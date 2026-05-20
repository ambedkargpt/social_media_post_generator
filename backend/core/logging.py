"""
Structured logging for production (JSON lines on stdout for journald / log collectors).
"""

from __future__ import annotations

import json
import logging
import os
import sys
from typing import Any


class JsonFormatter(logging.Formatter):
    """One JSON object per line."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "time": self.formatTime(record, self.datefmt),
        }
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        # Standard attributes useful for request tracing
        for key in ("request_id", "name", "pathname", "lineno"):
            if hasattr(record, key):
                val = getattr(record, key, None)
                if val is not None:
                    payload[key] = val
        return json.dumps(payload, ensure_ascii=False)


_configured = False


def setup_logging() -> None:
    """Idempotent: configure root logger once (safe across Gunicorn workers if called early)."""
    global _configured
    if _configured:
        return

    level_name = (os.getenv("LOG_LEVEL") or "INFO").strip().upper()
    level = getattr(logging, level_name, logging.INFO)
    use_json = (os.getenv("LOG_JSON", "true").lower() in {"1", "true", "yes", "on"})

    root = logging.getLogger()
    root.setLevel(level)

    # Remove inherited handlers so we don't duplicate lines under reload
    for h in list(root.handlers):
        root.removeHandler(h)

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(level)
    if use_json:
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(
            logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s")
        )
    root.addHandler(handler)

    # Quiet noisy libraries unless DEBUG
    if level > logging.DEBUG:
        logging.getLogger("httpx").setLevel(logging.WARNING)
        logging.getLogger("httpcore").setLevel(logging.WARNING)

    _configured = True
