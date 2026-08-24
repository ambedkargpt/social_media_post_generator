from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
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
from backend.repositories.streak_repo import StreakRepository
from backend.schemas.posts import (
    DAILY_POST_LIMIT,
    MILESTONE_TARGET,
    DailyQuotaResponse,
    PostCreateRequest,
    PostGenerateResponse,
    PostRegenerateRequest,
    PostResponse,
    PostTranslateResponse,
    PostsDashboardItem,
    PostUpdateRequest,
    RetrievedChunkReference,
)
from backend.pipeline_cli import _retrieval_cfg_from_settings, ensure_rag_stack
from backend.pipeline.generator import generate_post
from backend.pipeline.profiles import PROFILE_FIELDS, get_user_profiles
from backend.pipeline.post_validation import ValidationReport, validate_post
from backend.pipeline.retriever import retrieve_relevant_chunks
from backend.pipeline.web_research import ClaimFinding, ResearchBrief, research
from backend.semrag.runtime import semrag_candidates_for_query


# Claims repeat heavily: several stories are cut from one video, and several
# users generate posts from the same story. Keyed on normalised claim text, so
# the same assertion is searched once per process rather than once per post.
#
# Partitioned by tenant. The key is the claim text alone, so a single flat dict
# let a finding researched for one channel be served to another, which breaks
# the isolation the channels are supposed to have and silently attributes one
# party's sourcing to another's post.
_RESEARCH_CACHE: dict[str, dict[str, ClaimFinding]] = {}


# Published output is Hindi regardless of the UI language. The site language
# switches the interface, but a post written in English cannot carry the
# Devanagari-only editorial standard the news pipeline enforces, and switching
# the interface to English silently produced English posts.
POST_OUTPUT_LANGUAGE = "hi"


