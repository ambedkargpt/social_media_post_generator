# Postponed annotations are load-bearing here, not style. The class defines a
# method called `list`, so any later `-> list[dict]` would otherwise resolve to
# that method at class-creation time and raise, which takes the whole API down
# on import. py_compile does not catch it: it is a runtime error, not syntax.
from __future__ import annotations

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

    def list(self, limit: int = 100, skip: int = 0, exclude_category: Optional[str] = None) -> list[dict]:
        # The exclusion is applied in the query, not after it, so a limit still
        # means that many rows of what the caller asked for.
        query: dict[str, Any] = {"category": {"$ne": exclude_category}} if exclude_category else {}
        return list(self.collection.find(query).sort("created_at", -1).skip(skip).limit(limit))

    def list_position(self, party: str, group: str, category: str) -> list[dict]:
        """One party's active questions for one position group, in set order."""
        return list(
            self.collection.find(
                {"category": category, "party": party, "position_group": group, "is_active": True}
            ).sort("display_order", 1)
        )

    def list_by_ids(self, question_ids: list[str]) -> list[dict]:
        if not question_ids:
            return []
        return list(self.collection.find({"question_id": {"$in": list(question_ids)}}))

    def get_by_question_id(self, question_id: str) -> Optional[dict]:
        return self.collection.find_one({"question_id": question_id})

    def update(self, question_id: str, updates: dict[str, Any]) -> Optional[dict]:
        updates = {k: v for k, v in updates.items() if v is not None}
        if not updates:
            return self.get_by_question_id(question_id)
        updates["updated_at"] = datetime.now(timezone.utc)
        self.collection.update_one({"question_id": question_id}, {"$set": updates})
        return self.get_by_question_id(question_id)
