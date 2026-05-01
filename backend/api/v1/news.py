from fastapi import APIRouter, Depends, Query

from backend.core.dependencies import get_current_user_id
from backend.schemas.news import NewsCreateRequest, NewsResponse, NewsUpdateRequest
from backend.services.news_service import NewsService


router = APIRouter(prefix="/news", tags=["news"])
service = NewsService()


@router.post("/", response_model=NewsResponse)
def create_news(payload: NewsCreateRequest, _: str = Depends(get_current_user_id)) -> NewsResponse:
    return service.create(payload)


@router.get("/", response_model=list[NewsResponse])
def list_news(
    limit: int = Query(default=100, ge=1, le=500),
    skip: int = Query(default=0, ge=0),
    include_summary: bool = Query(default=True),
) -> list[NewsResponse]:
    return service.list(limit=limit, skip=skip, include_summary=include_summary)


@router.get("/by-news-id/{news_id}", response_model=NewsResponse)
def get_news_by_custom_news_id(news_id: str) -> NewsResponse:
    return service.get_by_custom_news_id(news_id)


@router.get("/{news_id}", response_model=NewsResponse)
def get_news(news_id: str) -> NewsResponse:
    return service.get(news_id)


@router.patch("/{news_id}", response_model=NewsResponse)
def update_news(news_id: str, payload: NewsUpdateRequest, _: str = Depends(get_current_user_id)) -> NewsResponse:
    return service.update(news_id, payload)
