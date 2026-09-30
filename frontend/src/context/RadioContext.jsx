import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { loadTracks } from '../data/bhimRadioTracks';

/**
 * Bhim Radio's one audio element and everything that knows about it.
 *
 * This sits above <Routes> rather than in a layout or the navbar, and that
 * placement is the point: every public page wraps itself in its own
 * MainLayout, so a player living there would unmount on navigation and the
 * audio would stop mid-sentence. A radio that dies when you open another page
 * is not a radio.
 *
 * One <audio> is created here and reused. Creating one per track leaks
 * elements and loses the volume the listener set.
 */

const RadioContext = createContext(null);

const VOLUME_KEY = 'bhim-radio-volume';

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
  const audioRef = useRef(null);
  // Built on mount rather than during render: touching a ref while rendering
  // is not allowed, and an <audio> is a side effect besides. Everything that
  // uses it either runs from an event or from an effect that lists
  // `audioReady`, so nothing reaches for it before it exists.
  const [audioReady, setAudioReady] = useState(false);

  const [open, setOpen] = useState(false);
  const [tracks, setTracks] = useState([]);
  const [status, setStatus] = useState('loading');   // loading | ready | error
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolumeState] = useState(readStoredVolume);
  const [muted, setMuted] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  // A track whose file will not play. Kept separately from `status` so one bad
  // file does not make the whole station look down.
  const [trackError, setTrackError] = useState(false);

  const track = tracks[index] ?? null;

  const fetchTracks = useCallback(() => {
    let cancelled = false;
    setStatus('loading');
    loadTracks()
      .then((rows) => {
        if (cancelled) return;
        setTracks(Array.isArray(rows) ? rows : []);
        setStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setTracks([]);
        setStatus('error');
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(fetchTracks, [fetchTracks]);

  useEffect(() => {
    const el = new Audio();
    el.preload = 'none';
    audioRef.current = el;
    setAudioReady(true);
    return () => { el.pause(); el.src = ''; audioRef.current = null; };
  }, []);

  // ── Wire the element's events to state ──────────────────────────────────
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return undefined;

    const onTime = () => setPosition(el.currentTime || 0);
    const onMeta = () => setDuration(Number.isFinite(el.duration) ? el.duration : 0);
    const onPlay = () => { setPlaying(true); setTrackError(false); };
    const onPause = () => setPlaying(false);
    const onError = () => { setPlaying(false); setTrackError(true); };
    // Advancing on `ended` rather than on a timer: a timer drifts and fires
    // late on a tab the browser has throttled.
    //
    // A one-track playlist is restarted by hand. Advancing would compute the
    // same index, so `track` would not change, the effect that loads a source
    // would not re-run, and the station would just stop - the one case where
    // wrapping round does nothing.
    const onEnded = () => {
      if (tracks.length <= 1) {
        el.currentTime = 0;
        el.play().catch(() => setPlaying(false));
        return;
      }
      setIndex((i) => (i + 1) % tracks.length);
    };

    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('durationchange', onMeta);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('error', onError);
    el.addEventListener('ended', onEnded);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onMeta);
      el.removeEventListener('durationchange', onMeta);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('error', onError);
      el.removeEventListener('ended', onEnded);
    };
  }, [tracks.length, audioReady]);

  // Point the element at the current track. `wantPlay` carries intent across
  // the source change, so skipping while playing keeps playing and skipping
  // while paused stays paused.
  const wantPlay = useRef(false);
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !track) return;
    el.src = track.src;
    el.preload = 'metadata';
    setPosition(0);
    setDuration(0);
    setTrackError(false);
    if (wantPlay.current) {
      // Rejects when the browser refuses playback - autoplay rules, or a file
      // it cannot decode. Either way the element stays paused and state
      // follows it, so the button never lies about what is happening.
      el.play().catch(() => setPlaying(false));
    }
  }, [track, audioReady]);

  useEffect(() => {
    const el = audioRef.current;
    if (el) { el.volume = volume; el.muted = muted; }
  }, [volume, muted, audioReady]);

  const play = useCallback(() => {
    const el = audioRef.current;
    if (!el || !el.src) return;
    wantPlay.current = true;
    el.play().catch(() => setPlaying(false));
  }, []);

  const pause = useCallback(() => {
    wantPlay.current = false;
    audioRef.current?.pause();
  }, []);

  const toggle = useCallback(() => {
    if (playing) pause(); else play();
  }, [playing, play, pause]);

  const count = tracks.length;
  const skip = useCallback((step) => {
    if (!count) return;
    // Carry the current intent across the change: skipping while playing keeps
    // playing, skipping while paused stays paused.
    wantPlay.current = playing;
    setIndex((i) => (i + step + count) % count);
  }, [count, playing]);

  const next = useCallback(() => skip(1), [skip]);
  const previous = useCallback(() => skip(-1), [skip]);

  const seek = useCallback((seconds) => {
    const el = audioRef.current;
    if (el && Number.isFinite(seconds)) { el.currentTime = seconds; setPosition(seconds); }
  }, []);

  const setVolume = useCallback((v) => {
    const clamped = Math.min(1, Math.max(0, v));
    setVolumeState(clamped);
    // Moving the slider off zero is the clearest possible "unmute me".
    if (clamped > 0) setMuted(false);
    try { window.localStorage.setItem(VOLUME_KEY, String(clamped)); } catch { /* not worth failing over */ }
  }, []);

  const value = useMemo(() => ({
    open, setOpen,
    tracks, status, retry: fetchTracks,
    track, index,
    playing, play, pause, toggle,
    next, previous,
    position, duration, seek,
    volume, setVolume,
    muted, toggleMute: () => setMuted((m) => !m),
    trackError,
  }), [
    open, tracks, status, fetchTracks, track, index, playing, play, pause,
    toggle, next, previous, position, duration, seek, volume, setVolume,
    muted, trackError,
  ]);

  return <RadioContext.Provider value={value}>{children}</RadioContext.Provider>;
}

export function useRadio() {
  const ctx = useContext(RadioContext);
  if (!ctx) throw new Error('useRadio must be used inside <RadioProvider>');
  return ctx;
}
