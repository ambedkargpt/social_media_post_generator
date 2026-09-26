"""
The party is set once and then fixed. The position is not.

Every answer is stored against an id that names the party - `party_inc_q1`,
`pos_inc_national_q3` - so a writer who moves to another party leaves all
fifteen behind at once, and the posts change character with nothing on screen
to explain it.

A position change is the ordinary case rather than that: people are promoted,
move between a district and a state body, join a frontal wing. The ten party
answers still apply afterwards, and only the five written for the old level
stop being read.
"""
from __future__ import annotations

from datetime import datetime, timezone

import pytest
from fastapi import HTTPException


INC = "Indian National Congress (INC)"
BSP = "Bahujan Samaj Party (BSP)"
POSITION = "national_vice_president"


@pytest.fixture
def service(monkeypatch):
    """AuthService with the user row and the token check stubbed."""
    from backend.services.auth_service import AuthService

    svc = AuthService.__new__(AuthService)   # no __init__: nothing else is used

    # update_profile builds its UserPublic inline from the stored row, so the
    # row has to carry the fields that response requires.
    BASE = {
        "_id": "u1",
        "username": "tester",
        "created_at": datetime(2026, 1, 1, tzinfo=timezone.utc),
        "auth_providers": ["email"],
    }

    class _Users:
        row: dict = {}
        saved: dict = {}

        def find_by_id(self, _id):
            return {**BASE, **self.row}

        def update_profile(self, _id, fields):
            self.saved = dict(fields)
            self.row = {**self.row, **fields}
            return {**BASE, **self.row}

        def find_by_username(self, _u):
            return None

    svc.users_repo = _Users()
    monkeypatch.setattr(svc, "_decode_or_401", lambda *a, **k: {"sub": "u1"}, raising=False)
    return svc


def _update(svc, **kwargs):
    return svc.update_profile(
        "Bearer t", full_name=None, username=None, **kwargs
    )


def test_a_party_can_be_set_when_there_is_none(service):
    """Locking a choice is not the same as forcing one."""
    service.users_repo.row = {"_id": "u1"}

    _update(service, political_party=INC)

    assert service.users_repo.saved["political_party"] == INC


def test_the_party_cannot_be_changed_once_set(service):
    """The whole point."""
    service.users_repo.row = {"_id": "u1", "political_party": INC}

    with pytest.raises(HTTPException) as caught:
        _update(service, political_party=BSP)

    assert caught.value.status_code == 409
    assert "cannot be changed" in caught.value.detail
    assert service.users_repo.saved == {}


def test_resending_the_same_party_is_not_an_error(service):
    """Saving the profile form again must not fail on a field nobody touched."""
    service.users_repo.row = {"_id": "u1", "political_party": INC}

    _update(service, political_party=INC)

    assert service.users_repo.saved["political_party"] == INC


def test_a_position_can_be_set_when_there_is_none(service):
    service.users_repo.row = {"_id": "u1", "political_party": INC}

    _update(service, party_position=POSITION)

    assert service.users_repo.saved["party_position"] == POSITION


def test_the_position_can_be_changed(service):
    """People are promoted and move between bodies; the party is what is fixed."""
    service.users_repo.row = {"_id": "u1", "political_party": INC, "party_position": POSITION}

    _update(service, party_position="national_president")

    assert service.users_repo.saved["party_position"] == "national_president"


def test_changing_the_position_does_not_let_the_party_move_with_it(service):
    """The looser rule on one field must not loosen the other."""
    service.users_repo.row = {"_id": "u1", "political_party": INC, "party_position": POSITION}

    with pytest.raises(HTTPException) as caught:
        _update(service, political_party=BSP, party_position="national_president")

    assert caught.value.status_code == 409
    assert service.users_repo.saved == {}


def test_an_unknown_position_is_still_dropped_rather_than_stored(service):
    """
    The existing rule survives the new one.

    A stale id would sit on the user forever and resolve to no guidance at
    generation time, which looks like the setting silently doing nothing.
    """
    service.users_repo.row = {"_id": "u1", "political_party": INC}

    _update(service, party_position="not_a_real_role")

    assert service.users_repo.saved["party_position"] == ""


def test_a_position_can_be_set_after_an_unknown_one_was_dropped(service):
    """An id that was dropped to "" leaves the writer free to choose again."""
    service.users_repo.row = {"_id": "u1", "political_party": INC, "party_position": ""}

    _update(service, party_position=POSITION)

    assert service.users_repo.saved["party_position"] == POSITION


def test_other_profile_fields_are_still_editable(service):
    """This locks two fields, not the profile."""
    service.users_repo.row = {"_id": "u1", "political_party": INC, "party_position": POSITION}

    _update(service, state="Uttar Pradesh", city="Lucknow")

    assert service.users_repo.saved["state"] == "Uttar Pradesh"
    assert service.users_repo.saved["city"] == "Lucknow"
