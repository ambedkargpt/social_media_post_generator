"""
Prototype CLI: load outputs/generated_news.json, list headlines as 1), 2), …,
let the user pick one, then run retrieval (query = headline + sub + summary)
and generate one post per user profile (Parquet via get_user_profiles).

Non-interactive: --pick 2

Example:
  python generate_posts_from_news.py
  python generate_posts_from_news.py --pick 1 --output outputs/generated_posts_from_news.json
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

_ROOT = Path(__file__).resolve().parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from openai import OpenAI
from tqdm import tqdm

from config import get_settings
from main import BASE_DIR, _retrieval_cfg_from_settings, ensure_rag_stack
from pipeline.generator import generate_post
from pipeline.profiles import get_user_profiles
from pipeline.retriever import retrieve_relevant_chunks
from semrag.runtime import semrag_candidates_for_query

DEFAULT_NEWS_JSON = BASE_DIR / "outputs" / "generated_news.json"
DEFAULT_OUTPUT = BASE_DIR / "outputs" / "generated_posts_from_news.json"


def generated_item_to_article(item: Dict[str, Any]) -> Dict[str, Any]:
    headline = (item.get("headline") or item.get("video_title") or "").strip()
    sub = (item.get("subheadline") or "").strip()
    summary = (item.get("summary_text") or "").strip()
    body = "\n\n".join(p for p in (headline, sub, summary) if p).strip()
    return {
        "title": headline,
        "description": sub,
        "content": body,
        "source": "generated_news",
        "video_link": item.get("video_link", ""),
        "video_title": item.get("video_title", ""),
        "generated_news_item": dict(item),
    }


def load_generated_news(path: Path) -> List[Dict[str, Any]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    items = data.get("items")
    if not isinstance(items, list):
        raise ValueError(f"No 'items' list in {path}")
    return [i for i in items if isinstance(i, dict)]


def pick_item_interactive(items: List[Dict[str, Any]], pick: Optional[int]) -> Dict[str, Any]:
    n = len(items)
    if n == 0:
        raise SystemExit("No news items in file.")
    if pick is not None:
        if not (1 <= pick <= n):
            raise SystemExit(f"--pick must be between 1 and {n}")
        return items[pick - 1]
    print("Generated news — choose one for retrieval + posts:\n")
    for i, it in enumerate(items, start=1):
        h = (it.get("headline") or it.get("video_title") or "(no headline)").strip()
        print(f"{i}) {h}")
    print()
    raw = input("Enter number: ").strip()
    try:
        choice = int(raw)
    except ValueError:
        raise SystemExit(f"Invalid choice: {raw!r}")
    if not (1 <= choice <= n):
        raise SystemExit(f"Choose 1–{n}")
    return items[choice - 1]


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Posts from picked generated_news.json headline")
    p.add_argument("--news-json", type=Path, default=DEFAULT_NEWS_JSON)
    p.add_argument("--pick", type=int, default=None, help="1-based index (skip interactive menu)")
    p.add_argument(
        "--profile",
        dest="profiles",
        action="append",
        default=None,
        help="User profile role to run (repeatable). If omitted, runs all profiles.",
    )
    p.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    p.add_argument("--no-progress", action="store_true")
    return p.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> None:
    args = parse_args(argv)
    settings = get_settings()
    news_path = args.news_json.resolve()
    if not news_path.is_file():
        raise SystemExit(f"Missing {news_path}")

    items = load_generated_news(news_path)
    chosen = pick_item_interactive(items, args.pick)
    article = generated_item_to_article(chosen)

    client = OpenAI(api_key=settings.openai_api_key)
    embedder, store, context_by_title = ensure_rag_stack(settings)

    news_text_for_query = " ".join(
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
            news_text_for_query,
            settings,
            mode=getattr(settings, "semrag_search_mode", "hybrid"),
        )
        retrieval_cfg["semrag_candidates"] = semrag_candidates
    except Exception as exc:
        retrieval_cfg["semrag_enabled"] = False
        retrieval_cfg.pop("semrag_candidates", None)
        print(f"SEMRAG retrieval fallback in generate_posts_from_news: {exc}")
    retrieved_chunks = retrieve_relevant_chunks(
        news_text=news_text_for_query,
        embedder=embedder,
        store=store,
        top_k=settings.retrieval_top_k,
        retrieval_cfg=retrieval_cfg,
    )

    full_contexts: List[Dict[str, Any]] = []
    seen_titles: set[str] = set()
    for c in retrieved_chunks:
        title = c["video_title"]
        if title in seen_titles:
            continue
        vc = context_by_title.get(title)
        if vc:
            full_contexts.append(vc)
            seen_titles.add(title)

    references = [
        {
            "chunk_id": c["chunk_id"],
            "video_title": c["video_title"],
            "video_link": c["video_link"],
            "chunk_text": c["chunk_text"],
            "similarity_score": c["similarity_score"],
            "relevance_score": c.get("relevance_score"),
            "argument_score": c["argument_score"],
            "final_score": c["final_score"],
        }
        for c in retrieved_chunks
    ]

    profiles = get_user_profiles()
    selected_roles = {(r or "").strip().lower() for r in (args.profiles or []) if (r or "").strip()}
    if selected_roles:
        profiles = [
            p for p in profiles
            if str(p.get("user_role", "")).strip().lower() in selected_roles
        ]
        if not profiles:
            raise SystemExit("No matching profiles found for --profile selection.")
    profile_iter: Any = profiles
    if not args.no_progress and profiles:
        profile_iter = tqdm(profiles, desc="Generating posts", unit="profile", dynamic_ncols=True)

    profile_outputs: List[Dict[str, Any]] = []
    for profile in profile_iter:
        post_text = generate_post(
            client=client,
            model=settings.openai_model,
            news=article,
            profile=profile,
            retrieved_chunks=retrieved_chunks,
            full_video_contexts=full_contexts,
            temperature=settings.openai_temperature,
        )
        profile_outputs.append({"profile": profile, "post": post_text})

    payload = [
        {
            "news": article,
            "references": references,
            "profiles": profile_outputs,
        }
    ]

    out_path = args.output.resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nWrote {len(profile_outputs)} profile post(s) to {out_path}")


if __name__ == "__main__":
    main()
