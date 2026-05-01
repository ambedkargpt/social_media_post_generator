import json
import threading
import time
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from openai import OpenAI
from tqdm import tqdm

from .store import (
    add_chunk_extraction,
    chunk_hash,
    load_extraction_cache,
    load_semrag_graph,
    reset_chunk_entries,
    save_extraction_cache,
    save_semrag_graph,
)


ENTITY_EXTRACTION_SYSTEM_NAME = "entity_extraction_system.txt"
ENTITY_EXTRACTION_USER_NAME = "entity_extraction_user.txt"
ENTITY_EXTRACTION_CHECKPOINTS_NAME = "entity_extraction_checkpoints.json"
ENTITY_BACKUP_NAME = "semrag_entities_backup.json"
RELATION_BACKUP_NAME = "semrag_relations_backup.json"
EXTRACTION_WORKERS = 4
EXTRACTION_BATCH_SIZE = 4
EXTRACTION_MAX_RETRIES = 3
EXTRACTION_BACKOFF_SECONDS = 1.5
EXTRACTION_REQUEST_TIMEOUT_SECONDS = 90.0
EXTRACTION_MAX_IN_FLIGHT = EXTRACTION_WORKERS * 2
_THREAD_LOCAL = threading.local()


def _fill_template(template: str, replacements: Dict[str, str]) -> str:
    out = template
    for key, value in replacements.items():
        out = out.replace("{" + key + "}", value)
    return out


def _load_prompts(prompts_dir: Path) -> tuple[str, str]:
    system_path = prompts_dir / ENTITY_EXTRACTION_SYSTEM_NAME
    user_path = prompts_dir / ENTITY_EXTRACTION_USER_NAME
    if not system_path.is_file():
        raise FileNotFoundError(f"Missing SEMRAG system prompt: {system_path}")
    if not user_path.is_file():
        raise FileNotFoundError(f"Missing SEMRAG user prompt: {user_path}")
    return system_path.read_text(encoding="utf-8").strip(), user_path.read_text(encoding="utf-8").strip()


def extraction_chat_client(settings) -> OpenAI:
    model = (settings.semrag_model or "").strip().lower()
    # If SEMRAG model is an OpenAI family model, use OPENAI_API_KEY endpoint.
    if model.startswith("gpt-") or model.startswith("o1") or model.startswith("o3"):
        if not settings.openai_api_key:
            raise ValueError("OPENAI_API_KEY is required for OpenAI SEMRAG extraction models.")
        return OpenAI(api_key=settings.openai_api_key)
    # Default: DeepSeek OpenAI-compatible endpoint
    if not settings.deepseek_api_key:
        raise ValueError("DEEPSEEK_API_KEY is required for SEMRAG extraction.")
    base = (settings.deepseek_base_url or "https://api.deepseek.com").rstrip("/")
    return OpenAI(api_key=settings.deepseek_api_key, base_url=base)


def _safe_json_extract(raw: str) -> Dict:
    text = (raw or "").strip()
    if not text:
        raise ValueError("Empty response from extraction model.")
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            return json.loads(text[start : end + 1])
        raise


def _validate_extraction(payload: Dict, expected_chunk_id: str) -> Dict:
    if not isinstance(payload, dict):
        raise ValueError("Extraction payload is not an object.")
    chunk_id = str(payload.get("chunk_id") or "").strip()
    if chunk_id != expected_chunk_id:
        raise ValueError(f"Extraction chunk_id mismatch: expected {expected_chunk_id}, got {chunk_id or 'empty'}.")
    entities = payload.get("entities", [])
    relations = payload.get("relations", [])
    if not isinstance(entities, list) or not isinstance(relations, list):
        raise ValueError("Extraction payload must contain entities[] and relations[] arrays.")
    payload["entities"] = entities
    payload["relations"] = relations
    return payload


def _extract_once(client: OpenAI, model: str, system_prompt: str, user_prompt: str) -> Dict:
    resp = client.chat.completions.create(
        model=model,
        temperature=0.0,
        timeout=EXTRACTION_REQUEST_TIMEOUT_SECONDS,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )
    content = (resp.choices[0].message.content or "").strip()
    return _safe_json_extract(content)


