from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from openai import OpenAI

from config import get_settings
from generate_posts_from_news import generated_item_to_article
from main import _retrieval_cfg_from_settings, ensure_rag_stack
from pipeline.generator import generate_post
from pipeline.profiles import get_user_profiles
from pipeline.retriever import retrieve_relevant_chunks
from semrag.runtime import semrag_candidates_for_query


BASE_DIR = Path(__file__).resolve().parents[2]
GENERATED_NEWS_PATH = BASE_DIR / "outputs" / "generated_news.json"
OUTPUT_PATH = BASE_DIR / "outputs" / "generated_posts_from_news.json"


def load_generated_news_items(path: Path | None = None) -> List[Dict[str, Any]]:
    news_path = path or GENERATED_NEWS_PATH
    if not news_path.is_file():
        return []
    data = json.loads(news_path.read_text(encoding="utf-8"))
    items = data.get("items", [])
    return [row for row in items if isinstance(row, dict)]


def generate_posts_for_generated_item(
    item: Dict[str, Any],
    *,
    selected_profile_roles: List[str] | None = None,
    progress_callback: Optional[Callable[[int, int, str], None]] = None,
) -> Dict[str, Any]:
    settings = get_settings()
    client = OpenAI(api_key=settings.openai_api_key)
    embedder, store, context_by_title = ensure_rag_stack(settings)
    article = generated_item_to_article(item)
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
    profiles = get_user_profiles()
    if selected_profile_roles:
        wanted = {r.strip().lower() for r in selected_profile_roles if r.strip()}
        profiles = [
            p for p in profiles
            if str(p.get("user_role", "")).strip().lower() in wanted
        ]
        if not profiles:
            raise ValueError("No matching profiles found for selected profile roles.")
    profile_outputs = []
    total_profiles = len(profiles)
    for idx, profile in enumerate(profiles, start=1):
        if progress_callback:
            progress_callback(idx, total_profiles, str(profile.get("user_role", "")).strip())
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
    payload = {
        "news": article,
        "references": chunks,
        "profiles": profile_outputs,
    }
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps([payload], ensure_ascii=False, indent=2), encoding="utf-8")
    return payload
