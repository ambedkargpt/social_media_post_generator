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


# ── the anchor's voice ──────────────────────────────────────────────────────

def test_the_voice_mapping_is_sent_whole(monkeypatch):
    """
    A dict setting read from the environment REPLACES pydantic's default; it
    does not merge. Sending only {"sarvam": ...} would leave every other
    provider without a speaker, so a day when Sarvam is down would fail at the
    fallback instead of quietly carrying on - which is the whole point of
    having one.
    """
    import json

    from backend.worker import build_radio

    voices = json.loads(build_radio.DEFAULTS["BHEEM_TTS_VOICES"])

    assert voices["sarvam"] == {"hi": "ritu", "en": "ritu"}
    # The fallback provider must still have a voice of its own.
    assert voices["gemini"]["hi"], "the Gemini fallback lost its speaker"
    assert set(voices) >= {"sarvam", "gemini", "openai", "minimax", "fake"}


def test_sarvam_speaker_names_are_lowercase():
    """Sarvam's catalogue is case-sensitive; "Shreya" is a 4xx, not a voice."""
    import json

    from backend.worker import build_radio

    for lang, name in json.loads(build_radio.DEFAULTS["BHEEM_TTS_VOICES"])["sarvam"].items():
        assert name == name.lower(), f"{lang}: {name!r} must be lowercase"


def test_expressiveness_stays_inside_what_the_api_accepts():
    """
    Bheem Radio's config documents the range as 0.01-2.0. The live API answers
    400 to anything above 1.0 - measured, not read. A value over the cap would
    fail every bulletin at the first narration, so it is pinned here rather
    than discovered in a build.
    """
    from backend.worker import build_radio

    temperature = float(build_radio.DEFAULTS["BHEEM_SARVAM_TEMPERATURE"])
    assert 0.01 <= temperature <= 1.0, "Sarvam rejects expressiveness above 1.0"


# ── the bulletin's shape ────────────────────────────────────────────────────

def test_every_default_names_a_real_setting(monkeypatch):
    """
    pydantic-settings ignores an environment variable it does not recognise, so
    a misspelled name is silent: the build runs, the setting keeps its default,
    and nothing says why the bulletin is the wrong length. BHEEM_LOOKBACK_DAYS
    was exactly that typo - the field is daily_lookback_days.

    Checked against the real Settings model when it is installed, and skipped
    where it is not, because bheem_radio only lives in the radio image.
    """
    import pytest

    from backend.worker import build_radio

    Settings = pytest.importorskip("bheem_radio.config").Settings

    known = {f"BHEEM_{name.upper()}" for name in Settings.model_fields}
    ours = {k for k in build_radio.DEFAULTS if k.startswith("BHEEM_")}

    unknown = sorted(ours - known)
    assert not unknown, f"not settings on bheem_radio.Settings: {unknown}"


def test_the_bulletin_covers_one_day_of_every_party():
    """
    The shape the station was asked for: an hour, every party, dealt in turns.

    An hour comes from the number of stories, never from longer scripts. A
    story carries about 133 words of source against a 140-word target, so
    writing to the ~220 words an hour would otherwise need means inventing the
    difference - on a broadcast that loops all day. Two days of stories at
    their honest length gets there instead.
    """
    from backend.worker import build_radio

    assert build_radio.DEFAULTS["BHEEM_DAILY_LOOKBACK_DAYS"] == "2"
    pool = build_radio.DEFAULTS["RADIO_POOL"].split(",")
    assert set(pool) == {"congress", "bjp", "samajwadi", "general"}


def test_stories_are_dealt_in_turns_not_in_blocks():
    """
    One from each party in turn, so a short cap takes from everyone. Blocks
    would have put all of Congress first and cut BJP off the end.
    """
    from backend.worker import build_radio

    class Story:
        def __init__(self, sid, tenant):
            self.id, self.tenant = sid, tenant

    class Inner:
        def stories(self, tenant, start, end):
            counts = {"congress": 3, "bjp": 2, "samajwadi": 1, "general": 2}
            return [Story(f"{tenant}-{i}", tenant) for i in range(counts.get(tenant, 0))]

    source = build_radio.RoundRobinSource(Inner(), ["congress", "bjp", "samajwadi", "general"])
    dealt = [s.tenant for s in source.stories("congress", None, None)]

    # First round is one of each, in the configured order.
    assert dealt[:4] == ["congress", "bjp", "samajwadi", "general"]
    # Nothing is lost when a party runs out mid-deal.
    assert len(dealt) == 8
    assert dealt.count("congress") == 3 and dealt.count("samajwadi") == 1


def test_a_story_tagged_for_two_parties_plays_once():
    """A story can carry more than one tenant; hearing it twice is a bug."""
    from backend.worker import build_radio

    class Story:
        def __init__(self, sid, tenant):
            self.id, self.tenant = sid, tenant

    class Inner:
        def stories(self, tenant, start, end):
            return [Story("shared", tenant), Story(f"{tenant}-own", tenant)]

    source = build_radio.RoundRobinSource(Inner(), ["congress", "bjp"])
    ids = [s.id for s in source.stories("congress", None, None)]

    assert ids.count("shared") == 1
    assert sorted(ids) == ["bjp-own", "congress-own", "shared"]


# ── what keeps wrong news off the air ───────────────────────────────────────

