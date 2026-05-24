# AmbedkarGPT production deployment (DigitalOcean Ubuntu + systemd + Nginx)

Architecture, storage lifecycle, and topology are defined in [`backend/docs/DEPLOYMENT_PLAN.md`](../backend/docs/DEPLOYMENT_PLAN.md). This README is the **executable runbook** for the current repo layout (single droplet or colocated API+worker; split workers reuse the same paths on the worker VM).

This guide targets **one Ubuntu 22.04 droplet** with a **200 GB block volume** mounted at `/data`, **MongoDB Atlas**, optional **Spaces** for artifact backups, and TLS via **Certbot**.

On **Ubuntu 24.04**, use `python3` / `python3-venv` (3.12) instead of `python3.11` for the venv.

## Pre-domain rollout (HTTP / droplet IP, no TLS yet)

Automated sequence (run scripts from the repo on the server after checkout at `/srv/ambedkar/app`):

1. `sudo bash deploy/scripts/01-storage-layout.sh` — dirs + `ambedkar` ownership under `/data` (artifacts, locks, **transcripts**, **logs/jobs**), `/srv/ambedkar`, `/var/www/ambedkar`.
2. `sudo bash deploy/scripts/02-migrate-opt-to-srv.sh` — optional; moves `/opt/ambedkar/app/semrag` → `/srv/ambedkar/app` if present.
3. Install env files: `sudo cp deploy/env/api.env.example /etc/ambedkar/api.env` and `worker.env.example` → `worker.env`; edit secrets; `sudo chmod 600 /etc/ambedkar/*.env`. For IP testing, set `ALLOWED_ORIGINS=http://<DROPLET_IP>`.
3b. **Master transcript on `/data`** (required before worker builds): copy `ravishkumar_all_transcripts.txt` (or your source of truth) to `/data/transcripts/` on the droplet, owned by `ambedkar`, and ensure `TRANSCRIPT_MASTER_PATH` in `worker.env` matches (default in the example: `/data/transcripts/ravishkumar_all_transcripts.txt`). Verify read access: `sudo -u ambedkar test -r /data/transcripts/ravishkumar_all_transcripts.txt && echo OK`.
4. `sudo bash deploy/scripts/03-python-deps.sh` — `/srv/ambedkar/venv` + API + worker Python deps.
5. Seed `/data/artifacts/builds/v0-bootstrap/` with artifact files (see §5), then `sudo BUILD_DIR=/data/artifacts/builds/v0-bootstrap bash deploy/scripts/04-bootstrap-promote.sh`.
6. `sudo bash deploy/scripts/05-install-systemd.sh` then `sudo systemctl start ambedkar-api.service`.
7. `sudo bash deploy/scripts/06-install-nginx-http.sh` — installs [`deploy/nginx/ambedkar-http-ip.conf`](nginx/ambedkar-http-ip.conf) (SPA + `/api/` proxy, no HTTPS redirect).
8. On your laptop: `bash deploy/scripts/build-frontend-for-droplet.sh http://<DROPLET_IP>/api/v1` then `bash deploy/scripts/08-sync-frontend-dist.sh root@<DROPLET_IP>`.
9. `sudo bash deploy/scripts/07-smoke-http.sh` or `BASE_URL=http://<DROPLET_IP> bash deploy/scripts/07-smoke-http.sh`.

Enable `ambedkar-worker.timer` only after `/etc/ambedkar/worker.env` and `TRANSCRIPT_MASTER_PATH` are valid.

## 1. Provision infrastructure

1. Create droplet (e.g. 4 vCPU / 8 GB RAM), Ubuntu 22.04 LTS.
2. Attach block volume, format and mount at `/data` (add `/etc/fstab` entry).
3. Create directories:
   ```bash
   sudo mkdir -p /data/artifacts/builds /data/locks /srv/ambedkar /etc/ambedkar /var/www/ambedkar
   sudo useradd -r -s /bin/bash -d /srv/ambedkar ambedkar || true
   sudo chown -R ambedkar:ambedkar /data/artifacts /data/locks /srv/ambedkar
   ```

## 2. Install system packages

```bash
sudo apt update && sudo apt install -y python3.11 python3.11-venv nginx certbot python3-certbot-nginx git rsync
```

## 3. Application checkout

```bash
sudo -u ambedkar git clone <YOUR_REPO_URL> /srv/ambedkar/app
# Or deploy via CI artifact extract into /srv/ambedkar/app
sudo ln -sf /srv/ambedkar/app /srv/ambedkar/current || true
```

Working directory in systemd units is `/srv/ambedkar`; adjust `WorkingDirectory` if you use `/srv/ambedkar/current`.

Create venv and install API deps:

```bash
sudo -u ambedkar python3.11 -m venv /srv/ambedkar/venv
sudo -u ambedkar /srv/ambedkar/venv/bin/pip install -U pip
sudo -u ambedkar /srv/ambedkar/venv/bin/pip install -r /srv/ambedkar/app/backend/requirements-api.txt
```

Worker host (or same machine with extra packages):

```bash
sudo -u ambedkar /srv/ambedkar/venv/bin/pip install -r /srv/ambedkar/app/backend/requirements-worker.txt
```

## 4. Environment files

**Separation (plan §8):** `api.env` — JWT, Mongo, CORS, paths under **`/data/artifacts/current`** (read-only for retrieval files). `worker.env` — model keys, `ARTIFACTS_ROOT`, locks, transcript path, optional Spaces credentials (writer + promote + backup).

