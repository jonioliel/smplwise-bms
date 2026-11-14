"""AREA-PRESENCE-LINE-2351: the compact presence line of ONE area (the devices area screen) - who / how many are there now.

Built only from the two presence sources that already exist; nothing new is read from a person and nothing is stored:
- the tagged presence sensors of the room (services/building_presence.py, anonymous, `presence.building.view`): occupied / empty since /
  no data - the same words as the map chip and the area window;
- the phone app's people placement (services/presence_people.py, `presence.view`, sensitive): the people a beacon places in a plan room
  (`spatial_zones`) linked to this area (`spatial_zones.ha_area_id`). A Wi-Fi or geofence placement knows a floor or a site only, never a
  room, so it never counts here.
Door / access events are NOT a source: an entry says someone passed a door, not that they are still in the room (the 2271 design keeps door
"last entry" and identity as a separate privacy decision).

Privacy (the people rules of presence_people.people_view are reused as they are, not re-implemented):
- the line exists only while the administrator switched it on (`presence.building.config.area_line`, OFF by default - conservative: the
  people part is sensitive, and the area screen is seen by every devices viewer);
- each part needs its own permission; a caller without either gets nothing of that part;
- names only while the people setting `show_names` is on, otherwise a count; an opted-out person is never placed in an area (people_view
  counts them installation-wide only), so they are not in the count either;
- a floor-scoped `presence.view` holder sees only people on the floors they hold (people_view's own rule);
- owner 02.11 (round 14): a holder of `presence.building.view` WITHOUT `presence.view` gets an anonymous COUNT of the people part - the
  same placement, the floors decided by the scope of presence.building.view, built with `with_names=False` (people_view never makes the
  per-person list), answered as `{count, names: null, more: 0, anonymous: true}` whatever `show_names` says. No name, user id, source,
  time or zone of a person is in that answer."""
from __future__ import annotations

import sqlite3
from typing import Any

from ..rbac import Principal, permissions_anywhere
from . import building_presence as bp
from . import presence_people as people_svc

MAX_NAMES = 50


def zones_of_area(conn: sqlite3.Connection, area_id: str) -> set[str]:
    """The plan rooms linked to this area (a zone deleted since does not count)."""
    return {r["id"] for r in conn.execute("SELECT id FROM spatial_zones WHERE ha_area_id = ? AND deleted_at IS NULL", (area_id,))}


def sensors_part(conn: sqlite3.Connection, area_id: str, fresh: bool) -> dict[str, Any] | None:
    """The room's sensor state, or None (module off, nothing tagged, no tagged sensor in this room)."""
    snap = bp.snapshot(conn, fresh=fresh)
    if not snap.get("configured"):
        return None
    room = next((r for r in snap.get("rooms") or [] if r.get("area_id") == area_id), None)
    if room is None:
        return None
    return {"status": room["status"], "empty_since": room.get("empty_since"), "sensors": room.get("sensors", 0)}


def people_part(conn: sqlite3.Connection, principal: Principal, area_id: str, anonymous: bool = False) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    """(the people placed in this area, people_view's answer for the audit) - (None, None) while the people module is off or no plan room
    is linked to this area. `anonymous` (a presence.building.view holder without presence.view): the count only, never a name."""
    zones = zones_of_area(conn, area_id)
    if not zones:
        return None, None
    view = people_svc.people_view(conn, principal, perm=bp.VIEW, with_names=False) if anonymous else people_svc.people_view(conn, principal)
    if not view.get("enabled"):
        return None, view
    count = sum(z["count"] for f in view.get("floors") or [] for z in f.get("zones") or [] if z.get("zone_id") in zones)
    if anonymous:
        return {"count": count, "names": None, "more": 0, "anonymous": True}, view
    show_names = bool((view.get("settings") or {}).get("show_names"))
    names = sorted((p["name"] for p in view.get("people") or [] if p.get("zone_id") in zones), key=str.casefold) if show_names else None
    return {"count": count, "names": names[:MAX_NAMES] if names is not None else None, "more": max(0, len(names) - MAX_NAMES) if names is not None else 0, "anonymous": False}, view


def area_line(conn: sqlite3.Connection, principal: Principal, area_id: str, fresh: bool = True) -> tuple[dict[str, Any], dict[str, Any] | None]:
    """(the line's answer, people_view's answer when the people part was read - for the throttled audit)."""
    cfg = bp.get_config(conn)
    out: dict[str, Any] = {"area_id": area_id, "line": bool(cfg.get("area_line")), "sensors": None, "people": None}
    if not out["line"]:
        return out, None  # switched off: nothing is read
    perms = permissions_anywhere(conn, principal)
    if bp.VIEW in perms:
        out["sensors"] = sensors_part(conn, area_id, fresh)
    view = None
    if people_svc.VIEW in perms:
        out["people"], view = people_part(conn, principal, area_id)
    elif bp.VIEW in perms:  # owner 02.11 (round 14): an anonymous count, decided here on the server - never per-person data
        out["people"], view = people_part(conn, principal, area_id, anonymous=True)
    return out, view
