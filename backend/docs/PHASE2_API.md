# Phase 2 API Documentation

Base path: `/api/v1`

## News APIs

- `POST /news/`
  - Create a news record.
- `GET /news/`
  - List news records (supports `limit` query param).
- `GET /news/{news_id}`
  - Fetch one news record by `_id`.
- `PATCH /news/{news_id}`
  - Partial update for headline/description/source/tags fields.

## Questions APIs

- `POST /questions/`
  - Create a question with unique `question_id`.
- `GET /questions/`
  - List questions.
- `GET /questions/{question_id}`
  - Fetch one question by `question_id`.
- `PATCH /questions/{question_id}`
  - Partial update question fields.

## User Profile Answer APIs (latest-only)

- `PUT /profile/answers/{question_id}`
  - Upsert latest answer for `(user_id, question_id)`.
  - Request includes: `user_id`, `answer`, `source`.
- `GET /profile/answers?user_id=<id>`
  - List all current answers for a user.
- `GET /profile/answers/{question_id}?user_id=<id>`
  - Get one user answer for a question.

## Validation Rules

- `question_id` must exist in `questions` before a profile answer upsert.
- `answer_type` is strictly validated in questions schema:
  - `text`, `single_select`, `multi_select`, `number`, `boolean`
- `source` for profile answers is strictly validated:
  - `onboarding`, `profile_update`, `survey`

## Implemented Indexes

- `news`:
  - `idx_news_published_at`
  - `idx_news_created_at`
  - `uq_news_source_url` (unique partial)
  - `idx_news_text` (headline + description text index)
- `questions`:
  - `uq_questions_question_id`
  - `idx_questions_category_active`
  - `idx_questions_created_at`
- `user_profile_answers`:
  - `uq_answers_user_question` (unique `(user_id, question_id)`)
  - `idx_answers_answered_at`
