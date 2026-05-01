from fastapi import APIRouter

from backend.db.mongo import db, ping_database


router = APIRouter(prefix="/health", tags=["health"])


@router.get("/")
def health_check() -> dict:
    db_connected = ping_database()
    checks = {
        "database_connected": db_connected,
        "indexes_ready": False,
    }
    if db_connected:
        required_collections = ["users", "otp_verifications", "sessions", "news", "questions", "user_profile_answers", "posts"]
        indexes_ok = True
        for cname in required_collections:
            try:
                _ = db[cname].index_information()
            except Exception:
                indexes_ok = False
                break
        checks["indexes_ready"] = indexes_ok
    overall = "ok" if all(checks.values()) else "degraded"
    return {
        "status": overall,
        **checks,
    }
