"""
Lambda that starts the day's radio builds.

One EventBridge rule fires this once a day, after the last ingest, and it
submits one AWS Batch job per party. Each job builds that party's bulletin
from the stories already in `news` and writes it to
`s3://<bucket>/radio/<tenant>/`.

Separate from watch_handler, which polls YouTube every few minutes for new
videos. The two share nothing but the Batch queue: different schedules,
different job definitions, different failure meanings. Folding the radio into
the watcher would mean a ten-minute poll carrying a once-a-day branch.

Environment:
    BATCH_JOB_QUEUE         e.g. ambedkargpt-worker-queue
    RADIO_JOB_DEFINITION    e.g. ambedkargpt-radio
    RADIO_TENANTS           optional, comma-separated; default is all four

Build order does not matter. General news is folded into every party's
bulletin, and whichever job narrates a General story first caches the audio
for the others - so the cost is paid once however they interleave.
"""
from __future__ import annotations

import logging
import os
from datetime import UTC, datetime

log = logging.getLogger(__name__)
if not log.handlers:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

# The four streams Bheem Radio builds, matching its own `daily_tenants`.
DEFAULT_TENANTS = ("congress", "bjp", "samajwadi", "general")


def _batch():
    # Imported inside the function so this module can be imported, and tested,
    # without boto3 present - CI installs requirements-api.txt only.
    import boto3

    return boto3.client("batch")


def tenants_from_env() -> list[str]:
    raw = (os.getenv("RADIO_TENANTS") or "").strip()
    if not raw:
        return list(DEFAULT_TENANTS)
    return [t.strip() for t in raw.split(",") if t.strip()]


def handler(event=None, context=None) -> dict:  # noqa: ARG001 - Lambda signature
    queue = (os.getenv("BATCH_JOB_QUEUE") or "").strip()
    definition = (os.getenv("RADIO_JOB_DEFINITION") or "").strip()

    missing = [n for n, v in (("BATCH_JOB_QUEUE", queue),
                              ("RADIO_JOB_DEFINITION", definition)) if not v]
    if missing:
        log.error("not configured: %s", ", ".join(missing))
        return {"ok": False, "error": f"missing {', '.join(missing)}"}

    batch = _batch()
    stamp = datetime.now(UTC).strftime("%Y%m%d")
    submitted, failed = [], []

    for tenant in tenants_from_env():
        try:
            job = batch.submit_job(
                jobName=f"radio-{tenant}-{stamp}",
                jobQueue=queue,
                jobDefinition=definition,
                parameters={"tenant": tenant},
            )
        except Exception as exc:  # noqa: BLE001 - one party must not stop the rest
            # A party whose job could not even be submitted keeps yesterday's
            # bulletin on air, which is the same outcome as a build that finds
            # no news. Worth an error line, not worth failing the others.
            log.exception("could not submit the %s radio job", tenant)
            failed.append({"tenant": tenant, "error": f"{type(exc).__name__}: {exc}"[:300]})
            continue
        log.info("submitted radio job for %s: %s", tenant, job.get("jobId"))
        submitted.append({"tenant": tenant, "jobId": job.get("jobId")})

    return {"ok": not failed, "submitted": submitted, "failed": failed}
