# SemRAG System Architecture

This document explains how the project works end-to-end: data flow, technology stack, search and retrieval techniques, orchestration, and backend APIs.

## 1) High-Level Overview

The repository combines three major capabilities:

- A transcript ingestion and processing pipeline.
- A retrieval system (classic RAG + graph-augmented SEMRAG).
- A FastAPI backend for auth, content, profile, and post workflows.

Core runtime path:

1. Fetch and consolidate YouTube transcript data.
2. Parse and chunk transcripts.
3. Build retrieval artifacts (embeddings, BM25 index, SEMRAG graph).
4. Retrieve relevant context for queries/news.
5. Generate profile-specific posts/content.
6. Expose operational and user-facing APIs via backend services.

## 2) Tech Stack

### Languages and Runtime

- Python is the primary language across ingestion, retrieval, orchestration, and backend.

### API and Service Layer

- FastAPI for backend APIs (`backend/main.py`, `backend/api/v1/*`).
- Pydantic schemas for request/response validation (`backend/schemas/*`).

### Data and Storage

- MongoDB (`pymongo`) for backend domain data and collections.
- JSON artifacts for pipeline and SEMRAG intermediate/final outputs (`data/semrag/*`, `outputs/*`).

### Retrieval/ML Tooling

- FAISS (`faiss-cpu`) for dense vector similarity search (`pipeline/vector_store.py`).
- BM25 custom lexical retriever for keyword relevance (`pipeline/bm25_store.py`).
- **Gemini embeddings** via Google GenAI SDK (`google-genai`): `ChunkEmbedder` in `pipeline/embedder.py` calls `client.models.embed_content`.
- OpenAI-compatible clients (including DeepSeek base URL path) for LLM generation and SEMRAG entity/relation extraction (`semrag/build.py`, `semrag/semrag_config.py`).

### UI and Utilities

- Streamlit app entrypoint exists (`streamlit_app/app.py`).
- CLI entrypoints for pipeline and SEMRAG tooling (`run_pipeline.py`, `scripts/*`).
- Pytest configured (`pytest.ini`) for test execution.

## 3) Data Flow (End-to-End)

### A. Ingestion

- Input starts from channel/video sources and transcript fetching.
- `Fetch.py` and orchestration stages download/process transcript text.
- Consolidated transcript outputs are stored to local files and ledgers.

### B. Transcript Parsing and Chunking (two distinct strategies)

The repo maintains **two chunk pipelines**. They are easy to confuse because both produce `chunk_text` records, but only one is “semantic” in the embedding sense.

#### B.1 RAG / main pipeline chunking — sentence windows + overlap (not embedding-based)

- **Module:** `pipeline/chunker.py` (`chunk_videos`).
- **Behavior:** Clean transcript lines → paragraph/line split → **sentence segmentation** (Hindi/English punctuation: `। ? ! .`) → **`_chunk_sentences`**: overlapping **word-token** windows (defaults roughly **220–300 tokens** per window with **~60-token overlap**, plus guards like `max_chars`).
- **Semantics:** This is **structural / heuristic chunking** for argument-sized spans. It does **not** call an embedding model to decide boundaries.
- **Optional scoring:** `pipeline/argument_scorer.py` can assign an `argument_score` to chunks after creation (separate from boundary detection).

#### B.2 SEMRAG chunking — embedding-based semantic boundaries

- **Module:** `semrag/chunking.py` (`chunk_videos_for_semrag`).
- **Mode:** Controlled by `SEMRAG_CHUNKING_MODE` (default **`semantic`** per `semrag/semrag_config.py`). Alternate **`paragraph`** mode joins sentences into one chunk per video (still subject to token/char splitting).
- **Semantic path (default):**
  1. Sentences via `split_sentences` (with Devanagari-aware splitting and fallbacks).
  2. Each sentence is embedded with the **same Gemini embedding model** as the rest of the stack (`_embed_sentences_batched` uses `embedder.client.models.embed_content`).
  3. Adjacent-sentence similarity is **cosine similarity** of consecutive normalized sentence vectors (`dot product` after L2 normalization).
  4. `_semantic_chunks_from_sims` merges sentences into chunks until adjacent similarity drops below **`similarity_threshold`** (default **0.60**), respecting **`min_chunk_sentences`** / **`max_chunk_sentences`** and **`buffer_sentences`** for overlap between chunks — aligned with the SemRAG paper’s Algorithm 1 comment in code.
- **Fallback:** If embedding fails or no embedder is passed, adjacent similarity falls back to **Jaccard similarity over whitespace-token sets** (`_adjacent_similarity_fallback`) — still boundary-driven, but lexical rather than neural.
- **Post-processing:** Large semantic spans are further split by **token limit** (`TOKEN_LIMIT` / `OVERLAP_TOKENS`, env-overridable) and **character limit** (`MAX_CHUNK_CHARS`) so chunks fit downstream LLM context.

### C. Retrieval Artifact Build

