"""Local history of Home Assistant entity states (T041): every state the VMS learns of (the snapshot at connect and
each state_changed) is kept with HA's change time and the VMS receipt time, for a bounded retention. The historical
map asks "what was the state at t": known only when a recorded state covers t — either the next recorded change
comes after t, or t is within the forward-fill bound of the last confirmation. Before the history began, or when
nothing bounds the gap, the answer is unknown with the reason, never the last value dressed up as current."""
from __future__ import annotations

import datetime as dt
import sqlite3
from typing import Any

from ..db import Database, now_iso
from .timeutil import iso_utc, parse_utc

RETENTION_DAYS = 30
FORWARD_FILL_MAX_S = 24 * 3600


def _norm(value: str | None) -> str | None:
    if not value:
        return None
    try:
        return iso_utc(parse_utc(value))
    except (ValueError, TypeError):
        return None


def record(conn: sqlite3.Connection, st: dict[str, Any]) -> bool:
    """Store one HA state object if it is new for the entity (same change time = already known). Returns True when stored."""
    eid = st.get("entity_id")
    if not eid:
        return False
    changed = _norm(st.get("last_changed")) or now_iso()
    last = conn.execute("SELECT state, changed_at FROM ha_state_history WHERE entity_id = ? ORDER BY changed_at DESC, id DESC LIMIT 1", (eid,)).fetchone()
    if last and last["changed_at"] == changed and last["state"] == st.get("state"):
        return False
    conn.execute("INSERT INTO ha_state_history(entity_id, state, changed_at, recorded_at) VALUES (?, ?, ?, ?)", (eid, st.get("state"), changed, now_iso()))
    return True


def coverage(conn: sqlite3.Connection) -> dict[str, Any]:
    row = conn.execute("SELECT MIN(recorded_at) AS first, MAX(recorded_at) AS last, COUNT(*) AS n FROM ha_state_history").fetchone()
    return {"from": row["first"], "to": row["last"], "rows": row["n"], "retention_days": RETENTION_DAYS, "forward_fill_max_s": FORWARD_FILL_MAX_S}


def state_at(conn: sqlite3.Connection, entity_ids: list[str], at_iso: str) -> dict[str, dict[str, Any]]:
    """Per entity: {state, changed_at, known, reason}. `state` is the last recorded state before t even when unknown
    (as last_known), so a screen can say "last seen X at Y" without pretending it still holds."""
    out: dict[str, dict[str, Any]] = {}
    first = conn.execute("SELECT MIN(recorded_at) FROM ha_state_history").fetchone()[0]
    t = parse_utc(at_iso)
    for eid in entity_ids:
        if not first or at_iso < first:
            out[eid] = {"state": None, "changed_at": None, "known": False, "reason": "לפני תחילת ההיסטוריה המקומית"}
            continue
        row = conn.execute("SELECT state, changed_at, recorded_at FROM ha_state_history WHERE entity_id = ? AND changed_at <= ? ORDER BY changed_at DESC, id DESC LIMIT 1", (eid, at_iso)).fetchone()
        if not row:
            out[eid] = {"state": None, "changed_at": None, "known": False, "reason": "לא נרשם מצב לישות לפני הרגע הזה"}
            continue
        nxt = conn.execute("SELECT changed_at FROM ha_state_history WHERE entity_id = ? AND changed_at > ? ORDER BY changed_at ASC LIMIT 1", (eid, at_iso)).fetchone()
        confirmed = max(parse_utc(row["changed_at"]), parse_utc(row["recorded_at"]))
        if nxt is not None:
            known, reason = True, None  # the next recorded change bounds this state: it held at t
        elif (t - confirmed).total_seconds() <= FORWARD_FILL_MAX_S:
            known, reason = True, None
        else:
            known, reason = False, "המצב האחרון שנרשם ישן מ־24 שעות ואין שינוי מאוחר יותר שתוחם אותו; לא ממלאים קדימה ללא גבול"
        out[eid] = {"state": row["state"], "changed_at": row["changed_at"], "known": known, "reason": reason}
    for v in out.values():
        v.setdefault("source", "vms")
    return out


RECORDER_WINDOW_H = 24


def recorder_state_at(entity_ids: list[str], at_iso: str, *, fetch: Any | None = None) -> dict[str, dict[str, Any]]:
    """S2 (0.1.73): the state each entity had at t according to the Home Assistant recorder (a secondary source, used
    only when the local history does not know). One GET /api/history/period over the 24 h before t; the last change
    before t wins. Any failure returns {} - the map then says "unknown" as before."""
    import datetime as dt

    from ..config import load_settings
    from .ha_client import _headers, _rest_base, configured

    t = parse_utc(at_iso)
    start = (t - dt.timedelta(hours=RECORDER_WINDOW_H)).strftime("%Y-%m-%dT%H:%M:%S+00:00")
    end = t.strftime("%Y-%m-%dT%H:%M:%S+00:00")
    try:
        if fetch is None:
            settings = load_settings()
            if not configured(settings):
                return {}
            import httpx

            with httpx.Client(timeout=15) as c:
                r = c.get(f"{_rest_base(settings)}/history/period/{start}", params={"filter_entity_id": ",".join(entity_ids), "end_time": end, "minimal_response": "", "no_attributes": ""}, headers=_headers(settings))
            if r.status_code != 200:
                return {}
            data = r.json()
        else:
            data = fetch(entity_ids, start, end)
    except Exception:  # noqa: BLE001 - a secondary source never breaks the map
        return {}
    out: dict[str, dict[str, Any]] = {}
    for series in data or []:
        if not series:
            continue
        eid = series[0].get("entity_id")
        if not eid:
            continue
        last = None
        for item in series:
            changed = item.get("last_changed") or item.get("last_updated")
            if changed and changed[:19] <= at_iso[:19]:
                last = item
        if last is not None:
            out[eid] = {"state": last.get("state"), "changed_at": (last.get("last_changed") or "")[:19] + "Z" if last.get("last_changed") else None, "known": True, "reason": None, "source": "ha_recorder"}
    return out


def prune(conn: sqlite3.Connection, days: int = RETENTION_DAYS) -> int:
    cutoff = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")
    return conn.execute("DELETE FROM ha_state_history WHERE recorded_at < ?", (cutoff,)).rowcount


def prune_db(db: Database, days: int = RETENTION_DAYS) -> int:
    with db.connection() as conn:
        return prune(conn, days)
