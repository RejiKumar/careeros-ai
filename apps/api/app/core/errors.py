"""Typed application errors and safe exception handlers.

Never expose internal details or private data in error responses.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class ErrorDetail(BaseModel):
    code: str
    message: str
    request_id: str | None = None


class AppError(Exception):
    """Domain error with a stable machine-readable code and HTTP status."""

    def __init__(self, *, code: str, message: str, status_code: int) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


def _error_response(error: ErrorDetail, status_code: int) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"error": error.model_dump()})


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    detail = ErrorDetail(code=exc.code, message=exc.message, request_id=_request_id(request))
    response = _error_response(detail, exc.status_code)
    if exc.status_code == status.HTTP_401_UNAUTHORIZED:
        response.headers["WWW-Authenticate"] = "Bearer"
    return response


async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    detail = ErrorDetail(
        code="validation_error",
        message="One or more request fields are invalid.",
        request_id=_request_id(request),
    )
    # Drop pydantic's ctx (may hold exception objects) so responses stay JSON-safe.
    fields = [{k: v for k, v in error.items() if k != "ctx"} for error in exc.errors()]
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"error": detail.model_dump(), "fields": fields},
    )


async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    # Deliberately generic: never leak stack traces or request contents.
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    detail = ErrorDetail(
        code="internal_error",
        message="An unexpected error occurred.",
        request_id=_request_id(request),
    )
    return _error_response(detail, status.HTTP_500_INTERNAL_SERVER_ERROR)


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(Exception, unhandled_error_handler)


def _request_id(request: Request) -> str | None:
    return request.headers.get("X-Request-Id")