- Embeddings are generated for chunks/titles/context.
- FAISS index is built for dense similarity retrieval.
- BM25 store is built for lexical search.
- SEMRAG extraction creates entities and relations from chunks.
- Graph artifacts and lookup indexes are persisted:
  - entity-to-chunks
  - relation-to-chunks
  - graph statistics and backups

### D. Query/News Retrieval and Generation

- User query or news text enters retrieval.
- Hybrid retrieval returns top supporting chunks/video contexts.
- Generator consumes retrieved context + profile constraints to produce post outputs.
- Outputs are written to configured files and/or backend persistence.

## 4) Search and Retrieval Techniques

Primary implementation: **`pipeline/retriever.py`** (`retrieve_relevant_chunks`). The system is layered: dense + lexical → rank fusion → optional embedding rerank → filters and per-video caps.

### 4.1 Dense Retrieval (FAISS)

- Query (and expanded queries) are embedded with **`ChunkEmbedder.embed_query`**.
- **FAISS** returns top indices by similarity (`pipeline/vector_store.search`); embeddings are built so **inner product matches cosine** on L2-normalized vectors.

### 4.2 Lexical Retrieval (BM25)

- A **`BM25Store`** is built over all chunk texts when needed (`BM25Store.build`).
- Top BM25 documents per query contribute ranks for fusion.

### 4.3 Reciprocal Rank Fusion (RRF) — merging FAISS and BM25

**Yes, RRF is used** to combine dense and lexical rankings.

- For each **weighted** query variant (raw news text weight **1.0**, each expansion weight **0.7** from `pipeline/query_expander.py`):
  - Dense list → rank `d_rank`.
  - BM25 list → rank `b_rank`.
  - Per chunk index, contribution is **`1/(rrf_k + d_rank)`** if present in dense hits, plus **`1/(rrf_k + b_rank)`** if present in BM25 hits.
- Default **`rrf_k`** is **60** (`RRF_K` in `pipeline/retriever.py`; override via **`RETRIEVAL_RRF_K`** in `backend/config.py` → retrieval cfg).
- **Soft title bias:** small bonus (+0.01) if chunk’s `video_title` is in the candidate title set.
- **Rare-term protection:** high-IDF query tokens can **force** extra BM25 candidate indices into the union before fusion.
- Scores from multiple query variants **sum** into `hybrid_score` / `final_score` (before rerank).
- When SEMRAG is enabled, graph-derived candidates can receive an additional **RRF-style bonus** from their graph rank (`1/(rrf_k + rank) * semrag_weight`).

### 4.4 Query Expansion

- Heuristic bilingual theme/keyword expansion broadens candidate recall.
- Especially useful when user query phrasing differs from transcript phrasing.

### 4.5 Reranking — Gemini embeddings, **not** a cross-encoder

**There is no cross-encoder reranker** (no `CrossEncoder`, no bi-encoder pair model for rerank). The second stage is **the same embedding model** as retrieval:

