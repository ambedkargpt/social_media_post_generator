from fastapi import APIRouter, Depends, HTTPException, Query, status

from backend.core.dependencies import get_current_user_id
from backend.schemas.auth import MessageResponse
from backend.schemas.posts import PostCreateRequest, PostResponse, PostsDashboardItem, PostUpdateRequest
from backend.services.posts_service import PostsService


router = APIRouter(prefix="/posts", tags=["posts"])
service = PostsService()


def _owner_id(post) -> str | None:
    if isinstance(post, dict):
        return post.get("user_id")
    return getattr(post, "user_id", None)


@router.post("/", response_model=PostResponse)
def create_post(payload: PostCreateRequest, current_user_id: str = Depends(get_current_user_id)) -> PostResponse:
    if payload.user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot create post for another user.")
    return service.create(payload)


@router.get("/", response_model=list[PostResponse])
def list_posts(
    user_id: str | None = Query(default=None),
    news_id: str | None = Query(default=None),
    status: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    skip: int = Query(default=0, ge=0),
    current_user_id: str = Depends(get_current_user_id),
) -> list[PostResponse]:
    if user_id and user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot list posts for another user.")
    user_filter = user_id or current_user_id
    return service.list(user_id=user_filter, news_id=news_id, status_filter=status, limit=limit, skip=skip)


@router.get("/dashboard", response_model=list[PostsDashboardItem])
def posts_dashboard(
    user_id: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    current_user_id: str = Depends(get_current_user_id),
) -> list[PostsDashboardItem]:
    if user_id and user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot view dashboard for another user.")
    return service.dashboard(user_id=(user_id or current_user_id), limit=limit)


@router.get("/{post_id}", response_model=PostResponse)
def get_post(post_id: str, current_user_id: str = Depends(get_current_user_id)) -> PostResponse:
    post = service.get(post_id)
    if _owner_id(post) != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot access another user's post.")
    return post


@router.patch("/{post_id}", response_model=PostResponse)
def update_post(post_id: str, payload: PostUpdateRequest, current_user_id: str = Depends(get_current_user_id)) -> PostResponse:
    existing = service.get(post_id)
    if _owner_id(existing) != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot update another user's post.")
    return service.update(post_id, payload)


@router.delete("/{post_id}", response_model=MessageResponse)
def archive_post(post_id: str, current_user_id: str = Depends(get_current_user_id)) -> MessageResponse:
    existing = service.get(post_id)
    if _owner_id(existing) != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot archive another user's post.")
    result = service.archive(post_id)
    return MessageResponse(**result)
