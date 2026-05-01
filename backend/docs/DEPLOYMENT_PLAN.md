# AmbedkarGPT Deployment Plan (Review Draft)

This document proposes a production deployment plan for the Social Media Generator + SEMRAG stack. It is written for architecture review and approval before implementation.

## 1) Goals and Non-Goals

### Goals

- Deploy backend APIs, worker pipelines, and future frontend with clear ownership boundaries.
- Prevent runtime clashes between API reads and SEMRAG/FAISS rebuild writes.
- Maintain durable storage for KG, chunk artifacts, FAISS index, checkpoints, and backups.
- Provide predictable rollback and disaster recovery procedures.
- Keep operations simple enough for a small team to run.

### Non-Goals (for phase 1)

- Multi-region active-active setup.
- Kubernetes-based orchestration.
- GPU-based in-house inference (current generation uses external model APIs).

## 2) Current Project Characteristics (Why This Plan)

- Backend service: FastAPI (`backend/main.py`) with MongoDB for domain data.
- Retrieval storage: FAISS index + chunk files under repo-managed paths.
- SEMRAG artifacts: large JSON graph/cache/chunks + checkpoints and backup snapshots.
- Processing pattern: periodic heavy rebuild/recovery tasks, plus light read-heavy API queries.

Because artifacts are large files and rebuilds are write-heavy, this plan separates writer and reader responsibilities.

## 3) Recommended Platform Decision

Primary recommendation:

- Compute and storage: DigitalOcean
- Database: MongoDB Atlas (preferred) or DO Managed MongoDB (acceptable fallback)
- Optional static frontend hosting: Vercel/Netlify or DO App Platform

Rationale:

- DigitalOcean provides simple VM + block volume + object storage flows for file-heavy RAG artifacts.
- MongoDB Atlas reduces DB operational load and provides mature managed backup/restore workflows.
- FAISS CPU (`faiss-cpu`) is compatible with standard Ubuntu droplets.

## 4) Target Architecture

### Services

- Frontend service (future): web UI.
- API service: FastAPI runtime for auth/profile/questions/posts/retrieval endpoints.
- Worker service: scheduled/manual SEMRAG build and recovery jobs.
- Redis (optional but recommended): job queue and distributed lock provider.
- MongoDB: application data store.
- Object storage: artifact backups and version snapshots.

### Isolation Principle (No-Clash Core Rule)

- API is read-only for retrieval artifacts.
- Worker is the only writer for retrieval artifacts.
- Artifact promotion is versioned + atomic (no in-place overwrite of active files).

## 5) Deployment Topology (Phase 1 and Phase 2)

### Phase 1 (MVP Production)

- 1x API droplet: 4 vCPU, 8 GB RAM, Ubuntu 22.04 LTS.
- 1x Worker droplet: 4 vCPU, 8-16 GB RAM (or colocated temporarily with API if budget constrained).
- 1x Block Volume: 200 GB mounted at `/data`.
- 1x Object storage bucket (Spaces): backup/snapshots.
- 1x Managed MongoDB cluster.

### Phase 2 (Scale Up)

- Separate API and worker permanently.
- Add load balancer in front of 2+ API droplets.
- Increase volume and Mongo tier based on artifact growth and QPS.
- Add Redis-backed queue for controlled worker concurrency and lock management.

## 6) Storage Design

### Hot Storage (attached block volume)

All active read/write artifacts live under `/data`:

- `/data/artifacts/builds/<artifact_version>/...`
- `/data/artifacts/current` (symlink/pointer to active version)
- `/data/logs/jobs/...`

Recommended artifact contents per version:

- `faiss_index.bin`
- chunks payload used for retrieval
- `semrag_graph.json`
- `semrag_chunks.json`
- `semrag_extraction_cache.json`
- build manifest (checksums, counts, built timestamp, git commit SHA)

### Cold Storage (object storage)

Store immutable snapshots under:

- `s3://<bucket>/artifacts/<artifact_version>/...`
- `s3://<bucket>/checkpoints/<date>/...`
- `s3://<bucket>/run-reports/<date>/...`

Retention baseline:

- Daily snapshots: keep 30 days.
- Weekly snapshots: keep 12 weeks.
- Monthly snapshots: keep 12 months (or per compliance needs).

## 7) Artifact Lifecycle and Atomic Promotion

### Build Pipeline (Worker)

1. Acquire distributed lock (`artifact_build_lock`).
2. Build artifacts in isolated path: `/data/artifacts/builds/<new_version>`.
3. Run validation suite:
   - FAISS load sanity check.
   - required file existence check.
   - non-empty entities/relations thresholds.
   - sample retrieval smoke tests.
4. Write `manifest.json` with checksums and metadata.
5. Upload full version to object storage.
6. Atomically update `/data/artifacts/current` pointer.
7. Release lock.

### Rollback

- Point `/data/artifacts/current` back to previous known-good version.
- Restart/reload API workers.
- Record incident details in run report.

## 8) Environment and Secret Management

Use separate env scopes:

