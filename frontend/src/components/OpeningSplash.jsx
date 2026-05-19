import { useEffect, useRef, useState } from 'react';
import logoSrc from '../assets/images/logo-animation.png';
import { markAppReady } from '../utils/appReady';
import {
  SITE_LANGUAGES,
  setSiteLanguage,
  getSiteLanguage,
  getSiteLanguageLabel,
} from '../utils/siteLanguage';

const EXIT_MS = 700;
const AUTO_DISMISS_MS = 2200; // how long to show the animation before auto-dismissing

export default function OpeningSplash({ onDone }) {
  const existingLang = getSiteLanguage(); // null on first visit, code on return
  const [phase, setPhase] = useState('enter'); // 'enter' | 'exit' | 'gone'
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedCode, setSelectedCode] = useState(null);
  const langRef = useRef(null);

  useEffect(() => {
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, []);

  // Return visit: language already chosen — just play the animation then auto-dismiss
  useEffect(() => {
    if (!existingLang) return;
    const t = setTimeout(() => {
      setPhase('exit');
      setTimeout(() => {
        setPhase('gone');
        markAppReady();
        onDone?.();
      }, EXIT_MS);
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!menuOpen) return undefined;

    function onPointerDown(e) {
      if (langRef.current && !langRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }

    function onKeyDown(e) {
      if (e.key === 'Escape') setMenuOpen(false);
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  function handleSelect(code) {
    if (phase !== 'enter' || selectedCode) return;

    setSiteLanguage(code);
    setSelectedCode(code);
    setMenuOpen(false);
    setPhase('exit');

    setTimeout(() => {
      setPhase('gone');
      markAppReady();
      onDone?.();
    }, EXIT_MS);
  }

  if (phase === 'gone') return null;

  const selectedLabel = selectedCode ? getSiteLanguageLabel(selectedCode) : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to AmbedkarGPT"
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden transition-opacity duration-[700ms] ease-out ${
        phase === 'exit' ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      style={{ background: 'radial-gradient(ellipse at 50% 30%, #0e1d4a 0%, #080e22 45%, #04080f 100%)' }}
    >
      {/* ΓöÇΓöÇ Spotlight radial glow ΓöÇΓöÇ */}
      <div
        className="splash-glow pointer-events-none absolute left-1/2 top-[22%] h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[90px]"
        style={{ background: 'radial-gradient(ellipse, rgba(30,90,210,0.45) 0%, rgba(10,40,130,0.25) 45%, transparent 75%)' }}
      />

      {/* ΓöÇΓöÇ Expanding rings ΓöÇΓöÇ */}
      <div className="pointer-events-none absolute left-1/2 top-[30%] -translate-x-1/2 -translate-y-1/2">
        <span className="splash-ring splash-ring--1" />
        <span className="splash-ring splash-ring--2" />
        <span className="splash-ring splash-ring--3" />
      </div>

      {/* ΓöÇΓöÇ Radar logo ΓöÇΓöÇ */}
      <img
        src={logoSrc}
        alt=""
        className="splash-logo relative z-10 h-20 w-20 object-contain drop-shadow-[0_0_32px_rgba(63,159,255,0.7)] md:h-28 md:w-28"
      />

      {/* ΓöÇΓöÇ Wordmark: AMBEDKARGPT ΓöÇΓöÇ */}
      <h1
        className="splash-wordmark relative z-10 mt-6 font-serif text-[52px] font-bold uppercase leading-none tracking-[0.08em] md:text-[80px] lg:text-[96px]"
        style={{
          background: 'linear-gradient(180deg, #c8deff 0%, #6aaaff 30%, #2a6fd4 65%, #0d3a8a 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          textShadow: 'none',
          filter: 'drop-shadow(0 0 28px rgba(50,120,255,0.35))',
        }}
      >
        AmbedkarGPT
      </h1>

      {/* ΓöÇΓöÇ Divider + tagline ΓöÇΓöÇ */}
      <div className="splash-tagline relative z-10 mt-6 flex items-center gap-4">
        <div
          className="h-px w-16 md:w-24"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(74,123,196,0.7))' }}
        />
        <span
          className="font-count text-[10px] uppercase tracking-[0.42em] md:text-[11px]"
          style={{ color: '#4a7bc4' }}
        >
          AI for Justice
        </span>
        <div
          className="h-px w-16 md:w-24"
          style={{ background: 'linear-gradient(270deg, transparent, rgba(74,123,196,0.7))' }}
        />
      </div>

      {/* ΓöÇΓöÇ ESTD. 2026 ΓöÇΓöÇ */}
      <p
        className="splash-estd relative z-10 mt-3 font-count text-[10px] uppercase tracking-[0.35em]"
        style={{ color: '#2d5080' }}
      >
        ESTD. 2026
      </p>

      {/* Language section */}
      {existingLang ? (
        /* Return visit — show current language badge, auto-dismissing */
        <div className="splash-lang relative z-10 mt-6 flex flex-col items-center gap-2">
          <span
            className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 font-count text-[12px] font-medium"
            style={{ borderColor: 'rgba(63,120,220,0.3)', backgroundColor: 'rgba(15,35,90,0.45)', color: '#4a6eaa' }}
          >
            {getSiteLanguageLabel(existingLang)}
          </span>
          <p className="font-count text-[10px] uppercase tracking-[0.28em]" style={{ color: '#2a4870' }}>
            Loading…
          </p>
        </div>
      ) : (
        /* First visit — require language selection */
        <div ref={langRef} className="splash-lang relative z-10 mt-6 flex flex-col items-center gap-2">
          <div className="relative">
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={menuOpen}
              aria-label="Select site language"
              disabled={Boolean(selectedCode)}
              onClick={() => setMenuOpen((open) => !open)}
              className="inline-flex min-w-[168px] items-center justify-between gap-3 rounded-full border px-4 py-1.5 font-count text-[12px] font-medium transition hover:brightness-110 disabled:cursor-default disabled:opacity-90"
              style={{
                borderColor: 'rgba(63,120,220,0.5)',
                backgroundColor: 'rgba(15,35,90,0.6)',
                color: '#7aabea',
              }}
            >
              <span>{selectedLabel ?? 'Select language'}</span>
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">
                <path d="M1 1l4 4 4-4" stroke="#7aabea" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {menuOpen && !selectedCode && (
              <ul
                role="listbox"
                aria-label="Site language"
                className="absolute left-0 right-0 top-[calc(100%+8px)] overflow-hidden rounded-2xl border py-1 shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
                style={{
                  borderColor: 'rgba(63,120,220,0.45)',
                  backgroundColor: 'rgba(8,18,48,0.98)',
                }}
              >
                {SITE_LANGUAGES.map((lang) => (
                  <li key={lang.code} role="presentation">
                    <button
                      type="button"
                      role="option"
                      className="w-full px-4 py-2 text-left font-count text-[12px] font-medium transition hover:bg-[rgba(63,120,220,0.2)]"
                      style={{ color: '#9ec4f5' }}
                      onClick={() => handleSelect(lang.code)}
                    >
                      {lang.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="font-count text-[10px] uppercase tracking-[0.28em]" style={{ color: '#3d6a9e' }}>
            Choose a language to continue
          </p>
        </div>
      )}
    </div>
  );
}
