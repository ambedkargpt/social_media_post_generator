"""
Wait out YouTube's transcript rate limit, then scrape the window - unattended.

The transcript endpoint blocks by IP with no Retry-After header, so the only
way to know it has lifted is to ask. This probes cheaply until it clears, runs
both channels, and repeats if the run trips the limit again partway. Every pass
resumes: transcripts already on disk are skipped, so nothing is refetched and
each round only attempts what is still missing.

Safe to leave running overnight. Writes a timestamped log, and stops early once
both channels come back with nothing left to fetch.

    python -m backend.scripts.overnight_scrape
    python -m backend.scripts.overnight_scrape --probe-minutes 20 --max-rounds 8
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LOG = ROOT / "backend" / "outputs" / "overnight_scrape.log"
CHANNELS = ("congress", "samajwadi")

# A video that is known to exist and to have captions. Probing one known id is
# cheaper and more honest than trying a whole run to find out.
PROBE_VIDEO = "skfnSEaUkB4"


def log(msg: str) -> None:
    line = f"{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')}Z  {msg}"
    print(line, flush=True)
    try:
        LOG.parent.mkdir(parents=True, exist_ok=True)
        with LOG.open("a", encoding="utf-8") as fh:
            fh.write(line + "\n")
    except Exception:
        pass


def transcripts_available() -> bool:
    """One request. True when YouTube serves a transcript rather than a 429."""
    try:
        from backend.Fetch import fetch_transcript_text

        return bool(fetch_transcript_text(PROBE_VIDEO))
    except Exception as exc:
        log(f"  probe raised: {exc}")
        return False


def run_channel(channel: str) -> dict:
    """Run ingestion through publish for one channel. Returns its stage metrics."""
    log(f"  running pipeline: {channel}")
    proc = subprocess.run(
        [sys.executable, "-m", "backend.run_pipeline", "--channel", channel, "--only-stage", "news_publish"],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if proc.returncode != 0:
        log(f"  {channel}: pipeline exited {proc.returncode}")

    runs = sorted((ROOT / "backend" / "outputs" / "runs" / channel).glob("*.json"), reverse=True)
    if not runs:
        return {}
    try:
        stages = json.loads(runs[0].read_text(encoding="utf-8")).get("stages", {})
    except Exception:
        return {}

    ing = stages.get("ingestion", {}).get("metrics", {}) or {}
    pub = stages.get("news_publish", {}).get("metrics", {}) or {}
    log(
        f"  {channel}: queued={ing.get('queued_urls', 0)} "
        f"fetched={ing.get('cleaned_transcripts', 0)} "
        f"failures={ing.get('transcript_failures', 0)} "
        f"skipped_existing={ing.get('skipped_existing', 0)} "
        f"published={pub.get('inserted', 0)}"
    )
    return {"ingestion": ing, "publish": pub}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--probe-minutes", type=int, default=20, help="Gap between rate-limit probes.")
    ap.add_argument("--cool-off-minutes", type=int, default=45, help="Wait after a round that hit 429s.")
    ap.add_argument("--max-rounds", type=int, default=8, help="Give up after this many scrape rounds.")
    ap.add_argument("--max-wait-hours", type=int, default=14, help="Give up if the block never lifts.")
    args = ap.parse_args()

    log("=" * 70)
    log(f"overnight scrape starting - probe every {args.probe_minutes}m, up to {args.max_rounds} rounds")

    deadline = time.time() + args.max_wait_hours * 3600
    for rnd in range(1, args.max_rounds + 1):
        # --- wait for the limit to lift -------------------------------------
        waited = 0
        while not transcripts_available():
            if time.time() > deadline:
                log(f"giving up: still rate limited after {args.max_wait_hours}h")
                return
            waited += args.probe_minutes
            if waited % 120 == 0:          # a line every two hours, not every probe
                log(f"  still rate limited ({waited // 60}h)")
            time.sleep(args.probe_minutes * 60)

        log(f"round {rnd}: rate limit clear, scraping")

        # --- scrape ---------------------------------------------------------
        failures = 0
        published = 0
        for channel in CHANNELS:
            m = run_channel(channel)
            failures += int(m.get("ingestion", {}).get("transcript_failures", 0) or 0)
            published += int(m.get("publish", {}).get("inserted", 0) or 0)

        log(f"round {rnd} done: published={published} transcript_failures={failures}")

        if failures == 0:
            log("nothing left to fetch - finished")
            break

        if rnd < args.max_rounds:
            log(f"  {failures} still missing, cooling off {args.cool_off_minutes}m before the next round")
            time.sleep(args.cool_off_minutes * 60)

    # --- what the feed looks like now ---------------------------------------
    try:
        from backend.db.mongo import db

        for slug in CHANNELS:
            total = db["news"].count_documents({"tenant_slug": slug})
            fresh = db["news"].count_documents(
                {"tenant_slug": slug, "published_at": {"$gte": datetime(2026, 8, 28, tzinfo=timezone.utc)}}
            )
            log(f"final: {slug} total={total} published_since_28_Aug={fresh}")
    except Exception as exc:
        log(f"final count failed: {exc}")

    log("overnight scrape ended")


if __name__ == "__main__":
    main()
