"""
Regenerate a channel's news from transcripts already on disk.

The pipeline's news stage reads transcripts collected during that same run, so
changing a prompt normally means re-scraping to see the effect — expensive, and
YouTube rate-limits hard. This script rebuilds the news from the channel's
consolidated transcript file instead, so prompt changes can be applied to
material that has already been fetched.

Usage:
    python -m backend.scripts.regenerate_channel_news --channel congress
    python -m backend.scripts.regenerate_channel_news --channel congress --limit 3 --dry-run
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from backend.config import get_settings
from backend.pipeline.multi_news_generator import build_story_rows, latin_ratio
from backend.pipeline.news_generator import update_generated_news_rolling
from backend.pipeline.orchestration.channel_config import load_channel_config
from backend.pipeline.transcript_parser import parse_transcripts
from backend.repositories.news_repo import NewsRepository
from backend.services.news_migration import migrate_news
from backend.tenants import general_tenant, get_tenant


def _entries_from_consolidated(path: Path, limit: int | None) -> list[dict]:
    """Read the channel's consolidated transcript file into ingestion-style entries."""
    if not path.is_file():
        raise FileNotFoundError(f"Consolidated transcript not found: {path}")
    videos = parse_transcripts(path.read_text(encoding="utf-8"))
    entries: list[dict] = []
    for v in videos:
        title = (v.get("video_title") or "").strip()
        link = (v.get("video_link") or "").strip()
        text = (v.get("full_text") or v.get("transcript") or "").strip()
        if not title or not link or not text:
            continue
        entries.append({"title": title, "url": link, "transcript": text})
        if limit and len(entries) >= limit:
            break
    return entries


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--channel", default="congress")
    ap.add_argument("--limit", type=int, default=None, help="Only process the first N videos.")
    ap.add_argument("--dry-run", action="store_true", help="Generate and print, but do not write or publish.")
    ap.add_argument("--purge", action="store_true", help="Delete this tenant's existing news before publishing.")
    args = ap.parse_args(argv)

    project_root = Path(__file__).resolve().parent.parent
    settings = get_settings()
    channel = load_channel_config(project_root, args.channel)
    tenant = get_tenant(channel.tenant_slug) or general_tenant()

    entries = _entries_from_consolidated(channel.consolidated_txt_path, args.limit)
    print(f"Channel {channel.name}: {len(entries)} transcript(s) available.")
    if not entries:
        return 1

    rows = build_story_rows(
        settings, entries, max_stories=channel.stories_per_video, show_progress=True
    )
    print(f"Built {len(rows)} story rows from {len(entries)} video(s).")

    offenders = [r for r in rows if latin_ratio(f"{r['headline']} {r['subheadline']}") > 0.25]
    print(f"Rows still containing significant Latin text: {len(offenders)}")

    if args.dry_run:
        for r in rows[:10]:
            print()
            print("  TOPIC:", r.get("topic"))
            print("  HEAD :", r["headline"])
            print("  SUB  :", r["subheadline"][:140])
        return 0

    repo = NewsRepository()
    if args.purge:
        # Rebuilt stories may not map 1:1 onto the old ones, so clear the tenant's
        # existing rows rather than leaving orphans behind.
        deleted = repo.collection.delete_many({"tenant_id": tenant.tenant_id}).deleted_count
        print(f"Purged {deleted} existing '{tenant.slug}' item(s).")
        for p in (channel.generated_news_path, channel.generated_news_legacy_path):
            if p.is_file():
                p.write_text(json.dumps({"items": []}, ensure_ascii=False), encoding="utf-8")

    stats = update_generated_news_rolling(
        settings,
        rows,
        show_progress=True,
        generated_news_path=channel.generated_news_path,
        generated_news_legacy_path=channel.generated_news_legacy_path,
        pregenerated=True,
    )
    print("Rolling news:", stats)

    if not channel.generated_news_legacy_path.is_file():
        channel.generated_news_legacy_path.write_text(
            json.dumps({"items": []}, ensure_ascii=False), encoding="utf-8"
        )
    pub = migrate_news(
        repo,
        current_file=channel.generated_news_path,
        legacy_file=channel.generated_news_legacy_path,
        tenant=tenant,
    )
    print(f"Published: inserted={pub.inserted} updated={pub.updated} total={pub.deduped_count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
