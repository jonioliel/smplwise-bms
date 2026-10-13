"""0.8.1 (CR-040): the trust epoch of this bridge and the ATOMIC rotation of its pairing key - pure logic.

No Home Assistant import (trust_service.py is the thin glue), so the same code runs inside Home Assistant, in plain unit tests and
behind the add-on's fake bridge. Protocol `smplwise-bridge-trust-v1` between the add-on and this bridge only (WisKey is not involved):

- `trust_rotate`: a message signed with the CURRENT key asks to move from epoch `e` (`epoch_from`) to `e + 1`. The bridge derives
  the next key from the current one (HKDF-SHA256 with the message's random salt - no key ever travels), PERSISTS it with the epoch and
  a ledger entry, then swaps the one key every signed service verifies with (`Verifier.secret`, one assignment: the atomic switch -
  there is never an instant with two valid keys), and answers with a proof made with the new key.
- `trust_status`: the read that resolves an UNKNOWN rotation on the add-on's side. It answers whether a rotation request was
  applied; a request it has never seen is FENCED first (written to the ledger as `fenced` and persisted), so the original message can
  never be applied afterwards. The key that verified a status query is the bridge's current key, which is what the add-on decides on.

Rules kept here: one key; validation before any change, in a fixed stage order; a refusal names its stage and code, never input;
nothing can fail after the switch (persist first, then swap, then answer); the ledger is never pruned and the shared nonce cache is
never cleared (anti-replay records are never deleted); nothing about a capability, a mapping or an anchor is touched or claimed (a
rotation is not a re-anchor). No key, salt, proof, nonce or signature is ever logged: `log_fields` keeps only the safe fields."""
from __future__ import annotations

import asyncio
import base64
import copy
import hashlib
import hmac
import json
import re
import time
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable

from .signing import Verifier, sign

PROTOCOL = "smplwise-bridge-trust-v1"
SERVICE_ROTATE = "trust_rotate"
SERVICE_STATUS = "trust_status"
SERVICES = (SERVICE_ROTATE, SERVICE_STATUS)
MAX_MESSAGE_BYTES = 4096
LIFETIME_MAX_S = 30
CLOCK_FLOOR = 1767225600  # 2026-01-01T00:00:00Z: a clock below it is not trusted (as the door DTO)
STORE_VERSION = 1
SAFE_INT = 2**53 - 1
TARGET_APPLIED = "applied"
TARGET_NOT_APPLIED = "not_applied"

WIRE_KEYS = frozenset({"protocol", "action", "actor", "params", "request_id", "issued_at", "expires_at", "ts", "nonce", "sig"})
ACTOR_KEYS = frozenset({"id", "display_name"})
PARAM_KEYS = {SERVICE_ROTATE: frozenset({"epoch_from", "salt"}), SERVICE_STATUS: frozenset({"target_request_id"})}
UUID4 = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
_HEX32 = re.compile(r"^[0-9a-f]{32}$")
_HEX64 = re.compile(r"^[0-9a-f]{64}$")
_ISO = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")
_CTRL = re.compile(r"[\x00-\x1f\x7f-\x9f]")


# ---------------------------------------------------------------- key derivation and proofs (byte-identical in the add-on)

def hkdf_sha256(ikm: bytes, salt: bytes, info: bytes, length: int = 32) -> bytes:
    """RFC 5869 HKDF with SHA-256 (extract, then expand)."""
    if length <= 0 or length > 255 * 32:
        raise ValueError("length")
    prk = hmac.new(salt if salt else b"\x00" * 32, ikm, hashlib.sha256).digest()
    out, block, counter = b"", b"", 1
    while len(out) < length:
        block = hmac.new(prk, block + info + bytes([counter]), hashlib.sha256).digest()
        out += block
        counter += 1
    return out[:length]


def derive_next_key(current_key: str, salt_hex: str, epoch_to: int, request_id: str) -> str:
    """The key of epoch `epoch_to`: HKDF-SHA256(ikm = the current key, salt = the request's random salt, info = protocol, epoch and
    request id), 32 bytes, URL-safe base64 without padding. Bound to the request: another request id or epoch gives another key."""
    info = f"{PROTOCOL}|epoch|{epoch_to}|{request_id}".encode("utf-8")
    okm = hkdf_sha256(current_key.encode("utf-8"), bytes.fromhex(salt_hex), info, 32)
    return base64.urlsafe_b64encode(okm).rstrip(b"=").decode("ascii")


def proof(key: str, kind: str, *fields: Any) -> str:
    """A MAC that only a holder of `key` can make, over the protocol, the answer kind and its fields - domain-separated from the
    message signatures (which MAC "<ts>.<nonce>.<hash>"). It leaves the bridge only inside its own answer and is never logged."""
    text = "|".join([PROTOCOL, kind, *(str(f) for f in fields)])
    return hmac.new(key.encode("utf-8"), text.encode("utf-8"), hashlib.sha256).hexdigest()


