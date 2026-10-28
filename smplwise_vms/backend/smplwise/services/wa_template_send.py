"""CR-W11TPL-295 (docs/changes/CR-W11TPL-295.md): the Arx side of a WhatsApp TEMPLATE send outside the 24-hour customer-service window
(WisKey item W11). OFF by default, FAKES ONLY, nothing here can send a real message.

WHAT IS BUILT (all pure or injectable; no route, no screen):
- a REGISTRY of template REFERENCES (`messaging.wa_templates`): Arx never holds a template body - Meta owns it - only a reference
  `{id, name, language, params[], purpose}`: the Meta name, its language and the ordered list of parameter SLOTS Arx fills
  (`name | organization | link | days`, the order of the template's {{1}}..{{n}}). `purpose` is `consent_request` or `notice`.
- the SWITCH `messaging.template_send` `{enabled}` (default OFF) AND the permit `intercom_messaging_adapter.TEMPLATE_SEND_SUPPORTED`
  (stays False): both must hold, else `not_sent / template_unsupported` and nothing is handed to any transport.
- ADMISSION, in this order, each refusal provably sending nothing: switch + permit; the reference exists and its parameters are exactly
  the slots it declares; the hours/budget (`wa_pacing`, class `ticket` = the normal class of every people-screen
  message; there is no separate template class and no second ledger - the attempt row in `intercom_messages` is what the budget
  already counts as WisKey-bound load, so a template send is counted once); the window (see below).
  NO RECIPIENT-CONSENT GATE (WKADAPT-295, owner decision TP-02, WisKey template_send_v1 route policy): consent never blocks this route and
  Arx never sends a consent field (no `consent=true`). Every other guard stays.
- the REQUEST follows WisKey's published `hikvision_intercom/whatsapp/template_send_v1` (M06_TEMPLATE_SEND_V1_CONTRACT, WisKey round 2,
  2026-10-23): envelope exactly `{id, type, template}`, template exactly `{schema_version: 1, request_id, operation_id, recipient_ref,
  account, template_name, language, parameters}` with WisKey's bounds (ids 1..128 without control characters, name
  `[a-z][a-z0-9_]{0,127}`, <= 20 parameters of 1..1024 characters without characters below U+0020, descriptor <= 32768 bytes).
- the ANSWER states: `accepted` -> sent (the provider's ACK only, delivery stays unknown), `not_sent` (only a closed result of the
  matching version, on the original request's context), `unknown` (anything else: a timeout, a disconnect, an HA error code, a bridge
  marker alone, a malformed answer, an answer of another version). Each command version has its OWN explicit reader: `read_v1`
  (`schema_version` 1, six keys; request of eight) and `read_v2` (`schema_version` 2, six keys; WisKey's autofill request of ten).
  A v2 result is never relabelled v1 and the version is kept on the answer. There is no reader for an answer without a
  `schema_version` (owner decision 413/A): it is `unknown`. An unknown outcome is NEVER retried and never refunded by Arx.
- the TRANSPORT is a Protocol. The only implementations here are `UnwiredTransport` (what production gets: it refuses, nothing left)
  and `FakeTemplateTransport` (tests). No live transport exists (WisKey's execution source and queue are NOT_INSTALLED); the HA error
  envelope mapping belongs to that future transport.
- the 24-hour WINDOW is a Protocol (`WindowProbe`): Arx has no inbound messages, so it cannot know the window; `unknown` is treated
  as closed (a template is what Meta accepts either way) and only an explicit `open` lets a caller prefer free text.

Audit and logs carry ids, codes and counts only - never a number, a parameter value, the link or a name.

WK4ADOPT-295 (W-013, WisKey `whatsapp/template_send_v2` contract revision 2, CODE 924df3e9, numbered contract items 1-9): the v2
REQUEST is built here (`TemplateRequestV2`, the closed ten keys with WisKey's `descriptor_v2` bounds) and sent by
`TemplateSender.send_v2` through `wiskey_template_direct.DirectTemplateTransport.send_v2` (the signed `wiskey-bridge-command.v1` of
the original pairing principal on the direct join's verified connection). Arx supplies ONLY fresh request/operation ids, the recipient
reference and its observed person revision, the account / template name / language and WisKey's exact private template reference +
revision (`TemplateRef.wiskey_ref` / `.wiskey_revision`): NO parameters, phone, PIN or body. The {{i}} order is WisKey's private
`ApprovedTextTemplate.parameter_fields`; WisKey's `send_v2` fills the values from its native person and its NativeTemplateSendHostV1
re-checks source and PIN policy before dispatch. The answer is read by `read_v2` only. The private installer read point is WisKey's
(`__init__.async_setup` -> `setup_native_template_installation(hass, config[DOMAIN][native_whatsapp_templates_v1])`, `NATIVE_INSTALLER_*`
below): Arx never writes that configuration. `TEMPLATE_SEND_SUPPORTED` stays False: production refuses every v2 send before any
hand-over; only tests open the permit, against a fake sender. Owner decision TP-02 (no recipient-consent gate) is unchanged."""
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
COMMAND = "hikvision_intercom/whatsapp/template_send_v1"  # WisKey's registered command (capability label whatsapp_template_route_v1)
SCHEMA_VERSION = 1
WIRE_TEMPLATE_KEYS = frozenset({"schema_version", "request_id", "operation_id", "recipient_ref", "account", "template_name", "language", "parameters"})
WIRE_NAME_RE = re.compile(r"^[a-z][a-z0-9_]{0,127}$")  # template_send_v1's template_name
WIRE_PARAMS_MAX = 20
DESCRIPTOR_MAX = 32768  # bytes of the sorted, compact, ASCII-escaped JSON of the template object
# the five closed (state, code, provider_accepted) combinations of a template_send_v1 result
V1_RESULT_KEYS = frozenset({"schema_version", "state", "code", "provider_accepted", "delivery", "retry_permitted"})
V1_COMBOS = {
    ("accepted", "provider_accepted", True): "accepted",
    ("not_sent", "template_mismatch", False): "not_sent",
    ("not_sent", "source_or_admission_refused", False): "not_sent",
    ("unknown", "operation_pending_or_unknown", None): "unknown",
    ("unknown", "provider_outcome_unknown", None): "unknown",
}
# template_send_v2 (WisKey autofill: it fills the parameters from its own source). WK4ADOPT-295: the request builder is
# `TemplateRequestV2` and the sender `TemplateSender.send_v2` (permit still False in production).
SCHEMA_VERSION_V2 = 2
V2_REQUEST_KEYS = frozenset({"schema_version", "request_id", "operation_id", "recipient_ref", "expected_person_revision", "account",
                             "template_name", "language", "template_ref", "expected_template_revision"})
