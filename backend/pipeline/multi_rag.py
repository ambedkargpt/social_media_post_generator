"""
Tenant-aware retrieval across several channels.

The original retrieval path is single-tenant: ``ensure_rag_stack`` caches one
stack in a module global, and ``semrag_candidates_for_query`` reads the graph
from ``settings.semrag_graph_path``. Once each party has its own knowledge graph
and Pinecone namespace, retrieval has to pick the right one -- otherwise a
Congress user is grounded in Ravish's corpus, or worse, in another party's.

This module resolves a tenant to that tenant's artifacts and runs retrieval
against them. It reuses the existing functions rather than reimplementing them,
by handing them a settings view whose paths point at the tenant's artifacts.

    from backend.pipeline.multi_rag import retrieve_for_tenant
    chunks = retrieve_for_tenant("expressway collapse", tenant="congress")

Lexical ranking is used when embeddings are unavailable, so the caller still
gets grounded material instead of an exception. See ``retrieve_for_tenant``.
"""

from __future__ import annotations

import json
import math
import re
from collections import Counter
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

_BACKEND = Path(__file__).resolve().parent.parent
_CHANNELS_DIR = _BACKEND / "config" / "channels"
_TOKEN_RE = re.compile(r"\w+", re.UNICODE)


@dataclass(frozen=True)
class TenantArtifacts:
    """Where one tenant's retrievable material lives."""

    tenant_slug: str
    channel: str
    semrag_graph_path: Path | None
    semrag_chunks_path: Path | None
    pinecone_namespace: str | None

    @property
    def has_graph(self) -> bool:
        return bool(self.semrag_graph_path and self.semrag_graph_path.is_file())

    @property
    def has_chunks(self) -> bool:
        return bool(self.semrag_chunks_path and self.semrag_chunks_path.is_file())


@lru_cache(maxsize=1)
def _tenant_to_channel() -> dict[str, str]:
    """Map tenant slug -> channel name, read from the channel configs."""
    mapping: dict[str, str] = {}
    if not _CHANNELS_DIR.is_dir():
        return mapping
    for path in sorted(_CHANNELS_DIR.glob("*.json")):
        if path.stem == "template":
            continue
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            continue
        slug = str(payload.get("tenant_slug") or "general").strip().lower()
        # First config wins, so a tenant with several channels stays deterministic.
        mapping.setdefault(slug, str(payload.get("name") or path.stem))
    return mapping


def artifacts_for_tenant(tenant: str | int | None) -> TenantArtifacts | None:
    """Resolve a tenant (id or slug) to its channel's retrieval artifacts."""
    from backend.pipeline.orchestration.channel_config import load_channel_config
    from backend.tenants import general_tenant, get_tenant

    resolved = get_tenant(tenant) if tenant not in (None, "") else general_tenant()
    if resolved is None:
        return None
    channel_name = _tenant_to_channel().get(resolved.slug)
    if not channel_name:
        return None
    try:
        channel = load_channel_config(_BACKEND, channel_name)
    except (FileNotFoundError, ValueError):
        return None
    return TenantArtifacts(
        tenant_slug=resolved.slug,
        channel=channel.name,
        semrag_graph_path=channel.semrag_graph_path,
        semrag_chunks_path=channel.semrag_chunks_path,
        pinecone_namespace=channel.pinecone_namespace,
    )


class _TenantSettings:
    """
    Settings view with this tenant's artifact paths substituted.

    ``semrag_candidates_for_query`` takes a settings object and reads paths off
    it, so overlaying the tenant's paths lets that function run per tenant
    without changing it. Attributes not overridden fall through to the real
    settings.
    """

    def __init__(self, base: Any, overrides: dict[str, Any]) -> None:
        self._base = base
        self._overrides = {k: v for k, v in overrides.items() if v is not None}

    def __getattr__(self, name: str) -> Any:
        if name in self._overrides:
            return self._overrides[name]
        return getattr(self._base, name)


def settings_for_tenant(settings: Any, art: TenantArtifacts) -> Any:
    """Settings scoped to one tenant's graph, chunks and Pinecone namespace."""
    return _TenantSettings(
        settings,
        {
            "semrag_graph_path": art.semrag_graph_path,
            "semrag_chunks_path": art.semrag_chunks_path,
            "pinecone_namespace": art.pinecone_namespace,
            # semrag_candidates_for_query returns empty on its first line unless
            # this is set, and the global setting is off. Turning it on here
            # rather than globally keeps it scoped to a tenant that actually has
            # a graph on disk, so no other channel changes behaviour.
            "semrag_enabled": True if art.has_graph else None,
        },
    )


# --------------------------------------------------------------------------
# Lexical fallback
# --------------------------------------------------------------------------

def _tokenize(text: str) -> list[str]:
    # \w is Unicode-aware, so Devanagari tokenizes alongside Latin.
    return [t.lower() for t in _TOKEN_RE.findall(text or "") if len(t) > 1]


@lru_cache(maxsize=8)
def _load_chunks(path_str: str) -> tuple[dict, ...]:
    try:
        data = json.loads(Path(path_str).read_text(encoding="utf-8"))
    except (ValueError, OSError):
        return ()
    return tuple(c for c in data if isinstance(c, dict))