def extract_chunk_entities(
    client: OpenAI,
    *,
    model: str,
    system_prompt: str,
    user_template: str,
    chunk: Dict,
    language_hint: str,
) -> Dict:
    chunk_id = str(chunk.get("chunk_id") or "").strip()
    if not chunk_id:
        raise ValueError("chunk_id missing in chunk payload.")
    user_prompt = _fill_template(
        user_template,
        {
            "chunk_id": chunk_id,
            "video_title": str(chunk.get("video_title") or "").strip(),
            "video_link": str(chunk.get("video_link") or "").strip(),
            "language_hint": language_hint,
            "chunk_text": str(chunk.get("chunk_text") or "").strip(),
        },
    )
    payload = _extract_once(client, model=model, system_prompt=system_prompt, user_prompt=user_prompt)
    try:
        return _validate_extraction(payload, expected_chunk_id=chunk_id)
    except Exception:
        repair_prompt = (
            "Return only valid JSON exactly in the required schema. "
            f"The chunk_id must be '{chunk_id}'. Do not add explanations."
        )
        payload_retry = _extract_once(
            client,
            model=model,
            system_prompt=system_prompt,
            user_prompt=f"{user_prompt}\n\n{repair_prompt}",
        )
        return _validate_extraction(payload_retry, expected_chunk_id=chunk_id)


def extract_query_entities(client: OpenAI, *, model: str, prompts_dir: Path, query_text: str) -> Dict:
    system_prompt, user_template = _load_prompts(prompts_dir)
    pseudo_chunk = {
        "chunk_id": "query_chunk",
        "video_title": "query",
        "video_link": "",
        "chunk_text": query_text or "",
    }
    return extract_chunk_entities(
        client,
        model=model,
        system_prompt=system_prompt,
        user_template=user_template,
        chunk=pseudo_chunk,
        language_hint="hi-en-mixed",
    )


def save_semrag_chunks(path: Path, chunks: List[Dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(chunks, ensure_ascii=False, indent=2), encoding="utf-8")


def _write_extraction_checkpoint(
    checkpoint_dir: Path,
    *,
    processed: int,
    total: int,
    extracted: int,
    skipped_cached: int,
    last_chunk_id: str,
    is_final: bool = False,
) -> None:
    checkpoint_dir.mkdir(parents=True, exist_ok=True)
    payload = {
        "processed_chunks": int(processed),
        "total_chunks": int(total),
        "extracted_chunks": int(extracted),
        "skipped_cached_chunks": int(skipped_cached),
        "last_chunk_id": last_chunk_id,
        "is_final": bool(is_final),
    }
    checkpoints_path = checkpoint_dir / ENTITY_EXTRACTION_CHECKPOINTS_NAME
    history_payload = {"checkpoints": []}
    if checkpoints_path.exists():
        try:
            loaded = json.loads(checkpoints_path.read_text(encoding="utf-8"))
            if isinstance(loaded, dict) and isinstance(loaded.get("checkpoints"), list):
                history_payload = loaded
        except Exception:
            history_payload = {"checkpoints": []}
    checkpoints = history_payload.setdefault("checkpoints", [])
    if not checkpoints or checkpoints[-1] != payload:
        checkpoints.append(payload)
    history_payload["latest"] = payload
    checkpoints_path.write_text(json.dumps(history_payload, ensure_ascii=False, indent=2), encoding="utf-8")

    # Keep a compact final snapshot for tooling that expects this file.
    if is_final:
        (checkpoint_dir / "entity_extraction_final.json").write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )


def _sync_extraction_state(
    *,
    graph_path: Path,
    graph: Dict,
    cache_path: Path,
    cache: Dict[str, Dict],
    checkpoint_dir: Path,
    processed: int,
    total: int,
    extracted: int,
    skipped_cached: int,
    last_chunk_id: str,
    is_final: bool,
) -> None:
    """
    Persist graph + cache + checkpoint as one synchronized progress step.
    """
    save_semrag_graph(graph_path, graph)
    save_extraction_cache(cache_path, cache)
    _write_extraction_checkpoint(
        checkpoint_dir,
        processed=processed,
        total=total,
        extracted=extracted,
        skipped_cached=skipped_cached,
        last_chunk_id=last_chunk_id,
        is_final=is_final,
    )
    _write_entity_relation_backups(graph=graph, output_dir=graph_path.parent)


