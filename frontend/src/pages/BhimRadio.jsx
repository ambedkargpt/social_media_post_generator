import { useEffect, useState } from 'react';
import { Loader2, RotateCw } from 'lucide-react';

import DashboardShell from '../layouts/DashboardShell';
import { useAuth } from '../context/AuthContext';
import { useRadio } from '../context/RadioContext';
import RadioDesk from '../components/radio/RadioDesk';
import RadioTape from '../components/radio/RadioTape';
import { BORDER, INK, INSET, MUTED, mmss } from '../components/radio/radioTokens';
import { useI18n } from '../i18n/index.jsx';

/* ── the station ──────────────────────────────────────────────────────────
   Two layouts over one broadcast. Both are fed from the same derived state
   below, so the only thing that differs between them is arrangement; neither
   can show a different story from the other.
   ------------------------------------------------------------------------ */

const LAYOUT_KEY = 'bhim-radio-layout';

// Accounts that may hold the tape still: play/pause, a scrub that stays put,
// and the segment walk-through. Hard-coded because it is for one demonstration
// and is meant to be deleted after it, which a settings flag quietly would not.
const DEMO_ACCOUNTS = ['krishprakash1232@gmail.com'];

function readLayout() {
  // Per-viewer convenience. Blocked site data throws rather than returning
  // null, and a storage failure must not be why the page will not render.
  try {
    return localStorage.getItem(LAYOUT_KEY) === 'tape' ? 'tape' : 'desk';
  } catch {
    return 'desk';
  }
}

