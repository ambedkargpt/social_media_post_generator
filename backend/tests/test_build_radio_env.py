"""
The environment mapping that stands between our worker and Bheem Radio.

Bheem reads `BHEEM_*`; our Batch job holds the same secrets under our own
names. The mapping is the whole of what `build_radio` does before handing over,
so it is the whole of what can go wrong here - and every way it goes wrong is
silent. A dropped Mongo field builds four empty bulletins and exits 0.
"""
from __future__ import annotations

import json

import pytest

from backend.worker import build_radio


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    """No BHEEM_* or source variable leaks in from the developer's shell."""
    import os

    for name in list(os.environ):
        if name.startswith("BHEEM_") or name in {
            "MONGODB_URI", "MONGODB_DATABASE", "DEEPSEEK_API_KEY",
            "GEMINI_API_KEY", "SARVAM_API_KEY", "S3_BUCKET",
        }:
            monkeypatch.delenv(name, raising=False)


def test_our_names_are_copied_onto_theirs(monkeypatch):
    """The point of the module. Their template aliases names we do not use."""
    monkeypatch.setenv("MONGODB_URI", "mongodb+srv://example")
    monkeypatch.setenv("MONGODB_DATABASE", "ambedkargpt")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "ds-key")
    monkeypatch.setenv("GEMINI_API_KEY", "gm-key")
    monkeypatch.setenv("S3_BUCKET", "ambedkargpt-artifacts")

    build_radio.prepare_environment()

    import os
    assert os.environ["BHEEM_MONGO_URI"] == "mongodb+srv://example"
    assert os.environ["BHEEM_MONGO_DB"] == "ambedkargpt"
    assert os.environ["BHEEM_DEEPSEEK_API_KEY"] == "ds-key"
    assert os.environ["BHEEM_GEMINI_API_KEY"] == "gm-key"
    # Theirs is ARTIFACTS_BUCKET; ours has always been S3_BUCKET.
    assert os.environ["BHEEM_S3_BUCKET"] == "ambedkargpt-artifacts"


def test_an_explicit_bheem_value_is_not_overwritten(monkeypatch):
    """Overriding one setting on the job definition must stay possible."""
    monkeypatch.setenv("MONGODB_URI", "mongodb+srv://ours")
    monkeypatch.setenv("BHEEM_MONGO_URI", "mongodb+srv://theirs")

    build_radio.prepare_environment()

    import os
    assert os.environ["BHEEM_MONGO_URI"] == "mongodb+srv://theirs"


def test_the_field_mapping_is_complete(monkeypatch):
    """
    The one that would be catastrophic and quiet.

    BHEEM_MONGO_FIELDS is a pydantic dict setting, so a value from the
    environment REPLACES the default rather than merging into it. Sending only
    our one override would drop `tenant -> tenant_slug` and `id -> news_id`
    with it, every query would match nothing, and four empty bulletins would
    be built without a single error.
    """
    build_radio.prepare_environment()

    import os
    fields = json.loads(os.environ["BHEEM_MONGO_FIELDS"])

    # Everything their default carries has to still be here.
    assert fields["id"] == "news_id"
    assert fields["tenant"] == "tenant_slug"
    assert fields["title"] == "headline"
    assert fields["story_type"] == "content_type"
    assert fields["published_at"] == "published_at"
    assert fields["source_url"] == "source_url"
    assert fields["source_name"] == "source_name"
    # And the one line that is ours: we have no `body`, but `description` is a
    # second paragraph their `summary or description` fallback never reaches.
    assert fields["body"] == "description"


def test_no_status_filter_is_set(monkeypatch):
    """
    Our documents have no status field - checked against production, 0 of 1317.

    Bheem skips the filter when the list is empty. Setting it to any guess
    would match nothing, which looks exactly like a quiet news day.
    """
    build_radio.prepare_environment()

    import os
    assert "BHEEM_MONGO_LIVE_STATUSES" not in os.environ


def test_without_a_sarvam_key_it_still_has_a_voice(monkeypatch):
    """
    The Sarvam subscription is not bought yet and the build has to run anyway.

    A stock Gemini voice is worth having while the cloned one is licensed;
    refusing to build until the key exists would block the whole integration
    on someone else's purchase order.
    """
    monkeypatch.setenv("GEMINI_API_KEY", "gm-key")

    build_radio.prepare_environment()

    import os
    assert os.environ["BHEEM_TTS_PRIMARY"].startswith("gemini:")


def test_with_a_sarvam_key_sarvam_leads_and_gemini_catches(monkeypatch):
    monkeypatch.setenv("SARVAM_API_KEY", "sv-key")
    monkeypatch.setenv("GEMINI_API_KEY", "gm-key")

    build_radio.prepare_environment()

    import os
    assert os.environ["BHEEM_TTS_PRIMARY"].startswith("sarvam:")
    assert os.environ["BHEEM_TTS_FALLBACK"].startswith("gemini:")


def test_the_fact_checker_is_not_the_writer(monkeypatch):
    """
    A model asked to check its own work shares its own blind spots. Bheem's
    whole fact-check step is worth nothing if both ends are the same model.
    """
    monkeypatch.setenv("GEMINI_API_KEY", "gm-key")

    build_radio.prepare_environment()

    import os
    writer = os.environ["BHEEM_LLM_SCRIPT_WRITER"].split(":")[0]
    checker = os.environ["BHEEM_LLM_FACT_CHECKER"].split(":")[0]
    assert writer != checker, "the fact-checker must be a different provider"


def test_the_stream_is_written_under_radio(monkeypatch):
    """The prefix the player and the CloudFront origin path both assume."""
    build_radio.prepare_environment()

    import os
    assert os.environ["BHEEM_STORAGE_BACKEND"] == "s3"
    assert os.environ["BHEEM_DAILY_S3_PREFIX"] == "radio/"