def _write_entity_relation_backups(*, graph: Dict, output_dir: Path) -> None:
    """
    Store entities and relations in separate backup files so graph content
    remains recoverable even if semrag_graph.json is later overwritten.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    entities = graph.get("entities", []) or []
    relations = graph.get("relations", []) or []

    entities_payload = {
        "updated_at": graph.get("updated_at"),
        "count": len(entities),
        "entities": entities,
    }
    relations_payload = {
        "updated_at": graph.get("updated_at"),
        "count": len(relations),
        "relations": relations,
    }

    (output_dir / ENTITY_BACKUP_NAME).write_text(
        json.dumps(entities_payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (output_dir / RELATION_BACKUP_NAME).write_text(
        json.dumps(relations_payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _read_backup_payloads(output_dir: Path) -> tuple[list[Dict], list[Dict]]:
    entities_path = output_dir / ENTITY_BACKUP_NAME
    relations_path = output_dir / RELATION_BACKUP_NAME
    if not entities_path.exists() or not relations_path.exists():
        return [], []
    try:
        entities_payload = json.loads(entities_path.read_text(encoding="utf-8"))
        relations_payload = json.loads(relations_path.read_text(encoding="utf-8"))
    except Exception:
        return [], []
    entities = entities_payload.get("entities") if isinstance(entities_payload, dict) else []
    relations = relations_payload.get("relations") if isinstance(relations_payload, dict) else []
    if not isinstance(entities, list) or not isinstance(relations, list):
        return [], []
    return entities, relations


def _graph_from_backups(*, entities: list[Dict], relations: list[Dict]) -> Dict:
    graph: Dict = {
        "version": 1,
        "updated_at": "",
        "entities": entities,
        "relations": relations,
        "entity_name_to_id": {},
        "chunk_entities": {},
        "entity_to_chunks": {},
        "relation_to_chunks": {},
    }

    for ent in entities:
        if not isinstance(ent, dict):
            continue
        entity_id = str(ent.get("entity_id") or "").strip()
        name = str(ent.get("canonical_name") or "").strip()
        entity_type = str(ent.get("entity_type") or "").strip().lower()
        if entity_id and name and entity_type:
            graph["entity_name_to_id"][f"{normalize_text(name)}::{normalize_text(entity_type)}"] = entity_id

    chunk_entities: Dict[str, set] = {}
    for rel in relations:
        if not isinstance(rel, dict):
            continue
        cid = str(rel.get("evidence_chunk_id") or "").strip()
        if not cid:
            continue
        bucket = chunk_entities.setdefault(cid, set())
        head = str(rel.get("head_entity_id") or "").strip()
        tail = str(rel.get("tail_entity_id") or "").strip()
        if head:
            bucket.add(head)
        if tail:
            bucket.add(tail)
    graph["chunk_entities"] = {k: sorted(v) for k, v in chunk_entities.items()}
    rebuild_indexes(graph)
    return graph


def _worker_client(settings) -> OpenAI:
    client = getattr(_THREAD_LOCAL, "client", None)
    if client is None:
        client = extraction_chat_client(settings)
        _THREAD_LOCAL.client = client
    return client


def _build_batch_user_prompt(chunks: List[Dict]) -> str:
    payload = []
    for ch in chunks:
        payload.append(
            {
                "chunk_id": str(ch.get("chunk_id") or "").strip(),
                "video_title": str(ch.get("video_title") or "").strip(),
                "video_link": str(ch.get("video_link") or "").strip(),
                "language_hint": "hi-en-mixed",
                "chunk_text": str(ch.get("chunk_text") or "").strip(),
            }
        )
    return (
        "Extract entities and relations for each item in this JSON array.\n"
        "Return ONLY JSON with this shape:\n"
        "{\n"
        '  "results": [\n'
        "    {\n"
        '      "chunk_id": "string",\n'
        '      "entities": [],\n'
        '      "relations": []\n'
        "    }\n"
        "  ]\n"
        "}\n"
        "The output must include one result object per input chunk_id.\n\n"
        f"INPUT_CHUNKS_JSON:\n{json.dumps(payload, ensure_ascii=False)}"
    )


def _extract_batch_once(
    client: OpenAI,
    *,
    model: str,
    system_prompt: str,
    chunks: List[Dict],
) -> Dict[str, Dict]:
    user_prompt = _build_batch_user_prompt(chunks)
    payload = _extract_once(client, model=model, system_prompt=system_prompt, user_prompt=user_prompt)
    results = payload.get("results", [])
    if not isinstance(results, list):
        raise ValueError("Batch extraction payload missing results[]")
    by_id: Dict[str, Dict] = {}
    for item in results:
        if not isinstance(item, dict):
            continue
        chunk_id = str(item.get("chunk_id") or "").strip()
        if not chunk_id:
            continue
        by_id[chunk_id] = _validate_extraction(item, expected_chunk_id=chunk_id)
    missing = [str(ch.get("chunk_id") or "").strip() for ch in chunks if str(ch.get("chunk_id") or "").strip() not in by_id]
    if missing:
        raise ValueError(f"Batch extraction missing chunk_ids: {missing[:5]}")
    return by_id


def _extract_batch_with_retry(
    batch_chunks: List[Dict],
    settings,
    system_prompt: str,
    user_template: str,
) -> Tuple[List[Tuple[str, Optional[Dict], str, Optional[str]]], int]:
    """
    Worker task: extract one batch with retry/backoff.
    Returns: ([ (chunk_id, extraction_or_none, hash, error_or_none) ... ], retry_count)
    """
    clean_chunks = [ch for ch in batch_chunks if str(ch.get("chunk_id") or "").strip()]
    if not clean_chunks:
        return [], 0
    client = _worker_client(settings)
    last_err = ""
    for attempt in range(1, EXTRACTION_MAX_RETRIES + 1):
        try:
            by_id = _extract_batch_once(
                client,
                model=settings.semrag_model,
                system_prompt=system_prompt,
                chunks=clean_chunks,
            )
            out: List[Tuple[str, Optional[Dict], str, Optional[str]]] = []
            for ch in clean_chunks:
                cid = str(ch.get("chunk_id") or "").strip()
                out.append((cid, by_id.get(cid), chunk_hash(ch), None))
            return out, attempt - 1
        except Exception as exc:
            last_err = str(exc)
            if attempt >= EXTRACTION_MAX_RETRIES:
                break
            delay = EXTRACTION_BACKOFF_SECONDS * (2 ** (attempt - 1))
            time.sleep(delay)
    # Fallback: attempt single-chunk extraction so one bad chunk doesn't drop whole batch.
    out: List[Tuple[str, Optional[Dict], str, Optional[str]]] = []
    for ch in clean_chunks:
        cid = str(ch.get("chunk_id") or "").strip()
        h = chunk_hash(ch)
        try:
            extraction = extract_chunk_entities(
                client,
                model=settings.semrag_model,
                system_prompt=system_prompt,
                user_template=user_template,
                chunk=ch,
                language_hint="hi-en-mixed",
            )
            out.append((cid, extraction, h, None))
        except Exception as exc:
            out.append((cid, None, h, str(exc) or last_err or "extraction_failed"))
    return out, EXTRACTION_MAX_RETRIES - 1


def build_semrag_graph(*, chunks: List[Dict], settings, graph_path: Path, cache_path: Path, force_rebuild: bool) -> Dict:
    graph = load_semrag_graph(graph_path)
    cache = load_extraction_cache(cache_path)
    total = len(chunks)
    processed = 0
    extracted = 0
    skipped_cached = 0
    failed = 0
    retried = 0
    checkpoint_every = 250
    checkpoint_dir = graph_path.parent / "checkpoints"
    pending: List[Dict] = []
    system_prompt, user_template = _load_prompts(settings.prompts_dir)
    last_chunk_id = str(chunks[0].get("chunk_id") if chunks else "")

    # Pre-filter cached chunks first (and count them in progress).
    # If cache contains extraction payloads, rehydrate graph directly from cache.
    for chunk in chunks:
        chunk_id = str(chunk.get("chunk_id") or "").strip()
        if not chunk_id:
            continue
        h = chunk_hash(chunk)
        cached = cache.get(chunk_id, {}) if isinstance(cache.get(chunk_id), dict) else {}
        hash_match = (not force_rebuild) and cached.get("hash") == h
        cached_extraction = cached.get("extraction")

        if hash_match and isinstance(cached_extraction, dict):
            try:
                # Ensure graph always reflects cached extractions for matching chunks.
                reset_chunk_entries(graph, chunk_id)
                add_chunk_extraction(graph, chunk, cached_extraction)
                skipped_cached += 1
                last_chunk_id = chunk_id
            except Exception:
                # If cache payload is malformed, re-extract this chunk.
                pending.append(chunk)
        elif hash_match:
            # Hash-only cache entry (legacy format): treat as processed, but no graph rehydrate available.
            skipped_cached += 1
            last_chunk_id = chunk_id
        else:
            pending.append(chunk)

    with tqdm(total=total, desc="SEMRAG entity extraction", unit="chunk") as pbar:
        # Mark cached as already processed on bar.
        if skipped_cached:
            processed += skipped_cached
            pbar.update(skipped_cached)
            pbar.set_postfix(extracted=extracted, skipped=skipped_cached, failed=failed, retried=retried, in_flight=0)
            # Persist a synchronized snapshot immediately, so restarts begin from cache-backed progress.
            _sync_extraction_state(
                graph_path=graph_path,
                graph=graph,
                cache_path=cache_path,
                cache=cache,
                checkpoint_dir=checkpoint_dir,
                processed=processed,
                total=total,
                extracted=extracted,
                skipped_cached=skipped_cached,
                last_chunk_id=last_chunk_id,
                is_final=False,
            )

        future_map = {}
        with ThreadPoolExecutor(max_workers=EXTRACTION_WORKERS) as pool:
            pending_idx = 0
            while pending_idx < len(pending) or future_map:
                while pending_idx < len(pending) and len(future_map) < EXTRACTION_MAX_IN_FLIGHT:
                    batch = pending[pending_idx : pending_idx + EXTRACTION_BATCH_SIZE]
                    fut = pool.submit(_extract_batch_with_retry, batch, settings, system_prompt, user_template)
                    future_map[fut] = batch
                    pending_idx += len(batch)
                if not future_map:
                    break
                done, _ = wait(set(future_map.keys()), return_when=FIRST_COMPLETED)
                for fut in done:
                    batch = future_map.pop(fut)
                    try:
                        batch_results, retry_count = fut.result()
                    except Exception as exc:
                        batch_results = []
                        for ch in batch:
                            cid = str(ch.get("chunk_id") or "").strip()
                            batch_results.append((cid, None, chunk_hash(ch), str(exc)))
                        retry_count = 0

                    retried += int(retry_count)
                    for cid, extraction, h, err in batch_results:
                        chunk_ref = next((c for c in batch if str(c.get("chunk_id") or "").strip() == cid), None)
                        if extraction is not None and cid and chunk_ref is not None:
                            reset_chunk_entries(graph, cid)
                            add_chunk_extraction(graph, chunk_ref, extraction)
                            cache[cid] = {
                                "hash": h,
                                "extraction": extraction,
                            }
                            extracted += 1
                            last_chunk_id = cid
                        else:
                            failed += 1
                            last_chunk_id = cid

                        processed += 1
                        pbar.update(1)
                        pbar.set_postfix(
                            extracted=extracted,
                            skipped=skipped_cached,
                            failed=failed,
                            retried=retried,
                            in_flight=len(future_map),
                        )

                        if processed % checkpoint_every == 0:
                            _sync_extraction_state(
                                graph_path=graph_path,
                                graph=graph,
                                cache_path=cache_path,
                                cache=cache,
                                checkpoint_dir=checkpoint_dir,
                                processed=processed,
                                total=total,
                                extracted=extracted,
                                skipped_cached=skipped_cached,
                                last_chunk_id=last_chunk_id,
                                is_final=False,
                            )
    # Guard: never overwrite graph with empty content when backups have valid extracted knowledge.
    if not graph.get("entities") and not graph.get("relations"):
        backup_entities, backup_relations = _read_backup_payloads(graph_path.parent)
        if backup_entities or backup_relations:
            graph = _graph_from_backups(entities=backup_entities, relations=backup_relations)

    _sync_extraction_state(
        graph_path=graph_path,
        graph=graph,
        cache_path=cache_path,
        cache=cache,
        checkpoint_dir=checkpoint_dir,
        processed=processed,
        total=total,
        extracted=extracted,
        skipped_cached=skipped_cached,
        last_chunk_id=str(chunks[-1].get("chunk_id") if chunks else ""),
        is_final=True,
    )
    return graph
