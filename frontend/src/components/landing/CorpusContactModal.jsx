import { useEffect, useState } from 'react';
import { X, Mail, Copy, Check } from 'lucide-react';

const EMAIL = 'smartbhaujan@gmail.com';

/**
 * Contact prompt for the two Dalit Corpus actions.
 *
 * Neither contributing nor buying is self-serve yet, so both routes end in a
 * conversation. The copy names which one was clicked so the reader is not left
 * guessing why a generic contact box appeared.
 */
const COPY = {
  contribute: {
    title: 'Contribute to the Corpus',
    body: 'Send us what you have, whether it is speeches, books, songs, slogans or political writing. Tell us a little about the material and where it came from, and we will take it from there.',
    subject: 'Contributing to Dalit Corpus',
  },
  buy: {
    title: 'Buy the Annotated Corpus',
    body: 'Tell us what you are building and which parts of the corpus you need. We will come back to you with what is available and what it costs.',
    subject: 'Buying the pre-built annotated corpus',
  },
};

export default function CorpusContactModal({ type, onClose }) {
  const content = COPY[type];
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Revert the confirmation so the button does not stay stuck on "Copied".
  useEffect(() => {
    if (!copied) return undefined;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  if (!content) return null;

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(EMAIL);
      setCopied(true);
    } catch {
      // Clipboard is blocked in some browsers and over plain http. The address
      // is on screen either way, so there is nothing useful to report here.
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(3,6,17,0.82)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="corpus-contact-title"
    >
      <div className="relative flex w-full max-w-[520px] flex-col rounded-2xl border border-[#1e3260] bg-[#080e24] shadow-[0_32px_80px_rgba(0,0,0,0.7)]">

        <div className="flex items-center justify-between border-b border-[#1a2c55] px-6 py-4">
          <h2 id="corpus-contact-title" className="font-display text-[20px] font-semibold text-white">
            {content.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#1e3260] text-[#8b94b8] transition hover:border-[#3a6bc4] hover:text-white"
          >
            <X size={15} />
          </button>
        </div>

        <div className="px-6 py-6">
          <p className="text-[14px] leading-relaxed text-[#a6b9d6]">
            {content.body}
          </p>

          <div className="mt-5 flex items-center gap-3 rounded-xl border border-[#1e3260] bg-[#0b1330] px-4 py-3.5">
            <Mail size={17} className="shrink-0 text-[#9dc3ff]" />
            <a
              href={`mailto:${EMAIL}?subject=${encodeURIComponent(content.subject)}`}
              className="min-w-0 flex-1 truncate font-count text-[15px] font-medium text-white underline decoration-[#3a6bc4] underline-offset-4 transition hover:decoration-white"
            >
              {EMAIL}
            </a>
            <button
              type="button"
              onClick={copyEmail}
              aria-label={copied ? 'Email copied' : 'Copy email address'}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#1e3260] text-[#8b94b8] transition hover:border-[#3a6bc4] hover:text-white"
            >
              {copied ? <Check size={14} className="text-[#7ee0a8]" /> : <Copy size={14} />}
            </button>
          </div>

          <a
            href={`mailto:${EMAIL}?subject=${encodeURIComponent(content.subject)}`}
            className="btn-gradient mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl font-count text-[16px] font-semibold text-white"
          >
            Write to us
          </a>
        </div>
      </div>
    </div>
  );
}
