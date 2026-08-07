"""
Translate already-published news items into Hindi, in place.

Published news must be Devanagari-only. Items generated before that rule was
introduced are still English or Hinglish. Re-extracting stories from source
transcripts to fix them costs minutes per video; translating the handful of
stored fields costs one short call per item, so this script repairs existing
rows directly instead.

Usage:
    python -m backend.scripts.hindify_news --dry-run
    python -m backend.scripts.hindify_news --tenant congress
"""

from __future__ import annotations

import argparse
import json

from backend.config import get_settings
from backend.pipeline.multi_news_generator import latin_ratio
from backend.pipeline.video_summarizer import deepseek_chat_client
from backend.repositories.news_repo import NewsRepository
from backend.tenants import get_tenant

_SYSTEM = (
    "You are a Hindi news editor. You rewrite news text into natural, grammatically "
    "correct Hindi in Devanagari script. You never add or drop facts."
)

_USER = """Rewrite the following news item entirely in Hindi using Devanagari script.

Rules:
- No Latin letters anywhere in the output.
- Transliterate names, places, parties and initialisms into Devanagari:
  Amit Shah -> अमित शाह, Rahul Gandhi -> राहुल गांधी, BJP -> भाजपा,
  Congress -> कांग्रेस, MSME -> एमएसएमई, NHAI -> एनएचएआई, Parliament -> संसद.
- Prefer a natural Hindi word over a transliterated English one where one exists
  (corporate houses -> कॉरपोरेट घराने, courage -> साहस, police -> पुलिस).
- Keep every fact, number, date and name. Do not add anything new.
- "headline" takes NO trailing danda. "description" and "summary" are full
  sentences and end with a danda (।).
- Keep roughly the same length as the input.

Return ONLY this JSON object:
{"headline": "...", "description": "...", "summary": "...", "topic": "..."}

headline: {headline}
description: {description}
summary: {summary}
topic: {topic}
"""


def _fill(tpl: str, repl: dict[str, str]) -> str:
    out = tpl
    for k, v in repl.items():
        out = out.replace("{" + k + "}", v)
    return out


def _strip_json(raw: str) -> str:
    t = (raw or "").strip()
    if t.startswith("```"):
        t = t.split("\n", 1)[-1]
        if t.rstrip().endswith("```"):
            t = t.rstrip()[:-3]
    t = t.strip()
    if not t.startswith("{"):
        s, e = t.find("{"), t.rfind("}")
        if s != -1 and e > s:
            t = t[s : e + 1]
    return t


def needs_hindi(doc: dict, threshold: float) -> bool:
    blob = " ".join(
        str(doc.get(k, "")) for k in ("headline", "description", "summary")
    )
    return latin_ratio(blob) > threshold


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--tenant", default=None, help="Limit to one tenant (id or slug).")
    ap.add_argument("--threshold", type=float, default=0.10,
                    help="Latin-letter share above which an item is rewritten.")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args(argv)

    repo = NewsRepository()
    query: dict = {}
    if args.tenant:
        t = get_tenant(args.tenant)
        if not t:
            print(f"Unknown tenant: {args.tenant}")
            return 1
        query["tenant_id"] = t.tenant_id

    docs = [d for d in repo.collection.find(query) if needs_hindi(d, args.threshold)]
    print(f"Items needing Hindi rewrite: {len(docs)}")
    if not docs:
        return 0
    if args.dry_run:
        for d in docs[:15]:
            print("  -", str(d.get("headline"))[:80])
        return 0

    settings = get_settings()
    client = deepseek_chat_client(settings)
    model = settings.deepseek_summary_model

    fixed = failed = 0
    for i, d in enumerate(docs, 1):
        msg = _fill(_USER, {
            "headline": str(d.get("headline", "")),
            "description": str(d.get("description", "")),
            "summary": str(d.get("summary", "")),
            "topic": ", ".join(d.get("tags") or []),
        })
        try:
            resp = client.chat.completions.create(
                model=model,
                messages=[{"role": "system", "content": _SYSTEM},
                          {"role": "user", "content": msg}],
                temperature=0.2,
            )
            out = json.loads(_strip_json(resp.choices[0].message.content or ""))
            headline = str(out.get("headline", "")).strip()
            description = str(out.get("description", "")).strip()
            summary = str(out.get("summary", "")).strip()
            if not headline or latin_ratio(headline) > 0.25:
                raise ValueError("rewrite still contains Latin text")
            update = {"headline": headline}
            if description:
                update["description"] = description
            if summary:
                update["summary"] = summary
            topic = str(out.get("topic", "")).strip()
            if topic and latin_ratio(topic) <= 0.25:
                update["tags"] = [topic.lower()]
            repo.collection.update_one({"_id": d["_id"]}, {"$set": update})
            fixed += 1
        except Exception as exc:  # noqa: BLE001 - one bad row must not stop the batch
            failed += 1
            print(f"  [{i}/{len(docs)}] failed: {exc}")
        if i % 5 == 0 or i == len(docs):
            print(f"  {i}/{len(docs)} processed (fixed={fixed}, failed={failed})")

    print(f"Done. rewritten={fixed} failed={failed}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
