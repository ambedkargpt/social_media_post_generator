import secrets
from datetime import UTC, datetime, timedelta

from backend.core.config import settings
from backend.services.security import hash_otp


def generate_otp_code() -> str:
    return f"{secrets.randbelow(10**6):06d}"


def otp_expiry_time() -> datetime:
    return datetime.now(UTC) + timedelta(minutes=settings.otp_expiry_minutes)


def build_hashed_otp() -> tuple[str, str]:
    code = generate_otp_code()
    return code, hash_otp(code)