# ---------------------------------------------------------------- the persisted state

def new_state(entry_id: str, pairing_id: str, epoch: int = 1, ledger: dict[str, Any] | None = None) -> dict[str, Any]:
    """A pairing's state. `key` None: the config entry's own pairing code is the key (never rotated since this pairing began)."""
    return {"version": STORE_VERSION, "entry_id": entry_id, "pairing_id": pairing_id, "key": None, "epoch": int(epoch), "rotated_at": None,
            "ledger": dict(ledger or {})}


def _valid_epoch(value: Any) -> bool:
    return type(value) is int and 1 <= value <= SAFE_INT


def reconcile(stored: Any, entry_id: str, pairing_id: str, entry_epoch: Any = None) -> dict[str, Any]:
    """The state a config entry starts with. The store wins when it is this entry's AND this pairing's (`pairing_id` changes only when
    the config flow accepts a different pairing code: a re-pair); otherwise a fresh pairing at the config entry's mirrored epoch (1 when
    absent). The ledger is kept in every case - it is never pruned."""
    ledger = stored.get("ledger") if isinstance(stored, dict) and isinstance(stored.get("ledger"), dict) else {}
    if isinstance(stored, dict) and stored.get("entry_id") == entry_id and stored.get("pairing_id") == pairing_id and _valid_epoch(stored.get("epoch")):
        state = new_state(entry_id, pairing_id, stored["epoch"], ledger)
        key = stored.get("key")
        state["key"] = key if isinstance(key, str) and key else None
        state["rotated_at"] = stored.get("rotated_at") if isinstance(stored.get("rotated_at"), str) else None
        return state
    return new_state(entry_id, pairing_id, entry_epoch if _valid_epoch(entry_epoch) else 1, ledger)


def current_key(state: dict[str, Any], entry_code: str) -> str:
    """The one key the bridge verifies with: the rotated key, else the config entry's pairing code."""
    return state.get("key") or entry_code


# ---------------------------------------------------------------- validation

class _Reject(Exception):
    def __init__(self, stage: str, code: str) -> None:
        super().__init__(f"{stage}/{code}")
        self.stage = stage
        self.code = code


def _strict_json(text: str) -> Any:
    def pairs(items: list[tuple[str, Any]]) -> dict[str, Any]:
        out: dict[str, Any] = {}
        for k, v in items:
            if k in out:
                raise _Reject("parse", "duplicate_key")
            out[k] = v
        return out

    def constant(_name: str) -> Any:
        raise _Reject("parse", "non_json_constant")

    def floating(_text: str) -> Any:
        raise _Reject("parse", "non_integer_number")

    def integer(text_: str) -> int:
        value = int(text_)
        if abs(value) > SAFE_INT:
            raise _Reject("parse", "integer_out_of_range")
        return value

    try:
        return json.loads(text, object_pairs_hook=pairs, parse_constant=constant, parse_float=floating, parse_int=integer)
    except _Reject:
        raise
    except (ValueError, RecursionError):
        raise _Reject("parse", "invalid_json") from None


def _has_surrogate(value: Any) -> bool:
    if isinstance(value, str):
        return any(0xD800 <= ord(ch) <= 0xDFFF for ch in value)
    if isinstance(value, dict):
        return any(_has_surrogate(k) or _has_surrogate(v) for k, v in value.items())
    if isinstance(value, list):
        return any(_has_surrogate(v) for v in value)
    return False


def _text_ok(value: str) -> bool:
    """1..128 code points, no C0 / C1 control and no Unicode format character (the door DTO's actor rule)."""
    return 1 <= len(value) <= 128 and not _CTRL.search(value) and not any(unicodedata.category(ch) in ("Cf", "Cs") for ch in value)


def _instant(value: Any) -> int:
    if not isinstance(value, str):
        raise _Reject("schema", "wrong_type")
    if not _ISO.match(value):
        raise _Reject("schema", "bad_format")
    try:
        at = datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    except ValueError:
        raise _Reject("schema", "bad_format") from None
    return int(at.timestamp())