V2_RESULT_KEYS = frozenset({"schema_version", "state", "code", "provider_accepted", "delivery", "retry_permitted"})
V2_COMBOS = {
    ("accepted", "provider_accepted", True): "accepted",
    ("not_sent", "template_mismatch", False): "not_sent",
    ("not_sent", "source_or_admission_refused", False): "not_sent",
    ("unknown", "operation_pending_or_unknown", None): "unknown",
    ("unknown", "provider_outcome_unknown", None): "unknown",
}
# WisKey's private installer read point (W013_TEMPLATE_SEND_V2.json item 7) - documentation constants; Arx never writes or reads it.
NATIVE_INSTALLER_CONFIG_KEY = "native_whatsapp_templates_v1"
NATIVE_INSTALLER_SETUP = "custom_components/hikvision_intercom/__init__.py:async_setup -> setup_native_template_installation"
NATIVE_INSTALLER_CONSUMED_KEYS = ("schema_version", "station_id", "bridge_entry_id", "accounts", "templates")
NATIVE_PARAMETER_FIELDS = ("display_name", "employee_no", "pin", "valid_from", "valid_until")  # WisKey-side only; never on Arx's wire
V2_REF_MAX_BYTES = 128
V2_REVISION_MAX = 2 ** 53 - 1
REGISTRY_MAX = 20
SLOTS = ("name", "organization", "link", "days")
PURPOSES = ("consent_request", "notice")
PARAM_MAX = 1024  # a filled slot (Meta's own limit is the template's; Arx never sends more than this)
NAME_RE = re.compile(r"^[a-z0-9_]{1,128}$")  # same as intercom_messaging.WA_TEMPLATE_NAME
LANG_RE = re.compile(r"^[a-z]{2,3}(?:_[A-Z]{2})?$")  # same as intercom_messaging.WA_TEMPLATE_LANG
ID_RE = re.compile(r"^[a-z0-9][a-z0-9_]{0,31}$")
WIRE_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.:@-]{0,127}$")  # person id / account / request id as they travel: no spaces, no control characters
KLASS = wa_pacing.CLASS_TICKET  # "a normal class": the people-screen messages' class, no special one

