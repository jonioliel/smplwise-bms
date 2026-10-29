"""TEMPLINK-295: a temperature report as a TEMPORARY DOWNLOAD LINK made from the report dialog (CR-INFRA-TEMPERATURE section 9, item 1).

A user with `infra.temperature.report_link` renders the report he could already download and turns the PDF into a snapshot in
`outbound_documents` (services/tickets/out_documents.py: the token is derived and never stored, only sha256(token) is; the public listener
serves it without an account, rate limited per token / network / installation; the page and the download answer the uniform 404 for an unknown,
expired, revoked or used-up token). This module adds only what is temperature's own:

* the switch - `report_link_enabled` (installation setting, OFF by default) AND the tickets module's `reports.documents` (the public
  listener's switch; without it the file is not served, so no link is made);
* the lifetime and limits - `report_link_hours` (default 24, at most 168), `report_link_max_opens`, `report_link_per_hour` (per user);
* the list / revoke of the links a user made (a manager sees and may revoke all of them);
* the audit rows: `infra.temperature.report.link.create` / `.revoke` here, `report.document.mint` / `report.document.open` in out_documents.
  A row names the actor, the time and the document id (the report id) - never the units' readings, the PDF or the token.

No WhatsApp document is sent (no file contract exists): the link is shown to the creator, who hands it on himself."""
from __future__ import annotations

import datetime as dt
import sqlite3
from typing import Any

from ..audit import audit
from . import temperature as t
from .ha_user_auth import RateLimiter
from .tickets import links as tlinks
from .tickets import out_documents as docs

PERM = "infra.temperature.report_link"
MODULE = "temperature"
LIMITER = RateLimiter()
UTC = dt.timezone.utc
LIST_MAX = 50


class LinkRefused(ValueError):
    """`code` is a key of temperature.MESSAGES; `status` the HTTP status the route answers."""

    def __init__(self, code: str, status: int) -> None:
        super().__init__(code)
        self.code, self.status = code, status


def settings(conn: sqlite3.Connection) -> dict[str, Any]:
    d = t.load_defaults(conn)
    return {"enabled": bool(d["report_link_enabled"]), "hours": int(d["report_link_hours"]), "max_opens": int(d["report_link_max_opens"]),
            "per_hour": int(d["report_link_per_hour"])}


def available(conn: sqlite3.Connection) -> bool:
    """On in the temperature settings AND the public listener's document switch is on."""
    return settings(conn)["enabled"] and docs.config(conn)["enabled"]


def create(conn: sqlite3.Connection, user_id: str, actor: Any, pdf: bytes, filename: str, units: int, now: dt.datetime) -> dict[str, Any]:
    """Mint the link for a rendered report. The caller holds the write transaction and has already checked the permission and the units."""
    s = settings(conn)
    if not s["enabled"]:
        raise LinkRefused("report_link_off", 409)
    if not LIMITER.hit(f"tlink:{user_id}", [(3600.0, s["per_hour"])]):
        raise LinkRefused("report_link_rate", 429)
    try:
        doc = docs.mint(conn, module=MODULE, source_id=None, recipient_kind="user", recipient_id=user_id, media_type="application/pdf", filename=filename,
                        content=pdf, created_by=user_id, now=now, hours=s["hours"], max_opens=s["max_opens"])
        link = docs.url(conn, doc)
    except docs.DocumentRefused as e:
        raise LinkRefused("report_link_too_large" if e.code in ("document_too_large", "document_store_full") else "report_link_unavailable",
                          422 if e.code == "document_too_large" else 409) from None
    except tlinks.PublicUrlError:
        raise LinkRefused("report_link_unavailable", 409) from None
    audit(conn, actor=actor, action="infra.temperature.report.link.create", decision="allowed", resource_type="outbound_document", resource_id=doc["id"],
          details={"units": units, "expires_at": doc["expires_at"], "max_opens": doc["max_opens"]})
    return {**public_row(doc, now), "url": link}


def state_of(r: dict[str, Any], now: dt.datetime) -> str:
    if r.get("revoked_at"):
        return "revoked"
    if r.get("purged_at") or (docs._parse(r["expires_at"]) or now) <= now:  # noqa: SLF001 - the module's own parser
        return "expired"
    if int(r["open_count"] or 0) >= int(r["max_opens"]):
        return "used"
    return "live"


def public_row(r: dict[str, Any], now: dt.datetime) -> dict[str, Any]:
    """What the dialog may see of a link: ids, times and counts. Never the token, its hash or the content. TEMPREPORT-297: a link that went
    out inside a WhatsApp report (`source_id` = the send row) also names its recipient (display name) - `sent` true."""
    return {"id": r["id"], "filename": r["filename"], "created_at": r["created_at"], "expires_at": r["expires_at"], "opens": int(r["open_count"] or 0),
            "max_opens": int(r["max_opens"]), "state": state_of(r, now), "created_by": r.get("created_by"), "sent": bool(r.get("source_id")),
            "recipient": r.get("recipient_name") if r.get("source_id") else None}


def listing(conn: sqlite3.Connection, user_id: str, everyone: bool, now: dt.datetime) -> list[dict[str, Any]]:
    sql = ("SELECT d.id, d.filename, d.created_at, d.expires_at, d.open_count, d.max_opens, d.created_by, d.revoked_at, d.purged_at, d.source_id, "
           "COALESCE(u.display_name, u.username) AS recipient_name FROM outbound_documents d LEFT JOIN users u ON u.id = d.recipient_id "
           "WHERE d.module = ? AND d.recipient_kind = 'user'")
    args: list[Any] = [MODULE]
    if not everyone:
        sql += " AND d.created_by = ?"
        args.append(user_id)
    rows = conn.execute(sql + " ORDER BY d.created_at DESC LIMIT ?", (*args, LIST_MAX)).fetchall()
    return [public_row(dict(r), now) for r in rows]


def revoke_all(conn: sqlite3.Connection, user_id: str, actor: Any, everyone: bool, now: dt.datetime) -> int:
    """TEMPREPORT-297 (Settings): revoke every link still live at once - a manager all of them, anyone else his own. One audit row with the count."""
    sql = ("UPDATE outbound_documents SET revoked_at = ?, revoked_reason = 'manual' WHERE module = ? AND recipient_kind = 'user' "
           "AND revoked_at IS NULL AND purged_at IS NULL")
    args: list[Any] = [docs.iso(now), MODULE]
    if not everyone:
        sql += " AND created_by = ?"
        args.append(user_id)
    n = conn.execute(sql, args).rowcount
    audit(conn, actor=actor, action="infra.temperature.report.link.revoke_all", decision="allowed", resource_type="outbound_document",
          details={"revoked": n, "everyone": everyone})
    return n


def revoke(conn: sqlite3.Connection, doc_id: str, user_id: str, actor: Any, everyone: bool, now: dt.datetime) -> None:
    """The creator revokes his own link; a manager any of them. Anything else is the same not-found. Revoking twice is not an error."""
    r = docs.row(conn, doc_id)
    if r is None or r["module"] != MODULE or r["recipient_kind"] != "user" or (not everyone and r["created_by"] != user_id):
        raise LinkRefused("link_not_found", 404)
    if docs.revoke(conn, doc_id, "manual", now):
        audit(conn, actor=actor, action="infra.temperature.report.link.revoke", decision="allowed", resource_type="outbound_document", resource_id=doc_id)


__all__ = ["PERM", "LinkRefused", "settings", "available", "create", "listing", "revoke", "revoke_all"]
