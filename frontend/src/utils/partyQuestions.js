// Whether a party has preference questions written for it.
// Mirrors question_party() in backend/pipeline/position_questions.py - keep
// the two in step, or a party the backend asks about looks question-less here.
const HAS_POSITION_SET = /indian national congress|\(inc\)|bahujan samaj|\(bsp\)|samajwadi|\(sp\)/i;

export function partyHasQuestions(party) {
  return HAS_POSITION_SET.test(String(party || ''));
}
