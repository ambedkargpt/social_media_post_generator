from __future__ import annotations

import argparse
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from config import get_settings
from semrag.build import build_semrag_graph
from semrag.store import load_extraction_cache


def _now_utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def _progress_dir() -> Path:
    path = ROOT / "data" / "semrag" / "progress"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _backups_dir() -> Path:
    path = ROOT / "data" / "semrag" / "backups"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _ledger_path() -> Path:
    return _progress_dir() / "processed_chunks_ledger.json"


def _load_ledger() -> dict[str, Any]:
    path = _ledger_path()
    if not path.exists():
        return {"processed_chunk_ids": [], "batches": []}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {"processed_chunk_ids": [], "batches": []}
    if not isinstance(payload, dict):
        return {"processed_chunk_ids": [], "batches": []}
    payload.setdefault("processed_chunk_ids", [])
    payload.setdefault("batches", [])
    if not isinstance(payload["processed_chunk_ids"], list):
        payload["processed_chunk_ids"] = []
    if not isinstance(payload["batches"], list):
        payload["batches"] = []
    return payload


def _save_ledger(ledger: dict[str, Any]) -> None:
    _ledger_path().write_text(json.dumps(ledger, ensure_ascii=False, indent=2), encoding="utf-8")


def _snapshot_backups(tag: str) -> dict[str, str]:
    semrag_dir = ROOT / "data" / "semrag"
    entities_src = semrag_dir / "semrag_entities_backup.json"
    relations_src = semrag_dir / "semrag_relations_backup.json"
    out_dir = _backups_dir()
    entities_dst = out_dir / f"entities_{tag}.json"
    relations_dst = out_dir / f"relations_{tag}.json"
    shutil.copy2(entities_src, entities_dst)
    shutil.copy2(relations_src, relations_dst)
    return {"entities": str(entities_dst), "relations": str(relations_dst)}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Incremental SEMRAG extraction over chunk windows.")
    parser.add_argument("--start-idx", type=int, default=-1, help="Start chunk index (inclusive).")
    parser.add_argument("--end-idx", type=int, default=-1, help="End chunk index (exclusive).")
    parser.add_argument("--batch-size", type=int, default=5000, help="Window size when start/end are omitted.")
    parser.add_argument("--tag", type=str, default="", help="Batch tag for backups/ledger.")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force processing window even if chunk_id exists in ledger.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    settings = get_settings()

    chunks = json.loads(settings.semrag_chunks_path.read_text(encoding="utf-8"))
    total = len(chunks)
    if total == 0:
        raise ValueError("No chunks found in semrag_chunks_path.")

    if args.start_idx >= 0 or args.end_idx >= 0:
        start = max(0, args.start_idx if args.start_idx >= 0 else 0)
        end = args.end_idx if args.end_idx >= 0 else min(total, start + args.batch_size)
    else:
        end = total
        start = max(0, end - args.batch_size)
    end = min(total, end)
    if start >= end:
        raise ValueError(f"Invalid window: start={start}, end={end}, total={total}")

    tag = (args.tag or f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{start}_{end}").strip()
    ledger = _load_ledger()
    processed_ids = set(str(x) for x in ledger.get("processed_chunk_ids", []))

    window = chunks[start:end]
    if not args.force:
        window = [ch for ch in window if str(ch.get("chunk_id") or "").strip() not in processed_ids]
    if not window:
        print("No pending chunks in selected window after ledger filtering.")
        return

    build_semrag_graph(
        chunks=window,
        settings=settings,
        graph_path=settings.semrag_graph_path,
        cache_path=settings.semrag_cache_path,
        force_rebuild=bool(args.force),
    )

    # Mark processed only when extraction payload exists in cache.
    cache = load_extraction_cache(settings.semrag_cache_path)
    completed_ids: list[str] = []
    for ch in window:
        cid = str(ch.get("chunk_id") or "").strip()
        payload = cache.get(cid, {}) if isinstance(cache.get(cid), dict) else {}
        if isinstance(payload.get("extraction"), dict):
            completed_ids.append(cid)
    processed_ids.update(completed_ids)

    snapshots = _snapshot_backups(tag)
    batch_row = {
        "tag": tag,
        "window_start": start,
        "window_end": end,
        "window_size": len(window),
        "completed_with_extraction": len(completed_ids),
        "force": bool(args.force),
        "timestamp_utc": _now_utc(),
        "entities_snapshot": snapshots["entities"],
        "relations_snapshot": snapshots["relations"],
    }
    ledger["processed_chunk_ids"] = sorted(processed_ids)
    ledger["batches"].append(batch_row)
    _save_ledger(ledger)

    print(f"Batch completed: {tag}")
    print(f"Window: [{start}, {end})")
    print(f"Completed with extraction payload: {len(completed_ids)}")
    print(f"Ledger updated: {_ledger_path()}")
    print(f"Snapshots: {snapshots['entities']} | {snapshots['relations']}")


if __name__ == "__main__":
    main()
