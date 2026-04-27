from fastapi import HTTPException, status

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
        return [self._to_response(doc) for doc in self.repo.list(limit=limit, skip=skip)]

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
        )
