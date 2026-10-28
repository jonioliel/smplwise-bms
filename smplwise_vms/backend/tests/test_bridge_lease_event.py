"""LEASEBR-295 (slice L4 of the capture lease): the bridge's `lease_event` / `lease_request` - the contract's stages 1-7 through the bridge's key set,
the closed answers, and the relay to the (not yet confirmed) WisKey consumer.

Home Assistant is NOT installed here: the pure modules (lease_contract, lease_answers, lease_service, keyset) are loaded without the package's
`__init__.py` (bridge_loader), and the Home Assistant wiring is checked from the source text. GOLDEN_VECTORS.json is the oracle; the HMAC key is
the published TEST constant of that file. Synthetic data only; nothing contacts a bridge, WisKey, a reader or Home Assistant."""
from __future__ import annotations

import ast
import asyncio
import copy
import dataclasses
import json
import logging
import re
import sys
import types
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pytest
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bridge_loader  # noqa: E402

REPO = bridge_loader.REPO
CONTRACT = REPO / "docs" / "contracts" / "wiskey-capture-lease"
VECTORS = json.loads((CONTRACT / "GOLDEN_VECTORS.json").read_text(encoding="utf-8"))
TEST_SECRET = VECTORS["test_hmac_key"]["value"]

const = bridge_loader.load("const")
keyset = bridge_loader.load("keyset")
lc = bridge_loader.load("lease_contract")
la = bridge_loader.load("lease_answers")
ls = bridge_loader.load("lease_service")

SERVICE_NAME = {"lease_event": const.SERVICE_LEASE_EVENT, "lease_request": const.SERVICE_LEASE_REQUEST}  # the vectors' names -> the bridge's constants
KIND = {"lease_event": lc.KIND_EVENT, "lease_request": lc.KIND_REQUEST}


def _epoch(t: str) -> int:
    return int(datetime.strptime(t, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc).timestamp())


def _ks(**kw: Any) -> Any:
    return keyset.KeySet(TEST_SECRET, **kw)


def _run(vector: dict[str, Any], ks: Any = None, now: Any = None) -> Any:
    return lc.validate(KIND[vector["service"]], {"signed_message_json": vector["signed_message_json"]}, ks or _ks(), vector["now"] if now is None else now)


ACCEPT = {v["id"]: v for v in VECTORS["accept"]}
REJECT = {v["id"]: v for v in VECTORS["reject"]}


def _msg(vid: str = "capture_status") -> dict[str, Any]:
    return json.loads(ACCEPT[vid]["signed_message_json"])


def _text(m: dict[str, Any]) -> str:
    return json.dumps(m, ensure_ascii=False, separators=(",", ":"))


def _resign(m: dict[str, Any], ks: Any = None, **changes: Any) -> str:
    """The message with `changes` (top-level fields) re-signed by `ks` (default: the TEST key, kid-less). ts follows issued_at unless given."""
    m = {**copy.deepcopy(m), **changes}
    ts, nonce = m.pop("ts"), m.pop("nonce")
    m.pop("sig", None), m.pop("kid", None)
    ts = changes.get("ts", _epoch(m["issued_at"]))
    return _text((ks or _ks()).sign(m, ts=ts, nonce=nonce))


def _kind_of(vector: dict[str, Any]) -> str:
    return KIND[vector["service"]]


# ---------------------------------------------------------------- the oracle: every golden vector

def test_the_vector_file_is_the_one_this_test_was_written_for():
    assert VECTORS["protocol"] == lc.PROTOCOL == "wiskey-capture-lease-v1"
    assert (len(VECTORS["accept"]), len(VECTORS["reject"])) == (8, 14)
    assert {v["service"] for v in VECTORS["accept"] + VECTORS["reject"]} == {"lease_event", "lease_request"}


@pytest.mark.parametrize("vid", list(ACCEPT))
def test_every_accept_vector_passes_all_stages_with_the_stated_now(vid):
    v = ACCEPT[vid]
    dto = _run(v)
    assert dto.action == json.loads(v["signed_message_json"])["action"]
    assert dto.kind == _kind_of(v)
    assert dto.body_sha256 == v["body_sha256_of_signed_fields"]  # the same bytes the oracle hashed
    assert dto.request_id == json.loads(v["signed_message_json"])["request_id"]


@pytest.mark.parametrize("vid", list(REJECT))
def test_every_reject_vector_is_refused_at_exactly_the_stated_stage_and_code(vid):
    v = REJECT[vid]
    with pytest.raises(lc.Reject) as err:
        _run(v)
    assert (err.value.stage, err.value.code) == (v["expect"]["stage"], v["expect"]["code"])
    answer = err.value.answer()
    assert answer["result"] == "rejected" and answer["stage"] == v["expect"]["stage"] and answer["code"] == v["expect"]["code"]
    if err.value.stage in lc.POST_SCHEMA_STAGES:  # DTO v3 section 9: request_id iff the schema stage passed
        assert answer["request_id"] == json.loads(v["signed_message_json"])["request_id"]
    else:
        assert "request_id" not in answer


def test_the_accept_vectors_share_one_key_set_without_a_false_replay():
    ks = _ks()
    for v in VECTORS["accept"]:
        _run(v, ks)  # eight different nonces under one ts: the replay verdict is per nonce (and per persisted high-water mark), not per ts


def test_the_golden_count_summary():
    passed = failed = 0
    for v in VECTORS["accept"]:
        try:
            _run(v)
            passed += 1
        except lc.Reject:
            failed += 1
    refused_exact = 0
    for v in VECTORS["reject"]:
        try:
            _run(v)
        except lc.Reject as r:
            refused_exact += (r.stage, r.code) == (v["expect"]["stage"], v["expect"]["code"])
    assert (passed, failed, refused_exact) == (8, 0, 14)


# ---------------------------------------------------------------- stage order and state

def test_a_replay_of_an_accepted_message_is_state_replay_and_a_fresh_key_set_with_a_persisted_high_water_mark_also_refuses():
    ks = _ks()
    v = ACCEPT["capture_start"]
    _run(v, ks)
    with pytest.raises(lc.Reject) as err:
        _run(v, ks)
    assert (err.value.stage, err.value.code) == ("state", "replay") and err.value.answer()["request_id"]
    saved = ks.state()  # the high-water mark is part of the persisted state (a restart)
    with pytest.raises(lc.Reject) as err2:
        _run(v, keyset.KeySet(TEST_SECRET, saved))
    assert (err2.value.stage, err2.value.code) == ("state", "replay")


