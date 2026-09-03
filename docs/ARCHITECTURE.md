# Architecture

## Runtime components

```
                    ┌──────────────────────────────┐
   Browser ───────► │  Nginx (droplet) / CloudFront │
                    │  SPA static files + /api proxy │
                    └───────────────┬──────────────┘
                                    │
                    ┌───────────────▼──────────────┐
                    │  FastAPI app (backend/main)  │
                    │  Gunicorn+Uvicorn, or Lambda │
                    │  via Mangum (main_lambda)    │
                    └──┬────────┬────────┬─────────┘
                       │        │        │
        ┌──────────────▼┐  ┌────▼─────┐  ▼──────────────────┐
        │ MongoDB Atlas │  │ Pinecone │  │ Artifact files    │
        │ users, posts, │  │ dense    │  │ chunks, contexts, │
        │ news, …       │  │ vectors  │  │ title embeddings, │
        └───────────────┘  └──────────┘  │ SEMRAG graph      │
                                         └───────┬───────────┘
                                                 │ reads (read-only)
        ┌────────────────────────────────────────┴───────────┐
        │  Rebuild worker (AWS Batch / systemd timer)         │
        │  parse → chunk → embed → upsert → validate →        │
        │  promote → backup                                   │
        └─────────────────────────────────────────────────────┘

   External model and search providers used at request time:
     Gemini (embeddings) · DeepSeek (writing, research) ·
     SearXNG / Brave / DuckDuckGo (web research) · 2Factor (SMS OTP) ·
     Google Identity (sign-in) · SMTP (contact form)
```

The API never writes retrieval artifacts. Only the worker does, and it publishes
by atomically repointing a `current` symlink (droplet) or an S3 prefix (AWS).
That separation is what makes a rebuild safe to run against a live API.

## Application layering

`backend/` follows a strict four-layer split. Requests move downward only.

| Layer | Directory | Responsibility |
|---|---|---|
| Routers | `backend/api/v1/` | Path, method, status codes, auth dependency, ownership checks |
| Services | `backend/services/` | Business rules, orchestration, external providers |
| Repositories | `backend/repositories/` | MongoDB queries; the only layer that touches collections |
| Schemas | `backend/schemas/` | Pydantic models for request and response validation |

Supporting modules sit beside those layers rather than inside them:

- `backend/core/config.py` re-exports the settings singleton; `backend/config.py`
  holds the 506-line `Settings` dataclass and reads every environment variable.
- `backend/core/http.py` registers CORS and the exception handlers
  (`register_http_layer`).
- `backend/core/dependencies.py` provides `get_current_user_id`, the FastAPI
  dependency that every protected route depends on.
- `backend/core/s3_loader.py` downloads artifact files to local disk on a Lambda
  cold start; `backend/core/artifact_readiness.py` decides whether the loaded
  artifact set is complete enough to serve traffic.
- `backend/db/mongo.py` owns the client and `ping_database()`;
  `backend/db/indexes.py` creates indexes at startup.

## Startup sequence

`app_lifespan` in `backend/main.py` runs three things before the app serves
traffic, then one in the background:

1. `ensure_auth_indexes()` — indexes for `users`, `otp_verifications`, `sessions`.
2. `ensure_phase2_indexes()` — indexes for `news`, `questions`,
   `user_profile_answers`.
3. `ensure_phase3_indexes()` — indexes for `posts`.
4. A daemon thread calls `ensure_rag_stack(settings)` to pre-warm the retrieval
   stack. The comment in `_warm_rag_cache` records the reason: a cold first
   request otherwise pays roughly 40–50 seconds to load chunks, contexts and
   title embeddings. A failure here is logged and swallowed — the first real
   request warms the cache instead.

The warmed stack is a module-level `_RAG_CACHE` tuple of
`(embedder, vector_store, context_by_title)` in `backend/pipeline_cli.py`. On a
warm Lambda instance the second call returns in under a millisecond.

## HTTP layer

`register_http_layer(app)` in `backend/core/http.py`:

