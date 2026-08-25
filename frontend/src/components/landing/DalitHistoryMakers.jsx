import { useState, useEffect, useRef, useCallback } from 'react';
import { Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SectionLabel from './SectionLabel';
import { useAuth } from '../../context/AuthContext';
import savitribai from '../../assets/images/makers/savitribai.png';
import gurram     from '../../assets/images/makers/gurram.png';
import jagjivan   from '../../assets/images/makers/jagjivan.png';
import udham      from '../../assets/images/makers/udham.png';
import dakshayani from '../../assets/images/makers/dakshayani.png';
import kanshi     from '../../assets/images/makers/kanshi.png';
import janabai    from '../../assets/images/makers/janabai.png';

const MAKERS = [
  {
    name: 'Savitribai Phule',
    image: savitribai,
    blurb: "India's first woman teacher and a pioneer of education for every learner, regardless of birth.",
  },
  {
    name: 'Gurram Jashuva',
    image: gurram,
    blurb: 'Poet of the oppressed who turned ignored verse into a clarion call for equality.',
  },
  {
    name: 'Jagjivan Ram',
    image: jagjivan,
    blurb: 'Champion of social justice and a voice for the marginalized across generations.',
  },
  {
    name: 'Udham Singh',
    image: udham,
    blurb: 'A revolutionary who gave voice to the silenced and inspired movements for dignity.',
  },
  {
    name: 'Dakshayani Velayudhan',
    image: dakshayani,
    blurb: 'First and only Dalit woman elected to the Constituent Assembly and a quiet architect of equality.',
  },
  {
    name: 'Kanshi Ram',
    image: kanshi,
    blurb: 'Organiser of the modern Bahujan movement and an unwavering advocate for social justice.',
  },
  {
    name: 'Sant Janabai',
    image: janabai,
    blurb: 'Medieval Marathi saint-poet whose verses centred the lives of labouring Dalit women.',
  },
];

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

function MakerCard({ maker }) {
  return (
    <div className="group relative h-[400px] w-[300px] shrink-0 overflow-hidden rounded-2xl border border-[#2a4375]/60 bg-[#0a1430] shadow-[0_20px_50px_rgba(0,0,0,0.45)] transition hover:-translate-y-1 hover:border-[#4a78c8]/80">
      <div className="absolute inset-0 bg-gradient-to-b from-[#11204a] via-[#0b1633] to-[#070c1f]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_25%,rgba(63,159,255,0.18),transparent_65%)]" />

      <img
        src={maker.image}
        alt={maker.name}
        loading="lazy"
        className="relative h-full w-full object-cover object-top transition duration-700 group-hover:scale-[1.04]"
        style={{ filter: 'saturate(1.05) contrast(1.02)' }}
      />

      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-[#030611] via-[#030611]/70 to-transparent p-5">
        <h3 className="text-[24px] font-semibold leading-tight text-white md:text-[27px]">
          {maker.name}
        </h3>
        <p className="mt-2 line-clamp-3 text-[17px] leading-relaxed text-[#c2d2ee] md:text-[18px]">
          {maker.blurb}
        </p>
      </div>
    </div>
  );
}

// Triple-clone so the track is always deep enough to loop seamlessly
const TRACK        = [...MAKERS, ...MAKERS, ...MAKERS];
const CARD_W       = 300;
const GAP          = 20;
const STEP         = CARD_W + GAP;           // px per card slot
const VIEWPORT_W   = 4 * CARD_W + 3 * GAP;  // show 4 cards = 1260px
const AUTO_MS      = 3000;
const SLIDE_EASE   = 'transform 0.55s cubic-bezier(0.25, 0.46, 0.45, 0.94)';

function DesktopCarousel() {
  // Start in the middle copy so we can go left or right without hitting the edge
  const [trackIdx,  setTrackIdx]  = useState(MAKERS.length);
  const [animated,  setAnimated]  = useState(true);
  const trackIdxRef               = useRef(MAKERS.length);
  const timerRef                  = useRef(null);

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
    const n   = MAKERS.length;
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
  function goTo(markerIdx) {
    const n    = MAKERS.length;
    const cur  = trackIdxRef.current;
    // jump to whichever copy of markerIdx is closest to current position
    const base = Math.round(cur / n) * n + markerIdx;
    trackIdxRef.current = base;
    setAnimated(true);
    setTrackIdx(base);
    startTimer();
  }

  const activeMarker = ((trackIdx % MAKERS.length) + MAKERS.length) % MAKERS.length;

  return (
    <div className="mt-14">
      {/* Viewport + side buttons */}
      <div className="relative" style={{ width: VIEWPORT_W, margin: '0 auto' }}>
        {/* Left button — sits outside the left edge, vertically centred on the cards */}
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
            {TRACK.map((maker, i) => (
              <div key={i} style={{ flexShrink: 0 }}>
                <MakerCard maker={maker} />
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
        {MAKERS.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => goTo(i)}
            className={[
              'rounded-full transition-all duration-300',
              i === activeMarker
                ? 'h-2 w-6 bg-[#3f9fff]'
                : 'h-2 w-2 bg-[#2a4375]/60 hover:bg-[#3f9fff]/50',
            ].join(' ')}
            aria-label={`Go to ${MAKERS[i].name}`}
          />
        ))}
      </div>
    </div>
  );
}

function MobileCarousel() {
  const [activeIdx, setActiveIdx] = useState(0);

  function goPrev() {
    setActiveIdx((i) => (i - 1 + MAKERS.length) % MAKERS.length);
  }
  function goNext() {
    setActiveIdx((i) => (i + 1) % MAKERS.length);
  }

  const maker = MAKERS[activeIdx];

  return (
    <div className="mt-10 px-6">
      <div className="relative mx-auto h-[420px] max-w-[360px] overflow-hidden rounded-2xl border border-[#2a4375]/60 bg-[#0a1430] shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
        <div
          key={activeIdx}
          className="absolute inset-0"
          style={{ animation: 'makerJumpIn 0.22s ease-out both' }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-[#11204a] via-[#0b1633] to-[#070c1f]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_25%,rgba(63,159,255,0.18),transparent_65%)]" />
          <img
            src={maker.image}
            alt={maker.name}
            loading="lazy"
            className="relative h-full w-full object-cover object-top"
            style={{ filter: 'saturate(1.05) contrast(1.02)' }}
          />
          <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-[#030611] via-[#030611]/70 to-transparent p-5">
            <h3 className="text-[22px] font-semibold leading-tight text-white">{maker.name}</h3>
            <p className="mt-2 line-clamp-3 text-[16px] leading-relaxed text-[#c2d2ee]">{maker.blurb}</p>
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-center gap-4">
        <NavButton onClick={goPrev} direction="left" label="Previous" />

        <div className="flex items-center gap-2">
          {MAKERS.map((_, i) => (
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
              aria-label={`Go to ${MAKERS[i].name}`}
            />
          ))}
        </div>

        <NavButton onClick={goNext} direction="right" label="Next" />
      </div>
    </div>
  );
}

export default function DalitHistoryMakers() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  // Straight to the post generator. ProtectedRoute would capture the intended
  // path on its own, but setting it here means a signed-out visitor lands on
  // the generator after logging in rather than on the dashboard.
  function handleBuildNarrative() {
    const target = '/generate/social-media';
    if (currentUser) {
      navigate(target);
    } else {
      sessionStorage.setItem('auth_redirect', target);
      navigate('/login');
    }
  }

  return (
    <section className="relative py-10 md:py-14">
      <div className="pointer-events-none absolute inset-x-0 -top-28 -bottom-28">
        <div className="absolute left-1/2 top-1/3 h-[400px] w-[700px] -translate-x-1/2 rounded-full bg-[#1e4fb5]/10 blur-[140px]" />
      </div>

      <div className="mx-auto max-w-[1440px] px-6">
        <SectionLabel>Dalit History Makers</SectionLabel>

        <h2 className="mx-auto mt-8 max-w-[900px] text-center font-display text-[52px] font-bold leading-[1.05] text-white md:text-[72px]">
          Voices That Shaped{' '}
          <span className="italic gradient-text-blue">Justice</span>
        </h2>

        <p className="mx-auto mt-6 max-w-[760px] text-center text-[22px] leading-9 text-[#bfcfe8] md:text-[24px]">
          Meet the reformers, poets, and thinkers whose ideas built the foundations of
          equality. Their stories live on in every line of the corpus.
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

      <div className="mt-10 flex justify-center md:mt-14">
        <button
          type="button"
          onClick={handleBuildNarrative}
          className="btn-gradient group inline-flex h-14 items-center gap-3 rounded-xl px-9 font-count text-[17px] font-semibold text-white"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 transition group-hover:bg-white/20">
            <Play size={13} fill="currentColor" strokeWidth={0} className="translate-x-[1px]" />
          </span>
          Build your narrative
        </button>
      </div>
    </section>
  );
}
