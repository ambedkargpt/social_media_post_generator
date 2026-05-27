# AmbedkarGPT — Cloud Deployment Proposal
### AWS vs GCP Comparison for Boss Review & Approval

> **Status:** Draft for approval  
> **Prepared by:** Engineering  
> **Date:** May 2026  
> **Previous plan:** DigitalOcean (superseded — see `DEPLOYMENT_PLAN.md` for reference)

---

## Quick Decision Summary

| | AWS | GCP |
|---|---|---|
| **Phase 1 estimated cost/mo** | **~$71** | **~$81 (on-demand) / ~$66 (with 1-yr commit)** |
| **Best for** | Predictable pricing, no commitment needed | Slightly cheaper long-term with commitment |
| **Worker model** | AWS Batch (Fargate) | Cloud Run Jobs |
| **Risk** | Low — mature, larger ecosystem | Low — strong product but smaller ops community |
| **Recommendation** | ✅ **Preferred** | ✅ Valid alternative |

> Both plans keep **MongoDB Atlas on the free tier (M0)**, **Vercel for the frontend**, and target **Mumbai region** for India-facing traffic.

---

## Part 1 — Project Characteristics (Why These Choices)

Before comparing costs, here is the workload profile that drives every architectural decision:

| Characteristic | Detail |
|---|---|
| **Backend** | FastAPI (Python), CPU-bound FAISS vector search |
| **Retrieval artifacts** | FAISS index + large SEMRAG JSON files (graph, chunks, cache) stored on disk |
| **Worker pattern** | Heavy periodic rebuild job (2–3× per week), **not 24/7** — bursty, interruptible |
| **Database** | MongoDB Atlas M0 (free tier, cloud-agnostic) |
| **AI APIs** | OpenAI, Gemini, DeepSeek — all external, no in-house GPU inference |
| **Frontend** | React/Vite — static, CDN-friendly |
| **Region** | Single region, India (Mumbai) for Phase 1 |

**The single biggest cost lever**: the SEMRAG rebuild worker runs 2–3× per week, not continuously. Paying for a 24/7 VM for a job that runs ~3 hours/week is wasteful. Both AWS and GCP have serverless compute products that charge per-second of actual execution — this is the primary optimization.

---

## Part 2 — AWS Deployment Plan

### 2.1 Architecture Overview

```
Internet
    │
    ▼
[Elastic IP + Nginx/TLS]
    │
    ▼
[EC2 t4g.large]  ──── reads ────▶  [EBS gp3 /data  200GB]
  FastAPI API                           │
  Gunicorn + Uvicorn                    │ artifacts/
                                        ▼
[AWS Batch / Fargate]  ── writes ──▶  [EBS gp3 /data  200GB]
  SEMRAG Worker                         │
  (runs 2-3x/week only)                 │ on promote
                                        ▼
                                   [S3 Bucket]
                                   cold snapshots
                                   + backups

[MongoDB Atlas M0]  ◀──────────────  API + Worker
[Vercel]            ──── static ───▶  Frontend (free)
[SSM Parameter Store] ◀─── secrets ── API + Worker
```

### 2.2 Service-by-Service Breakdown

#### Compute

| Service | Spec | Reason |
|---|---|---|
| **EC2 t4g.large** (API) | 2 vCPU, 8 GB RAM, Ubuntu 22.04, ARM (Graviton 3) | 20–40% cheaper than equivalent x86. FastAPI + FAISS-CPU + Python all run natively on ARM. |
| **AWS Batch on Fargate** (Worker) | 4 vCPU, 16 GB RAM — spun up per job, torn down after | Pay-per-second of actual execution. Worker runs ~2 hrs per job × 12 jobs/mo = negligible cost. No idle VM cost. |

> **ARM / Graviton note:** `faiss-cpu`, `numpy`, `torch` (CPU), `sentence-transformers`, and all Python packages used in this project have pre-built ARM wheels. No recompilation needed.

#### Storage

