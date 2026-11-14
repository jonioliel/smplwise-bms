"""LEASEARX-295: Arx's side of `wiskey-capture-lease-v1` aligned with WisKey's answer of 2026-10-21.

1. the final service names live in one place and nothing says "provisional";
2. the wire is DTO v3 / `wiskey-capture-lease-v1` with the service data exactly `{signed_message_json}` and the closed key list of
   lease.schema.json - no generalized W1 envelope field;
3. no `kid` on the lease wire (review L-05) - a lease signed with the current key, and with the previous key during a rotation window,
   verifies through the BRIDGE's key set verifier (the bridge copy of this repo: custom_components/smplwise_bridge/keyset.py, driven the
   way the bridge's lease_contract `_verify` drives it - see `bridge_verify`);
4. the answers are the four closed schemas and the closed code table (services/lease_answers.py), and the routes treat anything else as
   an unclear outcome.

Fakes and synthetic keys only: nothing here contacts a bridge, WisKey, Home Assistant or a reader. The `jsonschema` parity tests run
only where the package is installed (NOT_RUN otherwise)."""
from __future__ import annotations

import copy
import importlib.util
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pytest

from conftest import as_user
from fake_wiskey import LEASE_PERSON
from lease_fixtures import lease_world  # noqa: F401  (fixture, needed by `route`)
from test_intercom import env
from test_intercom_capture_lease import lease_of, route, start, wait_state  # noqa: F401  (route: fixture)

from smplwise.services import capture_lease_route, intercom_capture, ha_bridge, lease_answers as la, lease_events as le

ROOT = Path(__file__).resolve().parents[3]
CONTRACT = ROOT / "docs" / "contracts" / "wiskey-capture-lease"
BRIDGE = ROOT / "custom_components" / "smplwise_bridge"
RID = "00000000-0000-4000-8000-000000000001"
REF = "7c9e6679-7425-40de-944b-e07fc1f90ae7"
T0 = 1_800_000_000
M1, M2 = "synthetic-material-one-0001", "synthetic-material-two-0002"  # synthetic keys, never real ones
K1, K2 = "g1-0badc0de", "g2-1badc0de"
PAIRING = "synthetic-pairing-secret-0003"


def _load(name: str):
    spec = importlib.util.spec_from_file_location(f"_sw_lease295_{name}", BRIDGE / f"{name}.py")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod


keyset_mod = _load("keyset")


def _json(name: str) -> dict[str, Any]:
    return json.loads((CONTRACT / name).read_text(encoding="utf-8"))


# ---------------------------------------------------------------- 1. the final names, one place

def test_service_names_are_final_and_written_once(monkeypatch):
    assert (le.BRIDGE_DOMAIN, le.SERVICE_EVENT, le.SERVICE_REQUEST) == ("smplwise_bridge", "lease_event", "lease_request")
    calls: list[tuple[Any, ...]] = []
    from smplwise.services import ha_client

    monkeypatch.setattr(ha_client, "call_service", lambda settings, domain, service, data, return_response=False, **kw: calls.append((domain, service, data, return_response)) or {})
    t = le.BridgeLeaseTransport()
    t.event(object(), "TEXT-A")
    t.request(object(), "capture_start", "TEXT-B")
    assert calls == [("smplwise_bridge", "lease_event", {"signed_message_json": "TEXT-A"}, True),
                     ("smplwise_bridge", "lease_request", {"signed_message_json": "TEXT-B"}, True)]
    source = (Path(le.__file__)).read_text(encoding="utf-8")
    assert source.count('"lease_event"') == 1 and source.count('"lease_request"') == 1, "the names are constants, not scattered literals"
    assert "provisional" not in source.lower()


def test_contract_documents_say_nothing_provisional_about_the_service_names():
    for name in ("SCHEMA.md", "NOTE_FOR_WISKEY.md"):
        text = (CONTRACT / name).read_text(encoding="utf-8")
        assert not re.search(r"provisional\w*\s+name|uses `lease_request` provisionally|PROVISIONAL name", text, re.I), name


# ---------------------------------------------------------------- 2./3. the closed wire, no kid

