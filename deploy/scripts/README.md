# Deployment scripts (droplet + dev machine)

All `*.sh` scripts are intended for **Linux (Ubuntu on DigitalOcean)** unless noted. Run with `bash` or `chmod +x` first.

| Script | Where | Purpose |
|--------|--------|---------|
| `01-storage-layout.sh` | droplet (root) | `/data/artifacts`, `/data/locks`, `/srv/ambedkar`, `/var/www/ambedkar`, `/etc/ambedkar`; `chown` for `ambedkar` / `www-data` |
| `02-migrate-opt-to-srv.sh` | droplet (root) | Stop old API unit; `rsync` `/opt/ambedkar/app/semrag` → `/srv/ambedkar/app` |
| `03-python-deps.sh` | droplet (root) | Create `/srv/ambedkar/venv`, `pip install` API + worker requirements |
| `04-bootstrap-promote.sh` | droplet (root) | `promote_artifact` from `BUILD_DIR` (default `v0-bootstrap`) |
| `05-install-systemd.sh` | droplet (root) | Copy `ambedkar-*.service`, `gunicorn.conf.py`; `daemon-reload` |
| `06-install-nginx-http.sh` | droplet (root) | HTTP-only Nginx site ([`../nginx/ambedkar-http-ip.conf`](../nginx/ambedkar-http-ip.conf)) |
| `07-smoke-http.sh` | droplet or laptop | `curl` health live/ready; set `BASE_URL` for public IP |
| `08-sync-frontend-dist.sh` | dev machine | `rsync frontend/dist/` to `user@droplet:/var/www/ambedkar/` |
| `build-frontend-for-droplet.sh` | dev machine (bash) | `npm ci` + `VITE_API_URL=... npm run build` |
| `build-frontend-for-droplet.ps1` | dev machine (Windows) | Same as above for PowerShell |

Full narrative order: see [../README.md](../README.md) section **Pre-domain rollout**.
