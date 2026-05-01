from datetime import datetime, timezone

from bson import ObjectId

from backend.db.mongo import db
from backend.services.security import hash_token


class SessionsRepository:
    def __init__(self) -> None:
        self.collection = db["sessions"]

    def create_session(
        self,
        user_id: ObjectId,
        access_token: str,
        refresh_token: str,
        access_expires_at: datetime,
        refresh_expires_at: datetime,
        device_info: dict | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> dict:
        now = datetime.now(timezone.utc)
        doc = {
            "user_id": user_id,
            "access_token": access_token,
            "refresh_token_hash": hash_token(refresh_token),
            "access_expires_at": access_expires_at,
            "refresh_expires_at": refresh_expires_at,
            "device_info": device_info or {},
            "ip_address": ip_address,
            "user_agent": user_agent,
            "is_revoked": False,
            "revoked_at": None,
            "created_at": now,
            "updated_at": now,
        }
        result = self.collection.insert_one(doc)
        doc["_id"] = result.inserted_id
        return doc

    def find_active_by_refresh(self, refresh_token: str) -> dict | None:
        now = datetime.now(timezone.utc)
        return self.collection.find_one(
            {
                "refresh_token_hash": hash_token(refresh_token),
                "is_revoked": False,
                "refresh_expires_at": {"$gt": now},
            }
        )

    def rotate_tokens(
        self,
        session_id: ObjectId,
        access_token: str,
        refresh_token: str,
        access_expires_at: datetime,
        refresh_expires_at: datetime,
    ) -> None:
        self.collection.update_one(
            {"_id": session_id},
            {
                "$set": {
                    "access_token": access_token,
                    "refresh_token_hash": hash_token(refresh_token),
                    "access_expires_at": access_expires_at,
                    "refresh_expires_at": refresh_expires_at,
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )

    def revoke_by_refresh(self, refresh_token: str) -> bool:
        result = self.collection.update_one(
            {"refresh_token_hash": hash_token(refresh_token), "is_revoked": False},
            {"$set": {"is_revoked": True, "revoked_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}},
        )
        return result.modified_count > 0