| Service | Spec | Reason |
|---|---|---|
| **EBS gp3** (hot) | 200 GB, shared between API and worker via mount | gp3 is 20% cheaper AND 20% faster than old gp2. FAISS reads benefit from consistent IOPS. |
| **S3 Standard + Lifecycle** (cold) | Start ~50 GB, grow with artifact versions | Lifecycle rule: move to S3-IA after 30 days → saves ~45% on older snapshots. `s3://` URIs already in codebase — zero refactoring. |

#### Supporting Services

| Service | Use | Cost |
|---|---|---|
| **Elastic IP** | Static public IP for API | Free when attached to running instance |
| **SSM Parameter Store** (Standard tier) | Store secrets (JWT, API keys, Mongo URI) | Free — no additional cost |
| **CloudWatch** | Logs + basic metrics | ~$2/mo for logs ingestion |
| **ECR** (Elastic Container Registry) | Docker images for Batch worker | ~$0.20/mo |
| **MongoDB Atlas M0** | Application database | **Free** |
| **Vercel** | Frontend hosting | **Free** (Hobby tier) |

### 2.3 Phase 1 Cost Estimate (Mumbai — ap-south-1)

| Line Item | Configuration | Monthly Cost |
|---|---|---|
| EC2 t4g.large | API server, on-demand | $42.63 |
| AWS Batch (Fargate) | 4 vCPU / 16 GB / 2 hr × 12 runs | $5.52 |
| EBS gp3 | 200 GB hot storage | $16.00 |
| S3 Standard | ~50 GB cold backups + operations | $1.75 |
| MongoDB Atlas M0 | Free tier | $0.00 |
| Vercel | Frontend, free tier | $0.00 |
| Data transfer out | ~35 GB/mo estimate | $3.00 |
| SSM Parameter Store | Secrets | $0.00 |
| CloudWatch + ECR | Monitoring + container registry | $2.20 |
| **Total Phase 1** | | **≈ $71 / month** |

### 2.4 Phase 2 Cost Estimate (Scale-Up)

| Line Item | Configuration | Monthly Cost |
|---|---|---|
| EC2 t4g.large × 2 | 2× API servers | $85.26 |
| ALB | Application Load Balancer | $16.00 |
| AWS Batch (Fargate) | Worker (same frequency) | $5.52 |
| EBS gp3 × 2 | 200 GB per server | $32.00 |
| S3 Standard | ~200 GB cold storage | $5.00 |
| MongoDB Atlas M10 | When M0 limit exceeded | $57.00 |
| Data transfer out | ~100 GB/mo | $8.60 |
| CloudWatch enhanced | Dashboards + alarms | $5.00 |
| **Total Phase 2** | | **≈ $214 / month** |

### 2.5 AWS-Specific Optimisations Built Into This Plan

1. **Graviton (t4g) instances** — 20–40% savings vs equivalent x86. Best price-performance on AWS for Python workloads.
2. **AWS Batch over persistent VM** — Worker costs ~$5.52/mo instead of ~$48–96/mo for an always-on droplet.
3. **EBS gp3** — Same price per GB as gp2 but with free baseline IOPS/throughput increase. No reason to use gp2.
4. **SSM Parameter Store (free)** — Replaces Secrets Manager ($0.40/secret/mo). Enough for this project's secret count.
5. **S3 Intelligent-Tiering lifecycle** — Artifact snapshots older than 30 days auto-move to Infrequent Access, ~45% cheaper.
6. **No ALB in Phase 1** — Direct Nginx → EC2 with Elastic IP. Add ALB only when second API node is added.

### 2.6 AWS Pros and Cons

#### ✅ Advantages

| Advantage | Detail |
|---|---|
| **Cheapest Phase 1 cost — no commitment** | ~$71/mo on-demand. GCP needs a 1-year commitment to match. |
| **Plan already S3-native** | Existing codebase uses `s3://` paths and `AWS_*` env vars. Zero refactoring of storage code. |
| **AWS Batch is a natural fit** | Designed exactly for periodic, containerised batch jobs. Simple to trigger via cron, API call, or manual. |
| **Mature Mumbai region (ap-south-1)** | Launched 2016, well-established, many PoPs for India-facing traffic. Lower latency for Indian users. |
| **Graviton is production-proven** | Widely used in Indian startups and large orgs. All Python ML libraries have ARM wheels. |
| **Largest ops/hiring ecosystem** | More StackOverflow answers, more DevOps engineers familiar with AWS in India. |
| **Future GPU access** | AWS has the widest variety of GPU instance types (g4dn, g5, p3) if in-house inference is ever needed. |
| **EC2 Spot for future workers** | If Batch is ever replaced, Spot instances save 60–90% for interruptible batch work. |

