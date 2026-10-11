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
 * When a story goes out, as a wall clock.
 *
 * The bulletin loops from midnight IST, so a story's air time is midnight plus
 * its offset plus however many whole cycles have already run today. Without
 * the cycle count the running order would show tonight's stories as having
 * aired at 00:00.
 */
export function airTime(startSec, now, cycleLength) {
  const base = new Date(now);
  base.setHours(0, 0, 0, 0);
  const sinceMidnight = (now - base) / 1000;
  const cycles = cycleLength > 0 ? Math.floor(sinceMidnight / cycleLength) : 0;
  return new Date(base.getTime() + (cycles * cycleLength + startSec) * 1000);
}
