"""CR-SVC215 slice 2 (docs/changes/CR-SVC215.md sections 2.3 and 5): the one-line summary of a vendor in the quote comparison - the stat
strip (the card's numbers, trimmed to `vendor_stats.strip_numbers`) and the document mark. Computed on request, never stored.

Who sees what: the strip needs the card permission of the stats route (`vendor_stats.card_permission`, or tickets.directory) and
`vendor_stats.enabled`; its money number (quote adherence) only the money permission - absent otherwise, never null. The document mark
follows `vendor_documents.comparison_marks` and the maintenance switch. Only the vendors of THE request are asked for (the caller passes
them); no number of any other vendor ever travels. Never on the public page."""
from __future__ import annotations

import datetime as dt
import sqlite3
from typing import Any, Iterable

from ...db import get_setting
from ..timeutil import zone
from . import access, vendor_documents, vendor_stats
from .access import Viewer

UTC = dt.timezone.utc


def today(conn: sqlite3.Connection) -> dt.date:
    """The installation's local day (the zone setting, never a fixed offset)."""
    return dt.datetime.now(UTC).astimezone(zone(get_setting(conn, "time.zone", "Asia/Jerusalem") or "Asia/Jerusalem")).date()


def may_read_stats(viewer: Viewer, conn: sqlite3.Connection) -> bool:
    c = vendor_stats.cfg(conn)
    return bool(c["enabled"]) and (c["card_permission"] in viewer.anywhere or access.DIRECTORY in viewer.anywhere)


def strip(conn: sqlite3.Connection, viewer: Viewer, contact_id: str, now: dt.datetime) -> dict[str, Any] | None:
    """The trimmed card of the contact's vendor, or None (switch off, no permission, or a contact that gets no card)."""
    if not may_read_stats(viewer, conn):
        return None
    c = vendor_stats.cfg(conn)
    money = c["money_permission"] in viewer.anywhere
    try:
        card = vendor_stats.compute(conn, contact_id, months=int(c["default_months"]), now=now, money=money, only=set(c["strip_numbers"]))
    except vendor_stats.NoCard:
        return None
    return {"months": card["months"], "numbers": card["numbers"], "shown": card["shown"]}


def documents_for(conn: sqlite3.Connection, contact_ids: Iterable[str]) -> dict[str, dict[str, Any] | None]:
    """contact id -> the document state of its vendor ({state, expired, expiring}); None where the vendor holds no document or marks are off."""
    ids = list(dict.fromkeys(contact_ids))
    if not vendor_documents.cfg(conn)["comparison_marks"]:
        return dict.fromkeys(ids)
    unit = {i: vendor_documents.unit_of(conn, i) for i in ids}
    status = vendor_documents.status(conn, [u for u in unit.values() if u], today(conn))
    return {i: (status.get(u) if u else None) for i, u in unit.items()}


def for_rfq(conn: sqlite3.Connection, viewer: Viewer, vendors: list[dict[str, Any]], now: dt.datetime) -> list[dict[str, Any]]:
    """`vendors`: [{"vendor_id": the RFQ vendor row, "contact_id": ...}] of the request's quoting vendors. One entry each with `stats`
    (absent when the caller may not read the card) and `documents` (null when none)."""
    docs = documents_for(conn, [v["contact_id"] for v in vendors])
    out = []
    for v in vendors:
        entry: dict[str, Any] = {"vendor_id": v["vendor_id"], "contact_id": v["contact_id"], "documents": docs.get(v["contact_id"])}
        s = strip(conn, viewer, v["contact_id"], now)
        if s is not None:
            entry["stats"] = s
        out.append(entry)
    return out
