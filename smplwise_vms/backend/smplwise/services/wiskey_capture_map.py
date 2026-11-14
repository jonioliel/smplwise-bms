"""CAPMAP-295: the Arx-side map of the card-capture lease onto the original receiver chain (DTO9), behind a DISABLED build flag.

"Capture" here is CARD capture (a door station's reader collecting one presented card for the person editor, CR-005 / the capture lease
CR-WISKEY-LEASE-REVOCATION-EVENT), not a camera snapshot.

What "DTO9" is in this repository (the symbol exists, under another name): the receiver of `capture/lease_event` and `capture/lease_request`
is the ORIGINAL bridge services `smplwise_bridge.lease_event` / `.lease_request` (custom_components/smplwise_bridge/lease_service.py). Their
stages 1-7 (`lease_contract.validate`) hand WisKey's stage 8 an immutable `lease_contract.LeaseDTO`; `LeaseDTO.as_json()` has exactly the nine
keys below - the `original_dto9` of WisKey's two-layer capture vectors. WisKey's side then adds `protocol` from the capability
(`NativeCaptureBridgeSource.project_dto`, WisKey source - not in this repository, its mapping is Mac's deliverable).

    Arx lease worker / capture routes -> lease_events.sign (inner DTO v3 text) -> lease_events.TRANSPORT
      -> wiskey_capture_direct.DirectLeaseTransport -> port.call("capture/lease_event" | "capture/lease_request", {signed_message_json})
      -> [WisKey outer adapter] -> smplwise_bridge.lease_event | lease_request -> lease_contract.validate -> LeaseDTO (DTO9)
      -> [WisKey consumer, stage 8] -> the closed answer -> lease_answers / capture_lease_route.classify_request (Arx)

What this module adds: NOTHING on the wire and no engine. It is a pre-flight in front of the EXISTING DirectLeaseTransport:
- `MAP`: the closed table action -> direct command -> bridge service -> receiver symbol -> Arx answer classifier, with an empty Mac column
  (`mac_symbol` / `mac_sha256` None = PENDING_MAC) that only Mac's mapping table fills;
- `project_dto9(text, kind)`: the DTO9 the receiver will build from this exact text, computed locally WITHOUT a key (a projection, never a
  signature verification - the receiver still verifies). A text that cannot project (not one closed wire object, wrong protocol, wrong kind,
  a `kid`, oversize) is refused here as `not_sent`;
- `MappedLeaseTransport`: refuses honestly instead of sending when the mapping is disabled, when the peer's announced command list is unknown
  or lacks the command (`unsupported`, `not_sent`: nothing left Arx), else hands the SAME text to the inner transport and returns the host's
  answer as it came. It never builds an answer, never reports success the host did not give, never retries.

Not wired anywhere: `wiskey_direct_join.startup` still installs the plain DirectLeaseTransport. `MAPPING_ENABLED` is a build constant (never a
setting) and stays False; `capture_lease.GO_LIVE_PERMITTED` and `access.capture_lease` are not touched.

WK4ADOPT-295 (W-005, Mac mapping artifacts of WisKey CODE 924df3e9, reviewed by Windows 2026-10-25): Mac's column is filled from
`W005_CAPTURE_MAP.json` (symbol + file + file sha256 per action) and every row carries the closed inner `params` keys Mac names. The
review adds no wire field: `protocol` comes from the capability, DTO9 from `LeaseDTO.as_json`, actor / person_revision /
permission_revision stay inside the signed lease, CAS and join stay local mechanisms (no JSON join field, no proof from a destroyed
count). The projection additionally refuses (`not_sent`, nothing handed over) params that differ from the closed keys and a
`capture_start` whose `binding_revision` is not null (unsupported on the native path - refused, never adopted).
`announced_commands` picks the command list by Mac's preference (the current direct connection's `capabilities.commands`, else the
authorized `overview.api.commands`); `api_contract: null` of a native route is NOT a support verdict either way. `provenance` keeps
where an outcome came from: only this module's own pre-flight (or a transport refusal before any byte) proves "nothing was sent"; a
WisKey code alone never does, and a missing / malformed / unknown answer stays UNKNOWN with no replay. Emergency revoke and
card-capture go-live stay the separate 2.21.0 conditions."""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Any, Callable, Iterable

