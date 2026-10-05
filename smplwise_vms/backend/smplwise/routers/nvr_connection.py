"""The NVR connection in Arx (CR-022 section 6.2): the vendor catalogue, the stored connection (GET / PUT / DELETE), the
read-only connection test and the add-on restart that applies a change.

Every route: `system.configure` at installation scope (owner decision D5; the system administrator only - distinct from
CR-020's `nvr.configure`, which governs camera writes on the NVR itself), checked FIRST - the 401 / 403 and its audit row
come before the body is even parsed and before any device I/O. Bodies are strict (`extra=forbid`), small, JSON only. None of
these routes is reachable on the remote channel (remote_channel.BLOCKED_ON_REMOTE). The password is write-only: no answer,
audit row, log line or error carries it or its ciphertext. A save or a removal never changes the running process: it answers
`restart_required` and `/me` / `/health` report `connection_pending_restart` until the next start (section 8).

CR-024 (multi-NVR): the handlers take a recorder id. These `/nvr/connection*` paths are the first recorder's (`nvr-1`,
unchanged); routers/recorders.py serves `/recorders/{id}/connection*` for every recorder through the same functions. Only
the first recorder may fall back to the legacy connection the process started with; a further recorder has its row or nothing."""
from __future__ import annotations

import json
import logging
import re
import sqlite3
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from ..audit import audit
from ..auth import current_principal, get_conn, read_gate, settings_of
from ..config import DEV_NVR_PLACEHOLDER, Settings
from ..db import unlocked
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, require
from ..recorder_scope import PRIMARY, settings_for
from ..services import addon_restart, connection_probe, connection_store, update_runs
from ..services.recorders import registry

log = logging.getLogger("smplwise.nvr_connection")
router = APIRouter()

PERMISSION = "system.configure"
BODY_MAX = 16 * 1024
SAVE_WORD = "שמור"     # typed confirmation of a save whose test could not reach the NVR (D6)
REMOVE_WORD = "הסר"    # typed confirmation of "Remove NVR" (D7)
UNTESTED_OK = ("source_unavailable", "timeout")  # the only failures that may be saved untested


