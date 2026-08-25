"""
Send one test message through the configured SMTP and say exactly what happened.

The contact form fails in ways that look alike from the browser: a wrong
password, a host that accepts mail and never delivers it, a From address the
provider refuses to own. This separates them.

    python -m backend.scripts.check_contact_email
    python -m backend.scripts.check_contact_email --to someone@example.com

Reads the same settings the API does, so a pass here means the form works.
"""

from __future__ import annotations

import argparse
import smtplib
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.core.config import settings  # noqa: E402
from backend.schemas.contact import ContactMessageRequest  # noqa: E402

# Providers whose whole purpose is to capture mail for inspection. Credentials
# can be perfect and the message still never reaches a real inbox, which is the
# single most confusing way for this to "work".
_CAPTURE_ONLY = {
    "sandbox.smtp.mailtrap.io": "Mailtrap sandbox captures mail in its web UI and never delivers it.",
    "smtp.mailtrap.io": "Looks like a Mailtrap testing host. Use live.smtp.mailtrap.io to deliver.",
    "localhost": "A local SMTP catcher (MailHog, Mailpit) does not deliver outward.",
    "127.0.0.1": "A local SMTP catcher (MailHog, Mailpit) does not deliver outward.",
}


def _mask(value: str) -> str:
    if not value:
        return "(unset)"
    return value[:3] + "***" if len(value) > 3 else "***"


def main() -> int:
    ap = argparse.ArgumentParser(description="Verify contact-form email delivery.")
    ap.add_argument("--to", help="Override the recipient for this test only.")
    args = ap.parse_args()

    recipient = args.to or settings.contact_recipient_email

    print("=" * 68)
    print("CONTACT EMAIL CHECK")
    print("=" * 68)
    print(f"  host      : {settings.smtp_host or '(unset)'}")
    print(f"  port      : {settings.smtp_port}")
    print(f"  user      : {_mask(settings.smtp_user)}")
    print(f"  password  : {'set' if settings.smtp_password else '(unset)'}")
    print(f"  from      : {settings.contact_from_email or '(unset)'}")
    print(f"  to        : {recipient}")
    print()

    problems = []
    if not settings.smtp_host or not settings.smtp_user:
        problems.append("SMTP_HOST and SMTP_USER must both be set.")
    warning = _CAPTURE_ONLY.get(settings.smtp_host.lower())
    if warning:
        problems.append(warning)
    if "@" not in (settings.contact_from_email or ""):
        problems.append(
            f"CONTACT_FROM_EMAIL is {settings.contact_from_email!r}, which is not an "
            "email address. It defaults to SMTP_USER, and some providers use a "
            "username there. Set CONTACT_FROM_EMAIL explicitly."
        )

    for p in problems:
        print(f"  ISSUE: {p}")
    if problems:
        print("\n  Fix the above, then run this again.")
        print("=" * 68)
        return 1

    payload = ContactMessageRequest(
        name="Contact form check",
        email=recipient,
        message=(
            "This is a test from backend.scripts.check_contact_email. "
            "If you are reading it in a real inbox, the contact form delivers."
        ),
    )

    # Imported here so the checks above still run when the service cannot load.
    from backend.services.contact_service import send_contact_message

    original = settings.contact_recipient_email
    try:
        if args.to:
            object.__setattr__(settings, "contact_recipient_email", args.to)
        send_contact_message(payload)
    except smtplib.SMTPAuthenticationError:
        print("  FAILED: the server rejected the credentials.")
        print("  For Gmail this usually means a normal password was used. Gmail")
        print("  needs a 16-character App Password, and 2-Step Verification on first.")
        print("=" * 68)
        return 1
    except Exception as exc:  # noqa: BLE001 - the message is the whole point
        detail = getattr(exc, "detail", None) or exc
        print(f"  FAILED: {type(exc).__name__}: {detail}")
        print("  The API log line starting [contact] carries the underlying error.")
        print("=" * 68)
        return 1
    finally:
        if args.to:
            object.__setattr__(settings, "contact_recipient_email", original)

    print(f"  SENT. Check {recipient}, including spam.")
    print("  Nothing there after a few minutes means the provider accepted the")
    print("  message and dropped it, which points at the sending domain, not the code.")
    print("=" * 68)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
