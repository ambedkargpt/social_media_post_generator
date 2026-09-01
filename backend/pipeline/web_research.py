"""
Web research for post generation: news item -> claims -> search -> brief.

The pipeline writes posts from a party's own videos, so without an outside
source it can only repeat what that party said. This module adds one: it pulls
the checkable claims out of a generated news item, searches each one, reads the
pages it finds, and writes a sourced brief that the post generator receives
alongside the retrieved transcript chunks.

Search runs against a self-hosted SearXNG instance rather than a metered API,
because claim volume grows with the number of news items rather than the number
of users, and a self-hosted instance has no per-call ceiling to plan around.
Everything goes through search_urls(), so swapping providers is a single
function.

The whole module is best-effort. If SearXNG is down, if extraction fails, or if
the fact-check model errors, research() returns None and the caller generates
the post exactly as it does today. A research failure must never cost a user
their post.
"""

from __future__ import annotations

import json
import logging
import os
import re
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional
from urllib.parse import urlparse

import requests
from openai import OpenAI

logger = logging.getLogger(__name__)

# Two ways to use the search step, chosen by RESEARCH_PURPOSE.
#
# "support" is the default: the research desk looks for the figures, records and
# precedents that make the story land, and records anything cutting the other
# way only so the writer knows what not to assert.
#
# "verify" is the fact-checking behaviour: interrogate each claim and correct it
# where the record disagrees. Useful for auditing what the pipeline publishes,
# but it turns the tool against the speaker, which is not what a comms desk
# wants day to day.
_PROMPTS = {
    "support": (
        "research_angles_system.txt", "research_angles_user.txt",
        "corroboration_system.txt", "corroboration_user.txt",
    ),
    "verify": (
        "claim_extraction_system.txt", "claim_extraction_user.txt",
        "factcheck_system.txt", "factcheck_user.txt",
    ),
}


def prompt_names(purpose: str) -> tuple[str, str, str, str]:
    return _PROMPTS.get((purpose or "support").lower(), _PROMPTS["support"])


CLAIM_EXTRACTION_SYSTEM_NAME = "claim_extraction_system.txt"
CLAIM_EXTRACTION_USER_NAME = "claim_extraction_user.txt"
FACTCHECK_SYSTEM_NAME = "factcheck_system.txt"
FACTCHECK_USER_NAME = "factcheck_user.txt"

# Pages that never settle a factual claim. Aggregators and social platforms
# mostly restate a source we would rather read directly.
_BLOCKED_HOSTS = {
    "facebook.com", "www.facebook.com", "x.com", "twitter.com", "www.twitter.com",
    "instagram.com", "www.instagram.com", "youtube.com", "www.youtube.com",
    "youtu.be", "pinterest.com", "quora.com", "www.quora.com",
    "reddit.com", "www.reddit.com",
    # Reached only as search-engine filler, never as evidence for Indian
    # political facts. Bing padded a student-protest query with a Japanese
    # Windows support page and a Windows 11 forum, and both were fetched.
    "support.microsoft.com", "elevenforum.com", "www.elevenforum.com",
    "www.tripadvisor.in", "www.tripadvisor.com", "www.cuemath.com",
    "www.timeanddate.com", "www.zhihu.com", "dict.hinkhoj.com",
    "number.academy", "www.scribd.com", "www.linkedin.com",
}

# Enough page text to settle a claim without flooding the fact-check prompt.
_MAX_DOC_CHARS = 6000
_MIN_DOC_CHARS = 400

# DEEPSEEK_MODEL may be a reasoning model, and reasoning models bill their
# chain-of-thought against max_tokens. At 2000 the fact-check consumed the
# entire budget thinking and returned an empty string with finish_reason
# "length". These caps have to cover the reasoning as well as the answer, the
# same problem POST_MAX_COMPLETION_TOKENS solves in generator.py.
_CLAIM_MAX_TOKENS = int(os.getenv("RESEARCH_CLAIM_MAX_TOKENS", "8000"))
_FACTCHECK_MAX_TOKENS = int(os.getenv("RESEARCH_FACTCHECK_MAX_TOKENS", "16000"))

# How much of each fact-check reaches the post prompt. The full text is still
# stored for audit; this only bounds what the writer has to hold in mind.
_BRIEF_PROMPT_CHARS = int(os.getenv("RESEARCH_BRIEF_PROMPT_CHARS", "2200"))

# How much transcript the fact-check sees when checking a claim against it.
_MAX_TRANSCRIPT_CHARS = int(os.getenv("RESEARCH_TRANSCRIPT_CHARS", "8000"))

# Drop an angle whose quoted transcript line cannot be found. Set to 0 to keep
# them and rely on the fact-check's own transcript question instead.
# Shared secret for a SearXNG that is reachable from the internet. A public
# instance is a free search proxy and gets found and abused, so the AWS
# deployment puts an ALB rule in front that demands this header and the client
# has to send it. Unset for a local container on localhost.
_SEARXNG_AUTH_HEADER = (os.getenv("SEARXNG_AUTH_HEADER") or "X-SearXNG-Auth").strip()
_SEARXNG_AUTH_TOKEN = (os.getenv("SEARXNG_AUTH_TOKEN") or "").strip()

# Which search backend to use.
#   "auto"    try SearXNG, fall back to DuckDuckGo when it cannot be reached
#   "searxng" SearXNG only; no results if it is down
#   "ddg"     DuckDuckGo only, no server and no key
# auto is the default because the two deployments differ: a laptop runs the
# SearXNG container and gets Google results through it, while the Lambda has no
# container to talk to and must not depend on one.
_SEARCH_PROVIDER = (os.getenv("SEARCH_PROVIDER") or "auto").strip().lower()

# Google's Custom Search JSON API. The serverless way to get the results
# SearXNG gets by scraping Google, without a host to run it on. Free tier is
# 100 queries a day, and one post spends one query per claim.
_GOOGLE_CSE_KEY = (os.getenv("GOOGLE_CSE_API_KEY") or "").strip()
_GOOGLE_CSE_CX = (os.getenv("GOOGLE_CSE_CX") or "").strip()

# Providers known to be out of quota, and when that was learned.
#
# A post asks one query per claim, so without this a provider that answered 429
# for the first claim would be asked again for the second and the third: three
# wasted round trips per post, every post, until the quota resets. The entry
# goes stale on its own so a long-running process picks the provider back up
# after the daily reset without needing to be restarted.
_BRAVE_KEY = (os.getenv("BRAVE_SEARCH_API_KEY") or "").strip()

