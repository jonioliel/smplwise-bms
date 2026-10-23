"""CR-SVC215 slice 2 (docs/changes/CR-SVC215.md section 5): the vendor-document surfaces of the service module - the mark in the quote
comparison and the confirmation when a vendor with a lapsed document is assigned.

The DATA is CR-MAINT215's (`maint_tasks`, kind `vendor_document`: insurance, electrician licence, work-at-height, other; one valid-through
date and a lead per document) - one model, not two. When the maintenance bundle is merged its own `vendor_status()` answers (the same
helper the assignee picker uses); until then (this branch is cut before it) the same read is done here against the same table, and
answers EMPTY while the table is absent or the maintenance switch (`maintenance.enabled`) is off - so nothing in the service module
depends on the maintenance module being installed. Only document types and dates travel: never a file, never a value, never a number.
"""
from __future__ import annotations

import datetime as dt
import importlib
import sqlite3
from typing import Any

from ...db import get_setting
from . import settings_doc, store_vendor_stats as sv

FEATURE_KEY = "maintenance.enabled"  # CR-MAINT215's switch (services/maintenance/access.FEATURE_KEY)


def cfg(conn: sqlite3.Connection) -> dict[str, Any]:
    return settings_doc.read(conn)["vendor_documents"]


def _date(v: Any) -> dt.date | None:
    if not isinstance(v, str):
        return None
    try:
        return dt.date.fromisoformat(v[:10])
    except ValueError:
        return None


def status(conn: sqlite3.Connection, vendor_ids: list[str], today: dt.date) -> dict[str, dict[str, Any]]:
    """Per vendor with a document: {"state": expired | expiring | ok, "expired": [{doc_type, valid_until}], "expiring": [...]}. Vendors
    without a document are absent from the answer."""
    ids = [v for v in dict.fromkeys(vendor_ids) if v]
    if not ids:
        return {}
    try:  # the maintenance bundle's own helper once it is merged
        service = importlib.import_module("smplwise.services.maintenance.service")
        helper = getattr(service, "vendor_status", None)
    except ImportError:
        helper = None
    if helper is not None:
        return helper(conn, ids, today)
    if (get_setting(conn, FEATURE_KEY, "false") or "false") != "true":
        return {}
    if conn.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'maint_tasks'").fetchone() is None:
        return {}
    out: dict[str, dict[str, Any]] = {}
    marks = ",".join("?" * len(ids))
    for r in conn.execute(f"SELECT vendor_id, doc_type, due_date, lead_days FROM maint_tasks WHERE kind = 'vendor_document' AND deleted_at IS NULL "
                          f"AND active = 1 AND vendor_id IN ({marks}) ORDER BY due_date, id", ids).fetchall():
        due = _date(r["due_date"])
        if due is None:
            continue
        left = (due - today).days
        slot = out.setdefault(r["vendor_id"], {"state": "ok", "expired": [], "expiring": []})
        if left < 0:
            slot["expired"].append({"doc_type": r["doc_type"], "valid_until": r["due_date"]})
        elif left <= int(r["lead_days"] if r["lead_days"] is not None else 30):
            slot["expiring"].append({"doc_type": r["doc_type"], "valid_until": r["due_date"]})
    for slot in out.values():
        slot["state"] = "expired" if slot["expired"] else "expiring" if slot["expiring"] else "ok"
    return out


def unit_of(conn: sqlite3.Connection, contact_id: str) -> str | None:
    """The vendor company a document belongs to: the company of a technician, a freelancer's own id; None for an unknown contact."""
    c = sv.contact(conn, contact_id)
    if c is None:
        return None
    return c["vendor_id"] if c["kind"] == "person" and c.get("vendor_id") else c["id"]


def lapsed_for(conn: sqlite3.Connection, unit_id: str, today: dt.date, *, include_expiring: bool) -> list[dict[str, Any]]:
    """The documents of one vendor that ask for the manager's confirmation on assign: the expired ones, plus the expiring ones when asked."""
    slot = status(conn, [unit_id], today).get(unit_id)
    if not slot:
        return []
    out = [{**d, "state": "expired"} for d in slot["expired"]]
    if include_expiring:
        out += [{**d, "state": "expiring"} for d in slot["expiring"]]
    return out
