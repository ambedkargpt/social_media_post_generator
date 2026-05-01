from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def main() -> None:
    semrag_dir = ROOT / "data" / "semrag"
    progress_dir = semrag_dir / "progress"
    progress_dir.mkdir(parents=True, exist_ok=True)

    graph = _load_json(semrag_dir / "semrag_graph.json")
    entities = _load_json(semrag_dir / "semrag_entities_backup.json")
    relations = _load_json(semrag_dir / "semrag_relations_backup.json")
    ledger = _load_json(progress_dir / "processed_chunks_ledger.json")

    report = {
        "timestamp_utc": _now(),
        "graph": {
            "entities": len(graph.get("entities", []) or []),
            "relations": len(graph.get("relations", []) or []),
            "chunk_entities": len(graph.get("chunk_entities", {}) or {}),
            "updated_at": graph.get("updated_at"),
        },
        "backup": {
            "entities_count": int(entities.get("count", 0) or 0),
            "relations_count": int(relations.get("count", 0) or 0),
            "updated_at": entities.get("updated_at") or relations.get("updated_at"),
        },
        "ledger": {
            "processed_chunk_ids": len(ledger.get("processed_chunk_ids", []) or []),
            "batches": len(ledger.get("batches", []) or []),
            "latest_batch": (ledger.get("batches", []) or [{}])[-1] if (ledger.get("batches") or []) else {},
        },
        "checks": {
            "graph_non_empty": bool((graph.get("entities") or []) or (graph.get("relations") or [])),
            "backup_non_empty": bool((entities.get("count", 0) or 0) > 0 and (relations.get("count", 0) or 0) > 0),
        },
    }

    out_path = progress_dir / f"run_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    out_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Validation report written: {out_path}")
    print(json.dumps(report["checks"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
