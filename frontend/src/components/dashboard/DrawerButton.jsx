import { Menu } from 'lucide-react';
import { useShell } from '../../layouts/dashboardShellContext';
import { useI18n } from '../../i18n/index.jsx';

/**
 * Opens the mobile navigation drawer.
 *
 * It is its own component on purpose: a page that renders DashboardShell sits
 * *outside* the shell's provider, so calling useShell() up there reads the
 * default no-op and the button does nothing. Rendered inside the page body,
 * this reads the real one.
 */
export default function DrawerButton({ className = '' }) {
  const { openMenu } = useShell();
  const { t } = useI18n();

  return (
    <button
      type="button"
      onClick={openMenu}
      aria-label={t('common.openMenu')}
      className={`dash-icon-btn flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#1e3260]/70 text-[#8b9ac0] lg:hidden ${className}`}
    >
      <Menu size={18} strokeWidth={1.9} />
    </button>
  );
}
