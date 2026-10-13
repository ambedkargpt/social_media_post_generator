"""Reader-facing presentation for SemRAG answers in BheemBot.

Everything a user sees should read like a guide's answer, not a system's debug output:

* passages are cited by book, volume and printed page ("Annihilation of Caste, Vol. 1, p. 67"),
  never by internal chunk id;
* passage text is cleaned of scanning debris (print-shop paths, running heads, OCR markers);
* source excerpts start and end on sentence boundaries;
* the reply is plain text for the chat bubble, which renders text as-is (`white-space: pre-wrap`)
  and has no Markdown renderer, so `**`, `#` and `- ` would otherwise show literally.

The citation map (`data/citations.json`) is built in the Ambedkar-SemRAG repo by
`src/utils/build_citations.py` from the scanned pages' running heads and Volume 1's contents
page, and copied here so the lookup needs no database change. Page numbers were checked by
holding out every page with a printed number and predicting it from its neighbours: 98.6%
(Vol. 1) and 97.6% (Vol. 2) exact. Volume 2 is cited by Part rather than by speech, because
its contents could not be parsed reliably and a wrong speech title is worse than none.
"""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Optional

CITATIONS_FILE = Path(__file__).resolve().parent / "data" / "citations.json"
SERIES = "Writings and Speeches"
PILL_MAX = 40  # the source pill truncates its label at 40 characters


@lru_cache(maxsize=1)
def _citations() -> dict:
    try:
        return json.loads(CITATIONS_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}  # a missing map degrades to "Writings and Speeches, Vol. N"


def citation(chunk_id: Optional[str], volume=None) -> dict:
    """{'volume', 'work', 'pages'} for a chunk; falls back to the volume alone."""
    row = _citations().get(str(chunk_id or ""))
    if row:
        vol, work, pages = row
        return {"volume": vol, "work": work, "pages": pages}
    return {"volume": volume, "work": None, "pages": None}


def _pages_text(pages: Optional[str]) -> str:
    if not pages:
        return ""
    return ("pp. " if "–" in pages else "p. ") + pages


def reference(chunk_id: Optional[str], volume=None) -> str:
    """Full reference for prose: 'Annihilation of Caste, Vol. 1, p. 67'."""
    c = citation(chunk_id, volume)
    parts = [c["work"] or SERIES]
    if c["volume"]:
        parts.append(f"Vol. {c['volume']}")
    if c["pages"]:
        parts.append(_pages_text(c["pages"]))
    return ", ".join(parts)


def pill_label(chunk_id: Optional[str], volume=None) -> str:
    """Short label that fits the 40-character source pill, keeping volume and page visible.

    Only the first page is shown here so the title keeps its room; the full page range is in
    the pill's hover text (the snippet).
    """
    c = citation(chunk_id, volume)
    first_page = (c["pages"] or "").split("–")[0]
    suffix = " ".join(x for x in (f"Vol {c['volume']}" if c["volume"] else "",
                                  f"p. {first_page}" if first_page else "") if x)
    title = c["work"] or SERIES
    room = PILL_MAX - len(suffix) - 3  # " · "
    if len(title) > room:
        title = title[: max(room - 1, 8)].rstrip(" ,") + "…"
    return f"{title} · {suffix}" if suffix else title


# ── Cleaning passage text ─────────────────────────────────────────────────────

_TYPESETTING = re.compile(r"z:\s*\\[^\n]{0,80}?\.indd(?:\s+[A-Z]{2,}(?:\+[A-Z]{2,})?)*"
                          r"(?:\s+\d{1,2}-\d{1,2}-\d{4}(?:/[A-Z]{2,}-\d{1,2}-\d{1,2}-\d{4})?)?", re.I)
_SERIES_HEAD = re.compile(r"\b\d{0,4}\s*Dr\.\s*BABASAHEB\s+AMBEDKAR\s*:\s*WRITINGS\s+AND\s+SPEECHES\s*\d{0,4}", re.I)
_PAGED_HEAD = re.compile(r"\b(\d{1,4})\s+((?:[A-Z][A-Z\u2019',:\-\.]*\s+){1,10})\1\b")
_OCR_MARKERS = re.compile(r"\*?_{0,2}ABBR_\d+_{0,2}\*?|\(cid:\d+\)")


def clean_passage(text: str) -> str:
    """Remove scanning debris that is not part of what Dr. Ambedkar wrote."""
    out = _TYPESETTING.sub(" ", text or "")
    out = _SERIES_HEAD.sub(" ", out)
    out = _PAGED_HEAD.sub(" ", out)
    out = _OCR_MARKERS.sub(" ", out)
    return re.sub(r"\s+", " ", out).strip()


