"""Accounts a user has connected on another platform.

One row per (user, provider), so adding Twitter or LinkedIn later is a new
`provider` value rather than a new collection, a new signup field or a new
table. Nothing here is platform-specific: the provider decides what the tokens
mean, this only stores them.

The refresh token arrives already encrypted — see backend.core.token_crypto.
Nothing in this module ever sees it in the clear.
"""
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId

from backend.db.mongo import db


class IntegrationsRepository:
    def __init__(self) -> None:
        self.collection = db["user_integrations"]

    def upsert(
        self,
        *,
        user_id: str,
        provider: str,
        account_id: str,
        account_handle: str,
        refresh_token_enc: str,
        scopes: list[str],
    ) -> dict:
        now = datetime.now(timezone.utc)
        query = {"user_id": ObjectId(user_id), "provider": provider}
        self.collection.update_one(
            query,
            {
                "$set": {
                    "account_id": account_id,
                    "account_handle": account_handle,
                    "refresh_token_enc": refresh_token_enc,
                    "scopes": scopes,
                    "connected_at": now,
                    "updated_at": now,
                    # Reconnecting after a disconnect clears the tombstone
                    # rather than leaving a row that reads as revoked.
                    "revoked_at": None,
                },
                "$setOnInsert": {
                    "user_id": ObjectId(user_id),
                    "provider": provider,
                    "created_at": now,
                },
            },
            upsert=True,
        )
        return self.collection.find_one(query)

    def get(self, user_id: str, provider: str) -> dict | None:
        """The live connection, or None. A revoked row is not a connection."""
        return self.collection.find_one(
            {"user_id": ObjectId(user_id), "provider": provider, "revoked_at": None}
        )

    def list_by_user(self, user_id: str) -> list[dict]:
        return list(
            self.collection.find({"user_id": ObjectId(user_id), "revoked_at": None})
        )

    def mark_revoked(self, user_id: str, provider: str) -> None:
        """
        Disconnect. The token text is dropped, not just flagged: a row that
        still carries a usable token is not disconnected in any sense the user
        would recognise.
        """
        self.collection.update_one(
            {"user_id": ObjectId(user_id), "provider": provider},
            {
                "$set": {
                    "revoked_at": datetime.now(timezone.utc),
                    "refresh_token_enc": None,
                }
            },
        )

    def record_refresh_failure(self, user_id: str, provider: str, reason: str) -> None:
        """
        A refresh token the platform no longer accepts — the user revoked our
        access on their side. Treated as a disconnect, because that is what it
        is; the alternative is a connection that silently never works.
        """
        self.collection.update_one(
            {"user_id": ObjectId(user_id), "provider": provider},
            {
                "$set": {
                    "revoked_at": datetime.now(timezone.utc),
                    "refresh_token_enc": None,
                    "revoked_reason": reason,
                }
            },
        )

    def public_view(self, doc: dict[str, Any] | None) -> dict | None:
        """What the API may return: never the token, encrypted or otherwise."""
        if not doc:
            return None
        return {
            "provider": doc.get("provider"),
            "account_handle": doc.get("account_handle"),
            "connected_at": doc.get("connected_at"),
            "scopes": doc.get("scopes") or [],
        }
