from fastapi import HTTPException, status

from backend.repositories.profile_answers_repo import ProfileAnswersRepository
from backend.repositories.questions_repo import QuestionsRepository
from backend.schemas.profile import ProfileAnswerResponse


class ProfileService:
    def __init__(self) -> None:
        self.repo = ProfileAnswersRepository()
        self.questions_repo = QuestionsRepository()

    def upsert_answer(self, user_id: str, question_id: str, answer, source: str) -> ProfileAnswerResponse:
        if not self.questions_repo.get_by_question_id(question_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found.")
        doc = self.repo.upsert_answer(user_id=user_id, question_id=question_id, answer=answer, source=source)
        return self._to_response(doc)

    def list_answers(self, user_id: str, limit: int = 200, skip: int = 0) -> list[ProfileAnswerResponse]:
        return [self._to_response(doc) for doc in self.repo.list_by_user(user_id, limit=limit, skip=skip)]

    def get_answer(self, user_id: str, question_id: str) -> ProfileAnswerResponse:
        doc = self.repo.get_by_user_and_question(user_id, question_id)
        if not doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Answer not found.")
        return self._to_response(doc)

    def _to_response(self, doc: dict) -> ProfileAnswerResponse:
        return ProfileAnswerResponse(
            id=str(doc["_id"]),
            user_id=str(doc["user_id"]),
            question_id=doc["question_id"],
            answer=doc["answer"],
            source=doc["source"],
            answered_at=doc["answered_at"],
            created_at=doc["created_at"],
            updated_at=doc["updated_at"],
        )
