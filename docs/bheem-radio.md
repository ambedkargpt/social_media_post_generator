# Bhim Radio

Daily audio bulletins, one per party, built from the stories already in `news`.
[Bheem Radio](https://github.com/smartbhaujan/BHEEM-RADIO) does the writing,
fact-checking, voicing and mixing; this repository holds the entry point that
runs it, the Lambda that starts it, and the player.

```
EventBridge (daily, 06:00 IST)
  └─> ambedkargpt-radio-watch (Lambda)
        └─ one Batch job per party ──> ambedkargpt-radio (Fargate, 1 vCPU / 2 GB)
                                         ├─ reads today's stories from Mongo `news`
                                         ├─ DeepSeek writes the spoken copy  (cached)
                                         ├─ a second model fact-checks it
                                         ├─ Sarvam or Gemini voices it       (cached)
                                         └─ ffmpeg mixes one looped MP3
                                                      │
                   s3://ambedkargpt-artifacts/radio/<tenant>/  <─┘
                                  │
                        CDN ──> the player on the site
```

## What is in this repository

| Path | What it is |
|---|---|
| `backend/worker/build_radio.py` | Batch entry point. Maps our environment onto Bheem's and returns an exit code. |
| `backend/worker/radio_handler.py` | Lambda that submits one job per party. |
| `Dockerfile.radio` | The radio image. |
| `.github/workflows/deploy-radio.yml` | Builds it, registers the Batch job definition. |
| `frontend/src/data/bhimRadio.js` | Reads the manifest, turns segments into skippable tracks. |
| `frontend/src/context/RadioContext.jsx` | One `<audio>`, above the router so playback survives navigation. |
| `frontend/src/components/radio/BhimRadioPlayer.jsx` | The panel. |

## Why the radio has its own image

Bheem Radio requires `openai>=3.0` and `google-genai>=2.25`. This project pins
`openai==1.61.1` and `google-genai==1.29.0`. Those are major-version gaps on
both, so pip cannot install it into `Dockerfile.worker` at all — it is not a
tight squeeze, it is unsatisfiable.

Forcing the upgrade would mean rewriting the OpenAI client call in thirteen
files and the Gemini embedder, to make the radio work. A second image costs one
more ECR repository and leaves the product's dependency tree alone. It is also
much smaller: no yt-dlp, no SEMRAG, no ML stack.

Bheem Radio's integration guide says "you don't need a new container". That was
written before anyone compared the pins.

## One-time setup

Everything below is done once, by hand, and is not in any workflow.

### 1. ECR repository

```bash
aws ecr create-repository --repository-name ambedkargpt-radio --region ap-south-1
```

Then push to `main` (or run the workflow by hand) to build the image and
register the `ambedkargpt-radio` job definition.

### 2. IAM

`ambedkargpt-worker-role` needs, on the artifacts bucket:

- `s3:GetObject` and `s3:PutObject` on `arn:aws:s3:::ambedkargpt-artifacts/radio/*`
- `s3:ListBucket` on the bucket, with the condition `s3:prefix = radio/*`

The `ListBucket` grant matters: without it a cache miss comes back as "access
denied" instead of "not found", and the build fails instead of narrating the
story it has not narrated before.

### 3. The radio watcher Lambda

The same image as the API, with a different entry point — exactly how
`ambedkargpt-watch` already works.

```bash
aws lambda create-function \
  --function-name ambedkargpt-radio-watch \
  --package-type Image \
  --code ImageUri=<account>.dkr.ecr.ap-south-1.amazonaws.com/ambedkargpt-api:latest \
  --image-config '{"Command":["backend.worker.radio_handler.handler"]}' \
  --role arn:aws:iam::<account>:role/<the role ambedkargpt-watch uses> \
  --timeout 60 --memory-size 256 --region ap-south-1

aws lambda update-function-configuration \
  --function-name ambedkargpt-radio-watch \
  --environment 'Variables={BATCH_JOB_QUEUE=ambedkargpt-worker-queue,RADIO_JOB_DEFINITION=ambedkargpt-radio}'
```

`deploy-lambda.yml` keeps its code current afterwards.

### 4. EventBridge

Daily, after the last ingest. `cron(30 0 * * ? *)` is 06:00 IST.

```bash
aws events put-rule --name ambedkargpt-radio-daily \
  --schedule-expression 'cron(30 0 * * ? *)'
aws events put-targets --rule ambedkargpt-radio-daily \
  --targets 'Id=1,Arn=arn:aws:lambda:ap-south-1:<account>:function:ambedkargpt-radio-watch'
aws lambda add-permission --function-name ambedkargpt-radio-watch \
  --statement-id events-radio-daily --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:ap-south-1:<account>:rule/ambedkargpt-radio-daily
```

### 5. Serving the audio

The player needs a base URL that answers HTTP **with byte ranges** — that is
what makes the scrubber and the skip buttons work, because skipping is a seek
inside one file rather than a new download.

The account has no CloudFront distribution today. Whatever is chosen, set
`VITE_RADIO_BASE_URL` in Vercel (Production) to its origin and redeploy. Until
it is set the panel says nothing is on air and makes no request, which is also
what should happen locally and in previews.

Three options, in the order they were discussed:

- **CloudFront** over the bucket with origin path `/radio` and Origin Access
  Control, CORS allowing `GET`/`HEAD` from `https://www.ambedkargpt.in`. The
  rest of the bucket stays private. This is what Bheem's guide assumes.
- **S3 directly**, with `radio/` public-read. No distribution to create,
  cheaper at low volume, no edge cache.
- **Cloudflare R2.** S3-API compatible, so Bheem's `s3` backend works with an
  endpoint override, and egress is free — which is most of the $45/month
  estimate.

**Google Drive does not work for this.** The Drive API supports range requests
only with an `Authorization` header, which an `<audio src>` cannot send; public
Drive links give neither reliable ranges nor a CORS header for the manifest
fetch; downloads cost quota that Google has said will be billed; and proxying
through our API is impossible because API Gateway cuts every request off at 30
seconds. Seeking would be broken and the stream would throttle.

Also add an S3 lifecycle rule: expire `radio/cache/` after 30 days and dated
files under `radio/<tenant>/` after 14.

### 6. The voice

Until `SARVAM_API_KEY` exists in SSM, `build_radio.py` voices with Gemini and a
stock voice — deliberately, so the integration is not blocked on a purchase.
When the subscription lands:

```bash
aws ssm put-parameter --name /ambedkargpt/prod/SARVAM_API_KEY \
  --type SecureString --value '<key>'
```

then add it to the `secrets` block in `.github/workflows/deploy-radio.yml` and
redeploy. `build_radio.py` switches to Sarvam on its own once the variable is
present, with Gemini as the fallback.

The cloned station voice needs a recorded consent file and
`voices/registry.json` shipped into the image; see Bheem Radio's own guide.
Without it the stock voice is used, which is a licence question, not a
technical one.

## Checking it

```bash
# One party, from a container, without touching the schedule
docker build -f Dockerfile.radio -t radio:local .
docker run --rm --env-file .env.radio radio:local --tenant samajwadi
```

The log line names the stories, the duration, and the TTS characters actually
paid for. Run it twice: the second run should report `0 TTS characters`,
because everything is cached by content hash.

Then `curl -I <base>/samajwadi/latest.json` — 200, `cache-control:
public, max-age=60`, and the CORS header.

## Things worth knowing

**Thin stations.** Measured over a week: Congress 21 stories a day, BJP 18,
Samajwadi 3.4, General 1.6. Bheem's selection folds General into every party's
bulletin to pad out the quiet ones — but General is our thinnest feed of all, so
it cannot pad anything, and its own bulletin is about a minute. Samajwadi comes
out around four minutes.

Two levers exist, and which to use is an editorial call, not a technical one:
`BHEEM_DAILY_POOL` (put another party's stories in a thin bulletin) or
`BHEEM_DAILY_LOOKBACK_DAYS` (2 gives Samajwadi 11 stories instead of 6, at the
cost of repeating yesterday).

**`body` is mapped to `description`.** We have no `body` field. Bheem's
`summary or description` fallback stops at our summary, so `description` — a
second, fuller paragraph — would otherwise never be read. `build_radio.py`
sends the *whole* field mapping, not just that one line, because a dict setting
from the environment replaces the default rather than merging with it.

**No status filter.** Our documents have no `status` field at all (0 of 1317).
`BHEEM_MONGO_LIVE_STATUSES` is deliberately unset; any value would match
nothing and build four empty bulletins without an error.

**The pin.** `Dockerfile.radio` pins Bheem Radio to a commit, not a tag,
because the repository has no tags despite its guide asking for one. Move
`BHEEM_RADIO_REF` deliberately and read the diff first.
