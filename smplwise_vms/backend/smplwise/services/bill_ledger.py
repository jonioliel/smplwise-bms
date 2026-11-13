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

import datetime as dt
import json
import sqlite3
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from ..audit import audit as _audit_row
from ..db import new_id, now_iso
from ..errors import ApiError, conflict, not_found
from . import energy_periods as per
from . import energy_pricing as px


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
    number_tables: tuple[str, ...]  # where the next sequence and a taken number are looked up, in this order (the shared ledger first)
    account_table: str | None  # the account row the seal reads first and names in its audit row (electricity); None = the bill's own
                               # account_id (water) - as written before


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


# ====================================================================== overlap, numbering and the seal

def _eb():
    """The shared helpers of the billing engine (the date / instant formats and the snapshot hash), imported late: energy_billing
    imports this module at load time."""
    from . import energy_billing

    return energy_billing


def overlapping(kind: BillKind, conn: sqlite3.Connection, aid: str, p: per.Period, exclude: tuple[str, ...] = ()) -> sqlite3.Row | None:
    rows = conn.execute(
        f"SELECT * FROM {kind.table} WHERE account_id = ? AND state IN ('issued','sent','paid') AND period_start < ? AND period_end > ?",
        (aid, p.end.isoformat(), p.start.isoformat()),
    ).fetchall()
    for r in rows:
        if r["id"] not in exclude:
            return r
    return None


def overlap_error(r: sqlite3.Row) -> ApiError:
    return conflict("period_overlap", f"התקופה חופפת לחיוב {r['number']} שכבר הונפק.", bill_id=r["id"], number=r["number"])


def number_for(kind: BillKind, conn: sqlite3.Connection, bill: sqlite3.Row, customer_number: str) -> tuple[str, str, int]:
    """(number, base, seq) in the SHARED number space: YYYY-MM-CCCC[/S][-R]; month = month of the period's LAST day (owner round 2).
    The sequence and the uniqueness are checked against `kind.number_tables` (the ledger of numbers ever used first)."""
    last = _eb()._date(bill["period_end"]) - dt.timedelta(days=1)
    rev = int(bill["revision"])
    if bill["replaces_bill_id"]:
        root = get_bill(kind, conn, bill["replaces_bill_id"])
        while root["replaces_bill_id"]:
            root = get_bill(kind, conn, root["replaces_bill_id"])
        base, seq = root["number_base"], int(root["number_seq"])
    else:
        base = f"{last.year:04d}-{last.month:02d}-{customer_number}"
        seq = 1 + max(int(conn.execute(f"SELECT MAX(number_seq) FROM {t} WHERE number_base = ?", (base,)).fetchone()[0] or 0)
                      for t in kind.number_tables)
    number = base + (f"/{seq}" if seq > 1 else "") + (f"-{rev}" if rev > 1 else "")
    for t in kind.number_tables:
        if conn.execute(f"SELECT 1 FROM {t} WHERE number = ?", (number,)).fetchone():
            raise conflict("number_taken", "מספר החיוב כבר נוצל. יש לנסות שוב.", number=number)
    return number, base, seq


def seal(kind: BillKind, conn: sqlite3.Connection, bill: sqlite3.Row, comp: Any, *, actor: Any | None, issue_date: dt.date, request_id: str | None,
         client_request_id: str | None, clock: Callable[[], dt.datetime]) -> None:
    """Issue a draft inside the caller's write transaction: overlap check, number (shared ledger), sealed snapshot + hash, the original of a
    correction cancelled. `comp` is the fresh computation the caller made before taking the write lock (its `kind.quantity` attribute and
    `total`); `clock` is the owning module's clock seam, looked up by the wrapper at call time."""
    eb = _eb()
    account = conn.execute(f"SELECT * FROM {kind.account_table} WHERE id = ?", (bill["account_id"],)).fetchone() if kind.account_table else None
    p = per.Period(eb._date(bill["period_start"]), eb._date(bill["period_end"]))
    hit = overlapping(kind, conn, bill["account_id"], p, exclude=(bill["replaces_bill_id"],) if bill["replaces_bill_id"] else ())
    if hit:
        raise overlap_error(hit)
    snap = comp.snapshot
    number, base, seq = number_for(kind, conn, bill, snap["customer"]["customer_number"])
    due = px.due_date(issue_date, snap["bill"]["payment_terms"])
    at = clock()
    snap["bill"].update({
        "id": bill["id"], "number": number, "state": "issued", "issue_date": issue_date.isoformat(), "due_date": due.isoformat(),
        "expected_due_date": due.isoformat(), "issued_at": eb._iso(at),
        "issued_by": {"kind": "user", "display_name": getattr(actor, "display_name", "") or getattr(actor, "username", "")} if actor is not None else {"kind": "system"},
    })
    digest = eb.sha256_of(snap)
    conn.execute(
        f"""UPDATE {kind.table} SET state = 'issued', number = ?, number_base = ?, number_seq = ?, {kind.quantity} = ?, total = ?, snapshot_json = ?, snapshot_sha256 = ?,
             issue_date = ?, due_date = ?, issued_by = ?, issued_at = ?, issue_request_id = ?, row_version = row_version + 1, updated_at = ? WHERE id = ?""",
        (number, base, seq, getattr(comp, kind.quantity), comp.total, json.dumps(snap, ensure_ascii=False), digest, issue_date.isoformat(), due.isoformat(),
         getattr(actor, "user_id", None), eb._iso(at), client_request_id, now_iso(), bill["id"]),
    )
    conn.execute("INSERT INTO energy_bill_numbers(number, number_base, number_seq, revision, bill_id, assigned_at) VALUES (?, ?, ?, ?, ?, ?)",
                 (number, base, seq, int(bill["revision"]), bill["id"], now_iso()))
    action = "issue" if actor is not None else "auto_issue"
    event(kind, conn, bill["id"], action, actor, {"number": number})
    account_id = (account["id"] if account else None) if kind.account_table else bill["account_id"]
    audit(kind, conn, actor, f"bill.{action}", bill["id"], request_id, {"number": number, "sha256": digest[:12], "account_id": account_id})
    if bill["replaces_bill_id"]:
        orig = get_bill(kind, conn, bill["replaces_bill_id"])
        if orig["state"] != "void":
            reason = f"הוחלף ב-{number}"
            conn.execute(f"UPDATE {kind.table} SET state = 'void', void_reason = ?, voided_at = ?, replaced_by_bill_id = ?, row_version = row_version + 1, updated_at = ? WHERE id = ?",
                         (reason, now_iso(), bill["id"], now_iso(), orig["id"]))
            event(kind, conn, orig["id"], "void", actor, {"reason": reason, "replaced_by": number})
            audit(kind, conn, actor, "bill.void", orig["id"], request_id, {"replaced_by": number})
        else:
            conn.execute(f"UPDATE {kind.table} SET replaced_by_bill_id = ? WHERE id = ?", (bill["id"], orig["id"]))
