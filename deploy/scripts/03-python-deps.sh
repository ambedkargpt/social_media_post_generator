#!/usr/bin/env bash
# Run on the droplet as user ambedkar (or root with sudo -u). Creates venv and installs deps.
set -euo pipefail

AMBEDKAR_USER="${AMBEDKAR_USER:-ambedkar}"
SRV_APP="${SRV_APP:-/srv/ambedkar/app}"
VENV="${VENV:-/srv/ambedkar/venv}"

if [[ "$(id -un)" != "$AMBEDKAR_USER" ]] && [[ "$(id -un)" != "root" ]]; then
  echo "Run as root (script will sudo -u $AMBEDKAR_USER) or as $AMBEDKAR_USER" >&2
  exit 1
fi

run_as() {
  if [[ "$(id -un)" == "root" ]]; then
    sudo -u "$AMBEDKAR_USER" "$@"
  else
    "$@"
  fi
}

if [[ ! -d "$SRV_APP/backend" ]]; then
  echo "ERROR: $SRV_APP/backend not found" >&2
  exit 1
fi

echo "Creating venv at $VENV ..."
if [[ "$(id -un)" == "root" ]]; then
  mkdir -p "$(dirname "$VENV")"
  chown "$AMBEDKAR_USER:$AMBEDKAR_USER" /srv/ambedkar
fi

run_as python3 -m venv "$VENV"
run_as "$VENV/bin/pip" install -U pip
run_as "$VENV/bin/pip" install -r "$SRV_APP/backend/requirements-api.txt"
run_as "$VENV/bin/pip" install -r "$SRV_APP/backend/requirements-worker.txt"

echo "Done. Python: $("$VENV/bin/python" -V)"
