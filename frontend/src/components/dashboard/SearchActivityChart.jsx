import Card, { CardTitle } from './Card';
import { useI18n } from '../../i18n/index.jsx';

// Build last-7-days post counts
function buildData(posts) {
  const result = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dateStr = d.toDateString();
    const count = posts.filter((p) => new Date(p.created_at).toDateString() === dateStr).length;
    result.push({ d: label, v: count });
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

function catmullRomPath(pts) {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export default function SearchActivityChart({ posts = [] }) {
  const { t } = useI18n();
  const data   = buildData(posts);
  const maxVal = Math.max(...data.map((p) => p.v), 1);
  const MAX    = Math.ceil(maxVal * 1.3) || 5;
  const yTicks = [Math.round(MAX * 0.25), Math.round(MAX * 0.5), Math.round(MAX * 0.75), MAX];

  const pts  = toPoints(data, MAX);
  const line = catmullRomPath(pts);
  const area = `${line} L ${pts[pts.length - 1].x} ${H - PAD_B} L ${pts[0].x} ${H - PAD_B} Z`;

  return (
    <Card>
      <CardTitle>{t('chart.last7')}</CardTitle>

      {posts.length === 0 ? (
        <p className="mt-4 py-8 text-center text-[13px] text-[#6b78a0]">
          No posts yet — generate one to see activity.
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

            {yTicks.map((t) => {
              const y = PAD_T + (1 - t / MAX) * (H - PAD_T - PAD_B);
              return (
                <g key={t}>
                  <line x1={PAD_L} x2={W - PAD_R} y1={y} y2={y} stroke="rgba(60,85,155,0.18)" strokeDasharray="3 4" />
                  <text x={PAD_L - 10} y={y + 3} fontSize="10" fill="#5a6789" textAnchor="end" style={{ fontFamily: 'Count, Anybody, monospace' }}>{t}</text>
                </g>
              );
            })}

            <path d={area} fill="url(#searchArea)" />
            <path d={line} fill="none" stroke="url(#searchLine)" strokeWidth="2.4" strokeLinecap="round" />

            {pts.map((p) => (
              <g key={p.d}>
                <circle cx={p.x} cy={p.y} r="4.5" fill="#0b1331" stroke="url(#searchLine)" strokeWidth="2" />
                <text x={p.x} y={H - 12} fontSize="11" fill="#6b7a9f" textAnchor="middle" style={{ fontFamily: 'Inter, sans-serif' }}>{p.d}</text>
              </g>
            ))}
          </svg>
        </div>
      )}
    </Card>
  );
}
