#!/usr/bin/env bash
# Run on the droplet as root. Creates layout from deploy plan §1.
set -euo pipefail

AMBEDKAR_USER="${AMBEDKAR_USER:-ambedkar}"

echo "[1/1] Creating directories under /data, /srv/ambedkar, /var/www/ambedkar, /etc/ambedkar..."
mkdir -p /data/artifacts/builds /data/locks /var/www/ambedkar /etc/ambedkar /srv/ambedkar

if ! id "$AMBEDKAR_USER" &>/dev/null; then
  echo "Creating system user $AMBEDKAR_USER (home /srv/ambedkar)..."
  useradd -r -s /bin/bash -d /srv/ambedkar "$AMBEDKAR_USER" || true
fi

chown -R "$AMBEDKAR_USER:$AMBEDKAR_USER" /data/artifacts /data/locks /srv/ambedkar
chown -R www-data:www-data /var/www/ambedkar
chmod 755 /var/www/ambedkar

echo "Done. Mount block volume at /data if not already (see DigitalOcean docs + /etc/fstab)."
