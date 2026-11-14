"""CR-BILL-LEDGER-A-2436 (code review 04:F04): the lifecycle of a sealed bill, written once for electricity and water.

A bill is a sealed money document; electricity (`energy_bills`) and water (`water_bills`) share one number space and one lifecycle. Until
this module the lifecycle was written twice (services/energy_billing.py and services/water_billing.py), differing only by table name,
quantity column and audit prefix - so a fix made on one side only was a real risk. Each kind is now a `BillKind` record, a module constant
of its own service; table and column names come from those two constants and never from input.

Carried over literally from the two copies: the text of every statement and their order, the audit actions
(`energy.bill.*` / `infra.water.bill.*`), the bill events, the error codes and their Hebrew messages. The public names of
energy_billing / water_billing stay as thin wrappers, so routers and tests do not change. Proof: tests/test_bill_ledger_cross_kind.py
(golden statement traces recorded from the two copies before the move).

Step A (CR-BILL-LEDGER-A-2436): the marks (sent / paid), the void, the correction check, then the numbering and the seal.
Step B (CR-BILL-LEDGER-B-2438): the drafts (insert, recalculate, delete, the carried end points), the automatic generation, retention, and
the one read of an account's bills for its history (code review 04:F26). Proof: tests/test_bill_ledger_lifecycle_b.py (golden traces of
drafts, automatic-generation passes and retention recorded from the two copies before the move). The janitor throttles stay in their
modules (their state is per module and the water one is behind the module switch)."""
from __future__ import annotations

import datetime as dt
import json
import logging
import sqlite3
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
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
    accounts_table: str        # the accounts the automatic generation reads: "energy_accounts" / "water_accounts"
    runs_table: str            # one row per (account, period) of the automatic generation: "energy_auto_runs" / "water_auto_runs"
    account_resource_type: str  # the audit resource of a failed automatic run: "energy_account" / "water_account"
    log_word: str              # in the automatic generation's log lines: "" / "water " ("automatic water bill computation failed")
    pdf_column: str | None     # the stored PDF retention removes with a document: "pdf_path" (electricity) / None (water has none)


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


# ====================================================================== drafts (step B)

def by_create_request(kind: BillKind, conn: sqlite3.Connection, client_request_id: str) -> sqlite3.Row | None:
    return conn.execute(f"SELECT * FROM {kind.table} WHERE create_request_id = ?", (client_request_id,)).fetchone()


def insert_draft(kind: BillKind, conn: sqlite3.Connection, account: sqlite3.Row, p: per.Period, comp: Any, *, actor: Any | None, origin: str,
                 request_id: str | None, client_request_id: str | None, replaces: sqlite3.Row | None = None) -> str:
    """The write half of "create a draft" (inside the caller's write transaction; the computation was done before). `comp` carries the
    snapshot, `total` and the `kind.quantity` attribute; they are stored exactly as computed."""
    if replaces is None:
        hit = overlapping(kind, conn, account["id"], p)
        if hit:
            raise overlap_error(hit)
    dup = conn.execute(f"SELECT id FROM {kind.table} WHERE account_id = ? AND period_start = ? AND period_end = ? AND state = 'draft'",
                       (account["id"], p.start.isoformat(), p.end.isoformat())).fetchone()
    if dup:
        raise conflict("draft_exists", "כבר קיימת טיוטה לתקופה זו.", bill_id=dup["id"])
    bid = new_id()
    snap = comp.snapshot
    snap["bill"]["id"] = bid
    now = now_iso()
    conn.execute(
        f"""INSERT INTO {kind.table}(id, account_id, customer_id, revision, replaces_bill_id, period_start, period_end, state, origin, {kind.quantity}, total,
             snapshot_json, create_request_id, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?)""",
        (bid, account["id"], account["customer_id"], snap["bill"]["revision"], replaces["id"] if replaces is not None else None,
         p.start.isoformat(), p.end.isoformat(), origin, getattr(comp, kind.quantity), comp.total, json.dumps(snap, ensure_ascii=False), client_request_id,
         getattr(actor, "user_id", None), now, now),
    )
    action = "correct" if replaces is not None else ("auto_draft" if origin == "auto" and actor is None else "draft")
    event(kind, conn, bid, action, actor, {"replaces": replaces["number"]} if replaces is not None else None)
    audit(kind, conn, actor, f"bill.{action}", bid, request_id, {"account_id": account["id"], "period": p.as_api()})
    return bid


