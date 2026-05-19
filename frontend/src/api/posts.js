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
export async function generatePostForNews({ userId, newsId, tone, temperature, language }) {
  const payload = {
    user_id: userId,
    news_id: newsId,
    tone,
    temperature,
    language,
  };
  const { data } = await client.post('/posts/generate', payload);
  return data;
}

// POST /posts/:id/regenerate — rerun LLM only using stored retrieval snapshot
export async function regeneratePostFromSnapshot(postId, { temperature, language } = {}) {
  const payload = { temperature, language };
  const { data } = await client.post(`/posts/${postId}/regenerate`, payload);
  return data;
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
