"""Post-build validation for artifact directories."""

from __future__ import annotations

import json
from pathlib import Path

import faiss

from backend.worker.manifest import sha256_file


def validate_build_dir(
    build_dir: Path,
    *,
    require_semrag: bool = True,
    min_graph_entities: int = 1,
) -> tuple[bool, list[str]]:
    """
    Return (ok, warnings_or_errors).

    - Ensures required files exist and FAISS loads.
    - If ``require_semrag``, checks ``semrag_graph.json`` has non-empty ``entities`` list.
    """
    errors: list[str] = []
    for name in ("faiss_index.bin", "argument_chunks.json", "video_context.json"):
        p = build_dir / name
        if not p.is_file() or p.stat().st_size == 0:
            errors.append(f"missing_or_empty:{name}")

    try:
        idx = faiss.read_index(str(build_dir / "faiss_index.bin"))
        if idx.ntotal < 0:
            errors.append("faiss_ntotal_invalid")
    except Exception as exc:
        errors.append(f"faiss_load_failed:{exc}")

    semrag_graph = build_dir / "semrag_graph.json"
    if require_semrag:
        if not semrag_graph.is_file():
            errors.append("missing:semrag_graph.json")
        else:
            try:
                data = json.loads(semrag_graph.read_text(encoding="utf-8"))
                entities = data.get("entities") if isinstance(data, dict) else None
                n = len(entities) if isinstance(entities, list) else 0
                if n < min_graph_entities:
                    errors.append(f"semrag_entities_below_threshold:{n}<{min_graph_entities}")
            except Exception as exc:
                errors.append(f"semrag_graph_invalid:{exc}")

    chunks_path = build_dir / "semrag_chunks.json"
    if require_semrag and (not chunks_path.is_file() or chunks_path.stat().st_size < 32):
        errors.append("missing_or_empty:semrag_chunks.json")

    return (len(errors) == 0, errors)


def manifest_matches_disk(build_dir: Path) -> tuple[bool, str | None]:
    """If manifest.json exists, verify recorded sha256 matches files on disk."""
    man_path = build_dir / "manifest.json"
    if not man_path.is_file():
        return True, None
    try:
        data = json.loads(man_path.read_text(encoding="utf-8"))
        files = data.get("files") if isinstance(data, dict) else None
        if not isinstance(files, dict):
            return True, None
        for name, meta in files.items():
            p = build_dir / name
            if not p.is_file():
                return False, f"missing_file:{name}"
            rec = meta.get("sha256") if isinstance(meta, dict) else None
            if rec and sha256_file(p) != rec:
                return False, f"checksum_mismatch:{name}"
        return True, None
    except Exception as exc:
        return False, str(exc)
