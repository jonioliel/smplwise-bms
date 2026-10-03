"""Golden vectors for the WisKey trusted-caller (door_open) signing contract, regenerated from the EXISTING signers.

The vectors file `docs/contracts/wiskey-trusted-caller/GOLDEN_VECTORS.json` is derived here, case by case, from the
production signing code as it is today: the add-on's `smplwise.services.ha_bridge.sign` and the bridge integration's
`custom_components/smplwise_bridge/signing.sign`. Nothing in production code changes; this module only observes.

- `pytest tests/test_wiskey_golden_vectors.py` fails on any drift between the file and what the signers produce now.
- `python tests/test_wiskey_golden_vectors.py --write` rewrites the file (only after a deliberate, reviewed change:
  a serialization change needs a new protocol version, see the README next to the vectors).

vectors_version 2 adds `contract` and `contract_vectors` (the DTO draft in DTO_DRAFT.md) and a STRICT reference
parser/validator that exists in this TEST module only. It is not product code and no product code imports it; it proves
that every reject vector is refused before any pending record or dispatch and that every accept vector passes. The v1
`vectors` array is pinned by hash and must not change.

The HMAC key below is a TEST CONSTANT. It is not, and must never become, a pairing secret of any installation.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import math
import re
import sys
from dataclasses import FrozenInstanceError, dataclass
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any

BACKEND = Path(__file__).resolve().parents[1]
REPO = BACKEND.parents[1]
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))
if str(BACKEND / "tests") not in sys.path:
    sys.path.insert(0, str(BACKEND / "tests"))

import bridge_loader  # noqa: E402
from smplwise.services import ha_bridge  # noqa: E402

bridge_signing = bridge_loader.load("signing")

VECTORS_FILE = REPO / "docs" / "contracts" / "wiskey-trusted-caller" / "GOLDEN_VECTORS.json"

# TEST CONSTANT - deliberately fake, publishable, never a real pairing secret.
TEST_SECRET = "TEST-ONLY-golden-vectors-key-NOT-A-REAL-SECRET"
GENERIC_TS = int(datetime(2026, 10, 3, 12, 0, 0, tzinfo=timezone.utc).timestamp())
GENERIC_NONCE = "00000000000000000000000000000000"
PROTOCOL = "wiskey-trusted-door-v1"
SAFE_MAX = 2**53 - 1

# ---------------------------------------------------------------- independent RFC 8785 (JCS) reference, for comparison only


def _jcs_string(s: str) -> str:
    out = ['"']
    for ch in s:
        o = ord(ch)
        if 0xD800 <= o <= 0xDFFF:
            raise ValueError("lone surrogate is not I-JSON")
        if ch == '"':
            out.append('\\"')
        elif ch == "\\":
            out.append("\\\\")
        elif ch in "\b\t\n\f\r":
            out.append({"\b": "\\b", "\t": "\\t", "\n": "\\n", "\f": "\\f", "\r": "\\r"}[ch])
        elif o < 0x20:
            out.append(f"\\u{o:04x}")
        else:
            out.append(ch)
    out.append('"')
    return "".join(out)


def _jcs_number(v: int | float) -> str:
    """ECMAScript Number.prototype.toString of the IEEE-754 double nearest to `v` (RFC 8785 section 3.2.2.3)."""
    f = float(v)
    if math.isnan(f) or math.isinf(f):
        raise ValueError("NaN/Infinity are not JSON")
    if f == 0:
        return "0"
    sign = "-" if f < 0 else ""
    # repr gives the shortest round-trip digits, the same digit selection ECMAScript uses
    t = Decimal(repr(abs(f))).normalize().as_tuple()
    digits = "".join(map(str, t.digits))
    k = len(digits)
    n = k + int(t.exponent)  # value = 0.digits x 10^n
    if k <= n <= 21:
        s = digits + "0" * (n - k)
    elif 0 < n <= 21:
        s = digits[:n] + "." + digits[n:]
    elif -6 < n <= 0:
        s = "0." + "0" * (-n) + digits
    else:
        ex = n - 1
        s = digits[0] + ("." + digits[1:] if k > 1 else "") + "e" + ("+" if ex >= 0 else "-") + str(abs(ex))
    return sign + s


def jcs(v: Any) -> str:
    if v is None:
        return "null"
    if v is True:
        return "true"
    if v is False:
        return "false"
    if isinstance(v, (int, float)):
        return _jcs_number(v)
    if isinstance(v, str):
        return _jcs_string(v)
    if isinstance(v, list):
        return "[" + ",".join(jcs(x) for x in v) + "]"
    if isinstance(v, dict):
        keys = sorted(v, key=lambda k: k.encode("utf-16-be"))  # UTF-16 code-unit order
        return "{" + ",".join(_jcs_string(k) + ":" + jcs(v[k]) for k in keys) + "}"
    raise TypeError(type(v))


# ---------------------------------------------------------------- the existing signer, observed


def current_canonical(body: dict[str, Any]) -> str:
    """The exact expression both production signers use today (asserted against them below)."""
    return json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _sign_both(body: dict[str, Any], ts: int, nonce: str) -> dict[str, Any]:
    a = ha_bridge.sign(TEST_SECRET, body, ts, nonce)
    b = bridge_signing.sign(TEST_SECRET, body, ts, nonce)
    assert a == b, "the add-on signer and the bridge signer disagree"
    return a


def _signed_fields(body: dict[str, Any], ts: int, nonce: str) -> dict[str, Any]:
    canonical = current_canonical(body)
    raw = canonical.encode("utf-8")
    body_sha = hashlib.sha256(raw).hexdigest()
    hmac_input = f"{ts}.{nonce}.{body_sha}"
    mac = hmac.new(TEST_SECRET.encode("utf-8"), hmac_input.encode("utf-8"), hashlib.sha256).hexdigest()
    signed = _sign_both(body, ts, nonce)
    assert signed["sig"] == mac, "the documented HMAC recipe no longer matches the production signer"
    out: dict[str, Any] = {
        "canonical_utf8": canonical,
        "canonical_hex": raw.hex(),
        "body_sha256": body_sha,
        "ts": ts,
        "nonce": nonce,
        "hmac_input": hmac_input,
        "hmac_sha256": mac,
    }
    try:
        j = jcs(body)
        out["jcs_utf8"] = j
        out["jcs_equal"] = j == canonical
    except ValueError as e:
        out["jcs_utf8"] = None
        out["jcs_equal"] = False
        out["jcs_note"] = str(e)
    return out


def _strict_loads(text: str) -> Any:
    """Contract parser: rejects duplicate keys, NaN/Infinity, floats and integers outside the safe range."""

    def pairs(items: list[tuple[str, Any]]) -> dict[str, Any]:
        seen: dict[str, Any] = {}
        for k, v in items:
            if k in seen:
                raise ValueError(f"duplicate key {k!r}")
            seen[k] = v
        return seen

    def bad_const(c: str) -> Any:
        raise ValueError(f"non-JSON constant {c}")

    def bad_float(s: str) -> Any:
        raise ValueError(f"non-integer number {s}")

    def checked_int(s: str) -> int:
        i = int(s)
        if not -SAFE_MAX <= i <= SAFE_MAX:
            raise ValueError(f"integer outside the safe range {s}")
        return i

    v = json.loads(text, object_pairs_hook=pairs, parse_constant=bad_const, parse_float=bad_float, parse_int=checked_int)

    def walk(x: Any) -> None:
        if isinstance(x, str):
            if any(0xD800 <= ord(c) <= 0xDFFF for c in x):
                raise ValueError("lone surrogate")
        elif isinstance(x, list):
            for y in x:
                walk(y)
        elif isinstance(x, dict):
            for k, y in x.items():
                walk(k)
                walk(y)

    walk(v)
    return v


# ---------------------------------------------------------------- envelope schema (the field set agreed in round 4)

ENVELOPE_KEYS = {"protocol", "actor", "action", "station", "params", "request_id", "nonce", "issued_at", "expires_at"}
ACTOR_KEYS = {"id", "display_name"}
PARAMS_KEYS = {"door_open": {"relay"}, "door_open_status": set()}


def envelope_errors(env: dict[str, Any]) -> list[str]:
    errs = []
    if set(env) != ENVELOPE_KEYS:
        errs.append(f"envelope keys {sorted(set(env) ^ ENVELOPE_KEYS)}")
    if env.get("protocol") != PROTOCOL:
        errs.append("protocol")
    actor = env.get("actor")
    if not isinstance(actor, dict) or set(actor) != ACTOR_KEYS:
        errs.append("actor keys")
    action = env.get("action")
    if action not in PARAMS_KEYS:
        errs.append("action")
    params = env.get("params")
    if not isinstance(params, dict) or set(params) != PARAMS_KEYS.get(action, set()):
        errs.append("params keys")
    elif "relay" in params and (type(params["relay"]) is not int or not 0 <= params["relay"] <= SAFE_MAX):
        errs.append("relay")
    return errs


def _epoch(rfc3339: str) -> int:
    return int(datetime.strptime(rfc3339, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc).timestamp())


def envelope_vector(env: dict[str, Any]) -> dict[str, Any]:
    """How the EXISTING signer/verifier pair carries an envelope: the envelope `nonce` is the signing nonce (it goes
    into the HMAC input, not into the hashed body, because `Verifier.verify` strips ts/nonce/sig before hashing), and
    `ts` is the epoch second of `issued_at`."""
    nonce = env["nonce"]
    ts = _epoch(env["issued_at"])
    signed_body = {k: v for k, v in env.items() if k != "nonce"}
    fields = _signed_fields(signed_body, ts, nonce)
    wire = _sign_both(signed_body, ts, nonce)
    assert wire["nonce"] == nonce
    assert bridge_signing.Verifier(TEST_SECRET).verify(dict(wire), now=ts) is None
    return {"envelope": env, "signed_body": signed_body, **fields, "wire_message_json": json.dumps(wire, ensure_ascii=False, separators=(",", ":"))}


DOOR_OPEN = {
    "protocol": PROTOCOL,
    "actor": {"id": "test-user-0001", "display_name": "משתמש בדיקה \"ראשי\""},
    "action": "door_open",
    "station": "test_station_entrance",
    "params": {"relay": 1},
    "request_id": "3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b",
    "nonce": "a1b2c3d4e5f60718293a4b5c6d7e8f90",
    "issued_at": "2026-10-03T12:00:00Z",
    "expires_at": "2026-10-03T12:00:30Z",
}
DOOR_OPEN_STATUS = {
    "protocol": PROTOCOL,
    "actor": {"id": "test-user-0001", "display_name": "משתמש בדיקה \"ראשי\""},
    "action": "door_open_status",
    "station": "test_station_entrance",
    "params": {},
    "request_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "nonce": "0f1e2d3c4b5a69788796a5b4c3d2e1f0",
    "issued_at": "2026-10-03T12:00:05Z",
    "expires_at": "2026-10-03T12:00:35Z",
}

# ---------------------------------------------------------------- the cases

ACCEPT = [
    ("key_order_ascii", "Keys arrive out of order; output is sorted. ASCII code-point order: digits < upper case < '_' < lower case; a prefix sorts first.",
     '{"b":1,"a":1,"B":1,"_":1,"1":1,"aa":1,"a_":1,"A":1}'),
    ("nested_objects", "Every nested object is sorted too; arrays keep their order (arrays of objects included).",
     '{"z":{"y":{"x":1,"w":[{"b":2,"a":1},{"d":4,"c":3}]},"a":[3,1,2]},"m":{}}'),
    ("hebrew_values_and_keys", "Hebrew in values and keys is emitted as raw UTF-8 (no \\u escapes); Hebrew keys sort after ASCII by code point.",
     '{"\\u05e9\\u05dd":"\\u05d3\\u05dc\\u05ea \\u05e8\\u05d0\\u05e9\\u05d9\\u05ea","name":"\\u05d3\\u05dc\\u05ea","\\u05d0":1}'),
    ("non_ascii_mixed", "Arabic, CJK, accented Latin, a non-BMP emoji (U+1F6AA DOOR) and an RTL mark, all raw UTF-8.",
     '{"ar":"\\u0628\\u0627\\u0628","cjk":"\\u95e8","latin":"Caf\\u00e9","emoji":"\\ud83d\\udeaa","rlm":"a\\u200fb"}'),
    ("unicode_no_normalization_nfc", "U+00E9 precomposed: no Unicode normalization is applied (compare with the NFD case).",
     '{"s":"\\u00e9"}'),
    ("unicode_no_normalization_nfd", "e + U+0301 combining: a different byte string and a different hash from the NFC case.",
     '{"s":"e\\u0301"}'),
    ("escape_sequences", "Escapes: quote, backslash, \\b \\f \\n \\r \\t short forms, other C0 controls as lower-case \\u00XX; '/', DEL, U+2028/U+2029 stay raw.",
     '{"q":"\\"","bs":"\\\\","ctl":"\\b\\f\\n\\r\\t","nul":"\\u0000","us":"\\u001f","slash":"\\/","del":"\\u007f","ls":"\\u2028\\u2029"}'),
    ("integers_boundaries", "Integers 0, negative, and both ends of the safe range (+/-(2^53-1)) are emitted as plain decimal.",
     '{"zero":0,"neg":-1,"min_safe":-9007199254740991,"max_safe":9007199254740991,"one":1}'),
    ("booleans_null", "true/false/null as literals, in objects and arrays.",
     '{"t":true,"f":false,"n":null,"arr":[true,false,null]}'),
    ("empty_containers", "Empty object (empty params), empty array and empty string.",
     '{"params":{},"list":[],"s":""}'),
    ("empty_body", "The empty object.", "{}"),
]

DIVERGENCE = [
    ("jcs_key_order_non_bmp", "Key order differs from JCS: Python sorts by code point, JCS by UTF-16 code unit, so a non-BMP key (surrogate D83D...) sorts BEFORE U+E000 in JCS and AFTER it here. Not reachable with the envelope's fixed ASCII keys.",
     '{"\\ue000":1,"\\ud83d\\ude00":2}', "accept_but_not_jcs"),
    ("jcs_float_spelling", "Floats differ from JCS: Python repr spelling (1.0, 100.0, 1e-07, 1e+16, -0.0) vs ECMAScript (1, 100, 1e-7, 10000000000000000, 0). The contract forbids floats.",
     '{"a":1.0,"b":100.0,"c":1e-7,"d":1e16,"e":-0.0,"f":0.1,"g":1.5}', "reject"),
]

REJECT_RAW = [
    ("reject_int_2pow53", "2^53 is outside the safe integer range: reject.", '{"n":9007199254740992}', "integer outside the safe range"),
    ("reject_int_2pow53_plus1", "2^53+1: the existing signer emits the exact digits, JCS (IEEE-754) would emit 9007199254740992. Reject.", '{"n":9007199254740993}', "integer outside the safe range"),
    ("reject_int_neg_2pow53", "-(2^53): reject.", '{"n":-9007199254740992}', "integer outside the safe range"),
    ("reject_nan", "NaN is not JSON; Python's json accepts and emits it. Reject.", '{"n":NaN}', "non-JSON constant"),
    ("reject_infinity", "Infinity is not JSON. Reject.", '{"n":Infinity}', "non-JSON constant"),
    ("reject_duplicate_key_flat", "Duplicate key: Python's json.loads silently keeps the LAST value. Reject.", '{"a":1,"a":2}', "duplicate key"),
    ("reject_duplicate_key_nested", "Duplicate key inside a nested object. Reject.", '{"params":{"relay":1,"relay":2}}', "duplicate key"),
    ("reject_lone_surrogate", "A lone surrogate: the existing signer cannot produce bytes (UnicodeEncodeError). Reject.", '{"s":"\\ud800"}', "lone surrogate"),
]


def _env_json(env: dict[str, Any]) -> str:
    return json.dumps(env, ensure_ascii=False, separators=(",", ":"))


def _dup_station_text() -> str:
    t = _env_json(DOOR_OPEN)
    return t.replace('"station":"test_station_entrance"', '"station":"test_station_entrance","station":"test_station_other"')


REJECT_ENVELOPE = [
    ("reject_envelope_duplicate_station", "door_open with `station` twice. Python's json.loads keeps the last; the HMAC over that collapsed body would VERIFY. Reject at parse time.",
     _dup_station_text(), "duplicate key"),
    ("reject_envelope_unknown_top_field", "door_open plus an unknown top-level `capability`. The existing signer signs it and the existing verifier ACCEPTS the HMAC. Reject by schema.",
     _env_json({**DOOR_OPEN, "capability": "x"}), "unknown field"),
    ("reject_envelope_unknown_actor_field", "Unknown field inside actor (`role`). HMAC valid; reject by schema.",
     _env_json({**DOOR_OPEN, "actor": {**DOOR_OPEN["actor"], "role": "admin"}}), "unknown field"),
    ("reject_envelope_unknown_params_field", "Unknown field inside params (`duration_s`). HMAC valid; reject by schema.",
     _env_json({**DOOR_OPEN, "params": {"relay": 1, "duration_s": 5}}), "unknown field"),
    ("reject_envelope_relay_float", "relay as 1.0 (a float). Python canonicalizes it as 1.0, a JavaScript parser cannot tell it from 1. Reject.",
     _env_json(DOOR_OPEN).replace('"relay":1', '"relay":1.0'), "non-integer number"),
    ("reject_envelope_relay_out_of_range", "relay = 2^53. Reject.",
     _env_json(DOOR_OPEN).replace('"relay":1', '"relay":9007199254740992'), "integer outside the safe range"),
]


def _current_behaviour(text: str) -> dict[str, Any]:
    """What the existing code does with this input if nothing rejects it first: stdlib json.loads, then sign()."""
    body = json.loads(text)
    try:
        if isinstance(body, dict) and "nonce" in body and "issued_at" in body:  # an envelope: carried as in envelope_vector
            nonce, ts = body["nonce"], _epoch(body["issued_at"])
            signed_body = {k: v for k, v in body.items() if k != "nonce"}
        else:
            nonce, ts, signed_body = GENERIC_NONCE, GENERIC_TS, body
        f = _signed_fields(signed_body, ts, nonce)
        wire = _sign_both(signed_body, ts, nonce)
        f["existing_verifier_accepts_hmac"] = bridge_signing.Verifier(TEST_SECRET).verify(dict(wire), now=ts) is None
        f.pop("jcs_note", None)
        return {"signer_error": None, **{k: f[k] for k in ("canonical_utf8", "canonical_hex", "body_sha256", "hmac_sha256", "jcs_utf8", "jcs_equal", "existing_verifier_accepts_hmac")}}
    except UnicodeEncodeError as e:
        return {"signer_error": f"UnicodeEncodeError: {e.reason}"}


# ================================================================ vectors_version 2: the DTO draft contract (test code only)
#
# Everything below is a REFERENCE for the draft contract in docs/contracts/wiskey-trusted-caller/DTO_DRAFT.md. It lives
# in test code on purpose: there is no door_open / door_open_status service in product code, and this module must not
# become one. It proves, vector by vector, that every reject case is refused before any pending record or dispatch and
# that every accept case passes, with the expected immutable DTO.

VECTORS_VERSION = 2
# SHA-256 of the canonical form of the vectors_version 1 `vectors` array (29 vectors, Arx commit 9b05abbb). The v1 array
# must stay byte-for-byte what WisKey verified; the v2 cases live in `contract_vectors`.
V1_VECTORS_SHA256 = "3bb4bb2240e5586fed3e276699ed071b9fcec09dc84162f85f3833ce76b17520"
V1_FILE_SHA256 = "fd39b7ecc7bf71ef909cd148caed111231b0965e90fe602dfe277979d30389c8"

MAX_LIFETIME_S = 30
CLOCK_FLOOR = int(datetime(2026, 1, 1, tzinfo=timezone.utc).timestamp())  # a clock earlier than this is "invalid"
WIRE_KEYS = frozenset({"protocol", "actor", "action", "station", "params", "request_id", "issued_at", "expires_at", "ts", "nonce", "sig"})
V2_ACTOR_KEYS = frozenset({"id", "display_name"})
V2_PARAMS_KEYS = {"door_open": frozenset({"relay"}), "door_open_status": frozenset({"target_request_id"})}
STRING_FIELDS = ("protocol", "action", "station", "request_id", "issued_at", "expires_at", "nonce", "sig")
MAX_ACTOR_ID = 128
MAX_DISPLAY_NAME = 128
MAX_STATION = 128
UUID_RE = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
HEX32_RE = re.compile(r"[0-9a-f]{32}")
HEX64_RE = re.compile(r"[0-9a-f]{64}")
TIME_RE = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z")

STAGES = ("transport", "encoding", "parse", "schema", "binding", "signature", "time", "state")
CODES = {
    "transport": ("transport_shape",),
    "encoding": ("invalid_utf8", "lone_surrogate"),
    "parse": ("invalid_json", "duplicate_key", "non_json_constant", "non_integer_number", "integer_out_of_range", "lone_surrogate", "not_an_object"),
    "schema": ("unknown_field", "missing_field", "wrong_type", "bad_format", "bad_value"),
    "binding": ("ts_mismatch", "action_service_mismatch", "target_is_self"),
    "signature": ("bad_signature",),
    "time": ("clock_invalid", "lifetime_invalid", "not_yet_valid", "expired"),
    "state": ("replay", "request_id_conflict", "station_mismatch", "relay_not_allowed"),
}


class ContractReject(Exception):
    """A refusal at a named stage. Carries only the stage and the code: never the body or the offending text."""

    def __init__(self, stage: str, code: str) -> None:
        assert stage in STAGES and code in CODES[stage], (stage, code)
        super().__init__(f"{stage}:{code}")
        self.stage = stage
        self.code = code


@dataclass(frozen=True)
class TrustedDoorDTO:
    """The immutable internal DTO the bridge hands to WisKey's trusted Python API. No secret, no signature, no ts."""

    protocol: str
    actor: tuple[tuple[str, str], ...]
    action: str
    station: str
    params: tuple[tuple[str, Any], ...]
    request_id: str
    nonce: str
    issued_at: str
    expires_at: str
    body_sha256: str
    authenticated_message_sha256: str

    def as_json(self) -> dict[str, Any]:
        return {"protocol": self.protocol, "actor": dict(self.actor), "action": self.action, "station": self.station,
                "params": dict(self.params), "request_id": self.request_id, "nonce": self.nonce, "issued_at": self.issued_at,
                "expires_at": self.expires_at, "body_sha256": self.body_sha256,
                "authenticated_message_sha256": self.authenticated_message_sha256}


