"""Bulk actions of the devices area (CR-007 slice 3): "turn off the lights / close the covers / turn off the climate /
turn off the screens / turn everything off" for the building, one HA floor or one HA area.

Many physical devices change from one click, so this module is deliberately narrow:

- **The entity set is resolved here, on the server**, from the same projection the tree uses (services/devices.py
  `load_entities` + `load_structure`: no disabled, hidden, removed or config / diagnostic entity), narrowed to the
  entities the caller holds `devices.control_bulk` for (the entity's own placement, as every devices permission), and
  then to the domains of the requested kind - see KINDS. Only the everyday domains ever appear
  (ha_scope.DEVICES_CONTROL_DOMAINS); NEVER a lock, an alarm panel, a siren, a script, a scene or a button, never a
  door / garage / gate cover, never a cover or switch placed on the map's door layer. A SWITCH enters only when an
  administrator marked it bulk-safe (device_bulk_safe, system.configure) - CR-007 s3 forbids door release in bulk and a
  maglock relay is a switch too. A Plan Studio lighting circuit never grants that by itself (drawing one needs only
  map editing); it only makes the screens suggest the mark (review round 2). Every other switch is listed as "not
  included" with the reason; a mark is cleared when its entity leaves Home Assistant (clear_stale_marks). input_booleans (HA flags, not devices) never enter.
  The import-time check below fails the add-on's start if KINDS ever names anything else.
- An entity already in the target state (HA's last report) or unavailable is not sent: an "off" to a light that is
  already off could never be confirmed, and would only turn an honest result into noise. Both are counted.
- **Each entity is one ordinary ha_actions record** (via 'bulk', linked by bulk_id) - the same allow-list entry,
  argument validation, signed bridge call, per-user HA context and confirmation rules as a single action
  (services/ha_actions.py). Nothing goes through the WisKey feed.
- **Bounded**: at most BULK_MAX_IN_FLIGHT bridge calls in flight across ALL running bulks (a 200-light floor never
  storms Home Assistant, and single-entity actions, which never take these slots, are never starved); one bulk per
  scope at a time, and never two running bulks that share an entity (409 `bulk_in_progress`).
- **Honest outcome** per entity: queued (not sent yet), accepted (HA took the call, effect not reported yet),
  confirmed (HA reported the state), not_confirmed (the window passed and HA reports another state), refused (HA / the
  bridge said no, or it was never sent - the request expired, or the add-on restarted before its call), unknown (the call
  may have reached HA but its answer was lost - including a call in flight when the add-on restarted - or the entity
  reports nothing usable). A record is marked `sending` (committed) before its bridge call, so a restart can tell the
  two apart. "Done" only when nothing is queued, sending or accepted any more; unfinished bulks are settled at start-up.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import logging
import queue
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
from typing import Any

from ..audit import audit
from ..config import Settings
from ..db import Database, now_iso, retry_locked
from ..errors import ApiError
from ..rbac import Principal
from . import devices as dsvc
from . import ha_actions, ha_bridge, ha_client, ha_scope
from .timeutil import iso_utc

log = logging.getLogger(__name__)

PERMISSION = "devices.control_bulk"
AUDIT_ACTION = "devices.bulk"
MEDIA_AUDIT_ACTION = "media.bulk"  # CR-015: the screens page's floor / area "כבה מסכים" (origin 'media')
MEDIA_KINDS = frozenset({"screens_off", "all_off", "screens_on"})  # the kinds that reach media_player entities: through the media resolver only
SCOPES = ("building", "floor", "area")
BUILDING_ID = "*"
BULK_MAX_IN_FLIGHT = 8  # bridge calls in flight across every running bulk
SEND_WITHIN_S = 30.0  # nothing of a bulk is sent later than this after the request arrived (or after its expiry)
EXPIRY_MAX_S = 60.0  # an expires_at further ahead than this is refused (it would make the expiry meaningless)
POLL_S = 1.0  # the worker re-reads the confirmations this often while it waits
FLUSH_EVERY = 8  # per-entity answers are written in batches of this many (or every FLUSH_S)
FLUSH_S = 0.3

KIND_LABELS = {
    "lights_off": "כיבוי תאורה",
    "covers_close": "סגירת תריסים",
    "covers_open": "פתיחת תריסים",
    "covers_stop": "עצירת תריסים",
    "covers_position": "מיקום תריסים",
    "climate_off": "כיבוי מיזוג",
    "screens_off": "כיבוי מסכים",
    "all_off": "כיבוי הכל",
    # owner 2026-09-29 (the tiles' panel master control): turn a kind's shown devices on / off together
    "switches_off": "כיבוי מתגים",
    "switches_on": "הדלקת מתגים",
    "lights_on": "הדלקת תאורה",
    "screens_on": "הדלקת מסכים",
}
SCOPE_LABELS = {"building": "המבנה", "floor": "קומה", "area": "אזור"}

_LIGHTS = (("light", "light.turn_off"),)
_SWITCHES = (("switch", "switch.turn_off"),)  # only positively safe switches (see switch_policy); never input_boolean
_COVERS_CLOSE = (("cover", "cover.close_cover"),)
# CR-007 slice 4: the area's "כל התריסים" group control - open all / stop all / close all / position all, the same
# resolve/record/run path as every other bulk kind (never a fan-out path of its own); the same exclusions apply
# (never a door/garage/gate cover, never the map's door layer).
_COVERS_OPEN = (("cover", "cover.open_cover"),)
_COVERS_STOP = (("cover", "cover.stop_cover"),)
_COVERS_POSITION = (("cover", "cover.set_cover_position"),)
_CLIMATE = (("climate", "climate.turn_off"), ("fan", "fan.turn_off"))  # fans live on the climate card (מיזוג ואקלים)
_SCREENS = (("media_player", "media_player.turn_off"),)
# owner 2026-09-29: the tiles' panel master control. Switches only through the same SwitchPolicy (an administrator's
# bulk-safe mark is the only way in; never input_boolean, never the door layer) - turning ON is guarded exactly like off.
_SWITCHES_ON = (("switch", "switch.turn_on"),)
_LIGHTS_ON = (("light", "light.turn_on"),)
_SCREENS_ON = (("media_player", "media_player.turn_on"),)
# kind -> (domain, allow-listed action) in the order they are sent
KINDS: dict[str, tuple[tuple[str, str], ...]] = {
    "lights_off": _LIGHTS,
    "covers_close": _COVERS_CLOSE,
    "covers_open": _COVERS_OPEN,
    "covers_stop": _COVERS_STOP,
    "covers_position": _COVERS_POSITION,
    "climate_off": _CLIMATE,
    "screens_off": _SCREENS,
    "all_off": _LIGHTS + _SWITCHES + _COVERS_CLOSE + _CLIMATE + _SCREENS,
    "switches_off": _SWITCHES,
    "switches_on": _SWITCHES_ON,
    "lights_on": _LIGHTS_ON,
    "screens_on": _SCREENS_ON,
}
# kinds that turn something ON: an entity is sent when it is off (the reverse of _needs' "off" rule)
ON_KINDS = frozenset({"switches_on", "lights_on", "screens_on"})
# kinds whose targets carry a request argument (validated the same way as the single-entity action, ha_bridge.ACTIONS)
KINDS_WITH_POSITION = frozenset({"covers_position"})
# CR-007 slice 4 review (MEDIUM 4): the area's own "כל התריסים" group control - open all / stop all / position all -
# is the area's control, not the building's or a floor's (the spec never describes building-wide opening); unlike
# covers_close (a slice-3 kind, approved at every scope as part of the classic five-kind menu), these three are new
# in slice 4 and exist only for that one control, so they are refused outside scope "area".
# Owner decision 2026-09-29 (the tiles' panel: "open all / close all" for the covers of the building, a floor or an
# area): covers_open is no longer area-only; stop and position stay the area's own group control.
AREA_ONLY_KINDS = frozenset({"covers_stop", "covers_position"})
ONLY_MAX = 500  # `only`: the entity ids a request may be narrowed to (the panel's filter / search)
# never part of a bulk action, whatever the kind; the ones present in the scope are named in the preview
NEVER_BULK_DOMAINS = frozenset({"lock", "alarm_control_panel", "siren", "script", "scene", "button"})
# review MEDIUM 9: one definition of each, in services/devices.py (also used server-side under devices.control,
# services/ha_scope.py) - not a second copy here.
DOOR_COVER_CLASSES = dsvc.DOOR_COVER_CLASSES  # a cover that is a passage, not a shutter
DOOR_LAYER = dsvc.DOOR_LAYER  # a cover or switch placed on this map layer is a door / gate: never in a bulk action

DOMAIN_LABELS = {
    "light": "תאורה",
    "switch": "מתגים",
    "input_boolean": "מתגים (דגלים)",
    "cover": "תריסים",
    "climate": "מיזוג",
    "fan": "מאווררים",
    "media_player": "מסכים ונגנים",
    "lock": "מנעולים",
    "alarm_control_panel": "אזעקה",
    "siren": "צופרים",
    "script": "סקריפטים",
    "scene": "סצנות",
    "button": "כפתורים",
    "camera": "מצלמות",
}


def _check_kinds() -> None:
    """The safety invariant, checked when the module loads (not an assert: it must hold under -O too)."""
    for kind, parts in KINDS.items():
        for domain, action_id in parts:
            spec = ha_bridge.ACTIONS.get(action_id)
            if (
                not spec
                or spec["domain"] != domain
                or spec.get("grant")
                or spec["risk"] == "sensitive"
                or domain not in ha_scope.DEVICES_CONTROL_DOMAINS
                or domain in NEVER_BULK_DOMAINS
            ):
                raise RuntimeError(f"device_bulk: {kind} names {action_id}, which a bulk action may never send")


_check_kinds()


# ---------------------------------------------------------------- the target set

UNAVAILABLE_STATES = {"unavailable", "unknown", None, ""}


def _needs(kind: str, domain: str, state: str | None) -> bool:
    """Whether the kind's action would change this entity (HA's last report): an entity already off / closed /
    open - or, for covers_stop, not moving at all - is not sent (`covers_position` is decided separately in
    `resolve()`, against the requested position, not the state)."""
    if kind in ON_KINDS:
        if domain == "media_player":
            return state in ("off", "standby")
        return state == "off"
    if domain in ("light", "switch", "input_boolean", "fan"):
        return state == "on"
    if domain == "cover":
        if kind == "covers_open":
            return state in ("closed", "closing")
        if kind == "covers_stop":
            return state in ("opening", "closing")
        return state in ("open", "opening", "closing")  # covers_close / all_off
    if domain == "climate":
        return state not in dsvc.OFF_STATES
    if domain == "media_player":
        return state not in dsvc.MEDIA_OFF_STATES
    return False


def _door_layer_entities(conn: Any) -> set[str]:
    return {
        r["resource_id"]
        for r in conn.execute("SELECT DISTINCT resource_id FROM map_anchors WHERE resource_type = 'ha_entity' AND layer_id = ? AND effective_to IS NULL", (DOOR_LAYER,)).fetchall()
    }


class SwitchPolicy:
    """Which covers / switches a bulk action may reach: the map's door layer, the Plan Studio circuits' switches and
    the administrator's bulk-safe marks, read once per request."""

    def __init__(self, conn: Any) -> None:
        from . import geometry_store

        self.door_layer = _door_layer_entities(conn)
        self.circuits = set(geometry_store.circuit_switches(conn))
        self.marked = {r[0] for r in conn.execute("SELECT entity_id FROM device_bulk_safe").fetchall()}
        from . import alarm as alarm_svc

        self.alarm_managed = alarm_svc.managed_controls(conn)  # CR-010 review B1: a zone's bypass control, never in bulk

    def switch_reason(self, entity_id: str) -> tuple[bool, str]:
        """(included, reason) for a switch: alarm_managed (never - it bypasses an alarm zone), doors_layer (never), marked
        (the only way in), circuit_not_marked (a lighting circuit's switch - the mark is suggested, never implied) or
        switch_not_marked."""
        if entity_id in self.alarm_managed:
            return False, "alarm_managed"
        if entity_id in self.door_layer:
            return False, "doors_layer"
        if entity_id in self.marked:
            return True, "marked"
        if entity_id in self.circuits:
            return False, "circuit_not_marked"
        return False, "switch_not_marked"

    def excluded_reason(self, e: dict[str, Any]) -> str | None:
        # CR-010: an alarm zone's bypass control (computed once per request), or a row that says so itself
        if e["entity_id"] in self.alarm_managed or e.get("alarm_managed"):
            return "alarm_managed"
        if e["domain"] in ("cover", "switch") and e["entity_id"] in self.door_layer:
            return "doors_layer"
        if e["domain"] == "cover" and (e.get("device_class") or "") in DOOR_COVER_CLASSES:
            return "door_cover"
        if e["domain"] == "switch":
            ok, reason = self.switch_reason(e["entity_id"])
            return None if ok else reason
        return None


