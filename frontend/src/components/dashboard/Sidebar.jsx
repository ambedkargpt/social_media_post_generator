import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  FileText, House, LogOut, MessageCircle, Music, PanelLeftClose, PanelLeftOpen,
  Pause, Play, Plus, Radio, Settings, SquarePlus, X,
} from 'lucide-react';

import { useI18n } from '../../i18n/index.jsx';
import { useRadio } from '../../context/RadioContext';
import { useAuth } from '../../context/AuthContext';
import { getDailyQuota } from '../../api/posts';
import { partyLogo, partySymbol } from '../../utils/politicalParties';
import Chakra from '../np/Chakra';

/**
 * The rail.
 *
 * Phase 2 of docs/redesign/neela-press.md. What it keeps from the old rail is
 * everything that was not visual: the collapsed state in localStorage under
 * the same key, the useRadio() read, the mobile drawer with Escape and focus,
 * and logout with its in-flight state.
 *
 * What changed is the shape of it. The old rail was a flat list of nine items,
 * four of which went nowhere and wore a "SOON" badge, with Profile and
 * Preferences as separate rows. This one is two named groups of things that
 * exist, with the account work gathered under Settings, and a footer that
 * says what the rail could never say before: how much of today's quota is
 * left, and whether the station is on air.
 */

const COLLAPSED_KEY = 'ambedkargpt_sidebar_collapsed';
const RAIL_W = 272;
const RAIL_W_COLLAPSED = 76;

function readCollapsed() {
  try {
    const saved = localStorage.getItem(COLLAPSED_KEY);
    if (saved !== null) return saved === '1';
  } catch { /* blocked site data is not a reason to fail to render */ }
  // No stored preference: below 1280 the content column is the scarce thing,
  // so the rail starts narrow and the reader opens it if they want it.
  return typeof window !== 'undefined' && window.innerWidth < 1280;
}

/* ── one nav row ──────────────────────────────────────────────────────────
   A real <Link>, so middle-click and "open in new tab" work and the browser
   shows where it goes. The tooltip is ours rather than `title`, because the
   native one takes a second to appear, cannot be styled, and reads out as
   part of the accessible name on some screen readers. */
function NavItem({ to, icon: Icon, label, active, collapsed, badge, onNavigate, itemRef }) {
  if (!Icon) return null;
  return (
    <Link
      ref={itemRef}
      to={to}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={`np-nav-item ${active ? 'is-active' : ''} ${collapsed ? 'is-collapsed' : ''}`}
      data-tip={collapsed ? label : undefined}
    >
      <Icon size={20} strokeWidth={2} className="np-nav-icon" />
      <span className="np-nav-label">{label}</span>
      {badge && <span className="np-nav-badge">{badge}</span>}
    </Link>
  );
}

/* ── a group of rows, with the selection sliding between them ─────────────
   One indicator per group rather than a background on each row: the
   difference between "the selection moved" and "one thing lit while another
   went dark". Measured, because a Hindi label is routinely longer and the
   rows are taller in Hindi too. */
