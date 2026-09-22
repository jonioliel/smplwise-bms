"""Error model shared by every endpoint (MASTER_SPEC ch. 32): code, user_message, retryable,
correlation_id and non-sensitive details. Status codes keep forbidden / unsupported / timeout /
no_recording / partial_coverage / stale_revision / resource_exhausted apart."""
from __future__ import annotations

from typing import Any


class ApiError(Exception):
    def __init__(self, status: int, code: str, user_message: str, *, retryable: bool = False, details: dict[str, Any] | None = None):
        super().__init__(code)
        self.status = status
        self.code = code
        self.user_message = user_message
        self.retryable = retryable
        self.details = details or {}

    def payload(self, correlation_id: str) -> dict[str, Any]:
        return {
            "code": self.code,
            "user_message": self.user_message,
            "retryable": self.retryable,
            "correlation_id": correlation_id,
            "details": self.details,
        }


def reason_of(exc: BaseException) -> str:
    """Short reason for a screen or a status field when a device call fails: an ApiError names its code and
    the underlying error (`source_unavailable · ConnectTimeout`); `type(exc).__name__` on one is only the
    word "ApiError", which is what the storage and health screens used to show."""
    if isinstance(exc, ApiError):
        inner = (exc.details or {}).get("error")
        return f"{exc.code} · {inner}" if inner else exc.code
    return type(exc).__name__


def unauthenticated(code: str, message: str) -> ApiError:
    return ApiError(401, code, message)


def forbidden(message: str = "אין הרשאה לפעולה זו בהיקף המבוקש.", **details: Any) -> ApiError:
    return ApiError(403, "forbidden", message, details=details)


def not_found(what: str = "המשאב לא נמצא.") -> ApiError:
    return ApiError(404, "not_found", what)


def conflict(code: str, message: str, **details: Any) -> ApiError:
    return ApiError(409, code, message, details=details)


def validation(message: str, **details: Any) -> ApiError:
    return ApiError(422, "validation", message, details=details)
