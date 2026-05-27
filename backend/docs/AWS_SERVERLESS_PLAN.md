# AmbedkarGPT — AWS Serverless Deployment Plan
### Approved Architecture (Boss Sign-Off ✅)

> **Status:** Approved — implementation in progress  
> **Provider:** AWS (Mumbai — ap-south-1)  
> **Previous plan:** DigitalOcean VM → superseded  
> **Key change from VM plan:** FAISS replaced by Pinecone Serverless; API runs on Lambda; no persistent EC2 needed

---

## 1. Executive Summary

| What | Decision |
|---|---|
| **API compute** | AWS Lambda (container image) via Mangum ASGI adapter |
| **Worker compute** | AWS Batch on Fargate — serverless, pay-per-rebuild |
| **Vector search** | Pinecone Serverless — replaces FAISS on disk |
| **Chunks / SEMRAG artifacts** | S3 — downloaded to Lambda `/tmp` on cold start |
| **Database** | MongoDB Atlas M0 (free tier) |
| **Frontend** | Vercel (free tier) |
| **Secrets** | AWS SSM Parameter Store (free tier) |
| **Region** | ap-south-1 (Mumbai) — single region, Phase 1 |

---

## 2. Why Serverless Over VM?

| Concern | VM (old plan) | Serverless (this plan) |
|---|---|---|
| API compute cost | ~$42/mo (always on) | ~$0–2/mo (pay per request) |
| Worker cost | ~$5.52/mo (Batch) | ~$5.52/mo (Batch — unchanged) |
| FAISS cold start on Lambda | ❌ 5–30 sec (unacceptable) | ✅ Removed — Pinecone is always available |
| Storage (EBS) | ~$16/mo | ~$0 (no EBS needed) |
| Total Phase 1 | ~$71/mo | **~$8–12/mo** |
| Ops burden | Medium (EC2 patching, nginx) | Low (no servers to manage) |

**The key enabler:** replacing FAISS (file-on-disk) with Pinecone Serverless (managed cloud index) makes the API completely stateless. A stateless API can run on Lambda with no cold-start penalty for vector search.

---

## 3. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          PRODUCTION                                  │
│                                                                      │
│  [Vercel]                                                            │
│  React Frontend ──────────── HTTPS ──────────────────────┐          │
│                                                           │          │
│                                                           ▼          │
│  [Lambda Function URL]  ←── requests                                │
│  FastAPI + Mangum                                                    │
│       │                                                              │
│       ├── auth/profile/posts/news  ──────────────► [MongoDB Atlas]  │
│       │                                                              │
│       └── /chat  (retrieval + generation)                           │
│               │                                                      │
│               ├── embed query ──────────────────► [Gemini API]      │
│               ├── vector search ────────────────► [Pinecone]        │
│               ├── BM25 (in-memory, from chunks)                     │
│               ├── SEMRAG graph (loaded from S3 on cold start)       │
│               └── generate post ───────────────► [OpenAI API]      │
│                                                                      │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ worker path (2-3x/week) ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│                                                                      │
│  [EventBridge Scheduler]                                             │
│       │  cron trigger                                                │
│       ▼                                                              │
│  [AWS Batch / Fargate]                                               │
│  SEMRAG Worker                                                       │
│       │                                                              │
│       ├── fetch/parse transcripts ──────────────► [Gemini API]      │
│       ├── build embeddings ─────────────────────► [Gemini API]      │
│       ├── upsert vectors ───────────────────────► [Pinecone]        │
│       ├── build SEMRAG graph ───────────────────► [DeepSeek API]    │
│       └── upload artifacts ─────────────────────► [S3 Bucket]      │
│               (chunks JSON, SEMRAG graph, cache, title embeddings)  │
│                                                                      │
│  [S3 Bucket]  ◄──── cold start download ────  [Lambda]             │
│  argument_chunks.json                                                │
│  semrag_graph.json                                                   │
│  semrag_extraction_cache.json                                        │
│  semrag_chunks.json                                                  │
│  video_title_embeddings.json                                         │
│  video_context.json                                                  │
│  manifest.json                                                       │
│                                                                      │
│  [SSM Parameter Store]  ◄── secrets ──  Lambda + Batch             │
│  [ECR]  ──── container images ──────►  Lambda + Batch              │
│  [CloudWatch]  ◄─── logs/metrics ───  Lambda + Batch               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Component Deep-Dive

### 4.1 Lambda (API)

