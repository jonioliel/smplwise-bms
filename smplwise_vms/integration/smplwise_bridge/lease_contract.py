"""The bridge's side of `wiskey-capture-lease-v1` - the request stages (docs/contracts/wiskey-capture-lease/, slice L4 / LEASEBR-295).

Dependency-free (stdlib only; the signature stage is delegated to the key set handed in), so the same code runs inside Home Assistant Core
and in plain unit tests, like `keyset.py` and `signing.py`. The reference model is `smplwise_vms/backend/tests/lease_contract.py` and
`GOLDEN_VECTORS.json` is the oracle; this module is a separate, independent implementation of the same rules.

The stages, in the contract's order - the first failing stage names the refusal, and a refusal carries only a stage and a code (never the
body, a value of it, a key, a nonce or a signature):

1. transport   the service data is exactly `{signed_message_json: <str>}`
2. encoding    strict UTF-8 (no lone surrogate), at most 8192 bytes
3. parse       strict JSON: one object; no duplicate key, NaN / Infinity, float or integer outside +/-(2^53-1)
4. schema      the closed wire, actor and per-action params (the lease object of `capture_start` included)
5. binding     `ts == epoch(issued_at)`, the action belongs to the service, the station scope, the lease window
6. signature   `KeySet.verify` (rotation-aware, see `_verify`; the v1 wire carries NO `kid`)
7. time        clock sane, `0 < expires_at - issued_at <= 15`, `issued_at <= now < expires_at`
8. state       replay (the key set's nonce cache and persisted high-water mark)

`KeySet.verify` checks the MAC FIRST (so a message that did not prove a key is `bad_signature`, whatever else is wrong with it) and then its
own +/-60 s window and the replay cache. The contract wants the time stage before the replay stage, so a `stale` or `replay` verdict
(both only reachable AFTER the MAC proved the key) is held back and the time stage decides first.

What this module hands on (stage 8 belongs to WisKey) is a `LeaseDTO`: immutable, no `ts`, `nonce`, `sig` or `kid`, no secret. Its repr shows
the action only, so a log line cannot carry a label, a station or a reference by accident."""
from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from types import MappingProxyType
from typing import Any, Mapping, Protocol

PROTOCOL = "wiskey-capture-lease-v1"
MAX_MESSAGE_BYTES = 8192
MAX_LIFETIME_S = 15
LEASE_MAX_S = 120
SAFE_MAX = 2**53 - 1
CLOCK_FLOOR = int(datetime(2026, 1, 1, tzinfo=timezone.utc).timestamp())  # a clock earlier than this is "invalid"

EVENT_ACTIONS = ("lease_revoke", "lease_heartbeat", "lease_stream_reset")
REQUEST_ACTIONS = ("capture_start", "capture_status", "capture_confirm", "capture_cancel")
KIND_EVENT, KIND_REQUEST = "event", "request"
KIND_OF = {**{a: KIND_EVENT for a in EVENT_ACTIONS}, **{a: KIND_REQUEST for a in REQUEST_ACTIONS}}
SCOPES = ("lease", "actor", "station", "all")
REVOKE_REASONS = (
    "permission_revision", "actor_disabled", "actor_removed", "access_changed", "session_ended", "abandoned", "second_factor_changed",
    "binding_changed", "receiver_changed", "receiver_offline", "feed_reconnect", "feature_off", "repair", "emergency", "shutdown",
    "person_changed", "clock_invalid", "start_unknown", "host_lost_stream", "unknown_lease_on_host", "ledger_unavailable",
    "key_rotation", "restore", "cancel_unknown",
)
RESET_REASONS = ("startup", "repair", "restore", "key_rotation")

WIRE_KEYS = frozenset({"protocol", "actor", "action", "station", "params", "request_id", "issued_at", "expires_at", "ts", "nonce", "sig"})
# The v1 wire is EXACTLY the closed schema: no `kid` (lease.schema.json). A message signed by a rotated key still verifies, see `_verify`.
SIGNATURE_FIELDS = ("ts", "nonce", "sig")
ACTOR_KEYS = frozenset({"id", "display_name"})
STRING_FIELDS = ("protocol", "action", "station", "request_id", "issued_at", "expires_at", "nonce", "sig")
LEASE_KEYS = frozenset({"lease_ref", "lease_issued_at", "lease_expires_at", "binding_revision", "person_ref", "person_revision", "permission_revision",
                        "receiver", "stream_id", "sequence_at_issue", "lease_actions"})
