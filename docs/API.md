# API reference

Base URL is `<host>/api/v1`. Every router in `backend/api/v1/` is mounted under
that prefix by `backend/main.py`. Interactive documentation generated from the
code is served at `/docs`, with the raw schema at `/openapi.json`.

## Authentication

Protected endpoints depend on `get_current_user_id`
(`backend/core/dependencies.py`) and expect a bearer access token:

```
Authorization: Bearer <access_token>
```

Tokens come from `/auth/login`, `/auth/signup` (after OTP verification) or
`/auth/google-login`, and are refreshed through `/auth/refresh`.

The **Auth** column below reflects what the code enforces, not what is
convention. Endpoints marked "no" are reachable without a token.

## Health — `/health`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health/live` | no | Process liveness. Always `{"status": "ok"}`. |
| GET | `/health/ready` | no | DB ping + index introspection + artifact readiness. `503` when any check fails. |
| GET | `/health/` | no | Backwards-compatible alias with the same semantics as `/ready`. |

The `/ready` body carries `database_connected`, `indexes_ready`,
`artifacts_ready` and a nested `artifacts` detail object, so a `503` identifies
its own cause.

## Auth — `/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/signup` | no | Create an account and issue an OTP. `400`, `409`. |
| POST | `/auth/verify-otp` | no | Verify the OTP. `400`. |
| POST | `/auth/login` | no | Email/password login. `401`. |
| POST | `/auth/forgot-password` | no | Start password recovery. `400`, `404`. |
| POST | `/auth/send-phone-otp` | no | Send an OTP to a phone number. `404`, `409`. |
| POST | `/auth/resend-otp` | no | Reissue an outstanding OTP. `404`. |
| POST | `/auth/google-login` | no | Exchange a Google ID token for tokens. `400`, `401`. |
| POST | `/auth/refresh` | no | Exchange a refresh token for a new pair. `401`. |
| POST | `/auth/logout` | no | Delete the session. `404`. |
| GET | `/auth/me` | yes | Current user. `401`. |
| PATCH | `/auth/me` | yes | Update the current user. `401`, `409`. |

Endpoint-level contracts, validation rules and index strategy are documented in
more detail in `backend/docs/AUTH_API.md` and `backend/auth/README.md`.

## News — `/news`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/news/` | yes | Create a news item. |
| GET | `/news/tenants` | no | Tenant registry for the client's party selector. |
| GET | `/news/` | no | List news. |
| GET | `/news/by-news-id/{news_id}` | no | Fetch by the custom `news_id`. |
| GET | `/news/{news_id}` | no | Fetch by Mongo `_id`. |
| PATCH | `/news/{news_id}` | yes | Update a news item. |

`GET /news/` query parameters:

| Parameter | Type | Default | Notes |
|---|---|---|---|
| `limit` | int | `100` | 1–500. |
| `skip` | int | `0` | |
| `include_summary` | bool | `true` | |
| `language` | string | none | |
| `tenant` | string | none | Party tenant id or slug. Omit for all news. |
| `include_general` | bool | `true` | With a tenant given, also include general/neutral news. |

Note that all four read endpoints are unauthenticated, so the news catalogue —
including anything not yet meant to be public — is world-readable wherever the
API is exposed. Only writes require a token. If that is not the intent, add the
dependency in `backend/api/v1/news.py`; the write routes already show the
pattern.

There are two distinct identifiers. `news_id` in the path of `/news/{news_id}`
is the Mongo `_id`, while `/news/by-news-id/{news_id}` takes the project's own
`news_id` field. `backend/docs/NEWS_MIGRATION_NEWS_ID.md` explains the strategy
and the legacy migration.

## Questions — `/questions`