| Property | Value |
|---|---|
| Runtime | Python 3.11 container image (via ECR) |
| Memory | 1024 MB |
| Timeout | 60 seconds |
| Concurrency | Unreserved (scales automatically) |
| Entry point | `backend.main_lambda.handler` (Mangum wrapper) |
| HTTP endpoint | **Lambda Function URL** (free — no API Gateway needed) |
| Warm cache | `_RAG_CACHE` (chunks + BM25 + title embeddings in Lambda memory) |

**Cold start behaviour:**
- First invocation after idle: Lambda downloads artifacts from S3 → `/tmp`, builds BM25 index in memory, connects to Pinecone. ~5–15 sec one-time cost.
- All subsequent requests on the same instance: <1ms overhead (everything in `_RAG_CACHE`).
- Lambda stays warm ~15 min after last request.

**Artifacts loaded on cold start (from S3 → `/tmp`):**

| File | Size estimate | Purpose |
|---|---|---|
| `argument_chunks.json` | ~5–20 MB | BM25 index source + chunk metadata lookup |
| `semrag_graph.json` | ~2–10 MB | SEMRAG entity/relation graph |
| `semrag_extraction_cache.json` | ~5–15 MB | SEMRAG extraction cache |
| `semrag_chunks.json` | ~2–5 MB | SEMRAG chunk list |
| `video_title_embeddings.json` | ~2–5 MB | Title-level embedding cache |
| `video_context.json` | ~1–3 MB | Full video metadata |

**Total cold-start S3 download: ~20–60 MB → ~2–5 seconds on Lambda.**

### 4.2 Pinecone Serverless (Vector Search)

Replaces `faiss-cpu` entirely.

| Property | Value |
|---|---|
| Index type | Serverless (no pods, no infrastructure to manage) |
| Metric | Cosine similarity |
| Dimension | 768 (gemini-embedding-001) |
| Index name | `ambedkargpt-prod` |
| Namespace | `""` (default, can be versioned later) |
| Cloud | AWS |
| Region | us-east-1 (Pinecone Serverless available regions) |

**Why Pinecone Serverless:**
- Always available — no file to load, no cold start penalty
- Free tier: 2 indexes, 2GB storage, 100K reads/month
- Corpus estimate: ~20–50K chunks × 768 dims = ~60–150 MB → within free tier
- At MVP traffic: likely $0/month permanently on free tier

**Worker → Pinecone (upsert):**
```
Worker builds embeddings → upserts to Pinecone index
  vectors: [{id: chunk_id, values: [f32 × 768], metadata: {chunk_text, video_title, ...}}]
  batch_size: 100 vectors per upsert call
```

**API → Pinecone (query):**
```
API embeds query (Gemini) → queries Pinecone
  query(vector=[f32 × 768], top_k=250, include_metadata=False)
  returns: [{id: chunk_id, score: float}]
```

### 4.3 AWS Batch / Fargate (Worker)

No change from the previous plan. The worker is already serverless.

| Property | Value |
|---|---|
| Job definition | `ambedkargpt-worker` |
| vCPU | 4 |
| Memory | 16 GB |
| Trigger | EventBridge Scheduler: `cron(0 2 */2 * ? *)` — every 2 days at 2 AM IST |
| Manual trigger | AWS Console → Batch → Submit Job |
| Container image | ECR: `ambedkargpt-worker:latest` |

**Worker job sequence:**
1. Acquire S3-based distributed lock (`locks/artifact_build.lock`).
2. Parse transcripts, chunk, embed via Gemini.
3. Upsert all vectors to Pinecone (replacing old vectors atomically by ID).
4. Build SEMRAG graph (DeepSeek API).
5. Validate (chunk count, Pinecone vector count, SEMRAG entity threshold).
6. Write `manifest.json`, upload all artifact JSONs to S3.
7. Release lock.

### 4.4 S3 Bucket (Artifact Storage)

| Path | Contents |
|---|---|
| `artifacts/current/` | Latest promoted artifacts (Lambda downloads from here) |
| `artifacts/builds/<version>/` | Versioned build archives |
| `artifacts/locks/` | Distributed lock file |
| `backups/<date>/` | Retention copies |

**Lifecycle rules:**
- `artifacts/builds/` older than 30 days → S3 Infrequent Access (45% cheaper).
- `backups/` older than 90 days → S3 Glacier Instant (68% cheaper).

### 4.5 MongoDB Atlas M0 (Database)

Unchanged from original plan. M0 is free forever.

- Stores: users, sessions, otp_verifications, news, questions, profile_answers, posts.
- M0 limit: 512 MB storage, 500 connections.
- Upgrade trigger: collections exceed ~400 MB → upgrade to M10 ($57/mo).

### 4.6 SSM Parameter Store (Secrets)

Free (Standard tier — up to 10,000 parameters free).

