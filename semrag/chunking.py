import re
import time
import json
from pathlib import Path
from typing import TYPE_CHECKING, Dict, List, Optional

import numpy as np
from tqdm import tqdm

from .semrag_config import SemragConfig

if TYPE_CHECKING:
    from pipeline.embedder import ChunkEmbedder


_GREETING_PATTERNS = [
    r"^नमस्कार\b",
]

_NOISE_PATTERNS = [
    r"^\[संगीत\]$",
    r"^धन्यवाद[.!।]*$",
]


def _clean_lines(text: str) -> str:
    lines = text.splitlines()
    cleaned_lines: List[str] = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        for pat in _GREETING_PATTERNS:
            if re.match(pat, stripped):
                parts = re.split(r"(?<=[\.\?!।])\s+", stripped, maxsplit=1)
                stripped = parts[1].strip() if len(parts) > 1 else stripped
        if any(re.match(pat, stripped) for pat in _NOISE_PATTERNS):
            continue
        if not stripped:
            continue
        cleaned_lines.append(stripped)
    return "\n".join(cleaned_lines).strip()


def split_sentences(text: str, *, min_sentence_length: int) -> List[str]:
    raw = (text or "").strip()
    if not raw:
        return []
    line_parts = [re.sub(r"\s+", " ", ln).strip() for ln in raw.splitlines() if ln.strip()]
    base_parts = line_parts if line_parts else [re.sub(r"\s+", " ", raw).strip()]
    sentences: List[str] = []
    for part in base_parts:
        sentences.extend(re.split(r"(?<=[\.\?!।])\s+", part))
    if len(sentences) <= 1:
        refined: List[str] = []
        for sent in sentences:
            refined.extend(re.split(r"(?<=[,;:])\s+", sent))
        sentences = refined
    if len(sentences) <= 1:
        fallback: List[str] = []
        words = (sentences[0] if sentences else raw).split()
        step = 25
        for i in range(0, len(words), step):
            fallback.append(" ".join(words[i : i + step]))
        sentences = fallback
    out: List[str] = []
    for sent in sentences:
        s = sent.strip()
        if len(s) < min_sentence_length:
            continue
        out.append(s)
    if not out and raw:
        return [re.sub(r"\s+", " ", raw)]
    return out


def _split_into_paragraphs(text: str) -> List[str]:
    raw_parts = re.split(r"\n\s*\n", text)
    paragraphs: List[str] = []
    for part in raw_parts:
        stripped = part.strip()
        if not stripped:
            continue
        line_parts = [ln.strip() for ln in stripped.split("\n") if ln.strip()]
        if line_parts:
            paragraphs.extend(line_parts)
    return paragraphs


def _split_by_token_limit(text: str, token_limit: int, overlap_tokens: int) -> List[str]:
    tokens = text.split()
    if len(tokens) <= token_limit:
        return [text]
    chunks: List[str] = []
    i = 0
    while i < len(tokens):
        j = min(len(tokens), i + token_limit)
        chunks.append(" ".join(tokens[i:j]).strip())
        if j >= len(tokens):
            break
        i = max(i + 1, j - overlap_tokens)
    return [c for c in chunks if c]


def _split_by_char_limit(text: str, max_chars: int, overlap_chars: int = 200) -> List[str]:
    if len(text) <= max_chars:
        return [text]
    chunks: List[str] = []
    i = 0
    while i < len(text):
        j = min(len(text), i + max_chars)
        chunk = text[i:j].strip()
        if chunk:
            chunks.append(chunk)
        if j >= len(text):
            break
        i = max(i + 1, j - overlap_chars)
    return chunks


def _adjacent_similarity_fallback(sentences: List[str]) -> np.ndarray:
    def toks(s: str) -> set[str]:
        return set(re.findall(r"\w+", s.casefold()))

    sims: List[float] = []
    for i in range(len(sentences) - 1):
        a = toks(sentences[i])
        b = toks(sentences[i + 1])
        if not a or not b:
            sims.append(0.0)
            continue
        sims.append(float(len(a & b)) / float(len(a | b)))
    return np.asarray(sims, dtype=np.float32)


def _embed_sentences_batched(embedder: "ChunkEmbedder", sentences: List[str]) -> np.ndarray:
    """
    Embed sentence list in batches without spawning nested tqdm bars.
    """
    if not sentences:
        return np.empty((0, 1), dtype=np.float32)
    rows: List[List[float]] = []
    bs = max(1, int(getattr(embedder, "batch_size", 25)))
    for i in range(0, len(sentences), bs):
        batch = sentences[i : i + bs]
        result = embedder.client.models.embed_content(
            model=embedder.model_name,
            contents=batch,
        )
        for emb in result.embeddings:
            rows.append(list(emb.values))
    return np.asarray(rows, dtype=np.float32)


