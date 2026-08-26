import logging
import os
import time
import uuid
from dataclasses import dataclass

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


logger = logging.getLogger("backend.http")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO)


def _validation_detail(errors: list[dict]) -> str:
    """
    One readable sentence naming the field that failed and why.

    `detail` used to be the constant "Validation failed." with the real reason
    in a sibling `errors` array that no caller read. Every form in the app
    therefore reported the same thing for a too-short message, a malformed
    email and a missing field alike — the contact form said "Validation
    failed." for a 7-character message against a 10-character minimum, and
    nothing on screen said which field or what the minimum was.

    The `errors` array is still returned unchanged for machine callers.
    """
    if not errors:
        return "Validation failed."

    parts: list[str] = []
    for err in errors[:4]:                       # a whole form's worth is noise
        loc = [str(p) for p in err.get("loc", ()) if p not in {"body", "query", "path"}]
        field = loc[-1].replace("_", " ") if loc else "request"
        msg = str(err.get("msg") or "is invalid").strip()
        # Pydantic prefixes custom validators; the prefix means nothing here.
        for prefix in ("Value error, ", "Assertion failed, "):
            if msg.startswith(prefix):
                msg = msg[len(prefix):]
        parts.append(f"{field}: {msg[:1].lower() + msg[1:] if msg else 'is invalid'}")

    detail = "; ".join(parts)
    if len(errors) > 4:
        detail += f" (and {len(errors) - 4} more)"
    return detail


@dataclass
class ApiError:
    detail: str
    request_id: str


async def catch_http_exceptions(request: Request, call_next):
    request_id = request.headers.get("X-Request-Id") or str(uuid.uuid4())
    request.state.request_id = request_id
    started = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Unhandled request error request_id=%s path=%s", request_id, request.url.path)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error.", "request_id": request_id},
            headers={"X-Request-Id": request_id},
        )
    elapsed_ms = int((time.perf_counter() - started) * 1000)
    logger.info(
        "request_id=%s method=%s path=%s status=%s elapsed_ms=%s",
        request_id,
        request.method,
        request.url.path,
        getattr(response, "status_code", "unknown"),
        elapsed_ms,
    )
    response.headers["X-Request-Id"] = request_id
    return response


def register_http_layer(app: FastAPI) -> None:
    _raw = os.getenv("CORS_ORIGINS", "").strip()
    if _raw:
        origins = [o.strip() for o in _raw.split(",") if o.strip()]
    else:
        app_env = os.getenv("APP_ENV", "development").lower()
        if app_env in {"production", "prod"}:
            logger.error("CORS_ORIGINS is not set in production — requests will be blocked. Set CORS_ORIGINS env var.")
            origins = []  # block all in production if not configured
        else:
            logger.warning("CORS_ORIGINS not set — defaulting to wildcard '*' (dev only)")
            origins = ["*"]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.middleware("http")(catch_http_exceptions)

    @app.exception_handler(StarletteHTTPException)
    async def _http_exc_handler(request: Request, exc: StarletteHTTPException):
        request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": str(exc.detail), "request_id": request_id},
            headers={"X-Request-Id": request_id},
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_exc_handler(request: Request, exc: RequestValidationError):
        request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
        return JSONResponse(
            status_code=422,
            content={
                "detail": _validation_detail(exc.errors()),
                "errors": exc.errors(),
                "request_id": request_id,
            },
            headers={"X-Request-Id": request_id},
        )