function NavGroup({ title, items, collapsed, pathname, onNavigate }) {
  const refs = useRef({});
  const [box, setBox] = useState(null);
  const [animate, setAnimate] = useState(false);

  const activeId = items.find((i) => pathname.startsWith(i.to))?.to;

  const measure = useCallback(() => {
    const el = activeId ? refs.current[activeId] : null;
    if (!el) { setBox(null); return; }
    setBox({ y: el.offsetTop, h: el.offsetHeight });
  }, [activeId]);

  useLayoutEffect(() => {
    measure();
    // Placed without animating on the first paint: an indicator that slides
    // in from zero on every page load reads as a glitch, not as motion.
    const id = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(id);
  }, [measure, collapsed]);

  useEffect(() => {
    const ro = new ResizeObserver(measure);
    Object.values(refs.current).forEach((n) => n && ro.observe(n));
    return () => ro.disconnect();
  }, [measure, items]);

  return (
    <div className="np-nav-group">
      {title && <p className="np-nav-group-title">{title}</p>}
      <div style={{ position: 'relative' }}>
        {box && (
          <span
            aria-hidden="true"
            className="np-nav-indicator"
            style={{
              transform: `translateY(${box.y}px)`,
              height: box.h,
              transition: animate
                ? 'transform var(--np-dur-3) var(--np-ease-out), height var(--np-dur-3) var(--np-ease-out)'
                : 'none',
            }}
          />
        )}
        {items.map((item) => (
          <NavItem
            key={item.to}
            {...item}
            active={item.to === activeId}
            collapsed={collapsed}
            onNavigate={onNavigate}
            itemRef={(n) => { refs.current[item.to] = n; }}
          />
        ))}
      </div>
    </div>
  );
}

/* ── the party, as its own marks ──────────────────────────────────────────
   The round logo is identity. The line-art symbol behind it is a watermark,
   large and nearly invisible - at 9% it is texture rather than decoration,
   and it is the one thing on a signed-in screen that says whose desk this
   is without using words. */
function PartyCard({ user, collapsed, t }) {
  const party = user?.political_party;
  if (!party) return null;

  const logo = partyLogo(party);
  const symbol = partySymbol(party);
  const sub = [user?.party_position, user?.city].filter(Boolean).join(' · ');

  if (collapsed) {
    return (
      <div className="np-party np-party-collapsed" data-tip={party}>
        {logo && <img src={logo} alt="" aria-hidden="true" width={38} height={38} />}
      </div>
    );
  }

  return (
    <div className="np-party">
      {symbol && <img className="np-party-watermark" src={symbol} alt="" aria-hidden="true" />}
      {logo && <img className="np-party-logo" src={logo} alt="" aria-hidden="true" width={42} height={42} />}
      <span className="np-party-text">
        <span className="np-party-name">{party}</span>
        {sub && <span className="np-party-sub">{sub}</span>}
      </span>
      <span className="sr-only">{t('np.nav.workspace')}</span>
    </div>
  );
}

/* ── how much of today is left ────────────────────────────────────────────
   Segments rather than a bar, because the limit is a small whole number and
   a reader can count five blocks faster than they can read a percentage. */
function QuotaMeter({ quota, collapsed, t }) {
  if (!quota) return null;
  const limit = Number(quota.daily_limit) || 0;
  const used = Math.min(Number(quota.daily_used) || 0, limit);
  if (!limit) return null;

  if (collapsed) {
    return (
      <div className="np-quota np-quota-collapsed" data-tip={t('np.quota.today')}>
        <Chakra size={28} mode="progress" value={used / limit} />
      </div>
    );
  }

  return (
    <div className="np-quota">
      <p className="np-quota-line">
        <span>{t('np.quota.today')}</span>
        <span className="np-mono">{used}/{limit}</span>
      </p>
      <span className="np-quota-track" aria-hidden="true">
        {Array.from({ length: limit }, (_, i) => (
          <span key={i} className={`np-quota-seg ${i < used ? 'is-filled' : ''}`} />
        ))}
      </span>
    </div>
  );
}

/* ── the station, from the rail ───────────────────────────────────────────
   Hidden on /bhimradio, where the page itself is the player. The level meter
   animates scaleY only, and only while sound is actually coming out. */
