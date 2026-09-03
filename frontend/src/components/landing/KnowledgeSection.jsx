import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Edit3, Headphones, Mic2, Video, Newspaper, Scale, ArrowRight, Check } from 'lucide-react';
import SectionLabel from './SectionLabel';
import { useI18n } from '../../i18n/index.jsx';

const SERVICES = [
  {
    icon: Edit3,
    color: '#ff4f8a',
    gradient: 'from-[#ff4f8a] to-[#d43a68]',
    live: true,
    route: '/generate/social-media',
    id: 'social',
  },
  {
    icon: Headphones,
    color: '#06b6d4',
    gradient: 'from-[#06b6d4] to-[#0891b2]',
    live: false,
    id: 'podcast',
  },
  {
    icon: Mic2,
    color: '#22c55e',
    gradient: 'from-[#22c55e] to-[#16a34a]',
    live: false,
    id: 'speech',
  },
  {
    icon: Video,
    color: '#a855f7',
    gradient: 'from-[#a855f7] to-[#7b3fd4]',
    live: false,
    id: 'video',
  },
  {
    icon: Newspaper,
    color: '#f59e0b',
    gradient: 'from-[#f59e0b] to-[#d97706]',
    live: false,
    id: 'editorial',
  },
  {
    icon: Scale,
    color: '#3f9fff',
    gradient: 'from-[#3f9fff] to-[#5bc0ff]',
    live: false,
    id: 'debate',
  },
];

function handleCardMove(e) {
  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();
  el.style.setProperty('--mx', `${e.clientX - rect.left}px`);
  el.style.setProperty('--my', `${e.clientY - rect.top}px`);
}

function NavButton({ onClick, direction, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#2a4375]/60 bg-[#0a1430] text-[#7a90b8] transition hover:border-[#4a78c8]/80 hover:bg-[#0f1e45] hover:text-white"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        {direction === 'left'
          ? <path d="M10 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          : <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        }
      </svg>
    </button>
  );
}

function ServiceCard({ service }) {
  const { t } = useI18n();
  const { icon: Icon, id, color, gradient, live, route } = service;
  const title = t(`svc.${id}.title`);
  const sub = t(`svc.${id}.sub`);
  const features = [1, 2, 3].map((n) => t(`svc.${id}.f${n}`));
  return (
    <div
      onMouseMove={handleCardMove}
      className="liquid-glass group relative flex h-[480px] w-full flex-col overflow-hidden rounded-2xl p-7"
    >
      {/* cursor spotlight */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `radial-gradient(220px circle at var(--mx,50%) var(--my,50%), ${color}22, transparent 65%)` }}
      />
      <div
        className="pointer-events-none absolute -top-14 -right-14 h-32 w-32 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: `${color}20` }}
      />

      {/* ── Top row: icon + badge ── */}
      <div className="relative flex items-start justify-between">
        <span
          className={`flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} shadow-[0_4px_18px_rgba(0,0,0,0.35)]`}
        >
          <Icon size={24} strokeWidth={1.8} className="text-white" />
        </span>
        {live ? (
          <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-1 font-count text-[11px] font-semibold uppercase tracking-widest text-green-400">
            {t('landing.live')}
          </span>
        ) : (
          <span className="rounded-full border border-[#2a4375]/50 bg-[#0c1735]/60 px-2.5 py-1 font-count text-[11px] font-semibold uppercase tracking-widest text-[#5a7aaa]">
            {t('landing.soon')}
          </span>
        )}
      </div>

      {/* ── Title & description ── */}
      <p className="relative mt-5 text-[26px] font-semibold text-white">{title}</p>
      <p className="relative mt-2 text-[19px] leading-relaxed text-[#8aabcc]">{sub}</p>

      {/* ── Divider ── */}
      <div className="relative my-5 h-px w-full rounded-full bg-[#1e3260]/70" />

      {/* ── Feature bullets ── */}
      <ul className="relative flex-1 space-y-3">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2.5">
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
              style={{ background: `${color}22` }}
            >
              <Check size={11} strokeWidth={2.5} style={{ color }} />
            </span>
            <span className="text-[18px] text-[#a8c0dc]">{f}</span>
          </li>
        ))}
      </ul>

      {/* ── Bottom CTA ── */}
      <div className="relative mt-6 border-t border-[#1e3260]/50 pt-5">
        {live && route ? (
          <Link
            to={route}
            className="inline-flex items-center gap-1.5 text-[18px] font-semibold transition-all duration-200 hover:gap-2.5"
            style={{ color }}
          >
            {t('landing.tryNow')}
            <ArrowRight size={14} strokeWidth={2.2} />
          </Link>
        ) : (
          <p className="text-[17px] text-[#3d5a80]">{t('landing.comingSoon')}</p>
        )}
      </div>
    </div>
  );
}

