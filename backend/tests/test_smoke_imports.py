"""Lightweight import smoke tests for CI (no external services)."""


def test_worker_paths_resolve():
    from backend.worker.paths import artifacts_root, builds_dir

    assert str(builds_dir()).endswith("builds")


def test_manifest_filenames_non_empty():
    from backend.worker.manifest import ARTIFACT_FILENAMES

    # faiss_index.bin removed — Pinecone is cloud-managed, no local index file.
    assert "argument_chunks.json" in ARTIFACT_FILENAMES
    assert "faiss_index.bin" not in ARTIFACT_FILENAMES


def test_default_profiles_carry_every_profile_field():
    """
    Every default profile must define every field in PROFILE_FIELDS.

    get_user_profiles() validates this and raises, but nothing in CI called it,
    so adding `political_party` to PROFILE_FIELDS without adding it to the ten
    default profiles shipped a 500 on every generate request. The validation
    was right; it just was not being run.
    """
    from backend.pipeline.profiles import PROFILE_FIELDS, get_user_profiles

    profiles = get_user_profiles()          # raises if a field is missing
    assert profiles, "no default profiles defined"
    for profile in profiles:
        missing = [f for f in PROFILE_FIELDS if f not in profile]
        assert not missing, f"{profile.get('user_role')} missing {missing}"
