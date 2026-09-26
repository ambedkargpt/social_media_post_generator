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
import os
import re
import tempfile
import time
from pathlib import Path
from typing import Dict, Optional

logger = logging.getLogger(__name__)

_HEADER_RE = re.compile(r"^=====\s*(.*?)\s*=====\s*$", re.M)
_LINK_RE = re.compile(r"^Link:\s*(\S+)\s*$", re.M)

# Parsed transcripts per directory. Keyed by directory because there are two:
# the one baked into the image and the one pulled from S3 for stories scraped
# since the last deploy.
_cache: Dict[str, Dict[str, str]] = {}
_cache_key: Dict[str, tuple] = {}

# Where S3 masters are cached. /tmp on Lambda, which survives while a container
# is warm and is discarded with it.
_S3_CACHE_DIR = Path(os.getenv("TRANSCRIPT_CACHE_DIR") or (Path(tempfile.gettempdir()) / "transcripts"))

# Do not re-download on every miss. A video that is genuinely not in any master
# - a story whose transcript failed to fetch - would otherwise pull every
# master again for each post written about it.
_S3_REFRESH_SECONDS = float(os.getenv("TRANSCRIPT_S3_REFRESH_SECONDS", "300"))
_s3_last_refresh = 0.0


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
    """Parse every *_all_transcripts.txt in one directory, cached until a file changes."""
    slot = str(data_dir)
    if not data_dir.is_dir():
        return {}
    files = sorted(data_dir.glob("*_all_transcripts.txt"))
    key = tuple((str(f), f.stat().st_mtime_ns) for f in files if f.is_file())
    if _cache.get(slot) is not None and key == _cache_key.get(slot):
        return _cache[slot]

    merged: Dict[str, str] = {}
    for f in files:
        merged.update(_parse_file(f))
    _cache[slot], _cache_key[slot] = merged, key
    logger.info("Loaded %d transcripts from %d file(s) in %s", len(merged), len(files), data_dir)
    return merged


def _refresh_from_s3(want: str = "") -> bool:
    """
    Pull each channel's master transcript out of S3 into the cache directory.

    The image only carries what was committed when it was built, so a story
    scraped since the last deploy has no transcript in it and research is
    skipped for exactly the stories that are newest. The pipeline already
    writes every master to s3://<bucket>/<prefix>/channels/<name>/master.txt,
    so this reads what is there rather than waiting for a redeploy.

    Smallest master first, stopping as soon as `want` turns up. The five
    together are about 68 MB and Ravish alone is 57 of it, so pulling them all
    to answer a question about a three megabyte BJP story would spend ten times
    the bandwidth and time for nothing.

    Returns whether anything was downloaded. Never raises: no transcript is a
    state the caller already handles, and a research step is not worth failing
    a post over.
    """
    global _s3_last_refresh

    bucket = (os.getenv("S3_BUCKET") or "").strip()
    if not bucket:
        return False
    now = time.time()
    if now - _s3_last_refresh < _S3_REFRESH_SECONDS:
        return False
    _s3_last_refresh = now

    prefix = (os.getenv("S3_STATE_PREFIX") or "state").strip().strip("/")
    try:
        import boto3

        s3 = boto3.client("s3")
        _S3_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        masters = [
            obj
            for page in s3.get_paginator("list_objects_v2").paginate(
                Bucket=bucket, Prefix=f"{prefix}/channels/"
            )
            for obj in (page.get("Contents", []) or [])
            if obj["Key"].endswith("/master.txt")
        ]
        masters.sort(key=lambda o: o["Size"])

        got = 0
        for obj in masters:
            channel = obj["Key"].split("/")[-2]
            # The name has to end in _all_transcripts.txt: that is the glob
            # _load walks, and reusing it means the S3 copies are parsed by
            # exactly the same code as the committed ones.
            dest = _S3_CACHE_DIR / f"{channel}_all_transcripts.txt"
            if dest.exists() and dest.stat().st_size == obj["Size"]:
                continue              # same bytes already here
            s3.download_file(bucket, obj["Key"], str(dest))
            got += 1
            if want and want in _parse_file(dest):
                logger.info(
                    "Pulled %d master transcript(s) from s3://%s/%s/channels/; %s found in %s",
                    got, bucket, prefix, want, dest.name,
                )
                return True
        if got:
            logger.info("Pulled %d master transcript(s) from s3://%s/%s/channels/", got, bucket, prefix)
        return bool(got)
    except Exception as exc:  # noqa: BLE001 - see the docstring
        logger.warning("Could not refresh transcripts from S3: %s", exc)
        return False


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
    if data_dir is not None:
        return _load(data_dir).get(vid, "")

    # The image first: it holds everything committed up to the last deploy,
    # which is nearly every story and costs no network.
    baked = Path(__file__).resolve().parents[1] / "data"
    hit = _load(baked).get(vid, "")
    if hit:
        return hit

    # Only on a miss, and only when S3 is configured, is it worth looking for a
    # transcript newer than the image. This is the path a story scraped today
    # takes; everything older is already answered above.
    hit = _load(_S3_CACHE_DIR).get(vid, "")
    if hit:
        return hit
    if _refresh_from_s3(vid):
        return _load(_S3_CACHE_DIR).get(vid, "")
    return ""
