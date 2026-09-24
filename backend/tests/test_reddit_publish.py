"""
Tests for publishing a post to Reddit as the user.

Reddit itself is never called: `RedditService.submit` is replaced, because what
is worth guarding here is not Reddit's API but our own rules around it —

  * a post already on Reddit is never posted a second time,
  * a failed submit does not spend the user's daily quota,
  * a successful submit records where the post went,
  * every post goes to our subreddit and nowhere else, and
  * the stored refresh token is never readable from the database alone.

mongomock stands in for Mongo, so these run anywhere.
"""
from datetime import datetime, timezone

import mongomock
import pytest
from bson import ObjectId
from fastapi import HTTPException


USER_ID = "65f000000000000000000002"


@pytest.fixture
def repos(monkeypatch):
    """A clean in-memory database wired into every repository under test."""
    client = mongomock.MongoClient()
    fake_db = client["ambedkargpt_test"]

    import backend.db.mongo as mongo_module

    monkeypatch.setattr(mongo_module, "db", fake_db, raising=False)

    from backend.repositories import integrations_repo, posts_repo

    posts = posts_repo.PostsRepository()
    posts.collection = fake_db["posts"]
    integrations = integrations_repo.IntegrationsRepository()
    integrations.collection = fake_db["user_integrations"]
    return {"db": fake_db, "posts": posts, "integrations": integrations}


