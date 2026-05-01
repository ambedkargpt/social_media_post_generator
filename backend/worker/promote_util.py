"""Atomic symlink promotion for ``current`` → build directory."""

from __future__ import annotations

import os
from pathlib import Path

from backend.worker.paths import current_link_path


def atomic_symlink_dir(target: Path, link_path: Path) -> None:
    """Replace ``link_path`` with a symlink to ``target`` (directory) atomically."""
    link_path.parent.mkdir(parents=True, exist_ok=True)
    tmp = link_path.with_name(".current_symlink_tmp")
    if tmp.exists() or tmp.is_symlink():
        tmp.unlink()
    os.symlink(target.resolve(), tmp, target_is_directory=True)
    os.replace(tmp, link_path)


def promote_build_dir(build_dir: Path) -> None:
    """Point ``ARTIFACTS_ROOT/current`` at ``build_dir``."""
    atomic_symlink_dir(build_dir.resolve(), current_link_path())
