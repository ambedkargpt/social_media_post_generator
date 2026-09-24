"""
Tests for the channel watcher's decision: is there anything to run for?

YouTube is never called. What is worth guarding is not the Atom feed — it is
the reasoning around it, because every way this goes wrong is expensive:
running the pipeline in a loop over a video that can never be fetched, or
quietly abandoning a video nothing ever tried to fetch.
"""
from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta

import pytest

from backend.pipeline.youtube_feed import Upload


NOW = datetime.now(UTC)


def _upload(video_id: str, *, days_old: float = 0.0, title: str = "शीर्षक") -> Upload:
    return Upload(
        video_id=video_id,
        title=title,
        published=NOW - timedelta(days=days_old),
        url=f"https://www.youtube.com/watch?v={video_id}",
    )


@pytest.fixture
def channel(tmp_path, monkeypatch):
    """A channel config on disk, with the watcher pointed at this directory."""
    import backend.scripts.watch_channels as watcher

    processed = tmp_path / "processed.json"
    processed.write_text("[]", encoding="utf-8")

    payload = {
        "name": "testchannel",
        "channel_url": "https://www.youtube.com/@test/videos",
        "lookback_days": 5,
        "max_videos_per_run": 2,
        # pending_uploads resolves this against ROOT/backend, so the value
        # stored has to be relative to that.
        "processed_json_path": str(processed),
    }

    monkeypatch.setattr(watcher, "ROOT", tmp_path.parent, raising=False)
    return watcher, payload, processed


def _patch_feed(monkeypatch, watcher, uploads):
    """One feed, returning exactly these uploads."""
    monkeypatch.setattr(watcher, "feed_ids_for", lambda *a, **k: ["UCtest"])
    monkeypatch.setattr(
        watcher.youtube_feed, "recent_uploads", lambda channel_id, client=None: list(uploads)
    )


def _pending(watcher, payload, ledger, monkeypatch, processed, *, max_attempts=3):
    # load_processed is read through backend.Fetch inside the function, so the
    # path it builds is what gets patched rather than the import.
    import backend.Fetch as fetch

    real = fetch.load_processed
    monkeypatch.setattr(fetch, "load_processed", lambda _p: real(processed))
    return watcher.pending_uploads(
        "testchannel", payload, ledger, max_attempts, None, {}
    )


def test_a_new_video_is_pending(channel, monkeypatch):
    watcher, payload, processed = channel
    _patch_feed(monkeypatch, watcher, [_upload("aaaaaaaaaaa", days_old=0.1)])

    pending = _pending(watcher, payload, {}, monkeypatch, processed)

    assert [u.video_id for u in pending] == ["aaaaaaaaaaa"]


def test_an_already_ingested_video_is_not_pending(channel, monkeypatch):
    """The ordinary case: the pipeline has it, so there is nothing to run for."""
    watcher, payload, processed = channel
    processed.write_text(
        json.dumps([{"id": "aaaaaaaaaaa", "title": "t", "url": "u"}]), encoding="utf-8"
    )
    _patch_feed(monkeypatch, watcher, [_upload("aaaaaaaaaaa", days_old=0.1)])

    assert _pending(watcher, payload, {}, monkeypatch, processed) == []


def test_a_video_older_than_the_lookback_window_is_not_pending(channel, monkeypatch):
    """Ingestion would never collect it, so it is not work — it is background."""
    watcher, payload, processed = channel
    _patch_feed(monkeypatch, watcher, [_upload("aaaaaaaaaaa", days_old=9)])

    assert _pending(watcher, payload, {}, monkeypatch, processed) == []


def test_a_video_tried_too_often_stops_being_pending(channel, monkeypatch):
    """
    The loop-breaker.

    A video with no captions never reaches processed.json, so without this it
    stays 'new' forever and the pipeline runs every few minutes for something
    that can never succeed.
    """
    watcher, payload, processed = channel
    _patch_feed(monkeypatch, watcher, [_upload("aaaaaaaaaaa", days_old=0.1)])
    ledger = {"testchannel": {"aaaaaaaaaaa": {"attempts": 3}}}

    assert _pending(watcher, payload, ledger, monkeypatch, processed, max_attempts=3) == []

    # One try short of the limit, it is still worth asking for.
    ledger = {"testchannel": {"aaaaaaaaaaa": {"attempts": 2}}}
    assert len(_pending(watcher, payload, ledger, monkeypatch, processed, max_attempts=3)) == 1


def test_pending_videos_come_back_newest_first(channel, monkeypatch):
    """The cap slices this list, so its order decides which videos get tried."""
    watcher, payload, processed = channel
    _patch_feed(
        monkeypatch,
        watcher,
        [
            _upload("bbbbbbbbbbb", days_old=2),
            _upload("aaaaaaaaaaa", days_old=0.1),
            _upload("ccccccccccc", days_old=1),
        ],
    )

    pending = _pending(watcher, payload, {}, monkeypatch, processed)

    assert [u.video_id for u in pending] == ["aaaaaaaaaaa", "ccccccccccc", "bbbbbbbbbbb"]


