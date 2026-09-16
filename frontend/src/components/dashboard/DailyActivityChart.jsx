import { useState } from 'react';
import Card, { CardTitle } from './Card';
import PillDropdown from './PillDropdown';
import useChartScale from './useChartScale';
import { useI18n } from '../../i18n/index.jsx';
import { addDays, startOfWeek, weekdayShort } from '../../utils/dashboardDates';

const PERIODS = [
  { id: 'this', key: 'chart.thisWeek' },
  { id: 'last', key: 'chart.lastWeek' },
  { id: 'all',  key: 'chart.allTime' },
];

// Weeks run Monday to Sunday and are taken around the date chosen at the top
// of the dashboard, so "This week" is today's week unless another day is picked.
function postsInPeriod(posts, anchor, period) {
  if (period === 'all') return posts;
  const start = addDays(startOfWeek(anchor), period === 'last' ? -7 : 0);
  const end = addDays(start, 7);
  return posts.filter((p) => {
    const d = new Date(p.created_at);
    return d >= start && d < end;
  });
}

// Monday first. Names come from a real Monday-to-Sunday run of dates, so the
// locale supplies them rather than a hard-coded English list.
function buildData(posts, lang) {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const p of posts) {
    const d = new Date(p.created_at);
    if (!Number.isNaN(d.getTime())) counts[(d.getDay() + 6) % 7]++;
  }
  const monday = startOfWeek(new Date());
  return counts.map((v, i) => ({ d: weekdayShort(addDays(monday, i), lang), v }));
}

// Matches the line chart's plot box, so the two cards in the row line up.
const W = 520, H = 200, PAD_L = 36, PAD_R = 16, PAD_T = 14, PAD_B = 32;

export default function DailyActivityChart({ posts = [], anchor = new Date() }) {
  const { t, lang } = useI18n();
  const [period, setPeriod] = useState('this');
  const [plotRef, scale] = useChartScale(W);
  const yFont = (10 * scale).toFixed(1);
  const xFont = (11 * scale).toFixed(1);

  const shown = postsInPeriod(posts, anchor, period);
  const data = buildData(shown, lang);
  const maxVal = Math.max(...data.map((p) => p.v), 1);
  // Same headroom rule as the line chart: enough to keep the tallest bar off
  // the top, not enough to flatten the week into the bottom third.
  const MAX = Math.max(maxVal + 1, Math.ceil(maxVal * 1.12));
  const yTicks = [...new Set([0.25, 0.5, 0.75, 1].map((f) => Math.round(MAX * f)))].filter((v) => v > 0);

  const count = data.length;
  const slotW = (W - PAD_L - PAD_R) / count;
  const barW  = Math.min(34, slotW * 0.56);
  // The day with the most posts, called out in words so the chart says
  // something even before it is read.
  const busiest = data.reduce((best, p) => (p.v > best.v ? p : best), data[0]);

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <CardTitle>{t('chart.byDay')}</CardTitle>
          <p className="mt-1 text-[12px] text-[#7a86a8]">
            {busiest && busiest.v > 0
              ? t('chart.busiestDay', { day: busiest.d, n: busiest.v })
              : t('chart.noneInPeriod')}
          </p>
        </div>
        <PillDropdown
          value={period}
          onChange={setPeriod}
          ariaLabel={t('chart.rangeLabel')}
          options={PERIODS.map((o) => ({ id: o.id, label: t(o.key) }))}
        />
      </div>

      {posts.length === 0 || shown.length === 0 ? (
        <p className="mt-4 py-8 text-center text-[13px] text-[#6b78a0]">
          {t(posts.length === 0 ? 'charts.noPosts' : 'chart.noneInPeriod')}
        </p>
      ) : (
        <div ref={plotRef} className="mt-3 w-full overflow-hidden">
          <svg viewBox={`0 0 ${W} ${H}`} className="h-[172px] w-full sm:h-[196px]" role="img">
            <defs>
              <linearGradient id="barFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%"   stopColor="#7cb6ff" />
                <stop offset="100%" stopColor="#2b5fd0" />
              </linearGradient>
            </defs>

            {yTicks.map((tick) => {
              const y = PAD_T + (1 - tick / MAX) * (H - PAD_T - PAD_B);
              return (
                <g key={tick}>
                  <line x1={PAD_L} x2={W - PAD_R} y1={y} y2={y} stroke="rgba(60,85,155,0.14)" strokeDasharray="2 5" />
                  <text x={PAD_L - 7} y={y + Number(yFont) / 3} fontSize={yFont} fill="#5a6789" textAnchor="end" style={{ fontFamily: 'Count, Anybody, monospace' }}>{tick}</text>
                </g>
              );
            })}
            <line x1={PAD_L} x2={W - PAD_R} y1={H - PAD_B} y2={H - PAD_B} stroke="rgba(60,85,155,0.3)" />

            {data.map((p, i) => {
              const cx = PAD_L + slotW * i + slotW / 2;
              const h  = (p.v / MAX) * (H - PAD_T - PAD_B);
              const y  = H - PAD_B - h;
              return (
                <g key={i}>
                  {/* A day with no posts still gets a seat: a flat stub on the
                      zero line, so an empty day reads as empty rather than as
                      a gap in the chart. */}
                  {p.v > 0 ? (
                    <rect x={cx - barW / 2} y={y} width={barW} height={h} rx="5" fill="url(#barFill)" />
                  ) : (
                    <rect x={cx - barW / 2} y={H - PAD_B - 2} width={barW} height="2" rx="1" fill="rgba(90,120,190,0.28)" />
                  )}
                  <title>{`${p.d}: ${p.v}`}</title>
                  <text x={cx} y={H - 9} fontSize={xFont} fill="#6b7a9f" textAnchor="middle" style={{ fontFamily: 'Inter, sans-serif' }}>{p.d}</text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </Card>
  );
}
