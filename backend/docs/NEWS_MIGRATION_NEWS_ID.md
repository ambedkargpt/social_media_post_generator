# News Migration with `news_id`

This phase introduces a stable custom `news_id` for frontend-safe references, while preserving Mongo `_id`.

## `news_id` format

- Pattern: `news_000001`, `news_000002`, ...
- Stored in each `news` document as `news_id` (string).
- Unique index: `uq_news_news_id` (partial unique on string values).

## Source import files

- `outputs/generated_news.json`
- `outputs/generated_news_legacy.json`

## Migration behavior

- Normalize `video_link` to `source_url` (lowercase).
- Build canonical payload:
  - `headline` from input headline
  - `summary` from `summary_text` (full text for LLM context)
  - `description` from `subheadline` when available, else fallback to `summary`
  - `published_at` from `upload_datetime_utc` where available
  - `legacy_source` as `current` or `legacy`
  - `original_sort_timestamp` from `sort_timestamp`
- Deduplicate by `source_url`.
- On duplicate, keep record with latest `original_sort_timestamp`.
- Upsert by `source_url` (idempotent).
- Preserve existing `news_id` where present.

## Script

Run:

```powershell
$env:PYTHONPATH='.'; .\venv\Scripts\python scripts\migrate_news_to_db.py
```

## API access

- Existing:
  - `GET /api/v1/news/{mongo_id}`
- Added:
  - `GET /api/v1/news/by-news-id/{news_id}`

All news responses include:
- `id` (Mongo `_id` as string)
- `news_id` (stable custom id)
- `summary` (full summary text)
