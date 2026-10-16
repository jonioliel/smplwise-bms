"""LEASE-BUILD slice L0: the reference model of `wiskey-capture-lease-v1` (docs/contracts/wiskey-capture-lease/) and its golden
vectors. A MODEL only - no Home Assistant, no bridge, no WisKey, no reader; the HMAC key is the published golden-vector TEST
constant. The bridge fake (tests/fake_trusted_bridge.py `FakeLeaseBridge`) runs stages 1-7 through `validate`; the host fake
(tests/fake_wiskey.py `FakeLeaseHost`) is stage 8.

Write the vectors file (synthetic, deterministic):  python tests/lease_contract.py --write"""
from __future__ import annotations

import copy
import hashlib
import hmac
import json
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE))

import test_wiskey_golden_vectors as gv  # noqa: E402

REPO = HERE.parents[2]
VECTORS_FILE = REPO / "docs" / "contracts" / "wiskey-capture-lease" / "GOLDEN_VECTORS.json"
TEST_SECRET = gv.TEST_SECRET
PROTOCOL = "wiskey-capture-lease-v1"
MAX_MESSAGE_BYTES = 8192
MAX_LIFETIME_S = 15
LEASE_MAX_S = 120
EVENT_ACTIONS = ("lease_revoke", "lease_heartbeat", "lease_stream_reset")
REQUEST_ACTIONS = ("capture_start", "capture_status", "capture_confirm", "capture_cancel")
SERVICE_OF = {**{a: "lease_event" for a in EVENT_ACTIONS}, **{a: "lease_request" for a in REQUEST_ACTIONS}}
SCOPES = ("lease", "actor", "station", "all")
REVOKE_REASONS = (
    "permission_revision", "actor_disabled", "actor_removed", "access_changed", "session_ended", "abandoned", "second_factor_changed",
    "binding_changed", "receiver_changed", "receiver_offline", "feed_reconnect", "feature_off", "repair", "emergency", "shutdown",
    "person_changed", "clock_invalid", "start_unknown", "host_lost_stream", "unknown_lease_on_host", "ledger_unavailable",
    "key_rotation", "restore", "cancel_unknown",
)
RESET_REASONS = ("startup", "repair", "restore", "key_rotation")
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
CODES = {**gv.CODES, "binding": gv.CODES["binding"] + ("station_scope_mismatch", "lease_window"), "state": gv.CODES["state"]}


class Reject(Exception):
    def __init__(self, stage: str, code: str) -> None:
        assert stage in gv.STAGES and code in CODES[stage], (stage, code)
        super().__init__(f"{stage}:{code}")
        self.stage, self.code = stage, code


@dataclass(frozen=True)
class LeaseDTO:
    action: str
    actor_id: str
    station: str
    params: dict[str, Any]
    request_id: str
    nonce: str
    issued_at: str
    expires_at: str
    body_sha256: str


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


def _time(v: Any) -> int:
    if not isinstance(v, str):
        raise Reject("schema", "wrong_type")
    try:
        return gv._parse_time(v)
    except gv.ContractReject:
        raise Reject("schema", "bad_format") from None


