from pathlib import Path
from typing import Dict, List, Optional

from openai import OpenAI

from pipeline.video_summarizer import load_summary_cache, summary_cache_key

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
) -> str:
    """
    Generate a social media post for a news item, profile, and retrieved chunks.

    Prompts load from prompts_dir (defaults to Settings.prompts_dir):
    post_generation_system.txt, post_generation_user.txt
    """
    if not retrieved_chunks:
        return "Insufficient information in the provided transcript chunks to generate a reliable post."

    if prompts_dir is None:
        from config import get_settings

        prompts_dir = get_settings().prompts_dir

    cache_path = summaries_cache_path or DEFAULT_SUMMARIES_PATH

    system_msg, user_tpl = _load_post_prompts(prompts_dir)
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
    return text
