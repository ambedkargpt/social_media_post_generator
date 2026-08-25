"""
Walk one news item through the workflow one step at a time.

The steps map onto the whiteboard diagram:

    1 VIDEO      video: transcript + youtube link
    2 SEMRAG     retrieval: the chunks that carry the ideological lens
    3 WEBSEARCH  websearch with prompt  ->  web search result
    4 VERIFY     verification success   ->  what survives, what is held back
    5 JSON       websearch result + transcript + yt link + user pref + chunks
    6 POST       social media post

Each step prints what went in, what ran, and what came out, then saves its
result so the next step resumes from it. Run them in order, read the output,
stop wherever you want to look closer.

    python -m backend.scripts.walk_pipeline --news-id <id> --step 1
    python -m backend.scripts.walk_pipeline --news-id <id> --step 2
    ...
    python -m backend.scripts.walk_pipeline --news-id <id> --step all
    python -m backend.scripts.walk_pipeline --list
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

RULE = "=" * 78
THIN = "-" * 78


def head(n: str, title: str) -> None:
    print("\n" + RULE)
    print("STEP " + n + "  " + title)
    print(RULE)


def sub(title: str) -> None:
    print("\n" + title)
    print(THIN)


def state_path(news_id: str) -> Path:
    d = Path("backend/outputs/manual_run") / news_id
    d.mkdir(parents=True, exist_ok=True)
    return d / "state.json"


def load_state(news_id: str) -> dict:
    p = state_path(news_id)
    if not p.is_file():
        return {}
    return json.loads(p.read_text(encoding="utf-8"))


def save_state(news_id: str, st: dict) -> None:
    state_path(news_id).write_text(
        json.dumps(st, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print("\n[state saved to " + str(state_path(news_id)) + "]")


def need(st: dict, key: str, step: str) -> None:
    if key not in st:
        raise SystemExit("Run --step " + step + " first (missing '" + key + "' in state).")


# ─────────────────────────────── steps ───────────────────────────────


def step1(news_id: str, st: dict) -> dict:
    """video: transcript + youtube link"""
    from backend.pipeline.transcripts import transcript_for_video
    from backend.repositories.news_repo import NewsRepository
    from backend.services.posts_service import PostsService

    head("1", "VIDEO  ->  transcript + youtube link")

    repo = NewsRepository()
    doc = repo.get_by_id(news_id)
    if not doc:
        raise SystemExit("No news item " + news_id)
    svc = PostsService.__new__(PostsService)
    article = svc._news_doc_to_article(doc)

    sub("THE NEWS ITEM (what the pipeline already generated from this video)")
    print("headline : " + article["title"])
    print("summary  : " + article["content"][:500])

    sub("THE VIDEO IT CAME FROM")
    print("link : " + article["source_url"])
    print("(the #story-N fragment marks which story of this video; the video id is the same)")

    transcript = transcript_for_video(article["source_url"])
    sub("THE TRANSCRIPT, LOOKED UP BY VIDEO ID")
    print("source : backend/data/*_all_transcripts.txt")
    print("length : " + str(len(transcript)) + " chars")
    print("\nfirst 900 characters, the speaker's own words:\n")
    print(transcript[:900] + "\n[... continues ...]")

    if not transcript:
        print("\nNo transcript found. Everything downstream would fall back to the news")
        print("summary alone, and claims could not be checked against what was said.")

    st["article"] = article
    st["transcript"] = transcript
    return st


def step2(news_id: str, st: dict) -> dict:
    """semrag: the chunks"""
    from backend.core.config import settings
    from backend.pipeline.generator import _is_own
    from backend.pipeline_cli import ensure_rag_stack
    from backend.services.posts_service import PostsService

    need(st, "article", "1")
    head("2", "SEMRAG  ->  retrieved chunks (the ideological lens)")

    article = st["article"]
    svc = PostsService.__new__(PostsService)
    query_text = svc._query_from_article(article)

    sub("THE RETRIEVAL QUERY (built from the news item)")
    print(query_text[:400])

    embedder, store, ctx = ensure_rag_stack(settings)
    chunks = svc._retrieve_chunks(query_text, embedder, store)

    own = [c for c in chunks if _is_own(c, article)]
    other = [c for c in chunks if not _is_own(c, article)]

    sub("WHAT CAME BACK: " + str(len(chunks)) + " chunks")
    for c in chunks:
        tag = "OWN VIDEO " if _is_own(c, article) else "other vid"
        print("  [" + tag + "] " + str(c.get("video_title", ""))[:52])
        print("              " + str(c.get("chunk_text", ""))[:110].replace("\n", " "))

    sub("WHY THE SPLIT MATTERS")
    print("from this video : " + str(len(own)) + "   (may supply facts)")
    print("from other videos: " + str(len(other)) + "   (framing only, never facts)")
    print()
    print("The index holds the Ravish corpus, so a Congress story usually retrieves")
    print("zero chunks of its own. That is correct: the transcript carries this")
    print("story's facts, the chunks carry the Ambedkarite argument. Mixing them is")
    print("how a post about one expressway once cited another expressway's figures.")

    st["chunks"] = [
        {"chunk_id": c.get("chunk_id", ""), "video_title": c.get("video_title", ""),
         "video_link": c.get("video_link", ""), "chunk_text": c.get("chunk_text", "")}
        for c in chunks
    ]
    return st


def step3(news_id: str, st: dict) -> dict:
    """websearch with prompt -> web search result"""
    from openai import OpenAI

    from backend.core.config import settings
    from backend.pipeline.web_research import extract_claims, search_urls

    need(st, "transcript", "1")
    head("3", "WEBSEARCH WITH PROMPT  ->  web search result")

    article, transcript = st["article"], st["transcript"]
    client = OpenAI(api_key=settings.deepseek_api_key, base_url=settings.deepseek_base_url)
    news_item = "\n".join(str(article.get(k) or "") for k in ("title", "description", "content"))

    cap: dict = {}
    claims = extract_claims(
        client, settings.research_model, news_item=news_item,
        transcript_excerpt=transcript, prompts_dir=settings.prompts_dir,
        max_claims=settings.web_research_max_claims,
        purpose=settings.research_purpose, transcript=transcript,
        on_prompt=lambda s, u: cap.update(sys=s, usr=u),
    )

    sub("THE PROMPT THAT TURNS THE TRANSCRIPT INTO SEARCH QUERIES")
    print("system message (backend/prompts/research_angles_system.txt):\n")
    print(cap.get("sys", ""))
    print("\nuser message, first 1200 chars:\n")
    print(cap.get("usr", "")[:1200] + "\n[... news item and transcript continue ...]")

    sub("WHAT CAME BACK: " + str(len(claims)) + " angles, each anchored to a quoted line")
    for i, c in enumerate(claims, 1):
        print(str(i) + ". " + c.claim)
        print("   query : " + c.query)
        print("   quote : " + c.source_quote)
        print("   that quote is in the transcript: " +
              str(c.source_quote.lower()[:50] in transcript.lower()) + "\n")

    searched = []
    for i, c in enumerate(claims, 1):
        sub("SEARCH " + str(i) + ": " + c.query)
        print("GET " + settings.searxng_url + "/search?q=" +
              c.query.replace(" ", "+") + "&format=json\n")
        t0 = time.time()
        results = search_urls(c.query, base_url=settings.searxng_url,
                              top_k=settings.web_research_top_k)
        print("kept " + str(len(results)) + " results in " + format(time.time() - t0, ".1f") + "s")
        for r in results:
            print("  [" + r.engine[:11].ljust(11) + "] " + r.url)
        searched.append({
            "claim": c.claim, "query": c.query, "kind": c.kind,
            "source_quote": c.source_quote,
            "results": [{"title": r.title, "url": r.url, "snippet": r.snippet,
                         "engine": r.engine} for r in results],
        })

    st["searched"] = searched
    return st


def step4(news_id: str, st: dict) -> dict:
    """verification success"""
    from openai import OpenAI

    from backend.core.config import settings
    from backend.pipeline.web_research import (
        Claim, ClaimFinding, ResearchBrief, SearchResult, _parse_brief, apply_stance,
        factcheck_claim, fetch_documents, search_relevance, verify_fact_sources,
        verify_transcript_quote,
    )

    need(st, "searched", "3")
    head("4", "VERIFICATION SUCCESS  ->  what survives, what is held back")

    transcript = st["transcript"]
    client = OpenAI(api_key=settings.deepseek_api_key, base_url=settings.deepseek_base_url)
    findings = []

    for i, row in enumerate(st["searched"], 1):
        results = [SearchResult(**r) for r in row["results"]]
        docs = fetch_documents(results)
        sub("ANGLE " + str(i) + ": " + row["claim"][:70])
        print("pages read : " + format(len(docs), ",") + " chars via trafilatura")

        brief = factcheck_claim(
            client, settings.research_model,
            claim=Claim(claim=row["claim"], query=row["query"]),
            documents=docs, prompts_dir=settings.prompts_dir,
            transcript=transcript, purpose=settings.research_purpose,
        )
        verdict, stance, facts, in_tr = _parse_brief(brief)

        tv = verify_transcript_quote(brief, transcript)
        fv = verify_fact_sources(facts, results, docs)
        rel = search_relevance(results, row["query"], docs)

        print("\nVERDICT : " + verdict)
        print("STANCE  : " + stance)
        print("\nhow that was checked, without asking the model to be honest:")
        print("  quote it claimed from the transcript : " + tv["status"] +
              "  (" + str(tv["quotes_found"]) + "/" + str(tv["quotes_checked"]) + " found verbatim)")
        print("  facts supported by the fetched text  : " +
              str(fv["text_supported"]) + "/" + str(fv["facts"]))
        print("  cited URLs we never actually fetched : " + str(fv["url_not_fetched"]))
        print("  query terms present in the pages     : " +
              str(rel["covered"]) + "/" + str(rel["query_terms"]))

        if facts:
            print("\nfacts established, with the site each came from:")
            for f in facts[:5]:
                print("  - " + str(f.get("fact", ""))[:96])
                print("    source: " + str(f.get("source", "")))
                print("    url   : " + str(f.get("url", "")))

        findings.append(ClaimFinding(
            claim=Claim(claim=row["claim"], query=row["query"], kind=row.get("kind", "other"),
                        source_quote=row.get("source_quote", "")),
            brief=brief, sources=[r.url for r in results], stance=stance,
            verdict=verdict, facts=facts, in_transcript=in_tr,
            verification={"transcript": tv, "sources": fv, "search": rel},
        ))

    sub("THE GATE")
    useful = [f for f in findings if f.facts]
    print("angles checked        : " + str(len(findings)))
    print("angles with usable facts: " + str(len(useful)))
    print("gate: " + ("PASSED, a brief goes to the writer"
                      if useful else "BLOCKED, the post is written without a brief"))

    lead, held = apply_stance(findings, settings.research_stance_mode)
    sub("THE STANCE FILTER  (mode: " + settings.research_stance_mode + ")")
    print("used as evidence : " + str(len(lead)))
    print("held back        : " + str(len(held)))
    for f in held:
        print("\n  HELD: " + f.claim.claim)
        print("        " + f.verdict[:150])
        print("        Not built on, and the post may not state its opposite.")
    if not held:
        print("\nNothing was held back: every finding supported or was neutral to the case.")

    rb = ResearchBrief(findings=findings, stance_mode=settings.research_stance_mode)
    st["research"] = rb.as_meta()
    st["payload"] = rb.as_payload() if useful else None
    return st


def step5(news_id: str, st: dict) -> dict:
    """websearch result + transcript + yt link + user pref + chunks -> one JSON"""
    from backend.pipeline.profiles import get_user_profiles

    need(st, "chunks", "2")
    head("5", "COMBINE  ->  one JSON for the writer")

    profile = dict(get_user_profiles()[0])
    profile["content_length"] = (
        "2 short paragraphs, 110 to 150 words in total. Open with the news and the "
        "strongest fact, close with the call to action. Cut background rather than "
        "cutting the fact."
    )

    PANEL = ["user_role", "tone", "target_audience", "primary_focus",
             "ambedkarite_perspective", "content_length", "call_to_action"]
    sub("THE SEVEN PREFERENCES THE APP EXPOSES")
    for k in PANEL:
        print("  " + k.ljust(26) + ": " + str(profile.get(k, ""))[:110])

    sub("WHAT GOES INTO THE JSON")
    art = st["article"]
    own = [c for c in st["chunks"] if c.get("video_link", "").find(
        art.get("source_url", "").split("v=")[-1].split("#")[0]) >= 0]
    print("  user_profile        : the 25 fields above plus the fixed ones")
    print("  news                : " + art["title"][:60])
    print("  video.source_url    : " + art.get("source_url", ""))
    print("  source_video_chunks : " + str(len(own)) + "   (facts allowed)")
    print("  ideology_chunks     : " + str(len(st["chunks"]) - len(own)) + "   (framing only)")
    print("  research            : " + ("present" if st.get("payload") else "null"))

    if st.get("payload"):
        sub("THE RESEARCH SECTION AS THE WRITER RECEIVES IT")
        print(json.dumps(st["payload"], ensure_ascii=False, indent=2)[:2200])
        print("\n[... continues ...]")

    st["profile"] = profile
    return st


def step6(news_id: str, st: dict) -> dict:
    """social media post"""
    from openai import OpenAI

    from backend.core.config import settings
    from backend.pipeline.generator import generate_post
    from backend.services.posts_service import PostsService

    need(st, "profile", "5")
    head("6", "SOCIAL MEDIA POST")

    client = OpenAI(api_key=settings.deepseek_api_key, base_url=settings.deepseek_base_url)
    article, profile = st["article"], st["profile"]
    chunks = [{"chunk_id": c["chunk_id"], "video_title": c["video_title"],
               "video_link": c["video_link"], "chunk_text": c["chunk_text"]}
              for c in st["chunks"]]

    cap: dict = {}
    t0 = time.time()
    post = generate_post(
        client=client, model=settings.post_generation_model, news=article,
        profile=profile, retrieved_chunks=chunks, full_video_contexts=[],
        temperature=settings.openai_temperature, prompts_dir=settings.prompts_dir,
        language="hi", research_payload=st.get("payload"),
        on_prompt=lambda s, u: cap.update(sys=s, usr=u),
    )

    sub("THE SYSTEM MESSAGE (first 1400 chars)")
    print(cap.get("sys", "")[:1400] + "\n[... continues ...]")

    svc = PostsService.__new__(PostsService)
    final, report = svc._validated_post(
        post, article=article, profile=profile, retrieved_chunks=chunks,
        full_contexts=[], temperature=settings.openai_temperature,
        brief_payload=st.get("payload"),
    )
    elapsed = time.time() - t0

    sub("THE CHECK RUN ON THE FINISHED POST")
    m = report.as_meta() if report else {}
    print("  validation                : " + ("passed" if m.get("passed") else "FLAGGED"))
    print("  figures with no support   : " + str(m.get("unsupported_numbers", [])))
    print("  dates with no support     : " + str(m.get("unsupported_dates", [])))
    print("  figures from another video: " + str(m.get("cross_video_numbers", [])))
    print("  re-asked after a flag     : " + str(m.get("retried", False)))

    sub("THE POST  (" + format(elapsed, ".0f") + "s, " + str(len(final)) + " chars)")
    print(final)

    r = client.chat.completions.create(
        model=settings.post_generation_model, max_tokens=4000, temperature=0.3,
        messages=[
            {"role": "system", "content":
                "You are a precise translator. Translate the following social media post to "
                "English. Preserve the structure exactly: headline on the first line, then the "
                "body paragraphs, then hashtags at the end. Translate hashtag labels too where "
                "appropriate. Output ONLY the translated post, no explanations, no preamble."},
            {"role": "user", "content": final},
        ],
    )
    sub("ENGLISH TRANSLATION")
    print((r.choices[0].message.content or "").strip())

    st["post"] = final
    st["validation"] = m
    return st


STEPS = {"1": step1, "2": step2, "3": step3, "4": step4, "5": step5, "6": step6}


def list_items() -> None:
    from backend.pipeline.transcripts import transcript_for_video
    from backend.repositories.news_repo import NewsRepository

    repo = NewsRepository()
    docs = list(repo.collection.find(
        {"source_url": {"$regex": "youtube", "$options": "i"}},
        {"headline": 1, "source_url": 1},
    ).sort("published_at", -1).limit(15))
    print("news items with a transcript available:\n")
    for d in docs:
        t = transcript_for_video(d.get("source_url", ""))
        if not t:
            continue
        print(str(d["_id"]) + "   transcript " + str(len(t)) + " chars")
        print("   " + str(d.get("headline", ""))[:76] + "\n")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--news-id")
    ap.add_argument("--step", default="all")
    ap.add_argument("--list", action="store_true")
    args = ap.parse_args()

    if args.list or not args.news_id:
        list_items()
        if not args.news_id:
            print("Pass --news-id <id> --step 1")
        return 0

    st = load_state(args.news_id)
    order = list(STEPS) if args.step == "all" else [args.step]
    for s in order:
        if s not in STEPS:
            print("unknown step: " + s)
            return 1
        st = STEPS[s](args.news_id, st)
    save_state(args.news_id, st)
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.exit(main())
