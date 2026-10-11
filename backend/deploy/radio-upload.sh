#!/usr/bin/env bash
#
# Push today's bulletin to the radio bucket.
#
# Run this on the laptop, from the repo root - it is the one step that needs
# the local files, which is why it is not part of the CloudShell script.
#
#     bash backend/deploy/radio-upload.sh
#
# The bucket is private; CloudFront serves it. See radio-cloudfront-setup.sh,
# which is run once. This one runs after every build.
set -euo pipefail

BUCKET=ambedkargpt-radio
AWS="${AWS:-/c/Program Files/Amazon/AWSCLIV2/aws.exe}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SRC="$HERE/frontend/public/radio"

[ -d "$SRC" ] || { echo "no bulletin at $SRC - build one first" >&2; exit 1; }

echo "uploading $(du -sh "$SRC" | cut -f1) from $SRC"

# A manifest is rewritten every build, so it must not be cached for long; the
# audio never changes once written, so it can be cached for good. CloudFront's
# CachingOptimized policy honours both.
"$AWS" s3 cp "$SRC/" "s3://$BUCKET/" --recursive \
  --exclude "*.json" --cache-control "public, max-age=31536000, immutable"
"$AWS" s3 cp "$SRC/" "s3://$BUCKET/" --recursive \
  --exclude "*" --include "*.json" \
  --content-type "application/json" --cache-control "public, max-age=60"

echo
echo "done. the manifest is only a minute from being live at the edge."
