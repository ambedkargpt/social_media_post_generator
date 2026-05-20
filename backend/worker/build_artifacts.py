"""
CLI: build RAG + SEMRAG artifacts into ``ARTIFACTS_ROOT/builds/<version>/``, validate, manifest, promote.

Run: ``python -m backend.worker.build_artifacts --once``
"""

from __future__ import annotations

import argparse
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path

from backend.config import REPO_ROOT
from backend.Fetch import rebuild_rag_artifacts_from_data_file, rebuild_semrag_artifacts_from_data_file
from backend.worker.git_ops import git_sha_short
from backend.worker.lock import artifact_build_lock
from backend.worker.manifest import write_manifest
from backend.worker.paths import builds_dir, lock_file_path
from backend.worker.promote_util import promote_build_dir
from backend.worker.validate import manifest_matches_disk, validate_build_dir


def transcript_master_path() -> Path:
    raw = (os.getenv("TRANSCRIPT_MASTER_PATH") or "").strip()
    if raw:
        return Path(raw).expanduser().resolve()
    return (REPO_ROOT / "data" / "ravishkumar_all_transcripts.txt").resolve()


def prune_old_builds(keep: int = 2) -> None:
    bd = builds_dir()
    if not bd.is_dir():
        return
    dirs = sorted([p for p in bd.iterdir() if p.is_dir()], key=lambda p: p.name, reverse=True)
    for victim in dirs[keep:]:
        shutil.rmtree(victim, ignore_errors=True)


def run_build(*, promote: bool = True, prune_keep: int = 2, require_semrag: bool = True) -> Path:
    data_txt = transcript_master_path()
    if not data_txt.is_file():
        raise FileNotFoundError(f"Transcript master not found: {data_txt}")

    started = datetime.now(timezone.utc).isoformat()
    sha = git_sha_short()
    ver = f"{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}_{sha}"
    build_dir = builds_dir() / ver
    build_dir.mkdir(parents=True, exist_ok=True)

    index_path = build_dir / "faiss_index.bin"
    chunks_path = build_dir / "argument_chunks.json"
    vc_path = build_dir / "video_context.json"
    te_path = build_dir / "video_title_embeddings.json"
    graph_path = build_dir / "semrag_graph.json"
    cache_path = build_dir / "semrag_extraction_cache.json"
    sem_chunks_path = build_dir / "semrag_chunks.json"

    rebuild_rag_artifacts_from_data_file(
        data_txt,
        index_path=index_path,
        chunks_path=chunks_path,
        video_context_path=vc_path,
        title_emb_path=te_path,
    )
    rebuild_semrag_artifacts_from_data_file(
        data_txt,
        graph_path=graph_path,
        cache_path=cache_path,
        chunks_path=sem_chunks_path,
    )

    ok, errors = validate_build_dir(build_dir, require_semrag=require_semrag)
    if not ok:
        raise RuntimeError(f"Validation failed: {errors}")

    write_manifest(
        build_dir,
        git_sha=sha,
        started_at=started,
        extra={"transcript_master": str(data_txt)},
    )

    ok2, err2 = manifest_matches_disk(build_dir)
    if not ok2:
        raise RuntimeError(f"Manifest check failed: {err2}")

    if promote:
        promote_build_dir(build_dir)
        prune_old_builds(prune_keep)
        try:
            from backend.worker.backup_artifacts import backup_current_if_configured

            backup_current_if_configured()
        except Exception:
            pass

    return build_dir


def main() -> None:
    parser = argparse.ArgumentParser(description="Build and optionally promote RAG/SEMRAG artifacts.")
    parser.add_argument("--once", action="store_true", help="Run a single build (default).")
    parser.add_argument("--no-promote", action="store_true", help="Build only; do not update current symlink.")
    parser.add_argument("--prune-keep", type=int, default=2, help="Keep N newest builds under builds/ (default 2).")
    parser.add_argument(
        "--skip-semrag-check",
        action="store_true",
        help="Do not require SEMRAG graph thresholds (not recommended).",
    )
    args = parser.parse_args()
    with artifact_build_lock(lock_file_path()):
        out = run_build(
            promote=not args.no_promote,
            prune_keep=args.prune_keep,
            require_semrag=not args.skip_semrag_check,
        )
    print(f"OK build_dir={out}")


if __name__ == "__main__":
    main()
