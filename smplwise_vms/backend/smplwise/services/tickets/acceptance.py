"""CR-ACCEPT102 (board r102) slice 1: SMART ACCEPTANCE of vendor work. After a ticket is marked `done`, the sensors must show that the fix HELD
for a configurable time (default 24 h) before the ticket is confirmed (closed) automatically; otherwise it is reopened or flagged to a person.

Slice 1 knows ONE type: a ticket linked to a temperature unit (`infra_temp_tickets`). The healthy predicate is "the unit raised no
high / low / offline / frozen alert row" - the verdict of the existing alert engine (debounce, defrost windows, quiet hours already applied),
read from `infra_temp_events`. This module never polls a device and never reads Home Assistant: it only reads rows that already exist.

States of a `ticket_acceptance` row:
  pending   the ticket is `done`; waiting for the unit to be in range (no open breach row) and to report; ends in `start_timeout` after the grace
  holding   the clock runs from `hold_start` (the moment the unit was last healthy again, never before `done_at`) for `hold_minutes`
  accepted  the hold passed with no breach: the ticket was closed by the system (timeline `auto_closed`, data.by = acceptance)
  flagged   a breach / timeout and the rule says flag: the ticket STAYS `done`, the department managers are alerted, the department's own
            automatic close is blocked until a person decides
  reopened  a breach and the rule says reopen: `done` -> `in_progress` by the system, the assignee is told
  overridden a person moved the ticket (confirm = close, reopen, cancel, or a new `done`) before the system decided - the person wins

Everything is idempotent per tick and takes the clock as a parameter (`run(db, now)`); a restart loses nothing because the clock is stored in
the row (`hold_start`, `hold_until`). The switch (`ticket_acceptance_settings.enabled`, default off) AND the opt-in category list are both required."""
from __future__ import annotations

import datetime as dt
import json
import logging
import sqlite3
from dataclasses import dataclass
from typing import Any

from ...audit import audit
from ...db import Database
from . import model, notify_bridge, sla, store, stuck
from . import store_acceptance as sa

log = logging.getLogger("smplwise.tickets.acceptance")

BATCH = 100
BREACH_KINDS: tuple[str, ...] = ("high", "low", "offline", "frozen")
LIVE_WITHIN_S = 600  # the unit must have reported within this many seconds before the hold may start
ON_BREACH = ("flag", "reopen", "restart")
ACTIVE = ("pending", "holding", "flagged")
STATS: dict[str, int] = {"adopted": 0, "started": 0, "accepted": 0, "flagged": 0, "reopened": 0, "restarted": 0, "overridden": 0, "errors": 0}


@dataclass(frozen=True)
class Settings:
    enabled: bool
    hold_minutes: int
    start_grace_minutes: int
    on_breach: str
    max_restarts: int
    categories: tuple[str, ...]


def load_settings(conn: sqlite3.Connection) -> Settings:
    r = sa.settings_row(conn)
    if r is None:
        return Settings(False, 1440, 240, "flag", 2, ())
    try:
        cats = json.loads(r["categories_json"] or "[]")
    except ValueError:
        cats = []
    cats = tuple(str(c) for c in cats if isinstance(c, str)) if isinstance(cats, list) else ()
    return Settings(bool(r["enabled"]), int(r["hold_minutes"]), int(r["start_grace_minutes"]), str(r["on_breach"]), int(r["max_restarts"]), cats)


def _enabled(conn: sqlite3.Connection) -> bool:
    from .access import module_on

    return module_on(conn) and load_settings(conn).enabled


def blocks_auto_close(conn: sqlite3.Connection, ticket_id: str) -> bool:
    """The hook of the department's automatic close (monitor.auto_close): while the verification is pending, holding or flagged, only the
    acceptance (or a person) closes the ticket. Inert while the switch or the module is off."""
    try:
        state = sa.state_of(conn, ticket_id)
    except sqlite3.Error:
        return False
    return state in ACTIVE and _enabled(conn)


# ---------------------------------------------------------------- the temperature predicate

def _breaches(conn: sqlite3.Connection, unit_id: str, since: dt.datetime) -> list[dict[str, Any]]:
    """Alert rows that make the unit unhealthy for a hold that started at `since`: still open, or ended after `since`."""
    marks = ",".join("?" * len(BREACH_KINDS))
    out = []
    for r in conn.execute(f"SELECT id, kind, started_at, ended_at FROM infra_temp_events WHERE unit_id = ? AND kind IN ({marks})", (unit_id, *BREACH_KINDS)).fetchall():
        ended = stuck.parse(r["ended_at"])
        if ended is None or ended > since:
            out.append({"id": r["id"], "kind": r["kind"], "started_at": r["started_at"], "ended_at": r["ended_at"], "ended": ended})
    return out


def _unit_ok(conn: sqlite3.Connection, unit_id: str) -> bool:
    r = conn.execute("SELECT enabled FROM infra_temp_units WHERE id = ?", (unit_id,)).fetchone()
    return r is not None and bool(r["enabled"])


