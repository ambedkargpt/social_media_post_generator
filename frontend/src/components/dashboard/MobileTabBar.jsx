import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FileText, House, MessageCircle, Radio, SquarePlus } from 'lucide-react';

import { useI18n } from '../../i18n/index.jsx';

/**
 * The phone's navigation. Below 768px there is no rail at all - the five
 * things people actually move between live down here, within a thumb's
 * reach, and everything else (the party card, settings, the station, logout)
 * is in the drawer behind the avatar.
 *
 * The bar hides itself while a field has focus. On Android the keyboard
 * shrinks the viewport rather than overlaying it, so a fixed bottom bar rides
 * up and sits on top of the thing being typed into.
 */

const TABS = [
  { to: '/dashboard', icon: House,         key: 'np.nav.today' },
  { to: '/generate',  icon: SquarePlus,    key: 'np.nav.write' },
  { to: '/bhimbot',   icon: MessageCircle, key: 'dash.bheembot' },
  { to: '/bhimradio', icon: Radio,         key: 'radio.title' },
  { to: '/posts',     icon: FileText,      key: 'np.nav.myPosts' },
];

export default function MobileTabBar() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const refs = useRef({});
  const [x, setX] = useState(null);
  const [hidden, setHidden] = useState(false);

  // Longest match, not first: /generate/music must light Write rather than
  // nothing, and /dashboard must not be shadowed by a shorter prefix.
  const active = TABS
    .filter((tab) => pathname.startsWith(tab.to))
    .sort((a, b) => b.to.length - a.to.length)[0];

  useLayoutEffect(() => {
    const el = active ? refs.current[active.to] : null;
    if (!el) { setX(null); return; }
    // Centred over the tab: the bar is 24px and the tab is a fifth of the
    // screen, so the offset has to be measured rather than assumed.
    setX(el.offsetLeft + (el.offsetWidth - 24) / 2);
  }, [active, pathname]);

  useEffect(() => {
    const isField = (el) => el instanceof HTMLElement
      && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
    const onIn = (e) => { if (isField(e.target)) setHidden(true); };
    const onOut = () => setHidden(false);
    document.addEventListener('focusin', onIn);
    document.addEventListener('focusout', onOut);
    return () => {
      document.removeEventListener('focusin', onIn);
      document.removeEventListener('focusout', onOut);
    };
  }, []);

  return (
    <nav className="np-tabbar" data-hidden={hidden ? 'true' : 'false'} aria-label={t('np.nav.menu')}>
      <div className="np-tabbar-inner">
        {x !== null && (
          <span
            aria-hidden="true"
            className="np-tab-indicator"
            style={{ transform: `translateX(${x}px)` }}
          />
        )}
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = active?.to === tab.to;
          return (
            <Link
              key={tab.to}
              to={tab.to}
              ref={(n) => { refs.current[tab.to] = n; }}
              className={`np-tab ${isActive ? 'is-active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon size={22} strokeWidth={2} />
              <span>{t(tab.key)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