OUTCOMES = ("sent", "not_sent", "unknown")


# ---------------------------------------------------------------- the registry and the switch

@dataclass(frozen=True)
class TemplateRef:
    id: str
    name: str
    language: str
    params: tuple[str, ...]
    purpose: str
    wiskey_ref: str | None = None  # WK4ADOPT-295: WisKey's exact private template reference (template_send_v2 `template_ref`)
    wiskey_revision: int | None = None  # ... and the revision Arx observed (`expected_template_revision`)


def _v2_ref_ok(value: Any) -> bool:
    return (isinstance(value, str) and 1 <= len(value.encode("utf-8")) <= V2_REF_MAX_BYTES
            and not any(ord(c) < 32 or ord(c) == 127 for c in value))


def _v2_rev_ok(value: Any) -> bool:
    return type(value) is int and 1 <= value <= V2_REVISION_MAX


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
    wref, wrev = raw.get("template_ref"), raw.get("template_revision")
    if (wref is None) != (wrev is None) or (wref is not None and not (_v2_ref_ok(wref) and _v2_rev_ok(wrev))):
        return None  # both or neither (the v2 pair), never half of it
    return TemplateRef(rid, name, lang, tuple(params), str(purpose), wref, wrev)


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
    doc = [{"id": r.id, "name": r.name, "language": r.language, "params": list(r.params), "purpose": r.purpose,
            **({"template_ref": r.wiskey_ref, "template_revision": r.wiskey_revision} if r.wiskey_ref is not None else {})} for r in refs]
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
    """One WisKey `template_send_v1` request. `params` are the filled slots in the template's order; they are values for ONE send and
    are never stored or logged. `deadline` is the transport's own wait bound; it is not on the wire (the template object is closed)."""
    request_id: str  # idempotency key = the attempt's `client_request_id`; a repeat must never send twice
    account: str
    person_id: str  # WisKey's `recipient_ref`: the ManagedUser reference, never a phone number
    template_name: str
    language: str
    params: tuple[str, ...] = field(repr=False)
    deadline: dt.datetime = dt.datetime.min.replace(tzinfo=dt.timezone.utc)
    operation_id: str = ""  # WisKey's `operation_id`: a stable id of the logical operation, separate from the per-attempt request_id

    def wire(self) -> dict[str, Any]:
        """The closed eight-field `template` object of template_send_v1 (no consent, no policy, no deadline)."""
        return {"schema_version": SCHEMA_VERSION, "request_id": self.request_id, "operation_id": self.operation_id,
                "recipient_ref": self.person_id, "account": self.account, "template_name": self.template_name,
                "language": self.language, "parameters": list(self.params)}

    def envelope(self, message_id: int) -> dict[str, Any]:
        """The closed HA WebSocket envelope `{id, type, template}`; `message_id` is the connection's positive int id."""
        if type(message_id) is not int or message_id <= 0:
            raise ValueError("message_id must be a positive int")
        return {"id": message_id, "type": COMMAND, "template": self.wire()}


