# Auth API (Phase 1)

Base path: `/api/v1/auth`

## Endpoints

- `POST /signup`
  - Creates user with password auth (`email` or `phone` required).
  - Generates OTP for verification.
  - Returns access/refresh tokens and optional `dev_otp` when `AUTH_DEBUG_RETURN_OTP=true`.
- `POST /verify-otp`
  - Validates OTP for the provided channel/target/purpose.
  - Marks user channel as verified when linked with a user.
- `POST /login`
  - Logs in with username/email/phone + password.
  - If user has no verified channel, returns `otp_required=true` and issues OTP.
- `POST /google-login`
  - Verifies Google ID token and creates/updates user as Google provider.
- `POST /refresh`
  - Rotates access + refresh tokens from a valid active refresh token.
- `POST /logout`
  - Revokes active session by refresh token.
- `GET /me`
  - Requires `Authorization: Bearer <access_token>`.
  - Returns user public profile.

## Implemented Collections

- `users`
  - Identity and auth metadata including verification flags and providers.
- `otp_verifications`
  - Temporary OTP records with purpose and expiry.
- `sessions`
  - Stores access and refresh tokens, expiry, and revocation state.

## Indexes

- `users`
  - Unique `username`
  - Unique sparse `email`
  - Unique sparse `phone`
  - `created_at` descending
- `otp_verifications`
  - TTL on `expires_at`
  - Lookup index `(target, purpose, created_at)`
  - `user_id`
- `sessions`
  - `user_id`
  - Unique `refresh_token`
  - `access_expires_at`
  - `refresh_expires_at`

## Current Security Baseline

- Passwords are hashed using PBKDF2-HMAC-SHA256.
- OTP values are hashed with SHA256 before persistence.
- JWT-based access and refresh tokens use env-driven secret and algorithm.

## Required Env Vars for Auth

- `JWT_SECRET`
- `JWT_ALGORITHM` (default `HS256`)
- `ACCESS_TOKEN_EXPIRY_MINUTES` (default `30`)
- `REFRESH_TOKEN_EXPIRY_DAYS` (default `30`)
- `OTP_EXPIRY_MINUTES` (default `10`)
- `OTP_MAX_ATTEMPTS` (default `5`)
- `MONGODB_URI`
- `MONGODB_DATABASE`

Optional:

- `GOOGLE_CLIENT_ID` (for strict Google audience validation)
- `AUTH_DEBUG_RETURN_OTP` (debug only)
