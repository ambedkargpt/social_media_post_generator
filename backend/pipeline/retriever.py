from typing import List, Dict, Tuple, Set, Optional
from pathlib import Path
import json
import os
import unicodedata

import numpy as np

from .embedder import ChunkEmbedder
from .vector_store import VectorStore, search  # search() now returns (chunk_id: str, score)
from .query_expander import expand_queries_from_news
from .bm25_store import BM25Store, tokenize


MIN_SIMILARITY = 0.3  # cosine similarity threshold
MIN_SIMILARITY_RARE_QUERY = 0.2
BM25_NORM_KEEP_FLOOR = 0.15
TITLE_TOP_N = 5
STAGE2_SEARCH_K = 250
_ARTIFACTS_DIR = Path(os.environ["LAMBDA_ARTIFACTS_DIR"]) if os.getenv("LAMBDA_ARTIFACTS_DIR") else Path(__file__).resolve().parents[1] / "data"
TITLE_EMB_PATH = _ARTIFACTS_DIR / "video_title_embeddings.json"
STRICT_TITLE_TOP_N = 2
RRF_K = 60
BM25_TOP_N = 250
FINAL_CANDIDATE_K = 80
PER_VIDEO_CAP = 2
RERANK_TOP_N = 50
RARE_TERM_PROTECT = True
RARE_TERM_MIN_IDF = 6.0
RARE_TERM_FORCE_K = 20

_BM25_CACHE: Dict[int, BM25Store] = {}


def _rank_score(similarity: float) -> float:
    """
    Similarity-only ranking (debugging mode).
    """
    return float(similarity)


def _normalize_for_lexical(text: str) -> str:
    normalized = unicodedata.normalize("NFKC", text or "").casefold()
    for ch in ["“", "”", "‘", "’", "'", '"', "।", "॥"]:
        normalized = normalized.replace(ch, " ")
    return " ".join(normalized.split())


def _select_rare_terms(query: str, bm25_store: Optional[BM25Store], min_idf: float) -> List[str]:
    if bm25_store is None:
        return []
    tokens = tokenize(query)
    if not tokens:
        return []
    terms = []
    seen = set()
    for tok in tokens:
        if tok in seen:
            continue
        seen.add(tok)
        idf = float(bm25_store.idf.get(tok, 0.0))
        if idf >= min_idf:
            terms.append(tok)
    return terms


