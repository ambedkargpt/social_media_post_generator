"""POSIX advisory lock for single-writer artifact builds (Linux production)."""

from __future__ import annotations

import contextlib
from collections.abc import Generator
from pathlib import Path

try:
    import fcntl
except ImportError:  # Windows (dev): no flock; production worker is Linux.
    fcntl = None  # type: ignore[assignment]


@contextlib.contextmanager
def artifact_build_lock(lock_path: Path) -> Generator[None, None, None]:
    if fcntl is None:
        yield
        return
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    fp = open(lock_path, "a+", encoding="utf-8")
    try:
        fcntl.flock(fp.fileno(), fcntl.LOCK_EX)
        yield
    finally:
        fcntl.flock(fp.fileno(), fcntl.LOCK_UN)
        fp.close()
