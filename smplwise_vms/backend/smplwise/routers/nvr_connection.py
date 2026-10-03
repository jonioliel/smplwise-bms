"""The NVR connection in Arx (CR-022 section 6.2): the vendor catalogue, the stored connection (GET / PUT / DELETE), the
read-only connection test and the add-on restart that applies a change.

Every route: `system.configure` at installation scope (owner decision D5; the system administrator only - distinct from
CR-020's `nvr.configure`, which governs camera writes on the NVR itself), checked FIRST - the 401 / 403 and its audit row
come before the body is even parsed and before any device I/O. Bodies are strict (`extra=forbid`), small, JSON only. None of
these routes is reachable on the remote channel (remote_channel.BLOCKED_ON_REMOTE). The password is write-only: no answer,
audit row, log line or error carries it or its ciphertext. A save or a removal never changes the running process: it answers
`restart_required` and `/me` / `/health` report `connection_pending_restart` until the next start (section 8)."""
from __future__ import annotations

import json
import logging
import sqlite3
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from ..audit import audit
from ..auth import current_principal, get_conn, settings_of
from ..config import DEV_NVR_PLACEHOLDER, Settings
from ..db import unlocked
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, require
from ..services import addon_restart, connection_probe, connection_store
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
    if_revision: int | None = None


class RemoveIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    confirm_text: str = Field(max_length=32)


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


def _restart_mode(settings: Settings) -> str:
    return "addon" if addon_restart.configured(settings) else "manual"


# ---------------------------------------------------------------- the view (never a secret)

def connection_view(conn: sqlite3.Connection, request: Request) -> dict[str, Any]:
    """`GET /nvr/connection`: the stored row (or, before any save, the legacy connection the process runs with). Keys of
    0.1.71 kept (`host`, `placeholder`, `http_port`, `rtsp_port`, `user`, `has_password`, `in_addon`)."""
    settings = settings_of(request)
    row = connection_store.get_row(conn)
    cams = connection_store.camera_count(conn)
    common = {"pending_restart": connection_store.pending_restart(conn, settings), "legacy_options_differ": bool(getattr(request.app.state, "legacy_options_differ", False)),
              "in_addon": settings.in_addon, "restart": _restart_mode(settings), "cameras": cams}
    if row is not None:
        try:
            extra = json.loads(row["extra_json"] or "{}")
        except ValueError:
            extra = {}
        unreadable = not connection_store.readable(conn, settings, row)
        state = "unreadable" if unreadable else row["state"]
        return {"vendor": row["vendor"], "host": row["host"], "placeholder": False, "http_port": row["http_port"], "rtsp_port": row["rtsp_port"],
                "username": row["username"], "user": row["username"], "extra": extra, "has_password": bool(row["password_enc"]) and not unreadable,
                "state": state, "source": row["source"], "revision": int(row["revision"]), "updated_at": row["updated_at"], "updated_by": row["updated_by"],
                "vendor_locked": row["vendor"] != registry.NO_NVR and cams > 0, **common}
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
    allowed_extra = {f.key for f in spec.fields} - {"host", "http_port", "rtsp_port", "username", "password"}
    extra = body.extra or {}
    if any(k not in allowed_extra for k in extra) or any(not isinstance(v, (str, int, bool)) or isinstance(v, str) and len(v) > 200 for v in extra.values()):
        raise ApiError(422, "extra_invalid", "שדה נוסף אינו מוכר לסוג ה־NVR הזה.", details={"field": "extra"})
    return {"vendor": vendor, "host": host, **ports, "username": username, "extra": extra}


def _password_for(body: _Base, settings: Settings, row: sqlite3.Row | None, *, use_stored: bool) -> tuple[str | None, bool]:
    """(password to use, changed?). The stored one only when the body omits it and asks to keep it."""
    if body.password:
        return body.password, True
    if use_stored:
        try:
            if row is not None:
                return connection_store.stored_password(settings, row), False
            return settings.nvr_password, False  # before any save: the legacy password the process runs with
        except connection_store.SecretError:
            raise ApiError(422, "password_required", "לא ניתן לקרוא את הסיסמה השמורה - יש להזין אותה מחדש.", details={"field": "password"}) from None
    return None, False


def _current_vendor(settings: Settings, row: sqlite3.Row | None) -> str | None:
    if row is not None:
        return row["vendor"]
    host = settings.nvr_host
    return registry.DEFAULT_VENDOR if host and host != DEV_NVR_PLACEHOLDER else None


def _limit(request: Request, conn: sqlite3.Connection, principal: Principal, action: str) -> None:
    wait = request.app.state.connection_probe_limiter.take(principal.user_id or principal.username or "?")
    if wait:
        audit(conn, actor=principal, action=action, decision="denied", resource_type="nvr", resource_id="connection", reason="rate_limited", request_id=_rid(request))
        raise ApiError(429, "rate_limited", f"יותר מדי בדיקות חיבור; אפשר לנסות שוב בעוד {wait} שניות.", retryable=True, details={"retry_after_s": wait})


