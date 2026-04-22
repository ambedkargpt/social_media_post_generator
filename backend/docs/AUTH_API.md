# Auth API Documentation (Phase 1)

Base path: `/api/v1/auth`

## Endpoints

## `POST /signup`

Creates a new password-based user and triggers OTP verification for the chosen contact channel.

Request:

- `username` (string, required)
- `password` (string, required, min 8 chars)
- `email` (string, optional)
- `phone` (string, optional)

Rules:

- At least one of `email` or `phone` is required.
- `username`, `email`, `phone` uniqueness is enforced by DB indexes.

Response:

- `user` object
- `tokens` object (`access_token`, `refresh_token`, expiry fields)
- `otp_required=true`
- `otp_target`
- `dev_otp` only when `AUTH_DEBUG_RETURN_OTP=true`

## `POST /verify-otp`

Verifies OTP by target/channel/purpose and marks user verification channel if linked.

Request:

- `target` (string)
- `channel` (`email` | `phone`)
- `otp_code` (string)
- `purpose` (`signup_verify` | `login_verify` | `reset_password` | `change_contact`)

Response:

- `{ "message": "OTP verified successfully." }`

## `POST /login`

Logs in via `username` or `email` or `phone` and password.

Request:

- `identifier` (string)
- `password` (string)

Behavior:

- Returns tokens when credentials are valid.
- If no verified channel exists, triggers OTP flow (`otp_required=true`).

## `POST /google-login`

Logs in using Google ID token.

Request:

- `id_token` (string)

Behavior:

- Validates token using `google-auth`.
- Upserts user by email and ensures provider includes `google`.
- Returns tokens.

## `POST /refresh`

Rotates access/refresh tokens using valid active refresh session.

Request:

- `refresh_token` (string)

Response:

- New `tokens` + user object.

## `POST /logout`

Revokes session by refresh token.

Request:

- `refresh_token` (string)

Response:

- `{ "message": "Logged out successfully." }`

## `GET /me`

Returns current user profile from access token.

Header:

- `Authorization: Bearer <access_token>`

## Index strategy (implemented)

- `users`: unique `username`, unique partial `email`, unique partial `phone`
- `otp_verifications`: TTL on `expires_at` + lookup indexes
- `sessions`: user lookup + unique refresh token + expiry indexes

## Security baseline

- Passwords are hashed (PBKDF2-HMAC-SHA256).
- OTP codes are stored hashed (SHA256).
- JWT access and refresh tokens are issued and validated with `JWT_SECRET`.
