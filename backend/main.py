import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI

from backend.api.v1.auth import router as auth_router
from backend.api.v1.chat import router as chat_router
from backend.api.v1.contact import router as contact_router
from backend.api.v1.health import router as health_router
from backend.api.v1.news import router as news_router
from backend.api.v1.posts import router as posts_router
from backend.api.v1.profile import router as profile_router
from backend.api.v1.questions import router as questions_router
from backend.core.http import register_http_layer
from backend.core.config import settings
from backend.db.indexes import ensure_auth_indexes, ensure_phase2_indexes, ensure_phase3_indexes


def _warm_rag_cache() -> None:
    """Load FAISS + chunks + title embeddings into memory in the background
    so the first user request doesn't pay the ~40-50s cold-start cost."""
    try:
        from backend.pipeline_cli import ensure_rag_stack
        ensure_rag_stack(settings)
    except Exception as exc:
        # Non-fatal — first request will warm the cache instead
        import logging
        logging.getLogger(__name__).warning("RAG pre-warm failed: %s", exc)


@asynccontextmanager
async def app_lifespan(_: FastAPI):
    ensure_auth_indexes()
    ensure_phase2_indexes()
    ensure_phase3_indexes()
    # Pre-warm the RAG stack in the background so the first generate request is fast
    threading.Thread(target=_warm_rag_cache, daemon=True).start()
    yield


app = FastAPI(title="AmbedkarGPT Backend", lifespan=app_lifespan)
register_http_layer(app)
app.include_router(health_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(news_router, prefix="/api/v1")
app.include_router(questions_router, prefix="/api/v1")
app.include_router(profile_router, prefix="/api/v1")
app.include_router(posts_router, prefix="/api/v1")
app.include_router(chat_router, prefix="/api/v1")
app.include_router(contact_router, prefix="/api/v1")
