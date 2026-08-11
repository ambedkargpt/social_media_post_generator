"""
Show the top-N transcript chunks a query would retrieve, for one channel.

Useful for demonstrating what the pipeline actually has to work with, and for
sanity-checking a channel's chunks without standing up the whole app.

Ranking here is lexical (TF-IDF cosine over the chunk text). Production retrieval
additionally uses embeddings and the knowledge graph, which need the embedding
API; this script is deliberately dependency-free so it still runs when that key
is unavailable. Results are therefore indicative, not identical to production.

Usage:
    python -m backend.scripts.search_chunks --channel congress --query "expressway collapse"
    python -m backend.scripts.search_chunks --channel samajwadi --query "शिक्षा" --top 5 --graph
"""

from __future__ import annotations

import argparse
import json
import math
import re
from collections import Counter, defaultdict
from pathlib import Path

_DATA = Path(__file__).resolve().parent.parent / "data" / "semrag"
# Split on non-word runs; \w keeps Devanagari because Python's re is Unicode-aware.
_TOKEN_RE = re.compile(r"\w+", re.UNICODE)


def tokenize(text: str) -> list[str]:
    return [t.lower() for t in _TOKEN_RE.findall(text or "") if len(t) > 1]


def rank(chunks: list[dict], query: str, top: int) -> list[tuple[float, dict]]:
    """TF-IDF cosine between the query and each chunk."""
    docs = [tokenize(c.get("chunk_text", "")) for c in chunks]
    df: Counter[str] = Counter()
    for d in docs:
        df.update(set(d))
    n = max(1, len(docs))
    idf = {t: math.log(1 + n / (1 + c)) for t, c in df.items()}

    def vec(tokens: list[str]) -> dict[str, float]:
        tf = Counter(tokens)
        if not tf:
            return {}
        mx = max(tf.values())
        return {t: (f / mx) * idf.get(t, 0.0) for t, f in tf.items()}

    qv = vec(tokenize(query))
    qn = math.sqrt(sum(v * v for v in qv.values())) or 1.0

    scored: list[tuple[float, dict]] = []
    for doc, chunk in zip(docs, chunks):
        dv = vec(doc)
        if not dv:
            continue
        dot = sum(w * dv.get(t, 0.0) for t, w in qv.items())
        if dot <= 0:
            continue
        dn = math.sqrt(sum(v * v for v in dv.values())) or 1.0
        scored.append((dot / (qn * dn), chunk))
    scored.sort(key=lambda x: -x[0])
    return scored[:top]


def graph_hits(channel: str, chunk_ids: set[str]) -> list[str]:
    """Facts in the knowledge graph whose evidence is one of these chunks."""
    path = _DATA / channel / "semrag_graph.json"
    if not path.is_file():
        return []
    g = json.loads(path.read_text(encoding="utf-8"))
    names = {e["entity_id"]: e.get("canonical_name", "?") for e in g.get("entities", [])}
    out: list[str] = []
    seen: set[tuple[str, str, str]] = set()
    for r in g.get("relations", []):
        if r.get("evidence_chunk_id") not in chunk_ids:
            continue
        h = names.get(r.get("head_entity_id"))
        t = names.get(r.get("tail_entity_id"))
        rel = r.get("relation")
        if not (h and t and rel) or (h, rel, t) in seen:
            continue
        seen.add((h, rel, t))
        out.append(f"{h} --{rel}--> {t}")
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--channel", default="congress")
    ap.add_argument("--query", required=True)
    ap.add_argument("--top", type=int, default=5)
    ap.add_argument("--chars", type=int, default=320, help="Characters of chunk text to show.")
    ap.add_argument("--graph", action="store_true", help="Also show knowledge-graph facts from these chunks.")
    args = ap.parse_args(argv)

    src = _DATA / args.channel / "semrag_chunks.json"
    if not src.is_file():
        print(f"No chunks for channel '{args.channel}' at {src}")
        return 1
    chunks = json.loads(src.read_text(encoding="utf-8"))

    print(f'Channel : {args.channel}   ({len(chunks)} chunks from '
          f'{len({c.get("video_title") for c in chunks})} videos)')
    print(f'Query   : "{args.query}"')
    print("=" * 78)

    results = rank(chunks, args.query, args.top)
    if not results:
        print("No matching chunks.")
        return 0

    for i, (score, c) in enumerate(results, 1):
        text = " ".join((c.get("chunk_text") or "").split())
        print(f"\n[{i}]  score {score:.3f}   {c.get('chunk_id')}")
        print(f"     video: {str(c.get('video_title'))[:66]}")
        print(f"     {text[:args.chars]}{'…' if len(text) > args.chars else ''}")

    if args.graph:
        facts = graph_hits(args.channel, {c.get("chunk_id") for _, c in results})
        print("\n" + "=" * 78)
        print(f"Knowledge-graph facts extracted from these {len(results)} chunks:")
        if not facts:
            print("  (none)")
        for f in facts[:15]:
            print("  -", f)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
