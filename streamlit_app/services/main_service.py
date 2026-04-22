from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

from openai import OpenAI

from config import get_settings
from generate_posts_from_news import generated_item_to_article
from main import _retrieval_cfg_from_settings, ensure_rag_stack
from pipeline.generator import generate_post
from pipeline.profiles import get_user_profiles
from pipeline.retriever import retrieve_relevant_chunks
from semrag.runtime import semrag_candidates_for_query


BASE_DIR = Path(__file__).resolve().parents[2]
OUTPUT_PATH = BASE_DIR / "outputs" / "generated_posts.json"
GENERATED_NEWS_PATH = BASE_DIR / "outputs" / "generated_news.json"


def _article_from_user_input(headline: str, subheadline: str, body: str) -> Dict[str, Any]:
    return {
        "title": (headline or "").strip(),
        "description": (subheadline or "").strip(),
        "content": (body or "").strip(),
        "source": "streamlit_manual_input",
    }


def _prepare_articles(mode: str, headline: str, subheadline: str, body: str, pick_idx: int) -> List[Dict[str, Any]]:
    if mode == "generated":
        if not GENERATED_NEWS_PATH.is_file():
            raise FileNotFoundError(f"Missing generated news file: {GENERATED_NEWS_PATH}")
        data = json.loads(GENERATED_NEWS_PATH.read_text(encoding="utf-8"))
        items = [row for row in data.get("items", []) if isinstance(row, dict)]
        if not items:
            raise ValueError("No generated news items found.")
        if pick_idx < 0 or pick_idx >= len(items):
            raise IndexError("Invalid generated news selection index.")
        return [generated_item_to_article(items[pick_idx])]
    return [_article_from_user_input(headline, subheadline, body)]


def run_main_flow(
    mode: str,
    headline: str = "",
    subheadline: str = "",
    body: str = "",
    pick_idx: int = 0,
    selected_profile_roles: List[str] | None = None,
) -> List[Dict[str, Any]]:
    settings = get_settings()
    client = OpenAI(api_key=settings.openai_api_key)
    embedder, store, context_by_title = ensure_rag_stack(settings)
    profiles = get_user_profiles()
    if selected_profile_roles:
        wanted = {r.strip().lower() for r in selected_profile_roles if r.strip()}
        profiles = [
            p for p in profiles
            if str(p.get("user_role", "")).strip().lower() in wanted
        ]
        if not profiles:
            raise ValueError("No matching profiles found for selected profile roles.")
    news_items = _prepare_articles(mode, headline, subheadline, body, pick_idx)
    outputs: List[Dict[str, Any]] = []
    for article in news_items:
        query = " ".join(
            [
                article.get("title") or "",
                article.get("description") or "",
                article.get("content") or "",
            ]
        ).strip()
        retrieval_cfg = _retrieval_cfg_from_settings(settings)
        retrieval_cfg["semrag_enabled"] = True
        try:
            semrag_candidates, _ = semrag_candidates_for_query(
                query,
                settings,
                mode=getattr(settings, "semrag_search_mode", "hybrid"),
            )
            retrieval_cfg["semrag_candidates"] = semrag_candidates
        except Exception:
            retrieval_cfg["semrag_enabled"] = False
            retrieval_cfg.pop("semrag_candidates", None)
        chunks = retrieve_relevant_chunks(
            news_text=query,
            embedder=embedder,
            store=store,
            top_k=settings.retrieval_top_k,
            retrieval_cfg=retrieval_cfg,
        )
        full_contexts = []
        seen = set()
        for c in chunks:
            title = c["video_title"]
            if title in seen:
                continue
            vc = context_by_title.get(title)
            if vc:
                full_contexts.append(vc)
                seen.add(title)
        profile_outputs = []
        for profile in profiles:
            post = generate_post(
                client=client,
                model=settings.openai_model,
                news=article,
                profile=profile,
                retrieved_chunks=chunks,
                full_video_contexts=full_contexts,
                temperature=settings.openai_temperature,
            )
            profile_outputs.append({"profile": profile, "post": post})
        outputs.append({"news": article, "references": chunks, "profiles": profile_outputs})
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(outputs, ensure_ascii=False, indent=2), encoding="utf-8")
    return outputs
