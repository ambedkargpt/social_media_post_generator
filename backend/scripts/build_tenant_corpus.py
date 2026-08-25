"""
Build one channel's retrieval corpus and load it into that channel's namespace.

This is the step that turns declared isolation into real isolation. Until a
channel's corpus exists, retrieval falls back to the shared stack and its posts
are written from another channel's material.

Why this exists rather than the pipeline runner: the orchestrator gates
rag_artifacts behind ingestion, and dependency state is per run, so asking for
rag_artifacts alone always blocks and --only-stage re-scrapes YouTube. The
transcripts are already on disk. Nothing needs to be fetched to chunk them.

    # See what would be built. Parses and chunks only, no embedding, no writes.
    python -m backend.scripts.build_tenant_corpus --channel congress --dry-run

    # Build for real: embeds every chunk and upserts into the channel namespace.
    python -m backend.scripts.build_tenant_corpus --channel congress

    python -m backend.scripts.build_tenant_corpus --all --dry-run

Then confirm with:

    python -m backend.scripts.check_isolation --strict
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.pipeline.orchestration.channel_config import load_channel_config  # noqa: E402

_BACKEND = Path(__file__).resolve().parents[1]
_CHANNELS = _BACKEND / "config" / "channels"


def _all_channels() -> list[str]:
    if not _CHANNELS.is_dir():
        return []
    return sorted(p.stem for p in _CHANNELS.glob("*.json") if p.stem != "template")


def _preview(channel) -> int:
    """Parse and chunk without embedding, so the cost is known before it is paid."""
    from backend.pipeline.transcript_parser import parse_transcripts
    from backend.pipeline.chunker import chunk_videos
    from backend.pipeline.argument_scorer import score_argument_chunks

    raw = channel.master_transcript_path.read_text(encoding="utf-8")
    videos = parse_transcripts(raw)
    chunks = score_argument_chunks(chunk_videos(videos))

    print(f"  videos parsed      : {len(videos)}")
    print(f"  chunks produced    : {len(chunks)}")
    if chunks:
        print(f"  chunk id format    : {chunks[0].get('chunk_id')}")
    print(f"  would write        : {channel.rag_chunks_path}")
    print(f"  would upsert into  : namespace {channel.pinecone_namespace!r}")
    print(f"  embedding calls    : {len(chunks)} chunk(s)  <-- this is the spend")
    return len(chunks)


def build(name: str, *, dry_run: bool) -> int:
    try:
        channel = load_channel_config(_BACKEND, name)
    except (FileNotFoundError, ValueError) as exc:
        print(f"{name}: config unreadable ({exc})")
        return 1

    print(f"\n{'=' * 70}\n{name}  (tenant: {channel.tenant_slug})\n{'=' * 70}")

    if not channel.rag_chunks_path or not channel.pinecone_namespace:
        # Without both, a build would land in the shared corpus and the shared
        # namespace, which is the mixing this is meant to end.
        print("  declares no rag_chunks_path or no pinecone_namespace, skipping.")
        print("  A channel without both cannot be isolated; fix the channel config first.")
        return 0

    if not channel.master_transcript_path.is_file():
        print(f"  no transcripts at {channel.master_transcript_path}, nothing to build.")
        return 1

    if dry_run:
        _preview(channel)
        print("\n  dry run: nothing embedded, nothing written, nothing upserted.")
        return 0

    from backend.Fetch import rebuild_rag_artifacts_from_data_file

    channel.rag_chunks_path.parent.mkdir(parents=True, exist_ok=True)
    print(f"  building from {channel.master_transcript_path.name} ...")
    rebuild_rag_artifacts_from_data_file(
        channel.master_transcript_path,
        chunks_path=channel.rag_chunks_path,
        video_context_path=channel.rag_video_context_path,
        title_emb_path=channel.rag_title_embeddings_path,
        namespace=channel.pinecone_namespace,
    )
    ok = channel.rag_chunks_path.is_file()
    print(f"  corpus written     : {ok}  ({channel.rag_chunks_path})")
    print(f"  namespace          : {channel.pinecone_namespace}")
    return 0 if ok else 1


def main() -> int:
    ap = argparse.ArgumentParser(description="Build a channel's own retrieval corpus.")
    ap.add_argument("--channel", help="Channel config name under config/channels/*.json")
    ap.add_argument("--all", action="store_true", help="Every channel that declares isolation.")
    ap.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse and chunk only. Reports how many embedding calls a real run would make.",
    )
    args = ap.parse_args()

    if not args.channel and not args.all:
        ap.error("pass --channel <name> or --all")

    names = _all_channels() if args.all else [args.channel]
    rc = 0
    for name in names:
        rc |= build(name, dry_run=args.dry_run)

    if not args.dry_run:
        print("\nNow verify: python -m backend.scripts.check_isolation --strict")
    return rc


if __name__ == "__main__":
    raise SystemExit(main())
