#!/usr/bin/env bash
# Build Vite frontend with API URL for pre-domain (same-origin via Nginx /api).
# Usage: ./build-frontend-for-droplet.sh http://YOUR_DROPLET_IP/api/v1
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
API_URL="${1:?Usage: $0 http://<DROPLET_IP>/api/v1}"

cd "$REPO_ROOT/frontend"
npm ci
VITE_API_URL="$API_URL" npm run build
echo "Output: $REPO_ROOT/frontend/dist"
echo "Sync to droplet: rsync -av \"$REPO_ROOT/frontend/dist/\" root@<IP>:/var/www/ambedkar/"
