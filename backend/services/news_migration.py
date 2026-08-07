from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


@dataclass
class MigrationStats:
    current_count: int
    legacy_count: int
    merged_count: int
    deduped_count: int
    inserted: int
    updated: int


def _parse_dt(value: Any) -> datetime | None:
    if not value or not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None


def _normalize_item(
    item: dict[str, Any],
    source: str,
    *,
    tenant_id: int = 0,
    tenant_slug: str = "general",
    source_name: str = "Ravish Kumar",
    tags: list[str] | None = None,
) -> dict[str, Any] | None:
    source_url = (item.get("video_link") or "").strip().lower()
    headline = (item.get("headline") or "").strip()
    summary = (item.get("summary_text") or "").strip()
    description = (item.get("subheadline") or "").strip() or summary
    if not source_url or not headline or not summary:
        return None
    published_at = _parse_dt(item.get("upload_datetime_utc"))
    sort_ts = item.get("sort_timestamp")
    if sort_ts is None:
        sort_ts = item.get("upload_timestamp")
    try:
        sort_ts = float(sort_ts) if sort_ts is not None else 0.0
    except Exception:
        sort_ts = 0.0
    return {
        "source_url": source_url,
        "headline": headline,
        "description": description,
        "summary": summary,
        "source_name": source_name,
        "published_at": published_at,
        # Tenant stamp drives party vs general news segmentation in the API.
        "tenant_id": tenant_id,
        "tenant_slug": tenant_slug,
        # Keep null by default to avoid Mongo text index language override conflicts.
        "language": None,
        # Multi-story items carry their own topic; fall back to the channel tags.
        "tags": ([item["topic"].strip().lower()] if str(item.get("topic") or "").strip() else list(tags or [])),
        "embedding_ref": None,
        "legacy_source": source,
        "original_sort_timestamp": sort_ts,
    }


def load_and_dedupe_news(
    current_file: Path,
    legacy_file: Path,
    *,
    tenant: Any = None,
    tags: list[str] | None = None,
) -> tuple[list[dict[str, Any]], MigrationStats]:
    # A new channel has no legacy archive until items are first evicted, and a
    # channel can be published before either file exists. Treat both as empty
    # rather than failing the publish stage.
    def _items(path: Path) -> list[dict[str, Any]]:
        if not path.is_file():
            return []
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            return []
        items = payload.get("items", []) if isinstance(payload, dict) else payload
        return [i for i in items if isinstance(i, dict)] if isinstance(items, list) else []

    current_items = _items(current_file)
    legacy_items = _items(legacy_file)

    # Default to the general tenant so existing Ravish runs are unchanged.
    if tenant is None:
        from backend.tenants import general_tenant

        tenant = general_tenant()
    tenant_kwargs = {
        "tenant_id": tenant.tenant_id,
        "tenant_slug": tenant.slug,
        "source_name": tenant.source_name,
        "tags": tags,
    }

    merged: list[dict[str, Any]] = []
    for item in current_items:
        normalized = _normalize_item(item, "current", **tenant_kwargs)
        if normalized:
            merged.append(normalized)
    for item in legacy_items:
        normalized = _normalize_item(item, "legacy", **tenant_kwargs)
        if normalized:
            merged.append(normalized)

    dedup: dict[str, dict[str, Any]] = {}
    for item in merged:
        key = item["source_url"]
        existing = dedup.get(key)
        if not existing or item.get("original_sort_timestamp", 0.0) >= existing.get("original_sort_timestamp", 0.0):
            dedup[key] = item

    deduped = list(dedup.values())
    deduped.sort(key=lambda x: x.get("original_sort_timestamp", 0.0))
    stats = MigrationStats(
        current_count=len(current_items),
        legacy_count=len(legacy_items),
        merged_count=len(merged),
        deduped_count=len(deduped),
        inserted=0,
        updated=0,
    )
    return deduped, stats


def migrate_news(
    repo,
    current_file: Path,
    legacy_file: Path,
    *,
    tenant: Any = None,
    tags: list[str] | None = None,
) -> MigrationStats:
    deduped, stats = load_and_dedupe_news(current_file, legacy_file, tenant=tenant, tags=tags)
    existing_ids = {
        d.get("news_id")
        for d in repo.collection.find({"news_id": {"$regex": r"^news_\d+$"}}, {"news_id": 1})
        if d.get("news_id")
    }
    max_id = 0
    for n in existing_ids:
        max_id = max(max_id, int(str(n).split("_")[-1]))

    now = datetime.now(timezone.utc)
    for item in deduped:
        existing = repo.get_by_source_url(item["source_url"])
        if existing and existing.get("news_id"):
            news_id = existing["news_id"]
        else:
            max_id += 1
            news_id = f"news_{max_id:06d}"
        payload = {
            **item,
            "news_id": news_id,
            "created_at": existing.get("created_at", now) if existing else now,
            "updated_at": now,
        }
        _, created = repo.upsert_by_source_url(item["source_url"], payload)
        if created:
            stats.inserted += 1
        else:
            stats.updated += 1

    return stats
