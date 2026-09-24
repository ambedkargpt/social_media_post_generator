# Running the pipeline automatically

Written for: whoever deploys and operates the AWS stack.

The pipeline used to be run by hand every morning. This replaces that with two
pieces on the existing serverless stack:

```
EventBridge Scheduler  ──every 10 min──▶  Lambda: ambedkargpt-watch
                                            │  reads each channel's YouTube feed
                                            │  compares against processed.json in S3
                                            ▼  only if something is new
                                          AWS Batch: ambedkargpt-worker
                                            └─ python -m backend.worker.run_channels
```

The split is the important part. The Atom feed is the one YouTube endpoint that
answers a datacentre IP normally — `auto_rebuild.py` already falls back to it
for exactly that reason — so *asking* whether there is work is safe to do
cheaply and often from Lambda. Everything YouTube throttles, yt-dlp and the
transcript endpoint, stays in Batch where a run has time, a proxy, and somewhere
to keep state.

A tick with nothing new costs a few HTTP requests and a sub-second Lambda
invocation. No container starts.

## Read this before deploying

**Transcripts are the real constraint, not scheduling.** YouTube blocks by IP
with no Retry-After and no appeal, and a datacentre address is the worst case.
The repo already records this in two places:

- `requirements-worker.txt` — *"returns 0 videos from AWS IPs due to YouTube API changes"*
- `auto_rebuild.py:329` — *"yt-dlp returned 0 videos (likely AWS IP blocked)"*

So `backend/Fetch.py` now takes a proxy, off by default:

```
YOUTUBE_PROXY_WEBSHARE_USERNAME=…     # preferred: rotates IP per request
YOUTUBE_PROXY_WEBSHARE_PASSWORD=…
# or, for any other provider:
YOUTUBE_PROXY_URL=http://user:pass@host:port
```

Webshare is handled separately because its residential pool rotates per request
and the transcript library retries on a fresh IP when one is blocked. A single
proxy URL cannot do that, so a block there is final. Residential plans run about
$3–6/month.

Unset, nothing changes and requests go out directly — which is what a laptop
wants. `run_channels` logs a warning when it starts without one, so a run that
fetches nothing is explainable from CloudWatch rather than mysterious.

**`auto_rebuild` is not this.** It predates the channel configs, knows only
about Ravish, and its transcript path calls `get_transcript` /
`save_transcript_to_master_file`, which do not exist in `Fetch.py` — so it
always falls through to a subprocess and returns `1` regardless of outcome. It
still does the RAG artifact rebuild on its own EventBridge cron, and that part
is untouched. The watcher submits `run_channels` instead, via a container
override, so no second job definition has to be kept in step.

## State on ephemeral containers

A Batch container starts empty and is thrown away. The pipeline does not expect
that — `processed.json` is how it knows what it has already ingested. Run it in a
fresh container without that file and it does not fail; it silently re-ingests
the whole lookback window every time, spends the transcript budget on videos it
already has, and republishes stories that already exist.

So `backend/worker/channel_state.py` pulls each channel's state before the run
and pushes it back after — including after a failed run, because a run that
fetched four of six transcripts before being throttled has made real progress.

```
s3://<bucket>/state/channels/<name>/processed.json
s3://<bucket>/state/channels/<name>/transcripts/…
s3://<bucket>/state/channels/<name>/<master transcript>.txt
s3://<bucket>/state/shared/video_summaries.json
s3://<bucket>/state/watch/ledger.json
```

`video_summaries.json` is shared rather than per-channel because several
channels write to the same file; keying it per channel would have each run
overwrite the previous one's summaries.

## Two guards worth knowing about

**A video is only new once.** Ingestion records a video in `processed.json` only
when its transcript actually arrives. A video with no captions never gets there
— nothing is broken, it simply has no captions — so comparing the feed against
`processed.json` alone would rediscover it on every schedule and start a
container for it forever. The ledger at `state/watch/ledger.json` counts
attempts and stops after `WATCH_MAX_ATTEMPTS` (default 3). Videos deferred by a
channel's `max_videos_per_run` are *not* charged an attempt, so a backlog is
worked through rather than retired unattempted.