The profile question catalogue that drives the writing voice.

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/questions/` | yes | Create a question. |
| GET | `/questions/` | yes | List questions. |
| GET | `/questions/{question_id}` | no | Fetch one question. |
| PATCH | `/questions/{question_id}` | yes | Update a question. |

## Profile — `/profile`

| Method | Path | Auth | Description |
|---|---|---|---|
| PUT | `/profile/answers/{question_id}` | yes | Upsert one answer. |
| PUT | `/profile/answers` | yes | Upsert answers in bulk. |
| GET | `/profile/answers` | yes | List the current user's answers. |
| GET | `/profile/answers/{question_id}` | yes | Fetch one answer. |

Contracts and validation rules are in `backend/docs/PHASE2_API.md`.

## Posts — `/posts`

Every route here is authenticated, and every route compares the resource owner
against the caller, returning `403` on mismatch. That includes `list` and
`dashboard`, where passing another user's `user_id` as a query parameter is
rejected rather than quietly filtered.

| Method | Path | Description |
|---|---|---|
| POST | `/posts/` | Store a post. `payload.user_id` must equal the caller. |
| GET | `/posts/daily-quota` | Remaining generations for the calling user today. |
| POST | `/posts/generate` | Generate a post for a news item. |
| POST | `/posts/{post_id}/translate` | Translate an existing post. |
| POST | `/posts/{post_id}/regenerate` | Regenerate, reusing the stored retrieval snapshot. |
| GET | `/posts/` | List the caller's posts. |
| GET | `/posts/dashboard` | Dashboard view. |
| GET | `/posts/{post_id}` | Fetch one post. |
| PATCH | `/posts/{post_id}` | Update content, hashtags or status. |
| DELETE | `/posts/{post_id}` | Archive — a status change, not a hard delete. |

`POST /posts/generate` request fields: `user_id`, `news_id`, and the optional
`tone`, `temperature`, `language` and `profile_overrides`.

The response is a `PostGenerateResponse`: the created post, the list of
`references` (the retrieved chunks that grounded it), a
`retrieval_snapshot_id` of the form `rs_<uuid4hex>`, and `retrieval_reused`.
Hold the snapshot id to regenerate later against the same retrieval result
instead of retrieving afresh.

Status codes worth handling on the client:

| Code | Meaning |
|---|---|
| `403` | The post or news item belongs to another user. |
| `404` | The news item does not exist. |
| `502` | The model returned empty content — usually a reasoning model exhausting its completion budget on chain-of-thought. |
| `503` | No chunks, transcript or research brief could be gathered. The API refuses to write an ungrounded post rather than degrade quietly. |

`GET /posts/` accepts `user_id`, `news_id`, `status`, `limit` (1–500,
default 100) and `skip`. `GET /posts/dashboard` accepts `user_id` and `limit`
(1–200, default 50).

Field types and sample documents, including variants, are in
`backend/docs/PHASE3_POSTS_API.md`,
`backend/docs/PHASE3_POSTS_FIELD_TYPES.md` and
`backend/docs/PHASE3_POSTS_SAMPLE_DOCUMENTS.md`.

## Chat — `/chat`

BheemBot: retrieval-augmented Q&A over the corpus
(`backend/api/v1/chat.py`).

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/chat/message` | yes | Ask a question; returns a reply plus sources. |

Request: `message`, an optional `history` array of `{role, content}` turns for
context, and an optional `language` of `"en"` or `"hi"` (default `"en"`).

Response: `reply` plus `sources`, each source carrying `video_title` and a
`snippet`. The handler runs retrieval in a thread pool with a timeout, so a slow
retrieval fails the request rather than hanging the worker.

## Contact — `/contact`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/contact` | no | Deliver a contact-form submission over SMTP. |

Note the path has no trailing slash — the route is registered as `""` on a
router whose prefix is `/contact`.

## Error envelope

`register_http_layer` installs handlers for `StarletteHTTPException` and
`RequestValidationError` so both come back in the project's `ErrorResponse`
shape (`backend/schemas/auth.py`) rather than FastAPI's default. Validation
failures are flattened into a single readable `detail` string by
`_validation_detail` in `backend/core/http.py`.
