"""CALENDARS-298 phase 2 (server) - external calendar connections, bindings and manual sync (contract sections 12 and 13.5).

Who: `calendar.connect` (the grant the owner hands out, C10), at installation scope. A connection is changed or removed by its owner or a
system administrator; every connect holder sees the list. Binding a calendar needs, on top, an `edit`+ role in that calendar (a connection
holder cannot publish a calendar he cannot edit). All under the module gate; every write is audited with ids only (never labels of
external accounts, never tokens).

NOT here (needs a real provider, later phases): OAuth authorize / callback / client-secret routes, the iCal feeds. The registry holds no
real adapter, so a connection of a provider without an adapter answers `adapter_unavailable` and never reaches a network.
"""
from __future__ import annotations

import datetime as dt
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request, Response

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, require
from ..services import connection_store
from ..services.calendar import calendars as cals
from ..services.calendar import model
from ..services.calendar.access import Ctx, Denied, get_visible
from ..services.calendar.events import get_row
from ..services.calendar_sync import engine, registry
from ..services.calendar_sync.adapter import PROVIDERS, SyncError
from . import calendar as cal_mod
from .calendar import Body, _audit, _body, _errors, module_gate

router = APIRouter(dependencies=[Depends(module_gate)])


def _now() -> dt.datetime:
    return cal_mod._now()  # looked up at call time: the one route clock of the module (tests replace it)

SETUP_STEPS = {
    "google": ["Create a Google Cloud project and enable the Calendar API", "Create an OAuth client (web) and set the redirect address Arx shows", "Add yourself as a test user",
               "Paste the client id and secret into Arx", "Press connect and approve in your browser"],
    "microsoft": ["Register an application in Entra", "Set the redirect address Arx shows", "Grant delegated Calendars.ReadWrite (or Calendars.Read)", "Paste the client secret into Arx",
                  "Press connect and approve in your browser"],
    "ics_in": ["Copy the secret iCal address of the calendar you want to read", "Paste it into Arx (it is stored sealed)"],
    "ics_out": ["Create a feed; Arx shows its address once", "Subscribe to it from the calendar application"],
}
MAX_CONNECTIONS = 50


def _need_connect(conn: sqlite3.Connection, principal: Principal) -> None:
    require(conn, principal, model.PERM_CONNECT, INSTALLATION)


