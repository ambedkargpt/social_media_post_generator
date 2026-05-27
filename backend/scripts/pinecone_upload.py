"""
Direct Pinecone upload from existing caches.

Reads:  backend/data/argument_chunks.json   (4 818 chunks)
        backend/data/chunk_embedding_cache.json  (embeddings, 3072-dim)

Uploads: chunk vectors to the configured Pinecone index.

No transcript parsing, no re-embedding, no SEMRAG — just the upload.

Usage:
    python -m backend.scripts.pinecone_upload
    python -m backend.scripts.pinecone_upload --dry-run   # print stats, skip upsert
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
_BACKEND_DIR = Path(__file__).resolve().parent.parent
CHUNKS_PATH   = _BACKEND_DIR / "data" / "argument_chunks.json"
EMB_CACHE_PATH = _BACKEND_DIR / "data" / "chunk_embedding_cache.json"


def _load_chunks(path: Path) -> list[dict]:
    if not path.exists():
        sys.exit(f"ERROR: chunks file not found: {path}")
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, list):
        return data
    # some versions wrap in {"chunks": [...]}
    return data.get("chunks", [])


def _load_cache(path: Path) -> tuple[str, dict[str, list[float]]]:
    """Returns (model_name, {key: embedding_list})."""
    if not path.exists():
        sys.exit(f"ERROR: embedding cache not found: {path}")
    raw = json.loads(path.read_text(encoding="utf-8"))
    model = raw.get("embedding_model", "unknown")
    entries = raw.get("entries", {})
    return model, entries


def _cache_key(model_name: str, chunk_text: str) -> str:
    import hashlib
    h = hashlib.sha256()
    h.update((model_name or "").encode("utf-8"))
    h.update(b"\x00")
    h.update((chunk_text or "").encode("utf-8"))
    return h.hexdigest()


def _upsert(chunks: list[dict], embeddings: np.ndarray, settings, *, dry_run: bool, batch_size: int = 100) -> None:
    from pinecone import Pinecone as _Pinecone  # type: ignore[import-untyped]

    pc = _Pinecone(api_key=settings.pinecone_api_key)
    index = pc.Index(settings.pinecone_index_name)
    ns = settings.pinecone_namespace or ""

    # L2-normalise for cosine similarity (mirrors vector_store.build_index)
    n = embeddings.shape[0]
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True) + 1e-12
    normed = (embeddings / norms).astype("float32")

    vectors = []
    for i, (chunk, emb) in enumerate(zip(chunks, normed)):
        chunk_id = str(chunk.get("chunk_id") or f"idx_{i}")
        vectors.append({
            "id": chunk_id,
            "values": emb.tolist(),
            "metadata": {
                "video_title":    str(chunk.get("video_title", "")),
                "video_link":     str(chunk.get("video_link", "")),
                "argument_score": float(chunk.get("argument_score", 0.0)),
            },
        })

    if dry_run:
        print(f"[dry-run] Would upsert {len(vectors)} vectors to index={settings.pinecone_index_name!r} ns={ns!r}")
        print(f"[dry-run] Sample IDs: {[v['id'] for v in vectors[:5]]}")
        return

    total = len(vectors)
    print(f"Upserting {total} vectors → index={settings.pinecone_index_name!r} namespace={ns!r}")
    from tqdm import tqdm
    for start in tqdm(range(0, total, batch_size), unit="batch", desc="Pinecone upsert"):
        batch = vectors[start : start + batch_size]
        index.upsert(vectors=batch, namespace=ns)

    # Verify count
    stats = index.describe_index_stats()
    ns_count = (stats.namespaces or {}).get(ns, {})
    # Pinecone returns an object; try both attribute and dict access
    try:
        count = ns_count.vector_count if hasattr(ns_count, "vector_count") else ns_count.get("vector_count", "?")
    except Exception:
        count = "?"
    print(f"Done. Pinecone reports {count} vectors in namespace={ns!r}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Upload cached chunk embeddings to Pinecone.")
    parser.add_argument("--dry-run", action="store_true", help="Print stats without uploading.")
    parser.add_argument("--batch-size", type=int, default=100)
    args = parser.parse_args()

    # Load settings (reads .env)
    sys.path.insert(0, str(_BACKEND_DIR.parent))
    from backend.config import get_settings
    settings = get_settings()

    # Load chunks
    chunks = _load_chunks(CHUNKS_PATH)
    print(f"Loaded {len(chunks)} chunks from {CHUNKS_PATH}")

    # Load embedding cache
    model_name, cache_entries = _load_cache(EMB_CACHE_PATH)
    print(f"Loaded embedding cache: model={model_name!r}, {len(cache_entries)} entries")

    # Match each chunk to its cached embedding
    embeddings_list: list[list[float]] = []
    missing: list[int] = []
    for i, chunk in enumerate(chunks):
        key = _cache_key(model_name, chunk.get("chunk_text", ""))
        if key in cache_entries:
            embeddings_list.append(cache_entries[key])
        else:
            missing.append(i)

    if missing:
        print(f"WARNING: {len(missing)} chunks have no cached embedding (first 5 indices: {missing[:5]})")
        print("Those chunks will be skipped.")
        chunks = [c for i, c in enumerate(chunks) if i not in set(missing)]

    if not embeddings_list:
        sys.exit("ERROR: No embeddings found in cache for any chunk. Aborting.")

    embeddings = np.array(embeddings_list, dtype="float32")
    print(f"Embedding matrix: {embeddings.shape}  dtype={embeddings.dtype}")

    _upsert(chunks, embeddings, settings, dry_run=args.dry_run, batch_size=args.batch_size)


if __name__ == "__main__":
    main()
