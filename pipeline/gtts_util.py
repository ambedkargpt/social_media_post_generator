"""Google Text-to-Speech (gTTS) helpers for chunk/post narration."""

from __future__ import annotations

from io import BytesIO

# gTTS/Google unofficial limits vary; keep requests conservative.
GTTS_MAX_CHARS = 4500


def clamp_tts_text(text: str, max_chars: int = GTTS_MAX_CHARS) -> str:
    t = (text or "").strip()
    if len(t) <= max_chars:
        return t
    return t[: max_chars - 1].rstrip() + "…"


def synthesize_gtts_mp3(text: str, *, lang: str = "hi") -> bytes:
    """
    Return MP3 bytes for the given text. Requires network access to Google's TTS endpoint.
    """
    from gtts import gTTS

    payload = clamp_tts_text(text)
    if not payload:
        raise ValueError("No text to synthesize.")
    buf = BytesIO()
    code = (lang or "hi").strip() or "hi"
    tts = gTTS(text=payload, lang=code)
    tts.write_to_fp(buf)
    raw = buf.getvalue()
    if not raw:
        raise RuntimeError("gTTS returned empty audio.")
    return raw
