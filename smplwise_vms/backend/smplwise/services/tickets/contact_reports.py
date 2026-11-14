"""CR-VENDORQ-294 (docs/changes/CR-VENDORQ-294-DESIGN.md section 4): a module's REPORT to an external contact (a vendor, a technician)
through the tickets message queue - the owner's "sending to vendors via the message queue" (2026-10-19 / 2026-10-20, kept, not forgotten).
First consumer: the temperature report (CR-INFRA-TEMPERATURE section 9, on its own branch).

How it works:
* the module registers a PROVIDER once (`register("temperature", provider)`): `body(conn, row, lang)` rebuilds the text (and names a
  document) at SEND time, `outcome(conn, row)` hears the final state, `still_relevant(conn, row)` answers after the module was off;
* `queue(...)` writes ONE outbox row of purpose `report` (`source_module`, `source_id`, optional `document_id`) inside the caller's
  transaction. The row holds no text and no number (the rule of 0081);
* the outbox worker sends it like every contact message: the account the module's use maps to, the send hours (held at night), the
  pacing per account and recipient, the number-verification stop, `unknown` final, the audit row - nothing of that is re-implemented here.

Rules of this slice: OFF by default (`reports.to_contacts`); WhatsApp, or e-mail as the second channel (VENDORQ2-295, `reports.email`, off by
default; chosen per report by the caller - never an automatic fallback from one to the other); the provider's text is one paragraph of at most TEXT_MAX characters and must not look like a link (only the system's own
document link may appear); a document that is no longer live stops the message (`document_not_live`) - never a message promising a dead
link. Nothing here logs or audits a number, a text, a token or a URL."""
from __future__ import annotations

import dataclasses
import datetime as dt
import logging
import re
import sqlite3
from typing import Any, Protocol

from . import message_templates as mt
from . import out_documents, settings_doc, store_links
from .channel import DEFAULT_LANG, LANGS, Recipient, one_line, strip_controls

log = logging.getLogger("smplwise.tickets.reports")

PURPOSE = "report"
TEXT_MAX = 700
# DOCLINKSEC-295 M-01 (security review 2026-10-23): the tickets rule (links.py, review T3-2, spec 10.2) is "E-mail never carries the
# fragment: it carries a redeem link". A document link `#d.<token>` IS the bearer capability, and a mail body is copied to mail servers,
# archives, shared mailboxes and URL-rewriting scanners that keep the full URL. Until documents get a redeem-style link, a report WITH a
# document never leaves by e-mail: `queue` refuses it (`document_channel`) and `render` stops a provider that names one at send time
# (`not_sent` / `document_channel`, non-retryable, the document revoked). Text-only e-mail reports are unchanged.
EMAIL_CARRIES_NO_DOCUMENT = True
_MODULE = re.compile(r"[a-z_]{1,32}")
_SOURCE = re.compile(r"[A-Za-z0-9_.:-]{1,64}")
# the document line, in the contact's language ({until} = local date and time). ar / ru: developer translations, native review pending
DOC_LINE = {
    "he": "הדוח המלא (זמין עד {until}): {link}",
    "en": "The full report (available until {until}): {link}",
    "ar": "التقرير الكامل (متاح حتى {until}): {link}",
    "ru": "Полный отчёт (доступен до {until}): {link}",
}


@dataclasses.dataclass(frozen=True)
class ReportBody:
    text: str = dataclasses.field(repr=False)
    document_id: str | None = None  # overrides the row's document (None = the row's own, if any)


class Provider(Protocol):
    def body(self, conn: sqlite3.Connection, row: Any, lang: str) -> ReportBody | None: ...

    def outcome(self, conn: sqlite3.Connection, row: Any) -> None: ...

    def still_relevant(self, conn: sqlite3.Connection, row: Any) -> bool: ...


PROVIDERS: dict[str, Provider] = {}


def register(module: str, provider: Provider) -> None:
    if not _MODULE.fullmatch(module or ""):
        raise ValueError("module")
    PROVIDERS[module] = provider


