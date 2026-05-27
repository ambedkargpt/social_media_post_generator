"""
Readiness checks for RAG/SEMRAG artifacts and Pinecone connectivity.

MIGRATION NOTE: faiss_index.bin checks removed — vector search is now
handled by Pinecone Serverless (always-available cloud service).
Health check now pings the Pinecone index instead of reading a local file.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

from backend.config import Settings, effective_artifact_manifest_path

logger = logging.getLogger(__name__)


def _check_pinecone(settings: Settings) -> bool:
    """Ping the Pinecone index and return True if it responds with >= 0 vectors."""
    if not settings.pinecone_api_key:
        logger.warning("PINECONE_API_KEY not configured — skipping Pinecone health check.")
        return False
    try:
        from pinecone import Pinecone  # type: ignore[import-untyped]

        pc = Pinecone(api_key=settings.pinecone_api_key)
        idx = pc.Index(settings.pinecone_index_name)
        stats = idx.describe_index_stats()
        total = int(stats.total_vector_count or 0)
        logger.debug("Pinecone index %r: %d vectors", settings.pinecone_index_name, total)
        return True  # reachable and responding
    except Exception as exc:
        logger.error("Pinecone health check failed: %s", exc)
        return False


def assess_artifact_readiness(settings: Settings) -> dict[str, Any]:
    """Return a detail dict and whether artifacts are ready for traffic.

    Checks:
    - rag_chunks_ok      — argument_chunks.json exists and non-empty.
    - semrag_graph_ok    — semrag_graph.json exists (when SEMRAG enabled).
    - pinecone_ok        — Pinecone index is reachable.
    - manifest_ok        — manifest.json parses (when ARTIFACTS_ROOT is set).
    """
    out: dict[str, Any] = {
        "rag_chunks_ok": False,
        "semrag_graph_ok": False,
        "pinecone_ok": False,
        "manifest_ok": False,
        "manifest_expected": False,
        "artifact_version": None,
        "git_sha": None,
        "built_at": None,
    }

    # --- RAG chunks (needed for BM25 and metadata lookup) ---
    out["rag_chunks_ok"] = bool(
        settings.rag_chunks_path.is_file()
        and settings.rag_chunks_path.stat().st_size > 0
    )

    # --- SEMRAG graph ---
    if settings.semrag_enabled:
        out["semrag_graph_ok"] = bool(
            settings.semrag_graph_path.is_file()
            and settings.semrag_graph_path.stat().st_size > 64
        )
    else:
        out["semrag_graph_ok"] = True  # not required when SEMRAG disabled

    # --- Pinecone connectivity ---
    out["pinecone_ok"] = _check_pinecone(settings)

    # --- Manifest (optional — only expected when ARTIFACTS_ROOT is set) ---
    mp = effective_artifact_manifest_path(settings)
    out["manifest_expected"] = bool(settings.artifacts_root or settings.artifact_manifest_path)

    if mp is not None:
        if mp.is_file():
            try:
                data = json.loads(mp.read_text(encoding="utf-8"))
                out["manifest_ok"] = True
                out["artifact_version"] = data.get("version")
                out["git_sha"] = data.get("git_sha")
                out["built_at"] = data.get("built_at")
            except Exception:
                out["manifest_ok"] = False
        else:
            out["manifest_ok"] = False

    manifest_gate = True
    if out["manifest_expected"]:
        manifest_gate = out["manifest_ok"]

    ready = bool(
        out["rag_chunks_ok"]
        and out["semrag_graph_ok"]
        and out["pinecone_ok"]
        and manifest_gate
    )
    return {"ready": ready, "details": out}