def _rare_term_candidate_indices(
    rare_terms: List[str],
    bm25_store: Optional[BM25Store],
    force_k: int,
) -> Set[int]:
    """
    Force-include lexical candidates that contain rare query terms.
    """
    if bm25_store is None or not rare_terms or force_k <= 0:
        return set()
    scored: List[Tuple[float, int]] = []
    for idx, tf_doc in enumerate(bm25_store.doc_freqs):
        score = 0.0
        for tok in rare_terms:
            tf = float(tf_doc.get(tok, 0))
            if tf <= 0:
                continue
            score += tf * float(bm25_store.idf.get(tok, 0.0))
        if score > 0:
            scored.append((score, idx))
    scored.sort(key=lambda x: x[0], reverse=True)
    return {idx for _, idx in scored[:force_k]}


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
    query_embedding: Optional[np.ndarray] = None,
) -> List[str]:
    """
    Stage 1: pick candidate videos by title relevance.
    Uses a lexical exact/contains boost + embedding cosine similarity over titles.
    Accepts a pre-computed query_embedding to avoid a redundant API call.
    """
    if not all_titles:
        return []

    q_norm = _normalize_for_lexical(query)
    titles_norm = [_normalize_for_lexical(t) for t in all_titles]

    # Reuse pre-computed embedding when available, otherwise embed now
    if query_embedding is not None:
        q_emb = query_embedding.astype("float32").copy()
    else:
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
    rare_term_protect = bool(cfg.get("rare_term_protect", RARE_TERM_PROTECT))
    rare_term_min_idf = float(cfg.get("rare_term_min_idf", RARE_TERM_MIN_IDF))
    rare_term_force_k = int(cfg.get("rare_term_force_k", RARE_TERM_FORCE_K))
    semrag_enabled = bool(cfg.get("semrag_enabled", False))
    semrag_weight = float(cfg.get("semrag_weight", 0.5))
    semrag_candidates = cfg.get("semrag_candidates", []) or []
    semrag_rank_by_chunk: Dict[str, int] = {}
    semrag_score_by_chunk: Dict[str, float] = {}
    for rank, item in enumerate(semrag_candidates, start=1):
        if not isinstance(item, (tuple, list)) or len(item) < 2:
            continue
        chunk_id = str(item[0] or "").strip()
        if not chunk_id:
            continue
        semrag_rank_by_chunk[chunk_id] = rank
        semrag_score_by_chunk[chunk_id] = float(item[1] or 0.0)

    # Pre-compute news_text embedding once — reused for title selection,
    # dense retrieval, and reranking to avoid redundant API calls.
    news_emb = embedder.embed_query(news_text).astype("float32")

    expanded_queries = expand_queries_from_news(news_text, max_queries=5)

    # Raw query has highest weight, expansions are softer signals
    weighted_queries: List[Tuple[str, float]] = [(news_text, 1.0)]
    for q in expanded_queries:
        weighted_queries.append((q, 0.7))

    # Batch-embed all queries in a single API call instead of one call per query
    all_query_texts = [q for q, _ in weighted_queries]
    if len(all_query_texts) > 1:
        all_query_embs = embedder.embed_texts(all_query_texts).astype("float32")
    else:
        all_query_embs = news_emb[np.newaxis, :]

    results_by_chunk: Dict[str, Tuple[Dict, float]] = {}
    # Pinecone search() returns (chunk_id: str, score) — track best dense score per chunk_id
    dense_similarity_by_id: Dict[str, float] = {}
    chunk_by_id: Dict[str, Dict] = {
        str(chunk.get("chunk_id") or ""): chunk
        for chunk in store.chunks
        if str(chunk.get("chunk_id") or "").strip()
    }
    # Bridge BM25 int-indices ↔ Pinecone string IDs
    idx_to_id: Dict[int, str] = {
        idx: str(chunk.get("chunk_id") or f"idx_{idx}")
        for idx, chunk in enumerate(store.chunks)
    }

    bm25_store = None
    if use_bm25:
        cache_key = id(store.chunks)
        bm25_store = _BM25_CACHE.get(cache_key)
        if bm25_store is None:
            docs = [c.get("chunk_text", "") for c in store.chunks]
            bm25_store = BM25Store.build(docs)
            _BM25_CACHE.clear()
            _BM25_CACHE[cache_key] = bm25_store

    # Stage 1: candidate videos by title matching/similarity (reuse pre-computed embedding)
    all_titles = sorted({c.get("video_title", "") for c in store.chunks if c.get("video_title")})
    strict_title_mode = False
    candidate_titles = _select_candidate_titles(
        news_text, embedder, all_titles, top_n=TITLE_TOP_N, query_embedding=news_emb
    )
    candidate_set: Set[str] = set(candidate_titles)

    rare_terms = (
        _select_rare_terms(news_text, bm25_store, min_idf=rare_term_min_idf)
        if rare_term_protect
        else []
    )
    # Convert rare-term int-indices to chunk-id strings (BM25 returns int, Pinecone returns str)
    rare_force_int_indices: Set[int] = (
        _rare_term_candidate_indices(rare_terms, bm25_store, force_k=rare_term_force_k)
        if rare_terms
        else set()
    )
    rare_force_ids: Set[str] = {idx_to_id[i] for i in rare_force_int_indices if i in idx_to_id}

    for (q_text, weight), query_embedding in zip(weighted_queries, all_query_embs):
        if not q_text.strip():
            continue
        # Dense retrieval — Pinecone returns (chunk_id: str, score: float)
        dense_hits = search(store, query_embedding, top_k=dense_top_n)
        dense_rank_by_id: Dict[str, int] = {cid: rank for rank, (cid, _) in enumerate(dense_hits, start=1)}
        dense_sim_by_id: Dict[str, float] = {cid: sim for cid, sim in dense_hits}
        for cid, sim in dense_sim_by_id.items():
            prev = dense_similarity_by_id.get(cid, -1.0)
            if sim > prev:
                dense_similarity_by_id[cid] = sim

        # BM25 retrieval — still uses int indices internally; convert to chunk-id strings
        bm25_rank_by_id: Dict[str, int] = {}
        bm25_raw_by_id: Dict[str, float] = {}
        bm25_norm_by_id: Dict[str, float] = {}
        if bm25_store is not None:
            bm25_scores = bm25_store.score(q_text)
            if bm25_scores.size:
                top_bm25_idx = np.argsort(-bm25_scores)[:bm25_top_n]
                top_vals = bm25_scores[top_bm25_idx]
                max_bm25 = float(np.max(top_vals)) if len(top_vals) else 0.0
                for rank, idx in enumerate(top_bm25_idx, start=1):
                    cid = idx_to_id.get(int(idx))
                    if cid is None:
                        continue
                    raw = float(bm25_scores[int(idx)])
                    bm25_rank_by_id[cid] = rank
                    bm25_raw_by_id[cid] = raw
                    bm25_norm_by_id[cid] = (raw / max_bm25) if max_bm25 > 1e-12 else 0.0

        # Rank-fusion over union of candidate chunk-ids (all strings now)
        candidate_ids: Set[str] = set(dense_rank_by_id.keys()) | set(bm25_rank_by_id.keys())
        # Force-include rare-term lexical candidates
        if q_text == news_text and rare_force_ids:
            candidate_ids |= rare_force_ids
        for chunk_id in candidate_ids:
            chunk = chunk_by_id.get(chunk_id)
            if chunk is None:
                continue
            if strict_title_mode and candidate_set and chunk.get("video_title") not in candidate_set:
                continue

            # RRF contribution for this query
            rrf_score = 0.0
            d_rank = dense_rank_by_id.get(chunk_id)
            b_rank = bm25_rank_by_id.get(chunk_id)
            if d_rank is not None:
                rrf_score += 1.0 / (rrf_k + d_rank)
            if b_rank is not None:
                rrf_score += 1.0 / (rrf_k + b_rank)
            # Soft title bias without hard exclusion
            if candidate_set and chunk.get("video_title") in candidate_set:
                rrf_score += 0.01
            rrf_score *= weight

            similarity_score = float(dense_sim_by_id.get(chunk_id, dense_similarity_by_id.get(chunk_id, 0.0)))
            bm25_score = float(bm25_raw_by_id.get(chunk_id, 0.0))
            bm25_norm_score = float(bm25_norm_by_id.get(chunk_id, 0.0))
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
                    "semrag_score": float(semrag_score_by_chunk.get(str(chunk_id), 0.0)),
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
                existing_payload["semrag_score"] = max(
                    float(existing_payload.get("semrag_score", 0.0)),
                    float(semrag_score_by_chunk.get(str(chunk_id), 0.0)),
                )
                existing_payload["final_score"] = new_score
                results_by_chunk[chunk_id] = (existing_payload, max(existing_final, new_score))

    if semrag_enabled and semrag_rank_by_chunk:
        for chunk_id, raw_score in semrag_score_by_chunk.items():
            if chunk_id in results_by_chunk:
                continue
            chunk = chunk_by_id.get(chunk_id)
            if not chunk:
                continue
            payload = {
                "chunk_id": chunk_id,
                "video_title": chunk.get("video_title", ""),
                "video_link": chunk.get("video_link", ""),
                "chunk_text": chunk.get("chunk_text", ""),
                "similarity_score": 0.0,
                "bm25_score": 0.0,
                "bm25_norm_score": 0.0,
                "argument_score": float(chunk.get("argument_score", 0.0)),
                "semrag_score": float(raw_score),
                "hybrid_score": 0.0,
                "final_score": 0.0,
            }
            results_by_chunk[chunk_id] = (payload, 0.0)

        for chunk_id, (payload, _) in list(results_by_chunk.items()):
            rank = semrag_rank_by_chunk.get(str(chunk_id))
            if rank is None:
                continue
            rrf_bonus = (1.0 / (rrf_k + rank)) * semrag_weight
            payload["hybrid_score"] = float(payload.get("hybrid_score", 0.0) + rrf_bonus)
            payload["final_score"] = float(payload.get("hybrid_score", 0.0))
            results_by_chunk[chunk_id] = (payload, float(payload["final_score"]))

    ranked = sorted(
        (val[0] for val in results_by_chunk.values()),
        key=lambda c: c["final_score"],
        reverse=True,
    )
    ranked = ranked[: max(final_candidate_k, top_k)]

    # Optional semantic rerank over top-N hybrid candidates.
    if enable_rerank and ranked:
        q_emb = news_emb.copy()
        q_emb /= (float(np.linalg.norm(q_emb)) + 1e-12)
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
    effective_min_similarity = (
        MIN_SIMILARITY_RARE_QUERY if rare_terms else MIN_SIMILARITY
    )
    filtered: List[Dict] = []
    for item in ranked:
        if not strict_title_mode and item.get("similarity_score", 0.0) < effective_min_similarity:
            # Keep lexically strong candidates even if dense similarity is lower.
            if float(item.get("bm25_norm_score", 0.0)) < BM25_NORM_KEEP_FLOOR:
                continue
        filtered.append(item)

    # Per-video cap to avoid one video dominating.
    #
    # The cap assumes a corpus with more videos than top_k. A per-channel corpus
    # need not be: Samajwadi's 75 chunks come from a single video, where a cap
    # of 2 returns 2 chunks against a top_k of 5 and no amount of relevance can
    # lift it. Domination is not a risk when there is nothing to dominate, so
    # the cap relaxes just enough to fill the request.
    distinct_videos = len({item.get("video_title", "") for item in filtered})
    effective_cap = per_video_cap
    if distinct_videos and distinct_videos * per_video_cap < top_k:
        effective_cap = -(-top_k // distinct_videos)  # ceil
        logger.info(
            "per-video cap raised %d -> %d: %d video(s) in the corpus cannot fill top_k=%d",
            per_video_cap, effective_cap, distinct_videos, top_k,
        )

    selected: List[Dict] = []
    per_video_count: Dict[str, int] = {}
    for item in filtered:
        title = item.get("video_title", "")
        count = per_video_count.get(title, 0)
        if count >= effective_cap:
            continue
        selected.append(item)
        per_video_count[title] = count + 1
        if len(selected) >= top_k:
            break

    return selected


