import Card, { CardTitle } from './Card';
import { FileText, Send, Archive, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n/index.jsx';

export default function ImageGenerationCard({ postCount = 0 }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const GOAL = 50;
  // The ring is clamped; the count beside it is not. Past the goal the ring
  // reads full and the state says so, rather than drawing an arc longer than
  // the circle it is drawn on.
  const pct = Math.min(Math.round((postCount / GOAL) * 100), 100);
  const reached = postCount >= GOAL;
  const R = 42, C = 2 * Math.PI * R;
  const offset = C - (pct / 100) * C;

  const stages = [
    { Icon: FileText, key: 'card.postsGenerated', color: '#6aa8ff' },
    { Icon: Send,     key: 'card.readyToPublish', color: '#22c55e' },
    { Icon: Archive,  key: 'card.archiveDrafts',  color: '#ffb056' },
  ];

  return (
    <Card className="h-full">
      <CardTitle>{t('card.postProgress')}</CardTitle>

      <div className="mt-4 flex items-center gap-5">
        <div className="relative flex h-[104px] w-[104px] shrink-0 items-center justify-center">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img">
            <circle cx="50" cy="50" r={R} fill="none" stroke="#152248" strokeWidth="7" />
            <circle
              cx="50" cy="50" r={R} fill="none"
              stroke="url(#postProgress)" strokeWidth="7" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)' }}
            />
            <defs>
              <linearGradient id="postProgress" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%"   stopColor="#3f9fff" />
                <stop offset="100%" stopColor={reached ? '#22c55e' : '#7b5cff'} />
              </linearGradient>
            </defs>
          </svg>
          <span
            className="absolute rounded-full"
            style={{ inset: 8, boxShadow: `0 0 26px ${reached ? 'rgba(34,197,94,0.22)' : 'rgba(63,159,255,0.22)'}` }}
            aria-hidden="true"
          />
          <span className="absolute font-count text-[19px] font-bold tabular-nums text-white">{pct}%</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="font-count text-[30px] font-bold leading-none tabular-nums text-white">
            {postCount}
          </div>
          <div className="mt-1.5 text-[12px] text-[#7a86a8]">{t('card.total')}</div>

          {reached ? (
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#1c4a33]/80 bg-[#0e2a1d]/70 px-2.5 py-1 text-[11.5px] font-semibold text-[#5bdb90]">
              <Check size={12} strokeWidth={2.6} />
              {t('card.goalReached')}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/generate')}
              className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg btn-gradient px-3.5 py-2 text-[12px] font-semibold text-white"
            >
              {t('card.generateNow')}
            </button>
          )}
        </div>
      </div>

      <div className="mt-5 border-t border-[#1a254a]/50 pt-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="dash-eyebrow">{t('card.goalProgress')}</span>
          <span className="font-count text-[13.5px] font-bold tabular-nums text-white">
            {postCount} <span className="text-[#6f7fa8]">/ {GOAL}</span>
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#111d3f]">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${pct}%`,
              background: reached
                ? 'linear-gradient(90deg,#22c55e,#5bdb90)'
                : 'linear-gradient(90deg,#3f9fff,#7b5cff)',
            }}
          />
        </div>
        {/* Once the goal is passed there are no posts left to reach it, so the
            line that says there are goes away rather than contradicting the
            full bar above it. */}
        {!reached && <p className="mt-2 text-[11.5px] text-[#6b78a0]">{t('card.postsToMilestone')}</p>}
      </div>

      {/* What the count is made of, in one row rather than three stacked lines. */}
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
        {stages.map(({ Icon, key, color }) => (
          <span key={key} className="inline-flex items-center gap-1.5 text-[11.5px] text-[#7a86a8]">
            <Icon size={12} strokeWidth={1.9} style={{ color }} />
            {t(key)}
          </span>
        ))}
      </div>
    </Card>
  );
}
