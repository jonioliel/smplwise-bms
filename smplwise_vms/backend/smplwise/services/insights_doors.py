"""CR-INSIGHT215 part 2: "door opened without a matching entry event" - a read-only security insight (EXPANSION_IDEAS idea 19).

For every DOOR PAIR the administrator set (Settings: a door contact sensor, optionally the door's lock entity and up to four request-to-exit
inputs; never guessed from names), each opening of the contact in the range is compared with what explains it inside a window of
`before_s` seconds before to `after_s` seconds after the opening (both settings):

* `lock`      - the lock entity changed to unlocked / open in the window (a card, a code, a release from the panel - whatever the door system
                reports through its lock entity);
* `unlocked`  - the lock was already unlocked / open at the opening (passage mode, a held-open door);
* `command`   - an unlock / open command was sent from this system in the window (`ha_actions`; a command is not proof the door opened, but it
                does explain an opening);
* `rex`       - a request-to-exit input changed in the window;
* `window`    - a door window (CR-039) of the lock's station relay was in effect (`door_window_occurrences` through `intercom_door_map`).

An opening with none of these is UNEXPLAINED. An opening that cannot be judged is UNVERIFIABLE, never unexplained: the pair has neither a lock
nor an exit input, or the lock's state is unknown for any part of the window (unavailable, before the history). An opening needs a KNOWN closed state
before it (the first state after a gap is not an opening) and must last at least `min_open_s` (contact chatter).

Privacy (CR section 5): door and time only. No person, card, code or entry-log row is read or returned - the entry log of the door system is
not consulted in this slice at all. Read-only: the local state history (`ha_state_history`), `ha_actions`, `intercom_door_map` and
`door_window_occurrences`; nothing is written and nothing is sent."""
from __future__ import annotations

import bisect
import hashlib
import sqlite3
from typing import Any

from . import insights_common as ic

OPEN_ON, CLOSED_ON = frozenset({"on", "open"}), frozenset({"off", "closed"})
LOCK_OPEN = frozenset({"unlocked", "unlocking", "open", "opening"})
LOCK_SHUT = frozenset({"locked", "locking", "jammed", "closed"})
COMMAND_WORDS = ("unlock", "open")
COMMAND_LIVE = ("pending", "confirmed", "unknown")
WINDOW_LIVE = ("active", "starting", "ending", "relock_unconfirmed")
MAX_ITEMS = 200  # listed openings per door (the counts are always the full counts)
RANK = 10
REASONS = ("lock", "unlocked", "command", "rex", "window")


def door_key(sensor_entity_id: str) -> str:
    """The opaque handle of a door in an answer (the entity id itself is returned to managers only, in the settings)."""
    return hashlib.sha256(("door:" + sensor_entity_id).encode("utf-8")).hexdigest()[:12]


def _openings(segs: list[ic.Segment], invert: bool, min_open_s: float) -> list[tuple[float, float, bool]]:
    """[(opened_at, open_until, open_at_end)] - a KNOWN closed state followed by an open state lasting at least min_open_s. `open_at_end`:
    the door was still open when the range (or the history) ended."""
    is_open, is_closed = (CLOSED_ON, OPEN_ON) if invert else (OPEN_ON, CLOSED_ON)
    out: list[tuple[float, float, bool]] = []
    for i in range(1, len(segs)):
        prev, cur = segs[i - 1], segs[i]
        if cur.state in is_open and prev.state in is_closed and cur.end - cur.start >= min_open_s:
            out.append((cur.start, cur.end, i == len(segs) - 1))
    return out


def _station_of(conn: sqlite3.Connection, lock: str | None) -> tuple[str, int] | None:
    if not lock:
        return None
    try:
        r = conn.execute("SELECT config_entry_id, physical_index FROM intercom_door_map WHERE entity_id = ?", (lock,)).fetchone()
    except sqlite3.Error:
        return None
    return (r["config_entry_id"], int(r["physical_index"])) if r is not None else None


def _windows(conn: sqlite3.Connection, station: tuple[str, int] | None, lo: float, hi: float) -> list[tuple[float, float]]:
    if station is None:
        return []
    try:
        rows = conn.execute(f"SELECT start_at, end_at FROM door_window_occurrences WHERE station_id = ? AND relay = ? AND start_at < ? AND end_at > ? "
                            f"AND state IN ({','.join('?' * len(WINDOW_LIVE))})", (station[0], station[1], ic.iso(hi), ic.iso(lo), *WINDOW_LIVE)).fetchall()
    except sqlite3.Error:
        return []
    return ic.merge([(ic.ts_of(r["start_at"]), ic.ts_of(r["end_at"])) for r in rows])


def _commands(conn: sqlite3.Connection, lock: str | None, lo: float, hi: float) -> list[float]:
    if not lock:
        return []
    rows = conn.execute(f"SELECT action_id, requested_at FROM ha_actions WHERE entity_id = ? AND requested_at >= ? AND requested_at <= ? "
                        f"AND status IN ({','.join('?' * len(COMMAND_LIVE))})", (lock, ic.iso(lo), ic.iso(hi), *COMMAND_LIVE)).fetchall()
    return sorted(ic.ts_of(r["requested_at"]) for r in rows if any(w in str(r["action_id"]).lower() for w in COMMAND_WORDS))


