"""
Put the party and position preference questions into MongoDB.

Idempotent and additive. It upserts the documents built from
backend/pipeline/position_questions.py, and it never deletes: a position
question dropped from that file is marked inactive instead, so answers already
saved against it stay valid rows rather than dangling references.

Only ids beginning pos_ are ever written. Profile questions are not touched.

    python -m backend.scripts.seed_position_questions            # report only
    python -m backend.scripts.seed_position_questions --apply    # write
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone

from backend.db.mongo import db
from backend.pipeline.position_questions import CATEGORY, seed_documents, validate_parts
from backend.pipeline.position_questions import validate as validate_table


def validate() -> list[str]:
    """The question table and its part mapping, checked together before any write."""
    return validate_table() + validate_parts()

# Backdated on purpose. The listing that onboarding and the generator's panel
# call sorts by created_at, newest first, and takes the first 7 and 25 rows.
# Seeded with today's date, these seventy would be the newest rows and push the
# profile questions out of both windows for any deployment still running code
# that does not filter them out. Older than every profile question, they sort
# last, and the old code keeps working until the new code reaches it.
SEED_CREATED_AT = datetime(2026, 1, 1, tzinfo=timezone.utc)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--apply", action="store_true", help="Write. Without this the script only reports.")
    args = ap.parse_args()

    problems = validate()
    if problems:
        for p in problems:
            print("  X", p)
        raise SystemExit(f"refusing to seed: {len(problems)} authoring problem(s)")

    coll = db["questions"]
    docs = seed_documents()
    ids = [d["question_id"] for d in docs]
    assert all(i.startswith("pos_") for i in ids), "seed produced an id outside pos_"

    existing = {d["question_id"] for d in coll.find({"question_id": {"$in": ids}}, {"question_id": 1})}
    stale = list(
        coll.find(
            {"category": CATEGORY, "question_id": {"$nin": ids}, "is_active": True},
            {"question_id": 1},
        )
    )
    sets = sorted({(d["party"], d["position_group"]) for d in docs})

    print(f"question sets : {len(sets)}  ({', '.join(f'{p}/{g}' for p, g in sets)})")
    print(f"questions     : {len(docs)}  new={len(docs) - len(existing)}  existing={len(existing)}")
    print(f"to deactivate : {len(stale)}")

    if not args.apply:
        print("\ndry run: nothing written. Re-run with --apply.")
        return

    now = datetime.now(timezone.utc)
    for doc in docs:
        coll.update_one(
            {"question_id": doc["question_id"]},
            {"$set": {**doc, "updated_at": now}, "$setOnInsert": {"created_at": SEED_CREATED_AT}},
            upsert=True,
        )
    if stale:
        coll.update_many(
            {"_id": {"$in": [s["_id"] for s in stale]}},
            {"$set": {"is_active": False, "updated_at": now}},
        )

    print(f"\nupserted {len(docs)} question(s), deactivated {len(stale)}.")


if __name__ == "__main__":
    main()
