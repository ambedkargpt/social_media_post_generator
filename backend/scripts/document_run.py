"""
Run one news item through the whole pipeline and write an auditable walkthrough.

Produces an HTML document showing, in order: the video and its transcript, the
claim-extraction prompt and what came back, each search query and its results,
the fact-check prompt and verdict, how the verdict was verified against the
transcript, what the stance filter omitted, the JSON handed to the writer, and
the post that came out.

    python -m backend.scripts.document_run --news-id <id>
    python -m backend.scripts.document_run --news-id <id> --out run.html
"""

from __future__ import annotations

import argparse
import html
import json
import sys
import time
from pathlib import Path

from openai import OpenAI

from backend.core.config import settings
from backend.pipeline.generator import _is_own, generate_post
from backend.pipeline.profiles import get_user_profiles
from backend.pipeline.transcripts import transcript_for_video
from backend.pipeline.web_research import (
    SearchResult,
    _parse_brief,
    apply_stance,
    extract_claims,
    factcheck_claim,
    fetch_documents,
    search_relevance,
    search_urls,
    verify_fact_sources,
    verify_transcript_quote,
)
from backend.repositories.news_repo import NewsRepository
from backend.services.posts_service import PostsService

E = html.escape


def _pre(text: str, cls: str = "") -> str:
    return f'<pre class="{cls}">{E(str(text or ""))}</pre>'


def _kv(rows: list[tuple[str, str]]) -> str:
    return "<table class='kv'>" + "".join(
        f"<tr><td class='k'>{E(k)}</td><td>{v}</td></tr>" for k, v in rows
    ) + "</table>"


CSS = """
@page { size: A4; margin: 14mm 12mm; }
*{box-sizing:border-box}
body{font-family:"Segoe UI",Arial,sans-serif;color:#14181f;font-size:9.5pt;line-height:1.5;margin:0}
.deva{font-family:"Nirmala UI","Noto Sans Devanagari",Mangal,sans-serif}
h1{font-size:19pt;margin:0 0 4px;letter-spacing:-.3px}
.sub{color:#5b6472;font-size:10pt}.meta{color:#8a929e;font-size:8pt}
hr{border:0;border-top:1px solid #dfe3e8;margin:12px 0}
h2{font-size:11.5pt;margin:20px 0 7px;padding:6px 10px;background:#0b2b5c;color:#fff;border-radius:3px;page-break-after:avoid}
h3{font-size:9.5pt;margin:12px 0 5px;color:#0b2b5c;page-break-after:avoid}
p.lead{color:#444c58;margin:0 0 8px}
pre{font-family:Consolas,monospace;font-size:7.4pt;line-height:1.45;background:#fafbfc;border:1px solid #e3e7ec;
    border-radius:3px;padding:8px 10px;white-space:pre-wrap;word-break:break-word;margin:4px 0;max-height:none}
pre.sent{background:#f4f7fb;border-color:#cfe0f5}
pre.got{background:#f6fbf7;border-color:#cfe8d6}
pre.post{font-family:"Nirmala UI","Noto Sans Devanagari",Mangal,sans-serif;font-size:9pt;line-height:1.8;background:#fff}
table{width:100%;border-collapse:collapse;font-size:8.5pt;margin:5px 0}
th,td{text-align:left;padding:4px 7px;border-bottom:1px solid #e9edf2;vertical-align:top}
thead th{background:#f4f7fb;font-size:7.5pt;text-transform:uppercase;letter-spacing:.4px;color:#5b6472}
table.kv td.k{color:#5b6472;width:150px}
.bad{color:#b3261e;font-weight:600}.good{color:#1b6b45;font-weight:600}.warn{color:#9a6206;font-weight:600}
.box{border:1px solid #e3e7ec;border-left:3px solid #1b6b45;background:#fbfcfd;padding:8px 11px;margin:8px 0;
     border-radius:0 3px 3px 0;page-break-inside:avoid}
.box.red{border-left-color:#b3261e}.box.amber{border-left-color:#9a6206}
.tag{font-size:7.5pt;font-weight:700;letter-spacing:.4px;text-transform:uppercase;padding:1px 6px;border-radius:2px}
.tag.op{background:#dff0e7;color:#1b6b45}.tag.ru{background:#fdeceb;color:#8c2a22}.tag.nu{background:#eef1f5;color:#44506a}
.pagebreak{page-break-before:always}
.claimhd{background:#eef2f7;border-left:3px solid #0b2b5c;padding:6px 10px;margin:16px 0 6px;font-weight:700;font-size:10pt}
"""


