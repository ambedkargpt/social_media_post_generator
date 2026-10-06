import { useEffect, useState } from 'react';
import {
  Loader2,
  Radio,
  RotateCw,
  Signal,
  SignalZero,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';

import DashboardShell from '../layouts/DashboardShell';
import { useAuth } from '../context/AuthContext';
import { useRadio } from '../context/RadioContext';
import { stationArt } from '../data/bhimRadio';
import { useI18n } from '../i18n/index.jsx';

/* ── the station panel ────────────────────────────────────────────────────
   A player with a receiver's manners rather than a drawing of one: a lit
   readout, a speaker grille behind the station mark, and tune in / tune out
   instead of play / pause. Everything else is the product's own dark panel,
   because this screen sits inside the dashboard and should look like it.
   ------------------------------------------------------------------------ */

// Accounts that get the walk-through controls. Hard-coded because it is for
// one demonstration and is meant to be deleted after it, which a settings
// flag quietly would not be.
const DEMO_ACCOUNTS = ['krishprakash1232@gmail.com'];

// The readout. Amber on near-black, the one warm thing on the screen - which
// is the whole nod to a receiver, and the reason it is used nowhere else.
const LCD_BG = '#140d02';
const LCD_INK = '#ffb64d';

function clockTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fillPercent(value, max) {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return '0%';
  return `${Math.min(100, Math.max(0, (value / max) * 100))}%`;
}

/* ── sound bars ───────────────────────────────────────────────────────────── */

function SoundBars({ active }) {
  return (
    <span className="flex h-5 items-end gap-[3px]" aria-hidden="true">
      {[1, 2, 3, 4, 3].map((h, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full"
          style={{
            height: active ? `${h * 5}px` : '4px',
            background: active
              ? 'linear-gradient(180deg, #3f9fff 0%, #7b5cff 100%)'
              : 'rgba(255,255,255,0.12)',
            transition: 'height 0.25s ease',
            animation: active ? `bhim-bar ${0.48 + i * 0.11}s ease-in-out infinite alternate` : 'none',
          }}
        />
      ))}
    </span>
  );
}

/* ── station mark ─────────────────────────────────────────────────────────── */

/**
 * Album art for a bulletin that has none.
 *
 * One generated MP3 carries no artwork, so this stands in: a speaker grille,
 * the station's own mark, and - only while sound is actually coming out -
 * rings leaving the plate. The rings are what say "broadcast" rather than
 * "audio file"; standing rings around a silent plate read as a spinner.
 */
function StationMark({ slug, label, onAir, playing }) {
  return (
    <div className="relative aspect-square w-[128px] shrink-0 sm:w-[150px]">
      {playing && (
        <span aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="bhim-ring absolute inset-0 rounded-[26px] border border-[#3f9fff]/40"
              style={{ animationDelay: `${i * 1.1}s` }}
            />
          ))}
        </span>
      )}

      <div
        className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[26px] border border-[#1c2a50]/80"
        style={{
          background:
            'radial-gradient(circle at 50% 36%, rgba(63,127,255,0.16) 0%, rgba(10,16,44,0.96) 58%, rgba(5,8,26,0.99) 100%)',
          boxShadow: playing
            ? '0 0 0 1px rgba(63,127,255,0.16), 0 16px 44px rgba(26,95,255,0.22)'
            : '0 0 0 1px rgba(63,127,255,0.05), 0 16px 40px rgba(2,5,18,0.6)',
          transition: 'box-shadow 0.5s ease',
        }}
      >
        {/* The grille: concentric perforations, the way a speaker is drilled. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.22]"
          style={{
            backgroundImage:
              'repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,0.14) 0px, rgba(255,255,255,0.14) 1px, transparent 1px, transparent 7px)',
          }}
        />
        <img
          src={stationArt(slug)}
          alt={label}
          className="relative w-[52%] object-contain transition-all duration-500"
          style={{
            filter: onAir
              ? 'drop-shadow(0 6px 20px rgba(0,0,0,0.55))'
              : 'grayscale(1) drop-shadow(0 6px 16px rgba(0,0,0,0.5))',
            opacity: onAir ? 1 : 0.42,
          }}
          loading="lazy"
          decoding="async"
        />
      </div>
    </div>
  );
}

/* ── page ─────────────────────────────────────────────────────────────────── */

export default function BhimRadioPage() {
  const { t } = useI18n();
  const { currentUser } = useAuth();
  const {
    primeStation,
    configured,
    tenant,
    station, status, retry,
    tracks, segments, track, index,
    playing, toggle, next, previous,
    position, duration, seek,
    volume, setVolume,
    muted, toggleMute,
    streamError,
    setFollowBroadcast,
  } = useRadio();

  // Fetch the manifest. Nothing is torn down on unmount — the listener may
  // navigate away and want the audio to keep running, which is the whole
  // point of the context living above <Routes>.
  useEffect(() => { primeStation(); }, [primeStation]);

  const [showDemo, setShowDemo] = useState(false);

  const onAir = status === 'ready' && Boolean(station);
  const canInteract = onAir && !streamError;
  const scrubMax = duration > 0 ? duration : 0;
  const shownVolume = muted ? 0 : volume;
  const isDemo = DEMO_ACCOUNTS.includes(String(currentUser?.email || '').toLowerCase());
  const stationLabel = t(`radio.station${tenant.charAt(0).toUpperCase()}${tenant.slice(1)}`);

  // The demo account holds the tape rather than riding the broadcast: stop
  // and carry on from the same second, and a scrub while stopped stays put.
  // Set on the context, not kept here, because the audio outlives this page -
  // stepping away mid-demonstration must not put them back on the clock.
  useEffect(() => { setFollowBroadcast(!isDemo); }, [isDemo, setFollowBroadcast]);

  return (
    <DashboardShell active="radio">
      <style>{`
        @keyframes bhim-bar {
          from { transform: scaleY(0.55); }
          to   { transform: scaleY(1.45); }
        }
        @keyframes bhim-ring {
          0%   { transform: scale(1);    opacity: 0.55; }
          100% { transform: scale(1.34); opacity: 0;    }
        }
        .bhim-ring { animation: bhim-ring 3.3s ease-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .bhim-ring { animation: none; opacity: 0.2; }
        }
      `}</style>

      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 md:px-10">

        {/* ── header ── */}
        <div className="mb-7 flex items-center gap-4">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
            style={{
              background: 'linear-gradient(145deg, #1a5fff 0%, #7b3fff 100%)',
              boxShadow: '0 8px 28px rgba(26,95,255,0.40)',
            }}
          >
            <Radio size={26} strokeWidth={2} className="text-white" />
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold leading-tight text-white">
              {t('radio.title')}
            </h1>
            <p className="mt-0.5 text-sm text-[#7b88ad]">{t('radio.tagline')}</p>
          </div>

          <div className="ml-auto">
            {playing ? (
              <span className="flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/12 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-red-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-70 motion-safe:animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                </span>
                {t('ticker.label')}
              </span>
            ) : (
              <span className="flex items-center gap-2 rounded-full border border-[#1c2a50] bg-[#0a1030]/80 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-[#3a4a6a]">
                <span className="h-2 w-2 rounded-full bg-[#1c2540]" />
                {t('radio.standby')}
              </span>
            )}
          </div>
        </div>

        {/* ── the panel ── */}
        <div
          className="rounded-3xl border border-[#1c2a50]/70 p-5 sm:p-7"
          style={{
            background: 'linear-gradient(160deg, rgba(13,20,48,0.98) 0%, rgba(7,10,28,0.99) 100%)',
            boxShadow: '0 0 0 1px rgba(63,127,255,0.07), 0 24px 64px rgba(2,5,18,0.70)',
          }}
        >
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-stretch sm:gap-6">

            <StationMark slug={tenant} label={stationLabel} onAir={onAir} playing={playing} />

            <div className="flex min-w-0 flex-1 flex-col justify-between gap-4">

              {/* ── the readout ── */}
              <div
                className="relative overflow-hidden rounded-xl px-4 py-3"
                style={{
                  background: LCD_BG,
                  boxShadow: 'inset 0 0 0 1px rgba(255,182,77,0.18), inset 0 2px 10px rgba(0,0,0,0.6)',
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className="text-[9.5px] font-black uppercase tracking-[0.18em]"
                    style={{ color: LCD_INK, opacity: 0.8 }}
                  >
                    {stationLabel}
                  </span>
                  <span
                    className="font-mono text-[10px] font-bold"
                    style={{ color: LCD_INK, opacity: 0.6, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {onAir && scrubMax > 0 ? `${clockTime(position)} / ${clockTime(scrubMax)}` : '--:--'}
                  </span>
                </div>

                <p
                  className="mt-1 truncate text-[15px] font-bold"
                  style={{ color: LCD_INK }}
                  title={track?.title || station?.title || ''}
                >
                  {!configured && t('radio.empty')}
                  {configured && (status === 'idle' || status === 'loading') && (
                    <>
                      <Loader2 size={13} className="mr-1.5 inline animate-spin" />
                      {t('radio.loading')}
                    </>
                  )}
                  {configured && status === 'error' && t('radio.loadFailed')}
                  {configured && status === 'empty' && t('radio.emptyStation')}
                  {onAir && (streamError
                    ? t('radio.trackFailed')
                    : (track?.title || station.title || t('radio.title')))}
                </p>

                {onAir && !streamError && tracks.length > 0 && (
                  <p
                    className="mt-0.5 text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: LCD_INK, opacity: 0.55 }}
                  >
                    {t('radio.trackOf', { n: Math.max(index + 1, 1), total: tracks.length })}
                  </p>
                )}

                {/* A single highlight, so the readout reads as glass. */}
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{ background: 'linear-gradient(128deg, rgba(255,255,255,0.07) 0%, transparent 42%)' }}
                />
              </div>

              {status === 'error' && (
                <button
                  type="button"
                  onClick={retry}
                  className="flex items-center gap-1.5 self-start rounded-lg border border-[#2a3a6a] bg-[#101a3c] px-2.5 py-1.5 text-[12px] font-semibold text-[#6b9fff] transition hover:bg-[#16204a]"
                >
                  <RotateCw size={12} strokeWidth={2.2} />
                  {t('radio.retry')}
                </button>
              )}

              {/* ── level, and what the signal is doing ── */}
              <div className="flex items-center gap-3">
                <SoundBars active={playing} />
                <div className="h-px flex-1 bg-[#1c2a50]" />
                <span className="shrink-0">
                  {playing
                    ? <Signal size={18} strokeWidth={1.8} className="text-[#3f9fff]" />
                    : status === 'loading'
                      ? <Loader2 size={17} className="animate-spin text-[#2a3a5a]" />
                      : <SignalZero size={18} strokeWidth={1.8} className="text-[#1c2a4a]" />}
                </span>
              </div>
            </div>
          </div>

          {/* ── tune in / out ──
              Real radio has no play/pause - you tune in or tune out. Once in,
              it plays continuously; you can move between stories but the
              broadcast itself never pauses the way a podcast track would. */}
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={toggle}
              disabled={!canInteract}
              className="flex items-center gap-3 rounded-2xl px-10 py-4 text-[15px] font-bold text-white transition-all duration-300 hover:-translate-y-0.5 hover:brightness-110 disabled:pointer-events-none disabled:opacity-40"
              style={{
                background: 'linear-gradient(135deg, #1a5fff 0%, #7b3fff 100%)',
                boxShadow: '0 10px 30px rgba(26,95,255,0.35)',
              }}
            >
              <Radio size={17} strokeWidth={2.2} />
              {isDemo
                ? (playing ? t('radio.pause') : t('radio.play'))
                : (playing ? t('radio.tuneOut') : t('radio.tuneIn'))}
            </button>
          </div>

          {/* ── the dial ── */}
          <div className="mt-6">
            <label className="block">
              <span className="sr-only">{t('radio.seek')}</span>
              <input
                type="range"
                min={0}
                max={scrubMax}
                step={0.5}
                value={Math.min(position, scrubMax)}
                onChange={(e) => seek(Number(e.target.value))}
                disabled={!canInteract}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full disabled:opacity-40"
                style={{
                  background: `linear-gradient(90deg, #3f9fff ${fillPercent(position, scrubMax)}, #1c2a50 ${fillPercent(position, scrubMax)})`,
                }}
              />
            </label>

            <div className="mt-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={previous}
                  disabled={!canInteract}
                  aria-label={t('radio.previous')}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#1c2a50] bg-[#0b1230] text-[#8fb3ff] transition hover:bg-[#121b44] disabled:pointer-events-none disabled:opacity-35"
                >
                  <SkipBack size={15} strokeWidth={2.3} />
                </button>
                <button
                  type="button"
                  onClick={next}
                  disabled={!canInteract}
                  aria-label={t('radio.next')}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#1c2a50] bg-[#0b1230] text-[#8fb3ff] transition hover:bg-[#121b44] disabled:pointer-events-none disabled:opacity-35"
                >
                  <SkipForward size={15} strokeWidth={2.3} />
                </button>
              </div>

              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <button
                  type="button"
                  onClick={toggleMute}
                  disabled={!onAir}
                  aria-label={muted ? t('radio.unmute') : t('radio.mute')}
                  className="shrink-0 text-[#5a6a90] transition hover:text-[#8fb3ff] disabled:opacity-35"
                >
                  {muted ? <VolumeX size={16} strokeWidth={2} /> : <Volume2 size={16} strokeWidth={2} />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={shownVolume}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (muted && v > 0) toggleMute();
                    setVolume(v);
                  }}
                  disabled={!onAir}
                  aria-label={t('radio.volume')}
                  className="h-1 w-full max-w-[150px] cursor-pointer appearance-none rounded-full disabled:opacity-40"
                  style={{
                    background: `linear-gradient(90deg, #5a6a90 ${fillPercent(shownVolume, 1)}, #1c2a50 ${fillPercent(shownVolume, 1)})`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* ── presets: one per story, a seek rather than a load ── */}
          {onAir && tracks.length > 0 && (
            <div className="mt-6 border-t border-[#1c2a50] pt-5">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#3a4a6a]">
                  {t('radio.presets')}
                </span>
                {isDemo && (
                  <button
                    type="button"
                    onClick={() => setShowDemo((v) => !v)}
                    className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#6b9fff] underline-offset-2 hover:underline"
                  >
                    {showDemo ? t('radio.demoHide') : t('radio.demoShow')}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {tracks.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => seek(s.startSec)}
                    disabled={!canInteract}
                    title={s.title}
                    className={`h-8 min-w-8 rounded-lg border px-2.5 text-[12px] font-bold transition disabled:pointer-events-none disabled:opacity-35 ${
                      i === index
                        ? 'border-[#3f9fff]/60 bg-[#13265a] text-white'
                        : 'border-[#1c2a50] bg-[#0b1230] text-[#8fb3ff] hover:bg-[#121b44]'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>

              {/* ── the walk-through, for showing how a bulletin is built ── */}
              {isDemo && showDemo && (
                <div className="mt-4 rounded-xl border border-[#1c2a50] bg-[#070c20]/70 p-3">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#3a4a6a]">
                    {t('radio.demoTitle')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {segments.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => seek(s.startSec)}
                        disabled={!canInteract}
                        title={s.title || s.kind}
                        className="flex items-center gap-1.5 rounded-lg border border-[#1c2a50] bg-[#0b1230] px-2.5 py-1.5 text-[11px] font-semibold text-[#8fb3ff] transition hover:bg-[#121b44] disabled:pointer-events-none disabled:opacity-35"
                      >
                        {t(`radio.kind.${s.kind}`)}
                        <span className="font-mono text-[10px] opacity-55">{clockTime(s.startSec)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
