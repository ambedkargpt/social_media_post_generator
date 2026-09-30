import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Loader2, Pause, Play, Radio, RotateCw, SkipBack, SkipForward,
  Volume2, VolumeX, X,
} from 'lucide-react';

import { useRadio } from '../../context/RadioContext';
import { useI18n } from '../../i18n/index.jsx';

/**
 * The Bhim Radio panel.
 *
 * Deliberately light where the rest of the app is dark: a pale frosted panel
 * with one blue accent, floated over the dimmed page. It is the only surface
 * in the product that does this, which is the point - the radio is a thing you
 * open on top of what you were doing, not another screen of it.
 *
 * Portalled to document.body, not rendered where it is written. The page has
 * transformed ancestors - the curtain, the page transition, several animated
 * sections - and a transform makes its element the containing block for any
 * fixed descendant, so a fixed panel nested inside one anchors to that box
 * instead of the viewport. This has bitten the navbar and a landing modal.
 *
 * Audio state lives in RadioContext, one level above the router. This is only
 * the face of it: closing the panel leaves the station playing, which is what
 * a radio should do.
 */

// One place for the palette, so a colour is never guessed twice.
const INK = '#102a4d';     // headings and anything that must be read
// Both checked against the panel's darkest area, which is where a pale
// glass surface is least forgiving: #6b809f measured 2.79:1 there and
// #b0442c 4.13:1, so neither was readable enough for body text.
const MUTED = '#4d5d76';   // secondary text, icons at rest - 4.63:1
const DANGER = '#a64029';  // a track or a station that failed - 4.52:1
const ACCENT = '#1d7afc';  // fills, the play button, the icon tile
// The accent as a text colour only reaches 3.66:1 on the pale button it
// sits on, so the one label that uses it gets a darker shade of itself.
const ACCENT_TEXT = '#0367f3';  // 4.53:1

function clockTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Percentage for the slider's filled portion, guarding a zero-length track. */
function fillPercent(value, max) {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return '0%';
  return `${Math.min(100, Math.max(0, (value / max) * 100))}%`;
}

