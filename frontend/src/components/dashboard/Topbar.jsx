import { Sparkles, Menu, Landmark } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import LanguageSwitcher from '../LanguageSwitcher';
import NotificationBell from './NotificationBell';
import ProfileMenu from './ProfileMenu';
import { useI18n } from '../../i18n/index.jsx';

export default function Topbar({ user, onMenuOpen, totalPosts, onLogout }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const name  = user?.name  ?? '—';
  const email = user?.email ?? '';
  const party = user?.party ?? '';
  const initial = (name?.[0] ?? 'A').toUpperCase();

  return (
    <div className="flex items-center justify-between gap-4 pt-7 pb-6">
      {/* Hamburger — mobile only */}
      <button
        type="button"
        onClick={onMenuOpen}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#1e3260]/60 text-[#5a7a9e] transition hover:text-white lg:hidden"
        aria-label="Open menu"
      >
        <Menu size={17} strokeWidth={1.8} />
      </button>

      {/* Generate CTA + MP/MLA lookup (centered visually) */}
      <div className="flex-1 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/generate')}
          className="inline-flex items-center gap-2.5 rounded-full btn-gradient px-6 py-3 text-[15px] font-semibold text-white shadow-[0_8px_28px_rgba(17,122,255,0.4)]"
        >
          <Sparkles size={17} strokeWidth={2.1} />
          {t('dash.generate')}
        </button>

        {/* Not built yet — a dimmed outline pill with a Soon badge, same
            not-navigable treatment the sidebar already uses for this. */}
        <div
          title={`${t('dash.reviewMpMla')} — ${t('nav.comingSoonSuffix')}`}
          aria-disabled="true"
          className="hidden sm:inline-flex cursor-not-allowed items-center gap-2.5 rounded-full border border-[#1e3260]/70 px-6 py-3 text-[15px] font-semibold text-[#4d587a]"
        >
          <Landmark size={17} strokeWidth={2.1} />
          {t('dash.reviewMpMla')}
          <span className="rounded-full bg-[#141d3a] px-2 py-0.5 font-count text-[10px] uppercase tracking-wider text-[#5a6e9a]">
            {t('nav.soonBadge')}
          </span>
        </div>
      </div>

      {/* language + notifications + user */}
      <div className="flex items-center gap-4">
        <LanguageSwitcher />
        <NotificationBell totalPosts={totalPosts} />

        <ProfileMenu
          name={name}
          email={email}
          initial={initial}
          party={party}
          onLogout={onLogout}
        />
      </div>
    </div>
  );
}
