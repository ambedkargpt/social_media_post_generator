from __future__ import annotations

from typing import Callable, Sequence, Tuple

import streamlit as st

from pipeline.gtts_util import synthesize_gtts_mp3


def gtts_lang_widget(default_lang: str) -> str:
    common = ["hi", "en", "mr", "ta", "te", "bn"]
    d = (default_lang or "hi").strip() or "hi"
    if d not in common:
        common = [d] + [x for x in common if x != d]
    ix = common.index(d) if d in common else 0
    return st.selectbox(
        "gTTS language",
        options=common,
        index=ix,
        help="ISO 639-1 language code sent to Google TTS. Needs internet.",
    )


def _state_keys(session_suffix: str) -> Tuple[str, str]:
    return f"gtts_audio_{session_suffix}", f"gtts_err_{session_suffix}"


def store_gtts_in_session(text: str, session_suffix: str, lang: str) -> None:
    """Synthesize with gTTS and store MP3 bytes (or error) in session_state."""
    state_key, err_key = _state_keys(session_suffix)
    t = (text or "").strip()
    if not t:
        st.session_state.pop(state_key, None)
        st.session_state.pop(err_key, None)
        return
    try:
        st.session_state[state_key] = synthesize_gtts_mp3(t, lang=lang)
        st.session_state.pop(err_key, None)
    except Exception as e:
        st.session_state.pop(state_key, None)
        st.session_state[err_key] = str(e)


def store_gtts_batch(
    items: Sequence[Tuple[str, str]],
    lang: str,
    *,
    progress_label: str = "Synthesizing speech",
    set_progress: Callable[[float, str], None] | None = None,
) -> None:
    """items: (text, session_suffix) pairs."""
    n = len(items)
    for idx, (text, suffix) in enumerate(items):
        if set_progress and n:
            set_progress(idx / n, f"{progress_label} ({idx + 1}/{n})…")
        store_gtts_in_session(text, suffix, lang)
    if set_progress and n:
        set_progress(1.0, f"{progress_label} — done.")


def render_gtts_native_player(session_suffix: str, *, heading: str = "Audio") -> None:
    """Show the browser’s built-in audio control (play/pause/scrub) — no extra button."""
    state_key, err_key = _state_keys(session_suffix)
    audio = st.session_state.get(state_key)
    err = st.session_state.get(err_key)
    if err:
        st.error(err)
        return
    if not audio:
        return
    st.markdown(f"**{heading}**")
    st.audio(audio, format="audio/mpeg")
