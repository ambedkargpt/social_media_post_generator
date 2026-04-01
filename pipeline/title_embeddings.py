import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np

from .embedder import ChunkEmbedder


@dataclass
class TitleEmbeddings:
    model: str
    titles: List[str]
    links: List[str]
    embeddings: np.ndarray  # shape (n_titles, dim), float32, normalized


def build_title_embeddings(
    videos: List[Dict[str, str]],
    embedder: ChunkEmbedder,
) -> TitleEmbeddings:
    """
    Embed all video titles once and return normalized embeddings for cosine similarity.
    """
    # Deduplicate by title (keep first link encountered) and sort for stable ordering.
    by_title: Dict[str, str] = {}
    for v in videos:
        t = (v.get("video_title") or "").strip()
        if not t or t in by_title:
            continue
        by_title[t] = (v.get("video_link") or "").strip()

    titles = sorted(by_title.keys())
    links = [by_title[t] for t in titles]

    embs = embedder.embed_texts(titles, desc="Embedding video titles").astype("float32")
    embs /= (np.linalg.norm(embs, axis=1, keepdims=True) + 1e-12)

    return TitleEmbeddings(
        model=embedder.model_name,
        titles=titles,
        links=links,
        embeddings=embs,
    )


def save_title_embeddings(te: TitleEmbeddings, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "embedding_model": te.model,
        # Store as a map for robust lookup, independent of order.
        "title_map": {
            t: {
                "video_link": te.links[i],
                "embedding": te.embeddings[i].tolist(),
            }
            for i, t in enumerate(te.titles)
        },
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def load_title_embeddings(path: Path) -> Optional[TitleEmbeddings]:
    if not path.exists():
        return None
    payload = json.loads(path.read_text(encoding="utf-8"))
    model = payload.get("embedding_model", "")
    title_map = payload.get("title_map")
    if not isinstance(title_map, dict) or not title_map:
        return None

    titles = sorted(title_map.keys())
    links = [str((title_map[t] or {}).get("video_link", "")) for t in titles]
    embeddings = np.array([((title_map[t] or {}).get("embedding") or []) for t in titles], dtype=np.float32)
    if embeddings.ndim != 2 or embeddings.shape[0] != len(titles):
        return None

    # Assume stored embeddings were normalized; renormalize defensively.
    embeddings /= (np.linalg.norm(embeddings, axis=1, keepdims=True) + 1e-12)
    return TitleEmbeddings(model=model, titles=titles, links=links, embeddings=embeddings)

