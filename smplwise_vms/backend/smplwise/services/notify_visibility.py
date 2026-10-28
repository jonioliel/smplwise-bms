"""Who may see (and acknowledge) a notification (CR-018 section 7): the ONE function behind every recipient decision.

A notification reaches only a user who may see its SUBJECT, evaluated per subject kind at creation, at every delivery
attempt and at every inbox read - never cached across requests, so a revoked binding hides old rows at once. The rules
are the product's existing ones, not new ones:

| subject            | visible when                                                                                     |
|--------------------|--------------------------------------------------------------------------------------------------|
| camera             | row_scope(events.read) allows the camera (services/access)                                       |
| entity / area      | devices.read on the entity's placement (services/ha_scope), catalogued entities only             |
| alarm_panel        | alarm.view on the panel's own placement (a shared room's mirror never widens it)                 |
| door (WisKey)      | access.read at installation scope (stations have no site or floor)                               |
| schedule           | the owner of record, or schedule.view (installation-wide, or on one of its action entities)      |
| automation         | whoever may SEE it = automation.manage + the entities of its action targets in their floors        |
|                    | (no view-only access, owner 2026-10-01); an item that is gone: installation-wide managers          |
| bulk_job           | the initiator only                                                                               |
| energy_bills       | energy.bills (ELECBILL77)                                                                        |
| access_denied      | access.external.grant on the refused attempt's station (DENYALERT133-295)                        |
| access_visitor     | the host who invited the visitor (origin.host_user_id; EXTERNALBUILD-297)                        |
| system             | system.configure                                                                                |
| water              | water.view on the meter (floor-scoped by its entity), only while the water module is on (CR-WATER78) |
| session / security | the account's own user; a code lockout ONLY to system.configure holders (not the locked-out user)  |

A rule alert (`origin.events_scope`) keeps the rule it always had: a camera alert follows the camera scope for events.read, a
camera-less one needs installation-wide events.read (GET /rules/alerts, T055 M3).
"""
from __future__ import annotations

import json
import sqlite3
from typing import Any

from ..rbac import INSTALLATION, STATION, Principal, authorize
from . import ha_scope
from .access import row_scope

MANAGE = "notify.manage"


def principal_of(conn: sqlite3.Connection, user_id: str) -> Principal | None:
    u = conn.execute("SELECT id, username, display_name, active FROM users WHERE id = ?", (user_id,)).fetchone()
    if u is None or not u["active"]:
        return None
    return Principal(user_id=u["id"], username=u["username"] or "", display_name=u["display_name"] or "", source="push")


def is_manager(conn: sqlite3.Connection, principal: Principal) -> bool:
    return authorize(conn, principal, MANAGE, INSTALLATION).allowed


def catalogued(conn: sqlite3.Connection, entity_id: str | None) -> bool:
    """The entity is in the authorised catalogue (the devices area's rows): mirrored, not removed, not disabled or hidden."""
    if not entity_id:
        return False
    r = conn.execute("SELECT 1 FROM ha_entities WHERE entity_id = ? AND removed_at IS NULL AND disabled = 0 AND hidden = 0 AND (entity_category IS NULL OR entity_category = '')", (entity_id,)).fetchone()
    return r is not None


def note_dict(row: sqlite3.Row | dict[str, Any]) -> dict[str, Any]:
    """The fields visibility needs from a notifications row (or an already decoded dict)."""
    d = dict(row)
    origin = d.get("origin")
    if origin is None:
        try:
            origin = json.loads(d.get("origin_json") or "{}")
        except ValueError:
            origin = {}
    d["origin"] = origin if isinstance(origin, dict) else {}
    return d


