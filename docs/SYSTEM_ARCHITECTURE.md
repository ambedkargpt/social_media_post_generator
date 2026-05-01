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

- FAISS (`faiss-cpu`) for dense vector similarity search.
- BM25 custom lexical retriever for keyword relevance.
- Gemini embeddings via Google GenAI client.
- OpenAI-compatible clients (including DeepSeek base URL path) for generation/extraction tasks.

### UI and Utilities

- Streamlit app entrypoint exists (`streamlit_app/app.py`).
- CLI entrypoints for pipeline and SEMRAG tooling (`run_pipeline.py`, `scripts/*`).
- Pytest configured (`pytest.ini`) for test execution.

## 3) Data Flow (End-to-End)

## A. Ingestion

- Input starts from channel/video sources and transcript fetching.
- `Fetch.py` and orchestration stages download/process transcript text.
- Consolidated transcript outputs are stored to local files and ledgers.

## B. Transcript Parsing and Chunking

- Transcript parser transforms raw text into structured records:
  - `video_title`
  - `video_link`
  - `full_text`
  - optional metadata
- Chunker creates chunk units from long transcript text, generating IDs and metadata.

## C. Retrieval Artifact Build

- Embeddings are generated for chunks/titles/context.
- FAISS index is built for dense similarity retrieval.
- BM25 store is built for lexical search.
- SEMRAG extraction creates entities and relations from chunks.
- Graph artifacts and lookup indexes are persisted:
  - entity-to-chunks
  - relation-to-chunks
  - graph statistics and backups

## D. Query/News Retrieval and Generation

- User query or news text enters retrieval.
- Hybrid retrieval returns top supporting chunks/video contexts.
- Generator consumes retrieved context + profile constraints to produce post outputs.
- Outputs are written to configured files and/or backend persistence.

## 4) Search and Retrieval Techniques

The system is not single-mode retrieval; it uses layered retrieval to improve recall and ranking quality.

### 4.1 Dense Retrieval

- Uses embedding vectors indexed in FAISS.
- Fast nearest-neighbor search over semantic similarity space.

### 4.2 Lexical Retrieval (BM25)

- Keyword/token relevance using BM25 scoring.
- Useful for exact terms, rare names, and query anchoring.

### 4.3 Hybrid Fusion

- Dense and BM25 results are merged using reciprocal rank fusion (RRF)-style ranking.
- Additional controls include candidate limits and video-aware caps.

### 4.4 Query Expansion

- Heuristic bilingual theme/keyword expansion broadens candidate recall.
- Especially useful when user query phrasing differs from transcript phrasing.

### 4.5 Semantic Reranking

- Top hybrid candidates are reranked using embedding-based relevance refinement.
- Final ranking blends base hybrid signal with rerank quality.

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

Configuration is centralized and env-driven.

- `config.py` and SEMRAG config modules define:
  - model/provider keys and model names
  - retrieval thresholds and top-k settings
  - BM25/hybrid/rerank toggles
  - SEMRAG paths and search modes (`local`, `global`, `hybrid`)
  - backend auth/JWT/OTP and Mongo settings
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

- Chunk-level word totals can exceed source transcript totals because chunking may use overlap windows; this is expected in retrieval pipelines.
- Retrieval quality is a combination problem: lexical recall, dense semantic matching, and graph reasoning each contribute differently by query type.
- Prefer stage orchestration for repeatable production runs; use ad-hoc scripts for targeted recovery/debug workflows.

## 10) Suggested Next Improvements

- Add a single architecture diagram (pipeline + backend) in this folder.
- Document exact SEMRAG extraction prompts and quality gates.
- Add benchmark docs (retrieval precision/recall and latency).
- Add dataset/version registry for reproducible experiment tracking.