EXCLUDED_LABELS = {
    "alarm_managed": "נשלט ממסך האזעקה - מתג עקיפה של חיישן אזעקה לעולם לא בפעולה מרוכזת",
    "door_cover": "דלת / שער / חניה - תנועה של מעבר אינה נכללת בפעולה מרוכזת",
    "doors_layer": "הוצב במפה בשכבת הדלתות - לעולם לא בפעולה מרוכזת",
    "switch_not_marked": "לא סומן כבטוח לכיבוי קבוצתי",
    "circuit_not_marked": "לא סומן כבטוח לכיבוי קבוצתי (מפסק של מעגל תאורה - מומלץ לסמן כבטוח)",
    "no_position": "התריס אינו מדווח מיקום ואינו תומך בקביעת מיקום",
    # CR-015 (decision 8a): what the devices area's screens kinds leave out of a player list
    "not_a_screen": "לא מוגדר כמסך",
    "screen_not_approved": "מסך שטרם אושר בהגדרות המולטימדיה",
    "no_power": "אין למסך בקרת הפעלה",
}
# re-review: the same reasons in words that fit a kind that turns something ON (the "off" wording would be false)
EXCLUDED_LABELS_ON = {
    **EXCLUDED_LABELS,
    "switch_not_marked": "לא סומן כבטוח לפעולה קבוצתית (הדלקה וכיבוי)",
    "circuit_not_marked": "לא סומן כבטוח לפעולה קבוצתית (מפסק של מעגל תאורה - מומלץ לסמן כבטוח)",
}