**One job at a time.** Before submitting, the watcher lists the queue for jobs
named `watch-*` in any active state. Two containers would race for the same
`processed.json` and the same transcript budget.

## Setting it up

Do these in order. Step 1 is not optional: the watcher Lambda runs from the API
image, and until that image is rebuilt it does not contain `watch_handler` at
all — a function created before it would start and immediately fail on import.

Steps 2 to 4 are copy-paste into **CloudShell** (bottom-left of the console).
CloudShell already has the CLI and your console identity, so there are no keys
to create and nothing to install.

### 1. Get the code into the image

`deploy-lambda.yml` builds and pushes only on `main`. The work is on `deploy`,
so open a PR from `deploy` to `main` and merge it, then wait for the **Deploy
Lambda** action to finish. Confirm before continuing:

```bash
aws ecr describe-images   --repository-name ambedkargpt-api   --query 'sort_by(imageDetails,&imagePushedAt)[-1].imagePushedAt'
```

That timestamp must be after the merge.

### 2. The watcher's IAM role

It reads the watch state, reads each channel's processed.json, and submits a
job. It never reads a transcript or writes a story, so it needs no Mongo,
Pinecone or model keys.

```bash
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
REGION=ap-south-1
BUCKET=ambedkargpt-artifacts

aws iam create-role   --role-name ambedkargpt-watch-role   --assume-role-policy-document '{
    "Version":"2012-10-17",
    "Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]
  }'

aws iam attach-role-policy   --role-name ambedkargpt-watch-role   --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

aws iam put-role-policy   --role-name ambedkargpt-watch-role   --policy-name watch-state-and-submit   --policy-document "{
    \"Version\":\"2012-10-17\",
    \"Statement\":[
      {\"Effect\":\"Allow\",
       \"Action\":[\"s3:GetObject\",\"s3:PutObject\"],
       \"Resource\":\"arn:aws:s3:::${BUCKET}/state/watch/*\"},
      {\"Effect\":\"Allow\",
       \"Action\":\"s3:GetObject\",
       \"Resource\":\"arn:aws:s3:::${BUCKET}/state/channels/*\"},
      {\"Effect\":\"Allow\",
       \"Action\":\"batch:SubmitJob\",
       \"Resource\":[
         \"arn:aws:batch:${REGION}:${ACCOUNT}:job-queue/ambedkargpt-worker-queue\",
         \"arn:aws:batch:${REGION}:${ACCOUNT}:job-definition/ambedkargpt-worker\"
       ]},
      {\"Effect\":\"Allow\",\"Action\":\"batch:ListJobs\",\"Resource\":\"*\"}
    ]
  }"
```

`batch:ListJobs` takes no resource — it is queue-wide by design, which is why it
is the one wildcard here.

### 3. The watcher Lambda

Same image as the API, different command. Nothing extra to build.

```bash
aws lambda create-function   --function-name ambedkargpt-watch   --package-type Image   --code ImageUri="${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com/ambedkargpt-api:latest"   --image-config '{"Command":["backend.worker.watch_handler.handler"]}'   --role "arn:aws:iam::${ACCOUNT}:role/ambedkargpt-watch-role"   --timeout 120 --memory-size 512   --environment "Variables={S3_BUCKET=${BUCKET},S3_STATE_PREFIX=state,BATCH_JOB_QUEUE=ambedkargpt-worker-queue,BATCH_JOB_DEFINITION=ambedkargpt-worker,WATCH_MAX_ATTEMPTS=3}"
```

Test it before putting it on a schedule. With S3 still empty it should report
every channel as having new videos and submit one job — which is why the seed in
step 5 comes first if you would rather it not:

```bash
aws lambda invoke --function-name ambedkargpt-watch /dev/stdout
```

### 4. The schedule