def store_recalculated(kind: BillKind, conn: sqlite3.Connection, bill: sqlite3.Row, comp: Any, actor: Any | None, request_id: str | None,
                       row_version: int) -> None:
    cur = get_bill(kind, conn, bill["id"])
    if cur["state"] != "draft":
        raise conflict("bill_not_draft", "החיוב אינו טיוטה.", state=cur["state"])
    if cur["row_version"] != row_version:
        raise conflict("revision_conflict", "החיוב שונה בינתיים. יש לרענן ולנסות שוב.", current_revision=cur["row_version"])
    snap = comp.snapshot
    snap["bill"]["id"] = bill["id"]
    conn.execute(f"UPDATE {kind.table} SET {kind.quantity} = ?, total = ?, snapshot_json = ?, row_version = row_version + 1, updated_at = ? WHERE id = ?",
                 (getattr(comp, kind.quantity), comp.total, json.dumps(snap, ensure_ascii=False), now_iso(), bill["id"]))
    event(kind, conn, bill["id"], "recalculate", actor)
    audit(kind, conn, actor, "bill.recalculate", bill["id"], request_id)


def delete_draft(kind: BillKind, conn: sqlite3.Connection, bid: str, row_version: int, actor: Any, request_id: str | None) -> None:
    row = get_bill(kind, conn, bid)
    if row["state"] != "draft":
        raise conflict("bill_not_draft", "אפשר למחוק רק טיוטה.", state=row["state"])
    if row["row_version"] != row_version:
        raise conflict("revision_conflict", "החיוב שונה בינתיים. יש לרענן ולנסות שוב.", current_revision=row["row_version"])
    conn.execute(f"DELETE FROM {kind.table} WHERE id = ?", (bid,))
    conn.execute(f"DELETE FROM {kind.events_table} WHERE bill_id = ?", (bid,))
    audit(kind, conn, actor, "bill.delete", bid, request_id, {"account_id": row["account_id"]})


# ====================================================================== the end points carried between bills

def prev_bill(kind: BillKind, conn: sqlite3.Connection, aid: str, start: dt.date) -> sqlite3.Row | None:
    """The sealed bill of the account whose period ends where `start` begins (the highest revision, then the latest issue)."""
    return conn.execute(
        f"SELECT * FROM {kind.table} WHERE account_id = ? AND period_end = ? AND state IN ('issued','sent','paid') ORDER BY revision DESC, issued_at DESC LIMIT 1",
        (aid, start.isoformat()),
    ).fetchone()


def _meter_ends(snapshot_json: str, before: dt.datetime) -> dict[str, dt.datetime]:
    out: dict[str, dt.datetime] = {}
    for m in json.loads(snapshot_json).get("meters") or []:
        at = _eb()._parse_iso((m.get("end") or {}).get("at"))
        if at is not None and at < before:
            out[m["meter_id"]] = at
    return out


def carried_from(kind: BillKind, conn: sqlite3.Connection, aid: str, period: per.Period, w_start: dt.datetime) -> dict[str, dt.datetime]:
    """Per meter, the end point of the previous sealed bill when it lies before this window's start (a late report it already billed)."""
    prev = prev_bill(kind, conn, aid, period.start)
    if not prev:
        return {}
    return _meter_ends(prev["snapshot_json"], w_start)


