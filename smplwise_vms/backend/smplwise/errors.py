"""Error model shared by every endpoint (MASTER_SPEC ch. 32): code, user_message, retryable,
correlation_id and non-sensitive details. Status codes keep forbidden / unsupported / timeout /
no_recording / partial_coverage / stale_revision / resource_exhausted apart.

I18N-BACKEND-2490: `user_message` follows the requesting user's interface language (`ui.lang`, smplwise/i18n.py). The `code` stays the
machine word a screen keys on; the words are chosen when the envelope is answered (main.py's handlers), in this order:
  1. a `Msg` user_message (a catalogue key + params; this module's helpers, the setup wizard, the readiness report, capabilities)
     is rendered in the user's language;
  2. otherwise an English user gets `details.message_en` when the raising code put one there (elevators, temperature, insights, ...);
  3. (I18N-REST-2520) otherwise the English of a constant Hebrew text from the table of smplwise/error_text.py (keyed by the Hebrew);
  4. otherwise the Hebrew message as raised. No requesting user (a refusal before sign-in, a background job) = Hebrew.
I18N-RUNTIME-ERRORS-2520: a text built at run time is a `Tpl` (smplwise/error_text.py: a Hebrew template + params, English template
from a table) and is rendered as any `Msg` (step 1); a `Msg` inside `details` (a per-field `problems[].message`, a family's own
message list) is rendered in the same language, so a refusal's details never mix Hebrew into an English answer.
The Hebrew answer is byte for byte what it was before."""
from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from .error_text import english as _table_english
from .i18n import DEFAULT_LANG, Msg, localize, register, t

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
        return (isinstance(self.user_message, Msg) or isinstance((self.details or {}).get("message_en"), str)
                or _table_english(self.user_message) is not None or _has_msg(self.details))

    def message_in(self, lang: str) -> Any:
        """`user_message` in `lang` (I18N-BACKEND-2490, the order in this module's docstring)."""
        if isinstance(self.user_message, Msg):
            return self.user_message.render(lang)
        if lang == "en":
            en = (self.details or {}).get("message_en")
            if isinstance(en, str) and en:
                return en
            en = _table_english(self.user_message)
            if en:
                return en
        return self.user_message

    def payload(self, correlation_id: str, lang: str = DEFAULT_LANG) -> dict[str, Any]:
        return {
            "code": self.code,
            "user_message": self.message_in(lang),
            "retryable": self.retryable,
            "correlation_id": correlation_id,
            "details": self.details if lang == DEFAULT_LANG or not _has_msg(self.details) else localize(self.details, lang),
        }


def _has_msg(value: Any, depth: int = 0) -> bool:
    """True when a `Msg` is somewhere inside `value` (dict values, list / tuple items; a few levels deep)."""
    if isinstance(value, Msg):
        return True
    if depth > 4:
        return False
    if isinstance(value, dict):
        return any(_has_msg(v, depth + 1) for v in value.values())
    if isinstance(value, (list, tuple)):
        return any(_has_msg(v, depth + 1) for v in value)
    return False


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
    names each field and its constraint in the requester's language (Hebrew by default); the raw errors stay in details for a developer.

    ADR-019 (Step 0, item 4): `details.fields` (each field once, in the order of the errors) and `details.problems`
    (`{field, code, message}`: the pydantic error type and the constraint text in the same language) are derived from the same list,
    so a screen reads a refused body through the one field reader (`fieldsOf` / `problemsOf` in frontend/src/api/client.ts)."""
    constraints, unknown, prefix = _VALIDATION_TEXT.get(lang) or _VALIDATION_TEXT[DEFAULT_LANG]
    parts: list[str] = []
    raw: list[dict[str, Any]] = []
    problems: list[dict[str, str]] = []
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
        problems.append({"field": field, "code": str(e.get("type") or "invalid"), "message": what})
    # ADR-019 Step 0 item 4: the canonical field keys next to the raw list (additive - `errors` stays for a developer)
    details = {"errors": raw, "fields": _unique(p["field"] for p in problems), "problems": problems}
    return {"code": "validation", "user_message": prefix + " · ".join(parts), "retryable": False, "correlation_id": correlation_id, "details": details}


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


def _unique(names: Iterable[Any]) -> list[str]:
    """Each name once, in first-seen order."""
    return list(dict.fromkeys(str(n) for n in names))


def _problems(problems: Iterable[dict[str, Any]] | None) -> list[dict[str, str]]:
    """`{field, code, message?}` with string values; a missing / None message is left out."""
    out: list[dict[str, str]] = []
    for p in problems or ():
        one = {"field": str(p["field"]), "code": str(p["code"])}
        if p.get("message") is not None:
            # a Msg stays one (its value is the same Hebrew; the envelope renders it in the reader's language)
            one["message"] = p["message"] if isinstance(p["message"], Msg) else str(p["message"])
        out.append(one)
    return out


def field_error(message: str, fields: Iterable[str] = (), *, problems: Iterable[dict[str, Any]] | None = None, code: str = "validation",
                status: int = 422, legacy: dict[str, Any] | None = None, extra: dict[str, Any] | None = None,
                cls: type[ApiError] = ApiError) -> ApiError:
    """ADR-019 (Step 0, item 2): a refusal about one or more input fields, in the one field-error envelope (D1).

    `details.fields` lists the field names (dotted paths of the request model, never a Hebrew label), each once - the fields of
    `problems` are added in their order; `details.problems` is `[{field, code, message?}]` when the caller has per-field reasons.
    `legacy` is the key a family sent before its migration (`{"field": "to"}`, `{"key": ...}`), sent next to the canonical ones
    until its readers moved (ADR-019 Step 1 (d)); `extra` holds the endpoint's own details (`message_en`, limits, `reason`, ...),
    which are not part of the decision. Neither may carry `fields` / `problems`: the canonical keys are this helper's.
    `cls` is the family's own `ApiError` subclass (`PresenceError`) where a router catches that class (ADR019-FAMILY2-2500)."""
    for name, part in (("legacy", legacy), ("extra", extra)):
        if part and ("fields" in part or "problems" in part):
            raise ValueError(f"field_error: `{name}` must not carry the canonical keys")
    probs = _problems(problems)
    details: dict[str, Any] = {**(legacy or {}), **(extra or {}), "fields": _unique([*fields, *(p["field"] for p in probs)])}
    if probs:
        details["problems"] = probs
    return cls(status, code, message, details=details)


