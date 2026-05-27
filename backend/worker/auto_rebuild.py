"""
AWS Batch entry point: auto_rebuild

Full pipeline orchestrator for scheduled / triggered artifact rebuilds.

Flow:
  1.  Acquire S3-based distributed lock (prevents concurrent double-runs).
  2.  Download current artifacts + data files from S3 → /tmp (incremental caches
      reused so we only re-embed truly new chunks).
  3.  Optionally fetch new YouTube transcripts (FETCH_NEW_TRANSCRIPTS=1).
  4.  Run the full build pipeline (chunking → embedding → Pinecone upsert →
      SEMRAG graph → validate → manifest).
  5.  Upload all produced artifacts back to S3 under artifacts/current/.
  6.  Archive a versioned copy under artifacts/builds/<version>/.
  7.  Release the S3 lock.

S3 bucket layout (matches AWS_SERVERLESS_PLAN.md § 4.4):
  s3://<S3_BUCKET>/artifacts/current/          ← latest artifacts (Lambda reads here)
  s3://<S3_BUCKET>/artifacts/builds/<ver>/      ← versioned archives
  s3://<S3_BUCKET>/artifacts/locks/build.lock   ← distributed lock sentinel
  s3://<S3_BUCKET>/data/ravishkumar_all_transcripts.txt
  s3://<S3_BUCKET>/data/chunk_embedding_cache.json
  s3://<S3_BUCKET>/data/semrag_extraction_cache.json

Environment variables (injected by Batch job definition / SSM):
  S3_BUCKET                 required — artifact bucket name
  S3_ARTIFACT_PREFIX        default "artifacts"
  S3_DATA_PREFIX            default "data"
  ARTIFACTS_ROOT            default "/tmp/artifacts"
  TRANSCRIPT_MASTER_PATH    default "/tmp/data/ravishkumar_all_transcripts.txt"
  FETCH_NEW_TRANSCRIPTS     "1" to run YouTube transcript fetch before rebuild
  SKIP_SEMRAG               "1" to skip SEMRAG graph extraction (faster, RAG only)
  FORCE_FULL_REBUILD        "1" to delete local caches (forces full re-embed)
  LOCK_TIMEOUT_SECONDS      default 7200 (2 hours)
  GITHUB_RUN_ID             (informational, set by GitHub Actions trigger)
  GITHUB_SHA                (informational, set by GitHub Actions trigger)
"""

from __future__ import annotations

import json
import logging
import os
import shutil
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%SZ",
)
log = logging.getLogger("auto_rebuild")


# ── Helpers ──────────────────────────────────────────────────────────────────


def _env(name: str, default: str = "") -> str:
    return (os.getenv(name) or default).strip()


def _flag(name: str) -> bool:
    return _env(name).lower() in {"1", "true", "yes"}


def _s3_client():
    """Return a boto3 S3 client. Credentials come from the Batch task IAM role."""
    import boto3  # type: ignore[import-untyped]

    return boto3.client("s3", region_name="ap-south-1")


# ── S3 distributed lock ───────────────────────────────────────────────────────


def _lock_key(artifact_prefix: str) -> str:
    return f"{artifact_prefix}/locks/build.lock"


def acquire_s3_lock(client, bucket: str, lock_key: str, timeout_sec: int = 7200) -> bool:
    """
    Best-effort S3 lock using conditional PUT.

    S3 does not support atomic test-and-set, so we use a time-based sentinel:
    - Try to GET the lock object.  If it exists AND is younger than timeout_sec,
      someone else owns it → return False.
    - Otherwise PUT a new lock file (this can race, but Batch guarantees at-most-one
      concurrent job per queue at the job level; the lock adds defence-in-depth).
    """
    now = datetime.now(timezone.utc)
    try:
        resp = client.get_object(Bucket=bucket, Key=lock_key)
        body = json.loads(resp["Body"].read())
        locked_at = datetime.fromisoformat(body.get("locked_at", "1970-01-01T00:00:00+00:00"))
        age_sec = (now - locked_at).total_seconds()
        if age_sec < timeout_sec:
            log.warning(
                "Lock held by %s since %s (%.0f s ago) — aborting to avoid double-run.",
                body.get("run_id", "unknown"),
                body.get("locked_at"),
                age_sec,
            )
            return False
        log.info("Stale lock found (%.0f s old > %d s timeout) — taking over.", age_sec, timeout_sec)
    except client.exceptions.NoSuchKey:
        pass  # No lock exists — proceed
    except Exception as exc:
        log.warning("Could not read lock file (%s) — proceeding anyway.", exc)

    lock_body = json.dumps(
        {
            "locked_at": now.isoformat(),
            "run_id": _env("GITHUB_RUN_ID", f"batch-{int(now.timestamp())}"),
            "sha": _env("GITHUB_SHA", "unknown"),
        }
    ).encode()
    client.put_object(Bucket=bucket, Key=lock_key, Body=lock_body, ContentType="application/json")
    log.info("Lock acquired: s3://%s/%s", bucket, lock_key)
    return True