def excluded_label(reason: str, kind: str) -> str:
    return (EXCLUDED_LABELS_ON if kind in ON_KINDS else EXCLUDED_LABELS)[reason]
COVER_SUPPORT_SET_POSITION = 4  # HA cover.CoverEntityFeature.SET_POSITION


def bulk_scope(conn: Any, principal: Principal) -> tuple[bool, Any, Any]:
    """(installation-wide, in_scope, permitted) for devices.control_bulk: `in_scope(entity_id)` - the entity lies
    within the caller's grant (installation-wide, or placed on one of their floors); `permitted(entity_id)` - it
    does AND its domain is one a bulk action may ever reach."""
    wide, floors = ha_scope.visible_floors(conn, principal, PERMISSION)
    placed = ha_scope.placements(conn) if floors and not wide else {}
    from . import alarm as alarm_svc

    managed = alarm_svc.managed_controls(conn)  # CR-010 review B1
    # CR-014: the Scheduler component's switches are not devices - never reached by a bulk action, whatever a request names
    schedulers = {r[0] for r in conn.execute("SELECT entity_id FROM ha_entities WHERE " + dsvc.IS_SCHEDULER_SQL).fetchall()}

    def in_scope(entity_id: str) -> bool:
        return ha_scope.entity_visible(wide, floors, placed, entity_id)

    def permitted(entity_id: str) -> bool:
        # domain only here (not ha_scope.devices_control_reaches's door-class/door-layer refusal, added for the
        # single-entity route in the slice-4 review): a bulk request's own SwitchPolicy.excluded_reason already
        # excludes those, honestly, with a reason the dialog states - a second, silent exclusion here would hide them
        # from "excluded" instead.
        # CR-010 review B1: what the alarm section owns (a zone's bypass switch) is never reached from here either
        if entity_id in schedulers or dsvc.is_scheduler_entity(entity_id, None):
            return False
        return entity_id.split(".", 1)[0] in ha_scope.DEVICES_CONTROL_DOMAINS and entity_id not in managed and in_scope(entity_id)

    return wide, in_scope, permitted


def _structure(conn: Any, entities: list[dict[str, Any]]) -> tuple[dict[str, dict[str, Any]], dict[str, dict[str, Any]], dict[str, str]]:
    """(floors by id, areas by id, area id -> the tree's floor id - NO_FLOOR for an area on no known floor)."""
    floors, areas = dsvc.load_structure(conn, entities)
    fl = {f["floor_id"]: f for f in floors}
    ar = {a["area_id"]: a for a in areas}
    area_floor = {aid: (a.get("floor_id") if a.get("floor_id") in fl else dsvc.NO_FLOOR) for aid, a in ar.items()}
    return fl, ar, area_floor


def scope_flags(conn: Any, principal: Principal, entities: list[dict[str, Any]]) -> dict[str, Any]:
    """Where the caller may start a bulk action, for the tree / area screens: {building, floors: set, areas: set,
    all}. A floor-scoped holder may act on the HA floors / areas that hold at least one entity placed on their floors;
    only an installation-wide holder may act on the building."""
    wide, in_scope, _permitted = bulk_scope(conn, principal)
    if wide:
        return {"building": True, "all": True, "floors": set(), "areas": set()}
    areas = {e["area_id"] for e in entities if e.get("area_id") and in_scope(e["entity_id"])}
    if not areas:
        return {"building": False, "all": False, "floors": set(), "areas": set()}
    _fl, _ar, area_floor = _structure(conn, entities)
    return {"building": False, "all": False, "areas": areas, "floors": {area_floor.get(a, dsvc.NO_FLOOR) for a in areas}}