| Parameter | Used by |
|---|---|
| `/ambedkargpt/prod/OPENAI_API_KEY` | Lambda + Batch |
| `/ambedkargpt/prod/GEMINI_API_KEY` | Lambda + Batch |
| `/ambedkargpt/prod/DEEPSEEK_API_KEY` | Batch only |
| `/ambedkargpt/prod/PINECONE_API_KEY` | Lambda + Batch |
| `/ambedkargpt/prod/MONGODB_URI` | Lambda only |
| `/ambedkargpt/prod/JWT_SECRET` | Lambda only |
| `/ambedkargpt/prod/NEWS_API_KEY` | Lambda + Batch |

IAM roles:
- `ambedkargpt-api-role`: Lambda execution role. Access to SSM, S3 (read), ECR, CloudWatch.
- `ambedkargpt-worker-role`: Batch job role. Access to SSM, S3 (read+write), ECR, CloudWatch, Pinecone (via key from SSM).

---

## 5. Cost Breakdown

### Phase 1 (MVP, ap-south-1)

| Service | Configuration | Cost/mo |
|---|---|---|
| **Lambda** | 1 GB × 200ms avg × ~500K requests | ~$0–2 |
| **Lambda Function URL** | Free HTTPS endpoint | $0 |
| **AWS Batch (Fargate)** | 4 vCPU / 16 GB / 2hr × 12 runs | ~$5.52 |
| **Pinecone Serverless** | Free tier (2GB, 100K reads/mo) | **$0** |
| **S3** | ~60MB artifacts + ops | ~$0.50 |
| **MongoDB Atlas M0** | Free tier | $0 |
| **Vercel** | Frontend, free tier | $0 |
| **ECR** | 2 container images (~3 GB each) | ~$0.30 |
| **SSM Parameter Store** | Standard tier | $0 |
| **CloudWatch** | Logs (~500MB/mo) + basic alarms | ~$1 |
| **EventBridge Scheduler** | 12 cron triggers/mo (first 14M free) | $0 |
| **Data transfer** | Lambda → internet, minimal | ~$0.50 |
| **Total Phase 1** | | **≈ $8–10/mo** |

> 💡 **Compared to original DO plan (~$178-226/mo): saves ~$170-216/mo.**

### Phase 2 (Scale-Up, when needed)

| Service | Configuration | Cost/mo |
|---|---|---|
| Lambda (higher traffic) | 10M requests/mo, 1GB, 200ms | ~$20 |
| Lambda Provisioned Concurrency | 1 unit (eliminates cold starts) | ~$17 |
| AWS Batch (Fargate) | Same frequency | ~$5.52 |
| Pinecone Serverless (paid) | >100K reads/mo | ~$1–5 |
| S3 | Larger artifact set | ~$2 |
| MongoDB Atlas M10 | When M0 storage exceeded | ~$57 |
| CloudWatch enhanced | Dashboards + detailed metrics | ~$5 |
| **Total Phase 2** | | **≈ $107–112/mo** |

---

## 6. IAM and Security

### Lambda Execution Role (`ambedkargpt-api-role`)
```json
{
  "Statement": [
    {"Effect": "Allow", "Action": ["ssm:GetParameter", "ssm:GetParameters"], "Resource": "arn:aws:ssm:ap-south-1:*:parameter/ambedkargpt/prod/*"},
    {"Effect": "Allow", "Action": ["s3:GetObject", "s3:ListBucket"], "Resource": ["arn:aws:s3:::ambedkargpt-artifacts", "arn:aws:s3:::ambedkargpt-artifacts/*"]},
    {"Effect": "Allow", "Action": ["ecr:GetDownloadUrlForLayer", "ecr:BatchGetImage"], "Resource": "*"},
    {"Effect": "Allow", "Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"], "Resource": "*"}
  ]
}
```

### Batch Job Role (`ambedkargpt-worker-role`)
```json
{
  "Statement": [
    {"Effect": "Allow", "Action": ["ssm:GetParameter", "ssm:GetParameters"], "Resource": "arn:aws:ssm:ap-south-1:*:parameter/ambedkargpt/prod/*"},
    {"Effect": "Allow", "Action": ["s3:GetObject", "s3:PutObject", "s3:ListBucket", "s3:DeleteObject"], "Resource": ["arn:aws:s3:::ambedkargpt-artifacts", "arn:aws:s3:::ambedkargpt-artifacts/*"]},
    {"Effect": "Allow", "Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"], "Resource": "*"}
  ]
}
```

