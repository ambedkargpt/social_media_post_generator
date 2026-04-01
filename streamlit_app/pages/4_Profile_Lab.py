from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import pandas as pd
import streamlit as st

from pipeline.profiles import PROFILE_FIELDS
from streamlit_app.components.auth import is_admin
from streamlit_app.components.auth import require_login
from streamlit_app.services.profile_service import load_profiles, profiles_path, save_profiles


require_login("Profile Lab")

st.title("Profile Lab")
st.caption("Edit profile values to test post-generation behavior.")
st.caption(f"Backing file: `{profiles_path()}`")

rows = load_profiles()
df = pd.DataFrame(rows, columns=PROFILE_FIELDS)

edited = st.data_editor(
    df,
    width="stretch",
    num_rows="fixed",
    hide_index=True,
)

st.markdown("### Add new profile")
with st.form("add_profile_form", clear_on_submit=True):
    new_profile = {}
    for field in PROFILE_FIELDS:
        new_profile[field] = st.text_input(field)
    add_profile_clicked = st.form_submit_button("Add Profile", width="stretch")

if add_profile_clicked:
    role = (new_profile.get("user_role") or "").strip()
    if not role:
        st.warning("`user_role` is required to add a profile.")
    else:
        current_rows = edited.to_dict(orient="records")
        current_rows.append(new_profile)
        save_profiles(current_rows)
        st.success(f"Added profile: {role}")
        st.rerun()

col1, col2 = st.columns(2)
with col1:
    if st.button("Save Profiles to Parquet", width="stretch"):
        save_profiles(edited.to_dict(orient="records"))
        st.success("Profiles saved.")

with col2:
    if st.button("Reload From Disk", width="stretch"):
        st.rerun()

if is_admin():
    st.markdown("### Remove profiles (admin only)")
    current_rows = edited.to_dict(orient="records")
    remove_options = [
        f"{i + 1}. {str(row.get('user_role', '')).strip() or '(no user_role)'}"
        for i, row in enumerate(current_rows)
    ]
    selected_labels = st.multiselect(
        "Select profiles to remove",
        options=remove_options,
    )
    if st.button("Remove selected profiles", type="primary", width="stretch"):
        remove_idx = {int(lbl.split(".", 1)[0]) - 1 for lbl in selected_labels}
        remaining = [row for i, row in enumerate(current_rows) if i not in remove_idx]
        if len(remaining) == len(current_rows):
            st.warning("No profiles selected.")
        elif not remaining:
            st.error("Cannot remove all profiles.")
        else:
            save_profiles(remaining)
            st.success(f"Removed {len(current_rows) - len(remaining)} profile(s).")
            st.rerun()
