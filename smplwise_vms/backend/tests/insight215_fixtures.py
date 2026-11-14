"""CR-INSIGHT215 test helpers: invented entities, state history and clock. Fakes only - no Home Assistant, no device, no network."""
from __future__ import annotations

import datetime as dt
import json

from smplwise.db import Database, now_iso

UTC = dt.timezone.utc
API = "/api/v1"
# Monday 2026-10-12, before the autumn DST change (Asia/Jerusalem is UTC+3 that day)
T0 = dt.datetime(2026, 10, 12, 6, 0, tzinfo=UTC).timestamp()
NOW = dt.datetime(2026, 10, 12, 12, 0, tzinfo=UTC).timestamp()


def iso(ts: float) -> str:
    return dt.datetime.fromtimestamp(ts, UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def entity(conn, eid: str, name: str, *, device_class: str | None = None, area: str | None = None, state: str = "off") -> None:
    at = now_iso()
    conn.execute("""INSERT INTO ha_entities (entity_id, name, domain, device_class, area_id, state, available, last_changed, last_updated, first_seen_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)""", (eid, name, eid.split(".", 1)[0], device_class, area, state, at, at, at, at))


def area(conn, area_id: str, name: str) -> None:
    conn.execute("INSERT INTO ha_areas (area_id, name, floor_id, position, updated_at) VALUES (?, ?, NULL, 0, ?)", (area_id, name, now_iso()))


def hist(conn, eid: str, state: str, ts: float) -> None:
    conn.execute("INSERT INTO ha_state_history (entity_id, state, changed_at, recorded_at) VALUES (?, ?, ?, ?)", (eid, state, iso(ts), iso(ts)))


def switch(db: Database, key: str, on: bool = True) -> None:
    with db.connection() as conn:
        conn.execute("INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", (key, "true" if on else "false"))


def save_settings(db: Database, doc: dict) -> None:
    with db.connection() as conn:
        conn.execute("INSERT INTO settings(key, value) VALUES ('insights.settings', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                     (json.dumps(doc),))


def audit_rows(db: Database, action: str) -> list:
    with db.connection(mode="read") as conn:
        return conn.execute("SELECT decision, actor_username, details_json, reason FROM audit_log WHERE action = ? ORDER BY id", (action,)).fetchall()