// Triple-clone so the track is always deep enough to loop seamlessly
const TRACK      = [...SERVICES, ...SERVICES, ...SERVICES];
const CARD_W     = 360;
const GAP        = 24;
const STEP       = CARD_W + GAP;           // px per card slot
const VIEWPORT_W = 3 * CARD_W + 2 * GAP;   // show 3 cards
const AUTO_MS    = 3000;
const SLIDE_EASE = 'transform 0.55s cubic-bezier(0.25, 0.46, 0.45, 0.94)';

function DesktopCarousel() {
  // Start in the middle copy so we can go left or right without hitting the edge
  const [trackIdx, setTrackIdx] = useState(SERVICES.length);
  const [animated, setAnimated] = useState(true);
  const trackIdxRef             = useRef(SERVICES.length);
  const timerRef                = useRef(null);

  const startTimer = useCallback(() => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const next = trackIdxRef.current + 1;
      trackIdxRef.current = next;
      setAnimated(true);
      setTrackIdx(next);
    }, AUTO_MS);
  }, []);

  useEffect(() => {
    startTimer();
    return () => clearInterval(timerRef.current);
  }, [startTimer]);

  // After each slide completes, silently jump back to the middle copy if needed
  function onTransitionEnd() {
    const n   = SERVICES.length;
    const cur = trackIdxRef.current;
    if (cur >= n * 2) {
      const next = cur - n;
      trackIdxRef.current = next;
      setAnimated(false);
      setTrackIdx(next);
    } else if (cur < n) {
      const next = cur + n;
      trackIdxRef.current = next;
      setAnimated(false);
      setTrackIdx(next);
    }
  }

  // Re-enable transition on the frame after the silent jump
  useEffect(() => {
    if (!animated) {
      const id = requestAnimationFrame(() =>
        requestAnimationFrame(() => setAnimated(true))
      );
      return () => cancelAnimationFrame(id);
    }
  }, [animated]);

  function goPrev() {
    const next = trackIdxRef.current - 1;
    trackIdxRef.current = next;
    setAnimated(true);
    setTrackIdx(next);
    startTimer();
  }
  function goNext() {
    const next = trackIdxRef.current + 1;
    trackIdxRef.current = next;
    setAnimated(true);
    setTrackIdx(next);
    startTimer();
  }
  function goTo(serviceIdx) {
    const n    = SERVICES.length;
    const cur  = trackIdxRef.current;
    // jump to whichever copy of serviceIdx is closest to current position
    const base = Math.round(cur / n) * n + serviceIdx;
    trackIdxRef.current = base;
    setAnimated(true);
    setTrackIdx(base);
    startTimer();
  }

  const activeService = ((trackIdx % SERVICES.length) + SERVICES.length) % SERVICES.length;

  return (
    <div className="mt-14">
      {/* Viewport + side buttons */}
      <div className="relative" style={{ width: VIEWPORT_W, margin: '0 auto' }}>
        {/* Left button */}
        <div className="absolute top-1/2 -translate-y-1/2" style={{ left: -64 }}>
          <NavButton onClick={goPrev} direction="left" label="Previous" />
        </div>

        {/* Clipped viewport */}
        <div style={{ overflow: 'hidden' }}>
          <div
            onTransitionEnd={onTransitionEnd}
            style={{
              display:    'flex',
              gap:        GAP,
              transform:  `translateX(${-(trackIdx * STEP)}px)`,
              transition: animated ? SLIDE_EASE : 'none',
            }}
          >
            {TRACK.map((service, i) => (
              <div key={i} style={{ flexShrink: 0, width: CARD_W }}>
                <ServiceCard service={service} />
              </div>
            ))}
          </div>
        </div>

        {/* Right button */}
        <div className="absolute top-1/2 -translate-y-1/2" style={{ right: -64 }}>
          <NavButton onClick={goNext} direction="right" label="Next" />
        </div>
      </div>

      {/* Dots */}
      <div className="mt-7 flex justify-center gap-2">
        {SERVICES.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => goTo(i)}
            className={[
              'rounded-full transition-all duration-300',
              i === activeService
                ? 'h-2 w-6 bg-[#3f9fff]'
                : 'h-2 w-2 bg-[#2a4375]/60 hover:bg-[#3f9fff]/50',
            ].join(' ')}
            aria-label={`Go to ${SERVICES[i].title}`}
          />
        ))}
      </div>
    </div>
  );
}

