import Card, { CardTitle } from './Card';
import { useI18n } from '../../i18n/index.jsx';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function buildData(posts) {
  const counts = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
  for (const p of posts) {
    const d = DAYS[new Date(p.created_at).getDay()];
    if (d) counts[d]++;
  }
  return DAYS.map((d) => ({ d, v: counts[d] }));
}

const W = 520, H = 230, PAD_L = 36, PAD_R = 18, PAD_T = 18, PAD_B = 36;

export default function DailyActivityChart({ posts = [] }) {
  const { t } = useI18n();
  const data = buildData(posts);
  const maxVal = Math.max(...data.map((p) => p.v), 1);
  const MAX = Math.ceil(maxVal * 1.3) || 5;
  const yTicks = [
    Math.round(MAX * 0.25),
    Math.round(MAX * 0.5),
    Math.round(MAX * 0.75),
    MAX,
  ];

  const count = data.length;
  const slotW = (W - PAD_L - PAD_R) / count;
  const barW  = Math.min(34, slotW * 0.52);

  return (
    <Card>
      <CardTitle>{t('chart.byDay')}</CardTitle>

      {posts.length === 0 ? (
        <p className="mt-4 py-8 text-center text-[13px] text-[#6b78a0]">
          No posts yet — generate one to see activity.
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

            {yTicks.map((t) => {
              const y = PAD_T + (1 - t / MAX) * (H - PAD_T - PAD_B);
              return (
                <g key={t}>
                  <line x1={PAD_L} x2={W - PAD_R} y1={y} y2={y} stroke="rgba(60,85,155,0.18)" strokeDasharray="3 4" />
                  <text x={PAD_L - 10} y={y + 3} fontSize="10" fill="#5a6789" textAnchor="end" style={{ fontFamily: 'Count, Anybody, monospace' }}>{t}</text>
                </g>
              );
            })}

            {data.map((p, i) => {
              const cx = PAD_L + slotW * i + slotW / 2;
              const h  = (p.v / MAX) * (H - PAD_T - PAD_B);
              const y  = H - PAD_B - h;
              return (
                <g key={p.d}>
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
