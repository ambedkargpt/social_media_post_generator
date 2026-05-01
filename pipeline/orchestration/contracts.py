from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal


StageStatus = Literal["success", "skipped", "failed"]


@dataclass(frozen=True)
class ChannelConfig:
    name: str
    channel_url: str
    channel_slug: str
    transcripts_dir: Path
    consolidated_txt_path: Path
    processed_json_path: Path
    master_transcript_path: Path
    video_summaries_path: Path
    generated_news_path: Path
    generated_news_legacy_path: Path
    rebuild_rag: bool = True
    rebuild_semrag: bool = True
    run_summarizer: bool = True
    run_news_generator: bool = True
    run_news_publish: bool = True


@dataclass
class StageResult:
    stage_name: str
    status: StageStatus
    metrics: dict[str, Any] = field(default_factory=dict)
    artifacts_written: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


@dataclass
class PipelineContext:
    project_root: Path
    run_id: str
    channel: ChannelConfig
    dry_run: bool
    resume: bool
    settings: Any
    state_path: Path
    selected_stages: list[str]
    runtime: dict[str, Any] = field(default_factory=dict)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
