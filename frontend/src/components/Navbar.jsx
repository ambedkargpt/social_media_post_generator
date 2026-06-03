import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { Menu, X } from 'lucide-react';
import logoSrc from '../assets/images/logo-animation.png';

const navItems = [
  { label: 'HOME',          sectionId: 'home' },
  { label: 'ABOUT',         sectionId: 'about' },
  { label: 'BHEEM CHATBOT', sectionId: 'bheem' },
  { label: 'CONTACT',       sectionId: 'contact' },
  { label: 'CHARITY',       sectionId: 'charity' },
  { label: 'AMBEDKARVERSE', sectionId: 'ambedkarverse' },
];

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [active,   setActive]   = useState('home');
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef(null);

  // Highlight nav item based on scroll position
  useEffect(() => {
    if (location.pathname !== '/') return;
    const ids = navItems.map((i) => i.sectionId);
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean);
    if (!els.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-40% 0px -50% 0px', threshold: [0.1, 0.5, 1] }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [location.pathname]);

  // Close dropdown when clicking outside the header
  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e) {
      if (headerRef.current && !headerRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(e) { if (e.key === 'Escape') setMenuOpen(false); }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  // Close dropdown on route change
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  function handleNav(sectionId) {
    setActive(sectionId);
    setMenuOpen(false);
    if (location.pathname === '/') {
      const target = document.getElementById(sectionId);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    sessionStorage.setItem('pending-section-scroll', sectionId);
    navigate('/');
  }

  return (
    <header
      ref={headerRef}
      className="fixed inset-x-0 top-0 z-40 border-b border-[#1a2c55]/40 bg-[rgba(6,10,24,0.55)] backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.35)]"
    >
      <div className="mx-auto flex h-[72px] w-full max-w-[1440px] items-center justify-between px-6 md:h-[80px] md:px-10">

        {/* ── Logo ─────────────────────────────── */}
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2"
          onClick={() => {
            if (location.pathname === '/') window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <img
            src={logoSrc}
            alt="AmbedkarGPT"
            className="h-10 w-10 object-contain drop-shadow-[0_0_16px_rgba(63,159,255,0.65)] md:h-12 md:w-12"
          />
          <span className="font-display text-[18px] font-bold leading-none tracking-tight md:text-[24px]">
            <span className="hidden text-white sm:inline">Ambedkar</span>
            <span className="gradient-text-cyan">GPT</span>
          </span>
        </Link>

        {/* ── Desktop nav ──────────────────────── */}
        <nav className="hidden items-center gap-7 font-count text-[11.5px] font-medium tracking-[0.16em] lg:flex">
          {navItems.map((item) => {
            const isActive = active === item.sectionId;
            return (
              <button
                key={item.sectionId}
                type="button"
                onClick={() => handleNav(item.sectionId)}
                className={`relative rounded-md px-3 py-1.5 transition-all duration-200 ${
                  isActive
                    ? 'bg-[#0d1a3a] border border-[#3f6bd4]/60 text-[#3f9fff] shadow-[0_0_12px_rgba(63,159,255,0.18)]'
                    : 'border border-transparent text-white/75 hover:text-white hover:bg-white/[0.05] hover:border-white/10'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* ── Right cluster: hamburger + CTAs ─── */}
        <div className="flex shrink-0 items-center gap-2 md:gap-3">

          {/* Hamburger — mobile/tablet only */}
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-white/70 transition hover:border-white/30 hover:text-white lg:hidden"
          >
            {menuOpen
              ? <X    size={16} strokeWidth={1.8} />
              : <Menu size={16} strokeWidth={1.8} />
            }
          </button>

          <Link
            to="/login"
            className="inline-flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-white/20 bg-white/5 px-3 font-count text-[11.5px] font-medium text-white/80 transition hover:border-white/40 hover:bg-white/10 hover:text-white md:h-10 md:border-transparent md:bg-transparent md:px-4 md:text-[13px] md:hover:bg-transparent"
          >
            Log In
          </Link>
          <Link
            to="/signup"
            className="inline-flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-lg bg-linear-to-r from-[#0a7dff] to-[#3a9fff] px-3.5 font-count text-[11.5px] font-semibold text-white shadow-[0_4px_14px_rgba(17,122,255,0.4)] transition hover:-translate-y-0.5 hover:brightness-110 md:h-10 md:px-5 md:text-[13px] md:shadow-[0_6px_24px_rgba(17,122,255,0.45)]"
          >
            Get Started
          </Link>
        </div>
      </div>

      {/* ── Mobile dropdown menu ─────────────── */}
      {menuOpen && (
        <div
          className="absolute inset-x-0 top-full z-10 border-b border-[#1a2c55]/50 bg-[rgba(5,8,20,0.96)] backdrop-blur-xl lg:hidden"
          style={{ animation: 'nav-dropdown 160ms ease-out both' }}
        >
          <nav className="mx-auto w-full max-w-[1440px] px-4 py-2">
            {navItems.map((item) => {
              const isActive = active === item.sectionId;
              return (
                <button
                  key={item.sectionId}
                  type="button"
                  onClick={() => handleNav(item.sectionId)}
                  className={[
                    'flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left font-count text-[11.5px] font-medium tracking-[0.14em] transition-all duration-150',
                    isActive
                      ? 'bg-[#0d1a36] text-[#3f9fff] border border-[#3f6bd4]/35'
                      : 'border border-transparent text-[#b8cce8] hover:bg-white/[0.05] hover:text-white',
                  ].join(' ')}
                >
                  {isActive && (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#3f9fff] shadow-[0_0_7px_rgba(63,159,255,0.8)]" />
                  )}
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