from ..errors import ApiError
from . import capture_lease as cl
from . import lease_events
from .wiskey_capture_direct import EVENT_COMMAND, REQUEST_COMMAND

# The disabled feature flag (a build constant, the GO_LIVE_PERMITTED pattern). Flipped only by the commit that adopts Mac's reviewed mapping
# table; tests/test_capmap_295.py refuses True while any row still lacks its Mac symbol.
MAPPING_ENABLED = False

DTO9_KEYS = ("action", "actor", "station", "params", "request_id", "nonce", "issued_at", "expires_at", "body_sha256")
WIRE_KEYS = frozenset({"protocol", "actor", "action", "station", "params", "request_id", "issued_at", "expires_at", "ts", "nonce", "sig"})
SIGNATURE_FIELDS = ("ts", "nonce", "sig")
KIND_EVENT, KIND_REQUEST = "event", "request"
COMMAND_OF_KIND = {KIND_EVENT: EVENT_COMMAND, KIND_REQUEST: REQUEST_COMMAND}
RECEIVER_SYMBOL = "custom_components/smplwise_bridge/lease_contract.py:LeaseDTO"  # validate() -> LeaseDTO.as_json() = DTO9

STATES = ("disabled", "unsupported", "mapped_unverified", "mapped")
UNSUPPORTED_CODE = "capture_receiver_unsupported"  # routers/access_control._NOT_SENT_CODES: nothing was sent
PROJECTION_CODE = "capture_dto9_unmappable"
UNSUPPORTED_REASONS = ("mapping_disabled", "capabilities_unknown", "command_not_announced")
PROJECTION_REASONS = ("not_text", "message_too_large", "invalid_json", "duplicate_key", "not_an_object", "unknown_field", "missing_field",
                      "wrong_protocol", "wrong_action", "kind_mismatch", "action_mismatch", "wrong_type", "params_mismatch",
                      "binding_revision_unsupported")
UNSUPPORTED_TEXT = "קריאת כרטיס אינה נתמכת כעת"
PROJECTION_TEXT = "הודעת הקריאה אינה תקינה."


@dataclass(frozen=True)
class MapRow:
    action: str
    kind: str
    direct_command: str
    bridge_service: str
    receiver_symbol: str
    arx_classifier: str
    mac_symbol: str | None = None  # WisKey's handler / consumer symbol for this action, from Mac's table (None = PENDING_MAC)
    mac_sha256: str | None = None  # the file sha256 Mac's table names for that symbol
    mac_file: str | None = None
    params_keys: frozenset[str] = frozenset()  # the closed inner `params` keys of this action (Mac's table; Arx's lease_events agrees)


# W005_CAPTURE_MAP.json (Mac delivery 2026-10-25, WisKey CODE 924df3e9): action -> (symbol, (file, file sha256), closed params keys)
MAC_CODE = "924df3e9366c262c165fddf31d04dad5e9cb4ede"
_COMPOSITION = ("custom_components/hikvision_intercom/capture_native_composition.py", "bcf54e340c2b629cb14ed5cbaaf4f2068c9d29f51580f80021c9640a7d4b27c1")
_EXPERIMENTAL = ("custom_components/hikvision_intercom/trusted_actions/lease_experimental.py", "d662756464cc674b158d7a0f2b42c87552f90ba7a70a76678f6bf0b9228e0c2f")
_LEASE_HOST = ("custom_components/hikvision_intercom/trusted_actions/capture_lease_host.py", "f179e6984374eddfbed677733dbe83fb49eb53cb3c228d50da4b9f43decac2ba")
MAC_TABLE: dict[str, tuple[str, tuple[str, str], tuple[str, ...]]] = {
    "capture_start": ("NativeCaptureComposition.start", _COMPOSITION, ("lease",)),
    "capture_status": ("NativeCaptureComposition.status", _COMPOSITION, ("lease_ref", "session_id")),
    "capture_confirm": ("NativeCaptureComposition.confirm", _COMPOSITION, ("lease_ref", "session_id", "label")),
    "capture_cancel": ("ExperimentalLeaseHost.step", _EXPERIMENTAL, ("lease_ref", "session_id")),
    "lease_revoke": ("CaptureLeaseHost.event", _LEASE_HOST, ("stream_id", "sequence", "scope", "lease_ref", "permission_revision", "reason", "revoked_at")),
    "lease_heartbeat": ("CaptureLeaseHost.event", _LEASE_HOST, ("stream_id", "sequence", "live_leases", "permission_revision")),
    "lease_stream_reset": ("CaptureLeaseHost.event", _LEASE_HOST, ("stream_id", "previous_stream_id", "sequence", "reason")),
}


