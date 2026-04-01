from typing import List, Dict


KEYWORDS = [
    "संविधान",
    "अधिकार",
    "पुलिस",
    "राज्य",
    "लोकतंत्र",
    "न्याय",
    "संस्था",
    "कानून",
    "law",
    "rights",
    "democracy",
    "state",
    "citizen",
    "citizens",
]


def _contains_number(text: str) -> bool:
    return any(ch.isdigit() for ch in text)


def score_chunk(chunk_text: str) -> float:
    """
    Heuristic scoring of argument strength:
    - base score from keyword hits
    - bonus for numbers/statistics
    """
    text = chunk_text
    lower = text.lower()

    # Keyword hits
    hits = 0
    for kw in KEYWORDS:
        if kw in text or kw in lower:
            hits += 1

    if hits == 0 and not _contains_number(text):
        return 0.0

    # Normalize keyword score
    kw_score = min(hits / 5.0, 1.0)

    # Number/statistics bonus
    num_bonus = 0.2 if _contains_number(text) else 0.0

    score = kw_score + num_bonus
    return max(0.0, min(score, 1.0))


def score_argument_chunks(chunks: List[Dict[str, str]]) -> List[Dict[str, str]]:
    """
    Mutate and return chunks with 'argument_score' filled in [0, 1].
    """
    for chunk in chunks:
        chunk_text = chunk.get("chunk_text", "")
        chunk["argument_score"] = score_chunk(chunk_text)
    return chunks

