"""CR-BILL-LEDGER-A-2436 (code review 04:F04): the lifecycle of a sealed bill, written once for electricity and water.

A bill is a sealed money document; electricity (`energy_bills`) and water (`water_bills`) share one number space and one lifecycle. Until
this module the lifecycle was written twice (services/energy_billing.py and services/water_billing.py), differing only by table name,
quantity column and audit prefix - so a fix made on one side only was a real risk. Each kind is now a `BillKind` record, a module constant
of its own service; table and column names come from those two constants and never from input.

Carried over literally from the two copies: the text of every statement and their order, the audit actions
(`energy.bill.*` / `infra.water.bill.*`), the bill events, the error codes and their Hebrew messages. The public names of
energy_billing / water_billing stay as thin wrappers, so routers and tests do not change. Proof: tests/test_bill_ledger_cross_kind.py
(golden statement traces recorded from the two copies before the move).

Step A (this branch): the marks (sent / paid), the void, the correction check, then the numbering and the seal. Step B
(CR-BILL-LEDGER-B): drafts, automatic generation and retention."""
from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from typing import Any

from ..audit import audit as _audit_row
from ..db import new_id, now_iso
from ..errors import ApiError, conflict, not_found


@dataclass(frozen=True)
class BillKind:
    """One kind of sealed bill. Every name here is a constant of the owning service module, never input."""

    name: str                  # "energy" / "water"
    table: str                 # the bills table
    events_table: str          # the bill events table
    quantity: str              # the quantity column of the bills table (and the attribute of the computation): "kwh" / "m3"
    resource_type: str         # the audit resource type: "energy_bill" / "water_bill"
    audit_prefix: str          # prepended to "bill.<action>": "energy." / "infra.water."
    state_he: dict[str, str]   # the Hebrew state names used in the messages
    issued_states: tuple[str, ...]
    correction_columns: str    # what the open-correction lookup selects ("*" for electricity, "id" for water - as written before)


# ====================================================================== rows, events, audit

def get_bill(kind: BillKind, conn: sqlite3.Connection, bid: str) -> sqlite3.Row:
    row = conn.execute(f"SELECT * FROM {kind.table} WHERE id = ?", (bid,)).fetchone()
    if not row:
        raise not_found("החיוב לא נמצא.")
    return row


def event(kind: BillKind, conn: sqlite3.Connection, bid: str, action: str, actor: Any | None, details: dict[str, Any] | None = None) -> None:
    conn.execute(f"INSERT INTO {kind.events_table}(id, bill_id, at, action, actor_kind, actor_id, actor_name, details_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                 (new_id(), bid, now_iso(), action, "user" if actor is not None else "system", getattr(actor, "user_id", None),
                  (getattr(actor, "display_name", None) or getattr(actor, "username", None)) if actor is not None else None,
                  json.dumps(details, ensure_ascii=False) if details else None))


def audit(kind: BillKind, conn: sqlite3.Connection, actor: Any | None, action: str, rid: str, request_id: str | None = None,
          details: dict[str, Any] | None = None) -> None:
    """`action` is the kind-free part ("bill.sent"); the row carries `<audit_prefix>bill.sent`."""
    _audit_row(conn, actor=actor, action=f"{kind.audit_prefix}{action}", decision="allowed", resource_type=kind.resource_type, resource_id=rid,
               request_id=request_id, details=details)


# ====================================================================== lifecycle marks

def check_version(row: sqlite3.Row, row_version: int | None) -> None:
    if row_version is not None and row["row_version"] != row_version:
        raise conflict("revision_conflict", "החיוב שונה בינתיים. יש לרענן ולנסות שוב.", current_revision=row["row_version"])


def mark_sent(kind: BillKind, conn: sqlite3.Connection, bid: str, at: str, how: str, note: str, actor: Any, request_id: str | None,
              row_version: int | None = None) -> None:
    row = get_bill(kind, conn, bid)
    check_version(row, row_version)
    if row["state"] not in ("issued", "sent"):
        raise conflict("bill_state", f"אי אפשר לסמן כנשלח חיוב במצב {kind.state_he[row['state']]}.", state=row["state"])
    conn.execute(f"UPDATE {kind.table} SET state = 'sent', sent_at = ?, sent_how = ?, sent_note = ?, row_version = row_version + 1, updated_at = ? WHERE id = ?",
                 (at, how, note, now_iso(), bid))
    event(kind, conn, bid, "sent", actor, {"how": how})
    audit(kind, conn, actor, "bill.sent", bid, request_id, {"how": how})


def mark_paid(kind: BillKind, conn: sqlite3.Connection, bid: str, at: str, reference: str, actor: Any, request_id: str | None,
              row_version: int | None = None) -> None:
    row = get_bill(kind, conn, bid)
    check_version(row, row_version)
    if row["state"] not in ("issued", "sent"):
        raise conflict("bill_state", f"אי אפשר לסמן כשולם חיוב במצב {kind.state_he[row['state']]}.", state=row["state"])
    conn.execute(f"UPDATE {kind.table} SET state = 'paid', paid_at = ?, paid_ref = ?, row_version = row_version + 1, updated_at = ? WHERE id = ?",
                 (at, reference, now_iso(), bid))
    event(kind, conn, bid, "paid", actor)
    audit(kind, conn, actor, "bill.paid", bid, request_id)


def void_bill(kind: BillKind, conn: sqlite3.Connection, bid: str, reason: str, actor: Any, request_id: str | None,
              row_version: int | None = None) -> None:
    row = get_bill(kind, conn, bid)
    check_version(row, row_version)
    if not reason or not reason.strip():
        raise ApiError(422, "reason_required", "חובה לציין סיבת ביטול.", details={})
    if row["state"] not in ("issued", "sent"):
        raise conflict("bill_state", f"אי אפשר לבטל חיוב במצב {kind.state_he[row['state']]}.", state=row["state"])
    conn.execute(f"UPDATE {kind.table} SET state = 'void', void_reason = ?, voided_at = ?, row_version = row_version + 1, updated_at = ? WHERE id = ?",
                 (reason.strip(), now_iso(), now_iso(), bid))
    event(kind, conn, bid, "void", actor, {"reason": reason.strip()})
    audit(kind, conn, actor, "bill.void", bid, request_id)


def open_correction(kind: BillKind, conn: sqlite3.Connection, bid: str) -> sqlite3.Row | None:
    return conn.execute(f"SELECT {kind.correction_columns} FROM {kind.table} WHERE replaces_bill_id = ? AND state = 'draft'", (bid,)).fetchone()


def check_correctable(kind: BillKind, conn: sqlite3.Connection, row: sqlite3.Row) -> None:
    if row["state"] not in kind.issued_states:
        raise conflict("bill_state", f"אי אפשר לתקן חיוב במצב {kind.state_he[row['state']]}.", state=row["state"])
    existing = open_correction(kind, conn, row["id"])
    if existing:
        raise conflict("bill_state", "כבר קיימת טיוטת תיקון לחיוב זה.", bill_id=existing["id"], state=row["state"])
