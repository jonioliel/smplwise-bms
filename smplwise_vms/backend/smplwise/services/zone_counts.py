"""ZONECOUNT107-295 (docs/changes/CR-ZONECOUNT107.md), slice 1: how many PEOPLE are in each mapped area right now and over time, derived from
the Frigate review items Arx already ingests (services/recorders/frigate_events.py). Read-only toward Frigate (no request is made from here),
counts only.

Semantics (slice 1, documented limits):
- a review item counts while it is OPEN (`end_ts` IS NULL) and was re-seen by the poll / WebSocket within REVIEW_STALE_S; a closed or stale
  item stops counting at once (stale = the count shrinks, it never lingers);
- the people in a review = the number of `person` entries in its `objects` list, at least 1 when the label is there. Whether Frigate lists a
  label once per tracked object or once per review is NOT VERIFIED on a live instance, so this is a LOWER BOUND until it is;
- a review's `zones` is the union over its objects, so a review whose objects stand in two mapped zones adds its people to BOTH areas;
- two cameras that see the same room are summed (no de-duplication across overlapping cameras in slice 1);
- an area whose event source is not fresh (no successful poll within SOURCE_FRESH_S) is UNKNOWN (None), never zero.

Kept: integers per area (`zone_count_samples`), written when the value changes and at least every HEARTBEAT_S, pruned after
`occupancy.retention_days` (default 7) and capped at MAX_SAMPLES_PER_AREA. Nothing about a person is stored. Default OFF (`occupancy.enabled`)."""
from __future__ import annotations

import datetime as dt
import json
import sqlite3
from typing import Any

from ..db import get_setting, new_id, now_iso, set_setting
from ..errors import ApiError

UTC = dt.timezone.utc
ENABLED = "occupancy.enabled"
RETENTION = "occupancy.retention_days"
RETENTION_MIN, RETENTION_MAX, RETENTION_DEFAULT = 1, 90, 7
REVIEW_STALE_S = 180.0       # an open review not re-seen for this long no longer counts (the poll re-applies the open items every <= 60 s)
SOURCE_FRESH_S = 300.0       # the last successful poll of a recorder must be this recent, or its areas are unknown
HEARTBEAT_S = 300.0          # an unchanged value is written again after this long (a gap in the series longer than 2x this reads as unknown)
MAX_SAMPLES_PER_AREA = 20000
MAX_MAPPINGS = 500
MAX_HOURS = 24 * 90
PRUNE_EVERY_S = 3600.0
PERSON = "person"

_last_prune: dict[str, float] = {}


