import argparse
import json
from pathlib import Path
from typing import Any, Dict, List, Sequence, Tuple

from openai import OpenAI
from tqdm import tqdm

from config import get_settings
from pipeline.news_fetcher import fetch_latest_news
from pipeline.news_scraper import scrape_article
from pipeline.transcript_parser import parse_transcripts
from pipeline.chunker import chunk_videos
from pipeline.argument_scorer import score_argument_chunks
from pipeline.embedder import ChunkEmbedder
from pipeline.vector_store import build_index, save_vector_store, load_vector_store
from pipeline.retriever import retrieve_relevant_chunks
from pipeline.generator import generate_post
from pipeline.profiles import get_user_profiles
from pipeline.title_embeddings import build_title_embeddings, save_title_embeddings, load_title_embeddings
from semrag.build import build_semrag_graph, save_semrag_chunks
from semrag.chunking import chunk_videos_for_semrag
from semrag.runtime import semrag_candidates_for_query
from semrag.semrag_config import load_semrag_config


BASE_DIR = Path(__file__).parent
DATA_PATH = BASE_DIR / "data" / "ravishkumar_all_transcripts.txt"
OUTPUT_PATH = BASE_DIR / "outputs" / "generated_posts.json"
INDEX_PATH = BASE_DIR / "outputs" / "faiss_index.bin"
CHUNKS_PATH = BASE_DIR / "data" / "argument_chunks.json"
VIDEO_CONTEXT_PATH = BASE_DIR / "data" / "video_context.json"
TITLE_EMB_PATH = BASE_DIR / "data" / "video_title_embeddings.json"


def _retrieval_cfg_from_settings(settings) -> Dict[str, Any]:
    return {
        "use_bm25": settings.retrieval_use_bm25,
        "bm25_top_n": settings.retrieval_bm25_top_n,
        "dense_top_n": settings.retrieval_dense_top_n,
        "rrf_k": settings.retrieval_rrf_k,
        "candidate_k": settings.retrieval_candidate_k,
        "per_video_cap": settings.retrieval_per_video_cap,
        "enable_rerank": settings.retrieval_enable_rerank,
        "rerank_top_n": settings.retrieval_rerank_top_n,
        "rare_term_protect": settings.retrieval_rare_term_protect,
        "rare_term_min_idf": settings.retrieval_rare_term_min_idf,
        "rare_term_force_k": settings.retrieval_rare_term_force_k,
        "semrag_enabled": settings.semrag_enabled,
        "semrag_weight": settings.semrag_weight,
    }


def load_transcript_file() -> str:
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Transcript file not found at {DATA_PATH}")
    return DATA_PATH.read_text(encoding="utf-8")