#### ❌ Disadvantages

| Disadvantage | Detail |
|---|---|
| **Steeper initial learning curve** | IAM roles, VPCs, security groups, and Batch job definitions require more setup than GCP equivalents. |
| **Console complexity** | AWS console is more cluttered than GCP. Easier to misconfigure. |
| **ALB cost in Phase 2** | ALB adds ~$16/mo in Phase 2. GCP's HTTP(S) Load Balancing is priced similarly. |
| **CloudWatch is not best-in-class** | Monitoring and alerting is adequate but less polished than GCP Cloud Monitoring. |
| **Data egress pricing** | First 100 GB/mo free, then $0.086/GB. Similar to GCP but can add up at scale. |

---

## Part 3 — GCP Deployment Plan

### 3.1 Architecture Overview

```
Internet
    │
    ▼
[Static External IP + Nginx/TLS]
    │
    ▼
[Compute Engine e2-standard-2]  ── reads ──▶  [Persistent Disk Balanced  200GB]
  FastAPI API                                       │
  Gunicorn + Uvicorn                                │ artifacts/
                                                    ▼
[Cloud Run Jobs]  ────── writes ─────────▶  [Persistent Disk Balanced  200GB]
  SEMRAG Worker                                     │
  (runs 2-3x/week only)                             │ on promote
                                                    ▼
                                              [GCS Bucket]
                                              cold snapshots
                                              + backups

[MongoDB Atlas M0]  ◀───────────────────  API + Worker
[Vercel]            ──── static ────────▶  Frontend (free)
[GCP Secret Manager] ◀─── secrets ──────  API + Worker
```

### 3.2 Service-by-Service Breakdown

#### Compute

| Service | Spec | Reason |
|---|---|---|
| **Compute Engine e2-standard-2** (API) | 2 vCPU, 8 GB RAM, Ubuntu 22.04 | GCP's most cost-efficient general-purpose instance family. 1-yr CUD reduces cost by ~30%. |
| **Cloud Run Jobs** (Worker) | 4 vCPU, 16 GB RAM — serverless, per-execution billing | Fully serverless. Jobs triggered on schedule or manually. No infrastructure to manage — GCP handles provisioning and teardown automatically. |

#### Storage

| Service | Spec | Reason |
|---|---|---|
| **Persistent Disk Balanced** (hot) | 200 GB | Balance of cost and IOPS. Standard PD is cheaper ($8/mo) but IOPS is too low for FAISS random reads. SSD PD ($34/mo) is overkill. Balanced ($20/mo) is the right fit. |
| **GCS Standard + Lifecycle** (cold) | Start ~50 GB | Same S3-compatible HTTP API. Lifecycle rule to Nearline after 30 days (50% cheaper for cold data). |

#### Supporting Services

| Service | Use | Cost |
|---|---|---|
| **Static External IP** | Public IP for API | Free when attached to running VM (standard tier) |
| **GCP Secret Manager** | Store secrets (JWT, API keys, Mongo URI) | ~$0.20/mo — cheapest secret store of any provider |
| **Cloud Logging** | Structured logs | Free up to 50 GB/mo ingestion — easily within budget |
| **Cloud Monitoring** | Metrics + alerts | Free for GCP resource metrics |
| **Artifact Registry** | Docker images for Cloud Run Jobs | ~$0.10/mo |
| **MongoDB Atlas M0** | Application database | **Free** |
| **Vercel** | Frontend hosting | **Free** (Hobby tier) |

### 3.3 Phase 1 Cost Estimate (Mumbai — asia-south1)

#### Option A: On-Demand (No Commitment)

