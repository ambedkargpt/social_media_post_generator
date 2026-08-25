"""
Email OTP delivery over the same SMTP the contact form uses.

Nothing sent one. signup created the code, resend_otp had a phone branch and no
email branch, and forgot_password returned "Verification code sent to your
email" having sent nothing. It went unnoticed because AUTH_DEBUG_RETURN_OTP
hands the code back in the API response in development, and that gate is closed
in production, so email signup worked on a laptop and was a dead end live.

Failure is logged, not raised: a code that cannot be delivered should not also
destroy the account that was just created. The caller decides what to tell the
user.
"""

from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from backend.core.config import settings

logger = logging.getLogger(__name__)

_TIMEOUT_SECONDS = 20

_SUBJECTS = {
    "signup": "Verify your AmbedkarGPT account",
    "reset": "Reset your AmbedkarGPT password",
    "login": "Your AmbedkarGPT sign-in code",
}

_BODIES = {
    "signup": "Welcome to AmbedkarGPT. Enter this code to verify your account:",
    "reset": "Someone asked to reset the password on this account. Enter this code to continue:",
    "login": "Enter this code to sign in:",
}


def _text(kind: str, otp_code: str, minutes: int) -> str:
    lead = _BODIES.get(kind, _BODIES["login"])
    return (
        f"{lead}\n"
        f"\n"
        f"    {otp_code}\n"
        f"\n"
        f"The code expires in {minutes} minutes.\n"
        f"\n"
        f"If you did not ask for this, you can ignore this email and nothing "
        f"will change.\n"
        f"\n"
        f"-- \n"
        f"AmbedkarGPT\n"
    )


def try_send_otp_email(email: str, otp_code: str, kind: str = "signup") -> bool:
    """
    Send one OTP. Returns whether it went, and never raises.

    ``kind`` is signup, reset or login, and only changes the wording.
    """
    if not email or not otp_code:
        return False
    if not settings.smtp_host or not settings.smtp_user:
        logger.error(
            "[otp] SMTP is not configured, so the code for %s was not sent. "
            "Set SMTP_HOST, SMTP_USER and SMTP_PASSWORD.",
            email,
        )
        return False

    msg = EmailMessage()
    msg["Subject"] = _SUBJECTS.get(kind, _SUBJECTS["login"])
    # Not contact_from_email: that carries a "Contact Form" display name, which
    # reads wrong above a verification code. Gmail rewrites From to the
    # authenticated account regardless, so only the name is ours to choose.
    msg["From"] = f"AmbedkarGPT <{settings.smtp_user}>"
    msg["To"] = email
    msg.set_content(_text(kind, otp_code, settings.otp_expiry_minutes))

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=_TIMEOUT_SECONDS) as smtp:
            smtp.ehlo()
            if settings.smtp_port != 465:
                smtp.starttls()
                smtp.ehlo()
            if settings.smtp_password:
                smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(msg)
    except Exception as exc:  # noqa: BLE001 - delivery must not break signup
        # The code itself is never logged: these logs are readable by more
        # people than the mailbox is.
        logger.error("[otp] could not send the %s code to %s: %s", kind, email, exc)
        return False

    logger.info("[otp] %s code sent to %s", kind, email)
    return True
