import { Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import LanguageSwitcher from '../LanguageSwitcher';
import NotificationBell from './NotificationBell';
import ProfileMenu from './ProfileMenu';
import { useAuth } from '../../context/AuthContext';
import { useShell } from '../../layouts/dashboardShellContext';
import { useI18n } from '../../i18n/index.jsx';

/**
 * The header strip every signed-in working screen shares: the drawer button on
 * phones, where you are on the left, page controls in the middle, and the
 * account controls on the right. It sticks to the top of the scrolling area on
 * glass, so the controls stay reachable without taking a band of the screen.
 *
 * @param {object}    p
 * @param {object}    p.user        – name, email and party for the avatar menu
 * @param {number}    p.totalPosts  – the count the notification bell reads
 * @param {string}    p.title       – the page's name, on the left
 * @param {JSX.Element} p.icon      – small mark beside the title, desktop only
 * @param {JSX.Element} p.right     – page-specific controls, before the account ones
 */
export default function Topbar({ user, totalPosts, title, icon = null, right = null }) {
  const { t } = useI18n();
  const { openMenu } = useShell();
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  // Pages that do not load their own copy of the user still get a filled-in
  // avatar menu, because the session already holds one.
  const name  = user?.name  ?? currentUser?.username ?? '—';
  const email = user?.email ?? currentUser?.email ?? currentUser?.phone ?? '';
  const party = user?.party ?? currentUser?.political_party ?? '';
  const initial = (name?.[0] ?? 'A').toUpperCase();

  async function handleLogout() {
    await logout();
    // The landing page, not the login form: signing out is leaving, and being
    // dropped straight onto a form reads as "sign in again" rather than "done".
    navigate('/', { replace: true });
  }

  return (
    <header className="dash-header sticky top-0 z-30 -mx-4 mb-5 px-4 sm:-mx-6 sm:px-6 md:-mx-10 md:px-10">
      <div className="flex h-14 items-center gap-3 md:h-16">
        {/* Hamburger — phones and tablets */}
        <button
          type="button"
          onClick={openMenu}
          className="dash-icon-btn flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#1e3260]/70 text-[#8b9ac0] lg:hidden"
          aria-label={t('common.openMenu')}
        >
          <Menu size={17} strokeWidth={1.9} />
        </button>

        <div className="flex min-w-0 items-center gap-2.5">
          {icon}
          <span className="truncate font-display text-[14.5px] font-semibold tracking-tight text-white">
            {title ?? t('nav.dashboard')}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {right}
          <LanguageSwitcher />
          <NotificationBell totalPosts={totalPosts} />
          <ProfileMenu
            name={name}
            email={email}
            initial={initial}
            party={party}
            onLogout={handleLogout}
          />
        </div>
      </div>
    </header>
  );
}