PARAMS_KEYS = {
    "lease_revoke": frozenset({"stream_id", "sequence", "scope", "lease_ref", "permission_revision", "reason", "revoked_at"}),
    "lease_heartbeat": frozenset({"stream_id", "sequence", "live_leases", "permission_revision"}),
    "lease_stream_reset": frozenset({"stream_id", "previous_stream_id", "sequence", "reason"}),
    "capture_start": frozenset({"lease"}),
    "capture_status": frozenset({"lease_ref", "session_id"}),
    "capture_confirm": frozenset({"lease_ref", "session_id", "label"}),
    "capture_cancel": frozenset({"lease_ref", "session_id"}),
}
UUID_RE = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
HEX32_RE = re.compile(r"[0-9a-f]{32}")
HEX64_RE = re.compile(r"[0-9a-f]{64}")
TIME_RE = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z")

STAGES = ("transport", "encoding", "parse", "schema", "binding", "signature", "time", "state")
POST_SCHEMA_STAGES = ("binding", "signature", "time", "state")
CODES = {
    "transport": ("transport_shape",),
    "encoding": ("invalid_utf8", "lone_surrogate", "message_too_large"),
    "parse": ("invalid_json", "duplicate_key", "non_json_constant", "non_integer_number", "integer_out_of_range", "lone_surrogate", "not_an_object"),
    "schema": ("unknown_field", "missing_field", "wrong_type", "bad_format", "bad_value"),
    "binding": ("ts_mismatch", "action_service_mismatch", "station_scope_mismatch", "lease_window"),
    "signature": ("bad_signature",),
    "time": ("clock_invalid", "lifetime_invalid", "not_yet_valid", "expired"),
    "state": ("replay", "storage_unavailable"),
}


class Verifier(Protocol):
    """`keyset.KeySet` (HA bridge 0.9.5+): None when the message is valid, recent and unseen, else a short reason. `verifiable()` (optional) names
    the key ids the key set currently accepts."""

    def verify(self, message: dict[str, Any], now: float | None = None) -> str | None: ...


def _verify(verifier: Verifier, m: dict[str, Any], now: Any) -> str | None:
    """The key set's verdict for a lease message, whose wire has no `kid`. First the message as it is (kid-less: the pairing secret, while it still
    signs). If that is a bad signature, the sender may have signed with a ROTATED key and left the key id off the wire: try every key id the key set
    accepts, presenting the message with that `kid` (the v2 recipe binds the kid into the MAC, so a key can only verify what was signed for it). The
    first verdict that is not `bad_signature` wins; the key set's own replay and high-water bookkeeping run once, for that key. Nothing is added to
    the DTO and no key id ever leaves."""
    at = now if type(now) is int else None
    verdict = verifier.verify(m, at)
    if verdict != "bad_signature":
        return verdict
    kids = getattr(verifier, "verifiable", None)
    for kid in sorted(kids() if callable(kids) else ()):
        if kid.endswith("-legacy"):
            continue
        again = verifier.verify({**m, "kid": kid}, at)
        if again != "bad_signature":
            return again
    return verdict


class Reject(Exception):
    """A refusal at a named stage. Carries only the stage, the code and - after the schema stage - the request id (never any input text)."""

    def __init__(self, stage: str, code: str, request_id: str | None = None) -> None:
        assert stage in STAGES and code in CODES[stage], (stage, code)
        super().__init__(f"{stage}:{code}")
        self.stage, self.code = stage, code
        self.request_id = request_id if stage in POST_SCHEMA_STAGES else None

    def answer(self) -> dict[str, Any]:
        """The closed `rejected` answer: `request_id` is present iff the schema stage passed (DTO v3 section 9)."""
        out: dict[str, Any] = {"result": "rejected", "stage": self.stage, "code": self.code}
        if self.request_id is not None:
            out["request_id"] = self.request_id
        return out


def _freeze(value: Any) -> Any:
    if isinstance(value, dict):
        return MappingProxyType({k: _freeze(v) for k, v in value.items()})
    if isinstance(value, list):
        return tuple(_freeze(v) for v in value)
    return value


def thaw(value: Any) -> Any:
    if isinstance(value, Mapping):
        return {k: thaw(v) for k, v in value.items()}
    if isinstance(value, tuple):
        return [thaw(v) for v in value]
    return value


