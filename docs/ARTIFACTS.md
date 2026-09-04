# Retrieval artifacts and the rebuild worker

The API only ever *reads* retrieval artifacts. A separate worker builds them,
validates them, and publishes them atomically. This is the single most important
operational property of the system: a rebuild can run against a live API without
a window in which the API serves a half-written index.

## The artifact set

| File | Contents |
|---|---|
| `argument_chunks.json` | Chunked transcript passages with metadata and argument scores |
| `video_context.json` | Full per-video context, keyed by video title |
| `video_title_embeddings.json` | Title embeddings, used for the retrieval title bias |
| `semrag_chunks.json` | Chunks produced by the SEMRAG semantic chunker |
| `semrag_graph.json` | Entities, relations and lookup indexes |
| `semrag_extraction_cache.json` | Extraction cache, so a rebuild re-extracts only new chunks |
| `manifest.json` | SHA-256 checksum per file, build timestamp, git provenance |
| `faiss_index.bin` | Legacy dense index. Retained by the droplet path; the Pinecone path does not need it. |

Dense vectors now live in Pinecone rather than in a file. `requirements-api.txt`
records the migration explicitly — `faiss-cpu` was removed, and
`backend/worker/validate.py` replaced FAISS index validation with an
`argument_chunks.json` content check plus an optional Pinecone vector-count
check that is skipped in offline and CI builds.

## Filesystem layout

`backend/worker/paths.py` defines the layout under `ARTIFACTS_ROOT`, default
`/data/artifacts`:

```
/data/artifacts/
├── builds/
│   ├── v0-bootstrap/          first seeded build
│   ├── 2026-08-30T02-04-11Z/  one directory per rebuild
│   └── …
└── current -> builds/<version>    symlink the API reads through
```

Publishing is repointing `current`. Rollback is repointing it back. Nothing is
overwritten in place, which is why an interrupted build cannot corrupt what the
API is serving.

## Manifest and provenance

`backend/worker/manifest.py` writes a SHA-256 checksum for every file in the
build, along with a timestamp and the short git SHA from
`backend/worker/git_ops.py`. `assess_artifact_readiness` reads
`ARTIFACTS_ROOT/current/manifest.json` — which is why `/health/ready` returns
`503` on a droplet whose `ARTIFACTS_ROOT` is unset even when the files are
present.

## Single-writer locking

Two mechanisms, one per deployment target:

- **Droplet.** `backend/worker/lock.py` takes a POSIX advisory lock (`flock`) on
  a lock file. On Windows the import fails and locking degrades to a no-op; the
  module notes this is acceptable because the production worker is Linux.
- **AWS.** `auto_rebuild` acquires an S3-based distributed lock before doing
  anything, which is what allows the EventBridge schedule and the GitHub Actions
  schedule to coexist without double-running the build.

## The rebuild flow

`backend/worker/auto_rebuild.py` is the AWS Batch entry point:

1. Acquire the S3 distributed lock.
2. Download current artifacts and data files from S3 to `/tmp`, reusing the
   incremental caches so only genuinely new chunks are re-embedded.
3. Optionally fetch new YouTube transcripts (`FETCH_NEW_TRANSCRIPTS=1`).
4. Run the build: chunking → embedding → Pinecone upsert → SEMRAG graph →
   validate → manifest.
5. Upload the produced artifacts back to S3 under `artifacts/current/`.
6. Archive a versioned copy under `artifacts/builds/<version>/`.

The incremental cache is the reason a routine rebuild is cheap: embedding cost
scales with new transcript volume, not with corpus size.

## Worker CLIs

Run from the repository root with `PYTHONPATH` set to it.

| Command | Purpose |
|---|---|
| `python -m backend.worker.build_artifacts --once` | Build into `builds/<version>/`, validate, write manifest, promote |
| `python -m backend.worker.promote_artifact --from <dir>` | Validate an existing build directory and point `current` at it |
| `python -m backend.worker.rollback_artifact` | Point `current` at the previous build |
| `python -m backend.worker.backup_artifacts` | Upload the promoted tree to S3-compatible storage |

`backup_artifacts` reads `S3_ENDPOINT_URL` (or `SPACES_ENDPOINT`), `S3_BUCKET`
(or `SPACES_BUCKET`), `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` (or
`SPACES_KEY` / `SPACES_SECRET`), and `S3_ARTIFACT_PREFIX` (default `artifacts`).
It runs after a successful promote, so a backup always corresponds to something
that passed validation.

## Scheduling

Two independent triggers exist, both safe because of the S3 lock:

- **EventBridge Scheduler** is the production cron: `cron(0 2 */2 * ? *)` —
  every two days at 02:00 UTC, 07:30 IST.
- **`.github/workflows/rebuild.yml`** fires on the same cadence at 02:05 UTC. The
  five-minute offset avoids an exact simultaneous double-submit. It submits the
  Batch job, polls until `SUCCEEDED` or `FAILED` (bounded by the ~3 hour Actions
  job timeout), and writes the result to the job summary.

The workflow also supports manual dispatch with two inputs: `skip_semrag` to
build only the RAG artifacts, and `force_full` to ignore the incremental cache
and re-embed everything.

On the droplet the equivalent is `ambedkar-worker.timer`. Note the operational
trap recorded in `deploy/README.md`: `systemctl restart ambedkar-worker.service`
runs a full one-shot build immediately — it is not a config reload. To apply a
changed `worker.env` without building, edit the file and let the next timer run
pick it up.

## First-time bootstrap

A fresh environment has no `current`, so `/health/ready` fails. Seed one build
and promote it:

```bash
sudo mkdir -p /data/artifacts/builds/v0-bootstrap
sudo rsync -a ./argument_chunks.json ./video_context.json ./video_title_embeddings.json \
  ./semrag_graph.json ./semrag_chunks.json ./semrag_extraction_cache.json \
  /data/artifacts/builds/v0-bootstrap/
sudo chown -R ambedkar:ambedkar /data/artifacts/builds/v0-bootstrap
```

```bash
sudo -u ambedkar bash -c 'cd /srv/ambedkar/app && PYTHONPATH=/srv/ambedkar/app /srv/ambedkar/venv/bin/python -m backend.worker.promote_artifact --from /data/artifacts/builds/v0-bootstrap'
```

The worker also needs the master transcript on disk before it can build. Copy it
to `/data/transcripts/` owned by `ambedkar` and point `TRANSCRIPT_MASTER_PATH`
at it; the worker fails immediately with `Transcript master not found` otherwise.

## After a promotion

Restarting `ambedkar-api.service` is optional but forces the in-memory SEMRAG
graph cache and the `_RAG_CACHE` tuple to reload immediately. Without a restart
the API keeps serving from the artifacts it loaded at startup until the process
recycles.

## Related scripts

`backend/scripts/` holds the operational tooling around this flow, including
SEMRAG extraction batches with checkpointing, recovery after an interruption,
graph rebuild from already-extracted artifacts
(`build_semrag_graph_from_extracted.py`), validation, local and global graph
search CLIs, per-tenant corpus construction (`build_tenant_corpus.py`), tenant
isolation checks (`check_isolation.py`) and Pinecone upload
(`pinecone_upload.py`).