def schema(m: dict[str, Any]) -> tuple[int, int]:
    """Stage `schema` for the lease protocol: the closed wire, actor and per-action params (lease object included)."""
    keys = set(m)
    if keys - gv.WIRE_KEYS:
        raise Reject("schema", "unknown_field")
    if gv.WIRE_KEYS - keys:
        raise Reject("schema", "missing_field")
    for f in gv.STRING_FIELDS:
        if not isinstance(m[f], str):
            raise Reject("schema", "wrong_type")
    if type(m["ts"]) is not int or not isinstance(m["actor"], dict) or not isinstance(m["params"], dict):
        raise Reject("schema", "wrong_type")
    if m["protocol"] != PROTOCOL or m["action"] not in PARAMS_KEYS:
        raise Reject("schema", "bad_value")
    if not gv._plain_text(m["station"], gv.MAX_STATION):
        raise Reject("schema", "bad_format")
    if not UUID_RE.fullmatch(m["request_id"]) or not HEX32_RE.fullmatch(m["nonce"]) or not gv.HEX64_RE.fullmatch(m["sig"]):
        raise Reject("schema", "bad_format")
    issued, expires = _time(m["issued_at"]), _time(m["expires_at"])
    _check_keys(m["actor"], gv.V2_ACTOR_KEYS)
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
        _time(p["revoked_at"])
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
        li, le = _time(lease["lease_issued_at"]), _time(lease["lease_expires_at"])
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
    else:
        if not isinstance(p["lease_ref"], str) or not UUID_RE.fullmatch(p["lease_ref"]):
            raise Reject("schema", "bad_format")
        if not _text(p["session_id"], 128):
            raise Reject("schema", "bad_format")
        if a == "capture_confirm" and not _text(p["label"], 64, empty=True):
            raise Reject("schema", "bad_format")
    return issued, expires


def validate(service: str, service_data: Any, now: int | None, secret: str = TEST_SECRET, nonces: set[str] | None = None) -> LeaseDTO:
    """Stages transport .. state (replay) of the bridge's `lease_event` / `lease_request`; stage 8 is the host's."""
    if not isinstance(service_data, dict) or set(service_data) != {"signed_message_json"} or not isinstance(service_data["signed_message_json"], str):
        raise Reject("transport", "transport_shape")
    text = service_data["signed_message_json"]
    if len(text.encode("utf-8")) > MAX_MESSAGE_BYTES:
        raise Reject("transport", "transport_shape")
    try:
        m = gv.contract_loads(text)
    except gv.ContractReject as exc:
        raise Reject(exc.stage, exc.code) from None
    issued, expires = schema(m)
    if m["ts"] != issued:
        raise Reject("binding", "ts_mismatch")
    if SERVICE_OF[m["action"]] != service:
        raise Reject("binding", "action_service_mismatch")
    a, p = m["action"], m["params"]
    wide = a in ("lease_heartbeat", "lease_stream_reset") or (a == "lease_revoke" and p["scope"] == "all")
    if wide != (m["station"] == "*"):
        raise Reject("binding", "station_scope_mismatch")
    if a == "capture_start" and not gv._parse_time(p["lease"]["lease_issued_at"]) <= issued < gv._parse_time(p["lease"]["lease_expires_at"]):
        raise Reject("binding", "lease_window")
    signed_body = {k: v for k, v in m.items() if k not in ("ts", "nonce", "sig")}
    body_sha = hashlib.sha256(gv.current_canonical(signed_body).encode("utf-8")).hexdigest()
    expected = hmac.new(secret.encode("utf-8"), f"{m['ts']}.{m['nonce']}.{body_sha}".encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, m["sig"]):
        raise Reject("signature", "bad_signature")
    if type(now) is not int or now < gv.CLOCK_FLOOR:
        raise Reject("time", "clock_invalid")
    if not 0 < expires - issued <= MAX_LIFETIME_S:
        raise Reject("time", "lifetime_invalid")
    if now < issued:
        raise Reject("time", "not_yet_valid")
    if now >= expires:
        raise Reject("time", "expired")
    if nonces is not None:
        if m["nonce"] in nonces:
            raise Reject("state", "replay")
        nonces.add(m["nonce"])
    return LeaseDTO(a, m["actor"]["id"], m["station"], copy.deepcopy(p), m["request_id"], m["nonce"], m["issued_at"], m["expires_at"], body_sha)


# ---------------------------------------------------------------- golden vectors

ISSUED = "2026-10-16T12:00:00Z"
T0 = gv._epoch(ISSUED)
STREAM = "5e1f0c2a9b8d7e6f5a4b3c2d1e0f9a8b"
LEASE_REF = "7c9e6679-7425-40de-944b-e07fc1f90ae7"
ACTOR = "dev-sam"


