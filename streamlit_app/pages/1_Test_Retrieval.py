from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import streamlit as st

from config import get_settings
from streamlit_app.components.auth import require_login
from streamlit_app.components.tts_playback import (
    gtts_lang_widget,
    render_gtts_native_player,
    store_gtts_batch,
)
from streamlit_app.services.retrieval_service import run_retrieval


require_login("Test Retrieval")

st.title("Test Retrieval")
settings = get_settings()

with st.expander("Text-to-speech (gTTS)", expanded=False):
    tts_lang = gtts_lang_widget(settings.gtts_lang)

query = st.text_area("Query", height=140, placeholder="Enter a query/news summary")
top_k = st.slider("Top K", min_value=1, max_value=25, value=5, step=1)
semrag_mode = st.selectbox(
    "SEMRAG mode",
    options=["hybrid", "local", "global"],
    index=["hybrid", "local", "global"].index(getattr(settings, "semrag_search_mode", "hybrid"))
    if getattr(settings, "semrag_search_mode", "hybrid") in {"hybrid", "local", "global"}
    else 0,
)

if st.button("Run Retrieval", width="stretch"):
    if not query.strip():
        st.warning("Please provide a query.")
    else:
        with st.spinner("Running retrieval..."):
            payload = run_retrieval(query=query.strip(), top_k=int(top_k), semrag_mode=semrag_mode)
        st.session_state["tr_run"] = int(st.session_state.get("tr_run", 0)) + 1
        rid = int(st.session_state["tr_run"])
        n = len(payload.get("results", []))
        st.success(f"Retrieved {n} chunk(s).")
        st.caption(
            "SEMRAG mode: `{mode}` | effective: `{enabled}` | fallback used: `{fallback}`".format(
                mode=payload.get("semrag_mode", semrag_mode),
                enabled=payload.get("semrag_enabled_effective", False),
                fallback=payload.get("semrag_fallback_used", False),
            )
        )
        if payload.get("semrag_error"):
            st.warning(f"SEMRAG fallback reason: {payload['semrag_error']}")
        results = payload.get("results") or []
        if not results:
            st.info("No chunks matched this query.")
        else:
            tts_bar = st.progress(0, text="Synthesizing speech…")

            def _tts_progress(frac: float, msg: str) -> None:
                tts_bar.progress(min(max(frac, 0.0), 1.0), text=msg)

            pairs = [(row.get("chunk_text") or "", f"tr_c_{rid}_{i}") for i, row in enumerate(results)]
            store_gtts_batch(pairs, tts_lang, set_progress=_tts_progress)
        for i, row in enumerate(results):
            title = (row.get("video_title") or "").strip() or "(no title)"
            label = title if len(title) <= 96 else title[:93] + "..."
            with st.expander(f"Chunk {i + 1}: {label}", expanded=(i == 0)):
                st.markdown(f"**Similarity** `{row.get('similarity_score', 0):.3f}`")
                if row.get("semrag_score") is not None:
                    st.markdown(f"**SEMRAG score** `{row.get('semrag_score', 0):.3f}`")
                if row.get("relevance_score") is not None:
                    st.markdown(f"**Relevance** `{row.get('relevance_score', 0):.3f}`")
                if row.get("video_link"):
                    st.markdown(f"[Video link]({row['video_link']})")
                st.markdown("**Chunk text**")
                st.text_area(
                    "chunk",
                    value=row.get("chunk_text") or "",
                    height=220,
                    key=f"chunk_text_{rid}_{i}",
                    label_visibility="collapsed",
                )
                render_gtts_native_player(f"tr_c_{rid}_{i}", heading="Chunk audio")
        with st.expander("Raw JSON"):
            st.json(payload)
        if payload.get("semrag_query_extraction"):
            with st.expander("SEMRAG query extraction"):
                st.json(payload["semrag_query_extraction"])
