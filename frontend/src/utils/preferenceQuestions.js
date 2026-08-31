// The seven preferences that shape every generated post.
//
// Shared so the Preferences page and the generator's side panel agree on which
// questions are core. They used to disagree three ways: the page hardcoded its
// own seven, the panel listed its own seven, and the database marked fourteen
// questions is_required. Grouping by is_required would have quietly moved seven
// questions into the page's Core section.
export const CORE_QUESTION_IDS = [
  'profile_user_role',
  'profile_tone',
  'profile_target_audience',
  'profile_primary_focus',
  'profile_ambedkarite_perspective',
  'profile_content_length',
  'profile_call_to_action',
];

// Options are stored as "Label -> Description". The page shows the label alone
// on its buttons; the panel shows the whole string in a dropdown.
export function shortLabel(option) {
  const text = String(option ?? '');
  return text.includes(' -> ') ? text.split(' -> ')[0].trim() : text.trim();
}

// The label, plus the size the option actually commits to.
//
// "Short" and "Medium" say nothing on their own, and the numbers that decide
// the output were sitting in the description the dropdown threw away - so
// people picked a length without knowing what they were choosing between, then
// found the post was not the size they expected.
//
// Only a parenthetical about words is kept. Other questions have descriptions
// too ("Analyst -> Focus on explaining..."), and appending those would put a
// sentence in every row of a narrow dropdown.
export function labelWithSize(option) {
  const text = String(option ?? '');
  const label = shortLabel(text);
  const bracket = text.match(/\(([^)]*\bwords?\b[^)]*)\)/i);
  return bracket ? `${label} (${bracket[1].trim()})` : label;
}
