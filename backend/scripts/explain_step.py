"""
Run one stage of the pipeline on its own and print exactly what went out and
what came back.

Nothing here is new machinery. Each stage calls the same functions the product
calls; the point is to watch one moving part at a time.

    python -m backend.scripts.explain_step prompt   # how a prompt is built
    python -m backend.scripts.explain_step search   # the HTTP call to SearXNG
    python -m backend.scripts.explain_step fetch    # a URL becomes clean text
    python -m backend.scripts.explain_step llm      # one raw DeepSeek call
    python -m backend.scripts.explain_step angles   # transcript to research angles
    python -m backend.scripts.explain_step checks   # the deterministic guards
"""

from __future__ import annotations

import json
import sys
import textwrap

RULE = "=" * 76


def head(title: str) -> None:
    print("\n" + RULE + "\n" + title + "\n" + RULE)


def note(text: str) -> None:
    print(textwrap.fill(text, 76))


def demo_prompt() -> None:
    """A prompt is a text file with {placeholders} replaced by a plain string swap."""
    from backend.core.config import settings
    from backend.pipeline.web_research import _fill, _read_prompt, prompt_names

    _, usr_name, _, _ = prompt_names(settings.research_purpose)
    head("1. THE TEMPLATE ON DISK: backend/prompts/" + usr_name)
    tpl = _read_prompt(settings.prompts_dir, usr_name)
    print(tpl)

    head("2. THE VALUES WE SUBSTITUTE")
    values = {
        "max_claims": "3",
        "news_item": "<the generated news story goes here>",
        "transcript_excerpt": "<the video transcript goes here>",
    }
    for k, v in values.items():
        print("  {" + k + "}  ->  " + v)

    head("3. THE RESULT, WHICH IS WHAT THE MODEL ACTUALLY RECEIVES")
    print(_fill(tpl, values))

    head("WHY _fill AND NOT str.format")
    note(
        "Transcripts and JSON contain brace characters. str.format would read "
        "those as placeholders and either raise or mangle the prompt. _fill does "
        "one str.replace per known key and touches nothing else. It is six lines, "
        "in backend/pipeline/web_research.py."
    )


def demo_search() -> None:
    """Search is one HTTP GET. No SDK, no magic."""
    import requests

    from backend.core.config import settings
    from backend.pipeline.web_research import (
        SearchResult, _query_terms, _result_relevance, search_urls,
    )

    q = "152 paper leaks since 2014 7.5 crore students affected zero convictions"
    url = settings.searxng_url + "/search"
    params = {"q": q, "format": "json", "language": "en", "safesearch": 0}

    head("1. THE REQUEST WE SEND")
    print("GET " + url)
    for k, v in params.items():
        print("    " + k + " = " + str(v))
    print("\nThe same thing in a browser:")
    print("  " + url + "?q=" + q.replace(" ", "+") + "&format=json")

    raw = requests.get(url, params=params, timeout=45).json().get("results", [])
    head("2. WHAT SEARXNG RETURNED: " + str(len(raw)) + " results")
    for r in raw[:8]:
        print("  [" + (r.get("engine") or "")[:11].ljust(11) + "] " + r.get("url", "")[:68])

    head("3. WHAT WE KEEP, AND WHY")
    terms = _query_terms(q)
    print("relevance is judged on these query terms:")
    print("  " + ", ".join(terms) + "\n")
    for r in raw[:8]:
        sr = SearchResult(title=r.get("title", ""), url=r.get("url", ""),
                          snippet=r.get("content", ""))
        n = _result_relevance(sr, terms)
        verdict = "DROP" if n == 0 else "keep"
        print("  " + verdict + "  " + str(n) + "/" + str(len(terms)) +
              " terms  " + r.get("url", "")[:60])
    kept = search_urls(q, base_url=settings.searxng_url, top_k=6)
    print("\nkept after gating and the two-per-host cap: " + str(len(kept)))
    note(
        "\nA result carrying none of the query words is not a weak match, it is a "
        "different subject. Engines pad thin queries with filler, and that filler "
        "was being fetched and handed to the fact-check as evidence."
    )


def demo_fetch() -> None:
    """A URL becomes clean text with trafilatura. That text is the evidence."""
    from backend.core.config import settings
    from backend.pipeline.web_research import fetch_documents, search_urls

    q = "Dharmendra Pradhan resignation education minister July"
    results = search_urls(q, base_url=settings.searxng_url, top_k=3)
    head("1. PAGES WE WILL READ")
    for r in results:
        print("  " + r.url)

    docs = fetch_documents(results)
    head("2. WHAT trafilatura EXTRACTED: " + format(len(docs), ",") + " chars")
    print(docs[:1500])
    print("\n[... continues ...]")

    head("WHAT THIS REPLACES")
    note(
        "Raw HTML is mostly navigation, adverts and scripts. trafilatura returns "
        "the article body only. This block, labelled per source, is exactly what "
        "the fact-check model reads. It cannot cite a page that is not in here, "
        "which is what makes the citation check possible."
    )