def _row(action: str) -> MapRow:
    kind = KIND_EVENT if action in lease_events.EVENT_ACTIONS else KIND_REQUEST
    service = lease_events.SERVICE_EVENT if kind == KIND_EVENT else lease_events.SERVICE_REQUEST
    classifier = "lease_answers.classify_event" if kind == KIND_EVENT else "capture_lease_route.classify_request"
    symbol, (file, sha), keys = MAC_TABLE[action]
    return MapRow(action, kind, COMMAND_OF_KIND[kind], "smplwise_bridge." + service, RECEIVER_SYMBOL, classifier, symbol, sha, file, frozenset(keys))


MAP: tuple[MapRow, ...] = tuple(_row(a) for a in lease_events.ALL_ACTIONS)
ROW_OF = {r.action: r for r in MAP}


def enabled() -> bool:
    return MAPPING_ENABLED is True


def confirmed() -> bool:
    """True when every row carries Mac's symbol, file hash and closed params keys (WK4ADOPT-295: Mac's reviewed table). A SOURCE
    mapping fact only - never installation, a live measurement or a reason to enable the mapping."""
    return all(r.mac_symbol and r.mac_sha256 and r.mac_file and r.params_keys for r in MAP)


# ---------------------------------------------------------------- typed errors (ApiErrors the capture routes already understand)

class CaptureMapError(ApiError):
    """A pre-flight refusal: nothing was handed to the transport (`outcome = not_sent`). Carries a fixed reason token, never message text."""

    state = "refused"

    def __init__(self, status: int, code: str, text: str, reason: str) -> None:
        super().__init__(status, code, text, retryable=False, details={"outcome": "not_sent", "state": self.state, "reason": reason})
        self.reason = reason


class CaptureUnsupported(CaptureMapError):
    """The mapping or the peer's receiver is not available: an honest `unsupported`, never a fake success."""

    state = "unsupported"

    def __init__(self, reason: str) -> None:
        assert reason in UNSUPPORTED_REASONS, reason
        super().__init__(503, UNSUPPORTED_CODE, UNSUPPORTED_TEXT, reason)


class CaptureProjectionError(CaptureMapError):
    """The text cannot become the receiver's DTO9 (it would be rejected there): refused before anything leaves."""

    state = "unmappable"

    def __init__(self, reason: str) -> None:
        assert reason in PROJECTION_REASONS, reason
        super().__init__(400, PROJECTION_CODE, PROJECTION_TEXT, reason)


# ---------------------------------------------------------------- the DTO9 projection (no key: never a verification)

def _canonical(body: dict[str, Any]) -> bytes:
    return json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def _pairs(items: list[tuple[str, Any]]) -> dict[str, Any]:
    seen: dict[str, Any] = {}
    for k, v in items:
        if k in seen:
            raise CaptureProjectionError("duplicate_key")
        seen[k] = v
    return seen


def _no_number(_text: str) -> Any:
    raise CaptureProjectionError("invalid_json")


