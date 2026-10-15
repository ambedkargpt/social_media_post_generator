from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId

from backend.db.mongo import db

_DEV_OTPS: list[dict] = []


class OtpRepository:
    def __init__(self) -> None:
        self.collection = db["otp_verifications"]

    def create_otp(
        self,
        user_id: Optional[ObjectId],
        channel: str,
        target: str,
        otp_hash: str,
        purpose: str,
        max_attempts: int,
        expires_at: datetime,
    ) -> dict:
        now = datetime.now(timezone.utc)
        doc = {
            "user_id": user_id,
            "channel": channel,
            "target": target,
            "otp_hash": otp_hash,
            "purpose": purpose,
            "attempt_count": 0,
            "max_attempts": max_attempts,
            "expires_at": expires_at,
            "consumed_at": None,
            "created_at": now,
        }
        try:
            result = self.collection.insert_one(doc)
            doc["_id"] = result.inserted_id
        except Exception:
            doc["_id"] = ObjectId()
            _DEV_OTPS.append(doc)
        return doc

    def get_active_otp(self, target: str, channel: str, purpose: str) -> Optional[dict]:
        now = datetime.now(timezone.utc)
        try:
            return self.collection.find_one(
                {
                    "target": target,
                    "channel": channel,
                    "purpose": purpose,
                    "consumed_at": None,
                    "expires_at": {"$gt": now},
                },
                sort=[("created_at", -1)],
            )
        except Exception:
            for o in reversed(_DEV_OTPS):
                if (
                    o.get("target") == target
                    and o.get("channel") == channel
                    and o.get("purpose") == purpose
                    and o.get("consumed_at") is None
                    and o.get("expires_at", now) > now
                ):
                    return o
            return None

    def increment_attempt(self, otp_id: ObjectId) -> None:
        try:
            self.collection.update_one({"_id": otp_id}, {"$inc": {"attempt_count": 1}})
        except Exception:
            for o in _DEV_OTPS:
                if o.get("_id") == otp_id:
                    o["attempt_count"] = o.get("attempt_count", 0) + 1

    def consume(self, otp_id: ObjectId) -> None:
        try:
            self.collection.update_one({"_id": otp_id}, {"$set": {"consumed_at": datetime.now(timezone.utc)}})
        except Exception:
            for o in _DEV_OTPS:
                if o.get("_id") == otp_id:
                    o["consumed_at"] = datetime.now(timezone.utc)

    def delete_for_target(self, target: str, channel: str, purpose: str) -> None:
        try:
            self.collection.delete_many({"target": target, "channel": channel, "purpose": purpose, "consumed_at": None})
        except Exception:
            global _DEV_OTPS
            _DEV_OTPS = [
                o for o in _DEV_OTPS
                if not (
                    o.get("target") == target
                    and o.get("channel") == channel
                    and o.get("purpose") == purpose
                    and o.get("consumed_at") is None
                )
            ]

