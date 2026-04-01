from dataclasses import dataclass
from pathlib import Path
from typing import List, Dict, Tuple, Optional

import faiss
import numpy as np
import json


@dataclass
class VectorStore:
    index: faiss.IndexFlatIP
    chunks: List[Dict[str, str]]


def build_index(embeddings: np.ndarray, chunks: List[Dict[str, str]]) -> VectorStore:
    """
    Build a FAISS index over chunk embeddings.

    Stores:
    - embedding
    - chunk_text
    - video_title
    - video_link
    - chunk_id
    - argument_score
    """
    if embeddings.ndim != 2:
        raise ValueError("Embeddings must be a 2D array.")

    # Normalize embeddings for cosine similarity (inner product on unit vectors)
    n, dim = embeddings.shape
    if n > 0:
        norms = np.linalg.norm(embeddings, axis=1, keepdims=True) + 1e-12
        embeddings = embeddings / norms

    index = faiss.IndexFlatIP(dim)
    if n > 0:
        index.add(embeddings.astype("float32"))

    return VectorStore(index=index, chunks=chunks)


def save_vector_store(store: VectorStore, index_path: Path, chunks_path: Path) -> None:
    """
    Persist the FAISS index and chunks metadata to disk.

    - Index is stored as a FAISS binary file.
    - Chunks are stored as JSON for easy inspection/reuse.
    """
    index_path.parent.mkdir(parents=True, exist_ok=True)
    chunks_path.parent.mkdir(parents=True, exist_ok=True)

    faiss.write_index(store.index, str(index_path))
    chunks_path.write_text(json.dumps(store.chunks, ensure_ascii=False, indent=2), encoding="utf-8")


def load_vector_store(index_path: Path, chunks_path: Path) -> Optional[VectorStore]:
    """
    Load a previously saved VectorStore if both index and chunks files exist.
    Returns None if either file is missing.
    """
    if not index_path.exists() or not chunks_path.exists():
        return None

    index = faiss.read_index(str(index_path))
    chunks_data = json.loads(chunks_path.read_text(encoding="utf-8"))
    return VectorStore(index=index, chunks=chunks_data)


def search(
    store: VectorStore, query_embedding: np.ndarray, top_k: int = 5
) -> List[Tuple[int, float]]:
    """
    Search the FAISS index and return list of (index, score),
    where score is cosine similarity (inner product on unit vectors).
    """
    if query_embedding.ndim == 1:
        query_embedding = query_embedding.reshape(1, -1)

    if store.index.ntotal == 0:
        return []

    # Normalize query for cosine similarity
    q = query_embedding.astype("float32")
    q /= (np.linalg.norm(q, axis=1, keepdims=True) + 1e-12)

    sims, indices = store.index.search(q, top_k)
    results: List[Tuple[int, float]] = []
    for sim, idx in zip(sims[0], indices[0]):
        if idx == -1:
            continue
        score = float(sim)
        results.append((int(idx), score))
    return results

