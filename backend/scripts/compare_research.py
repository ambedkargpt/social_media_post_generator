"""
Generate the same news item twice, with and without web research, and show
the difference side by side.

This is the demo: one news item, one model, one profile, everything held equal
except the research step. It prints the claims that were checked, what the web
returned, and both posts with their validation reports.

    python -m backend.scripts.compare_research --news-id 6a7507d80735e63e2faedba9
    python -m backend.scripts.compare_research --list
    python -m backend.scripts.compare_research --news-id <id> --full
"""

from __future__ import annotations

import argparse
import sys
import time

from backend.core.config import settings
from backend.pipeline.generator import _is_own
from backend.pipeline.profiles import get_user_profiles
from backend.repositories.news_repo import NewsRepository
from backend.services.posts_service import PostsService

RULE = "=" * 78
THIN = "-" * 78


def _list_items(limit: int) -> None:
    repo = NewsRepository()
    docs = list(
        repo.collection.find(
            {"source_url": {"$regex": "youtube", "$options": "i"}},
            {"headline": 1, "source_url": 1, "content_type": 1, "tenant_slug": 1},
        )
        .sort("published_at", -1)
        .limit(limit)
    )
    print(f"{len(docs)} recent news items with a source video\n")
    for d in docs:
        print(f"{d['_id']}  [{d.get('tenant_slug','-')}/{d.get('content_type','-')}]")
        print(f"    {str(d.get('headline',''))[:74]}")
        print(f"    {d.get('source_url','')}\n")


def _show_references(brief) -> None:
    """
    Every fact the research established, grouped by the website it came from.

    This is the provenance view: which site, which page, which fact. It answers
    "where did this come from" without reading the briefs.
    """
    from urllib.parse import urlparse

    by_site: dict[str, list[tuple[str, str, str]]] = {}
    consulted: set[str] = set()
    for f in brief.findings:
        consulted.update(f.sources)
        for fact in f.facts:
            url = str(fact.get("url") or "").split(";")[0].strip()
            site = urlparse(url).netloc or str(fact.get("source") or "unknown")
            by_site.setdefault(site, []).append(
                (str(fact.get("fact") or ""), str(fact.get("source") or ""), url)
            )

    print(f"\n{RULE}\nREFERENCES  ({sum(len(v) for v in by_site.values())} facts "
          f"from {len(by_site)} sites, {len(consulted)} pages consulted)\n{RULE}")
    for site in sorted(by_site):
        print(f"\n  {site}")
        for fact, source, url in by_site[site]:
            print(f"    - {fact[:100]}")
            print(f"      source: {source}")
            if url:
                print(f"      url   : {url}")

    unused = sorted(u for u in consulted if urlparse(u).netloc not in by_site)
    if unused:
        print(f"\n  Consulted but supplied no fact ({len(unused)}):")
        for u in unused:
            print(f"    - {u}")