def _run_probe(request: Request, conn: sqlite3.Connection, settings: Settings, fields: dict[str, Any], password: str | None) -> dict[str, Any]:
    """The source policy, then the GET-only probe with the database write lock released. Raises 422 host_refused."""
    with unlocked(conn):
        target = connection_probe.connect_target(fields["host"], settings)
        cand = connection_probe.candidate(settings, vendor=fields["vendor"], target=target, http_port=fields["http_port"], rtsp_port=fields["rtsp_port"],
                                          username=fields["username"], password=password)
        return connection_probe.probe(cand)


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
def test_connection(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn),
                    raw: bytes = Depends(_raw_body)) -> dict[str, Any]:
    """A read-only test of a candidate connection. No database write except its one audit row."""
    require(conn, principal, PERMISSION, INSTALLATION)
    body: TestIn = _parse(request, raw, TestIn)
    settings = settings_of(request)
    fields = _validated(body)
    if fields["vendor"] == registry.NO_NVR:
        raise ApiError(422, "vendor_not_testable", "אין מה לבדוק כשנבחר \"ללא NVR\".", details={"field": "vendor"})
    row = connection_store.get_row(conn)
    password, _ = _password_for(body, settings, row, use_stored=body.use_stored_password)
    if not password:
        raise ApiError(422, "password_required", "יש להזין סיסמה.", details={"field": "password"})
    _limit(request, conn, principal, "nvr.connection.test")
    try:
        result = _run_probe(request, conn, settings, fields, password)
    except ApiError as exc:
        if exc.code == "host_refused":
            audit(conn, actor=principal, action="nvr.connection.test", decision="denied", resource_type="nvr", resource_id="connection", reason="host_refused",
                  request_id=_rid(request), details={"vendor": fields["vendor"], "outcome": "host_refused"})
        raise
    audit(conn, actor=principal, action="nvr.connection.test", decision="allowed", resource_type="nvr", resource_id="connection", request_id=_rid(request),
          details={"vendor": fields["vendor"], "outcome": result["code"]})
    return result


@router.put("/nvr/connection")
def save_connection(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn),
                    raw: bytes = Depends(_raw_body)) -> dict[str, Any]:
    """Test (server-side), then store. Section 6.4: an unreachable NVR is saved only with `save_untested` + the typed word;
    bad credentials and refused hosts never. Changing the vendor of a recorder with cameras needs "Remove NVR" first (D7)."""
    require(conn, principal, PERMISSION, INSTALLATION)
    body: SaveIn = _parse(request, raw, SaveIn)
    settings = settings_of(request)
    fields = _validated(body)
    row = connection_store.get_row(conn)
    if body.if_revision is not None and body.if_revision != (int(row["revision"]) if row else 0):
        raise ApiError(409, "stale", "פרטי החיבור השתנו בינתיים; טענו את הדף מחדש.", details={"revision": int(row["revision"]) if row else 0})
    current = _current_vendor(settings, row)
    if current not in (None, registry.NO_NVR) and fields["vendor"] != current and connection_store.camera_count(conn) > 0:
        raise ApiError(409, "remove_first", "יש להסיר את ה־NVR לפני החלפת סוג.", details={"vendor": current})
    actor_id = principal.user_id
    if fields["vendor"] == registry.NO_NVR:
        revision = connection_store.write_row(conn, settings, vendor=registry.NO_NVR, host=None, http_port=None, rtsp_port=None, username=None, password=None,
                                              extra=None, source="ui", actor_id=actor_id)
        audit(conn, actor=principal, action="nvr.connection.update", decision="allowed", resource_type="nvr", resource_id="connection", request_id=_rid(request),
              details={"vendor": registry.NO_NVR, "revision": revision})
        return {"saved": True, "restart_required": True, "restarting": False, "revision": revision, "device": None, "untested": False, **connection_view(conn, request)}
    password, changed = _password_for(body, settings, row if current == fields["vendor"] or row is None else None, use_stored=body.keep_password)
    if not password:
        raise ApiError(422, "password_required", "יש להזין סיסמה.", details={"field": "password"})
    _limit(request, conn, principal, "nvr.connection.update")
    result = _run_probe(request, conn, settings, fields, password)  # 422 host_refused propagates: never saved, even untested
    untested = False
    if not result["ok"]:
        code = result["code"]
        if code in UNTESTED_OK and body.save_untested:
            if (body.confirm_text or "").strip() != SAVE_WORD:
                raise ApiError(422, "confirm_required", f"כדי לשמור בלי בדיקה יש להקליד \"{SAVE_WORD}\".", details={"field": "confirm_text"})
            untested = True
        else:
            messages = {"source_forbidden": "ה־NVR דחה את שם המשתמש או הסיסמה.", "source_unavailable": "לא ניתן להתחבר ל־NVR.", "timeout": "ה־NVR לא ענה בזמן.",
                        "source_error": "ה־NVR החזיר שגיאה."}
            audit(conn, actor=principal, action="nvr.connection.update", decision="denied", resource_type="nvr", resource_id="connection", reason=code,
                  request_id=_rid(request), details={"vendor": fields["vendor"], "outcome": code})
            raise ApiError(503 if code != "source_forbidden" else 502, code, messages.get(code, "בדיקת החיבור נכשלה."), retryable=code in UNTESTED_OK,
                           details={"can_save_untested": code in UNTESTED_OK})
    before = dict(row) if row is not None else {}
    changed_fields = sorted(k for k in ("vendor", "host", "http_port", "rtsp_port", "username") if before.get(k) != fields.get(k))
    try:
        revision = connection_store.write_row(conn, settings, vendor=fields["vendor"], host=fields["host"], http_port=fields["http_port"], rtsp_port=fields["rtsp_port"],
                                              username=fields["username"], password=password, extra=fields["extra"], source="ui", actor_id=actor_id)
    except connection_store.SecretError:
        raise ApiError(500, "secret_store_unavailable", "לא ניתן לשמור את הסיסמה בצורה מוצפנת; בדקו את תיקיית הנתונים.") from None
    audit(conn, actor=principal, action="nvr.connection.update", decision="allowed", resource_type="nvr", resource_id="connection", request_id=_rid(request),
          details={"vendor": fields["vendor"], "host": fields["host"], "http_port": fields["http_port"], "rtsp_port": fields["rtsp_port"], "changed": changed_fields,
                   "password_changed": changed, "untested": untested, "revision": revision})
    device = {k: result.get(k) for k in ("model", "firmware", "channels")} if result["ok"] else None
    return {"saved": True, "restart_required": True, "restarting": False, "revision": revision, "device": device, "untested": untested, **connection_view(conn, request)}