def _sign(monkeypatch, secret: Any, at_offset: int = 0, nonce: str | None = None) -> Any:
    monkeypatch.setattr(le, "_secret", lambda conn: secret)
    params = {"stream_id": "5e1f0c2a9b8d7e6f5a4b3c2d1e0f9a8b", "sequence": 3, "live_leases": [REF], "permission_revision": 18}
    return le.sign(None, "lease_heartbeat", "arx-installation-1", "arx-installation-1", "*", params, request_id=RID, nonce=nonce,
                   at=datetime.fromtimestamp(T0 + at_offset, tz=timezone.utc))


def _keyset(signing: str, keys: dict[str, str], old: str | None = None, now: int = T0 + 1):
    state = {"v": 1, "signing": signing, "keys": keys, "old": old, "next": None, "legacy_retired": True, "rotation": None, "hw": {}}
    return keyset_mod.KeySet(None, state, now=lambda: float(now), mono=lambda: 0.0)


def bridge_verify(ks: Any, message: dict[str, Any]) -> str | None:
    """The bridge's verdict for a lease message (None = valid). The same procedure as the bridge's lease_contract `_verify`: the message as it
    is (kid-less: the pairing secret), and on a bad signature every key id the key set accepts, presented with that `kid` (the v2 recipe binds
    the kid into the MAC). A mirror of the bridge copy under test in pilot/LEASEBR-295, which was not pushed when this was written."""
    verdict = ks.verify(message)
    if verdict != "bad_signature":
        return verdict
    for kid in sorted(ks.verifiable()):
        if kid.endswith("-legacy"):
            continue
        again = ks.verify({**message, "kid": kid})
        if again != "bad_signature":
            return again
    return verdict


def test_the_lease_wire_is_exactly_the_closed_key_list_and_has_no_kid(monkeypatch):
    schema = _json("lease.schema.json")
    closed = set(schema["properties"])
    assert closed == {"protocol", "actor", "action", "station", "params", "request_id", "issued_at", "expires_at", "ts", "nonce", "sig"}
    assert schema["additionalProperties"] is False and "kid" not in closed
    for secret in (ha_bridge.BridgeKey(M1, K1), PAIRING):  # a rotated key, and the pairing secret
        wire = json.loads(_sign(monkeypatch, secret).text)
        assert set(wire) == closed, "no kid, no grant / decision / W1 envelope field"
        assert wire["protocol"] == "wiskey-capture-lease-v1"
    # the other bridge services keep their kid (this is the lease wire only)
    assert "kid" in ha_bridge.sign(ha_bridge.BridgeKey(M1, K1), {"a": 1}, ts=T0, nonce="0" * 32)


def test_a_lease_signed_with_the_current_key_verifies_at_the_bridge(monkeypatch):
    msg = json.loads(_sign(monkeypatch, ha_bridge.BridgeKey(M1, K1)).text)
    assert _keyset(K1, {K1: M1}).verify(msg) == "bad_signature", "the plain key set verify cannot name the key: the lease verifier must try the key ids"
    assert bridge_verify(_keyset(K1, {K1: M1}), msg) is None


def test_both_the_current_and_the_previous_key_verify_in_a_rotation_window(monkeypatch):
    previous = json.loads(_sign(monkeypatch, ha_bridge.BridgeKey(M1, K1), nonce="a" * 32).text)  # signed before the commit
    current = json.loads(_sign(monkeypatch, ha_bridge.BridgeKey(M2, K2), nonce="b" * 32).text)  # signed after it
    window = _keyset(K2, {K1: M1, K2: M2}, old=K1)  # committed, the old key still held (the overlap window)
    assert bridge_verify(window, current) is None
    assert bridge_verify(window, previous) is None
    # before the commit the bridge holds the old key as the signing key and the new one as `next`
    during = _keyset(K1, {K1: M1, K2: M2})
    during.next = K2
    assert bridge_verify(during, copy.deepcopy(previous)) is None
    assert bridge_verify(during, copy.deepcopy(current)) is None


