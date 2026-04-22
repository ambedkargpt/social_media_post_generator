import os
from dataclasses import dataclass
from pathlib import Path


CHUNKING_MODE = "semantic"  # "paragraph" or "semantic"

# Semantic chunking settings (from SemRAG paper Algorithm 1)
SIMILARITY_THRESHOLD = 0.60
MIN_CHUNK_SENTENCES = 3
MAX_CHUNK_SENTENCES = 30
BUFFER_SENTENCES = 7

# Token-based splitting (when chunks exceed limits)
TOKEN_LIMIT = 1024
OVERLAP_TOKENS = 128

# Character limits as fallback
MIN_CHUNK_CHARS = 600
MAX_CHUNK_CHARS = 2000

# Sentence splitting config
MIN_SENTENCE_LENGTH = 10


@dataclass
class SemragConfig:
    deepseek_api_key: str
    deepseek_base_url: str
    semrag_model: str
    prompts_dir: Path
    semrag_enabled: bool
    semrag_weight: float
    semrag_top_n: int
    semrag_search_mode: str
    semrag_streamlit_force: bool
    semrag_graph_path: Path
    semrag_cache_path: Path
    semrag_chunks_path: Path
    chunking_mode: str
    similarity_threshold: float
    min_chunk_sentences: int
    max_chunk_sentences: int
    buffer_sentences: int
    token_limit: int
    overlap_tokens: int
    min_chunk_chars: int
    max_chunk_chars: int
    min_sentence_length: int


def load_semrag_config(project_root: Path) -> SemragConfig:
    data_semrag_dir = (project_root / "data" / "semrag").resolve()
    prompts_dir_raw = (os.getenv("PROMPTS_DIR") or "").strip()
    prompts_dir = Path(prompts_dir_raw).expanduser().resolve() if prompts_dir_raw else (project_root / "prompts")
    deepseek_base_url = (
        (os.getenv("DEEPSEEK_BASE_URL") or os.getenv("DEEPSEEK_API_URL") or "https://api.deepseek.com")
        .strip()
        .rstrip("/")
    )
    semrag_enabled = os.getenv("SEMRAG_ENABLED", "false").lower() in {"1", "true", "yes", "on"}
    semrag_graph_raw = (os.getenv("SEMRAG_GRAPH_PATH") or "").strip()
    semrag_cache_raw = (os.getenv("SEMRAG_CACHE_PATH") or "").strip()
    semrag_chunks_raw = (os.getenv("SEMRAG_CHUNKS_PATH") or "").strip()
    semrag_search_mode = (os.getenv("SEMRAG_SEARCH_MODE") or "hybrid").strip().lower()
    if semrag_search_mode not in {"local", "global", "hybrid"}:
        semrag_search_mode = "hybrid"
    return SemragConfig(
        deepseek_api_key=(os.getenv("DEEPSEEK_API_KEY") or os.getenv("DEEPSEEK_KEY") or "").strip(),
        deepseek_base_url=deepseek_base_url,
        semrag_model=(os.getenv("SEMRAG_MODEL") or os.getenv("DEEPSEEK_MODEL") or "deepseek-chat").strip(),
        prompts_dir=prompts_dir,
        semrag_enabled=semrag_enabled,
        semrag_weight=float(os.getenv("SEMRAG_WEIGHT", "0.5")),
        semrag_top_n=int(os.getenv("SEMRAG_TOP_N", "120")),
        semrag_search_mode=semrag_search_mode,
        semrag_streamlit_force=os.getenv("SEMRAG_STREAMLIT_FORCE", "true").lower() in {"1", "true", "yes", "on"},
        semrag_graph_path=Path(semrag_graph_raw).expanduser().resolve()
        if semrag_graph_raw
        else (data_semrag_dir / "semrag_graph.json"),
        semrag_cache_path=Path(semrag_cache_raw).expanduser().resolve()
        if semrag_cache_raw
        else (data_semrag_dir / "semrag_extraction_cache.json"),
        semrag_chunks_path=Path(semrag_chunks_raw).expanduser().resolve()
        if semrag_chunks_raw
        else (data_semrag_dir / "semrag_chunks.json"),
        chunking_mode=(os.getenv("SEMRAG_CHUNKING_MODE") or CHUNKING_MODE).strip().lower(),
        similarity_threshold=float(os.getenv("SEMRAG_SIMILARITY_THRESHOLD", str(SIMILARITY_THRESHOLD))),
        min_chunk_sentences=int(os.getenv("SEMRAG_MIN_CHUNK_SENTENCES", str(MIN_CHUNK_SENTENCES))),
        max_chunk_sentences=int(os.getenv("SEMRAG_MAX_CHUNK_SENTENCES", str(MAX_CHUNK_SENTENCES))),
        buffer_sentences=int(os.getenv("SEMRAG_BUFFER_SENTENCES", str(BUFFER_SENTENCES))),
        token_limit=int(os.getenv("SEMRAG_TOKEN_LIMIT", str(TOKEN_LIMIT))),
        overlap_tokens=int(os.getenv("SEMRAG_OVERLAP_TOKENS", str(OVERLAP_TOKENS))),
        min_chunk_chars=int(os.getenv("SEMRAG_MIN_CHUNK_CHARS", str(MIN_CHUNK_CHARS))),
        max_chunk_chars=int(os.getenv("SEMRAG_MAX_CHUNK_CHARS", str(MAX_CHUNK_CHARS))),
        min_sentence_length=int(os.getenv("SEMRAG_MIN_SENTENCE_LENGTH", str(MIN_SENTENCE_LENGTH))),
    )
