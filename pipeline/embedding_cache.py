"""
Disk cache for chunk embeddings (option A): skip Gemini API when chunk text + model unchanged.
FAISS index is still rebuilt from the full embedding matrix each run.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Dict, List


def chunk_embedding_cache_key(model_name: str, chunk_text: str) -> str:
    h = hashlib.sha256()
    h.update((model_name or "").encode("utf-8"))
    h.update(b"\x00")
    h.update((chunk_text or "").encode("utf-8"))
    return h.hexdigest()


def load_chunk_embedding_cache(path: Path) -> Dict[str, List[float]]:
    if not path.exists():
        return {}
    try:
        raw = path.read_text(encoding="utf-8")
        data = json.loads(raw)
        entries = data.get("entries")
        return entries if isinstance(entries, dict) else {}
    except Exception:
        return {}


def save_chunk_embedding_cache(
    path: Path,
    model_name: str,
    entries: Dict[str, List[float]],
    embedding_dim: int,
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "embedding_model": model_name,
        "embedding_dim": int(embedding_dim),
        "entries": entries,
    }
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    tmp.replace(path)
