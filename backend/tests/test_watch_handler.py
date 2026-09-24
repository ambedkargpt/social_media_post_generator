"""
Tests for the Lambda that decides whether to start a Batch job.

Neither AWS nor YouTube is called. What is worth guarding is the decision, and
every way it goes wrong costs real money or real stories: a container started
every few minutes for a video that can never be fetched, two containers racing
for the same transcript budget, or a backlog quietly retired unattempted.
"""
from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta

import pytest

from backend.pipeline.youtube_feed import Upload


NOW = datetime.now(UTC)


def _upload(video_id: str, *, days_old: float = 0.1) -> Upload:
    return Upload(
        video_id=video_id,
        title="शीर्षक",
        published=NOW - timedelta(days=days_old),
        url=f"https://www.youtube.com/watch?v={video_id}",
    )


class _FakeS3:
    """Just enough S3 to hold one ledger object."""

    def __init__(self):
        self.objects: dict[str, bytes] = {}

    def get_object(self, Bucket, Key):  # noqa: N803 - boto3's own casing
        if Key not in self.objects:
            raise KeyError(Key)
        return {"Body": _Body(self.objects[Key])}

    def put_object(self, Bucket, Key, Body, ContentType=None):  # noqa: N803
        self.objects[Key] = Body


class _Body:
    def __init__(self, data):
        self._data = data

    def read(self):
        return self._data


class _FakeBatch:
    def __init__(self, *, running=False):
        self.running = running
        self.submitted: list[dict] = []

    def list_jobs(self, jobQueue, jobStatus):  # noqa: N803
        if self.running and jobStatus == "RUNNING":
            return {"jobSummaryList": [{"jobName": "watch-20260924-090000"}]}
        return {"jobSummaryList": []}

    def submit_job(self, **kwargs):
        self.submitted.append(kwargs)
        return {"jobId": "job-1", "jobName": kwargs["jobName"]}


@pytest.fixture
def aws(tmp_path, monkeypatch):
    """The handler wired to fake AWS clients and one channel config."""
    import boto3

    from backend.worker import channel_state, watch_handler

    config_dir = tmp_path / "channels"
    config_dir.mkdir()
    (config_dir / "testchannel.json").write_text(
        json.dumps(
            {
                "name": "testchannel",
                "channel_url": "https://www.youtube.com/@test/videos",
                "lookback_days": 5,
                "max_videos_per_run": 2,
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(watch_handler, "CONFIG_DIR", config_dir, raising=False)

    monkeypatch.setenv("S3_BUCKET", "test-bucket")
    monkeypatch.setenv("BATCH_JOB_QUEUE", "test-queue")
    monkeypatch.setenv("BATCH_JOB_DEFINITION", "test-def")

    s3, batch = _FakeS3(), _FakeBatch()
    monkeypatch.setattr(boto3, "client", lambda name, *a, **k: {"s3": s3, "batch": batch}[name])

    # No channel has ingested anything unless a test says so.
    monkeypatch.setattr(channel_state, "read_processed_ids", lambda _name: set())

    return watch_handler, s3, batch


def _feed(monkeypatch, uploads):
    from backend.pipeline import youtube_feed

    monkeypatch.setattr(youtube_feed, "resolve_channel_id", lambda *a, **k: "UCtest")
    monkeypatch.setattr(youtube_feed, "recent_uploads", lambda cid, client=None: list(uploads))


def test_nothing_new_starts_no_container(aws, monkeypatch):
    """The common case, and the one that has to be cheap."""
    watch_handler, _s3, batch = aws
    _feed(monkeypatch, [])

    result = watch_handler.handler()

    assert result == {"ok": True, "channels": [], "submitted": None}
    assert batch.submitted == []


def test_a_new_video_submits_the_multi_channel_pipeline(aws, monkeypatch):
    watch_handler, _s3, batch = aws
    _feed(monkeypatch, [_upload("aaaaaaaaaaa")])

    result = watch_handler.handler()

    assert result["channels"] == ["testchannel"]
    assert len(batch.submitted) == 1
    command = batch.submitted[0]["containerOverrides"]["command"]
    # Not auto_rebuild, which only knows about Ravish.
    assert command == ["python", "-m", "backend.worker.run_channels", "--channels", "testchannel"]


def test_an_already_ingested_video_starts_nothing(aws, monkeypatch):
    watch_handler, _s3, batch = aws
    from backend.worker import channel_state

    monkeypatch.setattr(channel_state, "read_processed_ids", lambda _name: {"aaaaaaaaaaa"})
    _feed(monkeypatch, [_upload("aaaaaaaaaaa")])

    assert watch_handler.handler()["submitted"] is None
    assert batch.submitted == []


def test_a_video_outside_the_lookback_window_starts_nothing(aws, monkeypatch):
    """Ingestion would never collect it, so it is not work."""
    watch_handler, _s3, batch = aws
    _feed(monkeypatch, [_upload("aaaaaaaaaaa", days_old=9)])

    assert batch.submitted == []
    assert watch_handler.handler()["submitted"] is None


def test_a_running_job_is_not_joined_by_a_second(aws, monkeypatch):
    """Two containers would race for the same processed.json and the same budget."""
    watch_handler, s3, batch = aws
    batch.running = True
    _feed(monkeypatch, [_upload("aaaaaaaaaaa")])

    result = watch_handler.handler()

    assert result["reason"] == "job_running"
    assert batch.submitted == []
    # Nothing was attempted, so nothing earned a strike.
    assert s3.objects == {}


def test_a_video_that_never_arrives_stops_costing_containers(aws, monkeypatch):
    """
    The loop-breaker.

    A video with no captions never reaches processed.json. Without the attempt
    ledger this would start a Batch container on every schedule, forever.
    """
    watch_handler, _s3, batch = aws
    _feed(monkeypatch, [_upload("aaaaaaaaaaa")])

    for _ in range(6):
        watch_handler.handler()

    assert len(batch.submitted) == 3


def test_a_backlog_is_not_retired_unattempted(aws, monkeypatch):
    """
    With max_videos_per_run=2, one run reaches the newest two.

    Striking all five would abandon the oldest three after three schedules
    without anything ever having tried to fetch them.
    """
    watch_handler, s3, _batch = aws
    _feed(monkeypatch, [_upload(f"vid{i:07d}", days_old=i * 0.1) for i in range(5)])

    watch_handler.handler()

    ledger = json.loads(s3.objects[watch_handler._ledger_key()])
    assert sorted(ledger["testchannel"]) == ["vid0000000", "vid0000001"]
