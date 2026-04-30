from __future__ import annotations

import argparse
from datetime import datetime, timezone
from pathlib import Path

from config import get_settings
from pipeline.orchestration import load_channel_config, resolve_stage_selection, run_pipeline
from pipeline.orchestration.contracts import PipelineContext
from pipeline.orchestration.stages import STAGE_DEPENDENCIES, STAGE_HANDLERS


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run the production pipeline orchestrator.")
    parser.add_argument("--channel", default="ravish", help="Channel config name under config/channels/*.json")
    parser.add_argument("--from-stage", choices=list(STAGE_HANDLERS.keys()))
    parser.add_argument("--to-stage", choices=list(STAGE_HANDLERS.keys()))
    parser.add_argument("--only-stage", choices=list(STAGE_HANDLERS.keys()))
    parser.add_argument("--resume", action="store_true", help="Resume previous stage state when fingerprints match.")
    parser.add_argument("--dry-run", action="store_true", help="Print stage execution graph without mutations.")
    parser.add_argument("--plan", action="store_true", help="Alias of --dry-run for operator ergonomics.")
    parser.add_argument("--run-id", default="", help="Optional run id override.")
    return parser


def _print_plan(stages: list[str]) -> None:
    print("Pipeline execution plan:")
    for stage in stages:
        deps = STAGE_DEPENDENCIES.get(stage, [])
        dep_txt = ", ".join(deps) if deps else "none"
        print(f" - {stage} (depends_on={dep_txt})")


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    project_root = Path(__file__).resolve().parent
    settings = get_settings()
    channel = load_channel_config(project_root, args.channel)
    selected_stages = resolve_stage_selection(
        only_stage=args.only_stage,
        from_stage=args.from_stage,
        to_stage=args.to_stage,
    )
    run_id = args.run_id or datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    state_path = project_root / "outputs" / "runs" / channel.name / f"{run_id}.json"
    dry_run = bool(args.dry_run or args.plan)
    _print_plan(selected_stages)
    context = PipelineContext(
        project_root=project_root,
        run_id=run_id,
        channel=channel,
        dry_run=dry_run,
        resume=bool(args.resume),
        settings=settings,
        state_path=state_path,
        selected_stages=selected_stages,
    )
    state = run_pipeline(context)
    final = state.get("stages", {})
    failed = [k for k, v in final.items() if (v or {}).get("status") == "failed"]
    print(f"Run state written to: {state_path}")
    if failed:
        print(f"Failed stages: {', '.join(failed)}")
        return 1
    print("Pipeline completed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
