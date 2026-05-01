# Phase 2 Field Types

## `news`

- `_id`: `ObjectId`
- `headline`: `string`
- `description`: `string`
- `source_name`: `string | null`
- `source_url`: `string | null`
- `published_at`: `datetime | null`
- `language`: `string | null`
- `tags`: `array<string>`
- `embedding_ref`: `string | null`
- `created_at`: `datetime`
- `updated_at`: `datetime`

## `questions`

- `_id`: `ObjectId`
- `question_id`: `string`
- `question_text`: `string`
- `category`: `string | null`
- `answer_type`: `string` (`text` | `single_select` | `multi_select` | `number` | `boolean`)
- `options`: `array<string>`
- `is_active`: `bool`
- `version`: `int`
- `created_at`: `datetime`
- `updated_at`: `datetime`

## `user_profile_answers`

- `_id`: `ObjectId`
- `user_id`: `ObjectId`
- `question_id`: `string`
- `answer`: `mixed`
- `source`: `string` (`onboarding` | `profile_update` | `survey`)
- `answered_at`: `datetime`
- `created_at`: `datetime`
- `updated_at`: `datetime`