function RadioMini({ collapsed, onBhimRadio, t }) {
  const { station, playing, toggle, streamError } = useRadio();
  if (!station || onBhimRadio) return null;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={toggle}
        className="np-radio-mini np-radio-mini-collapsed"
        data-tip={station.title || t('radio.title')}
        aria-label={playing ? t('radio.pause') : t('radio.play')}
      >
        {playing ? <Pause size={16} strokeWidth={2.4} /> : <Play size={16} strokeWidth={2.4} />}
      </button>
    );
  }

  return (
    <div className="np-radio-mini">
      <button
        type="button"
        onClick={toggle}
        disabled={streamError}
        className="np-radio-btn"
        aria-label={playing ? t('radio.pause') : t('radio.play')}
      >
        {playing ? <Pause size={15} strokeWidth={2.4} /> : <Play size={15} strokeWidth={2.4} />}
      </button>
      <span className="np-radio-text">
        <span className="np-radio-onair">● {t('ticker.label')}</span>
        <span className="np-radio-title">{station.title || t('radio.title')}</span>
      </span>
      <span className={`np-level ${playing ? 'is-live' : ''}`} aria-hidden="true">
        <i /><i /><i /><i />
      </span>
    </div>
  );
}

/* ── everything inside the rail ───────────────────────────────────────────
   Shared by the desktop column and the drawer, so the two can never drift. */
