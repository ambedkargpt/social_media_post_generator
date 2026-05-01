# Phase 3 Posts Sample Documents

```json
{
  "_id": "ObjectId('67f6f3fe8f5f8e8b73d2ff11')",
  "user_id": "ObjectId('67f5a0b18f5f8e8b73d2f1a1')",
  "news_id": "ObjectId('67f6a0b18f5f8e8b73d2f9a1')",
  "content": "Campus voices matter. Organize, read Ambedkar, and build solidarities.",
  "hashtags": ["ambedkar", "campusrights", "dalityouth"],
  "status": "published",
  "generation_meta": {
    "model": "gpt-5",
    "prompt_version": "v2",
    "pipeline": "generate_posts_from_news"
  },
  "created_at": "2026-04-10T15:00:00.000Z",
  "updated_at": "2026-04-10T15:03:00.000Z"
}
```

Example variant for same user + news:

```json
{
  "_id": "ObjectId('67f6f42f8f5f8e8b73d2ff12')",
  "user_id": "ObjectId('67f5a0b18f5f8e8b73d2f1a1')",
  "news_id": "ObjectId('67f6a0b18f5f8e8b73d2f9a1')",
  "content": "Study circles are resistance. Discuss constitutional rights this week.",
  "hashtags": ["studycircle", "constitution", "ambedkar"],
  "status": "draft",
  "generation_meta": {
    "model": "gpt-5",
    "prompt_version": "v2",
    "pipeline": "generate_posts_from_news"
  },
  "created_at": "2026-04-10T15:05:00.000Z",
  "updated_at": "2026-04-10T15:05:00.000Z"
}
```
