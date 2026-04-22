# Phase 3 Posts Field Types

## `posts`

- `_id`: `ObjectId`
- `user_id`: `ObjectId`
- `news_id`: `ObjectId`
- `content`: `string`
- `hashtags`: `array<string>`
- `status`: `string` (`draft` | `published` | `archived`)
- `generation_meta`: `object | null`
- `created_at`: `datetime`
- `updated_at`: `datetime`
