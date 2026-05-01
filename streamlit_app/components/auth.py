from __future__ import annotations

import hashlib
import hmac
import json
import secrets
from pathlib import Path
from typing import Dict, List

import streamlit as st


ROOT = Path(__file__).resolve().parents[2]
USERS_PATH = ROOT / "streamlit_app" / "auth" / "users.json"


def _pbkdf2_hash(password: str, salt: str, rounds: int = 120_000) -> str:
    raw = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), rounds)
    return raw.hex()


def _verify_password(password: str, record: Dict[str, str]) -> bool:
    salt = str(record.get("salt", ""))
    expected = str(record.get("password_hash", ""))
    rounds = int(record.get("rounds", 120_000))
    if not salt or not expected:
        return False
    actual = _pbkdf2_hash(password, salt, rounds=rounds)
    return hmac.compare_digest(actual, expected)


def _seed_default_user() -> None:
    if USERS_PATH.exists():
        return
    USERS_PATH.parent.mkdir(parents=True, exist_ok=True)
    # Default credentials: admin / admin123 (change immediately)
    salt = secrets.token_hex(16)
    rounds = 120_000
    payload = {
        "users": [
            {
                "username": "admin",
                "salt": salt,
                "rounds": rounds,
                "password_hash": _pbkdf2_hash("admin123", salt, rounds=rounds),
                "role": "admin",
                "active": True,
            }
        ]
    }
    USERS_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def _load_users() -> Dict[str, Dict[str, str]]:
    _seed_default_user()
    try:
        data = json.loads(USERS_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}
    out: Dict[str, Dict[str, str]] = {}
    for row in data.get("users", []):
        if not isinstance(row, dict):
            continue
        username = str(row.get("username", "")).strip()
        if username:
            out[username] = row
    return out


def _save_users(users: Dict[str, Dict[str, str]]) -> None:
    admin_count = sum(1 for rec in users.values() if rec.get("role") == "admin" and rec.get("active", True))
    if admin_count < 1:
        raise ValueError("At least one active admin user is required.")
    USERS_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {"users": list(users.values())}
    USERS_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def current_user() -> str:
    return str(st.session_state.get("auth_user", "")).strip()


def current_role() -> str:
    return str(st.session_state.get("auth_role", "")).strip()


def is_admin() -> bool:
    return current_role() == "admin"


def require_admin() -> None:
    if not is_admin():
        st.error("Admin access required.")
        st.stop()


def list_users() -> List[Dict[str, str]]:
    users = _load_users()
    rows: List[Dict[str, str]] = []
    for username, rec in sorted(users.items(), key=lambda x: x[0].lower()):
        rows.append(
            {
                "username": username,
                "role": str(rec.get("role", "tester")),
                "active": bool(rec.get("active", True)),
            }
        )
    return rows


def add_or_update_user(username: str, password: str | None, role: str = "tester", active: bool = True) -> None:
    user = username.strip()
    if not user:
        raise ValueError("Username cannot be empty.")
    users = _load_users()
    existing = dict(users.get(user, {"username": user}))
    existing["username"] = user
    existing["role"] = role.strip() or "tester"
    existing["active"] = bool(active)
    existing["rounds"] = int(existing.get("rounds", 120_000))
    if password:
        salt = secrets.token_hex(16)
        existing["salt"] = salt
        existing["password_hash"] = _pbkdf2_hash(password, salt, rounds=existing["rounds"])
    elif "password_hash" not in existing or "salt" not in existing:
        raise ValueError("Password is required for new users.")
    users[user] = existing
    _save_users(users)


def remove_users(usernames: List[str]) -> int:
    targets = {u.strip() for u in usernames if u.strip()}
    if not targets:
        return 0
    users = _load_users()
    current = current_user()
    targets.discard(current)
    removed = 0
    for u in list(targets):
        if u in users:
            users.pop(u)
            removed += 1
    _save_users(users)
    return removed


def init_auth_state() -> None:
    st.session_state.setdefault("auth_ok", False)
    st.session_state.setdefault("auth_user", "")
    st.session_state.setdefault("auth_role", "")


def login_ui() -> None:
    st.subheader("Sign in")
    with st.form("login_form", clear_on_submit=False):
        username = st.text_input("Username")
        password = st.text_input("Password", type="password")
        submitted = st.form_submit_button("Login", width="stretch")
    if not submitted:
        return
    users = _load_users()
    rec = users.get(username.strip())
    if not rec or not rec.get("active", True):
        st.error("Invalid credentials.")
        return
    if not _verify_password(password, rec):
        st.error("Invalid credentials.")
        return
    st.session_state["auth_ok"] = True
    st.session_state["auth_user"] = username.strip()
    st.session_state["auth_role"] = str(rec.get("role", "tester"))
    st.success("Login successful.")
    st.rerun()


def require_login(page_title: str) -> bool:
    st.set_page_config(page_title=page_title, layout="wide")
    init_auth_state()
    if st.session_state.get("auth_ok"):
        with st.sidebar:
            st.caption(f"Logged in as `{st.session_state.get('auth_user', '')}`")
            if st.button("Logout", width="stretch"):
                st.session_state["auth_ok"] = False
                st.session_state["auth_user"] = ""
                st.session_state["auth_role"] = ""
                st.rerun()
        return True
    st.title("RAG Pipeline Testing Console")
    st.info("Authenticated access only.")
    login_ui()
    st.stop()
    return False
