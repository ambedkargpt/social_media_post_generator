from contextlib import asynccontextmanager

from fastapi import FastAPI

from backend.api.v1.auth import router as auth_router
from backend.api.v1.health import router as health_router
from backend.api.v1.news import router as news_router
from backend.api.v1.posts import router as posts_router
from backend.api.v1.profile import router as profile_router
from backend.api.v1.questions import router as questions_router
from backend.core.http import register_http_layer
from backend.db.indexes import ensure_auth_indexes, ensure_phase2_indexes, ensure_phase3_indexes


@asynccontextmanager
async def app_lifespan(_: FastAPI):
    ensure_auth_indexes()
    ensure_phase2_indexes()
    ensure_phase3_indexes()
    yield


app = FastAPI(title="AmbedkarGPT Backend", lifespan=app_lifespan)
register_http_layer(app)
app.include_router(health_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(news_router, prefix="/api/v1")
app.include_router(questions_router, prefix="/api/v1")
app.include_router(profile_router, prefix="/api/v1")
app.include_router(posts_router, prefix="/api/v1")
