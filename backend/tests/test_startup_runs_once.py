"""
Startup work happens once per process, not once per request.

Mangum runs the ASGI lifespan on every invocation, so anything in the lifespan
is paid on every HTTP request rather than once per container. What was in there
is thirty-three create_index calls, measured at 1.4 seconds against Atlas - most
of what a warm request cost, and a dashboard makes five requests.

Under Gunicorn the lifespan runs once and none of this matters. The guard is
what makes the two hosts behave the same.
"""
from __future__ import annotations

import threading

import pytest


@pytest.fixture
def main(monkeypatch):
    """backend.main with the index calls counted instead of run."""
    import backend.main as m

    calls: dict[str, int] = {"indexes": 0, "threads": 0}

    def _count():
        calls["indexes"] += 1

    for name in ("ensure_auth_indexes", "ensure_phase2_indexes", "ensure_phase3_indexes"):
        monkeypatch.setattr(m, name, _count)

    class _NoThread:
        def __init__(self, *a, **k):
            calls["threads"] += 1

        def start(self):
            pass

    # A stand-in module, not a patch of threading.Thread itself: patching the
    # real class would also replace the threads this test starts, and the
    # concurrency case below would then test nothing.
    class _FakeThreading:
        Thread = _NoThread
        Lock = threading.Lock

    monkeypatch.setattr(m, "threading", _FakeThreading)
    monkeypatch.setattr(m, "_startup_done", False, raising=False)
    return m, calls


def test_the_second_request_does_no_index_work(main):
    """The whole point: an invocation after the first must not touch Atlas."""
    m, calls = main

    m._run_startup_once()
    after_first = calls["indexes"]
    for _ in range(20):
        m._run_startup_once()

    assert after_first == 3, "one call per ensure_* function on the first run"
    assert calls["indexes"] == 3, "later runs did index work"
    assert calls["threads"] == 1, "a pre-warm thread per request is its own leak"


def test_a_failure_is_retried_rather_than_latched(main, monkeypatch):
    """
    Setting the flag before the work would be cheaper and wrong.

    A container whose first request failed here would serve every later request
    without indexes, and nothing would say so.
    """
    m, calls = main
    boom = {"left": 1}

    def _first_call_fails():
        calls["indexes"] += 1
        if boom["left"]:
            boom["left"] -= 1
            raise RuntimeError("Atlas unreachable")

    monkeypatch.setattr(m, "ensure_auth_indexes", _first_call_fails)

    with pytest.raises(RuntimeError):
        m._run_startup_once()

    m._run_startup_once()          # the retry succeeds
    calls["indexes"] = 0
    m._run_startup_once()          # and then it is done for good
    assert calls["indexes"] == 0


def test_two_threads_do_the_work_once_between_them(main):
    """Gunicorn serves concurrently; two workers must not both build indexes."""
    m, calls = main
    start = threading.Barrier(8)

    def go():
        start.wait()
        m._run_startup_once()

    threads = [threading.Thread(target=go) for _ in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert calls["indexes"] == 3