def test_the_fact_checker_is_never_off():
    """
    A post can be corrected after it is published. A bulletin is read aloud and
    then plays on a loop all day. The checker is on by default upstream, which
    is exactly why it is pinned here: a default can change when the pinned
    commit moves, and nothing would say so.
    """
    from backend.worker import build_radio

    assert build_radio.DEFAULTS["BHEEM_DAILY_FACT_CHECK"] == "1"


def test_the_checker_is_a_different_model_from_the_writer(monkeypatch):
    """
    A model checking its own work shares its own blind spots: it will not see
    the number it just invented. The whole value of the check is that a second
    model, trained differently, reads the script against the source.
    """
    import os

    from backend.worker import build_radio

    for name in ("SARVAM_API_KEY", "GEMINI_API_KEY", "DEEPSEEK_API_KEY", "MONGODB_URI"):
        monkeypatch.setenv(name, "x")
    for name in list(os.environ):
        if name.startswith("BHEEM_"):
            monkeypatch.delenv(name, raising=False)

    build_radio.prepare_environment()

    writer = os.environ["BHEEM_LLM_SCRIPT_WRITER"]
    checker = os.environ["BHEEM_LLM_FACT_CHECKER"]

    assert writer and checker
    assert writer.split(":")[0] != checker.split(":")[0], (
        f"writer and checker are both {writer.split(':')[0]}; the check is worth "
        "nothing when one model marks its own work"
    )


def test_the_hour_is_made_of_stories_not_of_longer_ones():
    """
    Measured, not assumed. Raising the target to 190 words to stretch 53
    stories into an hour moved nothing: 37.7 minutes became 38.3, and 35,138
    TTS characters became 35,010. The writer does not pad to a number - it
    writes what the source carries, about 133 words a story.

    So the length is set below what the source supports and the hour comes
    from the count. This test holds that arithmetic together: change one of
    these and it says whether the bulletin still lands in the band.
    """
    from backend.worker import build_radio

    words = int(build_radio.DEFAULTS["RADIO_TARGET_WORDS"])
    cap = int(build_radio.DEFAULTS["BHEEM_DAILY_MAX_STORIES"])

    # Measured on the 7 October build, not derived: 126 stories ran 4583 s,
    # which is 36.4 s each against a 70-word target - the writer lands above
    # the words/second the prompt assumes. 126 of 128 survived the checker.
    SECONDS_PER_STORY = 36.4
    SURVIVES_FACT_CHECK = 126 / 128

    seconds = SECONDS_PER_STORY
    minutes = cap * SURVIVES_FACT_CHECK * seconds / 60

    assert words <= 133, "the target is above what a story's source carries"
    assert 55 <= minutes <= 65, (
        f"{cap} stories of {seconds:.0f}s is about {minutes:.0f} min, not 60 +/- 5"
    )


def test_the_prompt_still_refuses_padding():
    """The ceiling is lower now; the refusal still has to be in the prompt."""
    from backend.worker import build_radio

    replacement = " ".join(build_radio._LENGTH_LINE_TO.split())
    assert "ceiling, never a quota" in replacement
    for forbidden in ("repeating a point", "background the source does not state",
                      "Inventing a number"):
        assert forbidden in replacement, f"the padding refusal lost: {forbidden!r}"

def test_the_prompt_patch_fails_loudly_when_upstream_moves(tmp_path, monkeypatch):
    """
    The override rewrites one line of their prompt. If they reword it, a silent
    no-op would leave the bulletin at their length with nothing to say why - so
    it raises instead.
    """
    import pytest

    from backend.worker import build_radio

    (tmp_path / "script_writer.md").write_text("nothing like the line", encoding="utf-8")
    monkeypatch.setenv("BHEEM_PROMPTS_DIR", str(tmp_path))

    with pytest.raises(RuntimeError, match="no longer contains"):
        build_radio._write_prompts(190)


# ── the cloned station voice ────────────────────────────────────────────────

def test_the_clone_is_off_unless_asked_for(monkeypatch):
    """
    A cloned voice costs twelve minutes of rate-limited waiting on a full
    bulletin and takes no expressiveness setting, so it is never the default.
    """
    import os

    from backend.worker import build_radio

    for name in ("SARVAM_API_KEY", "GEMINI_API_KEY", "DEEPSEEK_API_KEY", "MONGODB_URI"):
        monkeypatch.setenv(name, "x")
    for name in list(os.environ):
        if name.startswith(("BHEEM_", "RADIO_")):
            monkeypatch.delenv(name, raising=False)

    build_radio.prepare_environment()
    assert "BHEEM_STATION_VOICE" not in os.environ


def test_the_registry_entry_is_usable_today():
    """
    bheem_radio refuses a voice with no consent on record, a passed expiry or a
    revocation - quietly falling back to the stock voice and logging it. A
    registry that cannot be used would mean the demo runs in the wrong voice
    with only a log line to say why.
    """
    import json
    import pathlib

    registry = json.loads(
        (pathlib.Path("backend/worker/radio_voices/registry.json")).read_text(encoding="utf-8")
    )
    entry = next(v for v in registry["voices"] if v["name"] == "station")

    assert entry["consents"], "no consent on record; the voice would be refused"
    assert not entry["revoked"]
    assert entry["provider_voices"]["sarvam"].startswith("svc-"), (
        "the dispatch is on the svc- prefix; anything else is read as a stock speaker"
    )