def test_the_window_closes_and_nothing_else_verifies(monkeypatch):
    previous = json.loads(_sign(monkeypatch, ha_bridge.BridgeKey(M1, K1), nonce="c" * 32).text)
    current = json.loads(_sign(monkeypatch, ha_bridge.BridgeKey(M2, K2), nonce="d" * 32).text)
    after = _keyset(K2, {K2: M2})  # the old key was dropped
    assert bridge_verify(after, previous) == "bad_signature"
    assert bridge_verify(after, current) is None
    assert bridge_verify(after, current) == "replay", "the same signed bytes again are a replay"
    forged = json.loads(_sign(monkeypatch, ha_bridge.BridgeKey("synthetic-other-material-9", K2), nonce="e" * 32).text)
    assert bridge_verify(_keyset(K2, {K2: M2}), forged) == "bad_signature"
    tampered = json.loads(_sign(monkeypatch, ha_bridge.BridgeKey(M2, K2), nonce="f" * 32).text)
    tampered["params"]["sequence"] = 4
    assert bridge_verify(_keyset(K2, {K2: M2}), tampered) == "bad_signature"


def test_before_any_rotation_the_pairing_secret_still_signs_the_old_kidless_recipe(monkeypatch):
    msg = json.loads(_sign(monkeypatch, PAIRING).text)
    legacy = keyset_mod.KeySet(PAIRING, None, now=lambda: float(T0 + 1), mono=lambda: 0.0)
    assert bridge_verify(legacy, msg) is None


# ---------------------------------------------------------------- 4. closed answers: the tables are the contract's

def test_the_tables_are_the_contract_files():
    codes = _json("CAPTURE_ANSWER_CODES.json")
    assert {k: tuple(v) for k, v in codes["refused"].items()} == la.REFUSED
    assert {k: tuple(v) for k, v in codes["rejected"]["pre_schema"].items()} == la.PRE_SCHEMA
    assert {a: {s: tuple(c) for s, c in t.items()} for a, t in codes["rejected"]["post_schema"].items()} == la.POST_SCHEMA
    assert set(codes["refused_liveness"]["session_unchanged"]) == la.SESSION_UNCHANGED
    assert codes["sent_unknown"]["allowed_on"] == ["capture_confirm"]
    assert tuple(codes["status_capture_state"]["states"]) == la.STATUS_STATES and "applying" not in la.STATUS_STATES
    assert tuple(codes["status_capture_state"]["errors"]) == la.STATUS_ERRORS


def test_the_tables_match_the_four_answer_schemas():
    for action in la.REQUEST_ACTIONS:
        schema = _json(f"{action}.answer.schema.json")
        by_result: dict[str, list[dict[str, Any]]] = {}
        for variant in schema["oneOf"]:
            by_result.setdefault(variant["properties"]["result"]["const"], []).append(variant)
        refused = by_result["refused"][0]["properties"]["code"]["enum"]
        assert tuple(refused) == la.REFUSED[action]
        assert ("sent_unknown" in by_result) == (action == "capture_confirm")
        pre, post = by_result["rejected"]
        assert "request_id" not in pre["properties"] and "request_id" in post["required"]
        assert {c["if"]["properties"]["stage"]["const"]: tuple(c["then"]["properties"]["code"]["enum"]) for c in post["allOf"]} == la.POST_SCHEMA[action]
        assert {c["if"]["properties"]["stage"]["const"]: tuple(c["then"]["properties"]["code"]["enum"]) for c in pre["allOf"]} == la.PRE_SCHEMA
    status_schema = _json("capture_status.answer.schema.json")
    capture = status_schema["oneOf"][0]["properties"]["capture"]["properties"]
    assert tuple(capture["state"]["enum"]) == la.STATUS_STATES
    assert tuple(capture["error"]["oneOf"][0]["enum"]) == la.STATUS_ERRORS
    card = status_schema["$defs"]["card"]["properties"]
    assert tuple(card["technology"]["oneOf"][0]["enum"]) == la.CARD_TECHNOLOGIES
    assert card["masked_number"]["pattern"] == la.MASKED_NUMBER_RE.pattern


