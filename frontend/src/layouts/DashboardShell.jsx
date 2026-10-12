import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Sidebar from '../components/dashboard/Sidebar';
import MobileTabBar from '../components/dashboard/MobileTabBar';
import NewsTicker from '../components/NewsTicker';
import { useAuth } from '../context/AuthContext';
import { ShellContext } from './dashboardShellContext';

/**
 * The frame every signed-in working screen sits in.
 *
 * Phase 2 of docs/redesign/neela-press.md. Two columns on a desktop - the
 * rail and one scrolling content column - a tab bar instead of the rail on a
 * phone, and one static gradient behind all of it.
 *
 * The four animated atmosphere layers it used to carry (dash-bloom, -beam,
 * -vignette, -grain) are gone from here. They stay in index.css because the
 * post generator is out of scope and still renders them; this shell paints
 * `.np-bg` instead, which is a single static layer and the most expensive
 * thing that was removed.
 *
 * Which rail item is current is worked out from the path by the rail itself,
 * so nothing is passed down for it.
 */
export default function DashboardShell({ children }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const shellRef = useRef(null);

  const ctx = useMemo(() => ({ openMenu: () => setMobileOpen(true) }), []);

  // The rail owns its collapsed state, but the grid column it sits in belongs
  // to the shell, so the shell watches the attribute the rail writes rather
  // than the two keeping separate copies of one fact.
  // `animating` adds `contain` while the width moves, so a long dashboard does
  // not relayout on every frame of the collapse. It is set in the same place
  // as the rail state rather than in an effect that watches it: deriving one
  // piece of state from another through a second effect means an extra render
  // between the two, and here that render is the first frame of the animation.
  const [rail, setRail] = useState({ state: 'expanded', animating: false });

  useEffect(() => {
    const node = shellRef.current?.querySelector('.np-rail');
    if (!node) return undefined;
    const read = () => (node.dataset.collapsed === 'true' ? 'collapsed' : 'expanded');
    setRail({ state: read(), animating: false });
    const mo = new MutationObserver(() => setRail({ state: read(), animating: true }));
    mo.observe(node, { attributes: true, attributeFilter: ['data-collapsed'] });
    return () => mo.disconnect();
  }, []);

  useEffect(() => {
    if (!rail.animating) return undefined;
    const el = shellRef.current;
    const done = () => setRail((r) => (r.animating ? { ...r, animating: false } : r));
    el?.addEventListener('transitionend', done);
    // A belt for the case where the transition never fires: under reduced
    // motion it resolves to nothing and `transitionend` never arrives, so the
    // containment would stay on forever and clip whatever overflows.
    const timer = setTimeout(done, 420);
    return () => { el?.removeEventListener('transitionend', done); clearTimeout(timer); };
  }, [rail.animating]);

  async function handleLogout() {
    await logout();
    // The landing page, not the login form: signing out is leaving, and being
    // dropped onto a form reads as "sign in again" rather than "done".
    navigate('/', { replace: true });
  }

  return (
    <ShellContext.Provider value={ctx}>
      <div
        ref={shellRef}
        className="np np-bg np-shell"
        data-rail={rail.state}
        data-animating={rail.animating ? 'true' : 'false'}
      >
        <Sidebar
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
          onLogout={handleLogout}
        />

        {/* A column, so the ticker sits outside the scrolling element. Inside
            it would have to be sticky, and the page header already is - two
            sticky strips land on each other. */}
        <div className="np-col">
          <NewsTicker className="np-ticker" />
          <main className="np-main">{children}</main>
        </div>

        <MobileTabBar />
      </div>
    </ShellContext.Provider>
  );
}
