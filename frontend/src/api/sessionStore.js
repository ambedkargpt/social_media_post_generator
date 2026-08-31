/**
 * Where the signed-in session lives.
 *
 * sessionStorage, not localStorage: the session belongs to the tab. Close the
 * tab and it is gone, so the next visit starts signed out.
 *
 * localStorage survives tab closes and browser restarts, which is the right
 * default for a consumer app and the wrong one here. Someone on a shared or
 * borrowed device closed the tab, reopened the site and reached BheemBot still
 * signed in, having authenticated nothing. Reloading a page still keeps you
 * signed in, because sessionStorage survives a reload; only closing the tab
 * ends it.
 *
 * The trade, worth knowing: sessionStorage is per-tab, so opening the site in a
 * second tab starts signed out there. That is the same property that makes
 * closing the tab work, not a separate bug.
 *
 * Every accessor is guarded. Private windows and browsers set to block site
 * data throw on access rather than returning null, and a storage failure must
 * never be the reason someone cannot use the page.
 */

const KEYS = ['access_token', 'refresh_token', 'user'];

export function readSession(key) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeSession(key, value) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* private mode, quota, blocked storage: not worth failing a login over */
  }
}

export function removeSession(key) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* nothing to do if it cannot be reached */
  }
}

/**
 * Drop sessions left in localStorage by the previous build.
 *
 * Without this, anyone already signed in stays signed in across tab closes
 * forever: their tokens sit in localStorage, nothing reads them any more, and
 * nothing clears them either. Runs once at startup.
 */
export function purgeLegacySession() {
  try {
    KEYS.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
