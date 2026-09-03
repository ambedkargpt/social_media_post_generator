# Frontend

A React 19 single-page application built with Vite 8, styled with Tailwind CSS 4
and routed by `react-router-dom` 7. It lives entirely in `frontend/` and talks to
the backend only through `src/api/`.

Paths in this file are relative to `frontend/`.

```bash
cd frontend && npm ci && npm run dev
```

| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server on `http://localhost:5173` |
| `npm run build` | Production bundle into `dist/` |
| `npm run preview` | Serve the built bundle |
| `npm run lint` | ESLint 9 flat config |
| `npm run e2e` | Playwright end-to-end suite (`e2e:headed`, `e2e:ui` variants) |

## Boot sequence

`src/main.jsx` does three things before the first render:

1. `purgeLegacySession()` clears tokens an earlier build left in `localStorage`.
2. Stamps `document.documentElement.lang` from the stored site language, so the
   font rules in CSS apply on the first paint rather than after a swap.
3. Renders `<App />`, then removes the static `#boot` screen from `index.html`
   inside a `requestAnimationFrame` — after paint, so no frame shows neither.

`App.jsx` nests the providers in this order: `ErrorBoundary` →
`GoogleOAuthProvider` → `BrowserRouter` → `CurtainProvider` → `AuthProvider`.

`IntroGate` runs the first-visit splash → language-popup → done sequence, and is
deliberately rendered inside `AuthProvider` so it can skip both for a signed-in
user and wait for `loading` to settle first — otherwise the popup flashes before
auth resolves.

## Routes

Twenty routes plus a catch-all that redirects unknown paths to `/`.

| Public | Protected |
|---|---|
| `/` (Home) | `/profile-setup` |
| `/about` | `/questionnaire` |
| `/solutions` | `/dashboard` |
| `/pricing` | `/generate` (service selection) |
| `/resources` | `/generate/social-media` |
| `/contact` | `/generate/music` |
| `/login` | `/generate/music/:type` |
| `/signup` | `/preferences` |
| `/otp` | `/posts` (history) |
| `/forgot-password` | `/bheembot` |

`ProtectedRoute` renders a spinner while `loading` is true, then redirects to
`/login` if there is no user. Before redirecting it stores the intended path in
`sessionStorage` under `auth_redirect`, so login can return the visitor to where
they were going.

## Code splitting

Only `Home` is in the entry bundle. Every other page is a `React.lazy` chunk
behind a `Suspense` fallback that matches the page background and carries a
spinner — the comment in `App.jsx` records why: a landing-page visitor was
downloading the dashboard, chatbot, post generator and music studio before
anything could paint.

`vite.config.js` names three vendor chunks — `react-vendor` (React, ReactDOM,
react-router), `ui-vendor` (lucide-react), `auth-vendor` (`@react-oauth`) — and
deliberately leaves Leaflet unnamed, because naming a chunk promotes it into the
initial graph and `map-vendor` was being preloaded on every page even after the
map itself became lazy. The React matcher tests for the package directory rather
than any path containing `react`, so `lucide-react` is not swept in.

The dev server sets `Cross-Origin-Opener-Policy: unsafe-none` so the Google
sign-in popup can talk back to the opener.

## API layer

`src/api/client.js` is a single axios instance with `baseURL` from
`VITE_API_URL` (fallback `http://localhost:8000/api/v1`). A request interceptor
attaches `Authorization: Bearer <access_token>`. A response interceptor handles
`401` by refreshing once through `/auth/refresh`, queueing any concurrent
requests behind that single refresh, then replaying the original request.

When the refresh itself fails it calls `clearTokens()` — the whole session, not
just the tokens. The comment records the bug that forced this: clearing only the
tokens left `user` behind, so the post-redirect reload read that user back,
believed it was signed in, and produced seven navigations to `/login`. It also
only redirects when the current path is *not* public: an expired session while
someone reads the home page signs them out quietly instead of throwing them at a
login screen they did not ask for.

