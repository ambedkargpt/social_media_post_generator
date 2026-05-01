import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv
from semrag.semrag_config import load_semrag_config


load_dotenv()

# Repository root (parent of ``backend/``). Used for SEMRAG defaults and RAG artifact paths.
_REPO_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = _REPO_ROOT


def _default_dev_origins() -> list[str]:
    return [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]


def _parse_allowed_origins(app_env: str) -> list[str]:
    raw = (os.getenv("ALLOWED_ORIGINS") or "").strip()
    if raw:
        return [x.strip() for x in raw.split(",") if x.strip()]
    if app_env == "production":
        return []
    return _default_dev_origins()


@dataclass
class Settings:
    openai_api_key: str
    openai_model: str
    gemini_api_key: str
    embedding_model: str
    # News configuration (either URLs or API)
    news_urls: list
    news_api_key: str
    news_country: str
    news_page_size: int
    # Retrieval configuration
    retrieval_top_k: int
    retrieval_candidate_k: int
    retrieval_per_video_cap: int
    retrieval_use_bm25: bool
    retrieval_bm25_top_n: int
    retrieval_dense_top_n: int
    retrieval_rrf_k: int
    retrieval_enable_rerank: bool
    retrieval_rerank_top_n: int
    retrieval_rare_term_protect: bool
    retrieval_rare_term_min_idf: float
    retrieval_rare_term_force_k: int
    semrag_enabled: bool
    semrag_graph_path: Path
    semrag_cache_path: Path
    semrag_chunks_path: Path
    semrag_weight: float
    semrag_top_n: int
    semrag_model: str
    semrag_search_mode: str
    semrag_streamlit_force: bool
    # RAG on-disk artifacts (FAISS + chunks + helpers)
    faiss_index_path: Path
    rag_chunks_path: Path
    rag_video_context_path: Path
    rag_title_embeddings_path: Path
    # LLM generation configuration
    openai_temperature: float
    # Embedding configuration
    embedding_batch_size: int
    embedding_chunk_cache_enabled: bool
    embedding_chunk_cache_path: Path
    # Video summarization configuration (DeepSeek OpenAI-compatible API)
    summary_batch_size: int
    summary_sleep_seconds: float
    deepseek_api_key: str
    deepseek_base_url: str
    deepseek_model: str
    deepseek_summary_model: str
    # Prompt templates (video summarizer, etc.)
    prompts_dir: Path
    # Generated news headlines (from video summaries + DeepSeek reasoner)
    news_generator_top_n: int
    generated_news_path: Path
    generated_news_legacy_path: Path
    news_headline_prompt_system: str
    news_headline_prompt_user: str
    # User profiles on disk (Parquet)
    user_profiles_parquet_path: Path
    # gTTS (optional; Streamlit / test_retrieval --tts)
    gtts_lang: str
    # Backend / MongoDB configuration
    mongodb_uri: str
    mongodb_database: str
    # Auth / security configuration
    jwt_secret: str
    jwt_algorithm: str
    access_token_expiry_minutes: int
    refresh_token_expiry_days: int
    otp_expiry_minutes: int
    otp_max_attempts: int
    google_client_id: str
    auth_debug_return_otp: bool
    app_env: str
    allowed_origins: list[str]
    # Optional: artifact promotion layout (/data/artifacts) — see deploy/README.md
    artifacts_root: Path | None
    artifact_manifest_path: Path | None


