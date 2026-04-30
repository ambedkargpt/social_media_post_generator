from __future__ import annotations

from dataclasses import asdict
from pathlib import Path
from typing import Iterable

from pipeline.orchestration.contracts import PipelineContext, StageResult
from pipeline.orchestration.state import (
    init_state,
    save_state,
    should_skip_stage,
    update_stage_state,
)
from pipeline.orchestration.stages import STAGE_DEPENDENCIES, STAGE_HANDLERS, stage_input_fingerprints


def _expand_dependencies(stages: Iterable[str]) -> list[str]:
    selected = set(stages)
    changed = True
    while changed:
        changed = False
        for stage in list(selected):
            for dep in STAGE_DEPENDENCIES.get(stage, []):
                if dep not in selected:
                    selected.add(dep)
                    changed = True
    ordered: list[str] = []
    for stage in STAGE_HANDLERS:
        if stage in selected:
            ordered.append(stage)
    return ordered


def resolve_stage_selection(
    *,
    only_stage: str | None,
    from_stage: str | None,
    to_stage: str | None,
) -> list[str]:
    all_stages = list(STAGE_HANDLERS.keys())
    if only_stage:
        if only_stage not in STAGE_HANDLERS:
            raise ValueError(f"Unknown stage: {only_stage}")
        return _expand_dependencies([only_stage])
    start_idx = all_stages.index(from_stage) if from_stage else 0
    end_idx = all_stages.index(to_stage) if to_stage else len(all_stages) - 1
    if start_idx > end_idx:
        raise ValueError("--from-stage must come before --to-stage")
    return all_stages[start_idx : end_idx + 1]


def run_pipeline(context: PipelineContext) -> dict:
    state = init_state(context.state_path, context.run_id, context.channel.name)
    context.runtime["results"] = []
    fp = stage_input_fingerprints(context)
    for stage_name in context.selected_stages:
        inputs = fp.get(stage_name, [])
        if should_skip_stage(state, stage_name, inputs, context.resume):
            result = StageResult(stage_name, "skipped", warnings=["resume-fingerprint-match"])
            context.runtime["results"].append(asdict(result))
            continue
        deps = STAGE_DEPENDENCIES.get(stage_name, [])
        blocked = [d for d in deps if not _is_success_or_skipped(state, d)]
        if blocked:
            result = StageResult(stage_name, "failed", errors=[f"blocked by dependency: {', '.join(blocked)}"])
            context.runtime["results"].append(asdict(result))
            state = update_stage_state(state, result, inputs)
            save_state(context.state_path, state)
            break
        handler = STAGE_HANDLERS[stage_name]
        try:
            result = handler(context)
        except Exception as exc:
            result = StageResult(stage_name, "failed", errors=[str(exc)])
        context.runtime["results"].append(asdict(result))
        state = update_stage_state(state, result, inputs)
        save_state(context.state_path, state)
        if result.status == "failed":
            break
    return state


def _is_success_or_skipped(state: dict, stage_name: str) -> bool:
    stage = (state.get("stages") or {}).get(stage_name) or {}
    return stage.get("status") in {"success", "skipped"}
