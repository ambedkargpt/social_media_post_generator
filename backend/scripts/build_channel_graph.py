"""
Build a channel's knowledge graph and vector index from transcripts on disk.

The orchestrator's graph stages depend on ingestion, so running them through the
pipeline re-scans YouTube even when every transcript is already downloaded --
slow, and it burns rate limit. This script drives the same rebuild functions
directly from the channel's master transcript.

Usage:
    python -m backend.scripts.build_channel_graph --channel samajwadi --semrag
    python -m backend.scripts.build_channel_graph --channel congress --semrag --rag
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from backend.pipeline.orchestration.channel_config import load_channel_config

# Fetch.py lives at the backend root and is imported as a top-level module.
_BACKEND = Path(__file__).resolve().parent.parent
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))


def _graph_summary(path: Path) -> str:
    if not path.is_file():
        return "graph not written"
    try:
        g = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        return f"unreadable ({exc})"
    return (
        f"entities={len(g.get('entities') or [])} "
        f"relations={len(g.get('relations') or [])} "
        f"chunks_mapped={len(g.get('chunk_entities') or {})}"
    )


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--channel", required=True)
    ap.add_argument("--semrag", action="store_true", help="Build the knowledge graph.")
    ap.add_argument("--rag", action="store_true", help="Build chunks/embeddings and upsert to Pinecone.")
    args = ap.parse_args(argv)

    if not (args.semrag or args.rag):
        ap.error("choose at least one of --semrag / --rag")

    import Fetch as fetch  # noqa: PLC0415 - needs sys.path set above

    project_root = _BACKEND
    channel = load_channel_config(project_root, args.channel)
    master = channel.master_transcript_path

    print(f"channel        : {channel.name}")
    print(f"master transcript: {master}")
    if not master.is_file():
        print("ERROR: master transcript missing; ingestion has not mirrored it yet.")
        return 1
    videos = master.read_text(encoding="utf-8").count("===== ")
    print(f"videos in file : {videos}")

    if args.semrag:
        graph_path = channel.semrag_graph_path
        print(f"\nBuilding knowledge graph -> {graph_path}")
        for p in (channel.semrag_graph_path, channel.semrag_chunks_path, channel.semrag_cache_path):
            if p:
                p.parent.mkdir(parents=True, exist_ok=True)
        fetch.rebuild_semrag_artifacts_from_data_file(
            master,
            graph_path=channel.semrag_graph_path,
            cache_path=channel.semrag_cache_path,
            chunks_path=channel.semrag_chunks_path,
        )
        if graph_path:
            print("  ->", _graph_summary(graph_path))

    if args.rag:
        print(f"\nBuilding RAG artifacts (pinecone namespace: {channel.pinecone_namespace or '(default)'})")
        for p in (channel.rag_chunks_path, channel.rag_video_context_path, channel.rag_title_embeddings_path):
            if p:
                p.parent.mkdir(parents=True, exist_ok=True)
        fetch.rebuild_rag_artifacts_from_data_file(
            master,
            chunks_path=channel.rag_chunks_path,
            video_context_path=channel.rag_video_context_path,
            title_emb_path=channel.rag_title_embeddings_path,
            namespace=channel.pinecone_namespace,
        )
        if channel.rag_chunks_path and channel.rag_chunks_path.is_file():
            n = len(json.loads(channel.rag_chunks_path.read_text(encoding="utf-8")))
            print(f"  -> chunks written: {n}")

    print("\nDone.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
