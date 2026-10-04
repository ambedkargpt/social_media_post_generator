"""
The Lambda that starts the day's radio builds.

Neither AWS nor Bheem Radio is called. What matters here is that four jobs go
out once a day and that one party failing does not take the others with it -
a build that is never submitted leaves yesterday's bulletin on air, and nobody
finds out until someone notices the date.
"""
from __future__ import annotations

import pytest

from backend.worker import radio_handler


class _FakeBatch:
    def __init__(self, *, fail_for: set[str] | None = None):
        self.fail_for = fail_for or set()
        self.submitted: list[dict] = []

    def submit_job(self, **kwargs):
        tenant = kwargs["parameters"]["tenant"]
        if tenant in self.fail_for:
            raise RuntimeError("Batch said no")
        self.submitted.append(kwargs)
        return {"jobId": f"job-{tenant}"}


@pytest.fixture
def aws(monkeypatch):
    monkeypatch.setenv("BATCH_JOB_QUEUE", "ambedkargpt-worker-queue")
    monkeypatch.setenv("RADIO_JOB_DEFINITION", "ambedkargpt-radio")
    monkeypatch.delenv("RADIO_TENANTS", raising=False)
    batch = _FakeBatch()
    # Through the module's own seam, so the test does not need boto3 - CI
    # installs requirements-api.txt only.
    monkeypatch.setattr(radio_handler, "_batch", lambda: batch)
    return batch


def test_one_job_per_party(aws):
    result = radio_handler.handler()

    assert result["ok"] is True
    assert [j["parameters"]["tenant"] for j in aws.submitted] == \
        ["congress", "bjp", "samajwadi", "general"]
    assert all(j["jobDefinition"] == "ambedkargpt-radio" for j in aws.submitted)


def test_the_tenant_goes_as_a_job_parameter(aws):
    """The job definition's command is `--tenant Ref::tenant`."""
    radio_handler.handler()

    assert aws.submitted[0]["parameters"] == {"tenant": "congress"}


def test_one_party_failing_does_not_stop_the_others(monkeypatch):
    """
    The whole reason submission is wrapped.

    Four parties, one Batch error: the other three must still get a bulletin.
    """
    monkeypatch.setenv("BATCH_JOB_QUEUE", "q")
    monkeypatch.setenv("RADIO_JOB_DEFINITION", "d")
    monkeypatch.delenv("RADIO_TENANTS", raising=False)
    batch = _FakeBatch(fail_for={"bjp"})
    monkeypatch.setattr(radio_handler, "_batch", lambda: batch)

    result = radio_handler.handler()

    assert [j["parameters"]["tenant"] for j in batch.submitted] == \
        ["congress", "samajwadi", "general"]
    assert result["ok"] is False
    assert result["failed"][0]["tenant"] == "bjp"


def test_a_subset_can_be_run(aws, monkeypatch):
    """For re-running one party after a fix, without rebuilding all four."""
    monkeypatch.setenv("RADIO_TENANTS", "samajwadi, congress")

    radio_handler.handler()

    assert [j["parameters"]["tenant"] for j in aws.submitted] == ["samajwadi", "congress"]


def test_it_refuses_rather_than_guesses_when_unconfigured(monkeypatch):
    """A missing job definition must not silently submit nothing and report ok."""
    monkeypatch.delenv("BATCH_JOB_QUEUE", raising=False)
    monkeypatch.delenv("RADIO_JOB_DEFINITION", raising=False)
    called = []
    monkeypatch.setattr(radio_handler, "_batch", lambda: called.append(1))

    result = radio_handler.handler()

    assert result["ok"] is False
    assert "BATCH_JOB_QUEUE" in result["error"]
    assert not called, "it reached for AWS before checking its configuration"