def _connection(conn: sqlite3.Connection, cid: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM cal_connections WHERE id = ?", (cid,)).fetchone()
    if row is None:
        raise ApiError(404, "not_found", "החיבור לא נמצא.")
    return row


def _own(ctx: Ctx, row: sqlite3.Row) -> None:
    if not (ctx.admin or row["owner_user_id"] == ctx.principal.user_id):
        raise Denied(model.PERM_CONNECT, row["id"], "owner")


def _out(conn: sqlite3.Connection, row: sqlite3.Row) -> dict[str, Any]:
    bs = conn.execute("SELECT id, calendar_id, direction, detail, dedicated FROM cal_sync_bindings WHERE connection_id = ? ORDER BY id", (row["id"],)).fetchall()
    return {"id": row["id"], "provider": row["provider"], "label": row["label"], "scope": row["scope"], "state": row["state"], "owner": cals.user_label(conn, row["owner_user_id"]),
            "last_sync_at": row["last_sync_at"], "next_sync_at": row["next_sync_at"], "error_code": row["error_code"], "adapter_available": row["provider"] in registry.available(),
            "bindings": [{"id": b["id"], "calendar_id": b["calendar_id"], "direction": b["direction"], "detail": b["detail"], "dedicated": bool(b["dedicated"])} for b in bs],
            "revision": row["revision"]}


@router.get("/calendar/connections")
def list_connections(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _need_connect(conn, principal)
    return {"connections": [_out(conn, r) for r in conn.execute("SELECT * FROM cal_connections ORDER BY created_at, id").fetchall()],
            "providers": [{"provider": p, "adapter_available": p in registry.available()} for p in PROVIDERS]}


@router.post("/calendar/connections", status_code=201)
def add_connection(body: Body, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _need_connect(conn, principal)
    d = _body(body)
    with _errors(conn, principal, request):
        if set(d) - {"provider", "label", "scope"}:  # a password or token in the body is refused, never stored
            raise model.Invalid("provider, label and scope only (Arx never takes a password here)", "provider")
        provider = model._choice(d.get("provider"), "provider", PROVIDERS)
        label = model._text(d.get("label"), "label", 1, 80)
        scope = model._choice(d.get("scope", "read"), "scope", ("read", "read_write"))
        if conn.execute("SELECT COUNT(*) FROM cal_connections").fetchone()[0] >= MAX_CONNECTIONS:
            raise model.Invalid("too many connections", "provider", "limit_reached")
        cid = cals.new_id("con")
        conn.execute("INSERT INTO cal_connections(id, provider, label, owner_user_id, scope, state, created_at) VALUES (?,?,?,?,?, 'ok', ?)",
                     (cid, provider, label, principal.user_id, scope, model.iso(_now())))
        _audit(conn, principal, request, "calendar.connection.add", "calendar_connection", cid, provider=provider, scope=scope)
        return {"connection": _out(conn, _connection(conn, cid)), "setup_steps": SETUP_STEPS[provider]}


@router.get("/calendar/connections/{cid}/calendars")
def connection_calendars(cid: str, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _need_connect(conn, principal)
    row = _connection(conn, cid)
    ad = registry.get(row["provider"])
    if ad is None:
        raise ApiError(409, "adapter_unavailable", "אין עדיין מתאם לספק הזה.", details={"provider": row["provider"]})
    try:
        items = ad.list_calendars(engine.connection_info(row))
    except SyncError as exc:
        raise ApiError(502, "provider_error", "הספק לא ענה.", retryable=True, details={"code": exc.code}) from None
    return {"calendars": [{"id_ref": c.id_ref, "name": c.name, "can_write": c.can_write, "is_primary": c.is_primary} for c in items]}


def _set_state(conn: sqlite3.Connection, principal: Principal, request: Request, cid: str, allowed_from: tuple[str, ...], to: str, action: str) -> dict[str, Any]:
    _need_connect(conn, principal)
    row = _connection(conn, cid)
    with _errors(conn, principal, request):
        _own(Ctx(conn, principal), row)
        if row["state"] not in allowed_from:
            raise ApiError(409, "bad_state", "אי אפשר לבצע את הפעולה במצב הנוכחי של החיבור.", details={"state": row["state"]})
        nxt = None if to == "paused" else model.iso(_now())
        conn.execute("UPDATE cal_connections SET state = ?, next_sync_at = ?, error_code = NULL, error_text = NULL, revision = revision + 1 WHERE id = ?", (to, nxt, cid))
        _audit(conn, principal, request, action, "calendar_connection", cid)
        return {"connection": _out(conn, _connection(conn, cid))}


@router.post("/calendar/connections/{cid}/pause")
def pause_connection(cid: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return _set_state(conn, principal, request, cid, ("ok", "error"), "paused", "calendar.connection.pause")


@router.post("/calendar/connections/{cid}/resume")
def resume_connection(cid: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    # owner answer 21 as a setting: with `reauth_and_continue` (default) a connection waiting for a new authorisation also offers a manual
    # "continue" - the next sync tries again and returns to needs_reauth if the provider still refuses; `reauth_only` keeps the old rule
    allowed = ("paused", "error", "needs_reauth") if model.read_settings(conn)["reauth_mode"] == "reauth_and_continue" else ("paused", "error")
    return _set_state(conn, principal, request, cid, allowed, "ok", "calendar.connection.resume")


@router.delete("/calendar/connections/{cid}", status_code=204)
def remove_connection(cid: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Response:
    """Best-effort revoke at the provider, then local delete. Bindings and their map rows go; Arx entries stay (contract 13.5)."""
    _need_connect(conn, principal)
    row = _connection(conn, cid)
    with _errors(conn, principal, request):
        _own(Ctx(conn, principal), row)
    ad = registry.get(row["provider"])
    if ad is not None:
        try:
            ad.revoke(engine.connection_info(row))
        except Exception:  # noqa: BLE001 - revoking is best effort; the local delete always happens
            pass
    ids = [b["id"] for b in conn.execute("SELECT id FROM cal_sync_bindings WHERE connection_id = ?", (cid,)).fetchall()]
    for bid in ids:
        conn.execute("DELETE FROM cal_sync_map WHERE binding_id = ?", (bid,))
    conn.execute("UPDATE cal_calendars SET sync_binding_id = NULL WHERE sync_binding_id IN (SELECT id FROM cal_sync_bindings WHERE connection_id = ?)", (cid,))
    conn.execute("DELETE FROM cal_sync_bindings WHERE connection_id = ?", (cid,))
    conn.execute("DELETE FROM settings WHERE key IN (?, ?)", (engine._lease_key(cid), f"calendar.sync.manual.{cid}"))
    conn.execute("DELETE FROM cal_connections WHERE id = ?", (cid,))
    _audit(conn, principal, request, "calendar.connection.remove", "calendar_connection", cid, bindings=len(ids))
    return Response(status_code=204)


@router.post("/calendar/connections/{cid}/sync")
def sync_now(cid: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Manual "sync now": at most once per `sync_manual_min_interval_s` (default 60) per connection."""
    _need_connect(conn, principal)
    row = _connection(conn, cid)
    settings = model.read_settings(conn)
    with _errors(conn, principal, request):
        _own(Ctx(conn, principal), row)
    now = _now()
    key = f"calendar.sync.manual.{cid}"
    from ..db import get_setting, set_setting  # noqa: PLC0415

    last = get_setting(conn, key)
    gap = settings["sync_manual_min_interval_s"]
    if last and gap and now < model.parse_utc(last, "last") + dt.timedelta(seconds=gap):
        wait = int((model.parse_utc(last, "last") + dt.timedelta(seconds=gap) - now).total_seconds())
        raise ApiError(429, "rate_limited", "אפשר לסנכרן ידנית פעם בדקה.", retryable=True, details={"retry_after_s": wait})
    set_setting(conn, key, model.iso(now))
    report = engine.sync_connection(conn, settings_of(request).data_dir, settings, cid, now)
    _audit(conn, principal, request, "calendar.connection.sync", "calendar_connection", cid, **{k: v for k, v in report.items() if isinstance(v, (int, str))})
    return {"report": report, "connection": _out(conn, _connection(conn, cid))}


@router.put("/calendar/calendars/{cid}/binding")
def put_binding(cid: str, body: Body, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Binds a calendar to one external calendar, or (a null body field `connection_id`) removes the binding. One binding per calendar."""
    _need_connect(conn, principal)
    ctx = Ctx(conn, principal, settings_of(request).data_dir)
    cal = get_visible(ctx, cid)
    d = _body(body)
    with _errors(conn, principal, request):
        role = ctx.role_in(cal)
        if role is None or model.ROLE_RANK[role] < model.ROLE_RANK["edit"]:
            raise Denied("calendar.role", cid, "edit")
        old = conn.execute("SELECT * FROM cal_sync_bindings WHERE calendar_id = ?", (cid,)).fetchone()
        if d.get("connection_id") is None:
            if old is not None:
                conn.execute("DELETE FROM cal_sync_map WHERE binding_id = ?", (old["id"],))
                conn.execute("DELETE FROM cal_sync_bindings WHERE id = ?", (old["id"],))
                conn.execute("UPDATE cal_calendars SET sync_binding_id = NULL WHERE id = ?", (cid,))
                _audit(conn, principal, request, "calendar.binding.set", "calendar", cid, removed=True)
            return {"binding": None}
        if set(d) - {"connection_id", "external_calendar_ref", "direction", "detail", "dedicated"}:
            raise model.Invalid("unknown binding field", "connection_id")
        crow = _connection(conn, str(d["connection_id"]))
        ref = model._text(d.get("external_calendar_ref"), "external_calendar_ref", 1, 300)
        direction = d.get("direction", "export")
        detail = d.get("detail", "busy")
        dedicated = d.get("dedicated", False)
        if not isinstance(dedicated, bool):
            raise model.Invalid("dedicated: true or false", "dedicated")
        engine.validate_binding(crow["provider"], direction, detail, dedicated, crow["scope"])
        if old is not None and old["connection_id"] == crow["id"] and engine.open_ref(settings_of(request).data_dir, old) == ref:
            # the same external calendar: settings change in place (map and sync token stay, so nothing is imported twice)
            if (old["detail"], old["direction"]) != (detail, direction):
                conn.execute("UPDATE cal_sync_map SET last_pushed_revision = NULL WHERE binding_id = ? AND origin = 'arx'", (old["id"],))  # re-publish at the new level
            conn.execute("UPDATE cal_sync_bindings SET direction = ?, detail = ?, dedicated = ?, revision = revision + 1 WHERE id = ?", (direction, detail, int(dedicated), old["id"]))
            bid = old["id"]
        else:
            if old is not None:  # another external calendar: nothing of the old link is trusted
                conn.execute("DELETE FROM cal_sync_map WHERE binding_id = ?", (old["id"],))
                conn.execute("DELETE FROM cal_sync_bindings WHERE id = ?", (old["id"],))
            bid = cals.new_id("bnd")
            conn.execute("INSERT INTO cal_sync_bindings(id, connection_id, calendar_id, external_calendar_id_sealed, direction, detail, dedicated, created_by) VALUES (?,?,?,?,?,?,?,?)",
                         (bid, crow["id"], cid, connection_store.seal_calendar_sync(settings_of(request).data_dir, bid, "ref", ref), direction, detail, int(dedicated), principal.user_id))
        conn.execute("UPDATE cal_calendars SET sync_binding_id = ?, updated_at = ?, revision = revision + 1 WHERE id = ?", (bid, model.iso(_now()), cid))
        conn.execute("UPDATE cal_connections SET next_sync_at = NULL WHERE id = ? AND state IN ('ok','error')", (crow["id"],))  # due on the next scheduler tick
        _audit(conn, principal, request, "calendar.binding.set", "calendar", cid, direction=direction, detail=detail, dedicated=dedicated, connection_id=crow["id"])
        return {"binding": {"id": bid, "connection_id": crow["id"], "calendar_id": cid, "direction": direction, "detail": detail, "dedicated": dedicated}}


@router.get("/calendar/sync/flags")
def sync_flags(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """CALENDARS-UI-2310: the entries the sync flagged for a human decision (C9: both kept), for the "סומנו להחלטה" list of the connections
    screen and the week view's side-by-side mark. Only calendars where the caller holds `edit`+ (the role that may resolve a flag)."""
    ctx = Ctx(conn, principal)
    out = []
    for ev in conn.execute("SELECT * FROM cal_events WHERE sync_flag IS NOT NULL AND state NOT IN ('cancelled','rejected','withdrawn','expired') ORDER BY starts_at LIMIT 500").fetchall():
        cal = conn.execute("SELECT * FROM cal_calendars WHERE id = ?", (ev["calendar_id"],)).fetchone()
        role = ctx.role_in(cal) if cal is not None and ctx.can_see(cal) else None
        if role is None or model.ROLE_RANK[role] < model.ROLE_RANK["edit"]:
            continue
        out.append({"event_id": ev["id"], "calendar": {"id": cal["id"], "name": cal["name"], "color": cal["color"]}, "title": ev["title"], "start": ev["starts_at"],
                    "end": ev["ends_at"], "flag": ev["sync_flag"], "source": ev["source"], "state": ev["state"], "revision": ev["revision"]})
    return {"flags": out}


@router.post("/calendar/events/{eid}/sync-resolve")
def resolve_sync_flag(eid: str, body: Body, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The human decision on an entry flagged by the sync (C9): `keep` clears the flag, `cancel` cancels the entry. Needs `edit`+ in its calendar."""
    ctx = Ctx(conn, principal, settings_of(request).data_dir)
    ev, cal, role = get_row(ctx, eid)
    d = _body(body)
    with _errors(conn, principal, request):
        if role is None or model.ROLE_RANK[role] < model.ROLE_RANK["edit"]:
            raise Denied("calendar.role", cal["id"], "edit")
        if d.get("revision") != ev["revision"]:
            raise ApiError(409, "stale", "האירוע עודכן בינתיים. רענן ונסה שוב.", details={"revision": ev["revision"]})
        resolution = model._choice(d.get("resolution"), "resolution", ("keep", "cancel"))
        if not ev["sync_flag"]:
            raise ApiError(409, "bad_state", "האירוע לא מסומן לטיפול.", details={"state": ev["state"]})
        engine.resolve_flag(conn, model.read_settings(conn), ev, resolution, principal.user_id, _now())
        _audit(conn, principal, request, "calendar.sync.resolve", "calendar_event", eid, resolution=resolution, flag=ev["sync_flag"])
        fresh = conn.execute("SELECT * FROM cal_events WHERE id = ?", (eid,)).fetchone()
        return {"event_id": eid, "state": fresh["state"], "sync_flag": fresh["sync_flag"]}


__all__ = ["router"]
