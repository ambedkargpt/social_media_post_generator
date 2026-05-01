"""
Compatibility shim: pipeline scripts and ``uvicorn`` often import ``config`` from the repo root.

Single source of truth: :mod:`backend.config`.
"""

from backend.config import REPO_ROOT, Settings, effective_artifact_manifest_path, get_settings

__all__ = ["REPO_ROOT", "Settings", "effective_artifact_manifest_path", "get_settings"]