def lexical_rank(chunks: tuple[dict, ...], query: str, top_k: int) -> list[dict]:
    """TF-IDF cosine ranking. No API calls, so it works without embeddings."""
    docs = [_tokenize(c.get("chunk_text", "")) for c in chunks]
    if not docs:
        return []
    df: Counter[str] = Counter()
    for d in docs:
        df.update(set(d))
    n = len(docs)
    idf = {t: math.log(1 + n / (1 + c)) for t, c in df.items()}

    def vec(tokens: list[str]) -> dict[str, float]:
        tf = Counter(tokens)
        if not tf:
            return {}
        mx = max(tf.values())
        return {t: (f / mx) * idf.get(t, 0.0) for t, f in tf.items()}

    qv = vec(_tokenize(query))
    if not qv:
        return []
    qn = math.sqrt(sum(v * v for v in qv.values())) or 1.0

    scored: list[tuple[float, dict]] = []
    for doc, chunk in zip(docs, chunks):
        dv = vec(doc)
        dot = sum(w * dv.get(t, 0.0) for t, w in qv.items())
        if dot <= 0:
            continue
        dn = math.sqrt(sum(v * v for v in dv.values())) or 1.0
        scored.append((dot / (qn * dn), chunk))
    scored.sort(key=lambda x: -x[0])
    return [{**c, "retrieval_score": round(s, 4)} for s, c in scored[:top_k]]


def graph_facts_for_chunks(art: TenantArtifacts, chunk_ids: set[str], limit: int = 20) -> list[str]:
    """Knowledge-graph facts whose supporting evidence is one of these chunks."""
    if not art.has_graph or not chunk_ids:
        return []
    graph = json.loads(art.semrag_graph_path.read_text(encoding="utf-8"))  # type: ignore[union-attr]
    names = {e["entity_id"]: e.get("canonical_name", "?") for e in graph.get("entities", [])}
    facts: list[str] = []
    seen: set[tuple[str, str, str]] = set()
    for rel in graph.get("relations", []):
        if rel.get("evidence_chunk_id") not in chunk_ids:
            continue
        head, tail, name = (
            names.get(rel.get("head_entity_id")),
            names.get(rel.get("tail_entity_id")),
            rel.get("relation"),
        )
        if not (head and tail and name) or (head, name, tail) in seen:
            continue
        seen.add((head, name, tail))
        facts.append(f"{head} --{name}--> {tail}")
        if len(facts) >= limit:
            break
    return facts


# --------------------------------------------------------------------------
# Public entry point
# --------------------------------------------------------------------------

def retrieve_for_tenant(
    query_text: str,
    *,
    tenant: str | int | None,
    top_k: int = 8,
    embedder: Any = None,
    store: Any = None,
    settings: Any = None,
) -> list[dict]:
    """
    Retrieve grounding chunks from one tenant's corpus.

    Uses the full embedding-based retriever when an embedder and store are
    supplied and working; otherwise falls back to lexical ranking over the
    tenant's chunks. The fallback matters because embeddings depend on an
    external API: without it a single expired key leaves generation with no
    source material at all.

    Returns chunk dicts. Empty means the tenant has no usable corpus.
    """
    art = artifacts_for_tenant(tenant)
    if art is None:
        return []

    if embedder is not None and store is not None:
        try:
            from backend.pipeline.retriever import retrieve_relevant_chunks
            from backend.pipeline_cli import _retrieval_cfg_from_settings

            if settings is None:
                from backend.config import get_settings

                settings = get_settings()
            scoped = settings_for_tenant(settings, art)
            cfg = _retrieval_cfg_from_settings(scoped)
            cfg["semrag_enabled"] = art.has_graph
            return retrieve_relevant_chunks(
                news_text=query_text,
                embedder=embedder,
                store=store,
                top_k=top_k,
                retrieval_cfg=cfg,
            )
        except Exception as exc:  # noqa: BLE001 - fall back rather than fail
            import logging

            logging.getLogger(__name__).warning(
                "vector retrieval failed for tenant '%s'; using lexical fallback: %s",
                art.tenant_slug,
                exc,
            )

    if not art.has_chunks:
        return []
    return lexical_rank(_load_chunks(str(art.semrag_chunks_path)), query_text, top_k)


def tenant_corpus_summary() -> list[dict[str, Any]]:
    """Per-tenant view of what corpus is available. Useful for diagnostics."""
    rows: list[dict[str, Any]] = []
    for slug in sorted(_tenant_to_channel()):
        art = artifacts_for_tenant(slug)
        if art is None:
            continue
        chunks = len(_load_chunks(str(art.semrag_chunks_path))) if art.has_chunks else 0
        entities = 0
        if art.has_graph:
            graph = json.loads(art.semrag_graph_path.read_text(encoding="utf-8"))  # type: ignore[union-attr]
            entities = len(graph.get("entities") or [])
        rows.append(
            {
                "tenant": art.tenant_slug,
                "channel": art.channel,
                "chunks": chunks,
                "graph_entities": entities,
                "namespace": art.pinecone_namespace or "(default)",
            }
        )
    return rows
