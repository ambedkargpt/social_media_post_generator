"""
AWS Lambda entry point for AmbedkarGPT API.

Wraps the existing FastAPI ``app`` with Mangum so AWS Lambda can invoke it
as a standard ASGI application.  No other code changes are needed — all
routes, middleware, lifespan hooks, and auth logic work identically.

Usage (Lambda function configuration):
  Handler:  backend.main_lambda.handler
  Runtime:  Container image (Python 3.11)
  Memory:   1024 MB
  Timeout:  60 s

Environment variables expected (loaded from SSM by Lambda on startup):
  OPENAI_API_KEY, GEMINI_API_KEY, PINECONE_API_KEY, PINECONE_INDEX_NAME,
  PINECONE_NAMESPACE, MONGODB_URI, JWT_SECRET, S3_BUCKET, S3_ARTIFACT_PREFIX,
  APP_ENV=production

Cold-start behaviour:
  The FastAPI lifespan hook pre-warms the RAG stack in a background thread
  (same as the Gunicorn/EC2 path).  On Lambda the background thread runs
  during the first invocation; subsequent invocations on the same instance
  hit the in-memory _RAG_CACHE with no overhead.
"""

import logging
import os

from mangum import Mangum  # type: ignore[import-untyped]

# Re-export the FastAPI app from the shared main module
from backend.main import app  # noqa: F401  (lifespan hooks included)

# Let our own INFO logs reach CloudWatch.
#
# The Lambda runtime leaves the root logger at WARNING, so every
# logger.info() in this codebase was discarded before it was written —
# the [generate], [retrieval] and [research] lines that exist precisely to
# explain a request never appeared in production. A 503 was diagnosed from
# the outside over two days that one of those lines would have named.
#
# Only the `backend` logger is raised, not the root: pymongo, httpx,
# pinecone and botocore at INFO would bury the lines this is for. LOG_LEVEL
# overrides when a run needs more or less.
logging.getLogger("backend").setLevel(
    getattr(logging, (os.getenv("LOG_LEVEL") or "INFO").upper(), logging.INFO)
)

_asgi = Mangum(app, lifespan="on")


# Lambda handler — the name "handler" is referenced in the Lambda config
def handler(event, context):
    """
    Mangum, with the request path put back the way it was sent.

    A Lambda function URL normalises `requestContext.http.path` and drops the
    trailing slash; `rawPath` keeps it. Mangum reads the normalised one. So a
    request for /api/v1/news/ reaches FastAPI as /api/v1/news, FastAPI redirects
    to add the slash, the function URL strips it again, and the browser follows
    that round until it gives up - a 307 loop on every route declared with a
    trailing slash, which is most of ours.

    API Gateway sends the two in agreement, so this changes nothing there. It
    exists so the function URL can be used at all, and the function URL is worth
    having because it has no 30-second ceiling: post generation with inline web
    research takes about 47 seconds, which the gateway can never deliver.
    """
    raw = event.get("rawPath")
    if raw:
        http = event.setdefault("requestContext", {}).setdefault("http", {})
        if http.get("path") != raw:
            http["path"] = raw
    return _asgi(event, context)
