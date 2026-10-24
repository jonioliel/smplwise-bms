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
setting) and stays False until Mac's table is reviewed; `capture_lease.GO_LIVE_PERMITTED` and `access.capture_lease` are not touched."""
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
                      "wrong_protocol", "wrong_action", "kind_mismatch", "action_mismatch", "wrong_type")
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
    mac_symbol: str | None = None  # PENDING_MAC: WisKey's handler / consumer symbol for this action, from Mac's table
    mac_sha256: str | None = None  # PENDING_MAC: the file sha256 Mac's table names for that symbol


def _row(action: str) -> MapRow:
    kind = KIND_EVENT if action in lease_events.EVENT_ACTIONS else KIND_REQUEST
    service = lease_events.SERVICE_EVENT if kind == KIND_EVENT else lease_events.SERVICE_REQUEST
    classifier = "lease_answers.classify_event" if kind == KIND_EVENT else "capture_lease_route.classify_request"
    return MapRow(action, kind, COMMAND_OF_KIND[kind], "smplwise_bridge." + service, RECEIVER_SYMBOL, classifier)


MAP: tuple[MapRow, ...] = tuple(_row(a) for a in lease_events.ALL_ACTIONS)
ROW_OF = {r.action: r for r in MAP}


def enabled() -> bool:
    return MAPPING_ENABLED is True


def confirmed() -> bool:
    """True only when every row carries Mac's symbol and hash (never in this build)."""
    return all(r.mac_symbol and r.mac_sha256 for r in MAP)


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
    return {"state": value, "receiver_symbol": RECEIVER_SYMBOL, "mac_mapping": "CONFIRMED" if confirmed() else "PENDING_MAC",
            "installation": "NOT_PERFORMED", "live": "NOT_MEASURED"}
