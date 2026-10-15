"""TK257: the vendor's QUOTE before the work (owner decisions of 2026-10-15/16). A quote is not a cost claim (migration 0083): it is a small
append-only record per assignment (migration 0085, `ticket_cost_quotes`), computed by the same server arithmetic (money.py, integer
minor units, the vendor's VAT toggle), shown to the manager next to the claim, and approving it NEVER sends a message to the vendor
(the manager is asked each time by the UI; there is no automatic send anywhere in this module). The payment demand after the work is the
existing claim; the vendor page shows the approved quote as the reference of that demand.

Visibility: every vendor-side function takes ONE assignment id (the link's) - a vendor sees its own quotes only, never another assignment's."""
from __future__ import annotations

import datetime as dt
import json
from typing import Any, Mapping

from ...db import new_id
from . import costs, model, store, store_costs
from .costs import CostRefused, iso

DEFAULT_KINDS: tuple[str, ...] = ("labor", "parts")
ALL_KINDS: tuple[str, ...] = ("labor", "parts", "travel", "other")
OPEN_STATES = frozenset({"submitted", "rejected"})  # the vendor may still send a (new) quote
QUOTE_STATUSES = model.HANDLING  # before the work is done: assigned / acknowledged / in progress / waiting for a part
NOTES_MAX = 1000


def parse_kinds(raw: Any) -> tuple[str, ...] | None:
    """A stored `cost_line_kinds` ('labor,parts,travel') -> the kinds in the fixed order; None for NULL / garbage (= the default)."""
    if not isinstance(raw, str) or not raw.strip():
        return None
    wanted = {p.strip() for p in raw.split(",")}
    kinds = tuple(k for k in ALL_KINDS if k in wanted)
    return kinds or None


def allowed_kinds(assignment: Mapping[str, Any] | None, department: Mapping[str, Any] | None) -> tuple[str, ...]:
    """Work + parts by default; travel / other only when the request (assignment) or else the department allows them. Work and parts
    are always part of the answer - a setting can add kinds, never take the two basic ones away."""
    chosen = parse_kinds((assignment or {}).get("cost_line_kinds")) or parse_kinds((department or {}).get("cost_line_kinds")) or DEFAULT_KINDS
    return tuple(k for k in ALL_KINDS if k in chosen or k in DEFAULT_KINDS)


# ---------------------------------------------------------------- storage

def quotes_of_assignment(conn, assignment_id: str) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute("SELECT * FROM ticket_cost_quotes WHERE assignment_id = ? ORDER BY seq", (assignment_id,)).fetchall()]


def quotes_of_ticket(conn, ticket_id: str) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute("SELECT * FROM ticket_cost_quotes WHERE ticket_id = ? ORDER BY created_at, seq", (ticket_id,)).fetchall()]


def quote(conn, quote_id: str) -> dict[str, Any] | None:
    row = conn.execute("SELECT * FROM ticket_cost_quotes WHERE id = ?", (quote_id,)).fetchone()
    return dict(row) if row is not None else None


def current(rows: list[dict[str, Any]]) -> dict[str, Any] | None:
    """The quote that counts: the approved one, else the newest that is not superseded."""
    approved = next((r for r in reversed(rows) if r["state"] == "approved"), None)
    if approved is not None:
        return approved
    live = [r for r in rows if r["state"] != "superseded"]
    return live[-1] if live else None


# ---------------------------------------------------------------- presentation

def _lines(row: Mapping[str, Any]) -> list[dict[str, Any]]:
    try:
        v = json.loads(row.get("lines_json") or "[]")
    except ValueError:
        return []
    return v if isinstance(v, list) else []


def present(row: Mapping[str, Any]) -> dict[str, Any]:
    """A quote as the vendor sees it (the manager's list adds who decided). `reason` is the correction request of a rejected quote."""
    out = {"id": row["id"], "seq": row["seq"], "state": row["state"], "lines": _lines(row), "labor_minor": row["labor_minor"],
           "parts_minor": row["parts_minor"], "travel_minor": row["travel_minor"], "other_minor": row["other_minor"],
           "subtotal_minor": row["subtotal_minor"], "vat_mode": row["vat_mode"], "vat_rate_bp": row["vat_rate_bp"], "vat_minor": row["vat_minor"],
           "total_minor": row["total_minor"], "net_minor": row["total_minor"] - row["vat_minor"], "currency": row["currency"],
           "notes": row.get("notes"), "created_at": row["created_at"]}
    if row["state"] == "rejected":
        out["reason"] = row.get("reason")
    return out