1. After RRF, candidates are truncated to `final_candidate_k` (see config).
2. If **`RETRIEVAL_ENABLE_RERANK`** is true (default **true** in `backend/config.py`):
   - Take the top **`rerank_top_n`** rows (default **50**, `RERANK_TOP_N`).
   - **Re-embed** the raw news query once and **re-embed each chunk’s `chunk_text`** via `embedder.embed_texts(..., desc="Reranking chunks")`.
   - **Rerank score** = **dot product** of normalized vectors (= cosine similarity).
   - **`final_score` = 0.7 * rerank_sim + 0.3 * hybrid_score`** (hybrid = fused RRF score).
3. List is sorted again by `final_score`.

So the pipeline is: **FAISS + BM25 → RRF → embedding cosine rerank**, not **cross-encoder**.

### 4.6 Graph-Augmented SEMRAG Retrieval

- Local graph search: directly matched entities/relations near the query intent.
- Global graph search: multi-hop traversal with score propagation/decay.
- Hybrid graph mode: combines local and global graph evidence.
- Fallback path: if graph returns weak/no hits, system falls back to dense+BM25 retrieval.

## 5) Orchestration and Reliability

Pipeline execution is stage-based and resumable.

### Stage Model

Typical stage chain:

1. Ingestion
2. RAG/SEMRAG build
3. Video summaries
4. News generation
5. Publish/output

### Reliability Features

- Run state persisted under `outputs/runs/*`.
- Stage metrics and artifacts captured per run.
- Resume mode uses fingerprints (path/mtime/size) to skip unchanged work.
- Dry-run/plan mode available via orchestrator CLI.
- SEMRAG scripts support checkpointing, backup merges, validation, and graph rebuild after interruption.

## 6) Backend API Architecture

The backend is organized by route modules, services, repositories, and schemas.

### API Domains

- `auth`: signup/login/OTP/google/refresh/logout/me
- `news`: create/list/get/update and migration support
- `questions`: profile question catalog APIs
- `profile`: user profile answer APIs with validation
- `posts`: post lifecycle, dashboard, archive/status operations
- `health`: readiness/liveness and service checks

### Layering

- Routers (`backend/api/v1/*`) for endpoint contracts.
- Services (`backend/services/*`) for business rules.
- Repositories (`backend/repositories/*`) for DB access.
- DB setup/indexing (`backend/db/*`) for constraints and performance.
- Shared HTTP/middleware/error handling (`backend/core/http.py`).

## 7) Config and Environment Conventions

Configuration is centralized and env-driven. Root `config.py` re-exports **`backend.config`** (`get_settings()`).

### 7.1 Gemini embedding model

- **Environment variable:** **`EMBEDDING_MODEL`**
- **Default:** **`gemini-embedding-001`** (see `backend/config.py` and `pipeline/embedder.py` default on `ChunkEmbedder`).
- **API:** `GEMINI_API_KEY` is required for embedding calls (validated in settings).
- **Notes:** Code comments state dimension is **not fixed** (e.g. often **3072** for `gemini-embedding-001`); the embedder discovers dimension from the API/cache rather than hard-coding 768.

### 7.2 Retrieval fusion and rerank (env)

| Variable | Role |
|----------|------|
| `RETRIEVAL_RRF_K` | RRF constant `k` (default **60**). |
| `RETRIEVAL_ENABLE_RERANK` | Toggle embedding rerank stage (default **true**). |
| `RETRIEVAL_RERANK_TOP_N` | How many top fused candidates to rerank (default **50**). |

Other retrieval knobs (candidate pool sizes, BM25 on/off, SEMRAG weight, etc.) are exposed on the same settings object — see `backend/config.py` for the full list.

### 7.3 SEMRAG chunking (env)

| Variable | Role |
|----------|------|
| `SEMRAG_CHUNKING_MODE` | `semantic` (default) vs `paragraph`. |
| `SEMRAG_SIMILARITY_THRESHOLD` | Adjacent sentence similarity cutoff (default **0.60**). |
| `SEMRAG_MIN_CHUNK_SENTENCES` / `SEMRAG_MAX_CHUNK_SENTENCES` | Bounds on sentences per chunk. |
| `SEMRAG_BUFFER_SENTENCES` | Overlap between consecutive semantic chunks. |
| `SEMRAG_TOKEN_LIMIT` / `SEMRAG_OVERLAP_TOKENS` | Hard split after semantic merge. |
| `SEMRAG_MAX_CHUNK_CHARS` | Character cap per chunk. |

Defined in `semrag/semrag_config.py` (`load_semrag_config`).

- Channel-specific JSON config under `config/channels/*` controls file paths and stage behavior per channel.

## 8) Key Entry Points and Commands

Main operational entrypoints:

- `run_pipeline.py` - stage orchestration, resume, selective stage execution.
- `Fetch.py` - fetch + process flow (or delegates to orchestrator based on mode).
- `main.py` - retrieval + generation flow from news/input.
- `generate_posts_from_news.py` - post generation from selected generated news.
- `scripts/semrag_*` - extraction batches, recovery, validation, local/global search CLIs.
- `scripts/build_semrag_graph_from_extracted.py` - graph reconstruction from extracted artifacts.

## 9) Practical Notes

- Chunk-level word totals can exceed source transcript totals because **RAG chunking uses explicit overlap** and **SEMRAG uses buffer overlap plus token/char splitting**; counting words across all chunks double-counts boundary text.
- Retrieval quality is a combination problem: lexical recall, dense semantic matching, graph reasoning, and (when enabled) a second embedding pass over chunk text.
- Prefer stage orchestration for repeatable production runs; use ad-hoc scripts for targeted recovery/debug workflows.

## 10) Quick reference — common questions

| Question | Answer |
|----------|--------|
| Where is **semantic chunking**? | **`semrag/chunking.py`** when `SEMRAG_CHUNKING_MODE=semantic`: sentence embeddings → adjacent cosine similarity → merge/split per `semrag/semrag_config.py`. |
| Where is **non-semantic / RAG chunking**? | **`pipeline/chunker.py`**: sentence segmentation + fixed token windows and overlap. |
| Do we use **RRF** for FAISS + BM25? | **Yes** — `pipeline/retriever.py` fuses dense rank and BM25 rank with **`1/(k+rank)`** terms (plus optional title bias and SEMRAG bonus). |
| Do we use a **cross-encoder** reranker? | **No.** Reranking is **query + chunk re-embedding** with the **same Gemini embedding model** and cosine/dot score; see `retrieve_relevant_chunks` rerank block. |
| Which **Gemini embedding** model? | Default **`gemini-embedding-001`** via **`EMBEDDING_MODEL`** (`backend/config.py`, `pipeline/embedder.py`). |

## 11) Suggested Next Improvements

- Add a single architecture diagram (pipeline + backend) in this folder.
- Document exact SEMRAG extraction prompts and quality gates.
- Add benchmark docs (retrieval precision/recall and latency).
- Add dataset/version registry for reproducible experiment tracking.
