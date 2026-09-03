# Testing

Be aware of the honest position before you rely on the suite: there is one
backend test file and one end-to-end spec. Both are useful, neither is coverage.
A green CI run means imports resolve, a handful of contracts hold, and the
frontend builds.

## Backend

```bash
pytest backend/tests -c backend/pytest.ini -q
```

Run it from the repository root — the package imports as `backend.*`, so the
root must be on `PYTHONPATH`. `backend/pytest.ini` sets `testpaths = tests` and
registers three markers (`unit`, `integration`, `e2e`) that nothing currently
uses.

`backend/tests/test_smoke_imports.py` is the whole suite: four tests, no external
services, no MongoDB. What it checks is more deliberate than "smoke" suggests —
three of the four exist because something shipped broken:

| Test | Guards |
|---|---|
| `test_worker_paths_resolve` | `backend.worker.paths` imports and `builds_dir()` ends in `builds` |
| `test_manifest_filenames_non_empty` | `argument_chunks.json` is in `ARTIFACT_FILENAMES` and `faiss_index.bin` is **not** — the Pinecone migration, asserted |
| `test_default_profiles_carry_every_profile_field` | Every default profile defines every `PROFILE_FIELDS` entry |
| `test_validation_report_serialises` | `ValidationReport().as_meta()` still emits `passed`, `retried`, `word_count`, `word_limit`, `over_length` |

The last two carry their history in the docstrings, and it is the same history
twice. `get_user_profiles()` already validated its own fields, but nothing in CI
called it, so adding `political_party` to `PROFILE_FIELDS` without adding it to
the ten default profiles shipped a `500` on every generate request. Adding
`word_count` and `word_limit` to `ValidationReport` dropped `retried` out of the
dataclass while `as_meta()` still read it, so every generate request `500`'d
while writing its trace — *after* the post had been written and paid for.

Both were guarded by code that was never executed. That is the useful lesson
from this suite: validation that nothing calls is not validation. New tests are
worth most where the failure mode is a late `500` in a paid path.

## Frontend

```bash
cd frontend && npm run build
```

CI runs the production build and treats a build failure as the test. `npm run
lint` exists but is **not** wired into CI; the header comment in `ci.yml` says
eslint is deferred because the repository has existing lint debt. Expect
findings if you run it.

## End-to-end

```bash
cd frontend && npm run e2e
```

`playwright.config.js` points at `./e2e`, `baseURL` from `FRONTEND_BASE_URL`
(default `http://127.0.0.1:5173`), `fullyParallel: false`, no retries, and
diagnostics only on failure: `trace: 'on-first-retry'`, screenshot and video
retained on failure.

One spec, `frontend/e2e/social-media-generation.spec.js`, and it tests the property that
matters most about generation: it logs in over the API, opens
`/generate/social-media`, clicks **Generate**, and asserts `200` with a
`retrieval_snapshot_id` and `retrieval_reused: false`; then clicks **Regenerate**
and asserts `200` with `retrieval_reused: true` and *the same* snapshot id. That
is the regeneration contract from [GENERATION.md](GENERATION.md) verified
end to end. Both waits allow 90 s, which is realistic for a real generation.

It needs a live stack and credentials:

| Variable | Purpose |
|---|---|
| `E2E_EMAIL` / `E2E_PASSWORD` | A real account; the test calls `test.skip()` when either is unset |
| `E2E_API_BASE_URL` | Backend base, default `http://127.0.0.1:8000/api/v1` |
| `FRONTEND_BASE_URL` | SPA origin, default `http://127.0.0.1:5173` |

Because it skips itself without credentials, `npm run e2e` reports success on a
machine that has never run the backend. Check for `skipped`, not for green.

### The spec seeds the wrong storage

`page.addInitScript` writes `access_token`, `refresh_token` and `user` into
`localStorage`. The app reads `sessionStorage` (`frontend/src/api/sessionStore.js`), and
`frontend/src/main.jsx` calls `purgeLegacySession()` at startup, which deletes those three
keys from `localStorage` specifically. So the seeding cannot authenticate the
page: `ProtectedRoute` finds no user, redirects to `/login`, and the assertion on
`Social Post Generator` fails before either API call happens.

The spec predates the localStorage → sessionStorage move. Fixing it is a
one-line change — `sessionStorage.setItem` in the init script — but it has to be
made deliberately, and the test cannot pass until it is.

## What is not covered

Worth stating plainly, since the gaps are where changes hurt:

- No test exercises a route handler. Auth, ownership `403`s, the `503` grounding
  guard and the `502` empty-content path are all unverified in CI.
- Nothing tests retrieval — RRF fusion arithmetic, the per-video cap, rare-term
  protection and the title bias have no assertions.
- `validate_post` has no case-level tests; only `as_meta()`'s key set is checked.
- Nothing tests tenant isolation, though `backend/scripts/check_isolation.py`
  exists to check it manually.
- The artifact promote/rollback cycle is untested; `paths` and the manifest
  filename list are the only worker code CI touches.

The pieces to build against are already there: `TestClient` over
`backend.main:app` needs no network for the auth and ownership paths, and
retrieval fusion is pure enough to test with fixed candidate lists.
