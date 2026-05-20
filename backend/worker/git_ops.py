"""Git metadata helpers for manifest provenance."""

from __future__ import annotations

import subprocess
from pathlib import Path

from backend.config import REPO_ROOT


def git_sha_short(repo_root: Path | None = None) -> str:
    root = repo_root or REPO_ROOT
    try:
        out = subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=root,
            stderr=subprocess.DEVNULL,
            text=True,
        )
        return (out.strip() or "unknown")
    except Exception:
        return "unknown"
