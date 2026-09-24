"""
Push the local pipeline state up to S3, once, before the watcher runs for real.

    python -m backend.scripts.seed_channel_state --dry-run
    python -m backend.scripts.seed_channel_state

Every run in AWS starts from `s3://<bucket>/state/channels/<name>/`. That prefix
is empty until something puts it there, and an empty prefix does not read as
"nothing ingested yet" in any harmless way: the first Batch job would see no
processed.json for any channel, treat the whole lookback window as new, and
spend the transcript budget refetching videos that are already on this machine.
With five channels that is enough requests to be refused partway, so the first
automated run would end with a rate limit and a half-filled feed.

This uploads what is already here — processed.json, the transcripts, the
consolidated and master transcript files, the video summaries — so the first run
in AWS starts where the last manual run left off.

Run it once, from the machine that has been doing the manual scrapes. Running it
again is safe but pointless: after the first automated run, AWS holds the newer
state and this would push an older copy over it.

Needs AWS credentials with write access to the bucket, and S3_BUCKET set.
"""
from __future__ import annotations

import argparse
import logging
import os
import sys
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(message)s")
log = logging.getLogger("seed")

PROJECT_ROOT = Path(__file__).resolve().parents[1]
CONFIG_DIR = PROJECT_ROOT / "config" / "channels"


def _human(size: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if size < 1024 or unit == "GB":
            return f"{size:.0f}{unit}" if unit == "B" else f"{size/1:.1f}{unit}"
        size /= 1024.0
    return f"{size:.1f}GB"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--channels", default="", help="Comma-separated subset; default is all.")
    parser.add_argument("--dry-run", action="store_true", help="List what would be uploaded.")
    args = parser.parse_args(argv)

    from backend.pipeline.orchestration import load_channel_config
    from backend.worker import channel_state

    if not channel_state.is_configured():
        log.error("S3_BUCKET is not set - nothing to seed into.")
        return 2

    available = sorted({p.stem for p in CONFIG_DIR.glob("*.json")} - {"template"})
    names = [n.strip() for n in args.channels.split(",") if n.strip()] or available
    unknown = [n for n in names if n not in available]
    if unknown:
        log.error("Unknown channel(s): %s", ", ".join(unknown))
        return 2

    log.info("bucket: s3://%s/%s", channel_state.bucket(), os.getenv("S3_STATE_PREFIX") or "state")
    total_files = 0
    total_bytes = 0

    for name in names:
        channel = load_channel_config(PROJECT_ROOT, name)
        log.info("\n%s", name)
        for key, path, is_dir in channel_state._members(channel):
            if is_dir:
                files = [p for p in path.rglob("*") if p.is_file()] if path.is_dir() else []
                size = sum(p.stat().st_size for p in files)
                log.info("  %-28s %4d file(s)  %8s  -> %s", path.name + "/", len(files), _human(size), key)
                total_files += len(files)
                total_bytes += size
            elif path.is_file():
                size = path.stat().st_size
                log.info("  %-28s %14s  -> %s", path.name, _human(size), key)
                total_files += 1
                total_bytes += size
            else:
                log.info("  %-28s %14s", path.name, "(absent)")

        if not args.dry_run:
            channel_state.push(channel)

    log.info("\n%s %d file(s), %s", "would upload" if args.dry_run else "uploaded", total_files, _human(total_bytes))
    if args.dry_run:
        log.info("Run again without --dry-run to upload.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