| Line Item | Configuration | Monthly Cost |
|---|---|---|
| Compute Engine e2-standard-2 | API server, on-demand | $48.91 |
| Cloud Run Jobs | 4 vCPU / 16 GB / 2 hr × 12 runs | $7.00 |
| Persistent Disk Balanced | 200 GB hot storage | $20.00 |
| GCS Standard | ~50 GB cold backups + operations | $1.50 |
| MongoDB Atlas M0 | Free tier | $0.00 |
| Vercel | Frontend, free tier | $0.00 |
| Data transfer out | ~35 GB/mo estimate | $3.00 |
| Secret Manager | Secrets | $0.20 |
| Cloud Logging + Monitoring | Basic observability | $0.00 |
| **Total Phase 1 (on-demand)** | | **≈ $81 / month** |

#### Option B: With 1-Year Committed Use Discount (CUD) on API

| Line Item | Configuration | Monthly Cost |
|---|---|---|
| Compute Engine e2-standard-2 | **1-yr CUD, ~30% discount** | $34.24 |
| Cloud Run Jobs | Same as above | $7.00 |
| Persistent Disk Balanced | 200 GB | $20.00 |
| GCS Standard | ~50 GB | $1.50 |
| MongoDB Atlas M0 | Free | $0.00 |
| Vercel | Free | $0.00 |
| Data transfer out | ~35 GB/mo | $3.00 |
| Secret Manager | | $0.20 |
| **Total Phase 1 (with CUD)** | | **≈ $66 / month** |

> **Note:** CUD requires a 1-year contract on the e2-standard-2 instance. Savings are automatic — no upfront payment required unless you choose "upfront" CUD.

### 3.4 Phase 2 Cost Estimate (Scale-Up, On-Demand)

| Line Item | Configuration | Monthly Cost |
|---|---|---|
| Compute Engine e2-standard-2 × 2 | 2× API servers | $97.82 |
| HTTP(S) Load Balancing | Cloud Load Balancer | $18.00 |
| Cloud Run Jobs | Worker (same frequency) | $7.00 |
| Persistent Disk Balanced × 2 | 200 GB per server | $40.00 |
| GCS Standard | ~200 GB cold storage | $5.00 |
| MongoDB Atlas M10 | When M0 limit exceeded | $57.00 |
| Data transfer out | ~100 GB/mo | $8.00 |
| Cloud Monitoring enhanced | Dashboards + alerting | $3.00 |
| **Total Phase 2** | | **≈ $236 / month** |

### 3.5 GCP-Specific Optimisations Built Into This Plan

1. **Cloud Run Jobs for Worker** — Simplest possible worker model. No Docker Compose, no systemd, no EC2 management. Define the job once, trigger it on a Cloud Scheduler cron or manually.
2. **CUD on API instance** — 30% discount with no upfront payment. Phase 1 cost drops from $81 → $66/mo, matching AWS.
3. **GCS Nearline lifecycle** — Artifact snapshots move to Nearline after 30 days ($0.010/GB vs $0.023/GB). 57% cheaper for cold storage.
4. **PD Balanced (not SSD)** — $20/mo vs $34/mo SSD. FAISS performs adequately with Balanced disk for this workload size.
5. **Secret Manager over alternatives** — At $0.20/mo, it's the cheapest secret store across all three providers.
6. **Cloud Logging free tier** — 50 GB free ingestion per month more than covers structured JSON API logs.

### 3.6 GCP Pros and Cons

#### ✅ Advantages

| Advantage | Detail |
|---|---|
| **Simplest worker setup** | Cloud Run Jobs is the easiest-to-operate batch compute product across any cloud. No job queues, no cluster config — define container + schedule, done. |
| **Cheapest long-term (with CUD)** | At ~$66/mo with 1-yr CUD, cheaper than AWS. No upfront payment required for CUD. |
| **Best-in-class secret management** | Secret Manager at $0.20/mo is 2× cheaper than AWS Secrets Manager. |
| **Free structured logging** | Cloud Logging with 50 GB free ingestion is generous. JSON log support is native. |
| **Cloud Monitoring is polished** | Better default dashboards and alerting UX than AWS CloudWatch. |
| **Cleaner IAM model** | GCP's IAM is more granular and consistent than AWS IAM policies. |
| **Future Vertex AI path** | If in-house embeddings (replacing Gemini API calls) are ever needed, Vertex AI is natively integrated. |
| **Committed Use = flexibility** | GCP CUD can be applied to any instance in the same family — more flexible than AWS Reserved Instances. |

