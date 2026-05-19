import client from './client';

// GET /news — paginated news list, optional language filter ("en" | "hi")
export async function getNews({ limit = 100, skip = 0, language } = {}) {
  const params = { limit, skip };
  if (language) params.language = language;
  const { data } = await client.get('/news', { params });
  return data;
}

// GET /news/:id
export async function getNewsById(id) {
  const { data } = await client.get(`/news/${id}`);
  return data;
}
