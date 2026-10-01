import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { initAnalytics, trackPageView } from './ga';

/**
 * A readable name for each route.
 *
 * Without this every page reports as "AmbedkarGPT", because index.html has one
 * <title> and nothing changes it per route - so the Pages report would be a
 * single row and tell you nothing about where people actually go.
 *
 * Paths that carry an id or a type are matched by prefix and reported under
 * the pattern, not the value. A report with one row per generated post is not
 * a report.
 */
const TITLES = [
  ['/',                      'Home'],
  ['/about',                 'About'],
  ['/solutions',             'Solutions'],
  ['/resources',             'Resources'],
  ['/contact',               'Contact'],
  ['/login',                 'Log in'],
  ['/signup',                'Sign up'],
  ['/otp',                   'OTP verification'],
  ['/forgot-password',       'Forgot password'],
  ['/profile-setup',         'Profile setup'],
  ['/questionnaire',         'Questionnaire'],
  ['/dashboard',             'Dashboard'],
  ['/generate/social-media', 'Post generator'],
  ['/generate/music',        'Music generation'],
  ['/generate',              'Service selection'],
  ['/posts',                 'Post history'],
  ['/preferences',           'Preferences'],
  ['/bhimbot',               'BhimBot'],
];

export function titleForPath(pathname) {
  const exact = TITLES.find(([p]) => p === pathname);
  if (exact) return exact[1];
  // Longest prefix wins, so /generate/music/:type lands on Music generation
  // rather than on Service selection.
  const prefixes = TITLES
    .filter(([p]) => p !== '/' && pathname.startsWith(`${p}/`))
    .sort((a, b) => b[0].length - a[0].length);
  return prefixes.length ? prefixes[0][1] : 'Other';
}

/**
 * Sends one page_view per route change, and the first one on load.
 *
 * Mounted once, inside the router. gtag's own page_view is switched off in
 * ga.js, so this is the only source and there is nothing to double-count.
 */
export function usePageViews() {
  const { pathname, search } = useLocation();

  useEffect(() => { initAnalytics(); }, []);

  useEffect(() => {
    // The query string goes along because it carries the campaign parameters -
    // utm_source and the rest - that decide which acquisition channel a visit
    // is filed under.
    trackPageView(`${pathname}${search}`, titleForPath(pathname));
  }, [pathname, search]);
}
