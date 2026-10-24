"""CR-036 WA: the WisKey side of the people screen's message dialog - the ADAPTER CONTRACT Arx needs from the messaging provider, and
the interim realization on the commands WisKey rc.37 already has.

WHAT IS NOT KNOWN (ask W11, private/wiskey-foldin/ARX_ASKS_W1_W10_2026-10-11_HE.md, unanswered): the send command for one person and its
body, whether it takes free text, the consent / opt-out model, delivery receipts, limits and error codes, and whether the service identity
may send at all. So nothing here has run against a real WisKey (live behaviour is NOT_RUN until slice S14); every test drives the fake
(tests/fake_wiskey.py `_whatsapp`, extended by tests/fake_wiskey_messaging.py). The browser never talks to WisKey and never names a
command: it calls the typed Arx routes (routers/access_control_messaging.py), which call the three methods below.

THE CONTRACT (what the Arx side asks of WisKey, in the order the dialog needs it):

| Adapter method | Arx needs to know                                                      | Realization today (rc.37)                                   | Proposed for W11            |
|----------------|-------------------------------------------------------------------------|--------------------------------------------------------------|-----------------------------|
| `status`       | is the messaging service connected; which accounts; its own allowance   | `whatsapp/status` {available, history, accounts[{id,name}]}  | + `quota {limit, used}`     |
| `recipient`    | does the person have a usable number; the person's consent             | `users/get` (the phone) + `whatsapp_consent` when present     | a consent field on the user |
| `send`         | send ONE text to ONE person, once, with nothing in it Arx did not write | `whatsapp/preview` (token) then `whatsapp/send` (the text)    | one send command, text only |

HOW rc.37 SENDS, and the one thing to be careful about: rc.37's `whatsapp/send` takes a one-use `token` that only `whatsapp/preview` issues,
and rc.37's `preview` ALSO returns the message WisKey builds for the renewal flow - which contains the person's PIN (`access_message`:
`user.pin.value`). Arx therefore calls `preview` for the token ONLY: the reply's `message`, `recipient` (the phone number) and `warnings`
are never read, kept, logged or forwarded - the text that goes out is the one Arx rendered from its own template (or the sender typed),
passed to `send` as `message`. W11 must give Arx a send that needs no preview (and so never puts a PIN into the add-on's memory).

WHAT EACH WisKey ANSWER MEANS (`classify`): `outcome` is what is KNOWN about the message -
`sent` (WisKey accepted it: `{accepted: true}`; NEVER "delivered" - there is no receipt),
`not_sent` (it provably never left: the session was not ready, no free slot or token, the service not connected, a rate refusal, an
expired token, the person gone - the record of the attempt is removed again),
`refused` (the SEND answered with a refusal about this message or number: `whatsapp_invalid_phone`, `invalid_fields` ... - the record stays,
"not sent"), `unknown` (handed on and no usable answer: a timeout, a dropped session, `whatsapp_send_uncertain`, any code the table below does
not prove to come BEFORE the provider call). An unknown outcome is never retried by Arx.
"""
from __future__ import annotations

import logging
import re
import threading
import time
from dataclasses import dataclass
from datetime import timedelta
from typing import Any

from ..config import Settings
from . import intercom_adapter, intercom_client, intercom_sync, wa_pacing
from .intercom_client import IntercomError, UnclearAnswer
from .intercom_messaging import utc

log = logging.getLogger("smplwise.intercom")

DOMAIN = intercom_client.DOMAIN
API_CONTRACT = intercom_client.API_CONTRACT
COMMANDS = ("whatsapp/status", "whatsapp/preview", "whatsapp/send")
LANGUAGE = "he"  # `preview` requires a language; the text it would build is never used
PACING_MAX_AGE_S = 300.0  # CR-WA-PACING-295: WisKey's counters older than this are unknown, not "still true"
PACING_CHANNEL = "pacing"  # PACING12-295: the guard `whatsapp/pacing_status_v1` goes through (wiskey_channels.PACING)
STATUS_ACCOUNTS_MAX = 10  # the WhatsApp accounts the dialog lists; a longer list is reported truncated, never cut silently
STATUS_TTL_S = 20.0  # the service's state is person-free and principal-independent: cached briefly (a dialog opens often)
SEND_WITHIN_S = 15.0  # a send that reaches the feed's loop later than this is not sent (`expired`)
TOKEN = re.compile(r"^\S{8,512}$")
TEMPLATE_SEND_SUPPORTED = False  # WA-CONSENT-LINK: rc.37 has no WhatsApp-template send; the configured template name is not forwarded (W11)

