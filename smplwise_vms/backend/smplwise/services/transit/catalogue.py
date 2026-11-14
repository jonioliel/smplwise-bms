"""BUSTIMES-295 - the local stop catalogue. A nightly job (04:00 in the installation's zone) downloads the day's `gtfs_stops` (3 pages of about
2 MB), deduplicates by stop code and replaces `transit_stops`; the settings search (city list, city + name filter, a code) reads only this table,
so configuring a screen makes no third-party call. A failed download keeps yesterday's table (still valid), and says so in the status."""
from __future__ import annotations

import datetime as dt
import json
import logging
import sqlite3
from typing import Any

from ...db import Database, get_setting, set_setting
from . import stride

log = logging.getLogger("smplwise.transit")

STATUS_KEY = "transit.catalogue"
SEARCH_MAX = 40


def status(conn: sqlite3.Connection) -> dict[str, Any]:
    """`{count, date, ok_at, error}`: how many stops the table holds, the day of the snapshot, when it was loaded, the last failure (if any)."""
    try:
        doc = json.loads(get_setting(conn, STATUS_KEY, "") or "{}")
    except ValueError:
        doc = {}
    count = conn.execute("SELECT COUNT(*) FROM transit_stops").fetchone()[0]
    return {"count": count, "date": doc.get("date") if count else None, "ok_at": doc.get("ok_at") if count else None, "error": doc.get("error") or None,
            "error_at": doc.get("error_at") or None}


def due(conn: sqlite3.Connection, local_now: dt.datetime) -> bool:
    """Is the nightly download due: the table is empty, or it is older than today and the clock has passed 04:00 (local)."""
    st = status(conn)
    if st["count"] == 0:
        return True
    return local_now.hour >= 4 and st["date"] != local_now.date().isoformat()


def refresh(db: Database, fetch: stride.Fetch, now: dt.datetime, local_day: dt.date) -> dict[str, Any]:
    """Download and replace. Never raises: the outcome is in the returned status (and the stored one). The network part runs outside any
    database transaction; the swap is one short write."""
    try:
        stops = stride.fetch_catalogue(fetch, local_day)
    except stride.StrideError as exc:
        log.warning("transit catalogue download failed: %s", exc.kind)
        with db.connection(label="transit.catalogue.fail") as conn:
            old = json.loads(get_setting(conn, STATUS_KEY, "") or "{}")
            set_setting(conn, STATUS_KEY, json.dumps({**old, "error": exc.kind, "error_at": _iso(now)}))
            return status(conn)
    except Exception as exc:  # noqa: BLE001 - a job never takes the loop down
        log.exception("transit catalogue download crashed")
        with db.connection(label="transit.catalogue.fail") as conn:
            old = json.loads(get_setting(conn, STATUS_KEY, "") or "{}")
            set_setting(conn, STATUS_KEY, json.dumps({**old, "error": type(exc).__name__, "error_at": _iso(now)}))
            return status(conn)
    with db.connection(label="transit.catalogue.swap") as conn:
        conn.execute("DELETE FROM transit_stops")
        conn.executemany("INSERT INTO transit_stops(code, name, city, lat, lon) VALUES (?, ?, ?, ?, ?)",
                         [(s["code"], s["name"], s["city"], s["lat"], s["lon"]) for s in stops])
        set_setting(conn, STATUS_KEY, json.dumps({"date": local_day.isoformat(), "ok_at": _iso(now), "count": len(stops)}))
        return status(conn)


def _iso(t: dt.datetime) -> str:
    return t.astimezone(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _like(s: str) -> str:
    return "%" + s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"


def cities(conn: sqlite3.Connection) -> list[str]:
    return [r[0] for r in conn.execute("SELECT DISTINCT city FROM transit_stops WHERE city <> '' ORDER BY city").fetchall()]


def search(conn: sqlite3.Connection, *, city: str = "", q: str = "", limit: int = SEARCH_MAX) -> list[dict[str, Any]]:
    """Stops by city (exact) and/or words of the name (every word must occur) and/or a code (digits only: the code itself or a prefix of it)."""
    q = " ".join((q or "").split())
    where: list[str] = []
    args: list[Any] = []
    if city:
        where.append("city = ?")
        args.append(city)
    if q.isdigit():
        where.append("(code = ? OR CAST(code AS TEXT) LIKE ? ESCAPE '\\')")
        args += [int(q), q + "%"]
    else:
        for word in q.split():
            where.append("name LIKE ? ESCAPE '\\'")
            args.append(_like(word))
    if not where:
        return []
    rows = conn.execute(f"SELECT code, name, city, lat, lon FROM transit_stops WHERE {' AND '.join(where)} ORDER BY (code = ?) DESC, city, name LIMIT ?",
                        (*args, int(q) if q.isdigit() else -1, max(1, min(limit, 100)))).fetchall()
    return [dict(r) for r in rows]


def get(conn: sqlite3.Connection, code: int) -> dict[str, Any] | None:
    r = conn.execute("SELECT code, name, city, lat, lon FROM transit_stops WHERE code = ?", (code,)).fetchone()
    return dict(r) if r else None
