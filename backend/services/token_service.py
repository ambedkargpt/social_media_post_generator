from datetime import UTC, datetime, timedelta
from uuid import uuid4

import jwt

from backend.core.config import settings


def create_access_token(user_id: str) -> tuple[str, datetime]:
    expires_at = datetime.now(UTC) + timedelta(minutes=settings.access_token_expiry_minutes)
    payload = {
        "sub": user_id,
        "type": "access",
        "jti": str(uuid4()),
        "exp": int(expires_at.timestamp()),
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, expires_at


def create_refresh_token(user_id: str) -> tuple[str, datetime]:
    expires_at = datetime.now(UTC) + timedelta(days=settings.refresh_token_expiry_days)
    payload = {
        "sub": user_id,
        "type": "refresh",
        "jti": str(uuid4()),
        "exp": int(expires_at.timestamp()),
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, expires_at


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
