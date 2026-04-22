from typing import Any

from fastapi import HTTPException, status

from backend.core.config import settings


def verify_google_id_token(id_token: str) -> dict[str, Any]:
    try:
        from google.auth.transport import requests as grequests
        from google.oauth2 import id_token as gid_token
    except ImportError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="google-auth dependency missing.",
        ) from exc

    audience = settings.google_client_id or None
    try:
        payload = gid_token.verify_oauth2_token(id_token, grequests.Request(), audience=audience)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google ID token.") from exc
    return payload