def release_s3_lock(client, bucket: str, lock_key: str) -> None:
    try:
        client.delete_object(Bucket=bucket, Key=lock_key)
        log.info("Lock released: s3://%s/%s", bucket, lock_key)
    except Exception as exc:
        log.warning("Failed to release S3 lock: %s", exc)


# ── S3 download / upload helpers ──────────────────────────────────────────────


def download_file(client, bucket: str, key: str, dest: Path) -> bool:
    """Download a single file from S3. Returns True if found, False if missing."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    try:
        client.download_file(bucket, key, str(dest))
        log.info("Downloaded s3://%s/%s → %s", bucket, key, dest)
        return True
    except Exception as exc:
        # botocore ClientError with 404 is the common case for missing files
        if "404" in str(exc) or "NoSuchKey" in str(exc):
            log.info("s3://%s/%s not found — skipping.", bucket, key)
        else:
            log.warning("Error downloading s3://%s/%s: %s", bucket, key, exc)
        return False


def upload_file(client, bucket: str, key: str, source: Path) -> None:
    client.upload_file(str(source), bucket, key)
    log.info("Uploaded %s → s3://%s/%s", source, bucket, key)


def download_current_artifacts(
    client, bucket: str, artifact_prefix: str, local_data_dir: Path
) -> None:
    """
    Pull files from s3://<bucket>/artifacts/current/ into local_data_dir.
    These serve as incremental caches (chunk_embedding_cache.json, semrag_extraction_cache.json, etc.)
    so the worker only processes new content.
    """
    from backend.worker.manifest import ARTIFACT_FILENAMES

    cache_files = (
        *ARTIFACT_FILENAMES,
        "manifest.json",
        "chunk_embedding_cache.json",
    )
    current_prefix = f"{artifact_prefix}/current"
    for name in cache_files:
        key = f"{current_prefix}/{name}"
        dest = local_data_dir / name
        download_file(client, bucket, key, dest)


def download_data_files(
    client, bucket: str, data_prefix: str, local_data_dir: Path
) -> Path:
    """
    Pull the transcript master + any additional data files from S3.
    Returns the path to the transcript master file.
    """
    transcript_name = "ravishkumar_all_transcripts.txt"
    transcript_key = f"{data_prefix}/{transcript_name}"
    transcript_dest = local_data_dir / transcript_name
    found = download_file(client, bucket, transcript_key, transcript_dest)
    if not found:
        # No transcript master in S3 yet — this is the very first run
        log.warning(
            "Transcript master not in S3 (%s). Relying on TRANSCRIPT_MASTER_PATH env var.",
            transcript_key,
        )
    return transcript_dest


def upload_artifacts(
    client, bucket: str, artifact_prefix: str, build_dir: Path, version: str
) -> None:
    """
    Upload all produced artifact files to:
      s3://<bucket>/artifacts/current/<file>         (latest, Lambda reads here)
      s3://<bucket>/artifacts/builds/<version>/<file> (versioned archive)
    """
    from backend.worker.manifest import ARTIFACT_FILENAMES

    upload_names = (*ARTIFACT_FILENAMES, "manifest.json")

    for name in upload_names:
        src = build_dir / name
        if not src.is_file():
            log.warning("Expected artifact not found: %s — skipping upload.", src)
            continue

        # Versioned archive copy
        versioned_key = f"{artifact_prefix}/builds/{version}/{name}"
        upload_file(client, bucket, versioned_key, src)

        # Promote to current (Lambda downloads from here on next cold start)
        current_key = f"{artifact_prefix}/current/{name}"
        upload_file(client, bucket, current_key, src)

    # Also upload incremental caches so the next worker run is fast
    local_data_dir = build_dir.parent  # caches were placed alongside build output
    for cache_name in ("chunk_embedding_cache.json",):
        cache_path = local_data_dir / cache_name
        if cache_path.is_file():
            upload_file(client, bucket, f"{artifact_prefix}/current/{cache_name}", cache_path)


# ── Optional: fetch new YouTube transcripts ───────────────────────────────────


def fetch_new_transcripts(transcript_master_path: Path) -> None:
    """
    Calls into Fetch.py's channel-fetch logic to download any new transcripts
    from the Ravish Kumar YouTube channel and append them to the master file.

    Only called when FETCH_NEW_TRANSCRIPTS=1.
    """
    log.info("Fetching new YouTube transcripts → %s", transcript_master_path)

    try:
        from backend.Fetch import (
            fetch_video_urls,
            RAVISH_CHANNEL_SLUG,
            RAVISH_DATA_TXT,
        )
    except ImportError as exc:
        log.error("Cannot import Fetch module: %s — skipping transcript fetch.", exc)
        return

    channel_url = f"https://www.youtube.com/@{RAVISH_CHANNEL_SLUG}"
    log.info("Fetching video list from %s ...", channel_url)
    video_urls = fetch_video_urls(channel_url)
    if not video_urls:
        log.warning("No video URLs returned — skipping fetch.")
        return

    log.info("Found %d videos. Fetching new transcripts ...", len(video_urls))

    # Import the per-video transcript logic
    try:
        from backend.Fetch import get_transcript, save_transcript_to_master_file  # type: ignore[attr-defined]
    except ImportError:
        # Older Fetch.py versions may not expose these — fall back to CLI subprocess
        log.warning("Transcript helpers not importable — using subprocess fallback.")
        import subprocess

        result = subprocess.run(
            [sys.executable, "-m", "backend.Fetch", "--channel", channel_url, "--no-rag"],
            check=False,
        )
        if result.returncode != 0:
            log.error("Fetch subprocess returned non-zero: %d", result.returncode)
        return

    new_count = 0
    for url in video_urls:
        try:
            transcript = get_transcript(url)
            if transcript:
                save_transcript_to_master_file(transcript, transcript_master_path)
                new_count += 1
        except Exception as exc:
            log.debug("Skipping %s: %s", url, exc)

    log.info("Fetch complete. %d new transcripts appended.", new_count)


# ── Main orchestrator ─────────────────────────────────────────────────────────


def run() -> int:
    """
    Returns 0 on success, non-zero on failure.
    """
    bucket = _env("S3_BUCKET")
    if not bucket:
        log.error("S3_BUCKET environment variable is required.")
        return 1

    artifact_prefix = _env("S3_ARTIFACT_PREFIX", "artifacts")
    data_prefix = _env("S3_DATA_PREFIX", "data")
    artifacts_root = Path(_env("ARTIFACTS_ROOT", "/tmp/artifacts"))
    local_data_dir = Path(_env("TRANSCRIPT_MASTER_PATH", "/tmp/data/ravishkumar_all_transcripts.txt")).parent
    lock_timeout = int(_env("LOCK_TIMEOUT_SECONDS", "7200"))

    started_at = datetime.now(timezone.utc)
    log.info("=== AmbedkarGPT Auto Rebuild ===")
    log.info("Bucket:          s3://%s", bucket)
    log.info("Artifact prefix: %s", artifact_prefix)
    log.info("SKIP_SEMRAG:     %s", _flag("SKIP_SEMRAG"))
    log.info("FORCE_FULL:      %s", _flag("FORCE_FULL_REBUILD"))
    log.info("FETCH_NEW:       %s", _flag("FETCH_NEW_TRANSCRIPTS"))

    client = _s3_client()
    lock_key = _lock_key(artifact_prefix)

    # ── Step 1: Acquire distributed lock ─────────────────────────────────────
    if not acquire_s3_lock(client, bucket, lock_key, lock_timeout):
        log.error("Could not acquire S3 lock — another rebuild is running. Exiting.")
        return 2

    try:
        # ── Step 2: Download current artifacts + data from S3 ─────────────────
        log.info("--- Step 2: Downloading artifacts from S3 ---")
        local_data_dir.mkdir(parents=True, exist_ok=True)
        download_current_artifacts(client, bucket, artifact_prefix, local_data_dir)
        transcript_path = download_data_files(client, bucket, data_prefix, local_data_dir)

        # Set env so build_artifacts.transcript_master_path() resolves correctly
        if transcript_path.is_file():
            os.environ["TRANSCRIPT_MASTER_PATH"] = str(transcript_path)

        # Move caches to the data directory that Fetch.py / pipeline expect
        _repoint_caches(local_data_dir)

        # ── Step 3: (Optional) Fetch new transcripts ──────────────────────────
        if _flag("FETCH_NEW_TRANSCRIPTS"):
            log.info("--- Step 3: Fetching new YouTube transcripts ---")
            fetch_new_transcripts(transcript_path)
        else:
            log.info("--- Step 3: Skipped (FETCH_NEW_TRANSCRIPTS not set) ---")

        # ── Step 4: Full build pipeline ───────────────────────────────────────
        log.info("--- Step 4: Running build pipeline ---")

        if _flag("FORCE_FULL_REBUILD"):
            log.info("FORCE_FULL_REBUILD set — removing incremental caches.")
            for cache in ("chunk_embedding_cache.json", "semrag_extraction_cache.json"):
                p = local_data_dir / cache
                if p.exists():
                    p.unlink()
                    log.info("Removed cache: %s", p)

        # Set ARTIFACTS_ROOT so build_artifacts writes into our controlled path
        os.environ["ARTIFACTS_ROOT"] = str(artifacts_root)

        from backend.worker.build_artifacts import run_build
        from backend.worker.lock import artifact_build_lock
        from backend.worker.paths import lock_file_path

        with artifact_build_lock(lock_file_path()):
            build_dir = run_build(
                promote=True,
                prune_keep=2,
                require_semrag=not _flag("SKIP_SEMRAG"),
            )

        version = build_dir.name
        log.info("Build complete: %s", build_dir)

        # ── Step 5: Upload artifacts to S3 ────────────────────────────────────
        log.info("--- Step 5: Uploading artifacts to S3 ---")
        upload_artifacts(client, bucket, artifact_prefix, build_dir, version)

        # Also upload updated transcript master + caches so next run stays fast
        if transcript_path.is_file():
            upload_file(
                client, bucket,
                f"{data_prefix}/ravishkumar_all_transcripts.txt",
                transcript_path,
            )

        # ── Done ──────────────────────────────────────────────────────────────
        elapsed = (datetime.now(timezone.utc) - started_at).total_seconds()
        log.info(
            "=== Rebuild complete in %.0f s (%.1f min). Version: %s ===",
            elapsed, elapsed / 60, version,
        )
        return 0

    except Exception:
        log.exception("Rebuild failed with unhandled exception.")
        return 1

    finally:
        # ── Step 7: Always release the lock ───────────────────────────────────
        release_s3_lock(client, bucket, lock_key)


def _repoint_caches(local_data_dir: Path) -> None:
    """
    The build pipeline looks for caches in backend/data/ by default.
    If we're running inside a container with no source tree,
    set env vars so the pipeline writes/reads caches from local_data_dir instead.
    """
    # These env vars are read by the embedding/SEMRAG pipeline modules
    cache_env_map = {
        "CHUNK_EMBEDDING_CACHE_PATH": "chunk_embedding_cache.json",
        "SEMRAG_EXTRACTION_CACHE_PATH": "semrag_extraction_cache.json",
    }
    for env_var, filename in cache_env_map.items():
        candidate = local_data_dir / filename
        if candidate.is_file() and not os.getenv(env_var):
            os.environ[env_var] = str(candidate)
            log.info("Cache repointed: %s → %s", env_var, candidate)


# ── Entry point ───────────────────────────────────────────────────────────────


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="AmbedkarGPT artifact auto-rebuild (AWS Batch entry point).")
    parser.add_argument(
        "--skip-semrag",
        action="store_true",
        help="Skip SEMRAG graph extraction (overrides SKIP_SEMRAG env var).",
    )
    parser.add_argument(
        "--fetch-new",
        action="store_true",
        help="Fetch new YouTube transcripts before rebuilding (overrides FETCH_NEW_TRANSCRIPTS env var).",
    )
    parser.add_argument(
        "--force-full",
        action="store_true",
        help="Delete incremental caches and re-embed everything (overrides FORCE_FULL_REBUILD env var).",
    )
    args = parser.parse_args()

    if args.skip_semrag:
        os.environ["SKIP_SEMRAG"] = "1"
    if args.fetch_new:
        os.environ["FETCH_NEW_TRANSCRIPTS"] = "1"
    if args.force_full:
        os.environ["FORCE_FULL_REBUILD"] = "1"

    sys.exit(run())


if __name__ == "__main__":
    main()