def present_for_manager(conn, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out = []
    for r in rows:
        p = present(r)
        p["reason"] = r.get("reason")
        p["assignment_id"] = r["assignment_id"]
        p["decided_by"] = store.display_name(conn, r["decided_by"]) if r.get("decided_by") else None
        p["decided_at"] = r.get("decided_at")
        out.append(p)
    return out


# ---------------------------------------------------------------- the vendor's side

def writable(ticket: Mapping[str, Any], rows: list[dict[str, Any]]) -> bool:
    if ticket["status"] not in QUOTE_STATUSES:
        return False
    cur = current(rows)
    return cur is None or cur["state"] in OPEN_STATES


def public_quote(conn, assignment_id: str, ticket_id: str) -> dict[str, Any]:
    """GET /t/api/quote: the vendor's own quote state, the figures of its latest quote, the lines it may use and the form settings."""
    ticket = store_costs.ticket_row(conn, ticket_id) or {}
    asg = store.assignment(conn, assignment_id) or {}
    dept = store.department_any(conn, ticket["department_id"]) if ticket.get("department_id") else None
    rows = quotes_of_assignment(conn, assignment_id)
    cur = current(rows)
    s = costs.cost_settings(conn)
    contact, vendor = costs._contact_pair(conn, asg["contact_id"]) if asg.get("contact_id") else ({}, None)
    exempt = bool(contact.get("vat_exempt") or (vendor or {}).get("vat_exempt"))
    rate = contact.get("labor_rate_minor")
    if rate is None and vendor is not None:
        rate = vendor.get("labor_rate_minor")
    rate_currency = contact.get("rate_currency") or (vendor or {}).get("rate_currency")
    currency = (cur or {}).get("currency") or (rate_currency if rate_currency in s.currencies else s.currencies[0])
    return {
        "state": cur["state"] if cur else "none",
        "writable": bool(ticket) and writable(ticket, rows),
        "allowed_kinds": list(allowed_kinds(asg, dept)),
        "currency": currency,
        "quote": present(cur) if cur else None,
        "form": {"currencies": list(s.currencies),
                 "vat": {"exempt": exempt, "rate_bp": s.vat_rate_bp,
                         "default": "none" if exempt else (contact.get("vat_default") or (vendor or {}).get("vat_default") or "excluded")},
                 "labor_rate_minor": rate if rate_currency in (None, currency) else None,
                 "limits": {"lines": 30, "description": 120, "notes": NOTES_MAX, "max_total_minor": s.max_claim_total_minor}},
    }


def submit(conn, assignment: Mapping[str, Any], ticket: Mapping[str, Any], body: Mapping[str, Any], *, at: dt.datetime) -> dict[str, Any]:
    """A vendor's quote through its handler link. The same arithmetic and validation as a claim (costs.draft), then: only the allowed
    line kinds; the request must still be before "done"; an approved quote is closed. A new quote supersedes the open one."""
    rows = quotes_of_assignment(conn, assignment["id"])
    if ticket["status"] not in QUOTE_STATUSES:
        raise CostRefused(409, "quote_closed")
    cur = current(rows)
    if cur is not None and cur["state"] == "approved":
        raise CostRefused(409, "quote_closed")
    dept = store.department_any(conn, ticket["department_id"]) if ticket.get("department_id") else None
    allowed = allowed_kinds(assignment, dept)
    d = costs.draft(conn, {"contact_id": assignment["contact_id"], "currency": None}, {k: v for k, v in body.items() if k not in ("notes", "no_charge")})
    for i, ln in enumerate(d.computed.lines):
        if ln.kind not in allowed:
            raise CostRefused(422, "kind_not_allowed", f"lines.{i}.kind")
    notes = costs._text(body.get("notes"), "notes", NOTES_MAX, multiline=True)
    c = d.computed
    seq = int(conn.execute("SELECT COALESCE(MAX(seq), 0) + 1 FROM ticket_cost_quotes WHERE assignment_id = ?", (assignment["id"],)).fetchone()[0])
    for r in rows:
        if r["state"] in OPEN_STATES:
            conn.execute("UPDATE ticket_cost_quotes SET state = 'superseded' WHERE id = ?", (r["id"],))
    qid = new_id()
    conn.execute(
        "INSERT INTO ticket_cost_quotes(id, ticket_id, assignment_id, contact_id, seq, state, lines_json, labor_minor, parts_minor, travel_minor,"
        " other_minor, subtotal_minor, vat_mode, vat_rate_bp, vat_minor, total_minor, currency, notes, created_at)"
        " VALUES (?,?,?,?,?,'submitted',?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (qid, ticket["id"], assignment["id"], assignment["contact_id"], seq,
         json.dumps([ln.as_json() for ln in c.lines], ensure_ascii=False, separators=(",", ":")),
         c.by_kind["labor"], c.by_kind["parts"], c.by_kind["travel"], c.by_kind["other"], c.subtotal_minor, c.vat_mode, c.vat_rate_bp,
         c.vat_minor, c.total_minor, d.currency, notes, iso(at)))
    return quote(conn, qid) or {}


# ---------------------------------------------------------------- the manager's side (no message is ever sent from here)

def decide(conn, quote_id: str, action: str, *, by: str, reason: Any, at: dt.datetime) -> dict[str, Any]:
    """approve | reject (a correction request, reason required). Only the open `submitted` quote can be decided."""
    row = quote(conn, quote_id)
    if row is None:
        raise CostRefused(404, "quote_not_found")
    if row["state"] != "submitted":
        raise CostRefused(409, "invalid_state")
    reason_text = costs._reason(reason, required=action == "reject")
    new = "approved" if action == "approve" else "rejected"
    conn.execute("UPDATE ticket_cost_quotes SET state = ?, reason = ?, decided_by = ?, decided_at = ? WHERE id = ?",
                 (new, reason_text if action == "reject" else None, by, iso(at), quote_id))
    return quote(conn, quote_id) or {}
