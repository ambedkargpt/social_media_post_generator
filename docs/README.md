# AmbedkarGPT — Project Documentation

Documentation for the `social_media_post_generator` repository: a full-stack
application that generates grounded political social-media posts from a corpus
of Hindi/English video transcripts, using retrieval-augmented generation.

If you are new to the repo, read [OVERVIEW.md](OVERVIEW.md) first, then
[ARCHITECTURE.md](ARCHITECTURE.md).

## Contents

| Document | What it covers |
|---|---|
| [OVERVIEW.md](OVERVIEW.md) | What the product does, the repository map, the tenant model |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Runtime components, request paths, MongoDB collections |
| [SETUP.md](SETUP.md) | Running the backend and frontend on your own machine |
| [CONFIGURATION.md](CONFIGURATION.md) | Every environment variable, grouped by subsystem |
| [API.md](API.md) | Complete HTTP endpoint reference |
| [GENERATION.md](GENERATION.md) | The post-generation pipeline, step by step |
| [ARTIFACTS.md](ARTIFACTS.md) | RAG artifacts, the rebuild worker, promotion and rollback |
| [FRONTEND.md](FRONTEND.md) | React app structure, routes, API client, auth |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Both deployment targets, CI/CD, operations |
| [TESTING.md](TESTING.md) | Test suites and how to run them |

## Things the code and the older docs disagree about

Documented where each belongs, collected here because each one has bitten
someone or will:

| Discrepancy | Where |
|---|---|
| The embedding reranker is **off** by default, though `config.py`'s docstring and `SYSTEM_ARCHITECTURE.md` say it is on | [CONFIGURATION.md](CONFIGURATION.md) |
| `REFRESH_TOKEN_EXPIRY_DAYS` is 30 in code, 7 in `.env.example`; `NEWS_PAGE_SIZE` is 5, not 20 | [CONFIGURATION.md](CONFIGURATION.md) |
| `CONTACT_RECIPIENT_EMAIL` falls back to a developer's personal Gmail compiled into `config.py` | [CONFIGURATION.md](CONFIGURATION.md) |
| All four `/news` read endpoints are unauthenticated, so the catalogue is world-readable | [API.md](API.md) |
| `deploy/env/*.env.example` does not exist, so the droplet runbook's `cp` step fails | [DEPLOYMENT.md](DEPLOYMENT.md) |
| The runbook sets `ALLOWED_ORIGINS`; the backend reads `CORS_ORIGINS` | [DEPLOYMENT.md](DEPLOYMENT.md) |
| nginx `proxy_read_timeout` is 120 s while gunicorn waits 600 s, so long generations return `504` for requests that succeeded | [DEPLOYMENT.md](DEPLOYMENT.md) |
| No workflow triggers on `deploy`, the branch treated as most current | [DEPLOYMENT.md](DEPLOYMENT.md) |
| The e2e spec seeds `localStorage`, but the app reads `sessionStorage` and purges those keys at startup | [TESTING.md](TESTING.md) |
| The root `README.md` and `frontend/README.md` describe the earlier prototype (NewsAPI, FAISS, OpenAI, `python main.py`) | [OVERVIEW.md](OVERVIEW.md) |

## Pre-existing documentation

This folder is the project-wide entry point. Deeper, subsystem-specific
documents already existed before it and are still authoritative for their
topics:

- `backend/docs/` — database design, per-phase API contracts, field types,
  sample documents, deployment planning. Start at `backend/docs/README.md`.
- `backend/docs/SYSTEM_ARCHITECTURE.md` — a detailed treatment of chunking,
  retrieval fusion (RRF), reranking and the SEMRAG graph. Note that parts of it
  predate the move to Pinecone and DeepSeek; where it disagrees with
  [ARCHITECTURE.md](ARCHITECTURE.md) or [CONFIGURATION.md](CONFIGURATION.md),
  the newer documents reflect the code as it stands on `deploy`.
- `backend/DATABASE_DESIGN.md` — MongoDB schema design and status.
- `deploy/README.md` — the executable runbook for the DigitalOcean droplet.
- `backend/auth/README.md`, `frontend/e2e/README.md` — module-local notes.

## Conventions used here

- Paths are relative to the repository root unless stated otherwise.
- Environment variables are written as `UPPER_SNAKE_CASE`.
- Endpoint paths include the `/api/v1` prefix that `backend/main.py` mounts.
- Where a default is quoted, it is the default in code, not merely the value in
  `.env.example`.