def resolve(conn: Any, principal: Principal, scope: str, scope_id: str, kind: str, position: int | None = None, only: set[str] | None = None) -> dict[str, Any]:
    """The exact set a bulk request would send, or an ApiError (404 unknown scope, 403 outside the caller's scope).
    The same function answers the preview (the confirmation dialog) and the request itself. `position` (CR-007 slice
    4): the one argument a bulk kind ever carries (covers_position, 0-100) - required exactly for that kind. `only`
    (owner 2026-09-29, the tiles' panel filter / search): narrows the scope to these entity ids - it can only remove
    entities from the set the rules resolve, never add one."""
    if scope not in SCOPES:
        raise ApiError(422, "validation", "היקף לא מוכר.", details={"fields": ["scope"]})
    if kind not in KINDS:
        raise ApiError(422, "validation", "סוג פעולה לא מוכר.", details={"fields": ["kind"]})
    if kind in KINDS_WITH_POSITION and position is None:
        raise ApiError(422, "validation", "יש לציין מיקום (0–100) לפעולת מיקום תריסים.", details={"fields": ["position"]})
    if kind in AREA_ONLY_KINDS and scope != "area":
        raise ApiError(422, "validation", "פעולה זו זמינה רק ברמת האזור (השליטה בקבוצת התריסים של האזור).", details={"fields": ["scope"]})
    entities = dsvc.load_entities(conn)
    floors, areas, area_floor = _structure(conn, entities)
    if scope == "building":
        if scope_id != BUILDING_ID:
            raise ApiError(422, "validation", "פעולה על המבנה כולו מזוהה ב־\"*\".", details={"fields": ["id"]})
        in_scope, name, floor_name = entities, "המבנה", None
    elif scope == "floor":
        if scope_id != dsvc.NO_FLOOR and scope_id not in floors:
            raise ApiError(404, "not_found", "הקומה לא נמצאה.")
        ids = {aid for aid, fid in area_floor.items() if fid == scope_id}
        in_scope = [e for e in entities if e.get("area_id") in ids]
        name = dsvc.NO_FLOOR_NAME if scope_id == dsvc.NO_FLOOR else floors[scope_id]["name"]
        floor_name = None
    else:
        if scope_id not in areas:
            raise ApiError(404, "not_found", "האזור לא נמצא.")
        in_scope = [e for e in entities if e.get("area_id") == scope_id]
        name = areas[scope_id]["name"]
        fid = area_floor.get(scope_id)
        floor_name = (floors[fid]["name"] if fid in floors else dsvc.NO_FLOOR_NAME) if fid else None
    if only is not None:
        if len(only) > ONLY_MAX:
            raise ApiError(422, "validation", f"ניתן לצמצם לכל היותר {ONLY_MAX} התקנים.", details={"fields": ["only"]})
        in_scope = [e for e in in_scope if e["entity_id"] in only]
    wide, held, permitted = bulk_scope(conn, principal)
    if scope == "building" and not wide:
        raise ApiError(403, "forbidden", "פעולה מרוכזת על המבנה כולו דורשת הרשאה לכל ההתקנה; ההרשאה שלך מוגבלת לקומות.", details={"permission": PERMISSION})
    if not wide and not any(held(e["entity_id"]) for e in in_scope):
        raise ApiError(403, "forbidden", "אין לך הרשאה לפעולות מרוכזות בהיקף הזה: אף התקן בו אינו מוצב בקומות שבהרשאתך.", details={"permission": PERMISSION})
    actions = dict(KINDS[kind])
    policy = SwitchPolicy(conn)
    mv = _media_verdicts(conn, kind) if kind in MEDIA_KINDS else None  # CR-015 decision 8a: a screens kind reaches approved screens only
    targets: list[dict[str, Any]] = []
    excluded: list[dict[str, Any]] = []
    never: dict[str, int] = {}
    already = unavailable = not_confirmed = 0
    for e in in_scope:
        domain = e["domain"]
        if not held(e["entity_id"]):
            continue  # outside the caller's floors: not sent, and not described either
        if domain in NEVER_BULK_DOMAINS:
            # present here, never part of a bulk action - said in the dialog of "כבה הכל" only (re-review: a lights
            # action listing the alarm and the locks as "not included" reads as if they could have been)
            if kind == "all_off":
                never[domain] = never.get(domain, 0) + 1
            continue
        if e["entity_id"] in policy.alarm_managed and domain in actions:
            # CR-010 review B1: named in the dialog as excluded (permitted() also refuses it, for every other caller)
            excluded.append({"entity_id": e["entity_id"], "name": _name(e), "domain": domain, "reason": "alarm_managed", "reason_label": EXCLUDED_LABELS["alarm_managed"]})
            continue
        if not permitted(e["entity_id"]):
            continue
        if domain not in actions:
            continue
        if domain == "media_player" and mv is not None:
            verdict = mv.get(e["entity_id"], "unclassified")
            if verdict == "skip":  # a receiver / speaker, or another endpoint of a screen: never reached, never described
                continue
            if verdict in ("unclassified", "unapproved", "no_power"):
                why = {"unclassified": "not_a_screen", "unapproved": "screen_not_approved", "no_power": "no_power"}[verdict]
                excluded.append({"entity_id": e["entity_id"], "name": _name(e), "domain": domain, "reason": why, "reason_label": excluded_label(why, kind)})
                continue
            if verdict == "unavailable":
                unavailable += 1
            elif verdict == "already":
                already += 1
            elif verdict == "not_confirmed":
                not_confirmed += 1
            else:
                targets.append({"entity_id": e["entity_id"], "name": _name(e), "domain": domain, "action_id": actions[domain], "state": e.get("state"), "area_id": e.get("area_id"), "area_name": e.get("area_name"), "args": {}})
            continue
        reason = policy.excluded_reason(e)
        if reason:
            excluded.append({"entity_id": e["entity_id"], "name": _name(e), "domain": domain, "reason": reason, "reason_label": excluded_label(reason, kind)})
            continue
        state = e.get("state")
        if state in UNAVAILABLE_STATES or not e.get("available"):
            unavailable += 1
            continue
        args: dict[str, Any] = {}
        if kind in KINDS_WITH_POSITION:
            # review NIT 6: a cover that neither reports current_position nor advertises SET_POSITION cannot be
            # positioned at all - excluded (with the reason), not sent and never counted as "already"
            cur = dsvc._num((e.get("attributes") or {}).get("current_position"))
            supports_position = bool((e.get("supported_features") or 0) & COVER_SUPPORT_SET_POSITION)
            if cur is None and not supports_position:
                excluded.append({"entity_id": e["entity_id"], "name": _name(e), "domain": domain, "reason": "no_position", "reason_label": EXCLUDED_LABELS["no_position"]})
                continue
            if cur is not None and abs(cur - position) < 1:  # already at (near enough) the requested position
                already += 1
                continue
            args = {"position": position}
        elif not _needs(kind, domain, state):
            already += 1
            continue
        targets.append({"entity_id": e["entity_id"], "name": _name(e), "domain": domain, "action_id": actions[domain], "state": state, "area_id": e.get("area_id"), "area_name": e.get("area_name"), "args": args})
    order = {d: i for i, (d, _a) in enumerate(KINDS[kind])}
    targets.sort(key=lambda t: (order[t["domain"]], t["area_name"] or "", t["name"], t["entity_id"]))
    by_domain: dict[str, int] = {}
    for t in targets:
        by_domain[t["domain"]] = by_domain.get(t["domain"], 0) + 1
    return {
        "scope": scope,
        "id": scope_id,
        "name": name,
        "floor_name": floor_name,
        "kind": kind,
        "kind_label": KIND_LABELS[kind],
        "count": len(targets),
        "targets": targets,
        "by_domain": by_domain,
        "domain_labels": {d: DOMAIN_LABELS.get(d, d) for d in set(by_domain) | set(never)},
        "skipped": {"already": already, "unavailable": unavailable, **({"not_confirmed": not_confirmed} if not_confirmed else {})},
        "excluded": excluded,
        "never_included": never,
        "digest": digest([t["entity_id"] for t in targets], kind, position),
        "narrowed": only is not None,
        "server_time_ms": int(time.time() * 1000),  # the client computes expires_at on the server's time line
        "position": position,  # covers_position only - echoed back so the confirmation dialog can restate it
        "note": "מנעולים, מערכת האזעקה, צופרים, סקריפטים, סצנות, כפתורים ושחרור דלתות אינם נכללים לעולם בפעולה מרוכזת.",
    }


