"""
Retire superseded news from the feed without deleting it.

The picker should show current stories. Everything older stays in MongoDB,
because the knowledge graph is built from it and a later story that refers back
to one has to be able to reach it. So this sets a flag, and only the feed
listing honours it: anything reading by id still finds the document.

    # see what would change, nothing is written
    python -m backend.scripts.hide_stale_news --before 2026-08-28 --tenant congress --tenant samajwadi

    # do it
    python -m backend.scripts.hide_stale_news --before 2026-08-28 --tenant congress --tenant samajwadi --apply

    # put them back
    python -m backend.scripts.hide_stale_news --before 2026-08-28 --tenant congress --unhide --apply
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone

from backend.db.mongo import db

FLAG = "hidden_from_ui"


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--before", required=True, help="Hide items published before this date (YYYY-MM-DD).")
    ap.add_argument("--tenant", action="append", default=[], help="Tenant slug; repeatable. Omit for all tenants.")
    ap.add_argument("--unhide", action="store_true", help="Clear the flag instead of setting it.")
    ap.add_argument("--apply", action="store_true", help="Write. Without this the script only reports.")
    args = ap.parse_args()

    cutoff = datetime.strptime(args.before, "%Y-%m-%d").replace(tzinfo=timezone.utc)

    # published_at is the story's own date; created_at is when the row was
    # written. Ordering uses both for the same reason, so selection does too:
    # a bulk import gives every row the same created_at.
    date_clause = {
        "$or": [
            {"published_at": {"$lt": cutoff}},
            {"published_at": {"$exists": False}, "created_at": {"$lt": cutoff}},
        ]
    }
    query: dict = dict(date_clause)
    if args.tenant:
        query = {"$and": [date_clause, {"tenant_slug": {"$in": args.tenant}}]}

    coll = db["news"]
    matched = coll.count_documents(query)
    scope = ", ".join(args.tenant) if args.tenant else "all tenants"
    verb = "unhide" if args.unhide else "hide"

    print(f"cutoff   : {args.before}  ({verb} items published before this)")
    print(f"tenants  : {scope}")
    print(f"matched  : {matched} document(s)")

    if matched:
        print("\nnewest few that would be affected:")
        for d in coll.find(query).sort([("published_at", -1)]).limit(5):
            when = d.get("published_at") or d.get("created_at")
            print(f"  {str(when)[:19]}  [{d.get('tenant_slug') or '-'}]  {str(d.get('headline') or '')[:64]}")

    # What stays visible afterwards, which is the number worth checking before
    # writing: hiding everything would leave an empty feed.
    if args.tenant and not args.unhide:
        remaining = coll.count_documents(
            {"tenant_slug": {"$in": args.tenant}, FLAG: {"$ne": True}, **{"_id": {"$nin": [d["_id"] for d in coll.find(query, {"_id": 1})]}}}
        )
        print(f"\nwould remain visible for {scope}: {remaining}")

    if not args.apply:
        print("\n(dry run - nothing written. add --apply)")
        return

    update = {"$unset": {FLAG: ""}} if args.unhide else {"$set": {FLAG: True}}
    res = coll.update_many(query, update)
    print(f"\nmodified : {res.modified_count} document(s)")


if __name__ == "__main__":
    main()
