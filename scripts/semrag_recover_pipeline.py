from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Sequence

ROOT = Path(__file__).resolve().parents[1]
PYTHON = ROOT / "venv" / "Scripts" / "python.exe"


def _run_step(name: str, cmd: Sequence[str]) -> tuple[bool, str]:
    print(f"\n=== {name} ===")
    print("Command:", " ".join(cmd))
    # Stream output live so tqdm/progress bars are visible in real time.
    proc = subprocess.Popen(
        cmd,
        cwd=str(ROOT),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        bufsize=1,
    )
    lines: list[str] = []
    assert proc.stdout is not None
    for line in proc.stdout:
        print(line, end="")
        lines.append(line)
    proc.wait()

    ok = proc.returncode == 0
    print(f"[{'OK' if ok else 'FAIL'}] {name} (exit={proc.returncode})")
    return ok, "".join(lines)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run full incremental SEMRAG recovery pipeline (extract -> merge -> graph -> validate)."
    )
    parser.add_argument("--batch-size", type=int, default=5000, help="Batch size for extraction window.")
    parser.add_argument("--start-idx", type=int, default=-1, help="Optional start chunk index for extraction.")
    parser.add_argument("--end-idx", type=int, default=-1, help="Optional end chunk index for extraction.")
    parser.add_argument("--tag", type=str, default="", help="Optional batch tag.")
    parser.add_argument(
        "--previous-window",
        action="store_true",
        help="Auto-pick the next backward window from ledger (uses latest batch.window_start as next end).",
    )
    parser.add_argument("--force", action="store_true", help="Force extraction in selected window.")
    parser.add_argument(
        "--skip-extract",
        action="store_true",
        help="Skip extraction step (useful if extraction already done and only rebuild is needed).",
    )
    return parser.parse_args()


def _resolve_previous_window(batch_size: int) -> tuple[int, int]:
    ledger_path = ROOT / "data" / "semrag" / "progress" / "processed_chunks_ledger.json"
    if not ledger_path.exists():
        raise FileNotFoundError(f"Ledger not found: {ledger_path}")
    payload = json.loads(ledger_path.read_text(encoding="utf-8"))
    batches = payload.get("batches", []) if isinstance(payload, dict) else []
    if not isinstance(batches, list) or not batches:
        raise ValueError("Ledger has no batches; cannot infer previous window.")
    latest = batches[-1] if isinstance(batches[-1], dict) else {}
    latest_start = int(latest.get("window_start", -1))
    if latest_start < 0:
        raise ValueError("Latest ledger batch has invalid window_start.")
    end_idx = latest_start
    start_idx = max(0, end_idx - int(batch_size))
    if start_idx >= end_idx:
        raise ValueError("No earlier window left to process.")
    return start_idx, end_idx


def main() -> int:
    if not PYTHON.exists():
        print(f"[FAIL] venv python not found at: {PYTHON}")
        return 1

    args = parse_args()
    run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    print("SEMRAG Recovery Pipeline")
    print(f"Run ID: {run_id}")

    steps: list[tuple[str, list[str]]] = []
    if not args.skip_extract:
        start_idx = args.start_idx
        end_idx = args.end_idx
        if args.previous_window:
            if args.start_idx >= 0 or args.end_idx >= 0:
                print("[FAIL] --previous-window cannot be combined with --start-idx/--end-idx.")
                return 1
            start_idx, end_idx = _resolve_previous_window(args.batch_size)
            print(f"Resolved previous window from ledger: [{start_idx}, {end_idx})")

        extract_cmd = [
            str(PYTHON),
            "scripts/semrag_extract_batch.py",
            "--batch-size",
            str(args.batch_size),
        ]
        if start_idx >= 0:
            extract_cmd += ["--start-idx", str(start_idx)]
        if end_idx >= 0:
            extract_cmd += ["--end-idx", str(end_idx)]
        tag = args.tag
        if not tag and args.previous_window and start_idx >= 0 and end_idx >= 0:
            tag = f"backfill_{start_idx}_{end_idx}"
        if tag:
            extract_cmd += ["--tag", tag]
        if args.force:
            extract_cmd += ["--force"]
        steps.append(("Batch Extraction", extract_cmd))

    steps.extend(
        [
            ("Merge Backups", [str(PYTHON), "scripts/semrag_merge_backups.py"]),
            (
                "Graph From Backup",
                [
                    str(PYTHON),
                    "scripts/build_semrag_graph_from_extracted.py",
                    "--entities-file",
                    "data/semrag/semrag_entities_backup.json",
                    "--relations-file",
                    "data/semrag/semrag_relations_backup.json",
                    "--output-graph",
                    "data/semrag/semrag_graph.json",
                ],
            ),
            ("Validate Run", [str(PYTHON), "scripts/semrag_validate_run.py"]),
        ]
    )

    summary: list[tuple[str, bool]] = []
    for name, cmd in steps:
        ok, _ = _run_step(name, cmd)
        summary.append((name, ok))
        if not ok:
            print("\nPipeline stopped due to failure.")
            break

    print("\n=== Pipeline Summary ===")
    for name, ok in summary:
        print(f"- {name}: {'OK' if ok else 'FAIL'}")

    return 0 if summary and all(ok for _, ok in summary) else 1


if __name__ == "__main__":
    raise SystemExit(main())