def test_time_is_decided_before_replay_and_signature_before_time():
    ks = _ks()
    m = _msg("capture_status")
    issued = _epoch(m["issued_at"])
    for _ in range(2):  # an expired message is `expired` the first time AND when the same bytes come again (never `replay`)
        with pytest.raises(lc.Reject) as err:
            lc.validate("request", {"signed_message_json": _text(m)}, ks, issued + 20)
        assert (err.value.stage, err.value.code) == ("time", "expired")
    bad = copy.deepcopy(m)
    bad["sig"] = "0" * 64
    with pytest.raises(lc.Reject) as err3:  # bad signature AND expired: the signature stage speaks first
        lc.validate("request", {"signed_message_json": _text(bad)}, _ks(), issued + 20)
    assert (err3.value.stage, err3.value.code) == ("signature", "bad_signature")


def test_the_time_stage_codes_and_the_key_set_window_never_leak_as_signature_or_state():
    m = _msg("capture_status")
    issued = _epoch(m["issued_at"])
    cases = [(issued - 1, "not_yet_valid"), (issued + 15, "expired"), (issued + 3600, "expired"), (issued - 3600, "not_yet_valid"), (0, "clock_invalid"),
             (lc.CLOCK_FLOOR - 1, "clock_invalid"), (None, "clock_invalid"), (float(issued), "clock_invalid")]
    for now, code in cases:
        with pytest.raises(lc.Reject) as err:
            lc.validate("request", {"signed_message_json": _text(m)}, _ks(), now)
        assert (err.value.stage, err.value.code) == ("time", code), now
    # the last second of life is still valid
    assert lc.validate("request", {"signed_message_json": _text(m)}, _ks(), issued + 14).action == "capture_status"


