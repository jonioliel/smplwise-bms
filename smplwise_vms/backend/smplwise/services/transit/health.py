"""BUSTIMES-295 - source health for the system-health area and the settings tab: last success, age of the data, error count.
No service-ticket action (tickets module rule): an installer sees "bus data 40 minutes old" in Settings / the health report, nothing opens a ticket."""
from __future__ import annotations

import datetime as dt
import sqlite3
from typing import Any

from ...db import get_setting
from . import model, poller, stride


def view(conn: sqlite3.Connection, now: dt.datetime) -> dict[str, Any]:
    """`state`: off (module off / nothing in use), ok (data younger than 3 minutes), stale (older, within the grace), down (older than the grace
    or never fetched while something is in use)."""
    cfg = model.load_config(get_setting(conn, model.CONFIG_KEY, ""))
    used = poller.used_codes(conn) if cfg["enabled"] else {}
    h = poller.HEALTH.view()
    row = conn.execute("SELECT MIN(fetched_at) AS oldest, MAX(fetched_at) AS newest FROM transit_cache").fetchone()
    newest = stride.parse_time(row["newest"]) if row and row["newest"] else None
    oldest = stride.parse_time(row["oldest"]) if row and row["oldest"] else None
    age = max(0, int((now - oldest).total_seconds())) if oldest else None
    if not cfg["enabled"] or not used:
        state = "off"
    elif age is None:
        state = "down"
    elif age <= model.fresh_s(cfg):
        state = "ok"
    elif age <= max(model.fresh_s(cfg), cfg["stale_grace_min"] * 60):
        state = "stale"
    else:
        state = "down"
    return {"enabled": cfg["enabled"], "state": state, "codes_in_use": len(used), "age_s": age,
            "last_ok_at": newest.strftime("%Y-%m-%dT%H:%M:%SZ") if newest else h["last_ok_at"], "errors": h["errors"],
            "consecutive_errors": h["consecutive_errors"], "last_error": h["last_error"], "last_error_at": h["last_error_at"],
            "backoff_until": h["backoff_until"]}
