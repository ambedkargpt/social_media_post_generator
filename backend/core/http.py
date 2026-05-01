import logging
import time
import uuid
from dataclasses import dataclass

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


logger = logging.getLogger("backend.http")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO)


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
            content={"detail": "Validation failed.", "errors": exc.errors(), "request_id": request_id},
            headers={"X-Request-Id": request_id},
        )
