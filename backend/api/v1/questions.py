from fastapi import APIRouter, Depends, Query

from backend.core.dependencies import get_current_user_id
from backend.schemas.questions import QuestionCreateRequest, QuestionResponse, QuestionUpdateRequest
from backend.services.questions_service import QuestionsService


router = APIRouter(prefix="/questions", tags=["questions"])
service = QuestionsService()


@router.post("/", response_model=QuestionResponse)
def create_question(payload: QuestionCreateRequest, _: str = Depends(get_current_user_id)) -> QuestionResponse:
    return service.create(payload)


@router.get("/", response_model=list[QuestionResponse])
def list_questions(
    limit: int = Query(default=100, ge=1, le=500),
    skip: int = Query(default=0, ge=0),
) -> list[QuestionResponse]:
    return service.list(limit=limit, skip=skip)


@router.get("/{question_id}", response_model=QuestionResponse)
def get_question(question_id: str) -> QuestionResponse:
    return service.get(question_id)


@router.patch("/{question_id}", response_model=QuestionResponse)
def update_question(
    question_id: str, payload: QuestionUpdateRequest, _: str = Depends(get_current_user_id)
) -> QuestionResponse:
    return service.update(question_id, payload)
