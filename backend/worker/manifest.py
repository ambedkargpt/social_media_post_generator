"""Build manifest with SHA-256 checksums."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def sha256_file(path: Path, chunk_size: int = 1024 * 1024) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            b = f.read(chunk_size)
            if not b:
                break
            h.update(b)
    return h.hexdigest()


ARTIFACT_FILENAMES = (
    "faiss_index.bin",
    "argument_chunks.json",
    "video_context.json",
    "video_title_embeddings.json",
    "semrag_graph.json",
    "semrag_chunks.json",
    "semrag_extraction_cache.json",
)


def write_manifest(
    build_dir: Path,
    *,
    git_sha: str,
    started_at: str,
    extra: dict[str, Any] | None = None,
) -> Path:
    files_meta: dict[str, dict[str, Any]] = {}
    for name in ARTIFACT_FILENAMES:
        p = build_dir / name
        if p.is_file():
            files_meta[name] = {
                "sha256": sha256_file(p),
                "size_bytes": p.stat().st_size,
            }
    manifest: dict[str, Any] = {
        "version": build_dir.name,
        "git_sha": git_sha,
        "started_at": started_at,
        "finished_at": datetime.now(timezone.utc).isoformat(),
        "files": files_meta,
    }
    if extra:
        manifest["extra"] = extra
    out = build_dir / "manifest.json"
    out.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return out
