"""Error model shared by every endpoint (MASTER_SPEC ch. 32): code, user_message, retryable,
correlation_id and non-sensitive details. Status codes keep forbidden / unsupported / timeout /
no_recording / partial_coverage / stale_revision / resource_exhausted apart.

I18N-BACKEND-2490: `user_message` follows the requesting user's interface language (`ui.lang`, smplwise/i18n.py). The `code` stays the
machine word a screen keys on; the words are chosen when the envelope is answered (main.py's handlers), in this order:
  1. a `Msg` user_message (a catalogue key + params; this module's helpers, the setup wizard, the readiness report, capabilities)
     is rendered in the user's language;
  2. otherwise an English user gets `details.message_en` when the raising code put one there (elevators, temperature, insights, ...);
  3. otherwise the Hebrew message as raised. No requesting user (a refusal before sign-in, a background job) = Hebrew.
The Hebrew answer is byte for byte what it was before."""
from __future__ import annotations

from typing import Any

from .i18n import DEFAULT_LANG, Msg, register, t

register("error", {
    "forbidden": ("אין הרשאה לפעולה זו בהיקף המבוקש.", "You do not have permission for this action in the requested scope."),
    "not_found": ("המשאב לא נמצא.", "The resource was not found."),
    # main.py's handlers
    "database_busy": ("המערכת עמוסה כרגע והפעולה לא הושלמה. יש לנסות שוב בעוד רגע.", "The system is busy right now and the action was not completed. Try again in a moment."),
    "storage_full": ("אחסון התוסף מלא, ולכן לא ניתן לשמור. יש לפנות מקום בדיסק של התוסף.", "The add-on storage is full, so nothing can be saved. Free up space on the add-on's disk."),
    "internal_error": ("אירעה שגיאה בלתי צפויה. יש לנסות שוב; אם השגיאה חוזרת, יש לפנות לתמיכה עם מזהה הבקשה.",
                       "An unexpected error occurred. Try again; if it happens again, contact support with the request ID."),
})