def excerpt(text: str, limit: int = 220) -> str:
    """A readable excerpt: starts at a sentence, ends at a sentence or a word, never mid-word."""
    t = clean_passage(text)
    if t and t[0].islower():  # chunk began mid-sentence: start at the next sentence
        m = re.search(r"[.!?][\"”’]?\s+(?=[A-Z“\"])", t)
        if m and m.end() < len(t) * 0.5:
            t = t[m.end():]
    if len(t) <= limit:
        return t
    cut = t[:limit]
    end = max(cut.rfind(". "), cut.rfind("? "), cut.rfind("! "))
    if end >= limit * 0.5:
        return cut[: end + 1]
    return cut[: cut.rfind(" ")].rstrip(" ,;:") + "…"


# ── Cleaning the reply ────────────────────────────────────────────────────────

_LEAKS = [
    re.compile(r"[ \t]*[\[(]\s*(?:chunk|source|passage)\s*[:#]?\s*[\w\-]*\d[\w\-]*\s*[\])]", re.I),
    re.compile(r"[ \t]*[\[(]\s*v\d+_chunk_\d+(?:\s*[,;]\s*v\d+_chunk_\d+)*\s*[\])]", re.I),
    re.compile(r"\bv\d+_chunk_\d+\b", re.I),
    re.compile(r"\bchunk[_ ]\d+\b", re.I),
]
_META_OPENERS = re.compile(
    r"^(?:based on|according to|from|as per|drawing on)\s+(?:the\s+)?(?:provided|retrieved|given|above)?\s*"
    r"(?:context|passages?|sources?|information|knowledge graph|excerpts?)\s*(?:provided|given|above)?\s*[,:]\s*",
    re.I,
)


def to_display_text(reply: str) -> str:
    """Plain, readable text for the chat bubble, with no internal identifiers."""
    t = (reply or "").replace("\r\n", "\n")
    for pat in _LEAKS:
        t = pat.sub("", t)
    t = re.sub(r"\[([^\]]+)\]\((?:https?://)[^)]+\)", r"\1", t)          # [text](url) -> text
    # Line-start patterns use [ \t], not \s: \s matches newlines and would merge paragraphs.
    t = re.sub(r"^[ \t]{0,3}#{1,6}[ \t]*", "", t, flags=re.M)               # headings
    t = re.sub(r"^[ \t]*(?:[-*+•])[ \t]+", "• ", t, flags=re.M)             # bullets
    t = re.sub(r"(\*\*|__)(.+?)\1", r"\2", t)                               # bold
    t = re.sub(r"(?<![\w*])\*(?!\s)([^*\n]+?)(?<!\s)\*(?![\w*])", r"\1", t)  # italic *x*
    t = re.sub(r"`([^`]+)`", r"\1", t)                                      # inline code
    t = re.sub(r"^[ \t]*(?:-{3,}|\*{3,}|_{3,})[ \t]*$", "", t, flags=re.M)  # horizontal rules
    t = re.sub(r"[ \t]*(?:\(\s*\)|\[\s*\])", "", t)                         # brackets emptied above
    t = _META_OPENERS.sub("", t.lstrip())
    t = t[:1].upper() + t[1:] if t else t
    t = re.sub(r"[ \t]+\n", "\n", t)
    t = re.sub(r"[ \t]{2,}", " ", t)
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()


# ── Which sources to show ─────────────────────────────────────────────────────

_NOT_COVERED = re.compile(
    r"(?:do|does|did)\s+not\s+(?:directly\s+)?(?:address|cover|discuss|mention)|"
    r"(?:no|not\s+any)\s+(?:direct\s+)?(?:reference|mention)|outside\s+(?:the\s+)?scope",
    re.I,
)


def _cited(reply: str, ref: dict) -> bool:
    """Does the reply cite this source - same work, volume and first page?"""
    work = re.escape(ref.get("work") or SERIES)
    first = ref.get("first_page")
    if not first:
        return False
    return bool(re.search(rf"{work}\s*,\s*Vol\.?\s*{ref['volume']}\s*,\s*pp?\.\s*{first}\b", reply, re.I))


def sources_to_show(reply: str, sources: list) -> list:
    """Source pills a reader should see for this reply.

    A pill tells the reader "this answer came from here", so it must not appear beside an answer
    that says the writings do not cover the question (an off-topic question still retrieves
    loosely related pages). When the reply cites specific pages, only those are shown. Otherwise
    every retrieved source is shown, as before.
    """
    cited = [s for s in sources if s.get("_ref") and _cited(reply, s["_ref"])]
    if cited:
        return cited
    if _NOT_COVERED.search(reply or ""):
        return []
    return sources
