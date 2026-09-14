# Load-bearing, as in questions_repo: this class has a method named `list`, and
# the `-> list[QuestionResponse]` annotations after it would resolve to that
# method and raise on import without postponed evaluation.
from __future__ import annotations

from fastapi import HTTPException, status

from backend.pipeline.position_questions import CATEGORY as POSITION_CATEGORY
from backend.pipeline.position_questions import question_party
from backend.repositories.questions_repo import QuestionsRepository
from backend.schemas.questions import QuestionCreateRequest, QuestionResponse, QuestionUpdateRequest


class QuestionsService:
    def __init__(self) -> None:
        self.repo = QuestionsRepository()

    def create(self, payload: QuestionCreateRequest) -> QuestionResponse:
        if self.repo.get_by_question_id(payload.question_id):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="question_id already exists.")
        doc = self.repo.create(payload.model_dump())
        return self._to_response(doc)

    def list(self, limit: int = 100, skip: int = 0) -> list[QuestionResponse]:
        # Position questions are served by list_position, one party and group at
        # a time. Left in this listing they would reach every caller that asks
        # for "the questions": onboarding takes the first 7 and the generator's
        # panel the first 25, and both would start showing someone another
        # party's questions in place of their own profile.
        docs = self.repo.list(limit=limit, skip=skip, exclude_category=POSITION_CATEGORY)
        return [self._to_response(doc) for doc in docs]

    def list_position(self, party_name: str, group: str) -> list[QuestionResponse]:
        """
        The five questions for this party and position group, in order.

        Empty rather than an error for a party or group with no set, because
        that is an ordinary state: a Samajwadi user or a supporter with no party
        simply has no position questions yet.
        """
        party = question_party(party_name)
        group = (group or "").strip()
        if not party or not group:
            return []
        docs = self.repo.list_position(party, group, POSITION_CATEGORY)
        return [self._to_response(doc) for doc in docs]

    def get(self, question_id: str) -> QuestionResponse:
        doc = self.repo.get_by_question_id(question_id)
        if not doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found.")
        return self._to_response(doc)

    def update(self, question_id: str, payload: QuestionUpdateRequest) -> QuestionResponse:
        doc = self.repo.update(question_id, payload.model_dump(exclude_unset=True))
        if not doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found.")
        return self._to_response(doc)

    def _to_response(self, doc: dict) -> QuestionResponse:
        return QuestionResponse(
            id=str(doc["_id"]),
            question_id=doc["question_id"],
            question_text=doc["question_text"],
            category=doc.get("category"),
            answer_type=doc["answer_type"],
            options=doc.get("options", []),
            is_required=bool(doc.get("is_required", False)),
            is_active=bool(doc.get("is_active", True)),
            version=int(doc.get("version", 1)),
            created_at=doc["created_at"],
            updated_at=doc["updated_at"],
            party=doc.get("party"),
            position_group=doc.get("position_group"),
            display_order=doc.get("display_order"),
            question_text_hi=doc.get("question_text_hi"),
            options_hi=doc.get("options_hi") or [],
        )
