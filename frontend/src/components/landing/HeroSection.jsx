import { useEffect, useState } from 'react';
import { Play, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sparkle  from './Sparkle';
import CountUp  from './CountUp';
import { useAuth } from '../../context/AuthContext';
import squiggleSrc      from '../../assets/images/squiggle-lines.png';
import ambedkarPortrait from '../../assets/images/purpose-ambedkar.png';

export default function HeroSection() {
  const [scrollY, setScrollY] = useState(0);
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  function handleBheemBot() {
    if (currentUser) {
      navigate('/bheembot');
    } else {
      sessionStorage.setItem('auth_redirect', '/bheembot');
      navigate('/login');
    }
  }

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY || 0);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <section
      id="home"
      className="relative bg-[radial-gradient(circle_at_50%_0%,rgba(41,108,255,0.18),rgba(6,11,26,0.98)_42%),linear-gradient(180deg,#050a18_0%,#030611_100%)] pt-6 md:min-h-[680px] md:pt-10"
    >
      {/* Glows + squiggle */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-16 h-[460px] w-[460px] rounded-full bg-[#2d7dfb]/25 blur-[130px]" />
        <div className="absolute -right-24 top-0 h-[460px] w-[460px] rounded-full bg-[#1d66de]/25 blur-[120px]" />
        <div className="absolute left-1/2 top-[58%] h-[520px] w-[720px] -translate-x-1/2 rounded-full bg-[#1e4fb5]/25 blur-[120px]" />
        <div
          className="absolute inset-0 bg-cover bg-center opacity-15"
          style={{ backgroundImage: `url(${squiggleSrc})` }}
        />
      </div>

      {/* Scanner beam */}
      <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: '96px' }}>
        <div className="hero-scan-beam relative h-px w-full">
          <div
            className="absolute inset-x-0 h-px"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(63,159,255,0.12) 8%, rgba(63,210,255,0.85) 30%, rgba(180,230,255,1) 50%, rgba(63,210,255,0.85) 70%, rgba(63,159,255,0.12) 92%, transparent 100%)',
            }}
          />
          <div
            className="absolute inset-x-0 -top-3 h-7"
            style={{
              background: 'linear-gradient(90deg, transparent 5%, rgba(63,159,255,0.04) 20%, rgba(100,200,255,0.18) 40%, rgba(160,225,255,0.22) 50%, rgba(100,200,255,0.18) 60%, rgba(63,159,255,0.04) 80%, transparent 95%)',
              filter: 'blur(4px)',
            }}
          />
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="relative z-10 mx-auto grid max-w-[1180px] items-stretch gap-12 px-6 pb-16 pt-8 md:grid-cols-[1fr_auto] md:pb-24 md:pt-14">

        {/* ── LEFT: text content ── */}
        <div className="flex flex-col items-start">

          {/* Badge */}
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#3a5e94] bg-[#0f1d3b]/75 px-5 py-2 text-[13px] text-[#d3e4ff] shadow-[0_0_24px_rgba(43,126,255,0.22)]">
            <Sparkle size={12} color="#4fb4ff" />
            Trusted by AI Power Users Worldwide
          </div>

          {/* Headline */}
          <h1 className="font-display max-w-[620px] text-[38px] font-semibold leading-[1.1] tracking-tight text-white md:text-[56px]">
            Artificial Intelligence{' '}
            <span className="gradient-text-cyan italic">(AI) Meets</span>
            <br />
            Ambedkar&apos;s Intelligence{' '}
            <span className="gradient-text-cyan italic">(AI)</span>
          </h1>

          {/* Sub-copy */}
          <p className="font-count mt-6 max-w-[480px] text-[14.5px] leading-7 text-[#b7c6e1] md:text-[15px]">
            Deep Neural Networks trained on a dataset of 15,000 pages of
            writings and speeches of Dr. BR Ambedkar...
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              type="button"
              className="btn-outline-blue group inline-flex h-12 items-center gap-2.5 rounded-xl px-7 font-count text-[15px] font-medium text-white"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 transition group-hover:bg-white/20">
                <Play size={11} fill="currentColor" strokeWidth={0} className="translate-x-[1px]" />
              </span>
              Watch Demo
            </button>
            <button
              type="button"
              onClick={handleBheemBot}
              className="btn-gradient inline-flex h-12 items-center gap-2 rounded-xl px-7 font-count text-[15px] font-semibold text-white"
            >
              BheemBot
              <ArrowRight size={17} strokeWidth={2.2} />
            </button>
          </div>

          {/* Stats */}
          <div className="mt-10 flex items-start gap-8 md:gap-12">
            <div>
              <p className="font-display text-[36px] leading-none text-[#3f9fff] md:text-[44px]">
                <CountUp end={4.8} decimals={1} />
                <span className="text-[#3f9fff]/80">+</span>
              </p>
              <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[#90a8cc]">Stars Rating</p>
            </div>
            <div>
              <p className="font-display text-[36px] leading-none text-[#3f9fff] md:text-[44px]">
                <CountUp end={24} format={(v) => `${Math.round(v)}k`} />
                <span className="text-[#3f9fff]/80">+</span>
              </p>
              <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[#90a8cc]">Satisfied Customer</p>
            </div>
          </div>
        </div>

        {/* ── RIGHT: image placeholder + EDUCATE text + AI Tools card ── */}
        <div className="relative hidden md:flex md:w-[380px] md:flex-col md:items-end md:justify-between">

          {/* Ambedkar image */}
          <div className="relative w-full overflow-hidden rounded-2xl" style={{ height: '420px' }}>
            <img
              src={ambedkarPortrait}
              alt="Dr. BR Ambedkar"
              className="h-full w-full object-cover"
              style={{ objectPosition: 'center 35%' }}
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#030611]/60" />
          </div>

          {/* EDUCATE . AGITATE . ORGANIZE — below image */}
          <div className="w-full py-3 text-center">
            <span
              className="font-display text-[15px] font-bold text-white md:text-[17px]"
              style={{
                textShadow: '0 0 24px rgba(63,159,255,0.8), 0 0 48px rgba(63,159,255,0.4)',
                letterSpacing: '0.2em',
              }}
            >
              EDUCATE . AGITATE . ORGANIZE
            </span>
          </div>

          {/* Best AI Tools badge */}
          <div
            className="flex w-[220px] items-center gap-3 rounded-xl px-3 py-2.5"
            style={{
              backgroundColor: '#000000',
              border: '1px solid rgba(63,159,255,0.55)',
              boxShadow: '0 0 10px rgba(63,159,255,0.35), 0 0 24px rgba(63,159,255,0.15)',
            }}
          >
            {/* Icon — robot face with blue glow */}
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#1e2a4a]"
              style={{ backgroundColor: '#111827' }}
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                {/* head */}
                <rect x="3" y="6" width="14" height="10" rx="2.5" stroke="#4a7fff" strokeWidth="1.4"/>
                {/* eyes */}
                <circle cx="7.5" cy="11" r="1.5" fill="#4a7fff"/>
                <circle cx="12.5" cy="11" r="1.5" fill="#4a7fff"/>
                {/* antenna */}
                <line x1="10" y1="6" x2="10" y2="3.5" stroke="#4a7fff" strokeWidth="1.4" strokeLinecap="round"/>
                <circle cx="10" cy="3" r="1" fill="#4a7fff"/>
              </svg>
            </div>

            {/* Text */}
            <div>
              <p className="font-count text-[13px] font-bold uppercase leading-tight tracking-[0.06em] text-white">
                Best AI Tools
              </p>
              <p className="font-count mt-1 text-[10.5px] leading-[1.45] text-white/70">
                Using AI to democratize providing knowledge and create equal beginnings
              </p>
            </div>
          </div>
        </div>
      </div>

    </section>
  );
}
