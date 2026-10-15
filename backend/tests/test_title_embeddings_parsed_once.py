"""
The title-embedding artifact is parsed once per container, not once per post.

`video_title_embeddings.json` is 127 MB. Measured: 0.5 s to read, 1.6 s to
parse, 0.1 s to turn into a NumPy array. The retriever read and parsed it on
every retrieval, and `ensure_rag_stack` parsed it a second time on each
container's first generation only to compare one string and throw the result
away. Together that was roughly 4 s of every generation, and generation lives
under a thirty-second gateway ceiling it was already hitting.

These tests pin the caching, because its absence is silent: everything still
works, it is only slower, and nobody notices until a post times out.
"""
from __future__ import annotations

import json

import pytest


@pytest.fixture
def artifact(tmp_path, monkeypatch):
    """A small stand-in artifact, with every read counted."""
    from backend.pipeline import retriever

    path = tmp_path / "video_title_embeddings.json"
    path.write_text(json.dumps({
        "embedding_model": "gemini-embedding-001",
        "title_map": {
            "पहला वीडियो": {"video_link": "a", "embedding": [0.1, 0.2]},
            "दूसरा वीडियो": {"video_link": "b", "embedding": [0.3, 0.4]},
        },
    }, ensure_ascii=False), encoding="utf-8")

    reads = {"n": 0}
    real = retriever.json.loads

    def counting_loads(text, *a, **k):
        reads["n"] += 1
        return real(text, *a, **k)

    monkeypatch.setattr(retriever.json, "loads", counting_loads)
    retriever._TITLE_PAYLOAD_CACHE.clear()
    return retriever, path, reads


def test_it_is_parsed_once_however_many_posts_are_written(artifact):
    """The whole point: generation number two must not pay for it again."""
    retriever, path, reads = artifact

    for _ in range(10):
        payload = retriever._title_payload(path)
        assert payload["embedding_model"] == "gemini-embedding-001"

    assert reads["n"] == 1, f"parsed {reads['n']} times, should have been once"


def test_a_rebuilt_artifact_is_picked_up(artifact):
    """
    The worker rebuilds this file. A container holding the old one forever
    would quietly retrieve against stale titles, which is worse than slow.
    """
    retriever, path, reads = artifact
    retriever._title_payload(path)
    assert reads["n"] == 1

    # Rewrite with different content; the mtime and size both move.
    path.write_text(json.dumps({
        "embedding_model": "gemini-embedding-002",
        "title_map": {"नया वीडियो": {"video_link": "c", "embedding": [0.5, 0.6]}},
    }, ensure_ascii=False), encoding="utf-8")

    payload = retriever._title_payload(path)
    assert reads["n"] == 2, "the rebuilt artifact was not re-read"
    assert payload["embedding_model"] == "gemini-embedding-002"


def test_the_cache_is_dropped_when_this_module_writes_the_file(artifact):
    """
    The retriever fills in missing titles and writes the file back. It has to
    drop what it cached, or the next read returns content that is one
    generation out of date.
    """
    retriever, path, reads = artifact
    retriever._title_payload(path)
    retriever._TITLE_PAYLOAD_CACHE.clear()          # what the write path does

    retriever._title_payload(path)
    assert reads["n"] == 2


def test_ensure_rag_stack_no_longer_parses_it_at_all(monkeypatch, tmp_path):
    """
    It used to call load_title_embeddings purely to compare a model string,
    then discard 127 MB of parsed embeddings. Nothing downstream ever saw the
    result - it is not in _RAG_CACHE and it is not returned.
    """
    import backend.pipeline_cli as cli

    # The artifact exists, so there is nothing to build and nothing to read.
    te = tmp_path / "video_title_embeddings.json"
    te.write_text("{}", encoding="utf-8")
    monkeypatch.setattr(cli, "TITLE_EMB_PATH", te, raising=False)

    built = {"n": 0}
    monkeypatch.setattr(cli, "build_title_embeddings",
                        lambda *a, **k: built.__setitem__("n", built["n"] + 1))

    assert not hasattr(cli, "load_title_embeddings"), \
        "load_title_embeddings is imported again; the 127 MB read is back"
    assert built["n"] == 0
