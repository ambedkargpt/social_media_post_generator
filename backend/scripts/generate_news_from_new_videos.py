"""
One-shot script: generate news from the 17 newly fetched videos.

Steps:
  1. Read new video URLs from data/new_video_urls.txt
  2. Get video metadata (title, upload dates) via yt-dlp
  3. Extract transcripts from the master file
  4. Generate DeepSeek summaries for each video
  5. Generate DeepSeek headlines + subheadlines
  6. Publish to MongoDB via news_migration

Run from repo root:
  python -m backend.scripts.generate_news_from_new_videos
"""

from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

import os
os.environ.setdefault("PYTHONUTF8", "1")

# Load .env
from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

from backend.config import get_settings
from backend.pipeline.video_summarizer import (
    deepseek_chat_client,
    get_or_create_video_summary,
    load_summary_cache,
    save_summary_cache,
    summary_cache_key,
)
from backend.pipeline.news_generator import update_generated_news_rolling
from backend.repositories.news_repo import NewsRepository
from backend.services.news_migration import migrate_news


# ── Paths ──────────────────────────────────────────────────────────────────────
NEW_URLS_FILE      = ROOT / "data" / "new_video_urls.txt"
MASTER_TRANSCRIPT  = ROOT / "data" / "ravishkumar_all_transcripts.txt"
SUMMARIES_CACHE    = ROOT / "data" / "video_summaries.json"
GENERATED_NEWS     = ROOT / "backend" / "outputs" / "generated_news.json"
GENERATED_LEGACY   = ROOT / "backend" / "outputs" / "generated_news_legacy.json"
PROMPTS_DIR        = ROOT / "backend" / "prompts"


def extract_transcripts_from_master(master_path: Path, urls: list[str]) -> dict[str, dict]:
    """Extract title + transcript for each URL from the master transcript file."""
    content = master_path.read_text(encoding="utf-8", errors="replace")

    # Split on video separators (===== Title =====)
    sections = re.split(r"\n(?====== .+ =====)", content)

    url_to_data: dict[str, dict] = {}
    for section in sections:
        link_match = re.search(r"Link:\s*(https://www\.youtube\.com/watch\?v=[a-zA-Z0-9_-]+)", section)
        if not link_match:
            continue
        url = link_match.group(1).strip()
        if url not in urls:
            continue

        title_match = re.match(r"=====\s*(.+?)\s*=====", section.strip())
        title = title_match.group(1).strip() if title_match else f"Video {url[-11:]}"

        # Transcript = everything after the Link: line
        link_pos = section.find(link_match.group(0)) + len(link_match.group(0))
        transcript = section[link_pos:].strip()

        url_to_data[url] = {"title": title, "transcript": transcript}

    return url_to_data


def get_video_metadata(urls: list[str]) -> dict[str, dict]:
    """Fetch upload dates from yt-dlp for the given URLs."""
    from yt_dlp import YoutubeDL
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
    }
    meta: dict[str, dict] = {}
    print(f"Fetching metadata for {len(urls)} videos via yt-dlp...")
    with YoutubeDL(ydl_opts) as ydl:
        for i, url in enumerate(urls, 1):
            try:
                info = ydl.extract_info(url, download=False)
                vid_meta: dict = {}
                ud = info.get("upload_date")
                if ud and isinstance(ud, str) and len(ud) == 8:
                    vid_meta["upload_date"] = ud
                ts = info.get("timestamp")
                if ts is not None:
                    from datetime import datetime, timezone
                    vid_meta["upload_timestamp"] = int(ts)
                    vid_meta["upload_datetime_utc"] = datetime.fromtimestamp(int(ts), tz=timezone.utc).isoformat()
                meta[url] = vid_meta
                print(f"  [{i}/{len(urls)}] {url[-11:]} — {vid_meta.get('upload_date', '?')}")
                time.sleep(0.5)
            except Exception as e:
                print(f"  [{i}/{len(urls)}] {url[-11:]} — metadata error: {e}")
                meta[url] = {}
    return meta


