"""
Remove the last N video blocks from consolidated transcript files, drop matching
processed.json rows, delete per-video .docx/.txt, trim video_summaries.json, then
rebuild RAG from data/ravishkumar_all_transcripts.txt.

Usage (from repo root):
  python scripts/undo_last_transcript_blocks.py --count 3
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))


def sanitize_filename(text: str) -> str:
    cleaned = text.replace("\n", "_").replace("\r", "_")
    return re.sub(r'[\\/*?:"<>|]', "", cleaned)[:80]


def split_consolidated(text: str) -> tuple[str, list[tuple[str, str]]]:
    parts = re.split(r"^===== (.+) =====\s*\n", text, flags=re.MULTILINE)
    preamble = parts[0]
    blocks: list[tuple[str, str]] = []
    i = 1
    while i + 1 < len(parts):
        blocks.append((parts[i].strip(), parts[i + 1]))
        i += 2
    return preamble, blocks


def join_consolidated(preamble: str, blocks: list[tuple[str, str]]) -> str:
    out = preamble
    for title, body in blocks:
        out += f"===== {title} =====\n{body}"
    return out


def link_and_id_from_block_body(body: str) -> tuple[str | None, str | None]:
    for line in body.splitlines():
        if line.strip().lower().startswith("link:"):
            url = line.split(":", 1)[1].strip()
            m = re.search(r"[?&]v=([A-Za-z0-9_-]{6,})", url) or re.search(
                r"youtu\.be/([A-Za-z0-9_-]{6,})", url
            )
            vid = m.group(1) if m else None
            return url, vid
    return None, None


def main() -> int:
    parser = argparse.ArgumentParser(description="Undo last N consolidated transcript videos.")
    parser.add_argument("--count", type=int, default=3, help="Number of trailing blocks to remove.")
    args = parser.parse_args()
    n = args.count
    if n < 1:
        print("count must be >= 1")
        return 1

    master = _ROOT / "data" / "ravishkumar_all_transcripts.txt"
    channel_copy = _ROOT / "outputs" / "transcripts" / "ravishkumar.official" / "ravishkumar_all_transcripts.txt"
    processed_path = _ROOT / "outputs" / "transcripts" / "ravishkumar.official" / "processed.json"
    summary_path = _ROOT / "data" / "video_summaries.json"
    out_dir = _ROOT / "outputs" / "transcripts" / "ravishkumar.official"

    text = master.read_text(encoding="utf-8")
    preamble, blocks = split_consolidated(text)
    if len(blocks) < n:
        print(f"Only {len(blocks)} blocks in master; cannot remove {n}.")
        return 1

    drop = blocks[-n:]
    keep = blocks[:-n]
    drop_ids: set[str] = set()
    drop_urls: set[str] = set()
    drop_titles: list[str] = []

    for title, body in drop:
        drop_titles.append(title)
        url, vid = link_and_id_from_block_body(body)
        if url:
            drop_urls.add(url)
        if vid:
            drop_ids.add(vid)

    print("Removing last", n, "block(s):")
    for t in drop_titles:
        print(" -", t[:72] + ("…" if len(t) > 72 else ""))

    new_text = join_consolidated(preamble, keep)
    master.write_text(new_text, encoding="utf-8")
    print("Wrote:", master)
    if channel_copy.exists():
        channel_copy.write_text(new_text, encoding="utf-8")
        print("Wrote:", channel_copy)

    if processed_path.exists():
        records = json.loads(processed_path.read_text(encoding="utf-8"))
        if isinstance(records, list):
            filtered = [r for r in records if isinstance(r, dict) and r.get("id") not in drop_ids]
            removed_n = len(records) - len(filtered)
            filtered.sort(key=lambda r: (r.get("title") or "", r.get("id") or ""))
            processed_path.write_text(
                json.dumps(filtered, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            print(f"processed.json: removed {removed_n} record(s), {len(filtered)} remain.")
        else:
            print("processed.json: unexpected shape, skipped.")

    for title in drop_titles:
        base = sanitize_filename(title)
        for ext in (".docx", ".txt"):
            p = out_dir / f"{base}{ext}"
            if p.exists():
                p.unlink()
                print("Deleted:", p.name)

    if summary_path.exists():
        from pipeline.video_summarizer import load_summary_cache, save_summary_cache, summary_cache_key

        cache = load_summary_cache(summary_path)
        to_del: set[str] = set()
        for k, ent in cache.items():
            if isinstance(ent, dict) and ent.get("video_link") in drop_urls:
                to_del.add(k)
        for title, body in drop:
            url, _ = link_and_id_from_block_body(body)
            if url:
                to_del.add(summary_cache_key(title, url))
        removed_s = 0
        for k in to_del:
            if k in cache:
                del cache[k]
                removed_s += 1
        save_summary_cache(summary_path, cache)
        print(f"video_summaries.json: removed {removed_s} cache entr(y/ies).")

    from Fetch import rebuild_rag_artifacts_from_data_file

    print("Rebuilding RAG from updated master file…")
    rebuild_rag_artifacts_from_data_file(master)
    print("Done. Re-run Fetch.py to download those videos again (with date metadata).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