def end_caps(kind: BillKind, conn: sqlite3.Connection, aid: str, period: per.Period, replaces: sqlite3.Row | None,
             w_end: dt.datetime) -> dict[str, dt.datetime]:
    """A correction of a bill that already has a successor keeps the original's per-meter end points, so the quantity the successor
    carried is never billed twice."""
    if replaces is None:
        return {}
    succ = conn.execute(f"SELECT 1 FROM {kind.table} WHERE account_id = ? AND period_start = ? AND state IN ('issued','sent','paid') LIMIT 1",
                        (aid, period.end.isoformat())).fetchone()
    if not succ:
        return {}
    return _meter_ends(replaces["snapshot_json"], w_end)


# ====================================================================== the bills of an account's history (code review 04:F26)

PeriodKey = tuple[str, str]


def period_bills(kind: BillKind, conn: sqlite3.Connection, aid: str, periods: list[per.Period]) -> tuple[dict[PeriodKey, sqlite3.Row], dict[PeriodKey, sqlite3.Row]]:
    """One statement for the bills of account `aid` whose period is exactly one of `periods` (the history used to look each period up
    twice). Returns (sealed, shown), keyed by (period_start, period_end):
    - sealed: the highest revision among issued / sent / paid - what the per-period quantity lookup returned;
    - shown: the highest revision that is not void - what the history row shows as the period's bill.
    The code never leaves two rows of one exact period with the same revision in these states (a second draft, an overlapping issue and a
    second open correction are refused); on such legacy data the earlier-written row wins."""
    keys = {(p.start.isoformat(), p.end.isoformat()) for p in periods}
    if not keys:
        return {}, {}
    lo, hi = min(k[0] for k in keys), max(k[1] for k in keys)
    rows = conn.execute(f"SELECT * FROM {kind.table} WHERE account_id = ? AND state != 'void' AND period_start >= ? AND period_end <= ? ORDER BY revision DESC, rowid",
                        (aid, lo, hi)).fetchall()
    sealed: dict[PeriodKey, sqlite3.Row] = {}
    shown: dict[PeriodKey, sqlite3.Row] = {}
    for r in rows:
        k = (r["period_start"], r["period_end"])
        if k not in keys:
            continue
        shown.setdefault(k, r)
        if r["state"] in kind.issued_states:
            sealed.setdefault(k, r)
    return sealed, shown


# ====================================================================== automatic generation (owner round 2)

@dataclass
class AutoOutcome:
    created: int = 0
    issued: int = 0
    failed: int = 0
    skipped: int = 0


@dataclass(frozen=True)
class AutoHooks:
    """What differs between the kinds in a pass, resolved by the owning module AT CALL TIME (its names stay the test seams: a test that
    replaces energy_billing.insert_draft or water_billing.compute replaces what the pass calls)."""

    log: logging.Logger
    read_settings: Callable[[sqlite3.Connection], dict[str, Any]]             # the SHARED billing settings document (the delay)
    provider: Callable[[sqlite3.Connection], Any]                              # the readings provider, inside the compute connection
    compute: Callable[[sqlite3.Connection, Any, sqlite3.Row, per.Period, dt.datetime], Any]  # origin "auto"
    insert_draft: Callable[..., str]
    seal: Callable[..., None]
    get_bill: Callable[[sqlite3.Connection, str], sqlite3.Row]
    max_per_account: int
    retry: dt.timedelta
    enabled: Callable[[sqlite3.Connection], bool] | None = None               # the module switch (water); None = always on
    draft_ready: Callable[[sqlite3.Connection, str, dt.date, dt.date], Any] | None = None  # told once per new draft (electricity)


def _run_row(kind: BillKind, conn: sqlite3.Connection, acc_id: str, p: per.Period) -> sqlite3.Row | None:
    return conn.execute(f"SELECT status, next_attempt_at FROM {kind.runs_table} WHERE account_id = ? AND period_start = ? AND period_end = ?",
                        (acc_id, p.start.isoformat(), p.end.isoformat())).fetchone()


def _settled(run: sqlite3.Row | None, now: dt.datetime) -> bool:
    """True when the (account, period) needs no pass now: it has a run row that is not a failure whose retry time came."""
    return run is not None and not (run["status"] == "failed" and (run["next_attempt_at"] or "") <= _eb()._iso(now))