def _env(action: str, params: dict[str, Any], *, station: str, n: int, actor: str = ACTOR, issued: str = ISSUED, lifetime: int = MAX_LIFETIME_S) -> dict[str, Any]:
    exp = gv._iso(gv._epoch(issued) + lifetime)
    return {"protocol": PROTOCOL, "actor": {"id": actor, "display_name": actor}, "action": action, "station": station, "params": params,
            "request_id": f"00000000-0000-4000-8000-{n:012d}", "nonce": f"{n:032x}", "issued_at": issued, "expires_at": exp}


def _lease() -> dict[str, Any]:
    return {"lease_ref": LEASE_REF, "lease_issued_at": ISSUED, "lease_expires_at": "2026-10-16T12:02:00Z", "binding_revision": None, "person_ref": "u1",
            "person_revision": 4, "permission_revision": 17, "receiver": {"reader_id": 0}, "stream_id": STREAM, "sequence_at_issue": 1,
            "lease_actions": list(REQUEST_ACTIONS)}


def accept_envelopes() -> list[tuple[str, dict[str, Any]]]:
    return [
        ("revoke_lease_scope", _env("lease_revoke", {"stream_id": STREAM, "sequence": 2, "scope": "lease", "lease_ref": LEASE_REF, "permission_revision": 17,
                                                     "reason": "abandoned", "revoked_at": ISSUED}, station="entry-a", n=1)),
        ("revoke_all_scope", _env("lease_revoke", {"stream_id": STREAM, "sequence": 3, "scope": "all", "lease_ref": "*", "permission_revision": 18,
                                                   "reason": "permission_revision", "revoked_at": ISSUED}, station="*", n=2, actor="arx-installation-1")),
        ("heartbeat", _env("lease_heartbeat", {"stream_id": STREAM, "sequence": 3, "live_leases": [LEASE_REF], "permission_revision": 18}, station="*", n=3, actor="arx-installation-1")),
        ("stream_reset", _env("lease_stream_reset", {"stream_id": STREAM, "previous_stream_id": "*", "sequence": 1, "reason": "startup"}, station="*", n=4, actor="arx-installation-1")),
        ("capture_start", _env("capture_start", {"lease": _lease()}, station="entry-a", n=5)),
        ("capture_status", _env("capture_status", {"lease_ref": LEASE_REF, "session_id": "0123456789abcdef"}, station="entry-a", n=6)),
        ("capture_confirm", _env("capture_confirm", {"lease_ref": LEASE_REF, "session_id": "0123456789abcdef", "label": "תג ראשי"}, station="entry-a", n=7)),
        ("capture_cancel", _env("capture_cancel", {"lease_ref": LEASE_REF, "session_id": "*"}, station="entry-a", n=8)),
    ]


def _mutate(env: dict[str, Any], path: tuple[Any, ...], value: Any) -> dict[str, Any]:
    out = copy.deepcopy(env)
    cur = out
    for k in path[:-1]:
        cur = cur[k]
    if value is _DELETE:
        del cur[path[-1]]
    else:
        cur[path[-1]] = value
    return out


_DELETE = object()