# a corpus of (action, answer, expected kind); `schema_valid` marks what the JSON Schema itself accepts (parity test below)
def _ack(action: str, **extra: Any) -> dict[str, Any]:
    body = {
        "capture_start": {"session": {"session_id": "0123456789abcdef", "state": "waiting"}},
        "capture_status": {"capture": {"state": "waiting", "error": None, "card": None}},
        "capture_confirm": {"person": copy.deepcopy(LEASE_PERSON)},
        "capture_cancel": {"cancelled": True},
    }[action]
    return {"result": "acknowledged", "request_id": RID, **body, **extra}


CARD = {"masked_number": "•••• 4321", "technology": "TypeA_M1", "reader_id": 1}


def _status(state: str, error: Any = None, card: Any = None) -> dict[str, Any]:
    return {"result": "acknowledged", "request_id": RID, "capture": {"state": state, "error": error, "card": card}}


def _rej(stage: str, code: str, rid: bool) -> dict[str, Any]:
    return {"result": "rejected", "stage": stage, "code": code, **({"request_id": RID} if rid else {})}


def _refused(code: str) -> dict[str, Any]:
    return {"result": "refused", "request_id": RID, "code": code}


VALID: list[tuple[str, dict[str, Any], str]] = [
    ("capture_start", _ack("capture_start"), "ok"),
    ("capture_start", {**_ack("capture_start"), "session": {"session_id": "A-b_9", "state": "preparing"}}, "ok"),
    ("capture_status", _status("preparing"), "ok"),
    ("capture_status", _status("waiting"), "ok"),
    ("capture_status", _status("captured", card=CARD), "ok"),
    ("capture_status", _status("captured", card={**CARD, "technology": None, "reader_id": None}), "ok"),
    ("capture_status", _status("error", error="capture_timeout"), "ok"),
    ("capture_confirm", _ack("capture_confirm"), "ok"),
    ("capture_cancel", _ack("capture_cancel"), "ok"),
    ("capture_confirm", {"result": "sent_unknown", "request_id": RID}, "sent_unknown"),
    ("capture_start", _rej("schema", "unknown_field", False), "rejected"),
    ("capture_status", _rej("transport", "transport_shape", False), "rejected"),
    ("capture_start", _rej("binding", "lease_window", True), "rejected"),
    ("capture_confirm", _rej("signature", "bad_signature", True), "rejected"),
    ("capture_cancel", _rej("time", "clock_invalid", True), "rejected"),
    ("capture_status", _rej("state", "replay", True), "rejected"),
] + [(a, _refused(c), "refused") for a, codes in la.REFUSED.items() for c in codes]

