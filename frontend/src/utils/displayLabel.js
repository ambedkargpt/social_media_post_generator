import { translate } from '../i18n/index.jsx';
import { getSiteLanguage } from './siteLanguage';

// Party names, org levels and tones are stored on the user and matched against
// the backend, so the value has to stay exactly as it is. These translate the
// label only; when a key is missing the English value is returned unchanged,
// which is what a party we have not translated should show.
const slug = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');

function display(prefix, value, lang) {
  if (!value) return value;
  const key = `${prefix}.${slug(value)}`;
  const out = translate(lang ?? getSiteLanguage() ?? 'hi', key);
  return out === key ? value : out;
}

export const partyLabel = (name, lang) => display('party', name, lang);
export const levelLabel = (group, lang) => display('level', group, lang);
export const toneLabel  = (tone, lang) => display('tone', tone, lang);
