import { useEffect, useRef, useState } from 'react';

import NotificationBell from '../dashboard/NotificationBell';
import { useI18n } from '../../i18n/index.jsx';
import { useShell } from '../../layouts/dashboardShellContext';

/**
 * The top of a page inside the shell.
 *
 * Replaces the old Topbar's appearance and keeps its working parts - the
 * notification bell and the language toggle. The avatar is here only on a
 * phone, where it is the way into the drawer; on a desktop the rail already
 * has the user row.
 *
 * It sticks, and its bottom edge appears only once the page has scrolled, so
 * a short page has no line across it for no reason. The edge is driven by a
 * sentinel rather than a scroll listener: one IntersectionObserver callback
 * when the state changes, instead of a handler on every frame of every
 * scroll.
 */
export default function PageHeader({ title, eyebrow, actions }) {
  const { t, lang, changeLanguage } = useI18n();
  const { openMenu } = useShell();
  const sentinel = useRef(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const node = sentinel.current;
    if (!node) return undefined;
    const io = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { threshold: 1 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  const otherLang = lang === 'hi' ? 'en' : 'hi';

  return (
    <>
      <div ref={sentinel} aria-hidden="true" style={{ height: 1 }} />
      <header className="np-page-head" data-scrolled={scrolled ? 'true' : 'false'}>
        <div style={{ minWidth: 0 }}>
          {eyebrow && <p className="np-page-eyebrow">{eyebrow}</p>}
          <h1 className="np-page-title np-display">{title}</h1>
        </div>

        <div className="np-page-actions">
          {actions}
          <button
            type="button"
            onClick={() => changeLanguage(otherLang)}
            className="np-icon-btn np-mono"
            style={{ width: 44, height: 44, border: '1px solid var(--color-np-track)', borderRadius: 10 }}
            aria-label={otherLang === 'hi' ? 'हिन्दी' : 'English'}
          >
            {otherLang === 'hi' ? 'हिं' : 'EN'}
          </button>
          <NotificationBell />
          {/* Phone only: the rail is not on screen, so this is the way to the
              party card, settings, the station and logout. */}
          <button
            type="button"
            onClick={openMenu}
            className="np-icon-btn np-page-avatar"
            aria-label={t('np.nav.menu')}
          >
            <span className="np-avatar" style={{ width: 32, height: 32, fontSize: 14 }}>
              {t('brand.ambedkar').charAt(0)}
            </span>
          </button>
        </div>
      </header>
    </>
  );
}
