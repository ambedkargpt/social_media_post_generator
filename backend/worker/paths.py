"""Filesystem layout under ``ARTIFACTS_ROOT`` (default ``/data/artifacts``)."""

from __future__ import annotations

import os
from pathlib import Path


def artifacts_root() -> Path:
    raw = (os.getenv("ARTIFACTS_ROOT") or "/data/artifacts").strip()
    return Path(raw).expanduser().resolve()


def builds_dir() -> Path:
    return artifacts_root() / "builds"


def current_link_path() -> Path:
    return artifacts_root() / "current"


def locks_dir() -> Path:
    raw = (os.getenv("ARTIFACTS_LOCKS_DIR") or "/data/locks").strip()
    return Path(raw).expanduser().resolve()


def lock_file_path() -> Path:
    return locks_dir() / "artifact_build.lock"
