"""DEVTYPE (owner 2026-10-09): the administrator's device type of a switch-wired device.

A plain switch (or a virtual on/off helper) has no type of its own in the infrastructure, so the server guesses it from the display name -
a boiler word makes a water heater, a tap / irrigation word a valve, an outlet device class an outlet, anything else a switch
(services/device_activity.switch_equipment, activity_kind). Those word lists stay the default. Here an administrator (system.configure,
in Settings only) fixes the type of one entity or of many at once, or returns it to automatic; the fixed type wins over the guess.

Persisted in `device_type_override` (migration 0076; backed up with the project, kept by a restore of an archive written before it).
Every change is audited (`devices.device_type`, plus `devices.device_type.batch` for a group change). Presentation only: the type picks the
icon, the wording and the equipment card of the activity window; the controls and every permission stay the entity's own domain's."""
from __future__ import annotations

import sqlite3
from typing import Any

from ..audit import audit
from ..db import now_iso
from ..rbac import Principal
from .device_activity import TYPE_OVERRIDE_KINDS, activity_kind

DOMAINS = tuple(TYPE_OVERRIDE_KINDS)
ALL_KINDS: tuple[str, ...] = tuple(dict.fromkeys(k for kinds in TYPE_OVERRIDE_KINDS.values() for k in kinds))
AUTO = "auto"
BULK_MAX = 500


def overrides(conn: sqlite3.Connection) -> dict[str, str]:
    """entity id -> fixed type; empty on a database from before migration 0076."""
    try:
        return {r["entity_id"]: r["kind"] for r in conn.execute("SELECT entity_id, kind FROM device_type_override").fetchall()}
    except sqlite3.OperationalError:
        return {}


def _override_rows(conn: sqlite3.Connection) -> dict[str, dict[str, Any]]:
    try:
        return {r["entity_id"]: dict(r) for r in conn.execute("SELECT * FROM device_type_override").fetchall()}
    except sqlite3.OperationalError:
        return {}


def auto_kind(e: dict[str, Any]) -> str | None:
    """The type the name / device class give (no override)."""
    return activity_kind(e["domain"], e.get("device_class"), None, e.get("name") or e.get("original_name"))


def listing(conn: sqlite3.Connection, entities: list[dict[str, Any]], floors: list[dict[str, Any]], areas: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Every entity whose type may be fixed, with its type now, the automatic one, the fixed one (or None), who fixed it and when, and its place."""
    rows = _override_rows(conn)
    fname = {f["floor_id"]: f["name"] for f in floors}
    area_floor = {a["area_id"]: a.get("floor_id") for a in areas}
    out = []
    for e in entities:
        if e["domain"] not in TYPE_OVERRIDE_KINDS:
            continue
        eid = e["entity_id"]
        o = rows.get(eid) or {}
        fixed = o.get("kind") if o.get("kind") in TYPE_OVERRIDE_KINDS[e["domain"]] else None
        auto = auto_kind(e)
        fid = area_floor.get(e.get("area_id")) if e.get("area_id") else None
        out.append({
            "entity_id": eid, "name": e.get("name") or e.get("original_name") or eid, "domain": e["domain"], "device_class": e.get("device_class"),
            "area_id": e.get("area_id"), "area_name": e.get("area_name"), "floor_id": fid, "floor_name": fname.get(fid) if fid else None,
            "state": e.get("state"), "available": bool(e.get("available")),
            "kind": fixed or auto, "auto": auto, "set": fixed, "options": list(TYPE_OVERRIDE_KINDS[e["domain"]]),
            "set_by": o.get("set_by_username") if fixed else None, "set_at": o.get("set_at") if fixed else None,
        })
    out.sort(key=lambda r: (r["name"].casefold(), r["entity_id"]))
    return out


def refusal(domain: str | None, kind: str) -> str | None:
    """Why `kind` cannot be fixed on an entity of `domain` (None = it can): not_found / not_typeable / kind_not_allowed."""
    if domain is None:
        return "not_found"
    if domain not in TYPE_OVERRIDE_KINDS:
        return "not_typeable"
    if kind != AUTO and kind not in TYPE_OVERRIDE_KINDS[domain]:
        return "kind_not_allowed"
    return None


def domain_of(conn: sqlite3.Connection, entity_id: str) -> str | None:
    row = conn.execute("SELECT domain FROM ha_entities WHERE entity_id = ? AND removed_at IS NULL", (entity_id,)).fetchone()
    return row["domain"] if row else None


def set_kind(conn: sqlite3.Connection, principal: Principal, entity_id: str, kind: str, *, request_id: str | None = None, batch: bool = False) -> bool:
    """Fix the type (or `auto`: drop the fixed one). The caller has checked `refusal`. True when something changed; one audit row per change."""
    before = conn.execute("SELECT kind FROM device_type_override WHERE entity_id = ?", (entity_id,)).fetchone()
    before_kind = before["kind"] if before else None
    after_kind = None if kind == AUTO else kind
    if before_kind == after_kind:
        return False
    if after_kind is None:
        conn.execute("DELETE FROM device_type_override WHERE entity_id = ?", (entity_id,))
    else:
        conn.execute(
            "INSERT INTO device_type_override(entity_id, kind, set_by, set_by_username, set_at) VALUES (?,?,?,?,?) ON CONFLICT(entity_id) DO UPDATE SET kind = excluded.kind, set_by = excluded.set_by, set_by_username = excluded.set_by_username, set_at = excluded.set_at",
            (entity_id, after_kind, principal.user_id, principal.username, now_iso()),
        )
    audit(conn, actor=principal, action="devices.device_type", decision="allowed", resource_type="ha_entity", resource_id=entity_id, request_id=request_id,
          details={"kind": kind, "before": before_kind or AUTO, **({"batch": True} if batch else {})})
    return True