@dataclass(frozen=True)
class LeaseDTO:
    """What stages 1-7 hand to WisKey (stage 8). Immutable: frozen and slotted (no `__dict__`, so no `vars(dto)[...]` back door), params are
    read-only mappings / tuples, and `as_json()` returns a fresh copy. `body_sha256` is the seal: the SHA-256 of the signed body, which every
    other field is rebuilt from in `intact()` - so even a write forced past the frozen guard (`object.__setattr__`, which Python cannot forbid)
    is detectable (LEASELIFE-295). The weakref slot lets the bridge remember which DTO objects it issued (lease_service.LeaseCapability).
    The slots are written by hand, not `slots=True`: on Python 3.12 a frozen `slots=True` dataclass answers an assignment to an unknown name
    with a bare TypeError from its own `super()` call instead of FrozenInstanceError."""

    __slots__ = ("action", "actor_id", "actor_display_name", "station", "params", "request_id", "nonce", "issued_at", "expires_at", "body_sha256",
                 "__weakref__")

    action: str
    actor_id: str
    actor_display_name: str
    station: str
    params: Mapping[str, Any]
    request_id: str
    nonce: str
    issued_at: str
    expires_at: str
    body_sha256: str

    @property
    def kind(self) -> str:
        return KIND_OF[self.action]

    def as_json(self) -> dict[str, Any]:
        return {"action": self.action, "actor": {"id": self.actor_id, "display_name": self.actor_display_name}, "station": self.station,
                "params": thaw(self.params), "request_id": self.request_id, "nonce": self.nonce, "issued_at": self.issued_at,
                "expires_at": self.expires_at, "body_sha256": self.body_sha256}

    def intact(self) -> bool:
        """True iff the fields still hash to the seal: the signed body (the wire without ts / nonce / sig) is rebuilt from the DTO alone."""
        try:
            body = {"protocol": PROTOCOL, "actor": {"id": self.actor_id, "display_name": self.actor_display_name}, "action": self.action,
                    "station": self.station, "params": thaw(self.params), "request_id": self.request_id, "issued_at": self.issued_at,
                    "expires_at": self.expires_at}
            return type(self.body_sha256) is str and hashlib.sha256(_canonical(body).encode("utf-8")).hexdigest() == self.body_sha256
        except Exception:  # noqa: BLE001 - a field forced to something unserialisable is simply not intact
            return False

    def __repr__(self) -> str:  # a log line never carries a label, a reference or a station
        return f"LeaseDTO({self.action})"


# ---------------------------------------------------------------- stages 2-3: encoding and parse

def _has_surrogate(s: str) -> bool:
    return any(0xD800 <= ord(c) <= 0xDFFF for c in s)


def _walk_surrogates(root: Any) -> bool:
    stack = [root]
    while stack:
        x = stack.pop()
        if isinstance(x, str):
            if _has_surrogate(x):
                return True
        elif isinstance(x, list):
            stack.extend(x)
        elif isinstance(x, dict):
            for k, y in x.items():
                stack.append(k)
                stack.append(y)
    return False


def loads(text: str) -> dict[str, Any]:
    """Stages `encoding` and `parse` for a `str` (the service data of a Home Assistant call is always text)."""
    if _has_surrogate(text):
        raise Reject("encoding", "lone_surrogate")
    try:
        size = len(text.encode("utf-8"))
    except UnicodeEncodeError:
        raise Reject("encoding", "invalid_utf8") from None
    if size > MAX_MESSAGE_BYTES:
        raise Reject("encoding", "message_too_large")

    def pairs(items: list[tuple[str, Any]]) -> dict[str, Any]:
        seen: dict[str, Any] = {}
        for k, v in items:
            if k in seen:
                raise Reject("parse", "duplicate_key")
            seen[k] = v
        return seen

    def bad_const(_c: str) -> Any:
        raise Reject("parse", "non_json_constant")

    def bad_float(_s: str) -> Any:
        raise Reject("parse", "non_integer_number")

    def checked_int(s: str) -> int:
        digits = s[1:] if s.startswith("-") else s
        if len(digits) > 16:  # also keeps int() away from its digit-count limit
            raise Reject("parse", "integer_out_of_range")
        i = int(s)
        if not -SAFE_MAX <= i <= SAFE_MAX:
            raise Reject("parse", "integer_out_of_range")
        return i

    try:
        value = json.loads(text, object_pairs_hook=pairs, parse_constant=bad_const, parse_float=bad_float, parse_int=checked_int)
    except (json.JSONDecodeError, RecursionError):
        raise Reject("parse", "invalid_json") from None
    if _walk_surrogates(value):
        raise Reject("parse", "lone_surrogate")
    if not isinstance(value, dict):
        raise Reject("parse", "not_an_object")
    return value