def reject_cases() -> list[tuple[str, dict[str, Any], str, str, dict[str, Any]]]:
    """(id, envelope, stage, code, wire overrides) - exactly one defect each."""
    acc = dict(accept_envelopes())
    rv, st, hb, rs = acc["revoke_lease_scope"], acc["capture_start"], acc["heartbeat"], acc["stream_reset"]
    return [
        ("revoke_sequence_zero", _mutate(rv, ("params", "sequence"), 0), "schema", "bad_value", {}),
        ("revoke_unknown_reason", _mutate(rv, ("params", "reason"), "because"), "schema", "bad_value", {}),
        ("revoke_lease_scope_star_ref", _mutate(rv, ("params", "lease_ref"), "*"), "schema", "bad_format", {}),
        ("revoke_extra_param", _mutate(rv, ("params", "card"), "1234"), "schema", "unknown_field", {}),
        ("revoke_all_scope_named_station", _mutate(acc["revoke_all_scope"], ("station",), "entry-a"), "binding", "station_scope_mismatch", {}),
        ("heartbeat_nine_live", _mutate(hb, ("params", "live_leases"), [f"7c9e6679-7425-40de-944b-e07fc1f90a{i:02d}" for i in range(9)]), "schema", "bad_value", {}),
        ("reset_sequence_two", _mutate(rs, ("params", "sequence"), 2), "schema", "bad_value", {}),
        ("start_lease_121s", _mutate(st, ("params", "lease", "lease_expires_at"), "2026-10-16T12:02:01Z"), "schema", "bad_value", {}),
        ("start_lease_card_field", _mutate(st, ("params", "lease", "card_number"), "1234"), "schema", "unknown_field", {}),
        ("start_lease_missing_stream", _mutate(st, ("params", "lease", "stream_id"), _DELETE), "schema", "missing_field", {}),
        ("start_wrong_actions", _mutate(st, ("params", "lease", "lease_actions"), ["capture_start"]), "schema", "bad_value", {}),
        ("message_lifetime_16s", _mutate(rv, ("expires_at",), "2026-10-16T12:00:16Z"), "time", "lifetime_invalid", {}),
        ("wrong_protocol", _mutate(rv, ("protocol",), "wiskey-trusted-door-v1"), "schema", "bad_value", {}),
        ("bad_signature", rv, "signature", "bad_signature", {"secret": "not-the-test-key"}),
    ]


def wire(env: dict[str, Any], secret: str = TEST_SECRET) -> dict[str, Any]:
    return gv._signed_wire(env, secret=secret)


def build_vectors() -> dict[str, Any]:
    acc = []
    for vid, env in accept_envelopes():
        w = wire(env)
        text = json.dumps(w, ensure_ascii=False, separators=(",", ":"))
        acc.append({"id": vid, "service": SERVICE_OF[env["action"]], "now": T0 + 1, "signed_message_json": text,
                    "body_sha256_of_signed_fields": hashlib.sha256(gv.current_canonical({k: v for k, v in w.items() if k not in ("ts", "nonce", "sig")}).encode("utf-8")).hexdigest(),
                    "expect": {"result": "pass"}})
    rej = []
    for vid, env, stage, code, extra in reject_cases():
        w = wire(env, secret=extra.get("secret", TEST_SECRET))
        text = json.dumps(w, ensure_ascii=False, separators=(",", ":"))
        rej.append({"id": vid, "service": SERVICE_OF.get(env["action"], "lease_event"), "now": T0 + 1, "signed_message_json": text,
                    "expect": {"result": "rejected", "stage": stage, "code": code}})
    return {
        "format": "smplwise-arx/wiskey-capture-lease/golden-vectors",
        "format_version": 1,
        "protocol": PROTOCOL,
        "vectors_version": 1,
        "status": "DRAFT, Arx LEASE-BUILD 2026-10-16 (CR-WISKEY-LEASE-REVOCATION-EVENT slice L0). Synthetic; do not edit by hand.",
        "generated_by": "smplwise_vms/backend/tests/lease_contract.py --write",
        "test_hmac_key": {"value": TEST_SECRET, "encoding": "UTF-8 bytes of the string are the HMAC key",
                          "warning": "TEST CONSTANT ONLY. Publicly known. Never use as, or derive, a pairing secret."},
        "signing": "as wiskey-trusted-door-v1 (DTO v3 sections 2-3): canonical JSON of the body without ts/nonce/sig (sort_keys, compact, UTF-8), "
                   "HMAC-SHA256 over '<ts>.<nonce>.<sha256(canonical)>', ts == epoch(issued_at), explicit 32-hex nonce",
        "accept": acc,
        "reject": rej,
    }


def write() -> None:
    VECTORS_FILE.parent.mkdir(parents=True, exist_ok=True)
    VECTORS_FILE.write_text(json.dumps(build_vectors(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


if __name__ == "__main__":
    if "--write" in sys.argv:
        write()
        print(f"wrote {VECTORS_FILE}")
