/**
 * Whether Bhim Radio sits behind a login.
 *
 * It does not, for now: the station is being shown as a standalone feature, so
 * anyone can open /bhimradio and listen, and a link to it can be shared as a
 * link. When there are enough users to justify an account wall again, set
 * VITE_RADIO_REQUIRES_LOGIN=true in the host's environment and redeploy - Vite
 * reads it at build time, not at run time - and every place that decides this
 * follows: the route goes back inside the dashboard shell and its login
 * guard, the rail gets its radio row back, and the navbar and the live strip
 * send a signed-out visitor to log in first.
 *
 * One switch rather than a few edits, because the wall is made of five
 * separate decisions and putting it back by hand is how one of them gets
 * forgotten.
 */
export const RADIO_REQUIRES_LOGIN = import.meta.env.VITE_RADIO_REQUIRES_LOGIN === 'true';