def _write_chunk_checkpoint(
    checkpoint_dir: Path,
    *,
    video_index_1based: int,
    total_videos: int,
    chunks: List[Dict],
    is_final: bool = False,
) -> None:
    checkpoint_dir.mkdir(parents=True, exist_ok=True)
    name = "chunking_final.json" if is_final else f"chunking_ckpt_{video_index_1based:04d}.json"
    payload = {
        "video_index_1based": int(video_index_1based),
        "total_videos": int(total_videos),
        "is_final": bool(is_final),
        "chunk_count": len(chunks),
        "chunks": chunks,
    }
    (checkpoint_dir / name).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _semantic_chunks_from_sims(sentences: List[str], sims: np.ndarray, cfg: SemragConfig) -> List[str]:
    if not sentences:
        return []
    if len(sentences) <= cfg.min_chunk_sentences:
        return [" ".join(sentences).strip()]

    n = len(sentences)
    chunks: List[str] = []
    start = 0
    min_window = max(cfg.min_chunk_sentences, cfg.buffer_sentences + 1)
    while start < n:
        end = min(n, start + min_window)
        while end < n and (end - start) < cfg.max_chunk_sentences:
            adj_sim = float(sims[end - 1]) if (end - 1) < len(sims) else 0.0
            if adj_sim < cfg.similarity_threshold and (end - start) >= cfg.min_chunk_sentences:
                break
            end += 1

        text = " ".join(sentences[start:end]).strip()
        if text:
            chunks.append(text)
        if end >= n:
            break
        start = max(start + 1, end - cfg.buffer_sentences)
    return chunks


def chunk_videos_for_semrag(videos: List[Dict[str, str]], embedder: Optional["ChunkEmbedder"], cfg: SemragConfig) -> List[Dict]:
    all_chunks: List[Dict] = []
    total = len(videos)
    started = time.time()
    checkpoint_dir = Path(cfg.semrag_chunks_path).parent / "checkpoints"
    checkpoint_every = 100
    with tqdm(total=total, desc="SEMRAG pipeline (chunking)", unit="video") as pbar:
        for vid_idx, video in enumerate(videos):
            elapsed = time.time() - started
            avg = (elapsed / (vid_idx + 1)) if (vid_idx + 1) else 0.0
            eta_s = int(max(0.0, (total - (vid_idx + 1)) * avg))
            pbar.set_postfix(
                chunks=len(all_chunks),
                eta=f"{eta_s // 60}m{eta_s % 60:02d}s",
            )
            title = video.get("video_title", "")
            link = video.get("video_link", "")
            cleaned = _clean_lines(video.get("full_text", ""))
            if not cleaned:
                pbar.update(1)
                continue
            # Batch sentence processing per video to reduce API calls.
            sentences = split_sentences(cleaned, min_sentence_length=cfg.min_sentence_length)
            if not sentences:
                pbar.update(1)
                continue
            if cfg.chunking_mode == "semantic":
                try:
                    if embedder is None:
                        raise RuntimeError("No embedder supplied")
                    embs = _embed_sentences_batched(embedder, sentences).astype("float32")
                    embs /= (np.linalg.norm(embs, axis=1, keepdims=True) + 1e-12)
                    sims = (
                        np.sum(embs[:-1] * embs[1:], axis=1) if len(sentences) > 1 else np.array([], dtype=np.float32)
                    )
                except Exception:
                    sims = _adjacent_similarity_fallback(sentences)
                chunks_for_video = _semantic_chunks_from_sims(sentences, sims, cfg)
            else:
                chunks_for_video = [" ".join(sentences).strip()]

            deduped: List[str] = []
            seen = set()
            min_chars = cfg.min_chunk_chars
            for pass_idx in range(2):
                if pass_idx == 1 and deduped:
                    break
                effective_min = min_chars if pass_idx == 0 else min(120, min_chars)
                for chunk_text in chunks_for_video:
                    if len(chunk_text) < effective_min:
                        continue
                    for token_chunk in _split_by_token_limit(chunk_text, cfg.token_limit, cfg.overlap_tokens):
                        for char_chunk in _split_by_char_limit(token_chunk, cfg.max_chunk_chars):
                            key = re.sub(r"\s+", " ", char_chunk).strip().lower()
                            if key and key not in seen:
                                deduped.append(char_chunk)
                                seen.add(key)

            for ck_idx, chunk_text in enumerate(deduped, start=1):
                chunk_id = f"sem_vid{vid_idx:03d}_c{ck_idx:03d}"
                all_chunks.append(
                    {
                        "chunk_id": chunk_id,
                        "video_title": title,
                        "video_link": link,
                        "chunk_text": chunk_text,
                        "chunk_type": "argument",
                        "argument_score": 0.0,
                    }
                )
            pbar.update(1)
            done = vid_idx + 1
            if done % checkpoint_every == 0:
                _write_chunk_checkpoint(
                    checkpoint_dir,
                    video_index_1based=done,
                    total_videos=total,
                    chunks=all_chunks,
                    is_final=False,
                )
    _write_chunk_checkpoint(
        checkpoint_dir,
        video_index_1based=total,
        total_videos=total,
        chunks=all_chunks,
        is_final=True,
    )
    return all_chunks
