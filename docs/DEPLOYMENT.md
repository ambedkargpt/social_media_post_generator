# Deployment

Two targets are maintained in parallel, and both read the same artifact tree
through a `current` pointer.

| | AWS (primary) | DigitalOcean droplet |
|---|---|---|
| API | Lambda container image via Mangum | gunicorn + uvicorn workers behind nginx |
| Worker | AWS Batch on Fargate | `ambedkar-worker.timer` (systemd oneshot) |
| Artifacts | S3 `s3://ambedkargpt-artifacts/artifacts/` | `/data/artifacts` on a block volume |
| Secrets | SSM Parameter Store under `/ambedkargpt/prod` | `/etc/ambedkar/*.env`, mode `600` |
| Region | `ap-south-1` | — |
| Runbook | this file + the workflows | `deploy/README.md` |

## Container images

`Dockerfile.lambda` builds on `public.ecr.aws/lambda/python:3.11`, installs
`backend/requirements-api.txt` into `${LAMBDA_TASK_ROOT}` and sets the handler to
`backend.main_lambda.handler`. Documented function settings: 1024 MB, 60 s
timeout.

`backend/main_lambda.py` wraps the same FastAPI `app` in Mangum, so routes,
middleware, lifespan hooks and auth behave identically to the gunicorn path. It
also raises the root log level explicitly. The comment records why: the Lambda
runtime leaves the root logger at `WARNING`, so every `logger.info()` in the
codebase was discarded — the `[generate]`, `[retrieval]` and `[research]` lines
that exist precisely to explain a request never reached CloudWatch, and a `503`
was diagnosed from the outside over two days that one of those lines would have
named.

`Dockerfile.worker` builds on `python:3.11-slim-bookworm` (Batch runs a normal
Linux container, not the Lambda runtime) and adds `ffmpeg` for yt-dlp audio
post-processing plus a compiler toolchain for C-extension wheels. It installs
`requirements-worker.txt`, which itself includes `requirements-api.txt`. Runtime
defaults point everything at `/tmp`: `ARTIFACTS_ROOT=/tmp/artifacts`,
`ARTIFACTS_LOCKS_DIR=/tmp/locks`, `TRANSCRIPT_MASTER_PATH=/tmp/data/…`. Default
command is `python -m backend.worker.auto_rebuild`.

## GitHub Actions

| Workflow | Trigger | Does |
|---|---|---|
| `ci.yml` | push/PR to `main`, `master`, `develop`, `dev` | pytest on 3.11; `npm ci && npm run build` on Node 20 |
| `deploy-lambda.yml` | push to `main` | pytest → build → ECR (`:latest` + `:<sha>`) → `update-function-code` → `wait function-updated` → optional smoke test |
| `deploy-worker.yml` | push to `main` | build → ECR → `aws batch register-job-definition` (new revision) |
| `rebuild.yml` | cron `5 2 */2 * *` + manual | submit the Batch job, poll to `SUCCEEDED`/`FAILED`, write the job summary |

All three AWS workflows authenticate with OIDC (`permissions: id-token: write`)
and assume `secrets.AWS_ROLE_ARN` — no static access keys are stored. They also
need `secrets.ECR_REGISTRY`; the smoke test reads the
`vars.LAMBDA_FUNCTION_URL` **variable** and skips itself when it is unset.

The smoke test accepts `200` **or** `503`, deliberately: a fresh Lambda with no
promoted artifacts answers `503` from `/health/ready` and that is not a failed
deploy.

`deploy-worker.yml` keeps the Batch job definition in code — 4 vCPU, 16384 MB
memory, Fargate platform capability, `assignPublicIp: ENABLED`, awslogs to
`/aws/batch/job` — and injects secrets by SSM parameter ARN rather than value.
Registering a revision is non-breaking: jobs already running stay on their
original revision, and the next submission picks up the new one.

### Branch triggers are worth checking before you rely on them

Every workflow above keys off `main`, `master`, `develop` or `dev`. The branch
this team treats as most current is `deploy`, and it appears in none of the
trigger lists. A push to `deploy` therefore runs no tests and deploys nothing;
release happens when those commits reach `main`. If `deploy` is meant to be the
integration branch, add it to `ci.yml` at minimum.

## Droplet deployment

Target described by `deploy/README.md`: one Ubuntu 22.04 droplet (4 vCPU / 8 GB
suggested) with a 200 GB block volume mounted at `/data`, MongoDB Atlas, optional
Spaces for artifact backup, TLS via Certbot. On Ubuntu 24.04 use the system
`python3`/`python3-venv` (3.12) instead of `python3.11`.

Layout:

```
/srv/ambedkar/app        repository checkout
/srv/ambedkar/venv       virtualenv (API deps; + worker deps on a build host)
/etc/ambedkar/           api.env, worker.env, gunicorn.conf.py   (chmod 600)
/data/artifacts/         builds/<version>/ and the current symlink
/data/locks/             flock file for the single-writer build lock
/data/transcripts/       master transcript the worker builds from
/var/www/ambedkar/       the built frontend, owned by www-data
```

`deploy/scripts/` numbers the sequence so it can be run in order:

| Script | Does |
|---|---|
| `01-storage-layout.sh` | Creates the directories above and sets `ambedkar` ownership |
| `02-migrate-opt-to-srv.sh` | Optional move of a legacy `/opt/ambedkar` checkout |
| `03-python-deps.sh` | Builds the venv and installs API + worker requirements |
| `04-bootstrap-promote.sh` | Promotes a seeded `BUILD_DIR` so `current` exists |
| `05-install-systemd.sh` | Installs and enables the units |
| `06-install-nginx-http.sh` | Installs the IP-only HTTP site (no TLS redirect) |
| `07-smoke-http.sh` | Curls `/health/live` and `/health/ready` |
| `08-sync-frontend-dist.sh` | rsyncs a locally built `dist/` to the droplet |

