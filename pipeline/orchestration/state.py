from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from pipeline.orchestration.contracts import StageResult, utc_now_iso


def _fingerprint_paths(paths: list[Path]) -> str:
    hasher = hashlib.sha256()
    for path in sorted(paths, key=lambda p: str(p)):
        hasher.update(str(path).encode("utf-8"))
        if path.exists():
            stat = path.stat()
            hasher.update(str(stat.st_mtime_ns).encode("utf-8"))
            hasher.update(str(stat.st_size).encode("utf-8"))
    return hasher.hexdigest()


def load_state(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        return payload if isinstance(payload, dict) else {}
    except Exception:
        return {}


def save_state(path: Path, state: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def init_state(path: Path, run_id: str, channel_name: str) -> dict[str, Any]:
    existing = load_state(path)
    if existing:
        return existing
    state = {
        "run_id": run_id,
        "channel": channel_name,
        "started_at": utc_now_iso(),
        "updated_at": utc_now_iso(),
        "stages": {},
    }
    save_state(path, state)
    return state


def should_skip_stage(
    state: dict[str, Any],
    stage_name: str,
    fingerprint_inputs: list[Path],
    resume: bool,
) -> bool:
    if not resume:
        return False
    stage = (state.get("stages") or {}).get(stage_name) or {}
    if stage.get("status") != "success":
        return False
    prev_fp = str(stage.get("fingerprint") or "")
    if not prev_fp:
        return False
    return prev_fp == _fingerprint_paths(fingerprint_inputs)


def update_stage_state(
    state: dict[str, Any],
    result: StageResult,
    fingerprint_inputs: list[Path],
) -> dict[str, Any]:
    stages = state.setdefault("stages", {})
    stages[result.stage_name] = {
        "status": result.status,
        "metrics": result.metrics,
        "artifacts_written": result.artifacts_written,
        "warnings": result.warnings,
        "errors": result.errors,
        "fingerprint": _fingerprint_paths(fingerprint_inputs),
        "updated_at": utc_now_iso(),
    }
    state["updated_at"] = utc_now_iso()
    return state
