import client from './client';

// POST /posts — save a generated post
export async function createPost({ userId, newsId, content, hashtags = [], status = 'draft', generationMeta }) {
  const { data } = await client.post('/posts', {
    user_id: userId,
    news_id: newsId,
    content,
    hashtags,
    status,
    generation_meta: generationMeta,
  });
  return data;
}

// POST /posts/generate — run retrieval + LLM generation on backend
export async function generatePostForNews({ userId, newsId, tone, temperature, language, profileOverrides }) {
  const payload = {
    user_id: userId,
    news_id: newsId,
    tone,
    temperature,
    language,
    profile_overrides: profileOverrides,
  };
  const { data } = await client.post('/posts/generate', payload);
  return data;
}

// POST /posts/:id/regenerate — rerun LLM only using stored retrieval snapshot
export async function regeneratePostFromSnapshot(postId, { temperature, language, profileOverrides, refinementNote } = {}) {
  const payload = { temperature, language, profile_overrides: profileOverrides, refinement_note: refinementNote || undefined };
  const { data } = await client.post(`/posts/${postId}/regenerate`, payload);
  return data;
}

// POST /posts/:id/translate — translate post content to another language
export async function translatePost(postId, targetLanguage = 'en') {
  const { data } = await client.post(`/posts/${postId}/translate`, {
    target_language: targetLanguage,
  });
  return data; // { translated_content, target_language }
}

// GET /posts/daily-quota — used/remaining/reset_at + all-time total
export async function getDailyQuota() {
  const { data } = await client.get('/posts/daily-quota');
  return data; // { used, limit, remaining, reset_at, total_posts, milestone_target }
}

// GET /posts — list user's posts
export async function getPosts({ newsId, status, limit = 50, skip = 0 } = {}) {
  const { data } = await client.get('/posts', {
    params: { news_id: newsId, status, limit, skip },
  });
  return data;
}

// PATCH /posts/:id
export async function updatePost(id, updates) {
  const { data } = await client.patch(`/posts/${id}`, updates);
  return data;
}

// DELETE /posts/:id (archives)
export async function deletePost(id) {
  const { data } = await client.delete(`/posts/${id}`);
  return data;
}