```bash
sudo cp /srv/ambedkar/app/deploy/env/api.env.example /etc/ambedkar/api.env
sudo cp /srv/ambedkar/app/deploy/env/worker.env.example /etc/ambedkar/worker.env
sudo chmod 600 /etc/ambedkar/*.env
```

Edit `/etc/ambedkar/api.env`:

- `ALLOWED_ORIGINS`, `MONGODB_URI`, `JWT_SECRET`, API keys.
- Set **all artifact paths** under `/data/artifacts/current/...` as in the example file.
- Set `ARTIFACTS_ROOT=/data/artifacts` so `/api/v1/health/ready` can load `current/manifest.json`.

Copy Gunicorn config:

```bash
sudo cp /srv/ambedkar/app/deploy/gunicorn.conf.py /etc/ambedkar/gunicorn.conf.py
```

## 5. Bootstrap artifacts (first deploy)

Copy your built files into a version directory, then promote:

```bash
sudo mkdir -p /data/artifacts/builds/v0-bootstrap
sudo rsync -a ./faiss_index.bin ./argument_chunks.json ./video_context.json ./video_title_embeddings.json \
  ./semrag_graph.json ./semrag_chunks.json ./semrag_extraction_cache.json \
  /data/artifacts/builds/v0-bootstrap/
sudo chown -R ambedkar:ambedkar /data/artifacts/builds/v0-bootstrap
sudo -u ambedkar bash -c 'cd /srv/ambedkar/app && PYTHONPATH=/srv/ambedkar/app /srv/ambedkar/venv/bin/python -m backend.worker.promote_artifact --from /data/artifacts/builds/v0-bootstrap'
```

This creates `/data/artifacts/current` → symlink to the bootstrap dir. Generate a manifest on the worker if missing:

```bash
sudo -u ambedkar bash -c 'cd /srv/ambedkar/app && PYTHONPATH=/srv/ambedkar/app /srv/ambedkar/venv/bin/python -m backend.worker.promote_artifact --from /data/artifacts/builds/v0-bootstrap'
```

## 6. systemd units

```bash
sudo cp /srv/ambedkar/app/deploy/systemd/ambedkar-api.service /etc/systemd/system/
sudo cp /srv/ambedkar/app/deploy/systemd/ambedkar-worker.service /etc/systemd/system/
sudo cp /srv/ambedkar/app/deploy/systemd/ambedkar-worker.timer /etc/systemd/system/
```

Ensure `WorkingDirectory` and `ExecStart` paths match your layout. Set `Environment=PYTHONPATH=/srv/ambedkar/app` if the repo lives at `/srv/ambedkar/app`.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now ambedkar-api.service
sudo systemctl enable --now ambedkar-worker.timer
```

## 7. Nginx + TLS

After DNS points at the droplet, switch from the HTTP-only site to TLS:

```bash
sudo rm -f /etc/nginx/sites-enabled/ambedkar-http-ip.conf
sudo cp /srv/ambedkar/app/deploy/nginx/ambedkar.conf /etc/nginx/sites-available/ambedkar
sudo ln -sf /etc/nginx/sites-available/ambedkar /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d app.example.com -d api.example.com
```

Build frontend and sync static files:

```bash
cd frontend && npm ci && npm run build
sudo rsync -a dist/ /var/www/ambedkar/
sudo chown -R www-data:www-data /var/www/ambedkar
```

Set `VITE_API_URL` at build time to your public API URL.

## 8. Smoke tests

```bash
curl -fsS https://api.example.com/api/v1/health/live
curl -fsS https://api.example.com/api/v1/health/ready
```

## 9. Rollback artifacts

```bash
sudo -u ambedkar bash -c 'cd /srv/ambedkar/app && PYTHONPATH=/srv/ambedkar/app /srv/ambedkar/venv/bin/python -m backend.worker.rollback_artifact'
sudo systemctl restart ambedkar-api.service
```

## 10. Operations notes

- **API is read-only** for retrieval files; only the **worker** writes new builds under `/data/artifacts/builds/<version>/` and promotes `current` (plan §7).
- **`systemctl restart ambedkar-worker.service`** runs a **full oneshot build** immediately, not a config reload. To apply `worker.env` without building, edit the file; the next timer run will pick it up. Use `start`/`restart` only when you intend to run a build now.
- After promotion, **restart** `ambedkar-api.service` if you need SEMRAG graph memory cache to reload immediately (optional).
- Enable Spaces backup by filling `S3_*` / `AWS_*` vars in `worker.env`; uploads run after a successful promote (plan §6 cold storage).
- **Two droplets (plan §5 phase 2):** repeat storage layout, venv, `worker.env`, and transcript on the worker host; API droplet does not need `TRANSCRIPT_MASTER_PATH` unless you run builds there.

## Troubleshooting

| Symptom | Check |
|--------|--------|
| 503 on `/ready` | Mongo URI, indexes, artifact files under `current`, manifest |
| CORS errors | `ALLOWED_ORIGINS` includes exact browser origin |
| 429 from OpenAI / DeepSeek | Provider quotas; backoff / upgrade tier |
| Worker fails immediately (`Transcript master not found`) | File exists at `TRANSCRIPT_MASTER_PATH`; `sudo -u ambedkar test -r <path>` |
