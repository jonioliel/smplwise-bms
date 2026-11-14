"""CR-INFRA-ELEVATORS - elevators under Infrastructure (`/api/v1/infra/elevators...`). View only: nothing is ever sent to the elevator.

Permissions (docs/changes/CR-INFRA-ELEVATORS.md section 4):
* reading the elevators and their live state needs `devices.read` and follows the device screens' scope rule (`ha_scope`): a floor-scoped
  viewer sees an elevator only through the sensors placed on his floors, the derivation uses only those, and an elevator with no visible
  sensor answers the same 404 as one that does not exist. Operator routes speak in role keys and labels, never entity ids.
* defining, editing, ordering and deleting elevators needs `infra.elevators.manage` (installation scope); only these routes and the
  manage listing return entity ids. Every linked sensor must be a `binary_sensor.*` the setter may see.
Audit rows carry ids only (no names, no entity ids)."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..db import new_id, now_iso
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, require
from ..services import elevators as el
from ..services import ha_scope

router = APIRouter()
READ, MANAGE = "devices.read", "infra.elevators.manage"


def _err(status: int, code: str, **details: Any) -> ApiError:
    m = el.MESSAGES[code]
    return ApiError(status, code, m["he"], details={**details, "message_en": m["en"]})


class _Body(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ExtraIn(_Body):
    entity_id: str = Field(min_length=3, max_length=255)
    label: str = Field(min_length=1, max_length=40)


class ElevatorIn(_Body):
    name: str = Field(min_length=1, max_length=60)
    area_id: str | None = Field(default=None, max_length=128)
    enabled: bool = True
    show_travel: bool = False
    sensors: dict[str, str | None] = Field(default_factory=dict)
    extras: list[ExtraIn] = Field(default_factory=list)
    revision: int | None = None


class OrderIn(_Body):
    ids: list[str] = Field(max_length=200)


def _manage_ro(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Principal:
    require(conn, principal, MANAGE, INSTALLATION)
    return principal


def _manage_w(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Principal:
    require(conn, principal, MANAGE, INSTALLATION)
    return principal


def _area_name(conn: sqlite3.Connection, area_id: str | None) -> str | None:
    if not area_id:
        return None
    r = conn.execute("SELECT name FROM ha_areas WHERE area_id = ?", (area_id,)).fetchone()
    return r["name"] if r else None


def _visible_rows(conn: sqlite3.Connection, principal: Principal, whole: set[str] | None = None) -> tuple[list[sqlite3.Row], dict[str, list[sqlite3.Row]]]:
    """The enabled elevators the caller may see, each with only the sensors he may see (raises the audited 403 without devices.read).
    `whole`, when given, receives the ids of the elevators whose sensors he sees ALL of (the history is derived from every sensor, so only those
    elevators may show it - a floor-scoped viewer never learns a state through the bar that his own sensors could not give him)."""
    wide, floors = ha_scope.visible_floors(conn, principal, READ)
    if not wide and not floors:
        require(conn, principal, READ, INSTALLATION)
    rows = conn.execute("SELECT * FROM infra_elevators WHERE enabled = 1 ORDER BY sort_order, name_key, id").fetchall()
    every = el.sensors_of(conn, [r["id"] for r in rows])
    sensors = every
    if not wide:
        placed = ha_scope.placements(conn)
        sensors = {k: [s for s in v if ha_scope.entity_visible(False, floors, placed, s["entity_id"])] for k, v in every.items()}
    sensors = {k: v for k, v in sensors.items() if v}
    if whole is not None:
        whole.update(k for k, v in sensors.items() if len(v) == len(every.get(k, [])))
    return [r for r in rows if r["id"] in sensors], sensors


def _window(hours: int) -> tuple[str, str]:
    import datetime as dt

    from ..services.timeutil import iso_utc

    hi = dt.datetime.now(dt.timezone.utc)
    return iso_utc(hi - dt.timedelta(hours=hours)), iso_utc(hi)


def _with_history(conn: sqlite3.Connection, items: list[dict[str, Any]], whole: set[str], hours: int) -> None:
    """Adds `history` (segments, 2.8.0) to the items the caller may see whole; None for the others (the screen draws no bar)."""
    lo, hi = _window(hours)
    try:
        hist = el.history(conn, [i["id"] for i in items if i["id"] in whole], lo, hi)
    except sqlite3.Error:  # before migration 0119
        hist = {}
    for i in items:
        i["history"] = hist.get(i["id"]) if i["id"] in whole else None


def _operator_out(conn: sqlite3.Connection, r: sqlite3.Row, sensors: list[sqlite3.Row], connected: bool) -> dict[str, Any]:
    return {"id": r["id"], "name": r["name"], "area_id": r["area_id"], "area_name": _area_name(conn, r["area_id"]), **el.live_of(sensors, connected=connected, travel=bool(r["show_travel"])), "uses_travel": bool(r["show_travel"])}


@router.get("/infra/elevators")
def list_elevators(history: int = Query(0, ge=0, le=24), principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """Every enabled elevator the caller may see with its derived live state, plus a summary for the home tile. Empty = feature absent.
    `history=24` (2.8.0) adds each elevator's state segments of the last 24 hours (only 24 is offered; 0 = none)."""
    whole: set[str] = set()
    rows, sensors = _visible_rows(conn, principal, whole)
    connected = el.mirror_connected()
    items = [_operator_out(conn, r, sensors[r["id"]], connected) for r in rows]
    if history:
        if history not in el.HISTORY_HOURS:
            raise ApiError(422, "validation", "טווח היסטוריה לא נתמך.", details={"fields": ["history"], "message_en": "Unsupported history range."})
        _with_history(conn, items, whole, history)
    return {"elevators": items, "summary": el.summary([i["state"] for i in items]), "stale": not connected, "at": now_iso()}