def _any_in(sorted_ts: list[float], a: float, b: float) -> bool:
    i = bisect.bisect_left(sorted_ts, a)
    return i < len(sorted_ts) and sorted_ts[i] <= b


def _state_at(segs: list[ic.Segment], starts: list[float], t: float) -> str | None:
    i = bisect.bisect_right(starts, t) - 1
    return segs[i].state if i >= 0 else None


def judge_pair(conn: sqlite3.Connection, pair: dict[str, Any], cfg: dict[str, Any], lo: float, hi: float) -> dict[str, Any]:
    """One door over [lo, hi): the counts, the reasons and the listed openings (unexplained and unverifiable, newest first, capped)."""
    before, after, min_open = float(cfg["before_s"]), float(cfg["after_s"]), float(cfg["min_open_s"])
    pad_lo, pad_hi = lo - before - 1, hi + after + 1
    sensor, lock, rex = pair["sensor_entity_id"], pair.get("lock_entity_id"), pair.get("rex_entity_ids") or []
    openings = [o for o in _openings(ic.timeline(conn, sensor, lo - 86400, hi), bool(pair.get("invert")), min_open) if lo <= o[0] < hi]
    lock_segs = ic.timeline(conn, lock, pad_lo, pad_hi) if lock else []
    lock_starts = [s.start for s in lock_segs]
    lock_opens = sorted(t for t, _f, to in ic.transitions(conn, lock, pad_lo, pad_hi) if to in LOCK_OPEN) if lock else []
    rex_ts = sorted(t for r in rex for t, _f, to in ic.transitions(conn, r, pad_lo, pad_hi) if to is not None and to not in CLOSED_ON)
    cmds = _commands(conn, lock, pad_lo, pad_hi)
    wins = _windows(conn, _station_of(conn, lock), pad_lo, pad_hi)
    judgeable = bool(lock or rex)
    counts = {"openings": len(openings), "explained": 0, "unexplained": 0, "unverifiable": 0}
    by_reason = dict.fromkeys(REASONS, 0)
    items: list[dict[str, Any]] = []
    for at, end, still in openings:
        a, b = at - before, at + after
        reasons = []
        if lock and _any_in(lock_opens, a, b):
            reasons.append("lock")
        if lock and not reasons and _state_at(lock_segs, lock_starts, a) in LOCK_OPEN:  # unlocked already before the window: held open
            reasons.append("unlocked")
        if _any_in(cmds, a, b):
            reasons.append("command")
        if _any_in(rex_ts, a, b):
            reasons.append("rex")
        if any(x <= at < y for x, y in wins):
            reasons.append("window")
        if reasons:
            verdict = "explained"
            for r in reasons:
                by_reason[r] += 1
        elif not judgeable:
            verdict = "unverifiable"
        elif lock and _lock_unknown(lock_segs, a, b):
            verdict = "unverifiable"  # the lock said nothing we can read around the opening: never call that unexplained
        else:
            verdict = "unexplained"
        counts[verdict] += 1
        if verdict != "explained":
            items.append({"at": ic.iso(at), "duration_s": int(end - at), "open_at_end": still, "verdict": verdict,
                          "why": "no_lock_or_exit" if verdict == "unverifiable" and not judgeable else ("lock_unknown" if verdict == "unverifiable" else None)})
    items.sort(key=lambda x: x["at"], reverse=True)
    return {**counts, "by_reason": by_reason, "judgeable": judgeable, "items": items[:MAX_ITEMS], "items_more": max(0, len(items) - MAX_ITEMS)}


def _lock_unknown(segs: list[ic.Segment], a: float, b: float) -> bool:
    """True when the lock's state is unknown for ANY part of [a, b] (or nothing covers it at all): an unlock may have happened unseen there."""
    touching = [s for s in segs if s.end > a and s.start < b]
    return not touching or any(s.state is None for s in touching)


def report(conn: sqlite3.Connection, scope: ic.Scope | None, lo: float, hi: float, cfg: dict[str, Any] | None = None) -> dict[str, Any]:
    """Every door pair the caller sees (`scope` None = everything: the building report, whose caller holds the installation permission)."""
    settings = ic.load(conn)
    cfg = cfg or settings["doors"]
    pairs = [p for p in cfg.get("pairs") or [] if scope is None or scope.sees(p["sensor_entity_id"])]
    names = ic.entity_names(conn, [p["sensor_entity_id"] for p in pairs])
    doors = []
    for p in pairs:
        row = names.get(p["sensor_entity_id"])
        out = judge_pair(conn, p, cfg, lo, hi)
        doors.append({"key": door_key(p["sensor_entity_id"]), "name": ic.friendly(row, "דלת"), "area": row["area_name"] if row is not None else None,
                      "floor": row["floor_name"] if row is not None else None, **out})
    doors.sort(key=lambda d: (-d["unexplained"], d["name"]))
    tot = {k: sum(d[k] for d in doors) for k in ("openings", "explained", "unexplained", "unverifiable")}
    ranking = [{"key": d["key"], "name": d["name"], "unexplained": d["unexplained"]} for d in doors if d["unexplained"] > 0][:RANK]
    return {"from": ic.iso(lo), "to": ic.iso(hi), "window": {"before_s": cfg["before_s"], "after_s": cfg["after_s"]}, "doors": doors,
            "total": tot, "ranking": ranking, "configured": bool(cfg.get("pairs"))}
