from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from pipeline.orchestration.contracts import ChannelConfig


def _to_bool(value: Any, default: bool) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _required(payload: dict[str, Any], key: str) -> str:
    value = str(payload.get(key, "")).strip()
    if not value:
        raise ValueError(f"Missing required channel config key: {key}")
    return value


def load_channel_config(project_root: Path, channel: str) -> ChannelConfig:
    config_path = project_root / "config" / "channels" / f"{channel}.json"
    if not config_path.is_file():
        raise FileNotFoundError(f"Channel config not found: {config_path}")
    payload = json.loads(config_path.read_text(encoding="utf-8"))
    name = _required(payload, "name")
    channel_url = _required(payload, "channel_url")
    channel_slug = _required(payload, "channel_slug")

    return ChannelConfig(
        name=name,
        channel_url=channel_url,
        channel_slug=channel_slug,
        transcripts_dir=(project_root / _required(payload, "transcripts_dir")).resolve(),
        consolidated_txt_path=(project_root / _required(payload, "consolidated_txt_path")).resolve(),
        processed_json_path=(project_root / _required(payload, "processed_json_path")).resolve(),
        master_transcript_path=(project_root / _required(payload, "master_transcript_path")).resolve(),
        video_summaries_path=(project_root / _required(payload, "video_summaries_path")).resolve(),
        generated_news_path=(project_root / _required(payload, "generated_news_path")).resolve(),
        generated_news_legacy_path=(project_root / _required(payload, "generated_news_legacy_path")).resolve(),
        rebuild_rag=_to_bool(payload.get("rebuild_rag"), True),
        rebuild_semrag=_to_bool(payload.get("rebuild_semrag"), True),
        run_summarizer=_to_bool(payload.get("run_summarizer"), True),
        run_news_generator=_to_bool(payload.get("run_news_generator"), True),
        run_news_publish=_to_bool(payload.get("run_news_publish"), True),
    )
