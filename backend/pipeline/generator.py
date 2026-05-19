import re
from pathlib import Path
from typing import Dict, List, Optional

from openai import OpenAI

from backend.pipeline.video_summarizer import load_summary_cache, summary_cache_key

POST_GENERATION_SYSTEM_NAME = "post_generation_system.txt"
DEFAULT_SUMMARIES_PATH = Path(__file__).resolve().parents[1] / "data" / "video_summaries.json"
POST_GENERATION_USER_NAME = "post_generation_user.txt"


def _fill_template(template: str, replacements: Dict[str, str]) -> str:
    """Avoid str.format so braces inside profile/news text cannot break the prompt."""
    out = template
    for key, val in replacements.items():
        out = out.replace("{" + key + "}", val)
    return out


def _load_post_prompts(prompts_dir: Path) -> tuple[str, str]:
    system_path = prompts_dir / POST_GENERATION_SYSTEM_NAME
    user_path = prompts_dir / POST_GENERATION_USER_NAME
    if not system_path.is_file():
        raise FileNotFoundError(f"Missing post generation system prompt: {system_path}")
    if not user_path.is_file():
        raise FileNotFoundError(f"Missing post generation user prompt: {user_path}")
    return (
        system_path.read_text(encoding="utf-8").strip(),
        user_path.read_text(encoding="utf-8").strip(),
    )


def _news_text(news: Dict) -> str:
    parts = [
        news.get("title", ""),
        news.get("description", ""),
        news.get("content", ""),
    ]
    return "\n".join(p for p in parts if p).strip()


def _chunks_str(retrieved_chunks: List[Dict]) -> str:
    return "\n\n".join(
        [
            f"Video Title: {c['video_title']}\nChunk ID: {c.get('chunk_id', '')}\nTranscript Chunk: {c['chunk_text']}"
            for c in retrieved_chunks
        ]
    )


def _video_summaries_str(
    full_video_contexts: List[Dict],
    summaries_path: Path,
) -> str:
    """
    Grounding aid without full transcripts: one paragraph summary per retrieved video
    from video_summaries.json (keyed by title||URL).
    """
    if not full_video_contexts:
        return "(None — use only retrieved chunks.)"
    entries = load_summary_cache(summaries_path)
    blocks: List[str] = []
    for vc in full_video_contexts:
        title = (vc.get("video_title") or "").strip()
        link = (vc.get("video_link") or "").strip()
        key = summary_cache_key(title, link)
        rec = entries.get(key)
        text = ""
        if isinstance(rec, dict):
            text = (rec.get("summary_text") or "").strip()
        if text:
            blocks.append(f"Video Title: {title}\nVideo URL: {link}\nSummary:\n{text}")
        else:
            blocks.append(
                f"Video Title: {title}\nVideo URL: {link}\n"
                f"Summary: (not in cache — use retrieved chunks from this video only.)"
            )
    return "\n\n".join(blocks)


_LANGUAGE_INSTRUCTIONS: dict[str, str] = {
    "hi": "LANGUAGE REQUIREMENT: Write the entire Social Media Post (and hashtags if included) in Hindi (Devanagari script). Do NOT write in English or Hinglish — pure Hindi only.",
    "en": "LANGUAGE REQUIREMENT: Write the entire Social Media Post (headline, body, and hashtags) in English. The source material may be in Hindi — synthesise ideas from it but express everything in English. Do NOT write in Hindi, Devanagari script, or Hinglish.",
}


_SECTION_RE = re.compile(
    r'^(Headline|Social Media Post|Hashtags)\s*:\s*\n',
    re.IGNORECASE | re.MULTILINE,
)


def _extract_post_body(raw: str) -> str:
    """
    Parse the structured LLM response into:
      [Headline]\\n\\n[Post body]\\n\\n[Hashtags]

    Falls back to returning the raw text if parsing fails.
    """
    sections: dict[str, str] = {}
    parts = _SECTION_RE.split(raw)
    # split() with a capturing group returns: [pre, key1, val1, key2, val2, ...]
    i = 1
    while i + 1 < len(parts):
        key = parts[i].strip().lower()
        val = parts[i + 1].strip()
        sections[key] = val
        i += 2

    headline   = sections.get("headline", "")
    body       = sections.get("social media post", "")
    hashtags   = sections.get("hashtags", "")

    # Remove placeholder values
    hashtags = "" if hashtags.upper() in ("N/A", "NA", "") else hashtags

    if not body:
        return raw.strip()

    pieces = [p for p in [headline, body, hashtags] if p]
    return "\n\n".join(pieces)


def generate_post(
    client: OpenAI,
    model: str,
    news: Dict,
    profile: Dict[str, str],
    retrieved_chunks: List[Dict],
    full_video_contexts: List[Dict],
    temperature: float = 0.7,
    prompts_dir: Optional[Path] = None,
    summaries_cache_path: Optional[Path] = None,
    language: Optional[str] = None,
    refinement_note: Optional[str] = None,
) -> str:
    """
    Generate a social media post for a news item, profile, and retrieved chunks.

    Prompts load from prompts_dir (defaults to Settings.prompts_dir):
    post_generation_system.txt, post_generation_user.txt
    """
    if not retrieved_chunks:
        return "Insufficient information in the provided transcript chunks to generate a reliable post."

    if prompts_dir is None:
        from backend.config import get_settings

        prompts_dir = get_settings().prompts_dir

    cache_path = summaries_cache_path or DEFAULT_SUMMARIES_PATH

    system_msg, user_tpl = _load_post_prompts(prompts_dir)

    lang_instruction = _LANGUAGE_INSTRUCTIONS.get(language or "en", "")
    if lang_instruction:
        system_msg = f"{system_msg}\n\n---\n\n{lang_instruction}"

    if refinement_note and refinement_note.strip():
        system_msg = f"{system_msg}\n\n---\n\nREFINEMENT INSTRUCTION: The user wants the following change in this post: {refinement_note.strip()}"

    profile_desc = "\n".join(f"{k}: {v}" for k, v in profile.items())

    user_content = _fill_template(
        user_tpl,
        {
            "user_profile": profile_desc,
            "news_article": _news_text(news),
            "retrieved_chunks": _chunks_str(retrieved_chunks),
            "video_summaries": _video_summaries_str(full_video_contexts, cache_path),
        },
    ).strip()

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_msg},
            {"role": "user", "content": user_content},
        ],
        temperature=temperature,
    )

    text = (response.choices[0].message.content or "").strip()
    return _extract_post_body(text)
