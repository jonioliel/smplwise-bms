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


_CONSTRAINT_HE = {
    "missing": "שדה חובה",
    "greater_than_equal": "לפחות {ge}",
    "greater_than": "גדול מ־{gt}",
    "less_than_equal": "לכל היותר {le}",
    "less_than": "קטן מ־{lt}",
    "string_too_long": "ארוך מדי (עד {max_length} תווים)",
    "string_too_short": "קצר מדי (לפחות {min_length} תווים)",
    "string_pattern_mismatch": "לא בפורמט הצפוי",
    "int_parsing": "חייב להיות מספר שלם",
    "int_type": "חייב להיות מספר שלם",
    "float_parsing": "חייב להיות מספר",
    "bool_parsing": "חייב להיות כן/לא",
    "enum": "לא מהרשימה",
    "literal_error": "לא מהרשימה",
    "json_invalid": "JSON לא תקין",
    "extra_forbidden": "שדה לא מוכר",
}


def validation_payload(errors: list[dict[str, Any]], correlation_id: str) -> dict[str, Any]:
    """The error envelope for a request pydantic rejected. FastAPI's default is a bare {"detail": [...]} the screens
    cannot read - the settings save used to fail without a word on an out-of-range value (0.1.80). The user message
    names each field and its constraint in Hebrew; the raw errors stay in details for a developer."""
    parts: list[str] = []
    raw: list[dict[str, Any]] = []
    for e in errors:
        loc = [str(p) for p in e.get("loc", ()) if p not in ("body", "query", "path", "header")]
        field = ".".join(loc) or "body"
        ctx = {k: (v if isinstance(v, (str, int, float, bool)) or v is None else str(v)) for k, v in (e.get("ctx") or {}).items()}
        template = _CONSTRAINT_HE.get(str(e.get("type", "")))
        try:
            what = template.format(**ctx) if template else str(e.get("msg") or "ערך לא תקין")
        except (KeyError, IndexError):
            what = str(e.get("msg") or "ערך לא תקין")
        parts.append(f"{field}: {what}")
        raw.append({"loc": loc, "type": e.get("type"), "msg": e.get("msg"), "ctx": ctx})
    return {"code": "validation", "user_message": "ערך לא תקין — " + " · ".join(parts), "retryable": False, "correlation_id": correlation_id, "details": {"errors": raw}}


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