# ---------------------------------------------------------------- stage 4: schema

def _int(v: Any, lo: int = 0) -> bool:
    return type(v) is int and v >= lo


def _text(v: Any, max_len: int, empty: bool = False) -> bool:
    return isinstance(v, str) and (empty or len(v) > 0) and len(v) <= max_len and not any(ord(c) < 0x20 or 0x7F <= ord(c) < 0xA0 for c in v)


def _check_keys(obj: Any, want: frozenset[str]) -> None:
    if not isinstance(obj, dict):
        raise Reject("schema", "wrong_type")
    if set(obj) - want:
        raise Reject("schema", "unknown_field")
    if want - set(obj):
        raise Reject("schema", "missing_field")


def parse_time(s: Any) -> int:
    if not isinstance(s, str):
        raise Reject("schema", "wrong_type")
    if not TIME_RE.fullmatch(s):
        raise Reject("schema", "bad_format")
    try:
        return int(datetime.strptime(s, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc).timestamp())
    except ValueError:
        raise Reject("schema", "bad_format") from None


def check_schema(m: dict[str, Any]) -> tuple[int, int]:
    """Stage `schema`: the closed wire, actor and per-action params. Returns (issued_epoch, expires_epoch)."""
    keys = set(m)
    if keys - WIRE_KEYS:
        raise Reject("schema", "unknown_field")
    if WIRE_KEYS - keys:
        raise Reject("schema", "missing_field")
    for f in STRING_FIELDS:
        if not isinstance(m[f], str):
            raise Reject("schema", "wrong_type")
    if type(m["ts"]) is not int or not isinstance(m["actor"], dict) or not isinstance(m["params"], dict):
        raise Reject("schema", "wrong_type")
    if m["protocol"] != PROTOCOL or m["action"] not in PARAMS_KEYS:
        raise Reject("schema", "bad_value")
    if not _text(m["station"], 128):
        raise Reject("schema", "bad_format")
    if not UUID_RE.fullmatch(m["request_id"]) or not HEX32_RE.fullmatch(m["nonce"]) or not HEX64_RE.fullmatch(m["sig"]):
        raise Reject("schema", "bad_format")
    issued, expires = parse_time(m["issued_at"]), parse_time(m["expires_at"])
    _check_keys(m["actor"], ACTOR_KEYS)
    if not (_text(m["actor"]["id"], 128) and _text(m["actor"]["display_name"], 128)):
        raise Reject("schema", "bad_format")
    p, a = m["params"], m["action"]
    _check_keys(p, PARAMS_KEYS[a])
    if a in EVENT_ACTIONS:
        if not isinstance(p["stream_id"], str) or not HEX32_RE.fullmatch(p["stream_id"]):
            raise Reject("schema", "bad_format")
        if not _int(p["sequence"], 1):
            raise Reject("schema", "bad_value")
    if a == "lease_revoke":
        if p["scope"] not in SCOPES or p["reason"] not in REVOKE_REASONS or not _int(p["permission_revision"]):
            raise Reject("schema", "bad_value")
        if not isinstance(p["lease_ref"], str) or not (UUID_RE.fullmatch(p["lease_ref"]) if p["scope"] == "lease" else p["lease_ref"] == "*"):
            raise Reject("schema", "bad_format")
        parse_time(p["revoked_at"])
    elif a == "lease_heartbeat":
        live = p["live_leases"]
        if not isinstance(live, list) or len(live) > 8 or len(set(map(str, live))) != len(live) or not all(isinstance(x, str) and UUID_RE.fullmatch(x) for x in live):
            raise Reject("schema", "bad_value")
        if not _int(p["permission_revision"]):
            raise Reject("schema", "bad_value")
    elif a == "lease_stream_reset":
        if p["sequence"] != 1 or p["reason"] not in RESET_REASONS:
            raise Reject("schema", "bad_value")
        if not isinstance(p["previous_stream_id"], str) or not (p["previous_stream_id"] == "*" or HEX32_RE.fullmatch(p["previous_stream_id"])):
            raise Reject("schema", "bad_format")
    elif a == "capture_start":
        lease = p["lease"]
        _check_keys(lease, LEASE_KEYS)
        if not isinstance(lease["lease_ref"], str) or not UUID_RE.fullmatch(lease["lease_ref"]):
            raise Reject("schema", "bad_format")
        li, le = parse_time(lease["lease_issued_at"]), parse_time(lease["lease_expires_at"])
        if not 0 < le - li <= LEASE_MAX_S:
            raise Reject("schema", "bad_value")
        if lease["binding_revision"] is not None and not _text(lease["binding_revision"], 128):
            raise Reject("schema", "bad_format")
        if not _text(lease["person_ref"], 128) or not (lease["person_revision"] is None or _int(lease["person_revision"])):
            raise Reject("schema", "bad_value")
        if not _int(lease["permission_revision"]) or not _int(lease["sequence_at_issue"]):
            raise Reject("schema", "bad_value")
        _check_keys(lease["receiver"], frozenset({"reader_id"}))
        if not (_int(lease["receiver"]["reader_id"]) and lease["receiver"]["reader_id"] <= 8):
            raise Reject("schema", "bad_value")
        if not isinstance(lease["stream_id"], str) or not HEX32_RE.fullmatch(lease["stream_id"]):
            raise Reject("schema", "bad_format")
        if lease["lease_actions"] != list(REQUEST_ACTIONS):
            raise Reject("schema", "bad_value")
    else:  # capture_status / capture_confirm / capture_cancel
        if not isinstance(p["lease_ref"], str) or not UUID_RE.fullmatch(p["lease_ref"]):
            raise Reject("schema", "bad_format")
        if not _text(p["session_id"], 128):
            raise Reject("schema", "bad_format")
        if a == "capture_confirm" and not _text(p["label"], 64, empty=True):
            raise Reject("schema", "bad_format")
    return issued, expires


