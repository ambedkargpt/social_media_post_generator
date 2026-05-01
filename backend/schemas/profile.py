from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel


ProfileAnswerSource = Literal["onboarding", "profile_update", "survey"]


class ProfileAnswerUpsertRequest(BaseModel):
    user_id: str
    answer: Any
    source: ProfileAnswerSource = "profile_update"


class ProfileAnswersBatchUpsertRequest(BaseModel):
    user_id: str
    answers: dict[str, Any]
    source: ProfileAnswerSource = "profile_update"


class ProfileAnswerResponse(BaseModel):
    id: str
    user_id: str
    question_id: str
    answer: Any
    source: ProfileAnswerSource
    answered_at: datetime
    created_at: datetime
    updated_at: datetime
