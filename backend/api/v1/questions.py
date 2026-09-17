from fastapi import APIRouter, Depends, Query

from backend.core.dependencies import get_current_user_id
from backend.schemas.questions import (
    PendingSetsResponse,
    QuestionCreateRequest,
    QuestionResponse,
    QuestionUpdateRequest,
)
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


# Declared before /{question_id}. Routes match in order, so after it this path
# would be read as a request for a question whose id is "position".
@router.get("/position", response_model=list[QuestionResponse])
def list_position_questions(
    party: str = Query(..., description="Party name as stored on the user."),
    group: str = Query(..., description="Position group, e.g. District or Frontal wing."),
) -> list[QuestionResponse]:
    return service.list_position(party_name=party, group=group)


# Declared before /{question_id} for the same reason /position is.
@router.get("/party", response_model=list[QuestionResponse])
def list_party_questions(
    party: str = Query(..., description="Party name as stored on the user."),
) -> list[QuestionResponse]:
    return service.list_party(party_name=party)


# Declared before /{question_id} for the same reason /position is.
@router.get("/pending", response_model=PendingSetsResponse)
def pending_question_sets(user_id: str = Depends(get_current_user_id)) -> PendingSetsResponse:
    return service.pending_sets(user_id)


@router.get("/{question_id}", response_model=QuestionResponse)
def get_question(question_id: str) -> QuestionResponse:
    return service.get(question_id)


@router.patch("/{question_id}", response_model=QuestionResponse)
def update_question(
    question_id: str, payload: QuestionUpdateRequest, _: str = Depends(get_current_user_id)
) -> QuestionResponse:
    return service.update(question_id, payload)