# Brave's free tier allows one request per second. Claims are researched in
# parallel, so three of them start at once and two get a 429 that has nothing
# to do with the monthly quota. Serialise Brave calls behind a minimum gap
# rather than letting the chain fall through on a limit that a short wait
# clears.
_BRAVE_MIN_INTERVAL_S = float(os.getenv("BRAVE_MIN_INTERVAL_SECONDS", "1.1"))
_brave_lock = threading.Lock()
_brave_last_call = 0.0

_QUOTA_EXHAUSTED: Dict[str, float] = {}
_QUOTA_RETRY_AFTER_S = float(os.getenv("SEARCH_QUOTA_RETRY_SECONDS", "1800"))


def _mark_exhausted(provider: str) -> None:
    _QUOTA_EXHAUSTED[provider] = time.time()


def _is_exhausted(provider: str) -> bool:
    at = _QUOTA_EXHAUSTED.get(provider)
    if at is None:
        return False
    if time.time() - at >= _QUOTA_RETRY_AFTER_S:
        _QUOTA_EXHAUSTED.pop(provider, None)
        return False
    return True

_REQUIRE_SOURCE_QUOTE = (os.getenv("RESEARCH_REQUIRE_SOURCE_QUOTE") or "1").strip().lower() in {"1", "true", "yes", "on"}


# Words too common to indicate that a page is about the query.
_STOPWORDS = {
    "the", "and", "for", "with", "from", "that", "this", "have", "has", "was",
    "were", "been", "over", "into", "about", "after", "before", "during",
    "said", "says", "india", "indian",
}


@dataclass
class Claim:
    claim: str
    query: str
    kind: str = "other"
    source_quote: str = ""

    @property
    def cache_key(self) -> str:
        """
        Claims repeat across stories cut from the same video, so the cache keys
        on the normalised claim text rather than on the news item it came from.
        """
        return re.sub(r"\s+", " ", self.claim.strip().lower())


@dataclass
class SearchResult:
    title: str
    url: str
    snippet: str = ""
    engine: str = ""


@dataclass
class ClaimFinding:
    claim: Claim
    brief: str
    sources: List[str] = field(default_factory=list)
    stance: str = "NEUTRAL"
    verdict: str = ""
    facts: List[Dict[str, str]] = field(default_factory=list)
    in_transcript: bool = True
    verification: Dict[str, Any] = field(default_factory=dict)

    @property
    def verified(self) -> bool:
        """Passed the verification gate: the evidence settles the claim one way."""
        v = self.verdict.lower()
        return bool(v) and not any(
            k in v for k in ("cannot be confirmed", "not confirmed", "unverified", "no evidence")
        )


class _Trace:
    """
    Writes every artefact of one research run to disk.

    Log lines truncate, and the interesting parts here are long: the exact query
    sent to SearXNG, the page text handed to the model, the brief that came
    back. When WEB_RESEARCH_DEBUG_DIR is set, each run drops a numbered folder
    so the whole chain can be read in order after a click in the product.
    """

    def __init__(self, base: Optional[Path], label: str) -> None:
        self.dir: Optional[Path] = None
        if not base:
            return
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        # Strip only what a filesystem rejects. A \w-based slug drops Devanagari
        # matras, because combining marks are not word characters, and turns
        # "हिमाचल" into "ह-म-चल".
        slug = re.sub(r'[<>:"/\\|?*\x00-\x1f]+', "", label)
        slug = re.sub(r"\s+", "-", slug).strip("-.")[:50] or "run"
        try:
            self.dir = Path(base) / f"{stamp}_{slug}"
            self.dir.mkdir(parents=True, exist_ok=True)
        except Exception as exc:
            logger.warning("Could not create research debug dir: %s", exc)
            self.dir = None

    def write(self, name: str, content: str) -> None:
        if not self.dir:
            return
        try:
            (self.dir / name).write_text(content or "", encoding="utf-8")
        except Exception as exc:
            logger.debug("Trace write failed for %s: %s", name, exc)


def apply_stance(
    findings: List[ClaimFinding], mode: str
) -> tuple[List[ClaimFinding], List[ClaimFinding]]:
    """
    Split findings into what the post may build on and what it must not assert.

    "angle" is the requested behaviour: lead with findings that help the
    Congress and Samajwadi case. What it does NOT do is throw away the rest,
    because a finding that cuts the other way is exactly what stops the post
    publishing something the record contradicts. Those are kept as constraints,
    so the post can stay silent on them but can never state their opposite.

    "strict" uses everything as evidence with no political weighting.
    """
    if mode == "strict":
        return findings, []
    lead = [f for f in findings if f.stance in ("SUPPORTS_OPPOSITION", "NEUTRAL")]
    constraints = [f for f in findings if f.stance == "SUPPORTS_RULING"]
    return lead, constraints


