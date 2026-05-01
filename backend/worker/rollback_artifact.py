"""CLI: point ``current`` at the previous older directory under ``builds/``.

Run: ``python -m backend.worker.rollback_artifact``
"""

from __future__ import annotations

import argparse

from backend.worker.lock import artifact_build_lock
from backend.worker.paths import builds_dir, current_link_path, lock_file_path
from backend.worker.promote_util import promote_build_dir


def main() -> None:
    parser = argparse.ArgumentParser(description="Rollback current symlink to the previous build.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print target only; do not change symlinks.",
    )
    args = parser.parse_args()

    cur = current_link_path()
    if not cur.is_symlink():
        raise SystemExit("current is not a symlink; set it via promote after first build.")

    resolved = cur.resolve()
    all_builds = sorted([p for p in builds_dir().iterdir() if p.is_dir()], key=lambda p: p.name)
    if resolved not in all_builds:
        raise SystemExit("current does not point to a directory under builds/.")

    idx = all_builds.index(resolved)
    if idx <= 0:
        raise SystemExit("No older build available to roll back to.")

    prev = all_builds[idx - 1]
    if args.dry_run:
        print(f"Would promote: {prev}")
        return

    with artifact_build_lock(lock_file_path()):
        promote_build_dir(prev)
    print(f"OK current -> {prev}")


if __name__ == "__main__":
    main()
