import client from './client';

// GET /questions — fetch active questions ordered by creation
// Returns [{ question_id, question_text, options, answer_type, ... }]
// Position questions are not in this list; use getPositionQuestions.
export async function getQuestions(limit = 7) {
  const { data } = await client.get('/questions/', { params: { limit } });
  return data;
}

// GET /questions/position — the five preference questions written for one
// party and one position group, in order. Empty for a party or group that has
// no set yet, which is an ordinary answer rather than an error.
//
// `party` is the party name exactly as stored on the user; the backend decides
// which set it maps to. Each question carries options_hi parallel to options:
// save the English option, show the Hindi at the same index.
export async function getPositionQuestions(party, group) {
  const { data } = await client.get('/questions/position', { params: { party, group } });
  return Array.isArray(data) ? data : [];
}