INVALID: list[tuple[str, dict[str, Any], str]] = [  # (action, answer, why)
    ("capture_start", {**_ack("capture_start"), "extra": 1}, "extra field"),
    ("capture_start", {"result": "acknowledged", "request_id": RID}, "no session"),
    ("capture_start", {**_ack("capture_start"), "session": {"state": "preparing"}}, "session without id"),
    ("capture_start", {**_ack("capture_start"), "session": {"session_id": "s", "state": "applying"}}, "session state"),
    ("capture_start", {**_ack("capture_start"), "session": {"session_id": "a b", "state": "waiting"}}, "session id pattern"),
    ("capture_start", {**_ack("capture_start"), "request_id": "00000000-0000-4000-8000-000000000002"}, "another request"),
    ("capture_start", {"result": "sent_unknown", "request_id": RID}, "sent_unknown is confirm only"),
    ("capture_status", {"result": "sent_unknown", "request_id": RID}, "sent_unknown is confirm only"),
    ("capture_cancel", {"result": "sent_unknown", "request_id": RID}, "sent_unknown is confirm only"),
    ("capture_confirm", {"result": "sent_unknown", "request_id": RID, "code": "x"}, "sent_unknown extra field"),
    ("capture_status", _status("applying"), "no applying status"),
    ("capture_status", _status("waiting", error="capture_failed"), "error only in state error"),
    ("capture_status", _status("error"), "state error needs an error"),
    ("capture_status", _status("error", error="boom"), "error outside the table"),
    ("capture_status", _status("captured"), "captured needs a card"),
    ("capture_status", _status("waiting", card=CARD), "card only when captured"),
    ("capture_status", _status("captured", card={**CARD, "masked_number": "1234567890"}), "an unmasked number"),
    ("capture_status", _status("captured", card={**CARD, "technology": "mifare"}), "technology outside the table"),
    ("capture_status", _status("captured", card={**CARD, "reader_id": 9}), "reader id range"),
    ("capture_status", _status("captured", card={**CARD, "length": 10}), "card extra field"),
    ("capture_status", {"result": "acknowledged", "request_id": RID, "capture": {"state": "waiting", "card": None}}, "capture without error"),
    ("capture_confirm", _ack("capture_confirm", extra=1), "extra field"),
    ("capture_confirm", {"result": "acknowledged", "request_id": RID}, "no person"),
    ("capture_confirm", _ack("capture_confirm", person={**LEASE_PERSON, "pin": "1"}), "person with a pin"),
    ("capture_confirm", _ack("capture_confirm", person={**LEASE_PERSON, "card_no": "1"}), "person with a card number"),
    ("capture_confirm", _ack("capture_confirm", person={**LEASE_PERSON, "photo": "x"}), "person with a photo"),
    ("capture_cancel", {**_ack("capture_cancel"), "cancelled": False}, "cancelled false"),
    ("capture_cancel", {"result": "acknowledged", "request_id": RID}, "no cancelled"),
    ("capture_start", _refused("capture_operation_busy"), "code of another action"),
    ("capture_status", _refused("capture_station_busy"), "code of another action"),
    ("capture_confirm", _refused("capture_applying"), "code of the cancel table"),
    ("capture_cancel", _refused("capture_not_ready"), "code of the confirm table"),
    ("capture_start", _refused("unknown_action"), "code outside every table"),
    ("capture_start", {**_refused("lease_gone"), "extra": 1}, "refused extra field"),
    ("capture_start", {"result": "refused", "code": "lease_gone"}, "refused without request_id"),
    ("capture_start", {"result": "applying", "request_id": RID}, "unknown result"),
    ("capture_start", _rej("schema", "unknown_field", True), "request_id forbidden before the schema stage passed"),
    ("capture_start", _rej("transport", "transport_shape", True), "request_id forbidden at transport"),
    ("capture_start", _rej("encoding", "invalid_utf8", True), "request_id forbidden at encoding"),
    ("capture_start", _rej("parse", "invalid_json", True), "request_id forbidden at parse"),
    ("capture_start", _rej("binding", "ts_mismatch", False), "request_id required at binding"),
    ("capture_start", _rej("signature", "bad_signature", False), "request_id required at signature"),
    ("capture_start", _rej("time", "expired", False), "request_id required at time"),
    ("capture_start", _rej("state", "replay", False), "request_id required at state"),
    ("capture_start", {**_rej("state", "replay", True), "request_id": "00000000-0000-4000-8000-000000000002"}, "request_id of another request"),
    ("capture_status", _rej("binding", "lease_window", True), "lease_window is capture_start's"),
    ("capture_start", _rej("time", "applying", True), "code outside the stage table"),
    ("capture_start", _rej("schema", "clock_invalid", False), "code of another stage"),
    ("capture_start", _rej("elsewhere", "bad_value", False), "unknown stage"),
    ("capture_start", {**_rej("schema", "bad_value", False), "extra": 1}, "rejected extra field"),
]


@pytest.mark.parametrize(("action", "answer", "kind"), VALID, ids=[f"{a}-{k}-{i}" for i, (a, _r, k) in enumerate(VALID)])
def test_closed_request_answers_are_classified(action, answer, kind):
    got, data = la.classify_request(copy.deepcopy(answer), RID, action)
    assert got == kind, (got, data)
    if kind == "refused":
        assert data == {"code": answer["code"]}
    if kind == "rejected":
        assert data == {"code": f"{answer['stage']}/{answer['code']}"}


@pytest.mark.parametrize(("action", "answer", "why"), INVALID, ids=[f"{a}-{w}" for a, _r, w in INVALID])
def test_anything_outside_the_closed_schemas_is_unknown(action, answer, why):
    assert la.classify_request(copy.deepcopy(answer), RID, action) == ("unknown", {"code": "invalid_response"}), why


