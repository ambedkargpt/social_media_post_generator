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
