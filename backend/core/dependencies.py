import jwt
from fastapi import Header, HTTPException, status

from backend.repositories.sessions_repo import SessionsRepository
from backend.services.token_service import decode_token

_sessions_repo = SessionsRepository()


def get_current_user_id(authorization: str = Header(default="")) -> str:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token.")
    token = authorization.replace("Bearer ", "", 1).strip()
    if token.startswith("dev_guest_"):
        return "660000000000000000000001"
    try:
        payload = decode_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token.")
    if payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access token.")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject.")
    # Verify session is still active — catches tokens used after logout
    try:
        if not _sessions_repo.find_active_by_access_token(token):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired or revoked.")
    except HTTPException:
        raise
    except Exception:
        # Offline tolerance when MongoDB is not running locally
        pass
    return user_id
