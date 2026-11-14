"""CR-SHIFT114 (r114, docs/changes/CR-SHIFT114.md): the shift / 24-hour summary - what happened in the building in a time window, built from
data Arx already holds and written by a fixed Hebrew template (services/shift_text.py; no model).

`build()` returns structured data (one entry per section, every sentence with its count) and the rendered text. A section appears only when
(1) its module is on / configured, (2) the reader holds one of the section's permissions, and then every counted row passes the reader's own
visibility rule: tickets through `services/tickets/access` (the module's one rule), everything that raised a notification through
`services/notify_visibility.Reach` (the inbox rule: camera / floor / alarm panel / door / generator / elevator sensor / temperature sensor scopes),
so the summary never counts what the reader's inbox would hide. Counts only: no ticket title or number, no person, no entity id.

The window is half open, [lo, hi): a thing is "in the window" when it began at or after lo and before hi; "still open at the end" when it
began before hi and was not resolved before hi. Read-only; writes nothing."""
from __future__ import annotations

import datetime as dt
import sqlite3
from typing import Any

from ..db import get_setting
from ..rbac import Principal, permissions_anywhere
from . import shift_text as tx
from .notify_visibility import Reach
from .timeutil import iso_utc, parse_utc, zone

MAX_HOURS = 72  # a custom window is at most this long (the notification and event rows are not kept forever)
PRESETS = {"8h": 8 * 3600, "12h": 12 * 3600, "24h": 24 * 3600}
ROW_CAP = 5000  # rows read per section; a longer list is cut and `truncated` says so
OPEN_TICKET = ("closed", "cancelled")
ELEVATOR_STATES = ("fault", "out_of_service", "fire_service")

# a section is offered to a reader who holds ANY of these permissions (anywhere); items inside are then filtered row by row
SECTION_PERMISSIONS: dict[str, tuple[str, ...]] = {
    "tickets": ("tickets.view",),
    "alarms": ("alarm.view", "devices.read"),
    "doors": ("access.read", "devices.read"),
    "devices": ("events.read", "devices.read"),
    "temperature": ("devices.read",),
    "elevators": ("devices.read",),
    "generator": ("generator.view",),
}
ALARM_SOURCES = ("alarm.triggered",)
SAFETY_SOURCES = ("sensor.smoke", "sensor.leak", "sensor.gas", "sensor.co")
EMERGENCY_SOURCES = ("door.emergency.started", "door.emergency.partial")
DOOR_SOURCES = (*EMERGENCY_SOURCES, "door.relock_unconfirmed", "door.window_not_started", "opening.left_open", "door.ring")
DEVICE_SOURCES = ("camera.offline", "nvr.offline", "recorder.unreachable", "device.unavailable")


class WindowError(ValueError):
    """A bad window request; the message names the field (`range`, `from`, `to`)."""


def parse_window(rng: str, start: str | None, end: str | None, now_ts: float) -> tuple[int, int]:
    """(lo, hi) in unix seconds. A preset ends now. `custom` takes `from` (required) and `to` (default now) as ISO instants WITH a zone; `to` is
    never later than now; the span is 1 minute .. MAX_HOURS hours. WindowError for anything else."""
    now = int(now_ts)
    if rng in PRESETS:
        return now - PRESETS[rng], now
    if rng != "custom":
        raise WindowError("range")
    bounds: list[int] = []
    for field, raw in (("from", start), ("to", end)):
        if raw is None:
            if field == "from":
                raise WindowError("from")
            bounds.append(now)
            continue
        try:
            value = dt.datetime.fromisoformat(raw.strip().replace("Z", "+00:00"))
        except ValueError:
            raise WindowError(field) from None
        if value.tzinfo is None:
            raise WindowError(field)
        bounds.append(int(value.timestamp()))
    lo, hi = bounds[0], min(bounds[1], now)
    if hi - lo < 60 or hi - lo > MAX_HOURS * 3600:
        raise WindowError("to")
    return lo, hi


def _iso(ts: float) -> str:
    return iso_utc(dt.datetime.fromtimestamp(ts, dt.timezone.utc))


def _ts(value: str) -> float:
    return parse_utc(value).timestamp()


def _table_has_rows(conn: sqlite3.Connection, sql: str) -> bool:
    try:
        return conn.execute(sql).fetchone() is not None
    except sqlite3.Error:
        return False


