# Phase 2 Sample Documents

## `news` sample

```json
{
  "_id": "ObjectId('67f6a0b18f5f8e8b73d2f9a1')",
  "headline": "AI in public policy",
  "description": "Long-form summary of the development.",
  "source_name": "Policy Times",
  "source_url": "https://policytimes.example/news/ai-public-policy",
  "published_at": "2026-04-10T10:00:00.000Z",
  "language": "en",
  "tags": ["ai", "policy", "india"],
  "embedding_ref": "news_emb_98312",
  "created_at": "2026-04-10T10:01:00.000Z",
  "updated_at": "2026-04-10T10:01:00.000Z"
}
```

## `questions` sample

```json
{
  "_id": "ObjectId('67f6a0e88f5f8e8b73d2f9a2')",
  "question_id": "q_pref_language",
  "question_text": "Which language do you prefer for generated posts?",
  "category": "preferences",
  "answer_type": "single_select",
  "options": ["en", "hi", "mr"],
  "is_active": true,
  "version": 1,
  "created_at": "2026-04-10T10:05:00.000Z",
  "updated_at": "2026-04-10T10:05:00.000Z"
}
```

## `user_profile_answers` sample

```json
{
  "_id": "ObjectId('67f6a1458f5f8e8b73d2f9a3')",
  "user_id": "ObjectId('67f5a0b18f5f8e8b73d2f1a1')",
  "question_id": "q_pref_language",
  "answer": "hi",
  "source": "onboarding",
  "answered_at": "2026-04-10T10:07:00.000Z",
  "created_at": "2026-04-10T10:07:00.000Z",
  "updated_at": "2026-04-10T10:07:00.000Z"
}
```
