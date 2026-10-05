import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useAuth } from './AuthContext';
import { loadStation, radioConfigured, stationForParty, trackAt } from '../data/bhimRadio';
import { trackEvent } from '../analytics/metrics';

/**
 * Bhim Radio's one audio element and everything that knows about it.
 *
 * This sits above <Routes> rather than in a layout or the navbar, and that
 * placement is the point: every public page wraps itself in its own
 * MainLayout, so a player living there would unmount on navigation and the
 * audio would stop mid-sentence. A radio that dies when you open another page
 * is not a radio.
 *
 * What it plays is one file. Bheem Radio builds a single looped MP3 per party
 * per day and a manifest of offsets into it, so "next story" is a seek, not a
 * load: the audio never stops, and skipping is instant once the file is
 * buffered. That is why there is no per-track `src` anywhere here.
 */

const RadioContext = createContext(null);

const VOLUME_KEY = 'bhim-radio-volume';
// How far into a story "previous" still means "start this one again", the way
// every other player behaves.
const RESTART_WINDOW_SEC = 3;

function readStoredVolume() {
  // Per-viewer convenience only. Private windows and blocked site data make
  // this throw or come back empty, which is not worth an error - it just means
  // this listener starts at full volume.
  try {
    const raw = window.localStorage.getItem(VOLUME_KEY);
    const n = Number(raw);
    return raw !== null && Number.isFinite(n) && n >= 0 && n <= 1 ? n : 1;
  } catch {
    return 1;
  }
}