def modules_on(conn: sqlite3.Connection) -> dict[str, bool]:
    """Which sections have a module that is on / configured. Tickets: the module switch. Elevators, temperature, generator: at least one enabled
    definition (an installation without them has nothing to say, and says nothing). Alarms, doors, devices: always (the Home Assistant mirror)."""
    from .tickets import access as ta

    return {
        "tickets": ta.module_on(conn),
        "alarms": True,
        "doors": True,
        "devices": True,
        "temperature": _table_has_rows(conn, "SELECT 1 FROM infra_temp_units WHERE enabled = 1 LIMIT 1"),
        "elevators": _table_has_rows(conn, "SELECT 1 FROM infra_elevators WHERE enabled = 1 LIMIT 1"),
        "generator": _table_has_rows(conn, "SELECT 1 FROM generator_devices WHERE status <> 'removed' LIMIT 1"),
    }


def offered(conn: sqlite3.Connection, principal: Principal) -> list[str]:
    """The sections this reader gets, in the fixed order: module on AND a permission of the section held."""
    held = set(permissions_anywhere(conn, principal))
    on = modules_on(conn)
    return [s for s in tx.ORDER if on[s] and held & set(SECTION_PERMISSIONS[s])]


def _line(key: str, n: int, **extra: Any) -> dict[str, Any]:
    return {"id": key, "n": n, "text": tx.say(key, n, **extra)}


# ---------------------------------------------------------------- the sections

def tickets(conn: sqlite3.Connection, principal: Principal, lo: int, hi: int) -> dict[str, Any]:
    from .tickets import access as ta

    a, b = _iso(lo), _iso(hi)
    placeholders = ",".join("?" * len(OPEN_TICKET))
    ids = [r[0] for r in conn.execute(
        f"""SELECT id FROM tickets WHERE (created_at >= ? AND created_at < ?) OR (closed_at >= ? AND closed_at < ?)
            OR (created_at < ? AND ((closed_at IS NULL AND status NOT IN ({placeholders})) OR closed_at >= ?)) LIMIT ?""",
        (a, b, a, b, b, *OPEN_TICKET, b, ROW_CAP)).fetchall()]
    rows = [s.row for s in ta.visible_by_ids(ta.Viewer(conn, principal), ids).values()]
    opened = sum(1 for r in rows if a <= r["created_at"] < b)
    closed = sum(1 for r in rows if r["closed_at"] and a <= r["closed_at"] < b)
    # open at the end of the window: made before it ended and not closed before it ended (a ticket still without a closing instant is open
    # unless its status says closed; one closed at or after the end was open when the window ended)
    open_end = [r for r in rows if r["created_at"] < b and ((r["closed_at"] and r["closed_at"] >= b) or (not r["closed_at"] and r["status"] not in OPEN_TICKET))]
    overdue = sum(1 for r in open_end if r["resolve_due_at"] and r["resolve_due_at"] < b)
    lines = [_line("tickets.opened", opened), _line("tickets.closed", closed), _line("tickets.open", len(open_end))]
    if overdue:
        lines.append(_line("tickets.overdue", overdue))
    return {"lines": lines, "attention": opened + closed + len(open_end), "truncated": len(ids) >= ROW_CAP,
            "counts": {"opened": opened, "closed": closed, "open": len(open_end), "overdue": overdue}}


def _notes(conn: sqlite3.Connection, reach: Reach, sources: tuple[str, ...], lo: int, hi: int) -> tuple[list[dict[str, Any]], bool]:
    """The notification rows of `sources` that overlap the window and that the reader may see (`Reach.can_see`, the inbox rule)."""
    a, b = _iso(lo), _iso(hi)
    marks = ",".join("?" * len(sources))
    rows = conn.execute(
        f"""SELECT source, subject_kind, subject_id, count, first_at, resolved_at, origin_json FROM notifications
            WHERE source IN ({marks}) AND first_at < ? AND (resolved_at IS NULL OR resolved_at >= ?) ORDER BY first_at LIMIT ?""",
        (*sources, b, a, ROW_CAP)).fetchall()
    out = [dict(r) for r in rows if reach.can_see(dict(r))]
    return out, len(rows) >= ROW_CAP


def _began(n: dict[str, Any], lo: int) -> bool:
    return _ts(n["first_at"]) >= lo


def _open_at_end(n: dict[str, Any], hi: int) -> bool:
    return not n["resolved_at"] or _ts(n["resolved_at"]) >= hi