```bash
aws iam create-role   --role-name ambedkargpt-scheduler-role   --assume-role-policy-document '{
    "Version":"2012-10-17",
    "Statement":[{"Effect":"Allow","Principal":{"Service":"scheduler.amazonaws.com"},"Action":"sts:AssumeRole"}]
  }'

aws iam put-role-policy   --role-name ambedkargpt-scheduler-role   --policy-name invoke-watch   --policy-document "{
    \"Version\":\"2012-10-17\",
    \"Statement\":[{\"Effect\":\"Allow\",\"Action\":\"lambda:InvokeFunction\",
      \"Resource\":\"arn:aws:lambda:${REGION}:${ACCOUNT}:function:ambedkargpt-watch\"}]
  }"

aws scheduler create-schedule   --name ambedkargpt-watch   --schedule-expression "rate(10 minutes)"   --flexible-time-window '{"Mode":"OFF"}'   --target "{
    \"Arn\":\"arn:aws:lambda:${REGION}:${ACCOUNT}:function:ambedkargpt-watch\",
    \"RoleArn\":\"arn:aws:iam::${ACCOUNT}:role/ambedkargpt-scheduler-role\"
  }"
```

### 5. Seed the state — from your own machine, not CloudShell

This uploads what is already on the machine that has been doing the manual
scrapes, so CloudShell cannot do it: the transcripts are not there.

Without this, the first Batch job sees no processed.json for any channel, treats
the whole lookback window as new, and refetches videos that are already on disk.
Across five channels that is enough requests to be refused partway, so the first
automated run ends in a rate limit and a half-filled feed.

Create an access key for yourself (IAM → Users → your user → Security
credentials → Create access key), then locally:

```bash
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export AWS_DEFAULT_REGION=ap-south-1
export S3_BUCKET=ambedkargpt-artifacts

python -m backend.scripts.seed_channel_state --dry-run
python -m backend.scripts.seed_channel_state
```

About 1275 files and 125 MB. Run it once. Running it again later is safe but
wrong: after the first automated run, AWS holds the newer state and this would
push an older copy over it.

### 6. Check the Batch job role can write the state back

The job writes to `state/channels/*`, which the watcher only reads. If
`ambedkargpt-worker-role` is scoped to `artifacts/*` rather than the whole
bucket, add `s3:GetObject`, `s3:PutObject` and `s3:ListBucket` for
`state/channels/*` — otherwise every run starts from nothing and the seed above
is undone on the first pass.

## Batch job environment

The job definition in `deploy-worker.yml` already carries the model keys, Mongo
URI and S3 settings. Add to it:

| Variable | Value |
|---|---|
| `S3_STATE_PREFIX` | `state` |
| `YOUTUBE_PROXY_WEBSHARE_USERNAME` | from SSM |
| `YOUTUBE_PROXY_WEBSHARE_PASSWORD` | from SSM |

`WATCH_CHANNELS` is set per job by the watcher and does not belong in the
definition.

## Checking on it

```bash
aws logs tail /aws/lambda/ambedkargpt-watch --follow
aws batch list-jobs --job-queue ambedkargpt-worker-queue --job-status RUNNING
aws s3 cp s3://ambedkargpt-artifacts/state/watch/ledger.json -   # what it gave up on
```

Invoke it by hand to see the decision without waiting for the schedule:

```bash
aws lambda invoke --function-name ambedkargpt-watch /dev/stdout
```

## Running the same check locally

`backend/scripts/watch_channels.py` is the local equivalent — same feed logic,
local disk instead of S3, and it runs the pipeline as a subprocess instead of
submitting a Batch job. Useful for seeing what is pending without touching AWS:

```bash
python -m backend.scripts.watch_channels --dry-run
```

It can also be left running on a laptop (`--interval 300`), which is what it was
first written for, but that means keeping the laptop awake — the reason the AWS
path exists.

## What this does not do

It does not backfill. The feed carries only the ~15 newest uploads with no
paging, so a channel that posted twenty videos while the watcher was down has
already pushed the oldest off the feed. Those are picked up by the pipeline's own
`lookback_days` window on a normal run, or by
`python -m backend.scripts.overnight_scrape` for a longer catch-up.

It is also a poll, not a push. YouTube does offer PubSubHubbub, which would cut
the delay from ten minutes to seconds, but it needs a public HTTPS callback,
HMAC verification and a renewal job because the lease expires every five days.
Against a pipeline run that takes six to eight minutes anyway, the poll costs
almost nothing by comparison.