def _has_surrogate(s: str) -> bool:
    return any(0xD800 <= ord(c) <= 0xDFFF for c in s)


def contract_loads(text: str | bytes) -> dict[str, Any]:
    """Stages `encoding` and `parse`. `bytes` input exists only for the invalid-UTF-8 vector (a Python str cannot hold
    invalid UTF-8; inside HA the REST layer fails first)."""
    if isinstance(text, bytes):
        try:
            text = text.decode("utf-8")  # strict
        except UnicodeDecodeError:
            raise ContractReject("encoding", "invalid_utf8") from None
    if _has_surrogate(text):
        raise ContractReject("encoding", "lone_surrogate")

    def pairs(items: list[tuple[str, Any]]) -> dict[str, Any]:
        seen: dict[str, Any] = {}
        for k, v in items:
            if k in seen:
                raise ContractReject("parse", "duplicate_key")
            seen[k] = v
        return seen

    def bad_const(_c: str) -> Any:
        raise ContractReject("parse", "non_json_constant")

    def bad_float(_s: str) -> Any:
        raise ContractReject("parse", "non_integer_number")

    def checked_int(s: str) -> int:
        i = int(s)
        if not -SAFE_MAX <= i <= SAFE_MAX:
            raise ContractReject("parse", "integer_out_of_range")
        return i

    try:
        v = json.loads(text, object_pairs_hook=pairs, parse_constant=bad_const, parse_float=bad_float, parse_int=checked_int)
    except json.JSONDecodeError:
        raise ContractReject("parse", "invalid_json") from None

    def walk(x: Any) -> None:
        if isinstance(x, str):
            if _has_surrogate(x):
                raise ContractReject("parse", "lone_surrogate")
        elif isinstance(x, list):
            for y in x:
                walk(y)
        elif isinstance(x, dict):
            for k, y in x.items():
                walk(k)
                walk(y)

    walk(v)
    if not isinstance(v, dict):
        raise ContractReject("parse", "not_an_object")
    return v


