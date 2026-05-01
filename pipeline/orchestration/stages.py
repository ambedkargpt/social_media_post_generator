from __future__ import annotations

import json
from pathlib import Path

from backend.repositories.news_repo import NewsRepository
from backend.services.news_migration import migrate_news
from pipeline.news_generator import update_generated_news_rolling
from pipeline.orchestration.contracts import PipelineContext, StageResult
from pipeline.video_summarizer import (
    deepseek_chat_client,
    get_or_create_video_summary,
    load_summary_cache,
    save_summary_cache,
    summary_cache_key,
)


def _fetch_module():
    import Fetch as fetch_module

    return fetch_module


def run_ingestion(context: PipelineContext) -> StageResult:
    if context.dry_run:
        return StageResult("ingestion", "skipped", warnings=["dry-run"])
    fetch = _fetch_module()
    channel = context.channel
    channel.transcripts_dir.mkdir(parents=True, exist_ok=True)
    video_urls = fetch.fetch_video_urls(channel.channel_url)
    processed_ids, processed_records = fetch.load_processed(channel.processed_json_path)
    filtered_urls, skipped_existing = fetch.filter_already_downloaded_urls(
        video_urls, processed_records, channel.transcripts_dir
    )
    entries: list[dict] = []
    for url in filtered_urls:
        meta = fetch.get_video_metadata(url)
        if not meta:
            continue
        transcript = fetch.fetch_transcript_text(meta["id"])
        if not transcript:
            continue
        base_name = fetch.sanitize_filename(meta["title"])
        docx_path = channel.transcripts_dir / f"{base_name}.docx"
        fetch.create_docx(
            docx_path,
            meta["title"],
            url,
            transcript,
            upload_date=meta.get("upload_date"),
            upload_datetime_utc=meta.get("upload_datetime_utc"),
        )
        fetch.create_txt_from_docx(docx_path)
        entry = {
            "title": meta.get("title", ""),
            "url": url,
            "transcript": transcript,
        }
        for key in ("upload_date", "upload_timestamp", "upload_datetime_utc"):
            if meta.get(key) is not None:
                entry[key] = meta[key]
        entries.append(entry)
        fetch.add_processed(processed_ids, processed_records, meta, url, channel.processed_json_path)

    appended = fetch.append_entries_to_consolidated(channel.consolidated_txt_path, entries)
    context.runtime["newly_fetched_entries"] = entries
    return StageResult(
        stage_name="ingestion",
        status="success",
        metrics={
            "queued_urls": len(video_urls),
            "filtered_pending": len(filtered_urls),
            "new_entries": len(entries),
            "appended_entries": appended,
            "skipped_existing": skipped_existing,
        },
        artifacts_written=[str(channel.consolidated_txt_path), str(channel.processed_json_path)],
    )


def run_rag_artifacts(context: PipelineContext) -> StageResult:
    if not context.channel.rebuild_rag:
        return StageResult("rag_artifacts", "skipped", warnings=["disabled-by-channel-config"])
    if context.dry_run:
        return StageResult("rag_artifacts", "skipped", warnings=["dry-run"])
    fetch = _fetch_module()
    fetch.rebuild_rag_artifacts_from_data_file(context.channel.master_transcript_path)
    return StageResult(
        "rag_artifacts",
        "success",
        artifacts_written=[str(context.channel.master_transcript_path)],
    )


def run_semrag_artifacts(context: PipelineContext) -> StageResult:
    if not context.channel.rebuild_semrag:
        return StageResult("semrag_artifacts", "skipped", warnings=["disabled-by-channel-config"])
    if context.dry_run:
        return StageResult("semrag_artifacts", "skipped", warnings=["dry-run"])
    fetch = _fetch_module()
    fetch.rebuild_semrag_artifacts_from_data_file(context.channel.master_transcript_path)
    return StageResult(
        "semrag_artifacts",
        "success",
        artifacts_written=[str(context.settings.semrag_graph_path), str(context.settings.semrag_chunks_path)],
    )


