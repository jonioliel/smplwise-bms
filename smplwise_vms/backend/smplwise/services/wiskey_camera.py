"""WisKey station camera stills through go2rtc (T054, owner rule 2026-09-28: all video goes through go2rtc).

A station's camera is pulled by go2rtc from the station itself, exactly as WisKey's own live view does
(`rtsp://<user>:<pass>@<host>:554/Streaming/Channels/101`, WISKEY_SOURCE_EXTRACTION.md 0.4): the host comes from WisKey's
`overview` (kept server-side by the feed, never served), the credentials are SMPLWISE's own - a per-station override
(`wiskey_station_credentials`) if a system administrator set one, else the shared add-on options `wiskey_username` /
`wiskey_password`. Nothing here ever returns, logs or audits a credential."""
from __future__ import annotations

import sqlite3
from typing import Any

from ..config import Settings
from ..db import now_iso
from ..errors import ApiError
from . import intercom_sync


def default_configured(settings: Settings) -> bool:
    return bool(settings.wiskey_user and settings.wiskey_password)


def credentials(conn: sqlite3.Connection, settings: Settings, station_id: str) -> tuple[str, str]:
    """(username, password) for the station: its override, else the shared default, else 503 source_not_configured."""
    row = conn.execute("SELECT username, password FROM wiskey_station_credentials WHERE station_id = ?", (station_id,)).fetchone()
    if row:
        return row["username"], row["password"]
    if default_configured(settings):
        return settings.wiskey_user or "", settings.wiskey_password or ""
    raise ApiError(503, "source_not_configured", "פרטי הגישה למצלמות עמדות WisKey לא הוגדרו (wiskey_username / wiskey_password בהגדרות ה־Add-on).")


def status(conn: sqlite3.Connection, settings: Settings, station_id: str) -> dict[str, Any]:
    """What an administrator may know about a station's credentials: whether an override exists (never its value)."""
    row = conn.execute("SELECT updated_at FROM wiskey_station_credentials WHERE station_id = ?", (station_id,)).fetchone()
    default = default_configured(settings)
    return {
        "station_id": station_id,
        "override": row is not None,
        "override_updated_at": row["updated_at"] if row else None,
        "default_configured": default,
        "effective": "override" if row else "default" if default else "none",
    }


def set_override(conn: sqlite3.Connection, station_id: str, username: str, password: str, actor_id: str | None) -> bool:
    """Store (or replace) the station's override; True when one existed before."""
    existed = conn.execute("SELECT 1 FROM wiskey_station_credentials WHERE station_id = ?", (station_id,)).fetchone() is not None
    conn.execute(
        """INSERT INTO wiskey_station_credentials(station_id, username, password, updated_at, updated_by) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(station_id) DO UPDATE SET username = excluded.username, password = excluded.password,
           updated_at = excluded.updated_at, updated_by = excluded.updated_by""",
        (station_id, username, password, now_iso(), actor_id),
    )
    return existed


def clear_override(conn: sqlite3.Connection, station_id: str) -> bool:
    return conn.execute("DELETE FROM wiskey_station_credentials WHERE station_id = ?", (station_id,)).rowcount > 0


def camera_access(conn: sqlite3.Connection, settings: Settings, overview: dict[str, Any] | None) -> dict[str, str]:
    """Per station with a camera, whether its still can be asked for at all, so the entry center can say why not
    instead of showing a broken image: `ready`, `no_media` (go2rtc not configured), `no_host` (WisKey sent no host),
    `no_credentials` (neither an override nor the shared default)."""
    stations = [s for s in (overview or {}).get("stations", []) if s.get("camera_entity")]
    if not stations:
        return {}
    overrides = {r["station_id"] for r in conn.execute("SELECT station_id FROM wiskey_station_credentials").fetchall()}
    default = default_configured(settings)
    out: dict[str, str] = {}
    for s in stations:
        sid = s["id"]
        if not settings.go2rtc_url:
            out[sid] = "no_media"
        elif not intercom_sync.SYNC.station_host(settings, sid):
            out[sid] = "no_host"
        elif sid not in overrides and not default:
            out[sid] = "no_credentials"
        else:
            out[sid] = "ready"
    return out