def _parse_time(s: str) -> int:
    if not TIME_RE.fullmatch(s):
        raise ContractReject("schema", "bad_format")
    try:
        return int(datetime.strptime(s, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc).timestamp())
    except ValueError:
        raise ContractReject("schema", "bad_format") from None


def _plain_text(s: str, max_len: int) -> bool:
    return 0 < len(s) <= max_len and not any(ord(c) < 0x20 or 0x7F <= ord(c) < 0xA0 for c in s)


def contract_schema(m: dict[str, Any]) -> tuple[int, int]:
    """Stage `schema`: closed schema at wire, actor and params level. Returns (issued_epoch, expires_epoch)."""
    keys = set(m)
    if keys - WIRE_KEYS:
        raise ContractReject("schema", "unknown_field")
    if WIRE_KEYS - keys:
        raise ContractReject("schema", "missing_field")
    for f in STRING_FIELDS:
        if not isinstance(m[f], str):
            raise ContractReject("schema", "wrong_type")
    if type(m["ts"]) is not int or not isinstance(m["actor"], dict) or not isinstance(m["params"], dict):
        raise ContractReject("schema", "wrong_type")
    if m["protocol"] != PROTOCOL or m["action"] not in V2_PARAMS_KEYS:
        raise ContractReject("schema", "bad_value")
    if not _plain_text(m["station"], MAX_STATION):
        raise ContractReject("schema", "bad_format")
    if not UUID_RE.fullmatch(m["request_id"]) or not HEX32_RE.fullmatch(m["nonce"]) or not HEX64_RE.fullmatch(m["sig"]):
        raise ContractReject("schema", "bad_format")
    issued, expires = _parse_time(m["issued_at"]), _parse_time(m["expires_at"])
    actor = m["actor"]
    if set(actor) - V2_ACTOR_KEYS:
        raise ContractReject("schema", "unknown_field")
    if V2_ACTOR_KEYS - set(actor):
        raise ContractReject("schema", "missing_field")
    if not isinstance(actor["id"], str) or not isinstance(actor["display_name"], str):
        raise ContractReject("schema", "wrong_type")
    if not _plain_text(actor["id"], MAX_ACTOR_ID) or not _plain_text(actor["display_name"], MAX_DISPLAY_NAME):
        raise ContractReject("schema", "bad_format")
    params, want = m["params"], V2_PARAMS_KEYS[m["action"]]
    if set(params) - want:
        raise ContractReject("schema", "unknown_field")
    if want - set(params):
        raise ContractReject("schema", "missing_field")
    if m["action"] == "door_open":
        if type(params["relay"]) is not int:  # bool is not int here
            raise ContractReject("schema", "wrong_type")
        if params["relay"] < 1:
            raise ContractReject("schema", "bad_value")
    else:
        if not isinstance(params["target_request_id"], str):
            raise ContractReject("schema", "wrong_type")
        if not UUID_RE.fullmatch(params["target_request_id"]):
            raise ContractReject("schema", "bad_format")
    return issued, expires


