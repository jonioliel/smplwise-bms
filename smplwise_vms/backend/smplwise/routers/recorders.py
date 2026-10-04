"""Recorders as first-class entities (CR-024, docs/changes/CR-024-MULTI-NVR.md section 2.2): the list, add, edit, enable /
disable, remove and a read-only health check of every NVR the installation manages, and each recorder's connection.

- Management (add, edit, remove, the connection and its test) = `system.configure` at installation scope (CR-022 decision D5),
  checked FIRST: the 401 / 403 and its audit row come before the body is parsed and before any device I/O. The connection
  routes reuse routers/nvr_connection.py (the same validation, source policy, GET-only probe, rate limit, encrypted password,
  typed confirmations, `if_revision`). The password is write-only.
- Reading the list or one recorder's health = whoever may read the NVR configuration (`system.configure` or any NVR
  permission); the connection detail (host, ports, user) only for `system.configure`. Never a password, a serial or a MAC.
- Every change waits for a restart (owner decision; `restart_required`, per-recorder `pending_restart`).
- Removal (owner decision): the recorder row stays, marked removed; its connection secrets are cleared; its cameras are
  disabled and left out of every camera list; events, cases, anchors, bindings and the change log are kept. Ids are never
  reused (`nvr-<n>` above every id ever used), except that the first recorder (`nvr-1`, the installation's process-wide
  connection) is filled again when an NVR is added to an installation that has none.
- Local channel only (remote_channel.BLOCKED_ON_REMOTE)."""
from __future__ import annotations

import json
import sqlite3
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal, get_conn, read_gate, settings_of
from ..config import DEV_NVR_PLACEHOLDER
from ..db import now_iso, unlocked
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, require
from ..recorder_scope import PRIMARY, next_id, settings_for, valid_id
from ..services import autosync, connection_store, events_ingest, nvr, recorder_live
from ..services.recorders import registry
from . import nvr_connection as nc

router = APIRouter()

PERMISSION = nc.PERMISSION  # system.configure
NAME_MAX = 60
READ_PERMISSIONS = ("system.configure", "nvr.configure", "nvr.config.write", "nvr.config.events", "nvr.config.detection", "nvr.config.privacy",
                    "nvr.config.smart", "nvr.config.schedule", "nvr.config.osd", "nvr.config.time", "nvr.record.manual", "nvr.record.lock",
                    "nvr.alarm_output", "nvr.storage.test", "nvr.system.reboot")


class AddIn(nc.SaveIn):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    name: str = Field(min_length=1, max_length=NAME_MAX)


class PatchIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = Field(default=None, min_length=1, max_length=NAME_MAX)
    enabled: bool | None = None
    sort_order: int | None = Field(default=None, ge=0, le=10_000)
    time_zone: str | None = Field(default=None, max_length=64)  # "" = back to the installation's zone


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _may_read(conn: sqlite3.Connection, principal: Principal) -> None:
    if any(authorize(conn, principal, p, INSTALLATION).allowed for p in READ_PERMISSIONS):
        return
    require(conn, principal, PERMISSION, INSTALLATION)  # the audited 403


_admin_ro = read_gate(lambda conn, principal: require(conn, principal, PERMISSION, INSTALLATION))


