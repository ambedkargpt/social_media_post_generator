from collections import deque
from typing import Dict, List, Set, Tuple

from .store import normalize_text


def _match_entity_ids(graph: Dict, *, name: str, entity_type: str) -> List[str]:
    norm_name = normalize_text(name or "")
    norm_type = normalize_text(entity_type or "")
    if not norm_name:
        return []

    key_to_id = graph.get("entity_name_to_id", {}) or {}
    direct_key = f"{norm_name}::{norm_type}"
    direct_id = key_to_id.get(direct_key)
    if direct_id:
        return [str(direct_id)]

    typed_matches: List[str] = []
    loose_matches: List[str] = []
    for entity in graph.get("entities", []) or []:
        eid = str(entity.get("entity_id") or "").strip()
        if not eid:
            continue
        et = normalize_text(str(entity.get("entity_type") or ""))
        names = [str(entity.get("canonical_name") or "")]
        names.extend(str(a or "") for a in (entity.get("aliases") or []))
        name_hit = any(normalize_text(n) == norm_name for n in names if n)
        if not name_hit:
            continue
        if norm_type and et == norm_type:
            typed_matches.append(eid)
        else:
            loose_matches.append(eid)
    if typed_matches:
        return typed_matches
    return loose_matches


def _query_entity_ids(graph: Dict, query_extraction: Dict) -> List[str]:
    matched: List[str] = []
    for entity in query_extraction.get("entities", []) or []:
        name = str(entity.get("name") or "").strip()
        entity_type = str(entity.get("entity_type") or "").strip().lower()
        if not name or not entity_type:
            continue
        matched.extend(_match_entity_ids(graph, name=name, entity_type=entity_type))
    return matched


def _query_relation_signatures(graph: Dict, query_extraction: Dict) -> List[str]:
    local_to_global: Dict[str, str] = {}
    for entity in query_extraction.get("entities", []) or []:
        local_id = str(entity.get("entity_id") or "").strip()
        name = str(entity.get("name") or "").strip()
        entity_type = str(entity.get("entity_type") or "").strip().lower()
        if not (local_id and name and entity_type):
            continue
        matched_ids = _match_entity_ids(graph, name=name, entity_type=entity_type)
        if matched_ids:
            local_to_global[local_id] = str(matched_ids[0])
    signatures: List[str] = []
    for relation in query_extraction.get("relations", []) or []:
        rel = str(relation.get("relation") or "").strip().lower()
        head = local_to_global.get(str(relation.get("head_entity_id") or "").strip())
        tail = local_to_global.get(str(relation.get("tail_entity_id") or "").strip())
        if rel and head and tail:
            signatures.append(f"{head}|{rel}|{tail}")
    return signatures


def semrag_rank_chunks(
    graph: Dict,
    query_extraction: Dict,
    *,
    top_n: int = 100,
    relation_bonus: float = 2.0,
) -> List[Tuple[str, float]]:
    return semrag_local_rank_chunks(
        graph,
        query_extraction,
        top_n=top_n,
        relation_bonus=relation_bonus,
    )


def semrag_local_rank_chunks(
    graph: Dict,
    query_extraction: Dict,
    *,
    top_n: int = 100,
    relation_bonus: float = 2.0,
) -> List[Tuple[str, float]]:
    entity_to_chunks = graph.get("entity_to_chunks", {}) or {}
    relation_to_chunks = graph.get("relation_to_chunks", {}) or {}
    chunk_scores: Dict[str, float] = {}
    for entity_id in _query_entity_ids(graph, query_extraction):
        for chunk_id in entity_to_chunks.get(entity_id, []) or []:
            chunk_scores[str(chunk_id)] = chunk_scores.get(str(chunk_id), 0.0) + 1.0
    for signature in _query_relation_signatures(graph, query_extraction):
        for chunk_id in relation_to_chunks.get(signature, []) or []:
            chunk_scores[str(chunk_id)] = chunk_scores.get(str(chunk_id), 0.0) + float(relation_bonus)
    ranked = sorted(chunk_scores.items(), key=lambda item: item[1], reverse=True)
    return ranked[: max(0, int(top_n))]


