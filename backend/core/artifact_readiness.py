"""
Readiness checks for on-disk RAG/SEMRAG artifacts (FAISS, chunks, graph, optional manifest).
"""

from __future__ import annotations

import json
from typing import Any

import faiss

from backend.config import Settings, effective_artifact_manifest_path


def assess_artifact_readiness(settings: Settings) -> dict[str, Any]:
    """
    Return a detail dict and whether artifacts are ready for traffic.

    If ``ARTIFACTS_ROOT`` or ``ARTIFACT_MANIFEST_PATH`` is set, ``manifest.json`` must exist and parse.
    """
    out: dict[str, Any] = {
        "faiss_index_ok": False,
        "rag_chunks_ok": False,
        "semrag_graph_ok": False,
        "manifest_ok": False,
        "manifest_expected": False,
        "faiss_smoke_ok": False,
        "artifact_version": None,
        "git_sha": None,
        "built_at": None,
    }

    out["faiss_index_ok"] = bool(
        settings.faiss_index_path.is_file() and settings.faiss_index_path.stat().st_size > 0
    )
    out["rag_chunks_ok"] = bool(
        settings.rag_chunks_path.is_file() and settings.rag_chunks_path.stat().st_size > 0
    )
    if settings.semrag_enabled:
        out["semrag_graph_ok"] = bool(
            settings.semrag_graph_path.is_file() and settings.semrag_graph_path.stat().st_size > 64
        )
    else:
        out["semrag_graph_ok"] = True

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

    try:
        if out["faiss_index_ok"]:
            idx = faiss.read_index(str(settings.faiss_index_path))
            out["faiss_smoke_ok"] = idx.ntotal >= 0
    except Exception:
        out["faiss_smoke_ok"] = False

    manifest_gate = True
    if out["manifest_expected"]:
        manifest_gate = out["manifest_ok"]

    ready = bool(
        out["faiss_index_ok"]
        and out["rag_chunks_ok"]
        and out["semrag_graph_ok"]
        and out["faiss_smoke_ok"]
        and manifest_gate
    )
    return {"ready": ready, "details": out}