# A refusal of `whatsapp/send` that provably comes BEFORE the provider call (rc.37 whatsapp_api.py: the handler checks `confirmed` /
# the text / the token first, then calls the provider, whose every exception it turns into `whatsapp_send_uncertain`). Everything else
# - including that code and any code this list does not know - may come after the message left, so it is `unknown`.
SEND_REFUSED = frozenset({
    "invalid_fields", "whatsapp_unavailable", "whatsapp_invalid_phone", "whatsapp_preview_expired", "user_not_found",
    "unauthorized", "rate_limited", "api_incompatible", "request_too_large", "unknown_command",
    # CR-WA-PACING-295 (WisKey's reply 2026-10-21): the provider provably did not accept the message
    "pair_rate_limited", "pacing_expired",
})
# CR-WA-PACING-295: WisKey says the send may have left. Never a refusal, never sent again by Arx.
UNCERTAIN_CODES = frozenset({"whatsapp_send_uncertain", "status_unknown"})


@dataclass(frozen=True)
class SendResult:
    """What is known about one message once the attempt is over. `outcome`: sent | not_sent | refused | unknown. `code` is Arx's word
    for it (busy / rate_limited / expired / service_unavailable / person_not_found / not_registered / refused / uncertain; None when
    sent); `wiskey_code` is WisKey's own, for the audit row and an administrator; `scope` says what a rate refusal was (`burst`: wait
    `retry_after_s` and it passes)."""

    outcome: str
    code: str | None = None
    wiskey_code: str | None = None
    retry_after_s: int | None = None
    scope: str | None = None


# ---------------------------------------------------------------- projections (closed: only what Arx uses is kept)

def _int(v: Any) -> int | None:
    return v if isinstance(v, int) and not isinstance(v, bool) and v >= 0 else None


def project_status(raw: Any) -> dict[str, Any]:
    """`whatsapp/status`: whether the service is connected, the accounts (id and name only), and - when WisKey reports one - its own
    allowance. Unknown keys are dropped; an answer that is not an object is WisKey's error."""
    if not isinstance(raw, dict):
        raise ValueError("unexpected whatsapp/status answer")
    accounts = []
    for a in raw.get("accounts") if isinstance(raw.get("accounts"), list) else []:
        if isinstance(a, dict) and isinstance(a.get("id"), str) and 0 < len(a["id"]) <= 128:
            accounts.append({"id": a["id"], "name": a["name"][:80] if isinstance(a.get("name"), str) else a["id"]})
    quota = raw.get("quota")
    limit, used = (_int(quota.get("limit")), _int(quota.get("used"))) if isinstance(quota, dict) else (None, None)
    # PACING12-295: the list is capped at STATUS_ACCOUNTS_MAX, never silently - `accounts_total` / `accounts_truncated` say so. The pacing
    # counters are NOT read from this answer any more: they come only from the explicitly chosen `whatsapp/pacing_status_v1` route.
    return {"available": raw.get("available") is True and bool(accounts), "accounts": accounts[:STATUS_ACCOUNTS_MAX],
            "accounts_total": len(accounts), "accounts_truncated": len(accounts) > STATUS_ACCOUNTS_MAX,
            "quota": {"limit": limit, "used": used} if limit is not None and used is not None else None}


def _closed_or_none(api: dict[str, Any] | None) -> tuple[str | None, str | None]:
    """PACING12-295 discovery: (route, closed reason) from WisKey's `api` facts. A contract newer than this add-on is `api_incompatible`;
    otherwise the explicit choice of `wa_pacing.choose_pacing_route` (only `whatsapp/pacing_status_v1`, never `whatsapp/status`)."""
    if api is None:
        return None, "discovery_unknown"
    min_client = api.get("min_client")
    if isinstance(min_client, int) and not isinstance(min_client, bool) and min_client > API_CONTRACT:
        return None, "api_incompatible"
    return wa_pacing.choose_pacing_route(api.get("commands"))


def project_recipient(raw: Any) -> dict[str, Any]:
    """`users/get` for the message dialog: the closed person projection of the people screen (id, name, stations, phone ...) plus the
    consent WisKey keeps, when it keeps one (the PROPOSED `whatsapp_consent`; rc.37 has none, so `unknown`)."""
    person = intercom_adapter.project_one_person(raw)
    consent = raw.get("whatsapp_consent") if isinstance(raw, dict) else None
    return {"person": person, "wiskey_consent": consent if consent in ("granted", "declined") else "unknown"}


# ---------------------------------------------------------------- the two WisKey exchanges

