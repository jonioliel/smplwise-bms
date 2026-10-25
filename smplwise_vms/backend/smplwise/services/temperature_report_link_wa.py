"""WALINK-295: the temporary temperature-report link (TEMPLINK-295) sent as a PLAIN-TEXT WhatsApp message to the recipients the installation configured.

It adds no transport. A send goes through exactly what the notification channel's test send and the report summaries already use: the
account of the use `infra.temperature.reports` (it inherits the notifications account), the shared pacing ledger, `WhatsAppChannel`
(`whatsapp.send_message`, text only) over `notify_whatsapp.transport()`, and the recipient's number and CONSENT from
`notify_whatsapp.resolve_number` (a system user is messaged only on the number they opted in for themselves).

A free-text message is not a template (owner decision 25.10: the template-send support flag is NOT required), so it is gated by the
session window before anything leaves. A recipient is `not_sendable` (typed, recorded, never a fake
`sent`) when ANY of these holds - the first reason found is reported:
* `no_address`      the user has no WhatsApp number;
* `no_consent`      the number is not opted in / verified for notifications;
* `no_session_window`     the recipient did not write to us within the configured session window (`report_link_wa_window_h`, default 24 h;
                    read from `ticket_inbound`, keyed by HMAC of the number under the module key - no number is ever compared in clear).
Other outcomes: `sent`; `failed` with `provider_refused` / `unknown_outcome` (it may have left: never retried) / `channel_unavailable` /
`rate_limited` / `channel_down`.

Settings (the temperature installation settings, all editable): `report_link_wa_enabled` (OFF), `report_link_wa_recipients` (user ids),
`report_link_wa_text_he` / `_en` (the message; `{link}` required, `{hours}` optional), `report_link_wa_window_h`, and the link's own lifetime
`report_link_hours`. The record is one content-free audit row per send (`infra.temperature.report.link.send`: counts and per-recipient status codes with the
user id; never the number, the text or the link)."""
from __future__ import annotations

import datetime as dt
import logging
import sqlite3
from typing import Any

from ..audit import audit
from ..db import unlocked
from . import messaging_accounts as ma
from . import messaging_runtime as mr
from . import temperature as t
from . import temperature_report_link as rl
from . import temperature_whatsapp as twa
from .tickets import out_documents as docs
from .timeutil import parse_utc

log = logging.getLogger("smplwise.temperature.link_wa")

PERM = "infra.temperature.report_link_send"
SENT, NOT_SENDABLE, FAILED = "sent", "not_sendable", "failed"
EVENT_RECEIVED = "whatsapp_message_received"
KIND = "message"


class SendRefused(ValueError):
    """`code` is a key of temperature.MESSAGES; `status` the HTTP status the route answers."""

    def __init__(self, code: str, status: int) -> None:
        super().__init__(code)
        self.code, self.status = code, status


def settings(conn: sqlite3.Connection) -> dict[str, Any]:
    d = t.load_defaults(conn)
    return {"enabled": bool(d["report_link_wa_enabled"]), "recipients": list(d["report_link_wa_recipients"]), "window_h": int(d["report_link_wa_window_h"]),
            "text_he": d["report_link_wa_text_he"], "text_en": d["report_link_wa_text_en"], "hours": int(d["report_link_hours"])}


def available(conn: sqlite3.Connection) -> bool:
    """The send is offered: the WhatsApp send is on, at least one recipient is configured, and the link itself is available."""
    s = settings(conn)
    return s["enabled"] and bool(s["recipients"]) and rl.available(conn)


def render(template: str, link: str, hours: int) -> str:
    """The configured text with `{link}` and `{hours}` filled. The template is flattened to one line first; the link is inserted afterwards."""
    from .tickets.channel import one_line

    text = one_line(template, 400).replace("{hours}", str(int(hours))).replace("{link}", link)
    return text[:700]


def session_open(conn: sqlite3.Connection, digits: str, window_h: int, now: dt.datetime) -> bool:
    """The recipient wrote to us within `window_h` hours. Fails closed: no module key, no table, no inbound row = closed."""
    from .tickets.channel import keyed_hash
    from .tickets.keyring import KEYS

    try:
        key = KEYS.get(None)
        r = conn.execute("SELECT MAX(received_at) AS last FROM ticket_inbound WHERE sender_key = ? AND event_type = ?", (keyed_hash(key, digits), EVENT_RECEIVED)).fetchone()
    except Exception:  # noqa: BLE001
        return False
    last = parse_utc(r["last"]) if r and r["last"] else None
    return last is not None and now - last <= dt.timedelta(hours=window_h) and last <= now + dt.timedelta(minutes=5)


def gate(conn: sqlite3.Connection, user_id: str, window_h: int, now: dt.datetime) -> tuple[Any | None, str | None]:
    """(resolved number, None) when a free-text message may go to this user, else (None, the not_sendable reason)."""
    from .notify_whatsapp import raw_number, resolve_number

    if raw_number(conn, user_id) is None:
        return None, "no_address"
    found = resolve_number(conn, user_id)
    if found is None or found.consent != "granted":
        return None, "no_consent"
    if not session_open(conn, found.digits, window_h, now):
        return None, "no_session_window"
    return found, None