def due_periods(kind: BillKind, conn: sqlite3.Connection, acc: sqlite3.Row, now: dt.datetime, delay: dt.timedelta,
                max_per_account: int) -> list[per.Period]:
    eb = _eb()
    tz = acc["timezone"]
    c = eb.cycle_of(acc)
    created_local = per.local_date(eb._parse_iso(acc["created_at"]) or now, tz)
    out: list[per.Period] = []
    for p in per.regular_periods(c, per.local_date(now, tz)):
        if p.end <= created_local:
            continue  # periods that ended before the account existed are never generated automatically
        if per.local_midnight_utc(p.end, tz) + delay > now:
            continue
        if _settled(_run_row(kind, conn, acc["id"], p), now):
            continue
        out.append(p)
        if len(out) >= max_per_account:
            break
    return out


def record_run(kind: BillKind, conn: sqlite3.Connection, acc_id: str, p: per.Period, status: str, bill_id: str | None, error: str | None,
               now: dt.datetime, retry: dt.timedelta) -> None:
    nxt = _eb()._iso(now + retry) if status == "failed" else None
    conn.execute(
        f"""INSERT INTO {kind.runs_table}(account_id, period_start, period_end, status, bill_id, error_code, attempts, next_attempt_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
           ON CONFLICT(account_id, period_start, period_end) DO UPDATE SET status = excluded.status, bill_id = excluded.bill_id,
             error_code = excluded.error_code, attempts = {kind.runs_table}.attempts + 1, next_attempt_at = excluded.next_attempt_at, updated_at = excluded.updated_at""",
        (acc_id, p.start.isoformat(), p.end.isoformat(), status, bill_id, error, nxt, now_iso(), now_iso()),
    )


def auto_generate(kind: BillKind, db: Any, now: dt.datetime, hooks: AutoHooks) -> AutoOutcome:
    """One pass of the automatic generation. Idempotent: the (account, period) run row is written in the same transaction as the draft,
    and the write re-checks it, so a second process, a double tick or a restart in the middle never makes a second bill. The computation
    runs before the write lock, on a read connection; an account changed meanwhile is left for the next pass."""
    out = AutoOutcome()
    with db.connection(mode="read", label=f"{kind.name}.auto.scan") as rconn:
        if hooks.enabled is not None and not hooks.enabled(rconn):
            return out
        delay = dt.timedelta(hours=int(hooks.read_settings(rconn)["auto"]["delay_hours"]))
        accounts = rconn.execute(f"SELECT * FROM {kind.accounts_table} WHERE deleted_at IS NULL AND status = 'active' AND auto_mode != 'off' ORDER BY created_at").fetchall()
        work = [(acc, due_periods(kind, rconn, acc, now, delay, hooks.max_per_account)) for acc in accounts]
    for acc, periods in work:
        for p in periods:
            try:
                with db.connection(mode="read", label=f"{kind.name}.auto.compute") as rconn:
                    if rconn.execute(f"SELECT 1 FROM {kind.table} WHERE account_id = ? AND period_start < ? AND period_end > ? AND state != 'void' LIMIT 1",
                                     (acc["id"], p.end.isoformat(), p.start.isoformat())).fetchone():
                        comp, error = None, "exists"
                    else:
                        comp, error = hooks.compute(rconn, hooks.provider(rconn), acc, p, now), None
            except ApiError as e:
                comp, error = None, e.code
            except Exception:  # noqa: BLE001 - one account never stops the others
                hooks.log.warning(f"automatic {kind.log_word}bill computation failed", exc_info=True)
                comp, error = None, "internal"
            with db.connection(label=f"{kind.name}.auto.write") as conn:
                if _settled(_run_row(kind, conn, acc["id"], p), now):
                    continue  # another pass got here first
                if error == "exists":
                    record_run(kind, conn, acc["id"], p, "skipped", None, None, now, hooks.retry)
                    out.skipped += 1
                    continue
                if comp is None:
                    record_run(kind, conn, acc["id"], p, "failed", None, error, now, hooks.retry)
                    _audit_row(conn, actor=None, action=f"{kind.audit_prefix}bill.auto_failed", decision="allowed", resource_type=kind.account_resource_type,
                               resource_id=acc["id"], request_id=None, details={"period": p.as_api(), "error": error})
                    out.failed += 1
                    continue
                cur = conn.execute(f"SELECT * FROM {kind.accounts_table} WHERE id = ? AND deleted_at IS NULL", (acc["id"],)).fetchone()
                if cur is None or cur["revision"] != acc["revision"]:
                    continue  # changed meanwhile: the next pass computes it again
                try:
                    bid = hooks.insert_draft(conn, cur, p, comp, actor=None, origin="auto", request_id=None, client_request_id=None)
                except ApiError as e:
                    record_run(kind, conn, acc["id"], p, "skipped" if e.code in ("draft_exists", "period_overlap") else "failed", None, e.code, now,
                               hooks.retry)
                    out.skipped += 1
                    continue
                status = "created"
                if cur["auto_mode"] == "issue":
                    bill = hooks.get_bill(conn, bid)
                    try:
                        hooks.seal(conn, bill, comp, actor=None, issue_date=per.local_date(now, cur["timezone"]), request_id=None, client_request_id=None)
                        status = "issued"
                        out.issued += 1
                    except ApiError as e:
                        hooks.log.warning(f"automatic {kind.log_word}issue refused: %s", e.code)
                if status == "created" and hooks.draft_ready is not None:  # a draft waits for review: told once, in this transaction
                    hooks.draft_ready(conn, bid, p.start, p.end)
                record_run(kind, conn, acc["id"], p, status, bid, None, now, hooks.retry)
                out.created += 1
    return out


