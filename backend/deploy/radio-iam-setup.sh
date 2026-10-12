#!/usr/bin/env bash
#
# Let the radio job write its bulletin.
#
# ambedkargpt-worker-role can write to ambedkargpt-artifacts and nothing else.
# The bulletins now live in ambedkargpt-radio, behind CloudFront, so without
# this the Batch job runs, spends the Sarvam money, and fails on the last step.
#
#     bash backend/deploy/radio-iam-setup.sh
#
# Adds two ARNs to the S3 statement of the inline policy and leaves everything
# else in it untouched. Safe to run twice.
set -euo pipefail

ROLE=ambedkargpt-worker-role
POLICY=ambedkargpt-worker-policy
BUCKET=ambedkargpt-radio
AWS="${AWS:-/c/Program Files/Amazon/AWSCLIV2/aws.exe}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Everything below this line hands paths to the Windows aws.exe and to a
# Windows python, neither of which understands Git Bash's /tmp/... form - that
# resolves to <current drive>:	mp\..., which is not where mktemp put it.
# cygpath -m gives C:/Users/... , which both accept.
WORKW="$(cygpath -m "$WORK" 2>/dev/null || echo "$WORK")"

echo "1/3  reading the current policy"
"$AWS" iam get-role-policy --role-name "$ROLE" --policy-name "$POLICY" \
  --query 'PolicyDocument' > "$WORK/policy.json"

echo "2/3  adding $BUCKET to the S3 statement"
python - "$WORKW/policy.json" "$WORKW/new.json" "$BUCKET" <<'PY'
import json, sys

src, dst, bucket = sys.argv[1], sys.argv[2], sys.argv[3]
doc = json.load(open(src))
wanted = [f"arn:aws:s3:::{bucket}", f"arn:aws:s3:::{bucket}/*"]

added = []
for statement in doc["Statement"]:
    actions = statement.get("Action", [])
    if isinstance(actions, str):
        actions = [actions]
    if not any(a.startswith("s3:") for a in actions):
        continue
    # Only the S3 statement is touched, and only by appending - the artifacts
    # bucket keeps every permission it had.
    resources = statement["Resource"]
    if isinstance(resources, str):
        resources = [resources]
    for arn in wanted:
        if arn not in resources:
            resources.append(arn)
            added.append(arn)
    statement["Resource"] = resources

json.dump(doc, open(dst, "w"), indent=2)
print("     added:", ", ".join(added) if added else "nothing, already there")
PY

echo "3/3  putting it back"
"$AWS" iam put-role-policy --role-name "$ROLE" --policy-name "$POLICY" \
  --policy-document "file://$WORKW/new.json"

echo
echo "done. what the worker may write to now:"
"$AWS" iam get-role-policy --role-name "$ROLE" --policy-name "$POLICY" \
  --query 'PolicyDocument.Statement[?contains(to_string(Action), `s3:PutObject`)].Resource' \
  --output text | tr '\t' '\n' | sed 's/^/  /'
