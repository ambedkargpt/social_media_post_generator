from typing import Any

import httpx
from fastapi import HTTPException, status


def fetch_google_userinfo(access_token: str) -> dict[str, Any]:
    response = httpx.get(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=10,
    )
    if response.status_code != 200:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google access token.")
    return response.json()
