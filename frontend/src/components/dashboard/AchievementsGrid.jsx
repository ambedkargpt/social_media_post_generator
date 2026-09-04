import Card, { CardTitle } from './Card';
import { Trophy, Target, Zap, Award } from 'lucide-react';
import { useI18n } from '../../i18n/index.jsx';

function AchievementTile({ icon: Icon, id, pct, iconBg, bar }) {
  const { t } = useI18n();
  return (
    <div
      className="rounded-xl border p-4"
      style={{
        background: 'linear-gradient(180deg, rgba(14,23,55,0.85) 0%, rgba(9,14,33,0.85) 100%)',
        borderColor: 'rgba(60,85,155,0.22)',
      }}
    >
      <div className="flex items-start gap-3">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-[0_6px_16px_rgba(0,0,0,0.35)] ${iconBg}`}>
          <Icon size={19} strokeWidth={2} />
        </div>
        <div className="flex-1">
          <h3 className="font-display text-[14.5px] font-semibold text-white leading-tight">{t(`ach.${id}.title`)}</h3>
          <p className="mt-1 text-[12px] text-[#8b94b8] leading-snug">{t(`ach.${id}.desc`)}</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#111a3a]">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${bar} transition-all duration-700`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        <div className="mt-2 font-count text-[11px] text-[#8b94b8]">{t('ach.percentDone', { pct: Math.round(pct) })}</div>
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
    },
    {
      icon:   Target,
      id:     'ten',
      pct:    Math.min((totalPosts / 10) * 100, 100),
      iconBg: 'bg-gradient-to-br from-[#c254ff] to-[#ff4fb5]',
      bar:    'from-[#c254ff] to-[#ff4fb5]',
    },
    {
      icon:   Zap,
      id:     'profile',
      pct:    Math.min((prefsAnswered / TOTAL_PREFS) * 100, 100),
      iconBg: 'bg-gradient-to-br from-[#3f9fff] to-[#5bc0ff]',
      bar:    'from-[#3f9fff] to-[#5bc0ff]',
    },
    {
      icon:   Award,
      id:     'fifty',
      pct:    Math.min((totalPosts / 50) * 100, 100),
      iconBg: 'bg-gradient-to-br from-[#22c55e] to-[#16a34a]',
      bar:    'from-[#22c55e] to-[#16a34a]',
    },
  ];

  return (
    <Card>
      <CardTitle>{t('ach.title')}</CardTitle>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <AchievementTile key={item.id} {...item} />
        ))}
      </div>
    </Card>
  );
}
