from datetime import datetime, timezone
from typing import Any, Optional

from bson import ObjectId

from backend.db.mongo import db


class ProfileAnswersRepository:
    def __init__(self) -> None:
        self.collection = db["user_profile_answers"]

    def upsert_answer(self, user_id: str, question_id: str, answer: Any, source: str) -> dict:
        now = datetime.now(timezone.utc)
        query = {"user_id": ObjectId(user_id), "question_id": question_id}
        update = {
            "$set": {
                "answer": answer,
                "source": source,
                "answered_at": now,
                "updated_at": now,
            },
            "$setOnInsert": {
                "user_id": ObjectId(user_id),
                "question_id": question_id,
                "created_at": now,
            },
        }
        self.collection.update_one(query, update, upsert=True)
        return self.collection.find_one(query)

    def list_by_user(self, user_id: str, limit: int = 200, skip: int = 0) -> list[dict]:
        return list(self.collection.find({"user_id": ObjectId(user_id)}).sort("updated_at", -1).skip(skip).limit(limit))

    def get_by_user_and_question(self, user_id: str, question_id: str) -> Optional[dict]:
        return self.collection.find_one({"user_id": ObjectId(user_id), "question_id": question_id})