def _row(conn: sqlite3.Connection, rid: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM recorders WHERE id = ?", (rid,)).fetchone()


def _known(conn: sqlite3.Connection, rid: str, *, include_removed: bool = False) -> sqlite3.Row | None:
    """The recorder row, 404 when the id is malformed or unknown (the first recorder exists before its first discovery)."""
    if not valid_id(rid):
        raise ApiError(404, "not_found", "ה־NVR לא נמצא.")
    row = _row(conn, rid)
    if row is None and rid == PRIMARY:
        return None
    if row is None or (row["removed_at"] and not include_removed):
        raise ApiError(404, "not_found", "ה־NVR לא נמצא.")
    return row


def recorder_settings(request: Request, conn: sqlite3.Connection, recorder_id: str | None) -> Any:
    """For an installation-level NVR route (`?recorder_id=`): the recorder's effective settings, 404 for an unknown or removed
    recorder. Called AFTER the route's permission check (an unauthorised caller learns nothing about recorder ids)."""
    rid = recorder_id or PRIMARY
    if rid != PRIMARY:
        _known(conn, rid)
    return settings_for(settings_of(request), rid)


# ---------------------------------------------------------------- the view (never a secret)

def _pending(conn: sqlite3.Connection, settings: Any, rid: str, row: sqlite3.Row | None) -> bool:
    """A restart is still needed for this recorder: its connection changed, it was added after the start, or it was removed while
    loaded (stopped at once; its connection leaves memory with the restart). Enable / disable never needs one (CR-024 owner
    decision 2026-10-04)."""
    if rid == PRIMARY:
        return connection_store.pending_restart(conn, settings, rid)
    loaded = rid in (settings.recorder_settings or {})
    if row is not None and row["removed_at"]:
        return loaded
    if not loaded:
        conn_row = connection_store.get_row(conn, rid)
        return bool(row is None or row["enabled"]) and conn_row is not None and conn_row["vendor"] != registry.NO_NVR
    return connection_store.pending_restart(conn, settings_for(settings, rid), rid)


def _state(conn: sqlite3.Connection, settings: Any, rid: str, row: sqlite3.Row | None, pending: bool) -> tuple[str, str | None]:
    """(state, error code): removed | disabled | pending_restart | unreadable | refused | not_configured | error | online | unknown."""
    if row is not None and row["removed_at"]:
        return "removed", None
    if row is not None and not row["enabled"]:
        return "disabled", None
    if pending:
        return "pending_restart", None
    rs = settings_for(settings, rid)
    if rs.nvr_connection_state in ("unreadable", "refused"):
        return rs.nvr_connection_state, None
    if not (rs.nvr_host and rs.nvr_host != DEV_NVR_PLACEHOLDER and rs.nvr_user and rs.nvr_password) and not (rid == PRIMARY and rs.nvr_host == DEV_NVR_PLACEHOLDER):
        return "not_configured", None
    st = autosync.recorder_state(rid)
    if st.get("cameras_last_error"):
        return "error", st["cameras_last_error"]
    if st.get("cameras_last_ok"):
        return "online", None
    return "unknown", None


def _caps(row: sqlite3.Row | None) -> dict[str, Any]:
    try:
        caps = json.loads((row["capabilities_json"] if row is not None else None) or "{}")
    except ValueError:
        caps = {}
    return caps if isinstance(caps, dict) else {}


def recorder_view(conn: sqlite3.Connection, request: Request, rid: str, row: sqlite3.Row | None, *, admin: bool) -> dict[str, Any]:
    settings = settings_of(request)
    counts = conn.execute("SELECT COUNT(*) AS n, COALESCE(SUM(enabled), 0) AS on_ FROM cameras WHERE recorder_id = ?", (rid,)).fetchone()
    pending = _pending(conn, settings, rid, row)
    state, error = _state(conn, settings, rid, row, pending)
    conn_row = connection_store.get_row(conn, rid)
    vendor = (conn_row["vendor"] if conn_row is not None and conn_row["vendor"] != registry.NO_NVR else None) or (row["vendor"] if row is not None else registry.DEFAULT_VENDOR)
    events = events_ingest.recorder_states().get(rid) or {}
    out: dict[str, Any] = {
        "id": rid, "primary": rid == PRIMARY, "name": row["name"] if row is not None else "NVR ראשי", "vendor": vendor,
        "vendor_label": (registry.SPEC_BY_ID.get(vendor).label if registry.SPEC_BY_ID.get(vendor) else vendor),
        "enabled": bool(row["enabled"]) if row is not None else True, "removed": bool(row is not None and row["removed_at"]),
        "removed_at": row["removed_at"] if row is not None else None, "sort_order": row["sort_order"] if row is not None else 0,
        "time_zone": row["time_zone"] if row is not None else None, "model": row["model"] if row is not None else None,
        "firmware": row["firmware"] if row is not None else None, "last_seen_at": row["last_seen_at"] if row is not None else None,
        "cameras": int(counts["n"] or 0), "cameras_enabled": int(counts["on_"] or 0),
        "status": {"state": state, "error": error, "events_connected": bool(events.get("connected")),
                   "discovery_last_ok": autosync.recorder_state(rid).get("cameras_last_ok")},
        "pending_restart": pending, "capabilities": _caps(row),
    }
    if admin:
        out["connection"] = {k: v for k, v in nc.connection_view(conn, request, rid).items()
                             if k in ("vendor", "host", "http_port", "rtsp_port", "username", "has_password", "state", "revision", "updated_at", "vendor_locked")}
    return out


def _ids(conn: sqlite3.Connection, include_removed: bool) -> list[tuple[str, sqlite3.Row | None]]:
    sql = "SELECT * FROM recorders" + ("" if include_removed else " WHERE removed_at IS NULL") + " ORDER BY sort_order, id"
    rows = conn.execute(sql).fetchall()
    out: list[tuple[str, sqlite3.Row | None]] = [(r["id"], r) for r in rows]
    if not any(rid == PRIMARY for rid, _ in out) and _primary_present(conn):
        out.insert(0, (PRIMARY, None))
    return out


def _primary_present(conn: sqlite3.Connection) -> bool:
    """The first recorder shows before its first discovery when it has a stored connection (not "no NVR")."""
    row = connection_store.get_row(conn, PRIMARY)
    return row is not None and row["vendor"] != registry.NO_NVR


# ---------------------------------------------------------------- routes

@router.get("/recorders")
def list_recorders(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn),
                   include_removed: bool = False) -> dict[str, Any]:
    """Every recorder of the installation with its status, camera counts and declared capabilities (removed ones on request)."""
    _may_read(conn, principal)
    admin = authorize(conn, principal, PERMISSION, INSTALLATION).allowed
    items = [recorder_view(conn, request, rid, row, admin=admin) for rid, row in _ids(conn, include_removed and admin)]
    settings = settings_of(request)
    return {"recorders": items, "count": sum(1 for r in items if not r["removed"]), "can_manage": admin,
            # CR-024: with no recorder left and history under the first id, the settings card adds a NEW recorder (never reuses it)
            "primary_has_history": admin and primary_has_history(conn) and _primary_free(conn, settings),
            "restart": nc._restart_mode(settings), "pending_restart": any(r["pending_restart"] for r in items)}


