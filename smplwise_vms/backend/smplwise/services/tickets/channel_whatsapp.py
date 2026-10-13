"""CR-038 9.3 / 9.4: the WhatsApp (`ha-whatsapp`, FaserF) adapter of the ticket channel.

Calls ONLY `whatsapp.send_message` and (when `use_buttons` is on) `whatsapp.send_buttons` - a hard-coded allow-list; nothing else
in the `whatsapp` domain is ever called (no webhook configuration, no images, no groups, no auto responder).
`data = {"account": <entry id | typed value>, "target": <digits>, "message": <text>}`; `account` is ALWAYS sent, even with one
paired number, so a second number never turns sends into "Multiple WhatsApp accounts found" errors. Buttons are OFF by default
(`[WA-DOC]`: multi-device clients may show text only); the default texts ask for a numbered reply ("1 = received, 2 = in progress").

Outcome classification (9.4) lives HERE, not in `ha_client.call_service` (which turns every transport exception into one 503 -
review C6). The transport below makes the one split that matters: a connect failure provably sent nothing (`not_sent`); a failure
after the request was written may have reached HA (`unknown`, never retried, never re-routed).

| What happened | outcome | outcome_code |
|---|---|---|
| no Supervisor token / HA URL | not_sent | ha_not_configured |
| connect error / connect or pool timeout | not_sent | ha_unavailable |
| read / write timeout, dropped connection, protocol error after the request started | unknown | timeout |
| 400 naming the account ("account ... not found" / "Multiple WhatsApp accounts", ServiceValidationError [WA-SRC]) | not_sent | account_not_found |
| 400 "does not support responses" (an `ha-whatsapp` version without return values) | not_sent | response_unsupported (the adapter stops asking for responses; the outbox retry sends again) |
| 400 other | not_sent | bad_request |
| 401 / 403 | not_sent | ha_forbidden |
| 404 | not_sent | service_not_found |
| 408, any 3xx, any 5xx | unknown | ha_error (HA may have called the integration) |
| other 4xx | not_sent | ha_rejected |
| 2xx with a body that is not JSON | unknown | malformed |
| 2xx with `success: false` in the service response | refused | provider_refused |
| 2xx otherwise | sent | - (`message_id` kept when present: UNVERIFIED shape over REST) |

How HA reports a ServiceValidationError over REST (status and body) is UNVERIFIED (9.9.5): the fake follows HA core's documented
behaviour (400); both readings end `not_sent`, only the `missing` mark of the account differs.

Privacy: the request body (number, text) and HA's response body are never logged and never put into an exception or a result.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Any, Callable, Protocol

import httpx

from .channel import (CONNECTED, NOT_SENT, REACH_CHANNEL_DOWN, REACH_NO_ADDRESS, REACH_OK, REACH_OPTED_OUT, REFUSED, SENT,
                      UNKNOWN, AccountRef, ChannelStatus, InboundMessage, OutboundMessage, Recipient, SendResult, phone_digits)

log = logging.getLogger("smplwise.tickets.channel")

DOMAIN = "whatsapp"
ALLOWED_SERVICES = ("send_message", "send_buttons")
TIMEOUT_S = 15.0
_ACCOUNT_ERROR = re.compile(r"(?is)account\b.{0,120}\bnot found|multiple whatsapp accounts")
_NO_RESPONSE = re.compile(r"(?i)does not support responses|return_response")
_MESSAGE_ID = re.compile(r"^[A-Za-z0-9_\-:.@]{1,128}$")


@dataclass(frozen=True)
class TransportReply:
    kind: str  # response | connect_error | transfer_error | not_configured
    status: int | None = None
    body: Any = field(default=None, repr=False)  # parsed JSON (None when absent or not JSON)
    json_ok: bool = True
    body_text: str = field(default="", repr=False)  # the first 500 characters, for the 400 classification only


class ServiceTransport(Protocol):
    def call(self, domain: str, service: str, data: dict[str, Any], *, return_response: bool, timeout: float) -> TransportReply: ...


class HaServiceTransport:
    """POST /api/services/<domain>/<service>[?return_response] on HA Core with the Supervisor token - the request of
    `ha_client.call_service` with the connect-vs-transfer exception split (spec name: `call_service_classified`; kept inside the
    adapter so this slice edits no shared file). `client_factory` is for tests (an httpx.MockTransport); no live HA is used."""

    def __init__(self, settings: Any, client_factory: Callable[[float], httpx.Client] | None = None) -> None:
        self._settings = settings
        self._factory = client_factory or (lambda timeout: httpx.Client(timeout=timeout))

    def call(self, domain: str, service: str, data: dict[str, Any], *, return_response: bool, timeout: float) -> TransportReply:
        from .. import ha_client  # the module's private URL / header helpers: one source of truth for the HA address

        if not ha_client.configured(self._settings):
            return TransportReply("not_configured")
        url = ha_client._rest_base(self._settings) + f"/services/{domain}/{service}" + ("?return_response" if return_response else "")
        try:
            with self._factory(timeout) as client:
                r = client.post(url, headers=ha_client._headers(self._settings), json=data)
        except (httpx.ConnectError, httpx.ConnectTimeout, httpx.PoolTimeout, httpx.UnsupportedProtocol, httpx.InvalidURL):
            return TransportReply("connect_error")
        except httpx.HTTPError:  # read / write timeout, dropped connection, protocol error: the request may have arrived
            return TransportReply("transfer_error")
        try:
            body, ok = r.json(), True
        except ValueError:
            body, ok = None, False
        return TransportReply("response", r.status_code, body, ok, r.text[:500] if r.status_code == 400 else "")


def classify(reply: TransportReply) -> SendResult:
    """9.4 - see the table in the module note."""
    if reply.kind == "not_configured":
        return SendResult(NOT_SENT, "ha_not_configured")
    if reply.kind == "connect_error":
        return SendResult(NOT_SENT, "ha_unavailable")
    if reply.kind != "response" or reply.status is None:
        return SendResult(UNKNOWN, "timeout")
    status = reply.status
    if 200 <= status < 300:
        if not reply.json_ok:
            return SendResult(UNKNOWN, "malformed")
        body = reply.body
        response = body.get("service_response", body) if isinstance(body, dict) else None
        if isinstance(response, dict) and response.get("success") is False:
            return SendResult(REFUSED, "provider_refused")
        mid = response.get("message_id") if isinstance(response, dict) else None
        return SendResult(SENT, None, mid if isinstance(mid, str) and _MESSAGE_ID.match(mid) else None)
    if status == 400:
        text = reply.body_text or ""
        if isinstance(reply.body, dict) and isinstance(reply.body.get("message"), str):
            text = f"{text} {reply.body['message']}"
        if _ACCOUNT_ERROR.search(text):
            return SendResult(NOT_SENT, "account_not_found")
        if _NO_RESPONSE.search(text):
            return SendResult(NOT_SENT, "response_unsupported")
        return SendResult(NOT_SENT, "bad_request")
    if status in (401, 403):
        return SendResult(NOT_SENT, "ha_forbidden")
    if status == 404:
        return SendResult(NOT_SENT, "service_not_found")
    if status == 408 or status < 400 or status >= 500:
        return SendResult(UNKNOWN, "ha_error")
    return SendResult(NOT_SENT, "ha_rejected")


def outcome_from_api_error(exc: Any) -> SendResult:
    """For a path that still goes through `ha_client.call_service` (which raises ApiError): its codes cannot tell a connect error
    from a read timeout (`ha_unavailable` covers both), so that one is `unknown`. Never used by the adapter itself."""
    code = getattr(exc, "code", None)
    if code in ("ha_not_configured", "service_not_found", "ha_forbidden"):
        return SendResult(NOT_SENT, code)
    return SendResult(UNKNOWN, code if code in ("ha_unavailable", "ha_error") else "ha_error")


class AccountStates(Protocol):
    def status(self, key: str) -> Any: ...  # messaging_accounts.AccountStatus (state, source, sendable)


class WhatsAppChannel:
    key = "whatsapp"

    def __init__(self, transport: ServiceTransport, accounts: AccountStates, *, use_buttons: Callable[[], bool] = lambda: False,
                 timeout: float = TIMEOUT_S) -> None:
        self._transport = transport
        self._accounts = accounts
        self._use_buttons = use_buttons
        self._timeout = timeout
        self._no_response: set[str] = set()  # services that refused `return_response` once

    # -- TicketChannel
    def status(self, account: AccountRef | None = None) -> ChannelStatus:
        if account is None or not account.value:
            return ChannelStatus("not_configured")
        st = self._accounts.status(account.key)
        return ChannelStatus(st.state, detail_for_admin=f"source={st.source}")

    def can_reach(self, recipient: Recipient, account: AccountRef | None = None) -> str:
        if recipient.opted_out:
            return REACH_OPTED_OUT
        if phone_digits(recipient.phone or "") is None:
            return REACH_NO_ADDRESS
        if account is None or not account.value or not self._accounts.status(account.key).sendable:
            return REACH_CHANNEL_DOWN
        return REACH_OK

    def supports_buttons(self) -> bool:
        return bool(self._use_buttons())

    def parse_inbound(self, event: dict[str, Any]) -> InboundMessage | None:
        from .inbound import normalise

        return normalise(event)

    def build_call(self, msg: OutboundMessage) -> tuple[str, dict[str, Any]]:
        """(service, data) of one send. Raises ValueError (no value in the message) when the message cannot be sent at all."""
        if msg.account is None or not msg.account.value:
            raise ValueError("account_unmapped")
        target = phone_digits(msg.recipient.phone or "")
        if target is None:
            raise ValueError("no_phone")
        if not msg.text.strip():
            raise ValueError("empty")
        data: dict[str, Any] = {"account": msg.account.value, "target": target, "message": msg.text}
        if msg.buttons and self.supports_buttons():
            data["buttons"] = [{"id": b.id, "displayText": b.text} for b in msg.buttons]
            if msg.footer:
                data["footer"] = msg.footer
            return "send_buttons", data
        return "send_message", data

    def send(self, msg: OutboundMessage) -> SendResult:
        try:
            service, data = self.build_call(msg)
        except ValueError as exc:
            result = SendResult(NOT_SENT, str(exc))
            log.info("whatsapp send outbox=%s outcome=%s code=%s", msg.outbox_id, result.outcome, result.outcome_code)
            return result
        assert service in ALLOWED_SERVICES
        try:
            reply = self._transport.call(DOMAIN, service, data, return_response=service not in self._no_response, timeout=self._timeout)
            result = classify(reply)
        except Exception:  # noqa: BLE001 - an unexpected failure after the call started: it may have left
            result = SendResult(UNKNOWN, "adapter_error")
        if result.outcome_code == "response_unsupported":
            self._no_response.add(service)
        log.info("whatsapp send outbox=%s service=%s account=%s outcome=%s code=%s", msg.outbox_id, service,
                 msg.account.key if msg.account else None, result.outcome, result.outcome_code)
        return result

    def account_connected(self, account: AccountRef | None) -> bool:
        return account is not None and self._accounts.status(account.key).state == CONNECTED
