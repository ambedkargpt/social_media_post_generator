#!/usr/bin/env bash
# Run from dev machine if dist/ already built. Usage: ./08-sync-frontend-dist.sh user@droplet
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TARGET="${1:?Usage: $0 user@droplet_ip}"

rsync -av "$REPO_ROOT/frontend/dist/" "$TARGET:/var/www/ambedkar/"
ssh "$TARGET" 'chown -R www-data:www-data /var/www/ambedkar && chmod -R u=rX,go=rX /var/www/ambedkar'
