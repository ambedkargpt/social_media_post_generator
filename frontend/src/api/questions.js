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

// GET /questions/party — the ten questions about the party itself, in order.
// These ask what the writer wants said about their party rather than how
// someone at their level writes, so they depend on the party alone and not on
// the position. Empty for a party with no set, which is an ordinary answer.
//
// Questions carry is_compulsory. It is deliberately not is_required: both
// parties' sets are active at once, so the backend cannot enforce it across
// every user. The screens that ask the question enforce it instead.
export async function getPartyQuestions(party) {
  const { data } = await client.get('/questions/party', { params: { party } });
  return Array.isArray(data) ? data : [];
}

// GET /questions/pending — { party, position }, each true when the signed-in
// user has that set and has answered none of it.
//
// "None of it", not "some gap in it": someone who answered two of ten has seen
// the questionnaire and stopped, and the rest fall back to their defaults.
//
// The party set is only ever pending for an account older than the questions,
// which is what keeps a fresh sign-up at five questions instead of fifteen.
export async function getPendingQuestionSets() {
  const { data } = await client.get('/questions/pending');
  return { party: Boolean(data?.party), position: Boolean(data?.position) };
}
