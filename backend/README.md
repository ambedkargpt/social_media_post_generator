# Backend Starter

## Folder Structure

- `backend/main.py` - FastAPI app entrypoint
- `backend/core/` - shared config and application-level utilities
- `backend/db/` - MongoDB connection and DB helpers
- `backend/api/v1/` - versioned route modules
- `backend/models/` - database models/documents
- `backend/schemas/` - request/response schemas
- `backend/repositories/` - data access layer
- `backend/services/` - business logic layer

## Current Status

- MongoDB Atlas URI wired through `config.py` (`MONGODB_URI`, `MONGODB_DATABASE`).
- Mongo client and connectivity check implemented in `backend/db/mongo.py`.
- Health endpoint available at `/api/v1/health/` that reports DB ping status.
- Database design draft documented in `backend/DATABASE_DESIGN.md`.
- Auth Phase 1 endpoints and contracts documented in `backend/auth/README.md`.
- Centralized backend docs index available at `backend/docs/README.md`.
- Phase 2 modules (`news`, `questions`, `user_profile_answers`) are implemented with APIs and tests.
- Phase 3 `posts` module is implemented with dashboard fetch APIs and indexing.

## Backend Implementation Plan

1. **Auth + user foundation**
   - Add user schema, repository, and auth service.
   - Add JWT/session strategy and role guards.
2. **Core domain modules**
   - Add source modules (news, posts, retrieval artifacts) with CRUD APIs.
   - Define indexes and validation rules per collection.
3. **RAG integration layer**
   - Connect existing pipelines (`Fetch.py`, `main.py`, generation scripts) through service APIs.
   - Persist run metadata and generated outputs in MongoDB.
4. **Quality and operations**
   - Add logging, centralized error handling, and request validation.
   - Add tests (unit + API integration) and environment-based deployment config.