export default function BhimRadioPage() {
  const { t } = useI18n();
  const { currentUser } = useAuth();
  const {
    primeStation, configured,
    station, status, retry,
    tracks, segments, broadcastNow,
    playing, play, pause, toggle,
    position, duration, seek,
    volume, setVolume, muted, toggleMute,
    streamError, setFollowBroadcast,
  } = useRadio();

  const [layout, setLayout] = useState(readLayout);
  const [showDemo, setShowDemo] = useState(false);
  const [now, setNow] = useState(() => new Date());

  // Fetch the manifest. Nothing is torn down on unmount - the listener may
  // navigate away and want the audio to keep running, which is the whole point
  // of the context living above <Routes>.
  useEffect(() => { primeStation(); }, [primeStation]);

  const isDemo = DEMO_ACCOUNTS.includes(String(currentUser?.email || '').toLowerCase());

  // The demo account holds the tape rather than riding the broadcast. Set on
  // the context, not here, because the audio outlives this page.
  useEffect(() => { setFollowBroadcast(!isDemo); }, [isDemo, setFollowBroadcast]);

  // A wall clock for the headers and the tape's labels, on the same beat as
  // the broadcast clock in the context.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 250);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    try { localStorage.setItem(LAYOUT_KEY, layout); } catch { /* not worth failing over */ }
  }, [layout]);

  const onAir = status === 'ready' && Boolean(station);
  const canTune = onAir && !streamError;
  const cycleLength = station?.durationSec || 0;

  // Where the broadcast is. A listener on the clock reads it from the clock; a
  // demonstration reads it from the audio, because it has been stopped
  // somewhere deliberate and the clock would drag it away.
  const at = isDemo ? position : broadcastNow;

  let storyIndex = -1;
  for (let i = tracks.length - 1; i >= 0; i -= 1) {
    if (at >= tracks[i].startSec) { storyIndex = i; break; }
  }
  const story = storyIndex >= 0 ? tracks[storyIndex] : null;
  const storyStart = story?.startSec ?? 0;
  const storyEnd = story?.endSec ?? cycleLength;
  const storyDuration = Math.max(1, storyEnd - storyStart);
  const offsetInStory = Math.min(Math.max(at - storyStart, 0), storyDuration);
  const progress = offsetInStory / storyDuration;

  // Before the first story the clock is in the opening music, so the next
  // thing on air is story one rather than "the rest of this story".
  const nextInSec = storyIndex < 0
    ? Math.max(0, (tracks[0]?.startSec ?? 0) - at)
    : storyDuration - offsetInStory;

  // The running order: what just aired, what is on now, and what is coming.
  const upcoming = [];
  if (tracks.length) {
    for (let k = -1; k <= 9; k += 1) {
      const i = storyIndex + k;
      if (i < 0 || i >= tracks.length) continue;
      upcoming.push({
        track: tracks[i],
        state: k < 0 ? 'aired' : k === 0 ? 'onair' : 'next',
        at: new Date(now.getTime() + (tracks[i].startSec - at) * 1000),
      });
    }
  }

  const shared = {
    // storyIndex stays as it is, -1 and all: clamping it here while leaving
    // `story` null is what made the tape read startSec off nothing. The two
    // describe the same thing and have to agree.
    now, story, storyIndex, total: tracks.length,
    offsetInStory, storyDuration, cycleLength, elapsed: at,
    listening: playing, canTune, nextInSec, progress,
    volume: muted ? 0 : volume,
    onVolume: (v) => { if (muted && v > 0) toggleMute(); setVolume(v); },
    onTune: () => (playing ? pause() : play()),
  };

  return (
    <DashboardShell active="radio">
      <div className="bhim-station">

        {/* ── layout toggle ──
            Both layouts ship so they can be compared in production before one
            is chosen. It is a view preference, not a setting, so it is kept in
            the browser and never sent anywhere. */}
        <div className="bhim-station-switch">
          {['desk', 'tape'].map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setLayout(id)}
              aria-pressed={layout === id}
              style={{
                padding: '7px 16px',
                borderRadius: 999,
                border: `1px solid ${layout === id ? 'transparent' : BORDER}`,
                background: layout === id
                  ? 'linear-gradient(135deg, #1a5fff 0%, #7b3fff 100%)'
                  : 'rgba(255,255,255,0.022)',
                color: layout === id ? '#fff' : MUTED,
                boxShadow: layout === id ? '0 6px 18px rgba(26,95,255,0.30)' : 'none',
                font: '600 11px/1 Inter, system-ui, sans-serif',
                letterSpacing: '0.12em', textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              {t(`radio.layout.${id}`)}
            </button>
          ))}

          {isDemo && onAir && (
            <button
              type="button"
              onClick={() => setShowDemo((v) => !v)}
              style={{
                marginLeft: 'auto', padding: '7px 16px', borderRadius: 999,
                border: `1px solid ${BORDER}`,
                background: 'rgba(255,255,255,0.022)', color: '#6b9fff',
                font: '600 11px/1 Inter, system-ui, sans-serif',
                letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer',
              }}
            >
              {showDemo ? t('radio.demoHide') : t('radio.demoShow')}
            </button>
          )}
        </div>

        {/* ── what is on, or why it is not ── */}
        {!onAir ? (
          <div style={{ padding: '48px 0', color: MUTED, display: 'flex', alignItems: 'center', gap: 10 }}>
            {(status === 'idle' || status === 'loading') && (
              <><Loader2 size={16} className="animate-spin" />{t('radio.loading')}</>
            )}
            {!configured && t('radio.empty')}
            {status === 'empty' && t('radio.emptyStation')}
            {status === 'error' && (
              <>
                <span style={{ color: '#ff6b5a' }}>{t('radio.loadFailed')}</span>
                <button
                  type="button"
                  onClick={retry}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    border: `1px solid ${BORDER}`, ...INSET, color: INK,
                    padding: '7px 14px', font: '600 12px/1 Inter, sans-serif', cursor: 'pointer',
                  }}
                >
                  <RotateCw size={12} />{t('radio.retry')}
                </button>
              </>
            )}
          </div>
        ) : layout === 'tape' ? (
          <RadioTape
            {...shared}
            tracks={tracks}
            reduced={window.matchMedia?.('(prefers-reduced-motion: reduce)').matches}
          />
        ) : (
          <RadioDesk {...shared} upcoming={upcoming} clockLabel={
            new Intl.DateTimeFormat('en-IN', {
              timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false,
            }).format(now)
          } />
        )}

        {/* ── the walk-through ──
            Every part of the bulletin, furniture included, so it can be shown
            to somebody a piece at a time. Only for the demo account, and only
            because that account is also off the clock - stepping through a
            broadcast that keeps moving would be unusable. */}
        {isDemo && showDemo && onAir && (
          <div style={{ borderTop: `1px solid ${BORDER}`, padding: '18px 0 0', marginTop: 20 }}>
            <p style={{
              margin: '0 0 12px', font: '600 11px/1 Inter, sans-serif',
              letterSpacing: '0.12em', textTransform: 'uppercase', color: MUTED,
            }}>
              {t('radio.demoTitle')}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              {segments.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => seek(s.startSec)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    border: `1px solid ${BORDER}`, ...INSET, color: INK,
                    padding: '9px 14px', font: '600 12px/1 Inter, sans-serif', cursor: 'pointer',
                  }}
                >
                  {t(`radio.kind.${s.kind}`)}
                  <span style={{ font: '500 11px/1 ui-monospace, monospace', color: MUTED }}>
                    {mmss(s.startSec)}
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={toggle}
                style={{
                  marginLeft: 8,
                  border: '1px solid transparent', borderRadius: 10, color: '#fff',
                  background: 'linear-gradient(135deg, #1a5fff 0%, #7b3fff 100%)',
                  boxShadow: '0 8px 20px rgba(26,95,255,0.30)',
                  padding: '9px 18px', font: '600 12px/1 Inter, sans-serif', cursor: 'pointer',
                }}
              >
                {playing ? t('radio.pause') : t('radio.play')}
              </button>
              <input
                type="range"
                min={0} max={duration || 0} step={0.5}
                value={Math.min(position, duration || 0)}
                onChange={(e) => seek(Number(e.target.value))}
                aria-label={t('radio.seek')}
                style={{ flex: 1, minWidth: 160, accentColor: '#1d7afc' }}
              />
            </div>
          </div>
        )}
      </div>

      <style>{`
        .bhim-station {
          max-width: 1280px;
          margin-inline: auto;
          padding-inline: 16px;
          padding-block: 24px 40px;
          min-height: 100%;
          display: flex;
          flex-direction: column;
        }
        @media (min-width: 768px) { .bhim-station { padding-inline: 32px; } }
        .bhim-station-switch {
          display: flex; gap: 8px; align-items: center;
          margin-bottom: 20px; flex-wrap: wrap;
        }
        .bhim-station input[type="range"] { accent-color: #1d7afc; }
        .bhim-station :focus-visible { outline: 2px solid #1d7afc; outline-offset: 2px; }
      `}</style>
    </DashboardShell>
  );
}
