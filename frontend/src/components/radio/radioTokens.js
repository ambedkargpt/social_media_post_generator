/* ── the broadcast desk's constants and clock helpers ─────────────────────
   A plain module, not .jsx: a file that exports both components and values
   breaks fast refresh, and these are values.
   ------------------------------------------------------------------------ */

export const INK = '#e5e7eb';
export const MUTED = '#8b94b8';
export const RULE = '#2a3566';
export const SURFACE = '#0d1333';
export const GROUND = '#0a0e27';
export const ACCENT = '#1d7afc';
export const ACCENT_HOVER = '#3f9fff';
export const DEEP = '#05081a';

/** Seconds as m:ss. */
export function mmss(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** A Date as HH:MM in IST, which is the only clock this station keeps. */
export function istClock(date, withSeconds = false) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    ...(withSeconds ? { second: '2-digit' } : {}),
    hour12: false,
  }).format(date);
}

/**
 * When the story on air went out, as a wall clock.
 *
 * Counted back from now by how far into the story the broadcast is, so it is
 * the same clock the broadcast keeps. It used to be worked out from today's
 * midnight plus whole cycles, but the broadcast loops from midnight of the
 * bulletin's own date - yesterday's, for most of a day - and a day is not a
 * whole number of cycles, so the two disagreed by up to a cycle: a story on
 * air at 17:52 was labelled 18:22.
 */
export function airTime(now, offsetInStory) {
  return new Date(now - Math.max(0, offsetInStory || 0) * 1000);
}
