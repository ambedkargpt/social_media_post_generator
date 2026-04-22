# AmbedkarGPT Backend Database Design (Draft v1)

This document captures the intended MongoDB data model for the backend based on the project context and your design notes.

## 1) Goals

- Build an auth-first backend with secure session handling.
- Support verification using at least one mandatory channel: **email OR phone**.
- Support login via **Google** as an additional auth provider.
- Store user profile answers mapped to question IDs.
- Support news ingestion and post generation tied to users and news items.

## 2) High-Level Collections

- `users` - identity, credentials, verification, login providers.
- `otp_verifications` - temporary OTP records for email/phone verification and login checks (TTL).
- `sessions` - active login sessions storing both access and refresh token data.
- `questions` - question bank with canonical `question_id`.
- `user_profile_answers` - user responses mapped to `question_id`.
- `news` - source news items.
- `posts` - generated/user posts linked to user and news.

## 3) Collection Design

## `users`

Primary identity and authentication metadata.

Suggested fields:

- `_id` (ObjectId)
- `username` (string, unique)
- `email` (string, nullable, unique when present)
- `phone` (string, nullable, unique when present)
- `password_hash` (string, nullable for Google-only accounts)
- `auth_providers` (array of strings, e.g. `["password"]`, `["google"]`, `["password","google"]`)
- `is_email_verified` (bool)
- `is_phone_verified` (bool)
- `is_active` (bool, default true)
- `last_login_at` (datetime, nullable)
- `created_at` (datetime)
- `updated_at` (datetime)

Business rules:

- At least one of `email` or `phone` must be present.
- At least one of `is_email_verified` or `is_phone_verified` must be true for verified status.
- If password login is enabled, `password_hash` is required.
- Google login accounts may not need `password_hash`.

Indexes:

- Unique: `username`
- Unique sparse/partial: `email`
- Unique sparse/partial: `phone`
- Index: `created_at`

## `otp_verifications`

Temporary OTP records for verification/auth flows.

Suggested fields:

- `_id` (ObjectId)
- `user_id` (ObjectId, nullable for pre-signup flow)
- `channel` (enum: `email` | `phone`)
- `target` (string; email or phone value used for OTP)
- `otp_hash` (string; hashed OTP, not plaintext)
- `purpose` (enum: `signup_verify` | `login_verify` | `reset_password` | `change_contact`)
- `attempt_count` (int)
- `max_attempts` (int)
- `expires_at` (datetime; TTL field)
- `consumed_at` (datetime, nullable)
- `created_at` (datetime)

Indexes:

- TTL index on `expires_at` (auto-delete expired OTP docs)
- Index: `(target, purpose, created_at desc)`
- Index: `user_id`

## `sessions`

Session store with both access and refresh tokens, as requested.

Suggested fields:

- `_id` (ObjectId)
- `user_id` (ObjectId)
- `access_token` (string)
- `refresh_token` (string)
- `access_expires_at` (datetime)
- `refresh_expires_at` (datetime)
- `device_info` (object; optional)
- `ip_address` (string; optional)
- `user_agent` (string; optional)
- `is_revoked` (bool, default false)
- `revoked_at` (datetime, nullable)
- `created_at` (datetime)
- `updated_at` (datetime)

Notes:

- Current plan stores both tokens directly; token lifecycle details will be finalized during implementation.
- If needed later for stronger security, tokens can be stored as hashes with token family rotation logic.

Indexes:

- Index: `user_id`
- Index: `refresh_token` (unique if token uniqueness is enforced)
- Index: `access_expires_at`
- Index: `refresh_expires_at`
- Optional TTL index for expired/revoked session cleanup (implementation choice)

## `questions`

Canonical question bank for profile mapping.

Suggested fields:

- `_id` (ObjectId)
- `question_id` (string, unique, stable public/internal ID)
- `question_text` (string)
- `category` (string, optional)
- `answer_type` (enum: `text` | `single_select` | `multi_select` | `number` | `boolean`)
- `options` (array, optional)
- `is_active` (bool)
- `version` (int)
- `created_at` (datetime)
- `updated_at` (datetime)

Indexes:

- Unique: `question_id`
- Index: `(category, is_active)`

## `user_profile_answers`

User responses mapped to `question_id`.

Suggested fields:

- `_id` (ObjectId)
- `user_id` (ObjectId)
- `question_id` (string; references `questions.question_id`)
- `answer` (mixed/object; depends on `answer_type`)
- `source` (enum: `onboarding` | `profile_update` | `survey`)
- `answered_at` (datetime)
- `created_at` (datetime)
- `updated_at` (datetime)

Indexes:

- Unique compound: `(user_id, question_id)` for latest single answer model
- Index: `question_id`
- Index: `answered_at`

## `news`

Source news objects used by generation pipelines.

Suggested fields:

- `_id` (ObjectId)
- `headline` (string)
- `description` (string)
- `source_name` (string, optional)
- `source_url` (string, optional)
- `published_at` (datetime, optional)
- `language` (string, optional)
- `tags` (array of strings, optional)
- `embedding_ref` (string/object, optional for RAG)
- `created_at` (datetime)
- `updated_at` (datetime)

Indexes:

- Text/compound indexes based on retrieval needs (`headline`, `description`)
- Index: `published_at`
- Optional unique index on normalized `source_url` to reduce duplicates

## `posts`

Generated or user-curated posts derived from news.

Suggested fields:

- `_id` (ObjectId)
- `user_id` (ObjectId)
- `news_id` (ObjectId)
- `content` (string)
- `hashtags` (array of strings)
- `status` (enum: `draft` | `published` | `archived`)
- `generation_meta` (object; model/version/prompt refs, optional)
- `created_at` (datetime)
- `updated_at` (datetime)

