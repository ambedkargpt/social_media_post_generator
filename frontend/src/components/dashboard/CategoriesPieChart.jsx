import Card, { CardTitle } from './Card';
import { useI18n } from '../../i18n/index.jsx';

const STATUS_COLORS = {
  draft:     '#6aa8ff',
  published: '#22c55e',
  archived:  '#ffb056',
};

// A ring rather than a pie, with the legend carrying the numbers. The pie drew
// its labels out at the ends of its own slices, which left a card mostly full
// of empty space and a reader working out which label went with which wedge.
const SIZE = 150, R = 59, STROKE = 18;
const C = 2 * Math.PI * R;

function buildSlices(posts) {
  const counts = { draft: 0, published: 0, archived: 0 };
  for (const p of posts) {
    if (counts[p.status] !== undefined) counts[p.status]++;
  }
  const total = posts.length || 1;
  return Object.entries(counts)
    .filter(([, v]) => v > 0)
    .map(([label, v]) => ({
      key: label,
      label: `status.${label}`,
      count: v,
      // The exact fraction draws the arc; the rounded figure is only ever
      // shown as text, so the ring can never disagree with the data.
      frac: v / total,
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
        <div className="flex h-[200px] items-center justify-center">
          <p className="text-[13px] text-[#6b78a0]">{t('chart.noPosts')}</p>
        </div>
      </Card>
    );
  }

  // Each arc is a dash on one circle, offset by everything drawn before it.
  const arcs = slices.reduce((acc, s) => {
    acc.items.push({ ...s, dash: s.frac * C, offset: -acc.drawn * C });
    return { drawn: acc.drawn + s.frac, items: acc.items };
  }, { drawn: 0, items: [] }).items;

  return (
    <Card className="h-full">
      <CardTitle>{t('chart.byStatus')}</CardTitle>

      {/* Side by side only once the card is wide enough for a legend row to
          fit: in a two-up column at 1024 the ring left the legend 120px and
          the status names were truncated to "Dra…". */}
      <div className="mt-3 flex flex-col items-center gap-4 xl:flex-row xl:gap-6">
        <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full -rotate-90" role="img">
            <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="#111d3f" strokeWidth={STROKE} />
            {arcs.map((a) => (
              <circle
                key={a.key}
                cx={SIZE / 2} cy={SIZE / 2} r={R}
                fill="none"
                stroke={a.color}
                strokeWidth={STROKE}
                strokeDasharray={`${a.dash} ${C - a.dash}`}
                strokeDashoffset={a.offset}
              >
                <title>{`${t(a.label)}: ${a.count} (${a.pct}%)`}</title>
              </circle>
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-count text-[28px] font-bold leading-none tabular-nums text-white">
              {posts.length}
            </span>
            <span className="mt-1 text-[10.5px] uppercase tracking-[0.14em] text-[#6f7fa8]">
              {t('card.total')}
            </span>
          </div>
        </div>

        {/* The legend is the chart: name, share, count, and a bar the eye can
            compare across rows without going back to the ring. */}
        <ul className="w-full min-w-0 space-y-3.5">
          {slices.map((s) => (
            <li key={s.key}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="inline-flex min-w-0 items-center gap-2 text-[13px] text-[#c3ccea]">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="truncate">{t(s.label)}</span>
                </span>
                <span className="shrink-0 font-count text-[13.5px] font-bold tabular-nums text-white">
                  {s.pct}%
                  <span className="ml-1.5 text-[11.5px] font-medium text-[#6f7fa8]">({s.count})</span>
                </span>
              </div>
              <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[#111d3f]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${s.frac * 100}%`, backgroundColor: s.color, opacity: 0.85 }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
