# Phase 4 Hardening Summary

This phase balances security, performance, and reliability while keeping API contracts stable.

## Security

- Refresh tokens are now stored in sessions as `refresh_token_hash` (SHA256).
- Session refresh/revoke lookups use hashed refresh token matching.
- `dev_otp` exposure is restricted to development/test-like environments.
- Reusable bearer auth dependency added for route protection.
- Protected write/read paths:
  - posts (owner-scoped)
  - profile answers (owner-scoped)
  - news/question writes (authenticated)

## Performance

- Pagination standardized with `limit` + `skip`:
  - news list
  - questions list
  - profile answers list
  - posts list already supported
- Optional `include_summary` toggle for news list payload size control.

## Reliability

- HTTP middleware adds request id (`X-Request-Id`) and structured request logs.
- Global exception handling returns consistent response envelope with `request_id`.
- Health endpoint now includes readiness-style checks:
  - `database_connected`
  - `indexes_ready`

## Tests

- Added security API tests for:
  - missing bearer token protection
  - cross-user post write prevention
- Full regression suite passes.
