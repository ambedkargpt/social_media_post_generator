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

/* The dashboard's own surfaces, so this page belongs to the product rather
   than to the brief it was drawn from. The values are index.css's .dash-panel,
   .dash-tile and .dash-inset; kept here as objects because these components
   style inline, and duplicated values would drift from the stylesheet. */
export const BORDER = 'rgba(60, 85, 155, 0.22)';
export const BORDER_SOFT = 'rgba(60, 85, 155, 0.18)';

export const PANEL = {
  borderRadius: 16,
  border: `1px solid ${BORDER}`,
  background: 'linear-gradient(180deg, rgba(16,25,55,0.8) 0%, rgba(10,16,38,0.8) 100%)',
  boxShadow: 'inset 0 1px 0 rgba(150,195,255,0.05)',
};

export const TILE = {
  borderRadius: 14,
  border: `1px solid ${BORDER_SOFT}`,
  background: 'linear-gradient(180deg, rgba(14,23,52,0.7) 0%, rgba(9,15,36,0.7) 100%)',
};

// No border: nested inside a panel, an outline reads as a card in a card.
export const INSET = {
  borderRadius: 12,
  background: 'rgba(255,255,255,0.022)',
};

export const R_CTRL = 10;

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
