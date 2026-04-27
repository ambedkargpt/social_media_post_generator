from datetime import datetime, timezone
from typing import Any, Optional

from backend.db.mongo import db


class QuestionsRepository:
    def __init__(self) -> None:
        self.collection = db["questions"]

    def create(self, payload: dict[str, Any]) -> dict:
        now = datetime.now(timezone.utc)
        doc = {
            "question_id": payload["question_id"],
            "question_text": payload["question_text"],
            "category": payload.get("category"),
            "answer_type": payload["answer_type"],
            "options": payload.get("options", []),
            "is_required": bool(payload.get("is_required", False)),
            "is_active": payload.get("is_active", True),
            "version": payload.get("version", 1),
            "created_at": now,
            "updated_at": now,
        }
        result = self.collection.insert_one(doc)
        doc["_id"] = result.inserted_id
        return doc

    def list(self, limit: int = 100, skip: int = 0) -> list[dict]:
        return list(self.collection.find().sort("created_at", -1).skip(skip).limit(limit))

    def get_by_question_id(self, question_id: str) -> Optional[dict]:
        return self.collection.find_one({"question_id": question_id})

    def update(self, question_id: str, updates: dict[str, Any]) -> Optional[dict]:
        updates = {k: v for k, v in updates.items() if v is not None}
        if not updates:
            return self.get_by_question_id(question_id)
        updates["updated_at"] = datetime.now(timezone.utc)
        self.collection.update_one({"question_id": question_id}, {"$set": updates})
        return self.get_by_question_id(question_id)
