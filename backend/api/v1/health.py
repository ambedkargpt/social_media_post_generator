from fastapi import APIRouter
from fastapi.responses import JSONResponse

from backend.core.artifact_readiness import assess_artifact_readiness
from backend.core.config import settings
from backend.db.mongo import db, ping_database

router = APIRouter(prefix="/health", tags=["health"])


def _index_checks() -> tuple[dict, bool]:
    """Mongo index introspection; returns (checks_dict, indexes_ok)."""
    db_connected = ping_database()
    checks: dict = {
        "database_connected": db_connected,
        "indexes_ready": False,
    }
    if not db_connected:
        return checks, False
    required_collections = [
        "users",
        "otp_verifications",
        "sessions",
        "news",
        "questions",
        "user_profile_answers",
        "posts",
    ]
    indexes_ok = True
    for cname in required_collections:
        try:
            _ = db[cname].index_information()
        except Exception:
            indexes_ok = False
            break
    checks["indexes_ready"] = indexes_ok
    return checks, indexes_ok


@router.get("/live")
def liveness() -> dict:
    """Process is up (for load balancers / orchestrators)."""
    return {"status": "ok"}


@router.get("/ready")
def readiness() -> JSONResponse:
    """
    Ready to serve traffic: DB + indexes + on-disk artifacts (see artifact_readiness).
    Returns HTTP 503 when not ready.
    """
    checks, indexes_ok = _index_checks()
    art = assess_artifact_readiness(settings)
    checks["artifacts_ready"] = art["ready"]
    checks["artifacts"] = art["details"]

    overall_ok = (
        checks["database_connected"]
        and indexes_ok
        and art["ready"]
    )
    status = "ok" if overall_ok else "degraded"
    payload = {"status": status, **checks}
    if overall_ok:
        return JSONResponse(status_code=200, content=payload)
    return JSONResponse(status_code=503, content=payload)


@router.get("/")
def health_check_legacy() -> JSONResponse:
    """Backwards-compatible combined check (same semantics as /ready)."""
    checks, indexes_ok = _index_checks()
    art = assess_artifact_readiness(settings)
    checks["artifacts_ready"] = art["ready"]
    checks["artifacts"] = art["details"]

    overall_ok = checks["database_connected"] and indexes_ok and art["ready"]
    status = "ok" if overall_ok else "degraded"
    payload = {"status": status, **checks}
    code = 200 if overall_ok else 503
    return JSONResponse(status_code=code, content=payload)
