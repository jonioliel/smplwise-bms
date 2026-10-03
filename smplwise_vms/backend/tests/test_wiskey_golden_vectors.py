"""Golden vectors for the WisKey trusted-caller (door_open) signing contract, regenerated from the EXISTING signers.

The vectors file `docs/contracts/wiskey-trusted-caller/GOLDEN_VECTORS.json` is derived here, case by case, from the
production signing code as it is today: the add-on's `smplwise.services.ha_bridge.sign` and the bridge integration's
`custom_components/smplwise_bridge/signing.sign`. Nothing in production code changes; this module only observes.

- `pytest tests/test_wiskey_golden_vectors.py` fails on any drift between the file and what the signers produce now.
- `python tests/test_wiskey_golden_vectors.py --write` rewrites the file (only after a deliberate, reviewed change:
  a serialization change needs a new protocol version, see the README next to the vectors).

The HMAC key below is a TEST CONSTANT. It is not, and must never become, a pairing secret of any installation.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import math
import sys
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


if __name__ == "__main__":
    if "--write" in sys.argv:
        VECTORS_FILE.parent.mkdir(parents=True, exist_ok=True)
        VECTORS_FILE.write_bytes(render(build_document()).encode("utf-8"))
        print(f"wrote {VECTORS_FILE}")
    else:
        print(render(build_document()))