#### ❌ Disadvantages

| Disadvantage | Detail |
|---|---|
| **More expensive on-demand (no commitment)** | Without CUD: ~$81/mo vs AWS ~$71/mo. For early-stage MVP with uncertain budget, this matters. |
| **CUD is a 1-year commitment** | To match AWS pricing, you must commit to 1 year on the API instance. If project is cancelled or pivoted, cost is wasted. |
| **GCS is not native S3** | Existing codebase uses `s3://` paths and `AWS_*` env vars (see `worker.env`, `backup_artifacts.py`). Migrating to GCS requires refactoring env vars and storage client code. |
| **Smaller ops community in India** | Fewer GCP-certified engineers and StackOverflow answers compared to AWS in the Indian market. |
| **Cloud Run Jobs — FAISS on shared volume** | Cloud Run Jobs cannot directly mount a Persistent Disk from Compute Engine. Worker would need to download artifacts from GCS → local disk → build → upload back to GCS. Adds a download/upload step (~5–10 min per run for large artifacts). |
| **Persistent Disk is single-zone** | PD is bound to one zone. API and worker must be in the same zone. AWS EBS has the same constraint but is more commonly worked around. |
| **Console parity** | GCP console is cleaner but some features are harder to find for those new to GCP. |

---

## Part 4 — Side-by-Side Comparison

### 4.1 Cost Comparison

| | AWS | GCP (on-demand) | GCP (1-yr CUD) |
|---|---|---|---|
| **Phase 1 / month** | **$71** | $81 | **$66** |
| **Phase 2 / month** | **$214** | $236 | ~$205 |
| **Commitment required** | None | None | 1-year on API instance |
| **Worker cost/run** | $0.46 | $0.98 | $0.98 |
| **Secret management** | $0 (SSM free) | $0.20 | $0.20 |
| **Discount path** | Savings Plans (flexible) | Committed Use Discounts | CUD |

### 4.2 Technical Comparison

| Criteria | AWS | GCP |
|---|---|---|
| **Worker compute model** | AWS Batch (Fargate) — mature, feature-rich | Cloud Run Jobs — simpler to set up, but disk-mount limitation for FAISS |
| **Block storage** | EBS gp3 — $0.08/GB, consistent IOPS | PD Balanced — $0.10/GB, good IOPS |
| **Object storage** | S3 — native, zero code changes needed | GCS — needs code changes in `backup_artifacts.py` and env vars |
| **Secrets** | SSM Parameter Store (free) | Secret Manager ($0.20/mo) |
| **Logging** | CloudWatch ($2/mo) | Cloud Logging (free tier) |
| **Monitoring** | CloudWatch — adequate | Cloud Monitoring — better UX |
| **ARM instances** | t4g — Graviton 3, 20-40% cheaper | No ARM option in e2 family; needs n2 ARM (more expensive) |
| **India region maturity** | ap-south-1 Mumbai — since 2016 | asia-south1 Mumbai — since 2017 |
| **Code changes required** | None — plan already uses `AWS_*` vars and `s3://` paths | Moderate — env vars, storage client, GCS SDK |
| **FAISS artifact access by worker** | Direct EBS mount — worker writes to `/data` directly | Indirect — download from GCS → build → upload back |
| **Future GPU (if needed)** | g4dn.xlarge: ~$0.526/hr | n1-standard-4 + T4: ~$0.35/hr (cheaper GPU) |

### 4.3 Operational Complexity

