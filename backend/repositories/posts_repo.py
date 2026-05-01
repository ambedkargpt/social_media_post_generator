from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from bson import ObjectId

from backend.db.mongo import db


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