def test_an_unknown_action_and_a_non_object_are_unknown():
    assert la.classify_request(_ack("capture_cancel"), RID, "capture_nope") == ("unknown", {"code": "invalid_response"})
    assert capture_lease_route.classify_request("text", RID, "capture_start") == ("unknown", {"code": "invalid_response"})
    assert capture_lease_route.classify_request(None, RID, "capture_start") == ("unknown", {"code": "invalid_response"})
    assert capture_lease_route.classify_request({"service_response": _ack("capture_cancel")}, RID, "capture_cancel")[0] == "ok"


def test_confirm_while_busy_is_a_refusal_not_a_status_and_leaves_the_session():
    assert la.classify_request(_refused("capture_operation_busy"), RID, "capture_confirm") == ("refused", {"code": "capture_operation_busy"})
    assert la.classify_request(_refused("capture_operation_busy"), RID, "capture_status") == ("refused", {"code": "capture_operation_busy"})
    assert "capture_operation_busy" in la.SESSION_UNCHANGED and "capture_applying" in la.SESSION_UNCHANGED


# ---- lease_event answers

def _ev(result: str, **kw: Any) -> dict[str, Any]:
    return {"result": result, "request_id": RID, **kw}


EVENT_VALID: list[tuple[dict[str, Any], str, str | None]] = [
    (_ev("acknowledged", sequence=2, destroyed=1), "acknowledged", "lease_revoke"),
    (_ev("acknowledged", sequence=1), "acknowledged", "lease_stream_reset"),
    (_ev("acknowledged", sequence=2, destroyed=0, live_leases=[REF]), "acknowledged", "lease_heartbeat"),
    (_ev("duplicate", sequence=2), "duplicate", "lease_revoke"),
    (_ev("stale", sequence=2, last_sequence=5), "stale", "lease_revoke"),
    (_ev("gap", sequence=2, last_sequence=5, destroyed=2), "gap", "lease_revoke"),
    (_ev("conflict", sequence=2, destroyed=2), "conflict", "lease_revoke"),
    ({"result": "unknown_stream", "request_id": RID}, "unknown_stream", "lease_heartbeat"),
    (_rej("schema", "bad_value", False), "rejected", "lease_revoke"),
    (_rej("time", "clock_invalid", True), "rejected", "lease_heartbeat"),
]
EVENT_INVALID: list[tuple[dict[str, Any], str | None, str]] = [
    (_ev("acknowledged", sequence=2, extra=1), None, "extra field"),
    (_ev("acknowledged"), None, "no sequence"),
    (_ev("acknowledged", sequence=3), None, "another sequence"),  # sent sequence is 2
    (_ev("acknowledged", sequence=0), None, "sequence below 1"),
    (_ev("acknowledged", sequence=True), None, "a bool is not a sequence"),
    (_ev("acknowledged", sequence=2, destroyed=-1), None, "negative count"),
    (_ev("acknowledged", sequence=2, live_leases=[REF]), "lease_revoke", "live_leases only on a heartbeat"),
    (_ev("acknowledged", sequence=2, live_leases=["x"]), "lease_heartbeat", "live_leases are UUIDs"),
    (_ev("stale", sequence=2), None, "stale needs last_sequence"),
    (_ev("gap", sequence=2, last_sequence=5), None, "gap needs destroyed"),
    (_ev("conflict", sequence=2), None, "conflict needs destroyed"),
    (_ev("unknown_stream", sequence=2), None, "unknown_stream is result and request_id only"),
    ({**_ev("duplicate", sequence=2), "request_id": "00000000-0000-4000-8000-000000000002"}, None, "another request"),
    (_ev("applying", sequence=2), None, "unknown result"),
    (_rej("schema", "bad_value", True), None, "request_id forbidden at schema"),
    (_rej("binding", "ts_mismatch", False), None, "request_id required at binding"),
    (_rej("time", "elsewhere", True), None, "code outside the stage table"),
]


@pytest.mark.parametrize(("answer", "kind", "action"), EVENT_VALID, ids=[f"{k}-{i}" for i, (_a, k, _x) in enumerate(EVENT_VALID)])
def test_closed_event_answers_are_classified(answer, kind, action):
    sequence = answer.get("sequence")
    got, _data = le.classify({"service_response": copy.deepcopy(answer)}, RID, sequence, action)
    assert got == kind