| Task | AWS | GCP |
|---|---|---|
| **Provision first VM** | 10 min (EC2 + EBS + security group) | 10 min (Compute Engine + PD + firewall) |
| **Set up worker** | ~2 hr (Batch job definition + IAM role + ECR image) | ~1 hr (Cloud Run job + Artifact Registry image) — simpler |
| **Set up secrets** | 30 min (SSM Parameter Store + IAM policy) | 30 min (Secret Manager + IAM binding) |
| **Set up monitoring** | 1 hr (CloudWatch alarms + dashboards) | 45 min (Cloud Monitoring — more out-of-box) |
| **First deploy end-to-end** | 1–2 days | 1–2 days |
| **Ongoing ops effort** | Medium | Medium-Low |

---

## Part 5 — Shared Architecture Decisions (Both Plans)

Regardless of provider chosen, the following decisions remain the same:

### 5.1 Storage Layout (Identical)

```
/data/
├── artifacts/
│   ├── builds/
│   │   └── <version>/
│   │       ├── faiss_index.bin
│   │       ├── semrag_graph.json
│   │       ├── semrag_chunks.json
│   │       ├── semrag_extraction_cache.json
│   │       └── manifest.json
│   └── current -> builds/<active_version>/   # symlink
├── transcripts/
├── locks/
└── logs/jobs/
```

### 5.2 No-Clash Guarantee (Identical)

- API is **read-only** for artifacts — reads from `artifacts/current` symlink.
- Worker is the **only writer** — builds in isolated `artifacts/builds/<version>`, then atomically updates the `current` symlink.
- Distributed lock (`artifact_build_lock`) prevents concurrent worker runs.

### 5.3 Artifact Lifecycle (Identical)

1. Worker acquires lock.
2. Builds in fresh isolated path.
3. Validates (FAISS load, checksum, smoke test).
4. Uploads version to object storage (S3 or GCS).
5. Atomically updates `current` symlink.
6. Releases lock.
7. Rollback = repoint symlink to previous version.

### 5.4 Environment Scopes (Identical)

- `api.env` — JWT, Mongo URI, model API keys for endpoints.
- `worker.env` — SEMRAG build vars, storage credentials, DeepSeek/Gemini keys.
- `frontend.env` — Public vars only, safe to expose.

### 5.5 Backup Retention (Identical)

| Tier | Retention |
|---|---|
| Daily snapshots | 30 days |
| Weekly snapshots | 12 weeks |
| Monthly snapshots | 12 months |

### 5.6 CI/CD Strategy (Identical)

- Merge to `main` → staging deploy (automated).
- Production deploy → manual approval gate.
- Artifact promotion → validation report + explicit approval.
- Three independent pipelines: Frontend / API / Worker.

### 5.7 Security Baseline (Identical)