def ensure_rag_stack(settings) -> Tuple[ChunkEmbedder, Any, Dict[str, Dict[str, Any]]]:
    """
    Load or build FAISS store + chunk JSON, return embedder and title→video_context map.
    Also refreshes title embeddings when the embedding model changes.
    """
    store = load_vector_store(INDEX_PATH, CHUNKS_PATH)

    if store is None:
        raw_transcripts = load_transcript_file()
        videos = parse_transcripts(raw_transcripts)

        VIDEO_CONTEXT_PATH.parent.mkdir(parents=True, exist_ok=True)
        VIDEO_CONTEXT_PATH.write_text(
            json.dumps(videos, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        chunks = chunk_videos(videos)
        chunks = score_argument_chunks(chunks)

        CHUNKS_PATH.parent.mkdir(parents=True, exist_ok=True)
        CHUNKS_PATH.write_text(
            json.dumps(chunks, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        embedder = ChunkEmbedder(
            api_key=settings.gemini_api_key,
            model_name=settings.embedding_model,
            batch_size=settings.embedding_batch_size,
        )
        embeddings, chunks = embedder.embed_chunks(
            chunks,
            cache_path=settings.embedding_chunk_cache_path,
            use_cache=settings.embedding_chunk_cache_enabled,
        )

        store = build_index(embeddings, chunks)
        save_vector_store(store, INDEX_PATH, CHUNKS_PATH)
    else:
        embedder = ChunkEmbedder(
            api_key=settings.gemini_api_key,
            model_name=settings.embedding_model,
            batch_size=settings.embedding_batch_size,
        )

    video_context = json.loads(VIDEO_CONTEXT_PATH.read_text(encoding="utf-8"))
    context_by_title = {v["video_title"]: v for v in video_context}

    te = load_title_embeddings(TITLE_EMB_PATH)
    if te is None or te.model != settings.embedding_model:
        te = build_title_embeddings(video_context, embedder)
        save_title_embeddings(te, TITLE_EMB_PATH)

    return embedder, store, context_by_title


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Political RAG content generator",
    )
    parser.add_argument(
        "--news-url",
        dest="news_urls",
        action="append",
        help="News article URL to scrape (can be passed multiple times). "
        "If provided, overrides NEWS_URLS/NewsAPI.",
    )
    parser.add_argument(
        "--news-text",
        dest="news_texts",
        action="append",
        help="Raw news text/title/summary to respond to (can be passed multiple times). "
        "If provided, skips NewsAPI and scraping.",
    )
    parser.add_argument(
        "--headline",
        type=str,
        default=None,
        help="Non-interactive: headline (use with --sub-headline). Skips the input menu.",
    )
    parser.add_argument(
        "--sub-headline",
        type=str,
        default="",
        help="Non-interactive: sub-headline (optional if --headline is set).",
    )
    parser.add_argument(
        "--build-semrag",
        action="store_true",
        help="Build or update SEMRAG graph from current argument chunks before retrieval.",
    )
    parser.add_argument(
        "--rebuild-semrag",
        action="store_true",
        help="Force re-extraction for all chunks when building SEMRAG graph.",
    )
    return parser.parse_args(argv)


def _news_from_configured_sources(args: argparse.Namespace, settings) -> List[Dict[str, Any]]:
    cli_urls = args.news_urls or []
    effective_urls = cli_urls or settings.news_urls
    if effective_urls:
        return [scrape_article(url) for url in effective_urls]
    if settings.news_api_key:
        return fetch_latest_news(
            api_key=settings.news_api_key,
            country=settings.news_country,
            page_size=settings.news_page_size,
        )
    return []


def _read_multiline_until_dot(prompt: str) -> str:
    print(prompt)
    print("When finished, type a single dot (.) on its own line and press Enter.")
    lines: List[str] = []
    while True:
        try:
            line = input()
        except EOFError:
            break
        if line.strip() == ".":
            break
        lines.append(line)
    return "\n".join(lines).strip()


def _interactive_collect_news_items(args: argparse.Namespace, settings) -> List[Dict[str, Any]]:
    """
    Ask how to supply news, then collect one item (or fall back to configured sources).
    Headline + sub-headline matches the structured news pipeline (title / description).
    """
    while True:
        print()
        print("How do you want to provide the news?")
        print("  1 — Headline + sub-headline (you will be asked for each, one after the other)")
        print("  2 — Paste the full article / body (multiple lines; end with a line containing only . )")
        print("  3 — Paste a news article URL")
        print("  [Enter] — Use configured sources (NEWS_URLS in .env or NewsAPI)")
        choice = input("Choose 1, 2, 3, or press Enter: ").strip()

        if choice == "":
            return _news_from_configured_sources(args, settings)

        if choice == "1":
            headline = input("\nHeadline: ").strip()
            if not headline:
                print("Headline cannot be empty. Try again.")
                continue
            sub_headline = input("Sub-headline: ").strip()
            return [
                {
                    "title": headline,
                    "description": sub_headline,
                    "content": "",
                    "source": "interactive_headline_subheadline",
                }
            ]

        if choice == "2":
            body = _read_multiline_until_dot("\nPaste the full article:")
            if not body:
                print("No text entered. Try again.")
                continue
            return [
                {
                    "title": "",
                    "description": "",
                    "content": body,
                    "source": "interactive_full_article",
                }
            ]

        if choice == "3":
            url = input("\nArticle URL: ").strip()
            if not url:
                print("URL cannot be empty. Try again.")
                continue
            if not (url.startswith("http://") or url.startswith("https://")):
                print("Please enter an http:// or https:// URL. Try again.")
                continue
            return [scrape_article(url)]

        print("Invalid choice. Enter 1, 2, 3, or press Enter for configured sources.")


def _should_prompt_primary_mode(args: argparse.Namespace) -> bool:
    return not args.news_texts and not (args.headline and args.headline.strip())


def _interactive_choose_primary_mode() -> str:
    """
    Initial startup choice:
    - manual: provide news yourself (existing main.py flow)
    - generated: choose from outputs/generated_news.json (generate_posts_from_news.py flow)
    """
    while True:
        print()
        print("Select input mode:")
        print("  1 — Provide news manually (headline/sub-headline, full article, URL, or configured sources)")
        print("  2 — Choose from already generated news (outputs/generated_news.json)")
        choice = input("Choose 1 or 2 (Enter defaults to 2): ").strip()
        if choice == "1":
            return "manual"
        if choice in {"", "2"}:
            return "generated"
        print("Invalid choice. Enter 1 or 2.")


def main(argv: Sequence[str] | None = None) -> None:
    args = parse_args(argv)
    settings = get_settings()
    semrag_cfg = load_semrag_config(BASE_DIR)

    # Initial mode selection when no explicit direct-news CLI args are provided.
    if _should_prompt_primary_mode(args):
        mode = _interactive_choose_primary_mode()
        if mode == "generated":
            # Delegate to existing generated-news picker pipeline.
            from generate_posts_from_news import main as generated_news_main

            generated_news_main([])
            return

    client = OpenAI(api_key=settings.openai_api_key)

    embedder, store, context_by_title = ensure_rag_stack(settings)
    if settings.semrag_enabled and (args.build_semrag or not settings.semrag_graph_path.exists()):
        if args.rebuild_semrag or not settings.semrag_chunks_path.exists():
            video_context = json.loads(VIDEO_CONTEXT_PATH.read_text(encoding="utf-8"))
            semrag_chunks = chunk_videos_for_semrag(video_context, embedder, semrag_cfg)
            semrag_chunks = score_argument_chunks(semrag_chunks)
            save_semrag_chunks(settings.semrag_chunks_path, semrag_chunks)
        else:
            semrag_chunks = json.loads(settings.semrag_chunks_path.read_text(encoding="utf-8"))
        build_semrag_graph(
            chunks=semrag_chunks,
            settings=settings,
            graph_path=settings.semrag_graph_path,
            cache_path=settings.semrag_cache_path,
            force_rebuild=bool(args.rebuild_semrag),
        )

    # 5. Fetch latest news or use CLI / interactive input
    if args.news_texts:
        news_items = [
            {
                "title": txt,
                "description": "",
                "content": txt,
                "source": "cli",
            }
            for txt in args.news_texts
        ]
    elif args.headline and args.headline.strip():
        news_items = [
            {
                "title": args.headline.strip(),
                "description": (args.sub_headline or "").strip(),
                "content": "",
                "source": "cli_headline_subheadline",
            }
        ]
    else:
        news_items = _interactive_collect_news_items(args, settings)

    # 6. Prepare profiles
    profiles = get_user_profiles()

    news_results: List[Dict[str, Any]] = []

    # 6. For each news article, retrieve chunks once and generate posts per profile
    for article in tqdm(news_items, desc="Processing news articles"):
        news_text_for_query = " ".join(
            [
                article.get("title") or "",
                article.get("description") or "",
                article.get("content") or "",
            ]
        ).strip()

        # Shared retrieval at news level
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
            print(f"SEMRAG retrieval fallback for post generation: {exc}")
        retrieved_chunks = retrieve_relevant_chunks(
            news_text=news_text_for_query,
            embedder=embedder,
            store=store,
            top_k=settings.retrieval_top_k,
            retrieval_cfg=retrieval_cfg,
        )

        # Context expansion: gather full transcripts for retrieved chunk videos
        full_contexts = []
        seen_titles = set()
        for c in retrieved_chunks:
            title = c["video_title"]
            if title in seen_titles:
                continue
            vc = context_by_title.get(title)
            if vc:
                full_contexts.append(vc)
                seen_titles.add(title)

        # Build a unified references list for this news item
        references = [
            {
                "chunk_id": c["chunk_id"],
                "video_title": c["video_title"],
                "video_link": c["video_link"],
                "chunk_text": c["chunk_text"],
                "similarity_score": c["similarity_score"],
                "argument_score": c["argument_score"],
                "final_score": c["final_score"],
            }
            for c in retrieved_chunks
        ]

        # Generate posts per profile, sharing the same references
        profile_outputs: List[Dict[str, Any]] = []
        for profile in profiles:
            post_text = generate_post(
                client=client,
                model=settings.openai_model,
                news=article,
                profile=profile,
                retrieved_chunks=retrieved_chunks,
                full_video_contexts=full_contexts,
                temperature=settings.openai_temperature,
            )

            profile_outputs.append(
                {
                    "profile": profile,
                    "post": post_text,
                }
            )

        news_results.append(
            {
                "news": article,
                "references": references,
                "profiles": profile_outputs,
            }
        )

    # Ensure output directory exists
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(news_results, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    # 7. Print a sample output to terminal
    if news_results:
        sample = news_results[0]
        print("\nPOST")
        print("----")
        # Print the first profile's post as a sample
        profiles = sample.get("profiles") or []
        if profiles:
            first_profile = profiles[0]
            print(first_profile.get("post", "").strip())

            print("\nREFERENCES")
            print("----------")
            for ref in sample.get("references", []):
                print(f"Video: {ref['video_title']}")
                print(f"Chunk: {ref['chunk_text']}")
                print()


if __name__ == "__main__":
    main()

