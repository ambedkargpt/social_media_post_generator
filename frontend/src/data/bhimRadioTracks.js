// What Bhim Radio plays.
//
// This file is the whole content seam: the player imports nothing else about
// what a track is, so filling this in is the only change needed to put audio
// on air. Nothing here decides how it sounds or looks.
//
// A track is:
//
//   {
//     id:     'ambedkar-1956-conversion',   // stable, unique, never shown
//     title:  'Annihilation of Caste, part 1',
//     artist: 'Dr. B. R. Ambedkar',          // optional, shown under the title
//     src:    '/radio/annihilation-1.mp3',   // any URL the browser can play
//   }
//
// `src` can be a file served from `public/` (put it in `public/radio/` and
// write the path as `/radio/<name>.mp3`, no `public` in the path), or an
// absolute URL to wherever the audio is hosted. Formats: mp3 and m4a play
// everywhere; ogg and opus do not play on Safari.
//
// The order here is the order on air, and the player wraps from the last
// track back to the first.

export const TRACKS = [
  // Empty on purpose: the programming is still being decided. The player
  // handles this and says so rather than looking broken.
  //
  // To go live, delete this comment and list the tracks:
  //
  // { id: 'ep1', title: 'Episode 1', artist: 'Bhim Radio', src: '/radio/ep1.mp3' },
];

/**
 * The playlist, as the player asks for it.
 *
 * Async and wrapped in a function so this can become a fetch later without the
 * player changing: whoever owns the programming can return `TRACKS`, read a
 * manifest, or call an API, and the seam stays one function wide.
 *
 * Rejecting is fine - the player shows its error state and offers a retry.
 */
export async function loadTracks() {
  return TRACKS;
}
