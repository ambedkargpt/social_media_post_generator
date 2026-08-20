"""
Print the most recent web-research trace in reading order.

A generation drops a dozen files into WEB_RESEARCH_DEBUG_DIR. This walks one run
and shows the chain in the order it happened: news item, claims, the query sent
to SearXNG, what came back, the verdict, and what the post did with it.

    python -m backend.scripts.show_research_trace            # latest run
    python -m backend.scripts.show_research_trace --list     # recent runs
    python -m backend.scripts.show_research_trace --run 2    # 2nd newest
    python -m backend.scripts.show_research_trace --full     # include page text
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from backend.core.config import settings

RULE = "=" * 78
THIN = "-" * 78


def _runs(base: Path) -> list[Path]:
    if not base.is_dir():
        return []
    return sorted((p for p in base.iterdir() if p.is_dir()), key=lambda p: p.name, reverse=True)


def _read(d: Path, name: str) -> str:
    p = d / name
    return p.read_text(encoding="utf-8") if p.is_file() else ""


def _verdict(brief: str) -> str:
    for line in brief.splitlines():
        if line.strip().startswith("VERDICT"):
            return line.strip()
    return "(no verdict line)"


def show(d: Path, *, full: bool) -> None:
    print(RULE)
    print(f"RUN  {d.name}")
    print(RULE)

    news = _read(d, "00_news_item.txt")
    if news:
        print("\nNEWS ITEM SENT TO CLAIM EXTRACTION")
        print(THIN)
        print(news.strip()[:1200])

    claims_raw = _read(d, "01_claims.json")
    claims = json.loads(claims_raw) if claims_raw else []
    print(f"\nCLAIMS EXTRACTED: {len(claims)}")
    print(THIN)
    for i, c in enumerate(claims, start=1):
        print(f"{i}. [{c.get('kind', '?')}] {c.get('claim', '')}")
        print(f"   query -> {c.get('query', '')}")

    for i in range(1, len(claims) + 1):
        search_raw = _read(d, f"{i:02d}a_search.json")
        docs = _read(d, f"{i:02d}b_documents.txt")
        brief = _read(d, f"{i:02d}c_brief.txt")
        if not (search_raw or docs or brief):
            continue

        print(f"\n{RULE}\nCLAIM {i}\n{RULE}")
        if search_raw:
            s = json.loads(search_raw)
            print(f"\nSENT TO SEARXNG: {s.get('query', '')}")
            print(f"RESULTS: {len(s.get('results', []))}")
            print(THIN)
            for r in s.get("results", []):
                print(f"  [{r.get('engine', '')}] {r.get('url', '')}")
                snip = (r.get("snippet") or "").strip().replace("\n", " ")
                if snip:
                    print(f"        {snip[:150]}")
        if docs:
            print(f"\nPAGE TEXT READ: {len(docs):,} chars")
            if full:
                print(THIN)
                print(docs)
        if brief:
            print(f"\nFACT-CHECK BRIEF ({len(brief):,} chars)")
            print(THIN)
            print(brief.strip() if full else brief.strip()[:1500])
            if not full and len(brief) > 1500:
                print(f"... [{len(brief) - 1500:,} more chars, use --full]")
            print(f"\n>>> {_verdict(brief)}")

    print(f"\n{RULE}\nPOST\n{RULE}")
    for label, name in (
        ("VALIDATION, first pass", "11_validation_first_pass.json"),
        ("VALIDATION, after retry", "13_validation_retry.json"),
    ):
        body = _read(d, name)
        if body:
            print(f"\n{label}: {body.strip()}")

    final = _read(d, "14_post_final.txt") or _read(d, "12_post_retry.txt") or _read(d, "10_post_first_pass.txt")
    if final:
        print(f"\nFINAL POST\n{THIN}\n{final.strip()}")
    else:
        print("\n(no post artefacts: research ran outside the post generation path)")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--list", action="store_true", help="list recent runs and exit")
    ap.add_argument("--run", type=int, default=1, help="which run, 1 = newest")
    ap.add_argument("--full", action="store_true", help="print full briefs and page text")
    args = ap.parse_args()

    base = settings.web_research_debug_dir
    if not base:
        print("WEB_RESEARCH_DEBUG_DIR is not set; nothing is being traced.")
        return 1

    runs = _runs(Path(base))
    if not runs:
        print(f"No runs found in {base}. Generate a post first.")
        return 1

    if args.list:
        print(f"{len(runs)} run(s) in {base}\n")
        for i, r in enumerate(runs[:25], start=1):
            print(f"{i:3d}. {r.name}")
        return 0

    if args.run < 1 or args.run > len(runs):
        print(f"--run must be between 1 and {len(runs)}")
        return 1

    show(runs[args.run - 1], full=args.full)
    return 0


if __name__ == "__main__":
    sys.exit(main())