def test_only_videos_the_run_could_reach_are_charged_an_attempt(channel):
    """
    A backlog must not be abandoned unattempted.

    With max_videos_per_run=2 and five pending, one run reaches the newest two.
    Charging all five an attempt would retire the oldest three after a few
    ticks without anything ever having tried to fetch them.
    """
    watcher, payload, _processed = channel
    pending = [_upload(f"vid{i:07d}", days_old=i * 0.1) for i in range(5)]

    attempted = watcher.attempted_slice(pending, payload)

    assert [u.video_id for u in attempted] == ["vid0000000", "vid0000001"]


def test_without_a_cap_every_pending_video_is_charged(channel):
    """No cap means the run really did try all of them."""
    watcher, payload, _processed = channel
    payload = {**payload, "max_videos_per_run": None}
    pending = [_upload(f"vid{i:07d}", days_old=i * 0.1) for i in range(5)]

    assert len(watcher.attempted_slice(pending, payload)) == 5


# ── A whole tick ────────────────────────────────────────────────────────────
# The pipeline is never launched; what matters here is the bookkeeping around
# it, because that is what decides whether the next tick runs again.


@pytest.fixture
def watch_dir(tmp_path, monkeypatch):
    """Point every file the watcher writes at a temporary directory."""
    import backend.scripts.watch_channels as watcher

    for name, filename in (
        ("STATE_PATH", "state.json"),
        ("ID_CACHE_PATH", "channel_ids.json"),
        ("LOCK_PATH", "watch.lock"),
        ("LOG_PATH", "watch.log"),
    ):
        monkeypatch.setattr(watcher, name, tmp_path / filename, raising=False)
    monkeypatch.setattr(watcher, "CONFIG_DIR", tmp_path / "channels", raising=False)
    (tmp_path / "channels").mkdir()
    return watcher, tmp_path


def _write_config(tmp_path, processed, **overrides):
    payload = {
        "name": "testchannel",
        "channel_url": "https://www.youtube.com/@test/videos",
        "lookback_days": 5,
        "max_videos_per_run": 2,
        "processed_json_path": str(processed),
        **overrides,
    }
    (tmp_path / "channels" / "testchannel.json").write_text(
        json.dumps(payload), encoding="utf-8"
    )


def _run_tick(watcher, tmp_path, monkeypatch, uploads, *, on_run, max_attempts=3):
    """One tick over one channel, with the pipeline replaced by `on_run`."""
    processed = tmp_path / "processed.json"
    if not processed.exists():
        processed.write_text("[]", encoding="utf-8")
    _write_config(tmp_path, processed)

    monkeypatch.setattr(watcher, "ROOT", tmp_path.parent, raising=False)
    monkeypatch.setattr(watcher, "feed_ids_for", lambda *a, **k: ["UCtest"])
    monkeypatch.setattr(
        watcher.youtube_feed, "recent_uploads", lambda channel_id, client=None: list(uploads)
    )

    import backend.Fetch as fetch

    real = fetch.load_processed
    monkeypatch.setattr(fetch, "load_processed", lambda _p: real(processed))

    def _pipeline(name):
        on_run(processed)
        return {"ingestion": {"transcript_failures": 0}, "publish": {"inserted": 0}}

    monkeypatch.setattr(watcher, "run_channel", _pipeline)
    watcher.tick(["testchannel"], max_attempts=max_attempts, dry_run=False)
    return json.loads((tmp_path / "state.json").read_text(encoding="utf-8"))


def test_a_video_the_run_could_not_fetch_is_charged_an_attempt(watch_dir, monkeypatch):
    """This is what eventually breaks the loop on a captionless video."""
    watcher, tmp_path = watch_dir

    state = _run_tick(
        watcher, tmp_path, monkeypatch,
        [_upload("aaaaaaaaaaa", days_old=0.1)],
        on_run=lambda _processed: None,          # the pipeline fetched nothing
    )

    assert state["videos"]["testchannel"]["aaaaaaaaaaa"]["attempts"] == 1


def test_a_video_the_run_did_fetch_leaves_no_ledger_entry(watch_dir, monkeypatch):
    """Success needs no record here — processed.json already holds it."""
    watcher, tmp_path = watch_dir

    def _ingested(processed):
        processed.write_text(
            json.dumps([{"id": "aaaaaaaaaaa", "title": "t", "url": "u"}]), encoding="utf-8"
        )

    state = _run_tick(
        watcher, tmp_path, monkeypatch,
        [_upload("aaaaaaaaaaa", days_old=0.1)],
        on_run=_ingested,
    )

    assert state["videos"].get("testchannel", {}) == {}


def test_repeated_failures_eventually_stop_running_the_pipeline(watch_dir, monkeypatch):
    """The whole point: a video that can never be fetched stops costing runs."""
    watcher, tmp_path = watch_dir
    uploads = [_upload("aaaaaaaaaaa", days_old=0.1)]
    runs = []

    def _count(_processed):
        runs.append(1)

    for _ in range(5):
        _run_tick(watcher, tmp_path, monkeypatch, uploads, on_run=_count, max_attempts=3)

    # Three attempts, then it is left alone — not five runs, and not forever.
    assert len(runs) == 3