| Module | Wraps |
|---|---|
| `auth.js` | signup, phone OTP, verify, login, Google login, resend, `me`, update, logout, token storage |
| `news.js` | `getNews`, `getTenants`, `getNewsById` |
| `posts.js` | create, generate, regenerate, translate, daily quota, list, update, delete |
| `profile.js` | bulk save and read of questionnaire answers |
| `questions.js` | question catalogue (default limit 7) |
| `chat.js` | `sendChatMessage({ message, history, language })` for BheemBot |
| `contact.js` | contact-form submission |
| `client.js` | the axios instance, interceptors and refresh queue |
| `sessionStore.js` | guarded `sessionStorage` accessors |

## Session storage

`sessionStore.js` keeps the session in `sessionStorage`, not `localStorage`, so
closing the tab signs you out; the docstring records that someone on a shared
device reopened the site and reached BheemBot still signed in. Reloads still keep
you signed in. The accepted trade-off is that a second tab starts signed out —
the same property that makes closing the tab work, not a separate bug.

Every accessor is wrapped in `try/catch`, because private windows and browsers
set to block site data throw on access rather than returning `null`, and a
storage failure must never be why someone cannot use the page.

## Auth context

`AuthContext` exposes `currentUser`, `loading` and the auth actions
(`signupWithEmail`, `signupWithPhone`, `loginWithPhone`, `verifyOtp`,
`loginWithEmail`, `loginWithGoogle`, `updateProfile`, `logout`). On mount, if a
token exists it calls `/auth/me` to confirm the token is still good and clears
the session if not.

`friendlyError(err)` maps backend `detail` strings onto messages worth showing a
user, including the two sentinel values the backend returns deliberately:
`google_account` ("this account uses Google Sign-In") and `phone_otp_required`.

`src/firebase.js` is a two-line stub — Firebase auth was replaced by the JWT
backend and the file only exists so older imports keep resolving.

## Shared data modules

`src/utils/` holds the values that two or more screens must agree on:

- `politicalParties.js` — the party list, with an `available` flag. Only
  Congress and Samajwadi have a corpus, graph and role vocabulary, so only those
  two are selectable; the rest stay listed because existing accounts carry those
  names and deleting a row would leave those users with a blank party.
- `partyRoles.js` — party positions, generated from the same source as
  `backend/pipeline/party_roles.py`, which owns what a position does to a post.
- `preferenceQuestions.js` — `CORE_QUESTION_IDS`, the seven preferences that
  shape every post. Shared because the Preferences page and the generator's side
  panel previously hardcoded their own lists and disagreed with the database.
- `parsePost.js` — splits a generated post into headline, body and hashtags,
  handling both the separate-block and inline-hashtag shapes the model emits.
- `siteLanguage.js` — `en`/`hi` site language in `localStorage`.
- `appReady.js` — a pub-sub singleton so animations wait for the splash to end.
- `socialPostGenerator.js` — the client-side template generator kept from the
  prototype; the real posts come from `POST /posts/generate`.

## Components

`src/components/` is flat for cross-cutting pieces (`Navbar`, `Footer`,
`ProtectedRoute`, `ErrorBoundary`, `Spinner`, form inputs, `GoogleButton`) with
subdirectories per surface: `landing/`, `dashboard/`, `generate/`, `about/`,
`forms/` and `ui/` for the reveal-on-scroll and glass-card primitives.

## Environment

Vite inlines `VITE_*` at build time, so a change needs a dev-server restart and
a production rebuild.

| Variable | Notes |
|---|---|
| `VITE_API_URL` | Must include the `/api/v1` suffix — `client.js` appends only the resource path |
| `VITE_GOOGLE_CLIENT_ID` | Must match the backend `GOOGLE_CLIENT_ID` |

`frontend/README.md` still describes the earlier prototype; treat this file as
current.