@router.get("/recorders/{recorder_id}")
def get_recorder(recorder_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """One recorder (status, cameras, capabilities; the connection detail for system.configure only)."""
    _may_read(conn, principal)
    admin = authorize(conn, principal, PERMISSION, INSTALLATION).allowed
    row = _known(conn, recorder_id, include_removed=admin)
    return recorder_view(conn, request, recorder_id, row, admin=admin)


def _destination_taken(conn: sqlite3.Connection, settings: Any, fields: dict[str, Any], rid: str) -> bool:
    """Another active recorder already names this device (host + HTTP port): two rows on one device would register its
    cameras twice and let two write batches run on it at once."""
    host = nc._norm_host(fields.get("host"))
    for r in conn.execute("SELECT rc.recorder_id, rc.host, rc.http_port FROM recorder_connections rc LEFT JOIN recorders r ON r.id = rc.recorder_id "
                          "WHERE rc.vendor <> 'none' AND rc.recorder_id <> ? AND (r.removed_at IS NULL)", (rid,)).fetchall():
        if nc._norm_host(r["host"]) == host and int(r["http_port"] or 0) == int(fields.get("http_port") or 0):
            return True
    if rid != PRIMARY and connection_store.get_row(conn, PRIMARY) is None and settings.nvr_host and settings.nvr_host != DEV_NVR_PLACEHOLDER:
        return nc._norm_host(settings.nvr_host) == host and int(settings.nvr_http_port) == int(fields.get("http_port") or 0)
    return False


def _primary_free(conn: sqlite3.Connection, settings: Any) -> bool:
    """No first recorder in use: no stored connection (or "no NVR") and no legacy host the process started with."""
    row = connection_store.get_row(conn, PRIMARY)
    if row is not None:
        return row["vendor"] == registry.NO_NVR
    return not (settings.nvr_host and settings.nvr_host != DEV_NVR_PLACEHOLDER)


def _other_recorders(conn: sqlite3.Connection) -> bool:
    """Another recorder is in use (not removed, with a connection that is not "no NVR")."""
    row = conn.execute("""SELECT 1 FROM recorder_connections rc LEFT JOIN recorders r ON r.id = rc.recorder_id
                          WHERE rc.recorder_id <> ? AND rc.vendor <> 'none' AND r.removed_at IS NULL LIMIT 1""", (PRIMARY,)).fetchone()
    return row is not None


def primary_has_history(conn: sqlite3.Connection) -> bool:
    """CR-024 (owner 2026-10-04): the first recorder id carries history - its recorder row, cameras, events or change-log rows.
    Such an id is never handed to a NEW device (its old cameras, events and changes must not attach to it): the add route issues
    a new id instead."""
    for sql in ("SELECT 1 FROM recorders WHERE id = ? LIMIT 1", "SELECT 1 FROM cameras WHERE recorder_id = ? LIMIT 1",
                "SELECT 1 FROM events WHERE recorder_id = ? LIMIT 1", "SELECT 1 FROM nvr_changes WHERE recorder_id = ? LIMIT 1"):
        try:
            if conn.execute(sql, (PRIMARY,)).fetchone():
                return True
        except sqlite3.OperationalError:  # a table or column a test database lacks
            continue
    return False


@router.post("/recorders", status_code=201)
def add_recorder(request: Request, principal: Principal = Depends(_admin_ro), raw: bytes = Depends(nc._raw_body),
                 conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Add a recorder: vendor, connection, name. Tested server-side first (CR-022 section 6.4: an unreachable NVR only with
    `save_untested` + the typed word "שמור"; bad credentials and refused hosts never). Restart required."""
    require(conn, principal, PERMISSION, INSTALLATION)
    body: AddIn = nc._parse(request, raw, AddIn)
    settings = settings_of(request)
    name = " ".join(body.name.split())
    if not name or any(ord(ch) < 32 for ch in name):
        raise ApiError(422, "name_invalid", "שם ה־NVR אינו תקין.", details={"field": "name"})
    if _primary_free(conn, settings) and not _other_recorders(conn) and not primary_has_history(conn):
        rid = PRIMARY  # an installation without any recorder and without history of the first one: it becomes the first recorder
    else:
        used = [r["id"] for r in conn.execute("SELECT id FROM recorders").fetchall()]
        used += [r["recorder_id"] for r in conn.execute("SELECT recorder_id FROM recorder_connections").fetchall()]
        rid = next_id(used)
    body = body.model_copy(update={"if_revision": connection_store.revision_of(conn, rid) or 0})

    def create(c: sqlite3.Connection, fields: dict[str, Any]) -> None:
        if _destination_taken(c, settings, fields, rid):
            raise ApiError(409, "recorder_duplicate", "ה־NVR הזה כבר מחובר למערכת.", details={"field": "host"})
        order = c.execute("SELECT COALESCE(MAX(sort_order), 0) + 1 FROM recorders").fetchone()[0]
        c.execute("""INSERT INTO recorders(id, name, model, firmware, last_seen_at, created_at, vendor, enabled, sort_order)
                     VALUES (?, ?, NULL, NULL, NULL, ?, ?, 1, ?)
                     ON CONFLICT(id) DO UPDATE SET name = excluded.name, vendor = excluded.vendor, enabled = 1, removed_at = NULL""",
                  (rid, name, now_iso(), fields["vendor"], order))

    out = nc.do_save(request, principal, body, conn, rid, before_write=create, allow_none=False)
    audit(conn, actor=principal, action="nvr.recorder.add", decision="allowed", resource_type="recorder", resource_id=rid, request_id=_rid(request),
          details={"vendor": out.get("vendor"), "name": name, "untested": out.get("untested"), "revision": out.get("revision")})
    return {"saved": True, "restart_required": True, "recorder_id": rid, "untested": out.get("untested"), "device": out.get("device"),
            "recorder": recorder_view(conn, request, rid, _row(conn, rid), admin=True)}


@router.patch("/recorders/{recorder_id}")
def update_recorder(recorder_id: str, request: Request, background: BackgroundTasks, principal: Principal = Depends(_admin_ro),
                    raw: bytes = Depends(nc._raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Rename, reorder, set the recorder's time zone, enable / disable. Disable / enable apply AT ONCE (owner 2026-10-04): a
    disabled recorder is never contacted from this request on (no discovery, alert stream, live, playback or device call), its
    streams leave go2rtc and its cameras leave the operator screens; enabling starts it again without a restart."""
    require(conn, principal, PERMISSION, INSTALLATION)
    body: PatchIn = nc._parse(request, raw, PatchIn)
    row = _known(conn, recorder_id)
    if row is None:  # the first recorder before its first discovery: create its row so the change has somewhere to live
        autosync.ensure_recorder(conn, recorder_id=PRIMARY)
        row = _row(conn, PRIMARY)
    changes: dict[str, Any] = {}
    if body.name is not None:
        name = " ".join(body.name.split())
        if not name or any(ord(ch) < 32 for ch in name):
            raise ApiError(422, "name_invalid", "שם ה־NVR אינו תקין.", details={"field": "name"})
        changes["name"] = name
    if body.enabled is not None:
        changes["enabled"] = 1 if body.enabled else 0
    if body.sort_order is not None:
        changes["sort_order"] = body.sort_order
    if body.time_zone is not None:
        tz = body.time_zone.strip()
        if tz:
            try:
                ZoneInfo(tz)
            except Exception:  # noqa: BLE001 - any unknown or malformed zone name
                raise ApiError(422, "time_zone_invalid", "אזור הזמן אינו מוכר.", details={"field": "time_zone"}) from None
        changes["time_zone"] = tz or None
    if not changes:
        raise ApiError(422, "validation", "אין מה לשנות.")
    sets = ", ".join(f"{k} = ?" for k in changes)
    conn.execute(f"UPDATE recorders SET {sets} WHERE id = ?", (*changes.values(), recorder_id))
    audit(conn, actor=principal, action="nvr.recorder.update", decision="allowed", resource_type="recorder", resource_id=recorder_id, request_id=_rid(request),
          details={k: (bool(v) if k == "enabled" else v) for k, v in changes.items()})
    if "enabled" in changes:
        recorder_live.flip(recorder_id, bool(changes["enabled"]))  # the switch every device boundary reads - from now on
        background.add_task(recorder_live.apply, request.app.state.db, settings_of(request), recorder_id, bool(changes["enabled"]),
                            getattr(request.app.state, "tz_of", None))
    view = recorder_view(conn, request, recorder_id, _row(conn, recorder_id), admin=True)
    return {"saved": True, "restart_required": view["pending_restart"], "recorder": view}


@router.delete("/recorders/{recorder_id}")
def remove_recorder(recorder_id: str, request: Request, background: BackgroundTasks, principal: Principal = Depends(_admin_ro),
                    raw: bytes = Depends(nc._raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Remove (typed "הסר" + `if_revision` of the connection): secrets cleared, the recorder marked removed, its cameras disabled
    and hidden; every history row kept. Restart required."""
    require(conn, principal, PERMISSION, INSTALLATION)
    body: nc.RemoveIn = nc._parse(request, raw, nc.RemoveIn)
    _known(conn, recorder_id)
    if body.confirm_text.strip() != nc.REMOVE_WORD:
        raise ApiError(422, "confirm_required", f"כדי להסיר את ה־NVR יש להקליד \"{nc.REMOVE_WORD}\".", details={"field": "confirm_text"})
    nc._require_revision(body.if_revision, conn, recorder_id)
    if _row(conn, recorder_id) is None:
        autosync.ensure_recorder(conn, recorder_id=recorder_id)
    revision, disabled = connection_store.remove(conn, settings_of(request), principal.user_id, recorder_id)
    audit(conn, actor=principal, action="nvr.recorder.remove", decision="allowed", resource_type="recorder", resource_id=recorder_id, request_id=_rid(request),
          details={"revision": revision, "cameras_disabled": disabled})
    background.add_task(recorder_live.stop, request.app.state.db, settings_of(request), recorder_id)  # stopped at once (CR-024)
    return {"removed": True, "restart_required": True, "recorder_id": recorder_id, "revision": revision, "cameras_disabled": disabled}


@router.get("/recorders/{recorder_id}/connection")
def get_recorder_connection(recorder_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The recorder's stored connection (the shape of GET /nvr/connection; never the password)."""
    require(conn, principal, PERMISSION, INSTALLATION)
    _known(conn, recorder_id)
    return nc.connection_view(conn, request, recorder_id)


@router.post("/recorders/{recorder_id}/connection/test")
def test_recorder_connection(recorder_id: str, request: Request, principal: Principal = Depends(_admin_ro), raw: bytes = Depends(nc._raw_body),
                             conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """A read-only test of a candidate connection for this recorder (CR-022 section 6.3 rules); one audit row, no other write."""
    require(conn, principal, PERMISSION, INSTALLATION)
    _known(conn, recorder_id)
    return nc.do_test(request, principal, raw, conn, recorder_id)


@router.put("/recorders/{recorder_id}/connection")
def save_recorder_connection(recorder_id: str, request: Request, principal: Principal = Depends(_admin_ro), raw: bytes = Depends(nc._raw_body),
                             conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Test, then store this recorder's connection (if_revision required; a destination another recorder uses = 409 recorder_duplicate)."""
    require(conn, principal, PERMISSION, INSTALLATION)
    body: nc.SaveIn = nc._parse(request, raw, nc.SaveIn)
    _known(conn, recorder_id)
    settings = settings_of(request)

    def unique(c: sqlite3.Connection, fields: dict[str, Any]) -> None:
        if _destination_taken(c, settings, fields, recorder_id):
            raise ApiError(409, "recorder_duplicate", "ה־NVR הזה כבר מחובר למערכת.", details={"field": "host"})

    return nc.do_save(request, principal, body, conn, recorder_id, before_write=unique, allow_none=recorder_id == PRIMARY)


@router.get("/recorders/{recorder_id}/health")
def recorder_health(recorder_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """A live, read-only check of one recorder (one deviceInfo GET, at most 4 s). Model, firmware and the outcome code only."""
    _may_read(conn, principal)
    _known(conn, recorder_id)
    adapter = registry.adapter_for(conn, settings_of(request), recorder_id)
    with unlocked(conn), nvr.deadline(4.0):
        try:
            h = adapter.health()
        except ApiError as exc:
            return {"recorder_id": recorder_id, "online": False, "model": None, "firmware": None, "error": exc.code}
    return {"recorder_id": recorder_id, "online": h.online, "model": h.model, "firmware": h.firmware, "error": h.error}
