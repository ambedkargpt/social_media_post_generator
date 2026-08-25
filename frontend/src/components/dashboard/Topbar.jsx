import { Sparkles, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import LanguageSwitcher from '../LanguageSwitcher';
import NotificationBell from './NotificationBell';
import ProfileMenu from './ProfileMenu';

export default function Topbar({ user, onMenuOpen, totalPosts, onLogout }) {
  const navigate = useNavigate();
  const name  = user?.name  ?? '—';
  const email = user?.email ?? '';
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

      {/* Generate CTA (centered visually) */}
      <div className="flex-1 flex items-center">
        <button
          type="button"
          onClick={() => navigate('/generate')}
          className="inline-flex items-center gap-2 rounded-full btn-gradient px-5 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_8px_28px_rgba(17,122,255,0.4)]"
        >
          <Sparkles size={15} strokeWidth={2.1} />
          Generate
        </button>
      </div>

      {/* language + notifications + user */}
      <div className="flex items-center gap-4">
        <LanguageSwitcher />
        <NotificationBell totalPosts={totalPosts} />

        <ProfileMenu
          name={name}
          email={email}
          initial={initial}
          onLogout={onLogout}
        />
      </div>
    </div>
  );
}