def _code(frame: Any) -> str:
    error = frame.get("error") if isinstance(frame, dict) and isinstance(frame.get("error"), dict) else {}
    return str(error.get("code") or "action_failed")


async def _status_exchange(call: intercom_client.Call) -> Any:
    frame = await call(f"{DOMAIN}/whatsapp/status", api_contract=API_CONTRACT)
    if not isinstance(frame, dict) or frame.get("success") is not True:
        raise IntercomError(_code(frame), "whatsapp/status")
    return frame.get("result")


async def _pacing_exchange(call: intercom_client.Call) -> Any:
    """PACING12-295: the one pacing read, on the explicitly chosen route (sent only after discovery listed it)."""
    frame = await call(f"{DOMAIN}/{wa_pacing.PACING_ROUTE}", api_contract=API_CONTRACT)
    if not isinstance(frame, dict) or frame.get("success") is not True:
        raise IntercomError(_code(frame), wa_pacing.PACING_ROUTE)
    return frame.get("result")


def _token_of(frame: Any) -> str:
    """The one-use token of a `preview` answer - and nothing else of it. A failed preview sent nothing: IntercomError (a refusal)."""
    if not isinstance(frame, dict) or frame.get("success") is not True:
        raise IntercomError(_code(frame), "whatsapp/preview")
    result = frame.get("result")
    token = result.get("token") if isinstance(result, dict) else None
    if not (isinstance(token, str) and TOKEN.match(token)):
        raise IntercomError("invalid_response", "whatsapp/preview")
    return token


def _accepted(frame: Any) -> dict[str, Any]:
    """`whatsapp/send`'s answer. `{accepted: true}` is the only success. A failure is a refusal only when its code is one that provably
    comes before the provider call (SEND_REFUSED); anything else - and a success of another shape - is UnclearAnswer: unknown."""
    if isinstance(frame, dict) and frame.get("success") is True:
        result = frame.get("result")
        if isinstance(result, dict) and result.get("accepted") is True:
            return {"accepted": True}
        raise UnclearAnswer("whatsapp/send", "invalid_response")
    if isinstance(frame, dict) and frame.get("success") is False:
        code = _code(frame)
        if code in SEND_REFUSED:
            raise IntercomError(code, "whatsapp/send")
        raise UnclearAnswer("whatsapp/send", code)
    raise UnclearAnswer("whatsapp/send", "invalid_response")


async def _preview_and_send(call: intercom_client.Call, account: str, user_id: str, text: str, trace: dict[str, str]) -> dict[str, Any]:
    """Both commands in ONE coroutine: one slot, one rate token, the same session. `trace["phase"]` says how far it got (a failure in
    the preview phase sent nothing, whatever the code)."""
    trace["phase"] = "preview"
    preview = await call(f"{DOMAIN}/whatsapp/preview", user_id=user_id, account=account, language=LANGUAGE, api_contract=API_CONTRACT)
    token = _token_of(preview)
    del preview  # nothing else of it is read: WisKey's own message text carries the person's PIN
    trace["phase"] = "send"
    frame = await call(f"{DOMAIN}/whatsapp/send", user_id=user_id, account=account, token=token, message=text, confirmed=True, api_contract=API_CONTRACT)
    return _accepted(frame)


# ---------------------------------------------------------------- what an answer means

# the burst refusals: WisKey's AdminLimiter / Arx's own message lane bucket - wait a moment and it passes
BURST_RETRY_S = 5
PAIR_RETRY_S = 300
NOT_SENT_WISKEY = {
    "rate_limited": "rate_limited", "busy": "busy", "expired": "expired", "whatsapp_unavailable": "service_unavailable",
    "pair_rate_limited": "pair_rate_limited", "pacing_expired": "pacing_expired",
    "whatsapp_preview_expired": "expired", "user_not_found": "person_not_found",
    "unauthorized": "service_unavailable", "unknown_command": "service_unavailable", "api_incompatible": "service_unavailable",
}


def classify(reply: dict[str, Any], outcome: str, phase: str) -> SendResult:
    """The feed's `(reply, outcome)` of one send -> what is known (see the module note). `phase` is how far the exchange got."""
    code = str(reply.get("last_error") or "")
    state = str(reply.get("state") or "")
    if outcome == "ok":
        return SendResult("sent")
    if outcome == "unknown" or code in UNCERTAIN_CODES:
        return SendResult("unknown", "uncertain", code or state or "unknown")
    if outcome == "not_sent":  # the feed refused or never scheduled it: nothing reached WisKey
        return _not_sent(NOT_SENT_WISKEY.get(code, "service_unavailable"), code or state)
    # refused: WisKey answered with a pre-effect refusal. Only a refusal of the SEND about this message or number is kept as a record
    # ("not sent"); everything else - the preview phase, the service, a rate, a token - provably sent nothing and leaves no record.
    if phase == "send" and code not in NOT_SENT_WISKEY:
        return SendResult("refused", "not_registered" if code == "whatsapp_invalid_phone" else "refused", code or state)
    word = NOT_SENT_WISKEY.get(code) or ("not_registered" if code == "whatsapp_invalid_phone" else "service_unavailable")
    return _not_sent(word, code or state)


