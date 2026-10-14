import { useEffect, useRef, useState } from 'react';
import { Camera, Check, Copy, Ellipsis, Mail, MessageCircle, Send, Share2 } from 'lucide-react';

import { useI18n } from '../../i18n/index.jsx';
import { radioShareTargets, radioShareText } from '../../data/radioShare';

/**
 * Share, as a menu of apps: WhatsApp, Telegram, Instagram, X, Facebook,
 * LinkedIn, email, copy, and the phone's own share sheet where there is one.
 * Each sends the message and the link - see radioShare.js.
 */

// lucide carries no brand marks, so each app is its colour and a plain glyph.
const MARK = {
  whatsapp: { bg: '#25d366', icon: <MessageCircle size={16} /> },
  telegram: { bg: '#2aabee', icon: <Send size={15} /> },
  instagram: { bg: 'linear-gradient(45deg, #f9ce34, #ee2a7b 55%, #6228d7)', icon: <Camera size={16} /> },
  x: { bg: '#000', text: '𝕏' },
  facebook: { bg: '#1877f2', text: 'f' },
  linkedin: { bg: '#0a66c2', text: 'in' },
  email: { bg: '#5b6478', icon: <Mail size={16} /> },
};

export default function ShareMenu({ headline, className = '', align = 'left' }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const root = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!root.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function flash(message) {
    setNote(message);
    setTimeout(() => setNote(''), 2500);
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(radioShareText(headline));
      flash(t('radio.shareCopied'));
      return true;
    } catch {
      return false;
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title: t('radio.title'), text: radioShareText(headline) });
      setOpen(false);
    } catch { /* dismissed */ }
  }

  const canNative = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <span ref={root} className="bhim-sharemenu">
      <button
        type="button"
        className={className}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Share2 size={14} aria-hidden="true" />
        <span>{note || t('radio.share')}</span>
      </button>

      {open && (
        <div role="menu" className={`bhim-sharemenu-panel ${align === 'right' ? 'is-right' : ''}`}>
          {radioShareTargets(headline).map((target) => {
            const mark = MARK[target.id];
            return (
              <a
                key={target.id}
                role="menuitem"
                href={target.href}
                target={target.id === 'email' ? undefined : '_blank'}
                rel="noopener noreferrer"
                onClick={async (e) => {
                  if (target.copy) {
                    // Instagram has no share page that takes text: copy the
                    // message, then open it for the listener to paste.
                    e.preventDefault();
                    await copyMessage();
                    window.open(target.href, '_blank', 'noopener');
                  }
                  setOpen(false);
                }}
              >
                <span className="bhim-sharemenu-mark" style={{ background: mark.bg }} aria-hidden="true">
                  {mark.icon || mark.text}
                </span>
                <span>{target.label}</span>
                {target.copy && <small>{t('radio.shareCopyFirst')}</small>}
              </a>
            );
          })}
          <button type="button" role="menuitem" onClick={async () => { if (await copyMessage()) setOpen(false); }}>
            <span className="bhim-sharemenu-mark" style={{ background: '#2a3566' }} aria-hidden="true">
              {note ? <Check size={16} /> : <Copy size={15} />}
            </span>
            <span>{t('radio.shareCopy')}</span>
          </button>
          {canNative && (
            <button type="button" role="menuitem" onClick={nativeShare}>
              <span className="bhim-sharemenu-mark" style={{ background: '#2a3566' }} aria-hidden="true">
                <Ellipsis size={16} />
              </span>
              <span>{t('radio.shareMore')}</span>
            </button>
          )}
        </div>
      )}

      <style>{`
        .bhim-sharemenu { position: relative; display: inline-flex; }
        .bhim-sharemenu-panel {
          position: absolute; top: calc(100% + 8px); left: 0; z-index: 30;
          width: 240px; max-width: calc(100vw - 32px);
          display: grid; padding: 6px;
          background: #0d1333; border: 1px solid #2a3566; border-radius: 12px;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
        }
        .bhim-sharemenu-panel.is-right { left: auto; right: 0; }
        .bhim-sharemenu-panel a, .bhim-sharemenu-panel button {
          display: flex; align-items: center; gap: 12px; width: 100%;
          padding: 8px 10px; border: 0; border-radius: 8px; background: transparent;
          color: #e5e7eb; text-decoration: none; text-align: left; cursor: pointer;
          font: 500 14px/1.2 var(--font-body, Inter), system-ui, sans-serif;
          letter-spacing: 0; text-transform: none;
        }
        .bhim-sharemenu-panel a:hover, .bhim-sharemenu-panel button:hover,
        .bhim-sharemenu-panel a:focus-visible, .bhim-sharemenu-panel button:focus-visible {
          background: #16204a; outline: none;
        }
        .bhim-sharemenu-panel small { margin-left: auto; color: #8b94b8; font-size: 11px; }
        .bhim-sharemenu-mark {
          flex: none; width: 30px; height: 30px; border-radius: 50%;
          display: grid; place-items: center; color: #fff;
          font: 700 15px/1 system-ui, sans-serif;
        }
      `}</style>
    </span>
  );
}
