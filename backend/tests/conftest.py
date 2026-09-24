"""
Shared test setup.

`backend.core.config` calls `get_settings()` at import time, and that refuses to
load without OPENAI_API_KEY and GEMINI_API_KEY. Anything that reaches
`backend.db.mongo` therefore imports it, so a test that never makes a model call
still cannot be collected without those variables set.

On a developer machine `.env` supplies them and this is invisible. CI has no
`.env`, so every test touching the database errored at setup there while passing
locally.

These are deliberately obvious placeholders. The tests they unblock use mongomock
and stubbed clients; nothing here reaches a real service, and a value that looks
like a key would make that harder to see, not easier.
"""
from __future__ import annotations

import os

_PLACEHOLDERS = {
    "OPENAI_API_KEY": "test-not-a-real-key",
    "GEMINI_API_KEY": "test-not-a-real-key",
    "MONGODB_URI": "mongodb://localhost:27017",
    "JWT_SECRET": "test-secret",
}

# setdefault, so a developer running against their own .env keeps their values.
for _name, _value in _PLACEHOLDERS.items():
    os.environ.setdefault(_name, _value)
