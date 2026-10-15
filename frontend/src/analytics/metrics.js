// Google Analytics 4.
//
// Everything here is a no-op unless VITE_GA_MEASUREMENT_ID is set at build
// time, which it only is for the production build. That is deliberate: a
// developer running the site locally, or a preview build, should not be
// posting into the same property the real numbers live in. Nothing needs
// guarding at the call sites - `trackEvent` is always safe to call.
//
// The id is read from the environment rather than written here because the
// host sets it, not the repo, the same way VITE_API_URL works.

const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || '';

/** True when a browser has asked not to be tracked. */
function optedOut() {
  if (typeof navigator === 'undefined') return false;
  return navigator.doNotTrack === '1' || window.doNotTrack === '1';
}

const enabled = Boolean(MEASUREMENT_ID) && !optedOut();

let started = false;

/**
 * Load gtag.js and configure the property.
 *
 * `send_page_view: false` is the important part. gtag sends one page_view on
 * load, and on a single-page app that is the only one it would ever send -
 * every route change afterwards is a history push, not a page load. The app
 * sends them itself instead, through `trackPageView`, which also lets it send
 * a readable title rather than the one <title> every route shares.
 *
 * In the GA console, turn OFF the advanced setting under Enhanced measurement
 * → Page views → "Page changes based on browser history events". Left on, it
 * fires its own page_view for the same navigation and every figure doubles.
 */
export function initAnalytics() {
  if (!enabled || started || typeof document === 'undefined') return;
  started = true;

  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  // The real gtag is this exact function: it pushes `arguments`, not an array
  // literal. GA reads the arguments object itself, so a spread here would
  // silently drop every call.
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;

  gtag('js', new Date());
  gtag('config', MEASUREMENT_ID, { send_page_view: false });
}

/** One screen view. Called on every route change, including the first. */
export function trackPageView(path, title) {
  if (!enabled || typeof window.gtag !== 'function') return;
  window.gtag('event', 'page_view', {
    page_path: path,
    page_title: title,
    page_location: window.location.href,
  });
}

/**
 * One event.
 *
 * Names are snake_case because that is what GA reports on, and the built-in
 * names (`login`, `sign_up`, `search`) are worth reusing where they fit: GA
 * already understands them and shows them in its own reports without anything
 * being configured.
 */
export function trackEvent(name, params = {}) {
  if (!enabled || typeof window.gtag !== 'function') return;
  window.gtag('event', name, params);
}

/**
 * Tie events to a signed-in person, so a session that starts logged out and
 * continues logged in reads as one person rather than two.
 *
 * The id is the app's own user id, never an email or a phone number - sending
 * anything that identifies a person directly is against Google's terms and
 * would get the property shut down.
 */
export function setAnalyticsUser(userId) {
  if (!enabled || typeof window.gtag !== 'function') return;
  window.gtag('set', { user_id: userId || undefined });
}

export const analyticsEnabled = enabled;
