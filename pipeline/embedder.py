from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np

# Google GenAI SDK for Gemini embeddings
from google import genai
from tqdm import tqdm

from .embedding_cache import (
    chunk_embedding_cache_key,
    load_chunk_embedding_cache,
    save_chunk_embedding_cache,
)


# Default embedding dimension for gemini-embedding-001 (avoids API call when no chunks)
GEMINI_EMBEDDING_DIM = 768


class ChunkEmbedder:
    """
    Embedder using Gemini embedding models via the Google GenAI SDK.
    """

    def __init__(
        self,
        api_key: str,
        model_name: str = "gemini-embedding-001",
        batch_size: int = 25,
    ) -> None:
        self.model_name = model_name
        self.client = genai.Client(api_key=api_key)
        self.batch_size = batch_size

    def embed_chunks(
        self,
        chunks: List[Dict[str, str]],
        *,
        cache_path: Optional[Path] = None,
        use_cache: bool = True,
    ) -> Tuple[np.ndarray, List[Dict[str, str]]]:
        """
        Generate embeddings for each chunk via Gemini API (batched).
        If cache_path is set and use_cache is True, reuse vectors for unchanged
        (model, chunk_text) pairs; FAISS is still rebuilt by the caller.

        Returns:
        - embeddings: np.ndarray of shape (n_chunks, dim)
        - same chunks list (for convenience)
        """
        texts = [c["chunk_text"] for c in chunks]
        if not texts:
            return np.empty((0, GEMINI_EMBEDDING_DIM)), chunks

        if not cache_path or not use_cache:
            all_embeddings: List[List[float]] = []
            for i in tqdm(range(0, len(texts), self.batch_size), desc="Embedding chunks"):
                batch = texts[i : i + self.batch_size]
                result = self.client.models.embed_content(
                    model=self.model_name,
                    contents=batch,
                )
                for emb in result.embeddings:
                    all_embeddings.append(emb.values)
            embeddings = np.array(all_embeddings, dtype=np.float32)
            return embeddings, chunks

        cache: Dict[str, List[float]] = load_chunk_embedding_cache(cache_path)
        n = len(texts)
        # Dimension for this run: learn from first cache hit, else from first API response.
        # Do not assume 768 — e.g. gemini-embedding-001 often returns 3072.
        dim: Optional[int] = None
        row_mats: List[Optional[np.ndarray]] = [None] * n

        for i, t in enumerate(texts):
            key = chunk_embedding_cache_key(self.model_name, t)
            vec = cache.get(key)
            if not isinstance(vec, list) or not vec:
                continue
            vlen = len(vec)
            if dim is None:
                dim = vlen
            if vlen != dim:
                continue
            row_mats[i] = np.asarray(vec, dtype=np.float32)

        miss_idx = [i for i in range(n) if row_mats[i] is None]
        miss_texts = [texts[i] for i in miss_idx]

        if miss_idx:
            print(
                f"Embedding chunks: {n - len(miss_idx)}/{n} from cache, "
                f"{len(miss_idx)} via Gemini API",
                flush=True,
            )
            for i in tqdm(
                range(0, len(miss_texts), self.batch_size),
                desc="Embedding chunks (API)",
            ):
                batch = miss_texts[i : i + self.batch_size]
                result = self.client.models.embed_content(
                    model=self.model_name,
                    contents=batch,
                )
                for bi, emb in enumerate(result.embeddings):
                    global_i = miss_idx[i + bi]
                    values = emb.values
                    if dim is None:
                        dim = len(values)
                    key = chunk_embedding_cache_key(self.model_name, texts[global_i])
                    cache[key] = list(values)
                    row_mats[global_i] = np.asarray(values, dtype=np.float32)
            if dim is None:
                dim = GEMINI_EMBEDDING_DIM
            save_chunk_embedding_cache(cache_path, self.model_name, cache, dim)
        else:
            print(f"Embedding chunks: {n}/{n} from cache (no API calls).", flush=True)

        if dim is None:
            dim = GEMINI_EMBEDDING_DIM
        out_rows: List[np.ndarray] = []
        for i in range(n):
            r = row_mats[i]
            if r is None:
                raise RuntimeError(f"Missing embedding for chunk index {i} after cache/API pass.")
            out_rows.append(r)
        embeddings = np.vstack(out_rows)
        return embeddings, chunks

    def embed_texts(self, texts: List[str], desc: str = "Embedding texts") -> np.ndarray:
        """
        Embed a list of plain strings via Gemini API, batched.

        Returns: np.ndarray of shape (len(texts), dim)
        """
        if not texts:
            return np.empty((0, GEMINI_EMBEDDING_DIM), dtype=np.float32)

        all_embeddings: List[List[float]] = []
        for i in tqdm(range(0, len(texts), self.batch_size), desc=desc):
            batch = texts[i : i + self.batch_size]
            result = self.client.models.embed_content(
                model=self.model_name,
                contents=batch,
            )
            for emb in result.embeddings:
                all_embeddings.append(emb.values)

        return np.array(all_embeddings, dtype=np.float32)

    def embed_query(self, text: str) -> np.ndarray:
        """Embed query/news text as a single vector."""
        result = self.client.models.embed_content(
            model=self.model_name,
            contents=text,
        )
        return np.array(result.embeddings[0].values, dtype=np.float32)