@dataclass
class ResearchBrief:
    findings: List[ClaimFinding]
    trace_dir: Optional[Path] = None
    stance_mode: str = "angle"

    @property
    def lead(self) -> List[ClaimFinding]:
        return apply_stance(self.findings, self.stance_mode)[0]

    @property
    def constraints(self) -> List[ClaimFinding]:
        return apply_stance(self.findings, self.stance_mode)[1]

    def as_prompt_text(self, *, per_claim_chars: int = _BRIEF_PROMPT_CHARS) -> str:
        """
        The brief as the post prompt receives it, trimmed.

        The stored brief keeps everything for audit, but the writer only needs
        the findings. Three untrimmed briefs ran to nearly 12,000 characters and
        the reasoning model spent its whole completion budget on them, returning
        an empty post. The verdict line is always kept, because it carries the
        conclusion the post has to respect.
        """
        def _block(i: int, f: ClaimFinding, *, evidence: bool) -> str:
            head = f"CLAIM {i}: {f.claim.claim}"
            if f.verdict:
                head += f"\nVERDICT: {f.verdict}\nHOW TO TREAT THIS CLAIM IN THE POST: {_treatment(f.verdict)}"
            if not evidence:
                return head + (
                    "\nThis finding does not help our argument. Do NOT build the post on it, "
                    "and do NOT state anything that contradicts it."
                )
            body = f.brief.strip()
            if len(body) > per_claim_chars:
                body = body[:per_claim_chars].rstrip() + " ..."
            src = "\n".join(f"  - {u}" for u in f.sources[:4])
            return f"{head}\n\nEVIDENCE:\n{body}\nSOURCES CONSULTED:\n{src}"

        lead, constraints = apply_stance(self.findings, self.stance_mode)
        parts = [_block(i, f, evidence=True) for i, f in enumerate(lead, start=1)]
        if constraints:
            parts.append(
                "DO NOT CONTRADICT THESE (verified, but they do not support our case):\n"
                + "\n\n".join(
                    _block(i, f, evidence=False)
                    for i, f in enumerate(constraints, start=len(lead) + 1)
                )
            )
        return "\n\n".join(parts)

    def as_meta(self) -> Dict[str, Any]:
        """Stored on the post so the brief can be audited against the output."""
        return {
            "stance_mode": self.stance_mode,
            "claims": [
                {
                    "claim": f.claim.claim,
                    "query": f.claim.query,
                    "kind": f.claim.kind,
                    "brief": f.brief,
                    "sources": f.sources,
                    "stance": f.stance,
                    "verdict": f.verdict,
                    "verified": f.verified,
                    "in_transcript": f.in_transcript,
                    "facts": f.facts,
                    "verification": f.verification,
                }
                for f in self.findings
            ],
        }

    def as_payload(self) -> Dict[str, Any]:
        """
        The research half of the JSON handed to the writer.

        Findings the stance filter set aside are still listed, under
        "do_not_contradict", carrying only their verdict. The writer needs to
        know they exist so it does not assert their opposite; it does not get
        their evidence to build on.
        """
        lead, constraints = apply_stance(self.findings, self.stance_mode)
        return {
            "stance_mode": self.stance_mode,
            "use_these": [
                {
                    "claim": f.claim.claim,
                    "verdict": f.verdict,
                    "how_to_treat": _treatment(f.verdict),
                    "stated_in_video": f.in_transcript,
                    "facts": f.facts,
                    "sources": f.sources[:4],
                }
                for f in lead
            ],
            "do_not_contradict": [
                {"claim": f.claim.claim, "verdict": f.verdict} for f in constraints
            ],
        }


_STANCE_RE = re.compile(r"^\s*STANCE:\s*(SUPPORTS_OPPOSITION|SUPPORTS_RULING|NEUTRAL)", re.M | re.I)
_VERDICT_RE = re.compile(r"^\s*VERDICT:\s*(.+)$", re.M)
_FACTS_RE = re.compile(r"^\s*FACTS:\s*(\[.*)", re.M | re.S)
_TRANSCRIPT_MISS_RE = re.compile(r"not in transcript", re.I)


