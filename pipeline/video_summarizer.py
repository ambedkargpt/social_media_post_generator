import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING, Dict, Optional

from openai import OpenAI

if TYPE_CHECKING:
    from config import Settings

VIDEO_SUMMARY_SYSTEM_NAME = "video_summary_system.txt"
VIDEO_SUMMARY_USER_NAME = "video_summary_user.txt"


def _stable_video_id(video_title: str, video_link: str) -> str:
    # Keep cache key readable and deterministic.
    key = f"{video_title.strip()}||{video_link.strip()}"
    return re.sub(r"\s+", " ", key).strip()


def summary_cache_key(video_title: str, video_link: str) -> str:
    """Public alias for cache keys used in video_summaries.json."""
    return _stable_video_id(video_title, video_link)


def deepseek_chat_client(settings: "Settings") -> OpenAI:
    """OpenAI-compatible client for DeepSeek chat completions."""
    if not settings.deepseek_api_key:
        raise ValueError("DEEPSEEK_API_KEY is not set (video summarization requires DeepSeek).")
    base = (settings.deepseek_base_url or "https://api.deepseek.com").rstrip("/")
    return OpenAI(api_key=settings.deepseek_api_key, base_url=base)


def load_summary_cache(cache_path: Path) -> Dict[str, Dict]:
    if not cache_path.exists():
        return {}
    try:
        payload = json.loads(cache_path.read_text(encoding="utf-8"))
        entries = payload.get("entries", {})
        return entries if isinstance(entries, dict) else {}
    except Exception:
        return {}


def save_summary_cache(cache_path: Path, entries: Dict[str, Dict]) -> None:
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "entries": entries,
    }
    cache_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _count_words(text: str) -> int:
    return len((text or "").split())


def _fill_template(template: str, replacements: Dict[str, str]) -> str:
    """Avoid str.format so braces inside transcript text cannot break the prompt."""
    out = template
    for key, val in replacements.items():
        out = out.replace("{" + key + "}", val)
    return out


def _load_video_summary_prompts(prompts_dir: Path) -> tuple[str, str]:
    system_path = prompts_dir / VIDEO_SUMMARY_SYSTEM_NAME
    user_path = prompts_dir / VIDEO_SUMMARY_USER_NAME
    if not system_path.is_file():
        raise FileNotFoundError(f"Missing system prompt: {system_path}")
    if not user_path.is_file():
        raise FileNotFoundError(f"Missing user prompt template: {user_path}")
    return (
        system_path.read_text(encoding="utf-8").strip(),
        user_path.read_text(encoding="utf-8").strip(),
    )


def summarize_video_context(
    client: OpenAI,
    model: str,
    video_title: str,
    video_link: str,
    full_text: str,
    target_words: int = 190,
    prompts_dir: Optional[Path] = None,
    word_min: int = 180,
    word_max: int = 200,
) -> str:
    """
    Create a concise video summary that captures the core argument.
    Prompts are loaded from prompts_dir (see config Settings.prompts_dir).
    """
    if prompts_dir is None:
        from config import get_settings

        prompts_dir = get_settings().prompts_dir

    system_msg, user_tpl = _load_video_summary_prompts(prompts_dir)
    user_msg = _fill_template(
        user_tpl,
        {
            "video_title": video_title or "",
            "video_link": video_link or "",
            "full_text": full_text or "",
            "target_words": str(target_words),
            "word_min": str(word_min),
            "word_max": str(word_max),
        },
    )

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_msg},
            {"role": "user", "content": user_msg},
        ],
        temperature=1,
    )
    return (response.choices[0].message.content or "").strip()


def get_or_create_video_summary(
    client: OpenAI,
    model: str,
    cache_entries: Dict[str, Dict],
    video_title: str,
    video_link: str,
    full_text: str,
    target_words: int = 190,
    prompts_dir: Optional[Path] = None,
    word_min: int = 180,
    word_max: int = 200,
) -> str:
    video_id = _stable_video_id(video_title, video_link)
    cached = cache_entries.get(video_id)
    if cached and isinstance(cached, dict) and cached.get("summary_text"):
        return str(cached["summary_text"])

    summary = summarize_video_context(
        client=client,
        model=model,
        video_title=video_title,
        video_link=video_link,
        full_text=full_text,
        target_words=target_words,
        prompts_dir=prompts_dir,
        word_min=word_min,
        word_max=word_max,
    )

    cache_entries[video_id] = {
        "video_title": video_title,
        "video_link": video_link,
        "summary_text": summary,
        "word_count": _count_words(summary),
        "source_length_chars": len(full_text or ""),
        "model": model,
        "target_words": target_words,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    return summary
