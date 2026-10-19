"""CR-038 section 15.1: the module's janitor step (main.janitor_tick, every 30 s; self-throttled to once an hour).

Slice 1 prunes the request-idempotency rows after 24 h (review T22). The purge of closed tickets past `purge_after` (with their
files), the inbound / outbox / link-access retention and the cost-claim retention belong to the slices that own those tables;
they add their steps here."""
from __future__ import annotations

import datetime as dt
import logging
import time

from ...db import Database
from . import store

log = logging.getLogger("smplwise.tickets.retention")
EVERY_S = 3600
REQUESTS_KEEP_H = 24
_LAST: dict[str, float] = {}


def janitor(db: Database, *, force: bool = False) -> int:
    """Returns the number of rows removed (0 when the step was throttled)."""
    _digest(db)  # TKNOTIFMATRIX: the daily digest (own throttle, off by default)
    _sla_monitor(db)  # slice 6: the SLA monitor rides on this janitor step with its own once-a-minute throttle (monitor.py)
    key = str(db.path)
    now = time.monotonic()
    if not force and now - _LAST.get(key, -EVERY_S) < EVERY_S:
        return 0
    _LAST[key] = now
    before = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=REQUESTS_KEEP_H)).strftime("%Y-%m-%dT%H:%M:%SZ")
    try:
        with db.connection(label="tickets.retention") as conn:
            return store.prune_requests(conn, before)
    except Exception:  # noqa: BLE001 - a housekeeping step never fails the tick
        log.warning("tickets retention step failed", exc_info=True)
        return 0


def _digest(db: Database) -> None:
    try:
        from . import notify_matrix

        notify_matrix.tick(db)
    except Exception:  # noqa: BLE001
        log.warning("tickets digest step failed", exc_info=True)


def _sla_monitor(db: Database) -> None:
    try:
        from . import monitor

        monitor.tick(db)
    except Exception:  # noqa: BLE001 - the monitor never fails the retention step (it logs its own problems)
        log.warning("tickets SLA monitor failed", exc_info=True)
    try:
        from . import rule_engine  # TKRULES-291: tickets from alerts - the same ride, its own once-a-minute throttle and kill switch

        rule_engine.tick(db)
    except Exception:  # noqa: BLE001
        log.warning("tickets rule engine failed", exc_info=True)
