from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from bson import ObjectId
from fastapi import HTTPException, status
from openai import OpenAI
from openai import RateLimitError as OpenAIRateLimitError

from backend.core.config import settings
from backend.db.mongo import db
from backend.repositories.news_repo import NewsRepository
from backend.repositories.posts_repo import PostsRepository
from backend.repositories.profile_answers_repo import ProfileAnswersRepository
from backend.schemas.posts import (
    PostCreateRequest,
    PostGenerateResponse,
    PostRegenerateRequest,
    PostResponse,
    PostsDashboardItem,
    PostUpdateRequest,
    RetrievedChunkReference,
)
from main import _retrieval_cfg_from_settings, ensure_rag_stack
from pipeline.generator import generate_post
from pipeline.profiles import PROFILE_FIELDS, get_user_profiles
from pipeline.retriever import retrieve_relevant_chunks
from semrag.runtime import semrag_candidates_for_query


class PostsService:
    def __init__(self) -> None:
        self.repo = PostsRepository()
        self.news_repo = NewsRepository()
        self.profile_answers_repo = ProfileAnswersRepository()

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

    def generate_post_for_news(
        self,
        *,
        user_id: str,
        news_id: str,
        tone: str | None = None,
        temperature: float | None = None,
    ) -> PostGenerateResponse:
        self._validate_references(user_id, news_id)
        news_doc = self.news_repo.get_by_id(news_id)
        if not news_doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="News not found.")

        article = self._news_doc_to_article(news_doc)
        query_text = self._query_from_article(article)
        profile = self._profile_for_user(user_id, tone=tone)
        retrieved_chunks = self._retrieve_chunks(query_text)
        full_contexts = self._full_contexts_for_chunks(retrieved_chunks)

        post_text = self._generate_with_llm(
            article=article,
            profile=profile,
            retrieved_chunks=retrieved_chunks,
            full_contexts=full_contexts,
            temperature=temperature,
        )
        model_used = self._current_generation_model()
        snapshot_id = f"rs_{uuid4().hex}"
        references = self._references_from_chunks(retrieved_chunks)
        generation_meta = self._build_generation_meta(
            profile=profile,
            query_text=query_text,
            references=references,
            snapshot_id=snapshot_id,
            retrieval_reused=False,
            parent_post_id=None,
            model_used=model_used,
        )
        doc = self.repo.create(
            {
                "user_id": user_id,
                "news_id": news_id,
                "content": post_text,
                "hashtags": [],
                "status": "draft",
                "generation_meta": generation_meta,
            }
        )
        return PostGenerateResponse(
            post=self._to_response(doc),
            references=references,
            retrieval_snapshot_id=snapshot_id,
            retrieval_reused=False,
        )

    def regenerate_from_snapshot(
        self,
        *,
        source_post_id: str,
        current_user_id: str,
        payload: PostRegenerateRequest,
    ) -> PostGenerateResponse:
        self._ensure_object_id(source_post_id, "post_id")
        source_doc = self.repo.get_by_id(source_post_id)
        if not source_doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found.")
        if str(source_doc["user_id"]) != current_user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot regenerate another user's post.")

        meta = source_doc.get("generation_meta") or {}
        retrieval_snapshot = meta.get("retrieval_snapshot") or {}
        snapshot_id = str(retrieval_snapshot.get("snapshot_id") or "").strip()
        chunks = retrieval_snapshot.get("chunks") or []
        if not snapshot_id or not isinstance(chunks, list) or not chunks:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Source post is missing retrieval snapshot required for regenerate.",
            )

        news_id = str(source_doc["news_id"])
        news_doc = self.news_repo.get_by_id(news_id)
        if not news_doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="News not found.")
        article = self._news_doc_to_article(news_doc)
        query_text = self._query_from_article(article)

        profile = meta.get("profile_used")
        if not isinstance(profile, dict) or not profile:
            profile = self._profile_for_user(current_user_id, tone=None)

        full_contexts = self._full_contexts_for_chunks(chunks)
        post_text = self._generate_with_llm(
            article=article,
            profile=profile,
            retrieved_chunks=chunks,
            full_contexts=full_contexts,
            temperature=payload.temperature,
        )
        model_used = self._current_generation_model()

        references = self._references_from_chunks(chunks)
        generation_meta = self._build_generation_meta(
            profile=profile,
            query_text=query_text,
            references=references,
            snapshot_id=snapshot_id,
            retrieval_reused=True,
            parent_post_id=str(source_doc["_id"]),
            model_used=model_used,
        )
        generation_meta["regenerated_from_post_id"] = str(source_doc["_id"])
        doc = self.repo.create(
            {
                "user_id": str(source_doc["user_id"]),
                "news_id": str(source_doc["news_id"]),
                "content": post_text,
                "hashtags": source_doc.get("hashtags", []),
                "status": "draft",
                "generation_meta": generation_meta,
            }
        )
        return PostGenerateResponse(
            post=self._to_response(doc),
            references=references,
            retrieval_snapshot_id=snapshot_id,
            retrieval_reused=True,
        )

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

    def _news_doc_to_article(self, doc: dict) -> dict[str, str]:
        return {
            "title": str(doc.get("headline") or "").strip(),
            "description": str(doc.get("description") or "").strip(),
            "content": str(doc.get("summary") or "").strip(),
            "source": "backend_news_collection",
        }

    def _query_from_article(self, article: dict[str, str]) -> str:
        return " ".join(
            [
                article.get("title") or "",
                article.get("description") or "",
                article.get("content") or "",
            ]
        ).strip()

    def _profile_for_user(self, user_id: str, *, tone: str | None) -> dict[str, Any]:
        default_profile = dict(get_user_profiles()[0])
        answers = self.profile_answers_repo.list_by_user(user_id=user_id, limit=500, skip=0)
        for row in answers:
            qid = str(row.get("question_id") or "").strip()
            if not qid.startswith("profile_"):
                continue
            field = qid.replace("profile_", "", 1)
            if field in PROFILE_FIELDS:
                default_profile[field] = row.get("answer")
        if tone and tone.strip():
            default_profile["tone"] = tone.strip()
        return default_profile

    def _retrieve_chunks(self, query_text: str) -> list[dict[str, Any]]:
        embedder, store, _ = ensure_rag_stack(settings)
        retrieval_cfg = _retrieval_cfg_from_settings(settings)
        retrieval_cfg["semrag_enabled"] = True
        try:
            semrag_candidates, _ = semrag_candidates_for_query(
                query_text,
                settings,
                mode=getattr(settings, "semrag_search_mode", "hybrid"),
            )
            retrieval_cfg["semrag_candidates"] = semrag_candidates
        except Exception:
            retrieval_cfg["semrag_enabled"] = False
            retrieval_cfg.pop("semrag_candidates", None)
        return retrieve_relevant_chunks(
            news_text=query_text,
            embedder=embedder,
            store=store,
            top_k=settings.retrieval_top_k,
            retrieval_cfg=retrieval_cfg,
        )

    def _full_contexts_for_chunks(self, chunks: list[dict[str, Any]]) -> list[dict[str, Any]]:
        _, _, context_by_title = ensure_rag_stack(settings)
        contexts: list[dict[str, Any]] = []
        seen: set[str] = set()
        for chunk in chunks:
            title = str(chunk.get("video_title") or "")
            if not title or title in seen:
                continue
            vc = context_by_title.get(title)
            if vc:
                contexts.append(vc)
                seen.add(title)
        return contexts

    def _generate_with_llm(
        self,
        *,
        article: dict[str, Any],
        profile: dict[str, Any],
        retrieved_chunks: list[dict[str, Any]],
        full_contexts: list[dict[str, Any]],
        temperature: float | None,
    ) -> str:
        try:
            if not settings.deepseek_api_key:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="DEEPSEEK_API_KEY is not set for post generation.",
                )
            client = OpenAI(api_key=settings.deepseek_api_key, base_url=settings.deepseek_base_url)
            return generate_post(
                client=client,
                model=self._current_generation_model(),
                news=article,
                profile=profile,
                retrieved_chunks=retrieved_chunks,
                full_video_contexts=full_contexts,
                temperature=temperature if temperature is not None else settings.openai_temperature,
            )
        except OpenAIRateLimitError as exc:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"LLM provider quota/rate-limit reached: {exc}",
            ) from exc
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Post generation failed: {exc}",
            ) from exc

    def _references_from_chunks(self, chunks: list[dict[str, Any]]) -> list[RetrievedChunkReference]:
        return [
            RetrievedChunkReference(
                chunk_id=str(c.get("chunk_id") or ""),
                video_title=str(c.get("video_title") or ""),
                video_link=str(c.get("video_link") or ""),
                chunk_text=str(c.get("chunk_text") or ""),
                similarity_score=float(c.get("similarity_score") or 0.0),
                relevance_score=(float(c["relevance_score"]) if c.get("relevance_score") is not None else None),
                argument_score=float(c.get("argument_score") or 0.0),
                final_score=float(c.get("final_score") or 0.0),
            )
            for c in chunks
        ]

    def _build_generation_meta(
        self,
        *,
        profile: dict[str, Any],
        query_text: str,
        references: list[RetrievedChunkReference],
        snapshot_id: str,
        retrieval_reused: bool,
        parent_post_id: str | None,
        model_used: str,
    ) -> dict[str, Any]:
        return {
            "pipeline_version": "post_generation_v1",
            "model": model_used,
            "prompt_version": "post_generation_system.txt|post_generation_user.txt",
            "news_query_text": query_text,
            "profile_used": profile,
            "retrieval_stage_skipped": retrieval_reused,
            "parent_post_id": parent_post_id,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "retrieval_snapshot": {
                "snapshot_id": snapshot_id,
                "chunks": [r.model_dump() for r in references],
            },
        }

    @staticmethod
    def _current_generation_model() -> str:
        # Post generation is intentionally on DeepSeek Reasoner for backend parity.
        return "deepseek-reasoner"

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
