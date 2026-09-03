# Local setup

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Python | 3.11 | CI and both container images pin 3.11. Ubuntu 24.04 hosts use the system 3.12. |
| Node.js | 20 | Matches `setup-node` in `.github/workflows/ci.yml`. |
| MongoDB | Atlas cluster or local `mongod` | The app only needs a connection string. |
| Docker | optional | Only for the SearXNG research container and image builds. |

You also need credentials for MongoDB, Gemini, Pinecone and DeepSeek. Without
those four the API starts but fails at the first request that needs them —
`backend/.env.example` marks them REQUIRED for exactly that reason.

## Backend

Run every command from the repository root, not from `backend/`. The package is
imported as `backend.*`, so the repository root must be on `PYTHONPATH`.

```bash
python3.11 -m venv .venv && source .venv/bin/activate
pip install -U pip
pip install -r backend/requirements-api.txt
```

`requirements-api.txt` is the API and local-development set. It deliberately
excludes `faiss-cpu` — vector search goes through Pinecone now. Use
`requirements-worker.txt` instead when you intend to run artifact rebuilds
locally; it adds the heavier ingestion and ML dependencies. `requirements.txt`
is the older combined list.

Copy and fill the environment file:

```bash
cp backend/.env.example backend/.env
```

`backend/config.py` loads `backend/.env` first and then the repository-root
`.env`, so a root `.env` can hold shared values while `backend/.env` overrides
them. See [CONFIGURATION.md](CONFIGURATION.md) for every variable.

For a first local run, these are the settings that matter most:

```bash
MONGODB_URI=<your Atlas URI>
MONGODB_DATABASE=ambedkargpt
JWT_SECRET=<32+ random characters>
GEMINI_API_KEY=<key>
PINECONE_API_KEY=<key>
PINECONE_INDEX_NAME=ambedkargpt
DEEPSEEK_API_KEY=<key>
CORS_ORIGINS=http://localhost:5173
AUTH_DEBUG_RETURN_OTP=true
```

`AUTH_DEBUG_RETURN_OTP=true` returns the OTP in the signup response so you can
complete signup without SMS credentials. Never set it outside development.

Start the API:

```bash
uvicorn backend.main:app --reload --port 8000
```

Interactive API documentation is then at `http://localhost:8000/docs`, and the
OpenAPI schema at `http://localhost:8000/openapi.json`.

Expect the first request to be slow. Startup kicks off a background thread that
loads chunks, video contexts and title embeddings; until that finishes the first
generate request pays the load cost itself.

Confirm the service is healthy:

```bash
curl -fsS http://localhost:8000/api/v1/health/ready
```

A `503` here is informative rather than fatal — the JSON body names which of
`database_connected`, `indexes_ready` and `artifacts_ready` failed. Missing
artifacts are normal on a fresh clone; see [ARTIFACTS.md](ARTIFACTS.md) for how
to obtain or build them.

## Frontend

```bash
cd frontend
npm ci
cp .env.example .env
npm run dev
```

Vite serves on `http://localhost:5173`. Two variables matter:

```bash
VITE_API_URL=http://localhost:8000/api/v1
VITE_GOOGLE_CLIENT_ID=<your Google OAuth client ID>
```

`VITE_API_URL` must include the `/api/v1` suffix — `frontend/src/api/client.js`
appends only the resource path. Vite inlines `VITE_*` variables at build time,
so changing either one requires a restart in development and a rebuild for
production.

Keep `CORS_ORIGINS` on the backend in sync with the origin the browser actually
uses, including the port. A mismatch shows up as a CORS error in the console
rather than a backend log line.

## Optional: web research

The research step is off by default. To enable it locally, start the bundled
SearXNG container and switch the flag on:

```bash
docker compose -f deploy/searxng/docker-compose.yml up -d
```

```bash
WEB_RESEARCH_ENABLED=1
SEARCH_PROVIDER=auto
SEARXNG_URL=http://localhost:8080
```

`SEARCH_PROVIDER=auto` walks SearXNG, then Brave, then DuckDuckGo, taking the
first backend that answers, so research keeps working when the container is
down. Page extraction needs `trafilatura`; it is already in
`requirements-api.txt`, but if it is missing every source silently degrades to a
one-line search snippet while the logs still describe sources as verified.

## Optional: internal Streamlit UI

`backend/streamlit_app/` is an internal tool for inspecting retrieval results.

```bash
streamlit run backend/streamlit_app/app.py
```

## Common problems

| Symptom | Cause |
|---|---|
| `ModuleNotFoundError: No module named 'backend'` | Running from inside `backend/`. Run from the repository root. |
| CORS error in the browser console | `CORS_ORIGINS` does not contain the exact origin including port. |
| `503` from `/posts/generate` | No chunks, transcript or research brief could be gathered — the API refuses to write an ungrounded post. |
| `502` from `/posts/generate` | The model returned empty content. A reasoning model can spend the whole completion budget on chain-of-thought; keep `POST_GENERATION_MODEL=deepseek-chat`. |
| First request hangs ~40–50 s | The RAG cache is still warming. |
| Contact form silently never delivers | `SMTP_*` points at a capture-only host. Verify with `python -m backend.scripts.check_contact_email`. |
