#!/usr/bin/env bash
# Pre-domain: HTTP only, default_server for droplet IP access.
set -euo pipefail

SRV_APP="${SRV_APP:-/srv/ambedkar/app}"
CONF_SRC="$SRV_APP/deploy/nginx/ambedkar-http-ip.conf"
CONF_DST=/etc/nginx/sites-available/ambedkar-http-ip.conf

if [[ ! -f "$CONF_SRC" ]]; then
  echo "ERROR: $CONF_SRC missing" >&2
  exit 1
fi

cp -v "$CONF_SRC" "$CONF_DST"
ln -sfn "$CONF_DST" /etc/nginx/sites-enabled/ambedkar-http-ip.conf
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

nginx -t
systemctl reload nginx
echo "Nginx HTTP site enabled. Place Vite build in /var/www/ambedkar"
