# Configuration reference

Every setting is an environment variable. `backend/config.py` builds a single
`Settings` dataclass from them; `backend/core/config.py` re-exports the
`settings` singleton that the rest of the backend imports.

Files are loaded in this order, and the first value found wins:

1. `backend/.env`
2. `<repo root>/.env`
3. The real process environment

Templates: `backend/.env.example` and `frontend/.env.example`. `deploy/README.md`
also instructs you to copy `deploy/env/api.env.example` and
`worker.env.example`, but that directory does not exist in the repository — build
the droplet's `api.env` and `worker.env` from `backend/.env.example` instead. See
[DEPLOYMENT.md](DEPLOYMENT.md).

## Defaults that differ from `.env.example`

Three variables have a code default that does not match the value written in
`backend/.env.example`. The code wins; if you rely on the documented value, set
it explicitly.

| Variable | Code default | `.env.example` says |
|---|---|---|
| `RETRIEVAL_ENABLE_RERANK` | `false` | described as `true` in the `config.py` docstring |
| `REFRESH_TOKEN_EXPIRY_DAYS` | `30` | `7` |
| `NEWS_PAGE_SIZE` | `5` | `20` |

The reranker one matters most: `backend/docs/SYSTEM_ARCHITECTURE.md` and the
docstring in `backend/config.py` both claim the embedding rerank stage is on by
default, but the code reads `os.getenv("RETRIEVAL_ENABLE_RERANK", "false")`
(`backend/config.py:242`). Reranking is off unless you turn it on.

## Database

| Variable | Default | Notes |
|---|---|---|
| `MONGODB_URI` | — | Required. Atlas connection string. |
| `MONGODB_DATABASE` | `ambedkargpt` | |

## Authentication

| Variable | Default | Notes |
|---|---|---|
| `JWT_SECRET` | — | Required. 32+ random characters. |
| `JWT_ALGORITHM` | `HS256` | |
| `ACCESS_TOKEN_EXPIRY_MINUTES` | `30` | |
| `REFRESH_TOKEN_EXPIRY_DAYS` | `30` | |
| `OTP_EXPIRY_MINUTES` | `10` | |
| `OTP_MAX_ATTEMPTS` | `5` | |
| `GOOGLE_CLIENT_ID` | — | ID token is verified client-side, so no client secret is read. |
| `TWOFACTOR_API_KEY` | — | SMS OTP provider. The old Twilio variables are no longer read. |
| `AUTH_DEBUG_RETURN_OTP` | unset | Returns the OTP in the API response. Development only. |

## Language models

| Variable | Default | Notes |
|---|---|---|
| `DEEPSEEK_API_KEY` | — | Required. `DEEPSEEK_KEY` is accepted as an alias. |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | `DEEPSEEK_API_URL` is accepted as an alias. |
| `DEEPSEEK_MODEL` | `deepseek-chat` | General-purpose model handle. |
| `DEEPSEEK_MODEL_SUMMARY` | falls back to `DEEPSEEK_MODEL` | Video summarisation. |
| `POST_GENERATION_MODEL` | `deepseek-chat` | Writes the post. |
| `RESEARCH_MODEL` | `deepseek-chat` | Runs the research step. |
| `OPENAI_API_KEY` | — | Legacy path and the BheemBot chat client. |
| `OPENAI_MODEL` | `gpt-5-nano` | Legacy default from the prototype. |
| `OPENAI_TEMPERATURE` | `1` | |

Keep `POST_GENERATION_MODEL` on a non-reasoning model. The comment in
`backend/.env.example` records what happened otherwise: on `deepseek-reasoner`
the chain-of-thought consumed the whole completion budget and the endpoint
returned an empty post, which surfaces as a `502`. `deepseek-chat` does the same
job in roughly a tenth of the time. Writing is instruction-following, not
deduction.

## Retrieval