@pytest.mark.parametrize(("answer", "action", "why"), EVENT_INVALID, ids=[w for _a, _x, w in EVENT_INVALID])
def test_event_answers_outside_the_closed_shapes_are_invalid(answer, action, why):
    assert le.classify(copy.deepcopy(answer), RID, 2, action) == ("invalid", {"code": "invalid_response"}), why


# ---- parity with the JSON Schemas where jsonschema is installed

def _validator(action: str):
    jsonschema = pytest.importorskip("jsonschema", reason="NOT_RUN: jsonschema is not installed")
    schema = _json(f"{action}.answer.schema.json")
    cls = jsonschema.Draft202012Validator
    cls.check_schema(schema)
    return cls(schema)


@pytest.mark.parametrize("action", la.REQUEST_ACTIONS)
def test_the_classifier_agrees_with_the_closed_json_schemas(action):
    validator = _validator(action)
    for a, answer, kind in VALID:
        if a == action and not (action == "capture_confirm" and kind == "ok"):  # the full ManagedUser.public() person is WisKey's: the fake person is not it
            assert validator.is_valid(answer), (answer, [e.message for e in validator.iter_errors(answer)])
    for a, answer, why in INVALID:
        if a != action:
            continue
        if why in ("another request", "request_id of another request", "code of another action", "code of the cancel table", "code of the confirm table",
                   "lease_window is capture_start's", "person with a pin", "person with a card number", "person with a photo", "sent_unknown is confirm only"):
            continue  # context-dependent (the request's own id / the action's table): the schema of THIS action decides only where it can
        assert not validator.is_valid(answer), (why, answer)


# ---------------------------------------------------------------- the routes treat a non-closed answer as unclear

def _override(route_world, monkeypatch, action: str, make) -> None:
    orig = route_world.host.handle_request
    monkeypatch.setattr(route_world.host, "handle_request", lambda dto: make(dto) if dto.action == action else orig(dto))


def test_a_start_refused_with_a_code_outside_the_start_table_is_an_unknown_start(route, monkeypatch):
    w = route
    _override(w, monkeypatch, "capture_start", lambda dto: {"result": "refused", "request_id": dto.request_id, "code": "capture_applying"})
    r = start(w)
    assert r.status_code == 504 and r.json()["details"]["outcome"] == "unknown", "not a clean refusal: the reader may be collecting"
    w.step(0.25)
    with w.db.connection(mode="read") as conn:
        assert conn.execute("SELECT reason FROM capture_leases").fetchone()[0] == "start_unknown"


def test_a_confirm_acknowledged_with_an_extra_field_is_an_unknown_confirm_and_is_never_resent(route, monkeypatch):
    w = route
    sid = start(w).json()["capture"]["session_id"]
    ref = lease_of(w, sid)["id"]
    w.host.present_card(ref)
    wait_state(w, sid, "captured")
    intercom_capture.CAPTURES._stop.set()
    _override(w, monkeypatch, "capture_confirm", lambda dto: {"result": "acknowledged", "request_id": dto.request_id, "person": copy.deepcopy(LEASE_PERSON), "applying": True})
    r = w.client.post(f"/api/v1/intercom/card-capture/{sid}/confirm", json=env(label="x", confirmed=True), headers=as_user("joni"))
    assert r.status_code == 504 and r.json()["user_message"] == capture_lease_route.CONFIRM_UNKNOWN_TEXT
    assert lease_of(w, sid)["reason"] == "confirm_unknown"
    assert len([c for c in w.bridge.calls if "dto" in c and c["dto"].action == "capture_confirm"]) == 1


def test_a_status_binding_denied_ends_the_session_as_lost(route, monkeypatch):
    w = route
    sid = start(w).json()["capture"]["session_id"]
    _override(w, monkeypatch, "capture_status", lambda dto: {"result": "refused", "request_id": dto.request_id, "code": "binding_denied"})
    wait_state(w, sid, "lost")
    row = lease_of(w, sid)
    assert row["state"] == "destroyed" and row["reason"] == "lost"
