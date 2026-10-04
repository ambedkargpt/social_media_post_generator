// Where Bhim Radio gets what it plays.
//
// Bheem Radio builds one looped MP3 per party per day and writes a manifest
// beside it. This module turns that manifest into the shape the player wants
// and is the only place that knows the manifest exists.
//
// The base URL is read from the environment rather than written here: the
// files are served from an object store whose host is still being decided
// (CloudFront, S3 directly, or R2 - the player cannot tell the difference, it
// only needs something that answers HTTP with byte ranges). Without the
// variable every call here is a no-op and the panel says nothing is on air,
// which is also what a developer running the site locally should see.

const BASE_URL = (import.meta.env.VITE_RADIO_BASE_URL || '').replace(/\/+$/, '');

export const radioConfigured = Boolean(BASE_URL);

// The four streams Bheem Radio builds. Fixed by its own config
// (`daily_tenants`), so they are written out rather than fetched: one more
// request on page load to learn four strings that have not changed would be a
// poor trade.
export const STATIONS = [
  { slug: 'congress',  labelKey: 'radio.stationCongress' },
  { slug: 'samajwadi', labelKey: 'radio.stationSamajwadi' },
  { slug: 'bjp',       labelKey: 'radio.stationBjp' },
  { slug: 'general',   labelKey: 'radio.stationGeneral' },
];

/**
 * Which stream to open for a listener, from the party stored on their account.
 *
 * Matched loosely on the stored name, the same way the news feed resolves a
 * tenant. BJP is deliberately not matched: it is scraped to be answered, never
 * to be someone's own party, and the signup picker does not offer it either.
 * Anyone else - no party, or one we hold no corpus for - gets General.
 */
export function stationForParty(partyName) {
  const name = String(partyName || '').toLowerCase();
  if (name.includes('congress') && !name.includes('trinamool')) return 'congress';
  if (name.includes('samajwadi')) return 'samajwadi';
  return 'general';
}

/**
 * The day's stream for one party.
 *
 * Returns null when nothing is on air - no base URL configured, no manifest
 * yet, or a manifest the build never finished. Throws only on a network or
 * parse failure, which the player reports separately so a station that is
 * merely quiet does not look broken.
 */
export async function loadStation(tenant) {
  if (!BASE_URL) return null;

  // `latest.json` is written last by the build and carries a 60-second
  // Cache-Control, so a fresh fetch here is cheap and a failed build leaves
  // yesterday's stream in place rather than an empty station.
  const response = await fetch(`${BASE_URL}/${encodeURIComponent(tenant)}/latest.json`, {
    headers: { Accept: 'application/json' },
  });
  if (response.status === 404 || response.status === 403) return null;  // nothing on air yet
  if (!response.ok) throw new Error(`radio manifest: HTTP ${response.status}`);

  const manifest = await response.json();
  const audioUrl = manifest.audio_url
    || (manifest.audio_key ? `${BASE_URL}/${manifest.audio_key}` : '');
  if (!audioUrl) return null;

  return {
    tenant: manifest.tenant || tenant,
    date: manifest.date || '',
    title: manifest.title || '',
    audioUrl,
    durationSec: Number(manifest.duration_sec) || 0,
    tracks: tracksFrom(manifest),
  };
}

/**
 * The manifest's segments, as things a listener can skip between.
 *
 * Only `story` segments become tracks. The intro, the headline montage and the
 * sign-off are part of the broadcast but not places anyone wants to land when
 * they press next, and a "track" called "intro" lasting nine seconds makes the
 * skip buttons useless.
 *
 * Each track keeps its offsets into the one MP3. Nothing here has its own
 * file: skipping seeks, it does not load.
 */
function tracksFrom(manifest) {
  const segments = Array.isArray(manifest.segments) ? manifest.segments : [];
  return segments
    .filter((s) => s && s.kind === 'story' && Number.isFinite(Number(s.start_sec)))
    .map((s, i) => ({
      id: String(s.story_id || `${manifest.date || 'day'}-${i}`),
      title: String(s.title || '').trim(),
      startSec: Number(s.start_sec),
      endSec: Number.isFinite(Number(s.end_sec)) ? Number(s.end_sec) : null,
      tenant: s.tenant || manifest.tenant || '',
    }));
}

/** The track playing at `seconds`, or -1 before the first story starts. */
export function trackAt(tracks, seconds) {
  for (let i = tracks.length - 1; i >= 0; i -= 1) {
    if (seconds >= tracks[i].startSec) return i;
  }
  return -1;
}