def _schema(msg: Any) -> dict[str, Any]:
    """The closed schema of section 2 (wire, actor, params): unknown, then missing, then types and formats. Returns the parsed
    times; raises _Reject."""
    if not isinstance(msg, dict):
        raise _Reject("parse", "not_an_object")
    keys = set(msg)
    if keys - WIRE_KEYS:
        raise _Reject("schema", "unknown_field")
    if WIRE_KEYS - keys:
        raise _Reject("schema", "missing_field")
    for name in ("protocol", "action", "request_id", "nonce", "sig"):
        if not isinstance(msg[name], str):
            raise _Reject("schema", "wrong_type")
    if not isinstance(msg["actor"], dict) or not isinstance(msg["params"], dict):
        raise _Reject("schema", "wrong_type")
    if type(msg["ts"]) is not int:
        raise _Reject("schema", "wrong_type")
    if msg["protocol"] != PROTOCOL or msg["action"] not in SERVICES:
        raise _Reject("schema", "bad_value")
    actor = msg["actor"]
    if set(actor) - ACTOR_KEYS:
        raise _Reject("schema", "unknown_field")
    if ACTOR_KEYS - set(actor):
        raise _Reject("schema", "missing_field")
    if not all(isinstance(actor[k], str) for k in ACTOR_KEYS):
        raise _Reject("schema", "wrong_type")
    if not all(_text_ok(actor[k]) for k in ACTOR_KEYS):
        raise _Reject("schema", "bad_value")
    params, allowed = msg["params"], PARAM_KEYS[msg["action"]]
    if set(params) - allowed:
        raise _Reject("schema", "unknown_field")
    if allowed - set(params):
        raise _Reject("schema", "missing_field")
    if msg["action"] == SERVICE_ROTATE:
        if type(params["epoch_from"]) is not int or not isinstance(params["salt"], str):
            raise _Reject("schema", "wrong_type")
        if not _valid_epoch(params["epoch_from"]):
            raise _Reject("schema", "bad_value")
        if not _HEX64.match(params["salt"]):
            raise _Reject("schema", "bad_format")
    else:
        if not isinstance(params["target_request_id"], str):
            raise _Reject("schema", "wrong_type")
        if not UUID4.match(params["target_request_id"]):
            raise _Reject("schema", "bad_format")
    if not UUID4.match(msg["request_id"]) or not _HEX32.match(msg["nonce"]) or not _HEX64.match(msg["sig"]):
        raise _Reject("schema", "bad_format")
    return {"issued": _instant(msg["issued_at"]), "expires": _instant(msg["expires_at"])}


# ---------------------------------------------------------------- one trust operation

@dataclass(frozen=True)
class Outcome:
    """What one operation answers, and - only when something must change - the state to persist first and the key to switch to."""
    answer: dict[str, Any]
    state: dict[str, Any] | None = None
    key: str | None = None


def rejected(stage: str, code: str, request_id: str | None = None) -> dict[str, Any]:
    """The closed refusal: `request_id` only once the schema stage passed; never input, never a value."""
    out: dict[str, Any] = {"result": "rejected", "stage": stage, "code": code}
    if request_id is not None:
        out["request_id"] = request_id
    return out


