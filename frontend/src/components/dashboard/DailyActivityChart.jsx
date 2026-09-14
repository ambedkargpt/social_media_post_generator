import { useState } from 'react';
import Card, { CardTitle } from './Card';
import PillDropdown from './PillDropdown';
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

const W = 520, H = 230, PAD_L = 36, PAD_R = 18, PAD_T = 18, PAD_B = 36;

export default function DailyActivityChart({ posts = [], anchor = new Date() }) {
  const { t, lang } = useI18n();
  const [period, setPeriod] = useState('this');

  const shown = postsInPeriod(posts, anchor, period);
  const data = buildData(shown, lang);
  const maxVal = Math.max(...data.map((p) => p.v), 1);
  const MAX = Math.ceil(maxVal * 1.3) || 5;
  const yTicks = [...new Set([0.25, 0.5, 0.75, 1].map((f) => Math.round(MAX * f)))].filter((v) => v > 0);

  const count = data.length;
  const slotW = (W - PAD_L - PAD_R) / count;
  const barW  = Math.min(34, slotW * 0.52);

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <CardTitle>{t('chart.byDay')}</CardTitle>
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
        <div className="mt-4 w-full overflow-hidden">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[220px]">
            <defs>
              <linearGradient id="barFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%"   stopColor="#6aa8ff" />
                <stop offset="100%" stopColor="#3168dd" />
              </linearGradient>
            </defs>

            {yTicks.map((tick) => {
              const y = PAD_T + (1 - tick / MAX) * (H - PAD_T - PAD_B);
              return (
                <g key={tick}>
                  <line x1={PAD_L} x2={W - PAD_R} y1={y} y2={y} stroke="rgba(60,85,155,0.18)" strokeDasharray="3 4" />
                  <text x={PAD_L - 10} y={y + 3} fontSize="10" fill="#5a6789" textAnchor="end" style={{ fontFamily: 'Count, Anybody, monospace' }}>{tick}</text>
                </g>
              );
            })}

            {data.map((p, i) => {
              const cx = PAD_L + slotW * i + slotW / 2;
              const h  = (p.v / MAX) * (H - PAD_T - PAD_B);
              const y  = H - PAD_B - h;
              return (
                <g key={i}>
                  {p.v > 0 && (
                    <rect x={cx - barW / 2} y={y} width={barW} height={h} rx="4" fill="url(#barFill)" opacity="0.95" />
                  )}
                  <text x={cx} y={H - 12} fontSize="11" fill="#6b7a9f" textAnchor="middle" style={{ fontFamily: 'Inter, sans-serif' }}>{p.d}</text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </Card>
  );
}
