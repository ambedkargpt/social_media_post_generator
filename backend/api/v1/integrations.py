"""Accounts the user has connected elsewhere, and publishing through them.

Only Reddit today. The shape is deliberately provider-shaped rather than
Reddit-shaped — adding Twitter later is another block of routes over the same
repository, not a second way of storing connected accounts.
"""
import logging
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse

from backend.core.config import settings
from backend.core.dependencies import get_current_user_id
from backend.schemas.integrations import (
    AuthorizeUrlResponse,
    RedditStatusResponse,
)
from backend.services.reddit_service import RedditError, RedditService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/integrations", tags=["integrations"])
reddit = RedditService()


@router.get("/reddit/status", response_model=RedditStatusResponse)
def reddit_status(current_user_id: str = Depends(get_current_user_id)) -> RedditStatusResponse:
    return RedditStatusResponse(**reddit.status(current_user_id))


@router.post("/reddit/authorize", response_model=AuthorizeUrlResponse)
def reddit_authorize(current_user_id: str = Depends(get_current_user_id)) -> AuthorizeUrlResponse:
    """The URL to send the user to. The app never handles their Reddit password."""
    try:
        return AuthorizeUrlResponse(authorize_url=reddit.authorize_url(current_user_id))
    except RedditError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error": exc.code, "message": str(exc)},
        ) from exc


@router.get("/reddit/callback")
def reddit_callback(
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
) -> RedirectResponse:
    """
    Where Reddit sends the browser back to.

    Deliberately unauthenticated: this is a top-level navigation from
    reddit.com, so it carries no Authorization header. Who it belongs to comes
    from the signed `state`, which is why that is signed and short-lived.

    Always a redirect, never JSON — a person is looking at this, not a script.
    """
    def back(**params: str) -> RedirectResponse:
        return RedirectResponse(
            f"{settings.frontend_base_url}/preferences?{urlencode(params)}",
            status_code=status.HTTP_303_SEE_OTHER,
        )

    if error:
        # The usual one is access_denied — the user pressed Decline, which is
        # not a failure worth shouting about.
        return back(reddit="declined")
    if not code or not state:
        return back(reddit="error", reason="missing_code")

    try:
        account = reddit.complete(code=code, state=state)
    except RedditError as exc:
        logger.warning("reddit callback failed: %s", exc)
        return back(reddit="error", reason=exc.code)
    except Exception:  # noqa: BLE001 — the browser still needs somewhere to land
        logger.exception("reddit callback crashed")
        return back(reddit="error", reason="unexpected")

    return back(reddit="connected", account=str((account or {}).get("account_handle") or ""))


@router.delete("/reddit", status_code=status.HTTP_204_NO_CONTENT)
def reddit_disconnect(current_user_id: str = Depends(get_current_user_id)) -> None:
    reddit.disconnect(current_user_id)
