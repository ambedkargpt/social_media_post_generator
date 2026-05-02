#!/usr/bin/env bash
# After copying artifact files into BUILD_DIR, promote to /data/artifacts/current.
# Usage: sudo -u ambedkar BUILD_DIR=/data/artifacts/builds/v0-bootstrap ./04-bootstrap-promote.sh
set -euo pipefail

AMBEDKAR_USER="${AMBEDKAR_USER:-ambedkar}"
SRV_APP="${SRV_APP:-/srv/ambedkar/app}"
VENV="${VENV:-/srv/ambedkar/venv}"
BUILD_DIR="${BUILD_DIR:-/data/artifacts/builds/v0-bootstrap}"

if [[ ! -d "$BUILD_DIR" ]]; then
  echo "ERROR: BUILD_DIR=$BUILD_DIR does not exist" >&2
  echo "Seed it first (from dev machine), e.g. rsync faiss_index.bin argument_chunks.json ... to $BUILD_DIR/" >&2
  exit 1
fi

cmd=(sudo -u "$AMBEDKAR_USER" bash -c "cd '$SRV_APP' && PYTHONPATH='$SRV_APP' '$VENV/bin/python' -m backend.worker.promote_artifact --from '$BUILD_DIR'")

echo "Running: ${cmd[*]}"
"${cmd[@]}"

echo "Verify: ls -la /data/artifacts/current && test -f /data/artifacts/current/manifest.json"
