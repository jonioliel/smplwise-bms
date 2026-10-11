"""The site's location for the sun of the realistic 3D (CR-029 S2; owner decision 2026-10-11: the location comes from the
home's own configuration - latitude, longitude, elevation and time zone of the core config - not from a typed setting).

Source of truth, in order:

1. `manual` - only when an administrator explicitly chose it (`site.location_source` = "manual", Settings, system.configure)
   AND both `site.latitude` / `site.longitude` are set. The typed values are an override, never the default.
2. `ha` - the core config as the HA sync session read it (`get_config` on every connect, again every REFRESH_S while the
   session lives; no new access path, no extra request). The last value read is kept in the settings table
   (`site.ha_location`), so an unreachable Home Assistant - or a restart while it is down - keeps the last known location.
3. `default` - 32.0 / 34.8 (central Israel) and the site clock `time.zone`; the 3D view says so.

The time zone is the home's zone whenever it is known (also with a manual latitude / longitude: the override is about the
position), else the `time.zone` setting. The north angle stays per floor (the geometry document), never here.

Privacy: latitude / longitude are kept and served at 2 decimals (~1 km) - plenty for the sun (well under 0.1 deg of solar
position), and the exact address of the home never leaves Home Assistant. Only these numbers and the zone are kept: no
name, no URL, no token. The cache is local state: never exported in a backup, never restored from one (backup.SETTINGS_KEEP);
the next connect reads it again.
"""
from __future__ import annotations

import json
import logging
import math
import sqlite3
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from ..db import get_setting, now_iso, set_setting

log = logging.getLogger(__name__)

CACHE_KEY = "site.ha_location"  # internal: not in the settings DEFAULTS, so never in GET / PATCH /settings
MODE_KEY = "site.location_source"
MODES = ("home", "manual")
DEFAULT_MODE = "home"
DEFAULT = {"latitude": 32.0, "longitude": 34.8}
DEFAULT_ZONE = "Asia/Jerusalem"  # = routers/settings.DEFAULTS["time.zone"] (a test keeps them equal)
PRECISION = 2
REFRESH_S = 6 * 3600  # the location of a home moves rarely: a connect and four reads a day are plenty
SOURCES = ("ha", "manual", "default")


def _num(value: Any, limit: float) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    v = float(value)
    return v if math.isfinite(v) and -limit <= v <= limit else None


def _zone(value: Any) -> str | None:
    if not isinstance(value, str) or not 0 < len(value) <= 64:
        return None
    try:
        ZoneInfo(value)
    except (ZoneInfoNotFoundError, ValueError):
        return None
    return value


def from_ha_config(cfg: Any) -> dict[str, Any] | None:
    """The location part of a core config (`get_config` result / GET /api/config body), validated and rounded; None when it
    has no usable position. 0 / 0 is Home Assistant's own "never set" value (the core default), not a place."""
    if not isinstance(cfg, dict):
        return None
    lat, lon = _num(cfg.get("latitude"), 90.0), _num(cfg.get("longitude"), 180.0)
    if lat is None or lon is None or (lat == 0.0 and lon == 0.0):
        return None
    elev = _num(cfg.get("elevation"), 9000.0)
    return {"latitude": round(lat, PRECISION), "longitude": round(lon, PRECISION), "elevation_m": None if elev is None else int(round(elev)),
            "time_zone": _zone(cfg.get("time_zone"))}


def note_ha_config(conn: sqlite3.Connection, cfg: Any, now: str | None = None) -> bool:
    """Keep the location of a core config just read. A reply without a usable position changes nothing (the last known
    value stays). Returns whether a location was stored."""
    loc = from_ha_config(cfg)
    if loc is None:
        return False
    set_setting(conn, CACHE_KEY, json.dumps({**loc, "fetched_at": now or now_iso()}, separators=(",", ":")))
    return True


def cached(conn: sqlite3.Connection) -> dict[str, Any] | None:
    """The last location read from the home's configuration (None when never read, or the stored value is unreadable)."""
    raw = get_setting(conn, CACHE_KEY)
    try:
        value = json.loads(raw) if raw else None
    except ValueError:
        return None
    if not isinstance(value, dict):
        return None
    loc = from_ha_config({**value, "elevation": value.get("elevation_m")})  # the stored shape, validated again
    if loc is None:
        return None
    fetched = value.get("fetched_at")
    return {**loc, "fetched_at": fetched if isinstance(fetched, str) and len(fetched) <= 40 else None}


def _manual(conn: sqlite3.Connection) -> tuple[float, float] | None:
    out = []
    for key, limit in (("site.latitude", 90.0), ("site.longitude", 180.0)):
        raw = get_setting(conn, key, "")
        try:
            v = _num(float(raw), limit) if raw not in ("", None) else None
        except (TypeError, ValueError):
            v = None
        if v is None:
            return None
        out.append(v)
    return out[0], out[1]


def mode(conn: sqlite3.Connection) -> str:
    m = get_setting(conn, MODE_KEY, DEFAULT_MODE)
    return m if m in MODES else DEFAULT_MODE


def resolve(conn: sqlite3.Connection) -> dict[str, Any]:
    """The location the sun uses, with where it came from (`source`: ha | manual | default), the administrator's choice
    (`mode`: home | manual) and the home's own value (`home`, for the settings screen; None when never read)."""
    home = cached(conn)
    chosen = mode(conn)
    manual = _manual(conn) if chosen == "manual" else None
    site_zone = _zone(get_setting(conn, "time.zone", DEFAULT_ZONE)) or DEFAULT_ZONE
    zone = (home or {}).get("time_zone") or site_zone
    if manual is not None:
        lat, lon, source = manual[0], manual[1], "manual"
    elif home is not None:
        lat, lon, source = home["latitude"], home["longitude"], "ha"
    else:
        lat, lon, source = DEFAULT["latitude"], DEFAULT["longitude"], "default"
    return {"latitude": lat, "longitude": lon, "elevation_m": (home or {}).get("elevation_m"), "time_zone": zone, "source": source,
            "mode": chosen, "home": home}
