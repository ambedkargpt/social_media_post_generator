import Card, { CardTitle } from './Card';
import { useI18n } from '../../i18n/index.jsx';

const STATUS_COLORS = {
  draft:     '#6aa8ff',
  published: '#22c55e',
  archived:  '#ffb056',
};

const CX = 250, CY = 200, R = 130;

function polar(angle) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: CX + R * Math.cos(rad), y: CY + R * Math.sin(rad) };
}
function labelPos(angle) {
  const rad = ((angle - 90) * Math.PI) / 180;
  const dist = R + 28;
  return { x: CX + dist * Math.cos(rad), y: CY + dist * Math.sin(rad) };
}

function buildSlices(posts) {
  const counts = { draft: 0, published: 0, archived: 0 };
  for (const p of posts) {
    if (counts[p.status] !== undefined) counts[p.status]++;
  }
  const total = posts.length || 1;
  return Object.entries(counts)
    .filter(([, v]) => v > 0)
    .map(([label, v]) => ({
      label: `status.${label}`,
      pct: Math.round((v / total) * 100),
      color: STATUS_COLORS[label],
    }));
}

export default function CategoriesPieChart({ posts = [] }) {
  const { t } = useI18n();
  const slices = buildSlices(posts);

  if (!slices.length) {
    return (
      <Card className="h-full">
        <CardTitle>{t('chart.byStatus')}</CardTitle>
        <div className="flex h-[280px] items-center justify-center">
          <p className="text-[13px] text-[#6b78a0]">{t('chart.noPosts')}</p>
        </div>
      </Card>
    );
  }

  const arcs = slices.reduce((acc, s) => {
    const start = acc.angle;
    const end   = start + (s.pct / 100) * 360;
    const p1 = polar(start);
    const p2 = polar(end);
    const large = end - start > 180 ? 1 : 0;
    const mid = start + (end - start) / 2;
    acc.items.push({
      ...s,
      d: `M ${CX} ${CY} L ${p1.x} ${p1.y} A ${R} ${R} 0 ${large} 1 ${p2.x} ${p2.y} Z`,
      mid,
    });
    acc.angle = end;
    return acc;
  }, { angle: 0, items: [] }).items;

  return (
    <Card className="h-full">
      <CardTitle>{t('chart.byStatus')}</CardTitle>
      <div className="mt-2 flex items-center justify-center">
        <svg viewBox="0 0 500 400" className="w-full max-w-[520px] h-[340px]">
          {arcs.map((a) => (
            <path key={a.label} d={a.d} fill={a.color} stroke="#0a1130" strokeWidth="2.5" strokeLinejoin="round" />
          ))}
          {arcs.map((a) => {
            const { x, y } = labelPos(a.mid);
            const anchor = x < CX - 10 ? 'end' : x > CX + 10 ? 'start' : 'middle';
            return (
              <text key={a.label + '-lbl'} x={x} y={y} fontSize="12" fontWeight="500" fill={a.color} textAnchor={anchor} style={{ fontFamily: 'Inter, sans-serif' }}>
                {t(a.label)} {a.pct}%
              </text>
            );
          })}
        </svg>
      </div>
    </Card>
  );
}