def _reporting(conn: sqlite3.Connection, unit_id: str, now: dt.datetime) -> bool:
    r = conn.execute("SELECT MAX(ts) FROM infra_temp_samples WHERE unit_id = ?", (unit_id,)).fetchone()
    return bool(r and r[0] is not None and now.timestamp() - float(r[0]) <= LIVE_WITHIN_S)


# ---------------------------------------------------------------- the tick

def run(db: Database, now: dt.datetime) -> dict[str, int]:
    """The janitor step (called by the SLA monitor's tick, once a minute). Returns what it did (empty when off)."""
    before = dict(STATS)
    try:
        with db.connection(label="tickets.acceptance") as conn:
            if not _enabled(conn):
                return {}
            active = sa.active_ids(conn, BATCH)
            adopt_ids = adoptable(conn)
        for tid in adopt_ids:
            _guarded(db, tid, lambda c, t=tid: adopt(c, t, now))
        for tid in [*active, *adopt_ids]:
            _guarded(db, tid, lambda c, t=tid: step(c, t, now))
    except Exception:  # noqa: BLE001 - housekeeping never fails the monitor
        STATS["errors"] += 1
        log.warning("ticket acceptance step failed", exc_info=True)
        return {}
    return {k: STATS[k] - before[k] for k in STATS if STATS[k] != before[k]}


def _guarded(db: Database, tid: str, fn: Any) -> None:
    try:
        with db.connection(label="tickets.acceptance") as conn:
            fn(conn)
    except Exception:  # noqa: BLE001 - one bad ticket never stops the others
        STATS["errors"] += 1
        log.warning("ticket acceptance failed on %s", tid, exc_info=True)


def adoptable(conn: sqlite3.Connection) -> list[str]:
    """`done` tickets with a verifiable temperature-unit link, in an opted-in category, that have no (current) verification row."""
    cfg = load_settings(conn)
    if not cfg.categories:
        return []
    return sa.adoptable_ids(conn, cfg.categories, BATCH)


def _done_seq(conn: sqlite3.Connection, ticket_id: str) -> int:
    """How many times the ticket entered `done` (timeline rows with to_status = done): a counter, so a reopen and a new `done` inside the
    same second (done_at has second precision) are still told apart."""
    return sa.done_seq(conn, ticket_id)


def adopt(conn: sqlite3.Connection, ticket_id: str, now: dt.datetime) -> bool:
    """Start the verification of one `done` ticket (the rule is frozen into the row, so a later settings change never moves a running one)."""
    cfg = load_settings(conn)
    row = sa.adopt_source(conn, ticket_id)
    if row is None:
        return False
    stamp = stuck.iso(now) or ""
    sa.replace_row(conn, {"ticket_id": ticket_id, "kind": "temperature", "subject_id": row["unit_id"], "state": "pending", "on_breach": cfg.on_breach,
                          "hold_minutes": cfg.hold_minutes, "start_grace_minutes": cfg.start_grace_minutes, "max_restarts": cfg.max_restarts,
                          "done_at": row["done_at"], "done_seq": _done_seq(conn, ticket_id), "pending_since": row["done_at"], "created_at": stamp})
    _note(conn, ticket_id, "acceptance_started", stamp, {"hold_minutes": cfg.hold_minutes, "on_breach": cfg.on_breach, "kind": "temperature"})
    STATS["adopted"] += 1
    return True


def step(conn: sqlite3.Connection, ticket_id: str, now: dt.datetime) -> str | None:
    """One look at one verification. Returns the new state (None = nothing changed)."""
    a = sa.row(conn, ticket_id)
    if a is None or a["state"] not in ACTIVE:
        return None
    t = store.ticket_row_system(conn, ticket_id)
    stamp = stuck.iso(now) or ""
    if t is None or t["status"] != "done" or _done_seq(conn, ticket_id) != a["done_seq"]:
        # a person moved the ticket first (confirm, reopen, cancel, or a fresh `done`): the person wins, the system only records it
        _finish(conn, ticket_id, "overridden", f"status_changed:{t['status'] if t else 'deleted'}", stamp)
        _note(conn, ticket_id, "acceptance_overridden", stamp, {"status": t["status"] if t else None})
        STATS["overridden"] += 1
        return "overridden"
    if a["state"] == "flagged":
        return None  # waiting for a person; the ticket stays `done`
    if not _unit_ok(conn, a["subject_id"]):
        return _fail(conn, a, t, now, "subject_unavailable")
    if a["state"] == "pending":
        return _pending(conn, a, t, now)
    return _holding(conn, a, t, now)


