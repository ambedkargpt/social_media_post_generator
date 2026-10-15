from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId

from backend.db.mongo import db


_DEV_USERS: dict[str, dict] = {}


def _init_dev_users() -> None:
    if _DEV_USERS:
        return
    from backend.services.security import hash_password
    pwd = hash_password("password123")
    now = datetime.now(timezone.utc)
    accounts = [
        {
            "_id": ObjectId("660000000000000000000001"),
            "username": "test_congress",
            "email": "test.cong@ambedkargpt.test",
            "password_hash": pwd,
            "political_party": "Congress",
            "party_position": "National Spokesperson",
            "state": "Delhi",
            "city": "New Delhi",
            "auth_providers": ["password"],
            "is_email_verified": True,
            "is_phone_verified": True,
            "is_active": True,
            "is_test_account": True,
            "created_at": now,
            "updated_at": now,
        },
        {
            "_id": ObjectId("660000000000000000000002"),
            "username": "test_sp",
            "email": "test.sp@ambedkargpt.test",
            "password_hash": pwd,
            "political_party": "Samajwadi",
            "party_position": "State Spokesperson",
            "state": "Uttar Pradesh",
            "city": "Lucknow",
            "auth_providers": ["password"],
            "is_email_verified": True,
            "is_phone_verified": True,
            "is_active": True,
            "is_test_account": True,
            "created_at": now,
            "updated_at": now,
        },
        {
            "_id": ObjectId("660000000000000000000003"),
            "username": "test_ind",
            "email": "test.ind@ambedkargpt.test",
            "password_hash": pwd,
            "political_party": "Independent",
            "party_position": "Citizen / Scholar",
            "state": "Maharashtra",
            "city": "Mumbai",
            "auth_providers": ["password"],
            "is_email_verified": True,
            "is_phone_verified": True,
            "is_active": True,
            "is_test_account": True,
            "created_at": now,
            "updated_at": now,
        },
    ]
    for acc in accounts:
        _DEV_USERS[str(acc["_id"])] = acc
        _DEV_USERS[acc["email"]] = acc
        _DEV_USERS[acc["username"]] = acc


_init_dev_users()


class UsersRepository:
    def __init__(self) -> None:
        self.collection = db["users"]

    def create_user(
        self,
        username: str,
        password_hash: Optional[str],
        email: Optional[str],
        phone: Optional[str],
        political_party: Optional[str],
        auth_providers: list[str],
        party_position: str = "",
        is_email_verified: bool = False,
        is_phone_verified: bool = False,
        state: Optional[str] = None,
        city: Optional[str] = None,
        date_of_birth: Optional[str] = None,
    ) -> dict:
        now = datetime.now(timezone.utc)
        doc = {
            "username": username,
            "password_hash": password_hash,
            "email": email,
            "phone": phone,
            "political_party": political_party,
            "party_position": party_position or "",
            "state": state,
            "city": city,
            "date_of_birth": date_of_birth,
            "auth_providers": auth_providers,
            "is_email_verified": is_email_verified,
            "is_phone_verified": is_phone_verified,
            "is_active": True,
            "last_login_at": None,
            "created_at": now,
            "updated_at": now,
        }
        try:
            result = self.collection.insert_one(doc)
            doc["_id"] = result.inserted_id
        except Exception:
            oid = ObjectId()
            doc["_id"] = oid
            _DEV_USERS[str(oid)] = doc
            if email:
                _DEV_USERS[email] = doc
            if phone:
                _DEV_USERS[phone] = doc
            _DEV_USERS[username] = doc
        return doc

    def find_by_username(self, username: str) -> Optional[dict]:
        try:
            return self.collection.find_one({"username": username})
        except Exception:
            return _DEV_USERS.get(username)

    def find_by_email(self, email: str) -> Optional[dict]:
        try:
            return self.collection.find_one({"email": email})
        except Exception:
            return _DEV_USERS.get(email)

    def find_by_phone(self, phone: str) -> Optional[dict]:
        try:
            return self.collection.find_one({"phone": phone})
        except Exception:
            return _DEV_USERS.get(phone)

    def find_by_identifier(self, identifier: str) -> Optional[dict]:
        try:
            return self.collection.find_one(
                {"$or": [{"username": identifier}, {"email": identifier}, {"phone": identifier}]}
            )
        except Exception:
            if identifier in _DEV_USERS:
                return _DEV_USERS[identifier]
            for u in _DEV_USERS.values():
                if u.get("email") == identifier or u.get("username") == identifier or u.get("phone") == identifier:
                    return u
            return None

    def find_by_id(self, user_id: str) -> Optional[dict]:
        try:
            return self.collection.find_one({"_id": ObjectId(user_id)})
        except Exception:
            return _DEV_USERS.get(str(user_id))

    def verify_channel(self, user_id: ObjectId, channel: str) -> None:
        update = {"updated_at": datetime.now(timezone.utc)}
        if channel == "email":
            update["is_email_verified"] = True
        if channel == "phone":
            update["is_phone_verified"] = True
        try:
            self.collection.update_one({"_id": user_id}, {"$set": update})
        except Exception:
            if str(user_id) in _DEV_USERS:
                _DEV_USERS[str(user_id)].update(update)

    def update_last_login(self, user_id: ObjectId) -> None:
        try:
            self.collection.update_one(
                {"_id": user_id},
                {"$set": {"last_login_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}},
            )
        except Exception:
            pass

    def update_profile(self, user_id: ObjectId, fields: dict) -> Optional[dict]:
        fields["updated_at"] = datetime.now(timezone.utc)
        self.collection.update_one({"_id": user_id}, {"$set": fields})
        return self.find_by_id(str(user_id))

    def upsert_google_user(self, email: str, username_seed: str, political_party: Optional[str] = None) -> dict:
        existing = self.find_by_email(email)
        now = datetime.now(timezone.utc)
        if existing:
            providers = set(existing.get("auth_providers", []))
            providers.add("google")
            self.collection.update_one(
                {"_id": existing["_id"]},
                {"$set": {"auth_providers": sorted(providers), "is_email_verified": True, "updated_at": now}},
            )
            existing["auth_providers"] = sorted(providers)
            existing["is_email_verified"] = True
            return existing

        base_username = username_seed.lower().replace(" ", "")[:20] or "google_user"
        username = base_username
        i = 1
        while self.find_by_username(username):
            i += 1
            username = f"{base_username}{i}"
        return self.create_user(
            username=username,
            password_hash=None,
            email=email,
            phone=None,
            political_party=political_party,
            auth_providers=["google"],
            is_email_verified=True,
            is_phone_verified=False,
        )
