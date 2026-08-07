import { useEffect, useState, useCallback } from 'react';
import logoSrc from '../assets/images/logo-animation.png';

const EXIT_MS = 180;

export default function OpeningSplash({ onDone }) {
  const [phase, setPhase] = useState('enter');

  // Lock body scroll while splash is visible
  useEffect(() => {
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => { document.documentElement.style.overflow = prev; };
  }, []);

  const dismiss = useCallback(() => {
    setPhase('exit');
    setTimeout(() => {
      setPhase('gone');
      onDone?.();
    }, EXIT_MS);
  }, [onDone]);

  function handleContinue() {
    dismiss();
  }

  if (phase === 'gone') return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to AmbedkarGPT"
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden transition-opacity duration-180 ease-out ${
        phase === 'exit' ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      style={{ background: 'radial-gradient(ellipse at 50% 30%, #0e1d4a 0%, #080e22 45%, #04080f 100%)' }}
    >
      {/* Spotlight */}
      <div
        className="splash-glow pointer-events-none absolute left-1/2 top-[22%] h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[90px]"
        style={{ background: 'radial-gradient(ellipse, rgba(30,90,210,0.45) 0%, rgba(10,40,130,0.25) 45%, transparent 75%)' }}
      />

      {/* Rings */}
      <div className="pointer-events-none absolute left-1/2 top-[30%] -translate-x-1/2 -translate-y-1/2">
        <span className="splash-ring splash-ring--1" />
        <span className="splash-ring splash-ring--2" />
        <span className="splash-ring splash-ring--3" />
      </div>

      {/* Logo */}
      <img
        src={logoSrc}
        alt=""
        className="splash-logo relative z-10 h-24 w-24 object-contain drop-shadow-[0_0_40px_rgba(63,159,255,0.75)] sm:h-28 sm:w-28 md:h-32 md:w-32"
      />

      {/* Wordmark — two-tier layout: serif name + display accent */}
      <div className="splash-wordmark relative z-10 mt-7 flex flex-col items-center gap-1.5">
        <h1
          className="font-serif text-[52px] font-bold uppercase leading-none tracking-[0.1em] sm:text-[64px] md:text-[88px] lg:text-[108px]"
          style={{
            background: 'linear-gradient(180deg, #dceeff 0%, #7ab8ff 28%, #2a6fd4 62%, #0d3a8a 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            filter: 'drop-shadow(0 0 28px rgba(50,120,255,0.3))',
          }}
        >
          Ambedkar
        </h1>
        <span
          className="font-display text-[26px] font-bold tracking-[0.38em] uppercase sm:text-[32px] md:text-[44px] lg:text-[54px]"
          style={{
            background: 'linear-gradient(90deg, #3f9fff 0%, #a78bff 50%, #3f9fff 100%)',
            backgroundSize: '200% 100%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            animation: 'accentShimmer 5s linear infinite',
          }}
        >
          GPT
        </span>
      </div>

      {/* Tagline */}
      <div className="splash-tagline relative z-10 mt-7 flex items-center gap-3 sm:gap-5">
        <div className="h-px w-14 sm:w-20 md:w-28" style={{ background: 'linear-gradient(90deg, transparent, rgba(74,123,196,0.65))' }} />
        <span className="font-count text-[12px] uppercase tracking-[0.45em] sm:text-[14px]" style={{ color: '#5080b8' }}>
          Bahujan AI Voice
        </span>
        <div className="h-px w-14 sm:w-20 md:w-28" style={{ background: 'linear-gradient(270deg, transparent, rgba(74,123,196,0.65))' }} />
      </div>

      {/* ESTD */}
      <p className="splash-estd relative z-10 mt-4 font-count text-[11px] uppercase tracking-[0.38em]" style={{ color: '#5a82c0' }}>
        ESTD. 2026
      </p>

      {/* Continue button */}
      <div className="splash-lang relative z-10 mt-8">
        <button
          type="button"
          onClick={handleContinue}
          className="group inline-flex items-center gap-2.5 rounded-full px-7 py-2.5 font-count text-[14px] font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110"
          style={{
            background: 'linear-gradient(135deg, #1a5fff 0%, #3f9fff 100%)',
            boxShadow: '0 4px 20px rgba(63,159,255,0.35)',
          }}
        >
          Continue
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
