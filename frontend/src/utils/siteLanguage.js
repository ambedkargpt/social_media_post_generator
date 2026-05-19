const STORAGE_KEY = 'ambedkargpt-site-language';

export const SITE_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी' },
];

export function getSiteLanguage() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return SITE_LANGUAGES.some((l) => l.code === value) ? value : null;
  } catch {
    return null;
  }
}

export function setSiteLanguage(code) {
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* ignore quota / private mode */
  }
}

export function getSiteLanguageLabel(code) {
  return SITE_LANGUAGES.find((l) => l.code === code)?.label ?? null;
}
