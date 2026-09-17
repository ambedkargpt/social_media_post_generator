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


class PendingSetsResponse(BaseModel):
    """Which question sets this user has a set for and has answered none of."""

    party: bool = False
    position: bool = False


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
    # Position and party questions only, absent on profile questions. Which
    # party the question belongs to, which position group (position questions
    # only), its place in that set, and its Hindi. options_hi runs parallel to
    # options: the English option is what gets saved, the Hindi at the same
    # index is what gets shown.
    party: Optional[str] = None
    position_group: Optional[str] = None
    display_order: Optional[int] = None
    question_text_hi: Optional[str] = None
    options_hi: list[str] = Field(default_factory=list)
    # Separate from is_required, which the batch save enforces across every
    # active question at once and so cannot be used for a question only half
    # the users are ever shown. This one only marks the question in the UI.
    is_compulsory: bool = False
    # Party questions only. The option to show selected before the user has
    # chosen one, and the same option the prompt falls back to, so the screen
    # and the generated post never disagree.
    default_option: Optional[str] = None
