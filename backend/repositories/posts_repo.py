from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from bson import ObjectId

from backend.db.mongo import db


def _today_midnight_utc() -> datetime:
    now = datetime.now(timezone.utc)
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


class PostsRepository:
    def __init__(self) -> None:
        self.collection = db["posts"]

    def create(self, payload: dict[str, Any]) -> dict:
        now = datetime.now(timezone.utc)
        doc = {
            "user_id": ObjectId(payload["user_id"]),
            "news_id": ObjectId(payload["news_id"]),
            "content": payload["content"],
            "hashtags": payload.get("hashtags", []),
            "status": payload.get("status", "draft"),
            "generation_meta": payload.get("generation_meta"),
            "created_at": now,
            "updated_at": now,
        }
        result = self.collection.insert_one(doc)
        doc["_id"] = result.inserted_id
        return doc

    def get_by_id(self, post_id: str) -> Optional[dict]:
        return self.collection.find_one({"_id": ObjectId(post_id)})

    def list_posts(
        self,
        user_id: str | None = None,
        news_id: str | None = None,
        status: str | None = None,
        limit: int = 100,
        skip: int = 0,
    ) -> list[dict]:
        query: dict[str, Any] = {}
        if user_id:
            query["user_id"] = ObjectId(user_id)
        if news_id:
            query["news_id"] = ObjectId(news_id)
        if status:
            query["status"] = status
        return list(self.collection.find(query).sort("created_at", -1).skip(skip).limit(limit))

    def update(self, post_id: str, updates: dict[str, Any]) -> Optional[dict]:
        updates = {k: v for k, v in updates.items() if v is not None}
        if not updates:
            return self.get_by_id(post_id)
        updates["updated_at"] = datetime.now(timezone.utc)
        self.collection.update_one({"_id": ObjectId(post_id)}, {"$set": updates})
        return self.get_by_id(post_id)

    def count_today(self, user_id: str) -> int:
        """Count posts created by user since midnight UTC today."""
        return self.collection.count_documents({
            "user_id": ObjectId(user_id),
            "created_at": {"$gte": _today_midnight_utc()},
        })

    def count_published_today(self, user_id: str) -> int:
        """Count posts published by user since midnight UTC today."""
        return self.collection.count_documents({
            "user_id": ObjectId(user_id),
            "status": "published",
            "published_at": {"$gte": _today_midnight_utc()},
        })

    def set_published_at(self, post_id: str) -> None:
        """Stamp published_at on the post (called exactly once when status → published)."""
        self.collection.update_one(
            {"_id": ObjectId(post_id), "published_at": {"$exists": False}},
            {"$set": {"published_at": datetime.now(timezone.utc)}},
        )

    def try_publish_atomic(self, post_id: str, user_id: str, daily_limit: int) -> bool:
        """Atomically publish a post only if the user hasn't hit the daily limit.
        Returns True if published, False if limit already reached.
        Uses a two-phase approach: stamp published_at only if count < limit.
        """
        midnight = _today_midnight_utc()
        now = datetime.now(timezone.utc)
        # Phase 1: stamp published_at atomically (idempotent — only if not already set)
        result = self.collection.find_one_and_update(
            {
                "_id": ObjectId(post_id),
                "user_id": ObjectId(user_id),
                "published_at": {"$exists": False},
            },
            {"$set": {"published_at": now, "updated_at": now}},
            return_document=True,
        )
        if not result:
            # Already published or not found — re-check current count
            return self.count_published_today(user_id) < daily_limit
        # Phase 2: check if this publish put us over the limit
        count = self.count_published_today(user_id)
        if count > daily_limit:
            # Rollback — unset published_at
            self.collection.update_one(
                {"_id": ObjectId(post_id)},
                {"$unset": {"published_at": ""}, "$set": {"updated_at": now}},
            )
            return False
        return True

    def count_all_time(self, user_id: str) -> int:
        """Total posts ever created by user (for milestone tracking)."""
        return self.collection.count_documents({"user_id": ObjectId(user_id)})

    def save_translation(self, post_id: str, language: str, content: str) -> None:
        """Store a translation under translations.{language} on the post document."""
        self.collection.update_one(
            {"_id": ObjectId(post_id)},
            {"$set": {f"translations.{language}": content, "updated_at": datetime.now(timezone.utc)}},
        )

    def archive(self, post_id: str) -> bool:
        result = self.collection.update_one(
            {"_id": ObjectId(post_id)},
            {"$set": {"status": "archived", "updated_at": datetime.now(timezone.utc)}},
        )
        return result.modified_count > 0

    def dashboard_list(self, user_id: str | None = None, limit: int = 50) -> list[dict]:
        query: dict[str, Any] = {}
        if user_id:
            query["user_id"] = ObjectId(user_id)
        return list(
            self.collection.find(
                query,
                {
                    "_id": 1,
                    "user_id": 1,
                    "news_id": 1,
                    "content": 1,
                    "hashtags": 1,
                    "status": 1,
                    "created_at": 1,
                },
            )
            .sort("created_at", -1)
            .limit(limit)
        )