# ====================================================================== retention (the SHARED keys)

def retention(kind: BillKind, db: Any, now: dt.datetime, data_dir: Path | None = None) -> dict[str, int]:
    """Drafts not changed for `energy.draft_retention_days` (30) and documents whose period ended before the first of the month
    `energy.bill_retention_years` (7) back are deleted with their events (and, for a kind with stored PDFs, the files after the commit).
    A document inside the retention years is never deleted, whatever its state or last change. The ledger of used numbers and the
    automatic-run rows stay, so a number is never reused and an old period is never generated again."""
    eb = _eb()
    with db.connection(label=f"{kind.name}.billing.retention") as conn:
        days = eb._int_setting(conn, "energy.draft_retention_days", 30, 7, 365)
        years = eb._int_setting(conn, "energy.bill_retention_years", 7, 1, 15)
        draft_cut = eb._iso(now - dt.timedelta(days=days))
        today = per.local_date(now, "UTC")
        bill_cut = today.replace(year=today.year - years, day=1).isoformat()
        drafts = [r["id"] for r in conn.execute(f"SELECT id FROM {kind.table} WHERE state = 'draft' AND updated_at < ?", (draft_cut,)).fetchall()]
        cols = f"id, {kind.pdf_column}" if kind.pdf_column else "id"
        old = conn.execute(f"SELECT {cols} FROM {kind.table} WHERE state != 'draft' AND period_end < ?", (bill_cut,)).fetchall()
        ids = drafts + [r["id"] for r in old]
        for bid in ids:
            conn.execute(f"DELETE FROM {kind.events_table} WHERE bill_id = ?", (bid,))
            conn.execute(f"DELETE FROM {kind.table} WHERE id = ?", (bid,))
        if ids:
            audit(kind, conn, None, "bill.retention", "*", None, {"drafts": len(drafts), "bills": len(old)})
    if data_dir is not None and kind.pdf_column:
        for r in old:
            if r[kind.pdf_column]:
                try:
                    (data_dir / r[kind.pdf_column]).unlink(missing_ok=True)
                except OSError:
                    pass
    return {"drafts": len(drafts), "bills": len(old)}