class _Base(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    vendor: str = Field(default=registry.DEFAULT_VENDOR, max_length=32)
    host: str | None = Field(default=None, max_length=400)  # the 253 limit is checked by valid_host (422 host_invalid)
    http_port: int | None = None
    rtsp_port: int | None = None
    username: str | None = Field(default=None, max_length=64, alias="user")  # `user`: the 0.1.71 body key, still accepted
    password: str | None = Field(default=None, max_length=128)
    keep_password: bool = True  # an absent password keeps the stored one (as in 0.1.71)
    extra: dict[str, Any] | None = None


class TestIn(_Base):
    use_stored_password: bool = False


class SaveIn(_Base):
    save_untested: bool = False
    confirm_text: str | None = Field(default=None, max_length=32)
    if_revision: int | None = None  # required (422 revision_required); re-checked after the probe, under the write lock (F10)


class RemoveIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    confirm_text: str = Field(max_length=32)
    if_revision: int | None = None  # required (422 revision_required); checked under the write lock (review F10)


class RestartIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    confirm: bool


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


async def _raw_body(request: Request) -> bytes:
    return await request.body()


def _parse(request: Request, raw: bytes, model: type[BaseModel]) -> Any:
    """Parsed only AFTER the permission check (the 403 and its audit row never depend on the body)."""
    if len(raw) > BODY_MAX:
        raise ApiError(413, "payload_too_large", "גוף הבקשה גדול מדי.", details={"max_bytes": BODY_MAX})
    media = (request.headers.get("content-type") or "").split(";", 1)[0].strip().lower()
    if raw.strip() and media != "application/json":
        raise ApiError(415, "unsupported_media_type", "הבקשה חייבת להישלח כ־JSON (Content-Type: application/json).")
    try:
        data = json.loads(raw) if raw.strip() else {}
    except (ValueError, RecursionError):
        raise ApiError(422, "validation", "גוף הבקשה אינו JSON תקין.", details={"fields": ["body"]}) from None
    if not isinstance(data, dict):
        raise ApiError(422, "validation", "גוף הבקשה חייב להיות אובייקט JSON.", details={"fields": ["body"]})
    try:
        return model.model_validate(data)
    except ValidationError as exc:
        fields = sorted({".".join(str(p) for p in err["loc"]) or "body" for err in exc.errors()})
        raise ApiError(422, "validation", "הבקשה אינה תקינה: " + ", ".join(fields), details={"fields": fields}) from None


# review L7 (tests/test_raw_body_order.py): the raw-body routes check the permission on a READ connection (a refusal is audited
# aside), then read the body, and only then open the write connection
_admin_ro = read_gate(lambda conn, principal: require(conn, principal, PERMISSION, INSTALLATION))


def _restart_mode(settings: Settings) -> str:
    return "addon" if addon_restart.configured(settings) else "manual"


# ---------------------------------------------------------------- the view (never a secret)

def connection_view(conn: sqlite3.Connection, request: Request, rid: str = PRIMARY) -> dict[str, Any]:
    """`GET /nvr/connection`: the stored row (or, before any save, the legacy connection the process runs with). Keys of
    0.1.71 kept (`host`, `placeholder`, `http_port`, `rtsp_port`, `user`, `has_password`, `in_addon`). CR-024: `rid` names
    the recorder; a further recorder never shows the legacy connection."""
    settings = settings_for(settings_of(request), rid)
    row = connection_store.get_row(conn, rid)
    cams = connection_store.camera_count(conn, rid)
    common = {"pending_restart": connection_store.pending_restart(conn, settings, rid),
              "legacy_options_differ": bool(getattr(request.app.state, "legacy_options_differ", False)) if rid == PRIMARY else False,
              "in_addon": settings.in_addon, "restart": _restart_mode(settings), "cameras": cams, "recorder_id": rid}
    if row is not None:
        try:
            extra = json.loads(row["extra_json"] or "{}")
        except ValueError:
            extra = {}
        unreadable = not connection_store.readable(conn, settings, row)
        state = "unreadable" if unreadable else row["state"]
        if not unreadable and settings.nvr_connection_state == "refused" and settings.nvr_connection_revision == int(row["revision"]):
            state = "refused"  # review F5: the stored host failed the source policy when this process started
        return {"vendor": row["vendor"], "host": row["host"], "placeholder": False, "http_port": row["http_port"], "rtsp_port": row["rtsp_port"],
                "username": row["username"], "user": row["username"], "extra": extra, "has_password": bool(row["password_enc"]) and not unreadable,
                "state": state, "source": row["source"], "revision": int(row["revision"]), "updated_at": row["updated_at"], "updated_by": row["updated_by"],
                "vendor_locked": row["vendor"] != registry.NO_NVR and cams > 0, **common}
    if rid != PRIMARY:
        return {"vendor": None, "host": None, "placeholder": False, "http_port": None, "rtsp_port": None, "username": None, "user": None, "extra": {},
                "has_password": False, "state": "not_chosen", "source": None, "revision": None, "updated_at": None, "updated_by": None, "vendor_locked": False, **common}
    placeholder = settings.nvr_host == DEV_NVR_PLACEHOLDER
    host = None if placeholder else settings.nvr_host
    return {"vendor": registry.DEFAULT_VENDOR if host else None, "host": host, "placeholder": placeholder, "http_port": settings.nvr_http_port,
            "rtsp_port": settings.nvr_rtsp_port, "username": settings.nvr_user, "user": settings.nvr_user, "extra": {}, "has_password": bool(settings.nvr_password),
            "state": "not_chosen" if not host else ("ok" if settings.nvr_password else "incomplete"), "source": "legacy" if host else None, "revision": None,
            "updated_at": None, "updated_by": None, "vendor_locked": bool(host) and cams > 0, **common}


# ---------------------------------------------------------------- validation shared by test and save

def _validated(body: _Base) -> dict[str, Any]:
    vendor = body.vendor
    if vendor not in registry.SPEC_BY_ID or not registry.selectable(vendor):
        raise ApiError(422, "vendor_not_available", "סוג ה־NVR שנבחר אינו זמין.", details={"field": "vendor"})
    if vendor == registry.NO_NVR:
        return {"vendor": vendor}
    spec = registry.SPEC_BY_ID[vendor]
    host = (body.host or "").strip()
    if not connection_probe.valid_host(host):
        raise ApiError(422, "host_invalid", "הכתובת אינה תקינה: שם מארח או כתובת IP בלבד, בלי פרוטוקול, נתיב או פורט.", details={"field": "host"})
    ports = {}
    for name in ("http_port", "rtsp_port"):
        value = getattr(body, name)
        value = spec.default_ports.get(name) if value is None else value
        if not connection_probe.valid_port(value):
            raise ApiError(422, "port_invalid", "מספר הפורט אינו תקין (1-65535).", details={"field": name})
        ports[name] = value
    username = (body.username or "").strip()
    if not username:
        raise ApiError(422, "username_required", "יש להזין שם משתמש.", details={"field": "username"})
    if any(ord(ch) < 32 or 127 <= ord(ch) < 160 for ch in username):  # review F14: no control characters in a stored, displayed name
        raise ApiError(422, "username_invalid", "שם המשתמש מכיל תווים לא חוקיים.", details={"field": "username"})
    allowed_extra = {f.key for f in spec.fields} - {"host", "http_port", "rtsp_port", "username", "password"}
    extra = body.extra or {}
    if any(k not in allowed_extra for k in extra) or any(not isinstance(v, (str, int, bool)) or isinstance(v, str) and len(v) > 200 for v in extra.values()):
        raise ApiError(422, "extra_invalid", "שדה נוסף אינו מוכר לסוג ה־NVR הזה.", details={"field": "extra"})
    by_key = {f.key: f for f in spec.fields}
    extra = {k: _extra_value(by_key[k], v) for k, v in extra.items()}
    return {"vendor": vendor, "host": host, **ports, "username": username, "extra": {k: v for k, v in extra.items() if v is not None}}


_HEX64 = re.compile(r"[0-9a-f]{64}")
_TEXT_RULES: dict[str, Any] = {  # text extras with a known shape (security review Low: no 500 / no odd value reaches a device)
    "tls_pin": lambda v: _HEX64.fullmatch(v.lower().replace(":", "")) is not None,
    "poll_interval_s": lambda v: v.isdigit() and 1 <= int(v) <= 3600,
    "push_advertise_host": connection_probe.valid_host,
}


def _extra_value(f: Any, v: Any) -> Any:
    """One vendor extra checked against its field kind (port 1-65535, bool, a listed select value, text without control
    characters and, for known keys, of the right shape). Empty text = not set (None). 422 extra_invalid otherwise."""
    def bad() -> ApiError:
        return ApiError(422, "extra_invalid", "ערך לא תקין בשדה נוסף.", details={"field": f"extra.{f.key}"})

    if isinstance(v, str):
        v = v.strip()
        if v == "" and f.kind != "select":
            return None
    if f.kind == "port":
        if isinstance(v, bool) or not (isinstance(v, int) or (isinstance(v, str) and v.isdigit())) or not 1 <= int(v) <= 65535:
            raise bad()
        return int(v)
    if f.kind == "bool":
        if isinstance(v, bool):
            return v
        if isinstance(v, str) and v.lower() in ("true", "false"):
            return v.lower() == "true"
        raise bad()
    if f.kind == "select":
        allowed = {o[0] for o in getattr(f, "options", ())}
        if not isinstance(v, str) or v not in allowed:
            raise bad()
        return v
    if isinstance(v, bool) or not isinstance(v, (str, int)):
        raise bad()
    original, v = v, str(v)
    if any(ord(ch) < 32 or 127 <= ord(ch) < 160 for ch in v):
        raise bad()
    rule = _TEXT_RULES.get(f.key)
    if rule is not None and not rule(v):
        raise bad()
    return original if isinstance(original, int) else v


def _norm_host(host: str | None) -> str:
    return (host or "").strip().strip("[]").lower().rstrip(".")


def _stored_destination(settings: Settings, row: sqlite3.Row | None, rid: str = PRIMARY) -> tuple[Any, ...] | None:
    """Where the stored password is allowed to go: (vendor, host, http_port, rtsp_port) of the stored row, or - before any
    save - of the legacy connection the process runs with. None when nothing is stored."""
    if row is not None:
        if row["vendor"] == registry.NO_NVR or not row["host"]:
            return None
        try:
            stored_extra = json.loads(row["extra_json"] or "{}")
        except ValueError:
            stored_extra = {}
        return (row["vendor"], _norm_host(row["host"]), row["http_port"], row["rtsp_port"], *_transport(stored_extra))
    if rid != PRIMARY:  # CR-024: only the first recorder has a legacy connection
        return None
    host = settings.nvr_host
    if not host or host == DEV_NVR_PLACEHOLDER:
        return None
    return (registry.DEFAULT_VENDOR, _norm_host(host), settings.nvr_http_port, settings.nvr_rtsp_port, *_transport({}))


def _transport(extra: dict[str, Any] | None) -> tuple[Any, ...]:
    """Security review Low: how the password travels is part of its destination - scheme, HTTPS port and certificate mode.
    A stored password is not reused when a save moves it from HTTPS to plain HTTP, to another HTTPS port, or from a
    verified / pinned certificate to "trust any"."""
    e = extra or {}
    auth = str(e.get("auth") or "").lower()  # a changed auth method (e.g. to Basic) is a new destination too
    scheme = str(e.get("scheme") or "http").lower()
    if scheme != "https":
        return ("http", None, None, auth)
    try:
        port = int(e.get("https_port") or 443)
    except (TypeError, ValueError):
        port = None
    return ("https", port, str(e.get("tls_mode") or "verify").lower(), auth)


DESTINATION_CHANGED = "הכתובת, הפורט, סוג החיבור או סוג ה־NVR השתנו - יש להזין את הסיסמה מחדש."


def _password_for(body: _Base, settings: Settings, row: sqlite3.Row | None, fields: dict[str, Any], *, use_stored: bool, rid: str = PRIMARY) -> tuple[str | None, bool]:
    """(password to use, changed?). The stored one only when the body omits it, asks to keep it AND the destination (vendor,
    host, HTTP port, RTSP port) is the stored one: a stored password is never sent anywhere else (security review F2; a
    deliberate hardening of CR-022 section 6.2). A changed destination without a typed password is 422 `password_required`
    with `details.reason = "destination_changed"`."""
    if body.password:
        return body.password, True
    if use_stored:
        stored = _stored_destination(settings, row, rid)
        if stored is None:  # second review N1: no stored destination = no stored password goes anywhere (422 password_required)
            return None, False
        wanted = (fields["vendor"], _norm_host(fields["host"]), fields["http_port"], fields["rtsp_port"], *_transport(fields.get("extra")))
        if stored != wanted:
            raise ApiError(422, "password_required", DESTINATION_CHANGED, details={"field": "password", "reason": "destination_changed"})
        try:
            if row is not None:
                return connection_store.stored_password(settings, row), False
            return settings.nvr_password, False  # before any save: the legacy password the process runs with
        except connection_store.SecretError:
            raise ApiError(422, "password_required", "לא ניתן לקרוא את הסיסמה השמורה - יש להזין אותה מחדש.", details={"field": "password"}) from None
    return None, False


def _current_vendor(settings: Settings, row: sqlite3.Row | None, rid: str = PRIMARY) -> str | None:
    if row is not None:
        return row["vendor"]
    if rid != PRIMARY:
        return None
    host = settings.nvr_host
    return registry.DEFAULT_VENDOR if host and host != DEV_NVR_PLACEHOLDER else None


def _check_vendor_change(conn: sqlite3.Connection, settings: Settings, row: sqlite3.Row | None, fields: dict[str, Any], rid: str = PRIMARY) -> None:
    """D7: changing the vendor of a recorder with cameras needs "Remove NVR" first (409 remove_first)."""
    current = _current_vendor(settings, row, rid)
    if current not in (None, registry.NO_NVR) and fields["vendor"] != current and connection_store.camera_count(conn, rid) > 0:
        raise ApiError(409, "remove_first", "יש להסיר את ה־NVR לפני החלפת סוג.", details={"vendor": current})


def _res(rid: str) -> str:
    """The audit resource id: "connection" for the first recorder (as CR-022), `connection:<id>` for a further one."""
    return "connection" if rid == PRIMARY else f"connection:{rid}"


def _limit(request: Request, conn: sqlite3.Connection, principal: Principal, action: str, rid: str = PRIMARY) -> None:
    wait = request.app.state.connection_probe_limiter.take(principal.user_id or principal.username or "?")
    if wait:
        audit(conn, actor=principal, action=action, decision="denied", resource_type="nvr", resource_id=_res(rid), reason="rate_limited", request_id=_rid(request))
        raise ApiError(429, "rate_limited", f"יותר מדי בדיקות חיבור; אפשר לנסות שוב בעוד {wait} שניות.", retryable=True, details={"retry_after_s": wait})


def _deny(request: Request, conn: sqlite3.Connection, principal: Principal, action: str, reason: str, vendor: str, rid: str = PRIMARY) -> None:
    """Review F7: every refused test or save leaves an audit row - the reason and the vendor, never the host or a password."""
    audit(conn, actor=principal, action=action, decision="denied", resource_type="nvr", resource_id=_res(rid), reason=reason,
          request_id=_rid(request), details={"vendor": vendor, "outcome": reason})


def _check_ports(fields: dict[str, Any]) -> None:
    """Review F9: the platform's own service ports are never a probe target, on any host."""
    for name in ("http_port", "rtsp_port"):
        if connection_probe.port_refused(fields.get(name)):
            raise ApiError(422, "port_refused", "הפורט שמור לשירותי המערכת ואינו מותר לחיבור NVR.", details={"field": name})


def _run_probe(request: Request, conn: sqlite3.Connection, settings: Settings, fields: dict[str, Any], password: str | None) -> dict[str, Any]:
    """The source policy, then the GET-only probe with the database write lock released. Raises 422 host_refused. A name that
    does not resolve is never handed to the HTTP client (review F3): `source_unavailable`, no connection. Name resolution and
    the probe share one 8 s budget (third review)."""
    with unlocked(conn):
        return connection_probe.check_and_probe(fields["host"], settings, lambda target: connection_probe.candidate(
            settings, vendor=fields["vendor"], target=target, http_port=fields["http_port"], rtsp_port=fields["rtsp_port"],
            username=fields["username"], password=password, extra=fields.get("extra")))


def _revision_now(conn: sqlite3.Connection, rid: str = PRIMARY) -> int:
    row = connection_store.get_row(conn, rid)
    return int(row["revision"]) if row else 0


def _require_revision(if_revision: int | None, conn: sqlite3.Connection, rid: str = PRIMARY) -> None:
    """Review F10: `if_revision` is mandatory on PUT / DELETE and must equal the stored revision (0 before any save)."""
    if if_revision is None:
        raise ApiError(422, "revision_required", "חסר מספר הגרסה של פרטי החיבור; טענו את הדף מחדש.", details={"field": "if_revision"})
    current = _revision_now(conn, rid)
    if if_revision != current:
        raise ApiError(409, "stale", "פרטי החיבור השתנו בינתיים; טענו את הדף מחדש.", details={"revision": current})


# ---------------------------------------------------------------- routes

@router.get("/nvr/vendors")
def vendors(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, PERMISSION, INSTALLATION)
    return {"vendors": registry.catalogue()}


@router.get("/nvr/connection")
def get_connection(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, PERMISSION, INSTALLATION)
    return connection_view(conn, request)


@router.post("/nvr/connection/test")
def test_connection(request: Request, principal: Principal = Depends(_admin_ro), raw: bytes = Depends(_raw_body),
                    conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """A read-only test of a candidate connection. No database write except its one audit row."""
    require(conn, principal, PERMISSION, INSTALLATION)
    return do_test(request, principal, raw, conn, PRIMARY)


def do_test(request: Request, principal: Principal, raw: bytes, conn: sqlite3.Connection, rid: str) -> dict[str, Any]:
    """The connection test of recorder `rid` (CR-024: shared by `/nvr/connection/test` and `/recorders/{id}/connection/test`).
    The caller has checked `system.configure`."""
    body: TestIn = _parse(request, raw, TestIn)
    settings = settings_of(request)
    fields = _validated(body)
    if fields["vendor"] == registry.NO_NVR:
        raise ApiError(422, "vendor_not_testable", "אין מה לבדוק כשנבחר \"ללא NVR\".", details={"field": "vendor"})
    row = connection_store.get_row(conn, rid)
    try:
        _check_ports(fields)
        password, _ = _password_for(body, settings, row, fields, use_stored=body.use_stored_password, rid=rid)
    except ApiError as exc:
        _deny(request, conn, principal, "nvr.connection.test", (exc.details or {}).get("reason") or exc.code, fields["vendor"], rid)
        raise
    if not password:
        raise ApiError(422, "password_required", "יש להזין סיסמה.", details={"field": "password"})
    _limit(request, conn, principal, "nvr.connection.test", rid)
    try:
        result = _run_probe(request, conn, settings, fields, password)
    except ApiError as exc:
        if exc.code == "host_refused":
            _deny(request, conn, principal, "nvr.connection.test", "host_refused", fields["vendor"], rid)
        raise
    audit(conn, actor=principal, action="nvr.connection.test", decision="allowed", resource_type="nvr", resource_id=_res(rid), request_id=_rid(request),
          details={"vendor": fields["vendor"], "outcome": result["code"]})
    return connection_probe.public(result)  # CR-024: the device serial (hashed for the identity) never leaves the server


@router.put("/nvr/connection")
def save_connection(request: Request, principal: Principal = Depends(_admin_ro), raw: bytes = Depends(_raw_body),
                    conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Test (server-side), then store. Section 6.4: an unreachable NVR is saved only with `save_untested` + the typed word;
    bad credentials and refused hosts never. Changing the vendor of a recorder with cameras needs "Remove NVR" first (D7)."""
    require(conn, principal, PERMISSION, INSTALLATION)
    body: SaveIn = _parse(request, raw, SaveIn)
    return do_save(request, principal, body, conn, PRIMARY, identity_rule=True)


def do_save(request: Request, principal: Principal, body: "SaveIn", conn: sqlite3.Connection, rid: str,
            before_write: Any = None, allow_none: bool = True, identity_rule: bool = False) -> dict[str, Any]:
    """The save of recorder `rid`'s connection (CR-024: shared by `PUT /nvr/connection`, `PUT /recorders/{id}/connection`
    and `POST /recorders`). The caller has checked `system.configure` and parsed the body. `before_write(conn, fields)` runs
    right before the row is written, under the write lock after the probe (the add route creates the recorder row there and
    refuses a duplicate destination). `allow_none` False refuses "no NVR" (a further recorder is removed, never set to none)."""
    settings = settings_of(request)
    fields = _validated(body)
    if fields["vendor"] == registry.NO_NVR and not allow_none:
        raise ApiError(422, "vendor_not_available", "סוג ה־NVR שנבחר אינו זמין.", details={"field": "vendor"})
    _require_revision(body.if_revision, conn, rid)
    row = connection_store.get_row(conn, rid)
    _check_vendor_change(conn, settings, row, fields, rid)
    actor_id = principal.user_id
    if fields["vendor"] == registry.NO_NVR:
        revision = connection_store.write_row(conn, settings, vendor=registry.NO_NVR, host=None, http_port=None, rtsp_port=None, username=None, password=None,
                                              extra=None, source="ui", actor_id=actor_id, recorder_id=rid)
        audit(conn, actor=principal, action="nvr.connection.update", decision="allowed", resource_type="nvr", resource_id=_res(rid), request_id=_rid(request),
              details={"vendor": registry.NO_NVR, "revision": revision})
        return {"saved": True, "restart_required": True, "restarting": False, "revision": revision, "device": None, "untested": False, **connection_view(conn, request, rid)}
    try:
        _check_ports(fields)
        password, changed = _password_for(body, settings, row, fields, use_stored=body.keep_password, rid=rid)
    except ApiError as exc:
        _deny(request, conn, principal, "nvr.connection.update", (exc.details or {}).get("reason") or exc.code, fields["vendor"], rid)
        raise
    if not password:
        raise ApiError(422, "password_required", "יש להזין סיסמה.", details={"field": "password"})
    _limit(request, conn, principal, "nvr.connection.update", rid)
    try:
        result = _run_probe(request, conn, settings, fields, password)  # 422 host_refused propagates: never saved, even untested
    except ApiError as exc:
        if exc.code == "host_refused":  # review F7: audited like the test's refusal (no host in the row)
            _deny(request, conn, principal, "nvr.connection.update", "host_refused", fields["vendor"], rid)
        raise
    # review F10: the probe ran with the write lock released - re-check the revision (and the vendor rule) under the lock now
    _require_revision(body.if_revision, conn, rid)
    row = connection_store.get_row(conn, rid)
    _check_vendor_change(conn, settings, row, fields, rid)
    untested = False
    if result.get("pin_required"):  # CR-025: "pin" chosen but no fingerprint in the body - the form pins it from the test
        raise ApiError(422, "tls_pin_required", "יש לנעוץ את תעודת ה־NVR (בדיקת חיבור ואז נעיצה) לפני השמירה.", details={"field": "tls_pin"})
    if not result["ok"]:
        code = result["code"]
        if code in UNTESTED_OK and body.save_untested:
            if (body.confirm_text or "").strip() != SAVE_WORD:
                raise ApiError(422, "confirm_required", f"כדי לשמור בלי בדיקה יש להקליד \"{SAVE_WORD}\".", details={"field": "confirm_text"})
            untested = True
        else:
            messages = {"source_forbidden": "ה־NVR דחה את שם המשתמש או הסיסמה.", "source_unavailable": "לא ניתן להתחבר ל־NVR.", "timeout": "ה־NVR לא ענה בזמן.",
                        "source_error": "ה־NVR החזיר שגיאה.", "tls_pin_mismatch": "תעודת ה־NVR אינה התעודה שננעצה.",
                        "auth_scheme_unsupported": "שיטת האימות של ה־NVR אינה נתמכת.",
                        "auth_downgrade_refused": "ה־NVR ביקש שיטת אימות חלשה מבעבר. בחרו את שיטת האימות במפורש."}
            audit(conn, actor=principal, action="nvr.connection.update", decision="denied", resource_type="nvr", resource_id=_res(rid), reason=code,
                  request_id=_rid(request), details={"vendor": fields["vendor"], "outcome": code})
            raise ApiError(503 if code != "source_forbidden" else 502, code, messages.get(code, "בדיקת החיבור נכשלה."), retryable=code in UNTESTED_OK,
                           details={"can_save_untested": code in UNTESTED_OK})
    # CR-024 (owner 2026-10-04, answer to the wizard question): `PUT /nvr/connection` (the setup wizard, the first recorder's form)
    # reconnects `nvr-1` only when it is the SAME physical recorder. When `nvr-1` is free (removed / "no NVR") and history exists
    # under it, the candidate's keyed identity (model + serial hash, from the test that just ran) must equal the identity stored
    # for `nvr-1`; a different device, a device without a serial, an untested save or a missing stored identity -> a NEW id, so the
    # old (disabled) cameras, events and changes never attach to another device. An edit of an active `nvr-1` is unchanged.
    from ..services import autosync

    candidate_fp = autosync.device_identity(conn, result.get("model"), result.get("_serial")) if result.get("ok") else None
    new_recorder = False
    if identity_rule and rid == PRIMARY and connection_store.primary_free(conn, settings) and connection_store.primary_has_history(conn):
        stored_fp = connection_store.stored_identity(conn, PRIMARY)
        if not (candidate_fp and stored_fp and candidate_fp == stored_fp):
            from .recorders import create_recorder_row, destination_taken

            rid = connection_store.next_free_id(conn)
            if destination_taken(conn, settings, fields, rid):
                raise ApiError(409, "recorder_duplicate", "ה־NVR הזה כבר מחובר למערכת.", details={"field": "host"})
            create_recorder_row(conn, rid, "NVR", fields["vendor"])
            row = None
            new_recorder = True
    if before_write is not None:
        before_write(conn, fields)
    before = dict(row) if row is not None else {}
    changed_fields = sorted(k for k in ("vendor", "host", "http_port", "rtsp_port", "username") if before.get(k) != fields.get(k))
    try:
        revision = connection_store.write_row(conn, settings, vendor=fields["vendor"], host=fields["host"], http_port=fields["http_port"], rtsp_port=fields["rtsp_port"],
                                              username=fields["username"], password=password, extra=fields["extra"], source="ui", actor_id=actor_id, recorder_id=rid)
    except connection_store.SecretError:
        raise ApiError(500, "secret_store_unavailable", "לא ניתן לשמור את הסיסמה בצורה מוצפנת; בדקו את תיקיית הנתונים.") from None
    audit(conn, actor=principal, action="nvr.connection.update", decision="allowed", resource_type="nvr", resource_id=_res(rid), request_id=_rid(request),
          details={"vendor": fields["vendor"], "host": fields["host"], "http_port": fields["http_port"], "rtsp_port": fields["rtsp_port"], "changed": changed_fields,
                   "password_changed": changed, "untested": untested, "revision": revision})
    if candidate_fp:  # which physical recorder this connection reaches (keyed hash; the serial is never stored)
        autosync.ensure_recorder(conn, recorder_id=rid)
        autosync.store_identity(conn, rid, candidate_fp)
    if new_recorder:
        audit(conn, actor=principal, action="nvr.recorder.add", decision="allowed", resource_type="recorder", resource_id=rid, request_id=_rid(request),
              details={"vendor": fields["vendor"], "reason": "history_under_first_id", "untested": untested, "revision": revision})
    device = {k: result.get(k) for k in ("model", "firmware", "channels")} if result["ok"] else None
    return {"saved": True, "restart_required": True, "restarting": False, "revision": revision, "device": device, "untested": untested,
            **connection_view(conn, request, rid), "recorder_id": rid, "new_recorder": new_recorder}


@router.delete("/nvr/connection")
def remove_connection(request: Request, background: BackgroundTasks, principal: Principal = Depends(_admin_ro), raw: bytes = Depends(_raw_body),
                      conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """"Remove NVR": secrets cleared, vendor `none`, the cameras stay - disabled. The add-on options are never re-imported."""
    require(conn, principal, PERMISSION, INSTALLATION)
    body: RemoveIn = _parse(request, raw, RemoveIn)
    if body.confirm_text.strip() != REMOVE_WORD:
        raise ApiError(422, "confirm_required", f"כדי להסיר את ה־NVR יש להקליד \"{REMOVE_WORD}\".", details={"field": "confirm_text"})
    _require_revision(body.if_revision, conn)  # the request holds the write lock from here to the commit
    revision, disabled = connection_store.remove(conn, settings_of(request), principal.user_id)
    audit(conn, actor=principal, action="nvr.connection.remove", decision="allowed", resource_type="nvr", resource_id="connection", request_id=_rid(request),
          details={"revision": revision, "cameras_disabled": disabled})
    from ..services import recorder_live

    background.add_task(recorder_live.stop, request.app.state.db, settings_of(request), PRIMARY)  # CR-024: stopped at once
    return {"removed": True, "restart_required": True, "revision": revision, "cameras_disabled": disabled}


def _restart_later(settings: Settings) -> None:
    outcome = addon_restart.restart(settings)
    if outcome != "ok":
        log.warning("the add-on restart was not accepted (%s); restart it by hand", outcome)


@router.post("/system/restart", status_code=202)
def restart_system(request: Request, background: BackgroundTasks, principal: Principal = Depends(_admin_ro),
                   raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> Any:
    """Restart Arx to apply a connection change (D3: never automatic). The call is made after the answer is sent - the
    restart ends this process, so its outcome cannot be reported; the screen falls back to "restart by hand" when the
    system does not come back."""
    require(conn, principal, PERMISSION, INSTALLATION)
    body: RestartIn = _parse(request, raw, RestartIn)
    if body.confirm is not True:
        raise ApiError(422, "confirm_required", "יש לאשר את ההפעלה מחדש.", details={"field": "confirm"})
    try:  # CR-021 S3 owner decision 2026-10-04: an Arx restart never starts while a self-update run is active
        update_runs.refuse_arx_restart_during_update(conn)
    except ApiError:
        audit(conn, actor=principal, action="system.restart", decision="denied", resource_type="system", resource_id="addon", reason="update_running", request_id=_rid(request))
        raise
    settings = settings_of(request)
    if not addon_restart.configured(settings):
        raise ApiError(409, "restart_manual", "יש להפעיל מחדש את השירות באופן ידני.")
    wait = addon_restart.wait_seconds(conn)  # review F6: persisted, so a restart loop cannot reset it
    if wait:
        audit(conn, actor=principal, action="system.restart", decision="denied", resource_type="system", resource_id="addon", reason="rate_limited", request_id=_rid(request))
        raise ApiError(429, "rate_limited", f"המערכת הופעלה מחדש לפני רגע; אפשר לנסות שוב בעוד {wait} שניות.", retryable=True, details={"retry_after_s": wait})
    audit(conn, actor=principal, action="system.restart", decision="allowed", resource_type="system", resource_id="addon", request_id=_rid(request),
          details={"pending_connection": connection_store.pending_restart(conn, settings)})
    addon_restart.mark(conn)
    background.add_task(_restart_later, settings)
    return JSONResponse({"restarting": True}, status_code=202)
