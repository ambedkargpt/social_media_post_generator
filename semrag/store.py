import hashlib
import json
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List


GRAPH_VERSION = 1


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_text(text: str) -> str:
    normalized = unicodedata.normalize("NFKC", (text or "")).casefold()
    return " ".join(normalized.split())


def chunk_hash(chunk: Dict) -> str:
    basis = "||".join(
        [
            str(chunk.get("chunk_id") or ""),
            str(chunk.get("video_title") or ""),
            str(chunk.get("video_link") or ""),
            str(chunk.get("chunk_text") or ""),
        ]
    )
    return hashlib.sha256(basis.encode("utf-8")).hexdigest()


def _default_graph() -> Dict:
    return {
        "version": GRAPH_VERSION,
        "updated_at": _now_iso(),
        "entities": [],
        "relations": [],
        "entity_name_to_id": {},
        "chunk_entities": {},
        "entity_to_chunks": {},
        "relation_to_chunks": {},
    }


def load_semrag_graph(path: Path) -> Dict:
    if not path.exists():
        return _default_graph()
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return _default_graph()
    if not isinstance(payload, dict):
        return _default_graph()
    base = _default_graph()
    base.update(payload)
    for key in ["entities", "relations"]:
        if not isinstance(base.get(key), list):
            base[key] = []
    for key in ["entity_name_to_id", "chunk_entities", "entity_to_chunks", "relation_to_chunks"]:
        if not isinstance(base.get(key), dict):
            base[key] = {}
    return base


def save_semrag_graph(path: Path, graph: Dict) -> None:
    graph["version"] = GRAPH_VERSION
    graph["updated_at"] = _now_iso()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(graph, ensure_ascii=False, indent=2), encoding="utf-8")


def load_extraction_cache(path: Path) -> Dict[str, Dict]:
    if not path.exists():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        entries = payload.get("entries", {})
        return entries if isinstance(entries, dict) else {}
    except Exception:
        return {}


def save_extraction_cache(path: Path, entries: Dict[str, Dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {"updated_at": _now_iso(), "entries": entries}
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _entity_key(name: str, entity_type: str) -> str:
    return f"{normalize_text(name)}::{normalize_text(entity_type)}"


def _relation_signature(head_entity_id: str, relation: str, tail_entity_id: str) -> str:
    return f"{head_entity_id}|{normalize_text(relation)}|{tail_entity_id}"


def _existing_entity_lookup(graph: Dict) -> Dict[str, Dict]:
    return {str(e.get("entity_id")): e for e in graph.get("entities", []) if e.get("entity_id")}


def _next_id(prefix: str, existing: Iterable[str]) -> str:
    max_n = 0
    for item in existing:
        if not isinstance(item, str) or not item.startswith(prefix):
            continue
        suffix = item[len(prefix) :]
        if suffix.isdigit():
            max_n = max(max_n, int(suffix))
    return f"{prefix}{max_n + 1}"


def _upsert_entity(graph: Dict, *, name: str, entity_type: str, aliases: List[str], confidence: float) -> str:
    key = _entity_key(name, entity_type)
    name_to_id = graph["entity_name_to_id"]
    entity_map = _existing_entity_lookup(graph)
    existing_id = name_to_id.get(key)
    if existing_id and existing_id in entity_map:
        entity = entity_map[existing_id]
        current_aliases = set(entity.get("aliases") or [])
        current_aliases.update(a for a in aliases if a)
        entity["aliases"] = sorted(current_aliases)
        entity["confidence"] = max(float(entity.get("confidence", 0.0)), float(confidence or 0.0))
        return existing_id

    entity_id = _next_id("e", name_to_id.values())
    graph["entities"].append(
        {
            "entity_id": entity_id,
            "canonical_name": name,
            "entity_type": entity_type,
            "aliases": sorted({a for a in aliases if a}),
            "confidence": float(confidence or 0.0),
        }
    )
    name_to_id[key] = entity_id
    return entity_id


def add_chunk_extraction(graph: Dict, chunk: Dict, extraction: Dict) -> None:
    chunk_id = str(chunk.get("chunk_id") or "").strip()
    if not chunk_id:
        return
    entity_local_to_global: Dict[str, str] = {}
    for entity in extraction.get("entities", []) or []:
        name = str(entity.get("name") or "").strip()
        entity_type = str(entity.get("entity_type") or "").strip().lower()
        if not name or not entity_type:
            continue
        aliases = [str(a).strip() for a in (entity.get("aliases") or []) if str(a).strip()]
        confidence = float(entity.get("confidence", 0.0) or 0.0)
        global_id = _upsert_entity(
            graph,
            name=name,
            entity_type=entity_type,
            aliases=aliases,
            confidence=confidence,
        )
        local_id = str(entity.get("entity_id") or "").strip()
        if local_id:
            entity_local_to_global[local_id] = global_id

    chunk_entity_ids = sorted(set(entity_local_to_global.values()))
    graph["chunk_entities"][chunk_id] = chunk_entity_ids

    for relation in extraction.get("relations", []) or []:
        rel = str(relation.get("relation") or "").strip().lower()
        head_local = str(relation.get("head_entity_id") or "").strip()
        tail_local = str(relation.get("tail_entity_id") or "").strip()
        head_global = entity_local_to_global.get(head_local)
        tail_global = entity_local_to_global.get(tail_local)
        if not (rel and head_global and tail_global):
            continue
        graph["relations"].append(
            {
                "relation_id": str(relation.get("relation_id") or "").strip() or _next_id(
                    "r", [r.get("relation_id", "") for r in graph.get("relations", [])]
                ),
                "head_entity_id": head_global,
                "relation": rel,
                "tail_entity_id": tail_global,
                "evidence_chunk_id": chunk_id,
                "evidence_text": str(relation.get("evidence_text") or "").strip(),
                "confidence": float(relation.get("confidence", 0.0) or 0.0),
            }
        )

    rebuild_indexes(graph)


def rebuild_indexes(graph: Dict) -> None:
    entity_to_chunks: Dict[str, List[str]] = {}
    relation_to_chunks: Dict[str, List[str]] = {}
    for chunk_id, entity_ids in (graph.get("chunk_entities") or {}).items():
        for entity_id in entity_ids or []:
            entity_to_chunks.setdefault(str(entity_id), []).append(str(chunk_id))
    for relation in graph.get("relations", []) or []:
        sig = _relation_signature(
            str(relation.get("head_entity_id") or ""),
            str(relation.get("relation") or ""),
            str(relation.get("tail_entity_id") or ""),
        )
        chunk_id = str(relation.get("evidence_chunk_id") or "").strip()
        if chunk_id:
            relation_to_chunks.setdefault(sig, []).append(chunk_id)
    graph["entity_to_chunks"] = {k: sorted(set(v)) for k, v in entity_to_chunks.items()}
    graph["relation_to_chunks"] = {k: sorted(set(v)) for k, v in relation_to_chunks.items()}


def reset_chunk_entries(graph: Dict, chunk_id: str) -> None:
    chunk_id = str(chunk_id or "").strip()
    if not chunk_id:
        return
    graph["chunk_entities"].pop(chunk_id, None)
    graph["relations"] = [
        rel for rel in (graph.get("relations") or []) if str(rel.get("evidence_chunk_id") or "") != chunk_id
    ]
    rebuild_indexes(graph)