def _make_post(repos, status="draft"):
    doc = {
        "_id": ObjectId(),
        "user_id": ObjectId(USER_ID),
        "content": "तेलंगाना में कांग्रेस सरकार का दावा",
        "status": status,
        "hashtags": [],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    repos["posts"].collection.insert_one(doc)
    return str(doc["_id"])


def _service(repos, monkeypatch, submit):
    """PostsService with its repositories pointed at the in-memory database."""
    from backend.services.posts_service import PostsService

    service = PostsService()
    service.repo = repos["posts"]

    class _Streak:
        def __init__(self):
            self.calls = []

        def on_publish(self, user_id):
            self.calls.append(user_id)

    service.streak_repo = _Streak()

    import backend.services.reddit_service as reddit_module

    class _FakeReddit:
        def __init__(self):
            self.submits = []

        def submit(self, *, user_id, title, body):
            self.submits.append({"user_id": user_id, "title": title, "body": body})
            return submit(title=title, body=body)

    fake = _FakeReddit()
    # Through monkeypatch, so the real class is back for the tests below that
    # exercise it — an outright assignment here leaked into the whole session.
    monkeypatch.setattr(reddit_module, "RedditService", lambda: fake)
    return service, fake


def _ok(**_kwargs):
    return {
        "url": "https://www.reddit.com/r/ambedkargpt/comments/abc123/x/",
        "post_id": "abc123",
        "fullname": "t3_abc123",
        "subreddit": "ambedkargpt",
    }


def test_records_where_the_post_went(repos, monkeypatch):
    post_id = _make_post(repos)
    service, fake = _service(repos, monkeypatch, _ok)

    publication = service.publish_to_reddit(post_id, USER_ID, title="Headline", body="Body")

    assert publication["platform"] == "reddit"
    assert publication["url"].startswith("https://www.reddit.com/r/ambedkargpt/")
    assert publication["remote_id"] == "t3_abc123"
    # The evidence lives on the post, not only in the response.
    stored = repos["posts"].find_publication(post_id, "reddit")
    assert stored and stored["url"] == publication["url"]
    # And it counts as published, with the streak advanced.
    assert repos["posts"].get_by_id(post_id)["status"] == "published"
    assert service.streak_repo.calls == [USER_ID]
    assert len(fake.submits) == 1


def test_never_posts_the_same_story_twice(repos, monkeypatch):
    post_id = _make_post(repos)
    service, fake = _service(repos, monkeypatch, _ok)

    first = service.publish_to_reddit(post_id, USER_ID, title="Headline", body="Body")
    second = service.publish_to_reddit(post_id, USER_ID, title="Headline", body="Body")

    assert first["url"] == second["url"]
    # A double tap reaches Reddit once.
    assert len(fake.submits) == 1


def test_a_failed_submit_does_not_spend_the_quota(repos, monkeypatch):
    from backend.services.reddit_service import RedditError

    post_id = _make_post(repos)

    def _boom(**_kwargs):
        raise RedditError("Reddit is asking you to wait.", code="rate_limited")

    service, _fake = _service(repos, monkeypatch, _boom)

    with pytest.raises(HTTPException) as caught:
        service.publish_to_reddit(post_id, USER_ID, title="Headline", body="Body")

    assert caught.value.status_code == 502
    assert caught.value.detail["error"] == "rate_limited"
    # Still a draft, still nothing recorded, streak untouched.
    assert repos["posts"].get_by_id(post_id)["status"] == "draft"
    assert repos["posts"].find_publication(post_id, "reddit") is None
    assert service.streak_repo.calls == []


def test_not_connected_is_a_conflict_not_a_crash(repos, monkeypatch):
    from backend.services.reddit_service import RedditNotConnected

    post_id = _make_post(repos)

    def _not_connected(**_kwargs):
        raise RedditNotConnected()

    service, _fake = _service(repos, monkeypatch, _not_connected)

    with pytest.raises(HTTPException) as caught:
        service.publish_to_reddit(post_id, USER_ID, title="Headline", body="Body")

    # 409, so the client knows to offer "Connect Reddit" rather than "retry".
    assert caught.value.status_code == 409
    assert caught.value.detail["error"] == "not_connected"


def test_stored_refresh_token_is_not_readable_from_the_database(repos, monkeypatch):
    """The row holds ciphertext; the plaintext only exists behind the key."""
    from cryptography.fernet import Fernet

    key = Fernet.generate_key().decode()
    import backend.core.token_crypto as crypto
    from backend.core.config import settings

    monkeypatch.setattr(settings, "integration_token_key", key, raising=False)
    crypto._cipher.cache_clear()

    secret = "reddit-refresh-token-value"
    repos["integrations"].upsert(
        user_id=USER_ID,
        provider="reddit",
        account_id="t2_abc",
        account_handle="krish",
        refresh_token_enc=crypto.encrypt(secret),
        scopes=["identity", "submit"],
    )

    row = repos["integrations"].get(USER_ID, "reddit")
    assert secret not in str(row)
    assert crypto.decrypt(row["refresh_token_enc"]) == secret

    # And what the API is allowed to return carries no token at all.
    public = repos["integrations"].public_view(row)
    assert public == {
        "provider": "reddit",
        "account_handle": "krish",
        "connected_at": row["connected_at"],
        "scopes": ["identity", "submit"],
    }
    assert "refresh_token_enc" not in public

    crypto._cipher.cache_clear()


# ── The destination ─────────────────────────────────────────────────────────
# These call the real RedditService.submit with Reddit's HTTP stubbed out,
# because the subject under test is exactly the part the other tests replace:
# which community a post is sent to.


class _FakeResponse:
    def __init__(self, payload):
        self.status_code = 200
        self._payload = payload
        self.text = str(payload)

    def json(self):
        return self._payload


def _stub_reddit_http(monkeypatch, *, returned_url):
    """Capture the form Reddit would have received, and answer it."""
    import backend.services.reddit_service as reddit_module

    sent = {}

    class _FakeClient:
        def __init__(self, **_kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *_exc):
            return False

        def post(self, _url, data=None, headers=None):
            sent.update(data or {})
            return _FakeResponse({"json": {"errors": [], "data": {
                "url": returned_url, "id": "abc123", "name": "t3_abc123",
            }}})

    monkeypatch.setattr(reddit_module.httpx, "Client", _FakeClient)
    monkeypatch.setattr(
        reddit_module.RedditService, "_access_token", lambda self, user_id: "token"
    )
    return sent


def test_the_post_always_goes_to_our_subreddit(repos, monkeypatch):
    """The destination comes from configuration, never from the caller.

    `submit` takes no subreddit argument and the request schema has no field
    for one, so this pins the remaining question: that what is actually sent
    to Reddit is the configured community.
    """
    import backend.services.reddit_service as reddit_module
    from backend.core.config import settings

    monkeypatch.setattr(settings, "reddit_subreddit", "ambedkargpt", raising=False)
    sent = _stub_reddit_http(
        monkeypatch,
        returned_url="https://www.reddit.com/r/ambedkargpt/comments/abc123/x/",
    )

    result = reddit_module.RedditService().submit(
        user_id=USER_ID, title="Headline", body="Body"
    )

    assert sent["sr"] == "ambedkargpt"
    assert result["subreddit"] == "ambedkargpt"


def test_a_post_filed_somewhere_else_is_not_recorded(repos, monkeypatch):
    """If the permalink says another community, we refuse rather than record it."""
    import backend.services.reddit_service as reddit_module
    from backend.core.config import settings

    monkeypatch.setattr(settings, "reddit_subreddit", "ambedkargpt", raising=False)
    _stub_reddit_http(
        monkeypatch,
        returned_url="https://www.reddit.com/r/somewhereelse/comments/abc123/x/",
    )

    with pytest.raises(reddit_module.RedditError) as caught:
        reddit_module.RedditService().submit(
            user_id=USER_ID, title="Headline", body="Body"
        )
    assert caught.value.code == "wrong_subreddit"


@pytest.mark.parametrize("configured", ["", "  ", "ab", "not a name", "a" * 22])
def test_a_misconfigured_subreddit_refuses_to_post(repos, monkeypatch, configured):
    """A server with no usable destination posts nowhere, rather than guessing."""
    import backend.services.reddit_service as reddit_module
    from backend.core.config import settings

    monkeypatch.setattr(settings, "reddit_subreddit", configured, raising=False)

    with pytest.raises(reddit_module.RedditError) as caught:
        reddit_module.subreddit()
    assert caught.value.code == "bad_subreddit"
