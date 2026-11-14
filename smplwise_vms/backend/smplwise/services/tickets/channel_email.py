"""CR-038 9.5 / D13 / review R7: the e-mail adapter of the ticket channel - the fallback when WhatsApp cannot carry a message to a
contact that has an e-mail address.

- Reuses the product's SMTP configuration and sender (`notify_email.smtp_send`, verified TLS, one message per session); the CR-018
  administrator recipient list is NOT involved: the message goes to the contact's own address, read from the directory at send time.
- The text is the outbox's rendered template; for a link purpose it carries the REDEEM link `/t/r/<rid>` (the outbox asks
  `Links.redeem_url` for e-mail rows), never the fragment token: corporate mail scanners rewrite and log links (review T3-2).
- Rate: the outbox keeps the module's own 10 e-mails / hour (separate from CR-018's counters).
- Outcome classification (9.4 style, for SMTP): a failure before the message was handed over (DNS, connect, TLS, login, an
  invalid address, too large, not configured) is `not_sent`; a recipient refusal is `refused`; a timeout may have happened during
  the transfer, so it is `unknown` (never retried, never re-routed - the same rule as WhatsApp).
Privacy: the address and the text are never logged and never put into an exception or a result."""
from __future__ import annotations

import html
import logging
from dataclasses import replace
from pathlib import Path
from typing import Any, Callable

from .channel import (NOT_SENT, REACH_NO_ADDRESS, REACH_OK, REACH_OPTED_OUT, REFUSED, RTL_LANGS, SENT, UNKNOWN, ChannelStatus,
                      InboundMessage, OutboundMessage, Recipient, SendResult)

log = logging.getLogger("smplwise.tickets.channel")

NOT_SENT_KINDS = frozenset({"dns", "connect", "tls", "auth", "invalid", "too_large", "unavailable"})


def mail_config(conn: Any, data_dir: Path | None) -> Any | None:
    """The SMTP configuration for a ticket e-mail: host, port and sender are enough (the administrator recipient list of CR-018 is
    not needed here). None when mail is not configured or a login has no stored password."""
    from .. import notify_email, notify_settings

    try:
        e = notify_settings.email_internal(conn)
    except Exception:  # noqa: BLE001 - a missing notification table (an old test database) means "not configured"
        return None
    if not (e.get("host") and e.get("from") and e.get("port")):
        return None
    password = None
    if e.get("user"):
        if data_dir is None:
            return None
        password = notify_settings.read_password(Path(data_dir))
        if password is None or e.get("security") == "none":
            return None
    return notify_email.MailConfig(e["host"], int(e["port"]), e["security"], e["user"], e["from"], tuple(e.get("recipients") or ()), "", password)


def rendered(msg: OutboundMessage) -> Any:
    from ..notify_email import Rendered

    lang = msg.recipient.lang
    direction = "rtl" if lang in RTL_LANGS else "ltr"
    body = "<br>".join(html.escape(line) for line in msg.text.split("\n"))
    page = (f'<!doctype html><html lang="{html.escape(lang)}" dir="{direction}"><body style="font-family:Arial,Helvetica,sans-serif;'
            f'font-size:15px;line-height:1.5;color:#111827;"><div dir="{direction}">{body}</div></body></html>')
    return Rendered(subject=msg.subject or "", text=msg.text, html=page)


class EmailChannel:
    key = "email"

    def __init__(self, config: Callable[[], Any | None], *, sender: Callable[[Any, str, Any], None] | None = None) -> None:
        """`config()` -> MailConfig | None (read when sending); `sender(cfg, to, rendered)` defaults to notify_email.smtp_send
        (tests pass a fake SMTP)."""
        self._config = config
        self._sender = sender

    def status(self, account: Any = None) -> ChannelStatus:
        return ChannelStatus("connected" if self._config() is not None else "not_configured")

    def can_reach(self, recipient: Recipient, account: Any = None) -> str:
        if recipient.opted_out:
            return REACH_OPTED_OUT
        return REACH_OK if recipient.email else REACH_NO_ADDRESS

    def supports_buttons(self) -> bool:
        return False

    def parse_inbound(self, event: dict[str, Any]) -> InboundMessage | None:
        return None  # e-mail replies are not read (release 1)

    def send(self, msg: OutboundMessage) -> SendResult:
        from .. import notify_email

        to = msg.recipient.email or ""
        if not to:
            return SendResult(NOT_SENT, "no_address")
        cfg = self._config()
        if cfg is None:
            return SendResult(NOT_SENT, "email_not_configured")
        send = self._sender or notify_email.smtp_send
        try:
            send(cfg, to, rendered(msg))
            result = SendResult(SENT)
        except notify_email.MailError as exc:
            if exc.kind in NOT_SENT_KINDS:
                result = SendResult(NOT_SENT, f"smtp_{exc.kind}")
            elif exc.kind == "refused":
                result = SendResult(REFUSED, "smtp_refused")
            else:
                result = SendResult(UNKNOWN, f"smtp_{exc.kind}")
        except Exception:  # noqa: BLE001 - anything else after the session started may have delivered it
            result = SendResult(UNKNOWN, "adapter_error")
        log.info("email send outbox=%s outcome=%s code=%s", msg.outbox_id, result.outcome, result.outcome_code)
        return result


def with_subject(msg: OutboundMessage, subject: str) -> OutboundMessage:
    return replace(msg, subject=subject)
