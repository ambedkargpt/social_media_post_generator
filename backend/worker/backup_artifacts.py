"""
Optional upload of the promoted ``current`` tree to S3-compatible storage (e.g. DigitalOcean Spaces).

Environment:
  - ``S3_ENDPOINT_URL`` or ``SPACES_ENDPOINT`` — e.g. ``https://nyc3.digitaloceanspaces.com``
  - ``S3_BUCKET`` or ``SPACES_BUCKET``
  - ``AWS_ACCESS_KEY_ID`` / ``AWS_SECRET_ACCESS_KEY`` (or ``SPACES_KEY`` / ``SPACES_SECRET``)
  - ``S3_ARTIFACT_PREFIX`` — key prefix (default ``artifacts``)
"""

from __future__ import annotations

import os
from pathlib import Path

from backend.worker.manifest import ARTIFACT_FILENAMES
from backend.worker.paths import artifacts_root, current_link_path


def _client():
    import boto3  # type: ignore[import-untyped]

    endpoint = (os.getenv("S3_ENDPOINT_URL") or os.getenv("SPACES_ENDPOINT") or "").strip()
    region = (os.getenv("S3_REGION") or os.getenv("SPACES_REGION") or "us-east-1").strip()
    key_id = (os.getenv("AWS_ACCESS_KEY_ID") or os.getenv("SPACES_KEY") or "").strip()
    secret = (os.getenv("AWS_SECRET_ACCESS_KEY") or os.getenv("SPACES_SECRET") or "").strip()
    if not endpoint or not key_id or not secret:
        return None
    session = boto3.session.Session()
    return session.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=key_id,
        aws_secret_access_key=secret,
        region_name=region,
    )


def backup_current_if_configured() -> bool:
    """Upload files under resolved ``current`` if bucket env is set. Returns True if upload ran."""
    bucket = (os.getenv("S3_BUCKET") or os.getenv("SPACES_BUCKET") or "").strip()
    if not bucket:
        return False

    cur = current_link_path()
    if not cur.is_symlink() and not cur.is_dir():
        return False
    base = cur.resolve()
    if not base.is_dir():
        return False

    client = _client()
    if client is None:
        return False

    prefix = (os.getenv("S3_ARTIFACT_PREFIX") or "artifacts").strip().strip("/")
    version = base.name
    key_prefix = f"{prefix}/{version}"

    manifest_name = "manifest.json"
    upload_names = [*ARTIFACT_FILENAMES, manifest_name]

    for name in upload_names:
        path = base / name
        if not path.is_file():
            continue
        key = f"{key_prefix}/{name}"
        extra: dict[str, str] = {}
        if os.getenv("S3_PUBLIC_READ", "").lower() in {"1", "true", "yes"}:
            extra["ACL"] = "public-read"
        if extra:
            client.upload_file(str(path), bucket, key, ExtraArgs=extra)
        else:
            client.upload_file(str(path), bucket, key)

    return True
