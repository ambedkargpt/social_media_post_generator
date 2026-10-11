"""
Memgraph Cloud Knowledge Graph Retriever for Ambedkar SemRAG.

Queries live Memgraph instance for:
- Entities & Relational Triples
- Verbatim Book Chunks from Dr. B.R. Ambedkar's Writings & Speeches (Vol 1 & 2)
- Community Thematic Summaries
"""

from __future__ import annotations

import logging
import os
import re
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Default Memgraph Cloud credentials
DEFAULT_MEMGRAPH_URI = os.getenv("MEMGRAPH_URI") or os.getenv("NEO4J_URI") or "bolt+s://18.162.109.140:7687"
DEFAULT_MEMGRAPH_USER = os.getenv("MEMGRAPH_USERNAME") or os.getenv("NEO4J_USERNAME") or ""
DEFAULT_MEMGRAPH_PASSWORD = os.getenv("MEMGRAPH_PASSWORD") or os.getenv("NEO4J_PASSWORD") or ""

_DRIVER = None


def get_memgraph_driver(uri: Optional[str] = None, user: Optional[str] = None, password: Optional[str] = None):
    """Obtain or reuse a thread-safe driver for Memgraph Cloud."""
    global _DRIVER
    if _DRIVER is not None:
        return _DRIVER

    from neo4j import GraphDatabase

    target_uri = uri or DEFAULT_MEMGRAPH_URI
    target_user = user or DEFAULT_MEMGRAPH_USER
    target_pwd = password or DEFAULT_MEMGRAPH_PASSWORD

    auth = (target_user, target_pwd) if (target_user or target_pwd) else None

    # Try standard URI first, fallback to self-signed cert handling if needed on macOS
    try:
        driver = GraphDatabase.driver(target_uri, auth=auth)
        driver.verify_connectivity()
        _DRIVER = driver
        return _DRIVER
    except Exception as exc:
        logger.info("Direct SSL connection to Memgraph failed, trying bolt+ssc:// fallback: %s", exc)
        fallback_uri = target_uri
        if "bolt+s://" in target_uri:
            fallback_uri = target_uri.replace("bolt+s://", "bolt+ssc://")
        elif "neo4j+s://" in target_uri:
            fallback_uri = target_uri.replace("neo4j+s://", "neo4j+ssc://")

        driver = GraphDatabase.driver(fallback_uri, auth=auth)
        driver.verify_connectivity()
        _DRIVER = driver
        return _DRIVER


STOP_WORDS = {
    "what", "is", "the", "of", "in", "and", "a", "to", "how", "did", "dr",
    "ambedkar", "ambedkar's", "babasaheb", "bhimrao", "view", "views", "critique", "think",
    "thought", "perspective", "about", "for", "on", "with", "by", "his", "their",
    "are", "does", "why", "who", "which", "was", "were", "when", "where", "can",
    "you", "tell", "me", "explain", "give", "some", "according", "opinion",
    "say", "said", "says", "speak", "spoke", "talk", "mention", "mentioned", "regarding",
    "from", "that", "this", "has", "have", "had", "any", "all", "into", "between",
    "than", "then", "there", "would", "could", "should", "also", "like", "its", "your",
    "not", "but", "more", "most", "does", "do", "wrote", "write", "bheem", "bot",
}


def extract_keywords(query: str) -> List[str]:
    """Extract key topical words from user question."""
    words: List[str] = []
    for raw in query.split():
        clean = raw.strip("?,.!'\"()[]{}<>").lower()
        if clean.endswith("'s"):
            clean = clean[:-2]
        if clean and len(clean) > 2 and clean not in STOP_WORDS:
            words.append(clean)
    return words