def get_settings() -> Settings:
    """
    Load configuration from environment variables.

    See repository docs for full variable list. Production mode (APP_ENV=production)
    requires MONGODB_URI, JWT_SECRET, DEEPSEEK_API_KEY, and ALLOWED_ORIGINS.
    """
    openai_api_key = os.getenv("OPENAI_API_KEY", "")
    openai_model = os.getenv("OPENAI_MODEL", "gpt-5-nano")
    gemini_api_key = os.getenv("GEMINI_API_KEY", "")
    embedding_model = os.getenv("EMBEDDING_MODEL", "gemini-embedding-001")
    news_urls_raw = os.getenv("NEWS_URLS", "")
    news_urls = [u.strip() for u in news_urls_raw.split(",") if u.strip()]
    news_api_key = os.getenv("NEWS_API_KEY") or os.getenv("news_api_key", "")
    news_country = os.getenv("NEWS_COUNTRY", "in")
    news_page_size = int(os.getenv("NEWS_PAGE_SIZE", "5"))
    retrieval_top_k = int(os.getenv("RETRIEVAL_TOP_K", "5"))
    retrieval_candidate_k = int(os.getenv("RETRIEVAL_CANDIDATE_K", "80"))
    retrieval_per_video_cap = int(os.getenv("RETRIEVAL_PER_VIDEO_CAP", "2"))
    retrieval_use_bm25 = os.getenv("RETRIEVAL_USE_BM25", "true").lower() in {"1", "true", "yes", "on"}
    retrieval_bm25_top_n = int(os.getenv("RETRIEVAL_BM25_TOP_N", "250"))
    retrieval_dense_top_n = int(os.getenv("RETRIEVAL_DENSE_TOP_N", "250"))
    retrieval_rrf_k = int(os.getenv("RETRIEVAL_RRF_K", "60"))
    retrieval_enable_rerank = os.getenv("RETRIEVAL_ENABLE_RERANK", "true").lower() in {"1", "true", "yes", "on"}
    retrieval_rerank_top_n = int(os.getenv("RETRIEVAL_RERANK_TOP_N", "50"))
    retrieval_rare_term_protect = os.getenv("RETRIEVAL_RARE_TERM_PROTECT", "true").lower() in {
        "1",
        "true",
        "yes",
        "on",
    }
    retrieval_rare_term_min_idf = float(os.getenv("RETRIEVAL_RARE_TERM_MIN_IDF", "6.0"))
    retrieval_rare_term_force_k = int(os.getenv("RETRIEVAL_RARE_TERM_FORCE_K", "20"))
    semrag_cfg = load_semrag_config(_REPO_ROOT)
    semrag_enabled = semrag_cfg.semrag_enabled
    semrag_graph_path = semrag_cfg.semrag_graph_path
    semrag_cache_path = semrag_cfg.semrag_cache_path
    semrag_weight = semrag_cfg.semrag_weight
    semrag_top_n = semrag_cfg.semrag_top_n
    semrag_search_mode = semrag_cfg.semrag_search_mode
    semrag_streamlit_force = semrag_cfg.semrag_streamlit_force
    openai_temperature = float(os.getenv("OPENAI_TEMPERATURE", "1"))
    embedding_batch_size = int(os.getenv("EMBEDDING_BATCH_SIZE", "25"))
    embedding_chunk_cache_enabled = os.getenv("EMBEDDING_CHUNK_CACHE", "true").lower() in {
        "1",
        "true",
        "yes",
        "on",
    }
    _emb_cache_raw = (os.getenv("EMBEDDING_CHUNK_CACHE_PATH") or "").strip()
    embedding_chunk_cache_path = (
        Path(_emb_cache_raw).expanduser().resolve()
        if _emb_cache_raw
        else (_REPO_ROOT / "data" / "chunk_embedding_cache.json").resolve()
    )

    _faiss_raw = (os.getenv("FAISS_INDEX_PATH") or "").strip()
    faiss_index_path = (
        Path(_faiss_raw).expanduser().resolve()
        if _faiss_raw
        else (_REPO_ROOT / "outputs" / "faiss_index.bin").resolve()
    )
    _rag_chunks_raw = (os.getenv("RAG_CHUNKS_PATH") or "").strip()
    rag_chunks_path = (
        Path(_rag_chunks_raw).expanduser().resolve()
        if _rag_chunks_raw
        else (_REPO_ROOT / "data" / "argument_chunks.json").resolve()
    )
    _rag_vc_raw = (os.getenv("RAG_VIDEO_CONTEXT_PATH") or "").strip()
    rag_video_context_path = (
        Path(_rag_vc_raw).expanduser().resolve()
        if _rag_vc_raw
        else (_REPO_ROOT / "data" / "video_context.json").resolve()
    )
    _rag_te_raw = (os.getenv("RAG_TITLE_EMBEDDINGS_PATH") or "").strip()
    rag_title_embeddings_path = (
        Path(_rag_te_raw).expanduser().resolve()
        if _rag_te_raw
        else (_REPO_ROOT / "data" / "video_title_embeddings.json").resolve()
    )

    summary_batch_size = int(os.getenv("SUMMARY_BATCH_SIZE", "50"))
    summary_sleep_seconds = float(os.getenv("SUMMARY_SLEEP_SECONDS", "2"))
    deepseek_api_key = (os.getenv("DEEPSEEK_API_KEY") or os.getenv("DEEPSEEK_KEY") or "").strip()
    deepseek_base_url = (
        (
            os.getenv("DEEPSEEK_BASE_URL")
            or os.getenv("DEEPSEEK_API_URL")
            or "https://api.deepseek.com"
        )
        .strip()
        .rstrip("/")
    )
    deepseek_model = (os.getenv("DEEPSEEK_MODEL") or "deepseek-chat").strip()
    semrag_model = semrag_cfg.semrag_model
    _summary_model_raw = (os.getenv("DEEPSEEK_MODEL_SUMMARY") or "").strip()
    deepseek_summary_model = _summary_model_raw or deepseek_model
    prompts_dir = semrag_cfg.prompts_dir
    news_generator_top_n = int(os.getenv("NEWS_GENERATOR_TOP_N", "10"))
    _gen_news_raw = (os.getenv("GENERATED_NEWS_PATH") or "").strip()
    generated_news_path = (
        Path(_gen_news_raw).expanduser().resolve()
        if _gen_news_raw
        else (_REPO_ROOT / "outputs" / "generated_news.json").resolve()
    )
    _gen_news_legacy_raw = (os.getenv("GENERATED_NEWS_LEGACY_PATH") or "").strip()
    generated_news_legacy_path = (
        Path(_gen_news_legacy_raw).expanduser().resolve()
        if _gen_news_legacy_raw
        else (_REPO_ROOT / "outputs" / "generated_news_legacy.json").resolve()
    )
    news_headline_prompt_system = (os.getenv("NEWS_HEADLINE_SYSTEM") or "news_headline_system.txt").strip()
    news_headline_prompt_user = (os.getenv("NEWS_HEADLINE_USER") or "news_headline_user.txt").strip()
    _profiles_parquet_raw = (os.getenv("USER_PROFILES_PARQUET") or "").strip()
    user_profiles_parquet_path = (
        Path(_profiles_parquet_raw).expanduser().resolve()
        if _profiles_parquet_raw
        else (_REPO_ROOT / "data" / "user_profiles.parquet").resolve()
    )
    gtts_lang = (os.getenv("GTTS_LANG") or "hi").strip() or "hi"
    mongodb_uri = (os.getenv("MONGODB_URI") or "").strip()
    mongodb_database = (os.getenv("MONGODB_DATABASE") or "ambedkargpt").strip() or "ambedkargpt"
    jwt_secret = (os.getenv("JWT_SECRET") or "").strip()
    jwt_algorithm = (os.getenv("JWT_ALGORITHM") or "HS256").strip() or "HS256"
    access_token_expiry_minutes = int(os.getenv("ACCESS_TOKEN_EXPIRY_MINUTES", "30"))
    refresh_token_expiry_days = int(os.getenv("REFRESH_TOKEN_EXPIRY_DAYS", "30"))
    otp_expiry_minutes = int(os.getenv("OTP_EXPIRY_MINUTES", "10"))
    otp_max_attempts = int(os.getenv("OTP_MAX_ATTEMPTS", "5"))
    google_client_id = (os.getenv("GOOGLE_CLIENT_ID") or "").strip()
    auth_debug_return_otp = os.getenv("AUTH_DEBUG_RETURN_OTP", "false").lower() in {"1", "true", "yes", "on"}
    app_env = (os.getenv("APP_ENV") or "development").strip().lower() or "development"
    allowed_origins = _parse_allowed_origins(app_env)

    _artifacts_root_raw = (os.getenv("ARTIFACTS_ROOT") or "").strip()
    artifacts_root = Path(_artifacts_root_raw).expanduser().resolve() if _artifacts_root_raw else None
    _manifest_raw = (os.getenv("ARTIFACT_MANIFEST_PATH") or "").strip()
    artifact_manifest_path = Path(_manifest_raw).expanduser().resolve() if _manifest_raw else None

    if app_env == "production":
        auth_debug_return_otp = False
        if not mongodb_uri:
            raise ValueError("MONGODB_URI is required when APP_ENV=production.")
        if not jwt_secret:
            raise ValueError("JWT_SECRET is required when APP_ENV=production.")
        if not deepseek_api_key:
            raise ValueError("DEEPSEEK_API_KEY is required when APP_ENV=production.")
        if not allowed_origins:
            raise ValueError(
                "ALLOWED_ORIGINS must be set (comma-separated) when APP_ENV=production."
            )

    if not openai_api_key:
        raise ValueError("OPENAI_API_KEY is not set in the environment.")
    if not gemini_api_key:
        raise ValueError("GEMINI_API_KEY is not set in the environment (required for embeddings).")

    return Settings(
        openai_api_key=openai_api_key,
        openai_model=openai_model,
        gemini_api_key=gemini_api_key,
        embedding_model=embedding_model,
        news_urls=news_urls,
        news_api_key=news_api_key,
        news_country=news_country,
        news_page_size=news_page_size,
        retrieval_top_k=retrieval_top_k,
        retrieval_candidate_k=retrieval_candidate_k,
        retrieval_per_video_cap=retrieval_per_video_cap,
        retrieval_use_bm25=retrieval_use_bm25,
        retrieval_bm25_top_n=retrieval_bm25_top_n,
        retrieval_dense_top_n=retrieval_dense_top_n,
        retrieval_rrf_k=retrieval_rrf_k,
        retrieval_enable_rerank=retrieval_enable_rerank,
        retrieval_rerank_top_n=retrieval_rerank_top_n,
        retrieval_rare_term_protect=retrieval_rare_term_protect,
        retrieval_rare_term_min_idf=retrieval_rare_term_min_idf,
        retrieval_rare_term_force_k=retrieval_rare_term_force_k,
        semrag_enabled=semrag_enabled,
        semrag_graph_path=semrag_graph_path,
        semrag_cache_path=semrag_cache_path,
        semrag_chunks_path=semrag_cfg.semrag_chunks_path,
        semrag_weight=semrag_weight,
        semrag_top_n=semrag_top_n,
        semrag_model=semrag_model,
        semrag_search_mode=semrag_search_mode,
        semrag_streamlit_force=semrag_streamlit_force,
        faiss_index_path=faiss_index_path,
        rag_chunks_path=rag_chunks_path,
        rag_video_context_path=rag_video_context_path,
        rag_title_embeddings_path=rag_title_embeddings_path,
        openai_temperature=openai_temperature,
        embedding_batch_size=embedding_batch_size,
        embedding_chunk_cache_enabled=embedding_chunk_cache_enabled,
        embedding_chunk_cache_path=embedding_chunk_cache_path,
        summary_batch_size=summary_batch_size,
        summary_sleep_seconds=summary_sleep_seconds,
        deepseek_api_key=deepseek_api_key,
        deepseek_base_url=deepseek_base_url,
        deepseek_model=deepseek_model,
        deepseek_summary_model=deepseek_summary_model,
        prompts_dir=prompts_dir,
        news_generator_top_n=news_generator_top_n,
        generated_news_path=generated_news_path,
        generated_news_legacy_path=generated_news_legacy_path,
        news_headline_prompt_system=news_headline_prompt_system,
        news_headline_prompt_user=news_headline_prompt_user,
        user_profiles_parquet_path=user_profiles_parquet_path,
        gtts_lang=gtts_lang,
        mongodb_uri=mongodb_uri,
        mongodb_database=mongodb_database,
        jwt_secret=jwt_secret,
        jwt_algorithm=jwt_algorithm,
        access_token_expiry_minutes=access_token_expiry_minutes,
        refresh_token_expiry_days=refresh_token_expiry_days,
        otp_expiry_minutes=otp_expiry_minutes,
        otp_max_attempts=otp_max_attempts,
        google_client_id=google_client_id,
        auth_debug_return_otp=auth_debug_return_otp,
        app_env=app_env,
        allowed_origins=allowed_origins,
        artifacts_root=artifacts_root,
        artifact_manifest_path=artifact_manifest_path,
    )


def effective_artifact_manifest_path(settings: Settings) -> Path | None:
    """Resolved manifest.json path: explicit env, or ``ARTIFACTS_ROOT/current/manifest.json``."""
    if settings.artifact_manifest_path:
        return settings.artifact_manifest_path
    if settings.artifacts_root:
        return (settings.artifacts_root / "current" / "manifest.json").resolve()
    return None