class PostsService:
    def __init__(self) -> None:
        self.repo = PostsRepository()
        self.news_repo = NewsRepository()
        self.profile_answers_repo = ProfileAnswersRepository()
        self.streak_repo = StreakRepository()

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

    def update(self, post_id: str, payload: PostUpdateRequest, current_user_id: str | None = None) -> PostResponse:
        self._ensure_object_id(post_id, "post_id")
        existing = self.repo.get_by_id(post_id)
        if not existing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found.")
        updates = payload.model_dump(exclude_unset=True)
        if "hashtags" in updates and updates["hashtags"] is not None:
            updates["hashtags"] = self._normalize_hashtags(updates["hashtags"])
        is_publishing = (
            updates.get("status") == "published"
            and existing.get("status") != "published"
        )
        if is_publishing:
            self._validate_status_transition(existing["status"], "published")
            user_id = current_user_id or str(existing["user_id"])
            # ── Atomic daily publish rate limit ─────────────────────────────
            published_today = self.repo.count_published_today(user_id)
            if published_today >= DAILY_POST_LIMIT:
                next_midnight = (datetime.now(timezone.utc) + timedelta(days=1)).replace(
                    hour=0, minute=0, second=0, microsecond=0
                )
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail={
                        "error": "daily_limit_reached",
                        "message": f"You've used all {DAILY_POST_LIMIT} posts for today. Come back tomorrow!",
                        "reset_at": next_midnight.isoformat(),
                    },
                )
            allowed = self.repo.try_publish_atomic(post_id, user_id, DAILY_POST_LIMIT)
            if not allowed:
                next_midnight = (datetime.now(timezone.utc) + timedelta(days=1)).replace(
                    hour=0, minute=0, second=0, microsecond=0
                )
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail={
                        "error": "daily_limit_reached",
                        "message": f"You've used all {DAILY_POST_LIMIT} posts for today. Come back tomorrow!",
                        "reset_at": next_midnight.isoformat(),
                    },
                )
            # Update streak
            self.streak_repo.on_publish(user_id)
        elif "status" in updates and updates["status"] is not None:
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
        language: str | None = None,
        profile_overrides: dict[str, str] | None = None,
    ) -> PostGenerateResponse:
        self._validate_references(user_id, news_id)

        news_doc = self.news_repo.get_by_id(news_id)
        if not news_doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="News not found.")

        article = self._news_doc_to_article(news_doc)

        # Which story, and which video it was cut from. Without this the log
        # jumps straight to search queries with no way to tell what was clicked,
        # and no way to open the source and check the post against it.
        #
        # One record per line, rather than one record carrying newlines:
        # retrieval drives a tqdm bar on the same stream, and a bar redrawing
        # with a carriage return can land on top of the tail of a multi-line
        # record. The video URL was the last line, so it was the line that
        # went missing from the console.
        import logging as _logging

        _log = _logging.getLogger(__name__)
        _log.info(
            "[generate] news_id=%s tenant=%s type=%s",
            news_id,
            news_doc.get("tenant_slug") or "-",
            news_doc.get("content_type") or "-",
        )
        _log.info("[generate] headline: %s", article.get("title") or "(untitled)")
        _log.info(
            "[generate] video   : %s",
            article.get("source_url") or "(no source_url on this news item)",
        )

        query_text = self._query_from_article(article)
        profile = self._profile_for_user(user_id, tone=tone, profile_overrides=profile_overrides)
        tenant = article.get("tenant_slug") or "general"
        embedder, store, context_by_title = self._rag_stack(tenant)
        retrieved_chunks = self._retrieve_chunks(query_text, embedder, store, tenant=tenant)
        full_contexts = self._full_contexts_for_chunks(retrieved_chunks, context_by_title)
        brief = self._research_for_article(article, retrieved_chunks)
        brief_payload = brief.as_payload() if brief else None
        # Loaded once here and handed to the writer as well as the research
        # step, so the post is written against what the speaker actually said
        # rather than only the excerpts a retriever happened to rank.
        transcript = self._transcript_for_article(article, retrieved_chunks)

        # Chunks are optional now, but writing from nothing is not. A post with
        # no chunks, no transcript and no research would be invention.
        if not retrieved_chunks and not transcript and not brief_payload:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=(
                    "No source material could be gathered for this story, so a "
                    "grounded post cannot be written. Please try again."
                ),
            )

        post_text = self._generate_with_llm(
            article=article,
            profile=profile,
            retrieved_chunks=retrieved_chunks,
            full_contexts=full_contexts,
            temperature=temperature,
            language=POST_OUTPUT_LANGUAGE,
            research_payload=brief_payload,
            transcript=transcript,
        )
        if not post_text or not post_text.strip():
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Post generation returned empty content. Please try again.",
            )
        post_text, validation = self._validated_post(
            post_text,
            article=article,
            profile=profile,
            retrieved_chunks=retrieved_chunks,
            full_contexts=full_contexts,
            temperature=temperature,
            brief_payload=brief_payload,
            trace_dir=brief.trace_dir if brief else None,
            transcript=transcript,
        )
        if brief and brief.trace_dir:
            self._trace_write(brief.trace_dir, "14_post_final.txt", post_text)
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
            research=brief.as_meta() if brief else None,
            validation=validation.as_meta() if validation else None,
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
        # Apply any panel overrides on top of the stored profile
        if payload.profile_overrides:
            for qid, value in payload.profile_overrides.items():
                field = qid.replace("profile_", "", 1) if qid.startswith("profile_") else qid
                if field in PROFILE_FIELDS and value:
                    profile[field] = value

        # The tenant's own stack, so a title lookup cannot pull another
        # channel's video summary into this post.
        _, _, context_by_title = self._rag_stack(article.get("tenant_slug") or "general")
        full_contexts = self._full_contexts_for_chunks(chunks, context_by_title)
        # Regeneration reuses the retrieval snapshot, so it reuses the research
        # too. Searching again would spend two LLM calls and a round of requests
        # to re-derive facts we already stored, and could quietly hand the user
        # a differently-sourced post than the one they asked to refine.
        prior_research = (meta.get("research") or {}) if isinstance(meta, dict) else {}
        post_text = self._generate_with_llm(
            article=article,
            profile=profile,
            retrieved_chunks=chunks,
            full_contexts=full_contexts,
            temperature=payload.temperature,
            language=POST_OUTPUT_LANGUAGE,
            refinement_note=payload.refinement_note,
            research_payload=self._payload_from_meta(prior_research),
            transcript=self._transcript_for_article(article, chunks),
        )
        if not post_text or not post_text.strip():
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Post generation returned empty content. Please try again.",
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
            research=prior_research or None,
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

    def get_daily_quota(self, *, user_id: str) -> DailyQuotaResponse:
        self._ensure_object_id(user_id, "user_id")
        daily_used = self.repo.count_published_today(user_id)
        total = self.repo.count_all_time(user_id)
        now = datetime.now(timezone.utc)
        next_midnight = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        streak = self.streak_repo.get_streak_info(user_id)
        return DailyQuotaResponse(
            daily_used=daily_used,
            daily_remaining=max(0, DAILY_POST_LIMIT - daily_used),
            reset_at=next_midnight,
            total_posts=total,
            streak_days=streak["streak_days"],
            streak_start_date=streak["streak_start_date"],
            total_streak_posts=streak["total_streak_posts"],
            streak_at_risk=streak["streak_at_risk"],
            streak_broken=streak["streak_broken"],
        )

    def translate_post(self, *, post_id: str, current_user_id: str, target_language: str) -> PostTranslateResponse:
        self._ensure_object_id(post_id, "post_id")
        doc = self.repo.get_by_id(post_id)
        if not doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found.")
        if str(doc["user_id"]) != current_user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot translate another user's post.")

        # Return cached translation if it already exists
        cached = (doc.get("translations") or {}).get(target_language)
        if cached:
            return PostTranslateResponse(translated_content=cached, target_language=target_language)

        content = doc.get("content", "")
        lang_name = "English" if target_language == "en" else "Hindi (Devanagari script)"

        if not settings.deepseek_api_key:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Translation service not configured.")

        client = OpenAI(api_key=settings.deepseek_api_key, base_url=settings.deepseek_base_url)
        # Translation is instruction-following, so it uses the writer's model
        # rather than the reasoning model, and carries an explicit cap: a
        # reasoning model spends the completion budget thinking and returns an
        # empty string, which is how post generation failed twice.
        response = client.chat.completions.create(
            model=settings.post_generation_model,
            max_tokens=4000,
            messages=[
                {
                    "role": "system",
                    "content": (
                        f"You are a precise translator. Translate the following social media post to {lang_name}. "
                        "Preserve the structure exactly: headline on the first line, then the body paragraphs, "
                        "then hashtags at the end. Translate hashtag labels too where appropriate. "
                        "Output ONLY the translated post — no explanations, no preamble."
                    ),
                },
                {"role": "user", "content": content},
            ],
            temperature=0.3,
        )
        translated = (response.choices[0].message.content or "").strip()
        if not translated:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Translation returned empty content. Please try again.",
            )

        # The stripper runs on generation, not here, so a post cleaned in Hindi
        # came back full of em dashes the moment it was translated. Translation
        # is a second generation and needs the same pass; the danda rule is not
        # applied, since it belongs to Devanagari only.
        from backend.pipeline.generator import _danda_normalise, _strip_ai_tells

        translated = _strip_ai_tells(translated)
        if target_language != "en":
            translated = _danda_normalise(translated)

        # Persist for future requests
        self.repo.save_translation(post_id, target_language, translated)

        return PostTranslateResponse(translated_content=translated, target_language=target_language)

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
        # source_url is the video this story came from. It was being dropped
        # here, which left the post with no way to cite where it originated.
        return {
            "title": str(doc.get("headline") or "").strip(),
            "description": str(doc.get("description") or "").strip(),
            "content": str(doc.get("summary") or "").strip(),
            "source_url": str(doc.get("source_url") or "").strip(),
            "video_title": str(doc.get("video_title") or doc.get("headline") or "").strip(),
            # Needed downstream to keep one channel's research off another's
            # posts. Without it every tenant shared one cache.
            "tenant_slug": str(doc.get("tenant_slug") or "general").strip().lower(),
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

    def _profile_for_user(
        self,
        user_id: str,
        *,
        tone: str | None,
        profile_overrides: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        default_profile = dict(get_user_profiles()[0])
        # Fetch only the known profile question IDs — avoids scanning 500 rows per request
        known_qids = [f"profile_{f}" for f in PROFILE_FIELDS]
        answers = self.profile_answers_repo.list_by_user(
            user_id=user_id,
            question_ids=known_qids,
            limit=len(known_qids),
            skip=0,
        )
        for row in answers:
            qid = str(row.get("question_id") or "").strip()
            if not qid.startswith("profile_"):
                continue
            field = qid.replace("profile_", "", 1)
            if field in PROFILE_FIELDS:
                default_profile[field] = row.get("answer")
        # Apply preferences-panel overrides (highest priority — user just changed them)
        if profile_overrides:
            for qid, value in profile_overrides.items():
                field = qid.replace("profile_", "", 1) if qid.startswith("profile_") else qid
                if field in PROFILE_FIELDS and value:
                    default_profile[field] = value
        if tone and tone.strip():
            default_profile["tone"] = tone.strip()
        return default_profile

    def _rag_stack(self, tenant: str) -> tuple[Any, Any, Any]:
        """
        This tenant's retrieval stack, or the shared one when it has none yet.

        Logged either way: falling back means the post is written from another
        channel's material, which is invisible in the output and worth saying.
        """
        import logging as _logging
        from backend.pipeline.multi_rag import rag_stack_for_tenant

        stack, isolated = rag_stack_for_tenant(settings, tenant)
        _log = _logging.getLogger(__name__)
        if isolated:
            _log.info("[retrieval] tenant=%s using its own corpus and namespace", tenant)
        else:
            _log.info(
                "[retrieval] tenant=%s falling back to the shared corpus "
                "(run backend.scripts.check_isolation to see why)", tenant,
            )
        return stack

    def _retrieve_chunks(
        self, query_text: str, embedder: Any, store: Any, *, tenant: str = "general"
    ) -> list[dict[str, Any]]:
        retrieval_cfg = _retrieval_cfg_from_settings(settings)
        retrieval_cfg["semrag_enabled"] = True
        try:
            # Tenant-scoped settings so the graph consulted is this channel's.
            # The global semrag_enabled is off and the global graph path does
            # not exist, so passing plain settings returned no candidates at all.
            from backend.pipeline.multi_rag import artifacts_for_tenant, settings_for_tenant

            _art = artifacts_for_tenant(tenant)
            _cfg_settings = settings_for_tenant(settings, _art) if _art else settings
            semrag_candidates, _ = semrag_candidates_for_query(
                query_text,
                _cfg_settings,
                mode=getattr(settings, "semrag_search_mode", "hybrid"),
            )
            retrieval_cfg["semrag_candidates"] = semrag_candidates
        except Exception as exc:
            import logging as _logging
            _logging.getLogger(__name__).warning("semrag retrieval failed, falling back to base retrieval: %s", exc)
            retrieval_cfg["semrag_enabled"] = False
            retrieval_cfg.pop("semrag_candidates", None)
        try:
            return retrieve_relevant_chunks(
                news_text=query_text,
                embedder=embedder,
                store=store,
                top_k=settings.retrieval_top_k,
                retrieval_cfg=retrieval_cfg,
            )
        except Exception as exc:  # noqa: BLE001 - surface a usable error, not a traceback
            # Chunks used to be the post's only grounding, so failing here was
            # right. They are not any more: the Ambedkarite lens moved into the
            # prompt, and the transcript and research brief carry the substance.
            # Refusing on the weakest dependency would take the whole feature
            # down over material the post can now do without. The caller checks
            # that SOMETHING survived before writing.
            import logging as _logging

            _logging.getLogger(__name__).error(
                "chunk retrieval failed, continuing without chunks: %s", exc
            )
            return []

    def _full_contexts_for_chunks(self, chunks: list[dict[str, Any]], context_by_title: dict[str, Any]) -> list[dict[str, Any]]:
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
        language: str | None = None,
        refinement_note: str | None = None,
        research_payload: dict[str, Any] | None = None,
        transcript: str | None = None,
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
                language=language,
                refinement_note=refinement_note,
                research_payload=research_payload,
                transcript=transcript,
            )
        except OpenAIRateLimitError as exc:
            import logging as _logging
            _logging.getLogger(__name__).warning("LLM rate limit reached: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Post generation is temporarily unavailable due to high demand. Please try again shortly.",
            ) from exc
        except Exception as exc:
            import logging as _logging
            _logging.getLogger(__name__).error("Post generation failed: %s", exc, exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Post generation failed. Please try again.",
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
        research: dict[str, Any] | None = None,
        validation: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        meta: dict[str, Any] = {
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
        # Stored so a published post can be audited against the evidence it was
        # given: which claims were checked, what the sources said, which URLs.
        if research:
            meta["research"] = research
        # Kept even when it passes: "we checked and found nothing" is the record
        # that makes a published post defensible.
        if validation is not None:
            meta["validation"] = validation
        return meta

    def _validated_post(
        self,
        post_text: str,
        *,
        article: dict[str, Any],
        profile: dict[str, Any],
        retrieved_chunks: list[dict[str, Any]],
        full_contexts: list[dict[str, Any]],
        temperature: float | None,
        brief_payload: dict[str, Any] | None,
        trace_dir: "Path | None" = None,
        transcript: str | None = None,
    ) -> tuple[str, "ValidationReport | None"]:
        """
        Check the post's figures and dates against the material, and re-ask once
        if any are unsupported.

        A prompt rule about dates was shown to fail even when written to target
        one specific error, so the check runs on the output rather than trusting
        the instruction. One retry only: if the second attempt still carries an
        unsupported figure, the post is returned with the flags recorded rather
        than spending a third call or denying the user a post.
        """
        self._trace_write(trace_dir, "10_post_first_pass.txt", post_text)
        if not settings.post_validation_enabled:
            return post_text, None

        # Only the story's own video counts as a factual source. Chunks from
        # other videos are checked separately, so a figure lifted from a
        # different briefing is reported as cross-video rather than invented.
        from backend.pipeline.generator import _is_own

        own_chunks = [c for c in retrieved_chunks if _is_own(c, article)]
        other_chunks = [c for c in retrieved_chunks if not _is_own(c, article)]
        sources = [
            # The writer is now shown the transcript, so anything in it is
            # sourced. Without this line every figure the speaker said aloud
            # would come back flagged as invented.
            transcript or "",
            "\n".join(str(article.get(k) or "") for k in ("title", "description", "content")),
            "\n".join(str(c.get("chunk_text") or "") for c in own_chunks),
            json.dumps(brief_payload, ensure_ascii=False) if brief_payload else "",
        ]
        other_sources = ["\n".join(str(c.get("chunk_text") or "") for c in other_chunks)]
        import logging as _logging
        _log = _logging.getLogger(__name__)

        report = validate_post(post_text, sources=sources, other_video_sources=other_sources)
        self._trace_write(trace_dir, "11_validation_first_pass.json", json.dumps(report.as_meta(), ensure_ascii=False, indent=2))
        if report.ok:
            _log.info("[validation] passed: no unsupported figures or dates")
            return post_text, report

        _log.info(
            "[validation] flagged numbers=%s dates=%s cross_video=%s; re-asking once",
            report.unsupported_numbers, report.unsupported_dates, report.cross_video_numbers,
        )
        try:
            retry = self._generate_with_llm(
                article=article,
                profile=profile,
                retrieved_chunks=retrieved_chunks,
                full_contexts=full_contexts,
                temperature=temperature,
                language=POST_OUTPUT_LANGUAGE,
                transcript=transcript,
                refinement_note=report.as_correction_note(),
                research_payload=brief_payload,
            )
        except HTTPException:
            return post_text, report
        if not retry or not retry.strip():
            return post_text, report

        second = validate_post(retry, sources=sources, other_video_sources=other_sources)
        self._trace_write(trace_dir, "12_post_retry.txt", retry)
        self._trace_write(trace_dir, "13_validation_retry.json", json.dumps(second.as_meta(), ensure_ascii=False, indent=2))
        # Keep the retry only when it is actually cleaner; a rewrite that trades
        # one bad figure for two is not an improvement.
        def _flags(r):
            return len(r.unsupported_numbers) + len(r.unsupported_dates) + len(r.cross_video_numbers)

        if _flags(second) <= _flags(report):
            second.retried = True
            _log.info("[validation] retry accepted; remaining flags: %s %s",
                      second.unsupported_numbers, second.unsupported_dates)
            return retry, second
        report.retried = True
        _log.info("[validation] retry was worse; keeping first pass")
        return post_text, report

    @staticmethod
    def _trace_write(trace_dir: "Path | None", name: str, content: str) -> None:
        """Mirror of the research tracer, so post artefacts land in the same folder."""
        if not trace_dir:
            return
        try:
            (trace_dir / name).write_text(content or "", encoding="utf-8")
        except Exception:
            pass

    @staticmethod
    def _payload_from_meta(research: dict[str, Any] | None) -> dict[str, Any] | None:
        """
        Rebuild the writer's research payload from what was stored on the parent
        post, so a regeneration reuses the same evidence and the same stance
        split rather than searching again and possibly landing elsewhere.
        """
        if not research:
            return None
        from backend.pipeline.web_research import _treatment

        mode = str(research.get("stance_mode") or "angle")
        use, avoid = [], []
        for row in research.get("claims") or []:
            verdict = str(row.get("verdict") or "")
            entry_stance = str(row.get("stance") or "NEUTRAL").upper()
            if mode != "strict" and entry_stance == "SUPPORTS_RULING":
                avoid.append({"claim": row.get("claim", ""), "verdict": verdict})
                continue
            use.append(
                {
                    "claim": row.get("claim", ""),
                    "verdict": verdict,
                    "how_to_treat": _treatment(verdict),
                    "stated_in_video": bool(row.get("in_transcript", True)),
                    "facts": row.get("facts") or [],
                    "sources": (row.get("sources") or [])[:4],
                }
            )
        if not use and not avoid:
            return None
        return {"stance_mode": mode, "use_these": use, "do_not_contradict": avoid}

    def _transcript_for_article(
        self, article: dict[str, Any], retrieved_chunks: list[dict[str, Any]]
    ) -> str:
        """
        The story's own transcript, from the scraper's output on disk.

        Falling back to whichever chunks ranked highest was actively harmful:
        with no chunks indexed for this video, claims were extracted from a
        different video entirely, so a paper-leak story produced claims about
        vote rolls. No transcript is the honest answer, another video's is not,
        so the fallback is limited to chunks from this same video.

        Shared by research and by writing, so both work from the same text.
        """
        from backend.pipeline.generator import _is_own
        from backend.pipeline.transcripts import transcript_for_video

        video_link = str(article.get("source_url") or "").strip()
        transcript = transcript_for_video(video_link)[:12000]
        if not transcript:
            own = [c for c in retrieved_chunks if _is_own(c, article)]
            transcript = "\n\n".join(str(c.get("chunk_text") or "") for c in own)[:12000]
        return transcript

    def _research_for_article(
        self,
        article: dict[str, Any],
        retrieved_chunks: list[dict[str, Any]],
    ) -> "ResearchBrief | None":
        """
        Verify the article's checkable claims against the open web.

        Best-effort by design. Any failure here returns None and the post is
        generated exactly as it was before, because a search outage must not
        cost a user their post.
        """
        if not settings.web_research_enabled:
            return None
        if not settings.deepseek_api_key:
            return None

        news_item = "\n".join(
            str(article.get(k) or "").strip()
            for k in ("title", "description", "content")
            if article.get(k)
        ).strip()
        if not news_item:
            return None

        video_link = str(article.get("source_url") or "").strip()
        transcript = self._transcript_for_article(article, retrieved_chunks)
        import logging as _logging
        _log = _logging.getLogger(__name__)
        if transcript:
            _log.info("[research] source video: %s  (transcript %d chars)",
                      video_link or "(no video link)", len(transcript))
        else:
            _log.info(
                "[research] source video: %s  NO TRANSCRIPT FOUND, claims will come "
                "from the news item alone", video_link or "(no video link)",
            )

        try:
            client = OpenAI(api_key=settings.deepseek_api_key, base_url=settings.deepseek_base_url)
            return research(
                client,
                settings.research_model,
                news_item=news_item,
                transcript_excerpt=transcript,
                prompts_dir=settings.prompts_dir,
                searxng_url=settings.searxng_url,
                max_claims=settings.web_research_max_claims,
                top_k=settings.web_research_top_k,
                cache=_RESEARCH_CACHE.setdefault(
                    str(article.get("tenant_slug") or "general"), {}
                ),
                debug_dir=settings.web_research_debug_dir,
                transcript=transcript,
                video_link=video_link,
                stance_mode=settings.research_stance_mode,
                purpose=settings.research_purpose,
            )
        except Exception as exc:
            import logging as _logging
            _logging.getLogger(__name__).warning("Web research skipped: %s", exc, exc_info=True)
            return None

    @staticmethod
    def _current_generation_model() -> str:
        """Model that writes the post. Separate from the research model on purpose."""
        return settings.post_generation_model

    def _to_response(self, doc: dict) -> PostResponse:
        return PostResponse(
            id=str(doc["_id"]),
            user_id=str(doc["user_id"]),
            news_id=str(doc["news_id"]),
            content=doc["content"],
            hashtags=doc.get("hashtags", []),
            status=doc.get("status", "draft"),
            generation_meta=doc.get("generation_meta"),
            translations=doc.get("translations") or {},
            published_at=doc.get("published_at"),
            created_at=doc["created_at"],
            updated_at=doc["updated_at"],
        )
