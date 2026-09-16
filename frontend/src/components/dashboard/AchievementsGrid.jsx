import Card, { CardTitle } from './Card';
import { Trophy, Target, Zap, Award, Check } from 'lucide-react';
import { useI18n } from '../../i18n/index.jsx';

// No border of its own: these sit inside a panel, and four bordered boxes
// inside a bordered card is the card-wall the dashboard had everywhere. A
// finished one is marked by a check and a trace of its own colour, so
// completion does not rest on the colour alone.
function AchievementTile({ icon: Icon, id, pct, iconBg, bar, glow }) {
  const { t } = useI18n();
  const done = pct >= 100;

  return (
    <div
      className="dash-inset p-3.5"
      style={done ? { boxShadow: `inset 0 0 0 1px ${glow}38, 0 0 18px ${glow}14` } : undefined}
    >
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-[0_6px_16px_rgba(0,0,0,0.35)] ${iconBg}`}>
          <Icon size={18} strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-display text-[14px] font-semibold leading-tight text-white">{t(`ach.${id}.title`)}</h4>
          <p className="mt-1 text-[11.5px] leading-snug text-[#8b94b8]">{t(`ach.${id}.desc`)}</p>
        </div>
      </div>

      <div className="mt-3">
        <div className="h-1 w-full overflow-hidden rounded-full bg-[#111a3a]">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${bar} transition-all duration-700`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 font-count text-[11px] text-[#8b94b8]">
          {done && <Check size={11} strokeWidth={3} style={{ color: glow }} />}
          {done ? t('ach.complete') : t('ach.percentDone', { pct: Math.round(pct) })}
        </div>
      </div>
    </div>
  );
}

export default function AchievementsGrid({ totalPosts = 0, prefsAnswered = 0 }) {
  const { t } = useI18n();
  const TOTAL_PREFS = 25;

  const items = [
    {
      icon:   Trophy,
      id:     'first',
      pct:    totalPosts >= 1 ? 100 : 0,
      iconBg: 'bg-gradient-to-br from-[#ffb056] to-[#ff7a2d]',
      bar:    'from-[#ffb056] to-[#ff7a2d]',
      glow:   '#ffb056',
    },
    {
      icon:   Target,
      id:     'ten',
      pct:    Math.min((totalPosts / 10) * 100, 100),
      iconBg: 'bg-gradient-to-br from-[#c254ff] to-[#ff4fb5]',
      bar:    'from-[#c254ff] to-[#ff4fb5]',
      glow:   '#c254ff',
    },
    {
      icon:   Zap,
      id:     'profile',
      pct:    Math.min((prefsAnswered / TOTAL_PREFS) * 100, 100),
      iconBg: 'bg-gradient-to-br from-[#3f9fff] to-[#5bc0ff]',
      bar:    'from-[#3f9fff] to-[#5bc0ff]',
      glow:   '#3f9fff',
    },
    {
      icon:   Award,
      id:     'fifty',
      pct:    Math.min((totalPosts / 50) * 100, 100),
      iconBg: 'bg-gradient-to-br from-[#22c55e] to-[#16a34a]',
      bar:    'from-[#22c55e] to-[#16a34a]',
      glow:   '#22c55e',
    },
  ];

  const done = items.filter((i) => i.pct >= 100).length;

  return (
    <Card className="h-full">
      <div className="flex items-baseline justify-between gap-3">
        <CardTitle>{t('ach.title')}</CardTitle>
        <span className="font-count text-[12px] tabular-nums text-[#7a86a8]">
          {done}/{items.length}
        </span>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <AchievementTile key={item.id} {...item} />
        ))}
      </div>
    </Card>
  );
}
