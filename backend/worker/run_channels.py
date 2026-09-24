"""
AWS Batch entry point: run the pipeline for the channels that have new videos.

    python -m backend.worker.run_channels --channels bjp,congress

This is what the watcher submits when a channel posts. It is the multi-channel
counterpart to auto_rebuild, which predates the channel configs and only knows
about Ravish.

Each channel is a separate pull → run → push, so one channel being throttled
leaves the others alone and each one's progress is saved whether or not the run
that follows it succeeds.

Environment:
    S3_BUCKET           required in production — where channel state is carried
    S3_STATE_PREFIX     default "state"
    WATCH_CHANNELS      comma-separated, used when --channels is not given
    YOUTUBE_PROXY_URL   see backend/Fetch.py — the transcript endpoint blocks
                        datacentre IPs, and this container has one
"""
from __future__ import annotations

import argparse
import logging
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%SZ",
)
log = logging.getLogger("run_channels")

PROJECT_ROOT = Path(__file__).resolve().parents[1]


def run_one(name: str) -> dict:
    """Pull state, run ingestion through publish, push state back."""
    from backend.config import get_settings
    from backend.pipeline.orchestration import load_channel_config, resolve_stage_selection, run_pipeline
    from backend.pipeline.orchestration.contracts import PipelineContext
    from backend.worker import channel_state

    channel = load_channel_config(PROJECT_ROOT, name)
    channel_state.pull(channel)

    run_id = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
    context = PipelineContext(
        project_root=PROJECT_ROOT,
        run_id=run_id,
        channel=channel,
        dry_run=False,
        resume=False,
        settings=get_settings(),
        state_path=PROJECT_ROOT / "outputs" / "runs" / name / f"{run_id}.json",
        # Everything ingestion through publish. rag_artifacts and
        # semrag_artifacts are not dependencies of news_publish and are rebuilt
        # on their own schedule by auto_rebuild.
        selected_stages=resolve_stage_selection(
            only_stage="news_publish", from_stage=None, to_stage=None
        ),
    )

    try:
        state = run_pipeline(context)
    finally:
        # Even a failed run has usually fetched something, and those transcripts
        # are the expensive part. Losing them would make the next run spend the
        # budget again on videos already on disk.
        channel_state.push(channel)

    stages = state.get("stages", {})
    failed = [k for k, v in stages.items() if (v or {}).get("status") == "failed"]
    ingestion = (stages.get("ingestion") or {}).get("metrics") or {}
    publish = (stages.get("news_publish") or {}).get("metrics") or {}
    log.info(
        "%s: fetched=%s failures=%s published=%s%s",
        name,
        ingestion.get("cleaned_transcripts", 0),
        ingestion.get("transcript_failures", 0),
        publish.get("inserted", 0),
        f" FAILED[{', '.join(failed)}]" if failed else "",
    )
    return {"channel": name, "failed": failed, "ingestion": ingestion, "publish": publish}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run the pipeline for one or more channels.")
    parser.add_argument("--channels", default="", help="Comma-separated channel names.")
    args = parser.parse_args(argv)

    raw = args.channels or os.getenv("WATCH_CHANNELS") or ""
    names = [n.strip() for n in raw.split(",") if n.strip()]
    if not names:
        log.error("No channels given. Pass --channels or set WATCH_CHANNELS.")
        return 2

    log.info("=== run_channels: %s ===", ", ".join(names))
    if not os.getenv("YOUTUBE_PROXY_URL") and not os.getenv("YOUTUBE_PROXY_WEBSHARE_USERNAME"):
        # Worth a line in CloudWatch rather than a silent zero-transcript run:
        # YouTube refuses datacentre addresses long before it refuses a home one.
        log.warning("No YouTube proxy configured - transcript fetches may be refused from AWS IPs.")

    results = []
    worst = 0
    for name in names:
        try:
            result = run_one(name)
            results.append(result)
            if result["failed"]:
                worst = 1
        except Exception as exc:  # noqa: BLE001 - one bad channel must not stop the rest
            log.exception("%s raised: %s", name, exc)
            results.append({"channel": name, "failed": ["exception"]})
            worst = 1

    published = sum(int((r.get("publish") or {}).get("inserted", 0) or 0) for r in results)
    log.info("=== done: %d channel(s), %d story(ies) published ===", len(results), published)
    return worst


if __name__ == "__main__":
    sys.exit(main())
