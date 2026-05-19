import client from './client';

// GET /questions — fetch active questions ordered by creation
// Returns [{ question_id, question_text, options, answer_type, ... }]
export async function getQuestions(limit = 7) {
  const { data } = await client.get('/questions', { params: { limit } });
  return data;
}
