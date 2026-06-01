from datetime import UTC, datetime, timedelta
from uuid import uuid4

import jwt

from backend.core.config import settings

# Whitelist of safe algorithms — prevents "none" algorithm attacks
_ALLOWED_ALGORITHMS = {"HS256", "HS512", "RS256"}

def _validate_algorithm() -> None:
    if settings.jwt_algorithm not in _ALLOWED_ALGORITHMS:
        raise ValueError(
            f"Unsafe JWT_ALGORITHM '{settings.jwt_algorithm}'. Must be one of {_ALLOWED_ALGORITHMS}."
        )


def create_access_token(user_id: str) -> tuple[str, datetime]:
    _validate_algorithm()
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
    try:
        # Explicitly pass only whitelisted algorithms — never allow "none"
        algorithms = [settings.jwt_algorithm] if settings.jwt_algorithm in _ALLOWED_ALGORITHMS else []
        return jwt.decode(token, settings.jwt_secret, algorithms=algorithms)
    except jwt.ExpiredSignatureError:
        raise jwt.ExpiredSignatureError("Token has expired")
    except jwt.InvalidTokenError as exc:
        raise jwt.InvalidTokenError(f"Invalid token: {exc}") from exc
