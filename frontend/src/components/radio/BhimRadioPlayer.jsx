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
 * Portalled to document.body, not rendered where it is written. The page has
 * transformed ancestors - the curtain, the page transition, several animated
 * sections - and a transform makes its element the containing block for any
 * fixed descendant, so a fixed panel nested inside one of those anchors to
 * that box instead of the viewport. This has bitten the navbar and a landing
 * modal already.
 *
 * Audio state lives in RadioContext, one level above the router. This is only
 * the face of it: closing the panel leaves the station playing, which is what
 * a radio should do.
 */

function clockTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
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

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={t('radio.title')}
    >
      {/* Click-away. A button rather than a div so it is reachable without a
          mouse and announces itself. */}
      <button
        type="button"
        aria-label={t('common.close')}
        onClick={() => setOpen(false)}
        className="absolute inset-0 h-full w-full cursor-default bg-[#03060f]/70 backdrop-blur-sm"
      />

      <div
        className="relative w-full max-w-[480px] rounded-t-2xl border border-[#1e3260]/80 bg-[#080d20] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.6)] sm:rounded-2xl sm:p-6"
        style={{ animation: 'nav-dropdown 180ms ease-out both' }}
      >
        {/* ── Header ── */}
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-[#0a7dff] to-[#3a9fff] shadow-[0_6px_18px_rgba(17,122,255,0.4)]">
              <Radio size={17} strokeWidth={2} className="text-white" />
            </span>
            <div>
              <p className="font-display text-[16px] font-bold leading-tight text-white">
                {t('radio.title')}
              </p>
              <p className="text-[11.5px] leading-tight text-[#7a90b8]">
                {t('radio.tagline')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t('common.close')}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#1e3260]/70 text-[#8b94b8] transition hover:border-[#3f9fff]/50 hover:text-white"
          >
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        {/* ── Now playing ── */}
        <div className="mb-4 min-h-[52px] rounded-xl border border-[#1e3260]/60 bg-[#0a1130]/70 px-4 py-3">
          {status === 'loading' && (
            <p className="flex items-center gap-2 text-[13px] text-[#8b94b8]">
              <Loader2 size={14} className="animate-spin" />
              {t('radio.loading')}
            </p>
          )}

          {status === 'error' && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] text-[#f0a07a]">{t('radio.loadFailed')}</p>
              <button
                type="button"
                onClick={retry}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#3f6bd4]/50 px-2.5 py-1.5 text-[12px] font-medium text-[#7fc8ff] transition hover:border-[#3f9fff] hover:text-white"
              >
                <RotateCw size={12} strokeWidth={2} />
                {t('radio.retry')}
              </button>
            </div>
          )}

          {empty && (
            <p className="text-[13px] leading-relaxed text-[#8b94b8]">
              {t('radio.empty')}
            </p>
          )}

          {track && (
            <>
              <p className="truncate font-count text-[14px] font-semibold text-white" title={track.title}>
                {track.title}
              </p>
              <p className="mt-0.5 truncate text-[12px] text-[#8b94b8]">
                {trackError
                  ? t('radio.trackFailed')
                  : track.artist || t('radio.trackOf', { n: index + 1, total: tracks.length })}
              </p>
            </>
          )}
        </div>

        {/* ── Scrubber ── */}
        <div className="mb-1 flex items-center gap-3">
          <span className="font-count w-9 shrink-0 text-right text-[11px] tabular-nums text-[#7a90b8]">
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
          />
          <span className="font-count w-9 shrink-0 text-[11px] tabular-nums text-[#7a90b8]">
            {clockTime(duration)}
          </span>
        </div>

        {/* ── Transport ── */}
        <div className="mt-4 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={previous}
            disabled={tracks.length < 2}
            aria-label={t('radio.previous')}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#1e3260]/70 text-[#a3b0d4] transition hover:border-[#3f9fff]/60 hover:text-white disabled:pointer-events-none disabled:opacity-35"
          >
            <SkipBack size={17} strokeWidth={2} />
          </button>

          <button
            type="button"
            onClick={toggle}
            disabled={!canPlay}
            aria-label={playing ? t('radio.pause') : t('radio.play')}
            className="btn-gradient flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[0_8px_26px_rgba(17,122,255,0.45)] transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-35"
          >
            {playing
              ? <Pause size={22} strokeWidth={2} fill="currentColor" />
              /* Nudged right: a triangle centred by its bounding box reads as
                 sitting left of centre. */
              : <Play size={22} strokeWidth={2} fill="currentColor" className="ml-0.5" />}
          </button>

          <button
            type="button"
            onClick={next}
            disabled={tracks.length < 2}
            aria-label={t('radio.next')}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#1e3260]/70 text-[#a3b0d4] transition hover:border-[#3f9fff]/60 hover:text-white disabled:pointer-events-none disabled:opacity-35"
          >
            <SkipForward size={17} strokeWidth={2} />
          </button>
        </div>

        {/* ── Volume ── */}
        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? t('radio.unmute') : t('radio.mute')}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#8b94b8] transition hover:text-white"
          >
            {muted || volume === 0
              ? <VolumeX size={16} strokeWidth={2} />
              : <Volume2 size={16} strokeWidth={2} />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={muted ? 0 : volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            aria-label={t('radio.volume')}
            className="radio-range flex-1"
          />
          <span className="font-count w-9 shrink-0 text-right text-[11px] tabular-nums text-[#7a90b8]">
            {Math.round((muted ? 0 : volume) * 100)}%
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
