"""CR-W11TPL-295 (docs/changes/CR-W11TPL-295.md): the Arx side of a WhatsApp TEMPLATE send outside the 24-hour customer-service window
(WisKey item W11). OFF by default, FAKES ONLY, nothing here can send a real message.

WHAT IS BUILT (all pure or injectable; no route, no screen):
- a REGISTRY of template REFERENCES (`messaging.wa_templates`): Arx never holds a template body - Meta owns it - only a reference
  `{id, name, language, params[], purpose}`: the Meta name, its language and the ordered list of parameter SLOTS Arx fills
  (`name | organization | link | days`, the order of the template's {{1}}..{{n}}). `purpose` is `consent_request` or `notice`.
- the SWITCH `messaging.template_send` `{enabled}` (default OFF) AND the permit `intercom_messaging_adapter.TEMPLATE_SEND_SUPPORTED`
  (stays False): both must hold, else `not_sent / template_unsupported` and nothing is handed to any transport.
- ADMISSION, in this order, each refusal provably sending nothing: switch + permit; the reference exists and its parameters are exactly
  the slots it declares; consent (declined: never; unknown: only a `consent_request`, and only a `notice` while `consent_by_link` is
  off - the people screen's existing rule); the hours/budget (`wa_pacing`, class `ticket` = the normal class of every people-screen
  message; there is no separate template class and no second ledger - the attempt row in `intercom_messages` is what the budget
  already counts as WisKey-bound load, so a template send is counted once); the window (see below).
- the REQUEST to the transport (`TemplateRequest`) and the ANSWER states: `accepted` -> sent, `not_sent` (only with a code that
  provably comes before the provider call), `unknown` (anything else: a timeout, a malformed answer, a code not proven pre-send). An
  unknown outcome is NEVER retried by Arx.
- the TRANSPORT is a Protocol. The only implementations here are `UnwiredTransport` (what production gets: it refuses, nothing left)
  and `FakeTemplateTransport` (tests). THE WISKEY WIRE FORMAT IS NOT INVENTED: no WisKey document in private/planning defines a
  template command, its fields, its codes or a window probe; the shape below is Arx's PROPOSAL (`wa_template_send_proposal.v0`) and the
  open questions are in the change record.
- the 24-hour WINDOW is a Protocol (`WindowProbe`): Arx has no inbound messages, so it cannot know the window; `unknown` is treated
  as closed (a template is what Meta accepts either way) and only an explicit `open` lets a caller prefer free text.

Audit and logs carry ids, codes and counts only - never a number, a parameter value, the link or a name."""
from __future__ import annotations

import datetime as dt
import json
import logging
import re
import sqlite3
from dataclasses import dataclass, field
from typing import Any, Callable, Mapping, Protocol

from . import wa_pacing

log = logging.getLogger("smplwise.intercom")

SWITCH_KEY = "messaging.template_send"
REGISTRY_KEY = "messaging.wa_templates"
PROPOSAL = "wa_template_send_proposal.v0"
REGISTRY_MAX = 20
SLOTS = ("name", "organization", "link", "days")
PURPOSES = ("consent_request", "notice")
PARAM_MAX = 1024  # a filled slot (Meta's own limit is the template's; Arx never sends more than this)
NAME_RE = re.compile(r"^[a-z0-9_]{1,128}$")  # same as intercom_messaging.WA_TEMPLATE_NAME
LANG_RE = re.compile(r"^[a-z]{2,3}(?:_[A-Z]{2})?$")  # same as intercom_messaging.WA_TEMPLATE_LANG
ID_RE = re.compile(r"^[a-z0-9][a-z0-9_]{0,31}$")
WIRE_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.:@-]{0,127}$")  # person id / account / request id as they travel: no spaces, no control characters
KLASS = wa_pacing.CLASS_TICKET  # "a normal class": the people-screen messages' class, no special one

# a failure that provably comes BEFORE the provider call (proposal: WisKey must confirm each one - open question 4)
PRE_SEND_CODES = frozenset({
    "template_unsupported", "template_not_found", "template_not_approved", "template_params_mismatch", "invalid_fields",
    "whatsapp_unavailable", "whatsapp_invalid_phone", "user_not_found", "unauthorized", "api_incompatible", "unknown_command",
    "rate_limited", "pair_rate_limited", "pacing_expired", "window_open",
})
OUTCOMES = ("sent", "not_sent", "unknown")


