# Phase 3 Posts API

Base path: `/api/v1/posts`

## Endpoints

- `POST /`
  - Create generated post variant.
- `GET /`
  - List posts with optional filters:
    - `user_id`
    - `news_id`
    - `status`
    - `limit`
    - `skip`
- `GET /dashboard`
  - Dashboard-optimized post cards with content preview.
  - Optional filters: `user_id`, `limit`.
- `GET /{post_id}`
  - Fetch single post by id.
- `PATCH /{post_id}`
  - Partial update (`content`, `hashtags`, `status`, `generation_meta`).
- `DELETE /{post_id}`
  - Archive-first behavior (sets `status=archived`).

## Variant Model

- Multiple post variants are allowed for the same `(user_id, news_id)`.
- No unique constraint is enforced on `(user_id, news_id)`.

## Business Rules

- `hashtags` are normalized to lowercase unique values.
- `user_id` and `news_id` must be valid ObjectIds and exist in DB on create.
- Status transitions:
  - `draft -> draft|published|archived`
  - `published -> published|archived`
  - `archived -> archived`
