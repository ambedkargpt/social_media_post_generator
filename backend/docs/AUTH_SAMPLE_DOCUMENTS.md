# Auth Sample Documents

These are representative document shapes for MongoDB collections.

## `users` sample

```json
{
  "_id": "ObjectId('67f5a0b18f5f8e8b73d2f1a1')",
  "username": "bharg",
  "password_hash": "salt_base64$digest_base64",
  "email": "bharg@example.com",
  "phone": null,
  "auth_providers": ["password", "google"],
  "is_email_verified": true,
  "is_phone_verified": false,
  "is_active": true,
  "last_login_at": "2026-04-09T13:05:22.000Z",
  "created_at": "2026-04-09T12:50:11.000Z",
  "updated_at": "2026-04-09T13:05:22.000Z"
}
```

## `otp_verifications` sample

```json
{
  "_id": "ObjectId('67f5a0d98f5f8e8b73d2f1a2')",
  "user_id": "ObjectId('67f5a0b18f5f8e8b73d2f1a1')",
  "channel": "email",
  "target": "bharg@example.com",
  "otp_hash": "f4f7d0f9e98e4d6f4c4f72f2fcb6f2f8b1739f8ce6d4ac2d8f6f0b5f9f8e7a6b",
  "purpose": "signup_verify",
  "attempt_count": 0,
  "max_attempts": 5,
  "expires_at": "2026-04-09T13:00:11.000Z",
  "consumed_at": null,
  "created_at": "2026-04-09T12:50:11.000Z"
}
```

## `sessions` sample

```json
{
  "_id": "ObjectId('67f5a11f8f5f8e8b73d2f1a3')",
  "user_id": "ObjectId('67f5a0b18f5f8e8b73d2f1a1')",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.access.payload",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh.payload",
  "access_expires_at": "2026-04-09T13:35:22.000Z",
  "refresh_expires_at": "2026-05-09T13:05:22.000Z",
  "device_info": {
    "platform": "web",
    "app_version": "1.0.0"
  },
  "ip_address": "49.37.10.22",
  "user_agent": "Mozilla/5.0",
  "is_revoked": false,
  "revoked_at": null,
  "created_at": "2026-04-09T13:05:22.000Z",
  "updated_at": "2026-04-09T13:05:22.000Z"
}
```