def build(news_id: str, out_path: Path) -> int:
    repo = NewsRepository()
    doc = repo.get_by_id(news_id)
    if not doc:
        print(f"No news item {news_id}")
        return 1

    svc = PostsService.__new__(PostsService)
    svc.news_repo = repo
    article = svc._news_doc_to_article(doc)
    profile = dict(get_user_profiles()[0])
    video_link = article.get("source_url", "")
    transcript = transcript_for_video(video_link)

    from backend.pipeline_cli import ensure_rag_stack

    embedder, store, ctx_by_title = ensure_rag_stack(settings)
    chunks = svc._retrieve_chunks(svc._query_from_article(article), embedder, store)
    contexts = svc._full_contexts_for_chunks(chunks, ctx_by_title)
    own = [c for c in chunks if _is_own(c, article)]
    other = [c for c in chunks if not _is_own(c, article)]

    client = OpenAI(api_key=settings.deepseek_api_key, base_url=settings.deepseek_base_url)
    P: list[str] = []
    A = P.append

    A(f"<h1>Pipeline Walkthrough</h1>")
    A(f'<div class="sub">One news item, every step, with the prompt sent and the response received</div>')
    A(f'<div class="meta">{E(str(news_id))} &middot; research {E(settings.research_model)} '
      f'&middot; writer {E(settings.post_generation_model)} &middot; stance {E(settings.research_stance_mode)}</div><hr>')

    # ── 1. video + transcript ──────────────────────────────────────────────
    A("<h2>Step 1 &mdash; The video: transcript and link</h2>")
    A(_kv([
        ("News headline", f'<span class="deva">{E(article["title"])}</span>'),
        ("Video link", f'<a href="{E(video_link)}">{E(video_link)}</a>'),
        ("Transcript found", f'<span class="{"good" if transcript else "bad"}">'
                             f'{"yes, " + str(len(transcript)) + " chars from backend/data/*_all_transcripts.txt" if transcript else "no"}</span>'),
        ("Chunks retrieved", f"{len(chunks)} total &mdash; {len(own)} from this video, {len(other)} from other videos"),
    ]))
    A("<h3>News summary the pipeline generated from this video</h3>")
    A(f'<pre class="deva">{E(article["content"])}</pre>')
    A("<h3>Transcript (the speaker\'s own words, verbatim)</h3>")
    A(_pre(transcript[:4000] + ("\n\n[... truncated for the document ...]" if len(transcript) > 4000 else "")))

    # ── 2. claim extraction ────────────────────────────────────────────────
    A("<h2>Step 2 &mdash; Claim extraction</h2>")
    cap: dict = {}
    claims = extract_claims(
        client, settings.research_model, news_item="\n".join(
            str(article.get(k) or "") for k in ("title", "description", "content")),
        transcript_excerpt=transcript, prompts_dir=settings.prompts_dir,
        max_claims=settings.web_research_max_claims,
        purpose=settings.research_purpose,
        transcript=transcript,          # enables the source-quote anchoring check
        on_prompt=lambda s, u: cap.update(sys=s, usr=u),
    )
    A("<h3>Prompt sent &mdash; system</h3>")
    A(_pre(cap.get("sys", ""), "sent"))
    A("<h3>Prompt sent &mdash; user</h3>")
    A(_pre(cap.get("usr", ""), "sent"))
    A("<h3>Response received</h3>")
    A(_pre(json.dumps([{"claim": c.claim, "query": c.query, "kind": c.kind,
                        "source_quote": c.source_quote} for c in claims],
                      ensure_ascii=False, indent=2), "got"))
    A('<div class="box"><b>Anchoring.</b> Every angle must quote the one transcript '
      'sentence it rests on, and that quote is looked up in the transcript before any '
      'search runs. An angle assembled from two separate sentences cannot produce a '
      'valid quote, so it is dropped rather than searched. This is what stopped a '
      'resignation being dated to a protest that happened in a different sentence.</div>')

    findings = []
    for idx, claim in enumerate(claims, start=1):
        A(f'<div class="claimhd pagebreak">CLAIM {idx} &mdash; {E(claim.claim)}</div>')

        # ── 3. search ──────────────────────────────────────────────────────
        A(f"<h2>Step 3.{idx} &mdash; Web search</h2>")
        t0 = time.time()
        results = search_urls(claim.query, base_url=settings.searxng_url,
                              top_k=settings.web_research_top_k)
        A(_kv([("Query sent to SearXNG", f"<code>{E(claim.query)}</code>"),
               ("Endpoint", f"{E(settings.searxng_url)}/search?format=json"),
               ("Results kept", f"{len(results)} (max 2 per host)")]))
        A("<table><thead><tr><th>#</th><th>Engine</th><th>URL</th><th>Snippet</th></tr></thead><tbody>")
        for i, r in enumerate(results, 1):
            A(f"<tr><td>{i}</td><td>{E(r.engine)}</td><td>{E(r.url)}</td><td>{E(r.snippet[:150])}</td></tr>")
        A("</tbody></table>")

        documents = fetch_documents(results)
        rel = search_relevance(results, claim.query, documents)
        A(_kv([("Page text extracted", f"{len(documents):,} chars via trafilatura"),
               ("Search relevance", f"{rel['covered']}/{rel['query_terms']} query terms present "
                                    f"({rel['coverage']*100:.0f}%)")]))

        # ── 4. fact-check ──────────────────────────────────────────────────
        A(f"<h2>Step 4.{idx} &mdash; Fact-check against the transcript and the pages</h2>")
        fcap: dict = {}
        brief = factcheck_claim(client, settings.research_model, claim=claim,
                                documents=documents, prompts_dir=settings.prompts_dir,
                                transcript=transcript, purpose=settings.research_purpose,
                                on_prompt=lambda s, u: fcap.update(sys=s, usr=u))
        verdict, stance, facts, in_tr = _parse_brief(brief)
        A("<h3>Prompt sent &mdash; system</h3>")
        A(_pre(fcap.get("sys", ""), "sent"))
        A("<h3>Prompt sent &mdash; user (pages and transcript truncated here for length)</h3>")
        usr = fcap.get("usr", "")
        A(_pre(usr[:3000] + ("\n\n[... retrieved pages and transcript continue ...]" if len(usr) > 3000 else ""), "sent"))
        A("<h3>Response received</h3>")
        A(_pre(brief, "got"))

        # ── 5. verification ────────────────────────────────────────────────
        A(f"<h2>Step 5.{idx} &mdash; How the response was verified</h2>")
        tv = verify_transcript_quote(brief, transcript)
        fv = verify_fact_sources(facts, results, documents)
        cls = "good" if tv["status"] == "verified" else "bad"
        A(_kv([
            ("Claim stated in transcript?", f"{'yes' if in_tr else 'NO'}"),
            ("Quote lookup", f'<span class="{cls}">{E(tv["status"])}</span> &mdash; '
                             f'{tv["quotes_found"]}/{tv["quotes_checked"]} quoted lines found verbatim in the transcript'),
            ("Facts supported by fetched page text", f"{fv['text_supported']}/{fv['facts']}"),
            ("Cited URLs we never fetched", f'<span class="{"bad" if fv["url_not_fetched"] else "good"}">{fv["url_not_fetched"]}</span>'),
            ("Verdict", E(verdict)),
            ("Stance", f'<span class="tag {"op" if stance=="SUPPORTS_OPPOSITION" else "ru" if stance=="SUPPORTS_RULING" else "nu"}">{E(stance)}</span>'),
        ]))
        if tv.get("unmatched"):
            A('<div class="box red"><b>Quotes not found in the transcript:</b><br>'
              + "<br>".join(E(u) for u in tv["unmatched"]) + "</div>")

        A("<h3>References established, with the site each came from</h3>")
        A("<table><thead><tr><th>Fact</th><th>Source</th><th>URL</th></tr></thead><tbody>")
        for f in facts:
            A(f"<tr><td>{E(str(f.get('fact',''))[:200])}</td><td>{E(str(f.get('source','')))}</td>"
              f"<td>{E(str(f.get('url',''))[:90])}</td></tr>")
        A("</tbody></table>")

        from backend.pipeline.web_research import ClaimFinding
        findings.append(ClaimFinding(claim=claim, brief=brief, sources=[r.url for r in results],
                                     stance=stance, verdict=verdict, facts=facts,
                                     in_transcript=in_tr,
                                     verification={"transcript": tv, "sources": fv, "search": rel}))

    # ── 6. gate + stance ───────────────────────────────────────────────────
    A('<h2 class="pagebreak">Step 6 &mdash; Verification gate and what was omitted</h2>')
    verified = [f for f in findings if f.verified]
    lead, held = apply_stance(findings, settings.research_stance_mode)
    A(_kv([
        ("Claims checked", str(len(findings))),
        ("Settled either way (gate)", f'<span class="{"good" if verified else "bad"}">{len(verified)} of {len(findings)}</span>'
                                      f' &mdash; {"gate passed" if verified else "gate would block: no brief sent"}'),
        ("Stance mode", E(settings.research_stance_mode)),
        ("Used as evidence", str(len(lead))),
        ("Omitted from evidence", f'<span class="warn">{len(held)}</span>'),
    ]))
    if held:
        A('<div class="box amber"><b>Omitted, and why.</b> These findings are verified but do not '
          'support the Congress or Samajwadi case, so the stance filter keeps them out of the '
          'evidence the post is built on. They are still passed to the writer under '
          '<code>do_not_contradict</code>: the post may stay silent on them, and may never state '
          'their opposite.<br><br>'
          + "<br><br>".join(f"<b>{E(f.claim.claim)}</b><br>{E(f.verdict)}" for f in held)
          + "</div>")
    else:
        A('<div class="box">Nothing was omitted: every verified finding supported or was neutral '
          'towards the case, so all of it went to the writer as evidence.</div>')

    # ── 7. the JSON ────────────────────────────────────────────────────────
    from backend.pipeline.web_research import ResearchBrief
    rb = ResearchBrief(findings=findings, stance_mode=settings.research_stance_mode) if verified else None
    payload = rb.as_payload() if rb else None

    A("<h2>Step 7 &mdash; The JSON handed to the writer</h2>")
    A("<p class='lead'>Research plus transcript plus video link plus preferences plus chunks, "
      "as one object. Chunks are split by video: only this story's own video may supply facts.</p>")
    pcap: dict = {}
    t0 = time.time()
    post = generate_post(
        client=client, model=settings.post_generation_model, news=article, profile=profile,
        retrieved_chunks=chunks, full_video_contexts=contexts,
        temperature=settings.openai_temperature, prompts_dir=settings.prompts_dir,
        language="hi", research_payload=payload,
        on_prompt=lambda s, u: pcap.update(sys=s, usr=u),
    )
    t_post = time.time() - t0
    A("<h3>System message</h3>")
    A(_pre(pcap.get("sys", ""), "sent"))
    A("<h3>User message &mdash; the JSON payload</h3>")
    A(_pre(pcap.get("usr", ""), "sent"))

    # ── 8. post + validation ───────────────────────────────────────────────
    final, report = svc._validated_post(
        post, article=article, profile=profile, retrieved_chunks=chunks,
        full_contexts=contexts, temperature=settings.openai_temperature,
        brief_payload=payload,
    )
    A("<h2>Step 8 &mdash; The post, and the check on it</h2>")
    m = report.as_meta() if report else {}
    A(_kv([
        ("Generation time", f"{t_post:.0f}s"),
        ("Validation", f'<span class="{"good" if m.get("passed") else "bad"}">'
                       f'{"passed" if m.get("passed") else "flagged"}</span>'),
        ("Figures with no support", E(str(m.get("unsupported_numbers", [])))),
        ("Dates with no support", E(str(m.get("unsupported_dates", [])))),
        ("Figures from another video", E(str(m.get("cross_video_numbers", [])))),
        ("Re-asked after a flag", str(m.get("retried", False))),
    ]))
    A(f'<pre class="post">{E(final)}</pre>')

    out_path.write_text(
        f"<!doctype html><html><head><meta charset='utf-8'>"
        f"<title>Pipeline Walkthrough</title><style>{CSS}</style></head><body>"
        + "".join(P) + "</body></html>",
        encoding="utf-8",
    )
    print(f"written: {out_path}  ({out_path.stat().st_size:,} bytes)")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--news-id", required=True)
    ap.add_argument("--out", default="backend/outputs/pipeline_walkthrough.html")
    args = ap.parse_args()
    return build(args.news_id, Path(args.out))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.exit(main())
