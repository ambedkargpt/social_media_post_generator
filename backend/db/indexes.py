from pymongo import ASCENDING, DESCENDING

from backend.db.mongo import db


def ensure_auth_indexes() -> None:
    users = db["users"]
    users.create_index([("username", ASCENDING)], unique=True, name="uq_users_username")
    users.create_index(
        [("email", ASCENDING)],
        unique=True,
        partialFilterExpression={"email": {"$type": "string"}},
        name="uq_users_email_sparse",
    )
    users.create_index(
        [("phone", ASCENDING)],
        unique=True,
        partialFilterExpression={"phone": {"$type": "string"}},
        name="uq_users_phone_sparse",
    )
    users.create_index([("created_at", DESCENDING)], name="idx_users_created_at")

    otp = db["otp_verifications"]
    otp.create_index([("expires_at", ASCENDING)], expireAfterSeconds=0, name="ttl_otp_expires")
    otp.create_index([("target", ASCENDING), ("purpose", ASCENDING), ("created_at", DESCENDING)], name="idx_otp_lookup")
    otp.create_index([("user_id", ASCENDING)], name="idx_otp_user")

    sessions = db["sessions"]
    sessions.create_index([("user_id", ASCENDING)], name="idx_sessions_user")
    sessions.create_index(
        [("refresh_token_hash", ASCENDING)],
        unique=True,
        partialFilterExpression={"refresh_token_hash": {"$type": "string"}},
        name="uq_sessions_refresh_token_hash",
    )
    sessions.create_index([("access_expires_at", ASCENDING)], name="idx_sessions_access_exp")
    sessions.create_index([("refresh_expires_at", ASCENDING)], name="idx_sessions_refresh_exp")


def ensure_phase2_indexes() -> None:
    news = db["news"]
    news.create_index([("published_at", DESCENDING)], name="idx_news_published_at")
    news.create_index([("created_at", DESCENDING)], name="idx_news_created_at")
    news.create_index(
        [("news_id", ASCENDING)],
        unique=True,
        partialFilterExpression={"news_id": {"$type": "string"}},
        name="uq_news_news_id",
    )
    news.create_index(
        [("source_url", ASCENDING)],
        unique=True,
        partialFilterExpression={"source_url": {"$type": "string"}},
        name="uq_news_source_url",
    )
    news.create_index([("headline", "text"), ("description", "text")], name="idx_news_text")

    questions = db["questions"]
    questions.create_index([("question_id", ASCENDING)], unique=True, name="uq_questions_question_id")
    questions.create_index([("category", ASCENDING), ("is_active", ASCENDING)], name="idx_questions_category_active")
    questions.create_index([("created_at", DESCENDING)], name="idx_questions_created_at")

    answers = db["user_profile_answers"]
    answers.create_index([("user_id", ASCENDING), ("question_id", ASCENDING)], unique=True, name="uq_answers_user_question")
    answers.create_index([("answered_at", DESCENDING)], name="idx_answers_answered_at")


def ensure_phase3_indexes() -> None:
    posts = db["posts"]
    posts.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)], name="idx_posts_user_created")
    posts.create_index([("news_id", ASCENDING), ("created_at", DESCENDING)], name="idx_posts_news_created")
    posts.create_index([("status", ASCENDING), ("created_at", DESCENDING)], name="idx_posts_status_created")
    posts.create_index([("content", "text")], name="idx_posts_content_text")