class ApiError(Exception):
    def __init__(self, status: int, code: str, user_message: str, *, retryable: bool = False, details: dict[str, Any] | None = None):
        super().__init__(code)
        self.status = status
        self.code = code
        self.user_message = user_message
        self.retryable = retryable
        self.details = details or {}

    def translatable(self) -> bool:
        """True when the message has words in another language (a `Msg`, or `details.message_en`): only then is the requester's
        language worth reading."""
        return isinstance(self.user_message, Msg) or isinstance((self.details or {}).get("message_en"), str)

    def message_in(self, lang: str) -> Any:
        """`user_message` in `lang` (I18N-BACKEND-2490, the order in this module's docstring)."""
        if isinstance(self.user_message, Msg):
            return self.user_message.render(lang)
        if lang == "en":
            en = (self.details or {}).get("message_en")
            if isinstance(en, str) and en:
                return en
        return self.user_message

    def payload(self, correlation_id: str, lang: str = DEFAULT_LANG) -> dict[str, Any]:
        return {
            "code": self.code,
            "user_message": self.message_in(lang),
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


# I18N-BACKEND-2490: the constraint texts of a refused request body, per interface language (the field names stay the model's)
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
_CONSTRAINT_EN = {
    "missing": "Required field",
    "greater_than_equal": "At least {ge}",
    "greater_than": "Greater than {gt}",
    "less_than_equal": "At most {le}",
    "less_than": "Less than {lt}",
    "string_too_long": "Too long (up to {max_length} characters)",
    "string_too_short": "Too short (at least {min_length} characters)",
    "string_pattern_mismatch": "Not in the expected format",
    "int_parsing": "Must be a whole number",
    "int_type": "Must be a whole number",
    "float_parsing": "Must be a number",
    "bool_parsing": "Must be yes or no",
    "enum": "Not from the list",
    "literal_error": "Not from the list",
    "json_invalid": "Invalid JSON",
    "extra_forbidden": "Unknown field",
}
# (constraint table, the fallback for an unknown constraint, the message prefix)
_VALIDATION_TEXT = {
    "he": (_CONSTRAINT_HE, "ערך לא תקין", "ערך לא תקין — "),
    "en": (_CONSTRAINT_EN, "Invalid value", "Invalid value — "),
}


def validation_payload(errors: list[dict[str, Any]], correlation_id: str, lang: str = DEFAULT_LANG) -> dict[str, Any]:
    """The error envelope for a request pydantic rejected. FastAPI's default is a bare {"detail": [...]} the screens
    cannot read - the settings save used to fail without a word on an out-of-range value (0.1.80). The user message
    names each field and its constraint in the requester's language (Hebrew by default); the raw errors stay in details for a developer."""
    constraints, unknown, prefix = _VALIDATION_TEXT.get(lang) or _VALIDATION_TEXT[DEFAULT_LANG]
    parts: list[str] = []
    raw: list[dict[str, Any]] = []
    for e in errors:
        loc = [str(p) for p in e.get("loc", ()) if p not in ("body", "query", "path", "header")]
        field = ".".join(loc) or "body"
        ctx = {k: (v if isinstance(v, (str, int, float, bool)) or v is None else str(v)) for k, v in (e.get("ctx") or {}).items()}
        template = constraints.get(str(e.get("type", "")))
        try:
            what = template.format(**ctx) if template else str(e.get("msg") or unknown)
        except (KeyError, IndexError):
            what = str(e.get("msg") or unknown)
        parts.append(f"{field}: {what}")
        raw.append({"loc": loc, "type": e.get("type"), "msg": e.get("msg"), "ctx": ctx})
    return {"code": "validation", "user_message": prefix + " · ".join(parts), "retryable": False, "correlation_id": correlation_id, "details": {"errors": raw}}


def unauthenticated(code: str, message: str) -> ApiError:
    return ApiError(401, code, message)


def forbidden(message: str = t("error.forbidden"), **details: Any) -> ApiError:
    return ApiError(403, "forbidden", message, details=details)


def not_found(what: str = t("error.not_found")) -> ApiError:
    return ApiError(404, "not_found", what)


def conflict(code: str, message: str, **details: Any) -> ApiError:
    return ApiError(409, code, message, details=details)


def validation(message: str, **details: Any) -> ApiError:
    return ApiError(422, "validation", message, details=details)


class ServiceInvalid(ValueError):
    """The common base of the services' validation errors - CR-CORE-HELPERS-2438 (code review 2026-11-13, 04:F16 step one).

    Today 23 classes in five shapes (`(message, field, code)`, `(field, code)`, `(field, message)`, `(code, fields)`, `(fields)`,
    `(key)`, `(code, message, message_en, details)`) are translated by 53 router `except ...Invalid` blocks, each with its own
    mapping to the 422 envelope. This base gives them one shape - `code`, `fields`, `message`, `details` - and one `to_api_error()`.
    It is additive: nothing subclasses it in this branch. A class that adopts it later keeps its own constructor (it sets the
    attributes it has; the class defaults cover the rest) and overrides `api_details()` when its endpoint's envelope carries
    `details.field` or `details.key` instead of `details.fields` - envelope keys change only with a contract decision."""

    status = 422
    code = "validation"
    message = ""
    fields: tuple[str, ...] | list[str] = ()
    details: dict[str, Any] | None = None

    def __init__(self, message: str = "", *, code: str | None = None, fields: Any = (), details: dict[str, Any] | None = None,
                 status: int | None = None) -> None:
        super().__init__(message or code or self.code)
        if code is not None:
            self.code = code
        self.message = message
        self.fields = [str(f) for f in fields] if fields else []
        self.details = dict(details) if details else {}
        if status is not None:
            self.status = status

    def api_details(self) -> dict[str, Any]:
        """The envelope's `details`: the error's own details, and `fields` when it names any."""
        out = dict(self.details or {})
        if self.fields:
            out.setdefault("fields", list(self.fields))
        return out

    # test-only: no product caller; used by tests/test_be_small_unify_2440.py, tests/test_be_twins_2440.py (+1 more). Kept (owner decision O10 a, CR-BE-DEAD-CODE-2442).
    def to_api_error(self, message: str | None = None, *, status: int | None = None) -> ApiError:
        """The ApiError a router raises for this error: its status (422 unless the class or the instance says otherwise), its code,
        `message` when the router has the user-facing text (else the error's own message), and `api_details()`."""
        return ApiError(status or self.status, self.code, message or self.message or str(self), details=self.api_details())