def unregister(module: str) -> None:
    PROVIDERS.pop(module, None)


class ReportRefused(ValueError):
    """`code` is a stable word; the message never carries a value."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def enabled(conn: sqlite3.Connection) -> bool:
    return bool(settings_doc.read(conn)["reports"]["to_contacts"])


def email_enabled(conn: sqlite3.Connection) -> bool:
    """VENDORQ2-295: e-mail as the second delivery channel - its own switch, on top of `reports.to_contacts` (both off by default)."""
    reports = settings_doc.read(conn)["reports"]
    return bool(reports["to_contacts"] and reports["email"])


def reach(conn: sqlite3.Connection, contact_id: str, channel: str = "whatsapp") -> str:
    """`ok` | `no_contact` | `no_whatsapp` | `no_email` | `reports_email_off` - may a report reach this contact now by this channel (the dialog's
    list; never a number or an address). E-mail needs the e-mail switch, an address on the contact and a configured SMTP; the contact's
    preferred channel does not matter (a report is the manager's explicit act), but an opt-out stops it at send time like every message."""
    from . import messaging

    contact = store_links.contact(conn, contact_id)
    if contact is None or contact.get("erased_at") or not contact.get("active", 1):
        return "no_contact"
    if channel == "email":
        if not email_enabled(conn):
            return "reports_email_off"
        if not contact.get("email") or not messaging.email_configured(conn, messaging.RUNTIME.data_dir):
            return "no_email"
        return "ok"
    if messaging.plan_channel(conn, contact, messaging.RUNTIME.data_dir) != "whatsapp":
        return "no_whatsapp"  # no number, WhatsApp off, prefers e-mail / manual, or an unverified number where verification is required
    return "ok"


def queue(conn: sqlite3.Connection, *, module: str, source_id: str, contact_id: str, requested_by: str | None,
          idempotency_key: str | None = None, use_key: str | None = None, document_id: str | None = None, department_id: str | None = None,
          channel: str = "whatsapp") -> Any:
    """ONE outbox row (purpose `report`) inside the caller's write transaction. Refusals: reports_to_contacts_off, report_module,
    report_source, report_channel, reports_email_off, contact (no_contact / no_whatsapp / no_email), document_channel (a document on the
    e-mail channel), document_unknown, queue_unavailable.
    `channel` is `whatsapp` (default) or `email` (VENDORQ2-295; needs `reports.email`). There is NO automatic switch between the two."""
    from . import messaging
    from .outbox import OutboxError

    if not enabled(conn):
        raise ReportRefused("reports_to_contacts_off")
    if module not in PROVIDERS:
        raise ReportRefused("report_module")
    if not isinstance(source_id, str) or not _SOURCE.fullmatch(source_id):
        raise ReportRefused("report_source")
    if channel not in ("whatsapp", "email"):
        raise ReportRefused("report_channel")
    why = reach(conn, contact_id, channel)
    if why != "ok":
        raise ReportRefused(why)
    if document_id is not None and channel == "email":
        raise ReportRefused("document_channel")  # DOCLINKSEC-295 M-01: see EMAIL_CARRIES_NO_DOCUMENT
    if document_id is not None:
        doc = out_documents.row(conn, document_id)
        if doc is None or doc["recipient_kind"] != "contact" or doc["recipient_id"] != contact_id:
            raise ReportRefused("document_unknown")  # a document is minted FOR its recipient - never re-used for another person
    if messaging.RUNTIME.outbox is None:
        raise ReportRefused("queue_unavailable")
    try:
        return messaging.RUNTIME.enqueue(conn, purpose=PURPOSE, contact_id=contact_id, department_id=department_id, channel=channel,
                                         requested_by=requested_by, idempotency_key=idempotency_key, source_module=module, source_id=source_id,
                                         document_id=document_id, use_key=use_key)
    except OutboxError as exc:
        raise ReportRefused(exc.code) from None


# ---------------------------------------------------------------- send time (the outbox's `report_text` port)

_URLISH = mt._URL  # the template lint's rule: a scheme, www., punycode, or a bare domain followed by a path


def clean(text: Any) -> str | None:
    """One paragraph: controls stripped (bidi overrides, zero-width), lines kept, blank runs collapsed, at most TEXT_MAX. None when it
    looks like a link (only the system's own document link may appear in a report)."""
    if not isinstance(text, str):
        return None
    lines = [" ".join(line.split()) for line in strip_controls(text, multiline=True).split("\n")]
    out = "\n".join(line for line in lines if line).strip()[:TEXT_MAX]
    if not out or _URLISH.search(out):
        return None
    return out


def _until(conn: sqlite3.Connection, expires_at: str) -> str:
    from . import messaging

    when = out_documents._parse(expires_at)
    return when.astimezone(messaging.time_zone(conn)).strftime("%d/%m %H:%M") if when else ""


def render(conn: sqlite3.Connection, row: Any, recipient: Recipient, now: dt.datetime) -> tuple[str | None, str | None]:
    """(text, None) or (None, outcome code): report_unavailable (no provider / no body), report_unsafe (link-looking or empty text),
    document_channel (a document on the e-mail channel), document_not_live (the named document cannot be downloaded any more)."""
    provider = PROVIDERS.get(row.source_module or "")
    if provider is None:
        return None, "report_unavailable"
    lang = recipient.lang if recipient.lang in LANGS else DEFAULT_LANG
    try:
        body = provider.body(conn, row, lang)
    except Exception:  # noqa: BLE001 - a provider failure is the module's; the message provably did not leave
        log.warning("report provider failed module=%s", row.source_module)
        return None, "report_unavailable"
    if body is None:
        return None, "report_unavailable"
    text = clean(body.text)
    if text is None:
        return None, "report_unsafe"
    organization = one_line(settings_doc.read(conn).get("organization_name") or "", mt.VALUE_MAX["organization"])
    parts = [organization, text] if organization else [text]
    doc_id = body.document_id or row.document_id
    if doc_id and getattr(row, "channel", None) == "email":
        return None, "document_channel"  # DOCLINKSEC-295 M-01: a provider that names a document at send time is stopped here too
    if doc_id:
        doc = out_documents.row(conn, doc_id)
        if doc is None or doc["recipient_kind"] != "contact" or doc["recipient_id"] != row.contact_id or not out_documents.is_live(conn, doc_id, now):
            return None, "document_not_live"
        try:
            link = out_documents.url(conn, doc)
        except Exception:  # noqa: BLE001 - no public address / the key is gone: the link would open nothing
            return None, "document_not_live"
        parts.append(DOC_LINE[lang].format(until=_until(conn, doc["expires_at"]), link=link))
    message = "\n".join(parts)
    if len(message) > mt.RENDERED_MAX:
        return None, "report_unsafe"
    return message, None


def on_outcome(conn: sqlite3.Connection, row: Any) -> None:
    """The final state reached the module (inside the outbox's transaction). A report that did not leave revokes its document."""
    if row.document_id and row.state in ("not_sent", "refused", "cancelled", "superseded"):
        out_documents.revoke(conn, row.document_id, "send_failed", row.updated_at or dt.datetime.now(dt.timezone.utc))
    provider = PROVIDERS.get(row.source_module or "")
    if provider is None:
        return
    try:
        provider.outcome(conn, row)
    except Exception:  # noqa: BLE001 - the outbox's own state is already final; the module's mirror must not undo it
        log.warning("report outcome hook failed module=%s", row.source_module)


def still_relevant(conn: sqlite3.Connection, row: Any) -> bool:
    provider = PROVIDERS.get(row.source_module or "")
    if provider is None:
        return False
    try:
        return bool(provider.still_relevant(conn, row))
    except Exception:  # noqa: BLE001
        return False


__all__ = ["register", "unregister", "queue", "reach", "email_enabled", "render", "clean", "enabled", "on_outcome", "still_relevant", "ReportBody", "ReportRefused",
           "PROVIDERS", "TEXT_MAX"]