| Variable | Default | Notes |
|---|---|---|
| `GEMINI_API_KEY` | — | Required. Embeddings. |
| `EMBEDDING_MODEL` | `gemini-embedding-001` | Dimension is discovered from the API, not hard-coded. |
| `EMBEDDING_BATCH_SIZE` | `25` | |
| `EMBEDDING_CHUNK_CACHE` | `true` | Reuse chunk embeddings from disk. |
| `EMBEDDING_CHUNK_CACHE_PATH` | `data/chunk_embedding_cache.json` | |
| `PINECONE_API_KEY` | — | Required for vector search. |
| `PINECONE_INDEX_NAME` | `ambedkargpt` | |
| `PINECONE_NAMESPACE` | `""` | |
| `RETRIEVAL_TOP_K` | `5` | Chunks handed to the writer. |
| `RETRIEVAL_CANDIDATE_K` | `80` | Candidate pool after fusion. |
| `RETRIEVAL_PER_VIDEO_CAP` | `2` | Stops one video dominating the context. |
| `RETRIEVAL_USE_BM25` | `true` | Lexical leg of the hybrid. |
| `RETRIEVAL_BM25_TOP_N` | `250` | |
| `RETRIEVAL_DENSE_TOP_N` | `250` | |
| `RETRIEVAL_RRF_K` | `60` | Reciprocal-rank-fusion constant. |
| `RETRIEVAL_ENABLE_RERANK` | `false` | Embedding rerank stage. Off by default. |
| `RETRIEVAL_RERANK_TOP_N` | `50` | |
| `RETRIEVAL_RARE_TERM_PROTECT` | `true` | Force high-IDF matches into the pool. |
| `RETRIEVAL_RARE_TERM_MIN_IDF` | `6.0` | |
| `RETRIEVAL_RARE_TERM_FORCE_K` | `20` | |

## SEMRAG chunking and graph

Defined in `backend/semrag/semrag_config.py` (`load_semrag_config`).

| Variable | Default | Notes |
|---|---|---|
| `SEMRAG_CHUNKING_MODE` | `semantic` | Alternative: `paragraph`. |
| `SEMRAG_SIMILARITY_THRESHOLD` | `0.60` | Adjacent-sentence cosine cutoff. |
| `SEMRAG_MIN_CHUNK_SENTENCES` / `SEMRAG_MAX_CHUNK_SENTENCES` | — | Sentence bounds per chunk. |
| `SEMRAG_BUFFER_SENTENCES` | — | Overlap between consecutive chunks. |
| `SEMRAG_TOKEN_LIMIT` / `SEMRAG_OVERLAP_TOKENS` | — | Hard split after semantic merge. |
| `SEMRAG_MAX_CHUNK_CHARS` | — | Character cap per chunk. |
| `SEMRAG_GRAPH_PATH` | `<backend>/data/semrag/semrag_graph.json` | |
| `SEMRAG_CHUNKS_PATH` | `<backend>/data/semrag/semrag_chunks.json` | |
| `SEMRAG_CACHE_PATH` | `<backend>/data/semrag/semrag_extraction_cache.json` | |

## Web research

Off by default. The whole step is skipped unless `WEB_RESEARCH_ENABLED` is set
to a truthy value.

| Variable | Default | Notes |
|---|---|---|
| `WEB_RESEARCH_ENABLED` | unset (off) | |
| `WEB_RESEARCH_MAX_CLAIMS` | `3` | Claims researched per post. |
| `WEB_RESEARCH_TOP_K` | `6` | Results kept per claim. |
| `WEB_RESEARCH_DEBUG_DIR` | unset | Writes every run's prompts, results and pages to disk. |
| `SEARCH_PROVIDER` | `auto` | `auto`, `searxng`, `brave`, `ddg`, or `google`. |
| `SEARXNG_URL` | `http://localhost:8080` | |
| `SEARXNG_AUTH_TOKEN` | unset | Only for an internet-facing SearXNG behind an ALB rule. |
| `BRAVE_SEARCH_API_KEY` | unset | Credits, not a free tier; billing continues past the allowance. |
| `BRAVE_MIN_INTERVAL_SECONDS` | `1.1` | Brave allows one request per second and claims run in parallel. |
| `GOOGLE_CSE_API_KEY` / `GOOGLE_CSE_CX` | unset | Not in the `auto` chain — a new engine can no longer search the whole web. |
| `SEARCH_QUOTA_RETRY_SECONDS` | `1800` | How long a `429`-ing backend stays skipped. |
| `POST_VALIDATION_ENABLED` | `true` | Post-generation validation pass. |
| `RESEARCH_STANCE_MODE` | `angle` | |
| `RESEARCH_PURPOSE` | `support` | |

`auto` walks SearXNG, then Brave, then DuckDuckGo, and steps over any backend
that is unreachable, unconfigured or out of quota. DuckDuckGo sits last because
it needs no key and has no quota, so search never simply stops.

## Artifacts and data paths

