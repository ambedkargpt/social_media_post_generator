import { useEffect, useState } from 'react';
import { Globe } from 'lucide-react';
import { SITE_LANGUAGES, getSiteLanguage, setSiteLanguage } from '../utils/siteLanguage';
import { markAppReady } from '../utils/appReady';
import { useI18n } from '../i18n/index.jsx';

export default function LanguagePopup({ onDone }) {
  const { t } = useI18n();
  const [selected, setSelected] = useState(getSiteLanguage() || 'hi');
  const [visible, setVisible] = useState(false);

  // Trigger the enter transition on the frame after mount.
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function handleContinue() {
    setSiteLanguage(selected);
    markAppReady();
    onDone?.();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Choose your language"
      className={`fixed inset-0 z-[200] flex items-center justify-center px-4 transition-opacity duration-200 ease-out ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ background: 'rgba(4,8,15,0.88)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className={`w-full max-w-[380px] rounded-3xl border p-7 text-center shadow-[0_24px_60px_rgba(0,0,0,0.55)] transition-all duration-200 ease-out ${
          visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
        }`}
        style={{ borderColor: 'rgba(63,120,220,0.35)', background: 'linear-gradient(180deg,#0d1531 0%,#080e22 100%)' }}
      >
        <div
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: 'rgba(63,120,220,0.15)' }}
        >
          <Globe size={20} strokeWidth={1.9} className="text-[#6aa8ff]" />
        </div>

        <h2 className="font-display text-[20px] font-bold text-white">Choose your language</h2>
        <p className="mt-1.5 font-count text-[13px] text-[#7b90c0]">
          You can change this anytime from settings
        </p>

        <div className="mt-6 flex flex-col gap-2.5">
          {SITE_LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => setSelected(lang.code)}
              aria-pressed={selected === lang.code}
              className="flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left font-count text-[14.5px] font-medium transition"
              style={{
                borderColor: selected === lang.code ? 'rgba(63,159,255,0.7)' : 'rgba(63,120,220,0.25)',
                background: selected === lang.code ? 'rgba(63,120,220,0.18)' : 'rgba(255,255,255,0.02)',
                color: selected === lang.code ? '#ffffff' : '#9ec4f5',
              }}
            >
              {lang.label}
              {selected === lang.code && (
                <span className="h-2 w-2 rounded-full bg-[#3f9fff] shadow-[0_0_8px_rgba(63,159,255,0.8)]" />
              )}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleContinue}
          className="group mt-7 inline-flex w-full items-center justify-center gap-2.5 rounded-full px-7 py-2.5 font-count text-[14px] font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110"
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