def _pending(conn, a, t, now: dt.datetime) -> str | None:
    since = stuck.parse(a["pending_since"]) or now
    breaches = _breaches(conn, a["subject_id"], since)
    if any(b["ended"] is None for b in breaches) or not _reporting(conn, a["subject_id"], now):
        if now >= since + dt.timedelta(minutes=int(a["start_grace_minutes"])):
            return _fail(conn, a, t, now, "start_timeout")
        return None
    hold_start = max([since, *[b["ended"] for b in breaches if b["ended"] is not None]])
    hold_start = min(hold_start, now)
    until = hold_start + dt.timedelta(minutes=int(a["hold_minutes"]))
    sa.start_hold(conn, a["ticket_id"], stuck.iso(hold_start), stuck.iso(until))
    _note(conn, a["ticket_id"], "acceptance_hold_started", stuck.iso(now) or "", {"hold_start": stuck.iso(hold_start), "hold_until": stuck.iso(until), "restarts": a["restarts"]})
    STATS["started"] += 1
    return "holding"


def _holding(conn, a, t, now: dt.datetime) -> str | None:
    start = stuck.parse(a["hold_start"]) or now
    breaches = _breaches(conn, a["subject_id"], start)
    if breaches:
        return _fail(conn, a, t, now, "breach", breach_event_id=breaches[0]["id"])
    until = stuck.parse(a["hold_until"])
    if until is None or now < until:
        return None
    from . import costs, monitor

    if costs.blocks_close(conn, a["ticket_id"]):
        return None  # a required cost claim is still pending: the same rule as the department's automatic close - retry next tick
    stamp = stuck.iso(now) or ""
    data = {"by": "acceptance", "kind": a["kind"], "hold_minutes": int(a["hold_minutes"]), "hold_start": a["hold_start"], "restarts": int(a["restarts"])}
    if not monitor.close_done(conn, t, now, "auto_closed", data, {"auto": True, "acceptance": True}):
        return None  # a person edited the ticket this very moment (revision moved): look again next tick
    _finish(conn, a["ticket_id"], "accepted", "accepted", stamp)
    STATS["accepted"] += 1
    return "accepted"


def _fail(conn, a, t, now: dt.datetime, why: str, *, breach_event_id: str | None = None) -> str:
    stamp = stuck.iso(now) or ""
    rule = a["on_breach"]
    if why == "breach" and rule == "restart" and int(a["restarts"]) < int(a["max_restarts"]):
        sa.restart(conn, a["ticket_id"], stamp, breach_event_id)
        _note(conn, a["ticket_id"], "acceptance_restarted", stamp, {"restarts": int(a["restarts"]) + 1, "max_restarts": int(a["max_restarts"]), "event": breach_event_id})
        STATS["restarted"] += 1
        return "pending"
    if rule == "reopen" and _reopen(conn, a, t, now, why):
        _finish(conn, a["ticket_id"], "reopened", why, stamp, breach_event_id)
        STATS["reopened"] += 1
        return "reopened"
    sa.flag(conn, a["ticket_id"], stamp, why, breach_event_id)
    _note(conn, a["ticket_id"], "acceptance_flagged", stamp, {"why": why, "event": breach_event_id})
    audit(conn, actor=None, action="ticket.acceptance", decision="allowed", resource_type="ticket", resource_id=a["ticket_id"],
          details={"number": t["number"], "result": "flagged", "why": why, "actor": "system"})
    notify_bridge.alert_managers(conn, t, "acceptance_failed")
    STATS["flagged"] += 1
    return "flagged"


def _reopen(conn, a, t, now: dt.datetime, why: str) -> bool:
    """`done` -> `in_progress` by the system - only when an assignee still holds the ticket (else it is flagged instead: nobody to hand it back to)."""
    asg = t.get("current_assignment_id") if not t.get("asg_ended_at") else None
    if not asg:
        return False
    stamp = stuck.iso(now) or ""
    on, reason = model.waiting_for("in_progress")
    if not store.update_ticket(conn, t["id"], {"status": "in_progress", "done_at": None, "waiting_on": on, "waiting_reason": reason, "last_activity_at": stamp},
                               expect_revision=t["revision"]):
        return False
    store.insert_event(conn, t["id"], "status", actor_kind="system", via="system", assignment_id=asg, from_status="done", to_status="in_progress", at=stamp,
                       data={"by": "acceptance", "why": why})
    audit(conn, actor=None, action="ticket.status", decision="allowed", resource_type="ticket", resource_id=t["id"],
          details={"number": t["number"], "from": "done", "to": "in_progress", "actor": "system", "acceptance": why})
    sla.refresh(conn, t["id"])
    notify_bridge.ticket_status(conn, t["id"], "done", "in_progress")
    notify_bridge.alert_managers(conn, t, "acceptance_failed")
    return True


# ---------------------------------------------------------------- bookkeeping

def _finish(conn: sqlite3.Connection, ticket_id: str, state: str, outcome: str, stamp: str, breach_event_id: str | None = None) -> None:
    sa.finish(conn, ticket_id, state, outcome, stamp, breach_event_id)


def _note(conn: sqlite3.Connection, ticket_id: str, kind: str, stamp: str, data: dict[str, Any]) -> None:
    store.insert_event(conn, ticket_id, kind, actor_kind="system", via="system", at=stamp, data=data)
