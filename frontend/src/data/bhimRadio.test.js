// What the player plays, derived from Bheem Radio's manifest.
//
// These three functions decide which story a listener hears when they press
// next, and every way they can be wrong is silent: an off-by-one puts them
// half a sentence into the wrong story, and a bad filter makes the skip
// buttons land on a nine-second station ident.

import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadStation, stationForParty, trackAt } from './bhimRadio';

// A manifest shaped exactly like the one in Bheem Radio's integration guide.
const MANIFEST = {
  version: 1,
  tenant: 'congress',
  date: '2026-10-04',
  lang: 'hi',
  title: 'कांग्रेस बुलेटिन',
  duration_sec: 2410.5,
  audio_key: 'congress/2026-10-04-3716a8dc0a.mp3',
  audio_url: 'https://radio.example.net/congress/2026-10-04-3716a8dc0a.mp3',
  segments: [
    { kind: 'intro', title: 'Station ident', start_sec: 0.0, end_sec: 12.9 },
    { kind: 'headlines', title: 'Headlines', start_sec: 12.9, end_sec: 48.2 },
    { kind: 'story', title: 'First story', story_id: 'news_001', tenant: 'congress',
      start_sec: 48.2, end_sec: 96.4 },
    { kind: 'story', title: 'Second story', story_id: 'news_002', tenant: 'congress',
      start_sec: 96.4, end_sec: 150.0 },
    { kind: 'story', title: 'A General story', story_id: 'news_003', tenant: 'general',
      start_sec: 150.0, end_sec: 200.0 },
    { kind: 'outro', title: 'Sign-off', start_sec: 2380.1, end_sec: 2410.5 },
  ],
};

function mockFetch(body, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('stationForParty', () => {
  it('sends a listener to their own party', () => {
    expect(stationForParty('Indian National Congress (INC)')).toBe('congress');
    expect(stationForParty('Samajwadi Party (SP)')).toBe('samajwadi');
  });

  it('never makes BJP someone\'s own station', () => {
    // BJP is scraped to be answered, not represented. The signup picker does
    // not offer it either, so a stored value naming it must not select it.
    expect(stationForParty('Bharatiya Janata Party (BJP)')).toBe('general');
  });

  it('does not mistake Trinamool Congress for Congress', () => {
    // Substring matching is what resolves the news tenant too, and "Trinamool
    // Congress" contains "congress".
    expect(stationForParty('Trinamool Congress (TMC)')).toBe('general');
  });

  it('falls back to General for no party and for parties we have no corpus for', () => {
    expect(stationForParty('')).toBe('general');
    expect(stationForParty(null)).toBe('general');
    expect(stationForParty('Aam Aadmi Party (AAP)')).toBe('general');
  });
});

describe('loadStation', () => {
  it('keeps only the stories as skippable tracks', async () => {
    mockFetch(MANIFEST);
    const station = await loadStation('congress');

    // The intro, the headline montage and the sign-off are part of the
    // broadcast but not places anyone wants to land on pressing next.
    expect(station.tracks.map((t) => t.title))
      .toEqual(['First story', 'Second story', 'A General story']);
  });

  it('keeps each track\'s offsets into the one file', async () => {
    mockFetch(MANIFEST);
    const station = await loadStation('congress');

    expect(station.audioUrl).toBe(MANIFEST.audio_url);
    expect(station.durationSec).toBe(2410.5);
    expect(station.tracks[1]).toMatchObject({
      id: 'news_002', startSec: 96.4, endSec: 150.0,
    });
    // No per-track source: skipping seeks, it does not load.
    expect(station.tracks[0].src).toBeUndefined();
  });

  it('builds the audio URL from audio_key when audio_url is absent', async () => {
    mockFetch({ ...MANIFEST, audio_url: undefined });
    const station = await loadStation('congress');

    expect(station.audioUrl).toMatch(/congress\/2026-10-04-3716a8dc0a\.mp3$/);
  });

  it('reports nothing on air rather than throwing when there is no manifest', async () => {
    // A party with no news today, or a build that has never run. Both are
    // ordinary, and neither should look like a broken station.
    mockFetch(null, 404);
    expect(await loadStation('samajwadi')).toBeNull();
  });

  it('throws on a server error, so the panel can offer a retry', async () => {
    mockFetch(null, 500);
    await expect(loadStation('congress')).rejects.toThrow(/500/);
  });

  it('survives a manifest with no segments at all', async () => {
    mockFetch({ ...MANIFEST, segments: undefined });
    const station = await loadStation('congress');
    expect(station.tracks).toEqual([]);
  });
});

describe('trackAt', () => {
  const tracks = [
    { startSec: 48.2 }, { startSec: 96.4 }, { startSec: 150.0 },
  ];

  it('is -1 during the intro, before any story has started', () => {
    expect(trackAt(tracks, 0)).toBe(-1);
    expect(trackAt(tracks, 48.1)).toBe(-1);
  });

  it('takes the story whose start has just passed', () => {
    expect(trackAt(tracks, 48.2)).toBe(0);     // exactly on the boundary
    expect(trackAt(tracks, 96.3)).toBe(0);     // a tenth before the next
    expect(trackAt(tracks, 96.4)).toBe(1);
    expect(trackAt(tracks, 149.9)).toBe(1);
  });

  it('stays on the last story through the sign-off', () => {
    // The outro is not a track, so "now playing" holds rather than blanking
    // out for the final thirty seconds.
    expect(trackAt(tracks, 2400)).toBe(2);
  });

  it('is -1 when there are no stories', () => {
    expect(trackAt([], 10)).toBe(-1);
  });
});