class Reach:
    """One user's reach, with each scope computed lazily and once (an inbox read checks many rows)."""

    def __init__(self, conn: sqlite3.Connection, principal: Principal) -> None:
        self.conn, self.principal = conn, principal
        self._cache: dict[str, Any] = {}

    # -- cached building blocks
    def _events(self):
        if "events" not in self._cache:
            self._cache["events"] = row_scope(self.conn, self.principal, "events.read")
        return self._cache["events"]

    def _floors(self, perm: str):
        k = "floors:" + perm
        if k not in self._cache:
            self._cache[k] = ha_scope.visible_floors(self.conn, self.principal, perm)
        return self._cache[k]

    def _placed(self, own: bool):
        k = "placed_own" if own else "placed"
        if k not in self._cache:
            self._cache[k] = ha_scope.own_placements(self.conn) if own else ha_scope.placements(self.conn)
        return self._cache[k]

    def _allowed(self, perm: str, scope=INSTALLATION) -> bool:
        k = f"auth:{perm}:{scope}"
        if k not in self._cache:
            self._cache[k] = authorize(self.conn, self.principal, perm, scope).allowed
        return self._cache[k]

    def _entity(self, perm: str, entity_id: str | None, *, own: bool = False) -> bool:
        if not entity_id:
            return False
        wide, floors = self._floors(perm)
        if wide:
            return True
        if not floors:
            return False
        return ha_scope.entity_visible(False, floors, self._placed(own), entity_id)

    def _automation(self, item_id: str, origin: dict[str, Any]) -> bool:
        """CR-017: an automation's notification (`automation.failed`, `automation.notify`) is visible to exactly the callers who see the automation itself:
        holders of `automation.manage` (there is no view-only access, owner decision 2026-10-01) whose floors hold the entities of its action targets
        (`automation_scope.visible`; no typed target -> its trigger entities; neither -> installation-wide managers). The item is read from the mirror's cache
        at every decision, never from the notification; an item that is gone is seen by installation-wide managers only."""
        from . import automation_scope as scope
        from . import automation_view as view
        from . import automations as store

        key = f"automation:{item_id}"
        if key in self._cache:
            return self._cache[key]
        ctx = self._cache.get("auto_ctx")
        if ctx is None:
            ctx = self._cache["auto_ctx"] = scope.Ctx(self.conn, self.principal)
        r = store.cache_row(self.conn, "automation", item_id) if item_id else None
        if r is None:  # the item is gone (deleted, or never mirrored): its author and the installation-wide viewers still hear of it
            ok = ctx.access.wide(scope.MANAGE)
        elif not scope.holds_any(ctx, "automation"):
            ok = False
        else:
            row = view.Row(r, None, None)
            ctx.preload([row.entity_id] if row.entity_id else [])
            _, facts = view.analyse_row(ctx, row)
            ok = view.row_visible(ctx, row, facts)
        self._cache[key] = ok
        return ok

    # -- the rules
    def can_see(self, n: dict[str, Any]) -> bool:
        n = note_dict(n)
        origin = n["origin"]
        uid = self.principal.user_id
        kind = n.get("subject_kind")
        sid = n.get("subject_id")
        if origin.get("events_scope"):
            return self._events().allows_row(origin.get("camera_id"))
        if kind == "camera":
            return self._events().allows_row(sid)
        if kind == "entity":
            return catalogued(self.conn, sid) and self._entity("devices.read", sid)
        if kind == "area":
            wide, floors = self._floors("devices.read")
            if wide:
                return True
            if not floors or not sid:
                return False
            rows = self.conn.execute("SELECT entity_id FROM ha_entities WHERE area_id = ? AND removed_at IS NULL AND disabled = 0 AND hidden = 0", (sid,)).fetchall()
            return any(self._entity("devices.read", r["entity_id"]) for r in rows)
        if kind == "alarm_panel":
            return self._entity("alarm.view", sid, own=True)
        if kind == "door":
            return self._allowed("access.read")
        if kind == "automation":
            return self._automation(str(sid or ""), origin)
        if kind == "schedule":
            if origin.get("owner_user_id") == uid:
                return True
            if self._allowed("schedule.view"):
                return True
            return any(self._entity("schedule.view", e) for e in (origin.get("entity_ids") or [])[:50])
        if kind == "bulk_job":
            return n.get("initiator_user_id") == uid
        if kind == "system":
            return self._allowed("system.configure")
        if kind == "scenario":  # XSCENARIO109-295: exactly the audience the engine resolved for this row (detailed rows only to full readers)
            return uid in ((origin.get("to") or [])[:200])
        if kind == "ticket":  # CR-038: exactly who may see the ticket (services/tickets/access.visible - module on, place, department)
            from .tickets import notify_bridge

            return notify_bridge.can_see(self.conn, self.principal, sid)
        if kind == "rfq":  # TKRFQ5: exactly who may see the request (services/tickets/rfq.visible - module on, place, department, creator / owner)
            from .tickets import rfq_notify

            return rfq_notify.can_see(self.conn, self.principal, sid)
        if kind == "energy_bills":  # ELECBILL77: holders of energy.bills (installation scope) - the same permission as the bills screen
            return self._allowed("energy.bills")
        if kind == "access_denied":  # DENYALERT133-295: access.external.grant on THE station of the refused attempt (the approvers of that door)
            sid = origin.get("station_id") or sid
            return bool(sid) and authorize(self.conn, self.principal, "access.external.grant", (STATION, str(sid))).allowed
        if kind == "access_visitor":  # EXTERNALBUILD-297: the host who invited the visitor, nobody else
            return bool(origin.get("host_user_id")) and origin.get("host_user_id") == uid
        if kind == "maintenance":  # CR-MAINT215: exactly who may see the task (module on, maintenance.view on its place)
            from .maintenance import access as maintenance_access

            return maintenance_access.can_see_task(self.conn, self.principal, sid)
        if kind == "notice":  # NOTICEPUSH-295: the notice's audience, or a notice manager (the sent item in the deliveries screen)
            from .notices import push as notice_push

            return notice_push.can_see(self.conn, self.principal, sid)
        if kind == "generator":
            return self._allowed("generator.view")  # CR-031: the generator's alerts reach holders of generator.view only
        if kind == "elevator":  # CR-INFRA-ELEVATORS 2.8.0: devices.read on the sensor of THIS notification's own state (D3, review H1)
            from . import elevators

            src = str(n.get("source") or "")
            role = src.split(".", 1)[1] if src.startswith("elevator.") else None
            return elevators.visible_to(self.conn, lambda eid: self._entity("devices.read", eid), sid, role)
        if kind == "temperature":  # CR-INFRA-TEMPERATURE 2.9.1: devices.read on the unit's temperature sensor (and the door sensor, when linked)
            from . import temperature_access

            return temperature_access.visible_to(self.conn, lambda eid: self._entity("devices.read", eid), sid)
        if kind == "water":  # CR-WATER78 slice 2: water.view on the meter (floor-scoped by its entity, owner Q5), only while the module is on
            from . import water_alerts, water_meters

            if not water_alerts.module_on(self.conn) or not sid:
                return False
            reach = self._cache.get("water_reach")
            if reach is None:
                reach = self._cache["water_reach"] = water_meters.Reach(self.conn, self.principal)
            row = self.conn.execute("SELECT source_ref FROM water_meters WHERE id = ?", (sid,)).fetchone()
            return row is not None and reach.sees(row)
        if kind == "incident":  # CR-LIVEEVENT100: exactly who may read the incident - events.read at its floor (installation without one)
            fid = origin.get("floor_id")
            return self._allowed("events.read", ("floor", str(fid)) if fid else INSTALLATION)
        if kind == "session":
            if str(n.get("source") or "") == "security.lockout":
                return self._allowed("system.configure")  # administrators ONLY: the locked-out account is not told (and cannot acknowledge it)
            return sid == uid
        return False

    def can_ack(self, n: dict[str, Any]) -> bool:
        """Acknowledge (shared): events.ack for camera / rule rows, alarm.view for alarm and safety rows, the recipient itself
        for personal rows; any other visible row may be acknowledged by a recipient. Always requires visibility."""
        n = note_dict(n)
        if not self.can_see(n):
            return False
        origin = n["origin"]
        kind = n.get("subject_kind")
        if origin.get("events_scope") or kind == "camera":
            cam = origin.get("camera_id") if origin.get("events_scope") else n.get("subject_id")
            return authorize(self.conn, self.principal, "events.ack", ("camera", cam) if cam else INSTALLATION).allowed
        if kind == "alarm_panel":
            return self._entity("alarm.view", n.get("subject_id"), own=True)
        if kind == "incident":  # CR-LIVEEVENT100: the same right as the incident's own acknowledge
            fid = origin.get("floor_id")
            return self._allowed("events.ack", ("floor", str(fid)) if fid else INSTALLATION)
        if n.get("category") == "safety":
            return self._entity("alarm.view", n.get("subject_id")) if kind == "entity" else self._allowed("alarm.view")
        return True

    def door(self, n: dict[str, Any]) -> dict[str, Any] | None:
        """A doorbell row's deep-link target for "פתח דלת": {id, name, can_open}. can_open = the caller may use the existing
        release path (access.doors.open at installation scope - WXPERM; a custom role's legacy access.release counts through
        rbac.LEGACY_PERMISSIONS) - it only decides whether the in-app confirmation is offered;
        the confirmation itself calls that route, which checks it again. Never a token, never an action."""
        n = note_dict(n)
        if n.get("source") != "door.ring" or n.get("subject_kind") != "door" or not n.get("subject_id"):
            return None
        params = n.get("params") or {}
        return {"id": str(n["subject_id"]), "name": str(params.get("name") or params.get("place") or ""), "can_open": self._allowed("access.doors.open")}
