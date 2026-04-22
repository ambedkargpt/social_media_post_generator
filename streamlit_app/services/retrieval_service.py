from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict

from config import get_settings
from pipeline.embedder import ChunkEmbedder
from pipeline.retriever import retrieve_relevant_chunks
from semrag.runtime import semrag_candidates_for_query
from pipeline.vector_store import load_vector_store


BASE_DIR = Path(__file__).resolve().parents[2]
INDEX_PATH = BASE_DIR / "outputs" / "faiss_index.bin"
CHUNKS_PATH = BASE_DIR / "data" / "argument_chunks.json"
OUTPUT_PATH = BASE_DIR / "outputs" / "retrieval_output.json"


def run_retrieval(query: str, top_k: int = 5) -> Dict[str, Any]:
    settings = get_settings()
    store = load_vector_store(INDEX_PATH, CHUNKS_PATH)
    if store is None:
        raise RuntimeError("Vector store not found. Run main.py once to build embeddings/index.")

    embedder = ChunkEmbedder(
        api_key=settings.gemini_api_key,
        model_name=settings.embedding_model,
        batch_size=settings.embedding_batch_size,
    )
    retrieval_cfg = {
        "use_bm25": settings.retrieval_use_bm25,
        "bm25_top_n": settings.retrieval_bm25_top_n,
        "dense_top_n": settings.retrieval_dense_top_n,
        "rrf_k": settings.retrieval_rrf_k,
        "candidate_k": settings.retrieval_candidate_k,
        "per_video_cap": settings.retrieval_per_video_cap,
        "enable_rerank": settings.retrieval_enable_rerank,
        "rerank_top_n": settings.retrieval_rerank_top_n,
        "rare_term_protect": settings.retrieval_rare_term_protect,
        "rare_term_min_idf": settings.retrieval_rare_term_min_idf,
        "rare_term_force_k": settings.retrieval_rare_term_force_k,
        "semrag_enabled": settings.semrag_enabled,
        "semrag_weight": settings.semrag_weight,
    }
    if settings.semrag_enabled:
        semrag_candidates, query_extraction = semrag_candidates_for_query(query.strip(), settings)
        retrieval_cfg["semrag_candidates"] = semrag_candidates
    rows = retrieve_relevant_chunks(
        news_text=query.strip(),
        embedder=embedder,
        store=store,
        top_k=int(top_k),
        retrieval_cfg=retrieval_cfg,
    )
    payload = {"query": query.strip(), "results": rows}
    if settings.semrag_enabled:
        payload["semrag_query_extraction"] = query_extraction
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return payload
