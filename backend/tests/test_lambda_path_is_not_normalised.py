"""
The Lambda handler hands FastAPI the path that was actually requested.

A Lambda function URL normalises `requestContext.http.path` and drops a
trailing slash, while `rawPath` keeps it. Mangum reads the normalised one. Most
of our routes are declared with a trailing slash, so `/api/v1/news/` arrived as
`/api/v1/news`, FastAPI redirected to add the slash, the function URL stripped
it again, and the client followed that round until it gave up. Measured against
the live function: 307 on every such route, 200 on the ones without a slash.

API Gateway sends the two fields in agreement, so none of this shows there -
which is exactly why it went unnoticed until the function URL was needed, and
why the test has to state the difference rather than exercise one host.
"""
from __future__ import annotations

import pytest


@pytest.fixture
def handler(monkeypatch):
    """The real handler with the ASGI call replaced by a recorder."""
    import backend.main_lambda as m

    seen = {}

    def fake_asgi(event, context):
        seen["path"] = event["requestContext"]["http"]["path"]
        return {"statusCode": 200}

    monkeypatch.setattr(m, "_asgi", fake_asgi)
    return m.handler, seen


def _event(raw_path, http_path):
    return {
        "version": "2.0",
        "rawPath": raw_path,
        "rawQueryString": "",
        "requestContext": {"http": {"method": "GET", "path": http_path}},
    }


def test_a_stripped_trailing_slash_is_put_back(handler):
    """The function URL's normalisation, and the whole reason for this code."""
    fn, seen = handler

    fn(_event("/api/v1/news/", "/api/v1/news"), None)

    assert seen["path"] == "/api/v1/news/", "FastAPI would redirect, and loop"


def test_an_agreeing_event_is_left_alone(handler):
    """What API Gateway sends. This must stay a no-op there."""
    fn, seen = handler

    fn(_event("/api/v1/news/tenants", "/api/v1/news/tenants"), None)

    assert seen["path"] == "/api/v1/news/tenants"


def test_rawpath_wins_whenever_the_two_disagree(handler):
    """
    rawPath is what the client sent; http.path is what Lambda made of it.
    Trailing slashes are the case we hit, but the rule is the general one.
    """
    fn, seen = handler

    fn(_event("/api/v1/posts//generate", "/api/v1/posts/generate"), None)

    assert seen["path"] == "/api/v1/posts//generate"


def test_an_event_without_rawpath_is_passed_through(handler):
    """
    Older payload formats and direct invocations have no rawPath. Reaching for
    one would raise, and a handler that cannot be invoked directly cannot be
    tested or run from the console.
    """
    fn, seen = handler

    fn({"requestContext": {"http": {"method": "GET", "path": "/api/v1/health/"}}}, None)

    assert seen["path"] == "/api/v1/health/"


def test_a_malformed_event_does_not_raise(handler):
    """A 500 from a KeyError is a worse answer than letting the app 404."""
    fn, seen = handler

    fn({"rawPath": "/api/v1/news/"}, None)      # no requestContext at all

    assert seen["path"] == "/api/v1/news/"