def _digests(m: dict[str, Any]) -> tuple[str, str, str]:
    signed_body = {k: v for k, v in m.items() if k not in ("ts", "nonce", "sig")}
    body_sha = hashlib.sha256(current_canonical(signed_body).encode("utf-8")).hexdigest()
    hmac_input = f"{m['ts']}.{m['nonce']}.{body_sha}"
    return body_sha, hmac_input, hashlib.sha256(hmac_input.encode("utf-8")).hexdigest()


def contract_validate(service: str, service_data: Any, now: int | None, secret: str = TEST_SECRET,
                      raw_inner: bytes | None = None) -> TrustedDoorDTO:
    """The draft validation order, stateless part (stages transport .. time). Stage `state` (replay, request_id,
    station vs open record, relay range, capability) needs the bridge/WisKey store and is not modelled here."""
    # transport
    if raw_inner is not None:
        text: str | bytes = raw_inner
    else:
        if not isinstance(service_data, dict) or set(service_data) != {"signed_message_json"} or not isinstance(service_data["signed_message_json"], str):
            raise ContractReject("transport", "transport_shape")
        text = service_data["signed_message_json"]
    # encoding + parse
    m = contract_loads(text)
    # schema
    issued, expires = contract_schema(m)
    # binding
    if m["ts"] != issued:
        raise ContractReject("binding", "ts_mismatch")
    if m["action"] != service:
        raise ContractReject("binding", "action_service_mismatch")
    if m["action"] == "door_open_status" and m["params"]["target_request_id"] == m["request_id"]:
        raise ContractReject("binding", "target_is_self")
    # signature
    body_sha, hmac_input, auth_sha = _digests(m)
    expected = hmac.new(secret.encode("utf-8"), hmac_input.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, m["sig"]):
        raise ContractReject("signature", "bad_signature")
    # time
    if type(now) is not int or now < CLOCK_FLOOR:
        raise ContractReject("time", "clock_invalid")
    if not 0 < expires - issued <= MAX_LIFETIME_S:
        raise ContractReject("time", "lifetime_invalid")
    if now < issued:
        raise ContractReject("time", "not_yet_valid")
    if now >= expires:
        raise ContractReject("time", "expired")
    return TrustedDoorDTO(
        protocol=m["protocol"], actor=tuple(sorted(m["actor"].items())), action=m["action"], station=m["station"],
        params=tuple(sorted(m["params"].items())), request_id=m["request_id"], nonce=m["nonce"], issued_at=m["issued_at"],
        expires_at=m["expires_at"], body_sha256=body_sha, authenticated_message_sha256=auth_sha)


class FakeWisKey:
    """Records what would happen after validation. A reject must leave both lists empty."""

    def __init__(self) -> None:
        self.pending: list[str] = []
        self.calls: list[tuple[str, str]] = []

    def reference_handle(self, service: str, service_data: Any, now: int | None, raw_inner: bytes | None = None) -> TrustedDoorDTO:
        dto = contract_validate(service, service_data, now, raw_inner=raw_inner)  # raises before anything below
        if dto.action == "door_open":
            self.pending.append(dto.request_id)
            self.calls.append(("open", dto.request_id))
        else:
            self.calls.append(("status_query", dict(dto.params)["target_request_id"]))  # never a pending, never an open
        return dto


def stateful_check(dto: TrustedDoorDTO, store: dict[str, Any]) -> str | None:
    """A toy of stage `state`, only to show what the stateful vectors mean. The real store is WisKey's SQLite."""
    if dto.nonce in store["nonces"] and store["nonces"][dto.nonce] != dto.request_id:
        return "replay"
    if dto.action == "door_open":
        rec = store["requests"].get(dto.request_id)
        meaning = (dto.protocol, dto.actor, dto.action, dto.station, dto.params)
        if rec is not None and rec["meaning"] != meaning:
            return "request_id_conflict"
        if dict(dto.params)["relay"] not in store["allowed_relays"].get(dto.station, ()):
            return "relay_not_allowed"
        return None
    rec = store["requests"].get(dict(dto.params)["target_request_id"])
    if rec is not None and rec["station"] != dto.station:
        return "station_mismatch"
    return None


# ---------------------------------------------------------------- v2 case construction

ISSUED = "2026-10-03T12:00:00Z"
T0 = _epoch(ISSUED)
STATUS_REQUEST_ID = "5b0c7d1a-2e3f-4a5b-9c6d-7e8f9a0b1c2d"
STATUS_NONCE = "c0ffee00c0ffee00c0ffee00c0ffee00"
V2_STATUS = {**DOOR_OPEN_STATUS, "params": {"target_request_id": DOOR_OPEN["request_id"]}, "request_id": STATUS_REQUEST_ID,
             "nonce": STATUS_NONCE, "issued_at": "2026-10-03T12:00:05Z", "expires_at": "2026-10-03T12:00:35Z"}


