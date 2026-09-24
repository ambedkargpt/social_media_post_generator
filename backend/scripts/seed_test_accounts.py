"""
Three accounts the team can sign into for testing.

    python -m backend.scripts.seed_test_accounts --apply
    python -m backend.scripts.seed_test_accounts --remove --apply

Each is marked `is_test_account`, which lifts the four limits a real account
lives under: one post per story per day, the settings rule across days, the
single refinement per post, and the five-a-day publish cap. Posts they generate
are stamped `origin: "test"` so they sit outside the unique indexes that enforce
those rules, and outside the queries that check them.

The three are deliberately not clones. A Congress account has both a party and a
position question set behind it, Samajwadi has neither yet, and an unaffiliated
account has no party at all -- three different prompts, which is the point of
having three.

They are pre-verified, so signing in needs only the password: an account with no
verified channel is pushed into an OTP flow it has no inbox to complete. Their
answers are seeded too, so they land on the dashboard rather than the
questionnaire.

The password comes from TEST_ACCOUNT_PASSWORD in the environment and is never
stored in this file: these accounts have no limits and they authenticate against
the deployed database, so committing one would put a live production credential
into git history.

Idempotent: re-running updates the same three accounts in place and resets their
passwords to whatever TEST_ACCOUNT_PASSWORD currently holds.
"""
from __future__ import annotations

import argparse
import os
from datetime import datetime, timezone

from backend.db.mongo import db
from backend.pipeline.party_questions import defaults_for
from backend.pipeline.party_questions import question_party
from backend.pipeline.position_questions import group_for_position
from backend.pipeline.position_questions import question_ids_for as position_ids
from backend.services.security import hash_password


# Read from the environment, never written here. These accounts have no limits
# and they authenticate against the deployed database, so a password committed
# to the repository is a live production credential in version control -- one
# that outlives any later rotation, because git keeps it.
#
# Set TEST_ACCOUNT_PASSWORD in backend/.env, which is gitignored:
#
#     TEST_ACCOUNT_PASSWORD='...' python -m backend.scripts.seed_test_accounts --apply
#
# Pick something you are willing to share with the team but that a stranger
# would not guess. Re-running with a different value rotates all three.
PASSWORD_ENV_VAR = "TEST_ACCOUNT_PASSWORD"

ACCOUNTS = [
    {
        "username": "test_congress",
        "email": "test.cong@ambedkargpt.test",
        "full_name": "Test Congress",
        "political_party": "Indian National Congress (INC)",
        "party_position": "district_president",
        "state": "Uttar Pradesh",
        "city": "Lucknow",
    },
    {
        "username": "test_samajwadi",
        "email": "test.sp@ambedkargpt.test",
        "full_name": "Test Samajwadi",
        "political_party": "Samajwadi Party (SP)",
        "party_position": "state_president",
        "state": "Uttar Pradesh",
        "city": "Lucknow",
    },
    {
        "username": "test_independent",
        "email": "test.ind@ambedkargpt.test",
        "full_name": "Test Independent",
        "political_party": "None / Not Affiliated",
        "party_position": "",
        "state": "Delhi",
        "city": "New Delhi",
    },
]


def _answers_for(account: dict) -> dict[str, str]:
    """
    The party and position answers this account should start with.

    Read from the questions collection rather than rebuilt here, so a reseeded
    or reworded set stays in step and an option string is never invented. Empty
    for a party with no set, which is the case these accounts exist to cover.
    """
    party = question_party(account["political_party"])
    if not party:
        return {}

    answers = dict(defaults_for(party))

    ids = position_ids(party, group_for_position(account["party_position"]))
    if ids:
        for doc in db["questions"].find({"question_id": {"$in": ids}}):
            options = doc.get("options") or []
            chosen = doc.get("default_option") or (options[0] if options else "")
            if chosen:
                answers[str(doc["question_id"])] = chosen
    return answers


def _remove() -> None:
    emails = [a["email"] for a in ACCOUNTS]
    users = list(db["users"].find({"email": {"$in": emails}}, {"_id": 1, "email": 1}))
    if not users:
        print("no test accounts found.")
        return
    ids = [u["_id"] for u in users]
    posts = db["posts"].delete_many({"user_id": {"$in": ids}}).deleted_count
    db["sessions"].delete_many({"user_id": {"$in": ids}})
    db["user_profile_answers"].delete_many({"user_id": {"$in": ids}})
    db["streaks"].delete_many({"user_id": {"$in": ids}})
    db["users"].delete_many({"_id": {"$in": ids}})
    for u in users:
        print(f"  removed {u['email']}")
    print(f"\nremoved {len(users)} account(s) and {posts} post(s).")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="write to the database")
    parser.add_argument("--remove", action="store_true", help="delete the accounts and their posts")
    args = parser.parse_args()

    if args.remove:
        if not args.apply:
            print("dry run: would remove " + ", ".join(a["email"] for a in ACCOUNTS))
            print("re-run with --apply.")
            return
        _remove()
        return

    for account in ACCOUNTS:
        answers = _answers_for(account)
        party = question_party(account["political_party"]) or "-"
        print(f"{account['email']:34} party={party:4} answers={len(answers)}")

    if not args.apply:
        print("\ndry run: nothing written. Re-run with --apply.")
        return

    password = os.environ.get(PASSWORD_ENV_VAR, "").strip()
    if not password:
        print(
            f"\n{PASSWORD_ENV_VAR} is not set, so there is no password to seed.\n"
            f"Set it in backend/.env or inline:\n\n"
            f"    {PASSWORD_ENV_VAR}='...' python -m backend.scripts.seed_test_accounts --apply\n"
        )
        raise SystemExit(1)

    now = datetime.now(timezone.utc)
    password_hash = hash_password(password)

    for account in ACCOUNTS:
        db["users"].update_one(
            {"email": account["email"]},
            {
                "$set": {
                    **account,
                    "password_hash": password_hash,
                    "auth_providers": ["password"],
                    # Without a verified channel, login diverts into an OTP that
                    # nobody can read: these addresses are not real inboxes.
                    "is_email_verified": True,
                    "is_phone_verified": False,
                    "is_active": True,
                    "is_test_account": True,
                    "updated_at": now,
                },
                "$setOnInsert": {"created_at": now},
            },
            upsert=True,
        )
        user = db["users"].find_one({"email": account["email"]}, {"_id": 1})
        for question_id, answer in _answers_for(account).items():
            db["user_profile_answers"].update_one(
                {"user_id": user["_id"], "question_id": question_id},
                {
                    "$set": {
                        "answer": answer,
                        "source": "onboarding",
                        "answered_at": now,
                        "updated_at": now,
                    },
                    "$setOnInsert": {
                        "user_id": user["_id"],
                        "question_id": question_id,
                        "created_at": now,
                    },
                },
                upsert=True,
            )

    print(f"\nseeded {len(ACCOUNTS)} test account(s), all with the password in ${PASSWORD_ENV_VAR}.")
    for account in ACCOUNTS:
        print(f"  {account['email']:34} {account['political_party']}")


if __name__ == "__main__":
    main()