def run_video_summaries(context: PipelineContext) -> StageResult:
    if not context.channel.run_summarizer:
        return StageResult("video_summaries", "skipped", warnings=["disabled-by-channel-config"])
    if context.dry_run:
        return StageResult("video_summaries", "skipped", warnings=["dry-run"])
    entries = context.runtime.get("newly_fetched_entries") or []
    if not entries:
        return StageResult("video_summaries", "skipped", warnings=["no-new-entries"])
    cache = load_summary_cache(context.channel.video_summaries_path)
    client = deepseek_chat_client(context.settings)
    new_rows: list[dict] = []
    new_count = 0
    for item in entries:
        title = (item.get("title") or "").strip()
        url = (item.get("url") or "").strip()
        transcript = (item.get("transcript") or "").strip()
        if not title or not url or not transcript:
            continue
        key = summary_cache_key(title, url)
        had_summary = bool(cache.get(key, {}).get("summary_text"))
        get_or_create_video_summary(
            client=client,
            model=context.settings.deepseek_summary_model,
            cache_entries=cache,
            video_title=title,
            video_link=url,
            full_text=transcript,
            target_words=190,
            prompts_dir=context.settings.prompts_dir,
        )
        if not had_summary:
            new_count += 1
            created = cache.get(key, {})
            if created.get("summary_text"):
                row = {
                    "video_title": title,
                    "video_link": url,
                    "summary_text": created["summary_text"],
                }
                for k in ("upload_timestamp", "upload_datetime_utc", "upload_date"):
                    if item.get(k) is not None:
                        row[k] = item[k]
                new_rows.append(row)
    save_summary_cache(context.channel.video_summaries_path, cache)
    context.runtime["new_summary_rows"] = new_rows
    return StageResult(
        "video_summaries",
        "success",
        metrics={"new_summaries": new_count},
        artifacts_written=[str(context.channel.video_summaries_path)],
    )


def run_news_generation(context: PipelineContext) -> StageResult:
    if not context.channel.run_news_generator:
        return StageResult("news_generation", "skipped", warnings=["disabled-by-channel-config"])
    if context.dry_run:
        return StageResult("news_generation", "skipped", warnings=["dry-run"])
    rows = context.runtime.get("new_summary_rows") or []
    if not rows:
        return StageResult("news_generation", "skipped", warnings=["no-new-summaries"])
    stats = update_generated_news_rolling(context.settings, rows, show_progress=True)
    return StageResult(
        "news_generation",
        "success",
        metrics=stats,
        artifacts_written=[str(context.channel.generated_news_path), str(context.channel.generated_news_legacy_path)],
    )


def run_news_publish(context: PipelineContext) -> StageResult:
    if not context.channel.run_news_publish:
        return StageResult("news_publish", "skipped", warnings=["disabled-by-channel-config"])
    if context.dry_run:
        return StageResult("news_publish", "skipped", warnings=["dry-run"])
    repo = NewsRepository()
    stats = migrate_news(
        repo,
        current_file=context.channel.generated_news_path,
        legacy_file=context.channel.generated_news_legacy_path,
    )
    return StageResult(
        "news_publish",
        "success",
        metrics={
            "inserted": stats.inserted,
            "updated": stats.updated,
            "deduped_count": stats.deduped_count,
        },
    )


STAGE_HANDLERS = {
    "ingestion": run_ingestion,
    "rag_artifacts": run_rag_artifacts,
    "semrag_artifacts": run_semrag_artifacts,
    "video_summaries": run_video_summaries,
    "news_generation": run_news_generation,
    "news_publish": run_news_publish,
}

STAGE_DEPENDENCIES = {
    "ingestion": [],
    "rag_artifacts": ["ingestion"],
    "semrag_artifacts": ["ingestion"],
    "video_summaries": ["ingestion"],
    "news_generation": ["video_summaries"],
    "news_publish": ["news_generation"],
}


def stage_input_fingerprints(context: PipelineContext) -> dict[str, list[Path]]:
    return {
        "ingestion": [context.channel.processed_json_path],
        "rag_artifacts": [context.channel.master_transcript_path],
        "semrag_artifacts": [context.channel.master_transcript_path],
        "video_summaries": [context.channel.video_summaries_path, context.channel.master_transcript_path],
        "news_generation": [context.channel.video_summaries_path],
        "news_publish": [context.channel.generated_news_path, context.channel.generated_news_legacy_path],
    }
