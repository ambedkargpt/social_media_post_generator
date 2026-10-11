#!/usr/bin/env bash
#
# Put the radio bulletins behind CloudFront.
#
# Run this in AWS CloudShell (ap-south-1 or anywhere - CloudFront is global).
# The audio itself is uploaded from the laptop first, by radio-upload.sh, which
# is the only step that needs the local files.
#
#     bash radio-cloudfront-setup.sh
#
# The bucket stays private throughout. CloudFront reads it with an Origin
# Access Control and is the only thing allowed to; nobody can reach the bucket
# directly. That is both AWS's own recommendation and the reason this route
# exists: the player needs CORS headers and byte-range requests, and a
# distribution gives both without opening the bucket.
#
# Afterwards, in Vercel:
#     VITE_RADIO_BASE_URL = https://<the domain this prints>
# and redeploy - Vite reads it at build time, not at run time.
set -euo pipefail

BUCKET=ambedkargpt-radio
REGION=ap-south-1

echo "1/5  origin access control"
# Reuse one if it is already there: this script is safe to run twice, and
# create-origin-access-control fails on a duplicate name rather than returning
# the existing one.
OAC=$(aws cloudfront list-origin-access-controls \
  --query "OriginAccessControlList.Items[?Name=='$BUCKET-oac'].Id" --output text 2>/dev/null || true)

if [ -z "$OAC" ] || [ "$OAC" = "None" ]; then
  OAC=$(aws cloudfront create-origin-access-control --origin-access-control-config "{
    \"Name\": \"$BUCKET-oac\",
    \"Description\": \"Bheem Radio bulletins\",
    \"SigningProtocol\": \"sigv4\",
    \"SigningBehavior\": \"always\",
    \"OriginAccessControlOriginType\": \"s3\"
  }" --query 'OriginAccessControl.Id' --output text)
fi
echo "     $OAC"

echo "2/5  policies"
# The cache policy is looked up rather than hard-coded. The IDs are stable,
# but a wrong one fails the distribution create with a message that names
# nothing useful.
CACHE=$(aws cloudfront list-cache-policies --type managed \
  --query "CachePolicyList.Items[?CachePolicy.CachePolicyConfig.Name=='Managed-CachingOptimized'].CachePolicy.Id" \
  --output text)

# CORS is our own policy, not Managed-SimpleCORS. SimpleCORS leaves
# AccessControlAllowMethods empty and does not override the origin, and with
# it attached a real browser request - Origin header present, same URL - came
# back with no Access-Control-Allow-Origin at all. The station showed "could
# not load" while curl on the same file showed 200 and the header.
#
# So: curl is not a browser. It does not enforce CORS and therefore cannot
# confirm it. The check that counts is a cross-origin fetch from a real page,
# which e2e/radio-set.spec.js makes.
CORS=$(aws cloudfront list-response-headers-policies --type custom \
  --query "ResponseHeadersPolicyList.Items[?ResponseHeadersPolicy.ResponseHeadersPolicyConfig.Name=='$BUCKET-cors'].ResponseHeadersPolicy.Id" \
  --output text 2>/dev/null || true)

if [ -z "$CORS" ] || [ "$CORS" = "None" ]; then
  CORS=$(aws cloudfront create-response-headers-policy --response-headers-policy-config "{
    \"Name\": \"$BUCKET-cors\",
    \"Comment\": \"Cross-origin reads of the bulletins, methods and headers spelled out\",
    \"CorsConfig\": {
      \"AccessControlAllowOrigins\": { \"Quantity\": 1, \"Items\": [\"*\"] },
      \"AccessControlAllowHeaders\": { \"Quantity\": 1, \"Items\": [\"*\"] },
      \"AccessControlAllowMethods\": { \"Quantity\": 3, \"Items\": [\"GET\", \"HEAD\", \"OPTIONS\"] },
      \"AccessControlExposeHeaders\": { \"Quantity\": 3, \"Items\": [\"Content-Length\", \"Content-Range\", \"Accept-Ranges\"] },
      \"AccessControlAllowCredentials\": false,
      \"AccessControlMaxAgeSec\": 3600,
      \"OriginOverride\": true
    }
  }" --query 'ResponseHeadersPolicy.Id' --output text)
fi
echo "     cache $CACHE"
echo "     cors  $CORS"

echo "3/5  distribution"
# CachingOptimized forwards no cookies or query strings and honours the
# origin's Cache-Control, which is what the upload sets: a year for the audio,
# a minute for the manifest that is rewritten every build.
DIST_JSON=$(aws cloudfront create-distribution --distribution-config "{
  \"CallerReference\": \"$BUCKET-$(date +%s)\",
  \"Comment\": \"Bheem Radio bulletins\",
  \"Enabled\": true,
  \"PriceClass\": \"PriceClass_200\",
  \"Origins\": {
    \"Quantity\": 1,
    \"Items\": [{
      \"Id\": \"radio-s3\",
      \"DomainName\": \"$BUCKET.s3.$REGION.amazonaws.com\",
      \"OriginAccessControlId\": \"$OAC\",
      \"S3OriginConfig\": { \"OriginAccessIdentity\": \"\" }
    }]
  },
  \"DefaultCacheBehavior\": {
    \"TargetOriginId\": \"radio-s3\",
    \"ViewerProtocolPolicy\": \"redirect-to-https\",
    \"AllowedMethods\": {
      \"Quantity\": 2,
      \"Items\": [\"GET\", \"HEAD\"],
      \"CachedMethods\": { \"Quantity\": 2, \"Items\": [\"GET\", \"HEAD\"] }
    },
    \"Compress\": true,
    \"CachePolicyId\": \"$CACHE\",
    \"ResponseHeadersPolicyId\": \"$CORS\"
  }
}")

DIST_ID=$(echo "$DIST_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin)["Distribution"]["Id"])')
DOMAIN=$(echo "$DIST_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin)["Distribution"]["DomainName"])')
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
echo "     $DIST_ID  $DOMAIN"

echo "4/5  let that distribution, and only it, read the bucket"
# Scoped by SourceArn, so this grants nothing to CloudFront in general - only
# to this one distribution in this one account.
aws s3api put-bucket-policy --bucket "$BUCKET" --policy "{
  \"Version\": \"2012-10-17\",
  \"Statement\": [{
    \"Sid\": \"AllowCloudFrontRead\",
    \"Effect\": \"Allow\",
    \"Principal\": { \"Service\": \"cloudfront.amazonaws.com\" },
    \"Action\": \"s3:GetObject\",
    \"Resource\": \"arn:aws:s3:::$BUCKET/*\",
    \"Condition\": {
      \"StringEquals\": {
        \"AWS:SourceArn\": \"arn:aws:cloudfront::$ACCOUNT:distribution/$DIST_ID\"
      }
    }
  }]
}"

echo "5/5  waiting for the distribution to deploy (5-10 min)"
aws cloudfront wait distribution-deployed --id "$DIST_ID"

echo
echo "done. check it from a browser, not from curl:"
echo "  VITE_RADIO_BASE_URL=https://$DOMAIN npm run dev   # in frontend/"
echo "  npx playwright test e2e/radio-set.spec.js"
echo "(curl does not enforce CORS, so a 200 from curl proves nothing here.)"
echo
echo "then in Vercel:"
echo "  VITE_RADIO_BASE_URL = https://$DOMAIN"
echo "  ...and redeploy."
