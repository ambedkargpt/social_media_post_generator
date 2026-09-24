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

## Creating the watcher Lambda

It runs from the **same image as the API** with a different CMD, so there is
nothing extra to build. `deploy-lambda.yml` updates it alongside the API once it
exists, and skips it silently before then.

```bash
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
REGION=ap-south-1
IMAGE="${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com/ambedkargpt-api:latest"

aws lambda create-function \
  --function-name ambedkargpt-watch \
  --package-type Image \
  --code ImageUri="${IMAGE}" \
  --image-config '{"Command":["backend.worker.watch_handler.handler"]}' \
  --role "arn:aws:iam::${ACCOUNT}:role/ambedkargpt-watch-role" \
  --timeout 120 \
  --memory-size 512 \
  --environment "Variables={
    S3_BUCKET=ambedkargpt-artifacts,
    S3_STATE_PREFIX=state,
    BATCH_JOB_QUEUE=ambedkargpt-worker-queue,
    BATCH_JOB_DEFINITION=ambedkargpt-worker,
    WATCH_MAX_ATTEMPTS=3
  }"
```

The role needs only: `s3:GetObject` and `s3:PutObject` on
`<bucket>/state/watch/*`, `s3:GetObject` on `<bucket>/state/channels/*`,
`batch:SubmitJob`, `batch:ListJobs`, and the basic Lambda logging policy. It does
**not** need Mongo, Pinecone or any model key — it never reads a transcript or
writes a story.

## The schedule

```bash
aws scheduler create-schedule \
  --name ambedkargpt-watch \
  --schedule-expression "rate(10 minutes)" \
  --flexible-time-window '{"Mode":"OFF"}' \
  --target "{
    \"Arn\":\"arn:aws:lambda:${REGION}:${ACCOUNT}:function:ambedkargpt-watch\",
    \"RoleArn\":\"arn:aws:iam::${ACCOUNT}:role/ambedkargpt-scheduler-role\"
  }"
```

Ten minutes is a deliberate floor, not a limit of the feed. A pipeline run takes
six to eight minutes, so checking much more often only finds a job already
running. Uploads are picked up on the next tick, not instantly.

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
