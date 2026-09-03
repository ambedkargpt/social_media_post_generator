import Card from './Card';
import { FileText, Send, Archive } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n/index.jsx';

export default function ImageGenerationCard({ postCount = 0 }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const GOAL = 50;
  const pct  = Math.min(Math.round((postCount / GOAL) * 100), 100);
  const R = 42, C = 2 * Math.PI * R;
  const offset = C - (pct / 100) * C;

  return (
    <Card className="h-full">
      <div className="flex items-start justify-between">
        <h2 className="font-display text-[16px] font-semibold leading-tight text-white tracking-tight">
          {t('card.postProgress')}
        </h2>
        <div className="rounded-lg border border-[#2a4375]/60 bg-[#111f46]/80 px-3 py-1.5 text-right">
          <div className="font-count text-[15px] font-bold leading-none text-[#6aa8ff]">{postCount}</div>
          <div className="mt-0.5 text-[10px] font-medium text-[#6aa8ff]/80 tracking-wider">{t('card.total')}</div>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-[12.5px] text-[#8b94b8]">
          <FileText size={13} strokeWidth={1.8} className="text-[#6aa8ff]" /> {t('card.postsGenerated')}
        </div>
        <div className="flex items-center gap-2 text-[12.5px] text-[#8b94b8]">
          <Send size={13} strokeWidth={1.8} className="text-[#22c55e]" /> {t('card.readyToPublish')}
        </div>
        <div className="flex items-center gap-2 text-[12.5px] text-[#8b94b8]">
          <Archive size={13} strokeWidth={1.8} className="text-[#ffb056]" /> {t('card.archiveDrafts')}
        </div>
      </div>

      <div className="mt-6 flex items-center gap-5">
        <div className="relative flex h-[112px] w-[112px] items-center justify-center">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle cx="50" cy="50" r={R} fill="none" stroke="#152248" strokeWidth="7" />
            <circle
              cx="50" cy="50" r={R} fill="none"
              stroke="url(#postProgress)" strokeWidth="7" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={offset}
            />
            <defs>
              <linearGradient id="postProgress" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%"   stopColor="#3f9fff" />
                <stop offset="100%" stopColor="#7b5cff" />
              </linearGradient>
            </defs>
          </svg>
          <span className="absolute font-display text-[18px] font-bold text-white">{pct}%</span>
        </div>

        <div className="flex-1 leading-tight">
          <div className="text-[12px] text-[#8b94b8]">{t('card.goalProgress')}</div>
          <div className="mt-0.5 font-count text-[22px] font-bold text-white tabular-nums">
            {postCount} / {GOAL}
          </div>
          <div className="mt-1 text-[11px] text-[#6b78a0]">{t('card.postsToMilestone')}</div>
          <button
            type="button"
            onClick={() => navigate('/generate')}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg btn-gradient px-3 py-1.5 text-[11.5px] font-semibold text-white"
          >
            {t('card.generateNow')}
          </button>
        </div>
      </div>
    </Card>
  );
}