@router.delete("/nvr/connection")
def remove_connection(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn),
                      raw: bytes = Depends(_raw_body)) -> dict[str, Any]:
    """"Remove NVR": secrets cleared, vendor `none`, the cameras stay - disabled. The add-on options are never re-imported."""
    require(conn, principal, PERMISSION, INSTALLATION)
    body: RemoveIn = _parse(request, raw, RemoveIn)
    if body.confirm_text.strip() != REMOVE_WORD:
        raise ApiError(422, "confirm_required", f"כדי להסיר את ה־NVR יש להקליד \"{REMOVE_WORD}\".", details={"field": "confirm_text"})
    revision, disabled = connection_store.remove(conn, settings_of(request), principal.user_id)
    audit(conn, actor=principal, action="nvr.connection.remove", decision="allowed", resource_type="nvr", resource_id="connection", request_id=_rid(request),
          details={"revision": revision, "cameras_disabled": disabled})
    return {"removed": True, "restart_required": True, "revision": revision, "cameras_disabled": disabled}


def _restart_later(settings: Settings) -> None:
    outcome = addon_restart.restart(settings)
    if outcome != "ok":
        log.warning("the add-on restart was not accepted (%s); restart it by hand", outcome)


@router.post("/system/restart", status_code=202)
def restart_system(request: Request, background: BackgroundTasks, principal: Principal = Depends(current_principal),
                   conn: sqlite3.Connection = Depends(get_conn), raw: bytes = Depends(_raw_body)) -> Any:
    """Restart Arx to apply a connection change (D3: never automatic). The call is made after the answer is sent - the
    restart ends this process, so its outcome cannot be reported; the screen falls back to "restart by hand" when the
    system does not come back."""
    require(conn, principal, PERMISSION, INSTALLATION)
    body: RestartIn = _parse(request, raw, RestartIn)
    if body.confirm is not True:
        raise ApiError(422, "confirm_required", "יש לאשר את ההפעלה מחדש.", details={"field": "confirm"})
    settings = settings_of(request)
    if not addon_restart.configured(settings):
        raise ApiError(409, "restart_manual", "יש להפעיל מחדש את השירות באופן ידני.")
    wait = request.app.state.restart_limiter.take("installation")
    if wait:
        audit(conn, actor=principal, action="system.restart", decision="denied", resource_type="system", resource_id="addon", reason="rate_limited", request_id=_rid(request))
        raise ApiError(429, "rate_limited", f"המערכת הופעלה מחדש לפני רגע; אפשר לנסות שוב בעוד {wait} שניות.", retryable=True, details={"retry_after_s": wait})
    audit(conn, actor=principal, action="system.restart", decision="allowed", resource_type="system", resource_id="addon", request_id=_rid(request),
          details={"pending_connection": connection_store.pending_restart(conn, settings)})
    background.add_task(_restart_later, settings)
    return JSONResponse({"restarting": True}, status_code=202)
