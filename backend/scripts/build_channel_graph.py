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



def _graph_over_corpus(channel, *, force: bool) -> int:
    """
    Build the knowledge graph over the chunks retrieval actually searches.

    The default path re-chunks the transcripts with the SEMRAG chunker, which
    produces a different partition of the same text: for Congress, 329 chunks
    averaging 595 characters against the retriever's 51 averaging 1183. The
    graph maps entities onto sem_vid000_c001 while the vector store holds
    vid000_c001, so every candidate the graph returns is looked up, missed and
    skipped. The stage runs and contributes nothing.

    The ids cannot simply be renamed. sem_vid000_c001 is roughly the first half
    of vid000_c001, so stripping the prefix would map the graph onto text it
    never indexed, which is worse than missing: it would point at the wrong
    passage confidently.

    Building over the corpus gives one chunking with two consumers. The graph
    is coarser than the SEMRAG chunker intends, so entity-to-chunk mappings are
    less precise. That is the price of the stage working at all.
    """
    from backend.config import get_settings
    from backend.semrag.build import build_semrag_graph

    corpus = channel.rag_chunks_path
    graph_path = channel.semrag_graph_path
    cache_path = channel.semrag_cache_path

    if not corpus or not corpus.is_file():
        print(f"ERROR: retrieval corpus missing: {corpus}")
        print("Build it first:")
        print(f"  python -m backend.scripts.build_tenant_corpus --channel {channel.name}")
        return 1
    if not graph_path:
        print("ERROR: channel config sets no semrag_graph_path.")
        return 1

    chunks = json.loads(corpus.read_text(encoding="utf-8"))
    if isinstance(chunks, dict):
        chunks = chunks.get("chunks") or []
    if not chunks:
        print(f"ERROR: corpus at {corpus} holds no chunks.")
        return 1

    ids = [str(c.get("chunk_id") or "") for c in chunks]
    print("\nBuilding knowledge graph over the retrieval corpus")
    print(f"  corpus     : {corpus}  ({len(chunks)} chunks)")
    print(f"  chunk ids  : {ids[0]} ... {ids[-1]}")
    print(f"  graph      : {graph_path}")

    # build_semrag_graph loads and extends whatever graph is already present,
    # and the existing one is keyed on sem_* ids. Merging the two id spaces
    # would leave half the references unresolvable, so start clean.
    if graph_path.is_file():
        if not force:
            print("\nERROR: a graph already exists at that path.")
            print("  It is keyed on sem_* ids and cannot be merged with a corpus-keyed one.")
            print("  Re-run with --force to replace it (a .bak copy is kept).")
            return 1
        backup = graph_path.with_suffix(".sem-chunked.bak.json")
        backup.write_bytes(graph_path.read_bytes())
        graph_path.unlink()
        print(f"  previous graph backed up -> {backup.name}")

    graph_path.parent.mkdir(parents=True, exist_ok=True)
    if cache_path:
        cache_path.parent.mkdir(parents=True, exist_ok=True)

    build_semrag_graph(
        chunks=chunks,
        settings=get_settings(),
        graph_path=graph_path,
        cache_path=cache_path,
        force_rebuild=False,
    )
    print("  ->", _graph_summary(graph_path))

    # The whole point of this mode: the graph must reference ids the vector
    # store holds. Report it rather than assume it.
    g = json.loads(graph_path.read_text(encoding="utf-8"))
    mapped = set((g.get("chunk_entities") or {}).keys())
    overlap = len(mapped & set(ids))
    print(f"\n  graph chunk ids present in the corpus: {overlap} of {len(mapped)}")
    if mapped and overlap != len(mapped):
        print("  WARNING: some graph ids are absent from the corpus; retrieval skips those.")
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--channel", required=True)
    ap.add_argument("--semrag", action="store_true", help="Build the knowledge graph.")
    ap.add_argument("--rag", action="store_true", help="Build chunks/embeddings and upsert to Pinecone.")
    ap.add_argument(
        "--from-corpus",
        action="store_true",
        help=(
            "Build the graph over the retrieval corpus (rag_chunks_path) instead of "
            "re-chunking the transcripts. Required for the graph to affect retrieval."
        ),
    )
    ap.add_argument(
        "--force",
        action="store_true",
        help="With --from-corpus, replace an existing graph (a .bak copy is kept).",
    )
    args = ap.parse_args(argv)

    if not (args.semrag or args.rag):
        ap.error("choose at least one of --semrag / --rag")

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

    if args.semrag and args.from_corpus:
        return _graph_over_corpus(channel, force=args.force)

    if args.semrag:
        graph_path = channel.semrag_graph_path
        print(f"\nBuilding knowledge graph -> {graph_path}")
        for p in (channel.semrag_graph_path, channel.semrag_chunks_path, channel.semrag_cache_path):
            if p:
                p.parent.mkdir(parents=True, exist_ok=True)
        import Fetch as fetch  # noqa: PLC0415 - needs sys.path set above

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
        import Fetch as fetch  # noqa: PLC0415 - needs sys.path set above

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
