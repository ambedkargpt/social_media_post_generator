import { useState } from 'react';
import Card, { CardTitle } from './Card';
import PillDropdown from './PillDropdown';
import { useI18n } from '../../i18n/index.jsx';
import { addDays, formatAxisDate, sameDay, startOfDay } from '../../utils/dashboardDates';

const RANGES = [7, 14, 30];
const TITLE_KEY = { 7: 'chart.last7', 14: 'chart.last14', 30: 'chart.last30' };

// Post counts for each day of the range, ending on the date chosen at the top
// of the dashboard (today unless the user picked another day).
function buildData(posts, anchor, days, lang) {
  const end = startOfDay(anchor);
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = addDays(end, -i);
    const v = posts.filter((p) => p.created_at && sameDay(new Date(p.created_at), day)).length;
    result.push({ d: formatAxisDate(day, lang), v });
  }
  return result;
}

const W = 520, H = 230, PAD_L = 36, PAD_R = 18, PAD_T = 18, PAD_B = 36;

function toPoints(data, MAX) {
  const step = (W - PAD_L - PAD_R) / (data.length - 1);
  return data.map((p, i) => ({
    x: PAD_L + i * step,
    y: PAD_T + (1 - p.v / MAX) * (H - PAD_T - PAD_B),
    ...p,
  }));
}

// Control points are held inside the plot. Unclamped, a run of empty days
// between busy ones swings the curve below the zero line, drawing counts that
// cannot exist; with thirty points it happened on every quiet stretch.
const clampY = (y) => Math.min(H - PAD_B, Math.max(PAD_T, y));

function catmullRomPath(pts) {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = clampY(p1.y + (p2.y - p0.y) / 6);
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = clampY(p2.y - (p3.y - p1.y) / 6);
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export default function SearchActivityChart({ posts = [], anchor = new Date() }) {
  const { t, lang } = useI18n();
  const [days, setDays] = useState(7);

  const data   = buildData(posts, anchor, days, lang);
  const total  = data.reduce((sum, p) => sum + p.v, 0);
  const maxVal = Math.max(...data.map((p) => p.v), 1);
  const MAX    = Math.ceil(maxVal * 1.3) || 5;
  const yTicks = [...new Set([0.25, 0.5, 0.75, 1].map((f) => Math.round(MAX * f)))].filter((v) => v > 0);

  const pts  = toPoints(data, MAX);
  const line = catmullRomPath(pts);
  const area = `${line} L ${pts[pts.length - 1].x} ${H - PAD_B} L ${pts[0].x} ${H - PAD_B} Z`;

  // Thirty date labels do not fit under the chart. Counted back from the last
  // day, so the chosen date always keeps its label.
  const labelEvery = days <= 7 ? 1 : days <= 14 ? 2 : 5;

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <CardTitle>{t(TITLE_KEY[days])}</CardTitle>
        <PillDropdown
          value={days}
          onChange={setDays}
          ariaLabel={t('chart.rangeLabel')}
          options={RANGES.map((n) => ({ id: n, label: t(`chart.range${n}`) }))}
        />
      </div>

      {posts.length === 0 || total === 0 ? (
        <p className="mt-4 py-8 text-center text-[13px] text-[#6b78a0]">
          {t(posts.length === 0 ? 'charts.noPosts' : 'chart.noneInPeriod')}
        </p>
      ) : (
        <div className="mt-4 w-full overflow-hidden">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[220px]">
            <defs>
              <linearGradient id="searchLine" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%"   stopColor="#3f9fff" />
                <stop offset="100%" stopColor="#7b5cff" />
              </linearGradient>
              <linearGradient id="searchArea" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%"   stopColor="#3f9fff" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#3f9fff" stopOpacity="0" />
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

            <path d={area} fill="url(#searchArea)" />
            <path d={line} fill="none" stroke="url(#searchLine)" strokeWidth="2.4" strokeLinecap="round" />

            {pts.map((p, i) => (
              <g key={i}>
                {days <= 14 && (
                  <circle cx={p.x} cy={p.y} r="4.5" fill="#0b1331" stroke="url(#searchLine)" strokeWidth="2" />
                )}
                {(pts.length - 1 - i) % labelEvery === 0 && (
                  <text x={p.x} y={H - 12} fontSize="11" fill="#6b7a9f" textAnchor="middle" style={{ fontFamily: 'Inter, sans-serif' }}>{p.d}</text>
                )}
              </g>
            ))}
          </svg>
        </div>
      )}
    </Card>
  );
}
