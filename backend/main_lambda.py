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

from mangum import Mangum  # type: ignore[import-untyped]

# Re-export the FastAPI app from the shared main module
from backend.main import app  # noqa: F401  (lifespan hooks included)

# Lambda handler — the name "handler" is referenced in the Lambda config
handler = Mangum(app, lifespan="on")