def _iso(d: dt.datetime) -> str:
    return d.astimezone(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _parse(text: Any) -> dt.datetime | None:
    try:
        d = dt.datetime.fromisoformat(str(text).replace("Z", "+00:00"))
    except ValueError:
        return None
    return d if d.tzinfo else d.replace(tzinfo=UTC)


# ---------------------------------------------------------------------------------------------- switches

def enabled(conn: sqlite3.Connection) -> bool:
    return get_setting(conn, ENABLED, "off") == "on"


def retention_days(conn: sqlite3.Connection) -> int:
    try:
        v = int(get_setting(conn, RETENTION, str(RETENTION_DEFAULT)) or RETENTION_DEFAULT)
    except ValueError:
        v = RETENTION_DEFAULT
    return min(RETENTION_MAX, max(RETENTION_MIN, v))


def settings_view(conn: sqlite3.Connection) -> dict[str, Any]:
    return {"enabled": enabled(conn), "retention_days": retention_days(conn), "retention_min": RETENTION_MIN, "retention_max": RETENTION_MAX,
            "review_stale_s": int(REVIEW_STALE_S), "source_fresh_s": int(SOURCE_FRESH_S), "heartbeat_s": int(HEARTBEAT_S)}


def apply_settings(conn: sqlite3.Connection, *, enabled_: bool | None, retention: int | None) -> dict[str, Any]:
    """Store the switches. Turning the feature OFF deletes every sample (data minimisation: counts of a room are kept only while the
    feature is on); the mapping stays so turning it on again needs no re-entry."""
    if retention is not None:
        if not RETENTION_MIN <= retention <= RETENTION_MAX:
            raise ApiError(422, "invalid_retention", f"הערך חייב להיות בין {RETENTION_MIN} ל-{RETENTION_MAX} ימים.")
        set_setting(conn, RETENTION, str(retention))
    if enabled_ is not None:
        was = enabled(conn)
        set_setting(conn, ENABLED, "on" if enabled_ else "off")
        if was and not enabled_:
            conn.execute("DELETE FROM zone_count_samples")
    return settings_view(conn)


# ---------------------------------------------------------------------------------------------- mapping

def mappings(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute(
        "SELECT m.id, m.recorder_id, m.camera_key, m.frigate_zone, m.area_id, a.name AS area_name, m.created_at FROM zone_count_map m "
        "LEFT JOIN ha_areas a ON a.area_id = m.area_id ORDER BY m.area_id, m.recorder_id, m.camera_key, m.frigate_zone").fetchall()]


def add_mapping(conn: sqlite3.Connection, *, recorder_id: str, camera_key: str, frigate_zone: str, area_id: str, actor: str | None) -> dict[str, Any]:
    if not conn.execute("SELECT 1 FROM ha_areas WHERE area_id = ?", (area_id,)).fetchone():
        raise ApiError(404, "area_not_found", "האזור לא נמצא.")
    if not conn.execute("SELECT 1 FROM cameras WHERE recorder_id = ? AND source_ref = ?", (recorder_id, camera_key)).fetchone():
        raise ApiError(404, "camera_not_found", "המצלמה לא נמצאה אצל המקליט.")
    if conn.execute("SELECT COUNT(*) FROM zone_count_map").fetchone()[0] >= MAX_MAPPINGS:
        raise ApiError(409, "too_many_mappings", "יותר מדי מיפויים.")
    if conn.execute("SELECT 1 FROM zone_count_map WHERE recorder_id = ? AND camera_key = ? AND frigate_zone = ?", (recorder_id, camera_key, frigate_zone)).fetchone():
        raise ApiError(409, "mapping_exists", "המיפוי כבר קיים.")
    mid = new_id()
    conn.execute("INSERT INTO zone_count_map(id, recorder_id, camera_key, frigate_zone, area_id, created_by, created_at) VALUES (?,?,?,?,?,?,?)",
                 (mid, recorder_id, camera_key, frigate_zone, area_id, actor, now_iso()))
    return {"id": mid, "recorder_id": recorder_id, "camera_key": camera_key, "frigate_zone": frigate_zone, "area_id": area_id}


def delete_mapping(conn: sqlite3.Connection, mapping_id: str) -> dict[str, Any]:
    row = conn.execute("SELECT * FROM zone_count_map WHERE id = ?", (mapping_id,)).fetchone()
    if row is None:
        raise ApiError(404, "mapping_not_found", "המיפוי לא נמצא.")
    conn.execute("DELETE FROM zone_count_map WHERE id = ?", (mapping_id,))
    return dict(row)


# ---------------------------------------------------------------------------------------------- counting

def persons_in(objects: Any) -> int:
    """People in one review: the number of `person` entries of its objects list (so 1 when the label is there once, 0 when absent)."""
    if not isinstance(objects, list):
        return 0
    return sum(1 for o in objects if isinstance(o, str) and o.lower() == PERSON)


def area_sources(conn: sqlite3.Connection) -> dict[str, set[str]]:
    """area id -> the recorders that feed it (from the mapping)."""
    out: dict[str, set[str]] = {}
    for r in conn.execute("SELECT area_id, recorder_id FROM zone_count_map").fetchall():
        out.setdefault(r["area_id"], set()).add(r["recorder_id"])
    return out


def _fresh_recorders(conn: sqlite3.Connection, recorders: set[str], now: dt.datetime) -> set[str]:
    fresh: set[str] = set()
    for rid in recorders:
        row = conn.execute("SELECT last_poll_at, last_poll_error FROM frigate_sync_state WHERE recorder_id = ?", (rid,)).fetchone()
        if row is None or row["last_poll_error"] or not row["last_poll_at"]:
            continue
        at = _parse(row["last_poll_at"])
        if at is not None and (now - at).total_seconds() <= SOURCE_FRESH_S:
            fresh.add(rid)
    return fresh


def current_counts(conn: sqlite3.Connection, now: dt.datetime | None = None) -> dict[str, int | None]:
    """area id -> people now (None = unknown). Every mapped area is present in the answer."""
    now = now or dt.datetime.now(UTC)
    maps: dict[tuple[str, str], list[tuple[str, str]]] = {}
    for r in conn.execute("SELECT recorder_id, camera_key, frigate_zone, area_id FROM zone_count_map").fetchall():
        maps.setdefault((r["recorder_id"], r["camera_key"]), []).append((r["frigate_zone"], r["area_id"]))
    sources = area_sources(conn)
    fresh = _fresh_recorders(conn, {r for rs in sources.values() for r in rs}, now)
    totals: dict[str, int] = {a: 0 for a in sources}
    if maps:
        seen_after = _iso(now - dt.timedelta(seconds=REVIEW_STALE_S))
        for r in conn.execute("SELECT recorder_id, source_ref, objects_json, zones_json FROM frigate_reviews WHERE end_ts IS NULL AND last_seen_at >= ?", (seen_after,)).fetchall():
            entries = maps.get((r["recorder_id"], r["source_ref"]))
            if not entries:
                continue
            try:
                people = persons_in(json.loads(r["objects_json"] or "[]"))
                zones = {z for z in json.loads(r["zones_json"] or "[]") if isinstance(z, str)}
            except ValueError:
                continue
            if people <= 0:
                continue
            hit = {area for zone, area in entries if zone == "" or zone in zones}
            for area in hit:
                totals[area] += people
    return {area: (min(1000, totals[area]) if sources[area] <= fresh else None) for area in sources}


# ---------------------------------------------------------------------------------------------- the series

def sample(conn: sqlite3.Connection, now: dt.datetime | None = None) -> int:
    """Called by the Frigate event path after every poll / frame batch, inside its write transaction. Writes a row per mapped area whose
    value changed (or whose last row is older than HEARTBEAT_S); returns the rows written. Does nothing while the feature is off."""
    if not enabled(conn):
        return 0
    now = now or dt.datetime.now(UTC)
    written = 0
    for area, value in current_counts(conn, now).items():
        last = conn.execute("SELECT at, count FROM zone_count_samples WHERE area_id = ? ORDER BY id DESC LIMIT 1", (area,)).fetchone()
        due = last is None or last["count"] != value
        if not due:
            at = _parse(last["at"])
            due = at is None or (now - at).total_seconds() >= HEARTBEAT_S
        if due:
            conn.execute("INSERT INTO zone_count_samples(area_id, at, count) VALUES (?,?,?)", (area, _iso(now), value))
            written += 1
    if now.timestamp() - _last_prune.get("t", 0.0) >= PRUNE_EVERY_S:
        _last_prune["t"] = now.timestamp()
        prune(conn, now)
    return written


def prune(conn: sqlite3.Connection, now: dt.datetime | None = None) -> int:
    """Retention: rows older than `occupancy.retention_days`, then the per-area cap (oldest first), then rows of areas no longer mapped."""
    now = now or dt.datetime.now(UTC)
    cutoff = _iso(now - dt.timedelta(days=retention_days(conn)))
    n = conn.execute("DELETE FROM zone_count_samples WHERE at < ?", (cutoff,)).rowcount
    for r in conn.execute("SELECT area_id, COUNT(*) AS n FROM zone_count_samples GROUP BY area_id HAVING n > ?", (MAX_SAMPLES_PER_AREA,)).fetchall():
        n += conn.execute("DELETE FROM zone_count_samples WHERE area_id = ? AND id <= (SELECT id FROM zone_count_samples WHERE area_id = ? ORDER BY id DESC LIMIT 1 OFFSET ?)",
                          (r["area_id"], r["area_id"], MAX_SAMPLES_PER_AREA)).rowcount
    n += conn.execute("DELETE FROM zone_count_samples WHERE area_id NOT IN (SELECT area_id FROM zone_count_map)").rowcount
    return n


def series(conn: sqlite3.Connection, area_id: str, hours: int, now: dt.datetime | None = None) -> dict[str, Any]:
    """The stored points of one area over the last `hours` (bounded by the retention) plus the value in force at the window start."""
    now = now or dt.datetime.now(UTC)
    hours = max(1, min(hours, MAX_HOURS, retention_days(conn) * 24))
    start = _iso(now - dt.timedelta(hours=hours))
    before = conn.execute("SELECT count FROM zone_count_samples WHERE area_id = ? AND at < ? ORDER BY id DESC LIMIT 1", (area_id, start)).fetchone()
    pts = [{"at": r["at"], "count": r["count"]} for r in conn.execute("SELECT at, count FROM zone_count_samples WHERE area_id = ? AND at >= ? ORDER BY id LIMIT 5000", (area_id, start)).fetchall()]
    known = [p["count"] for p in pts if p["count"] is not None]
    return {"from": start, "to": _iso(now), "hours": hours, "start_value": before["count"] if before else None, "points": pts,
            "max": max(known) if known else None, "heartbeat_s": int(HEARTBEAT_S)}


def janitor(db: Any, now: dt.datetime | None = None) -> int:
    """main.janitor_tick hook (REL2140 review M-2). While the feature is OFF, every sample left over is deleted - whatever switched it off
    without the PUT /occupancy/settings delete (a direct write, an older build); while it is ON, the retention runs at most every
    PRUNE_EVERY_S even when no Frigate poll calls `sample`. The switch is read on a read connection first, so an OFF install with no
    samples never takes the write lock. Never raises (a missing table on an older database included); returns the rows deleted."""
    import logging

    now = now or dt.datetime.now(UTC)
    try:
        with db.connection(mode="read", label="zone_counts.janitor_read") as conn:
            on = enabled(conn)
            if not on and conn.execute("SELECT 1 FROM zone_count_samples LIMIT 1").fetchone() is None:
                return 0
        if on and now.timestamp() - _last_prune.get("janitor", 0.0) < PRUNE_EVERY_S:
            return 0
        with db.connection(label="zone_counts.janitor") as conn:
            if not enabled(conn):  # re-checked inside the write transaction
                return conn.execute("DELETE FROM zone_count_samples").rowcount
            _last_prune["janitor"] = now.timestamp()
            return prune(conn, now)
    except Exception:  # noqa: BLE001 - housekeeping never stops the janitor
        logging.getLogger("smplwise.zone_counts").warning("zone count janitor failed", exc_info=True)
        return 0


# ---------------------------------------------------------------------------------------------- the hook

def sample_quietly(conn: sqlite3.Connection) -> None:
    """The call the Frigate event path makes: it must never break ingestion (a missing table on an older database included)."""
    import logging

    try:
        sample(conn)
    except Exception:  # noqa: BLE001
        logging.getLogger("smplwise.zone_counts").exception("zone count sampling failed")