# ---------------------------------------------------------------- the registry and the switch

@dataclass(frozen=True)
class TemplateRef:
    id: str
    name: str
    language: str
    params: tuple[str, ...]
    purpose: str


def parse_ref(raw: Any) -> TemplateRef | None:
    """One stored reference, or None when it fails any rule (a bad entry is dropped, never repaired)."""
    if not isinstance(raw, dict):
        return None
    rid, name, lang, params, purpose = raw.get("id"), raw.get("name"), raw.get("language"), raw.get("params"), raw.get("purpose")
    if not (isinstance(rid, str) and ID_RE.fullmatch(rid) and isinstance(name, str) and NAME_RE.fullmatch(name)
            and isinstance(lang, str) and LANG_RE.fullmatch(lang) and purpose in PURPOSES):
        return None
    if not (isinstance(params, list) and len(params) <= 8 and all(p in SLOTS for p in params)):
        return None
    return TemplateRef(rid, name, lang, tuple(params), str(purpose))


def validate_registry(raw: Any) -> tuple[list[TemplateRef], list[dict[str, str]]]:
    """(references, problems `{path, code}`) of an administrator's list. Ids and (name, language) pairs are unique."""
    if not isinstance(raw, list):
        return [], [{"path": "templates", "code": "not_a_list"}]
    problems: list[dict[str, str]] = []
    if len(raw) > REGISTRY_MAX:
        problems.append({"path": "templates", "code": "too_many"})
    out: list[TemplateRef] = []
    for i, item in enumerate(raw[:REGISTRY_MAX]):
        ref = parse_ref(item)
        if ref is None:
            problems.append({"path": f"templates.{i}", "code": "invalid"})
        elif any(r.id == ref.id for r in out) or any((r.name, r.language) == (ref.name, ref.language) for r in out):
            problems.append({"path": f"templates.{i}", "code": "duplicate"})
        else:
            out.append(ref)
    return out, problems


def load_registry(conn: sqlite3.Connection) -> list[TemplateRef]:
    row = conn.execute("SELECT value FROM settings WHERE key = ?", (REGISTRY_KEY,)).fetchone()
    try:
        raw = json.loads(row[0]) if row else []
    except (TypeError, ValueError):
        return []
    refs, problems = validate_registry(raw)
    return [] if problems else refs  # fail closed: a registry with any bad entry reads as empty