def _name(e: dict[str, Any]) -> str:
    return e.get("name") or e.get("original_name") or e["entity_id"]


def _media_verdicts(conn: Any, kind: str) -> dict[str, str]:
    """CR-015 decision 8a: how the devices area's screens kinds treat every media_player endpoint. Only the POWER endpoint of an APPROVED
    screen is ever sent to, and only a screen CONFIRMED on (or in art mode) for an "off" kind, one that is off for `screens_on`:
    target | already | unavailable | not_confirmed | no_power (a screen that cannot be switched) | unapproved (a detected screen not
    approved yet) | unclassified (not a media device we know as a screen) | skip (a receiver / speaker, or another endpoint of a screen).
    A receiver may feed other rooms and is never included."""
    from . import media_store as ms

    cat = ms.load_catalog(conn, approved_only=False, kind=None)
    out: dict[str, str] = {}
    for item in cat.items.values():
        live = caps = None
        for ep in item.model.endpoints:
            if ep.domain != "media_player":
                continue
            if item.row["kind"] != "screen":
                out[ep.ref] = "skip" if item.row["kind"] in ("receiver", "speaker") else "unclassified"
            elif ep.ref != item.view.prim.get("power"):
                out[ep.ref] = "skip"  # another endpoint of the same screen: never reached, never described
            elif not item.row["approved"]:
                out[ep.ref] = "unapproved"
            else:
                live = live or ms.live_of(cat, item, key_url=False)
                caps = caps or ms.caps_of(cat, item)
                out[ep.ref] = screen_verdict(live, caps, kind in ON_KINDS)
    return out


def screen_verdict(live: dict[str, Any], caps: dict[str, Any], turning_on: bool) -> str:
    """One approved screen's verdict for a bulk "off" (or "on") of its power endpoint - shared by both bulk entry points."""
    power = live["power"]
    if power in ("unavailable", "unknown"):
        return "unavailable"
    if turning_on:
        if power in ("on", "art"):
            return "already"
        return "target" if caps["power_on"] else "no_power"
    if power in ("off", "standby"):
        return "already"
    if power == "on" and not live["confirmed"]:
        return "not_confirmed"
    return "target" if caps["power_off"] else "no_power"


def resolve_media(conn: Any, principal: Principal, scope: str, scope_id: str) -> dict[str, Any]:
    """CR-015 (MEDIA_API.md 3.9): the screens page's floor / area "כבה מסכים" - approved screens of one HA floor or area the caller may
    read, `media.bulk` at each screen's anchor, their POWER endpoint only, only screens confirmed on (or in art mode). Same plan shape
    as `resolve` (so `record` / `run` / `load` and the poll route are shared) plus `devices`, the per-screen preview rows. 422 for the
    building (7b was not taken), 404 when the caller sees no screen there, 403 when none of them may be switched off in bulk by them."""
    from . import media_store as ms

    if scope not in ("floor", "area"):
        raise ApiError(422, "validation", "כיבוי מסכים מרוכז זמין לקומה או לאזור בלבד.", details={"fields": ["scope"]})
    cat = ms.load_catalog(conn)
    access = ms.Access(conn, principal, (ms.PERM_READ, ms.PERM_BULK))
    if not access.anywhere(ms.PERM_BULK):
        from ..rbac import INSTALLATION, require

        require(conn, principal, ms.PERM_BULK, INSTALLATION)
    field = "floor_id" if scope == "floor" else "area_id"
    inside = [i for i in ms.visible_items(cat, access) if ms.floor_area(i)[field] == scope_id]
    if not inside:
        raise ApiError(404, "not_found", "הקומה או האזור לא נמצאו.")
    inside.sort(key=lambda i: (i.name, i.key))
    label = ms.floor_area(inside[0])["floor_name" if scope == "floor" else "area_name"] or scope_id
    devices: list[dict[str, Any]] = []
    targets: list[dict[str, Any]] = []
    counts = {"send": 0, "already_off": 0, "not_confirmed": 0, "unavailable": 0, "not_allowed": 0}
    for item in inside:
        anchor = item.row.get("anchor_entity_id")
        power = item.view.prim.get("power")
        reason: str | None
        if not access.has(ms.PERM_BULK, anchor) or not power:
            reason = "not_allowed"
        else:
            verdict = screen_verdict(ms.live_of(cat, item, key_url=False), ms.caps_of(cat, item), False)
            reason = {"target": None, "already": "already_off", "unavailable": "unavailable", "not_confirmed": "not_confirmed", "no_power": "not_allowed"}[verdict]
        devices.append({"key": item.key, "name": item.name, "will": "skip" if reason else "off", "reason": reason})
        if reason is None:
            counts["send"] += 1
            e = cat.ents.get(power or "") or {}
            targets.append({"entity_id": power, "name": item.name, "domain": "media_player", "action_id": "media_player.turn_off", "state": e.get("state"),
                            "area_id": e.get("area_id"), "area_name": e.get("area_name"), "args": {}, "device_key": item.key})
        else:
            counts[reason] += 1
    if not counts["send"] and counts["not_allowed"] == len(devices):
        raise ApiError(403, "forbidden", "אין לך הרשאה לכיבוי מרוכז של מסכים בהיקף הזה.", details={"permission": ms.PERM_BULK})
    return {
        "scope": scope, "id": scope_id, "name": label, "floor_name": None, "kind": "screens_off", "kind_label": KIND_LABELS["screens_off"], "count": len(targets), "targets": targets,
        "by_domain": {"media_player": len(targets)} if targets else {}, "domain_labels": {"media_player": DOMAIN_LABELS["media_player"]},
        "skipped": {"already": counts["already_off"], "unavailable": counts["unavailable"]}, "excluded": [], "never_included": {},
        "digest": digest([t["entity_id"] for t in targets], "screens_off"), "narrowed": False, "server_time_ms": int(time.time() * 1000), "position": None, "note": "",
        "origin": "media", "devices": devices, "counts": counts,
    }


