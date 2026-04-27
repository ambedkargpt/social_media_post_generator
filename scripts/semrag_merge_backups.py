from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from semrag.store import normalize_text


def _entity_key(item: dict[str, Any]) -> str:
    name = str(item.get("canonical_name") or "").strip()
    entity_type = str(item.get("entity_type") or "").strip().lower()
    return f"{normalize_text(name)}::{normalize_text(entity_type)}"


def _relation_key(item: dict[str, Any]) -> str:
    return "||".join(
        [
            str(item.get("head_entity_id") or "").strip(),
            str(item.get("relation") or "").strip().lower(),
            str(item.get("tail_entity_id") or "").strip(),
            str(item.get("evidence_chunk_id") or "").strip(),
            str(item.get("evidence_text") or "").strip(),
        ]
    )


def main() -> None:
    semrag_dir = ROOT / "data" / "semrag"
    backups_dir = semrag_dir / "backups"
    backups_dir.mkdir(parents=True, exist_ok=True)

    entity_files = sorted(backups_dir.glob("entities_*.json"))
    relation_files = sorted(backups_dir.glob("relations_*.json"))
    if not entity_files or not relation_files:
        raise FileNotFoundError("No batch backup files found in data/semrag/backups.")

    entities_map: dict[str, dict[str, Any]] = {}
    for path in entity_files:
        payload = json.loads(path.read_text(encoding="utf-8"))
        for item in payload.get("entities", []) or []:
            if not isinstance(item, dict):
                continue
            k = _entity_key(item)
            if k:
                entities_map[k] = item

    relations_map: dict[str, dict[str, Any]] = {}
    for path in relation_files:
        payload = json.loads(path.read_text(encoding="utf-8"))
        for item in payload.get("relations", []) or []:
            if not isinstance(item, dict):
                continue
            k = _relation_key(item)
            if k:
                relations_map[k] = item

    entities_out = {
        "updated_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "count": len(entities_map),
        "entities": list(entities_map.values()),
    }
    relations_out = {
        "updated_at": entities_out["updated_at"],
        "count": len(relations_map),
        "relations": list(relations_map.values()),
    }

    entities_path = semrag_dir / "semrag_entities_backup.json"
    relations_path = semrag_dir / "semrag_relations_backup.json"
    entities_path.write_text(json.dumps(entities_out, ensure_ascii=False, indent=2), encoding="utf-8")
    relations_path.write_text(json.dumps(relations_out, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Merged entities: {len(entities_map)} -> {entities_path}")
    print(f"Merged relations: {len(relations_map)} -> {relations_path}")


if __name__ == "__main__":
    main()