def query_semrag(
    query: str,
    top_chunks: int = 5,
    volume: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Search Memgraph for entities, relationships, verbatim chunks, and community summaries.
    """
    driver = get_memgraph_driver()
    keywords = extract_keywords(query)
    q_lower = query.lower()
    explicit_ambedkar = any(k in q_lower for k in ["ambedkar", "babasaheb", "bhimrao"])

    with driver.session() as session:
        # 1. Match Entities
        entity_matches: List[Dict[str, Any]] = []
        seen_entity_ids = set()

        for kw in keywords:
            cypher_entities = """
            MATCH (e:Entity)
            WHERE ((' ' + toLower(e.name) + ' ') CONTAINS (' ' + $kw + ' ')
                   OR (' ' + toLower(e.name) + ' ') CONTAINS (' ' + $kw + 's '))
              AND ($volume IS NULL OR e.volume = $volume)
            RETURN e.entity_id AS id, e.name AS name, e.entity_type AS type, e.volume AS volume,
                   e.description AS desc, e.frequency AS freq,
                   CASE WHEN toLower(e.name) = $kw THEN 0 ELSE 1 END AS exact_rank
            ORDER BY exact_rank ASC, e.frequency DESC
            LIMIT 10
            """
            rows = session.run(cypher_entities, {"kw": kw, "volume": volume}).data()
            for r in rows:
                if r["id"] not in seen_entity_ids:
                    seen_entity_ids.add(r["id"])
                    r["kw_hits"] = 1
                    entity_matches.append(r)
                else:
                    for m in entity_matches:
                        if m["id"] == r["id"]:
                            m["kw_hits"] += 1

        entity_matches.sort(key=lambda e: (-e.get("kw_hits", 0), e.get("exact_rank", 1), -(e.get("freq") or 0)))
        top_entities = entity_matches[:8]
        entity_ids = [e["id"] for e in top_entities]

        # General fallback if no entities matched
        if not entity_ids and explicit_ambedkar:
            cypher_fallback_ent = """
            MATCH (e:Entity)
            WHERE (e.name CONTAINS 'Ambedkar' OR e.name CONTAINS 'Caste' OR e.name CONTAINS 'Constitution')
              AND ($volume IS NULL OR e.volume = $volume)
            RETURN e.entity_id AS id, e.name AS name, e.entity_type AS type, e.volume AS volume,
                   e.description AS desc, e.frequency AS freq
            ORDER BY e.frequency DESC
            LIMIT 5
            """
            top_entities = session.run(cypher_fallback_ent, {"volume": volume}).data()
            entity_ids = [e["id"] for e in top_entities]

        # 2. Relational Edges
        triples: List[Dict[str, Any]] = []
        if entity_ids:
            cypher_triples = """
            MATCH (e1:Entity)-[r:RELATES_TO]->(e2:Entity)
            WHERE (e1.entity_id IN $ids OR e2.entity_id IN $ids)
              AND ($volume IS NULL OR e1.volume = $volume)
            RETURN e1.name AS source,
                   head(coalesce(r.relationships, ['RELATES_TO'])) AS relation,
                   e2.name AS target,
                   coalesce(r.description, '') AS description
            LIMIT 15
            """
            triples = session.run(cypher_triples, {"ids": entity_ids, "volume": volume}).data()

        # 3. Verbatim Source Chunks
        chunks: List[Dict[str, Any]] = []
        if entity_ids:
            cypher_chunks = """
            MATCH (ch:Chunk)-[:MENTIONS]->(e:Entity)
            WHERE e.entity_id IN $ids
              AND ($volume IS NULL OR ch.volume = $volume)
              AND coalesce(ch.low_quality, false) = false
            RETURN ch.chunk_id AS chunk_id, ch.text AS text, ch.volume AS volume,
                   count(DISTINCT e) AS hits, collect(DISTINCT e.name)[0] AS matched_entity
            ORDER BY hits DESC
            LIMIT $limit
            """
            chunks = session.run(cypher_chunks, {"ids": entity_ids, "volume": volume, "limit": top_chunks * 2}).data()
        elif keywords:
            # Fallback text search across chunks
            cypher_text_chunks = """
            MATCH (ch:Chunk)
            WHERE toLower(ch.text) CONTAINS $kw
              AND ($volume IS NULL OR ch.volume = $volume)
            RETURN ch.chunk_id AS chunk_id, ch.text AS text, ch.volume AS volume,
                   1 AS hits, $kw AS matched_entity
            LIMIT $limit
            """
            chunks = session.run(cypher_text_chunks, {"kw": keywords[0], "volume": volume, "limit": top_chunks}).data()

        # 4. Community Summaries
        communities: List[Dict[str, Any]] = []
        if top_entities:
            comm_ids = list({e.get("community_id") for e in top_entities if e.get("community_id") is not None})
            if comm_ids:
                cypher_comm = """
                MATCH (c:Community)
                WHERE c.community_id IN $cids AND c.summary <> ''
                RETURN c.community_id AS id, c.summary AS summary, c.volume AS volume
                LIMIT 3
                """
                communities = session.run(cypher_comm, {"cids": comm_ids}).data()

        if not communities:
            cypher_comm_fallback = """
            MATCH (c:Community)
            WHERE c.summary <> '' AND ($volume IS NULL OR c.volume = $volume)
            RETURN c.community_id AS id, c.summary AS summary, c.volume AS volume
            LIMIT 2
            """
            communities = session.run(cypher_comm_fallback, {"volume": volume}).data()

        return {
            "entities": top_entities,
            "triples": triples,
            "chunks": chunks[:top_chunks],
            "communities": communities,
        }


def retrieve_semrag_context(query: str, top_k: int = 5) -> Tuple[str, List[Dict[str, str]]]:
    """
    High-level entry point for BheemBot.
    Returns:
      (context_string_for_prompt, list_of_sources_for_ui)
    """
    try:
        data = query_semrag(query, top_chunks=top_k)
    except Exception as exc:
        logger.warning("SemRAG retrieval encountered error: %s", exc)
        return "", []

    chunks = data.get("chunks", [])
    triples = data.get("triples", [])
    communities = data.get("communities", [])

    if not chunks and not triples and not communities:
        return "", []

    parts: List[str] = []

    if triples:
        triple_lines = [
            f"- ({t['source']}) ──[{t['relation']}]──> ({t['target']})" + (f": {t['description']}" if t.get('description') else "")
            for t in triples[:8]
        ]
        parts.append("=== AMBEDKAR KNOWLEDGE GRAPH RELATIONSHIPS ===\n" + "\n".join(triple_lines))

    if communities:
        comm_lines = [
            f"- [Thematic Cluster Vol {c.get('volume')}]: {c.get('summary')}"
            for c in communities
        ]
        parts.append("=== MACRO THEMATIC CONTEXT ===\n" + "\n".join(comm_lines))

    if chunks:
        chunk_lines = [
            f"--- [Dr. Babasaheb Ambedkar: Writings and Speeches, Volume {c.get('volume')}, Chunk {c.get('chunk_id')}] ---\n{c.get('text')}"
            for c in chunks
        ]
        parts.append("=== VERBATIM SOURCE PASSAGES (DR. B.R. AMBEDKAR) ===\n" + "\n\n".join(chunk_lines))

    context_str = "\n\n".join(parts)

    sources: List[Dict[str, str]] = []
    seen_sources = set()
    for c in chunks:
        vol = c.get("volume") or 1
        cid = c.get("chunk_id") or "chunk"
        title = f"Dr. Ambedkar: Writings & Speeches (Vol. {vol}, {cid})"
        if title not in seen_sources:
            seen_sources.add(title)
            snippet = (c.get("text") or "")[:200].rstrip() + "…"
            sources.append({
                "video_title": title,  # Frontend renders 'video_title' in BookOpen pill
                "snippet": snippet,
                "volume": str(vol),
                "chunk_id": str(cid),
            })

    return context_str, sources
