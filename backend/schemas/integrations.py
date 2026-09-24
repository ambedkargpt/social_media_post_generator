from datetime import datetime

from pydantic import BaseModel, Field


class ConnectedAccount(BaseModel):
    """What the app may say about a connected account. Never the token."""

    provider: str
    account_handle: str | None = None
    connected_at: datetime | None = None
    scopes: list[str] = Field(default_factory=list)


class RedditStatusResponse(BaseModel):
    # configured: whether this deployment has Reddit credentials at all. The
    # UI needs to tell "we cannot do this" apart from "you have not connected".
    configured: bool
    connected: bool
    subreddit: str
    account: ConnectedAccount | None = None


class AuthorizeUrlResponse(BaseModel):
    authorize_url: str


class PublishToRedditRequest(BaseModel):
    # The headline makes the Reddit title; the post body is the selftext. Both
    # are sent by the client so what the user saw is what gets posted, rather
    # than the server re-deriving it and posting something slightly different.
    title: str = Field(min_length=1, max_length=500)
    body: str = Field(default="", max_length=40000)


class PublicationResponse(BaseModel):
    platform: str
    url: str
    posted_at: datetime
    subreddit: str | None = None