def _iso(epoch: int) -> str:
    return datetime.fromtimestamp(epoch, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _signed_wire(env: dict[str, Any], *, ts: Any = None, wire_nonce: Any = None, hmac_ts: Any = None,
                 secret: str = TEST_SECRET) -> dict[str, Any]:
    """Wire message from an envelope (nonce included), signed with the documented recipe. `ts`/`wire_nonce` override
    what is put on the wire (type vectors); the HMAC uses `hmac_ts` (default: the wire ts) and the wire nonce, spelled
    as the existing verifier would (`int(ts)`, `str(nonce)`), so the HMAC is valid wherever that is meaningful."""
    nonce = env["nonce"] if wire_nonce is None else wire_nonce
    if ts is None:
        ts = _epoch(env["issued_at"]) if TIME_RE.fullmatch(str(env["issued_at"])) else T0
    signed_body = {k: v for k, v in env.items() if k != "nonce"}
    sha = hashlib.sha256(current_canonical(signed_body).encode("utf-8")).hexdigest()
    hts = ts if hmac_ts is None else hmac_ts
    sig = hmac.new(secret.encode("utf-8"), f"{hts}.{nonce}.{sha}".encode("utf-8"), hashlib.sha256).hexdigest()
    if type(ts) is int and isinstance(nonce, str) and secret == TEST_SECRET and hmac_ts is None:
        assert _sign_both(signed_body, ts, nonce)["sig"] == sig  # same bytes as the production signers
    return {**signed_body, "ts": ts, "nonce": nonce, "sig": sig}


def _text(wire: dict[str, Any]) -> str:
    return json.dumps(wire, ensure_ascii=False, separators=(",", ":"))


def _service_data_json(inner: str, ascii_only: bool = False) -> str:
    return json.dumps({"signed_message_json": inner}, ensure_ascii=ascii_only, separators=(",", ":"))


# Each case: id, category, service, expect, stage, code, now, reason, and exactly ONE of:
#   wire (dict -> inner text), inner (exact inner text), service_data (dict as the bridge receives it), raw_inner (bytes)
# Every reject case carries exactly one defect, so stage AND code are both binding for a conforming implementation.

def _cases() -> list[dict[str, Any]]:
    C: list[dict[str, Any]] = []

    def add(vid: str, category: str, expect: str, stage: str | None, code: str | None, reason: str, *, service: str = "door_open",
            now: int | None = T0, **payload: Any) -> None:
        C.append({"id": vid, "category": category, "service": service, "expect": expect, "reject_stage": stage,
                  "reject_code": code, "now": now, "reason": reason, **payload})

    base = _signed_wire(DOOR_OPEN)

    # --- types
    add("types_ts_string", "types", "reject", "schema", "wrong_type", "ts is the string \"<epoch>\". The existing verifier coerces it with int(); the contract does not.",
        wire=_signed_wire(DOOR_OPEN, ts=str(T0)))
    add("types_ts_float", "types", "reject", "parse", "non_integer_number", "ts is <epoch>.0. Floats are refused while parsing; the existing verifier would truncate it.",
        inner=_text(base).replace(f'"ts":{T0}', f'"ts":{T0}.0'))
    add("types_ts_bool", "types", "reject", "schema", "wrong_type", "ts is true. A boolean is not an integer (Python bool is an int subclass; the check must be exact).",
        wire=_signed_wire(DOOR_OPEN, ts=True, hmac_ts=T0))
    add("types_ts_mismatch", "types", "reject", "binding", "ts_mismatch", "ts = epoch(issued_at) + 1. Correctly signed, but ts must equal the epoch seconds of issued_at.",
        wire=_signed_wire(DOOR_OPEN, ts=T0 + 1))
    add("types_nonce_number", "types", "reject", "schema", "wrong_type", "nonce is the number 12345. The existing verifier would str() it.",
        wire=_signed_wire(DOOR_OPEN, wire_nonce=12345))
    add("types_nonce_16_hex", "types", "reject", "schema", "bad_format", "nonce has 16 hex chars: the existing signer's default (secrets.token_hex(8)). v1 requires 32; Arx passes it explicitly.",
        wire=_signed_wire({**DOOR_OPEN, "nonce": "a1b2c3d4e5f60718"}))
    add("types_nonce_uppercase", "types", "reject", "schema", "bad_format", "nonce in upper-case hex. Only lower-case is accepted (no case folding).",
        wire=_signed_wire({**DOOR_OPEN, "nonce": DOOR_OPEN["nonce"].upper()}))
    add("types_relay_bool", "types", "reject", "schema", "wrong_type", "relay is true.",
        wire=_signed_wire({**DOOR_OPEN, "params": {"relay": True}}))
    add("types_relay_string", "types", "reject", "schema", "wrong_type", "relay is the string \"1\".",
        wire=_signed_wire({**DOOR_OPEN, "params": {"relay": "1"}}))
    add("types_relay_zero", "types", "reject", "schema", "bad_value", "relay is 0. relay must be a positive integer.",
        wire=_signed_wire({**DOOR_OPEN, "params": {"relay": 0}}))
    add("types_relay_negative", "types", "reject", "schema", "bad_value", "relay is -1.",
        wire=_signed_wire({**DOOR_OPEN, "params": {"relay": -1}}))
    add("types_relay_positive_2", "types", "accept", None, None, "relay 2 passes the schema. Whether station test_station_entrance has relay 2 is WisKey's per-station check (stage state).",
        wire=_signed_wire({**DOOR_OPEN, "params": {"relay": 2}}))
    add("types_action_open_door", "types", "reject", "schema", "bad_value", "action \"open_door\" (the wrong name from an earlier draft). Only door_open and door_open_status exist.",
        wire=_signed_wire({**DOOR_OPEN, "action": "open_door"}))
    add("types_protocol_unknown", "types", "reject", "schema", "bad_value", "protocol wiskey-trusted-door-v2 is not known to a v1 verifier.",
        wire=_signed_wire({**DOOR_OPEN, "protocol": "wiskey-trusted-door-v2"}))
    add("types_extra_wire_field", "types", "reject", "schema", "unknown_field", "Extra signed top-level field `capability`. HMAC valid; closed schema refuses it.",
        wire=_signed_wire({**DOOR_OPEN, "capability": "x"}))
    add("types_extra_actor_field", "types", "reject", "schema", "unknown_field", "Extra field `role` inside actor. HMAC valid.",
        wire=_signed_wire({**DOOR_OPEN, "actor": {**DOOR_OPEN["actor"], "role": "admin"}}))
    add("types_extra_params_field", "types", "reject", "schema", "unknown_field", "Extra field `duration_s` inside params. HMAC valid.",
        wire=_signed_wire({**DOOR_OPEN, "params": {"relay": 1, "duration_s": 5}}))
    add("types_missing_request_id", "types", "reject", "schema", "missing_field", "request_id absent. HMAC valid over the shorter body.",
        wire=_signed_wire({k: v for k, v in DOOR_OPEN.items() if k != "request_id"}))
    add("types_request_id_not_uuid", "types", "reject", "schema", "bad_format", "request_id is not a lower-case hyphenated UUID.",
        wire=_signed_wire({**DOOR_OPEN, "request_id": "req-0001"}))
    add("types_actor_id_number", "types", "reject", "schema", "wrong_type", "actor.id is a number.",
        wire=_signed_wire({**DOOR_OPEN, "actor": {"id": 1, "display_name": DOOR_OPEN["actor"]["display_name"]}}))
    add("types_station_empty", "types", "reject", "schema", "bad_format", "station is the empty string.",
        wire=_signed_wire({**DOOR_OPEN, "station": ""}))

    # --- time
    add("time_lifetime_30_ok", "time", "accept", None, None, "expires_at - issued_at = 30 s (the maximum); now = issued_at.", wire=base)
    add("time_last_valid_second", "time", "accept", None, None, "now = expires_at - 1: the last accepted second.", wire=base, now=T0 + 29)
    add("time_lifetime_31", "time", "reject", "time", "lifetime_invalid", "expires_at - issued_at = 31 s.",
        wire=_signed_wire({**DOOR_OPEN, "expires_at": _iso(T0 + 31)}))
    add("time_lifetime_zero", "time", "reject", "time", "lifetime_invalid", "expires_at == issued_at.",
        wire=_signed_wire({**DOOR_OPEN, "expires_at": ISSUED}))
    add("time_lifetime_negative", "time", "reject", "time", "lifetime_invalid", "expires_at < issued_at.",
        wire=_signed_wire({**DOOR_OPEN, "expires_at": _iso(T0 - 1)}))
    add("time_future_issued_at_1s", "time", "reject", "time", "not_yet_valid", "now = issued_at - 1. v1 allows no future skew (open question: tolerate up to 2 s?).",
        wire=base, now=T0 - 1)
    add("time_exact_expiry", "time", "reject", "time", "expired", "now == expires_at: rejected exactly at expiry (now < expires_at is required).", wire=base, now=T0 + 30)
    add("time_expired", "time", "reject", "time", "expired", "now = expires_at + 1.", wire=base, now=T0 + 31)
    add("time_clock_unavailable", "time", "reject", "time", "clock_invalid", "No valid clock (now = null). An invalid clock blocks; it never passes.", wire=base, now=None)
    add("time_clock_before_floor", "time", "reject", "time", "clock_invalid", "now = 0 (1970): earlier than the clock floor 2026-01-01T00:00:00Z, treated as an invalid clock.", wire=base, now=0)
    add("time_offset_not_z", "time", "reject", "schema", "bad_format", "issued_at written as +00:00 instead of Z (same instant). Only the Z form is accepted.",
        wire=_signed_wire({**DOOR_OPEN, "issued_at": "2026-10-03T12:00:00+00:00"}, ts=T0))
    add("time_lowercase_z", "time", "reject", "schema", "bad_format", "expires_at with a lower-case z.",
        wire=_signed_wire({**DOOR_OPEN, "expires_at": "2026-10-03T12:00:30z"}))
    add("time_fractional_seconds", "time", "reject", "schema", "bad_format", "issued_at with fractional seconds (.000Z). Whole seconds only.",
        wire=_signed_wire({**DOOR_OPEN, "issued_at": "2026-10-03T12:00:00.000Z"}, ts=T0))
    add("time_invalid_calendar_date", "time", "reject", "schema", "bad_format", "expires_at 2026-02-30: right shape, not a date.",
        wire=_signed_wire({**DOOR_OPEN, "issued_at": "2026-02-30T12:00:00Z", "expires_at": "2026-02-30T12:00:30Z"}, ts=T0))

    # --- status
    st_now = _epoch(V2_STATUS["issued_at"])
    add("status_with_target", "status", "accept", None, None, "door_open_status with params.target_request_id = the door_open request_id; own request_id and nonce; same station.",
        service="door_open_status", wire=_signed_wire(V2_STATUS), now=st_now)
    add("status_missing_target", "status", "reject", "schema", "missing_field", "door_open_status with empty params (the v1 envelope_door_open_status shape, re-signed here).",
        service="door_open_status", wire=_signed_wire({**V2_STATUS, "params": {}}), now=st_now)
    add("status_target_not_uuid", "status", "reject", "schema", "bad_format", "target_request_id is not a UUID.",
        service="door_open_status", wire=_signed_wire({**V2_STATUS, "params": {"target_request_id": "not-a-uuid"}}), now=st_now)
    add("status_target_uppercase_uuid", "status", "reject", "schema", "bad_format", "target_request_id in upper case. Lower-case only, no case folding.",
        service="door_open_status", wire=_signed_wire({**V2_STATUS, "params": {"target_request_id": DOOR_OPEN["request_id"].upper()}}), now=st_now)
    add("status_carrying_relay", "status", "reject", "schema", "unknown_field", "door_open_status params also carry relay. Status params are exactly {target_request_id}.",
        service="door_open_status", wire=_signed_wire({**V2_STATUS, "params": {"target_request_id": DOOR_OPEN["request_id"], "relay": 1}}), now=st_now)
    add("status_target_is_self", "status", "reject", "binding", "target_is_self", "target_request_id equals the status message's own request_id.",
        service="door_open_status", wire=_signed_wire({**V2_STATUS, "params": {"target_request_id": STATUS_REQUEST_ID}}), now=st_now)
    add("status_sent_to_door_open_service", "status", "reject", "binding", "action_service_mismatch", "A valid door_open_status message delivered to the door_open service.",
        service="door_open", wire=_signed_wire(V2_STATUS), now=st_now)
    add("door_open_sent_to_status_service", "status", "reject", "binding", "action_service_mismatch", "A valid door_open message delivered to the door_open_status service: it must not open and must not query.",
        service="door_open_status", wire=base)
    add("status_station_mismatch_vs_open_record", "status", "stateful", "state", "station_mismatch",
        "Well-formed status for the door_open request but station test_station_side. Passes every stateless stage; the bridge/WisKey store must refuse it because the open record has station test_station_entrance.",
        service="door_open_status", wire=_signed_wire({**V2_STATUS, "station": "test_station_side"}), now=st_now,
        state_setup="door_open request 3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b recorded for station test_station_entrance")
    add("status_target_unknown", "status", "stateful", None, None,
        "Well-formed status for a request the store has never seen (or purged after 7 days). Not a rejection: the response is unknown / not_found_or_expired; no pending, no open.",
        service="door_open_status", wire=_signed_wire({**V2_STATUS, "params": {"target_request_id": "00000000-0000-4000-8000-000000000000"}}), now=st_now,
        state_setup="empty store", stateful_expectation={"result": "unknown", "reason": "not_found_or_expired", "pending_created": False, "door_opened": False})

    # --- stateful door_open cases (described; the toy store in the test demonstrates them)
    add("state_duplicate_identical", "state", "stateful", None, None,
        "The exact envelope_door_open wire delivered a second time after it completed. Not executed again: the stored result is returned.",
        wire=base, state_setup="the same request_id/nonce/meaning already completed",
        stateful_expectation={"result": "stored_result", "second_dispatch": False})
    add("state_request_id_reused_other_meaning", "state", "stateful", "state", "request_id_conflict",
        "Same request_id, a new nonce, relay 2 instead of 1. Refused: one request_id, one meaning.",
        wire=_signed_wire({**DOOR_OPEN, "params": {"relay": 2}, "nonce": "11111111111111111111111111111111"}),
        state_setup="request 3f2b8c1e-... recorded with relay 1")
    add("state_nonce_reused_other_request", "state", "stateful", "state", "replay",
        "The nonce of envelope_door_open reused by a different request_id. Refused as replay.",
        wire=_signed_wire({**DOOR_OPEN, "request_id": "9d3e5f7a-1b2c-4d4e-8f6a-7b8c9d0e1f2a"}),
        state_setup="nonce a1b2c3d4... recorded for request 3f2b8c1e-...")
    add("state_relay_outside_station_range", "state", "stateful", "state", "relay_not_allowed",
        "relay 99 passes the schema; the station's allowed relay range (WisKey to confirm per station) refuses it before any pending.",
        wire=_signed_wire({**DOOR_OPEN, "params": {"relay": 99}, "request_id": "2a4c6e80-1357-4b9d-8ace-02468ace1357",
                           "nonce": "22222222222222222222222222222222"}),
        state_setup="a fresh request (new request_id and nonce); test_station_entrance allows relay 1 only")

    # --- signature
    tampered = {**base, "station": "test_station_other"}
    add("signature_tampered_station", "signature", "reject", "signature", "bad_signature", "station changed after signing.", wire=tampered)
    add("signature_nonce_changed", "signature", "reject", "signature", "bad_signature",
        "nonce changed after signing. nonce is not in body_sha256 but it is in hmac_input (and in authenticated_message_sha256).",
        wire={**base, "nonce": "ffffffffffffffffffffffffffffffff"})
    add("signature_wrong_key", "signature", "reject", "signature", "bad_signature", "Signed with a different (also public, fake) key.",
        wire=_signed_wire(DOOR_OPEN, secret="TEST-ONLY-some-other-fake-key"))
    add("signature_uppercase_sig", "signature", "reject", "schema", "bad_format", "sig in upper-case hex. Lower-case 64 hex only.",
        wire={**base, "sig": base["sig"].upper()})

    # --- transport (the string envelope)
    add("transport_envelope_door_open", "transport", "accept", None, None,
        "v1 vector envelope_door_open, carried as service_data {\"signed_message_json\": <wire_message_json>}.", wire=base)
    add("transport_envelope_door_open_status_v1", "transport", "reject", "schema", "missing_field",
        "v1 vector envelope_door_open_status in the string envelope. Valid serialization, but not a complete v2 status query (no target_request_id).",
        service="door_open_status", wire=_signed_wire(DOOR_OPEN_STATUS), now=_epoch(DOOR_OPEN_STATUS["issued_at"]))
    dup = _text(base).replace('"station":"test_station_entrance"', '"station":"test_station_other","station":"test_station_entrance"')
    add("transport_duplicate_station_in_string", "transport", "reject", "parse", "duplicate_key",
        "station twice INSIDE signed_message_json. The outer service_data is a valid one-key object; the bridge parses the string itself and refuses the duplicate. A plain json.loads would keep the last value and the HMAC would verify.",
        inner=dup)
    add("transport_duplicate_actor_id_nested", "transport", "reject", "parse", "duplicate_key", "Duplicate actor.id inside the string (nested object).",
        inner=_text(base).replace('"id":"test-user-0001"', '"id":"test-user-0002","id":"test-user-0001"'))
    add("transport_duplicate_params_relay_nested", "transport", "reject", "parse", "duplicate_key", "Duplicate params.relay inside the string.",
        inner=_text(base).replace('"relay":1', '"relay":2,"relay":1'))
    add("transport_wire_as_object", "transport", "reject", "transport", "transport_shape",
        "service_data IS the wire message as an object (the pre-v2 shape). Refused: duplicates would already have collapsed before the bridge sees it.",
        service_data=base)
    add("transport_signed_message_not_string", "transport", "reject", "transport", "transport_shape", "signed_message_json holds an object, not a string.",
        service_data={"signed_message_json": base})
    add("transport_extra_outer_key", "transport", "reject", "transport", "transport_shape", "service_data has a second key next to signed_message_json.",
        service_data={"signed_message_json": _text(base), "station": "test_station_other"})
    add("transport_missing_outer_key", "transport", "reject", "transport", "transport_shape", "service_data is empty.", service_data={})
    add("transport_inner_not_object", "transport", "reject", "parse", "not_an_object", "signed_message_json is a JSON array.", inner="[]")
    add("transport_inner_invalid_json", "transport", "reject", "parse", "invalid_json", "signed_message_json is truncated JSON.", inner=_text(base)[:-1])
    add("transport_inner_lone_surrogate_escape", "transport", "reject", "parse", "lone_surrogate",
        "actor.display_name contains the escape \\ud800 inside the string; it decodes to a lone surrogate. sig is a placeholder (the signer cannot encode it); the refusal happens before signature checking.",
        inner=_text({**base, "sig": "0" * 64}).replace('"display_name":"', '"display_name":"\\ud800', 1))
    add("transport_outer_lone_surrogate", "transport", "reject", "encoding", "lone_surrogate",
        "The OUTER JSON escapes a lone surrogate (\\ud800) into the string value itself, so signed_message_json reaches the bridge already holding U+D800. Refused before parsing. Only service_data_json is given: the inner string cannot be written as UTF-8.",
        outer_surrogate=True)
    add("transport_inner_invalid_utf8", "transport", "reject", "encoding", "invalid_utf8",
        "The inner message as bytes with 0xFF inside actor.display_name. Given as hex only (a JSON string cannot hold it); inside HA the REST layer fails first. Implementations that receive bytes must decode strictly.",
        raw_inner=_text(base).encode("utf-8").replace("משתמש".encode("utf-8"), b"\xff" + "משתמש".encode("utf-8"), 1))
    collapsed_outer = '{"signed_message_json":"garbage","signed_message_json":' + json.dumps(_text(base), ensure_ascii=False) + "}"
    add("transport_outer_duplicate_collapsed_by_ha", "transport", "accept", None, None,
        "The OUTER service_data JSON repeats signed_message_json. HA parses the REST body before the bridge and keeps the last value, so the bridge receives one key and cannot see the duplicate. Harmless: all meaning is inside the signed string. Arx must never send this; listed to show the outer/inner difference.",
        service_data_json_override=collapsed_outer, service_data={"signed_message_json": _text(base)})
    return C


def _expected_dto(wire: dict[str, Any]) -> dict[str, Any]:
    """Built independently of contract_validate: envelope fields plus the two digests."""
    body_sha, hmac_input, auth_sha = _digests(wire)
    return {k: wire[k] for k in ("protocol", "actor", "action", "station", "params", "request_id", "nonce", "issued_at", "expires_at")} | {
        "body_sha256": body_sha, "authenticated_message_sha256": auth_sha}


def build_contract_vectors() -> list[dict[str, Any]]:
    out = []
    for c in _cases():
        v: dict[str, Any] = {k: c[k] for k in ("id", "category", "expect", "reason", "reject_stage", "reject_code", "service", "now")}
        v["now_iso"] = None if c["now"] is None else _iso(c["now"])
        if "wire" in c:
            inner = _text(c["wire"])
            v["signed_message_json"] = inner
            v["service_data_json"] = _service_data_json(inner)
        elif "inner" in c:
            v["signed_message_json"] = c["inner"]
            v["service_data_json"] = _service_data_json(c["inner"])
        elif "raw_inner" in c:
            v["signed_message_json"] = None
            v["signed_message_utf8_hex"] = c["raw_inner"].hex()
            v["service_data_json"] = None
        elif c.get("outer_surrogate"):
            inner = _text(_signed_wire(DOOR_OPEN)).replace('"display_name":"', '"display_name":"\ud800', 1)
            v["signed_message_json"] = None
            v["service_data_json"] = _service_data_json(inner, ascii_only=True)
        else:
            v["signed_message_json"] = None
            v["service_data_json"] = c.get("service_data_json_override") or json.dumps(c["service_data"], ensure_ascii=False, separators=(",", ":"))
            if "service_data_json_override" in c:
                v["service_data_as_received_by_bridge"] = c["service_data"]
        if "state_setup" in c:
            v["state_setup"] = c["state_setup"]
        if "stateful_expectation" in c:
            v["stateful_expectation"] = c["stateful_expectation"]
        if c["expect"] in ("accept", "stateful") and v["signed_message_json"] is not None or "service_data_json_override" in c:
            wire = json.loads(v["signed_message_json"] or c["service_data"]["signed_message_json"])
            body_sha, hmac_input, auth_sha = _digests(wire)
            v["signed_body"] = {k: x for k, x in wire.items() if k not in ("ts", "nonce", "sig")}
            v["canonical_utf8"] = current_canonical(v["signed_body"])
            v["body_sha256"] = body_sha
            v["hmac_input"] = hmac_input
            v["authenticated_message_sha256"] = auth_sha
            v["sig"] = wire["sig"]
            v["expected_dto"] = _expected_dto(wire)
        out.append(v)
    return out


def _service_data_for(v: dict[str, Any]) -> tuple[Any, bytes | None]:
    """What the bridge handler receives for a contract vector: HA's (stdlib) parse of service_data_json."""
    if v.get("signed_message_utf8_hex"):
        return None, bytes.fromhex(v["signed_message_utf8_hex"])
    if "service_data_as_received_by_bridge" in v:
        return v["service_data_as_received_by_bridge"], None
    return json.loads(v["service_data_json"]), None


def build_document() -> dict[str, Any]:
    vectors: list[dict[str, Any]] = []
    for vid, desc, text in ACCEPT:
        body = _strict_loads(text)
        vectors.append({"id": vid, "expect": "accept", "description": desc, "input_json": text, **_signed_fields(body, GENERIC_TS, GENERIC_NONCE)})
    for env, vid, desc in ((DOOR_OPEN, "envelope_door_open", "door_open envelope as carried by the existing signer."),
                           (DOOR_OPEN_STATUS, "envelope_door_open_status", "door_open_status envelope (read-only query, empty params).")):
        text = _env_json(env)
        assert _strict_loads(text) == env and envelope_errors(env) == []
        vectors.append({"id": vid, "expect": "accept", "description": desc, "input_json": text, **envelope_vector(env)})
    for vid, desc, text, expect in DIVERGENCE:
        body = json.loads(text)
        v = {"id": vid, "expect": expect, "description": desc, "input_json": text, **_signed_fields(body, GENERIC_TS, GENERIC_NONCE)}
        if expect == "reject":
            v["reject_reason"] = "non-integer number"
        vectors.append(v)
    for vid, desc, text, reason in REJECT_RAW + REJECT_ENVELOPE:
        vectors.append({"id": vid, "expect": "reject", "reject_reason": reason, "description": desc, "input_json": text,
                        "current_code_if_not_rejected": _current_behaviour(text)})
    return {
        "format": "smplwise-arx/wiskey-trusted-caller/golden-vectors",
        "format_version": 1,
        "protocol": PROTOCOL,
        "generated_by": "smplwise_vms/backend/tests/test_wiskey_golden_vectors.py (from the existing Arx signers; do not edit by hand)",
        "test_hmac_key": {
            "value": TEST_SECRET,
            "encoding": "UTF-8 bytes of the string are the HMAC key",
            "warning": "TEST CONSTANT ONLY. Publicly known. Never use as, or derive, a pairing secret.",
        },
        "recipe": {
            "canonical": "json.dumps(body, sort_keys=True, separators=(',', ':'), ensure_ascii=False) -> UTF-8 bytes",
            "body_sha256": "lower-case hex SHA-256 of the canonical UTF-8 bytes",
            "hmac_input": "ASCII string f'{ts}.{nonce}.{body_sha256}' (ts = decimal epoch seconds)",
            "hmac_sha256": "lower-case hex HMAC-SHA256(key=UTF-8(test_hmac_key.value), msg=UTF-8(hmac_input))",
            "wire": "the signed body plus ts, nonce and sig as top-level fields; the verifier removes ts, nonce and sig before hashing",
            "envelope_mapping": "envelope.nonce is the signing nonce (in hmac_input, NOT in the hashed body); ts = epoch seconds of issued_at",
        },
        "generic_ts": GENERIC_TS,
        "generic_nonce": GENERIC_NONCE,
        "vectors": vectors,
        "vectors_version": VECTORS_VERSION,
        "vectors_version_history": [
            {"vectors_version": 1, "arx_commit": "9b05abbb", "file_sha256": V1_FILE_SHA256,
             "content": "the `vectors` array (29 vectors); unchanged since, its canonical SHA-256 is pinned in the test"},
            {"vectors_version": 2, "content": "adds `contract` and `contract_vectors` for the DTO draft (DTO_DRAFT.md); `vectors` untouched"},
        ],
        "contract": {
            "status": "DRAFT, Arx position 2026-10-04, pending WisKey agreement; see DTO_DRAFT.md",
            "transport": "service_data = {\"signed_message_json\": <wire message JSON as ONE string>}; nothing else",
            "wire_fields": sorted(WIRE_KEYS),
            "actor_fields": sorted(V2_ACTOR_KEYS),
            "params_fields": {k: sorted(v) for k, v in V2_PARAMS_KEYS.items()},
            "max_lifetime_s": MAX_LIFETIME_S,
            "clock_floor": _iso(CLOCK_FLOOR),
            "validation_stages_in_order": list(STAGES),
            "codes": {k: list(v) for k, v in CODES.items()},
            "now": "evaluation time in epoch seconds (null = no valid clock); now_iso is the same instant",
            "digests": {
                "body_sha256": "lower-case hex SHA-256 of the canonical signed_body (wire minus ts, nonce, sig)",
                "authenticated_message_sha256": "lower-case hex SHA-256 of UTF-8(hmac_input), hmac_input = f'{ts}.{nonce}.{body_sha256}'",
            },
            "expect_values": {
                "accept": "passes every stateless stage; expected_dto is the DTO handed to WisKey",
                "reject": "refused at reject_stage with reject_code, before any pending record or dispatch",
                "stateful": "passes every stateless stage; the outcome depends on the bridge/WisKey store (state_setup, reject_code or stateful_expectation)",
            },
        },
        "contract_vectors": build_contract_vectors(),
    }


def render(doc: dict[str, Any]) -> str:
    return json.dumps(doc, ensure_ascii=False, indent=2) + "\n"


# ---------------------------------------------------------------- tests


def test_vectors_file_has_not_drifted():
    assert VECTORS_FILE.read_text(encoding="utf-8") == render(build_document()), (
        "GOLDEN_VECTORS.json differs from what the existing signers produce. If a signer changed, that is a protocol "
        "change (new protocol version), not a vectors refresh.")


def test_canonical_expression_is_the_one_in_both_signers():
    body = {"b": [1, {"d": "ש", "c": None}], "a": True}
    for signer in (ha_bridge.sign, bridge_signing.sign):
        sig = signer(TEST_SECRET, body, GENERIC_TS, GENERIC_NONCE)["sig"]
        sha = hashlib.sha256(current_canonical(body).encode()).hexdigest()
        assert sig == hmac.new(TEST_SECRET.encode(), f"{GENERIC_TS}.{GENERIC_NONCE}.{sha}".encode(), hashlib.sha256).hexdigest()


def test_jcs_reference_matches_rfc8785_number_examples():
    # RFC 8785 appendix B samples (IEEE-754 values given by their decimal spelling here)
    for v, want in [(0.0, "0"), (-0.0, "0"), (1e21, "1e+21"), (1e-7, "1e-7"), (333333333.3333333, "333333333.3333333"),
                    (9007199254740991, "9007199254740991"), (9007199254740993, "9007199254740992"), (1e20, "100000000000000000000"),
                    (0.000001, "0.000001"), (1e16, "10000000000000000"), (1.5, "1.5"), (100.0, "100")]:
        assert _jcs_number(v) == want, (v, _jcs_number(v))


def test_every_accept_vector_equals_jcs_except_the_documented_divergences():
    doc = build_document()
    for v in doc["vectors"]:
        if v["expect"] == "accept":
            assert v["jcs_equal"] is True, v["id"]
        if v["id"].startswith("jcs_"):
            assert v["jcs_equal"] is False, v["id"]


def test_reject_vectors_are_rejected_by_the_contract_parser_and_schema():
    for _vid, _desc, text, reason in REJECT_RAW + REJECT_ENVELOPE:
        try:
            env = _strict_loads(text)
        except ValueError as e:
            assert reason in str(e), (text, e)
            continue
        assert reason == "unknown field" and envelope_errors(env), text


def test_documented_gaps_of_the_existing_code():
    # duplicate keys: stdlib json keeps the last value, so a collapsed duplicate verifies
    assert json.loads('{"a":1,"a":2}') == {"a": 2}
    doc = {v["id"]: v for v in build_document()["vectors"]}
    assert doc["reject_envelope_duplicate_station"]["current_code_if_not_rejected"]["existing_verifier_accepts_hmac"] is True
    # unknown fields: the HMAC alone does not reject them
    for vid in ("reject_envelope_unknown_top_field", "reject_envelope_unknown_actor_field", "reject_envelope_unknown_params_field"):
        assert doc[vid]["current_code_if_not_rejected"]["existing_verifier_accepts_hmac"] is True
    # lone surrogate: the signer cannot produce bytes at all
    assert doc["reject_lone_surrogate"]["current_code_if_not_rejected"]["signer_error"].startswith("UnicodeEncodeError")
    # out-of-safe-range integers keep their exact digits (JCS would round)
    cur = doc["reject_int_2pow53_plus1"]["current_code_if_not_rejected"]
    assert cur["canonical_utf8"] == '{"n":9007199254740993}' and cur["jcs_utf8"] == '{"n":9007199254740992}'
    # NaN is emitted as a bare token
    assert doc["reject_nan"]["current_code_if_not_rejected"]["canonical_utf8"] == '{"n":NaN}'
    # the existing window is 60 s on both sides; the trusted-caller contract asks for 30 s (enforced via expires_at)
    assert ha_bridge.SIGNATURE_WINDOW_S == 60 and bridge_signing.SIGNATURE_WINDOW_S == 60


def test_envelope_tamper_breaks_the_hmac():
    v = {x["id"]: x for x in build_document()["vectors"]}["envelope_door_open"]
    wire = json.loads(v["wire_message_json"])
    for field, value in (("station", "test_station_other"), ("params", {"relay": 2}), ("expires_at", "2026-10-03T12:05:00Z")):
        assert bridge_signing.Verifier(TEST_SECRET).verify({**wire, field: value}, now=wire["ts"]) == "bad_signature"
    assert bridge_signing.Verifier(TEST_SECRET).verify({**wire, "nonce": "ffffffffffffffffffffffffffffffff"}, now=wire["ts"]) == "bad_signature"


# ---------------------------------------------------------------- tests: vectors_version 2 (DTO draft)


def _v1_vectors_sha(vectors: list[dict[str, Any]]) -> str:
    return hashlib.sha256(json.dumps(vectors, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()


def test_v1_vectors_are_unchanged():
    assert _v1_vectors_sha(build_document()["vectors"]) == V1_VECTORS_SHA256
    assert _v1_vectors_sha(json.loads(VECTORS_FILE.read_text(encoding="utf-8"))["vectors"]) == V1_VECTORS_SHA256


def test_contract_vectors_are_well_formed():
    vs = build_contract_vectors()
    ids = [v["id"] for v in vs]
    assert len(ids) == len(set(ids))
    for v in vs:
        assert v["expect"] in ("accept", "reject", "stateful") and v["reason"], v["id"]
        if v["expect"] == "accept":
            assert v["reject_stage"] is None and v["reject_code"] is None, v["id"]
        if v["expect"] == "reject":
            assert v["reject_stage"] in STAGES and v["reject_code"] in CODES[v["reject_stage"]], v["id"]
            assert v["reject_stage"] != "state", v["id"]  # state cases are `stateful`
        if v["expect"] == "stateful":
            assert v["reject_stage"] in (None, "state") and v.get("state_setup"), v["id"]
        if v["signed_message_json"] is not None:
            assert json.loads(v["service_data_json"]) == {"signed_message_json": v["signed_message_json"]}, v["id"]
        text = json.dumps(v, ensure_ascii=False)
        assert TEST_SECRET not in text, v["id"]  # the key itself never appears inside a vector


def test_reference_validator_agrees_with_every_contract_vector():
    """Every reject is refused at its declared stage and code with ZERO pending/dispatch; every accept and every
    stateful case passes all stateless stages and yields exactly the expected DTO."""
    for v in build_contract_vectors():
        sink = FakeWisKey()
        service_data, raw = _service_data_for(v)
        if v["expect"] == "reject":
            try:
                sink.reference_handle(v["service"], service_data, v["now"], raw_inner=raw)
            except ContractReject as e:
                assert (e.stage, e.code) == (v["reject_stage"], v["reject_code"]), (v["id"], e.stage, e.code)
                assert "test_" not in str(e) and "משתמש" not in str(e), v["id"]  # the error never carries input text
            else:
                raise AssertionError(f"{v['id']} was accepted")
            assert sink.pending == [] and sink.calls == [], v["id"]
            continue
        dto = sink.reference_handle(v["service"], service_data, v["now"], raw_inner=raw)
        assert dto.as_json() == v["expected_dto"], v["id"]
        if dto.action == "door_open":
            assert sink.calls == [("open", dto.request_id)] and sink.pending == [dto.request_id], v["id"]
        else:
            assert sink.pending == [] and [c[0] for c in sink.calls] == ["status_query"], v["id"]  # a status never opens


def test_accept_vectors_also_verify_with_the_existing_verifier():
    for v in build_contract_vectors():
        if v["expect"] in ("accept", "stateful") and v["signed_message_json"]:
            wire = json.loads(v["signed_message_json"])
            assert bridge_signing.Verifier(TEST_SECRET).verify(dict(wire), now=wire["ts"]) is None, v["id"]


def test_stateful_vectors_with_a_toy_store():
    vs = {v["id"]: v for v in build_contract_vectors()}

    def dto_of(vid: str) -> TrustedDoorDTO:
        v = vs[vid]
        return contract_validate(v["service"], json.loads(v["service_data_json"]), v["now"])

    opened = dto_of("transport_envelope_door_open")
    store = {"nonces": {opened.nonce: opened.request_id},
             "requests": {opened.request_id: {"station": opened.station, "meaning": (opened.protocol, opened.actor, opened.action, opened.station, opened.params)}},
             "allowed_relays": {"test_station_entrance": (1,)}}
    assert stateful_check(dto_of("status_station_mismatch_vs_open_record"), store) == "station_mismatch"
    assert stateful_check(dto_of("status_with_target"), store) is None
    assert stateful_check(dto_of("state_request_id_reused_other_meaning"), store) == "request_id_conflict"
    assert stateful_check(dto_of("state_nonce_reused_other_request"), store) == "replay"
    assert stateful_check(dto_of("state_relay_outside_station_range"), store) == "relay_not_allowed"
    assert stateful_check(dto_of("state_duplicate_identical"), store) is None  # same meaning: the stored result is returned
    assert dto_of("status_target_unknown").params[0][1] not in store["requests"]
    for vid, v in vs.items():
        if v["expect"] == "stateful" and v["reject_code"]:
            assert v["reject_code"] in CODES["state"], vid


def test_v1_vectors_under_the_v2_validator():
    """v1 reject vectors are refused before dispatch by the v2 validator too; v1 envelope accepts pass once they are
    carried in the string envelope (the v1 status vector lacks target_request_id, see its v2 transport twin)."""
    for v in build_document()["vectors"]:
        sink = FakeWisKey()
        if v["expect"] == "reject":
            try:
                sink.reference_handle("door_open", {"signed_message_json": v["input_json"]}, T0)
            except ContractReject as e:
                assert e.stage in ("encoding", "parse", "schema"), (v["id"], e.stage)
            else:
                raise AssertionError(v["id"])
            assert sink.calls == [], v["id"]
        elif v["id"] == "envelope_door_open":
            dto = sink.reference_handle("door_open", {"signed_message_json": v["wire_message_json"]}, v["ts"])
            assert dto.body_sha256 == v["body_sha256"]
        elif v["id"] == "envelope_door_open_status":
            try:
                sink.reference_handle("door_open_status", {"signed_message_json": v["wire_message_json"]}, v["ts"])
            except ContractReject as e:
                assert (e.stage, e.code) == ("schema", "missing_field")
        elif v["expect"] == "accept":
            contract_loads(v["input_json"])  # serialization-only vectors pass the strict parser (they are not envelopes)


def test_digests_bind_what_they_claim():
    v = {x["id"]: x for x in build_contract_vectors()}["transport_envelope_door_open"]
    wire = json.loads(v["signed_message_json"])
    other = {**wire, "nonce": "ffffffffffffffffffffffffffffffff"}
    b1, _h1, a1 = _digests(wire)
    b2, _h2, a2 = _digests(other)
    assert b1 == b2 and a1 != a2  # nonce is outside body_sha256 but inside authenticated_message_sha256
    assert v["body_sha256"] == {x["id"]: x for x in build_document()["vectors"]}["envelope_door_open"]["body_sha256"]
    dto = contract_validate("door_open", json.loads(v["service_data_json"]), T0)
    try:
        dto.station = "x"  # type: ignore[misc]
    except FrozenInstanceError:
        pass
    else:
        raise AssertionError("DTO must be immutable")
    assert "sig" not in dto.as_json() and "ts" not in dto.as_json()
    assert TEST_SECRET not in json.dumps(dto.as_json(), ensure_ascii=False)


def test_existing_signer_default_nonce_is_16_hex_so_arx_must_pass_one():
    for signer in (ha_bridge.sign, bridge_signing.sign):
        n = signer(TEST_SECRET, {}, GENERIC_TS)["nonce"]
        assert len(n) == 16 and not HEX32_RE.fullmatch(n)


def test_existing_verifier_gaps_that_v2_closes():
    vs = {v["id"]: v for v in build_contract_vectors()}
    for vid in ("types_ts_string", "types_nonce_number", "time_lifetime_31", "types_extra_wire_field", "types_relay_bool"):
        wire = json.loads(vs[vid]["signed_message_json"])
        assert bridge_signing.Verifier(TEST_SECRET).verify(dict(wire), now=T0) is None, vid  # existing verifier says OK
    collapsed = json.loads(vs["transport_duplicate_station_in_string"]["signed_message_json"])  # stdlib keeps the last
    assert bridge_signing.Verifier(TEST_SECRET).verify(collapsed, now=T0) is None


if __name__ == "__main__":
    if "--write" in sys.argv:
        VECTORS_FILE.parent.mkdir(parents=True, exist_ok=True)
        VECTORS_FILE.write_bytes(render(build_document()).encode("utf-8"))
        print(f"wrote {VECTORS_FILE}")
    else:
        print(render(build_document()))
