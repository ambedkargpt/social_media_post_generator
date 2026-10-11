from pymongo import MongoClient
from pymongo.errors import PyMongoError

from backend.core.config import settings


_uri = settings.mongodb_uri or "mongodb://localhost:27017"
_mongo_client = MongoClient(_uri, serverSelectionTimeoutMS=2000)
db = _mongo_client[settings.mongodb_database or "ambedkargpt"]


def ping_database() -> bool:
    """Return True when MongoDB is reachable."""
    try:
        _mongo_client.admin.command("ping")
        return True
    except PyMongoError:
        return False
