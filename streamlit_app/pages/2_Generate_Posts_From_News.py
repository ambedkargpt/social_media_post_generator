from __future__ import annotations

import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import streamlit as st

from pipeline.profiles import get_user_profiles
from streamlit_app.components.auth import require_login
from streamlit_app.services.posts_from_news_service import (
    generate_posts_for_generated_item,
    load_generated_news_items,
)


require_login("Generate Posts From News")

st.title("Generate Posts From Generated News")
items = load_generated_news_items()
if not items:
    st.warning("No items found in `outputs/generated_news.json`.")
    st.stop()

all_roles = sorted(
    {
        str(p.get("user_role", "")).strip()
        for p in get_user_profiles()
        if str(p.get("user_role", "")).strip()
    }
)
mode = st.radio(
    "Profile mode",
    options=["all", "selected"],
    horizontal=True,
    format_func=lambda v: "Run all profiles" if v == "all" else "Run selected profiles only",
)
selected_roles = []
if mode == "selected":
    selected_roles = st.multiselect("Choose profile roles", options=all_roles, default=all_roles[:1] if all_roles else [])

st.session_state.setdefault("generated_news_selected_idx", 0)
selected = int(st.session_state.get("generated_news_selected_idx", 0))
selected = max(0, min(selected, len(items) - 1))

st.markdown("### Pick generated news item")
for idx, item in enumerate(items):
    headline = (item.get("headline") or item.get("video_title") or "(no headline)").strip()
    subheadline = (item.get("subheadline") or "").strip()
    if not subheadline:
        subheadline = "(no subheadline)"
    with st.container(border=True):
        st.markdown(f"**{idx + 1}. {headline}**")
        st.caption(subheadline)
        cols = st.columns([1, 4])
        with cols[0]:
            if st.button("Select", key=f"pick_news_{idx}", width="stretch"):
                st.session_state["generated_news_selected_idx"] = idx
                st.rerun()
        with cols[1]:
            if st.session_state.get("generated_news_selected_idx", 0) == idx:
                st.success("Selected")

selected = int(st.session_state.get("generated_news_selected_idx", 0))
selected = max(0, min(selected, len(items) - 1))

if st.button("Generate Posts", width="stretch"):
    if mode == "selected" and not selected_roles:
        st.warning("Choose at least one profile role.")
        st.stop()
    progress = st.progress(0, text="Preparing generation...")
    status = st.empty()
    started = time.time()

    def _on_progress(i: int, total: int, role: str) -> None:
        pct = int((i / max(total, 1)) * 100)
        elapsed = int(time.time() - started)
        progress.progress(
            pct,
            text=f"Generating profile {i}/{total}: {role} (elapsed: {elapsed}s)",
        )
        status.info(f"Running: **{role}**")

    with st.spinner("Generating posts for selected profile set..."):
        payload = generate_posts_for_generated_item(
            items[selected],
            selected_profile_roles=(selected_roles if mode == "selected" else None),
            progress_callback=_on_progress,
        )
    progress.progress(100, text="Generation complete.")
    status.success("All selected profiles completed.")
    st.success(f"Generated {len(payload.get('profiles', []))} profile post(s).")
    st.json(payload)
