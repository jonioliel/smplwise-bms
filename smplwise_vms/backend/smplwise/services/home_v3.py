"""HOME-V3-P1-2430: the home interface, mockup v3 phase 1 (security and intercom) - the small server pieces the mockup needs and the
product did not have. Everything else in phase 1 reuses existing routes (recordings, playback sessions, events, the call log, the
intercom people directory, the visitor invitations, the alarm panels and the personal alarm code).

* The administrator's room wallpaper for everyone (owner decision 16b, 2026-11-11): `home.room_wallpapers` (settings row, JSON
  {room_key: "g:<gallery>" | "img"}) plus a shared picture = a `home_room_image` row whose user_id is SHARED ('*'). Precedence, decided
  here and documented in docs/changes/HOME-V3-P1-2430.md: a person's own wallpaper wins over the administrator's, EXCEPT on a wall
  panel (kiosk), where the administrator's wins (the frontend applies it; the server serves both).
* The doors a person may offer a guest: the WisKey stations of the served copy on which the caller holds `access.visitor.invite`,
  with their relays (the visitor invitation route decides again, per station).

Nothing here talks to a device. Never a door code, a visitor's number or a picture in an audit row.
"""
from __future__ import annotations

import json
import sqlite3
from typing import Any

from ..db import get_setting, set_setting
from ..rbac import STATION, Principal, authorize

SHARED = "*"
WALLS_KEY = "home.room_wallpapers"
MAX_WALL_ROOMS = 500


def _gallery() -> tuple[str, ...]:
    from .home_interface import GALLERY

    return GALLERY


def stored_walls(conn: sqlite3.Connection) -> dict[str, str]:
    try:
        raw = json.loads(get_setting(conn, WALLS_KEY) or "{}")
    except ValueError:
        return {}
    return {k: v for k, v in raw.items() if isinstance(k, str) and isinstance(v, str)} if isinstance(raw, dict) else {}


def has_shared_image(conn: sqlite3.Connection, room_key: str) -> bool:
    try:
        return conn.execute("SELECT 1 FROM home_room_image WHERE user_id = ? AND room_key = ?", (SHARED, room_key)).fetchone() is not None
    except sqlite3.OperationalError:
        return False


def room_wallpapers(conn: sqlite3.Connection, mode: str) -> dict[str, str]:
    """The administrator's wallpaper per room, as it applies now: nothing while the installation offers no wallpaper, a picture only
    while pictures are on and the picture exists, gallery names only from the built-in list."""
    if mode == "none":
        return {}
    gallery = _gallery()
    out: dict[str, str] = {}
    for room, v in stored_walls(conn).items():
        if v == "img":
            if mode == "gallery_image" and has_shared_image(conn, room):
                out[room] = v
        elif v.startswith("g:") and v[2:] in gallery:
            out[room] = v
    return out


def set_room_wallpaper(conn: sqlite3.Connection, room_key: str, value: str | None) -> dict[str, str]:
    """Set (`g:<name>` / `img`) or clear (None / "") the administrator's wallpaper of one room. The caller holds rbac.assign."""
    walls = stored_walls(conn)
    if value:
        walls[room_key] = value
    else:
        walls.pop(room_key, None)
    if len(walls) > MAX_WALL_ROOMS:
        from .home_interface import HomeInterfaceError

        raise HomeInterfaceError(422, "validation", "יותר מדי חדרים עם רקע.")
    set_setting(conn, WALLS_KEY, json.dumps(walls, sort_keys=True))
    return walls


def guest_doors(conn: sqlite3.Connection, principal: Principal) -> list[dict[str, Any]]:
    """The doors (station + relay) the caller may put in a guest invitation: stations of the served WisKey copy where the caller holds
    `access.visitor.invite` (deny-overrides over the station chain), each with its lock relays and names."""
    from . import intercom_doors
    from .access_visitors import PERMISSION
    from .intercom_sync import SYNC

    out: list[dict[str, Any]] = []
    for s in SYNC.stations():
        sid = s.get("id")
        if not sid or not authorize(conn, principal, PERMISSION, (STATION, sid)).allowed:
            continue
        relays = intercom_doors.station_relays(s)
        names = {int(lk["physical_index"]): (lk.get("name") or "") for lk in s.get("locks") or [] if "physical_index" in lk}
        for r in relays:
            out.append({"station_id": sid, "relay": r, "name": names.get(r) or str(s.get("name") or "דלת"), "station_name": str(s.get("name") or "")})
    return out[:24]