| Variable | Default | Notes |
|---|---|---|
| `ARTIFACTS_ROOT` | unset | Root under which `current/manifest.json` is read. Required for `/health/ready` to assess artifacts. |
| `ARTIFACT_MANIFEST_PATH` | unset | Explicit manifest override. |
| `RAG_CHUNKS_PATH` | `<backend>/data/argument_chunks.json` | |
| `GENERATED_NEWS_PATH` / `GENERATED_NEWS_LEGACY_PATH` | unset | Offline news generation outputs. |
| `USER_PROFILES_PARQUET` | unset | Profile table for offline runs. |
| `TRANSCRIPT_MASTER_PATH` | — | Worker only. Source-of-truth transcript file. |

## News ingestion

| Variable | Default |
|---|---|
| `NEWS_API_KEY` | — |
| `NEWS_COUNTRY` | `in` |
| `NEWS_PAGE_SIZE` | `5` |
| `NEWS_URLS` | unset |
| `NEWS_GENERATOR_TOP_N` | `10` |
| `NEWS_STORIES_PER_VIDEO` | `4` |

## Transcript processing and prompts

Prompt variables name a file under the prompts directory rather than holding
prompt text. The templates live in `backend/prompts/`.

| Variable | Default |
|---|---|
| `TRANSCRIPT_CLEANING_ENABLED` | `true` |
| `TRANSCRIPT_CLEANING_SYSTEM` | `transcript_cleaning_system.txt` |
| `TRANSCRIPT_CLEANING_USER` | `transcript_cleaning_user.txt` |
| `NEWS_HEADLINE_SYSTEM` / `NEWS_HEADLINE_USER` | corresponding files |
| `NEWS_MULTI_STORY_SYSTEM` / `NEWS_MULTI_STORY_USER` | corresponding files |
| `HINDI_STYLE_REFERENCE` | `hindi_style_reference.txt` |
| `SUMMARY_BATCH_SIZE` | `50` |
| `SUMMARY_SLEEP_SECONDS` | `2` |
| `GTTS_LANG` | `hi` |

## Contact form

| Variable | Default | Notes |
|---|---|---|
| `SMTP_HOST` | — | |
| `SMTP_PORT` | `587` | |
| `SMTP_USER` | — | Gmail requires an App Password, not the account password. |
| `SMTP_PASSWORD` | — | 16 characters, no spaces. |
| `CONTACT_FROM_EMAIL` | `SMTP_USER`, else `no-reply@ambedkargpt.in` | Gmail rewrites `From` to the authenticated account. |
| `CONTACT_RECIPIENT_EMAIL` | a hard-coded personal Gmail address | See `backend/config.py:346`. |

The default recipient is a developer's personal Gmail account compiled into
`config.py`. Any deployment that does not set `CONTACT_RECIPIENT_EMAIL` will
silently mail contact submissions there. Set it explicitly in every environment.

Do not point `SMTP_HOST` at a capture-only host such as a Mailtrap sandbox: it
accepts mail, displays it in a web UI, and never delivers. Verify with
`python -m backend.scripts.check_contact_email`.

## Web server

| Variable | Default | Notes |
|---|---|---|
| `CORS_ORIGINS` | unset | Comma-separated. Unset falls back to `*` outside production and blocks requests in production. |
| `APP_ENV` | `development` | |
| `PORT` | `8000` | |
| `HOST` | `0.0.0.0` | |
| `GUNICORN_BIND` | `127.0.0.1:8000` | |
| `WEB_CONCURRENCY` | `cpu_count * 2 + 1` | |
| `GUNICORN_TIMEOUT` | `600` | Generation regularly exceeds the 120 s default. |
| `GUNICORN_GRACEFUL_TIMEOUT` | `120` | |
| `GUNICORN_KEEPALIVE` | `5` | |

`deploy/README.md` refers to `ALLOWED_ORIGINS`. Nothing reads that name —
`backend/core/http.py:85` reads `CORS_ORIGINS`. Setting only `ALLOWED_ORIGINS`
leaves CORS unconfigured, and in production that blocks every browser request.

## Frontend

Vite inlines these at build time, so a change needs a rebuild.

| Variable | Notes |
|---|---|
| `VITE_API_URL` | Must include the `/api/v1` suffix. |
| `VITE_GOOGLE_CLIENT_ID` | Must match the backend `GOOGLE_CLIENT_ID`. |