def _norm_for_match(text: str) -> str:
    """Collapse whitespace, case and quote style so a quoted line can be found."""
    t = (text or "").lower()
    t = t.replace("‘", "'").replace("’", "'").replace("“", '"').replace("”", '"')
    t = re.sub(r"[^\wऀ-ॿ]+", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def _transcript_section(brief: str) -> str:
    """The whole TRANSCRIPT CHECK answer, not just its first line."""
    m = re.search(r"TRANSCRIPT CHECK:(.*?)(?=\n\s*\d+\.\s|\nVERDICT:|\Z)", brief, re.S | re.I)
    return m.group(1) if m else brief.split("\n", 1)[0]


def verify_transcript_quote(brief: str, transcript: str) -> Dict[str, Any]:
    """
    Check the quote the fact-check says it took from the transcript.

    The model is asked to quote the line carrying the claim. Taking that on
    trust means the transcript check verifies nothing, so the quote is looked up
    in the actual transcript. A quote that is not there means the model asserted
    a transcript line that does not exist, which matters more than the claim
    itself.
    """
    section = _transcript_section(brief)
    claimed_absent = bool(_TRANSCRIPT_MISS_RE.search(section))
    quotes = [q for q in re.findall(r'"([^"]{12,300})"', section)]
    if not transcript:
        return {"status": "no_transcript", "quotes_checked": 0, "quotes_found": 0}
    if claimed_absent and not quotes:
        return {"status": "absent_as_reported", "quotes_checked": 0, "quotes_found": 0}
    if not quotes:
        return {"status": "no_quote_given", "quotes_checked": 0, "quotes_found": 0}

    hay = _norm_for_match(transcript)
    found = sum(1 for q in quotes if _norm_for_match(q) and _norm_for_match(q) in hay)
    return {
        "status": "verified" if found else "quote_not_in_transcript",
        "quotes_checked": len(quotes),
        "quotes_found": found,
        "unmatched": [q[:120] for q in quotes if _norm_for_match(q) not in hay][:3],
    }


def verify_fact_sources(
    facts: List[Dict[str, str]], results: List[SearchResult], documents: str
) -> Dict[str, Any]:
    """
    Check that each cited URL is one we actually fetched, and that the fact's
    distinctive terms appear in the fetched text.

    Catches two things the model can get wrong without noticing: citing a URL it
    never saw, and attaching a real fact to the wrong page among the six it read.
    """
    fetched = {r.url for r in results}
    hay = _norm_for_match(documents)
    cited = grounded = unknown_url = 0
    for f in facts:
        url = str(f.get("url") or "").split(";")[0].strip()
        if url and url.lower() != "n/a":
            cited += 1
            if url not in fetched:
                unknown_url += 1
        # Distinctive tokens: numbers and long words carry the fact's substance.
        tokens = [t for t in _norm_for_match(str(f.get("fact") or "")).split() if len(t) > 5 or t.isdigit()]
        if tokens and sum(1 for t in tokens if t in hay) >= max(1, len(tokens) // 3):
            grounded += 1
    return {
        "facts": len(facts),
        "with_url": cited,
        "url_not_fetched": unknown_url,
        "text_supported": grounded,
    }


def search_relevance(results: List[SearchResult], query: str, documents: str) -> Dict[str, Any]:
    """
    How much of the query the retrieved pages actually cover.

    A low score means SearXNG returned pages about something else, which is the
    early warning that a verdict of "cannot be confirmed" says more about the
    search than about the claim.
    """
    terms = [t for t in _norm_for_match(query).split() if len(t) > 3]
    if not terms:
        return {"query_terms": 0, "covered": 0, "coverage": 0.0}
    hay = _norm_for_match(documents)
    covered = sum(1 for t in terms if t in hay)
    return {
        "query_terms": len(terms),
        "covered": covered,
        "coverage": round(covered / len(terms), 2),
        "pages": len(results),
    }



def _sanitise_query(query: str, quote: str, transcript: str) -> str:
    """
    Remove a year from the query that no source ever stated.

    The anchoring rule stops an angle being welded from two sentences, but the
    model still reaches for a year when it writes the search query: the
    transcript said "the 20th of July" with no year, and the query came back as
    "July 2024", then "July 2025", for events that happened in 2026. Searching a
    fabricated year is worse than searching none, because the results come back
    confidently about the wrong period.

    A year is kept only if the quote or the transcript actually contains it.
    """
    years = set(re.findall(r"\b(19|20)\d{2}\b", query))
    if not years:
        return query
    hay = quote + chr(10) + transcript
    out = query
    for y in re.findall(r"\b(?:19|20)\d{2}\b", query):
        if y not in hay:
            out = re.sub(rf"\s*\b{y}\b", "", out)
            logger.info("[research] removed year %s from query: no source states it", y)
    return re.sub(r"\s{2,}", " ", out).strip()

def _parse_brief(brief: str) -> tuple[str, str, List[Dict[str, str]], bool]:
    """Pull the structured tail off a fact-check: verdict, stance, facts, transcript hit."""
    verdict_m = _VERDICT_RE.search(brief)
    verdict = verdict_m.group(1).strip() if verdict_m else ""

    stance_m = _STANCE_RE.search(brief)
    stance = stance_m.group(1).upper() if stance_m else "NEUTRAL"

    facts: List[Dict[str, str]] = []
    facts_m = _FACTS_RE.search(brief)
    if facts_m:
        raw = facts_m.group(1).strip()
        # The array is the last thing in the reply, so trim anything after it.
        depth, end = 0, len(raw)
        for i, ch in enumerate(raw):
            if ch == "[":
                depth += 1
            elif ch == "]":
                depth -= 1
                if depth == 0:
                    end = i + 1
                    break
        try:
            parsed = json.loads(raw[:end])
            if isinstance(parsed, list):
                facts = [f for f in parsed if isinstance(f, dict)]
        except json.JSONDecodeError:
            logger.debug("Could not parse FACTS array from fact-check")

    # Only the first answer line is about the transcript; a later mention of the
    # phrase inside the evidence should not count as a miss.
    head = brief.split("\n", 3)[0] if brief else ""
    in_transcript = not bool(_TRANSCRIPT_MISS_RE.search(head))
    return verdict, stance, facts, in_transcript


def _treatment(verdict: str) -> str:
    """
    Turn a verdict into an instruction the writer cannot misread.

    "VERDICT: cannot be confirmed" is a finding, not a directive, and a model
    under a deadline reads it as background. Spelling out what to do with the
    claim is the difference between a post that reports an unverified claim as
    fact and one that says so.
    """
    v = verdict.lower()
    if "cannot be confirmed" in v or "not confirmed" in v or "unverified" in v:
        return (
            "This claim is NOT verified. Do not state it as fact. Say plainly in the post "
            "that it is unconfirmed, or that it rests only on the speaker's own word."
        )
    if "misleading" in v:
        return (
            "This claim is MISLEADING. State the correction plainly in the post, and give the "
            "evidence that contradicts it."
        )
    if "false" in v or "inaccurate" in v:
        return (
            "This claim is FALSE as stated. Correct it in the post and give the accurate version."
        )
    # Checked before "accurate", because the interesting verdicts are mixed:
    # "supported only for the 2017-18 period, not for the present, and official
    # data contradicts any current four-decade high claim" matched none of the
    # keywords above and fell through to the mildest note in the file, which is
    # how a contradicted figure reached the writer as usable material.
    if "contradict" in v:
        return (
            "Part of this claim is CONTRADICTED by the evidence. Do not state the contradicted "
            "part at all. If you use this claim, use only the part the evidence supports, and "
            "date it explicitly so a reader cannot take a past figure for a current one."
        )
    if "only for" in v or "not for the present" in v or "no longer" in v or "outdated" in v:
        return (
            "This claim held for one period only and does not describe the present. State the "
            "period it belongs to, and do not write it as a current fact."
        )
    if "accurate" in v:
        return "This claim is supported. You may state it, and you may cite the sourced detail."
    return "Follow the verdict exactly. Do not overstate what the evidence supports."


def _fill(template: str, replacements: Dict[str, str]) -> str:
    """Avoid str.format so braces in news text or page content cannot break the prompt."""
    out = template
    for key, val in replacements.items():
        out = out.replace("{" + key + "}", val)
    return out


def _read_prompt(prompts_dir: Path, name: str) -> str:
    path = prompts_dir / name
    if not path.is_file():
        raise FileNotFoundError(f"Missing research prompt: {path}")
    return path.read_text(encoding="utf-8").strip()


def _parse_json_object(text: str) -> Dict[str, Any]:
    """
    Models wrap JSON in prose or code fences often enough that a bare
    json.loads is not worth relying on.
    """
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        start, end = cleaned.find("{"), cleaned.rfind("}")
        if start == -1 or end <= start:
            raise
        return json.loads(cleaned[start : end + 1])


# ─────────────────────────── search ───────────────────────────


def _query_terms(query: str) -> list:
    """Meaningful words from the query. No regex, so nothing depends on escaping."""
    strip = ".,:;!?'\"()[]{}/-"
    out = []
    for raw in (query or "").lower().split():
        t = raw.strip(strip)
        if len(t) > 3 and t not in _STOPWORDS:
            out.append(t)
    return out


def _result_relevance(result: "SearchResult", terms: list) -> int:
    """How many query terms appear in this result's title and snippet."""
    if not terms:
        return 1
    blob = ((result.title or "") + " " + (result.snippet or "")).lower()
    return sum(1 for t in terms if t in blob)


def _search_headers() -> Dict[str, str]:
    headers = {"User-Agent": "AmbedkarGPT-Research/1.0"}
    if _SEARXNG_AUTH_TOKEN:
        headers[_SEARXNG_AUTH_HEADER] = _SEARXNG_AUTH_TOKEN
    return headers


class _SearxngUnreachable(Exception):
    """Raised so the caller can fall back rather than return no results."""


def _raw_searxng(query: str, base_url: str, timeout: float) -> List[Dict[str, str]]:
    """Rows from a self-hosted SearXNG, in the shared shape."""
    endpoint = base_url.rstrip("/") + "/search"
    try:
        resp = requests.get(
            endpoint,
            params={"q": query, "format": "json", "language": "en", "safesearch": 0},
            timeout=timeout,
            headers=_search_headers(),
        )
        resp.raise_for_status()
        payload = resp.json()
    except requests.exceptions.ConnectionError as exc:
        raise _SearxngUnreachable(base_url) from exc
    except Exception as exc:
        logger.warning("SearXNG query failed for %r: %s", query, exc)
        return []
    return [
        {
            "url": (r.get("url") or "").strip(),
            "title": (r.get("title") or "").strip(),
            "content": (r.get("content") or "").strip(),
            "engine": (r.get("engine") or "").strip(),
        }
        for r in payload.get("results", [])
    ]


def _brave_configured() -> bool:
    return bool(_BRAVE_KEY)


def _raw_brave(query: str, top_k: int, timeout: float) -> List[Dict[str, str]]:
    """
    Rows from the Brave Search API, in the shared shape.

    Brave crawls its own index rather than reselling Bing or Google, so it
    returns things the others miss, and unlike Google's Programmable Search it
    still searches the open web. Priced in credits rather than a free tier:
    $5 of credit a month against $5 per 1,000 requests, so roughly 1,000
    searches, and it bills past that rather than refusing.
    """
    global _brave_last_call
    if not _brave_configured():
        logger.error(
            "SEARCH_PROVIDER wants Brave but BRAVE_SEARCH_API_KEY is unset. "
            "Posts will still generate, without any web research."
        )
        return []

    # One request per second on the free tier, and claims run in parallel.
    with _brave_lock:
        gap = time.time() - _brave_last_call
        if gap < _BRAVE_MIN_INTERVAL_S:
            time.sleep(_BRAVE_MIN_INTERVAL_S - gap)
        _brave_last_call = time.time()

    try:
        resp = requests.get(
            "https://api.search.brave.com/res/v1/web/search",
            params={"q": query, "count": min(max(top_k * 2, 10), 20), "country": "in"},
            headers={
                "X-Subscription-Token": _BRAVE_KEY,
                "Accept": "application/json",
            },
            timeout=timeout,
        )
        if resp.status_code == 429:
            # Could be the per-second limit or the monthly one. Treating both as
            # exhausted for a while is the safe read: a short pause costs one
            # search, and hammering a spent monthly quota costs every search.
            _mark_exhausted("brave")
            logger.warning(
                "Brave returned 429; skipping it for %d minutes and falling "
                "through to the next backend.",
                int(_QUOTA_RETRY_AFTER_S // 60),
            )
            return []
        resp.raise_for_status()
        payload = resp.json()
    except Exception as exc:
        logger.warning("Brave query failed for %r: %s", query, exc)
        return []

    return [
        {
            "url": (r.get("url") or "").strip(),
            "title": (r.get("title") or "").strip(),
            # Brave marks query terms in the description with <strong> tags.
            "content": re.sub(r"</?strong>", "", (r.get("description") or "")).strip(),
            "engine": "brave",
        }
        for r in (payload.get("web", {}).get("results") or [])
    ]


def _google_cse_configured() -> bool:
    return bool(_GOOGLE_CSE_KEY and _GOOGLE_CSE_CX)


def _raw_google_cse(query: str, top_k: int, timeout: float) -> List[Dict[str, str]]:
    """
    Rows from Google's Custom Search JSON API, in the shared shape.

    Same results SearXNG reaches through its google engine, reached instead by
    the documented API, so the Lambda needs nothing running beside it.

    Quota is the thing to watch. The free tier allows 100 queries a day and a
    post spends one per claim, so roughly thirty posts. Exceeding it returns
    HTTP 429 and no results, which degrades to a post with no research rather
    than an error, so the log line below is the only warning you get.
    """
    if not _google_cse_configured():
        logger.error(
            "SEARCH_PROVIDER wants Google CSE but GOOGLE_CSE_API_KEY or "
            "GOOGLE_CSE_CX is unset. Posts will still generate, without any "
            "web research."
        )
        return []
    try:
        resp = requests.get(
            "https://www.googleapis.com/customsearch/v1",
            params={
                "key": _GOOGLE_CSE_KEY,
                "cx": _GOOGLE_CSE_CX,
                "q": query,
                # 10 is the API's ceiling per call. The host cap and relevance
                # gate discard some, so ask for all of them.
                "num": 10,
            },
            timeout=timeout,
        )
        if resp.status_code == 429:
            _mark_exhausted("google")
            logger.warning(
                "Google CSE daily quota exhausted; skipping it for %d minutes "
                "and falling through to the next backend.",
                int(_QUOTA_RETRY_AFTER_S // 60),
            )
            return []
        resp.raise_for_status()
        payload = resp.json()
    except Exception as exc:
        logger.warning("Google CSE query failed for %r: %s", query, exc)
        return []
    return [
        {
            "url": (item.get("link") or "").strip(),
            "title": (item.get("title") or "").strip(),
            "content": (item.get("snippet") or "").strip(),
            "engine": "google cse",
        }
        for item in payload.get("items", [])
    ]


def _raw_ddg(query: str, top_k: int, timeout: float) -> List[Dict[str, str]]:
    """
    Rows from DuckDuckGo, in the shared shape.

    No key and no host, which is the whole point: it runs inside the API Lambda
    where there is nothing to deploy alongside it. Narrower than SearXNG, which
    fans out to Google as well, so results are thinner on obscure queries.
    """
    try:
        try:
            from ddgs import DDGS
        except ImportError:
            from duckduckgo_search import DDGS
    except ImportError:
        logger.error(
            "SEARCH_PROVIDER wants DuckDuckGo but ddgs is not installed. "
            "Add it to requirements-api.txt and rebuild. Posts will still "
            "generate, without any web research."
        )
        return []
    try:
        # Ask for more than needed: the host cap and relevance gate below
        # discard some, and asking again costs another round trip.
        with DDGS(timeout=int(timeout)) as ddg:
            rows = list(ddg.text(query, max_results=max(top_k * 3, 12)))
    except Exception as exc:
        logger.warning("DuckDuckGo query failed for %r: %s", query, exc)
        return []
    return [
        {
            "url": (r.get("href") or r.get("url") or "").strip(),
            "title": (r.get("title") or "").strip(),
            "content": (r.get("body") or "").strip(),
            "engine": "duckduckgo",
        }
        for r in rows
    ]


def search_urls(
    query: str,
    *,
    base_url: str,
    top_k: int = 6,
    timeout: float = 20.0,
) -> List[SearchResult]:
    """
    Search the web and return de-duplicated results, best first.

    The only place a search provider is named. Everything downstream reads
    SearchResult, so adding a provider means adding a _raw_* function and a
    branch here, and nothing else changes.

    SEARCH_PROVIDER picks the backend:
      auto    walk searxng -> brave -> ddg, taking the first that answers
      searxng SearXNG only, pinned
      brave   Brave Search API only, pinned
      ddg     DuckDuckGo only, pinned
      google  Google Programmable Search only, pinned; covers just the sites
              configured on the engine, since entire-web is deprecated

    On auto, a backend that is unreachable, unconfigured or out of quota is
    stepped over rather than failing the search. DuckDuckGo sits last because
    it has no key and no quota, so the chain always has somewhere to land.
    """
    def _try(name: str) -> List[Dict[str, str]]:
        """One backend, or an empty list if it is unavailable for any reason."""
        if _is_exhausted(name):
            return []
        if name == "searxng":
            if not base_url:
                return []
            try:
                return _raw_searxng(query, base_url, timeout)
            except _SearxngUnreachable:
                # One line, not one per claim: a stack of identical connection
                # errors buries the single thing worth knowing.
                if not _is_exhausted("searxng_notice"):
                    _mark_exhausted("searxng_notice")
                    logger.warning(
                        "SearXNG is not reachable at %s. Start it with: "
                        "docker compose -f deploy/searxng/docker-compose.yml up -d",
                        base_url,
                    )
                return []
        if name == "brave":
            return _raw_brave(query, top_k, timeout) if _brave_configured() else []
        if name == "google":
            return _raw_google_cse(query, top_k, timeout) if _google_cse_configured() else []
        if name == "ddg":
            return _raw_ddg(query, top_k, timeout)
        return []

    # Preference order, best first. DuckDuckGo is last on purpose: it is the
    # only one with neither a key nor a quota, so it is what the chain lands on.
    #
    # Google is not in the chain. Programmable Search can no longer be set to
    # search the entire web, so a new engine only covers the sites listed on it
    # and is a curated index rather than a search backend. It stays selectable
    # explicitly for anyone holding an older engine that kept the setting.
    CHAIN = ("searxng", "brave", "ddg")

    rows: List[Dict[str, str]] = []
    if _SEARCH_PROVIDER in CHAIN:
        # An explicit choice is pinned: no silent substitution when the point of
        # setting it was to know which backend answered.
        rows = _try(_SEARCH_PROVIDER)
    else:
        for i, name in enumerate(CHAIN):
            rows = _try(name)
            if rows:
                if i:
                    logger.info("[research] %s answered after %s could not", name, ", ".join(CHAIN[:i]))
                break

    terms = _query_terms(query)
    out: List[SearchResult] = []
    seen_hosts: Dict[str, int] = {}
    dropped = 0
    for row in rows:
        url = (row.get("url") or "").strip()
        if not url:
            continue
        host = (urlparse(url).netloc or "").lower()
        if host in _BLOCKED_HOSTS:
            continue
        # Two pages per host at most: five results from one site is one source.
        if seen_hosts.get(host, 0) >= 2:
            continue
        candidate = SearchResult(
            title=row.get("title", ""),
            url=url,
            snippet=row.get("content", ""),
            engine=row.get("engine", ""),
        )
        # A result carrying not one word of the query is not a weak match, it is
        # a different subject. Engines pad thin queries with their own filler,
        # and that filler was being fetched and handed to the fact-check as
        # evidence alongside real reporting.
        if _result_relevance(candidate, terms) == 0:
            dropped += 1
            continue

        seen_hosts[host] = seen_hosts.get(host, 0) + 1
        out.append(candidate)
        if len(out) >= top_k:
            break

    if dropped:
        logger.info("[research] dropped %d off-topic result(s) for %r", dropped, query)
    return out


# ─────────────────────────── extraction ───────────────────────────


# Warned once per process, not once per page. A run fetches dozens of URLs and
# the repeated warning buried the one line that mattered.
_TRAFILATURA_WARNED = False



# Formats trafilatura cannot read. It is an HTML extractor, so a PDF is a
# multi-megabyte download that yields nothing - and the slow ones are the worst
# of both: an Adani annual report and an NSE letter of offer each spent the full
# 30-second timeout and then a retry, a minute of the request gone on documents
# that could never have produced a sentence.
_UNREADABLE_SUFFIXES = (
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".zip", ".rar", ".7z", ".mp3", ".mp4", ".avi", ".mov", ".jpg", ".jpeg",
    ".png", ".gif", ".webp", ".svg", ".csv",
)


def _is_readable_page(url: str) -> bool:
    """False for URLs whose extension says the body is not HTML."""
    try:
        path = urlparse(url).path.lower()
    except Exception:
        return True
    return not path.endswith(_UNREADABLE_SUFFIXES)


def _download_config(timeout: float):
    """
    trafilatura's config with our timeout, not its 30-second default.

    The timeout argument to _extract_one was accepted and then never used, so
    every fetch waited the library default and urllib3 retried on top of it.
    """
    from trafilatura.settings import use_config

    cfg = use_config()
    cfg.set("DEFAULT", "DOWNLOAD_TIMEOUT", str(int(max(3, timeout))))
    # 20MB is a lot to pull for text. Anything that big is not an article.
    cfg.set("DEFAULT", "MAX_FILE_SIZE", "3000000")
    return cfg


def _extract_one(result: SearchResult, timeout: float) -> Optional[str]:
    global _TRAFILATURA_WARNED
    try:
        import trafilatura
    except ImportError:
        if not _TRAFILATURA_WARNED:
            _TRAFILATURA_WARNED = True
            # Name the interpreter: this is nearly always a virtualenv
            # mismatch, the server running on a Python that never got the
            # requirements rather than a package that failed to build.
            logger.warning(
                "trafilatura is not importable by %s, so pages cannot be read "
                "and research falls back to search snippets, which are a "
                "sentence or two each. Install it into THAT interpreter: "
                "%s -m pip install trafilatura",
                sys.executable,
                sys.executable,
            )
        return None
    if not _is_readable_page(result.url):
        logger.debug("skipping non-HTML result: %s", result.url)
        return None
    try:
        downloaded = trafilatura.fetch_url(result.url, config=_download_config(timeout))
        if not downloaded:
            return None
        text = trafilatura.extract(
            downloaded,
            include_comments=False,
            include_tables=True,
            favor_precision=True,
        )
    except Exception as exc:
        logger.debug("Extraction failed for %s: %s", result.url, exc)
        return None
    if not text or len(text) < _MIN_DOC_CHARS:
        return None
    return text[:_MAX_DOC_CHARS]


def fetch_documents(
    results: Iterable[SearchResult],
    *,
    timeout: float = 15.0,
    max_workers: int = 5,
) -> str:
    """
    Fetch and clean the result pages into one labelled block for the prompt.

    Pages that fail extraction fall back to their search snippet, which is thin
    but still carries the publication name and often a date, so a partly failed
    fetch still produces a usable brief.
    """
    results = list(results)
    if not results:
        return ""
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        texts = list(pool.map(lambda r: _extract_one(r, timeout), results))

    blocks = []
    for res, text in zip(results, texts):
        body = text or res.snippet
        if not body:
            continue
        host = urlparse(res.url).netloc
        blocks.append(
            f"--- SOURCE: {res.title or host}\nURL: {res.url}\nSITE: {host}\n\n{body}"
        )
    return "\n\n".join(blocks)


# ─────────────────────────── LLM steps ───────────────────────────


def extract_claims(
    client: OpenAI,
    model: str,
    *,
    news_item: str,
    transcript_excerpt: str,
    prompts_dir: Path,
    max_claims: int = 2,
    temperature: float = 0.2,
    on_prompt=None,
    purpose: str = "support",
    transcript: str = "",
) -> List[Claim]:
    sys_name, usr_name, _, _ = prompt_names(purpose)
    system = _read_prompt(prompts_dir, sys_name)
    user = _fill(
        _read_prompt(prompts_dir, usr_name),
        {
            "max_claims": str(max_claims),
            "news_item": news_item.strip(),
            "transcript_excerpt": (transcript_excerpt or "(none)").strip(),
        },
    )
    if on_prompt:
        on_prompt(system, user)
    resp = client.chat.completions.create(
        model=model,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        temperature=temperature,
        max_tokens=_CLAIM_MAX_TOKENS,
    )
    raw = (resp.choices[0].message.content or "").strip()
    if not raw:
        return []
    try:
        data = _parse_json_object(raw)
    except json.JSONDecodeError:
        logger.warning("Claim extraction returned unparseable JSON: %s", raw[:300])
        return []

    hay = _norm_for_match(transcript)
    claims: List[Claim] = []
    for row in (data.get("claims") or [])[:max_claims]:
        text = str(row.get("claim") or "").strip()
        query = str(row.get("query") or "").strip()
        if not text or not query:
            continue
        quote = str(row.get("source_quote") or "").strip()

        # An angle has to rest on one sentence the speaker actually said. The
        # failure this catches is welding: the transcript said "students marched
        # on the 20th of July" and, separately, "the minister resigned", and the
        # extractor merged them into a resignation dated 20 July, then searched
        # for a date nobody gave. A quote that is not in the transcript means the
        # angle was assembled rather than found, so it is dropped before it costs
        # a search.
        if _REQUIRE_SOURCE_QUOTE and hay:
            norm_q = _norm_for_match(quote)
            if not norm_q:
                logger.info("[research] dropped angle with no source quote: %s", text[:90])
                continue
            if norm_q not in hay:
                logger.info(
                    "[research] dropped angle whose quote is not in the transcript: %s | quote=%r",
                    text[:90], quote[:90],
                )
                continue

        query = _sanitise_query(query, quote, transcript)
        claims.append(Claim(claim=text, query=query,
                            kind=str(row.get("kind") or "other"), source_quote=quote))
    return claims


def factcheck_claim(
    client: OpenAI,
    model: str,
    *,
    claim: Claim,
    documents: str,
    prompts_dir: Path,
    transcript: str = "",
    temperature: float = 0.1,
    on_prompt=None,
    purpose: str = "support",
) -> str:
    _, _, sys_name, usr_name = prompt_names(purpose)
    system = _read_prompt(prompts_dir, sys_name)
    user = _fill(
        _read_prompt(prompts_dir, usr_name),
        {
            "today": date.today().strftime("%d %B %Y"),
            "claim": claim.claim,
            "documents": documents,
            "transcript": (transcript or "(transcript not available)")[:_MAX_TRANSCRIPT_CHARS],
        },
    )
    if on_prompt:
        on_prompt(system, user)
    resp = client.chat.completions.create(
        model=model,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        temperature=temperature,
        max_tokens=_FACTCHECK_MAX_TOKENS,
    )
    return (resp.choices[0].message.content or "").strip()


# ─────────────────────────── orchestration ───────────────────────────


def research(
    client: OpenAI,
    model: str,
    *,
    news_item: str,
    transcript_excerpt: str = "",
    prompts_dir: Path,
    searxng_url: str,
    max_claims: int = 2,
    top_k: int = 6,
    cache: Optional[Dict[str, ClaimFinding]] = None,
    debug_dir: Optional[Path] = None,
    transcript: str = "",
    video_link: str = "",
    stance_mode: str = "angle",
    purpose: str = "support",
) -> Optional[ResearchBrief]:
    """
    Run the full research step for one news item.

    Returns None when nothing usable was produced, which the caller must treat
    as "generate the post without a brief" rather than as an error.
    """
    trace = _Trace(debug_dir, news_item.strip().splitlines()[0] if news_item.strip() else "run")
    trace.write("00_news_item.txt", f"VIDEO: {video_link}\n\n{news_item}")
    trace.write("00b_transcript.txt", transcript or transcript_excerpt)
    if trace.dir:
        logger.info("[research] tracing to %s", trace.dir)

    # The transcript is the primary source: claims are what the speaker said,
    # and every claim is checked back against it. Chunks stand in when the full
    # transcript is not on hand.
    transcript = (transcript or transcript_excerpt or "").strip()

    try:
        claims = extract_claims(
            client,
            model,
            news_item=news_item,
            transcript_excerpt=transcript_excerpt,
            prompts_dir=prompts_dir,
            max_claims=max_claims,
            purpose=purpose,
            transcript=transcript,
            on_prompt=lambda sysmsg, usr: (
                trace.write("01x_claim_prompt_system.txt", sysmsg),
                trace.write("01x_claim_prompt_user.txt", usr),
            ),
        )
    except Exception as exc:
        logger.warning("[research] claim extraction failed: %s", exc)
        return None

    logger.info("[research] extracted %d claim(s), each anchored to a transcript line", len(claims))
    trace.write(
        "01_claims.json",
        json.dumps([{"claim": c.claim, "query": c.query, "kind": c.kind,
                     "source_quote": c.source_quote} for c in claims],
                   ensure_ascii=False, indent=2),
    )
    if not claims:
        logger.info("[research] no checkable claims; skipping research")
        return None

    def _one(idx: int, claim: Claim) -> Optional[ClaimFinding]:
        started = time.monotonic()
        if cache is not None and claim.cache_key in cache:
            logger.info("[research] claim %d served from cache", idx)
            return cache[claim.cache_key]

        logger.info("[research] claim %d searxng query: %r", idx, claim.query)
        results = search_urls(claim.query, base_url=searxng_url, top_k=top_k)
        logger.info("[research] claim %d got %d result(s)", idx, len(results))
        for n, r in enumerate(results, 1):
            # Full URL, never truncated: a cut link is not a link, and these get
            # copied out of the log to check a source by hand.
            logger.info("[research]   claim %d result %d [%s] %s", idx, n, r.engine, r.url)
        trace.write(
            f"{idx:02d}a_search.json",
            json.dumps(
                {"query": claim.query,
                 "results": [{"engine": r.engine, "title": r.title, "url": r.url,
                              "snippet": r.snippet} for r in results]},
                ensure_ascii=False, indent=2,
            ),
        )
        if not results:
            logger.info("[research] claim %d: no search results", idx)
            return None

        documents = fetch_documents(results)
        logger.info("[research] claim %d extracted %d chars of page text", idx, len(documents))
        trace.write(f"{idx:02d}b_documents.txt", documents)
        if not documents:
            logger.info("[research] claim %d: no readable pages", idx)
            return None

        try:
            brief = factcheck_claim(
                client, model, claim=claim, documents=documents,
                prompts_dir=prompts_dir, transcript=transcript, purpose=purpose,
                on_prompt=lambda sysmsg, usr, i=idx: (
                    trace.write(f"{i:02d}x_factcheck_prompt_system.txt", sysmsg),
                    trace.write(f"{i:02d}x_factcheck_prompt_user.txt", usr),
                ),
            )
        except Exception as exc:
            logger.warning("[research] claim %d fact-check failed: %s", idx, exc)
            return None
        if not brief:
            logger.warning("[research] claim %d fact-check returned nothing", idx)
            return None

        trace.write(f"{idx:02d}c_brief.txt", brief)
        verdict, stance, facts, in_transcript = _parse_brief(brief)
        logger.info(
            "[research] claim %d done in %.0fs stance=%s transcript=%s facts=%d | %s",
            idx, time.monotonic() - started, stance,
            "yes" if in_transcript else "NO", len(facts), verdict[:150] or "(no verdict)",
        )
        for f in facts:
            u = str(f.get("url") or "").split(";")[0].strip()
            if u:
                logger.info("[research]   claim %d fact source: %s | %s",
                            idx, str(f.get("source") or ""), u)

        verification = {
            "transcript": verify_transcript_quote(brief, transcript),
            "sources": verify_fact_sources(facts, results, documents),
            "search": search_relevance(results, claim.query, documents),
        }
        logger.info(
            "[verify] claim %d transcript=%s facts=%d/%d text-supported, "
            "%d cited url not fetched, search coverage=%.0f%%",
            idx, verification["transcript"]["status"],
            verification["sources"]["text_supported"], verification["sources"]["facts"],
            verification["sources"]["url_not_fetched"],
            verification["search"]["coverage"] * 100,
        )

        finding = ClaimFinding(
            claim=claim, brief=brief, sources=[r.url for r in results],
            stance=stance, verdict=verdict, facts=facts, in_transcript=in_transcript,
            verification=verification,
        )
        if cache is not None:
            cache[claim.cache_key] = finding
        return finding

    # Claims are independent, and each one costs a search, six page fetches and
    # a reasoning-model call. Run sequentially that was about five minutes for
    # three claims, nearly all of it spent waiting. Running them together makes
    # the step cost roughly one claim instead of all of them.
    started = time.monotonic()
    with ThreadPoolExecutor(max_workers=min(len(claims), 4)) as pool:
        settled = list(pool.map(lambda p: _one(*p), list(enumerate(claims, start=1))))
    findings = [f for f in settled if f is not None]
    logger.info("[research] %d/%d claim(s) resolved in %.0fs",
                len(findings), len(claims), time.monotonic() - started)

    if not findings:
        logger.info("[research] no usable findings; post will generate without a brief")
        return None

    # Verification gate. A run where nothing could be settled either way carries
    # no information for the writer, so the post is generated without a brief
    # rather than on a page of "cannot be confirmed".
    if purpose == "support":
        # The gate asks a different question here: did we find anything usable?
        useful = [f for f in findings if f.facts]
        if not useful:
            logger.info("[research] nothing usable found across %d angle(s); "
                        "post will generate without a brief", len(findings))
            trace.write("09_brief_combined.txt", "(gate: no supporting material found)")
            return None
    elif not any(f.verified for f in findings):
        logger.info("[research] verification gate: nothing was settled across %d claim(s); "
                    "post will generate without a brief", len(findings))
        trace.write("09_brief_combined.txt", "(verification gate: no claim was settled)")
        return None

    out = ResearchBrief(findings=findings, trace_dir=trace.dir, stance_mode=stance_mode)
    lead, constraints = apply_stance(findings, stance_mode)
    logger.info(
        "[research] gate passed: %d verified, %d lead, %d held as constraints (mode=%s)",
        sum(1 for f in findings if f.verified), len(lead), len(constraints), stance_mode,
    )
    trace.write("09_brief_combined.txt", out.as_prompt_text())
    return out
