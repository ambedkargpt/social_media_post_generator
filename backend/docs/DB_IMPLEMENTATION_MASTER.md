# AmbedkarGPT DB Implementation Master Doc

This document is the final consolidated record of what has been implemented for backend database design and related APIs.

## 1) Scope Completed

Implemented across four phases:

- Phase 1: Auth foundation (`users`, `otp_verifications`, `sessions`)
- Phase 2: Profile + content metadata (`questions`, `user_profile_answers`, `news`)
- Phase 3: Generated posts storage (`posts`)
- Phase 4: Balanced hardening (security, performance, reliability)
- News migration enhancement: stable `news_id`, import from current + legacy outputs, dedupe by `source_url`

## 2) Final Collections Implemented

## `users`

Purpose: account identity and auth state.

Key fields:

- `_id` (ObjectId)
- `username`, `email`, `phone`
- `password_hash`
- `auth_providers` (`password`, `google`)
- `is_email_verified`, `is_phone_verified`, `is_active`
- `last_login_at`, `created_at`, `updated_at`

## `otp_verifications`

Purpose: temporary OTP verification with expiry.

Key fields:

- `_id`, `user_id`
- `channel`, `target`, `purpose`
- `otp_hash`
- `attempt_count`, `max_attempts`
- `expires_at`, `consumed_at`, `created_at`

## `sessions`

Purpose: active login sessions and token lifecycle.

Key fields:

- `_id`, `user_id`
- `access_token`
- `refresh_token_hash` (hashed refresh token storage)
- `access_expires_at`, `refresh_expires_at`
- `is_revoked`, `revoked_at`
- `device_info`, `ip_address`, `user_agent`
- `created_at`, `updated_at`

## `questions`

Purpose: canonical profile question bank.

Key fields:

- `_id`
- `question_id` (stable unique ID)
- `question_text`, `category`
- `answer_type` (`text`, `single_select`, `multi_select`, `number`, `boolean`)
- `options` (array)
- `is_active`, `version`
- `created_at`, `updated_at`

## `user_profile_answers`

Purpose: user answers mapped to question IDs.

Model: latest-only by `(user_id, question_id)`.

Key fields:

- `_id`, `user_id`, `question_id`
- `answer`, `source`
- `answered_at`, `created_at`, `updated_at`

## `news`

Purpose: frontend/LLM-ready source news records.

Key fields:

- `_id` (Mongo ID)
- `news_id` (custom stable ID, e.g. `news_000001`)
- `headline`
- `description` (short form)
- `summary` (full summary text for LLM use)
- `source_name`
- `source_url` (normalized, dedupe key)
- `published_at`
- `language`, `tags`, `embedding_ref`
- `legacy_source`, `original_sort_timestamp`
- `created_at`, `updated_at`

## `posts`

Purpose: generated/final posts for dashboard and lifecycle management.

Key fields:

- `_id`
- `user_id`, `news_id`
- `content`, `hashtags`
- `status` (`draft`, `published`, `archived`)
- `generation_meta`
- `created_at`, `updated_at`

Note: multiple post variants are allowed per `(user_id, news_id)`.

## 3) APIs Implemented

All APIs are under `/api/v1`.

## Auth (`/auth`)

- `POST /signup`
- `POST /verify-otp`
- `POST /login`
- `POST /google-login`
- `POST /refresh`
- `POST /logout`
- `GET /me`

## News (`/news`)

- `POST /`
- `GET /` (supports `limit`, `skip`, `include_summary`)
- `GET /{mongo_id}`
- `GET /by-news-id/{news_id}`
- `PATCH /{mongo_id}`

## Questions (`/questions`)

- `POST /`
- `GET /` (supports `limit`, `skip`)
- `GET /{question_id}`
- `PATCH /{question_id}`

## Profile Answers (`/profile/answers`)

- `PUT /{question_id}`
- `GET /` (supports `user_id`, `limit`, `skip`)
- `GET /{question_id}` (with `user_id`)

## Posts (`/posts`)

- `POST /`
- `GET /` (filters + pagination)
- `GET /dashboard`
- `GET /{post_id}`
- `PATCH /{post_id}`
- `DELETE /{post_id}` (archive-first)

## Health (`/health`)

- `GET /`
- returns:
  - `status`
  - `database_connected`
  - `indexes_ready`

## 4) Security and Access Rules Implemented

- Passwords hashed before storage.
- OTP values hashed before storage.
- Refresh token is stored as hash (`refresh_token_hash`).
- Protected route auth dependency added via bearer token.
- Owner checks enforced on:
  - posts operations
  - profile answer operations
- `dev_otp` response constrained to dev/test-like environments when enabled.

## 5) Indexes Implemented (Summary)

## Auth

- `users`: unique username/email/phone + created date
- `otp_verifications`: TTL on `expires_at`, lookup indexes
- `sessions`: user, refresh hash unique partial, expiry indexes

## Phase 2

- `questions`: unique `question_id`, category/active, created date
- `user_profile_answers`: unique `(user_id, question_id)`, answered date
- `news`: unique partial `source_url`, publish/created date, text index

## News Migration Enhancement

- `news`: unique partial `news_id`

## Posts

- `(user_id, created_at desc)`
- `(news_id, created_at desc)`
- `(status, created_at desc)`
- text index on `content`

## 6) Migrations and Data Seeding Implemented

## News migration (`news_id` + dedupe)

Script:

- `scripts/migrate_news_to_db.py`

Logic:

- Reads:
  - `outputs/generated_news.json`
  - `outputs/generated_news_legacy.json`
- Normalizes `video_link -> source_url`
- Deduplicates by `source_url`
- Keeps latest by `sort_timestamp`
- Assigns/preserves stable `news_id`
- Upserts idempotently
- Ensures `summary` is stored in `news`

## Profile question seeding

- Profile-oriented question set has been inserted into `questions` collection as `profile_*` IDs.

## 7) Reliability / Operability Hardening

- Request middleware with request ID (`X-Request-Id`) and structured logging.
- Standardized error envelope includes `request_id`.
- Health endpoint enhanced with readiness-style checks.

## 8) Testing Status

Implemented test suites include:

- auth unit + service + API integration
- phase 2 service + API integration
- phase 3 posts service + API integration
- phase 4 security API checks
- news migration dedupe tests

Current regression status:

- full suite passing (`17 passed` at latest run)

## 9) What Is Still Open (Design Extensions)

Core DB design implementation is complete for current scope. Optional future work:

- token strategy deep hardening (full hash model with token-family rotation)
- social accounts collection (if adding providers beyond Google)
- post analytics / feedback collections
- historical profile answer versioning (if needed beyond latest-only model)
- broader soft-delete strategy across entities

## 10) Source-of-Truth Related Docs

- `backend/DATABASE_DESIGN.md`
- `backend/docs/AUTH_API.md`
- `backend/docs/PHASE2_API.md`
- `backend/docs/PHASE3_POSTS_API.md`
- `backend/docs/NEWS_MIGRATION_NEWS_ID.md`
- `backend/docs/PHASE4_HARDENING.md`