def _iso(now: float) -> str:
    return datetime.fromtimestamp(int(now), tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def process(service: str, data: Any, state: dict[str, Any], key: str, now: float, check_nonce: Callable[[str, float], bool], *, usable: bool = True) -> Outcome:
    """One `trust_rotate` / `trust_status` call against `state`, verified with the bridge's ONE current `key`. Pure: the caller
    persists `Outcome.state` (when set) BEFORE switching to `Outcome.key` (when set) and before answering."""
    request_id: str | None = None
    try:
        # 1 transport
        if not isinstance(data, dict) or set(data) != {"signed_message_json"} or not isinstance(data["signed_message_json"], str):
            raise _Reject("transport", "transport_shape")
        text = data["signed_message_json"]
        # 2 encoding: strict UTF-8 first, then the size in bytes
        try:
            raw = text.encode("utf-8")
        except UnicodeEncodeError:
            raise _Reject("encoding", "lone_surrogate") from None
        if len(raw) > MAX_MESSAGE_BYTES:
            raise _Reject("encoding", "message_too_large")
        # 3 parse
        msg = _strict_json(text)
        if _has_surrogate(msg):
            raise _Reject("parse", "lone_surrogate")
        # 4 schema
        times = _schema(msg)
        request_id = msg["request_id"]
        # 5 binding
        if msg["ts"] != times["issued"]:
            raise _Reject("binding", "ts_mismatch")
        if msg["action"] != service:
            raise _Reject("binding", "action_service_mismatch")
        if service == SERVICE_STATUS and msg["params"]["target_request_id"] == request_id:
            raise _Reject("binding", "target_is_self")
        # 6 signature: the ONE current key, constant time
        body = {k: v for k, v in msg.items() if k not in ("ts", "nonce", "sig")}
        if not hmac.compare_digest(sign(key, body, msg["ts"], msg["nonce"])["sig"], msg["sig"]):
            raise _Reject("signature", "bad_signature")
        # 7 time: no forward skew, a 30 s lifetime at most
        if now < CLOCK_FLOOR:
            raise _Reject("time", "clock_invalid")
        lifetime = times["expires"] - times["issued"]
        if not 0 < lifetime <= LIFETIME_MAX_S:
            raise _Reject("time", "lifetime_invalid")
        if now < times["issued"]:
            raise _Reject("time", "not_yet_valid")
        if now >= times["expires"]:
            raise _Reject("time", "expired")
        # 8 state
        if not usable:
            raise _Reject("state", "storage_unavailable")
        if not check_nonce(msg["nonce"], now):
            raise _Reject("state", "replay")
        ledger = state.get("ledger") or {}
        if request_id in ledger:
            raise _Reject("state", "request_seen")
        epoch = int(state.get("epoch") or 1)
        if service == SERVICE_ROTATE and msg["params"]["epoch_from"] != epoch:
            raise _Reject("state", "epoch_mismatch")
    except _Reject as exc:
        return Outcome(rejected(exc.stage, exc.code, request_id if exc.stage not in ("transport", "encoding", "parse", "schema") else None))
    at = _iso(now)
    if service == SERVICE_ROTATE:
        epoch_to = epoch + 1
        next_key = derive_next_key(key, msg["params"]["salt"], epoch_to, request_id)
        new = copy.deepcopy(state)
        new.update(key=next_key, epoch=epoch_to, rotated_at=at)
        new.setdefault("ledger", {})[request_id] = {"outcome": "applied", "epoch_from": epoch, "epoch_to": epoch_to, "at": at}
        return Outcome({"result": "rotated", "request_id": request_id, "epoch": epoch_to, "proof": proof(next_key, "rotated", request_id, epoch_to)}, new, next_key)
    target = msg["params"]["target_request_id"]
    entry = ledger.get(target)
    new_state_: dict[str, Any] | None = None
    if entry is None:  # never seen: fence it, durably, before saying so
        new_state_ = copy.deepcopy(state)
        new_state_.setdefault("ledger", {})[target] = {"outcome": "fenced", "epoch_from": epoch, "epoch_to": None, "at": at}
        verdict = TARGET_NOT_APPLIED
    else:
        verdict = TARGET_APPLIED if entry.get("outcome") == "applied" else TARGET_NOT_APPLIED
    answer = {"result": "status", "request_id": request_id, "target_request_id": target, "target": verdict, "epoch": epoch,
              "proof": proof(key, "status", request_id, target, verdict, epoch)}
    return Outcome(answer, new_state_)


def log_fields(service: str, answer: dict[str, Any]) -> dict[str, Any]:
    """What may be logged about an answer: never the proof (nor anything of the request: there is nothing else in an answer)."""
    return {"service": service, **{k: v for k, v in answer.items() if k in ("result", "stage", "code", "request_id", "target_request_id", "target", "epoch")}}


# ---------------------------------------------------------------- the runtime (async, still free of Home Assistant)

class TrustRuntime:
    """One config entry's trust state while the bridge runs: the shared Verifier (its key and its nonce cache), the persisted state
    and one lock that every trust operation holds - verification included - so a status query never interleaves with a switch.
    `save` persists a whole state durably (Home Assistant: a private, atomically written Store) and raises when it cannot.
    `on_switch(key, epoch)` mirrors the switch into the config entry (best effort; a failure there changes nothing)."""

    def __init__(self, verifier: Verifier, state: dict[str, Any], save: Callable[[dict[str, Any]], Awaitable[None]], *, usable: bool = True,
                 on_switch: Callable[[str, int], None] | None = None, clock: Callable[[], float] = time.time) -> None:
        self.verifier = verifier
        self.state = state
        self.usable = usable
        self._save = save
        self._on_switch = on_switch
        self._clock = clock
        self._lock: asyncio.Lock | None = None
        self._lock_loop: Any = None

    @property
    def epoch(self) -> int:
        return int(self.state.get("epoch") or 1)

    def _the_lock(self) -> asyncio.Lock:
        loop = asyncio.get_running_loop()
        if self._lock is None or self._lock_loop is not loop:
            self._lock, self._lock_loop = asyncio.Lock(), loop
        return self._lock

    async def handle(self, service: str, data: Any) -> dict[str, Any]:
        async with self._the_lock():
            out = process(service, data, self.state, self.verifier.secret, self._clock(), self.verifier.check_nonce, usable=self.usable)
            if out.state is None:
                return out.answer
            try:
                await self._save(out.state)
            except Exception:  # noqa: BLE001 - nothing was switched and nothing is claimed
                return rejected("state", "storage_unavailable", out.answer.get("request_id"))
            self.state = out.state
            if out.key is not None:
                self.verifier.secret = out.key  # THE atomic switch: one assignment, after the durable write, before the answer
                if self._on_switch is not None:
                    try:
                        self._on_switch(out.key, self.epoch)
                    except Exception:  # noqa: BLE001 - the mirror is best effort; the store is the record
                        pass
            return out.answer