- Reads `CORS_ORIGINS` as a comma-separated list. Unset in production logs an
  error and blocks requests; unset outside production logs a warning and falls
  back to the `*` wildcard. Set it explicitly for any deployed environment.
- Installs handlers for `StarletteHTTPException` and `RequestValidationError` so
  validation failures come back in the project's own error envelope
  (`ErrorResponse` in `backend/schemas/auth.py`) rather than FastAPI's default
  shape.
- Adds middleware that catches exceptions escaping route handlers.

## Authentication model

Auth is JWT-based with a server-side session record.

- Signup issues an OTP. `AUTH_DEBUG_RETURN_OTP=true` returns the OTP in the API
  response so signup works without SMS credentials — a development-only switch.
- SMS OTP is delivered through 2Factor (`TWOFACTOR_API_KEY`). The Twilio
  variables that older revisions of `.env.example` listed are no longer read.
- Google sign-in verifies the ID token, so only `GOOGLE_CLIENT_ID` is needed; no
  client secret is read anywhere in the backend.
- Access tokens expire after `ACCESS_TOKEN_EXPIRY_MINUTES` (default 30), refresh
  tokens after `REFRESH_TOKEN_EXPIRY_DAYS` (default 7). `POST /auth/refresh`
  exchanges one for a new pair; `POST /auth/logout` deletes the session.
- Signing uses `JWT_SECRET` with `JWT_ALGORITHM` (default `HS256`).

Ownership is enforced in the routers, not only in the services. Every `posts`
route compares the resource's `user_id` against `get_current_user_id()` and
raises `403` on mismatch, including on `list` and `dashboard` where a caller
could otherwise pass another user's `user_id` as a query parameter.

## MongoDB collections

`GET /api/v1/health/ready` treats these seven as required:

| Collection | Contents | Repository |
|---|---|---|
| `users` | Accounts, verification flags, Google linkage | `users_repo.py` |
| `otp_verifications` | Outstanding OTPs, attempt counters | `otp_repo.py` |
| `sessions` | Refresh-token sessions | `sessions_repo.py` |
| `news` | News items stamped with `tenant_id` / `tenant_slug` | `news_repo.py` |
| `questions` | Profile question catalogue | `questions_repo.py` |
| `user_profile_answers` | Per-user answers that steer the writing voice | `profile_answers_repo.py` |
| `posts` | Generated posts, status, `generation_meta` | `posts_repo.py` |

`user_streaks` also exists (`streak_repo.py`) and backs the dashboard streak
counter, but readiness does not require it.

Field-by-field types and sample documents are already documented per phase in
`backend/docs/` — see `AUTH_COLLECTION_FIELD_TYPES.md`,
`PHASE2_FIELD_TYPES.md`, `PHASE3_POSTS_FIELD_TYPES.md` and the matching
`*_SAMPLE_DOCUMENTS.md` files.

## Readiness semantics

`/health/live` is a bare process check that always returns `{"status": "ok"}`.

`/health/ready` returns `503` unless all three hold: the database responds to a
ping, every required collection's index information can be read, and
`assess_artifact_readiness(settings)` reports the artifact set as ready. The
response body carries the individual checks, so a `503` tells you which of the
three failed. `GET /health/` is a backwards-compatible alias with the same
semantics.

Because readiness depends on artifacts, a droplet whose `current` symlink points
at an incomplete build will fail readiness and be pulled from rotation rather
than serve ungrounded posts.

## External dependencies

| Service | Used for | Required? |
|---|---|---|
| MongoDB Atlas | All domain data | Yes |
| Pinecone | Dense vector search | Yes |
| Gemini | Embeddings (`gemini-embedding-001`) | Yes |
| DeepSeek | Post writing and the research step | Yes |
| SMTP (Gmail app password) | Contact form delivery | For the contact form |
| 2Factor | SMS OTP | For phone signup |
| Google Identity | Google sign-in | For Google sign-in |
| SearXNG / Brave / DuckDuckGo | Web research | Optional, off by default |
| NewsAPI | News ingestion | For the ingestion path |
| AWS S3 | Artifact storage and backup | AWS deployment only |
