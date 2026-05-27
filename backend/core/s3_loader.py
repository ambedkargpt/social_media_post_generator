"""
S3 artifact downloader for Lambda cold-start bootstrapping.

On a normal EC2/local server the artifact files live on disk already.
Inside Lambda there is no persistent disk, so this module downloads
each artifact from S3 to ``/tmp`` on the first cold start.

Usage (in pipeline_cli.py or anywhere that needs a local artifact path):

    from backend.core.s3_loader import ensure_artifact_local

    local_path = ensure_artifact_local(
        s3_key="artifacts/current/argument_chunks.json",
        local_path=Path("/tmp/artifacts/argument_chunks.json"),
    )

The function is a no-op (returns the path immediately) when:
  - the file already exists on disk, OR
  - S3_BUCKET env var is not set (local dev with local files).
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)


def _s3_client():
    """Return a boto3 S3 client, or None if boto3 / credentials unavailable."""
    try:
        import boto3  # type: ignore[import-untyped]
        return boto3.client("s3")
    except Exception as exc:
        logger.warning("boto3 unavailable — S3 download disabled: %s", exc)
        return None


def ensure_artifact_local(s3_key: str, local_path: Path) -> Path:
    """Ensure ``local_path`` exists, downloading from S3 if necessary.

    Args:
        s3_key:     Full S3 object key, e.g. ``artifacts/current/argument_chunks.json``.
        local_path: Target local path.  Parent directories are created automatically.

    Returns:
        ``local_path`` — whether the file was already present or freshly downloaded.

    Raises:
        FileNotFoundError: if the file is missing and S3_BUCKET is not configured.
        Exception:         if the S3 download fails.
    """
    if local_path.exists():
        return local_path

    bucket = (os.getenv("S3_BUCKET") or os.getenv("SPACES_BUCKET") or "").strip()
    if not bucket:
        # Running locally without S3 — caller will handle missing file
        logger.debug("S3_BUCKET not set and %s not found locally — skipping download.", local_path)
        return local_path

    client = _s3_client()
    if client is None:
        return local_path

    local_path.parent.mkdir(parents=True, exist_ok=True)
    logger.info("Cold-start S3 download: s3://%s/%s → %s", bucket, s3_key, local_path)
    client.download_file(bucket, s3_key, str(local_path))
    logger.info("Downloaded %s (%.1f KB)", local_path.name, local_path.stat().st_size / 1024)
    return local_path


def artifact_s3_key(filename: str) -> str:
    """Build the S3 key for a current-version artifact.

    Uses ``S3_ARTIFACT_PREFIX`` env var (default ``artifacts/current``).
    """
    prefix = (os.getenv("S3_ARTIFACT_PREFIX") or "artifacts/current").strip().strip("/")
    return f"{prefix}/{filename}"
