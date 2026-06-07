"""
SMS OTP delivery via 2Factor.in.

API: GET https://2factor.in/API/V1/{KEY}/SMS/{PHONE}/{OTP}/TwoFactor
Phone must be 10-digit Indian mobile (no country code).

In development (AUTH_DEBUG_RETURN_OTP=true) the OTP is also returned in the
API response and auto-filled in the UI, so SMS delivery is not critical for testing.
"""
import logging
import re

import requests

from backend.core.config import settings

logger = logging.getLogger(__name__)


def _to_10digit(phone: str) -> str | None:
    """Strip country code and spaces; return 10-digit Indian mobile or None."""
    digits = re.sub(r"\D", "", phone)
    if digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]
    if len(digits) == 10:
        return digits
    return None


def try_send_otp_sms(phone: str, otp_code: str = "") -> None:
    """
    Send OTP via 2Factor.in. Logs and swallows errors — never raises.
    In dev mode the OTP is returned in the API response regardless.
    """
    if not settings.twofactor_api_key:
        logger.warning("TWOFACTOR_API_KEY not set; skipping SMS to %s.", phone)
        return

    number = _to_10digit(phone)
    if not number:
        logger.warning("2Factor: cannot convert '%s' to 10-digit format.", phone)
        return

    try:
        url = f"https://2factor.in/API/V1/{settings.twofactor_api_key}/SMS/{number}/{otp_code}"
        resp = requests.get(url, timeout=10)
        data = resp.json()
        if data.get("Status") == "Success":
            logger.info("OTP SMS sent to %s via 2Factor.in.", phone)
        else:
            logger.warning("2Factor.in error for %s: %s", phone, data.get("Details"))
    except Exception as exc:
        logger.warning("2Factor.in request failed for %s: %s", phone, exc)
