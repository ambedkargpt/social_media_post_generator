"""
clear_user_data.py — wipes all user accounts and their associated data.

Collections cleared:
  - users
  - sessions
  - otp_verifications
  - user_profile_answers
  - user_streaks
  - posts

Collections left untouched:
  - questions  (platform content, not user data)
  - news       (platform content, not user data)

Run from the project root:
  python -m backend.scripts.clear_user_data
"""

from backend.db.mongo import db


def main() -> None:
    targets = [
        "users",
        "sessions",
        "otp_verifications",
        "user_profile_answers",
        "user_streaks",
        "posts",
    ]

    print("This will permanently delete ALL documents in:")
    for name in targets:
        count = db[name].count_documents({})
        print(f"  {name:30s}  ({count} documents)")

    print()
    confirm = input("Type 'yes' to confirm: ").strip().lower()
    if confirm != "yes":
        print("Aborted.")
        return

    print()
    for name in targets:
        result = db[name].delete_many({})
        print(f"  Cleared {name:30s}  — {result.deleted_count} documents removed")

    print("\nDone. All user data has been wiped.")


if __name__ == "__main__":
    main()