def alarms(conn: sqlite3.Connection, reach: Reach, lo: int, hi: int) -> dict[str, Any]:
    rows, cut = _notes(conn, reach, (*ALARM_SOURCES, *SAFETY_SOURCES), lo, hi)
    alarm = [n for n in rows if n["source"] in ALARM_SOURCES]
    safety = [n for n in rows if n["source"] in SAFETY_SOURCES]
    raised = sum(1 for n in alarm if _began(n, lo))
    active = sum(1 for n in alarm if _open_at_end(n, hi))
    s_raised = sum(1 for n in safety if _began(n, lo))
    s_active = sum(1 for n in safety if _open_at_end(n, hi))
    lines = [_line("alarms.raised", raised)]
    if active:
        lines.append(_line("alarms.active", active))
    if s_raised:
        lines.append(_line("alarms.safety", s_raised))
    if s_active:
        lines.append(_line("alarms.safety_active", s_active))
    return {"lines": lines, "attention": raised + active + s_raised + s_active, "truncated": cut,
            "counts": {"raised": raised, "active": active, "safety": s_raised, "safety_active": s_active}}


def doors(conn: sqlite3.Connection, reach: Reach, lo: int, hi: int) -> dict[str, Any]:
    rows, cut = _notes(conn, reach, DOOR_SOURCES, lo, hi)
    began = [n for n in rows if _began(n, lo)]

    def total(sources: tuple[str, ...], weight: bool = False) -> int:
        return sum((n["count"] if weight else 1) for n in began if n["source"] in sources)

    emergency = total(EMERGENCY_SOURCES)
    relock = total(("door.relock_unconfirmed",))
    window = total(("door.window_not_started",))
    left_open = total(("opening.left_open",))
    rings = total(("door.ring",), weight=True)
    pairs = (("doors.emergency", emergency), ("doors.relock", relock), ("doors.window", window), ("doors.left_open", left_open), ("doors.rings", rings))
    lines = [_line(k, n) for k, n in pairs if n]
    notable = emergency + relock + window + left_open
    if not notable:
        lines.insert(0, _line("doors.none", 0))
    return {"lines": lines, "attention": notable, "truncated": cut,
            "counts": {"emergency": emergency, "relock_unconfirmed": relock, "window_not_started": window, "left_open": left_open, "rings": rings}}


def devices(conn: sqlite3.Connection, reach: Reach, lo: int, hi: int) -> dict[str, Any]:
    rows, cut = _notes(conn, reach, DEVICE_SOURCES, lo, hi)
    dropped = sum(1 for n in rows if _began(n, lo))
    now = sum(1 for n in rows if _open_at_end(n, hi))
    return {"lines": [_line("devices.dropped", dropped), _line("devices.now", now)], "attention": dropped + now, "truncated": cut,
            "counts": {"dropped": dropped, "unavailable_now": now}}


def temperature(conn: sqlite3.Connection, reach: Reach, lo: int, hi: int) -> dict[str, Any]:
    a, b = _iso(lo), _iso(hi)
    rows = conn.execute(
        """SELECT e.unit_id, e.severity, e.started_at, e.ended_at FROM infra_temp_events e JOIN infra_temp_units u ON u.id = e.unit_id
           WHERE u.enabled = 1 AND e.kind IN ('high', 'low') AND e.started_at < ? AND (e.ended_at IS NULL OR e.ended_at >= ?) LIMIT ?""",
        (b, a, ROW_CAP)).fetchall()
    seen: dict[str, bool] = {}
    mine = []
    for r in rows:
        if r["unit_id"] not in seen:
            seen[r["unit_id"]] = reach.can_see({"subject_kind": "temperature", "subject_id": r["unit_id"], "source": "temperature.alarm"})
        if seen[r["unit_id"]]:
            mine.append(r)
    began = [r for r in mine if r["started_at"] >= a]
    alarm = sum(1 for r in began if r["severity"] == "alarm")
    ongoing = sum(1 for r in mine if not r["ended_at"] or r["ended_at"] >= b)
    lines = [_line("temperature.excursions", len(began))]
    if alarm:
        lines.append(_line("temperature.alarm", alarm))
    if ongoing:
        lines.append(_line("temperature.ongoing", ongoing))
    return {"lines": lines, "attention": len(began) + ongoing, "truncated": len(rows) >= ROW_CAP,
            "counts": {"excursions": len(began), "alarm": alarm, "ongoing": ongoing}}


