#!/usr/bin/env bash
# Install systemd units and gunicorn config from repo (paths: /srv/ambedkar).
set -euo pipefail

mkdir -p /etc/ambedkar

SRV_APP="${SRV_APP:-/srv/ambedkar/app}"

if [[ ! -d "$SRV_APP/deploy/systemd" ]]; then
  echo "ERROR: $SRV_APP/deploy/systemd not found" >&2
  exit 1
fi

cp -v "$SRV_APP/deploy/systemd/ambedkar-api.service" /etc/systemd/system/
cp -v "$SRV_APP/deploy/systemd/ambedkar-worker.service" /etc/systemd/system/
cp -v "$SRV_APP/deploy/systemd/ambedkar-worker.timer" /etc/systemd/system/
cp -v "$SRV_APP/deploy/gunicorn.conf.py" /etc/ambedkar/gunicorn.conf.py
chmod 644 /etc/systemd/system/ambedkar-*.service /etc/systemd/system/ambedkar-*.timer

systemctl daemon-reload
systemctl enable ambedkar-api.service
echo "Start API after /etc/ambedkar/api.env is ready:"
echo "  systemctl start ambedkar-api.service && systemctl status ambedkar-api.service --no-pager"
echo "Enable worker timer only after worker.env + TRANSCRIPT_MASTER_PATH verified:"
echo "  systemctl enable --now ambedkar-worker.timer"