def digest(entity_ids: list[str], kind: str, position: int | None = None) -> str:
    """A short fingerprint of exactly what the dialog showed: the request is refused when the set - or, for
    covers_position, the requested position - changed since."""
    key = kind if position is None else f"{kind}:{position}"
    return hashlib.sha256((key + "\n" + "\n".join(sorted(entity_ids))).encode()).hexdigest()[:16]


# ---------------------------------------------------------------- in flight

class _Runner:
    """The running bulks: one per scope, never two sharing an entity, and the global send slots."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._scopes: dict[str, str] = {}
        self._entities: dict[str, set[str]] = {}
        self._threads: dict[str, threading.Thread] = {}
        self.slots = threading.BoundedSemaphore(BULK_MAX_IN_FLIGHT)

    def reserve(self, key: str, bulk_id: str, entity_ids: set[str]) -> str | None:
        """Reserve the scope and its entities for `bulk_id`; returns the id of the running bulk that blocks it."""
        with self._lock:
            if key in self._scopes:
                return self._scopes[key]
            for other, ids in self._entities.items():
                if ids & entity_ids:
                    return other
            self._scopes[key] = bulk_id
            self._entities[bulk_id] = set(entity_ids)
            return None

    def release(self, bulk_id: str) -> None:
        with self._lock:
            for k in [k for k, v in self._scopes.items() if v == bulk_id]:
                del self._scopes[k]
            self._entities.pop(bulk_id, None)
            self._threads.pop(bulk_id, None)

    def running(self, bulk_id: str) -> bool:
        with self._lock:
            return bulk_id in self._entities

    def start(self, bulk_id: str, target: Any) -> None:
        t = threading.Thread(target=target, name=f"device-bulk-{bulk_id}", daemon=True)
        with self._lock:
            self._threads[bulk_id] = t
        t.start()

    def wait(self, bulk_id: str, timeout: float = 30.0) -> bool:
        """Tests: block until the bulk's worker ended. True when it did."""
        with self._lock:
            t = self._threads.get(bulk_id)
        if t is None:
            return True
        t.join(timeout)
        return not t.is_alive()

    def clear(self) -> None:
        with self._lock:
            self._scopes.clear()
            self._entities.clear()
            self._threads.clear()


RUNNER = _Runner()


def scope_key(scope: str, scope_id: str) -> str:
    return f"{scope}:{scope_id}"


# ---------------------------------------------------------------- recording and sending

def record(conn: Any, principal: Principal, bulk_id: str, plan: dict[str, Any], client_request_id: str, not_after: dt.datetime) -> None:
    """The bulk row and one queued ha_actions record per entity, in the caller's transaction (committed, together
    with the attempt audit row, before anything is sent)."""
    now = now_iso()
    conn.execute(
        "INSERT INTO device_bulk_actions(id, scope, scope_id, scope_name, kind, principal_user_id, principal_username, client_request_id, entity_count, status, requested_at, not_after, origin) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (bulk_id, plan["scope"], plan["id"], plan["name"], plan["kind"], principal.user_id, principal.username, client_request_id, plan["count"], "sending", now, iso_utc(not_after), plan.get("origin", "devices")),
    )
    attrs = {r["entity_id"]: r["attributes_json"] for r in conn.execute("SELECT entity_id, attributes_json FROM ha_entities WHERE entity_id IN (%s)" % ",".join("?" * len(plan["targets"])), [t["entity_id"] for t in plan["targets"]]).fetchall()} if plan["targets"] else {}
    for n, t in enumerate(plan["targets"]):
        spec, data = ha_bridge.validate_action(t["action_id"], t["entity_id"], t.get("args") or {})  # the same allow-list and validation as a single action
        try:
            a = json.loads(attrs.get(t["entity_id"]) or "{}")
        except ValueError:
            a = {}
        t["id"] = f"{bulk_id}{n:04d}"
        t["data"] = data
        t["service"] = spec["service"]
        # the arguments as validated (cleaned: entity_id dropped) - CR-007 slice 4: an attribute confirmation (e.g.
        # covers_position) compares the observed attribute to THESE, exactly as the single-entity route does
        # (routers/ha.py); every earlier bulk kind sends no arguments at all, so this was always "{}" for them.
        cleaned = {k: v for k, v in data.items() if k != "entity_id"}
        conn.execute(
            "INSERT INTO ha_actions(id, entity_id, action_id, arguments_json, principal_user_id, principal_username, client_request_id, status, requested_at, expected_state, via, bulk_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            (t["id"], t["entity_id"], t["action_id"], json.dumps(cleaned, ensure_ascii=False), principal.user_id, principal.username, f"{client_request_id}:{n}", "queued", now, ha_bridge.expectation_for(spec, a), "bulk", bulk_id),
        )


UNKNOWN_ERRORS = frozenset({"ha_unavailable", "internal_error"})  # the call may have reached Home Assistant
NOT_SENT_ERRORS = frozenset({"expired", "interrupted", "ha_unreachable"})


def _call(settings: Settings, secret: str, principal: Principal, t: dict[str, Any]) -> tuple[dict[str, Any], str, str | None]:
    """One entity's bridge call (its record is already `sending`, committed). (item, status, error). The caller holds
    one of the global slots; it is released here, whatever happens."""
    try:
        payload = ha_bridge.sign(secret, {"user_id": principal.user_id, "domain": t["domain"], "service": t["service"], "data": t["data"], "request_id": t["id"]})
        try:
            result = ha_client.call_bridge_execute(settings, payload)
        except ApiError as exc:
            code = exc.code
            if code == "ha_unavailable" and (exc.details or {}).get("error") in ("ConnectError", "ConnectTimeout"):
                code = "ha_unreachable"  # the connection was never made: nothing reached Home Assistant
            return t, "failed", code
        except Exception:  # noqa: BLE001 - whatever it was, the call may have gone out
            log.exception("device bulk: bridge call for %s failed", t["entity_id"])
            return t, "failed", "internal_error"
        status, error = ha_actions.bridge_status(result)
        return t, status, error
    finally:
        RUNNER.slots.release()


def _flush(db: Database, rows: list[tuple[str, str | None, str]]) -> None:
    if not rows:
        return
    with db.write_aside() as w:
        now = now_iso()
        for status, error, aid in rows:
            w.execute("UPDATE ha_actions SET status = ?, error = ?, responded_at = ? WHERE id = ?", (status, error, now, aid))
    rows.clear()


def _mark_sending(db: Database, aid: str) -> None:
    """Committed before the bridge call: after a restart, a `sending` record is a call that may have gone out
    (unknown), never "not sent". requested_at becomes the instant the call leaves - the confirmation window and the
    "reported after the request" check run from there, not from when the bulk was queued."""
    with db.write_aside() as w:
        w.execute("UPDATE ha_actions SET status = 'sending', requested_at = ? WHERE id = ? AND status = 'queued'", (now_iso(), aid))


