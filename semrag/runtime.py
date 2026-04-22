from pathlib import Path
from typing import Dict, List, Tuple

from .build import extraction_chat_client, extract_query_entities
from .retriever import semrag_global_rank_chunks, semrag_hybrid_rank_chunks, semrag_local_rank_chunks
from .store import load_semrag_graph


_GRAPH_CACHE: Dict[str, Dict] = {}


def _load_graph_cached(path: Path) -> Dict:
    key = str(path.resolve())
    if key not in _GRAPH_CACHE:
        _GRAPH_CACHE[key] = load_semrag_graph(path)
    return _GRAPH_CACHE[key]


def semrag_candidates_for_query(
    query_text: str,
    settings,
    mode: str = "hybrid",
) -> Tuple[List[Tuple[str, float]], Dict]:
    if not settings.semrag_enabled:
        return [], {}
    graph_path = settings.semrag_graph_path
    if not graph_path.exists():
        return [], {}
    graph = _load_graph_cached(graph_path)
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
