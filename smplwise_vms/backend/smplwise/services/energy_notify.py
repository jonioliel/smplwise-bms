"""ELECBILL77: the electricity bills' side of the notification pipeline (CR-018) and the cheap live-state read for the bills screen.

1. `draft_ready` - the automatic generation (services/energy_billing.auto_generate) computed a draft: one `energy.bill_draft` notification per
   draft, to the holders of energy.bills (recipient rule `energy_bills`, subject kind `energy_bills`, re-checked by services/notify_visibility
   at every delivery). It is emitted in the SAME transaction as the draft and its run row, so a retried or concurrent pass (which the run row
   already refuses) can never emit it twice, and the dedupe key carries the bill id. A recalculation, an edit, a correction or a draft a person
   made by hand emits nothing (the person knows). The text is the period only - never an amount, a customer or an account name. Channels,
   quiet hours, the phone app / WhatsApp rules and the per-user push rate are the pipeline's own (services/notify_channels, mobile_push).
   Nothing here can fail the billing: an error is logged and the draft stays.
2. `listed` - the source is listed in the policy matrix (and so reachable) only while the installation has billing accounts; with none, the
   module is not in use and the source does not exist for the administrator.
3. `state` / `revision` - what the bills screen polls: counts by state, the automatic runs and a revision (a hash of those numbers and the newest
   change). One indexed read on the read connection; the router answers 304 on a matching If-None-Match."""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import logging
import sqlite3
from typing import Any

from . import notify

log = logging.getLogger("smplwise.energy.notify")

SOURCE = "energy.bill_draft"
BILL_STATES = ("draft", "issued", "sent", "paid", "void")
RUN_STATUSES = ("created", "issued", "skipped", "failed")


def listed(conn: sqlite3.Connection) -> bool:
    """Whether the installation uses electricity billing at all (at least one account that is not deleted)."""
    try:
        return conn.execute("SELECT 1 FROM energy_accounts WHERE deleted_at IS NULL LIMIT 1").fetchone() is not None
    except sqlite3.Error:  # a database without the billing tables (a unit fixture) has no module
        return False


def period_label(start: dt.date, end_exclusive: dt.date) -> str:
    """`09/2026` for a whole calendar month, else `01.09.2026-14.09.2026` (the period's last day, inclusive)."""
    if start.day == 1 and end_exclusive == (start.replace(day=28) + dt.timedelta(days=4)).replace(day=1):
        return f"{start.month:02d}/{start.year}"
    last = end_exclusive - dt.timedelta(days=1)
    return f"{start:%d.%m.%Y}-{last:%d.%m.%Y}"


def draft_ready(conn: sqlite3.Connection, bill_id: str, start: dt.date, end_exclusive: dt.date) -> str | None:
    """Emit `energy.bill_draft` for one new automatic draft (inside the caller's write transaction). The notification id when a row was
    created, else None (the policy is off, nobody holds energy.bills, billing is not in use, or an error - logged, never raised)."""
    try:
        if not listed(conn):
            return None
        return notify.emit(conn, notify.Signal(
            SOURCE, "energy_bills", bill_id, dedupe_key=f"{SOURCE}:{bill_id}", params={"period": period_label(start, end_exclusive)},
            origin={"kind": "energy_bill_draft"}, link=f"#/infra/electricity/bills/{bill_id}"))
    except Exception:  # noqa: BLE001 - a notification problem never costs a bill
        log.warning("electricity draft notification failed", exc_info=True)
        return None


def state(conn: sqlite3.Connection) -> dict[str, Any]:
    """The live state of the bills screen: counts by state, the automatic generation's runs and a `revision` that changes when any of it
    (or any bill's version / stored PDF) changes. Money-free: counts and timestamps only."""
    counts = {s: 0 for s in BILL_STATES}
    for r in conn.execute("SELECT state, COUNT(*) FROM energy_bills GROUP BY state").fetchall():
        counts[r[0]] = r[1]
    agg = conn.execute("SELECT COALESCE(SUM(row_version), 0), MAX(updated_at), COUNT(pdf_path) FROM energy_bills").fetchone()
    runs = {s: 0 for s in RUN_STATUSES}
    for r in conn.execute("SELECT status, COUNT(*) FROM energy_auto_runs GROUP BY status").fetchall():
        runs[r[0]] = r[1]
    run_agg = conn.execute("SELECT MAX(updated_at), COALESCE(SUM(attempts), 0) FROM energy_auto_runs").fetchone()
    retrying = conn.execute("SELECT COUNT(*) FROM energy_auto_runs WHERE status = 'failed'").fetchone()[0]
    body = {
        "counts": counts,
        "bills_changed_at": agg[1],
        "auto": {"runs": runs, "last_run_at": run_agg[0], "failed_waiting_retry": retrying},
    }
    token = json.dumps({**body, "v": int(agg[0]), "p": int(agg[2]), "a": int(run_agg[1])}, sort_keys=True, separators=(",", ":"))
    body["revision"] = hashlib.sha256(token.encode("utf-8")).hexdigest()[:16]
    return body
