"""
Look up a video's transcript by its YouTube link.

The workflow starts from "video: transcript + youtube link", but at post
generation time the only transcript-like material to hand was the retrieved
chunks, and those come from the whole corpus rather than this story's video.
When a story's own video had no chunks indexed, the research step fell back to
whichever chunks ranked highest and checked the claims against a completely
different video's words. That produced claims about vote-roll figures while the
story was about paper leaks.

The scraper already writes every transcript to backend/data/*_all_transcripts.txt
in this shape:

    ===== TITLE =====
    TITLE
    Link: https://www.youtube.com/watch?v=VIDEO_ID
    Published (UTC): 2026-08-06T15:30:34+00:00
    <transcript body>

so this module parses those files once and serves the right transcript by video
id. Anything not found returns empty, which the caller must treat as "no
transcript" rather than substituting another video's.
"""

from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Dict, Optional

logger = logging.getLogger(__name__)

_HEADER_RE = re.compile(r"^=====\s*(.*?)\s*=====\s*$", re.M)
_LINK_RE = re.compile(r"^Link:\s*(\S+)\s*$", re.M)

_cache: Optional[Dict[str, str]] = None
_cache_key: Optional[tuple] = None


def video_id(url: str) -> str:
    """The stable id inside any of the link forms the scraper produces."""
    u = (url or "").strip()
    if not u:
        return ""
    m = re.search(r"(?:v=|youtu\.be/|/live/|/shorts/|/embed/)([A-Za-z0-9_-]{6,})", u)
    return m.group(1) if m else ""


def _parse_file(path: Path) -> Dict[str, str]:
    """Split one transcripts file into {video_id: body}."""
    out: Dict[str, str] = {}
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError as exc:
        logger.warning("Could not read transcripts file %s: %s", path, exc)
        return out

    # Split on the ===== TITLE ===== separators, keeping each block's body.
    parts = _HEADER_RE.split(text)
    # split() with one capturing group gives [pre, title1, body1, title2, body2, ...]
    for i in range(1, len(parts) - 1, 2):
        body = parts[i + 1]
        link_m = _LINK_RE.search(body)
        if not link_m:
            continue
        vid = video_id(link_m.group(1))
        if not vid:
            continue
        # Drop the metadata lines; keep what the speaker actually said.
        lines = [
            ln for ln in body.splitlines()
            if ln.strip()
            and not ln.startswith("Link:")
            and not ln.startswith("Published (UTC):")
        ]
        if lines and lines[0].strip() == parts[i].strip():
            lines = lines[1:]          # the title repeats on its own line
        joined = "\n".join(lines).strip()
        if joined:
            out[vid] = joined
    return out


def _load(data_dir: Path) -> Dict[str, str]:
    """Parse every *_all_transcripts.txt, cached until a file changes."""
    global _cache, _cache_key
    files = sorted(data_dir.glob("*_all_transcripts.txt"))
    key = tuple((str(f), f.stat().st_mtime_ns) for f in files if f.is_file())
    if _cache is not None and key == _cache_key:
        return _cache

    merged: Dict[str, str] = {}
    for f in files:
        merged.update(_parse_file(f))
    _cache, _cache_key = merged, key
    logger.info("Loaded %d transcripts from %d file(s)", len(merged), len(files))
    return merged


def transcript_for_video(url: str, *, data_dir: Optional[Path] = None) -> str:
    """
    The transcript for this video, or "" when it is not on disk.

    Never guesses. An empty result means the caller has no transcript for this
    story, which is the honest state; substituting another video's words is what
    caused the bug this module exists to fix.
    """
    vid = video_id(url)
    if not vid:
        return ""
    base = data_dir or (Path(__file__).resolve().parents[1] / "data")
    return _load(base).get(vid, "")
