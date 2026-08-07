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
    # Every tab to scrape for this channel (e.g. /videos and /streams).
    # Falls back to [channel_url] when the config does not list any.
    channel_urls: tuple[str, ...] = ()
    # Only ingest videos published within this many days (None = no window).
    lookback_days: int | None = None
    # Tenant this channel publishes into (see backend/tenants.py).
    tenant_slug: str = "general"
    # "single" = one news item per video (default).
    # "multi"  = split each video into several stories (live/press conferences).
    news_mode: str = "single"
    stories_per_video: int = 4
    rebuild_rag: bool = True
    rebuild_semrag: bool = True
    run_summarizer: bool = True
    run_news_generator: bool = True
    run_news_publish: bool = True

    @property
    def source_urls(self) -> tuple[str, ...]:
        return self.channel_urls or (self.channel_url,)


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
