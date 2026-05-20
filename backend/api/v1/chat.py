"""
BheemBot chat endpoint — RAG-powered Q&A over the Ambedkar corpus.
POST /api/v1/chat/message  →  {reply, sources}
"""
from __future__ import annotations

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from openai import OpenAI
from pydantic import BaseModel

from backend.core.dependencies import get_current_user_id
from backend.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chat", tags=["chat"])

# ── Pydantic models ────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str           # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []   # last N turns for context
    language: Optional[str] = "en"              # "en" | "hi"


class SourceChunk(BaseModel):
    video_title: str
    snippet: str


class ChatResponse(BaseModel):
    reply: str
    sources: List[SourceChunk] = []


# ── System prompt ──────────────────────────────────────────────────────────────

_SYSTEM_PROMPT = """You are BheemBot, an AI knowledge assistant trained exclusively on the writings, speeches, and philosophy of Dr. B.R. Ambedkar — the principal architect of the Indian Constitution, social reformer, jurist, economist, and champion of the rights of Dalits and other marginalized communities.

Your role:
1. Answer questions about Dr. Ambedkar's life, philosophy, writings, and legacy.
2. Explain constitutional provisions, rights, and their historical context.
3. Discuss social justice, caste, equality, and anti-caste movements.
4. Draw exclusively from the retrieved context below when available; if the context is insufficient, acknowledge it honestly.
5. Be respectful, educational, and empowering in tone.
6. Keep answers concise (3–5 paragraphs) unless the user explicitly asks for more detail.
7. NEVER fabricate quotes or citations — if unsure, say so.

Retrieved Knowledge Context:
{context}

Answer in {language}."""


# ── Lazy RAG helpers ───────────────────────────────────────────────────────────

def _try_retrieve(query: str, top_k: int = 5) -> List[dict]:
    """
    Attempt to retrieve relevant chunks from the RAG stack.
    Returns empty list gracefully if the stack is unavailable.
    """
    try:
        from backend.pipeline_cli import ensure_rag_stack
        from backend.pipeline.retriever import retrieve_relevant_chunks

        embedder, store, _ctx = ensure_rag_stack(settings)
        cfg = {
            "use_bm25": getattr(settings, "retrieval_use_bm25", True),
            "bm25_top_n": getattr(settings, "retrieval_bm25_top_n", 50),
            "dense_top_n": getattr(settings, "retrieval_dense_top_n", 50),
        }
        chunks = retrieve_relevant_chunks(
            news_text=query,
            embedder=embedder,
            store=store,
            top_k=top_k,
            retrieval_cfg=cfg,
        )
        return chunks
    except Exception as exc:
        logger.warning("RAG retrieval failed (BheemBot falling back to LLM-only): %s", exc)
        return []


def _chunks_to_context(chunks: List[dict]) -> str:
    if not chunks:
        return "(No specific retrieved context — answer from general Ambedkar knowledge.)"
    parts = []
    for c in chunks:
        title = c.get("video_title", "Unknown Source")
        text  = c.get("chunk_text", "")
        parts.append(f"[Source: {title}]\n{text}")
    return "\n\n---\n\n".join(parts)


# ── Endpoint ───────────────────────────────────────────────────────────────────

@router.post("/message", response_model=ChatResponse)
def chat_message(
    payload: ChatRequest,
    current_user_id: str = Depends(get_current_user_id),
) -> ChatResponse:
    if not payload.message.strip():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Message cannot be empty.")

    # 1. Retrieve relevant chunks
    chunks = _try_retrieve(payload.message.strip(), top_k=5)
    context_str = _chunks_to_context(chunks)

    lang_label = "Hindi" if payload.language == "hi" else "English"
    system_content = _SYSTEM_PROMPT.replace("{context}", context_str).replace("{language}", lang_label)

    # 2. Build messages array
    messages = [{"role": "system", "content": system_content}]
    for h in (payload.history or [])[-6:]:   # last 3 turns (6 messages)
        messages.append({"role": h.role, "content": h.content})
    messages.append({"role": "user", "content": payload.message.strip()})

    # 3. Call LLM
    try:
        openai_key = getattr(settings, "openai_api_key", None)
        if not openai_key:
            raise ValueError("OPENAI_API_KEY not configured")
        client = OpenAI(api_key=openai_key)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            max_tokens=700,
            temperature=0.5,
        )
        reply_text = response.choices[0].message.content.strip()
    except Exception as exc:
        logger.error("LLM call failed in BheemBot: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="BheemBot is temporarily unavailable. Please try again.",
        )

    # 4. Build source list (dedup by title)
    seen: set[str] = set()
    sources: List[SourceChunk] = []
    for c in chunks:
        title = c.get("video_title", "")
        if title and title not in seen:
            seen.add(title)
            snippet = (c.get("chunk_text") or "")[:160].rstrip() + "…"
            sources.append(SourceChunk(video_title=title, snippet=snippet))

    return ChatResponse(reply=reply_text, sources=sources)
