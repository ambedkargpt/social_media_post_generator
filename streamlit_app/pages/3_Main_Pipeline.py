from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import json
from pathlib import Path

import streamlit as st

from config import get_settings
from pipeline.profiles import get_user_profiles
from streamlit_app.components.auth import require_login
from streamlit_app.components.tts_playback import (
    gtts_lang_widget,
    render_gtts_native_player,
    store_gtts_batch,
)
from streamlit_app.services.main_service import GENERATED_NEWS_PATH, run_main_flow


require_login("Main Pipeline")

st.title("Main Pipeline")
settings = get_settings()
with st.expander("Text-to-speech (gTTS)", expanded=False):
    tts_lang = gtts_lang_widget(settings.gtts_lang)
all_roles = sorted(
    {
        str(p.get("user_role", "")).strip()
        for p in get_user_profiles()
        if str(p.get("user_role", "")).strip()
    }
)
profile_mode = st.radio(
    "Profile mode",
    options=["all", "selected"],
    horizontal=True,
    format_func=lambda v: "Run all profiles" if v == "all" else "Run selected profiles only",
)
selected_roles = []
if profile_mode == "selected":
    selected_roles = st.multiselect(
        "Choose profile roles",
        options=all_roles,
        default=all_roles[:1] if all_roles else [],
    )

mode = st.radio(
    "Input mode",
    options=["generated", "manual"],
    format_func=lambda v: "Generated news from outputs/generated_news.json" if v == "generated" else "Manual news input",
    horizontal=True,
)

pick_idx = 0
headline = ""
subheadline = ""
body = ""

if mode == "generated":
    if not GENERATED_NEWS_PATH.is_file():
        st.error(f"Missing file: {GENERATED_NEWS_PATH}")
        st.stop()
    data = json.loads(Path(GENERATED_NEWS_PATH).read_text(encoding="utf-8"))
    items = [row for row in data.get("items", []) if isinstance(row, dict)]
    if not items:
        st.warning("No generated news items available.")
        st.stop()
    st.session_state.setdefault("main_generated_selected_idx", 0)
    current_idx = int(st.session_state.get("main_generated_selected_idx", 0))
    current_idx = max(0, min(current_idx, len(items) - 1))
    st.markdown("### Select generated news item")
    for idx, item in enumerate(items):
        headline_text = (item.get("headline") or item.get("video_title") or "(no headline)").strip()
        subheadline_text = (item.get("subheadline") or "").strip()
        if not subheadline_text:
            subheadline_text = "(no subheadline)"
        with st.container(border=True):
            st.markdown(f"**{idx + 1}. {headline_text}**")
            st.caption(subheadline_text)
            cols = st.columns([1, 4])
            with cols[0]:
                if st.button("Select", key=f"main_pick_news_{idx}", width="stretch"):
                    st.session_state["main_generated_selected_idx"] = idx
                    st.rerun()
            with cols[1]:
                if st.session_state.get("main_generated_selected_idx", 0) == idx:
                    st.success("Selected")
    pick_idx = int(st.session_state.get("main_generated_selected_idx", 0))
    pick_idx = max(0, min(pick_idx, len(items) - 1))
else:
    headline = st.text_input("Headline")
    subheadline = st.text_input("Sub-headline")
    body = st.text_area("Body (optional)", height=180)

if st.button("Run Main Flow", width="stretch"):
    if profile_mode == "selected" and not selected_roles:
        st.warning("Choose at least one profile role.")
        st.stop()
    if mode == "manual" and not (headline.strip() or body.strip()):
        st.warning("Provide headline or body for manual mode.")
        st.stop()
    with st.spinner("Running main pipeline..."):
        outputs = run_main_flow(
            mode=mode,
            headline=headline,
            subheadline=subheadline,
            body=body,
            pick_idx=int(pick_idx),
            selected_profile_roles=(selected_roles if profile_mode == "selected" else None),
        )
    st.session_state["main_run"] = int(st.session_state.get("main_run", 0)) + 1
    mrun = int(st.session_state["main_run"])
    st.success(f"Generated output for {len(outputs)} news item(s).")

    tts_pairs: list[tuple[str, str]] = []
    for bi, block in enumerate(outputs):
        for i, ref in enumerate(block.get("references") or []):
            tts_pairs.append((ref.get("chunk_text") or "", f"main_b{bi}_r_{mrun}_{i}"))
        for j, po in enumerate(block.get("profiles") or []):
            role = str(po.get("profile", {}).get("user_role") or f"profile_{j + 1}")
            post_text = po.get("post") or ""
            safe = "".join(c if c.isalnum() else "_" for c in role)[:40]
            tts_pairs.append((post_text, f"main_b{bi}_p_{mrun}_{j}_{safe}"))
    if tts_pairs:
        tts_bar = st.progress(0, text="Synthesizing speech…")

        def _tts_progress(frac: float, msg: str) -> None:
            tts_bar.progress(min(max(frac, 0.0), 1.0), text=msg)

        store_gtts_batch(tts_pairs, tts_lang, set_progress=_tts_progress)

    for bi, block in enumerate(outputs):
        st.markdown(f"### Block {bi + 1}")
        st.markdown("#### Retrieved chunks (TTS)")
        for i, ref in enumerate(block.get("references") or []):
            t = (ref.get("video_title") or "").strip() or f"reference {i + 1}"
            with st.expander(f"Ref {i + 1}: {t[:80]}{'…' if len(t) > 80 else ''}", expanded=False):
                st.text_area(
                    "chunk",
                    value=ref.get("chunk_text") or "",
                    height=200,
                    key=f"main_b{bi}_ref_{mrun}_{i}",
                    label_visibility="collapsed",
                )
                render_gtts_native_player(f"main_b{bi}_r_{mrun}_{i}", heading="Chunk audio")
        st.markdown("#### Generated posts (TTS)")
        for j, po in enumerate(block.get("profiles") or []):
            role = str(po.get("profile", {}).get("user_role") or f"profile_{j + 1}")
            post_text = po.get("post") or ""
            with st.expander(f"Post: {role}", expanded=(j == 0 and bi == 0)):
                st.markdown(post_text)
                safe = "".join(c if c.isalnum() else "_" for c in role)[:40]
                render_gtts_native_player(f"main_b{bi}_p_{mrun}_{j}_{safe}", heading="Post audio")

    with st.expander("Raw JSON"):
        st.json(outputs)