function MobileCarousel() {
  const [activeIdx, setActiveIdx] = useState(0);

  function goPrev() {
    setActiveIdx((i) => (i - 1 + SERVICES.length) % SERVICES.length);
  }
  function goNext() {
    setActiveIdx((i) => (i + 1) % SERVICES.length);
  }

  const service = SERVICES[activeIdx];

  return (
    <div className="mt-10 px-6">
      <div
        key={activeIdx}
        className="mx-auto max-w-[360px]"
        style={{ animation: 'makerJumpIn 0.22s ease-out both' }}
      >
        <ServiceCard service={service} />
      </div>

      <div className="mt-5 flex items-center justify-center gap-4">
        <NavButton onClick={goPrev} direction="left" label="Previous" />

        <div className="flex items-center gap-2">
          {SERVICES.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActiveIdx(i)}
              className={[
                'rounded-full transition-all duration-200',
                i === activeIdx
                  ? 'h-2 w-6 bg-[#3f9fff]'
                  : 'h-2 w-2 bg-[#2a4375]/60 hover:bg-[#3f9fff]/50',
              ].join(' ')}
              aria-label={`Go to ${SERVICES[i].title}`}
            />
          ))}
        </div>

        <NavButton onClick={goNext} direction="right" label="Next" />
      </div>
    </div>
  );
}

export default function KnowledgeSection() {
  const { t } = useI18n();
  return (
    <section id="about" className="relative py-8 md:py-10">
      <div className="pointer-events-none absolute inset-x-0 -top-28 -bottom-28">
        <div className="absolute left-[20%] top-[30%] h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#2d7dfb]/9 blur-[140px]" />
        <div className="absolute right-[10%] bottom-[20%] h-[380px] w-[380px] rounded-full bg-[#1a5fff]/7 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-[1440px] px-6">
        <SectionLabel>{t('landing.ourServices')}</SectionLabel>

        <h2 className="mx-auto mt-8 max-w-[820px] text-center font-display text-[46px] font-bold leading-[1.05] text-white md:text-[62px]">
          Grow Your Content{' '}
          <span className="gradient-text-blue italic">{t('landing.creatorJourney')}</span>
        </h2>

        <p className="mx-auto mt-6 max-w-[760px] text-center text-[22px] leading-9 text-[#bfcfe8] md:text-[24px]">
          {t('know.sub')}
        </p>
      </div>

      {/* Mobile: one-by-one carousel */}
      <div className="md:hidden">
        <MobileCarousel />
      </div>

      {/* Desktop: carousel with left/right nav */}
      <div className="hidden md:block">
        <DesktopCarousel />
      </div>

      {/* ── CTA ── */}
      <div className="mt-12 flex justify-center">
        <Link
          to="/signup"
          className="inline-flex h-14 items-center gap-3 rounded-xl bg-[#2d6fff] px-9 text-[17px] font-semibold text-white shadow-[0_0_24px_rgba(45,111,255,0.4)] transition-all duration-300 hover:bg-[#3d7fff] hover:-translate-y-0.5 hover:shadow-[0_0_36px_rgba(45,111,255,0.6)]"
        >
          {t('landing.getStartedFree')}
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
    </section>
  );
}
