"""PRESENCE-2280: the building-presence history - when each room (and the building) became occupied, clear or unknown, kept `retention_days`.

Only while the master switch (`enabled`, off by default) is on AND `retention_days` > 0. Switching the module off, or setting 0, stops recording and
erases what was kept. Rows hold a timestamp, a room id/name and a status: no person, phone, picture or sensor identifier. Written by the housekeeping
tick (every ~30 s) from the live snapshot; a stale mirror (link down) records nothing, so an outage never shows as an empty building."""
from __future__ import annotations

import datetime as dt
import sqlite3
from typing import Any

from ..db import Database
from . import building_presence as bp


def summary(conn: sqlite3.Connection) -> dict[str, Any]:
    r = conn.execute("SELECT COUNT(*) AS n, MIN(at) AS oldest FROM presence_building_history").fetchone()
    return {"rows": r["n"], "oldest": r["oldest"], "retention_days": bp.get_config(conn)["retention_days"], "enabled": bp.is_enabled(conn)}


def purge(conn: sqlite3.Connection) -> int:
    return conn.execute("DELETE FROM presence_building_history").rowcount


def _last(conn: sqlite3.Connection, scope: str, area_id: str | None) -> str | None:
    r = conn.execute("SELECT status FROM presence_building_history WHERE scope = ? AND area_id IS ? ORDER BY id DESC LIMIT 1", (scope, area_id)).fetchone()
    return r["status"] if r else None


def record(conn: sqlite3.Connection, now: dt.datetime | None = None, fresh: bool = True) -> int:
    """Insert one row per room / building whose status changed since its last row; returns the number written."""
    cfg = bp.get_config(conn)
    if not cfg["enabled"] or cfg["retention_days"] <= 0 or not fresh:
        return 0
    snap = bp.snapshot(conn, now, fresh=True)
    if not snap.get("configured"):
        return 0
    at = snap["at"]
    items = [("building", None, None, snap["status"])] + [("room", r["area_id"], r["name"], r["status"]) for r in snap["rooms"]]
    n = 0
    for scope, area_id, name, status in items:
        if _last(conn, scope, area_id) != status:
            conn.execute("INSERT INTO presence_building_history(at, scope, area_id, area_name, status) VALUES(?,?,?,?,?)", (at, scope, area_id, name, status))
            n += 1
    return n


def prune(conn: sqlite3.Connection, now: dt.datetime | None = None) -> int:
    cfg = bp.get_config(conn)
    if not cfg["enabled"] or cfg["retention_days"] <= 0:
        return purge(conn)
    cutoff = (now or dt.datetime.now(dt.timezone.utc)) - dt.timedelta(days=cfg["retention_days"])
    return conn.execute("DELETE FROM presence_building_history WHERE at < ?", (bp._iso(cutoff),)).rowcount


def janitor(db: Database) -> dict[str, int]:
    from . import ha_sync

    with db.connection(label="presence.building.history") as conn:
        pruned = prune(conn)
        written = record(conn, fresh=bool(ha_sync.STATE.connected))
    return {"written": written, "pruned": pruned}
