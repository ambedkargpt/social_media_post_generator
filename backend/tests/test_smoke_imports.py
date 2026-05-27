"""Lightweight import smoke tests for CI (no external services)."""


def test_worker_paths_resolve():
    from backend.worker.paths import artifacts_root, builds_dir

    assert str(builds_dir()).endswith("builds")


def test_manifest_filenames_non_empty():
    from backend.worker.manifest import ARTIFACT_FILENAMES

    # faiss_index.bin removed — Pinecone is cloud-managed, no local index file.
    assert "argument_chunks.json" in ARTIFACT_FILENAMES
    assert "faiss_index.bin" not in ARTIFACT_FILENAMES
