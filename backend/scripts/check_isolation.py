"""
Report, per tenant, what is isolated and what is still shared.

Each channel is supposed to answer only from its own material: its own corpus,
its own Pinecone namespace, its own knowledge graph. A tenant that declares
isolation in its channel config but has no artifacts on disk does not fail. It
falls back to whatever the shared stack holds, silently, and one party's words
end up behind another party's post.

That failure is invisible at request time, so this makes it visible. Run it
after adding a channel, after a rebuild, and in CI:

    python -m backend.scripts.check_isolation
    python -m backend.scripts.check_isolation --strict   # exit 1 on any gap

--strict is the one to wire into CI once the corpora exist. Before then it will
fail, which is the honest answer rather than a green tick over shared data.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.pipeline.multi_rag import artifacts_for_tenant  # noqa: E402
from backend.pipeline.orchestration.channel_config import load_channel_config  # noqa: E402

_BACKEND = Path(__file__).resolve().parents[1]
_CHANNELS = _BACKEND / "config" / "channels"


def _channels() -> list[str]:
    if not _CHANNELS.is_dir():
        return []
    return sorted(p.stem for p in _CHANNELS.glob("*.json") if p.stem != "template")


def _namespace_counts() -> dict[str, int] | None:
    """
    Vectors per Pinecone namespace, or None when the index cannot be reached.

    A corpus file on disk proves nothing. Chunks are written before the upsert,
    so a failed or quota-blocked upsert leaves the file present and the
    namespace empty, and a check that looks only at the filesystem calls that
    isolated. It is not: retrieval against an empty namespace returns nothing.
    """
    try:
        from backend.config import get_settings
        from pinecone import Pinecone

        s = get_settings()
        idx = Pinecone(api_key=s.pinecone_api_key).Index(s.pinecone_index_name)
        stats = idx.describe_index_stats()
        return {
            ns: int(info.get("vector_count") or 0)
            for ns, info in (stats.get("namespaces") or {}).items()
        }
    except Exception:
        return None


def main() -> int:
    ap = argparse.ArgumentParser(description="Per-tenant retrieval isolation report.")
    ap.add_argument(
        "--strict",
        action="store_true",
        help="Exit 1 if any tenant declaring isolation is still sharing material.",
    )
    ap.add_argument(
        "--offline",
        action="store_true",
        help="Skip the Pinecone namespace check (filesystem only, cannot confirm isolation).",
    )
    args = ap.parse_args()

    counts = None if args.offline else _namespace_counts()

    rows = []
    for name in _channels():
        try:
            channel = load_channel_config(_BACKEND, name)
        except (FileNotFoundError, ValueError) as exc:
            print(f"  {name}: config unreadable ({exc})")
            continue
        art = artifacts_for_tenant(channel.tenant_slug)
        rows.append((name, channel, art))

    if not rows:
        print("No channel configs found.")
        return 1

    print("=" * 78)
    print("TENANT ISOLATION REPORT")
    print("=" * 78)

    # Two channels pointing at one namespace is the worst case: it is not a
    # missing artifact but an active mix, and no rebuild will fix it.
    seen_namespace: dict[str, str] = {}
    collisions: list[str] = []
    failing = 0

    for name, channel, art in rows:
        print(f"\n{name}  (tenant: {channel.tenant_slug})")
        ns = (art.pinecone_namespace if art else None) or channel.pinecone_namespace
        print(f"  pinecone namespace : {ns or '(default, SHARED)'}")
        print(f"  rag corpus         : {channel.rag_chunks_path}")
        print(f"    built            : {bool(channel.rag_chunks_path and channel.rag_chunks_path.is_file())}")
        print(f"  semrag graph       : {channel.semrag_graph_path}")
        print(f"    built            : {bool(channel.semrag_graph_path and channel.semrag_graph_path.is_file())}")

        if ns:
            if ns in seen_namespace and seen_namespace[ns] != name:
                collisions.append(f"{name} and {seen_namespace[ns]} both use namespace {ns!r}")
            seen_namespace[ns] = name

        vectors = None if counts is None else counts.get(ns or "", 0)
        if counts is None:
            print("  vectors in ns      : unknown (index not reachable)")
        else:
            print(f"  vectors in ns      : {vectors}")

        if art is None:
            print("  status             : UNRESOLVED (tenant maps to no channel)")
            failing += 1
            continue
        if not art.declares_isolation:
            print("  status             : shared by design (declares no namespace or corpus)")
            continue
        gaps = list(art.isolation_gaps)
        # The upsert is the step that actually isolates retrieval. Everything
        # before it is preparation.
        if counts is None:
            gaps.append("namespace not verified (index unreachable)")
        elif not vectors:
            gaps.append(f"namespace {ns!r} holds no vectors: corpus never upserted")
        if gaps:
            failing += 1
            print("  status             : NOT ISOLATED, falls back to shared material")
            for g in gaps:
                print(f"      - {g}")
        else:
            print("  status             : isolated")

    print("\n" + "=" * 78)
    for c in collisions:
        print(f"COLLISION: {c}")
    if collisions:
        print()
    if failing:
        print(f"{failing} tenant(s) declare isolation but do not have it.")
        print("Until their artifacts exist, their posts are built from shared material.")
    else:
        print("Every tenant that declares isolation has it.")
    print("=" * 78)

    return 1 if args.strict and (failing or collisions) else 0


if __name__ == "__main__":
    raise SystemExit(main())
