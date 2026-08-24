"""
Vector store abstraction backed by Pinecone Serverless.

Replaces the previous faiss-cpu implementation.  The public surface is
intentionally kept identical so callers (retriever, pipeline_cli, worker)
require only minimal changes:

  build_index()       → upserts embeddings into Pinecone, returns VectorStore
  save_vector_store() → saves chunk JSON to disk (FAISS file no longer needed)
  load_vector_store() → loads chunk JSON + wraps live Pinecone index
  search()            → queries Pinecone; returns List[Tuple[chunk_id, score]]

The one deliberate API change: search() now returns (chunk_id: str, score: float)
instead of (array_index: int, score: float).  Callers that used integer indices
to do store.chunks[idx] must switch to chunk_by_id[chunk_id].
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)

# Seconds to wait on a Pinecone query before giving up. Retrieval sits in the
# request path, so it must fail faster than a user will wait.
PINECONE_QUERY_TIMEOUT_S = 15

# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------

@dataclass
class VectorStore:
    """Wraps a live Pinecone index + the in-memory chunk list.

    ``index``  — pinecone.Index handle (always-available cloud index).
    ``chunks`` — list of chunk dicts; still needed for BM25 and metadata lookup.
    """
    index: Any                    # pinecone.data.index.Index
    chunks: List[Dict[str, Any]]
    # Which slice of the index this store reads. Empty is the shared default
    # namespace. A per-channel store sets it so one tenant's search cannot
    # return another tenant's vectors, and search() picks it up without every
    # call site having to pass it.
    namespace: str = ""


# ---------------------------------------------------------------------------
# Build / upsert
# ---------------------------------------------------------------------------

def build_index(
    embeddings: np.ndarray,
    chunks: List[Dict[str, Any]],
    pinecone_index: Any,
    *,
    namespace: str = "",
    batch_size: int = 100,
) -> VectorStore:
    """Normalise embeddings and upsert them into a Pinecone index.

    Vectors are L2-normalised before upload so that inner-product similarity
    equals cosine similarity (matches the old FAISS IndexFlatIP behaviour).

    Args:
        embeddings:     2-D float32 array, shape (n_chunks, dim).
        chunks:         Parallel list of chunk dicts (chunk_id, chunk_text, …).
        pinecone_index: A live ``pinecone.Index`` instance.
        namespace:      Pinecone namespace (empty = default).
        batch_size:     Vectors per upsert call (Pinecone max is 100).

    Returns:
        VectorStore wrapping the index + chunks.
    """
    if embeddings.ndim != 2:
        raise ValueError("Embeddings must be a 2-D array, got shape %s." % str(embeddings.shape))

    n, _dim = embeddings.shape

    # L2-normalise for cosine similarity via inner product
    if n > 0:
        norms = np.linalg.norm(embeddings, axis=1, keepdims=True) + 1e-12
        embeddings = (embeddings / norms).astype("float32")

    # Build vector list
    vectors: List[Dict[str, Any]] = []
    for i, (emb, chunk) in enumerate(zip(embeddings, chunks)):
        chunk_id = str(chunk.get("chunk_id") or f"idx_{i}")
        vectors.append({
            "id": chunk_id,
            "values": emb.tolist(),
            "metadata": {
                "video_title":    str(chunk.get("video_title", "")),
                "video_link":     str(chunk.get("video_link", "")),
                "argument_score": float(chunk.get("argument_score", 0.0)),
                # chunk_text is intentionally omitted from Pinecone metadata to keep
                # index size small; the full text lives in argument_chunks.json.
            },
        })

    # Upsert in batches
    total = len(vectors)
    for start in range(0, total, batch_size):
        batch = vectors[start : start + batch_size]
        pinecone_index.upsert(vectors=batch, namespace=namespace)
        logger.debug("Upserted vectors %d–%d / %d", start, start + len(batch) - 1, total)

    logger.info("Pinecone upsert complete: %d vectors into namespace=%r", total, namespace or "(default)")
    return VectorStore(index=pinecone_index, chunks=chunks)


# ---------------------------------------------------------------------------
# Persist / load
# ---------------------------------------------------------------------------

def save_vector_store(
    store: VectorStore,
    index_path: Path,   # kept for API compatibility; no longer written
    chunks_path: Path,
) -> None:
    """Persist chunk metadata JSON to disk.

    ``index_path`` is accepted for drop-in compatibility with the old FAISS
    signature but is ignored — the Pinecone index is cloud-managed.
    The ``argument_chunks.json`` file is still required for BM25 scoring and
    chunk-metadata lookups in the retriever.
    """
    chunks_path.parent.mkdir(parents=True, exist_ok=True)
    chunks_path.write_text(
        json.dumps(store.chunks, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    logger.info("Saved %d chunks → %s", len(store.chunks), chunks_path)


def load_vector_store(
    index_path: Path,       # kept for API compatibility; unused
    chunks_path: Path,
    pinecone_index: Optional[Any] = None,
) -> Optional[VectorStore]:
    """Load a VectorStore from the chunks JSON + a live Pinecone index.

    Returns ``None`` if the chunks file is missing (triggers a full rebuild).

    Args:
        index_path:     Ignored (no FAISS file). Kept for drop-in compatibility.
        chunks_path:    Path to ``argument_chunks.json``.
        pinecone_index: A live ``pinecone.Index`` instance.  If omitted the
                        caller must pass one before the store is used for search.
    """
    if not chunks_path.exists():
        logger.warning("Chunks file not found at %s — VectorStore will be None.", chunks_path)
        return None

    chunks_data: List[Dict[str, Any]] = json.loads(chunks_path.read_text(encoding="utf-8"))
    logger.info("Loaded %d chunks from %s", len(chunks_data), chunks_path)
    return VectorStore(index=pinecone_index, chunks=chunks_data)


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------

def search(
    store: VectorStore,
    query_embedding: np.ndarray,
    top_k: int = 5,
    namespace: Optional[str] = None,
) -> List[Tuple[str, float]]:
    """Query the Pinecone index.

    Returns:
        List of (chunk_id: str, score: float) tuples sorted by descending score.
        Replaces the old FAISS interface which returned (array_index: int, score).

    Note:
        The query vector is L2-normalised here so callers do not need to
        normalise before calling — mirrors the old FAISS search behaviour.
    """
    if store.index is None:
        logger.error("search() called but VectorStore.index is None — Pinecone not initialised.")
        return []

    # An explicit argument still wins; otherwise the store decides, which is how
    # a tenant store keeps its own namespace without threading it through every
    # caller in the retrieval path.
    ns = namespace if namespace is not None else getattr(store, "namespace", "")

    if query_embedding.ndim == 1:
        query_embedding = query_embedding.reshape(1, -1)

    # L2-normalise for cosine similarity
    q = query_embedding.astype("float32").copy()
    q /= (np.linalg.norm(q, axis=1, keepdims=True) + 1e-12)
    q_list: List[float] = q[0].tolist()

    try:
        # Bound the call. The client defaults to no connect timeout, so a slow
        # or unreachable data plane blocks the request thread indefinitely --
        # a post generation was seen sitting at 220s with no error. Failing
        # fast lets the caller surface a real error instead of appearing hung.
        result = store.index.query(
            vector=q_list,
            top_k=top_k,
            namespace=ns,
            include_values=False,
            include_metadata=False,
            _request_timeout=PINECONE_QUERY_TIMEOUT_S,
        )
    except Exception as exc:
        logger.error("Pinecone query failed: %s", exc)
        return []

    return [(match.id, float(match.score)) for match in result.matches]