function RailContent({ collapsed, onToggleCollapse, onClose, onLogout }) {
  const { t, lang, changeLanguage } = useI18n();
  const { currentUser } = useAuth();
  const { pathname } = useLocation();
  const [quota, setQuota] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let alive = true;
    // A rail that cannot show the quota is not a rail that should fail: the
    // meter simply does not render.
    getDailyQuota().then((q) => { if (alive) setQuota(q); }).catch(() => {});
    return () => { alive = false; };
  }, [pathname]);

  const workspace = [
    { to: '/dashboard', icon: House,      label: t('np.nav.today') },
    { to: '/generate',  icon: SquarePlus, label: t('np.nav.create') },
    {
      to: '/posts', icon: FileText, label: t('np.nav.myPosts'),
      badge: quota?.total_posts ? String(quota.total_posts) : undefined,
    },
  ];

  const { station } = useRadio();
  const learn = [
    { to: '/bhimbot',        icon: MessageCircle, label: t('dash.bheembot') },
    {
      to: '/bhimradio', icon: Radio, label: t('radio.title'),
      badge: station ? t('np.nav.live') : undefined,
    },
    { to: '/generate/music', icon: Music,         label: t('np.nav.music') },
  ];

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    onClose?.();
    try { await onLogout(); } finally { setLoggingOut(false); }
  }

  const initial = (currentUser?.full_name || currentUser?.username || '?').trim().charAt(0).toUpperCase();
  const otherLang = lang === 'hi' ? 'en' : 'hi';

  return (
    <>
      <div className="np-rail-head">
        <Link to="/dashboard" onClick={onClose} className="np-brand" aria-label={t('np.nav.today')}>
          <span className="np-brand-mark" aria-hidden="true">अ</span>
          <span className="np-brand-text np-display">
            {t('brand.ambedkar')}<span className="np-brand-gpt">GPT</span>
          </span>
        </Link>

        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="np-rail-toggle"
            aria-label={collapsed ? t('np.nav.expand') : t('np.nav.collapse')}
            aria-expanded={!collapsed}
          >
            {collapsed ? <PanelLeftOpen size={18} strokeWidth={2} /> : <PanelLeftClose size={18} strokeWidth={2} />}
          </button>
        )}

        {onClose && (
          <button type="button" onClick={onClose} className="np-rail-close" aria-label={t('side.closeMenu')}>
            <X size={18} strokeWidth={2} />
          </button>
        )}
      </div>

      <PartyCard user={currentUser} collapsed={collapsed} t={t} />

      <Link
        to="/generate"
        onClick={onClose}
        className={`np-newpost ${collapsed ? 'is-collapsed' : ''}`}
        data-tip={collapsed ? t('np.nav.newPost') : undefined}
      >
        <Plus size={18} strokeWidth={2.4} />
        <span className="np-nav-label">{t('np.nav.newPost')}</span>
        {/* The shortcut is shown rather than hidden in a help page: a keycap
            next to the action is how anyone finds out it exists. */}
        <kbd className="np-keycap np-mono">N</kbd>
      </Link>

      <nav className="np-rail-nav">
        <NavGroup
          title={collapsed ? null : t('np.nav.workspace')}
          items={workspace}
          collapsed={collapsed}
          pathname={pathname}
          onNavigate={onClose}
        />
        <NavGroup
          title={collapsed ? null : t('np.nav.learn')}
          items={learn}
          collapsed={collapsed}
          pathname={pathname}
          onNavigate={onClose}
        />
      </nav>

      <div className="np-rail-foot">
        <QuotaMeter quota={quota} collapsed={collapsed} t={t} />
        <RadioMini collapsed={collapsed} onBhimRadio={pathname.startsWith('/bhimradio')} t={t} />

        <div className={`np-user ${collapsed ? 'is-collapsed' : ''}`}>
          <span className="np-avatar" aria-hidden="true">{initial}</span>
          <span className="np-user-text">
            <span className="np-user-name">{currentUser?.full_name || currentUser?.username}</span>
            {currentUser?.city && <span className="np-user-sub">{currentUser.city}</span>}
          </span>
          {/* Shows the language you would switch to, not the one you are in:
              a toggle labelled with the current state is a toggle nobody can
              read. */}
          <button
            type="button"
            onClick={() => changeLanguage(otherLang)}
            className="np-icon-btn np-mono"
            aria-label={otherLang === 'hi' ? 'हिन्दी' : 'English'}
          >
            {otherLang === 'hi' ? 'हिं' : 'EN'}
          </button>
          <Link
            to="/settings"
            onClick={onClose}
            className={`np-icon-btn ${pathname.startsWith('/settings') ? 'is-active' : ''}`}
            aria-label={t('np.nav.settings')}
            aria-current={pathname.startsWith('/settings') ? 'page' : undefined}
          >
            <Settings size={18} strokeWidth={2} />
          </Link>
          {onLogout && (
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="np-icon-btn"
              aria-label={t('auth.logout')}
            >
              {loggingOut
                ? <Chakra size={18} mode="spin" />
                : <LogOut size={18} strokeWidth={2} />}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

export default function Sidebar({ mobileOpen = false, onMobileClose, onLogout }) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const drawerRef = useRef(null);
  const navigate = useNavigate();

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // Keyboard: [ collapses the rail, N starts a post. Both are ignored while
  // the reader is typing, which includes contenteditable - otherwise writing
  // the letter n in a draft navigates away from it.
  useEffect(() => {
    function onKey(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target;
      const typing = el instanceof HTMLElement
        && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
      if (typing) return;
      if (e.key === '[') { e.preventDefault(); toggleCollapsed(); }
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); navigate('/generate'); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleCollapsed, navigate]);

  // The drawer: Escape closes it and the first control in it takes focus, so
  // it can be opened and left without a pointer.
  useEffect(() => {
    if (!mobileOpen) return undefined;
    function onKey(e) { if (e.key === 'Escape') onMobileClose?.(); }
    document.addEventListener('keydown', onKey);
    drawerRef.current?.querySelector('a, button')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen, onMobileClose]);

  return (
    <>
      <aside
        className="np-rail"
        data-collapsed={collapsed ? 'true' : 'false'}
      >
        <RailContent
          collapsed={collapsed}
          onToggleCollapse={toggleCollapsed}
          onLogout={onLogout}
        />
      </aside>

      {mobileOpen && (
        <div className="np-drawer-root" role="dialog" aria-modal="true">
          <div className="np-drawer-scrim" onClick={onMobileClose} />
          <aside ref={drawerRef} className="np-rail np-drawer" data-collapsed="false">
            <RailContent collapsed={false} onClose={onMobileClose} onLogout={onLogout} />
          </aside>
        </div>
      )}
    </>
  );
}

export { RAIL_W, RAIL_W_COLLAPSED };
