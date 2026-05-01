import re
from typing import List, Dict


_GREETING_PATTERNS = [
    r"^नमस्कार\s*मैं.*",
    r"^नमस्कार\s+मैं\s+रविश.*",
]

_NOISE_PATTERNS = [
    r"^\[संगीत\]$",
    r"^धन्यवाद[.!।]*$",
]


def _clean_lines(text: str) -> str:
    """Remove greetings, noise markers, empty lines, and very short fragments."""
    lines = text.splitlines()
    cleaned_lines: List[str] = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if any(re.match(pat, stripped) for pat in _GREETING_PATTERNS):
            continue
        if any(re.match(pat, stripped) for pat in _NOISE_PATTERNS):
            continue
        # Drop fragments under 5 words
        if len(stripped.split()) < 5:
            continue
        cleaned_lines.append(stripped)
    return "\n".join(cleaned_lines).strip()


def _split_into_sentences(text: str) -> List[str]:
    """
    Sentence segmentation for Hindi/English based on punctuation: । ? ! .
    """
    # Normalize whitespace while preserving sentence boundaries.
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []

    # Split on Hindi/English sentence-ending punctuation.
    sentences = re.split(r"(?<=[\.\?!।])\s+", text)
    sentences = [s.strip() for s in sentences if s.strip()]

    # Fallback: if we got a very long sentence, split by comma-like pauses.
    refined: List[str] = []
    for sent in sentences:
        if len(sent.split()) > 70:
            parts = re.split(r"(?<=[,;:])\s+", sent)
            refined.extend([p.strip() for p in parts if p.strip()])
        else:
            refined.append(sent)
    sentences = refined

    return sentences


def _split_into_paragraphs(text: str) -> List[str]:
    """
    Split text into paragraph-like blocks while keeping single-line
    transcript structure usable.
    """
    raw_parts = re.split(r"\n\s*\n", text)
    paragraphs: List[str] = []
    for part in raw_parts:
        stripped = part.strip()
        if not stripped:
            continue
        # If a paragraph is still huge due to single-line transcripts,
        # split it by line breaks to keep local context tighter.
        line_parts = [ln.strip() for ln in stripped.split("\n") if ln.strip()]
        if line_parts:
            paragraphs.extend(line_parts)
    return paragraphs


def _chunk_sentences(
    sentences: List[str],
    min_tokens: int = 220,
    max_tokens: int = 300,
    overlap_tokens: int = 60,
    fallback_min_tokens: int = 120,
    max_chars: int = 8000,
) -> List[str]:
    """
    Create overlapping sentence windows for argument chunks.

    Windowed chunks help preserve argument continuity while keeping each
    chunk reasonably small and focused.
    """
    chunks: List[str] = []

    def token_count(text: str) -> int:
        return len(text.split())

    n = len(sentences)
    if n == 0:
        return chunks

    i = 0
    while i < n:
        cur_tokens = 0
        j = i
        while j < n:
            next_tokens = token_count(sentences[j])
            # Always include at least one sentence in a chunk.
            if j > i and cur_tokens + next_tokens > max_tokens:
                break
            cur_tokens += next_tokens
            j += 1

        text = " ".join(sentences[i:j]).strip()
        # Keep ~300-token windows, but avoid tiny fallback chunks.
        # A 2+ sentence fallback is allowed only if it still has enough substance.
        if text and (
            cur_tokens >= min_tokens or ((j - i) >= 2 and cur_tokens >= fallback_min_tokens)
        ) and len(text) <= max_chars:
            chunks.append(text)

        if j >= n:
            break

        # Move start to preserve overlap by token count.
        back_tokens = 0
        next_i = j
        while next_i > i and back_tokens < overlap_tokens:
            next_i -= 1
            back_tokens += token_count(sentences[next_i])
        i = max(i + 1, next_i)

    return chunks


def chunk_videos(videos: List[Dict[str, str]]) -> List[Dict[str, str]]:
    """
    Create argument-level chunks from parsed video transcripts.

    Input videos schema:
    {
      "video_title": "...",
      "video_link": "...",
      "full_text": "..."
    }

    Output argument chunk schema:
    {
      "chunk_id": "videoIndex_chunkIndex",
      "video_title": "...",
      "video_link": "...",
      "chunk_text": "...",
      "chunk_type": "argument",
      "argument_score": 0.0  # to be filled by scoring step
    }
    """
    all_chunks: List[Dict[str, str]] = []

    for vid_idx, video in enumerate(videos):
        title = video["video_title"]
        link = video.get("video_link", "")
        cleaned = _clean_lines(video["full_text"])
        if not cleaned:
            continue

        paragraphs = _split_into_paragraphs(cleaned)
        if not paragraphs:
            continue

        chunks_for_video: List[str] = []
        for para in paragraphs:
            sentences = _split_into_sentences(para)
            if not sentences:
                continue
            chunks_for_video.extend(_chunk_sentences(sentences))

        # Deduplicate near-identical chunks within the same video.
        deduped: List[str] = []
        seen = set()
        for ch in chunks_for_video:
            key = re.sub(r"\s+", " ", ch).strip().lower()
            if key and key not in seen:
                deduped.append(ch)
                seen.add(key)

        for ck_idx, chunk_text in enumerate(deduped, start=1):
            chunk_id = f"vid{vid_idx:03d}_c{ck_idx:03d}"
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

    return all_chunks