def project_dto9(text: Any, kind: str) -> dict[str, Any]:
    """The nine-key DTO the receiver (`lease_contract.validate`) builds from this exact text, or CaptureProjectionError. Checks only what the
    projection needs (one closed wire object, the protocol, an action of `kind`); the per-action params schema, the binding, the signature, the
    time and the replay stages stay the receiver's."""
    if type(text) is not str or not text:
        raise CaptureProjectionError("not_text")
    try:
        size = len(text.encode("utf-8"))
    except UnicodeEncodeError:
        raise CaptureProjectionError("invalid_json") from None
    if size > lease_events.MAX_MESSAGE_BYTES:
        raise CaptureProjectionError("message_too_large")
    try:  # the receiver's parse stage refuses duplicates, NaN / Infinity and non-integer numbers: so does the projection
        m = json.loads(text, object_pairs_hook=_pairs, parse_constant=_no_number, parse_float=_no_number)
    except (ValueError, RecursionError):
        raise CaptureProjectionError("invalid_json") from None
    if not isinstance(m, dict):
        raise CaptureProjectionError("not_an_object")
    if set(m) - WIRE_KEYS:
        raise CaptureProjectionError("unknown_field")  # a `kid` or any added field: the v1 wire is closed
    if WIRE_KEYS - set(m):
        raise CaptureProjectionError("missing_field")
    if m["protocol"] != cl.PROTOCOL:
        raise CaptureProjectionError("wrong_protocol")
    row = ROW_OF.get(m["action"]) if isinstance(m["action"], str) else None
    if row is None:
        raise CaptureProjectionError("wrong_action")
    if row.kind != kind:
        raise CaptureProjectionError("kind_mismatch")
    actor = m["actor"]
    if not isinstance(actor, dict) or set(actor) != {"id", "display_name"} or not isinstance(m["params"], dict):
        raise CaptureProjectionError("wrong_type")
    if set(m["params"]) != row.params_keys:
        raise CaptureProjectionError("params_mismatch")  # Mac's closed inner keys: no added field, nothing missing
    if row.action == "capture_start":
        lease = m["params"]["lease"]
        if not isinstance(lease, dict) or lease.get("binding_revision") is not None:
            raise CaptureProjectionError("binding_revision_unsupported")  # the native path refuses a non-null binding_revision
    body = {k: v for k, v in m.items() if k not in SIGNATURE_FIELDS}
    return {"action": m["action"], "actor": {"id": actor["id"], "display_name": actor["display_name"]}, "station": m["station"],
            "params": m["params"], "request_id": m["request_id"], "nonce": m["nonce"], "issued_at": m["issued_at"],
            "expires_at": m["expires_at"], "body_sha256": hashlib.sha256(_canonical(body)).hexdigest()}


# ---------------------------------------------------------------- the gated transport

Announced = Callable[[], Iterable[str] | None]


class MappedLeaseTransport:
    """`lease_events.LeaseTransport` in front of the existing DirectLeaseTransport. Pre-flight only; the inner transport does the one call."""

    def __init__(self, inner: Any, announced: Announced, *, is_enabled: Callable[[], bool] = enabled) -> None:
        self.inner = inner
        self.announced = announced
        self.is_enabled = is_enabled

    def _commands(self) -> frozenset[str] | None:
        try:
            listed = self.announced()
        except Exception:  # noqa: BLE001 - an unreadable announcement is an unknown one
            return None
        if listed is None or isinstance(listed, (str, bytes)):
            return None
        try:
            return frozenset(c for c in listed if isinstance(c, str))
        except TypeError:
            return None

    def _preflight(self, kind: str, text: Any) -> dict[str, Any]:
        if not self.is_enabled():
            raise CaptureUnsupported("mapping_disabled")
        commands = self._commands()
        if commands is None:
            raise CaptureUnsupported("capabilities_unknown")
        if COMMAND_OF_KIND[kind] not in commands:
            raise CaptureUnsupported("command_not_announced")
        return project_dto9(text, kind)

    def event(self, settings: Any, text: str) -> Any:
        self._preflight(KIND_EVENT, text)
        return self.inner.event(settings, text)

    def request(self, settings: Any, action: str, text: str) -> Any:
        if action not in cl.LEASE_ACTIONS:
            raise ValueError("lease_request action")
        dto = self._preflight(KIND_REQUEST, text)
        if dto["action"] != action:
            raise CaptureProjectionError("action_mismatch")
        return self.inner.request(settings, action, text)


