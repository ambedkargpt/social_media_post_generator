"""Encryption for third-party tokens we hold on a user's behalf.

A stored Reddit refresh token is the right to post as that person, indefinitely.
It never sits in the database in the clear, so a leaked dump is not the same
thing as a leaked ability to post as our users.

Fernet (AES-128-CBC + HMAC-SHA256) is the right weight here: the threat is a
copied database, not an attacker who already holds the application's own key.

Generate a key once and put it in INTEGRATION_TOKEN_KEY:

    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

Rotating it invalidates every stored token, which logs everyone out of their
connected accounts rather than losing data — they reconnect and carry on.
"""
from __future__ import annotations

from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken

from backend.core.config import settings


class TokenCryptoUnavailable(RuntimeError):
    """Raised when INTEGRATION_TOKEN_KEY is missing or malformed."""


@lru_cache(maxsize=1)
def _cipher() -> Fernet:
    key = (settings.integration_token_key or "").strip()
    if not key:
        raise TokenCryptoUnavailable(
            "INTEGRATION_TOKEN_KEY is not set, so connected-account tokens "
            "cannot be stored. Generate one with Fernet.generate_key()."
        )
    try:
        return Fernet(key.encode())
    except (ValueError, TypeError) as exc:
        raise TokenCryptoUnavailable(
            "INTEGRATION_TOKEN_KEY is not a valid Fernet key (32 url-safe "
            "base64-encoded bytes)."
        ) from exc


def is_configured() -> bool:
    """Whether tokens can be stored at all. Checked before starting a connect."""
    try:
        _cipher()
    except TokenCryptoUnavailable:
        return False
    return True


def encrypt(plaintext: str) -> str:
    return _cipher().encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    """
    Raises TokenCryptoUnavailable when the value cannot be read — which is what
    happens to every stored token after a key rotation. Callers treat that as
    "not connected" and ask the user to connect again.
    """
    try:
        return _cipher().decrypt(ciphertext.encode()).decode()
    except InvalidToken as exc:
        raise TokenCryptoUnavailable(
            "Stored token could not be decrypted; INTEGRATION_TOKEN_KEY may "
            "have changed since it was written."
        ) from exc
