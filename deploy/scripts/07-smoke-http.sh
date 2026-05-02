#!/usr/bin/env bash
# Smoke tests against local Nginx (same machine) or pass BASE_URL.
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1}"

echo "GET $BASE_URL/api/v1/health/live"
curl -fsS "$BASE_URL/api/v1/health/live"
echo
echo "GET $BASE_URL/api/v1/health/ready"
curl -fsS "$BASE_URL/api/v1/health/ready"
echo
echo "OK"
