# Frontend Browser E2E (Playwright)

This suite validates browser-level integration for:

- Frontend click -> backend `POST /api/v1/posts/generate`
- Frontend click -> backend `POST /api/v1/posts/{id}/regenerate`
- Regenerate reuses the same retrieval snapshot ID

## Prerequisites

- Backend API running (default: `http://127.0.0.1:8000/api/v1`)
- Frontend app running (default: `http://127.0.0.1:5173`)
- A verified test user in backend auth DB
- OpenAI provider quota available for generation

## Environment variables

- `FRONTEND_BASE_URL` (optional, default `http://127.0.0.1:5173`)
- `E2E_API_BASE_URL` (optional, default `http://127.0.0.1:8000/api/v1`)
- `E2E_EMAIL` (required)
- `E2E_PASSWORD` (required)

## Install and run

```bash
cd frontend
npm install
npx playwright install
npm run e2e
```

Headed mode:

```bash
npm run e2e:headed
```
