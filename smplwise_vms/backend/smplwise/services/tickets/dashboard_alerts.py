"""MGRDASH phases 4-5 (docs/design/MANAGER_DASHBOARD_SPEC_HE.md section 9): the manager overview's alerts, raised by the janitor
(costs_retention.janitor -> tick(), every 10 minutes) through the existing notification centre. Every source is OFF by default (its
policy row); nothing is computed for a source that is off. No person and no amount is ever in the text.

    rfq.instalment_due_tomorrow   (phase 4) approved instalments due TOMORROW (the installation's day) and not marked paid: one row per
                                  award and day (`rfqpaydue:<rfq>:<award>:<day>`), raised once (a row that ever existed is not raised
                                  again), to the RFQ managers who may mark the payment; resolved when nothing of it is due tomorrow any
                                  more (paid, moved, or the day came - the overdue signal takes over from there)."""
from __future__ import annotations

import datetime as dt
import logging
from typing import Any

from ...services import notify_policy
from . import dashboard_pay, rfq, rfq_notify, store_dash_extra

log = logging.getLogger("smplwise.tickets.dashboard_alerts")


def source_on(conn, source: str) -> bool:
    policy = notify_policy.get_policy(conn, source)
    return bool(policy and policy.get("enabled"))


def _tz(conn):
    from .messaging import time_zone

    return time_zone(conn)


def payments_tick(conn, now: dt.datetime) -> dict[str, int]:
    """Phase 4: raise / resolve the "payment due tomorrow" rows."""
    out = {"raised": 0, "resolved": 0}
    tz = _tz(conn)
    today = now.astimezone(tz).date()
    tomorrow = today + dt.timedelta(days=1)
    due: dict[str, dict[str, Any]] = {}
    if source_on(conn, "rfq.instalment_due_tomorrow"):
        for it in dashboard_pay.instalments(conn, today=today, tz=tz, until=tomorrow + dt.timedelta(days=1)):
            if it["due_date"] != tomorrow:
                continue
            key = f"{rfq_notify.DUE_PREFIX}:{it['rfq_id']}:{it['award_id']}:{tomorrow.isoformat()}"
            due.setdefault(key, {**it, "count": 0})["count"] += 1
    for key in store_dash_extra.open_notification_keys(conn, f"{rfq_notify.DUE_PREFIX}:"):
        if key not in due:
            rfq_notify.instalment_due_over(conn, key)
            out["resolved"] += 1
    for key, it in due.items():
        if store_dash_extra.notification_key_seen(conn, key):
            continue  # raised once (open, acknowledged or already over) - never folded again
        row = rfq.system_row(conn, it["rfq_id"])
        if row is None:
            continue
        if rfq_notify.instalment_due_tomorrow(conn, row, it["award_id"], it["rfq_vendor_id"], count=it["count"], day=tomorrow.isoformat()):
            out["raised"] += 1
    return out


def tick(conn, now: dt.datetime) -> dict[str, Any]:
    """The janitor step (inside the cost janitor's write transaction; each part fails on its own)."""
    out: dict[str, Any] = {}
    try:
        out["payments"] = payments_tick(conn, now)
    except Exception as exc:  # noqa: BLE001 - an alert never stops the janitor
        log.warning("dashboard payment alerts failed (%s)", type(exc).__name__, exc_info=True)
    return out
