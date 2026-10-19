"""TKNOTIFMATRIX (CR-038 section 18A, "per-department notification matrix, daily digest"): which ticket event notifies, per department,
and whether it goes at once, once a day in a digest, or not at all.

The smallest safe version, behind two settings that default to TODAY's behaviour (`tickets.settings` block `notify`):
  - `notify.matrix_enabled` (default off): while off, `decide()` answers "now" for everything - nothing changes until an administrator
    turns it on. The matrix `notify.matrix` is `{department id | "*": {source: "digest" | "off"}}`; a missing cell is "now" and the
    department's own row wins over "*" cell by cell. WHOM an event notifies stays the source's own audience (notify_sources.SOURCE_DEFS
    `who`); the channels of each source (in-app, push, WhatsApp, ...) stay in CR-018's notification policy matrix, which already has
    the source x channel grid - this module adds the department axis and the timing axis.
  - `notify.digest_enabled` (default off): while off, a "digest" cell behaves as "now" (an event is never held for a digest that will
    not be sent). While on, the event is queued here (setting `tickets.notify_digest_queue`, no table) and the janitor sends ONE
    `ticket.digest` notification per department at `notify.digest_time` (installation time zone), to the department's managers. Its
    text holds counts and the department name only. Entries of tickets that closed meanwhile are dropped; "digest" is allowed only for
    sources whose audience is the managers (an assignee's reminder is never held back).

Nothing here raises into a ticket action: when an event cannot be queued it is sent at once (never lost)."""
from __future__ import annotations

import datetime as dt
import json
import logging
import sqlite3
import time
from typing import Any

from ...db import Database, get_setting, set_setting
from . import settings_doc
from .notify_sources import RULE_MANAGERS, SOURCE_DEFS, SUBJECT

log = logging.getLogger("smplwise.tickets.notify_matrix")

MODES = ("now", "digest", "off")
# the department-scoped ticket sources a matrix can address (installation-level and per-user ones are not departmental)
_EXCLUDED = {"ticket.channel_down", "ticket.staff_mobile", "ticket.portal_tech_request", "ticket.digest"}
MATRIX_SOURCES: tuple[str, ...] = tuple(d["key"] for d in SOURCE_DEFS
                                        if d["key"].startswith("ticket.") and d["key"] not in _EXCLUDED and d.get("subject", SUBJECT) == SUBJECT)
DIGESTABLE: frozenset[str] = frozenset(d["key"] for d in SOURCE_DEFS if d["key"] in MATRIX_SOURCES and d["who"] == RULE_MANAGERS)
LABELS: dict[str, str] = {d["key"]: d["label"] for d in SOURCE_DEFS}

QUEUE_KEY = "tickets.notify_digest_queue"
LAST_KEY = "tickets.notify_digest_last"  # the local date (YYYY-MM-DD) of the last digest run
QUEUE_MAX = 2000
EVERY_S = 60
_LAST: dict[str, float] = {}
DIGEST_SOURCE = "ticket.digest"


def _cfg(conn: sqlite3.Connection) -> dict[str, Any]:
    return settings_doc.read(conn)["notify"]


def decide(conn: sqlite3.Connection, department_id: str | None, source: str) -> str:
    """"now" | "digest" | "off" for one event. Anything unusual (matrix off, unknown source, corrupt cell) reads as "now"."""
    try:
        cfg = _cfg(conn)
        if not cfg["matrix_enabled"] or source not in MATRIX_SOURCES:
            return "now"
        matrix = cfg["matrix"]
        mode = (matrix.get(department_id or "") or {}).get(source) or (matrix.get("*") or {}).get(source) or "now"
        if mode == "digest" and (not cfg["digest_enabled"] or source not in DIGESTABLE):
            return "now"
        return mode if mode in MODES else "now"
    except Exception:  # noqa: BLE001 - fail safe: today's behaviour
        log.warning("notification matrix read failed", exc_info=True)
        return "now"


def _queue(conn: sqlite3.Connection) -> list[dict[str, str]]:
    try:
        q = json.loads(get_setting(conn, QUEUE_KEY, "[]") or "[]")
    except (ValueError, TypeError):
        return []
    if not isinstance(q, list):
        return []
    return [e for e in q if isinstance(e, dict) and all(isinstance(e.get(k), str) for k in ("t", "d", "s"))]


