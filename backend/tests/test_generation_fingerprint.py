"""
Tests for the generation fingerprint — the identity of one post generation.

No Mongo, no model calls: build_fingerprint is pure. These guard the two ways
the rule can fail silently. It can be too strict, handing users a free
regeneration because something unrelated to their settings changed; or too
loose, letting the same settings through twice.
"""

from backend.services.generation_fingerprint import build_fingerprint


def _inputs(**overrides):
    base = dict(
        news_id="65f000000000000000000001",
        user_id="65f000000000000000000002",
        profile={
            "tone": "Fierce, uncompromising, urgent",
            "target_platform": "X (Twitter)",
            "political_party": "Indian National Congress",
            # Rendered prose the model reads. Not user intent.
            "party_position": "Write as a district president: speak for the "
                              "district organisation, not the national party.",
            "party_preferences": "Q1. What should the post lead with? -> Policy",
            "position_preferences": "Q1. How hard to push? -> Firmly",
            "language": "hi",
        },
        party_position_id="district_president",
        party_answers={"party_inc_q1": "Policy record", "party_inc_q2": "Firmly"},
        position_answers={"pos_inc_district_q1": "Local delivery"},
    )
    base.update(overrides)
    return base


def test_same_inputs_give_same_fingerprint():
    first, _ = build_fingerprint(**_inputs())
    second, _ = build_fingerprint(**_inputs())
    assert first == second


def test_key_order_does_not_change_fingerprint():
    """A dict built in a different order is the same settings."""
    forward = _inputs()
    reversed_profile = dict(reversed(list(forward["profile"].items())))
    reordered = _inputs(profile=reversed_profile)
    assert build_fingerprint(**forward)[0] == build_fingerprint(**reordered)[0]


def test_changing_a_profile_field_changes_fingerprint():
    baseline, _ = build_fingerprint(**_inputs())
    profile = dict(_inputs()["profile"])
    profile["tone"] = "Measured, evidence-led"
    changed, _ = build_fingerprint(**_inputs(profile=profile))
    assert changed != baseline


def test_changing_platform_changes_fingerprint():
    """Platform is a picker on the generate screen and counts as a change."""
    baseline, _ = build_fingerprint(**_inputs())
    profile = dict(_inputs()["profile"])
    profile["target_platform"] = "Instagram"
    assert build_fingerprint(**_inputs(profile=profile))[0] != baseline


def test_changing_a_party_answer_changes_fingerprint():
    baseline, _ = build_fingerprint(**_inputs())
    changed, _ = build_fingerprint(
        **_inputs(party_answers={"party_inc_q1": "Constitutional values",
                                 "party_inc_q2": "Firmly"})
    )
    assert changed != baseline


def test_changing_a_position_answer_changes_fingerprint():
    baseline, _ = build_fingerprint(**_inputs())
    changed, _ = build_fingerprint(
        **_inputs(position_answers={"pos_inc_district_q1": "State leadership"})
    )
    assert changed != baseline


def test_editing_question_wording_does_not_change_fingerprint():
    """
    The most important test here.

    party_preferences and position_preferences are rendered for the model and
    embed the question text straight from the questions collection, and
    party_position is a guidance paragraph from party_roles. If any of those
    reached the hash, fixing a typo in a question would change every stored
    fingerprint at once and hand every user a fresh generation of every story
    they had already written -- with nothing in the logs to say why.
    """
    baseline, _ = build_fingerprint(**_inputs())
    profile = dict(_inputs()["profile"])
    profile["party_preferences"] = "Q1. What should the post lead with? -> Policy record"
    profile["position_preferences"] = "Q1. How firmly should you push? -> Firmly"
    profile["party_position"] = "Completely reworded guidance for a district president."
    assert build_fingerprint(**_inputs(profile=profile))[0] == baseline


def test_interface_language_does_not_change_fingerprint():
    """
    Posts are Hindi whatever the interface language is (POST_OUTPUT_LANGUAGE),
    and the UI sends its language on every generate. Hashing it would let a
    user flip to English and unlock a "new" generation producing an identical
    Hindi post.
    """
    baseline, _ = build_fingerprint(**_inputs())
    profile = dict(_inputs()["profile"])
    profile["language"] = "en"
    assert build_fingerprint(**_inputs(profile=profile))[0] == baseline


def test_blank_and_missing_values_match():
    """Clearing a field is not a change, so it must not unlock a generation."""
    profile = dict(_inputs()["profile"])
    profile["personal_story"] = "   "
    with_blank, _ = build_fingerprint(**_inputs(profile=profile))

    profile.pop("personal_story")
    without, _ = build_fingerprint(**_inputs(profile=profile))
    assert with_blank == without


def test_refinement_note_changes_fingerprint():
    """
    The note is what separates a refinement from the generation it came from.
    Without it in the hash the two would collide and the refinement could not
    be recorded as its own entry.
    """
    baseline, _ = build_fingerprint(**_inputs())
    refined, _ = build_fingerprint(**_inputs(refinement_note="make it angrier"))
    assert refined != baseline

    other, _ = build_fingerprint(**_inputs(refinement_note="add a Periyar reference"))
    assert other != refined


def test_blank_note_matches_no_note():
    """A whitespace-only note is no note, so it cannot pass as a difference."""
    none_given, _ = build_fingerprint(**_inputs(refinement_note=None))
    blank, _ = build_fingerprint(**_inputs(refinement_note="   "))
    assert none_given == blank


def test_payload_carries_raw_values_not_prose():
    """
    The returned payload is stored on the post so a refusal can be explained.
    It must hold the stored id and the answer maps, not the prose.
    """
    _, payload = build_fingerprint(**_inputs())
    assert payload["party_position"] == "district_president"
    assert payload["party_answers"]["party_inc_q1"] == "Policy record"
    assert "party_preferences" not in payload["profile"]
    assert "position_preferences" not in payload["profile"]
    assert "language" not in payload["profile"]
