import json
from pathlib import Path
from typing import Dict, List

from .build import extract_query_entities, extraction_chat_client
from .retriever import semrag_global_rank_chunks, semrag_hybrid_rank_chunks, semrag_local_rank_chunks
from .store import load_semrag_graph


def _chunk_index(chunks_path: Path) -> Dict[str, Dict]:
    payload = json.loads(chunks_path.read_text(encoding="utf-8"))
    out: Dict[str, Dict] = {}
    for row in payload:
        chunk_id = str(row.get("chunk_id") or "").strip()
        if chunk_id:
            out[chunk_id] = row
    return out


def run_semrag_search(
    *,
    query_text: str,
    settings,
    mode: str,
    top_k: int = 10,
) -> Dict:
    graph = load_semrag_graph(settings.semrag_graph_path)
    chunks_by_id = _chunk_index(settings.semrag_chunks_path)
    client = extraction_chat_client(settings)
    query_extraction = extract_query_entities(
        client,
        model=settings.semrag_model,
        prompts_dir=settings.prompts_dir,
        query_text=query_text,
    )
    mode_normalized = str(mode or "").strip().lower()
    if mode_normalized == "local":
        ranked = semrag_local_rank_chunks(graph, query_extraction, top_n=top_k)
    elif mode_normalized == "global":
        ranked = semrag_global_rank_chunks(graph, query_extraction, top_n=top_k)
    else:
        ranked = semrag_hybrid_rank_chunks(graph, query_extraction, top_n=top_k)
        mode_normalized = "hybrid"

    rows: List[Dict] = []
    for rank, (chunk_id, score) in enumerate(ranked, start=1):
        chunk = chunks_by_id.get(chunk_id, {})
        rows.append(
            {
                "rank": rank,
                "chunk_id": chunk_id,
                "score": float(score),
                "video_title": str(chunk.get("video_title") or ""),
                "video_link": str(chunk.get("video_link") or ""),
                "chunk_text": str(chunk.get("chunk_text") or ""),
                "source": "semrag_graph",
            }
        )

    fallback_used = False
    # If graph-mode returns nothing (generic mentions, unresolved entities), fall back to dense+BM25 retrieval.
    if not rows:
        fallback_used = True
        from main import _retrieval_cfg_from_settings, ensure_rag_stack
        from pipeline.retriever import retrieve_relevant_chunks

        embedder, store, _ = ensure_rag_stack(settings)
        retrieval_cfg = _retrieval_cfg_from_settings(settings)
        retrieval_cfg["semrag_candidates"] = []
        dense_rows = retrieve_relevant_chunks(
            news_text=query_text,
            embedder=embedder,
            store=store,
            top_k=max(1, int(top_k)),
            retrieval_cfg=retrieval_cfg,
        )
        rows = [
            {
                "rank": idx,
                "chunk_id": str(item.get("chunk_id") or ""),
                "score": float(item.get("final_score", 0.0)),
                "video_title": str(item.get("video_title") or ""),
                "video_link": str(item.get("video_link") or ""),
                "chunk_text": str(item.get("chunk_text") or ""),
                "source": "dense_bm25_fallback",
            }
            for idx, item in enumerate(dense_rows, start=1)
        ]

    return {
        "mode": mode_normalized,
        "query": query_text,
        "query_extraction": query_extraction,
        "fallback_used": fallback_used,
        "results": rows,
    }