def refresh_pending(conn: Any, bulk_id: str) -> int:
    """Advance the bulk's pending records (ha_actions.refresh). Returns how many are still pending or queued."""
    for r in conn.execute("SELECT * FROM ha_actions WHERE bulk_id = ? AND status = 'pending'", (bulk_id,)).fetchall():
        ha_actions.refresh(conn, ha_actions.as_dict(r))
    return conn.execute("SELECT COUNT(*) FROM ha_actions WHERE bulk_id = ? AND status IN ('pending', 'queued', 'sending')", (bulk_id,)).fetchone()[0]


def run(db: Database, settings: Settings, principal: Principal, bulk_id: str, targets: list[dict[str, Any]], secret: str, not_after: dt.datetime, request_id: str | None) -> None:
    """The worker: fan the calls out (bounded), record each answer, wait for the confirmations, write the outcome."""
    try:
        buffer: list[tuple[str, str | None, str]] = []
        answers: queue.Queue = queue.Queue()
        last = time.monotonic()

        def drain(block: bool = False) -> None:
            nonlocal last
            while True:
                try:
                    t, status, error = answers.get(block=block, timeout=0.2) if block else answers.get_nowait()
                except queue.Empty:
                    break
                block = False
                buffer.append((status, error, t["id"]))
            if buffer and (len(buffer) >= FLUSH_EVERY or time.monotonic() - last > FLUSH_S):
                _flush(db, buffer)
                last = time.monotonic()

        with ThreadPoolExecutor(max_workers=BULK_MAX_IN_FLIGHT, thread_name_prefix=f"bulk-{bulk_id}") as pool:
            futures = []
            for t in targets:
                # one slot of the global bound per call in flight, taken HERE: this thread is the only writer, and a
                # record is `sending` (committed) before its call can start
                while not RUNNER.slots.acquire(timeout=0.2):
                    drain()
                if dt.datetime.now(dt.timezone.utc) > not_after:
                    RUNNER.slots.release()
                    buffer.append(("failed", "expired", t["id"]))  # never sent: the request's own deadline passed
                    continue
                try:
                    _mark_sending(db, t["id"])
                except BaseException:
                    RUNNER.slots.release()
                    raise
                fut = pool.submit(_call, settings, secret, principal, t)
                fut.add_done_callback(lambda f, t=t: answers.put((t, "failed", "internal_error") if f.exception() else f.result()))
                futures.append(fut)
                drain()
            for fut in futures:
                fut.exception()  # wait for every call to end
        drain()
        _flush(db, buffer)
        with db.write_aside() as w:
            w.execute("UPDATE device_bulk_actions SET status = 'waiting', sent_at = ? WHERE id = ?", (now_iso(), bulk_id))
        deadline = time.monotonic() + ha_actions.CONFIRM_WINDOW_S + 5.0
        def _poll() -> int:
            with db.write_aside() as w:
                return refresh_pending(w, bulk_id)

        while True:
            left = retry_locked(_poll, what=f"device bulk {bulk_id} poll")  # a busy database delays a poll, it does not end the bulk
            if not left or time.monotonic() > deadline:
                break
            time.sleep(POLL_S)
    except Exception:  # noqa: BLE001 - never leave a bulk hanging: whatever was not sent is recorded as such
        log.exception("device bulk %s: the worker failed", bulk_id)
        try:
            with db.write_aside() as w:
                interrupt(w, bulk_id)
        except Exception:  # noqa: BLE001
            log.exception("device bulk %s: could not record the unsent entities", bulk_id)
    finally:
        try:
            retry_locked(lambda: finish(db, bulk_id, request_id), what=f"device bulk {bulk_id} outcome")  # the outcome audit row is never lost to a busy database
        except Exception:  # noqa: BLE001 - the attempt row and the per-entity records stand
            log.exception("device bulk %s: the outcome could not be recorded", bulk_id)
        RUNNER.release(bulk_id)


# ---------------------------------------------------------------- reading back

def outcome_of(status: str, error: str | None, observed: str | None, confirmation: str = "state") -> str:
    """`confirmation` (ha_bridge.confirmation_kind: "state" / "attribute" / "none") - review MEDIUM 3: a record with
    nothing observable (cover.stop_cover and the like) is marked "confirmed" in the DB the moment HA is known to have
    accepted it (services/ha_actions.refresh: no expected_state to wait for), but that is honestly "sent", never
    "confirmed" - the same rule the single-entity route already applies (api/device-commands.ts settle()); a bulk
    "stop all" must never read "בוצע" for something nobody actually verified."""
    if status == "queued":
        return "queued"
    if status in ("pending", "sending"):
        return "accepted"
    if status == "confirmed":
        return "sent" if confirmation == "none" else "confirmed"
    if status == "unknown":
        # the window passed: HA reports the device in another state (we know it did not happen), or nothing usable
        return "not_confirmed" if observed not in UNAVAILABLE_STATES else "unknown"
    if status == "failed" and error in UNKNOWN_ERRORS:
        return "unknown"
    return "refused"  # denied by HA, refused by the bridge, or never sent


OUTCOMES = ("confirmed", "sent", "accepted", "queued", "not_confirmed", "refused", "unknown")