def elevators(conn: sqlite3.Connection, reach: Reach, lo: int, hi: int) -> dict[str, Any]:
    a, b = _iso(lo), _iso(hi)
    affected = fire = down_now = 0
    minutes = 0.0
    for e in conn.execute("SELECT id FROM infra_elevators WHERE enabled = 1 ORDER BY sort_order, name").fetchall():
        def seen(state: str, eid: str = e["id"]) -> bool:
            return reach.can_see({"subject_kind": "elevator", "subject_id": eid, "source": f"elevator.{state}"})

        visible = {s: seen(s) for s in ELEVATOR_STATES}
        prev = conn.execute("SELECT at, state FROM infra_elevator_states WHERE elevator_id = ? AND at <= ? ORDER BY at DESC LIMIT 1", (e["id"], a)).fetchone()
        rows = conn.execute("SELECT at, state FROM infra_elevator_states WHERE elevator_id = ? AND at > ? AND at < ? ORDER BY at", (e["id"], a, b)).fetchall()
        segs: list[tuple[float, str]] = ([(float(lo), prev["state"])] if prev is not None else []) + [(_ts(r["at"]), r["state"]) for r in rows]
        down = False
        was_fire = False
        for i, (t, st) in enumerate(segs):
            end = segs[i + 1][0] if i + 1 < len(segs) else float(hi)
            if st in ELEVATOR_STATES and visible[st]:
                minutes += (end - t) / 60
                down = True
                was_fire = was_fire or st == "fire_service"
        affected += down
        fire += was_fire
        if segs and segs[-1][1] in ELEVATOR_STATES and visible[segs[-1][1]]:
            down_now += 1
    lines = [_line("elevators.down", affected)]
    if affected:
        lines.append(_line("elevators.minutes", 0, dur=tx.duration(round(minutes))))
    if fire:
        lines.append(_line("elevators.fire", fire))
    if down_now:
        lines.append(_line("elevators.now", down_now))
    return {"lines": lines, "attention": affected + down_now, "truncated": False,
            "counts": {"affected": affected, "down_minutes": int(minutes), "fire_service": fire, "down_now": down_now}}


def generator(conn: sqlite3.Connection, reach: Reach, lo: int, hi: int) -> dict[str, Any]:
    a, b = _iso(lo), _iso(hi)
    if not reach.can_see({"subject_kind": "generator", "source": "generator.alert"}):
        rows: list[sqlite3.Row] = []
    else:
        rows = conn.execute(
            """SELECT g.severity, g.raised_at, g.cleared_at FROM generator_alerts g JOIN generator_devices d ON d.id = g.device_id
               WHERE d.status <> 'removed' AND g.raised_at < ? AND (g.cleared_at IS NULL OR g.cleared_at >= ?) LIMIT ?""", (b, a, ROW_CAP)).fetchall()
    began = [r for r in rows if r["raised_at"] >= a]
    critical = sum(1 for r in began if r["severity"] == "critical")
    active = sum(1 for r in rows if not r["cleared_at"] or r["cleared_at"] >= b)
    lines = [_line("generator.alerts", len(began))]
    if critical:
        lines.append(_line("generator.critical", critical))
    if active:
        lines.append(_line("generator.active", active))
    return {"lines": lines, "attention": len(began) + active, "truncated": len(rows) >= ROW_CAP,
            "counts": {"alerts": len(began), "critical": critical, "active": active}}


# ---------------------------------------------------------------- the whole summary

def build(conn: sqlite3.Connection, principal: Principal, lo: int, hi: int) -> dict[str, Any]:
    """The structured summary of [lo, hi) for this reader plus the rendered Hebrew text."""
    tz = zone(get_setting(conn, "time.zone", "Asia/Jerusalem") or "Asia/Jerusalem")
    reach = Reach(conn, principal)
    runners = {
        "tickets": lambda: tickets(conn, principal, lo, hi),
        "alarms": lambda: alarms(conn, reach, lo, hi),
        "doors": lambda: doors(conn, reach, lo, hi),
        "devices": lambda: devices(conn, reach, lo, hi),
        "temperature": lambda: temperature(conn, reach, lo, hi),
        "elevators": lambda: elevators(conn, reach, lo, hi),
        "generator": lambda: generator(conn, reach, lo, hi),
    }
    sections = []
    for key in offered(conn, principal):
        got = runners[key]()
        sections.append({"key": key, "title": tx.TITLES[key], **got})
    start = dt.datetime.fromtimestamp(lo, dt.timezone.utc).astimezone(tz)
    end = dt.datetime.fromtimestamp(hi, dt.timezone.utc).astimezone(tz)
    window = {"from": _iso(lo), "to": _iso(hi), "minutes": (hi - lo) // 60, "zone": str(tz), "start_label": tx.local_label(start),
              "end_label": tx.local_label(end), "duration_text": tx.duration((hi - lo) // 60)}
    quiet = bool(sections) and all(s["attention"] == 0 for s in sections)
    return {"v": 1, "lang": "he", "window": window, "quiet": quiet, "sections": sections, "text": tx.render(window, sections, quiet),
            "truncated": any(s["truncated"] for s in sections)}


def audit_details(model: dict[str, Any]) -> dict[str, Any]:
    """What the audit row keeps: the window length and the section keys with their attention counts - never a sentence, never an entity."""
    return {"minutes": model["window"]["minutes"], "sections": {s["key"]: s["attention"] for s in model["sections"]}}
