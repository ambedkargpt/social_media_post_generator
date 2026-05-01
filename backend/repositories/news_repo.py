from datetime import datetime, timezone
from typing import Any, Optional

from bson import ObjectId

from backend.db.mongo import db


class NewsRepository:
    def __init__(self) -> None:
        self.collection = db["news"]

    def create(self, payload: dict[str, Any]) -> dict:
        now = datetime.now(timezone.utc)
        doc = {
            "news_id": payload.get("news_id"),
            "headline": payload["headline"],
            "description": payload["description"],
            "summary": payload.get("summary"),
            "source_name": payload.get("source_name"),
            "source_url": payload.get("source_url"),
            "published_at": payload.get("published_at"),
            "language": payload.get("language"),
            "tags": payload.get("tags", []),
            "embedding_ref": payload.get("embedding_ref"),
            "legacy_source": payload.get("legacy_source"),
            "original_sort_timestamp": payload.get("original_sort_timestamp"),
            "created_at": now,
            "updated_at": now,
        }
        doc = {k: v for k, v in doc.items() if v is not None}
        result = self.collection.insert_one(doc)
        doc["_id"] = result.inserted_id
        return doc

    def list(self, limit: int = 100, skip: int = 0) -> list[dict]:
        return list(self.collection.find().sort("created_at", -1).skip(skip).limit(limit))

    def get_by_id(self, news_id: str) -> Optional[dict]:
        return self.collection.find_one({"_id": ObjectId(news_id)})

    def get_by_custom_news_id(self, news_id: str) -> Optional[dict]:
        return self.collection.find_one({"news_id": news_id})

    def get_by_source_url(self, source_url: str) -> Optional[dict]:
        return self.collection.find_one({"source_url": source_url})

    def get_latest_news_id(self) -> str | None:
        latest = self.collection.find_one(
            {"news_id": {"$regex": r"^news_\d+$"}},
            {"news_id": 1},
            sort=[("news_id", -1)],
        )
        return latest.get("news_id") if latest else None

    def update(self, news_id: str, updates: dict[str, Any]) -> Optional[dict]:
        updates = {k: v for k, v in updates.items() if v is not None}
        if not updates:
            return self.get_by_id(news_id)
        updates["updated_at"] = datetime.now(timezone.utc)
        self.collection.update_one({"_id": ObjectId(news_id)}, {"$set": updates})
        return self.get_by_id(news_id)

    def upsert_by_source_url(self, source_url: str, doc: dict[str, Any]) -> tuple[dict, bool]:
        now = datetime.now(timezone.utc)
        payload = {
            "news_id": doc["news_id"],
            "headline": doc["headline"],
            "description": doc["description"],
            "summary": doc.get("summary"),
            "source_name": doc.get("source_name"),
            "source_url": source_url,
            "published_at": doc.get("published_at"),
            "language": doc.get("language"),
            "tags": doc.get("tags", []),
            "embedding_ref": doc.get("embedding_ref"),
            "legacy_source": doc.get("legacy_source"),
            "original_sort_timestamp": doc.get("original_sort_timestamp"),
            "updated_at": now,
        }
        payload = {k: v for k, v in payload.items() if v is not None}
        result = self.collection.update_one(
            {"source_url": source_url},
            {"$set": payload, "$setOnInsert": {"created_at": now}},
            upsert=True,
        )
        saved = self.get_by_source_url(source_url)
        return saved, bool(result.upserted_id)