def load(conn: Any, bulk_id: str) -> dict[str, Any]:
    b = conn.execute("SELECT * FROM device_bulk_actions WHERE id = ?", (bulk_id,)).fetchone()
    if not b:
        raise ApiError(404, "not_found", "הפעולה המרוכזת לא נמצאה.")
    rows = conn.execute(
        "SELECT a.id, a.entity_id, a.action_id, a.status, a.error, a.observed_state, a.confirmed_at, a.expected_state, e.name, e.domain, e.area_name "
        "FROM ha_actions a LEFT JOIN ha_entities e ON e.entity_id = a.entity_id WHERE a.bulk_id = ? ORDER BY a.id",
        (bulk_id,),
    ).fetchall()
    items = []
    counts = {k: 0 for k in OUTCOMES}
    for r in rows:
        confirmation = ha_bridge.confirmation_kind(r["action_id"], r["expected_state"])
        out = outcome_of(r["status"], r["error"], r["observed_state"], confirmation)
        counts[out] += 1
        items.append({
            "entity_id": r["entity_id"], "name": r["name"] or r["entity_id"], "domain": r["domain"] or r["entity_id"].split(".", 1)[0], "area_name": r["area_name"],
            "action_id": r["action_id"], "outcome": out, "status": r["status"], "error": r["error"], "observed_state": r["observed_state"],
            "expected_state": r["expected_state"],
            "sent": r["status"] != "queued" and not (r["status"] == "failed" and r["error"] in NOT_SENT_ERRORS),
            "may_have_been_sent": r["status"] == "unknown" and r["error"] == "interrupted",
        })
    counts["total"] = len(rows)
    done = b["status"] == "done"
    return {
        "id": b["id"], "scope": b["scope"], "scope_id": b["scope_id"], "scope_name": b["scope_name"], "kind": b["kind"], "kind_label": KIND_LABELS.get(b["kind"], b["kind"]),
        "status": b["status"], "requested_at": b["requested_at"], "not_after": b["not_after"], "sent_at": b["sent_at"], "done_at": b["done_at"],
        "principal_user_id": b["principal_user_id"], "principal_username": b["principal_username"], "origin": b["origin"],
        "done": done, "all_confirmed": done and counts["total"] > 0 and counts["confirmed"] == counts["total"], "counts": counts, "items": items,
        "note": "הצלחה נקבעת רק לפי מה שדווח לכל התקן; התקן שלא דיווח אינו נחשב כבוי.",
    }


def finish(db: Database, bulk_id: str, request_id: str | None = None) -> None:
    """Mark the bulk done and write its outcome audit row - exactly once, whoever gets here first (the worker, or a
    read after the add-on restarted mid-bulk)."""
    with db.write_aside() as w:
        body = load(w, bulk_id)
        w.execute("UPDATE device_bulk_actions SET status = 'done', done_at = COALESCE(done_at, ?), counts_json = ? WHERE id = ?", (now_iso(), json.dumps(body["counts"]), bulk_id))
        if w.execute("UPDATE device_bulk_actions SET outcome_at = ? WHERE id = ? AND outcome_at IS NULL", (now_iso(), bulk_id)).rowcount != 1:
            return
        c = body["counts"]
        actor = SimpleNamespace(user_id=body["principal_user_id"], username=body["principal_username"])

        def ids(outcome: str) -> list[str]:
            return [i["entity_id"] for i in body["items"] if i["outcome"] == outcome][:100]

        audit(w, actor=actor, action=MEDIA_AUDIT_ACTION if body["origin"] == "media" else AUDIT_ACTION, decision="allowed", resource_type=f"devices_{body['scope']}", resource_id=body["scope_id"],
              reason=None if c["confirmed"] == c["total"] else ("partial" if c["confirmed"] else "none_confirmed"), request_id=request_id,
              details={"phase": "outcome", "bulk_id": bulk_id, "kind": body["kind"], "scope": body["scope"], "scope_name": body["scope_name"], "counts": c,
                       "not_confirmed": ids("not_confirmed"), "unknown": ids("unknown"), "refused": ids("refused")})


def interrupt(conn: Any, bulk_id: str) -> None:
    """The bulk's worker is gone: a record never handed to a call (`queued`) was not sent - refused, "interrupted"; a
    record whose call had started (`sending`: committed before the call, its answer possibly never written) may have
    reached Home Assistant - unknown, never "not sent"."""
    now = now_iso()
    conn.execute("UPDATE ha_actions SET status = 'failed', error = 'interrupted', responded_at = ? WHERE bulk_id = ? AND status = 'queued'", (now, bulk_id))
    conn.execute("UPDATE ha_actions SET status = 'unknown', error = 'interrupted', observed_state = NULL, responded_at = ? WHERE bulk_id = ? AND status = 'sending'", (now, bulk_id))


def settle_orphan(db: Database, bulk_id: str, final: bool = False) -> None:
    """A bulk whose worker is gone (the add-on restarted mid-bulk): what was never sent is recorded so, what was in
    flight is unknown, what was accepted gets its confirmation read once more - and, `final` (the start-up sweep), what
    is still waiting for it is unknown too - then the outcome row is written."""
    with db.write_aside() as w:
        interrupt(w, bulk_id)
        refresh_pending(w, bulk_id)
        if final:
            w.execute("UPDATE ha_actions SET status = 'unknown', error = 'interrupted', observed_state = NULL WHERE bulk_id = ? AND status = 'pending'", (bulk_id,))
        left = w.execute("SELECT COUNT(*) FROM ha_actions WHERE bulk_id = ? AND status = 'pending'", (bulk_id,)).fetchone()[0]
    if not left:
        finish(db, bulk_id)


def sweep_unfinished(db: Database) -> int:
    """At start-up: every bulk that has no outcome yet (its worker died with the previous process) is settled and gets
    its outcome audit row now, not only when its requester opens it. Returns how many were settled."""
    with db.write_aside() as w:
        ids = [r[0] for r in w.execute("SELECT id FROM device_bulk_actions WHERE outcome_at IS NULL").fetchall()]
    n = 0
    for bid in ids:
        if RUNNER.running(bid):
            continue  # a worker of this very process (another app instance on the same database, in tests)
        settle_orphan(db, bid, final=True)
        n += 1
    return n


def clear_stale_marks(conn: Any, present: set[str]) -> list[str]:
    """On a registry refresh: a bulk-safe mark whose entity is gone from Home Assistant (removed, or renamed to another
    id) is deleted and audited, so an id that comes back later - maybe another device - is never pre-marked."""
    gone = []
    for r in conn.execute("SELECT b.entity_id, e.removed_at FROM device_bulk_safe b LEFT JOIN ha_entities e ON e.entity_id = b.entity_id").fetchall():
        if r["entity_id"] not in present or r["removed_at"]:
            gone.append(r["entity_id"])
    for eid in gone:
        conn.execute("DELETE FROM device_bulk_safe WHERE entity_id = ?", (eid,))
        audit(conn, actor=None, action="devices.bulk_safe.cleared", decision="allowed", resource_type="ha_entity", resource_id=eid, reason="entity_gone")
    return gone


def set_bulk_safe(conn: Any, principal: Principal, entity_id: str, safe: bool) -> None:
    if safe:
        conn.execute("INSERT INTO device_bulk_safe(entity_id, marked_by, marked_by_username, marked_at) VALUES (?,?,?,?) ON CONFLICT(entity_id) DO UPDATE SET marked_by = excluded.marked_by, marked_by_username = excluded.marked_by_username, marked_at = excluded.marked_at",
                     (entity_id, principal.user_id, principal.username, now_iso()))
    else:
        conn.execute("DELETE FROM device_bulk_safe WHERE entity_id = ?", (entity_id,))
