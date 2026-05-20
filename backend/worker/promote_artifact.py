"""CLI: validate an existing build directory and promote ``current`` → it.

Run: ``python -m backend.worker.promote_artifact --from /data/artifacts/builds/<ver>``
"""

from __future__ import annotations

import argparse
from pathlib import Path

from datetime import datetime, timezone

from backend.worker.git_ops import git_sha_short
from backend.worker.lock import artifact_build_lock
from backend.worker.manifest import write_manifest
from backend.worker.paths import lock_file_path
from backend.worker.promote_util import promote_build_dir
from backend.worker.validate import manifest_matches_disk, validate_build_dir


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate a build dir and atomically promote current.")
    parser.add_argument(
        "--from",
        dest="build_dir",
        type=Path,
        required=True,
        help="Path to a version directory under ARTIFACTS_ROOT/builds/",
    )
    parser.add_argument("--skip-semrag-check", action="store_true")
    args = parser.parse_args()
    bd = args.build_dir.resolve()
    if not bd.is_dir():
        raise SystemExit(f"Not a directory: {bd}")

    ok, errors = validate_build_dir(bd, require_semrag=not args.skip_semrag_check)
    if not ok:
        raise SystemExit(f"Validation failed: {errors}")

    man = bd / "manifest.json"
    if man.is_file():
        m_ok, m_err = manifest_matches_disk(bd)
        if not m_ok:
            raise SystemExit(f"Manifest verification failed: {m_err}")
    else:
        write_manifest(
            bd,
            git_sha=git_sha_short(),
            started_at=datetime.now(timezone.utc).isoformat(),
            extra={"promoted_manual": True},
        )
        m_ok, m_err = manifest_matches_disk(bd)
        if not m_ok:
            raise SystemExit(f"Manifest verification failed: {m_err}")

    with artifact_build_lock(lock_file_path()):
        promote_build_dir(bd)
    print(f"OK promoted current -> {bd}")


if __name__ == "__main__":
    main()