def _entity_graph_neighbors(graph: Dict) -> Dict[str, Set[str]]:
    neighbors: Dict[str, Set[str]] = {}
    for rel in graph.get("relations", []) or []:
        head = str(rel.get("head_entity_id") or "").strip()
        tail = str(rel.get("tail_entity_id") or "").strip()
        if not head or not tail:
            continue
        neighbors.setdefault(head, set()).add(tail)
        neighbors.setdefault(tail, set()).add(head)
    return neighbors


def semrag_global_rank_chunks(
    graph: Dict,
    query_extraction: Dict,
    *,
    top_n: int = 100,
    hops: int = 2,
    hop_decay: float = 0.65,
    centrality_weight: float = 0.15,
) -> List[Tuple[str, float]]:
    seed_entities = list(dict.fromkeys(_query_entity_ids(graph, query_extraction)))
    if not seed_entities:
        return []

    entity_to_chunks = graph.get("entity_to_chunks", {}) or {}
    neighbors = _entity_graph_neighbors(graph)
    entity_scores: Dict[str, float] = {}
    min_hops = max(0, int(hops))

    for seed in seed_entities:
        entity_scores[seed] = entity_scores.get(seed, 0.0) + 1.0
        q = deque([(seed, 0)])
        seen: Set[str] = {seed}
        while q:
            current, depth = q.popleft()
            if depth >= min_hops:
                continue
            for nxt in neighbors.get(current, set()):
                if nxt in seen:
                    continue
                seen.add(nxt)
                next_depth = depth + 1
                propagated = hop_decay**next_depth
                entity_scores[nxt] = entity_scores.get(nxt, 0.0) + propagated
                q.append((nxt, next_depth))

    chunk_scores: Dict[str, float] = {}
    for entity_id, base_score in entity_scores.items():
        degree = len(neighbors.get(entity_id, set()))
        centrality_bonus = centrality_weight * (degree / (degree + 1.0))
        final_entity_score = float(base_score) + float(centrality_bonus)
        for chunk_id in entity_to_chunks.get(entity_id, []) or []:
            key = str(chunk_id)
            chunk_scores[key] = chunk_scores.get(key, 0.0) + final_entity_score

    ranked = sorted(chunk_scores.items(), key=lambda item: item[1], reverse=True)
    return ranked[: max(0, int(top_n))]


def semrag_hybrid_rank_chunks(
    graph: Dict,
    query_extraction: Dict,
    *,
    top_n: int = 100,
    local_weight: float = 0.6,
    global_weight: float = 0.4,
    relation_bonus: float = 2.0,
    hops: int = 2,
    hop_decay: float = 0.65,
    centrality_weight: float = 0.15,
) -> List[Tuple[str, float]]:
    local_ranked = semrag_local_rank_chunks(
        graph,
        query_extraction,
        top_n=max(top_n * 3, top_n),
        relation_bonus=relation_bonus,
    )
    global_ranked = semrag_global_rank_chunks(
        graph,
        query_extraction,
        top_n=max(top_n * 3, top_n),
        hops=hops,
        hop_decay=hop_decay,
        centrality_weight=centrality_weight,
    )
    if not local_ranked and not global_ranked:
        return []

    local_scores = dict(local_ranked)
    global_scores = dict(global_ranked)
    max_local = max(local_scores.values(), default=0.0) or 1.0
    max_global = max(global_scores.values(), default=0.0) or 1.0

    merged: Dict[str, float] = {}
    keys = set(local_scores.keys()) | set(global_scores.keys())
    for chunk_id in keys:
        local_norm = float(local_scores.get(chunk_id, 0.0)) / max_local
        global_norm = float(global_scores.get(chunk_id, 0.0)) / max_global
        merged[chunk_id] = (float(local_weight) * local_norm) + (float(global_weight) * global_norm)

    ranked = sorted(merged.items(), key=lambda item: item[1], reverse=True)
    return ranked[: max(0, int(top_n))]
