from __future__ import annotations

from bson import ObjectId
from fastapi import HTTPException, status

from backend.db.mongo import db
from backend.repositories.posts_repo import PostsRepository
from backend.schemas.posts import PostCreateRequest, PostResponse, PostsDashboardItem, PostUpdateRequest


class PostsService:
    def __init__(self) -> None:
        self.repo = PostsRepository()

    def create(self, payload: PostCreateRequest) -> PostResponse:
        self._validate_references(payload.user_id, payload.news_id)
        data = payload.model_dump()
        data["hashtags"] = self._normalize_hashtags(data.get("hashtags", []))
        doc = self.repo.create(data)
        return self._to_response(doc)

    def list(
        self,
        user_id: str | None = None,
        news_id: str | None = None,
        status_filter: str | None = None,
        limit: int = 100,
        skip: int = 0,
    ) -> list[PostResponse]:
        docs = self.repo.list_posts(user_id=user_id, news_id=news_id, status=status_filter, limit=limit, skip=skip)
        return [self._to_response(d) for d in docs]

    def get(self, post_id: str) -> PostResponse:
        self._ensure_object_id(post_id, "post_id")
        doc = self.repo.get_by_id(post_id)
        if not doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found.")
        return self._to_response(doc)

    def update(self, post_id: str, payload: PostUpdateRequest) -> PostResponse:
        self._ensure_object_id(post_id, "post_id")
        existing = self.repo.get_by_id(post_id)
        if not existing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found.")
        updates = payload.model_dump(exclude_unset=True)
        if "hashtags" in updates and updates["hashtags"] is not None:
            updates["hashtags"] = self._normalize_hashtags(updates["hashtags"])
        if "status" in updates and updates["status"] is not None:
            self._validate_status_transition(existing["status"], updates["status"])
        doc = self.repo.update(post_id, updates)
        if not doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found.")
        return self._to_response(doc)

    def archive(self, post_id: str) -> dict:
        self._ensure_object_id(post_id, "post_id")
        archived = self.repo.archive(post_id)
        if not archived:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found.")
        return {"message": "Post archived successfully."}

    def dashboard(self, user_id: str | None = None, limit: int = 50) -> list[PostsDashboardItem]:
        if user_id:
            self._ensure_object_id(user_id, "user_id")
        docs = self.repo.dashboard_list(user_id=user_id, limit=limit)
        items: list[PostsDashboardItem] = []
        for d in docs:
            content = d.get("content", "")
            items.append(
                PostsDashboardItem(
                    id=str(d["_id"]),
                    user_id=str(d["user_id"]),
                    news_id=str(d["news_id"]),
                    content_preview=content[:180],
                    hashtags=d.get("hashtags", []),
                    status=d.get("status", "draft"),
                    created_at=d["created_at"],
                )
            )
        return items

    def _validate_references(self, user_id: str, news_id: str) -> None:
        self._ensure_object_id(user_id, "user_id")
        self._ensure_object_id(news_id, "news_id")
        if not db["users"].find_one({"_id": ObjectId(user_id)}):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
        if not db["news"].find_one({"_id": ObjectId(news_id)}):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="News not found.")

    def _ensure_object_id(self, value: str, field_name: str) -> None:
        if not ObjectId.is_valid(value):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid {field_name}.")

    def _normalize_hashtags(self, hashtags: list[str]) -> list[str]:
        return sorted({h.strip().lower() for h in hashtags if h and h.strip()})

    def _validate_status_transition(self, old_status: str, new_status: str) -> None:
        allowed = {
            "draft": {"published", "archived", "draft"},
            "published": {"archived", "published"},
            "archived": {"archived"},
        }
        if new_status not in allowed.get(old_status, {old_status}):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status transition from {old_status} to {new_status}.",
            )

    def _to_response(self, doc: dict) -> PostResponse:
        return PostResponse(
            id=str(doc["_id"]),
            user_id=str(doc["user_id"]),
            news_id=str(doc["news_id"]),
            content=doc["content"],
            hashtags=doc.get("hashtags", []),
            status=doc.get("status", "draft"),
            generation_meta=doc.get("generation_meta"),
            created_at=doc["created_at"],
            updated_at=doc["updated_at"],
        )
