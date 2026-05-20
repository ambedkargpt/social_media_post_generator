"""Lightweight import smoke tests for CI (no external services)."""


def test_worker_paths_resolve():
    from backend.worker.paths import artifacts_root, builds_dir

    assert str(builds_dir()).endswith("builds")


def test_manifest_filenames_non_empty():
    from backend.worker.manifest import ARTIFACT_FILENAMES

    assert "faiss_index.bin" in ARTIFACT_FILENAMES
