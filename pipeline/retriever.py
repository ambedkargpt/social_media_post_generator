from typing import List, Dict, Tuple, Set, Optional
from pathlib import Path
import json

import numpy as np

from .embedder import ChunkEmbedder
from .vector_store import VectorStore, search
from .query_expander import expand_queries_from_news
from .bm25_store import BM25Store


MIN_SIMILARITY = 0.3  # cosine similarity threshold
TITLE_TOP_N = 5
STAGE2_SEARCH_K = 250
TITLE_EMB_PATH = Path(__file__).resolve().parents[1] / "data" / "video_title_embeddings.json"
STRICT_TITLE_TOP_N = 2
RRF_K = 60
BM25_TOP_N = 250
FINAL_CANDIDATE_K = 80
PER_VIDEO_CAP = 2
RERANK_TOP_N = 50

_BM25_CACHE: Dict[int, BM25Store] = {}


def _rank_score(similarity: float) -> float:
    """
    Similarity-only ranking (debugging mode).
    """
    return float(similarity)


def _normalize_for_lexical(text: str) -> str:
    return " ".join((text or "").lower().split())


def _strict_title_matches(query: str, all_titles: List[str], top_n: int = STRICT_TITLE_TOP_N) -> List[str]:
    """
    Hard lexical match for title-like queries.
    - exact normalized equality first
    - then contains matches
    """
    q_norm = _normalize_for_lexical(query)
    if not q_norm:
        return []

    exact = [t for t in all_titles if _normalize_for_lexical(t) == q_norm]
    if exact:
        return exact[:top_n]

    contains = []
    for t in all_titles:
        t_norm = _normalize_for_lexical(t)
        if q_norm in t_norm or t_norm in q_norm:
            contains.append(t)
    return contains[:top_n]


def _select_candidate_titles(
    query: str,
    embedder: ChunkEmbedder,
    all_titles: List[str],
    top_n: int = TITLE_TOP_N,
) -> List[str]:
    """
    Stage 1: pick candidate videos by title relevance.
    Uses a lexical exact/contains boost + embedding cosine similarity over titles.
    """
    if not all_titles:
        return []

    q_norm = _normalize_for_lexical(query)
    titles_norm = [_normalize_for_lexical(t) for t in all_titles]

    # Embed query, compute cosine against pre-embedded titles (if available)
    q_emb = embedder.embed_query(query).astype("float32")
    q_emb /= (float((q_emb @ q_emb) ** 0.5) + 1e-12)

    title_embs = None
    title_map = {}
    payload = {}
    if TITLE_EMB_PATH.exists():
        try:
            payload = json.loads(TITLE_EMB_PATH.read_text(encoding="utf-8"))
            if payload.get("embedding_model") == embedder.model_name:
                title_map = payload.get("title_map") or {}
                if isinstance(title_map, dict) and title_map:
                    # Build cache-aligned embeddings and only fill missing titles.
                    missing_titles = [t for t in all_titles if not title_map.get(t, {}).get("embedding")]
                    if missing_titles:
                        missing_embs = embedder.embed_texts(
                            missing_titles, desc="Embedding video titles"
                        ).astype("float32")
                        for t, emb in zip(missing_titles, missing_embs):
                            existing_link = title_map.get(t, {}).get("link", "")
                            title_map[t] = {"link": existing_link, "embedding": emb.tolist()}
                        payload["title_map"] = title_map
                        TITLE_EMB_PATH.write_text(
                            json.dumps(payload, ensure_ascii=False, indent=2),
                            encoding="utf-8",
                        )

                    embs = [title_map[t]["embedding"] for t in all_titles]
                    title_embs = np.array(embs, dtype=np.float32)
        except Exception:
            title_embs = None

    if title_embs is None:
        # Fallback: embed titles on the fly (slower)
        title_embs = embedder.embed_texts(all_titles, desc="Embedding video titles").astype("float32")
        title_embs /= (np.linalg.norm(title_embs, axis=1, keepdims=True) + 1e-12)
    else:
        # Ensure cached embeddings are normalized
        title_embs /= (np.linalg.norm(title_embs, axis=1, keepdims=True) + 1e-12)

    sims = title_embs @ q_emb  # (n_titles,)

    scored: List[Tuple[float, str]] = []
    for t_raw, t_norm, sim in zip(all_titles, titles_norm, sims):
        lexical_boost = 0.0
        if q_norm and (q_norm in t_norm or t_norm in q_norm):
            lexical_boost = 1.0  # strong routing signal
        scored.append((float(sim) + lexical_boost, t_raw))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [t for _, t in scored[:top_n]]