`build-frontend-for-droplet.sh` (and its `.ps1` twin) builds the SPA with
`VITE_API_URL` pointed at the droplet, because Vite inlines that value — the
bundle is environment-specific and cannot be built once and repointed later.

### systemd units

`ambedkar-api.service` is a long-running `Type=simple` unit:
`gunicorn -c /etc/ambedkar/gunicorn.conf.py backend.main:app`, `Restart=on-failure`,
`EnvironmentFile=-/etc/ambedkar/api.env`, `PYTHONPATH=/srv/ambedkar/app`.

`ambedkar-worker.service` is `Type=oneshot` running
`python -m backend.worker.build_artifacts --once`, driven by
`ambedkar-worker.timer` at `OnCalendar=*-*-* 02:30:00` with `Persistent=true` so
a missed window runs on the next boot.

`restart` on the worker unit starts a **full build immediately** — it is not a
config reload. Editing `worker.env` and waiting for the next timer run is how you
apply configuration without building.

### gunicorn

`deploy/gunicorn.conf.py` uses `uvicorn.workers.UvicornWorker`,
`WEB_CONCURRENCY` workers (default `cpu_count * 2 + 1`), and a 600 s timeout
because a generation with retrieval and validation regularly exceeds the 120 s
default. Logs go to stdout/stderr for journald to collect.

### nginx

`deploy/nginx/ambedkar.conf` terminates TLS for `app.example.com` (SPA with
`try_files … /index.html`, `/api/` proxied to `127.0.0.1:8000`) and optionally
`api.example.com` for the API alone. It adds HSTS, `X-Content-Type-Options`,
`X-Frame-Options` and a referrer policy, gzips text responses, and rate-limits
`/api/v1/auth/` to 5 r/s per IP with a burst of 20.

`ambedkar-http-ip.conf` is the pre-DNS variant: same proxy and SPA rules over
plain HTTP on the droplet IP, with no HTTPS redirect.

## Three traps in the droplet path

These are real mismatches between the runbook and the code, not style notes.

**`deploy/env/api.env.example` and `worker.env.example` do not exist.** Step 3
of the runbook and §4 both `cp` from `deploy/env/`, and that directory is absent
from the repository. The copy fails with *No such file or directory*. Build the
two files from `backend/.env.example` instead, splitting them the way §4
describes: `api.env` carries JWT, Mongo, CORS and the read-only artifact paths
under `/data/artifacts/current`; `worker.env` carries the model keys,
`ARTIFACTS_ROOT`, the lock directory, `TRANSCRIPT_MASTER_PATH` and the optional
Spaces credentials.

**`ALLOWED_ORIGINS` is not read by the backend.** The runbook tells you to set
it in three places; `backend/core/http.py:85` reads `CORS_ORIGINS`. Setting
`ALLOWED_ORIGINS` alone leaves CORS unset, which in production means the
middleware logs an error and blocks browser requests. Use `CORS_ORIGINS`.

**nginx gives up at 120 s while gunicorn waits 600 s.** Every `proxy_read_timeout`
in both nginx configs is `120s`, but `GUNICORN_TIMEOUT` defaults to `600`
precisely because generation exceeds two minutes. A long generation therefore
returns `504` to the browser while the worker is still writing the post — and the
post is still persisted, so the user sees a failure for a request that succeeded.
Raise `proxy_read_timeout` on the `/api/` location to match gunicorn before
enabling generation behind nginx.

## Frontend

The SPA is static output; only `VITE_API_URL` and `VITE_GOOGLE_CLIENT_ID` tie it
to an environment, and both are inlined at build time.

```bash
cd frontend && npm ci && VITE_API_URL=https://api.example.com/api/v1 npm run build
```

```bash
sudo rsync -a dist/ /var/www/ambedkar/ && sudo chown -R www-data:www-data /var/www/ambedkar
```

Keep the backend `CORS_ORIGINS` in step with the origin the browser actually
uses, including port and scheme.

## Verifying a deploy

```bash
curl -fsS https://api.example.com/api/v1/health/live
```

```bash
curl -fsS https://api.example.com/api/v1/health/ready
```

`/live` proves the process is up. `/ready` is the one that matters: it names
which of `database_connected`, `indexes_ready` and `artifacts_ready` failed, so a
`503` diagnoses itself. On a fresh environment the usual cause is that no build
has been promoted yet — see [ARTIFACTS.md](ARTIFACTS.md).

| Symptom | Check |
|---|---|
| `503` on `/ready` | Mongo URI, index creation, files under `current`, `manifest.json`, `ARTIFACTS_ROOT` |
| CORS error in the browser | `CORS_ORIGINS` (not `ALLOWED_ORIGINS`) contains the exact origin |
| `504` on `/posts/generate` | nginx `proxy_read_timeout`, not the backend |
| `429` from DeepSeek | Provider quota; back off or raise the tier |
| Worker exits immediately with `Transcript master not found` | `TRANSCRIPT_MASTER_PATH` and `sudo -u ambedkar test -r <path>` |
| API `logger.info` lines missing on Lambda | Root log level — see `backend/main_lambda.py` |

Architecture, storage lifecycle and topology decisions behind all of this are in
`backend/docs/DEPLOYMENT_PLAN.md`.