def run():
    settings = get_settings()

    # 1. Load new video URLs (only the 17 that had transcripts)
    if not NEW_URLS_FILE.exists():
        print("No new_video_urls.txt found — run the transcript fetch script first.")
        return

    all_new_urls = [u.strip() for u in NEW_URLS_FILE.read_text(encoding="utf-8").splitlines() if u.strip()]
    print(f"New video URLs total: {len(all_new_urls)}")

    # 2. Extract transcripts from master file
    print("\nExtracting transcripts from master file...")
    url_to_transcript = extract_transcripts_from_master(MASTER_TRANSCRIPT, set(all_new_urls))
    urls_with_transcripts = [u for u in all_new_urls if u in url_to_transcript]
    print(f"Found transcripts for: {len(urls_with_transcripts)} / {len(all_new_urls)} videos")

    if not urls_with_transcripts:
        print("No transcripts found for new videos.")
        return

    # 3. Fetch video metadata (upload dates)
    metadata = get_video_metadata(urls_with_transcripts)

    # 4. Build entries list
    entries = []
    for url in urls_with_transcripts:
        data = url_to_transcript[url]
        meta = metadata.get(url, {})
        entry = {
            "title": data["title"],
            "url": url,
            "transcript": data["transcript"],
        }
        entry.update(meta)
        entries.append(entry)

    print(f"\nBuilt {len(entries)} entries for summarization")

    # 5. Generate summaries via DeepSeek
    print("\n── Step 1: Video Summarization (DeepSeek) ──")
    SUMMARIES_CACHE.parent.mkdir(parents=True, exist_ok=True)
    cache = load_summary_cache(SUMMARIES_CACHE)
    client = deepseek_chat_client(settings)
    model  = settings.deepseek_summary_model
    new_rows = []

    for i, entry in enumerate(entries, 1):
        title = entry["title"]
        url = entry["url"]
        transcript = entry["transcript"]
        print(f"  [{i}/{len(entries)}] {title[:55]}...")

        key = summary_cache_key(title, url)
        had_summary = bool(cache.get(key, {}).get("summary_text"))

        get_or_create_video_summary(
            client=client,
            model=model,
            cache_entries=cache,
            video_title=title,
            video_link=url,
            full_text=transcript,
            target_words=190,
            prompts_dir=PROMPTS_DIR,
        )

        if not had_summary:
            created = cache.get(key, {})
            if created.get("summary_text"):
                row = {
                    "video_title": title,
                    "video_link": url,
                    "summary_text": created["summary_text"],
                }
                for k in ("upload_timestamp", "upload_datetime_utc", "upload_date"):
                    if entry.get(k) is not None:
                        row[k] = entry[k]
                new_rows.append(row)
                print(f"      → Summary: {len(created['summary_text'].split())} words")

    save_summary_cache(SUMMARIES_CACHE, cache)
    print(f"\nSummaries generated: {len(new_rows)}")

    if not new_rows:
        print("No new summaries — nothing to generate news for.")
        return

    # 6. Generate headlines + subheadlines
    print("\n── Step 2: News Headline Generation (DeepSeek) ──")
    GENERATED_NEWS.parent.mkdir(parents=True, exist_ok=True)
    stats = update_generated_news_rolling(settings, new_rows, show_progress=True)
    print(f"News stats: {stats}")

    # 7. Publish to MongoDB
    print("\n── Step 3: Publishing to MongoDB ──")
    if not GENERATED_NEWS.exists():
        print("generated_news.json not found — skipping publish.")
        return

    legacy_path = GENERATED_LEGACY if GENERATED_LEGACY.exists() else None

    # Create empty legacy if doesn't exist (migrate_news requires it)
    if not GENERATED_LEGACY.exists():
        GENERATED_LEGACY.write_text(json.dumps({"items": []}), encoding="utf-8")

    repo = NewsRepository()
    pub_stats = migrate_news(repo, current_file=GENERATED_NEWS, legacy_file=GENERATED_LEGACY)
    print(f"Published: {pub_stats.inserted} inserted, {pub_stats.updated} updated")
    print("\nDone! Latest news is now in MongoDB.")


if __name__ == "__main__":
    run()