def wire_problem(request: TemplateRequest) -> str | None:
    """None when the template object meets template_send_v1's bounds, else a short reason. Checked BEFORE the hand-over."""
    w = request.wire()
    if set(w) != WIRE_TEMPLATE_KEYS:
        return "fields"
    for key in ("request_id", "operation_id", "recipient_ref", "account"):
        v = w[key]
        if not (isinstance(v, str) and 1 <= len(v) <= 128 and not any(ord(c) < 32 or ord(c) == 127 for c in v)):
            return key
    if not WIRE_NAME_RE.fullmatch(w["template_name"]) or not LANG_RE.fullmatch(w["language"]):
        return "template"
    ps = w["parameters"]
    if len(ps) > WIRE_PARAMS_MAX or any(not isinstance(p, str) or not 1 <= len(p) <= PARAM_MAX or any(ord(c) < 0x20 for c in p) for p in ps):
        return "parameters"
    if len(json.dumps(w, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode("ascii")) > DESCRIPTOR_MAX:
        return "too_large"
    return None


@dataclass(frozen=True)
class TemplateRequestV2:
    """One WisKey `template_send_v2` request (W-013 item 2): exactly ten closed keys, no parameters / phone / PIN / body."""
    request_id: str
    operation_id: str
    recipient_ref: str
    expected_person_revision: int
    account: str
    template_name: str
    language: str
    template_ref: str
    expected_template_revision: int

    def wire(self) -> dict[str, Any]:
        return {"schema_version": SCHEMA_VERSION_V2, "request_id": self.request_id, "operation_id": self.operation_id,
                "recipient_ref": self.recipient_ref, "expected_person_revision": self.expected_person_revision, "account": self.account,
                "template_name": self.template_name, "language": self.language, "template_ref": self.template_ref,
                "expected_template_revision": self.expected_template_revision}


def wire_problem_v2(request: TemplateRequestV2) -> str | None:
    """None when the object meets WisKey's `descriptor_v2` bounds (closed keys, revisions 1..2^53-1, references <= 128 UTF-8 bytes
    without control characters, the v1 name / language rules, <= 32768 bytes), else a short reason. Checked BEFORE the hand-over."""
    w = request.wire()
    if set(w) != V2_REQUEST_KEYS:
        return "fields"
    if not (_v2_rev_ok(w["expected_person_revision"]) and _v2_rev_ok(w["expected_template_revision"])):
        return "revision"
    for key in ("template_ref", "request_id", "operation_id", "recipient_ref", "account"):
        if not _v2_ref_ok(w[key]):
            return key
    if not WIRE_NAME_RE.fullmatch(w["template_name"]) or not LANG_RE.fullmatch(w["language"]):
        return "template"
    if len(json.dumps(w, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode("ascii")) > DESCRIPTOR_MAX:
        return "too_large"
    return None


@dataclass(frozen=True)
class TransportAnswer:
    """What the transport knows: `state` accepted | not_sent | unknown, WisKey's `code`, and `version`, the result version that was read
    (1 or 2; None when no closed result of the expected version was read). `retry_after_s`/`scope` stay None: no closed result has them."""
    state: str
    code: str | None = None
    retry_after_s: int | None = None
    scope: str | None = None
    version: int | None = None


class TemplateTransport(Protocol):
    def send_template(self, request: TemplateRequest) -> Any: ...


class UnwiredTransport:
    """Production's transport until WisKey has a template command: it refuses and nothing leaves."""

    def send_template(self, request: TemplateRequest) -> Any:
        return {"state": "not_sent", "code": "template_unsupported"}


# WKINT-295: the process-wide transport a TemplateSender built WITHOUT an explicit transport uses at send time. None (the default, and
# always without a usable pairing key or with `access.station_media_provider = local`) keeps `UnwiredTransport` - exactly the behaviour
# before. services/wiskey_direct_join.py installs a provider that returns its `DirectTemplateTransport` only while the direct path is
# selected (else None). The switch / permit gates above it (TEMPLATE_SEND_SUPPORTED) are untouched.
TRANSPORT_PROVIDER: Callable[[], "TemplateTransport | None"] | None = None
# WKR5-295 unit D: the same for the v2 (autofill) command - the join returns its DirectTemplateTransport only while
# `whatsapp/template_send_v2` is selected (discovered on the current direct connection). None: `send_v2` refuses before any hand-over.
TRANSPORT_V2_PROVIDER: Callable[[], Any] | None = None


def installed_transport() -> "TemplateTransport":
    provider = TRANSPORT_PROVIDER
    if provider is not None:
        try:
            chosen = provider()
        except Exception:  # noqa: BLE001 - an unreadable selection keeps the unwired transport (nothing leaves)
            chosen = None
        if chosen is not None:
            return chosen
    return UnwiredTransport()


def closed_result(version: int, state: str, code: str, provider_accepted: bool | None) -> dict[str, Any]:
    """A closed six-key result of `version` (tests and fakes)."""
    return {"schema_version": version, "state": state, "code": code, "provider_accepted": provider_accepted, "delivery": "unknown",
            "retry_permitted": False}


class FakeTemplateTransport:
    """Tests only. Records the wire form of each request (never a real call); `answers` are consumed in order, then `default`."""

    def __init__(self, *answers: Any, default: Any = None) -> None:
        self.answers, self.default, self.requests = list(answers), default if default is not None else closed_result(SCHEMA_VERSION, "accepted", "provider_accepted", True), []

    def send_template(self, request: TemplateRequest) -> Any:
        self.requests.append(request.wire())
        nxt = self.answers.pop(0) if self.answers else self.default
        if isinstance(nxt, BaseException):
            raise nxt
        return nxt


def _read_closed(raw: Any, version: int, keys: frozenset[str], combos: Mapping[tuple[Any, Any, Any], str]) -> TransportAnswer:
    """One closed result of exactly `version`: exactly `keys`, `schema_version == version` (a real int), delivery unknown, no retry, and
    one of the closed (state, code, provider_accepted) combinations. Anything else is `unknown`."""
    if not isinstance(raw, Mapping) or set(raw) != keys:
        return TransportAnswer("unknown", "invalid_response")
    pa = raw.get("provider_accepted")
    ok = (type(raw.get("schema_version")) is int and raw.get("schema_version") == version and raw.get("delivery") == "unknown"
          and raw.get("retry_permitted") is False and (pa is None or type(pa) is bool))
    state, code = raw.get("state"), raw.get("code")
    st = combos.get((state, code, pa)) if ok and isinstance(state, str) and isinstance(code, str) else None
    if st is None:
        return TransportAnswer("unknown", "invalid_response")
    return TransportAnswer(st, None if st == "accepted" else str(code), version=version)


def read_v1(raw: Any) -> TransportAnswer:
    """The reader of a `template_send_v1` result (`schema_version` 1, six keys). A result of another version is `unknown`."""
    return _read_closed(raw, SCHEMA_VERSION, V1_RESULT_KEYS, V1_COMBOS)


def read_v2(raw: Any) -> TransportAnswer:
    """The reader of a `template_send_v2` (autofill) result (`schema_version` 2, six keys). Its own function, never the v1 one."""
    return _read_closed(raw, SCHEMA_VERSION_V2, V2_RESULT_KEYS, V2_COMBOS)


READERS: Mapping[int, Callable[[Any], TransportAnswer]] = {SCHEMA_VERSION: read_v1, SCHEMA_VERSION_V2: read_v2}


def read_answer(raw: Any, *, version: int = SCHEMA_VERSION) -> TransportAnswer:
    """The closed reading of a transport answer, by the version of the command that was SENT (default v1). `accepted` is the provider's ACK
    only; `not_sent` only a closed result of that same version; everything else - a timeout, a disconnect, an HA error code
    (`operation_conflict`, `template_source_unavailable`, ...), a `bridge_schema` marker alone, a malformed answer, an answer without
    a `schema_version` (the former legacy branch, removed) or of the other version - is `unknown`: no refund, no retry, no pacer credit."""
    reader = READERS.get(version) if type(version) is int else None
    if reader is None:
        return TransportAnswer("unknown", "invalid_response")
    return reader(raw)


# ---------------------------------------------------------------- the window

class WindowProbe(Protocol):
    def window(self, person_id: str) -> str: ...  # "open" | "closed" | "unknown"


class NoWindowProbe:
    """Arx has no inbound messages and WisKey reports no window (open question 3): always unknown."""

    def window(self, person_id: str) -> str:
        return "unknown"


WINDOW_STATES = ("open", "closed", "unknown")


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
    result_version: int | None = None  # the template_send result version that was read (1 or 2); None when none was

    def as_send_result(self) -> Any:
        from .intercom_messaging_adapter import SendResult
        return SendResult(self.outcome, None if self.outcome == "sent" else ("uncertain" if self.outcome == "unknown" else (self.code or self.reason)),
                          self.code, self.retry_after_s, self.scope)


def _refuse(reason: str, **kw: Any) -> TemplateResult:
    return TemplateResult("not_sent", code=reason, reason=reason, **kw)


class TemplateSender:
    """One template send, once. `values` are the slot values for this person. There is NO recipient-consent gate on this route
    (WKADAPT-295: owner decision TP-02 and WisKey's template_send_v1 policy): a `consent` argument a caller still passes is ignored for
    admission and never reaches the wire. The caller records the attempt (`intercom_messages`, BEFORE the call, like every message) -
    that row is the budget's count; this class adds nothing to any ledger, so a send is counted once."""

    def __init__(self, transport: TemplateTransport | None = None, *, registry: Callable[[], list[TemplateRef]], switch: Callable[[], bool],
                 permit_fn: Callable[[], bool] = permit, pacer: wa_pacing.WaPacer | None = None, pacing_for: Callable[[str], Any] | None = None,
                 clock: Callable[[], dt.datetime] = lambda: dt.datetime.now(dt.timezone.utc)) -> None:
        self._explicit = transport is not None  # WKINT-295: without one, the installed transport is read at send time
        self.transport = transport or UnwiredTransport()
        self._registry, self._switch, self._permit = registry, switch, permit_fn
        self._pacer, self._pacing_for, self._clock = pacer, pacing_for, clock

    def admit(self, *, template_id: str, values: Mapping[str, str], account_key: str, recipient_key: str, ref: str,
              consent: str | None = None) -> tuple[TemplateRef | None, TemplateResult | None]:
        """(reference, None) when the send may start; (None, refusal) when it provably must not. Nothing is sent here.
        `consent` is accepted for callers' compatibility only and never refuses (TP-02)."""
        if not self._switch() or not self._permit():
            return None, _refuse("template_unsupported")
        tpl = next((t for t in self._registry() if t.id == template_id), None)
        if tpl is None:
            return None, _refuse("template_not_found")
        if any(not isinstance(values.get(s), str) or not values[s] or len(values[s]) > PARAM_MAX for s in tpl.params):
            return None, _refuse("template_params_mismatch")
        if self._pacer is None or self._pacing_for is None:
            return None, _refuse("paced_unavailable")  # F3C TP-01: a paid template never leaves outside the shared budget
        now = self._clock()
        d = self._pacer.check(account_key=account_key, pacing=self._pacing_for(account_key), recipient_key=recipient_key, klass=KLASS, ref=ref, now=now)
        if not d.allowed:
            reason = "pacing_expired" if d.expired else "paced"
            return None, TemplateResult("not_sent", code=reason, reason=reason, retry_after_s=max(1, int((d.not_before - now).total_seconds())), wait_until=d.not_before)
        return tpl, None

    def send(self, *, template_id: str, values: Mapping[str, str], account: str, account_key: str, person_id: str, recipient_key: str,
             request_id: str, operation_id: str, window: str = "unknown", consent: str | None = None) -> TemplateResult:
        if not all(isinstance(v, str) and WIRE_ID_RE.fullmatch(v) for v in (person_id, account, request_id, operation_id)):
            return _refuse("invalid_reference")  # F3C TP-03: the ids on the wire are closed strings (ids only)
        tpl, refused = self.admit(template_id=template_id, values=values, account_key=account_key, recipient_key=recipient_key, ref=request_id)
        if refused is not None or tpl is None:
            return refused or _refuse("template_unsupported")
        if not needs_template(window) and tpl.purpose != "consent_request":  # F3C TP-04
            return _refuse("window_open")  # the caller should have chosen free text; a template inside the window is not Arx's decision to make here
        transport = self.transport if self._explicit else installed_transport()
        if isinstance(transport, UnwiredTransport):
            return _refuse("template_unsupported")  # nothing is wired: refused before any hand-over (there is no answer to read)
        now = self._clock()
        req = TemplateRequest(request_id, account, person_id, tpl.name, tpl.language, tuple(values[s] for s in tpl.params), now + dt.timedelta(seconds=15),
                              operation_id=operation_id)
        if wire_problem(req) is not None:
            return _refuse("invalid_fields")  # outside template_send_v1's bounds: refused before the hand-over, nothing leaves
        try:
            raw = transport.send_template(req)
        except Exception as exc:  # noqa: BLE001 - an exception after the hand-over may have left: unknown, never retried
            log.warning("template send: the transport failed after the hand-over (%s)", type(exc).__name__)
            raw = {"state": "unknown", "code": "transport_error"}
        ans = read_answer(raw, version=SCHEMA_VERSION)  # the request built above is template_send_v1
        outcome = {"accepted": "sent", "not_sent": "not_sent"}.get(ans.state, "unknown")
        if self._pacer is not None:
            self._pacer.on_result(account_key=account_key, recipient_key=recipient_key, klass=KLASS, outcome=outcome, outcome_code=ans.code, now=now)
        if outcome == "sent":
            return TemplateResult("sent", result_version=ans.version)
        return TemplateResult(outcome, code=ans.code, retry_after_s=ans.retry_after_s, scope=ans.scope, result_version=ans.version)

    def send_v2(self, *, template_id: str, account: str, account_key: str, person_id: str, recipient_key: str, request_id: str,
                operation_id: str, person_revision: int | None = None, expected_person_revision: int | None = None,
                template_ref: str | None = None, expected_template_revision: int | None = None, window: str = "unknown") -> TemplateResult:
        """One `whatsapp/template_send_v2` send (WisKey AUTOFILL), once. REL2210: the one implementation of WK4ADOPT-295 (W-013) and
        WKR5-295 unit D. WisKey fills the parameters from its own native person (PIN only when its private template declares it); Arx
        passes references and revisions only: no name, PIN or card value.

        - the person revision is `person_revision` (W-013) or `expected_person_revision` (unit D); both given must agree.
        - the WisKey template pair is the explicit `template_ref` + `expected_template_revision` (unit D) or else the pair stored on
          the reference (`TemplateRef.wiskey_ref` / `.wiskey_revision`, W-013); without either: `template_v2_unbound`.
        - same admission as `send` (switch + permit, the reference, the shared budget) EXCEPT the window: an open window does not refuse
          an explicitly requested approved template (WISKEY-MAC-ADOPT-298 item B, WisKey answer 5); `window` must be open|closed|unknown.
        - the transport: the explicit one (W-013), else the v2 provider of the direct join while `template_send_v2` is selected
          (`TRANSPORT_V2_PROVIDER`, unit D; set but answering None refuses, with no fallback), else the installed transport. It must
          offer `send_v2`, else refused before any hand-over.
        `accepted` is the provider's acceptance only (delivery unknown); anything but a closed v2 result is UNKNOWN, never retried."""
        if person_revision is not None and expected_person_revision is not None and person_revision != expected_person_revision:
            return _refuse("invalid_reference")
        revision = person_revision if person_revision is not None else expected_person_revision
        ids = (person_id, account, request_id, operation_id) + ((template_ref,) if template_ref is not None else ())
        if not all(isinstance(v, str) and WIRE_ID_RE.fullmatch(v) for v in ids):
            return _refuse("invalid_reference")
        if not _v2_rev_ok(revision):
            return _refuse("invalid_reference")
        if (template_ref is None) != (expected_template_revision is None) or (
                expected_template_revision is not None and not _v2_rev_ok(expected_template_revision)):
            return _refuse("invalid_fields")
        if not self._switch() or not self._permit():
            return _refuse("template_unsupported")
        tpl = next((t for t in self._registry() if t.id == template_id), None)
        if tpl is None:
            return _refuse("template_not_found")
        wref, wrev = (template_ref, expected_template_revision) if template_ref is not None else (tpl.wiskey_ref, tpl.wiskey_revision)
        if wref is None or wrev is None:
            return _refuse("template_v2_unbound")  # no WisKey template pair: nothing to name
        if self._pacer is None or self._pacing_for is None:
            return _refuse("paced_unavailable")
        now = self._clock()
        d = self._pacer.check(account_key=account_key, pacing=self._pacing_for(account_key), recipient_key=recipient_key, klass=KLASS,
                              ref=request_id, now=now)
        if not d.allowed:
            reason = "pacing_expired" if d.expired else "paced"
            return TemplateResult("not_sent", code=reason, reason=reason, retry_after_s=max(1, int((d.not_before - now).total_seconds())),
                                  wait_until=d.not_before)
        # WISKEY-MAC-ADOPT-298 item B (Mac 03_template_peer/TEMPLATE_SEVEN_ANSWERS.json answer 5, option b): an EXPLICITLY requested
        # approved template is sent as a template even inside an open conversation window - this route never chooses free text and never
        # infers the window. So `window` no longer refuses here (`send`, v1, keeps its F3C TP-04 rule). Nothing else is relaxed: the switch
        # + permit, the registered reference and its WisKey pair, the shared budget and the transport selection above/below all still hold.
        if window not in WINDOW_STATES:
            return _refuse("invalid_fields")
        transport = self._v2_transport()
        send_v2 = getattr(transport, "send_v2", None)
        if transport is None or isinstance(transport, UnwiredTransport) or not callable(send_v2):
            return _refuse("template_unsupported")  # no v2 path: nothing is handed over
        req = TemplateRequestV2(request_id, operation_id, person_id, revision, account, tpl.name, tpl.language, wref, wrev)
        if wire_problem_v2(req) is not None:
            return _refuse("invalid_fields")
        try:
            raw = send_v2(req.wire())
        except Exception as exc:  # noqa: BLE001 - after the hand-over: unknown, never retried
            log.warning("template send v2: the transport failed after the hand-over (%s)", type(exc).__name__)
            raw = {"state": "unknown", "code": "transport_error"}
        ans = read_answer(raw, version=SCHEMA_VERSION_V2)
        outcome = {"accepted": "sent", "not_sent": "not_sent"}.get(ans.state, "unknown")
        self._pacer.on_result(account_key=account_key, recipient_key=recipient_key, klass=KLASS, outcome=outcome, outcome_code=ans.code, now=now)
        if outcome == "sent":
            return TemplateResult("sent", result_version=ans.version)
        return TemplateResult(outcome, code=ans.code, retry_after_s=ans.retry_after_s, scope=ans.scope, result_version=ans.version)

    def _v2_transport(self) -> Any:
        if self._explicit:
            return self.transport
        provider = TRANSPORT_V2_PROVIDER
        if provider is not None:
            try:
                return provider()
            except Exception:  # noqa: BLE001 - no selected v2 path
                return None
        return installed_transport()
