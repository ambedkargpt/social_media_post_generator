"""
Carry a channel's pipeline state between Fargate runs, through S3.

A Batch container starts empty and is thrown away when it exits. The pipeline
does not expect that: `processed.json` is how it knows which videos it has
already ingested, and the transcript files on disk are how
`filter_already_downloaded_urls` avoids refetching them. Run the pipeline in a
fresh container with neither, and it does not fail — it quietly re-ingests the
whole lookback window every time, spends the transcript budget on videos it
already has, and republishes stories that already exist.

So every run pulls the channel's state in first and pushes it back at the end.
The layout mirrors the local one under a per-channel prefix:

    s3://<bucket>/<prefix>/channels/<name>/processed.json
    s3://<bucket>/<prefix>/channels/<name>/transcripts/…
    s3://<bucket>/<prefix>/channels/<name>/consolidated.txt
    s3://<bucket>/<prefix>/channels/<name>/master.txt
    s3://<bucket>/<prefix>/shared/<video summaries file>

Only state the *next* run needs is carried. Generated news is not here — it
goes to MongoDB, which is where the API reads it from.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path

log = logging.getLogger("channel_state")

# video_summaries.json is shared by several channels (ravish and the parties all
# write into data/video_summaries.json), so it is keyed by its filename rather
# than by channel. Pulling it per channel would have each run overwrite the
# previous channel's summaries.
_SHARED = "shared"


def _client():
    import boto3  # provided by the Lambda runtime and the worker image

    return boto3.client("s3")


def bucket() -> str:
    return (os.getenv("S3_BUCKET") or "").strip()


def _prefix() -> str:
    return (os.getenv("S3_STATE_PREFIX") or "state").strip().strip("/")


def _channel_prefix(name: str) -> str:
    return f"{_prefix()}/channels/{name}"


def is_configured() -> bool:
    """Without a bucket there is nowhere to carry state, so runs stay local."""
    return bool(bucket())


def _sync_down_file(client, key: str, dest: Path) -> bool:
    try:
        dest.parent.mkdir(parents=True, exist_ok=True)
        client.download_file(bucket(), key, str(dest))
        return True
    except Exception as exc:  # noqa: BLE001 - a missing object is the normal first run
        log.debug("no object at s3://%s/%s (%s)", bucket(), key, type(exc).__name__)
        return False


def _sync_down_prefix(client, key_prefix: str, dest_dir: Path) -> int:
    count = 0
    paginator = client.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket(), Prefix=key_prefix + "/"):
        for obj in page.get("Contents", []) or []:
            relative = obj["Key"][len(key_prefix) + 1 :]
            if not relative:
                continue
            target = dest_dir / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            client.download_file(bucket(), obj["Key"], str(target))
            count += 1
    return count


def _sync_up_file(client, source: Path, key: str) -> bool:
    if not source.is_file():
        return False
    client.upload_file(str(source), bucket(), key)
    return True


def _sync_up_prefix(client, source_dir: Path, key_prefix: str) -> int:
    if not source_dir.is_dir():
        return 0
    count = 0
    for path in source_dir.rglob("*"):
        if path.is_file():
            relative = path.relative_to(source_dir).as_posix()
            client.upload_file(str(path), bucket(), f"{key_prefix}/{relative}")
            count += 1
    return count


def _members(channel) -> list[tuple[str, Path, bool]]:
    """(key suffix, local path, is_directory) for everything worth carrying."""
    base = _channel_prefix(channel.name)

    # Named by role, not by filename. The consolidated and master transcripts
    # are different files that happen to share a basename
    # (outputs/…/ravishkumar_all_transcripts.txt and
    # data/ravishkumar_all_transcripts.txt), so keying on the name put both at
    # one key and silently lost whichever was uploaded first.
    return [
        (f"{base}/processed.json", channel.processed_json_path, False),
        (f"{base}/transcripts", channel.transcripts_dir, True),
        (f"{base}/consolidated.txt", channel.consolidated_txt_path, False),
        (f"{base}/master.txt", channel.master_transcript_path, False),
        # Shared on purpose: ravish and the parties all write into
        # data/video_summaries.json, so a per-channel key would have each run
        # overwrite the previous channel's summaries. Dalit Dastak has its own
        # file and therefore its own key, which the filename handles.
        (f"{_prefix()}/{_SHARED}/{channel.video_summaries_path.name}", channel.video_summaries_path, False),
    ]


def pull(channel) -> None:
    """Restore this channel's state from S3 before the pipeline runs."""
    if not is_configured():
        log.info("S3_BUCKET unset - running against local state only")
        return
    client = _client()
    for key, path, is_dir in _members(channel):
        if is_dir:
            n = _sync_down_prefix(client, key, path)
            log.info("pulled %d file(s) -> %s", n, path)
        elif _sync_down_file(client, key, path):
            log.info("pulled %s", path.name)


def push(channel) -> None:
    """
    Save this channel's state back to S3 after the pipeline runs.

    Called even when the run failed partway. A run that fetched four of six
    transcripts before being throttled has genuinely made progress, and
    discarding it would make the next run refetch those four — spending the
    transcript budget that was the scarce thing in the first place.
    """
    if not is_configured():
        return
    client = _client()
    for key, path, is_dir in _members(channel):
        if is_dir:
            n = _sync_up_prefix(client, path, key)
            log.info("pushed %d file(s) from %s", n, path.name)
        elif _sync_up_file(client, path, key):
            log.info("pushed %s", path.name)


def read_processed_ids(name: str) -> set[str]:
    """
    Which videos this channel has already ingested, read straight from S3.

    This is what lets the watcher decide whether there is anything to run for
    without starting a container. It reads the same processed.json the pipeline
    writes, so the two cannot drift.
    """
    if not is_configured():
        return set()
    import json

    from backend.pipeline import ingested

    try:
        body = _client().get_object(
            Bucket=bucket(), Key=f"{_channel_prefix(name)}/processed.json"
        )["Body"].read()
    except Exception:  # noqa: BLE001 - absent on the first run, which is not an error
        return set()
    try:
        return ingested.ids_from_payload(json.loads(body))
    except ValueError:
        return set()
