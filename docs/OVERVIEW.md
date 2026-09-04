# Overview

## What this project is

AmbedkarGPT turns a news story into a social-media post written in a specific
political voice, and grounds every post in real source material rather than
letting the language model invent claims.

The source material is a corpus of video transcripts (Ravish Kumar's channel for
neutral/journalistic coverage, plus party channels). When a user picks a news
story, the backend retrieves the passages from that corpus that argue about the
same subject, optionally researches the story on the open web, and then asks a
language model to write a post that uses those passages and the user's own
profile answers as its raw material.

The product is not a general chatbot wrapper. Three design decisions shape the
whole codebase:

1. **Grounding is mandatory.** If no chunks, no transcript and no research
   brief can be gathered for a story, `POST /api/v1/posts/generate` returns
   `503` instead of writing an ungrounded post
   (`backend/services/posts_service.py`).
2. **Retrieval artifacts are built offline, not per request.** A separate worker
   rebuilds the embeddings and graph on a schedule, and the API only ever reads
   a promoted, immutable artifact set. See [ARTIFACTS.md](ARTIFACTS.md).
3. **Every generation leaves a trace.** Each run writes its news item,
   transcript, chunks, prompts, intermediate drafts and final post to a trace
   directory so a post can be audited against its sources after the fact.

## Capabilities

| Capability | Where it lives |
|---|---|
| Post generation from a news story | `POST /api/v1/posts/generate` |
| Regeneration reusing a retrieval snapshot | `POST /api/v1/posts/{id}/regenerate` |
| Post translation | `POST /api/v1/posts/{id}/translate` |
| Daily generation quota | `GET /api/v1/posts/daily-quota` |
| Post history, dashboard, archive | `GET /api/v1/posts`, `/posts/dashboard` |
| BheemBot — RAG Q&A over the corpus | `POST /api/v1/chat/message` |
| Email + phone signup, OTP, Google sign-in | `/api/v1/auth/*` |
| Profile questionnaire that steers the writing voice | `/api/v1/questions`, `/api/v1/profile` |
| News ingestion and per-tenant listing | `/api/v1/news/*` |
| Contact form delivered over SMTP | `POST /api/v1/contact` |
| Liveness / readiness probes | `/api/v1/health/live`, `/health/ready` |

The frontend additionally ships pages for music generation
(`frontend/src/pages/MusicGeneration.jsx`, `MusicGenerationStudio.jsx`) and
pricing/marketing content; these are UI surfaces without a matching backend
router in this repository.

## The tenant model

A **tenant** is a news audience segment — a political party a user can follow,
plus a special `general` tenant carrying neutral coverage. The registry is data,
not code: `backend/config/tenants.json`.

| `tenant_id` | `slug` | Name | Source | General? |
|---|---|---|---|---|
| 0 | `general` | General News | Ravish Kumar | yes |
| 1 | `congress` | Indian National Congress | Indian National Congress | no |
| 2 | `samajwadi` | Samajwadi Party | Samajwadi Party | no |

Every news document is stamped with `tenant_id` and `tenant_slug` at publish
time, so the API can serve party news and general news from the same collection.
Adding a party means adding an entry to `tenants.json` and building a corpus for
it — see `backend/scripts/build_tenant_corpus.py` and
`backend/scripts/check_isolation.py`. The retrieval stack is resolved per tenant
in `PostsService._rag_stack(tenant)`, so a party's posts are written from that
party's corpus.

## Repository map

```
├── backend/                  FastAPI service, RAG pipeline, rebuild worker
│   ├── api/v1/               HTTP routers (auth, news, questions, profile,
│   │                         posts, chat, contact, health)
│   ├── services/             Business logic, one module per domain
│   ├── repositories/         MongoDB data access
│   ├── schemas/              Pydantic request/response models
│   ├── db/                   Mongo client and index creation
│   ├── core/                 Config, dependencies, HTTP layer, logging,
│   │                         S3 artifact loading, readiness assessment
│   ├── pipeline/             Chunking, embedding, retrieval, generation,
│   │                         web research, validation, news fetching
│   ├── pipeline/orchestration/  Resumable stage runner for offline builds
│   ├── semrag/               Graph-augmented retrieval (entities, relations)
│   ├── worker/               Artifact build, validate, promote, rollback
│   ├── scripts/              35 operational and one-off CLI scripts
│   ├── streamlit_app/        Internal Streamlit UI for retrieval inspection
│   ├── prompts/              Prompt templates as plain text files
│   ├── config/               tenants.json, per-channel JSON config
│   ├── docs/                 Pre-existing backend documentation
│   └── tests/                pytest suite
├── frontend/                 React 19 + Vite 8 SPA, Tailwind 4
│   ├── src/pages/            20 route-level pages
│   ├── src/components/       Shared and feature components
│   ├── src/api/              axios client and per-domain API modules
│   ├── src/context/          Auth and UI context providers
│   └── e2e/                  Playwright end-to-end specs
├── deploy/                   DigitalOcean droplet runbook and assets
│   ├── nginx/                SPA + /api proxy site configs (HTTP and TLS)
│   ├── systemd/              API service, worker service and timer
│   ├── searxng/              Self-hosted metasearch for the research step
│   └── scripts/              Numbered provisioning scripts
├── .github/workflows/        CI, Lambda deploy, worker deploy, scheduled rebuild
├── Dockerfile.lambda         API container image for AWS Lambda
├── Dockerfile.worker         Rebuild worker image for AWS Batch
└── docs/                     This documentation set
```

## Principal entry points

| Entry point | Purpose |
|---|---|
| `backend/main.py` | FastAPI app; mounts every router under `/api/v1` |
| `backend/main_lambda.py` | Mangum handler wrapping the same app for Lambda |
| `backend/pipeline_cli.py` | `ensure_rag_stack()` — loads or builds the retrieval stack; also a CLI |
| `backend/run_pipeline.py` | Stage orchestration with resume and selective stages |
| `backend/Fetch.py` | Transcript fetch and processing flow |
| `backend/generate_posts_from_news.py` | Offline post generation from generated news |
| `backend/worker/auto_rebuild.py` | The scheduled artifact rebuild entry point |
| `deploy/scripts/0*.sh` | Ordered droplet provisioning steps |

## Where the stale documentation is

The repository-root `README.md` still describes an earlier prototype: NewsAPI
plus a single Ravish Kumar transcript file, FAISS on local disk, OpenAI
`gpt-5-nano` for generation, and `python main.py` as the entry point. The
current system uses Pinecone for vector search, DeepSeek for writing, a
multi-tenant corpus, and a FastAPI service as the entry point. Treat this
`docs/` folder as current and the root README as historical.