- `api.env`: API runtime vars (JWT, Mongo URI, minimal model keys if needed by endpoints).
- `worker.env`: build/recovery vars (OpenAI/Gemini/DeepSeek, SEMRAG controls, storage creds).
- `frontend.env`: frontend-safe and public vars only.

Security controls:

- Never commit `.env`.
- Rotate keys quarterly or on incident.
- Principle of least privilege for object storage credentials.

## 9) CI/CD and Release Strategy

### Independent Pipelines

- Frontend deploy pipeline.
- API deploy pipeline.
- Worker deploy pipeline.
- Artifact build/promotion pipeline (separate from API release).

### Branch/Release Policy

- Merge to main triggers staging deployment.
- Production deployment requires manual approval.
- Artifact promotion requires validation report + explicit approval.

## 10) Runtime Configuration and Process Model

### API Process

- Nginx reverse proxy + TLS.
- Gunicorn with Uvicorn workers.
- Health endpoints:
  - liveness
  - readiness (includes Mongo ping + artifact version loaded)

### Worker Process

- Scheduled jobs for refresh/rebuild.
- Manual trigger endpoint/CLI for urgent rebuild.
- Concurrency cap to avoid disk and API quota saturation.

## 11) Observability and Ops

### Metrics

- API latency, error rates, request volume.
- Worker throughput, retries, failures, build duration.
- Artifact sizes and build frequency.
- Mongo connection/latency metrics.

### Logs

- Structured JSON logs from API and worker.
- Correlation IDs for request-to-job tracing.
- Centralized log retention (at least 14-30 days).

### Alerting

- Build failed.
- Artifact validation failed.
- API readiness failing.
- Backup sync failed.

## 12) Backup and Disaster Recovery

### Database

- Managed backups enabled, tested monthly restore drill.

### Artifacts

- Automatic sync to object storage after each promotion.
- Nightly verification job:
  - checksum integrity
  - latest snapshot presence
  - restorable bundle test

### Recovery RTO/RPO Targets (initial)

- RTO: 1-2 hours.
- RPO: <=24 hours (improve later with higher snapshot frequency).

## 13) Security Baseline

- TLS enforced end-to-end where possible.
- Restricted inbound ports (80/443 only public; SSH restricted to office/VPN IP).
- Non-root service users.
- Regular OS patching window.
- Rate limiting on auth endpoints.
- Secret scanning in CI.

## 14) Capacity Planning (Initial)

- API node: 4 vCPU / 8 GB RAM.
- Worker node: 4-8 vCPU / 8-16 GB RAM.
- Storage: start 200 GB block volume, monitor monthly growth.
- Scale triggers:
  - API p95 latency > SLO for 3 consecutive days.
  - Worker build time exceeds maintenance window.
  - Storage utilization > 70%.

## 15) Cost Guardrails

- Keep API and worker separated only when usage justifies it; colocate temporarily for MVP.
- Use object storage lifecycle rules aggressively.
- Archive stale artifact versions.
- Track monthly cost by service (compute, DB, storage, bandwidth).

## 16) Implementation Plan (Execution Sequence)

### Step 1: Infrastructure provisioning

- Create droplets, volume, VPC/network rules, managed DB, object bucket.

### Step 2: Runtime setup

- Install runtime dependencies, process manager, reverse proxy, TLS.
- Configure env files and secret injection.

### Step 3: Data and artifact bootstrap

- Upload/import initial artifacts and DB seed.
- Validate API startup and retrieval smoke tests.

### Step 4: CI/CD wiring

- Enable staging and production pipelines with manual gates.

### Step 5: Backup and monitoring

- Enable scheduled backups, alerts, and dashboarding.

### Step 6: Controlled go-live

- Run pilot traffic window.
- Confirm SLOs and incident runbooks.
- Approve production traffic ramp.

## 17) Risks and Mitigations

- Risk: artifact corruption during rebuild.
  - Mitigation: isolated build paths + manifest checksums + atomic pointer switch.
- Risk: API serving partially updated data.
  - Mitigation: API reads only `current` promoted version.
- Risk: runaway storage growth.
  - Mitigation: lifecycle retention and monthly storage review.
- Risk: provider lock-in.
  - Mitigation: S3-compatible backup format and infrastructure-as-code templates.

## 18) Review Checklist for Approval

- Architecture separation accepted (API read-only vs worker write-only)?
- Sizing accepted for first 3 months?
- Mongo hosting choice finalized (Atlas vs DO managed)?
- Backup retention and RTO/RPO approved?
- Security baseline approved by senior reviewer?
- Budget envelope approved?
- Go-live criteria and rollback runbook accepted?

## 19) Final Recommendation

Proceed with:

- DigitalOcean for compute + hot/cold artifact storage.
- MongoDB Atlas for database.
- Versioned artifact lifecycle with atomic promotion and single-writer guarantees.

This gives the best balance of reliability, operational simplicity, and compatibility with the current FastAPI + FAISS + SEMRAG file-heavy architecture.