export function RadioProvider({ children }) {
  const { currentUser } = useAuth();

  const audioRef = useRef(null);
  // Built on mount rather than during render: touching a ref while rendering
  // is not allowed, and an <audio> is a side effect besides.
  const [audioReady, setAudioReady] = useState(false);

  const [open, setOpen] = useState(false);
  const [tenant, setTenantState] = useState('general');
  const [station, setStation] = useState(null);
  // idle | loading | ready | empty | error. `idle` until the panel is first
  // opened: someone who never presses Radio should not pay for the manifest.
  const [status, setStatus] = useState('idle');
  const [playing, setPlaying] = useState(false);
  const [volume, setVolumeState] = useState(readStoredVolume);
  const [muted, setMuted] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [streamError, setStreamError] = useState(false);

  // Follows the signed-in user's party until they choose a station themselves,
  // after which their choice stands - switching party mid-session is not a
  // reason to yank the stream they are listening to.
  const chosen = useRef(false);
  useEffect(() => {
    if (chosen.current) return;
    setTenantState(stationForParty(currentUser?.political_party));
  }, [currentUser?.political_party]);

  const setTenant = useCallback((next) => {
    chosen.current = true;
    setTenantState(next);
  }, []);

  // Memoised because the `?? []` would otherwise hand out a new array on
  // every render, which would make the context value new every render too
  // and re-render every listener of it for nothing.
  const tracks = useMemo(() => station?.tracks ?? [], [station]);
  const index = trackAt(tracks, position);
  const track = index >= 0 ? tracks[index] : null;

  // ── Load the day's stream ───────────────────────────────────────────────
  const [reloadToken, setReloadToken] = useState(0);
  const retry = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    if (!open || !radioConfigured) return undefined;
    let cancelled = false;
    setStatus('loading');
    loadStation(tenant)
      .then((next) => {
        if (cancelled) return;
        setStation(next);
        setStatus(next && next.tracks.length ? 'ready' : 'empty');
      })
      .catch(() => {
        if (cancelled) return;
        setStation(null);
        setStatus('error');
      });
    return () => { cancelled = true; };
  }, [open, tenant, reloadToken]);

  // ── The element ─────────────────────────────────────────────────────────
  useEffect(() => {
    const el = new Audio();
    el.preload = 'none';
    // One file, played round. The build puts the sign-off at the end and the
    // station ident at the start, so looping reads as a broadcast rather than
    // as a track repeating.
    el.loop = true;
    audioRef.current = el;
    setAudioReady(true);
    return () => { el.pause(); el.src = ''; audioRef.current = null; };
  }, []);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return undefined;
    const onTime = () => setPosition(el.currentTime || 0);
    const onMeta = () => setDuration(Number.isFinite(el.duration) ? el.duration : 0);
    const onPlay = () => { setPlaying(true); setStreamError(false); };
    const onPause = () => setPlaying(false);
    const onError = () => { setPlaying(false); setStreamError(true); };

    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('durationchange', onMeta);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('error', onError);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onMeta);
      el.removeEventListener('durationchange', onMeta);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('error', onError);
    };
  }, [audioReady]);

  // Point the element at the day's file. Only ever runs when the station
  // changes, which is why skipping between stories costs nothing.
  const wantPlay = useRef(false);
  const audioUrl = station?.audioUrl ?? '';
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (!audioUrl) { el.removeAttribute('src'); el.load(); return; }
    el.src = audioUrl;
    el.preload = 'metadata';
    setPosition(0);
    setDuration(station?.durationSec || 0);
    setStreamError(false);
    if (wantPlay.current) {
      // Rejects when the browser refuses playback - autoplay rules, or a file
      // it cannot decode. Either way the element stays paused and state
      // follows it, so the button never lies about what is happening.
      el.play().catch(() => setPlaying(false));
    }
  }, [audioUrl, audioReady]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = audioRef.current;
    if (el) { el.volume = volume; el.muted = muted; }
  }, [volume, muted, audioReady]);

  // ── Controls ────────────────────────────────────────────────────────────
  const play = useCallback(() => {
    const el = audioRef.current;
    if (!el || !el.src) return;
    wantPlay.current = true;
    trackEvent('radio_play', { station: tenant });
    el.play().catch(() => setPlaying(false));
  }, [tenant]);

  const pause = useCallback(() => {
    wantPlay.current = false;
    audioRef.current?.pause();
  }, []);

  const toggle = useCallback(() => { if (playing) pause(); else play(); }, [playing, play, pause]);

  const seek = useCallback((seconds) => {
    const el = audioRef.current;
    if (!el || !Number.isFinite(seconds)) return;
    const limit = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : null;
    const to = Math.max(0, limit ? Math.min(seconds, limit - 0.25) : seconds);
    el.currentTime = to;
    setPosition(to);
  }, []);

  // Skipping is a seek inside the one file, so it is instant and never
  // interrupts playback - there is no new source to buffer.
  const next = useCallback(() => {
    if (!tracks.length) return;
    const to = tracks[Math.min(index + 1, tracks.length - 1)];
    // Past the last story, the outro is still ahead; let it run rather than
    // jumping backwards, which would be a surprising thing for "next" to do.
    if (index >= tracks.length - 1) return;
    seek(to.startSec);
  }, [tracks, index, seek]);

  const previous = useCallback(() => {
    if (!tracks.length) return;
    if (index < 0) { seek(tracks[0].startSec); return; }
    const current = tracks[index];
    const restart = position - current.startSec > RESTART_WINDOW_SEC || index === 0;
    seek(restart ? current.startSec : tracks[index - 1].startSec);
  }, [tracks, index, position, seek]);

  const setVolume = useCallback((v) => {
    const clamped = Math.min(1, Math.max(0, v));
    setVolumeState(clamped);
    // Moving the slider off zero is the clearest possible "unmute me".
    if (clamped > 0) setMuted(false);
    try { window.localStorage.setItem(VOLUME_KEY, String(clamped)); } catch { /* not worth failing over */ }
  }, []);

  const value = useMemo(() => ({
    open, setOpen,
    configured: radioConfigured,
    tenant, setTenant,
    station, status, retry,
    tracks, track, index,
    playing, play, pause, toggle,
    next, previous,
    position, duration, seek,
    volume, setVolume,
    muted, toggleMute: () => setMuted((m) => !m),
    streamError,
  }), [
    open, tenant, setTenant, station, status, retry, tracks, track, index,
    playing, play, pause, toggle, next, previous, position, duration, seek,
    volume, setVolume, muted, streamError,
  ]);

  return <RadioContext.Provider value={value}>{children}</RadioContext.Provider>;
}

export function useRadio() {
  const ctx = useContext(RadioContext);
  if (!ctx) throw new Error('useRadio must be used inside <RadioProvider>');
  return ctx;
}
