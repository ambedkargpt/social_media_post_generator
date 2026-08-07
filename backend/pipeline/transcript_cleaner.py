"""
Transcript cleaning — runs after ingestion, before summarization/extraction.

Auto-generated YouTube captions arrive full of non-speech markers ("[music]"),
caption artefacts (">>"), ASR stutters, and no sentence boundaries. Feeding that
straight into summarization and entity extraction degrades both.

Cleaning happens in two passes:

1. ``basic_clean`` — deterministic regex pass. Free, fast, and always applied, so
   the pipeline still improves even when no LLM is available.
2. ``llm_clean``  — prompt-driven pass using ``prompts/transcript_cleaning_*.txt``
   for punctuation and sentence repair. Toggle with TRANSCRIPT_CLEANING_ENABLED.

Long transcripts are chunked on sentence boundaries so a multi-hour press
conference does not blow the model's context window.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from backend.config import Settings

TRANSCRIPT_CLEANING_SYSTEM_NAME = "transcript_cleaning_system.txt"
TRANSCRIPT_CLEANING_USER_NAME = "transcript_cleaning_user.txt"

# Roughly one chunk per model call; sized well inside DeepSeek's context window.
_CHUNK_CHAR_LIMIT = 8000

# Non-speech caption markers: [music], (applause), [संगीत] ...
_BRACKET_MARKER_RE = re.compile(r"[\[\(](?:music|applause|laughter|foreign|inaudible|noise|संगीत|तालियाँ)[\]\)]", re.IGNORECASE)
# Any short all-lowercase bracketed cue that captions insert, e.g. [music]
_GENERIC_BRACKET_CUE_RE = re.compile(r"\[[^\]\n]{0,20}\]")
# Caption speaker-change artefacts: ">>", ">>>"
_SPEAKER_ARROW_RE = re.compile(r">>+")
# Immediate duplicated word ("the the", "मैं मैं")
_DUP_WORD_RE = re.compile(r"\b(\w+)(\s+\1\b)+", re.IGNORECASE | re.UNICODE)
_MULTISPACE_RE = re.compile(r"[ \t]{2,}")
_SPACE_BEFORE_PUNCT_RE = re.compile(r"\s+([,.!?;:])")


def basic_clean(text: str) -> str:
    """Deterministic cleanup that never calls a model."""
    if not text:
        return ""
    out = _BRACKET_MARKER_RE.sub(" ", text)
    out = _GENERIC_BRACKET_CUE_RE.sub(" ", out)
    out = _SPEAKER_ARROW_RE.sub(" ", out)
    out = _DUP_WORD_RE.sub(r"\1", out)
    out = _SPACE_BEFORE_PUNCT_RE.sub(r"\1", out)
    out = _MULTISPACE_RE.sub(" ", out)
    # Collapse 3+ blank lines but keep paragraph breaks
    out = re.sub(r"\n{3,}", "\n\n", out)
    return out.strip()


def _fill_template(template: str, replacements: dict[str, str]) -> str:
    """Avoid str.format so braces inside transcript text cannot break the prompt."""
    out = template
    for key, val in replacements.items():
        out = out.replace("{" + key + "}", val)
    return out


def load_style_reference(prompts_dir: Path, filename: str = "hindi_style_reference.txt") -> str:
    """
    Ground-truth Hindi punctuation/grammar reference injected into the prompt.

    Missing file is not fatal — cleaning still runs on the inline rules, just
    without the worked reference material.
    """
    path = prompts_dir / filename
    if not path.is_file():
        print(f" Style reference not found ({path}); continuing without it.")
        return ""
    return path.read_text(encoding="utf-8").strip()


def load_cleaning_prompts(prompts_dir: Path) -> tuple[str, str]:
    system_path = prompts_dir / TRANSCRIPT_CLEANING_SYSTEM_NAME
    user_path = prompts_dir / TRANSCRIPT_CLEANING_USER_NAME
    if not system_path.is_file():
        raise FileNotFoundError(f"Missing transcript cleaning system prompt: {system_path}")
    if not user_path.is_file():
        raise FileNotFoundError(f"Missing transcript cleaning user prompt: {user_path}")
    return (
        system_path.read_text(encoding="utf-8").strip(),
        user_path.read_text(encoding="utf-8").strip(),
    )


def _chunk_text(text: str, limit: int = _CHUNK_CHAR_LIMIT) -> list[str]:
    """Split on sentence boundaries so chunks stay under the model context."""
    if len(text) <= limit:
        return [text]
    # Split after Devanagari danda or western sentence enders
    sentences = re.split(r"(?<=[।.!?])\s+", text)
    chunks: list[str] = []
    current = ""
    for sentence in sentences:
        if current and len(current) + len(sentence) + 1 > limit:
            chunks.append(current.strip())
            current = sentence
        else:
            current = f"{current} {sentence}".strip() if current else sentence
    if current.strip():
        chunks.append(current.strip())
    return chunks


def llm_clean(
    *,
    client,
    model: str,
    prompts_dir: Path,
    video_title: str,
    video_link: str,
    raw_transcript: str,
    style_reference: str = "",
) -> str:
    """
    Prompt-driven cleaning. Returns the cleaned transcript, or the basic-cleaned
    text if the model fails — cleaning must never drop a transcript.
    """
    system_msg, user_tpl = load_cleaning_prompts(prompts_dir)
    pre = basic_clean(raw_transcript)
    if not pre:
        return ""

    cleaned_parts: list[str] = []
    for chunk in _chunk_text(pre):
        user_msg = _fill_template(
            user_tpl,
            {
                "style_reference": style_reference,
                "video_title": video_title or "",
                "video_link": video_link or "",
                "raw_transcript": chunk,
            },
        )
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_msg},
                    {"role": "user", "content": user_msg},
                ],
                temperature=0.0,
            )
            out = (response.choices[0].message.content or "").strip()
        except Exception as exc:  # noqa: BLE001 - cleaning is best-effort
            print(f" Transcript cleaning failed for chunk ({exc}); keeping basic-cleaned text.")
            out = ""
        # Guard against a model that summarizes instead of cleaning: if the
        # output collapsed to a fraction of the input, keep the original chunk.
        if not out or len(out) < len(chunk) * 0.5:
            out = chunk
        cleaned_parts.append(out)

    return "\n\n".join(p for p in cleaned_parts if p).strip()


def clean_transcript(
    settings: "Settings",
    *,
    video_title: str,
    video_link: str,
    raw_transcript: str,
    client=None,
) -> str:
    """
    Clean one transcript according to settings.

    Always applies ``basic_clean``. Adds the LLM pass when
    TRANSCRIPT_CLEANING_ENABLED is on and a DeepSeek key is configured.
    """
    if not raw_transcript:
        return ""
    if not getattr(settings, "transcript_cleaning_enabled", True):
        return basic_clean(raw_transcript)
    if not getattr(settings, "deepseek_api_key", ""):
        return basic_clean(raw_transcript)

    if client is None:
        from backend.pipeline.video_summarizer import deepseek_chat_client

        client = deepseek_chat_client(settings)

    return llm_clean(
        client=client,
        model=settings.deepseek_summary_model,
        prompts_dir=settings.prompts_dir,
        video_title=video_title,
        video_link=video_link,
        raw_transcript=raw_transcript,
        style_reference=load_style_reference(
            settings.prompts_dir,
            getattr(settings, "hindi_style_reference_file", "hindi_style_reference.txt"),
        ),
    )