class ServiceInvalid(ValueError):
    """The common base of the services' validation errors - CR-CORE-HELPERS-2438 (code review 2026-11-13, 04:F16 step one).

    Today 23 classes in five shapes (`(message, field, code)`, `(field, code)`, `(field, message)`, `(code, fields)`, `(fields)`,
    `(key)`, `(code, message, message_en, details)`) are translated by 53 router `except ...Invalid` blocks, each with its own
    mapping to the 422 envelope. This base gives them one shape - `code`, `fields`, `message`, `details` - and one `to_api_error()`.
    A class that adopts it keeps its own constructor (it sets the attributes it has; the class defaults cover the rest).
    ADR-019 (ADR019-STEP0-2500): the routers raise `to_api_error()`, which answers the canonical `details.fields` (and `problems`
    for a class with a per-field reason, `field_code`); a family's legacy key (`details.field`, `details.key`) is passed as
    `legacy=` until its readers moved - envelope keys are removed only with the ADR's per-family step."""

    status = 422
    code = "validation"
    message = ""
    fields: tuple[str, ...] | list[str] = ()
    details: dict[str, Any] | None = None
    # ADR-019: the per-field reason of a class whose `code` says what is wrong with the field (`format`, `unknown`, ...) rather than
    # being the envelope code; when set, `api_details()` adds `problems` ({field, code} per named field).
    field_code: str | None = None

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

    def __str__(self) -> str:
        """As before (the message the error was raised with); a `Msg` message stays a `Msg` (the same Hebrew value), so a router that
        answers `str(exc)` keeps its English (I18N-RUNTIME-ERRORS-2520)."""
        if len(self.args) == 1 and isinstance(self.args[0], Msg):
            return self.args[0]
        return super().__str__()

    def field_problems(self) -> list[dict[str, str]]:
        """ADR-019 D1 `details.problems`: one `{field, code}` per named field when the class carries a per-field reason
        (`field_code`); [] otherwise."""
        if not self.field_code:
            return []
        return [{"field": str(f), "code": str(self.field_code)} for f in self.fields]

    def api_details(self) -> dict[str, Any]:
        """The envelope's `details`: the error's own details, `fields` when it names any, and `problems` when it has per-field
        reasons (ADR-019 Step 0, item 2)."""
        out = dict(self.details or {})
        if self.fields:
            out.setdefault("fields", list(self.fields))
            problems = self.field_problems()
            if problems:
                out.setdefault("problems", problems)
        return out

    def to_api_error(self, message: str | None = None, *, status: int | None = None, code: str | None = None,
                     legacy: dict[str, Any] | None = None, extra: dict[str, Any] | None = None) -> ApiError:
        """The ApiError a router raises for this error: its status (422 unless the class or the instance says otherwise), its code
        (`code` overrides it where the class's own code is a per-field reason and the endpoint answers another), `message` when the
        router has the user-facing text (else the error's own message), and `api_details()`. ADR-019 Step 1: `legacy` is the
        family's pre-migration key (`{"field": ...}`), sent next to the canonical ones until its readers moved; `extra` holds the
        endpoint's own details (`message_en`, ...). The keys of `api_details()` win over both."""
        details = {**(legacy or {}), **(extra or {}), **self.api_details()}
        return ApiError(status or self.status, code or self.code, message or self.message or str(self), details=details)
