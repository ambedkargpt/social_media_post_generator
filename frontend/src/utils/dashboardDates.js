// Local-calendar date helpers for the dashboard. Every comparison is by local
// day, so a post made at 1 AM counts on the day the user saw it happen.

export function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

// Monday, to match the Mon-to-Sun axis of the day-of-week chart.
export function startOfWeek(d) {
  const x = startOfDay(d);
  return addDays(x, -((x.getDay() + 6) % 7));
}

function locale(lang) {
  return lang === 'hi' ? 'hi-IN' : 'en-US';
}

// Assembled from parts rather than one toLocaleDateString call: en-GB now
// prints "Sept", and the design reads "6 Sep 2025".
function monthShort(d, lang) {
  return d.toLocaleDateString(locale(lang), { month: 'short' });
}

export function formatFullDate(d, lang) {
  return `${d.getDate()} ${monthShort(d, lang)} ${d.getFullYear()}`;
}

export function formatAxisDate(d, lang) {
  return lang === 'hi'
    ? `${d.getDate()} ${monthShort(d, lang)}`
    : `${monthShort(d, lang)} ${d.getDate()}`;
}

export function weekdayShort(d, lang) {
  return d.toLocaleDateString(locale(lang), { weekday: 'short' });
}

// <input type="date"> speaks YYYY-MM-DD in local time. new Date('2026-09-14')
// would parse it as UTC midnight, which is the previous day west of Greenwich.
export function toInputValue(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fromInputValue(v) {
  const [y, m, day] = String(v || '').split('-').map(Number);
  return y && m && day ? new Date(y, m - 1, day) : null;
}