def _not_sent(word: str, wiskey_code: str) -> SendResult:
    if word in ("rate_limited", "busy"):
        return SendResult("not_sent", "rate_limited", wiskey_code, BURST_RETRY_S, "burst")
    if word == "pair_rate_limited":  # the provider slowed this one recipient: not a burst, wait a while
        return SendResult("not_sent", word, wiskey_code, PAIR_RETRY_S, "pair")
    return SendResult("not_sent", word, wiskey_code)


# ---------------------------------------------------------------- the adapter

def commands_listed(settings: Settings) -> tuple[bool | None, str | None]:
    """(available, reason) from the commands WisKey lists for the add-on's user (`api.commands`); None while there is no copy yet."""
    api = intercom_sync.SYNC.api_facts(settings)
    if api is None:
        return None, None
    min_client = api.get("min_client")
    if min_client is not None and min_client > API_CONTRACT:
        return False, "api_incompatible"
    commands = api.get("commands")
    if commands is None:
        return False, "commands_unknown"
    if not all(c in commands for c in COMMANDS):
        return False, "not_listed"
    return True, None


class MessagingAdapter:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._status: dict[str, Any] | None = None
        self._status_key: tuple[Any, ...] | None = None
        self._status_at = 0.0
        self._pacing: dict[str, Any] = wa_pacing.closed_envelope("not_read")  # the projected pacing envelope of the last read
        self._pacing_at: float | None = None

    def forget(self) -> None:
        with self._lock:
            self._status = None

    @staticmethod
    def _session_key() -> tuple[Any, ...]:
        s = intercom_sync.STATE
        return (s.started_at, s.reconnects, s.wiskey_version)

    def status(self, settings: Settings, who: str) -> dict[str, Any]:
        """The messaging service as WisKey reports it: `{state, available, accounts, quota, last_error}`. `available` is True only when
        WisKey lists the three commands, the feed is ready and the service answered "connected" with at least one account; None when
        it could not be asked (the feed is not ready, WisKey is busy) - the caller says "not connected" for both. Cached
        STATUS_TTL_S seconds per session."""
        listed, why = commands_listed(settings)
        if listed is False:
            return {"state": "unsupported", "available": False, "accounts": [], "quota": None, "last_error": why}
        key = self._session_key()
        with self._lock:
            if self._status is not None and self._status_key == key and time.monotonic() - self._status_at < STATUS_TTL_S:
                return dict(self._status)
        reply = intercom_sync.SYNC.command(settings, "whatsapp", _status_exchange, project_status, who=who, channel="messaging")
        got = reply.get("whatsapp")
        if reply.get("state") != "ready" or not isinstance(got, dict):
            return {"state": str(reply.get("state") or "error"), "available": None, "accounts": [], "quota": None, "last_error": reply.get("last_error")}
        out = {"state": "ready", "available": got["available"], "accounts": got["accounts"], "accounts_total": got["accounts_total"],
               "accounts_truncated": got["accounts_truncated"], "quota": got["quota"], "last_error": None}
        with self._lock:
            self._status, self._status_key, self._status_at = dict(out), key, time.monotonic()
        self.refresh_pacing(settings, who)
        return out

    def _keep_pacing(self, envelope: dict[str, Any]) -> None:
        with self._lock:
            self._pacing, self._pacing_at = envelope, time.monotonic()

    def refresh_pacing(self, settings: Settings, who: str) -> str | None:
        """PACING12-295: read WisKey's pacing envelope. Discovery first (WisKey's `api.commands`); then ONLY the explicitly chosen route
        `whatsapp/pacing_status_v1`. A discovery that does not list it, an incompatible contract, or a failed read FAILS CLOSED: the kept
        envelope is closed with that reason (every sender unknown, never zero) and no other endpoint is tried - never `whatsapp/status`.
        Returns the closed reason, None when the read is usable."""
        route, why = _closed_or_none(intercom_sync.SYNC.api_facts(settings))
        if route is None:
            self._keep_pacing(wa_pacing.closed_envelope(why or "discovery_unknown"))
            return why
        try:
            reply = intercom_sync.SYNC.command(settings, "pacing", _pacing_exchange, wa_pacing.project_pacing_envelope, who=who, channel=PACING_CHANNEL)
        except Exception:  # noqa: BLE001 - a request-level refusal of the pacing read must not break the status read: unknown
            log.debug("intercom messaging: the pacing read was refused")
            reply = {}
        got = reply.get("pacing")
        if reply.get("state") != "ready" or not isinstance(got, dict):
            # WisKey's producer refused the request as too large (`request_too_large`): its own closed reason, not the generic one
            got = wa_pacing.closed_envelope("producer_over_limit" if reply.get("last_error") == "request_too_large" else "route_error")
        self._keep_pacing(got)
        return got.get("closed_reason")

    def cached_pacing(self) -> "wa_pacing.WiskeyPacing":
        """WisKey's pacing envelope as of the last read, without asking WisKey (the outbox worker must never wait on it). Older than
        PACING_MAX_AGE_S (`stale`), never read (`not_read`) or closed: no sender = UNKNOWN to the budget, with the reason."""
        with self._lock:
            if self._pacing_at is None:
                return wa_pacing.WiskeyPacing(closed_reason="not_read")
            if time.monotonic() - self._pacing_at >= PACING_MAX_AGE_S:
                return wa_pacing.WiskeyPacing(closed_reason="stale")
            envelope = dict(self._pacing)
        return wa_pacing.parse_wiskey_status(envelope)

    @staticmethod
    def account_for(status: dict[str, Any], configured: str) -> tuple[str | None, str | None]:
        """(account id, problem). The administrator's choice when it is one of WisKey's accounts; with none chosen the only account;
        several accounts and no choice is a problem (`account_required`) - a message must never leave from a number nobody picked. A
        configured account that is not in a TRUNCATED list is `account_not_covered` (unknown), not `account_missing`."""
        accounts = [a["id"] for a in status.get("accounts") or []]
        if configured:
            if configured in accounts:
                return configured, None
            return None, ("account_not_covered" if status.get("accounts_truncated") is True else "account_missing")
        if len(accounts) == 1:
            return accounts[0], None
        return (None, "account_required") if accounts else (None, "no_account")

    def recipient(self, settings: Settings, who: str, person_id: str) -> dict[str, Any]:
        """One person for the dialog (a superset: the caller's own filter decides what of it they see): `{state, ..., recipient:
        {person, wiskey_consent}}`. A person WisKey does not know is ApiError 404 `intercom_person_not_found` (from the feed)."""
        return intercom_sync.SYNC.command(settings, "recipient", lambda call: intercom_adapter.users_get(call, person_id), project_recipient, who=who, channel="read")

    def send(self, settings: Settings, who: str, person_id: str, account: str, text: str, *, wa_template: dict[str, Any] | None = None) -> SendResult:
        """Hand ONE text to WisKey for ONE person. Never retried, never queued; the text is passed on and not kept.

        `wa_template` (WA-CONSENT-LINK): the WhatsApp Business template a FIRST contact outside the 24-hour window must use - `{name,
        language, params}` as the administrator configured it (approval by Meta is the owner's action). PART OF THE CONTRACT, NOT YET
        FORWARDED: rc.37's `whatsapp/send` takes a text only (ask W11: a template send). Until WisKey has one, the text goes out as today and
        WhatsApp itself decides whether a business-initiated text reaches a person outside the window (TEMPLATE_SEND_SUPPORTED)."""
        del wa_template  # rc.37: no template send (see TEMPLATE_SEND_SUPPORTED)
        trace = {"phase": "preview"}
        reply, outcome = intercom_sync.SYNC.message_send(
            settings, "message", lambda call: _preview_and_send(call, account, person_id, text, trace), lambda _raw: {"accepted": True}, who,
            not_after=utc() + timedelta(seconds=SEND_WITHIN_S),
        )
        result = classify(reply, outcome, trace["phase"])
        if result.code == "service_unavailable":
            self.forget()  # the next dialog asks again
        return result

    def send_template(self, sender: Any, **kw: Any) -> SendResult:
        """CR-W11TPL-295: a template send through `wa_template_send.TemplateSender` (injected, so a test hands it a fake transport).
        Everything is gated there by the switch AND TEMPLATE_SEND_SUPPORTED (False): nothing reaches WisKey today. No route calls this yet."""
        return sender.send(**kw).as_send_result()


MESSAGING = MessagingAdapter()
