from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, model_validator


PostStatus = Literal["draft", "published", "archived"]


class PostCreateRequest(BaseModel):
    user_id: str
    news_id: str
    content: str = Field(min_length=3)
    hashtags: list[str] = Field(default_factory=list)
    status: PostStatus = "draft"
    generation_meta: Optional[dict[str, Any]] = None


class PostUpdateRequest(BaseModel):
    content: Optional[str] = Field(default=None, min_length=3)
    hashtags: Optional[list[str]] = None
    status: Optional[PostStatus] = None
    generation_meta: Optional[dict[str, Any]] = None


class PostResponse(BaseModel):
    id: str
    user_id: str
    news_id: str
    content: str
    hashtags: list[str]
    status: PostStatus
    generation_meta: Optional[dict[str, Any]]
    translations: dict[str, str] = {}
    published_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class RetrievedChunkReference(BaseModel):
    chunk_id: str
    video_title: str
    video_link: str
    chunk_text: str
    similarity_score: float = 0.0
    relevance_score: Optional[float] = None
    argument_score: float = 0.0
    final_score: float = 0.0


class PostGenerateRequest(BaseModel):
    user_id: str
    news_id: str
    tone: Optional[str] = None
    temperature: Optional[float] = Field(default=None, ge=0.0, le=2.0)
    language: Optional[str] = None
    profile_overrides: Optional[dict[str, str]] = None  # preferences panel values


class PostRegenerateRequest(BaseModel):
    temperature: Optional[float] = Field(default=None, ge=0.0, le=2.0)
    language: Optional[str] = None
    profile_overrides: Optional[dict[str, str]] = None
    refinement_note: Optional[str] = None  # "make it more aggressive", "add Periyar reference", etc.


class PostGenerateResponse(BaseModel):
    post: PostResponse
    references: list[RetrievedChunkReference] = Field(default_factory=list)
    retrieval_snapshot_id: str
    retrieval_reused: bool = False

    @model_validator(mode="after")
    def validate_snapshot_id(self):
        if not self.retrieval_snapshot_id.strip():
            raise ValueError("retrieval_snapshot_id must be non-empty.")
        return self


DAILY_POST_LIMIT = 5
MILESTONE_TARGET = 200


class DailyQuotaResponse(BaseModel):
    # Daily publish count (only published posts count toward the limit)
    daily_used: int
    daily_limit: int = DAILY_POST_LIMIT
    daily_remaining: int
    reset_at: datetime

    # All-time generated count (kept for backward compat)
    total_posts: int

    # Streak fields
    streak_days: int = 0
    streak_start_date: Optional[datetime] = None
    total_streak_posts: int = 0   # resets when streak breaks — used for milestone
    streak_at_risk: bool = False  # active streak but no publish yet today
    streak_broken: bool = False   # just broke streak (reset to 0 this session)

    milestone_target: int = MILESTONE_TARGET

    # Legacy aliases so existing frontend code still works
    @property
    def used(self) -> int: return self.daily_used
    @property
    def limit(self) -> int: return self.daily_limit
    @property
    def remaining(self) -> int: return self.daily_remaining


class PostTranslateRequest(BaseModel):
    target_language: str = "en"  # "en" | "hi"


class PostTranslateResponse(BaseModel):
    translated_content: str
    target_language: str


class PostsDashboardItem(BaseModel):
    id: str
    user_id: str
    news_id: str
    content_preview: str
    hashtags: list[str]
    status: PostStatus
    created_at: datetime