export default function BhimRadioPlayer() {
  const { t } = useI18n();
  const {
    open, setOpen,
    tracks, status, retry,
    track, index,
    playing, toggle, next, previous,
    position, duration, seek,
    volume, setVolume,
    muted, toggleMute,
    trackError,
  } = useRadio();

  // Escape closes the panel. It does not stop playback: the listener asked for
  // the panel to go away, not for the radio to go off.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  if (!open) return null;

  const empty = status === 'ready' && tracks.length === 0;
  const canPlay = Boolean(track) && !trackError;
  const scrubMax = duration > 0 ? duration : 0;
  const shownVolume = muted ? 0 : volume;

  const roundButton =
    'flex items-center justify-center rounded-full border border-[#c3d6ee] bg-white/75 text-[#274b78] shadow-[0_1px_3px_rgba(16,42,77,0.10)] transition hover:bg-white hover:border-[#8fb7e8] hover:text-[#0f2f5c] disabled:pointer-events-none disabled:opacity-40';

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('radio.title')}
    >
      {/* Click-away. A button rather than a div so it is reachable without a
          mouse and announces itself. The scrim stays dark: the page behind is
          dark, and dimming it is what lifts the pale panel off it. */}
      <button
        type="button"
        aria-label={t('common.close')}
        onClick={() => setOpen(false)}
        className="absolute inset-0 h-full w-full cursor-default bg-[#03060f]/65 backdrop-blur-[3px]"
      />

      <div
        className="relative w-full max-w-[460px] rounded-t-[26px] border border-white/60 p-5 sm:rounded-[26px] sm:p-6"
        style={{
          // Frosted, not flat: the blur is what makes it read as glass rather
          // than as a white card dropped on a dark page.
          background: 'linear-gradient(160deg, rgba(247,251,255,0.93) 0%, rgba(226,239,253,0.90) 100%)',
          backdropFilter: 'blur(22px) saturate(140%)',
          WebkitBackdropFilter: 'blur(22px) saturate(140%)',
          boxShadow: '0 24px 70px rgba(4,12,30,0.55), inset 0 1px 0 rgba(255,255,255,0.9)',
          animation: 'nav-dropdown 180ms ease-out both',
        }}
      >
        {/* ── Header ── */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className="flex h-11 w-11 items-center justify-center rounded-[14px]"
              style={{
                background: `linear-gradient(150deg, #3f9bff 0%, ${ACCENT} 100%)`,
                boxShadow: '0 6px 16px rgba(29,122,252,0.38)',
              }}
            >
              <Radio size={20} strokeWidth={2.2} className="text-white" />
            </span>
            <div>
              <p className="font-display text-[17px] font-bold leading-tight" style={{ color: INK }}>
                {t('radio.title')}
              </p>
              <p className="text-[12.5px] leading-tight" style={{ color: MUTED }}>
                {t('radio.tagline')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t('common.close')}
            className={`${roundButton} h-9 w-9 rounded-xl`}
          >
            <X size={16} strokeWidth={2.2} />
          </button>
        </div>

        {/* ── Now playing ── */}
        <div
          className="mb-5 min-h-[56px] rounded-2xl px-4 py-3.5"
          style={{
            background: 'rgba(206,227,250,0.55)',
            border: '1px solid rgba(146,186,235,0.55)',
          }}
        >
          {status === 'loading' && (
            <p className="flex items-center gap-2 text-[13px]" style={{ color: MUTED }}>
              <Loader2 size={14} className="animate-spin" />
              {t('radio.loading')}
            </p>
          )}

          {status === 'error' && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-medium" style={{ color: DANGER }}>
                {t('radio.loadFailed')}
              </p>
              <button
                type="button"
                onClick={retry}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#9dc0ea] bg-white/70 px-2.5 py-1.5 text-[12px] font-semibold transition hover:bg-white"
                style={{ color: ACCENT_TEXT }}
              >
                <RotateCw size={12} strokeWidth={2.2} />
                {t('radio.retry')}
              </button>
            </div>
          )}

          {empty && (
            <p className="text-[13px] leading-relaxed" style={{ color: '#3c5b85' }}>
              {t('radio.empty')}
            </p>
          )}

          {track && (
            <>
              <p
                className="truncate font-count text-[14.5px] font-semibold"
                style={{ color: INK }}
                title={track.title}
              >
                {track.title}
              </p>
              <p className="mt-0.5 truncate text-[12.5px]" style={{ color: trackError ? DANGER : MUTED }}>
                {trackError
                  ? t('radio.trackFailed')
                  : track.artist || t('radio.trackOf', { n: index + 1, total: tracks.length })}
              </p>
            </>
          )}
        </div>

        {/* ── Scrubber ── */}
        <div className="flex items-center gap-3">
          <span
            className="font-count w-9 shrink-0 text-right text-[11.5px] tabular-nums"
            style={{ color: MUTED }}
          >
            {clockTime(position)}
          </span>
          <input
            type="range"
            min={0}
            max={scrubMax || 1}
            step={0.1}
            value={Math.min(position, scrubMax || 1)}
            onChange={(e) => seek(Number(e.target.value))}
            disabled={!canPlay || scrubMax === 0}
            aria-label={t('radio.seek')}
            className="radio-range flex-1"
            style={{ '--radio-fill': fillPercent(position, scrubMax) }}
          />
          <span
            className="font-count w-9 shrink-0 text-[11.5px] tabular-nums"
            style={{ color: MUTED }}
          >
            {clockTime(duration)}
          </span>
        </div>

        {/* ── Transport ── */}
        <div className="mt-5 flex items-center justify-center gap-5">
          <button
            type="button"
            onClick={previous}
            disabled={tracks.length < 2}
            aria-label={t('radio.previous')}
            className={`${roundButton} h-11 w-11`}
          >
            <SkipBack size={18} strokeWidth={2.2} fill="currentColor" />
          </button>

          <button
            type="button"
            onClick={toggle}
            disabled={!canPlay}
            aria-label={playing ? t('radio.pause') : t('radio.play')}
            className="flex h-[62px] w-[62px] items-center justify-center rounded-full text-white transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-40"
            style={{
              background: `linear-gradient(150deg, #3f9bff 0%, ${ACCENT} 100%)`,
              boxShadow: '0 10px 26px rgba(29,122,252,0.45)',
            }}
          >
            {playing
              ? <Pause size={24} strokeWidth={2} fill="currentColor" />
              /* Nudged right: a triangle centred by its bounding box reads as
                 sitting left of centre. */
              : <Play size={24} strokeWidth={2} fill="currentColor" className="ml-1" />}
          </button>

          <button
            type="button"
            onClick={next}
            disabled={tracks.length < 2}
            aria-label={t('radio.next')}
            className={`${roundButton} h-11 w-11`}
          >
            <SkipForward size={18} strokeWidth={2.2} fill="currentColor" />
          </button>
        </div>

        {/* ── Volume ── */}
        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? t('radio.unmute') : t('radio.mute')}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition hover:bg-white/70"
            style={{ color: muted || volume === 0 ? DANGER : MUTED }}
          >
            {muted || volume === 0
              ? <VolumeX size={17} strokeWidth={2.2} />
              : <Volume2 size={17} strokeWidth={2.2} />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={shownVolume}
            onChange={(e) => setVolume(Number(e.target.value))}
            aria-label={t('radio.volume')}
            className="radio-range flex-1"
            style={{ '--radio-fill': fillPercent(shownVolume, 1) }}
          />
          <span
            className="font-count w-10 shrink-0 text-right text-[11.5px] tabular-nums"
            style={{ color: MUTED }}
          >
            {Math.round(shownVolume * 100)}%
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