def test_a_lifetime_of_zero_negative_or_sixteen_is_lifetime_invalid_and_fifteen_passes():
    m = _msg("capture_status")
    issued = _epoch(m["issued_at"])
    for lifetime, ok in ((15, True), (16, False), (0, False), (-5, False)):
        text = _resign(m, expires_at=datetime.fromtimestamp(issued + lifetime, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"))
        if ok:
            lc.validate("request", {"signed_message_json": text}, _ks(), issued + 1)
        else:
            with pytest.raises(lc.Reject) as err:
                lc.validate("request", {"signed_message_json": text}, _ks(), issued + 1)
            assert (err.value.stage, err.value.code) == ("time", "lifetime_invalid")


# ---------------------------------------------------------------- stages 1-4

def _stage(data: Any, kind: str = "request") -> tuple[str, str]:
    with pytest.raises(lc.Reject) as err:
        lc.validate(kind, data, _ks(), ACCEPT["capture_status"]["now"])
    assert "request_id" not in err.value.answer()
    return err.value.stage, err.value.code


def test_transport_shape_is_exactly_one_string_field():
    good = ACCEPT["capture_status"]["signed_message_json"]
    for data in (None, [], "x", {}, {"signed_message_json": 5}, {"signed_message_json": None}, {"signed_message_json": good, "extra": 1}, {"other": good},
                 {"signed_message_json": good.encode()}, {"signed_message_json": {"a": 1}}):
        assert _stage(data) == ("transport", "transport_shape"), data


def test_encoding_and_parse_stages():
    def t(text: str) -> tuple[str, str]:
        return _stage({"signed_message_json": text})

    assert t("\ud800") == ("encoding", "lone_surrogate")
    assert t(" " * 8193) == ("encoding", "message_too_large")
    assert t("é" * 4097) == ("encoding", "message_too_large")  # bytes, not characters: 4097 * 2 > 8192
    assert t("") == ("parse", "invalid_json")
    assert t("{") == ("parse", "invalid_json")
    assert t("[" * 6000) == ("parse", "invalid_json")  # deeply nested: no RecursionError escapes
    assert t("[]") == ("parse", "not_an_object")
    assert t("1") == ("parse", "not_an_object")
    assert t('{"a":1,"a":2}') == ("parse", "duplicate_key")
    assert t('{"a":{"b":1,"b":1}}') == ("parse", "duplicate_key")
    assert t('{"a":NaN}') == ("parse", "non_json_constant")
    assert t('{"a":-Infinity}') == ("parse", "non_json_constant")
    assert t('{"a":1.0}') == ("parse", "non_integer_number")
    assert t('{"a":1e3}') == ("parse", "non_integer_number")
    assert t('{"a":9007199254740992}') == ("parse", "integer_out_of_range")
    assert t('{"a":-9007199254740992}') == ("parse", "integer_out_of_range")
    assert t('{"a":' + "9" * 5000 + "}") == ("parse", "integer_out_of_range")  # past int()'s own digit limit, still a clean refusal
    assert t('{"a":"\\ud800"}') == ("parse", "lone_surrogate")
    assert t('{"\\udc00":1}') == ("parse", "lone_surrogate")
    # exactly 8192 bytes is still read (and then refused at the schema stage - it is not a lease message)
    assert t('{"a":"' + "x" * (8192 - 8) + '"}') == ("schema", "unknown_field")


def test_the_closed_schema_refuses_every_extra_missing_or_mistyped_field():
    base = _msg("capture_confirm")

    def refused(mutate) -> tuple[str, str]:
        m = copy.deepcopy(base)
        mutate(m)
        return _stage({"signed_message_json": _text(m)})

    assert refused(lambda m: m.update(extra=1)) == ("schema", "unknown_field")
    assert refused(lambda m: m.pop("nonce")) == ("schema", "missing_field")
    assert refused(lambda m: m.update(ts="1")) == ("schema", "wrong_type")
    assert refused(lambda m: m.update(ts=True)) == ("schema", "wrong_type")
    assert refused(lambda m: m.update(actor="x")) == ("schema", "wrong_type")
    assert refused(lambda m: m["actor"].update(role="admin")) == ("schema", "unknown_field")
    assert refused(lambda m: m["actor"].update(id="")) == ("schema", "bad_format")
    assert refused(lambda m: m["actor"].update(id="a\u0085b")) == ("schema", "bad_format")  # C1 control
    assert refused(lambda m: m["actor"].update(display_name="x" * 129)) == ("schema", "bad_format")
    assert refused(lambda m: m.update(station="")) == ("schema", "bad_format")
    assert refused(lambda m: m.update(nonce="A" * 32)) == ("schema", "bad_format")
    assert refused(lambda m: m.update(request_id="not-a-uuid")) == ("schema", "bad_format")
    assert refused(lambda m: m.update(issued_at="2026-10-16 12:00:00")) == ("schema", "bad_format")
    assert refused(lambda m: m.update(issued_at="2026-13-16T12:00:00Z")) == ("schema", "bad_format")
    assert refused(lambda m: m.update(action="door_open")) == ("schema", "bad_value")
    assert refused(lambda m: m["params"].update(label="x" * 65)) == ("schema", "bad_format")
    assert refused(lambda m: m["params"].update(label=5)) == ("schema", "bad_format")
    assert refused(lambda m: m["params"].update(card_number="1234")) == ("schema", "unknown_field")
    assert refused(lambda m: m["params"].pop("session_id")) == ("schema", "missing_field")
    assert refused(lambda m: m["params"].update(lease_ref="*")) == ("schema", "bad_format")
    # the v1 wire is EXACTLY the closed schema: a `kid` (valid or not) is an unknown field, not an extension
    assert refused(lambda m: m.update(kid="g1-0a1b2c3d")) == ("schema", "unknown_field")
    assert refused(lambda m: m.update(kid=7)) == ("schema", "unknown_field")
    # an empty label is allowed (0..64)
    ok = _resign(base, params={**base["params"], "label": ""})
    assert lc.validate("request", {"signed_message_json": ok}, _ks(), ACCEPT["capture_confirm"]["now"]).params["label"] == ""


def test_the_start_lease_object_is_closed_in_every_field():
    base = _msg("capture_start")

    def refused(mutate) -> tuple[str, str]:
        m = copy.deepcopy(base)
        mutate(m["params"]["lease"])
        return _stage({"signed_message_json": _text(m)})

    assert refused(lambda l: l.update(address="x")) == ("schema", "unknown_field")
    assert refused(lambda l: l["receiver"].update(serial="x")) == ("schema", "unknown_field")
    assert refused(lambda l: l["receiver"].update(reader_id=9)) == ("schema", "bad_value")
    assert refused(lambda l: l["receiver"].update(reader_id=-1)) == ("schema", "bad_value")
    assert refused(lambda l: l.update(stream_id="xyz")) == ("schema", "bad_format")
    assert refused(lambda l: l.update(lease_ref="1234")) == ("schema", "bad_format")
    assert refused(lambda l: l.update(person_ref="")) == ("schema", "bad_value")
    assert refused(lambda l: l.update(permission_revision=-1)) == ("schema", "bad_value")
    assert refused(lambda l: l.update(binding_revision=5)) == ("schema", "bad_format")
    assert refused(lambda l: l.update(lease_actions=["capture_start", "capture_status", "capture_confirm", "capture_cancel", "x"])) == ("schema", "bad_value")
    assert refused(lambda l: l.update(lease_expires_at=l["lease_issued_at"])) == ("schema", "bad_value")  # zero length


# ---------------------------------------------------------------- stage 5: binding

def test_binding_rules():
    # an event action sent to the request service and the reverse
    with pytest.raises(lc.Reject) as err:
        lc.validate("request", {"signed_message_json": ACCEPT["heartbeat"]["signed_message_json"]}, _ks(), ACCEPT["heartbeat"]["now"])
    assert (err.value.stage, err.value.code) == ("binding", "action_service_mismatch") and err.value.answer()["request_id"]
    with pytest.raises(lc.Reject) as err2:
        lc.validate("event", {"signed_message_json": ACCEPT["capture_cancel"]["signed_message_json"]}, _ks(), ACCEPT["capture_cancel"]["now"])
    assert (err2.value.stage, err2.value.code) == ("binding", "action_service_mismatch")
    m = _msg("capture_status")
    ts_bad = _text({**m, "ts": m["ts"] + 1})
    with pytest.raises(lc.Reject) as err3:
        lc.validate("request", {"signed_message_json": ts_bad}, _ks(), ACCEPT["capture_status"]["now"])
    assert (err3.value.stage, err3.value.code) == ("binding", "ts_mismatch")
    # station scope, both directions: a named station on a wide action, and "*" on a lease-scoped one
    for vid, station in (("heartbeat", "entry-a"), ("stream_reset", "entry-a"), ("revoke_lease_scope", "*"), ("capture_start", "*"), ("capture_status", "*")):
        with pytest.raises(lc.Reject) as e:
            lc.validate(_kind_of(ACCEPT[vid]), {"signed_message_json": _resign(_msg(vid), station=station)}, _ks(), ACCEPT[vid]["now"])
        assert (e.value.stage, e.value.code) == ("binding", "station_scope_mismatch"), vid
    # the start's own window: lease_issued_at <= issued_at < lease_expires_at
    start = _msg("capture_start")
    lease = {**start["params"]["lease"], "lease_issued_at": "2026-10-16T12:00:05Z", "lease_expires_at": "2026-10-16T12:02:05Z"}
    with pytest.raises(lc.Reject) as e2:
        lc.validate("request", {"signed_message_json": _resign(start, params={"lease": lease})}, _ks(), ACCEPT["capture_start"]["now"])
    assert (e2.value.stage, e2.value.code) == ("binding", "lease_window")


# ---------------------------------------------------------------- stage 6: the key set (rotation, kid)

LEGACY_SIGNING_STATE = {"v": 1, "signing": "g1-0a1b2c3d", "keys": {"g1-0a1b2c3d": "synthetic-rotated-key-material-0001"}, "old": None, "next": None,
                        "legacy_retired": True, "rotation": None, "hw": {}}


def _no_kid(text: str) -> str:
    m = json.loads(text)
    assert "kid" in m  # a rotated key signs the v2 recipe, which names its kid on the wire ...
    del m["kid"]  # ... and the lease wire leaves it off: the bridge finds the key itself
    return _text(m)


def test_a_wire_with_a_kid_is_not_a_lease_message():
    rotated = keyset.KeySet(TEST_SECRET, copy.deepcopy(LEGACY_SIGNING_STATE))
    with_kid = _resign(_msg("capture_status"), ks=rotated)
    assert json.loads(with_kid)["kid"] == "g1-0a1b2c3d"
    with pytest.raises(lc.Reject) as err:
        lc.validate("request", {"signed_message_json": with_kid}, rotated, ACCEPT["capture_status"]["now"])
    assert (err.value.stage, err.value.code) == ("schema", "unknown_field") and "request_id" not in err.value.answer()


def test_a_lease_signed_by_a_rotated_key_verifies_without_a_kid_and_the_old_secret_does_not():
    rotated = keyset.KeySet(TEST_SECRET, copy.deepcopy(LEGACY_SIGNING_STATE))
    base = _msg("capture_status")
    text = _no_kid(_resign(base, ks=rotated))
    dto = lc.validate("request", {"signed_message_json": text}, rotated, ACCEPT["capture_status"]["now"])
    assert dto.action == "capture_status" and "kid" not in dto.as_json() and "sig" not in dto.as_json()
    # the same bytes again: replay, decided by the key set's bookkeeping for the key that matched
    with pytest.raises(lc.Reject) as again:
        lc.validate("request", {"signed_message_json": text}, rotated, ACCEPT["capture_status"]["now"])
    assert (again.value.stage, again.value.code) == ("state", "replay")
    # the retired pairing secret (kid-less v1 recipe): the downgrade guard of the key set refuses it as a bad signature
    kidless = _resign(base)
    with pytest.raises(lc.Reject) as err:
        lc.validate("request", {"signed_message_json": kidless}, rotated, ACCEPT["capture_status"]["now"])
    assert (err.value.stage, err.value.code) == ("signature", "bad_signature") and err.value.answer()["request_id"] == base["request_id"]
    # a key the key set does not hold: the same answer, no hint which part was wrong
    other = keyset.KeySet(TEST_SECRET, {**copy.deepcopy(LEGACY_SIGNING_STATE), "signing": "g2-ffffffff", "keys": {"g2-ffffffff": "other-material"}})
    with pytest.raises(lc.Reject) as err2:
        lc.validate("request", {"signed_message_json": _no_kid(_resign(base, ks=other))}, keyset.KeySet(TEST_SECRET, copy.deepcopy(LEGACY_SIGNING_STATE)),
                    ACCEPT["capture_status"]["now"])
    assert (err2.value.stage, err2.value.code) == ("signature", "bad_signature")
    # tampering with the body breaks the MAC of the rotated key too
    tampered = json.loads(text)
    tampered["station"] = "entry-b"
    with pytest.raises(lc.Reject) as err3:
        lc.validate("request", {"signed_message_json": _text(tampered)}, keyset.KeySet(TEST_SECRET, copy.deepcopy(LEGACY_SIGNING_STATE)), ACCEPT["capture_status"]["now"])
    assert (err3.value.stage, err3.value.code) == ("signature", "bad_signature")


def test_during_a_rotation_both_keys_verify_lease_messages():
    now_wall = float(ACCEPT["capture_status"]["now"])
    state = {"v": 1, "signing": "g1-0a1b2c3d", "keys": {"g1-0a1b2c3d": "synthetic-rotated-key-material-0001"}, "old": "g0-legacy", "next": None,
             "legacy_retired": False, "rotation": {"id": "r1", "t0_wall": now_wall - 5, "committed": True, "closed": False, "mode": "routine", "overlap_s": 60}, "hw": {}}
    both = keyset.KeySet(TEST_SECRET, state, now=lambda: now_wall, mono=lambda: 0.0)
    new_key_signer = keyset.KeySet(TEST_SECRET, copy.deepcopy(state), now=lambda: now_wall, mono=lambda: 0.0)
    base = _msg("capture_status")
    assert lc.validate("request", {"signed_message_json": _no_kid(_resign(base, ks=new_key_signer))}, both, ACCEPT["capture_status"]["now"]).action == "capture_status"
    other = _msg("capture_cancel")
    assert lc.validate("request", {"signed_message_json": _text(other)}, both, ACCEPT["capture_cancel"]["now"]).action == "capture_cancel"  # kid-less, old key


def test_the_bridge_asks_the_key_set_and_no_second_verifier_exists():
    class Spy:
        def __init__(self) -> None:
            self.calls: list[Any] = []

        def verify(self, message: dict[str, Any], now: Any = None) -> str | None:
            self.calls.append((sorted(message), now))
            return None

    spy = Spy()
    v = ACCEPT["heartbeat"]
    lc.validate("event", {"signed_message_json": v["signed_message_json"]}, spy, v["now"])
    assert len(spy.calls) == 1 and spy.calls[0][1] == v["now"] and "sig" in spy.calls[0][0]
    for verdict in ("bad_signature", "bad_format", "anything-new"):
        class Fixed:
            def verify(self, message: dict[str, Any], now: Any = None, _v: str = verdict) -> str | None:
                return _v

        with pytest.raises(lc.Reject) as err:
            lc.validate("event", {"signed_message_json": v["signed_message_json"]}, Fixed(), v["now"])
        assert (err.value.stage, err.value.code) == ("signature", "bad_signature")
    src = (bridge_loader.SRC / "lease_contract.py").read_text(encoding="utf-8")
    assert "hmac" not in src.replace("HMAC", "") and "compare_digest" not in src  # the MAC is the key set's business alone


# ---------------------------------------------------------------- the DTO

def test_the_dto_is_immutable_and_carries_no_secret_and_its_repr_names_the_action_only():
    dto = _run(ACCEPT["capture_confirm"])
    assert dataclasses.is_dataclass(dto)
    with pytest.raises(dataclasses.FrozenInstanceError):
        dto.action = "capture_start"  # type: ignore[misc]
    with pytest.raises(TypeError):
        dto.params["label"] = "x"  # type: ignore[index]
    start = _run(ACCEPT["capture_start"])
    with pytest.raises(TypeError):
        start.params["lease"]["receiver"]["reader_id"] = 5  # type: ignore[index]
    assert isinstance(start.params["lease"]["lease_actions"], tuple)
    assert repr(dto) == "LeaseDTO(capture_confirm)" and "label" not in repr(dto) and dto.params["label"] not in repr(dto)
    as_json = dto.as_json()
    assert set(as_json) == {"action", "actor", "station", "params", "request_id", "nonce", "issued_at", "expires_at", "body_sha256"}
    as_json["params"]["label"] = "changed"
    assert dto.params["label"] != "changed"  # a copy
    assert json.loads(json.dumps(start.as_json()))["params"]["lease"]["lease_actions"] == list(lc.REQUEST_ACTIONS)


# ---------------------------------------------------------------- the answers

UUID4 = json.loads(ACCEPT["capture_status"]["signed_message_json"])["request_id"]
PERSON = {
    "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7", "employee_no": "E1", "display_name": "Test Person", "phone": "", "access_category": "staff", "responsible_person": "",
    "access_purpose": "", "archived_at": None, "access_timing_draft": None, "access_timing_policy": None, "active": True, "user_type": "normal", "valid_from": None,
    "valid_until": None, "assignments": {"u1": {"config_entry_id": "entry1", "enabled": True, "allowed_locks": [1, 2], "schedule_template": None, "desired_revision": 2,
                                                 "applied_revision": None, "sync_state": "pending", "last_sync_at": None, "last_error": None}},
    "revision": 3, "created_at": "2026-10-16T12:00:00Z", "updated_at": "2026-10-16T12:00:01Z", "identity_locked": False, "profile": {}, "group_ids": [],
    "permission_overrides": {"door.open": "allow"}, "photo_configured": False, "pin_configured": False,
    "cards": [{"id": "c1", "masked_number": "•••• AB12", "label": "main", "card_type": "normalCard", "enabled": True}],
}


def _ack(dto: Any) -> dict[str, Any]:
    rid = dto.request_id
    return {
        "lease_revoke": {"result": "acknowledged", "request_id": rid, "sequence": dto.params.get("sequence"), "destroyed": 1},
        "lease_heartbeat": {"result": "acknowledged", "request_id": rid, "sequence": dto.params.get("sequence"), "destroyed": 0, "live_leases": list(dto.params.get("live_leases", ()))},
        "lease_stream_reset": {"result": "acknowledged", "request_id": rid, "sequence": 1, "destroyed": 0},
        "capture_start": {"result": "acknowledged", "request_id": rid, "session": {"session_id": "0123456789abcdef", "state": "waiting"}},
        "capture_status": {"result": "acknowledged", "request_id": rid, "capture": {"state": "captured", "error": None, "card": {"masked_number": "••••", "technology": "TypeA_M1", "reader_id": 1}}},
        "capture_confirm": {"result": "acknowledged", "request_id": rid, "person": copy.deepcopy(PERSON)},
        "capture_cancel": {"result": "acknowledged", "request_id": rid, "cancelled": True},
    }[dto.action]


def _answer_fn(dto: Any):
    return la.event_answer if dto.kind == "event" else la.request_answer


@pytest.mark.parametrize("vid", list(ACCEPT))
def test_a_closed_acknowledgement_for_every_action_passes_unchanged_and_as_a_copy(vid):
    dto = _run(ACCEPT[vid])
    ack = _ack(dto)
    out = _answer_fn(dto)(dto, ack)
    assert out == ack and out is not ack


def test_event_answer_variants_and_what_they_must_echo():
    dto = _run(ACCEPT["revoke_lease_scope"])
    seq, rid = dto.params["sequence"], dto.request_id
    good = [{"result": "acknowledged", "request_id": rid, "sequence": seq, "destroyed": 0}, {"result": "duplicate", "request_id": rid, "sequence": seq},
            {"result": "stale", "request_id": rid, "sequence": seq, "last_sequence": seq + 3},
            {"result": "gap", "request_id": rid, "sequence": seq, "last_sequence": 0, "destroyed": 2},
            {"result": "conflict", "request_id": rid, "sequence": seq, "destroyed": 4}, {"result": "unknown_stream", "request_id": rid},
            {"result": "rejected", "stage": "state", "code": "replay", "request_id": rid},
            {"result": "rejected", "stage": "time", "code": "expired", "request_id": rid},
            {"result": "rejected", "stage": "signature", "code": "bad_signature", "request_id": rid},
            {"result": "rejected", "stage": "binding", "code": "station_scope_mismatch", "request_id": rid}]
    for a in good:
        assert la.event_answer(dto, a) == a, a
    bad = [{"result": "acknowledged", "request_id": rid, "sequence": seq + 1, "destroyed": 0},  # another sequence
           {"result": "acknowledged", "request_id": "11111111-1111-4111-8111-111111111111", "sequence": seq, "destroyed": 0},  # another request
           {"result": "acknowledged", "request_id": rid, "sequence": seq},  # missing destroyed
           {"result": "acknowledged", "request_id": rid, "sequence": seq, "destroyed": 0, "live_leases": []},  # live_leases only on a heartbeat
           {"result": "acknowledged", "request_id": rid, "sequence": seq, "destroyed": True},
           {"result": "acknowledged", "request_id": rid, "sequence": seq, "destroyed": -1},
           {"result": "acknowledged", "request_id": rid, "sequence": seq, "destroyed": 0, "note": "ok"},
           {"result": "duplicate", "request_id": rid, "sequence": seq, "destroyed": 0},
           {"result": "unknown_stream", "request_id": rid, "sequence": seq},
           {"result": "rejected", "stage": "schema", "code": "bad_value", "request_id": rid},  # pre-schema stages are the bridge's, never the host's
           {"result": "rejected", "stage": "transport", "code": "transport_shape", "request_id": rid},
           {"result": "rejected", "stage": "binding", "code": "lease_window", "request_id": rid},  # a capture_start code only
           {"result": "rejected", "stage": "State", "code": "replay", "request_id": rid},
           {"result": "rejected", "stage": "state", "code": "time/expired", "request_id": rid},
           {"result": "rejected", "stage": "state", "code": "a" * 65, "request_id": rid},
           {"result": "rejected", "stage": "state", "code": "because", "request_id": rid},
           {"result": "rejected", "stage": "state", "code": "replay"},
           {"result": "refused", "request_id": rid, "code": "lease_gone"}, {"result": "ok"}, {}, None, [], "acknowledged"]
    for a in bad:
        assert la.event_answer(dto, a) is None, a
    hb = _run(ACCEPT["heartbeat"])
    live = ["7c9e6679-7425-40de-944b-e07fc1f90ae7"]
    assert la.event_answer(hb, {"result": "acknowledged", "request_id": hb.request_id, "sequence": hb.params["sequence"], "destroyed": 0, "live_leases": live})
    for lv in (["x"], live + live, [5], "7c9e6679-7425-40de-944b-e07fc1f90ae7"):
        assert la.event_answer(hb, {"result": "acknowledged", "request_id": hb.request_id, "sequence": hb.params["sequence"], "destroyed": 0, "live_leases": lv}) is None
    # an event answer can never answer a request action and the reverse
    assert la.event_answer(_run(ACCEPT["capture_status"]), {"result": "unknown_stream", "request_id": UUID4}) is None
    assert la.request_answer(dto, {"result": "unknown_stream", "request_id": rid}) is None


def test_request_answers_refused_codes_are_closed_per_action_and_sent_unknown_is_confirm_only():
    for vid in ("capture_start", "capture_status", "capture_confirm", "capture_cancel"):
        dto = _run(ACCEPT[vid])
        for code in la.REFUSED_CODES[dto.action]:
            a = {"result": "refused", "request_id": dto.request_id, "code": code}
            assert la.request_answer(dto, a) == a
        others = set().union(*la.REFUSED_CODES.values()) - set(la.REFUSED_CODES[dto.action])
        for code in others | {"Unauthorized", "free text", ""}:
            assert la.request_answer(dto, {"result": "refused", "request_id": dto.request_id, "code": code}) is None, (vid, code)
        unknown = {"result": "sent_unknown", "request_id": dto.request_id}
        assert (la.request_answer(dto, unknown) == unknown) is (vid == "capture_confirm")


def test_no_card_value_pin_photo_or_extra_field_gets_out_through_an_answer():
    status = _run(ACCEPT["capture_status"])
    ok = _ack(status)
    cap = ok["capture"]
    leaks = [
        {**cap, "card": {**cap["card"], "masked_number": "1234567890"}},
        {**cap, "card": {**cap["card"], "masked_number": "•••• 12345"}},
        {**cap, "card": {**cap["card"], "card_no": "1234567890"}},
        {**cap, "card": {**cap["card"], "hash": "ab" * 16}},
        {**cap, "card": {**cap["card"], "reader_id": 9}},
        {**cap, "card": {**cap["card"], "technology": "Magic"}},
        {**cap, "state": "waiting"},  # card only when captured
        {**cap, "state": "error"},  # error needs a code and no card
        {"state": "waiting", "error": "capture_failed", "card": None},
        {**cap, "length": 10},
    ]
    for leak in leaks:
        assert la.request_answer(status, {**ok, "capture": leak}) is None, leak
    assert la.request_answer(status, {**ok, "serial": "x"}) is None
    confirm = _run(ACCEPT["capture_confirm"])
    ok2 = _ack(confirm)
    for key, value in (("pin", "1234"), ("card_no", "1234567890"), ("photo", "data"), ("badge", "1")):
        person = {**copy.deepcopy(PERSON), key: value}
        assert la.request_answer(confirm, {**ok2, "person": person}) is None, key
    person = copy.deepcopy(PERSON)
    person["cards"][0]["masked_number"] = "12345678"
    assert la.request_answer(confirm, {**ok2, "person": person}) is None
    person = copy.deepcopy(PERSON)
    del person["revision"]
    assert la.request_answer(confirm, {**ok2, "person": person}) is None
    person = copy.deepcopy(PERSON)
    person["display_name"] = "x" * 33
    assert la.request_answer(confirm, {**ok2, "person": person}) is None
    # start: no address, no serial
    start = _run(ACCEPT["capture_start"])
    ok3 = _ack(start)
    assert la.request_answer(start, {**ok3, "session": {**ok3["session"], "address": "10.0.0.1"}}) is None
    assert la.request_answer(start, {**ok3, "session": {**ok3["session"], "session_id": "has space"}}) is None
    assert la.request_answer(start, {**ok3, "session": {**ok3["session"], "state": "captured"}}) is None
    cancel = _run(ACCEPT["capture_cancel"])
    assert la.request_answer(cancel, {**_ack(cancel), "cancelled": False}) is None
    assert la.request_answer(cancel, {**_ack(cancel), "cancelled": 1}) is None


# a small evaluator of the JSON-Schema subset the five answer schemas use: the bridge's hand-written checks are compared with the contract files
def _schema_ok(schema: dict[str, Any], inst: Any, root: dict[str, Any]) -> bool:
    if "$ref" in schema:
        node: Any = root
        for part in schema["$ref"].lstrip("#/").split("/"):
            node = node[part]
        return _schema_ok(node, inst, root)
    if "oneOf" in schema and sum(_schema_ok(s, inst, root) for s in schema["oneOf"]) != 1:
        return False
    if "allOf" in schema and not all(_schema_ok(s, inst, root) for s in schema["allOf"]):
        return False
    if "if" in schema:
        branch = schema.get("then") if _schema_ok(schema["if"], inst, root) else schema.get("else")
        if branch is not None and not _schema_ok(branch, inst, root):
            return False
    if "const" in schema and not (inst == schema["const"] and type(inst) is type(schema["const"])):
        return False
    if "enum" in schema and not any(inst == e and type(inst) is type(e) for e in schema["enum"]):
        return False
    t = schema.get("type")
    py = {"object": dict, "array": list, "string": str, "integer": int, "boolean": bool, "null": type(None)}
    if t is not None:
        if t == "integer" and (type(inst) is not int):
            return False
        if t != "integer" and not isinstance(inst, py[t]):
            return False
    if isinstance(inst, str):
        if "pattern" in schema and not re.search(schema["pattern"], inst):
            return False
        if len(inst) < schema.get("minLength", 0) or len(inst) > schema.get("maxLength", 10**9):
            return False
    if type(inst) is int:
        if inst < schema.get("minimum", -10**18) or inst > schema.get("maximum", 10**18):
            return False
    if isinstance(inst, list):
        if "items" in schema and not all(_schema_ok(schema["items"], x, root) for x in inst):
            return False
        if schema.get("uniqueItems") and len({json.dumps(x, sort_keys=True) for x in inst}) != len(inst):
            return False
    if isinstance(inst, dict):
        props = schema.get("properties", {})
        if any(r not in inst for r in schema.get("required", [])):
            return False
        for k, v in inst.items():
            if k in props:
                if not _schema_ok(props[k], v, root):
                    return False
            elif schema.get("additionalProperties") is False:
                return False
            elif isinstance(schema.get("additionalProperties"), dict) and not _schema_ok(schema["additionalProperties"], v, root):
                return False
        if "propertyNames" in schema and not all(_schema_ok(schema["propertyNames"], k, root) for k in inst):
            return False
        if len(inst) > schema.get("maxProperties", 10**9):
            return False
    return True


def _mutations(answer: dict[str, Any]) -> list[Any]:
    """The answer, and one-defect variants of it (extra / missing / retyped fields at every level)."""
    out: list[Any] = [answer]

    def walk(path: tuple[Any, ...], node: Any) -> None:
        if isinstance(node, dict):
            for k in list(node):
                for fn in ("drop", "retype", "null"):
                    m = copy.deepcopy(answer)
                    cur = m
                    for p in path:
                        cur = cur[p]
                    if fn == "drop":
                        del cur[k]
                    elif fn == "retype":
                        cur[k] = 7 if not isinstance(cur[k], int) or isinstance(cur[k], bool) else "x"
                    else:
                        cur[k] = None
                    out.append(m)
                walk(path + (k,), node[k])
            m = copy.deepcopy(answer)
            cur = m
            for p in path:
                cur = cur[p]
            cur["zz_extra"] = 1
            out.append(m)

    walk((), answer)
    return out


@pytest.mark.parametrize("vid,schema_file", [("capture_start", "capture_start"), ("capture_status", "capture_status"), ("capture_confirm", "capture_confirm"),
                                             ("capture_cancel", "capture_cancel")])
def test_the_hand_written_answer_checks_agree_with_the_contract_schemas(vid, schema_file):
    schema = json.loads((CONTRACT / f"{schema_file}.answer.schema.json").read_text(encoding="utf-8"))
    dto = _run(ACCEPT[vid])
    samples = [_ack(dto)]
    if vid == "capture_status":
        samples += [{**_ack(dto), "capture": {"state": s, "error": e, "card": c}} for s, e, c in (
            ("preparing", None, None), ("waiting", None, None), ("error", "capture_timeout", None), ("error", None, None), ("captured", None, None),
            ("captured", "capture_failed", _ack(dto)["capture"]["card"]), ("waiting", None, _ack(dto)["capture"]["card"]))]
    samples += [{"result": "refused", "request_id": dto.request_id, "code": c} for c in (*la.REFUSED_CODES[dto.action], "capture_station_busy", "x")]
    samples.append({"result": "sent_unknown", "request_id": dto.request_id})
    checked = agree_ack = 0
    for sample in samples:
        for variant in _mutations(sample):
            want = _schema_ok(schema, variant, schema)
            got = la.request_answer(dto, variant) is not None
            assert got == want, (vid, variant)
            checked += 1
            agree_ack += want
    assert checked > 40 and agree_ack >= 3


# ---------------------------------------------------------------- the service: relay, no consumer, logging

def _hass() -> Any:
    return types.SimpleNamespace(data={})


class Consumer:
    def __init__(self, answer: Any = "ack", exc: BaseException | None = None) -> None:
        self.seen: list[Any] = []
        self.answer, self.exc = answer, exc

    async def handle(self, dto: Any) -> Any:
        self.seen.append(dto)
        if self.exc:
            raise self.exc
        return _ack(dto) if self.answer == "ack" else self.answer


def _call(hass: Any, vid: str, ks: Any, now: Any = None) -> dict[str, Any]:
    v = ACCEPT[vid]
    return asyncio.run(ls.async_handle(hass, SERVICE_NAME[v["service"]], KIND[v["service"]], {"signed_message_json": v["signed_message_json"]}, ks, v["now"] if now is None else now))


def test_with_no_consumer_the_call_fails_and_spends_no_nonce():
    hass, ks = _hass(), _ks()
    for vid in ACCEPT:
        with pytest.raises(ls.LeaseUnavailable) as err:
            _call(hass, vid, ks)
        assert err.value.code == "lease_consumer_missing"
    consumer = Consumer()
    remove = ls.async_register_consumer(hass, consumer)
    for vid in ACCEPT:  # the very same bytes are accepted now: nothing was consumed while nobody could answer
        assert _call(hass, vid, ks)["result"] == "acknowledged"
    assert [d.action for d in consumer.seen] == [json.loads(ACCEPT[v]["signed_message_json"])["action"] for v in ACCEPT]
    remove()
    assert ls.async_get_capability(hass).registration is None


def test_the_consumer_is_registered_once_and_removed_by_its_own_handle_only():
    hass = _hass()
    a, b = Consumer(), Consumer()
    remove_a = ls.async_register_consumer(hass, a)
    with pytest.raises(RuntimeError):
        ls.async_register_consumer(hass, b)
    with pytest.raises(TypeError):
        ls.async_register_consumer(_hass(), object())
    remove_a()
    remove_b = ls.async_register_consumer(hass, b)
    remove_a()  # a stale remover does not drop the new consumer
    assert ls.async_get_capability(hass).registration is remove_b
    remove_b()
    assert ls.async_get_capability(hass).registration is None


def test_a_rejected_message_never_reaches_the_consumer_and_a_replay_is_answered_not_relayed():
    hass, ks = _hass(), _ks()
    consumer = Consumer()
    ls.async_register_consumer(hass, consumer)
    for vid, v in REJECT.items():
        out = asyncio.run(ls.async_handle(hass, "x", KIND[v["service"]], {"signed_message_json": v["signed_message_json"]}, ks, v["now"]))
        assert out["result"] == "rejected" and (out["stage"], out["code"]) == (v["expect"]["stage"], v["expect"]["code"])
    assert consumer.seen == []
    assert _call(hass, "capture_cancel", ks)["result"] == "acknowledged"
    again = _call(hass, "capture_cancel", ks)
    assert (again["result"], again["stage"], again["code"]) == ("rejected", "state", "replay") and again["request_id"]
    assert len(consumer.seen) == 1


def test_a_failing_slow_or_non_closed_consumer_is_a_service_error_never_an_acknowledgement(caplog):
    caplog.set_level(logging.DEBUG)
    for consumer, code in ((Consumer(exc=RuntimeError("boom with a secret label 4242")), "lease_consumer_failed"), (Consumer(exc=asyncio.TimeoutError()), "lease_consumer_failed"),
                           (Consumer(answer={"result": "acknowledged"}), "lease_answer_invalid"), (Consumer(answer=None), "lease_answer_invalid"),
                           (Consumer(answer={"ok": True}), "lease_answer_invalid"), (Consumer(answer="free text"), "lease_answer_invalid")):
        hass = _hass()
        ls.async_register_consumer(hass, consumer)
        with pytest.raises(ls.LeaseUnavailable) as err:
            _call(hass, "capture_confirm", _ks())
        assert err.value.code == code
        assert len(consumer.seen) == 1
    assert "4242" not in caplog.text and "secret label" not in caplog.text


def test_a_hanging_consumer_is_cut_off(monkeypatch):
    class Hang:
        async def handle(self, dto: Any) -> Any:
            await asyncio.sleep(30)

    hass = _hass()
    ls.async_register_consumer(hass, Hang())
    monkeypatch.setattr(ls, "HOST_TIMEOUT_S", 0.05)
    with pytest.raises(ls.LeaseUnavailable) as err:
        _call(hass, "capture_status", _ks())
    assert err.value.code == "lease_consumer_failed"


def test_a_synchronous_consumer_works_and_the_consumer_gets_the_immutable_dto():
    class Sync:
        def __init__(self) -> None:
            self.dto: Any = None

        def handle(self, dto: Any) -> Any:
            self.dto = dto
            return _ack(dto)

    hass, consumer = _hass(), Sync()
    ls.async_register_consumer(hass, consumer)
    assert _call(hass, "capture_start", _ks())["session"]["state"] == "waiting"
    assert isinstance(consumer.dto, lc.LeaseDTO) and consumer.dto.action == "capture_start"


def test_logs_carry_stage_and_code_only_never_a_label_a_reference_a_station_or_a_key(caplog):
    caplog.set_level(logging.DEBUG)
    hass = _hass()
    ls.async_register_consumer(hass, Consumer(exc=ValueError("x")))
    sensitive = [json.loads(ACCEPT["capture_confirm"]["signed_message_json"])["params"]["label"], "0123456789abcdef", "7c9e6679-7425-40de-944b-e07fc1f90ae7", "entry-a",
                 TEST_SECRET, "dev-sam", "arx-installation-1"]
    with pytest.raises(ls.LeaseUnavailable):
        _call(hass, "capture_confirm", _ks())
    for v in list(REJECT.values())[:6]:
        asyncio.run(ls.async_handle(hass, "svc", KIND[v["service"]], {"signed_message_json": v["signed_message_json"]}, _ks(), v["now"]))
    bad = _msg("capture_status")
    bad["sig"] = "f" * 64
    asyncio.run(ls.async_handle(hass, "svc", "request", {"signed_message_json": _text(bad)}, _ks(), ACCEPT["capture_status"]["now"]))
    for s in sensitive:
        assert s not in caplog.text, s
    assert "signature/bad_signature" in caplog.text


# ---------------------------------------------------------------- the Home Assistant wiring (source text; Home Assistant is not installed here)

SRC = bridge_loader.SRC
INIT = (SRC / "__init__.py").read_text(encoding="utf-8")


def test_the_two_services_are_registered_with_a_response_only_removed_on_unload_and_take_exactly_the_one_field():
    for name in ("SERVICE_LEASE_EVENT, lease_event", "SERVICE_LEASE_REQUEST, lease_request"):
        assert f"hass.services.async_register(DOMAIN, {name}, schema=LEASE_SCHEMA, supports_response=SupportsResponse.ONLY)" in INIT, name
    for name in ("SERVICE_LEASE_EVENT", "SERVICE_LEASE_REQUEST"):
        assert f"hass.services.async_remove(DOMAIN, {name})" in INIT
    assert "LEASE_SCHEMA = vol.Schema(dict)" in INIT  # no coercion, no defaults: stage 1 of the contract judges the shape
    assert "keyset" in INIT.split("async def lease(")[1].split("async def lease_event")[0]  # the verifier handed on is the key set
    assert "lease_service.async_handle(hass, service_name, kind, dict(call.data), keyset)" in INIT
    for cls in ("HomeAssistantError",):
        assert cls in INIT
    # the signature is never judged by anything but the key set in the lease modules (no hmac / hashlib.compare / signing import)
    for mod in ("lease_contract", "lease_answers", "lease_service"):
        tree = ast.parse((SRC / f"{mod}.py").read_text(encoding="utf-8"))
        imported = {n.names[0].name.split(".")[0] for n in tree.body if isinstance(n, ast.Import)} | {n.module.split(".")[0] for n in tree.body if isinstance(n, ast.ImportFrom) and n.module}
        assert not imported & {"homeassistant", "voluptuous", "hmac", "signing", "keyset"}, mod
    # the data keys of the service are exactly signed_message_json in services.yaml, and the three strings files name both services
    services = yaml.safe_load((SRC / "services.yaml").read_text(encoding="utf-8"))
    for name in (const.SERVICE_LEASE_EVENT, const.SERVICE_LEASE_REQUEST):
        assert set(services[name]["fields"]) == {"signed_message_json"} and services[name]["name"] and services[name]["description"]
        for f in ("strings.json", "translations/en.json", "translations/he.json"):
            data = json.loads((SRC / f).read_text(encoding="utf-8"))["services"][name]
            assert data["name"] and data["description"], (f, name)


def test_the_provisional_names_live_in_one_constant_each_and_nothing_else_spells_them():
    assert (const.SERVICE_LEASE_EVENT, const.SERVICE_LEASE_REQUEST) == ("lease_event", "lease_request")
    for path in sorted(SRC.glob("*.py")):
        if path.name == "const.py":
            continue
        for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
            if isinstance(node, ast.Constant) and node.value in ("lease_event", "lease_request"):
                pytest.fail(f"{path.name} spells a provisional service name as a literal")
    # ... and Arx's side still calls the very same names (a rename must change both, and this fails until it does).
    # Release 2.12.0: LEASEARX-295 moved Arx's names into one constant each (BRIDGE_DOMAIN / SERVICE_EVENT / SERVICE_REQUEST in lease_events.py).
    arx = (REPO / "smplwise_vms" / "backend" / "smplwise" / "services" / "lease_events.py").read_text(encoding="utf-8")
    assert 'BRIDGE_DOMAIN = "smplwise_bridge"' in arx
    assert f'SERVICE_EVENT = "{const.SERVICE_LEASE_EVENT}"' in arx and f'SERVICE_REQUEST = "{const.SERVICE_LEASE_REQUEST}"' in arx
    # the action-to-service grouping does not depend on the names: it is the contract's, by kind
    assert set(lc.KIND_OF) == set(lc.EVENT_ACTIONS) | set(lc.REQUEST_ACTIONS)


def test_version_0_9_6_everywhere_and_both_copies_are_byte_identical():
    mirror = REPO / "smplwise_vms" / "integration" / "smplwise_bridge"
    manifest = json.loads((SRC / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["version"] == const.VERSION == "0.10.1"
    assert "const VERSION = '0.10.1'" in (SRC / "www" / "smplwise-card.js").read_text(encoding="utf-8")
    names = sorted(p.relative_to(SRC).as_posix() for p in SRC.rglob("*") if p.is_file() and "__pycache__" not in p.parts)
    assert {"lease_contract.py", "lease_answers.py", "lease_service.py"} <= set(names)
    for name in names:
        assert (mirror / name).read_bytes() == (SRC / name).read_bytes(), name
    assert sorted(p.relative_to(mirror).as_posix() for p in mirror.rglob("*") if p.is_file() and "__pycache__" not in p.parts) == names


def test_nothing_that_switches_the_capture_lease_on_was_touched():
    text = (REPO / "smplwise_vms" / "backend" / "smplwise" / "services" / "capture_lease.py").read_text(encoding="utf-8")
    assert re.search(r"^MIN_BRIDGE_FOR_CAPTURE_LEASE: str \| None = None$", text, re.M)
    assert re.search(r"^GO_LIVE_PERMITTED = False\b", text, re.M)


def test_the_closed_tables_equal_the_contract_file():
    codes = json.loads((CONTRACT / "CAPTURE_ANSWER_CODES.json").read_text(encoding="utf-8"))
    assert {k: tuple(v) for k, v in codes["refused"].items()} == la.REFUSED_CODES
    pre = codes["rejected"]["pre_schema"]
    for stage in ("transport", "encoding", "parse", "schema"):
        assert tuple(pre[stage]) == lc.CODES[stage], stage
    for action, table in codes["rejected"]["post_schema"].items():
        for stage in lc.POST_SCHEMA_STAGES:
            want = set(table[stage])
            got = {c for c in lc.CODES[stage] if c != "lease_window" or action == "capture_start"}
            assert want == got, (action, stage)
    for action in ("capture_start", "capture_status", "capture_confirm", "capture_cancel"):
        dto = _run(ACCEPT[action])
        for stage, names in codes["rejected"]["post_schema"][action].items():
            for code in names:
                a = {"result": "rejected", "stage": stage, "code": code, "request_id": dto.request_id}
                assert la.request_answer(dto, a) == a, (action, stage, code)