def _name(conn: sqlite3.Connection, user_id: str) -> str:
    r = conn.execute("SELECT username, display_name FROM users WHERE id = ?", (user_id,)).fetchone()
    return (r["display_name"] or r["username"]) if r else user_id


def _deliver(conn: sqlite3.Connection, db: Any, found: Any, text: str, row_id: str, now: dt.datetime) -> tuple[str, str | None]:
    """One message through the shared account, pacing and adapter (the same sequence as notify_whatsapp.send_test)."""
    from .notify_whatsapp import _messaging_key, transport
    from .tickets.channel import NOT_SENT, REFUSED, SENT as CH_SENT, OutboundMessage, Recipient
    from .tickets.channel_whatsapp import WhatsAppChannel

    svc = mr.service(conn)
    account = svc.resolve(twa.USE_KEY)
    if account is None or not account.value:
        return FAILED, "channel_unavailable"
    if not svc.status(account.key).sendable:
        return FAILED, "channel_down"
    gate_ = ma.PacingGate(ma.SqliteSendLedger(conn))
    rkey = mr.recipient_key(_messaging_key(db), found.digits)
    decision = gate_.check(account_key=account.key, pacing=svc.pacing(account.key), recipient_key=rkey, kind=KIND, now=now)
    if not decision.allowed:
        return FAILED, "rate_limited"
    msg = OutboundMessage(outbox_id=row_id, channel=twa.CHANNEL, purpose="notify", recipient=Recipient(None, phone=found.digits), text=text, account=account)
    with unlocked(conn):
        result = WhatsAppChannel(transport(), svc).send(msg)
    svc.note_result(account.key, result)
    if result.may_have_left:
        try:
            gate_.record(account_key=account.key, use_key=twa.USE_KEY, recipient_key=rkey, kind=KIND, now=now)
        except Exception:  # noqa: BLE001
            log.warning("temperature link send ledger row failed")
    if result.outcome == CH_SENT:
        return SENT, None
    if result.outcome == REFUSED:
        return FAILED, "provider_refused"
    if result.outcome == NOT_SENT:
        return FAILED, result.outcome_code or "not_sent"
    return FAILED, "unknown_outcome"  # it may have left: never retried here


def send(conn: sqlite3.Connection, db: Any, link_id: str, user_id: str, actor: Any, everyone: bool, now: dt.datetime) -> dict[str, Any]:
    """Send the live link `link_id` (the creator's own, or any for a manager) to the configured recipients. Raises SendRefused for the
    refusals that stop the whole send; per-recipient refusals are typed rows in the result and in the audit row."""
    s = settings(conn)
    if not s["enabled"]:
        raise SendRefused("report_link_wa_off", 409)
    if not s["recipients"]:
        raise SendRefused("report_link_wa_none", 409)
    r = docs.row(conn, link_id)
    if r is None or r["module"] != rl.MODULE or r["recipient_kind"] != "user" or (not everyone and r["created_by"] != user_id):
        raise SendRefused("link_not_found", 404)
    if rl.state_of(r, now) != "live":
        raise SendRefused("report_link_not_live", 409)
    try:
        url = docs.url(conn, r)
    except Exception:  # noqa: BLE001 - no public address / a lost module key: the link derives nothing
        raise SendRefused("report_link_unavailable", 409) from None
    ends = parse_utc(r["expires_at"])
    hours = max(1, -(-int((ends - now).total_seconds()) // 3600)) if ends else s["hours"]  # whole hours left, rounded up
    results: list[dict[str, Any]] = []
    for uid in dict.fromkeys(s["recipients"]):
        row: dict[str, Any] = {"user_id": uid, "name": _name(conn, uid)}
        found, why = gate(conn, uid, s["window_h"], now)
        if found is None:
            results.append({**row, "status": NOT_SENDABLE, "reason": why})
            continue
        lang = "he" if found.lang == "he" else "en"
        status, reason = _deliver(conn, db, found, render(s["text_he"] if lang == "he" else s["text_en"], url, hours), f"walink-{link_id[:24]}-{uid[:12]}", now)
        results.append({**row, "status": status, "reason": reason})
    counts = {k: sum(1 for x in results if x["status"] == k) for k in (SENT, NOT_SENDABLE, FAILED)}
    overall = SENT if counts[SENT] == len(results) else (NOT_SENDABLE if counts[NOT_SENDABLE] == len(results) else (FAILED if not counts[SENT] else "partial"))
    audit(conn, actor=actor, action="infra.temperature.report.link.send", decision="allowed", resource_type="outbound_document", resource_id=link_id,
          details={"status": overall, **counts, "recipients": [{"user_id": x["user_id"], "status": x["status"], "reason": x["reason"]} for x in results]})
    return {"status": overall, **counts, "results": results}


__all__ = ["PERM", "SENT", "NOT_SENDABLE", "FAILED", "SendRefused", "settings", "available", "render", "session_open", "gate", "send"]