def demo_llm() -> None:
    """One raw call, so you can see there is nothing between us and the API."""
    from openai import OpenAI

    from backend.core.config import settings

    system = "You answer in one short sentence. No preamble."
    user = "In one sentence: what does a research brief need to be useful to a writer?"

    head("1. THE HTTP CALL")
    print("POST " + settings.deepseek_base_url + "/chat/completions")
    print("Authorization: Bearer <DEEPSEEK_API_KEY>\n")
    body = {
        "model": settings.post_generation_model,
        "temperature": 0.3,
        "max_tokens": 500,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }
    print(json.dumps(body, indent=2, ensure_ascii=False))

    client = OpenAI(api_key=settings.deepseek_api_key, base_url=settings.deepseek_base_url)
    r = client.chat.completions.create(**body)

    head("2. WHAT CAME BACK")
    print("content       : " + (r.choices[0].message.content or "").strip())
    print("finish_reason : " + str(r.choices[0].finish_reason))
    print("usage         : " + str(r.usage))

    head("WHY finish_reason AND usage MATTER")
    note(
        "A reasoning model bills its thinking against max_tokens. Twice this "
        "pipeline returned an empty post with finish_reason 'length' and every "
        "token spent on reasoning, which looks identical to a refusal. That is why "
        "generator.py logs these on every call, and why writing runs on "
        "deepseek-chat while research keeps its own model setting."
    )


def demo_angles() -> None:
    """Transcript in, research angles out, each anchored to a quoted line."""
    from openai import OpenAI

    from backend.core.config import settings
    from backend.pipeline.transcripts import transcript_for_video
    from backend.pipeline.web_research import extract_claims

    video = "https://www.youtube.com/watch?v=azL0kU__sPE"
    t = transcript_for_video(video)
    head("1. THE TRANSCRIPT: " + str(len(t)) + " chars, from backend/data/*_all_transcripts.txt")
    print(t[:700] + "\n[... continues ...]")

    news = "Rahul Gandhi said 152 paper leaks since 2014 affected 7.5 crore students."
    client = OpenAI(api_key=settings.deepseek_api_key, base_url=settings.deepseek_base_url)
    cap: dict = {}
    claims = extract_claims(
        client, settings.research_model, news_item=news, transcript_excerpt=t,
        prompts_dir=settings.prompts_dir, max_claims=3,
        purpose=settings.research_purpose, transcript=t,
        on_prompt=lambda s, u: cap.update(sys=s, usr=u),
    )

    head("2. THE SYSTEM MESSAGE SENT")
    print(cap.get("sys", ""))

    head("3. THE ANGLES THAT SURVIVED ANCHORING")
    for i, c in enumerate(claims, 1):
        print(str(i) + ". " + c.claim)
        print("   query : " + c.query)
        print("   quote : " + c.source_quote)
        print("   quote found in transcript: " +
              str(c.source_quote.lower()[:50] in t.lower()) + "\n")

    head("WHAT THE ANCHORING RULE PREVENTS")
    note(
        "The transcript says students marched on the 20th of July and, in the very "
        "next sentence, that the Education Minister resigned. Without anchoring the "
        "extractor welded them into a resignation dated 20 July and searched for a "
        "date nobody gave. An angle that cannot quote one whole sentence is dropped "
        "before it costs a search."
    )


def demo_checks() -> None:
    """The guards are plain Python. No model is asked to be careful."""
    from backend.pipeline.generator import _danda_normalise, _norm_link, _strip_ai_tells
    from backend.pipeline.post_validation import validate_post
    from backend.pipeline.web_research import _sanitise_query

    head("1. EM DASHES BECOME COMMAS   generator._strip_ai_tells")
    s = 'सरकार का दावा — "पहला राज्य" — गलत है'
    print("  in : " + s)
    print("  out: " + _strip_ai_tells(s))

    head("2. FULL STOP BECOMES A DANDA, EXCEPT IN ABBREVIATIONS   generator._danda_normalise")
    for x in ["संविधान ने अधिकार दिया है.", "डॉ. आंबेडकर ने कहा.", "4.68 करोड़ खर्च हुए."]:
        print("  " + x + "   ->   " + _danda_normalise(x))

    head("3. A FABRICATED YEAR IS STRIPPED FROM THE QUERY   web_research._sanitise_query")
    print("  in : Pradhan resignation July 2024")
    print("  out: " + _sanitise_query(
        "Pradhan resignation July 2024",
        "Education Minister Dharmendra Pradhan resigned.", ""))

    head("4. ONE VIDEO IN THREE LINK FORMATS   generator._norm_link")
    for u in ["https://www.youtube.com/watch?v=abc123XYZ#story-2",
              "https://youtu.be/abc123XYZ",
              "https://www.youtube.com/live/abc123XYZ"]:
        print("  " + u.ljust(52) + " -> " + _norm_link(u))

    head("5. EVERY FIGURE CHECKED AGAINST WHAT THE POST WAS GIVEN   post_validation")
    r = validate_post(
        "इस योजना पर 4200 करोड़ खर्च हुए और 9,999 लोग प्रभावित हुए।",
        sources=["The scheme covers 6,000 children."],
        other_video_sources=["4200 करोड़ का Kanpur-Lucknow Expressway"],
    )
    print("  invented, in nothing we supplied : " + str(r.unsupported_numbers))
    print("  real, but from a different video : " + str(r.cross_video_numbers))
    print()
    note(
        "These are reported separately because they are different failures. An "
        "invented figure is made up. A cross-video figure is real but belongs to "
        "another story, which is worse, because it looks sourced."
    )


DEMOS = {
    "prompt": demo_prompt,
    "search": demo_search,
    "fetch": demo_fetch,
    "llm": demo_llm,
    "angles": demo_angles,
    "checks": demo_checks,
}


def main() -> int:
    if len(sys.argv) < 2 or sys.argv[1] not in DEMOS:
        print(__doc__)
        print("stages: " + ", ".join(DEMOS))
        return 1
    DEMOS[sys.argv[1]]()
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.exit(main())
