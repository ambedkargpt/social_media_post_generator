#!/usr/bin/env bash
# Run on the droplet as root. Stops legacy units and moves /opt/ambedkar/app/semrag → /srv/ambedkar/app
set -euo pipefail

AMBEDKAR_USER="${AMBEDKAR_USER:-ambedkar}"
OPT_APP="${OPT_APP:-/opt/ambedkar/app/semrag}"
SRV_APP="${SRV_APP:-/srv/ambedkar/app}"

echo "Stopping known unit names (ignore errors if absent)..."
systemctl stop ambedkar-api.service 2>/dev/null || true
systemctl disable ambedkar-api.service 2>/dev/null || true

if [[ -d "$SRV_APP" ]] && [[ -n "$(ls -A "$SRV_APP" 2>/dev/null)" ]]; then
  echo "ERROR: $SRV_APP already exists and is non-empty. Move it aside or set SRV_APP." >&2
  exit 1
fi

if [[ ! -d "$OPT_APP" ]]; then
  echo "No $OPT_APP — skip rsync; clone fresh into $SRV_APP instead:"
  echo "  sudo -u $AMBEDKAR_USER git clone <REPO_URL> $SRV_APP"
  exit 0
fi

mkdir -p "$(dirname "$SRV_APP")"
echo "Rsync $OPT_APP → $SRV_APP ..."
rsync -a "$OPT_APP/" "$SRV_APP/"
chown -R "$AMBEDKAR_USER:$AMBEDKAR_USER" "$SRV_APP"

echo "Migrate env if needed:"
echo "  sudo cp /opt/ambedkar/env/api.env /etc/ambedkar/api.env   # merge/edit"
echo "  sudo chmod 600 /etc/ambedkar/api.env"
echo "Optional: remove old tree after verification: rm -rf /opt/ambedkar/app"
