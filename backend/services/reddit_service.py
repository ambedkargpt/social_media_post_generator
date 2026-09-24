"""Publishing to Reddit as the user, not as the app.

Every post goes to one subreddit we run, but under the account of whoever
wrote it. A single bot account posting everyone's work would read as spam to
both Reddit and to anyone browsing the subreddit, which is the whole reason
this holds per-user tokens at all.

Flow:

    authorize_url()  ->  user approves on reddit.com
                     ->  Reddit calls our callback with ?code
    complete()       ->  code exchanged for an access + refresh token,
                         the refresh token stored encrypted
    submit()         ->  a fresh access token from the refresh token,
                         then one self-post to the subreddit

Nothing here runs without the user pressing something. There is no background
posting, and no path that posts on behalf of a user who has not just asked for
it.
"""
from __future__ import annotations

import logging
import re
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import urlencode
from uuid import uuid4

import httpx
import jwt

from backend.core.config import settings
from backend.core import token_crypto
from backend.repositories.integrations_repo import IntegrationsRepository

logger = logging.getLogger(__name__)

PROVIDER = "reddit"

_AUTHORIZE_URL = "https://www.reddit.com/api/v1/authorize"
_TOKEN_URL = "https://www.reddit.com/api/v1/access_token"
_API_BASE = "https://oauth.reddit.com"

# identity: which account this is, so we can show "Connected as u/…".
# submit:   create posts. Nothing else is asked for — no reading their feed,
#           no voting, no editing, no history.
_SCOPES = ("identity", "submit")

# Reddit caps a post title at 300 characters.
_TITLE_MAX = 300

# Reddit's own rule for a community name: 3-21 characters, letters, digits and
# underscores. A configured value outside this is a deployment mistake, and it
# is better to refuse than to send posts at whatever it happens to name.
_SUBREDDIT_RE = re.compile(r"^[A-Za-z0-9_]{3,21}$")

_STATE_TTL_MINUTES = 10
_HTTP_TIMEOUT = 20.0


class RedditError(RuntimeError):
    """A failure the user should be told about, in words they can act on."""

    def __init__(self, message: str, *, code: str = "reddit_error") -> None:
        super().__init__(message)
        self.code = code


class RedditNotConnected(RedditError):
    def __init__(self) -> None:
        super().__init__(
            "Connect your Reddit account before publishing.", code="not_connected"
        )


def is_configured() -> bool:
    """Whether Reddit publishing can work at all in this deployment.

    A missing or malformed subreddit counts as not configured: there would be
    nowhere to post, and saying so up front hides the Connect button rather
    than letting a user grant us access and then fail at the last step.
    """
    return bool(
        settings.reddit_client_id
        and settings.reddit_client_secret
        and settings.reddit_redirect_uri
        and token_crypto.is_configured()
        and _configured_subreddit() is not None
    )


def _configured_subreddit() -> str | None:
    """The configured community name, or None if it is unusable."""
    name = (settings.reddit_subreddit or "").strip().strip("/").removeprefix("r/")
    return name if _SUBREDDIT_RE.match(name) else None


def subreddit() -> str:
    """
    The one community posts may go to. Server configuration only.

    There is deliberately no argument and no caller that can pass one: a
    request cannot name a destination, so nothing a client sends can move a
    post off this subreddit.

    Note on scope: Reddit has no per-subreddit permission. The `submit` scope
    a user grants us is the right to post anywhere they could, which is wider
    than what we use it for. That width is bounded here, in our own code, and
    nowhere else — which is why this is the only place the target is decided
    and why the result is checked against it after the fact.
    """
    name = _configured_subreddit()
    if name is None:
        raise RedditError(
            "Reddit publishing is misconfigured on this server.",
            code="bad_subreddit",
        )
    return name


def _headers(access_token: str) -> dict[str, str]:
    # Reddit rate-limits generic user agents aggressively and asks that the
    # string identify the app, so this is not decoration.
    return {
        "Authorization": f"Bearer {access_token}",
        "User-Agent": settings.reddit_user_agent,
    }


# ── OAuth state ─────────────────────────────────────────────────────────────
# Signed rather than stored: it carries who started the connect, it expires in
# ten minutes, and a callback holding one we did not sign is refused. That is
# what stops someone else's callback attaching their Reddit account to this
# user's profile.

