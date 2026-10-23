"""CR-LIVEEVENT100 (board r100): the live event mode routes (services/incidents.py is the model).

Module switch (default OFF, `incident.enabled`): while off every `/incidents*` route answers 404 `feature_disabled` before any permission
check - except `GET /incidents/summary` (the shell's pill / dots: `enabled: false`, nothing else) and `GET|PUT /incidents/settings` (the
settings card, where the switch itself is turned on).

* `GET  /incidents/settings`              every setting + its bounds; `can_edit` = system.configure
* `PUT  /incidents/settings`              system.configure; partial; every bound checked (422); audited `incident.settings` / `incident.module.*`
* `GET  /incidents/summary`               open incidents this viewer may read (count, newest) - navigation only, no audit
* `GET  /incidents?status=open|closed|all` the list (events.read at each incident's floor)
* `POST /incidents`                       open manually ({floor_id, x, y, title}) or from an event ({event_id}); events.ack at the floor / camera
* `GET  /incidents/{id}`                  head + chain of handling (events.read at the floor)
* `GET  /incidents/{id}/cameras`          the nearest cameras the caller may watch live (video.live per camera)
* `GET  /incidents/{id}/doors`            the doors near it (state: entity.state.read; who opened: access.events.read per station)
* `POST /incidents/{id}/ack|note|close`   events.ack at the floor; audited

Read-only towards the building: no route here opens a door, arms / disarms an alarm, moves a camera or sends a notification by hand."""
from __future__ import annotations

import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, require
from ..services import incidents as svc
from ..services.access import require_camera

router = APIRouter()

CONFIGURE = "system.configure"
READ, ACK = "events.read", "events.ack"


def _off() -> ApiError:
    return ApiError(404, "feature_disabled", "מצב אירוע חי כבוי בהגדרות המערכת.")


def _gate(conn: sqlite3.Connection) -> None:
    if not svc.module_on(conn):
        raise _off()


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _incident(conn: sqlite3.Connection, principal: Principal, incident_id: str, permission: str) -> sqlite3.Row:
    """The incident when the caller holds events.read and `permission` at its floor (the installation when it has none) - the audited
    403 otherwise, like the event page (CR §7 B-03); 404 for an unknown id."""
    row = svc.get(conn, incident_id[:64])
    if row is None:
        raise ApiError(404, "incident_not_found", "האירוע לא נמצא.")
    require(conn, principal, READ, svc.target_of(row))
    if permission != READ:
        require(conn, principal, permission, svc.target_of(row))
    return row


# ---------------------------------------------------------------- settings

