import logging
from pathlib import Path
from typing import Dict, List, Tuple

from .memgraph_retriever import query_semrag

_log = logging.getLogger(__name__)
_GRAPH_CACHE: Dict[str, Dict] = {}


def _load_graph_cached(path: Path) -> Dict:
    from .store import load_semrag_graph
    key = str(path.resolve())
    if key not in _GRAPH_CACHE:
        _GRAPH_CACHE[key] = load_semrag_graph(path)
    return _GRAPH_CACHE[key]


def semrag_candidates_for_query(
    query_text: str,
    settings,
    mode: str = "hybrid",
) -> Tuple[List[Tuple[str, float]], Dict]:
    # 1. Primary: Query the live Ambedkar Memgraph Cloud Knowledge Graph
    try:
        data = query_semrag(query_text, top_chunks=getattr(settings, "semrag_top_n", 10))
        chunks = data.get("chunks", [])
        if chunks:
            ranked: List[Tuple[str, float]] = [
                (str(c.get("chunk_id")), float(c.get("hits", 1.0)))
                for c in chunks
            ]
            extraction = {
                "entities": data.get("entities", []),
                "triples": data.get("triples", []),
                "communities": data.get("communities", []),
                "search_mode": str(mode or "hybrid").strip().lower(),
            }
            return ranked, extraction
    except Exception as exc:
        _log.warning("Memgraph SemRAG retrieval encountered an issue, checking local graph fallback: %s", exc)

    # 2. Secondary fallback: Local static graph if exists on disk
    if not getattr(settings, "semrag_enabled", False):
        return [], {}
    graph_path = getattr(settings, "semrag_graph_path", None)
    if not graph_path or not Path(graph_path).exists():
        return [], {}

    try:
        from .build import extraction_chat_client, extract_query_entities
        from .retriever import semrag_global_rank_chunks, semrag_hybrid_rank_chunks, semrag_local_rank_chunks

        graph = _load_graph_cached(Path(graph_path))
        client = extraction_chat_client(settings)
        query_extraction = extract_query_entities(
            client,
            model=settings.semrag_model,
            prompts_dir=settings.prompts_dir,
            query_text=query_text,
        )
        mode_normalized = str(mode or "hybrid").strip().lower()
        if mode_normalized == "local":
            ranked = semrag_local_rank_chunks(graph, query_extraction, top_n=settings.semrag_top_n)
        elif mode_normalized == "global":
            ranked = semrag_global_rank_chunks(graph, query_extraction, top_n=settings.semrag_top_n)
        else:
            ranked = semrag_hybrid_rank_chunks(graph, query_extraction, top_n=settings.semrag_top_n)
            mode_normalized = "hybrid"
        query_extraction["search_mode"] = mode_normalized
        return ranked, query_extraction
    except Exception as exc:
        _log.warning("Local SemRAG fallback failed: %s", exc)
        return [], {}

