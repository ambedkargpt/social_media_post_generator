import Card from './Card';
import { Star, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n/index.jsx';

/**
 * The account summary. Laid out along a row rather than centred in a column:
 * centred, the avatar alone took a third of the card's height and pushed the
 * one action in it below the fold on a phone.
 */
export default function ProfileCard({ user }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const name      = user?.name      ?? '—';
  const email     = user?.email     ?? '—';
  const joined    = user?.joined    ?? '';
  const postCount = user?.postCount ?? 0;
  const initial   = (name?.[0] ?? '?').toUpperCase();

  return (
    <Card className="h-full">
      <div className="flex items-center gap-3.5">
        <div className="relative shrink-0">
          <div className="flex h-[58px] w-[58px] items-center justify-center rounded-full border-2 border-[#3f9fff]/50 bg-gradient-to-br from-[#3f7fff] via-[#6a6af0] to-[#8b5cf6] font-display text-[22px] font-bold text-white shadow-[0_0_22px_rgba(63,159,255,0.3)]">
            {initial}
          </div>
          <span className="dot-online absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full border-2 border-[#0d1226] bg-[#22c55e]" />
        </div>

        <div className="min-w-0">
          <h3 className="truncate font-display text-[17px] font-semibold text-white">{name}</h3>
          <p className="truncate text-[12.5px] text-[#8b94b8]">{email}</p>
          {joined && <p className="mt-0.5 truncate text-[11px] text-[#6b78a0]">{joined}</p>}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <div className="dash-inset px-3 py-2.5">
          <div className="flex items-center gap-1.5 font-count text-[19px] font-bold tabular-nums text-[#6aa8ff]">
            <FileText size={13} strokeWidth={2} />
            {postCount}
          </div>
          <div className="mt-1 text-[10.5px] leading-snug text-[#8b94b8]">{t('profcard.postsGenerated')}</div>
        </div>
        {/* The plan, stated once and quietly. It was a bright purple panel
            competing with the number beside it. */}
        <div className="dash-inset px-3 py-2.5">
          <div className="inline-flex items-center gap-1.5 font-display text-[15px] font-bold text-[#ffc94a]">
            <Star size={12} strokeWidth={0} fill="#ffc94a" /> {t('profcard.free')}
          </div>
          <div className="mt-1 text-[10.5px] leading-snug text-[#8b94b8]">{t('profcard.plan')}</div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigate('/preferences')}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl btn-gradient py-2.5 text-[13px] font-semibold text-white shadow-[0_6px_20px_rgba(17,122,255,0.3)]"
      >
        {t('prefcard.edit')}
      </button>
    </Card>
  );
}