# ---------------------------------------------------------------- stages 1-8

def _canonical(body: dict[str, Any]) -> str:
    return json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def validate(kind: str, service_data: Any, verifier: Verifier, now: Any) -> LeaseDTO:
    """Run the stages for one call of the event service (`kind` = KIND_EVENT) or the request service (KIND_REQUEST). `verifier` is the bridge's
    `KeySet`; `now` an integer epoch second. Raises `Reject` (stage, code[, request_id]); returns the immutable DTO for WisKey's stage 8."""
    # 1 transport
    if not isinstance(service_data, dict) or set(service_data) != {"signed_message_json"} or not isinstance(service_data["signed_message_json"], str):
        raise Reject("transport", "transport_shape")
    # 2-3 encoding, parse
    m = loads(service_data["signed_message_json"])
    # 4 schema
    issued, expires = check_schema(m)
    rid = m["request_id"]
    # 5 binding
    if m["ts"] != issued:
        raise Reject("binding", "ts_mismatch", rid)
    if KIND_OF[m["action"]] != kind:
        raise Reject("binding", "action_service_mismatch", rid)
    a, p = m["action"], m["params"]
    wide = a in ("lease_heartbeat", "lease_stream_reset") or (a == "lease_revoke" and p["scope"] == "all")
    if wide != (m["station"] == "*"):
        raise Reject("binding", "station_scope_mismatch", rid)
    if a == "capture_start" and not parse_time(p["lease"]["lease_issued_at"]) <= issued < parse_time(p["lease"]["lease_expires_at"]):
        raise Reject("binding", "lease_window", rid)
    # 6 signature (+ the key set's own window and replay verdicts, held back until the time stage has spoken)
    verdict = _verify(verifier, m, now)
    if verdict not in (None, "stale", "replay"):
        raise Reject("signature", "bad_signature", rid)  # bad_format / bad_signature / anything unknown: the sender did not prove a key
    # 7 time
    if type(now) is not int or now < CLOCK_FLOOR:
        raise Reject("time", "clock_invalid", rid)
    if not 0 < expires - issued <= MAX_LIFETIME_S:
        raise Reject("time", "lifetime_invalid", rid)
    if now < issued:
        raise Reject("time", "not_yet_valid", rid)
    if now >= expires:
        raise Reject("time", "expired", rid)
    if verdict == "stale":  # cannot happen inside a 15 s lifetime; fail closed if the key set's window disagrees
        raise Reject("time", "expired", rid)
    # 8 state
    if verdict == "replay":
        raise Reject("state", "replay", rid)
    body = {k: v for k, v in m.items() if k not in SIGNATURE_FIELDS}
    return LeaseDTO(a, m["actor"]["id"], m["actor"]["display_name"], m["station"], _freeze(p), rid, m["nonce"], m["issued_at"], m["expires_at"],
                    hashlib.sha256(_canonical(body).encode("utf-8")).hexdigest())
