"""
Put the party-specific post preference questions into MongoDB, and retire the
fine-tuning profile questions they replace.

Two changes, one script, because they are one decision: the preference set a
user is asked is now the seven core profile questions, the ten party questions,
and the five position questions for their office. The eighteen fine-tuning
profile questions are no longer asked.

Nothing is deleted. A retired profile question is marked is_active: False, so
answers already saved against it stay valid rows rather than dangling
references, and the values still back the generated post through the default
profile in backend/pipeline/profiles.py. Only ids beginning party_ are written;
the seven core profile questions are never touched.

    python -m backend.scripts.seed_party_questions            # report only
    python -m backend.scripts.seed_party_questions --apply    # write
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone

from backend.db.mongo import db
from backend.pipeline.party_questions import CATEGORY, seed_documents, validate, validate_facets

# The seven that stay. Mirrors CORE_QUESTION_IDS in
# frontend/src/utils/preferenceQuestions.js, which is what the generator's side
# panel and the Preferences page both read.
CORE_PROFILE_IDS = (
    "profile_user_role",
    "profile_tone",
    "profile_target_audience",
    "profile_primary_focus",
    "profile_ambedkarite_perspective",
    "profile_content_length",
    "profile_call_to_action",
)

# Backdated for the same reason seed_position_questions backdates: the listing
# onboarding and the generator's panel call sorts by created_at, newest first,
# and takes the first rows. Seeded with today's date these twenty would be the
# newest and push the core profile questions out of that window for any
# deployment still running the old code.
SEED_CREATED_AT = datetime(2026, 1, 1, tzinfo=timezone.utc)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--apply", action="store_true", help="Write. Without this the script only reports.")
    ap.add_argument(
        "--keep-fine-tuning",
        action="store_true",
        help="Seed the party questions but leave the fine-tuning profile questions active.",
    )
    args = ap.parse_args()

    problems = validate() + validate_facets()
    if problems:
        for p in problems:
            print("  X", p)
        raise SystemExit(f"refusing to seed: {len(problems)} authoring problem(s)")

    coll = db["questions"]
    docs = seed_documents()
    ids = [d["question_id"] for d in docs]
    assert all(i.startswith("party_") for i in ids), "seed produced an id outside party_"

    existing = {d["question_id"] for d in coll.find({"question_id": {"$in": ids}}, {"question_id": 1})}
    stale = list(
        coll.find(
            {"category": CATEGORY, "question_id": {"$nin": ids}, "is_active": True},
            {"question_id": 1},
        )
    )
    fine_tuning = (
        []
        if args.keep_fine_tuning
        else list(
            coll.find(
                {
                    "category": "profile",
                    "question_id": {"$nin": list(CORE_PROFILE_IDS)},
                    "is_active": True,
                },
                {"question_id": 1},
            )
        )
    )

    print(f"party questions : {len(docs)}  new={len(docs) - len(existing)}  existing={len(existing)}")
    print(f"stale party     : {len(stale)}")
    print(f"fine-tuning off : {len(fine_tuning)}")
    for row in fine_tuning:
        print("   -", row["question_id"])

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
    retire = [r["_id"] for r in stale] + [r["_id"] for r in fine_tuning]
    if retire:
        coll.update_many({"_id": {"$in": retire}}, {"$set": {"is_active": False, "updated_at": now}})

    print(f"\nupserted {len(docs)} question(s), deactivated {len(retire)}.")


if __name__ == "__main__":
    main()
