"""CAL-GRID-EDIT-2343 - notices to an organizer whose entry someone else cancelled or moved, held back so "בטל" (undo) can withdraw them.

The grid offers "בטל" for a few seconds after a move, a resize or a delete. If the organizer were told at once, an undo would send him
"cancelled" and then "booked again" (owner, 02.11: approved). So a notice is queued with `due_at = now + cancel_notice_delay_s` (default 6 s);
an undo inside that time withdraws it (`withdraw_for`), and the janitor pass delivers what is due (`deliver_due`, every 30 s).

Delivery: the calendars module has no notification source yet (contract section 7 lists the notices; the channels are a later slice of the
contract). `deliver_due` marks the row sent and writes an audit row with ids only; a channel registers itself in DELIVERERS and is called
with the row (it must not raise; a failing channel leaves the row sent - the inbox never repeats a notice). Payloads carry ids and instants,
never a title or a person's name."""
from __future__ import annotations

import datetime as dt
import json
import logging
import sqlite3
from typing import Any, Callable

from . import model
from .calendars import new_id

log = logging.getLogger(__name__)
KINDS = ("calendar.booking.cancelled", "calendar.booking.changed")
DELIVERERS: list[Callable[[sqlite3.Connection, sqlite3.Row], None]] = []


def queue(conn: sqlite3.Connection, settings: dict[str, Any], *, event_id: str, kind: str, recipient: str | None, actor: str | None, now: dt.datetime,
          payload: dict[str, Any] | None = None) -> str | None:
    """Queues one notice; nothing when there is no recipient or the organizer did it himself. An older unsent notice of the same entry is
    superseded (one notice per entry carries the latest change)."""
    if kind not in KINDS or not recipient or recipient == actor:
        return None
    stamp = model.iso(now)
    conn.execute("UPDATE cal_notices SET withdrawn_at = ? WHERE event_id = ? AND sent_at IS NULL AND withdrawn_at IS NULL", (stamp, event_id))
    nid = new_id("ntc")
    due = model.iso(now + dt.timedelta(seconds=settings["cancel_notice_delay_s"]))
    conn.execute("INSERT INTO cal_notices(id, event_id, kind, recipient_user_id, actor_user_id, payload_json, created_at, due_at) VALUES (?,?,?,?,?,?,?,?)",
                 (nid, event_id, kind, recipient, actor, json.dumps(payload or {}, sort_keys=True), stamp, due))
    return nid


def withdraw_for(conn: sqlite3.Connection, event_id: str, now: dt.datetime) -> int:
    """An undo: every notice of the entry not sent yet is withdrawn. Returns how many."""
    cur = conn.execute("UPDATE cal_notices SET withdrawn_at = ? WHERE event_id = ? AND sent_at IS NULL AND withdrawn_at IS NULL", (model.iso(now), event_id))
    return cur.rowcount


def pending_for(conn: sqlite3.Connection, event_id: str) -> list[sqlite3.Row]:
    return conn.execute("SELECT * FROM cal_notices WHERE event_id = ? AND sent_at IS NULL AND withdrawn_at IS NULL ORDER BY created_at", (event_id,)).fetchall()


def deliver_due(conn: sqlite3.Connection, now: dt.datetime) -> int:
    """Marks every due notice sent and hands it to the registered channels. Returns the number delivered."""
    from ...audit import audit  # noqa: PLC0415

    rows = conn.execute("SELECT * FROM cal_notices WHERE sent_at IS NULL AND withdrawn_at IS NULL AND due_at <= ? ORDER BY due_at", (model.iso(now),)).fetchall()
    for r in rows:
        conn.execute("UPDATE cal_notices SET sent_at = ? WHERE id = ?", (model.iso(now), r["id"]))
        for deliver in DELIVERERS:
            try:
                deliver(conn, r)
            except Exception:  # noqa: BLE001 - a channel never stops the others
                log.warning("calendar notice channel failed", exc_info=True)
        audit(conn, actor=None, action="calendar.notice.sent", decision="allowed", resource_type="calendar_event", resource_id=r["event_id"],
              details={"kind": r["kind"], "notice": r["id"]})
    return len(rows)