def _save(conn: sqlite3.Connection, q: list[dict[str, str]]) -> None:
    set_setting(conn, QUEUE_KEY, json.dumps(q[-QUEUE_MAX:], ensure_ascii=False, separators=(",", ":")))


def enqueue(conn: sqlite3.Connection, ticket_id: str, department_id: str, source: str, *, now: dt.datetime | None = None) -> bool:
    """Hold one event for the digest (one entry per ticket and source). False = could not hold it (the caller sends it at once)."""
    try:
        q = _queue(conn)
        if not any(e["t"] == ticket_id and e["s"] == source for e in q):
            stamp = (now or dt.datetime.now(dt.timezone.utc)).strftime("%Y-%m-%dT%H:%M:%SZ")
            q.append({"t": ticket_id, "d": department_id, "s": source, "at": stamp})
            _save(conn, q)
        return True
    except Exception:  # noqa: BLE001
        log.warning("digest enqueue failed", exc_info=True)
        return False


def pending(conn: sqlite3.Connection) -> int:
    return len(_queue(conn))


def _digest_text(conn: sqlite3.Connection, dept_name: str, counts: dict[str, int]) -> tuple[str, str]:
    from . import notify_bridge as nb

    total = sum(counts.values())
    parts = [f"{n} {LABELS.get(s, s)}" for s, n in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))][:5]
    title = nb.text(conn, "תקציר {ticket}: {n} אירועים", n=total)
    body = " · ".join([dept_name, *parts]) if dept_name else " · ".join(parts)
    return title, body


def flush(conn: sqlite3.Connection, *, local_date: str) -> int:
    """Send one `ticket.digest` per department with held events and clear them. Returns how many digests were created."""
    from .. import notify
    from . import store

    q = _queue(conn)
    if not q:
        return 0
    by_dept: dict[str, list[dict[str, str]]] = {}
    for e in q:
        by_dept.setdefault(e["d"], []).append(e)
    keep: list[dict[str, str]] = []
    sent = 0
    for dept_id, items in by_dept.items():
        live: list[dict[str, str]] = []
        first = None
        for e in items:
            row = store.ticket_row_system(conn, e["t"])
            if row is None or row["status"] in ("closed", "cancelled"):
                continue  # over meanwhile: nothing to summarise
            live.append(e)
            first = first or row
        if not live or first is None:
            continue
        counts: dict[str, int] = {}
        for e in live:
            counts[e["s"]] = counts.get(e["s"], 0) + 1
        dept = store.department_any(conn, dept_id) or {}
        title, body = _digest_text(conn, str(dept.get("name") or ""), counts)
        try:
            res = notify.emit_full(conn, notify.Signal(
                source=DIGEST_SOURCE, subject_kind=SUBJECT, subject_id=first["id"], severity="info",
                dedupe_key=f"ticket-digest:{dept_id}:{local_date}", params={"title": title, "body": body}, link="#/tickets",
                origin={"ticket_id": first["id"], "department_id": dept_id, "audience": "digest"}))
            if res.action is None:
                keep.extend(items)
            else:
                sent += 1
        except Exception:  # noqa: BLE001 - kept for the next run
            log.warning("digest emit failed for %s", dept_id, exc_info=True)
            keep.extend(items)
    _save(conn, keep)
    return sent


def tick(db: Database, *, force: bool = False, now: dt.datetime | None = None) -> int:
    """The janitor step (every minute at most): once the local time passes `digest_time` and today's digest has not run, flush."""
    key = str(db.path)
    mono = time.monotonic()
    if not force and mono - _LAST.get(key, -EVERY_S) < EVERY_S:
        return 0
    _LAST[key] = mono
    try:
        with db.connection(label="tickets.digest") as conn:
            from .access import module_on
            from .messaging import time_zone

            if not module_on(conn):
                return 0
            cfg = _cfg(conn)
            if not cfg["digest_enabled"]:
                return 0
            local = (now or dt.datetime.now(dt.timezone.utc)).astimezone(time_zone(conn))
            today = local.strftime("%Y-%m-%d")
            if local.strftime("%H:%M") < cfg["digest_time"] or get_setting(conn, LAST_KEY) == today:
                return 0
            sent = flush(conn, local_date=today)
            set_setting(conn, LAST_KEY, today)
            return sent
    except Exception:  # noqa: BLE001 - a housekeeping step never fails the tick
        log.warning("ticket digest step failed", exc_info=True)
        return 0