### Network Security
- Lambda runs in default VPC (no NAT Gateway needed — Lambda Function URL is public by default).
- S3 bucket: private, no public access. Lambda and Batch access via IAM role only.
- No SSH, no EC2, no security groups to manage.
- TLS: Lambda Function URL enforces HTTPS. Vercel enforces HTTPS on frontend.

---

## 7. Environment Variables

### Lambda (`api.env` → SSM parameters)

| Variable | Source | Notes |
|---|---|---|
| `OPENAI_API_KEY` | SSM | Post generation |
| `GEMINI_API_KEY` | SSM | Embeddings |
| `PINECONE_API_KEY` | SSM | Vector search |
| `PINECONE_INDEX_NAME` | SSM | e.g. `ambedkargpt-prod` |
| `PINECONE_NAMESPACE` | SSM | e.g. `""` or `prod` |
| `MONGODB_URI` | SSM | Atlas connection string |
| `JWT_SECRET` | SSM | Auth token signing |
| `S3_BUCKET` | Lambda env var (not secret) | Artifact bucket name |
| `S3_ARTIFACT_PREFIX` | Lambda env var | e.g. `artifacts/current` |
| `APP_ENV` | Lambda env var | `production` |

### Batch Worker (`worker.env` → SSM parameters)

All of the above plus:

| Variable | Source | Notes |
|---|---|---|
| `DEEPSEEK_API_KEY` | SSM | SEMRAG graph extraction |
| `TRANSCRIPT_MASTER_PATH` | Batch env var | Path in container or S3 key |
| `S3_BUCKET` | Batch env var | Same bucket |

---

## 8. Deployment Topology (No VPC Cost)

```
Lambda Function URL (public HTTPS)
    │
    └── Lambda function
            │
            ├── S3 (IAM auth, no VPC endpoint needed)
            ├── SSM (IAM auth)
            ├── Pinecone (external HTTPS — no VPC needed)
            ├── MongoDB Atlas (external HTTPS — no VPC needed)
            ├── OpenAI API (external HTTPS)
            └── Gemini API (external HTTPS)

No NAT Gateway. No VPC Endpoint. No ALB.
Total network cost: $0.
```

---

## 9. Observability

### CloudWatch
- Lambda logs: automatically shipped to `/aws/lambda/ambedkargpt-api`
- Batch logs: automatically shipped to `/aws/batch/job`
- Alarms:
  - Lambda error rate > 1% → SNS alert
  - Lambda p99 duration > 30s → SNS alert
  - Batch job FAILED state → SNS alert

### Health Endpoint
`GET /api/v1/health` — returns:
```json
{
  "status": "ok",
  "database_connected": true,
  "pinecone_ok": true,
  "rag_chunks_ok": true,
  "semrag_graph_ok": true,
  "artifact_version": "20260525T020000Z_abc1234"
}
```

### Dashboards
Single CloudWatch dashboard:
- Lambda: invocation count, error rate, p50/p99 duration, cold starts
- Batch: job success/failure count, job duration
- S3: PUT/GET operations (proxy for rebuild frequency)

---

## 10. CI/CD Pipeline

### GitHub Actions Workflows

#### `deploy-lambda.yml` — Triggered on merge to `main`
```
1. Run tests (pytest)
2. Build Docker image (Dockerfile.lambda)
3. Push to ECR (ambedkargpt-api:latest + ambedkargpt-api:<sha>)
4. Update Lambda function to use new image SHA
5. (Optional) Run smoke test against Lambda Function URL
```

#### `deploy-worker.yml` — Triggered on merge to `main`
```
1. Build Docker image (Dockerfile.worker)
2. Push to ECR (ambedkargpt-worker:latest + ambedkargpt-worker:<sha>)
3. Update Batch job definition to use new image SHA
```

#### `trigger-rebuild.yml` — Manual dispatch
```
1. Submit Batch job (ambedkargpt-worker)
2. Wait for job completion
3. Post result to Slack/GitHub summary
```

### Branch/Release Policy
- `main` → staging Lambda (auto deploy)
- `main` + approval → production Lambda (manual approval gate in GitHub Actions)
- Artifact rebuild: manual trigger only (no auto-rebuild on code push)

---

## 11. Disaster Recovery

| Scenario | Action | Time |
|---|---|---|
| Lambda function broken | Redeploy previous image SHA from ECR | ~2 min |
| Pinecone index corrupt | Re-trigger worker rebuild (re-upserts all vectors) | ~2–3 hr |
| S3 artifacts missing | Re-trigger worker rebuild | ~2–3 hr |
| MongoDB data loss | Restore from Atlas automated backup | ~1–2 hr |
| Pinecone service outage | API falls back gracefully: returns BM25-only results | 0 min (auto) |

