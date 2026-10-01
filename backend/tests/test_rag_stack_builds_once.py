"""
The RAG stack is built once per container, however many threads ask for it.

`ensure_rag_stack` checked its cache and, finding it empty, went ahead and
built. Two callers arriving before either finished both built: on a cold
Lambda that meant 204 MB of artifacts downloaded from S3 twice, 4867 chunks
parsed twice, and Pinecone connected to twice.

It happened on every cold container, because the startup pre-warm thread and
the request that woke the container race by design - the thread exists
precisely so the stack is ready before a request needs it. Production logs
showed each download and each parse exactly twice, about six seconds of a
thirty-second gateway budget spent reaching the same answer in parallel.
"""
from __future__ import annotations

import threading
import time

import pytest


@pytest.fixture
def cli(monkeypatch):
    """pipeline_cli with the build replaced by something countable and slow."""
    import backend.pipeline_cli as m

    calls = {"builds": 0}

    def fake_build(_settings):
        calls["builds"] += 1
        # Long enough that a second caller is certainly inside the window the
        # bug lived in. Without the lock this test fails; with it, the second
        # caller waits here and then takes the cache.
        time.sleep(0.2)
        m._RAG_CACHE = ("embedder", "store", {})
        return m._RAG_CACHE

    monkeypatch.setattr(m, "_build_rag_stack", fake_build)
    monkeypatch.setattr(m, "_RAG_CACHE", None, raising=False)
    return m, calls


def test_eight_threads_build_it_once(cli):
    """The pre-warm thread and the first request are the real two."""
    m, calls = cli
    start = threading.Barrier(8)
    results = []

    def go():
        start.wait()
        results.append(m.ensure_rag_stack(object()))

    threads = [threading.Thread(target=go) for _ in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert calls["builds"] == 1, "the stack was built more than once"
    assert len(results) == 8
    assert all(r == ("embedder", "store", {}) for r in results), \
        "a caller that waited got something other than the built stack"


def test_a_warm_container_does_not_take_the_lock(cli):
    """
    The common case by far, and it must stay free.

    Every generation calls this. If a warm hit went through the lock it would
    serialise concurrent requests behind each other for no reason.
    """
    m, calls = cli
    m.ensure_rag_stack(object())          # builds
    m._RAG_LOCK.acquire()                 # now hold it against everyone
    try:
        assert m.ensure_rag_stack(object()) == ("embedder", "store", {})
    finally:
        m._RAG_LOCK.release()
    assert calls["builds"] == 1
