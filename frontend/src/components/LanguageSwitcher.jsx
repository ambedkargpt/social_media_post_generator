import { useRef, useState, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { SITE_LANGUAGES, getSiteLanguage } from '../utils/siteLanguage';
import { useI18n } from '../i18n/index.jsx';

export default function LanguageSwitcher() {
  const [open, setOpen] = useState(false);
  const { changeLanguage } = useI18n();
  const [current, setCurrent] = useState(getSiteLanguage() ?? 'hi');
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function select(code) {
    // Live, not a reload. changeLanguage persists the choice and moves the
    // provider, so every screen re-renders in place: the reload was only ever
    // there because nothing held the language in React state, and it threw
    // away whatever the person was in the middle of doing.
    changeLanguage(code);
    setCurrent(code);
    setOpen(false);
  }

  const currentLang = SITE_LANGUAGES.find((l) => l.code === current);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-label="Change language"
        title="Change language"
        className="flex h-10 w-10 items-center justify-center rounded-full border border-[#1a254a]/70 bg-[#0d1531]/60 text-[#a3b0d4] transition hover:border-[#2a4375]/80 hover:text-white"
      >
        <Globe size={15} strokeWidth={1.9} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border shadow-[0_16px_40px_rgba(0,0,0,0.5)]"
          style={{ borderColor: 'rgba(63,120,220,0.4)', backgroundColor: 'rgba(8,18,48,0.98)', minWidth: 140 }}
        >
          <p className="px-4 pt-3 pb-1.5 font-count text-[10px] uppercase tracking-widest text-[#4a6eaa]">
            Language
          </p>
          {SITE_LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => select(lang.code)}
              className="flex w-full items-center justify-between px-4 py-2.5 text-left font-count text-[13px] transition hover:bg-[rgba(63,120,220,0.15)]"
              style={{ color: lang.code === current ? '#6aa8ff' : '#9ec4f5' }}
            >
              {lang.label}
              {lang.code === current && (
                <span className="h-1.5 w-1.5 rounded-full bg-[#3f9fff] shadow-[0_0_6px_rgba(63,159,255,0.8)]" />
              )}
            </button>
          ))}
          <p className="px-4 pb-3 pt-1 font-count text-[10px] text-[#2d4870]">
            Current: {currentLang?.label}
          </p>
        </div>
      )}
    </div>
  );
}