def _make_state(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "type": "reddit_oauth_state",
        "jti": str(uuid4()),
        "exp": int((datetime.now(UTC) + timedelta(minutes=_STATE_TTL_MINUTES)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def _read_state(state: str) -> str:
    try:
        payload = jwt.decode(state, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError as exc:
        raise RedditError(
            "That Reddit connection link expired. Please try connecting again.",
            code="state_expired",
        ) from exc
    except jwt.InvalidTokenError as exc:
        raise RedditError("Invalid Reddit connection request.", code="bad_state") from exc
    if payload.get("type") != "reddit_oauth_state":
        raise RedditError("Invalid Reddit connection request.", code="bad_state")
    return str(payload["sub"])


class RedditService:
    def __init__(self) -> None:
        self.integrations = IntegrationsRepository()

    # ── Connecting ──────────────────────────────────────────────────────────

    def authorize_url(self, user_id: str) -> str:
        if not is_configured():
            raise RedditError(
                "Reddit publishing is not configured on this server.",
                code="not_configured",
            )
        query = {
            "client_id": settings.reddit_client_id,
            "response_type": "code",
            "state": _make_state(user_id),
            "redirect_uri": settings.reddit_redirect_uri,
            # permanent is what returns a refresh token. Without it the access
            # token dies in an hour and the user reconnects before every post.
            "duration": "permanent",
            "scope": " ".join(_SCOPES),
        }
        return f"{_AUTHORIZE_URL}?{urlencode(query)}"

    def complete(self, *, code: str, state: str) -> dict:
        """Finish the connect. Returns the public view of the connection."""
        user_id = _read_state(state)
        tokens = self._token_request(
            {
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": settings.reddit_redirect_uri,
            }
        )
        refresh_token = tokens.get("refresh_token")
        if not refresh_token:
            # Happens when duration=permanent was dropped, or the user had
            # already granted a temporary token. Without it we would be asking
            # them to reconnect every hour.
            raise RedditError(
                "Reddit did not return a lasting permission. Please try "
                "connecting again and choose Allow.",
                code="no_refresh_token",
            )

        me = self._get_json("/api/v1/me", tokens["access_token"])
        doc = self.integrations.upsert(
            user_id=user_id,
            provider=PROVIDER,
            account_id=str(me.get("id") or ""),
            account_handle=str(me.get("name") or ""),
            refresh_token_enc=token_crypto.encrypt(refresh_token),
            scopes=list(_SCOPES),
        )
        logger.info("reddit: connected u/%s for user %s", me.get("name"), user_id)
        return self.integrations.public_view(doc)

    def status(self, user_id: str) -> dict:
        connection = self.integrations.get(user_id, PROVIDER)
        return {
            "configured": is_configured(),
            "connected": bool(connection),
            # Not subreddit(): a status call must answer even when the server
            # is misconfigured — that is precisely when the UI needs to hear
            # "configured: false" rather than a 500.
            "subreddit": _configured_subreddit() or "",
            "account": self.integrations.public_view(connection),
        }

    def disconnect(self, user_id: str) -> None:
        """
        Tell Reddit to forget the token as well as forgetting it ourselves. A
        row deleted only on our side leaves a live grant on the user's Reddit
        account, which is not what "disconnect" means to them.
        """
        connection = self.integrations.get(user_id, PROVIDER)
        if not connection:
            return
        enc = connection.get("refresh_token_enc")
        if enc:
            try:
                self._revoke(token_crypto.decrypt(enc))
            except (token_crypto.TokenCryptoUnavailable, RedditError, httpx.HTTPError) as exc:
                # Our own record still goes; a revoke we could not deliver is
                # not a reason to leave the user connected here.
                logger.warning("reddit: revoke failed for user %s: %s", user_id, exc)
        self.integrations.mark_revoked(user_id, PROVIDER)

    # ── Posting ─────────────────────────────────────────────────────────────

    def submit(self, *, user_id: str, title: str, body: str) -> dict:
        """
        One self-post to our subreddit, as the user. Returns the permalink.
        """
        access_token = self._access_token(user_id)
        title = (title or "").strip()
        if not title:
            raise RedditError("A Reddit post needs a title.", code="empty_title")
        if len(title) > _TITLE_MAX:
            # Cut on a word boundary rather than mid-word, and say so with an
            # ellipsis; the full story is in the body underneath.
            title = title[: _TITLE_MAX - 1].rsplit(" ", 1)[0] + "…"

        payload = {
            "sr": subreddit(),
            "kind": "self",
            "title": title,
            "text": body or "",
            "api_type": "json",
            # Reddit's own duplicate guard; without it a double tap posts twice.
            "resubmit": "false",
        }
        with httpx.Client(timeout=_HTTP_TIMEOUT) as client:
            response = client.post(
                f"{_API_BASE}/api/submit", data=payload, headers=_headers(access_token)
            )
        if response.status_code == 429:
            raise RedditError(
                "Reddit is asking you to wait before posting again. Try in a "
                "few minutes.",
                code="rate_limited",
            )
        if response.status_code >= 400:
            logger.warning("reddit submit http %s: %s", response.status_code, response.text[:400])
            raise RedditError("Reddit refused the post. Please try again.", code="http_error")

        data = response.json().get("json") or {}
        errors = data.get("errors") or []
        if errors:
            raise RedditError(self._error_message(errors), code=self._error_code(errors))

        created = data.get("data") or {}
        url = created.get("url") or ""

        # The post is only ours if it landed where we aimed. Reddit has never
        # been observed to file a post elsewhere, but a permalink that says
        # otherwise means either a bug here or something we do not understand,
        # and recording it as published would make our own record a lie.
        target = subreddit()
        if url and f"/r/{target}/".lower() not in url.lower():
            logger.error("reddit: submitted to r/%s but got back %s", target, url)
            raise RedditError(
                "The post did not reach the expected community.",
                code="wrong_subreddit",
            )

        return {
            "url": url,
            "post_id": created.get("id") or "",
            "fullname": created.get("name") or "",
            "subreddit": target,
        }

    # ── Internals ───────────────────────────────────────────────────────────

    def _access_token(self, user_id: str) -> str:
        connection = self.integrations.get(user_id, PROVIDER)
        if not connection or not connection.get("refresh_token_enc"):
            raise RedditNotConnected()
        try:
            refresh_token = token_crypto.decrypt(connection["refresh_token_enc"])
        except token_crypto.TokenCryptoUnavailable as exc:
            # Unreadable stored token — a key rotation, most likely. Treat it
            # as disconnected so the user is asked to reconnect rather than
            # shown an error they cannot act on.
            self.integrations.record_refresh_failure(user_id, PROVIDER, "token_unreadable")
            raise RedditNotConnected() from exc

        try:
            tokens = self._token_request(
                {"grant_type": "refresh_token", "refresh_token": refresh_token}
            )
        except RedditError as exc:
            if exc.code == "invalid_grant":
                # The user revoked us from their Reddit settings.
                self.integrations.record_refresh_failure(user_id, PROVIDER, "revoked_by_user")
                raise RedditNotConnected() from exc
            raise
        return tokens["access_token"]

    def _token_request(self, form: dict[str, str]) -> dict[str, Any]:
        with httpx.Client(timeout=_HTTP_TIMEOUT) as client:
            response = client.post(
                _TOKEN_URL,
                data=form,
                auth=(settings.reddit_client_id, settings.reddit_client_secret),
                headers={"User-Agent": settings.reddit_user_agent},
            )
        if response.status_code >= 400:
            logger.warning("reddit token http %s: %s", response.status_code, response.text[:300])
            raise RedditError("Reddit rejected the connection.", code="token_http_error")
        body = response.json()
        if "error" in body:
            raise RedditError(
                "Reddit rejected the connection.", code=str(body["error"])
            )
        if not body.get("access_token"):
            raise RedditError("Reddit did not return an access token.", code="no_access_token")
        return body

    def _get_json(self, path: str, access_token: str) -> dict[str, Any]:
        with httpx.Client(timeout=_HTTP_TIMEOUT) as client:
            response = client.get(f"{_API_BASE}{path}", headers=_headers(access_token))
        if response.status_code >= 400:
            raise RedditError("Could not read your Reddit account.", code="identity_failed")
        return response.json()

    def _revoke(self, refresh_token: str) -> None:
        with httpx.Client(timeout=_HTTP_TIMEOUT) as client:
            client.post(
                "https://www.reddit.com/api/v1/revoke_token",
                data={"token": refresh_token, "token_type_hint": "refresh_token"},
                auth=(settings.reddit_client_id, settings.reddit_client_secret),
                headers={"User-Agent": settings.reddit_user_agent},
            )

    @staticmethod
    def _error_code(errors: list) -> str:
        first = errors[0] if errors else []
        return str(first[0]).lower() if first else "reddit_error"

    @staticmethod
    def _error_message(errors: list) -> str:
        """
        Reddit returns [code, message, field] triples. Its own message is
        usually the clearest thing we can say, so it is passed through for the
        cases we have not phrased ourselves.
        """
        first = errors[0] if errors else []
        code = str(first[0]).upper() if first else ""
        known = {
            "RATELIMIT": (
                "Reddit is asking you to wait before posting again. New "
                "accounts can post less often."
            ),
            "SUBREDDIT_NOTALLOWED": "Your Reddit account cannot post in this community yet.",
            "NO_TEXT": "The post was empty.",
            "TOO_LONG": "The post is longer than Reddit allows.",
            "ALREADY_SUB": "This has already been posted.",
        }
        if code in known:
            return known[code]
        if len(first) > 1 and first[1]:
            return str(first[1])
        return "Reddit refused the post."