- TLS enforced (Nginx + Let's Encrypt / ACM).
- Inbound: 80/443 public; SSH restricted to team IP/VPN only.
- Non-root service users.
- Secrets never in `.env` files committed to repo.
- Rate limiting on auth endpoints.
- Secret scanning in CI pipeline.

---

## Part 6 — RTO / RPO Targets

| Target | Phase 1 | Phase 2 |
|---|---|---|
| **RTO (Recovery Time Objective)** | 1–2 hours | < 30 minutes |
| **RPO (Recovery Point Objective)** | ≤ 24 hours | ≤ 4 hours |

---

## Part 7 — Risk Register

| Risk | Likelihood | Impact | Mitigation | AWS | GCP |
|---|---|---|---|---|---|
| Artifact corruption during rebuild | Low | High | Isolated build path + checksums + atomic swap | ✅ | ✅ |
| API serving stale data | Low | Medium | Reads only `current` symlink — never in-flight version | ✅ | ✅ |
| Worker storage conflict | Low | High | Distributed lock prevents concurrent writes | ✅ | ✅ |
| MongoDB M0 storage limit (512 MB) | Medium | Medium | Upgrade to M10 ($57/mo) when collections exceed ~400 MB | ✅ | ✅ |
| Storage cost runaway | Low | Medium | Lifecycle rules + monthly cost review | ✅ | ✅ |
| Provider outage (Mumbai region) | Very Low | High | Artifact snapshots in object storage — recover to any region | ✅ | ✅ |
| GCS disk-mount gap for worker | N/A | Medium | Worker must download/upload artifacts via GCS (extra 5–10 min per run) | — | ⚠️ |
| 1-yr CUD commitment (GCP) | Low | Low | CUD has no upfront cost; worst case: pay ~$35/mo for unused commitment | — | ⚠️ |

---

## Part 8 — Implementation Sequence

This sequence is identical for both AWS and GCP. Provider-specific resource names are noted.

| Step | Task | AWS Resource | GCP Resource | Est. Time |
|---|---|---|---|---|
| 1 | Provision VM + storage | EC2 t4g.large + EBS gp3 | Compute Engine e2-standard-2 + PD Balanced | 1–2 hr |
| 2 | Storage layout | Mount EBS at `/data`, run `01-storage-layout.sh` | Mount PD at `/data`, run `01-storage-layout.sh` | 30 min |
| 3 | Runtime setup | Python venv, Nginx, Gunicorn, systemd service | Python venv, Nginx, Gunicorn, systemd service | 2–3 hr |
| 4 | Secrets | SSM Parameter Store + IAM role | Secret Manager + service account | 30 min |
| 5 | Worker setup | Batch job definition + ECR image | Cloud Run job + Artifact Registry image | 2–3 hr |
| 6 | Object storage | S3 bucket + lifecycle policy | GCS bucket + lifecycle policy | 30 min |
| 7 | Seed bootstrap | Upload initial artifacts, validate API startup | Same | 1 hr |
| 8 | CI/CD | GitHub Actions → deploy to EC2 via SSM/SSH | GitHub Actions → deploy via SSH + gcloud | 2–4 hr |
| 9 | Monitoring | CloudWatch alarms + basic dashboard | Cloud Monitoring alerts + dashboard | 1–2 hr |
| 10 | Worker schedule | EventBridge cron → Batch job | Cloud Scheduler → Cloud Run job | 30 min |
| 11 | Go-live | Pilot traffic, confirm SLOs, ramp | Same | 2–4 hr |
| **Total** | | | | **~2 days** |

---

## Part 9 — Final Recommendation for Approval

### Option A — AWS ✅ (Recommended)

**Choose AWS if:**
- You want the lowest cost with **no multi-year commitment** ($71/mo).
- You want to avoid refactoring storage code (plan already uses `s3://` and `AWS_*` env vars).
- You want the safest operational choice — largest ecosystem, most engineers familiar with it.
- You want direct EBS mount for the worker (avoids GCS download/upload round-trip for large FAISS artifacts).

**Monthly cost:** ~$71  
**Commitment required:** None  
**Code changes from DO plan:** None (storage paths and env vars unchanged)

---

### Option B — GCP ✅ (Valid Alternative)

**Choose GCP if:**
- You are comfortable signing a 1-year CUD to get to $66/mo (saves $5/mo vs AWS — minimal benefit).
- You prefer Cloud Run Jobs' simpler worker UX over AWS Batch setup complexity.
- You have existing GCP credits or GCP is already used in the organisation.
- You anticipate needing Vertex AI for in-house embedding/inference later.

**Monthly cost:** ~$81 (on-demand) / ~$66 (1-yr CUD)  
**Commitment required:** 1-year CUD on API instance for price parity with AWS  
**Code changes from DO plan:** Moderate — GCS client, env var renames, worker artifact sync via GCS

---

### Decision Checklist for Approval

- [ ] Cloud provider selected: **AWS** / **GCP**
- [ ] MongoDB Atlas M0 confirmed as starting database tier
- [ ] Vercel confirmed for frontend hosting
- [ ] Single region (Mumbai) confirmed for Phase 1
- [ ] Budget envelope confirmed: **~$71/mo (AWS)** or **~$66–81/mo (GCP)**
- [ ] Worker frequency confirmed: 2–3× per week
- [ ] Backup retention policy approved (30d daily / 12w weekly / 12m monthly)
- [ ] RTO/RPO targets approved (1–2 hr / ≤24 hr for Phase 1)
- [ ] Security baseline approved
- [ ] Go-live criteria and rollback runbook accepted

---

*Document version: 1.0 — awaiting provider selection approval*  
*Next step after approval: Update `DEPLOYMENT_PLAN.md` with selected provider topology and begin Step 1 of the implementation sequence.*
