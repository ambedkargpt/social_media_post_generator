# Auth Collection Field Types

This file documents the data structure used for each field in implemented auth collections.

## `users`

- `_id`: `ObjectId`
- `username`: `string`
- `password_hash`: `string | null`
- `email`: `string | null`
- `phone`: `string | null`
- `auth_providers`: `array<string>`
- `is_email_verified`: `bool`
- `is_phone_verified`: `bool`
- `is_active`: `bool`
- `last_login_at`: `datetime | null`
- `created_at`: `datetime`
- `updated_at`: `datetime`

## `otp_verifications`

- `_id`: `ObjectId`
- `user_id`: `ObjectId | null`
- `channel`: `string` (`email` or `phone`)
- `target`: `string`
- `otp_hash`: `string`
- `purpose`: `string` (`signup_verify` / `login_verify` / `reset_password` / `change_contact`)
- `attempt_count`: `int`
- `max_attempts`: `int`
- `expires_at`: `datetime` (TTL field)
- `consumed_at`: `datetime | null`
- `created_at`: `datetime`

## `sessions`

- `_id`: `ObjectId`
- `user_id`: `ObjectId`
- `access_token`: `string`
- `refresh_token`: `string`
- `access_expires_at`: `datetime`
- `refresh_expires_at`: `datetime`
- `device_info`: `object`
- `ip_address`: `string | null`
- `user_agent`: `string | null`
- `is_revoked`: `bool`
- `revoked_at`: `datetime | null`
- `created_at`: `datetime`
- `updated_at`: `datetime`
