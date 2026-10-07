import { Radio } from 'lucide-react';

import { useI18n } from '../../i18n/index.jsx';
import { ACCENT, ACCENT_HOVER, INK, MUTED, RULE, R_CTRL, mmss } from './radioTokens';

/* ── pieces both broadcast layouts are built from ─────────────────────────
   Flat surfaces, no radius, 2px rules between regions. The two layouts differ
   in arrangement, not in parts, so everything shared lives here and neither
   layout owns a second copy that can drift from the other.
   ------------------------------------------------------------------------ */

/* ── small label ──────────────────────────────────────────────────────────── */

export function Label({ children, tone = MUTED, className = '' }) {
  // Devanagari is not letter-spaced: the marks sit on the letters and tracking
  // pulls them off. index.css already makes that exception for .dash-eyebrow.
  return (
    <span
      className={`dash-eyebrow ${className}`}
      style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: tone }}
    >
      {children}
    </span>
  );
}

/* ── transcript ───────────────────────────────────────────────────────────── */

/**
 * The words being read, with the current one lit.
 *
 * The manifest carries the narration itself, so this is the text the voice is
 * actually speaking rather than a summary written beside it. There are no word
 * timings in the manifest, so the position is estimated from how far into the
 * story the broadcast is - even spacing, which drifts within a sentence and
 * re-syncs at every story boundary. Good enough to follow, and honest about it
 * by never claiming a word is exact.
 */
export function Transcript({ text, offsetSec, durationSec, listening, size = 23 }) {
  const { t } = useI18n();
  const words = String(text || '').split(/\s+/).filter(Boolean);

  if (!words.length) return null;

  const ratio = durationSec > 0 ? Math.min(Math.max(offsetSec / durationSec, 0), 1) : 0;
  const current = Math.min(words.length - 1, Math.floor(ratio * words.length));

  return (
    <div style={{ opacity: listening ? 1 : 0.55 }}>
      <p
        lang="hi"
        style={{
          fontFamily: 'var(--font-hindi)',
          fontSize: size,
          lineHeight: 1.75,
          margin: 0,
          color: INK,
        }}
      >
        {words.map((word, i) => (
          <span
            key={`${i}-${word}`}
            style={
              i === current
                ? {
                    background: '#1a3a80', color: '#fff',
                    padding: '1px 4px', borderRadius: 5,
                    boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone',
                  }
                : i < current
                  ? { color: INK }
                  : { color: '#5a6789' }
            }
          >
            {word}{' '}
          </span>
        ))}
      </p>
      {!listening && (
        <p style={{ margin: '12px 0 0', fontSize: 12, color: MUTED }}>
          {t('radio.tuneInToHear')}
        </p>
      )}
    </div>
  );
}

/* ── signal meter ─────────────────────────────────────────────────────────── */

/** Twenty-eight bars that move only while sound is coming out. */
export function SignalMeter({ active, bars = 28 }) {
  return (
    <span
      aria-hidden="true"
      style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 26 }}
    >
      {Array.from({ length: bars }, (_, i) => (
        <span
          key={i}
          className={active ? 'bhim-signal-bar' : ''}
          style={{
            width: 3,
            borderRadius: 2,
            height: active ? undefined : 3,
            background: active ? ACCENT_HOVER : RULE,
            animationDelay: `${(i % 7) * 0.13}s`,
          }}
        />
      ))}
    </span>
  );
}

/* ── tune button ──────────────────────────────────────────────────────────── */

export function TuneButton({ listening, onClick, disabled, width = 220, height = 60 }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={listening}
      aria-label={listening ? t('radio.tuneOff') : t('radio.tuneInAria')}
      className="bhim-tune"
      style={{
        width, height,
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '0 22px',
        borderRadius: 14,
        border: listening ? `1px solid ${ACCENT}` : '1px solid transparent',
        background: listening
          ? 'rgba(29,122,252,0.10)'
          : 'linear-gradient(135deg, #1a5fff 0%, #7b3fff 100%)',
        boxShadow: listening ? 'none' : '0 10px 28px rgba(26,95,255,0.32)',
        color: listening ? ACCENT_HOVER : '#fff',
        font: '600 15px/1 var(--font-body, Inter), system-ui, sans-serif',
        letterSpacing: '0.02em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {listening
        ? <span style={{ width: 10, height: 10, borderRadius: 3, background: ACCENT_HOVER, flex: 'none' }} />
        : <Radio size={18} strokeWidth={2.2} style={{ flex: 'none' }} />}
      <span style={{ textAlign: 'left' }}>
        {listening ? t('radio.tuneOff') : t('radio.tuneIn')}
      </span>
    </button>
  );
}

/* ── volume ───────────────────────────────────────────────────────────────── */

export function VolumeControl({ volume, onChange, listening, disabled }) {
  const { t } = useI18n();
  const pct = `${Math.round(volume * 100)}%`;
  return (
    <label
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        opacity: listening ? 1 : 0.4,
        minWidth: 0,
      }}
    >
      <Label>{t('radio.volume')}</Label>
      <input
        type="range"
        min={0} max={1} step={0.01}
        value={volume}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        aria-label={t('radio.volume')}
        style={{
          width: 120, height: 4, appearance: 'none', cursor: 'pointer',
          borderRadius: 999,
          background: `linear-gradient(90deg, ${ACCENT} ${pct}, ${RULE} ${pct})`,
        }}
      />
      <span
        style={{
          font: '500 12px/1 ui-monospace, monospace',
          color: MUTED, fontVariantNumeric: 'tabular-nums', minWidth: 34,
        }}
      >
        {pct}
      </span>
    </label>
  );
}

/* ── status line ──────────────────────────────────────────────────────────── */

export function StatusLine({ listening, nextInSec, progress }) {
  const { t } = useI18n();
  return (
    <div style={{ minWidth: 0, flex: 1 }}>
      <div
        style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          gap: 16, marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 13, color: listening ? INK : MUTED }}>
          {listening ? t('radio.listeningLive') : t('radio.runningTuneIn')}
        </span>
        <span
          style={{
            font: '500 12px/1 ui-monospace, monospace',
            color: MUTED, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
          }}
        >
          {t('radio.nextIn', { time: mmss(nextInSec) })}
        </span>
      </div>
      <div
        style={{ height: 4, background: RULE, borderRadius: 999, overflow: 'hidden' }}
        aria-hidden="true"
      >
        <div style={{ height: '100%', width: `${progress * 100}%`, background: ACCENT }} />
      </div>
    </div>
  );
}
