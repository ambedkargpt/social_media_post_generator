from fastapi import APIRouter, Depends, HTTPException, Query, status

from backend.core.dependencies import get_current_user_id
from backend.schemas.profile import ProfileAnswerResponse, ProfileAnswersBatchUpsertRequest, ProfileAnswerUpsertRequest
from backend.services.profile_service import ProfileService


router = APIRouter(prefix="/profile", tags=["profile"])
service = ProfileService()


@router.put("/answers/{question_id}", response_model=ProfileAnswerResponse)
def upsert_profile_answer(
    question_id: str, payload: ProfileAnswerUpsertRequest, current_user_id: str = Depends(get_current_user_id)
) -> ProfileAnswerResponse:
    if payload.user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot update another user's profile.")
    return service.upsert_answer(
        user_id=payload.user_id,
        question_id=question_id,
        answer=payload.answer,
        source=payload.source,
    )


@router.put("/answers", response_model=list[ProfileAnswerResponse])
def upsert_profile_answers_batch(
    payload: ProfileAnswersBatchUpsertRequest, current_user_id: str = Depends(get_current_user_id)
) -> list[ProfileAnswerResponse]:
    if payload.user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot update another user's profile.")
    return service.upsert_answers_batch(user_id=payload.user_id, answers=payload.answers, source=payload.source)


@router.get("/answers", response_model=list[ProfileAnswerResponse])
def list_profile_answers(
    user_id: str = Query(...),
    limit: int = Query(default=200, ge=1, le=500),
    skip: int = Query(default=0, ge=0),
    current_user_id: str = Depends(get_current_user_id),
) -> list[ProfileAnswerResponse]:
    if user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot list another user's profile answers.")
    return service.list_answers(user_id=user_id, limit=limit, skip=skip)


@router.get("/answers/{question_id}", response_model=ProfileAnswerResponse)
def get_profile_answer(
    question_id: str, user_id: str = Query(...), current_user_id: str = Depends(get_current_user_id)
) -> ProfileAnswerResponse:
    if user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot fetch another user's profile answer.")
    return service.get_answer(user_id=user_id, question_id=question_id)
