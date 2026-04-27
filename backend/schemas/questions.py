from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


AnswerType = Literal["text", "single_select", "multi_select", "number", "boolean"]


class QuestionCreateRequest(BaseModel):
    question_id: str = Field(min_length=2, max_length=100)
    question_text: str = Field(min_length=3)
    category: Optional[str] = None
    answer_type: AnswerType
    options: list[str] = Field(default_factory=list)
    is_required: bool = False
    is_active: bool = True
    version: int = 1


class QuestionUpdateRequest(BaseModel):
    question_text: Optional[str] = Field(default=None, min_length=3)
    category: Optional[str] = None
    answer_type: Optional[AnswerType] = None
    options: Optional[list[str]] = None
    is_required: Optional[bool] = None
    is_active: Optional[bool] = None
    version: Optional[int] = None


class QuestionResponse(BaseModel):
    id: str
    question_id: str
    question_text: str
    category: Optional[str]
    answer_type: AnswerType
    options: list[str]
    is_required: bool
    is_active: bool
    version: int
    created_at: datetime
    updated_at: datetime