@router.get("/incidents/settings")
def get_settings(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    return {"settings": svc.read_settings(conn), "bounds": svc.bounds(), "can_edit": authorize(conn, principal, CONFIGURE, INSTALLATION).allowed,
            "notify_source": "incident.opened", "policy": svc.POLICY}


class SettingsIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    settings: dict[str, Any] = Field(max_length=len(svc.SETTINGS))


@router.put("/incidents/settings")
def put_settings(body: SettingsIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, CONFIGURE, INSTALLATION)
    try:
        changes = svc.validate_patch(body.settings)
    except ValueError as exc:
        key = str(exc)
        raise ApiError(422, "validation", "ערך לא תקין בהגדרות מצב אירוע חי.", details={"field": key, "bounds": svc.bounds().get(key)}) from None
    diff = svc.write_settings(conn, changes)
    if svc.ENABLED in diff:
        audit(conn, actor=principal, action="incident.module.enable" if diff[svc.ENABLED]["to"] else "incident.module.disable", decision="allowed",
              resource_type="installation", resource_id="incidents", request_id=_rid(request))
    if diff:
        audit(conn, actor=principal, action="incident.settings", decision="allowed", resource_type="installation", resource_id="incidents", request_id=_rid(request),
              details=diff)
    return {"settings": svc.read_settings(conn), "bounds": svc.bounds(), "can_edit": True, "changed": sorted(diff)}


# ---------------------------------------------------------------- the shell

@router.get("/incidents/summary")
def summary(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    return svc.summary(conn, principal)


# ---------------------------------------------------------------- list / open

@router.get("/incidents")
def list_incidents(status: Literal["open", "closed", "all"] = "all", limit: int = Query(50, ge=1, le=200), principal: Principal = Depends(current_principal_ro),
                   conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _gate(conn)
    if not authorize(conn, principal, READ, INSTALLATION).allowed and not _reads_anywhere(conn, principal):
        require(conn, principal, READ, INSTALLATION)  # the audited 403: no events.read anywhere
    rows = svc.visible(conn, principal, status=status, limit=limit)
    cfg = svc.read_settings(conn)
    return {"incidents": [svc.serialize(conn, r, principal, with_chain=False) for r in rows], "retention_days": cfg["incidents.retention_days"],
            "can_open": _acks_anywhere(conn, principal), "can_configure": authorize(conn, principal, CONFIGURE, INSTALLATION).allowed,
            "settings": {k: cfg[k] for k in ("incident.header_clock", "incident.red_dot", "incident.refresh_s")}}


def _reads_anywhere(conn: sqlite3.Connection, principal: Principal) -> bool:
    from ..rbac import permissions_anywhere

    return READ in set(permissions_anywhere(conn, principal))


def _acks_anywhere(conn: sqlite3.Connection, principal: Principal) -> bool:
    from ..rbac import permissions_anywhere

    return ACK in set(permissions_anywhere(conn, principal))


class OpenIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    event_id: str | None = Field(default=None, min_length=1, max_length=64)
    anchor_id: str | None = Field(default=None, min_length=1, max_length=64)  # the map's "open here" (a camera / device marker)
    alarm_panel: str | None = Field(default=None, min_length=1, max_length=255, pattern=r"^alarm_control_panel\.[a-z0-9_]+$")  # the alarm screen's button
    floor_id: str | None = Field(default=None, min_length=1, max_length=64)
    x: float | None = Field(default=None, ge=0, le=1)
    y: float | None = Field(default=None, ge=0, le=1)
    title: str | None = Field(default=None, max_length=svc.TITLE_MAX)


@router.post("/incidents", status_code=201)
def open_incident(body: OpenIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _gate(conn)
    if body.event_id:
        ev = conn.execute("SELECT id, camera_id, type, occurred_at, source, details_json FROM events WHERE id = ?", (body.event_id,)).fetchone()
        if ev is None:
            raise ApiError(404, "not_found", "האירוע לא נמצא.")
        if ev["camera_id"]:
            require_camera(conn, principal, ev["camera_id"], ACK)
        else:
            require(conn, principal, ACK, INSTALLATION)
        anchor = svc.anchor_of(conn, "camera", ev["camera_id"]) if ev["camera_id"] else None
        if anchor is None and ev["source"] == "ha":
            import json

            eid = (json.loads(ev["details_json"] or "{}") or {}).get("entity_id")
            anchor = svc.anchor_of(conn, "ha_entity", eid) if eid else None
        label = svc.EVENT_TYPE_HE.get(ev["type"], ev["type"])
        cam_name = svc._camera_names(conn).get(ev["camera_id"]) if ev["camera_id"] else None
        title = (body.title or "").strip() or (f"{label} · {cam_name}" if cam_name else label)
        try:
            row, merged = svc.open_incident(conn, source="event", title=title, floor_id=anchor["floor_id"] if anchor else None, x=anchor["x"] if anchor else None,
                                            y=anchor["y"] if anchor else None, anchor_id=anchor["id"] if anchor else None, source_ref=ev["id"],
                                            source_camera=ev["camera_id"], actor=principal, request_id=_rid(request), event_label=label)
        except svc.Disabled:
            raise _off() from None
    elif body.anchor_id:
        a = svc.anchor_row(conn, body.anchor_id)
        if a is None:
            raise ApiError(404, "not_found", "הסמן לא נמצא על המפה.")
        require(conn, principal, ACK, ("floor", a["floor_id"]))
        if a["resource_type"] == "camera":
            name = svc._camera_names(conn).get(a["resource_id"], a["label"] or a["resource_id"])
        else:
            e = conn.execute("SELECT name FROM ha_entities WHERE entity_id = ?", (a["resource_id"],)).fetchone()
            name = (e["name"] if e and e["name"] else None) or a["label"] or a["resource_id"]
        try:
            row, merged = svc.open_incident(conn, source="manual", title=(body.title or "").strip() or f"אירוע ידני · {name}", floor_id=a["floor_id"], x=a["x"], y=a["y"],
                                            anchor_id=a["id"], source_ref=a["resource_id"], source_camera=a["resource_id"] if a["resource_type"] == "camera" else None,
                                            actor=principal, request_id=_rid(request))
        except svc.Disabled:
            raise _off() from None
    elif body.alarm_panel:
        if conn.execute("SELECT 1 FROM ha_entities WHERE entity_id = ? AND removed_at IS NULL", (body.alarm_panel,)).fetchone() is None:
            raise ApiError(404, "not_found", "לוח האזעקה לא נמצא.")
        anchor, title = svc.alarm_location(conn, body.alarm_panel)
        require(conn, principal, ACK, ("floor", anchor["floor_id"]) if anchor else INSTALLATION)
        try:
            row, merged = svc.open_incident(conn, source="alarm", title=(body.title or "").strip() or title, floor_id=anchor["floor_id"] if anchor else None,
                                            x=anchor["x"] if anchor else None, y=anchor["y"] if anchor else None, anchor_id=anchor["id"] if anchor else None,
                                            source_ref=body.alarm_panel, actor=principal, request_id=_rid(request), event_label="אזעקת פריצה")
        except svc.Disabled:
            raise _off() from None
    else:
        if not body.floor_id:
            raise ApiError(422, "validation", "יש לבחור קומה או אירוע.", details={"field": "floor_id"})
        fl = svc.floor_info(conn, body.floor_id)
        if fl is None:
            raise ApiError(404, "not_found", "הקומה לא נמצאה.")
        require(conn, principal, ACK, ("floor", fl["id"]))
        if (body.x is None) != (body.y is None):
            raise ApiError(422, "validation", "נקודה על התוכנית: x ו־y יחד.", details={"field": "x"})
        try:
            row, merged = svc.open_incident(conn, source="manual", title=(body.title or "").strip() or "אירוע ידני", floor_id=fl["id"], x=body.x, y=body.y,
                                            actor=principal, request_id=_rid(request))
        except svc.Disabled:
            raise _off() from None
    return {"incident": svc.serialize(conn, row, principal), "merged": merged}


# ---------------------------------------------------------------- one incident

@router.get("/incidents/{incident_id}")
def get_incident(incident_id: str, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _gate(conn)
    row = _incident(conn, principal, incident_id, READ)
    out = svc.serialize(conn, row, principal)
    cfg = svc.read_settings(conn)
    out["settings"] = {k: cfg[k] for k in svc.CLIENT_KEYS}
    out["policy"] = svc.POLICY
    return out


@router.get("/incidents/{incident_id}/cameras")
def incident_cameras(incident_id: str, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _gate(conn)
    row = _incident(conn, principal, incident_id, READ)
    out = svc.cameras_panel(conn, row, principal)
    if out["withheld"]:
        raise ApiError(403, "forbidden", "וידאו חי אינו זמין לך.", details={"permission": "video.live"})
    return out


@router.get("/incidents/{incident_id}/doors")
def incident_doors(incident_id: str, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _gate(conn)
    row = _incident(conn, principal, incident_id, READ)
    return svc.doors_panel(conn, row, principal)


@router.post("/incidents/{incident_id}/ack")
def ack_incident(incident_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _gate(conn)
    row = _incident(conn, principal, incident_id, ACK)
    if row["status"] != "open":
        raise ApiError(409, "incident_closed", "האירוע כבר נסגר.")
    svc.ack(conn, row, principal, _rid(request))
    return svc.serialize(conn, svc.get(conn, row["id"]), principal)


class NoteIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str = Field(min_length=1, max_length=svc.NOTE_MAX)


@router.post("/incidents/{incident_id}/note")
def note_incident(incident_id: str, body: NoteIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _gate(conn)
    row = _incident(conn, principal, incident_id, ACK)
    if not body.text.strip():
        raise ApiError(422, "validation", "ההערה ריקה.", details={"field": "text"})
    if row["status"] != "open":
        raise ApiError(409, "incident_closed", "האירוע כבר נסגר.")
    svc.note(conn, row, principal, body.text, _rid(request))
    return svc.serialize(conn, row, principal)


class CloseIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    note: str | None = Field(default=None, max_length=svc.NOTE_MAX)


@router.post("/incidents/{incident_id}/close")
def close_incident(incident_id: str, request: Request, body: CloseIn | None = None, principal: Principal = Depends(current_principal),
                   conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _gate(conn)
    row = _incident(conn, principal, incident_id, ACK)
    if row["status"] != "open":
        raise ApiError(409, "incident_closed", "האירוע כבר נסגר.")
    svc.close(conn, row, principal, body.note if body else None, _rid(request))
    return svc.serialize(conn, svc.get(conn, row["id"]), principal)
