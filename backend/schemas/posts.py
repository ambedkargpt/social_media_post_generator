from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


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
    created_at: datetime
    updated_at: datetime


class PostsDashboardItem(BaseModel):
    id: str
    user_id: str
    news_id: str
    content_preview: str
    hashtags: list[str]
    status: PostStatus
    created_at: datetime