**RTO: ~30 min (Lambda) / 2–3 hr (full artifact rebuild)**
**RPO: ≤ 2 days (last worker rebuild)**

---

## 12. Implementation Sequence

| Step | Task | Owner | Est. Time |
|---|---|---|---|
| 1 | Create S3 bucket + lifecycle rules | DevOps | 30 min |
| 2 | Create ECR repositories (api + worker) | DevOps | 15 min |
| 3 | Create SSM parameters (secrets) | DevOps | 30 min |
| 4 | Create IAM roles (api + worker) | DevOps | 30 min |
| 5 | Create Pinecone account + serverless index | Dev | 15 min |
| 6 | Replace FAISS with Pinecone in code | Dev | **Done (see migration)** |
| 7 | Add Mangum wrapper to FastAPI | Dev | **Done** |
| 8 | Build + push Lambda container to ECR | Dev | 20 min |
| 9 | Create Lambda function (container image) | DevOps | 20 min |
| 10 | Create Lambda Function URL | DevOps | 5 min |
| 11 | Build + push worker container to ECR | Dev | 20 min |
| 12 | Create Batch compute environment + job def | DevOps | 45 min |
| 13 | Create EventBridge Scheduler rule | DevOps | 15 min |
| 14 | Run first manual worker rebuild | Dev | 2–3 hr |
| 15 | Validate Lambda health endpoint | Dev | 15 min |
| 16 | Update Vercel frontend env vars (API URL) | Dev | 10 min |
| 17 | Set up CloudWatch alarms + dashboard | DevOps | 1 hr |
| 18 | Set up GitHub Actions CI/CD | Dev | 2–4 hr |
| 19 | Run pilot traffic + smoke tests | Dev | 1 hr |
| 20 | Go-live | All | — |
| **Total** | | | **~1.5 days** |

---

## 13. Operational Runbooks

### Runbook 1: Trigger Manual Worker Rebuild
```bash
# Via AWS CLI
aws batch submit-job \
  --job-name "manual-rebuild-$(date +%Y%m%d)" \
  --job-queue ambedkargpt-worker-queue \
  --job-definition ambedkargpt-worker

# Or: GitHub Actions → trigger-rebuild.yml → Run workflow
```

### Runbook 2: Roll Back Lambda to Previous Version
```bash
# Get last good image SHA from ECR
aws ecr describe-images --repository-name ambedkargpt-api \
  --query 'imageDetails[*].[imageTags,imagePushedAt]' --output table

# Update Lambda to use that SHA
aws lambda update-function-code \
  --function-name ambedkargpt-api \
  --image-uri <account>.dkr.ecr.ap-south-1.amazonaws.com/ambedkargpt-api:<prev-sha>
```

### Runbook 3: Check Pinecone Vector Count
```bash
# Should equal number of chunks in argument_chunks.json
curl -X GET "https://api.pinecone.io/v3/indexes/ambedkargpt-prod/stats" \
  -H "Api-Key: $PINECONE_API_KEY"
```

### Runbook 4: Recover from Pinecone Service Outage
```
- API automatically falls back to BM25-only retrieval if Pinecone query fails
- SEMRAG candidates still work (loaded from S3, graph-based only)
- Post quality degrades slightly (no dense retrieval) but service stays up
- No action needed until Pinecone recovers
```

---

## 14. Cost Guardrails

- Set AWS Budget alert at $20/mo → email notification.
- Pinecone: monitor monthly reads in Pinecone console. Free tier = 100K/mo.
- Lambda: enable Cost Anomaly Detection for Lambda service.
- S3: lifecycle rules prevent unbounded artifact growth.
- Monthly cost review: first Monday of each month.

---

## 15. Review Checklist

- [x] Provider selected: **AWS Serverless**
- [x] FAISS → Pinecone migration approved
- [x] MongoDB Atlas M0 as starting database tier
- [x] Vercel for frontend
- [x] Single region ap-south-1 for Phase 1
- [ ] Pinecone account created + API key obtained
- [ ] AWS account + IAM admin access confirmed
- [ ] S3 bucket name decided: `ambedkargpt-artifacts` (or update in env vars)
- [ ] Lambda Function URL to be shared with Vercel as `VITE_API_BASE_URL`
- [ ] Budget: **~$8–10/mo Phase 1** confirmed
- [ ] RTO/RPO: 30min/2days approved
- [ ] CI/CD: GitHub Actions workflows approved
- [ ] Go-live criteria confirmed

---

*Next step: See `PINECONE_MIGRATION.md` for code-level migration details.*  
*Implementation files: `vector_store.py`, `retriever.py`, `config.py`, `main_lambda.py`, `Dockerfile.lambda`*
