"""
Research recent stories ahead of time, so writing a post does not have to.

    python -m backend.scripts.research_recent_news            # report only
    python -m backend.scripts.research_recent_news --apply
    python -m backend.scripts.research_recent_news --apply --days 2 --limit 20

Research is the slow half of writing a post: three claims searched, eighteen
pages fetched and fact-checked, about twenty seconds. It is also the same work
for every post written from the same story - the claims come from the story and
its transcript, not from the writer.

Doing it inline was what broke production. Generation went from fifteen seconds
to forty; the HTTP API in front of the Lambda gives up at thirty, so the browser
was handed a 503 while the Lambda went on to finish the post and log a 200.
Thirty seconds is a hard ceiling on HTTP APIs and cannot be raised.

So it moves off the request path entirely. This runs where there is no timeout -
the same machine that scrapes - and stores the brief on the news document.
`PostsService._research_for_article` finds it there and skips straight past the
searching, which makes research free at generation time rather than impossible.

Safe to re-run: a story that already has a brief is skipped unless --refresh.
"""
from __future__ import annotations

import argparse
import logging
import sys
import time
from datetime import UTC, datetime, timedelta

logging.basicConfig(level=logging.INFO, format="%(message)s")
log = logging.getLogger("research")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--apply", action="store_true", help="Write. Without this the script only reports.")
    ap.add_argument("--days", type=int, default=2, help="How far back to look (default 2).")
    ap.add_argument("--limit", type=int, default=25, help="Most stories to research in one run (default 25).")
    ap.add_argument("--refresh", action="store_true", help="Redo stories that already have a brief.")
    args = ap.parse_args(argv)

    from bson import ObjectId

    import os

    # This script is the thing that is allowed to search. The request path is
    # not, because twenty seconds does not fit inside the gateway's thirty.
    os.environ["WEB_RESEARCH_PRECOMPUTED_ONLY"] = "0"

    from backend.config import get_settings
    from backend.db.mongo import db

    settings = get_settings()
    if not settings.web_research_enabled:
        # The flag is off in production for the timeout reason above, but this
        # runs off the request path and is exactly what makes turning it back
        # on possible. Say so rather than exiting.
        log.warning("WEB_RESEARCH_ENABLED is not set here; set it for this script to do anything.")
        return 2

    since = ObjectId.from_datetime(datetime.now(UTC) - timedelta(days=args.days))
    query: dict = {"_id": {"$gt": since}}
    if not args.refresh:
        query["research"] = {"$exists": False}
    stories = list(db["news"].find(query).sort("_id", -1).limit(args.limit))

    log.info("stories from the last %d day(s) %s a brief: %d",
             args.days, "needing" if not args.refresh else "to redo", len(stories))
    if not stories:
        return 0
    if not args.apply:
        for s in stories[:10]:
            log.info("   %s  %s", s["_id"], (s.get("headline") or "")[:70])
        log.info("\ndry run: nothing written. Re-run with --apply.")
        return 0

    from backend.services.posts_service import PostsService

    service = PostsService()
    done = skipped = failed = 0
    for story in stories:
        headline = (story.get("headline") or "")[:60]
        started = time.time()
        try:
            article = service._news_doc_to_article(story)
            tenant = article.get("tenant_slug") or "general"
            embedder, store, context_by_title = service._rag_stack(tenant)
            query_text = article.get("headline") or article.get("summary") or ""
            chunks = service._retrieve_chunks(query_text, embedder, store, tenant=tenant)

            # The stored brief would otherwise short-circuit the research this
            # script exists to run.
            article.pop("research", None)
            brief = service._research_for_article(article, chunks)
        except Exception as exc:  # noqa: BLE001 - one bad story must not stop the rest
            log.warning("  %-60s failed: %s", headline, exc)
            failed += 1
            continue

        if not brief:
            # No checkable claims is an ordinary outcome, not a failure. Marked
            # so the next run does not try again and spend the same minute.
            db["news"].update_one(
                {"_id": story["_id"]},
                {"$set": {"research": {"stance_mode": "angle", "claims": []},
                          "researched_at": datetime.now(UTC)}},
            )
            log.info("  %-60s no checkable claims (%.0fs)", headline, time.time() - started)
            skipped += 1
            continue

        db["news"].update_one(
            {"_id": story["_id"]},
            {"$set": {"research": brief.as_meta(), "researched_at": datetime.now(UTC)}},
        )
        log.info("  %-60s %d claim(s) (%.0fs)", headline, len(brief.findings), time.time() - started)
        done += 1

    log.info("\n%d researched, %d with nothing to check, %d failed", done, skipped, failed)
    return 1 if failed and not done else 0


if __name__ == "__main__":
    sys.exit(main())