def state(announced: Iterable[str] | None = None) -> dict[str, Any]:
    """The honest status of the mapping for a status screen or a report. Never claims installation or a live measurement."""
    if not enabled():
        value = "disabled"
    elif announced is None or not {EVENT_COMMAND, REQUEST_COMMAND} <= set(announced):
        value = "unsupported"
    else:
        value = "mapped" if confirmed() else "mapped_unverified"
    return {"state": value, "receiver_symbol": RECEIVER_SYMBOL, "mac_mapping": "REVIEWED" if confirmed() else "PENDING_MAC",
            "installation": "NOT_PERFORMED", "live": "NOT_MEASURED"}


# ---------------------------------------------------------------- WK4ADOPT-295 (W-005): the announcement source and the outcome provenance

def _command_list(raw: Any) -> frozenset[str] | None:
    if not isinstance(raw, (list, tuple)) or not all(isinstance(c, str) for c in raw):
        return None
    return frozenset(raw)


def announced_commands(direct_capabilities: Any = None, overview_api: Any = None) -> tuple[frozenset[str] | None, str]:
    """(the command names, their source) by Mac's preference: the CURRENT authenticated direct connection's `capabilities.commands`
    (`direct/connect` / `direct/capabilities`), else the authorized `overview.api.commands`. A per-command `api_contract: null` is the
    absence of a panel API-contract number for a separately registered native route: it is ignored here (neither support nor absence);
    only the exact name counts, and the native binding and the go-live permit stay separate gates. (None, "unknown") when neither is
    readable - that is `capabilities_unknown`, never "unsupported"."""
    for source, raw in (("direct_capabilities", direct_capabilities), ("overview_api", overview_api)):
        if isinstance(raw, dict):
            listed = _command_list(raw.get("commands"))
            if listed is not None:
                return listed, source
    return None, "unknown"


@dataclass(frozen=True)
class Provenance:
    """Where the outcome of one lease call came from. `not_sent_proven` only for this module's own pre-flight or a transport refusal
    proven before any byte (`not_sent`); `replay_permitted` is always False."""

    phase: str  # local_preflight | transport_not_sent | remote_answer | remote_rejected | remote_refused | sent_unknown | unknown
    code: str | None
    not_sent_proven: bool

    @property
    def replay_permitted(self) -> bool:
        return False


def provenance(outcome: Any) -> Provenance:
    """Classify an exception raised by a lease call, or a classified answer `(kind, data)` of lease_answers / capture_lease_route.
    A WisKey code (`Unauthorized`, `invalid_fields`, a `rejected` stage, a `refused` code) is kept WITH its phase and never turned into
    `not_sent` by the code alone; anything unrecognised is UNKNOWN."""
    if isinstance(outcome, CaptureMapError):
        return Provenance("local_preflight", outcome.reason, True)
    if isinstance(outcome, BaseException):
        details = getattr(outcome, "details", None)
        if isinstance(details, dict) and details.get("outcome") == "not_sent":
            return Provenance("transport_not_sent", getattr(outcome, "code", None), True)
        return Provenance("unknown", getattr(outcome, "code", None) or type(outcome).__name__, False)
    if isinstance(outcome, tuple) and len(outcome) == 2 and isinstance(outcome[1], dict):
        kind, data = outcome
        code = data.get("code") if isinstance(data.get("code"), str) else None
        if kind in ("ok", "acknowledged"):
            return Provenance("remote_answer", None, False)
        phase = {"rejected": "remote_rejected", "refused": "remote_refused", "sent_unknown": "sent_unknown"}.get(kind)
        if phase is not None:
            return Provenance(phase, code, False)
    return Provenance("unknown", None, False)