# ---------------------------------------------------------------- manage (registered before /{elevator_id})

def _entity_name(r: sqlite3.Row) -> str:
    return r["e_name"] or r["e_original"] or ""


def _manage_out(conn: sqlite3.Connection, r: sqlite3.Row, sensors: list[sqlite3.Row], connected: bool) -> dict[str, Any]:
    fixed = {s["role"]: {"entity_id": s["entity_id"], "entity_name": _entity_name(s), "missing": s["domain"] is None or bool(s["removed_at"])} for s in sensors if s["role"] != "extra"}
    extras = [{"entity_id": s["entity_id"], "label": s["label"] or "", "entity_name": _entity_name(s), "missing": s["domain"] is None or bool(s["removed_at"])} for s in sensors if s["role"] == "extra"]
    # the live fields first: the manage listing's `extras` is the mapping (entity id + label), not the live on / off
    return {**el.live_of(sensors, connected=connected, travel=bool(r["show_travel"])), "id": r["id"], "name": r["name"], "area_id": r["area_id"], "area_name": _area_name(conn, r["area_id"]),
            "enabled": bool(r["enabled"]), "show_travel": bool(r["show_travel"]), "sort_order": r["sort_order"], "revision": r["revision"], "sensors": fixed, "extras": extras}


@router.get("/infra/elevators/manage")
def manage_list(principal: Principal = Depends(_manage_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    rows = conn.execute("SELECT * FROM infra_elevators ORDER BY sort_order, name_key, id").fetchall()
    sensors, connected = el.sensors_of(conn, [r["id"] for r in rows]), el.mirror_connected()
    return {"elevators": [_manage_out(conn, r, sensors.get(r["id"], []), connected) for r in rows], "roles": list(el.ROLES), "max_extras": el.MAX_EXTRAS}


@router.get("/infra/elevators/candidates")
def candidates(q: str = Query("", max_length=80), principal: Principal = Depends(_manage_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The binary sensors the setter may link (devices.read scope), for the per-role select of the settings dialog."""
    rows = conn.execute(
        "SELECT entity_id, name, original_name, device_class, area_name FROM ha_entities WHERE domain = 'binary_sensor' AND removed_at IS NULL AND disabled = 0 ORDER BY name, entity_id"
    ).fetchall()
    items = [{"entity_id": r["entity_id"], "name": r["name"] or r["original_name"] or r["entity_id"], "device_class": r["device_class"], "area_name": r["area_name"]} for r in rows]
    items, _ = ha_scope.scoped_rows(conn, principal, READ, items)
    needle = q.strip().casefold()
    if needle:
        items = [i for i in items if needle in i["name"].casefold() or needle in i["entity_id"].casefold()]
    return {"items": items[:500]}


# ---------------------------------------------------------------- 2.8.0: alert settings (owner decision 2026-10-18; services/elevator_alerts.py)

CONFIGURE = "system.configure"
NOTIFY_MANAGE = "notify.manage"  # also needed to add WhatsApp (GENELEV-295)


class AlertRecipientsIn(_Body):
    roles: list[str] = Field(default_factory=list, max_length=10)
    users: list[str] = Field(default_factory=list, max_length=100)
    groups: list[str] = Field(default_factory=list, max_length=20)


class AlertStateIn(_Body):
    enabled: bool | None = None
    recipients: AlertRecipientsIn | None = None
    channels: list[str] | None = Field(default=None, max_length=5)


class AlertsIn(_Body):
    enabled: bool | None = None
    states: dict[str, AlertStateIn] | None = None
    row_version: int | None = None


def _alerts_reader(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Principal:
    """Reading the alert settings: the elevator managers and the system configurators (who may change them)."""
    if not authorize(conn, principal, MANAGE, INSTALLATION).allowed:
        require(conn, principal, CONFIGURE, INSTALLATION)
    return principal


def _alerts_writer(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Principal:
    require(conn, principal, CONFIGURE, INSTALLATION)  # owner: changing the elevator alerts needs the system-settings permission
    return principal


@router.get("/infra/elevators/alerts")
def get_alerts(principal: Principal = Depends(_alerts_reader), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The elevator alert settings: master switch, per-state switches (all default off), recipients (roles / users / groups) and channels."""
    from ..services import elevator_alerts

    return {**elevator_alerts.view(conn), "can_edit": authorize(conn, principal, CONFIGURE, INSTALLATION).allowed,
            "can_whatsapp": authorize(conn, principal, NOTIFY_MANAGE, INSTALLATION).allowed}


@router.put("/infra/elevators/alerts")
def put_alerts(body: AlertsIn, principal: Principal = Depends(_alerts_writer), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Saves the alert settings (system.configure; audited, ids only). Turning a state off closes its open elevator notifications with the visible
    resolution "התראות המעליות כובו"; turning one on notifies only transitions that happen from now on."""
    from ..services import elevator_alerts

    raw = body.model_dump(exclude_none=True)
    if elevator_alerts.whatsapp_change(elevator_alerts.load(conn), raw):
        # WhatsApp is an external, budget-limited channel shared with the tickets module (NOTIFWA): adding it, or changing who it reaches, needs notify.manage too
        require(conn, principal, NOTIFY_MANAGE, INSTALLATION)
    try:
        out = elevator_alerts.save(conn, principal, body.model_dump(exclude_none=True))
    except elevator_alerts.AlertsInvalid as e:
        raise ApiError(409 if e.code == "revision_conflict" else 422, e.code, e.message, details={**e.details, "message_en": e.message_en}) from None
    return {**out, "can_edit": True, "can_whatsapp": authorize(conn, principal, NOTIFY_MANAGE, INSTALLATION).allowed}


def _validate(conn: sqlite3.Connection, principal: Principal, body: ElevatorIn) -> list[tuple[str, int, str, str | None]]:
    if body.area_id and conn.execute("SELECT 1 FROM ha_areas WHERE area_id = ?", (body.area_id,)).fetchone() is None:
        raise _err(422, "area_not_found", fields=["area_id"])
    unknown = [k for k in body.sensors if k not in el.ROLES]
    if unknown:
        raise ApiError(422, "validation", "תפקיד חיישן לא מוכר.", details={"fields": [f"sensors.{k}" for k in unknown], "message_en": "Unknown sensor role."})
    if len(body.extras) > el.MAX_EXTRAS:
        raise _err(422, "too_many_extras", fields=["extras"])
    out: list[tuple[str, int, str, str | None]] = [(role, 0, eid.strip(), None) for role, eid in body.sensors.items() if eid and eid.strip()]
    for i, x in enumerate(body.extras):
        if not x.label.strip():
            raise _err(422, "extra_label", fields=[f"extras.{i}.label"])
        out.append(("extra", i, x.entity_id.strip(), x.label.strip()))
    if not out:
        raise _err(422, "no_sensor", fields=["sensors"])
    seen: set[str] = set()
    placed: ha_scope.Placements | None = None
    wide, floors = ha_scope.visible_floors(conn, principal, READ)
    for role, pos, eid, _label in out:
        field = f"extras.{pos}.entity_id" if role == "extra" else f"sensors.{role}"
        if not eid.startswith("binary_sensor.") or eid.count(".") != 1:
            raise _err(422, "not_binary_sensor", fields=[field])
        if eid in seen:
            raise _err(422, "duplicate_sensor", fields=[field])
        seen.add(eid)
        exists = conn.execute("SELECT 1 FROM ha_entities WHERE entity_id = ? AND domain = 'binary_sensor' AND removed_at IS NULL", (eid,)).fetchone()
        if not wide and placed is None:
            placed = ha_scope.placements(conn)
        # an entity the setter may not see answers exactly like one that does not exist
        if exists is None or not ha_scope.entity_visible(wide, floors, placed or {}, eid):
            raise _err(422, "sensor_not_found", fields=[field])
    return out


def _name_taken(conn: sqlite3.Connection, name: str, except_id: str | None = None) -> bool:
    r = conn.execute("SELECT id FROM infra_elevators WHERE name_key = ?", (el.name_key(name),)).fetchone()
    return r is not None and r["id"] != except_id


def _write_sensors(conn: sqlite3.Connection, elevator_id: str, sensors: list[tuple[str, int, str, str | None]]) -> None:
    conn.execute("DELETE FROM infra_elevator_sensors WHERE elevator_id = ?", (elevator_id,))
    conn.executemany("INSERT INTO infra_elevator_sensors (elevator_id, role, position, entity_id, label) VALUES (?, ?, ?, ?, ?)",
                     [(elevator_id, role, pos, eid, label) for role, pos, eid, label in sensors])


def _one(conn: sqlite3.Connection, elevator_id: str) -> sqlite3.Row:
    r = conn.execute("SELECT * FROM infra_elevators WHERE id = ?", (elevator_id,)).fetchone()
    if r is None:
        raise _err(404, "elevator_not_found")
    return r


def _manage_one(conn: sqlite3.Connection, elevator_id: str) -> dict[str, Any]:
    return _manage_out(conn, _one(conn, elevator_id), el.sensors_of(conn, [elevator_id]).get(elevator_id, []), el.mirror_connected())


@router.post("/infra/elevators", status_code=201)
def create(body: ElevatorIn, principal: Principal = Depends(_manage_w), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    name = " ".join(body.name.split())
    if not name:
        raise ApiError(422, "validation", "יש לתת שם.", details={"fields": ["name"], "message_en": "A name is required."})
    sensors = _validate(conn, principal, body)
    if _name_taken(conn, name):
        raise _err(409, "duplicate_name", fields=["name"])
    eid, at = new_id(), now_iso()
    nxt = conn.execute("SELECT COALESCE(MAX(sort_order), -1) + 1 FROM infra_elevators").fetchone()[0]
    conn.execute("INSERT INTO infra_elevators (id, name, name_key, area_id, sort_order, enabled, show_travel, revision, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)",
                 (eid, name, el.name_key(name), body.area_id or None, nxt, 1 if body.enabled else 0, 1 if body.show_travel else 0, at, at))
    _write_sensors(conn, eid, sensors)
    audit(conn, actor=principal, action="infra.elevator.create", decision="allowed", resource_type="infra_elevator", resource_id=eid)
    return _manage_one(conn, eid)


@router.put("/infra/elevators/order")
def reorder(body: OrderIn, principal: Principal = Depends(_manage_w), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    have = {r[0] for r in conn.execute("SELECT id FROM infra_elevators").fetchall()}
    if set(body.ids) != have or len(body.ids) != len(have):
        raise _err(422, "order_mismatch", fields=["ids"])
    conn.executemany("UPDATE infra_elevators SET sort_order = ? WHERE id = ?", [(i, x) for i, x in enumerate(body.ids)])
    audit(conn, actor=principal, action="infra.elevator.reorder", decision="allowed", resource_type="infra_elevator", details={"ids": body.ids})
    return manage_list(principal, conn)


@router.put("/infra/elevators/{elevator_id}")
def update(elevator_id: str, body: ElevatorIn, principal: Principal = Depends(_manage_w), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    cur = _one(conn, elevator_id)
    if body.revision is not None and body.revision != cur["revision"]:
        raise _err(409, "revision_conflict", revision=cur["revision"])
    name = " ".join(body.name.split())
    if not name:
        raise ApiError(422, "validation", "יש לתת שם.", details={"fields": ["name"], "message_en": "A name is required."})
    sensors = _validate(conn, principal, body)
    if _name_taken(conn, name, elevator_id):
        raise _err(409, "duplicate_name", fields=["name"])
    conn.execute("UPDATE infra_elevators SET name = ?, name_key = ?, area_id = ?, enabled = ?, show_travel = ?, revision = revision + 1, updated_at = ? WHERE id = ?",
                 (name, el.name_key(name), body.area_id or None, 1 if body.enabled else 0, 1 if body.show_travel else 0, now_iso(), elevator_id))
    _write_sensors(conn, elevator_id, sensors)
    audit(conn, actor=principal, action="infra.elevator.update", decision="allowed", resource_type="infra_elevator", resource_id=elevator_id)
    return _manage_one(conn, elevator_id)


@router.delete("/infra/elevators/{elevator_id}", status_code=204)
def delete(elevator_id: str, principal: Principal = Depends(_manage_w), conn: sqlite3.Connection = Depends(get_conn)) -> None:
    _one(conn, elevator_id)
    from ..services import elevators_runtime

    elevators_runtime.resolve_all(conn, elevator_id)  # 2.8.0: its open notifications end with it (the memory rows would cascade anyway)
    try:
        conn.execute("DELETE FROM infra_elevator_states WHERE elevator_id = ?", (elevator_id,))
    except sqlite3.Error:  # before migration 0119
        pass
    conn.execute("DELETE FROM infra_elevator_sensors WHERE elevator_id = ?", (elevator_id,))
    conn.execute("DELETE FROM infra_elevators WHERE id = ?", (elevator_id,))
    audit(conn, actor=principal, action="infra.elevator.delete", decision="allowed", resource_type="infra_elevator", resource_id=elevator_id)


@router.get("/infra/elevators/{elevator_id}")
def get_one(elevator_id: str, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    rows, sensors = _visible_rows(conn, principal)
    r = next((x for x in rows if x["id"] == elevator_id), None)
    if r is None:
        raise _err(404, "elevator_not_found")
    return _operator_out(conn, r, sensors[r["id"]], el.mirror_connected())