def _show_post(label: str, post: str, report, elapsed: float) -> None:
    print(f"\n{RULE}\n{label}   ({elapsed:.0f}s, {len(post)} chars)\n{RULE}")
    if report:
        m = report.as_meta()
        state = "PASS" if m["passed"] else "FLAGGED"
        print(f"validation: {state}"
              f"  invented={m['unsupported_numbers']}"
              f"  dates={m['unsupported_dates']}"
              f"  cross_video={m['cross_video_numbers']}"
              f"  retried={m['retried']}")
        print(THIN)
    print(post.strip())


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--news-id", help="news _id to generate from")
    ap.add_argument("--list", action="store_true", help="list recent news ids and exit")
    ap.add_argument("--limit", type=int, default=10)
    ap.add_argument("--full", action="store_true", help="print the full fact-check briefs")
    ap.add_argument("--long", action="store_true", help="use the profile's default length instead of the short one")
    ap.add_argument("--no-translate", action="store_true", help="skip the English translation")
    args = ap.parse_args()

    if args.list or not args.news_id:
        _list_items(args.limit)
        if not args.news_id:
            print("Pass --news-id <id> to run the comparison.")
        return 0

    repo = NewsRepository()
    doc = repo.get_by_id(args.news_id)
    if not doc:
        print(f"No news item with id {args.news_id}")
        return 1

    svc = PostsService.__new__(PostsService)          # no Mongo writes, read-only run
    svc.news_repo = repo
    article = svc._news_doc_to_article(doc)
    profile = dict(get_user_profiles()[0])

    # Length is one of the seven preferences the app exposes, so a shorter post
    # is requested by changing that preference rather than by bolting a word
    # cap onto the prompt.
    if not args.long:
        profile["content_length"] = (
            "2 short paragraphs, 110 to 150 words in total. Open with the news and the strongest "
            "fact, close with the call to action. Cut background rather than cutting the fact."
        )

    PANEL = ["user_role", "tone", "target_audience", "primary_focus",
             "ambedkarite_perspective", "content_length", "call_to_action"]
    print()
    print(RULE)
    print('PREFERENCES IN USE (the seven the app exposes)')
    print(RULE)
    for _k in PANEL:
        print('  ' + _k.ljust(26) + ': ' + str(profile.get(_k, ''))[:120])

    print(RULE)
    print("NEWS ITEM")
    print(RULE)
    print(f"headline : {article['title']}")
    print(f"video    : {article['source_url']}")
    print(f"summary  : {article['content'][:400]}")

    from backend.pipeline_cli import ensure_rag_stack

    embedder, store, context_by_title = ensure_rag_stack(settings)
    chunks = svc._retrieve_chunks(svc._query_from_article(article), embedder, store)
    contexts = svc._full_contexts_for_chunks(chunks, context_by_title)

    own = [c for c in chunks if _is_own(c, article)]
    other = [c for c in chunks if not _is_own(c, article)]
    print(f"\nchunks retrieved: {len(chunks)}"
          f"  from this video: {len(own)}"
          f"  from other videos: {len(other)}")
    for c in other:
        print(f"    other: {str(c.get('video_title',''))[:60]}  {c.get('video_link','')}")

    # ── B: no research, what the product did before ────────────────────────
    t0 = time.time()
    post_b = svc._generate_with_llm(
        article=article, profile=profile, retrieved_chunks=chunks,
        full_contexts=contexts, temperature=settings.openai_temperature,
        language="hi", research_payload=None,
    )
    final_b, report_b = svc._validated_post(
        post_b, article=article, profile=profile, retrieved_chunks=chunks,
        full_contexts=contexts, temperature=settings.openai_temperature,
        brief_payload=None,
    )
    t_b = time.time() - t0

    # ── A: with research ───────────────────────────────────────────────────
    t1 = time.time()
    brief = svc._research_for_article(article, chunks)
    payload = brief.as_payload() if brief else None

    print(f"\n{RULE}\nWHAT THE SEARCH RETURNED\n{RULE}")
    if not brief:
        print("No brief produced (verification gate, or research disabled).")
    else:
        print(f"stance mode: {brief.stance_mode}"
              f"   lead: {len(brief.lead)}   held as constraints: {len(brief.constraints)}")
        for i, f in enumerate(brief.findings, start=1):
            print(f"\n  CLAIM {i} [{f.stance}] verified={f.verified} in_transcript={f.in_transcript}")
            print(f"    {f.claim.claim}")
            print(f"    query   : {f.claim.query}")
            print(f"    VERDICT : {f.verdict}")
            for fact in f.facts[:4]:
                print(f"      fact  : {str(fact.get('fact',''))[:88]}")
                print(f"              {fact.get('source','')} | {fact.get('url','')}")
            if args.full:
                print(THIN)
                print(f.brief)
        _show_references(brief)

    post_a = svc._generate_with_llm(
        article=article, profile=profile, retrieved_chunks=chunks,
        full_contexts=contexts, temperature=settings.openai_temperature,
        language="hi", research_payload=payload,
    )
    final_a, report_a = svc._validated_post(
        post_a, article=article, profile=profile, retrieved_chunks=chunks,
        full_contexts=contexts, temperature=settings.openai_temperature,
        brief_payload=payload, trace_dir=brief.trace_dir if brief else None,
    )
    t_a = time.time() - t1

    _show_post("POST B  —  NO WEB RESEARCH  (what shipped before)", final_b, report_b, t_b)
    _show_post("POST A  —  WITH WEB RESEARCH", final_a, report_a, t_a)

    if not args.no_translate:
        from openai import OpenAI as _OAI
        cl = _OAI(api_key=settings.deepseek_api_key, base_url=settings.deepseek_base_url)
        r = cl.chat.completions.create(
            model=settings.post_generation_model, max_tokens=4000, temperature=0.3,
            messages=[
                {"role": "system", "content":
                    "You are a precise translator. Translate the following social media post to English. "
                    "Preserve the structure exactly: headline on the first line, then the body paragraphs, "
                    "then hashtags at the end. Translate hashtag labels too where appropriate. "
                    "Output ONLY the translated post, no explanations, no preamble."},
                {"role": "user", "content": final_a},
            ],
        )
        print()
        print(RULE)
        print('POST A  —  ENGLISH TRANSLATION')
        print(RULE)
        translated = (r.choices[0].message.content or "").strip()
        print(translated if translated else "(translation returned empty)")

    if brief and brief.trace_dir:
        print()
        print("Full trace: " + str(brief.trace_dir))
        print("Read it with: python -m backend.scripts.show_research_trace --full")
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.exit(main())