def retrieve_relevant_chunks(
    news_text: str,
    embedder: ChunkEmbedder,
    store: VectorStore,
    top_k: int = 5,
    retrieval_cfg: Optional[Dict] = None,
) -> List[Dict]:
    """
    Retrieve top-k relevant transcript chunks for the given news text.

    Steps:
    1. Use raw query plus expanded political themes.
    2. Embed each query with a weight (raw query highest).
    3. Retrieve top chunks per query from FAISS.
    4. Filter out chunks below a minimum similarity threshold.
    5. Merge and deduplicate by chunk_id.
    6. Rank by (similarity * query_weight) only.

    Returns top_k chunks.
    """
    cfg = retrieval_cfg or {}
    use_bm25 = bool(cfg.get("use_bm25", True))
    dense_top_n = int(cfg.get("dense_top_n", STAGE2_SEARCH_K))
    bm25_top_n = int(cfg.get("bm25_top_n", BM25_TOP_N))
    rrf_k = int(cfg.get("rrf_k", RRF_K))
    final_candidate_k = int(cfg.get("candidate_k", FINAL_CANDIDATE_K))
    per_video_cap = int(cfg.get("per_video_cap", PER_VIDEO_CAP))
    enable_rerank = bool(cfg.get("enable_rerank", True))
    rerank_top_n = int(cfg.get("rerank_top_n", RERANK_TOP_N))

    expanded_queries = expand_queries_from_news(news_text)

    # Raw query has highest weight, expansions are softer signals
    weighted_queries: List[Tuple[str, float]] = [(news_text, 1.0)]
    for q in expanded_queries:
        weighted_queries.append((q, 0.7))

    results_by_chunk: Dict[str, Tuple[Dict, float]] = {}
    dense_similarity_by_idx: Dict[int, float] = {}

    bm25_store = None
    if use_bm25:
        cache_key = id(store.chunks)
        bm25_store = _BM25_CACHE.get(cache_key)
        if bm25_store is None:
            docs = [c.get("chunk_text", "") for c in store.chunks]
            bm25_store = BM25Store.build(docs)
            _BM25_CACHE.clear()
            _BM25_CACHE[cache_key] = bm25_store

    # Stage 1: candidate videos by title matching/similarity
    all_titles = sorted({c.get("video_title", "") for c in store.chunks if c.get("video_title")})
    strict_titles = _strict_title_matches(news_text, all_titles, top_n=STRICT_TITLE_TOP_N)
    strict_title_mode = len(strict_titles) > 0
    if strict_title_mode:
        # Exact/contains match path: lock retrieval to these videos.
        candidate_titles = strict_titles
    else:
        candidate_titles = _select_candidate_titles(news_text, embedder, all_titles, top_n=TITLE_TOP_N)
    candidate_set: Set[str] = set(candidate_titles)

    for q_text, weight in weighted_queries:
        if not q_text.strip():
            continue

        query_embedding = embedder.embed_query(q_text)
        # Dense retrieval candidates
        dense_hits = search(store, query_embedding, top_k=dense_top_n)
        dense_rank_by_idx = {idx: rank for rank, (idx, _) in enumerate(dense_hits, start=1)}
        dense_sim_by_idx = {idx: sim for idx, sim in dense_hits}
        for idx, sim in dense_sim_by_idx.items():
            prev = dense_similarity_by_idx.get(idx, -1.0)
            if sim > prev:
                dense_similarity_by_idx[idx] = sim

        # BM25 retrieval candidates
        bm25_rank_by_idx: Dict[int, int] = {}
        bm25_raw_by_idx: Dict[int, float] = {}
        bm25_norm_by_idx: Dict[int, float] = {}
        if bm25_store is not None:
            bm25_scores = bm25_store.score(q_text)
            if bm25_scores.size:
                top_bm25_idx = np.argsort(-bm25_scores)[:bm25_top_n]
                bm25_rank_by_idx = {int(idx): rank for rank, idx in enumerate(top_bm25_idx, start=1)}
                top_vals = bm25_scores[top_bm25_idx]
                max_bm25 = float(np.max(top_vals)) if len(top_vals) else 0.0
                for idx in top_bm25_idx:
                    raw = float(bm25_scores[int(idx)])
                    bm25_raw_by_idx[int(idx)] = raw
                    bm25_norm_by_idx[int(idx)] = (raw / max_bm25) if max_bm25 > 1e-12 else 0.0

        # Rank-fusion score over union of candidates.
        candidate_indices = set(dense_rank_by_idx.keys()) | set(bm25_rank_by_idx.keys())
        for idx in candidate_indices:
            chunk = store.chunks[idx]
            if candidate_set and chunk.get("video_title") not in candidate_set:
                continue

            # RRF contribution for this query
            rrf_score = 0.0
            d_rank = dense_rank_by_idx.get(idx)
            b_rank = bm25_rank_by_idx.get(idx)
            if d_rank is not None:
                rrf_score += 1.0 / (rrf_k + d_rank)
            if b_rank is not None:
                rrf_score += 1.0 / (rrf_k + b_rank)
            rrf_score *= weight

            chunk_id = chunk.get("chunk_id") or f"idx_{idx}"
            similarity_score = float(dense_sim_by_idx.get(idx, dense_similarity_by_idx.get(idx, 0.0)))
            bm25_score = float(bm25_raw_by_idx.get(idx, 0.0))
            bm25_norm_score = float(bm25_norm_by_idx.get(idx, 0.0))
            argument_score = float(chunk.get("argument_score", 0.0))

            existing = results_by_chunk.get(chunk_id)
            if existing is None:
                enriched = {
                    "chunk_id": chunk_id,
                    "video_title": chunk.get("video_title", ""),
                    "video_link": chunk.get("video_link", ""),
                    "chunk_text": chunk.get("chunk_text", ""),
                    "similarity_score": similarity_score,
                    "bm25_score": bm25_score,
                    "bm25_norm_score": bm25_norm_score,
                    "argument_score": argument_score,
                    "hybrid_score": float(rrf_score),
                    "final_score": float(rrf_score),
                }
                results_by_chunk[chunk_id] = (enriched, float(rrf_score))
            else:
                existing_payload, existing_final = existing
                new_score = existing_payload.get("hybrid_score", 0.0) + float(rrf_score)
                existing_payload["hybrid_score"] = new_score
                # Keep best available similarity seen
                existing_payload["similarity_score"] = max(
                    float(existing_payload.get("similarity_score", 0.0)), similarity_score
                )
                existing_payload["bm25_score"] = max(
                    float(existing_payload.get("bm25_score", 0.0)), bm25_score
                )
                existing_payload["bm25_norm_score"] = max(
                    float(existing_payload.get("bm25_norm_score", 0.0)), bm25_norm_score
                )
                existing_payload["final_score"] = new_score
                results_by_chunk[chunk_id] = (existing_payload, max(existing_final, new_score))

    # Fallback: if non-strict title-routing filtered too hard, rerun without title restriction
    if (not strict_title_mode) and candidate_set and len(results_by_chunk) < top_k:
        candidate_set = set()
        for payload, _ in results_by_chunk.values():
            payload["final_score"] = payload.get("hybrid_score", payload.get("final_score", 0.0))

    ranked = sorted(
        (val[0] for val in results_by_chunk.values()),
        key=lambda c: c["final_score"],
        reverse=True,
    )
    ranked = ranked[: max(final_candidate_k, top_k)]

    # Optional semantic rerank over top-N hybrid candidates.
    if enable_rerank and ranked:
        q_emb = embedder.embed_query(news_text).astype("float32")
        q_emb /= (np.linalg.norm(q_emb) + 1e-12)
        rerank_slice = ranked[: min(rerank_top_n, len(ranked))]
        chunk_texts = [r.get("chunk_text", "") for r in rerank_slice]
        chunk_embs = embedder.embed_texts(chunk_texts, desc="Reranking chunks").astype("float32")
        chunk_embs /= (np.linalg.norm(chunk_embs, axis=1, keepdims=True) + 1e-12)
        rerank_sims = chunk_embs @ q_emb
        for i, sim in enumerate(rerank_sims):
            rerank_slice[i]["rerank_score"] = float(sim)
            # Favor reranker strongly while retaining hybrid prior.
            hybrid = float(rerank_slice[i].get("hybrid_score", 0.0))
            rerank_slice[i]["final_score"] = float(0.7 * sim + 0.3 * hybrid)
        ranked = sorted(ranked, key=lambda c: c["final_score"], reverse=True)

    # Add a bounded relevance metric for easier interpretation in reports.
    for item in ranked:
        rerank = item.get("rerank_score")
        dense = float(item.get("similarity_score", 0.0))
        bm25_norm = float(item.get("bm25_norm_score", 0.0))
        dense_norm = max(0.0, min(1.0, (dense + 1.0) / 2.0))
        if rerank is not None:
            rerank_norm = max(0.0, min(1.0, (float(rerank) + 1.0) / 2.0))
            # Reranker-dominant relevance, lexical as supporting signal.
            relevance = 0.7 * rerank_norm + 0.2 * bm25_norm + 0.1 * dense_norm
        else:
            relevance = 0.55 * dense_norm + 0.45 * bm25_norm
        item["relevance_score"] = float(max(0.0, min(1.0, relevance)))

    # Remove very low-similarity dense matches in broad mode.
    filtered: List[Dict] = []
    for item in ranked:
        if item.get("similarity_score", 0.0) < MIN_SIMILARITY and not strict_title_mode:
            continue
        filtered.append(item)

    # Per-video cap to avoid one video dominating.
    selected: List[Dict] = []
    per_video_count: Dict[str, int] = {}
    for item in filtered:
        title = item.get("video_title", "")
        count = per_video_count.get(title, 0)
        if count >= per_video_cap:
            continue
        selected.append(item)
        per_video_count[title] = count + 1
        if len(selected) >= top_k:
            break

    return selected