Indexes:

- Index: `user_id`
- Index: `news_id`
- Index: `(user_id, created_at desc)`

## 4) Relationships (Logical)

- `users (1) -> (N) sessions`
- `users (1) -> (N) otp_verifications`
- `users (1) -> (N) user_profile_answers`
- `questions (1) -> (N) user_profile_answers` via `question_id`
- `news (1) -> (N) posts`
- `users (1) -> (N) posts`

MongoDB keeps these as references by IDs (no hard foreign key constraints).

## 5) Verification and Login Rules

- Signup must collect at least one contact method: email or phone.
- Account is considered verified when at least one channel is verified.
- OTP collection handles temporary proof and expiry.
- Login options:
  - Password-based login (email/phone + password + optional OTP depending on flow)
  - Google login (OAuth provider)
- Session creation stores both access and refresh tokens in `sessions`.

## 6) Data Validation Rules (Application Layer)

- Reject user creation if both `email` and `phone` are missing.
- Enforce canonical formatting for email and phone before save.
- Never store raw password or raw OTP (store hashes only).
- Enforce allowed enums (`channel`, `purpose`, `status`, etc.).
- Enforce one-answer-per-question-per-user if using unique `(user_id, question_id)`.

## 7) Audit and Timestamps

Each collection should include:

- `created_at`
- `updated_at`

Security-sensitive collections (`sessions`, `otp_verifications`) should also track revoke/consume fields for auditability.

## 8) Future Extensions

- Add `social_accounts` collection if multiple OAuth providers expand.
- Add `post_feedback` / `post_analytics` for engagement tracking.
- Add profile answer history versioning if you need change trails over time.
- Add soft-delete (`deleted_at`) where recovery is needed.

## 9) Open Implementation Decisions (To Finalize in Build Phase)

- Exact token rotation/revocation strategy in `sessions`.
- Whether tokens are stored raw or hashed.
- Whether `user_profile_answers` keeps only latest answer or full history.
- Final index tuning after real query patterns and load testing.

## 10) Phase 1 Implementation Status

Implemented in codebase:

- Auth collections wired: `users`, `otp_verifications`, `sessions`.
- APIs implemented under `/api/v1/auth`:
  - `signup`, `verify-otp`, `login`, `google-login`, `refresh`, `logout`, `me`
- Index setup implemented at app startup:
  - Unique username/email/phone constraints
  - OTP TTL index on `expires_at`
  - Session lookup and token-expiry indexes

Current behavior:

- Signup requires username + password + at least one of email/phone.
- Verification requires OTP against channel + target + purpose.
- Sessions store both access and refresh tokens (v1 design choice).
- Google login creates or links users by Google email.

## 11) Phase 2 Implementation Status

Implemented in codebase:

- Collections wired in repositories/services/routes:
  - `news`
  - `questions`
  - `user_profile_answers` (latest-only per `(user_id, question_id)`)
- APIs implemented:
  - `POST/GET/PATCH /api/v1/news/*`
  - `POST/GET/PATCH /api/v1/questions/*`
  - `PUT/GET /api/v1/profile/answers/*`
- Startup indexes added:
  - `news`: publish/date/text/source-url indexes
  - `questions`: unique `question_id`, category/activity indexes
  - `user_profile_answers`: unique `(user_id, question_id)` + answered date index

Current behavior:

- Profile answer writes validate that `question_id` exists.
- News service normalizes URLs and tags before persistence.
- Profile answers use latest-only upsert semantics.

## 12) Phase 3 Implementation Status

Implemented in codebase:

- `posts` collection module with schema, repository, service, and API routes.
- APIs implemented:
  - `POST /api/v1/posts/`
  - `GET /api/v1/posts/`
  - `GET /api/v1/posts/dashboard`
  - `GET /api/v1/posts/{post_id}`
  - `PATCH /api/v1/posts/{post_id}`
  - `DELETE /api/v1/posts/{post_id}` (archive-first)
- Startup indexes added:
  - `(user_id, created_at desc)`
  - `(news_id, created_at desc)`
  - `(status, created_at desc)`
  - text index on `content`

Current behavior:

- Multiple variants per `(user_id, news_id)` are supported (no unique pair constraint).
- `user_id` and `news_id` are validated on create.
- Hashtags are normalized to lowercase unique values.
- Status transitions are validated by service rules.

## 13) News `news_id` + Migration Status

Implemented in codebase:

- `news` now supports stable custom `news_id` in addition to Mongo `_id`.
- News APIs now return `news_id` and support lookup by custom ID.
- Migration utility added for importing:
  - `outputs/generated_news.json`
  - `outputs/generated_news_legacy.json`
- Dedupe strategy: normalized `source_url` from `video_link`.
- Duplicate resolution: keep latest entry by `sort_timestamp`.

Indexes:

- `uq_news_news_id` (unique partial)
- `uq_news_source_url` (unique partial)
- Existing publish/date/text indexes retained.

## 14) Phase 4 Hardening Status

Implemented in codebase:

- Session security improved with hashed refresh token storage (`refresh_token_hash`).
- Auth guard dependency added and enforced on protected content/profile routes.
- Pagination standardized with `limit` + `skip` across key list endpoints.
- News list supports optional `include_summary` for lighter payloads.
- Global HTTP middleware now provides:
  - request id tracing
  - structured request logging
  - standardized error envelope
- Health endpoint includes readiness-style checks for DB and index availability.

Validation status:

- Full regression test suite passes with added security guard checks.
