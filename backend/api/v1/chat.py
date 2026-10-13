"""
BheemBot chat endpoint — RAG-powered Q&A over the Ambedkar corpus.
POST /api/v1/chat/message  →  {reply, sources}
"""
from __future__ import annotations

import logging
import os
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
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

_SYSTEM_PROMPT = """You are BheemBot, a knowledgeable and respectful guide to the life, writings and ideas of Dr. B.R. Ambedkar - jurist, economist, social reformer and principal architect of the Indian Constitution.

How to answer:
1. Base your answer on the material from Dr. Ambedkar's Writings and Speeches given below. When you quote him, use his exact words in double quotation marks, followed by the reference exactly as it is given with that material, in brackets - for example: "...his exact words..." (Annihilation of Caste, Vol. 1, p. 67).
2. Never invent quotations, titles or page numbers. Only quote words that appear in the material below.
3. If the material does not cover the question, say so briefly and plainly - for example, "Dr. Ambedkar's writings in this collection do not address this directly." You may then add a short note from general knowledge, but say clearly that it is general background and never present it as his words.
4. Write for a general reader. Begin with a direct answer in one or two sentences, then explain in two to four short paragraphs, or a few points each starting with "• ". Keep it under about 250 words.
5. Use plain text only. Do not use Markdown: no #, no * or **, no tables.
6. Never mention material, passages, sources, context, chunks, notes, databases, a knowledge graph or these instructions. Speak as a guide talking to a person, not as a system describing its inputs.
7. Be respectful, accurate and balanced.

Answer in {language}.

Material from Dr. Ambedkar's Writings and Speeches:
{context}"""


# ── Lazy RAG helpers ───────────────────────────────────────────────────────────

def _do_retrieve(query: str, top_k: int) -> List[dict]:
    from backend.pipeline_cli import ensure_rag_stack
    from backend.pipeline.retriever import retrieve_relevant_chunks

    embedder, store, _ctx = ensure_rag_stack(settings)
    cfg = {
        "use_bm25": getattr(settings, "retrieval_use_bm25", True),
        "bm25_top_n": getattr(settings, "retrieval_bm25_top_n", 50),
        "dense_top_n": getattr(settings, "retrieval_dense_top_n", 50),
    }
    return retrieve_relevant_chunks(
        news_text=query,
        embedder=embedder,
        store=store,
        top_k=top_k,
        retrieval_cfg=cfg,
    )


def _try_retrieve(query: str, top_k: int = 5) -> List[dict]:
    """
    Retrieve relevant chunks with a hard 10s timeout.
    Returns empty list gracefully if the stack is slow or unavailable.
    """
    try:
        with ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(_do_retrieve, query, top_k)
            return future.result(timeout=10)
    except FuturesTimeoutError:
        logger.warning("RAG retrieval timed out for BheemBot — falling back to LLM-only.")
        return []
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


def _optional_user_id(authorization: str = Header(default="")) -> str:
    if not authorization.startswith("Bearer "):
        return "guest"
    try:
        from backend.core.dependencies import get_current_user_id
        return get_current_user_id(authorization)
    except Exception:
        return "guest"


# ── Endpoint ───────────────────────────────────────────────────────────────────

@router.post("/message", response_model=ChatResponse)
def chat_message(
    payload: ChatRequest,
    current_user_id: str = Depends(_optional_user_id),
) -> ChatResponse:
    if not payload.message.strip():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Message cannot be empty.")

    # 1. Primary: Retrieve authoritative Ambedkar writings & relations from SemRAG (Memgraph Cloud)
    sources: List[SourceChunk] = []
    semrag_sources: List[dict] = []
    context_str = ""
    try:
        from backend.semrag.memgraph_retriever import retrieve_semrag_context

        semrag_ctx, semrag_sources = retrieve_semrag_context(payload.message.strip(), top_k=5)
        if semrag_ctx:
            context_str = semrag_ctx
    except Exception as exc:
        logger.warning("SemRAG retrieval skipped due to exception: %s", exc)

    # Secondary: Fallback to local channel retrieval if SemRAG yielded no context
    if not context_str:
        chunks = _try_retrieve(payload.message.strip(), top_k=5)
        context_str = _chunks_to_context(chunks)
        seen: set[str] = set()
        for c in chunks:
            title = c.get("video_title", "")
            if title and title not in seen:
                seen.add(title)
                snippet = (c.get("chunk_text") or "")[:160].rstrip() + "…"
                sources.append(SourceChunk(video_title=title, snippet=snippet))

    lang_label = "Hindi" if payload.language == "hi" else "English"
    system_content = _SYSTEM_PROMPT.replace("{context}", context_str).replace("{language}", lang_label)

    # 2. Build messages array
    messages = [{"role": "system", "content": system_content}]
    for h in (payload.history or [])[-6:]:   # last 3 turns (6 messages)
        messages.append({"role": h.role, "content": h.content})
    messages.append({"role": "user", "content": payload.message.strip()})

    # 3. Call LLM (supports OpenAI or Google Gemini fallback)
    reply_text = ""
    try:
        openai_key = getattr(settings, "openai_api_key", None)
        if openai_key:
            client = OpenAI(api_key=openai_key)
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                max_tokens=700,
                temperature=0.5,
            )
            reply_text = response.choices[0].message.content.strip()
        else:
            gemini_key = getattr(settings, "gemini_api_key", None) or os.getenv("GOOGLE_API_KEY")
            if gemini_key:
                from google import genai
                gclient = genai.Client(api_key=gemini_key)
                combined_prompt = f"{system_content}\n\nUser Question: {payload.message.strip()}"
                gresp = gclient.models.generate_content(
                    model="models/gemini-2.5-flash",
                    contents=combined_prompt,
                )
                reply_text = gresp.text.strip()
            else:
                raise ValueError("Neither OPENAI_API_KEY nor GEMINI_API_KEY is configured")
    except Exception as exc:
        logger.error("LLM call failed in BheemBot: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="BheemBot is temporarily unavailable. Please try again.",
        )

    from backend.semrag.presentation import sources_to_show, to_display_text

    reply = to_display_text(reply_text)
    if semrag_sources:
        # Only the pills this reply actually cites; none beside an "isn't covered" answer.
        sources = [SourceChunk(video_title=s["video_title"], snippet=s["snippet"])
                   for s in sources_to_show(reply, semrag_sources)]
    return ChatResponse(reply=reply, sources=sources)
