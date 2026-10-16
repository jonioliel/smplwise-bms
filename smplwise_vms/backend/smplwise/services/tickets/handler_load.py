"""HANDLERLOAD (owner request 2026-10-17): the "handled" number on the handler cards of "מטפלים וספקים" - how many requests each
handler resolved in a period. A count per assignee key (`user:<id>` / `contact:<id>`), never any content of a request.

DEFINITION (also in docs/changes/CR-HANDLER-LOAD.md): a request is HANDLED by X in a period when
  - its status is `done` or `closed` (a cancelled request, and one a manager closed WITHOUT "done", were not resolved by a handler);
  - its completion time `done_at` (the moment the handler - or the manager on his behalf - moved it to `done`; it is kept when a manager
    then closes it, and cleared on every reopen / reassignment from `done`) lies inside the period; and
  - X is the assignee it had AT that moment: the assignment with the latest `assigned_at` <= `done_at` that had not ended before it.
So a request reassigned before it was done counts for the last assignee only, one that was re-opened and finished again counts once, on
its latest completion, and the closing click of a manager (or the automatic close) does not move it between days or people.
Why `done_at` and not `closed_at`: the closing is the manager's confirmation, days later at times; the work was finished at `done`.

PERIOD: 1 = today, 7 = the last seven days, 30 = the last thirty - whole days of the installation's time zone (setting `time.zone`),
today included: since = local midnight (days - 1) days ago, up to now. The boundary instant itself is inside.

VISIBILITY: only through board.scan() (access.visible_page) and only the rows the viewer MANAGES (`Seen.manager`) - the same rule as the
manager board, so a department manager gets counts of his departments' requests only, and the route has the board's manager gate."""
from __future__ import annotations

import datetime as dt
from typing import Any

from . import access, board, stuck
from .access import Viewer

PERIODS: tuple[int, ...] = (1, 7, 30)
HANDLED_STATUSES = ("done", "closed")


def period_start(now: dt.datetime, days: int, tz: dt.tzinfo) -> dt.datetime:
    """Local midnight, `days - 1` days before today, as an aware UTC instant (the calendar arithmetic is done on local dates, so a
    daylight-saving change never shifts the boundary off midnight)."""
    local_today = now.astimezone(tz).date()
    first = dt.datetime.combine(local_today - dt.timedelta(days=days - 1), dt.time.min, tzinfo=tz)
    return first.astimezone(dt.timezone.utc)


def _assignee_at(conn, ticket_id: str, at: str) -> str | None:
    row = conn.execute(
        "SELECT assignee_kind, user_id, contact_id FROM ticket_assignments WHERE ticket_id = ? AND assigned_at <= ? "
        "AND (ended_at IS NULL OR ended_at >= ?) ORDER BY assigned_at DESC, rowid DESC LIMIT 1", (ticket_id, at, at)).fetchone()
    if row is None:
        return None
    return f"contact:{row['contact_id']}" if row["assignee_kind"] == "contact" else f"user:{row['user_id']}"


def handled_counts(conn, viewer: Viewer, days: int, now: dt.datetime, tz: dt.tzinfo) -> dict[str, Any]:
    if days not in PERIODS:
        raise ValueError("days")
    since = stuck.iso(period_start(now, days, tz)) or ""
    until = stuck.iso(now) or ""
    scope = "all" if access.ALL_DEPARTMENTS in viewer.anywhere else "department"
    sc = board.scan(viewer, scope=scope, statuses=HANDLED_STATUSES, department_id=None, query="")
    counts: dict[str, int] = {}
    for s in sc.rows:
        if not s.manager:
            continue
        done_at = stuck.iso(stuck.parse(s.row.get("done_at")))
        if not done_at or not since <= done_at <= until:
            continue
        key = _assignee_at(conn, s.row["id"], s.row["done_at"])
        if key:
            counts[key] = counts.get(key, 0) + 1
    return {"days": days, "since": since, "now": until, "handled": counts, "truncated": sc.truncated}
