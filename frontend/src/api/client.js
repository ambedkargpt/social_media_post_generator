import axios from 'axios';
import { clearTokens } from './auth';
import { readSession, writeSession } from './sessionStore';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// Pages a signed-out visitor is entitled to see. A session that expires while
// someone is reading one of these should log them out quietly, not throw them
// at a login screen they did not ask for.
const PUBLIC_PATHS = ['/', '/login', '/signup', '/otp', '/forgot-password', '/reset-password'];

const client = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// ── Attach access token to every request ─────────────────────────────────────
client.interceptors.request.use((config) => {
  const token = readSession('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── On 401: try refresh, then retry original request once ────────────────────
let refreshing = false;
let queue = [];

function flushQueue(error, token = null) {
  queue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  queue = [];
}

client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    if (refreshing) {
      return new Promise((resolve, reject) => {
        queue.push({ resolve, reject });
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`;
        return client(original);
      });
    }

    original._retry = true;
    refreshing = true;

    try {
      const refreshToken = readSession('refresh_token');
      if (!refreshToken) throw new Error('No refresh token');

      const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
        refresh_token: refreshToken,
      });

      const accessToken = data.tokens.access_token;
      const newRefresh  = data.tokens.refresh_token;
      writeSession('access_token', accessToken);
      writeSession('refresh_token', newRefresh);

      flushQueue(null, accessToken);
      original.headers.Authorization = `Bearer ${accessToken}`;
      return client(original);
    } catch (err) {
      flushQueue(err);

      // Clear the whole session, not just the tokens.
      //
      // This removed access_token and refresh_token and left `user` behind, so
      // after the redirect below reloaded the page the app read that user back
      // out of localStorage, believed it was signed in, made another
      // authenticated call, got another 401, and redirected again. Reopening a
      // tab with an expired session produced seven navigations to /login and a
      // page too busy reloading to finish rendering.
      clearTokens();

      // An expired session on a public page is not an error worth hijacking
      // the page for: the visitor asked for the home page and should get it,
      // signed out. Only a protected route has nowhere to fall back to.
      const path = window.location.pathname;
      const isProtected = !PUBLIC_PATHS.some(
        (p) => path === p || path.startsWith(`${p}/`),
      );
      if (isProtected && path !== '/login') {
        window.location.href = '/login';
      }
      return Promise.reject(err);
    } finally {
      refreshing = false;
    }
  }
);

export default client;
