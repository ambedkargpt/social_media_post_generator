from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from semrag.store import normalize_text, rebuild_indexes, save_semrag_graph


def _entity_key(name: str, entity_type: str) -> str:
    return f"{normalize_text(name)}::{normalize_text(entity_type)}"


def _load_payload(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(f"Missing input file: {path}")
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"Expected JSON object in: {path}")
    return data


def _build_entity_name_to_id(entities: list[dict[str, Any]]) -> dict[str, str]:
    out: dict[str, str] = {}
    for item in entities:
        entity_id = str(item.get("entity_id") or "").strip()
        name = str(item.get("canonical_name") or "").strip()
        entity_type = str(item.get("entity_type") or "").strip().lower()
        if not (entity_id and name and entity_type):
            continue
        out[_entity_key(name, entity_type)] = entity_id
    return out


def build_graph_from_backups(
    *,
    entities_path: Path,
    relations_path: Path,
    output_graph_path: Path,
) -> dict[str, Any]:
    entities_payload = _load_payload(entities_path)
    relations_payload = _load_payload(relations_path)

    entities = entities_payload.get("entities") or []
    relations = relations_payload.get("relations") or []
    if not isinstance(entities, list):
        raise ValueError("'entities' must be a list in entities backup.")
    if not isinstance(relations, list):
        raise ValueError("'relations' must be a list in relations backup.")

    graph: dict[str, Any] = {
        "version": 1,
        "updated_at": entities_payload.get("updated_at") or relations_payload.get("updated_at"),
        "entities": entities,
        "relations": relations,
        "entity_name_to_id": _build_entity_name_to_id(entities),
        "chunk_entities": {},
        "entity_to_chunks": {},
        "relation_to_chunks": {},
    }

    # Reconstruct chunk_entities from relation evidence.
    chunk_entities: dict[str, set[str]] = {}
    for rel in relations:
        if not isinstance(rel, dict):
            continue
        cid = str(rel.get("evidence_chunk_id") or "").strip()
        head = str(rel.get("head_entity_id") or "").strip()
        tail = str(rel.get("tail_entity_id") or "").strip()
        if not cid:
            continue
        bucket = chunk_entities.setdefault(cid, set())
        if head:
            bucket.add(head)
        if tail:
            bucket.add(tail)
    graph["chunk_entities"] = {k: sorted(v) for k, v in chunk_entities.items()}

    rebuild_indexes(graph)
    save_semrag_graph(output_graph_path, graph)
    return graph


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build semrag_graph.json from extracted entities/relations backups."
    )
    parser.add_argument(
        "--entities-file",
        default="data/semrag/semrag_entities_backup.json",
        help="Path to entities backup JSON.",
    )
    parser.add_argument(
        "--relations-file",
        default="data/semrag/semrag_relations_backup.json",
        help="Path to relations backup JSON.",
    )
    parser.add_argument(
        "--output-graph",
        default="data/semrag/semrag_graph.json",
        help="Path where semrag graph JSON will be written.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    entities_path = Path(args.entities_file).resolve()
    relations_path = Path(args.relations_file).resolve()
    output_graph_path = Path(args.output_graph).resolve()

    graph = build_graph_from_backups(
        entities_path=entities_path,
        relations_path=relations_path,
        output_graph_path=output_graph_path,
    )
    print(f"Graph written to: {output_graph_path}")
    print(f"Entities: {len(graph.get('entities', []))}")
    print(f"Relations: {len(graph.get('relations', []))}")
    print(f"Chunk mappings: {len(graph.get('chunk_entities', {}))}")


if __name__ == "__main__":
    main()
