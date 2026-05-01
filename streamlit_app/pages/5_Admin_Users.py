from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import streamlit as st

from streamlit_app.components.auth import (
    add_or_update_user,
    list_users,
    remove_users,
    require_admin,
    require_login,
)


require_login("Admin Users")
require_admin()

st.title("Admin - Manage Users")
st.caption("Create, update, deactivate, and remove testing users.")

with st.expander("Add new user", expanded=True):
    with st.form("add_user_form", clear_on_submit=True):
        username = st.text_input("Username")
        password = st.text_input("Password", type="password")
        role = st.selectbox("Role", options=["tester", "admin"])
        active = st.checkbox("Active", value=True)
        add_submit = st.form_submit_button("Add user", width="stretch")
    if add_submit:
        try:
            add_or_update_user(username=username, password=password, role=role, active=active)
        except Exception as exc:
            st.error(str(exc))
        else:
            st.success(f"User `{username}` added.")
            st.rerun()

st.subheader("Existing users")
rows = list_users()
if not rows:
    st.warning("No users found.")
    st.stop()

for row in rows:
    user = row["username"]
    with st.container(border=True):
        col1, col2, col3, col4 = st.columns([2, 1, 1, 2])
        with col1:
            st.markdown(f"**{user}**")
        with col2:
            role_val = st.selectbox(
                f"Role ({user})",
                options=["tester", "admin"],
                index=0 if row["role"] == "tester" else 1,
                key=f"role_{user}",
                label_visibility="collapsed",
            )
        with col3:
            active_val = st.checkbox(
                "Active",
                value=bool(row["active"]),
                key=f"active_{user}",
                label_visibility="collapsed",
            )
        with col4:
            with st.form(f"update_{user}", clear_on_submit=True):
                new_password = st.text_input(
                    "New password (optional)",
                    type="password",
                    key=f"pwd_{user}",
                )
                c1, c2 = st.columns(2)
                save_clicked = c1.form_submit_button("Save", width="stretch")
                remove_clicked = c2.form_submit_button("Remove", width="stretch")
            if save_clicked:
                try:
                    add_or_update_user(
                        username=user,
                        password=(new_password or None),
                        role=role_val,
                        active=active_val,
                    )
                except Exception as exc:
                    st.error(str(exc))
                else:
                    st.success(f"Updated `{user}`.")
                    st.rerun()
            if remove_clicked:
                try:
                    removed = remove_users([user])
                except Exception as exc:
                    st.error(str(exc))
                else:
                    if removed:
                        st.success(f"Removed `{user}`.")
                        st.rerun()
                    else:
                        st.warning("User could not be removed.")

st.subheader("Bulk remove")
choices = [r["username"] for r in rows]
to_remove = st.multiselect("Select users to remove", options=choices)
if st.button("Remove selected users", type="primary", width="stretch"):
    try:
        removed = remove_users(to_remove)
    except Exception as exc:
        st.error(str(exc))
    else:
        st.success(f"Removed {removed} user(s).")
        st.rerun()
