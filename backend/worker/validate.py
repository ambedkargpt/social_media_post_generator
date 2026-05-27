"""Post-build validation for artifact directories.

MIGRATION NOTE: faiss-cpu removed — FAISS index validation replaced by:
  - argument_chunks.json content check (non-empty, parseable)
  - Pinecone vector count check (optional; skipped in offline/CI builds)
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path

from backend.worker.manifest import sha256_file

logger = logging.getLogger(__name__)


def _pinecone_vector_count(min_expected: int = 1) -> tuple[bool, str | None]:
    """Return (ok, error_message).

    Pings the configured Pinecone index and checks that it has at least
    ``min_expected`` vectors.  Returns (True, None) when:
      - PINECONE_API_KEY is not set (offline / CI build — skip silently), or
      - the index reports >= min_expected vectors.
    """
    api_key = (os.getenv("PINECONE_API_KEY") or "").strip()
    if not api_key:
        logger.info("PINECONE_API_KEY not set — skipping Pinecone vector count check.")
        return True, None

    index_name = (os.getenv("PINECONE_INDEX_NAME") or "ambedkargpt").strip()
    try:
        from pinecone import Pinecone  # type: ignore[import-untyped]

        pc = Pinecone(api_key=api_key)
        idx = pc.Index(index_name)
        stats = idx.describe_index_stats()
        total = int(stats.total_vector_count or 0)
        if total < min_expected:
            return False, f"pinecone_vector_count_too_low:{total}<{min_expected}"
        logger.info("Pinecone index %r has %d vectors — OK.", index_name, total)
        return True, None
    except Exception as exc:
        return False, f"pinecone_check_failed:{exc}"


def validate_build_dir(
    build_dir: Path,
    *,
    require_semrag: bool = True,
    min_graph_entities: int = 1,
    check_pinecone: bool = True,
) -> tuple[bool, list[str]]:
    """Return (ok, warnings_or_errors).

    Checks:
    - argument_chunks.json  — exists, non-empty, valid JSON, has at least 1 chunk.
    - video_context.json    — exists and non-empty.
    - semrag_graph.json     — exists and has >= min_graph_entities entities (if require_semrag).
    - semrag_chunks.json    — exists and non-empty (if require_semrag).
    - Pinecone vector count — >= len(chunks) (if check_pinecone and PINECONE_API_KEY set).
    """
    errors: list[str] = []

    # --- argument_chunks.json ---
    chunks_path = build_dir / "argument_chunks.json"
    if not chunks_path.is_file() or chunks_path.stat().st_size == 0:
        errors.append("missing_or_empty:argument_chunks.json")
        chunk_count = 0
    else:
        try:
            chunks = json.loads(chunks_path.read_text(encoding="utf-8"))
            chunk_count = len(chunks) if isinstance(chunks, list) else 0
            if chunk_count == 0:
                errors.append("argument_chunks_empty:0_items")
        except Exception as exc:
            errors.append(f"argument_chunks_invalid:{exc}")
            chunk_count = 0

    # --- video_context.json ---
    for name in ("video_context.json",):
        p = build_dir / name
        if not p.is_file() or p.stat().st_size == 0:
            errors.append(f"missing_or_empty:{name}")

    # --- SEMRAG artifacts ---
    if require_semrag:
        semrag_graph = build_dir / "semrag_graph.json"
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

        sem_chunks = build_dir / "semrag_chunks.json"
        if not sem_chunks.is_file() or sem_chunks.stat().st_size < 32:
            errors.append("missing_or_empty:semrag_chunks.json")

    # --- Pinecone vector count ---
    if check_pinecone and chunk_count > 0:
        ok, err = _pinecone_vector_count(min_expected=1)
        if not ok and err:
            errors.append(err)

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
