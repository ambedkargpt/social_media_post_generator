from __future__ import annotations

import hashlib
import json
from typing import Any


# Bumping this invalidates every stored fingerprint, which hands every user a
# fresh generation of every story they have already written. Bump it only when
# the set of inputs genuinely changes, never to force a recompute.
FINGERPRINT_VERSION = 1


# Rendered prose, not user intent. Each of these is built for the model to read
# and carries text from outside the user's answers, so hashing it would make an
# unrelated edit look like the user changed their mind:
#
#   party_position       -> the guidance paragraph from party_roles.guidance_for
#   party_preferences    -> question text + answer, from the questions collection
#   position_preferences -> same
#
# The raw values behind them are hashed instead: party_position as its stored id,
# the two preference blocks as their {question_id: answer} maps.
_RENDERED_PROSE_FIELDS = frozenset(
    {"party_position", "party_preferences", "position_preferences"}
)

# Sent on every generate but does not reach the output: posts are Hindi whatever
# the interface language is. Hashing it would let a user flip the UI to English
# and unlock a "new" generation that produces a byte-identical Hindi post.
_NON_INPUT_FIELDS = frozenset({"language"})


def _canonical_value(value: Any) -> Any:
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, dict):
        return {str(k): _canonical_value(v) for k, v in value.items() if not _is_blank(v)}
    if isinstance(value, (list, tuple)):
        return [_canonical_value(v) for v in value if not _is_blank(v)]
    return value


def _is_blank(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return not value.strip()
    if isinstance(value, (list, tuple, dict)):
        return len(value) == 0
    return False


def build_fingerprint(
    *,
    news_id: str,
    user_id: str,
    profile: dict[str, Any],
    party_position_id: str | None,
    party_answers: dict[str, Any] | None,
    position_answers: dict[str, Any] | None,
    refinement_note: str | None = None,
) -> tuple[str, dict[str, Any]]:
    """
    The identity of one generation: who, which story, and every setting that
    shaped the post. Returns the sha256 and the canonical payload it was taken
    over, so a later refusal can be explained rather than just asserted.

    A blank value and a missing one hash alike, so a user who clears a field is
    not handed a new combination for having done nothing.
    """
    payload: dict[str, Any] = {
        "v": FINGERPRINT_VERSION,
        "news_id": str(news_id),
        "user_id": str(user_id),
        "profile": {
            key: _canonical_value(value)
            for key, value in (profile or {}).items()
            if key not in _RENDERED_PROSE_FIELDS
            and key not in _NON_INPUT_FIELDS
            and not _is_blank(value)
        },
        "party_position": (party_position_id or "").strip(),
        "party_answers": _canonical_value(party_answers or {}),
        "position_answers": _canonical_value(position_answers or {}),
    }
    # Only present on a refine. The note is what the user asked to be different,
    # so it is the one thing separating a refined post from the post it came
    # from -- without it the two would collide on the same fingerprint.
    note = (refinement_note or "").strip()
    if note:
        payload["refinement_note"] = note

    payload = {k: v for k, v in payload.items() if not _is_blank(v) or k == "v"}
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest(), payload