def store_registry(conn: sqlite3.Connection, refs: list[TemplateRef]) -> None:
    doc = [{"id": r.id, "name": r.name, "language": r.language, "params": list(r.params), "purpose": r.purpose} for r in refs]
    conn.execute("INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                 (REGISTRY_KEY, json.dumps(doc, separators=(",", ":"))))


def switch_on(conn: sqlite3.Connection) -> bool:
    """The administrator's switch. Default OFF; anything unreadable is OFF."""
    row = conn.execute("SELECT value FROM settings WHERE key = ?", (SWITCH_KEY,)).fetchone()
    try:
        return bool(row) and json.loads(row[0]).get("enabled") is True
    except (TypeError, ValueError, AttributeError):
        return False


def store_switch(conn: sqlite3.Connection, enabled: bool) -> None:
    conn.execute("INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                 (SWITCH_KEY, json.dumps({"enabled": bool(enabled)}, separators=(",", ":"))))


def permit() -> bool:
    """The code-level permit: the adapter's constant. It stays False until WisKey provides the command (W11)."""
    from .intercom_messaging_adapter import TEMPLATE_SEND_SUPPORTED
    return TEMPLATE_SEND_SUPPORTED is True


# ---------------------------------------------------------------- request, answer, transport

@dataclass(frozen=True)
class TemplateRequest:
    """Arx's PROPOSED request (`wa_template_send_proposal.v0`) - NOT a WisKey wire format. `params` are the filled slots in the
    template's order; they are values for ONE send and are never stored or logged."""
    request_id: str  # idempotency key = the attempt's `client_request_id`; a repeat must never send twice
    account: str
    person_id: str
    template_name: str
    language: str
    params: tuple[str, ...] = field(repr=False)
    deadline: dt.datetime = dt.datetime.min.replace(tzinfo=dt.timezone.utc)

    def wire(self) -> dict[str, Any]:
        return {"schema": PROPOSAL, "request_id": self.request_id, "account": self.account, "user_id": self.person_id,
                "template": {"name": self.template_name, "language": self.language}, "params": list(self.params),
                "deadline": self.deadline.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")}


@dataclass(frozen=True)
class TransportAnswer:
    """What the transport knows: `state` accepted | not_sent | unknown, WisKey's `code`, and `retry_after_s`/`scope` for a rate answer."""
    state: str
    code: str | None = None
    retry_after_s: int | None = None
    scope: str | None = None


class TemplateTransport(Protocol):
    def send_template(self, request: TemplateRequest) -> Any: ...


class UnwiredTransport:
    """Production's transport until WisKey has a template command: it refuses and nothing leaves."""

    def send_template(self, request: TemplateRequest) -> Any:
        return {"state": "not_sent", "code": "template_unsupported"}


class FakeTemplateTransport:
    """Tests only. Records the wire form of each request (never a real call); `answers` are consumed in order, then `default`."""

    def __init__(self, *answers: Any, default: Any = None) -> None:
        self.answers, self.default, self.requests = list(answers), default if default is not None else {"state": "accepted"}, []

    def send_template(self, request: TemplateRequest) -> Any:
        self.requests.append(request.wire())
        nxt = self.answers.pop(0) if self.answers else self.default
        if isinstance(nxt, BaseException):
            raise nxt
        return nxt


def read_answer(raw: Any) -> TransportAnswer:
    """The closed reading of a transport answer. `accepted` needs state == accepted exactly; `not_sent` needs a code in PRE_SEND_CODES;
    everything else - a timeout-shaped, malformed or unproven answer - is `unknown`."""
    if not isinstance(raw, Mapping):
        return TransportAnswer("unknown", "invalid_response")
    state, code = raw.get("state"), raw.get("code")
    code = code if isinstance(code, str) and 0 < len(code) <= 64 else None
    retry = raw.get("retry_after_s")
    retry = retry if isinstance(retry, int) and not isinstance(retry, bool) and 0 < retry <= 86400 else None
    scope = raw.get("scope") if raw.get("scope") in ("burst", "account", "pair") else None
    if state == "accepted":
        return TransportAnswer("accepted")
    if state == "not_sent" and code in PRE_SEND_CODES:
        return TransportAnswer("not_sent", code, retry, scope)
    return TransportAnswer("unknown", code or "status_unknown")


# ---------------------------------------------------------------- the window

class WindowProbe(Protocol):
    def window(self, person_id: str) -> str: ...  # "open" | "closed" | "unknown"


class NoWindowProbe:
    """Arx has no inbound messages and WisKey reports no window (open question 3): always unknown."""

    def window(self, person_id: str) -> str:
        return "unknown"


def needs_template(window: str) -> bool:
    """Only an explicit `open` window may carry free text; closed and unknown take a template."""
    return window != "open"


# ---------------------------------------------------------------- the sender

@dataclass(frozen=True)
class TemplateResult:
    """Same words as `intercom_messaging_adapter.SendResult` (`outcome`: sent | not_sent | unknown), plus Arx's `reason` for an
    admission refusal. `wait_until` is set when the budget (not the platform) holds the send."""
    outcome: str
    code: str | None = None
    reason: str | None = None
    retry_after_s: int | None = None
    scope: str | None = None
    wait_until: dt.datetime | None = None

    def as_send_result(self) -> Any:
        from .intercom_messaging_adapter import SendResult
        return SendResult(self.outcome, None if self.outcome == "sent" else ("uncertain" if self.outcome == "unknown" else (self.code or self.reason)),
                          self.code, self.retry_after_s, self.scope)


def _refuse(reason: str, **kw: Any) -> TemplateResult:
    return TemplateResult("not_sent", code=reason, reason=reason, **kw)


class TemplateSender:
    """One template send, once. `consent` is the effective consent (`granted | declined | unknown`), `values` the slot values for this
    person. The caller records the attempt (`intercom_messages`, BEFORE the call, like every message) - that row is the budget's
    count; this class adds nothing to any ledger, so a send is counted once."""

    def __init__(self, transport: TemplateTransport | None = None, *, registry: Callable[[], list[TemplateRef]], switch: Callable[[], bool],
                 permit_fn: Callable[[], bool] = permit, pacer: wa_pacing.WaPacer | None = None, pacing_for: Callable[[str], Any] | None = None,
                 consent_by_link: Callable[[], bool] = lambda: False, clock: Callable[[], dt.datetime] = lambda: dt.datetime.now(dt.timezone.utc)) -> None:
        self.transport = transport or UnwiredTransport()
        self._registry, self._switch, self._permit = registry, switch, permit_fn
        self._pacer, self._pacing_for, self._consent_by_link, self._clock = pacer, pacing_for, consent_by_link, clock

    def admit(self, *, template_id: str, consent: str, values: Mapping[str, str], account_key: str, recipient_key: str, ref: str) -> tuple[TemplateRef | None, TemplateResult | None]:
        """(reference, None) when the send may start; (None, refusal) when it provably must not. Nothing is sent here."""
        if not self._switch() or not self._permit():
            return None, _refuse("template_unsupported")
        tpl = next((t for t in self._registry() if t.id == template_id), None)
        if tpl is None:
            return None, _refuse("template_not_found")
        if any(not isinstance(values.get(s), str) or not values[s] or len(values[s]) > PARAM_MAX for s in tpl.params):
            return None, _refuse("template_params_mismatch")
        if consent == "declined":
            return None, _refuse("no_consent")
        if consent == "unknown" and tpl.purpose != "consent_request" and self._consent_by_link():
            return None, _refuse("consent_required")
        if self._pacer is None or self._pacing_for is None:
            return None, _refuse("paced_unavailable")  # F3C TP-01: a paid template never leaves outside the shared budget
        now = self._clock()
        d = self._pacer.check(account_key=account_key, pacing=self._pacing_for(account_key), recipient_key=recipient_key, klass=KLASS, ref=ref, now=now)
        if not d.allowed:
            reason = "pacing_expired" if d.expired else "paced"
            return None, TemplateResult("not_sent", code=reason, reason=reason, retry_after_s=max(1, int((d.not_before - now).total_seconds())), wait_until=d.not_before)
        return tpl, None

    def send(self, *, template_id: str, consent: str, values: Mapping[str, str], account: str, account_key: str, person_id: str, recipient_key: str,
             request_id: str, window: str = "unknown") -> TemplateResult:
        if not all(isinstance(v, str) and WIRE_ID_RE.fullmatch(v) for v in (person_id, account, request_id)):
            return _refuse("invalid_reference")  # F3C TP-03: the ids on the wire are closed strings (ids only)
        tpl, refused = self.admit(template_id=template_id, consent=consent, values=values, account_key=account_key, recipient_key=recipient_key, ref=request_id)
        if refused is not None or tpl is None:
            return refused or _refuse("template_unsupported")
        if not needs_template(window) and tpl.purpose != "consent_request":  # F3C TP-04
            return _refuse("window_open")  # the caller should have chosen free text; a template inside the window is not Arx's decision to make here
        now = self._clock()
        req = TemplateRequest(request_id, account, person_id, tpl.name, tpl.language, tuple(values[s] for s in tpl.params), now + dt.timedelta(seconds=15))
        try:
            raw = self.transport.send_template(req)
        except Exception as exc:  # noqa: BLE001 - an exception after the hand-over may have left: unknown, never retried
            log.warning("template send: the transport failed after the hand-over (%s)", type(exc).__name__)
            raw = {"state": "unknown", "code": "transport_error"}
        ans = read_answer(raw)
        outcome = {"accepted": "sent", "not_sent": "not_sent"}.get(ans.state, "unknown")
        if self._pacer is not None:
            self._pacer.on_result(account_key=account_key, recipient_key=recipient_key, klass=KLASS, outcome=outcome, outcome_code=ans.code, now=now)
        if outcome == "sent":
            return TemplateResult("sent")
        return TemplateResult(outcome, code=ans.code, retry_after_s=ans.retry_after_s, scope=ans.scope)
