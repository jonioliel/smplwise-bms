"""KEYROT-FIX-295 K-07: the DTO v3 reference (test_wiskey_golden_vectors) accepts the ONE optional wire field `kid` that every Arx message
carries after the first bridge-key rotation, verified with signature v2 under the receiver's key set. Kid-less messages (every golden
vector) are unchanged. Synthetic keys only."""
from __future__ import annotations

import json
from datetime import datetime, timezone

import pytest
import test_wiskey_golden_vectors as gv

from smplwise.services import bridge_keys as bk, ha_bridge, trusted_door

ISSUED = datetime(2026, 10, 24, 9, 0, 0, tzinfo=timezone.utc)
NOW = int(ISSUED.timestamp()) + 1
KID = "g1-0badc0de"
MATERIAL = "synthetic-k07-material-not-a-key-0001"
STATION = "station-k07"


def _msg(secret: str, rid: str | None = None) -> str:
    return trusted_door.sign_message(secret, "door_open", "dev-k07", "k07", STATION, {"relay": 1}, rid or trusted_door.new_request_id(), now=ISSUED).text


def _keys(kid: str) -> str | None:
    return {KID: MATERIAL}.get(kid)


def test_a_rotated_door_message_carries_kid_and_validates_under_the_key_set():
    text = _msg(ha_bridge.BridgeKey(MATERIAL, KID))
    assert json.loads(text)["kid"] == KID
    dto = gv.contract_validate_v3("door_open", {"signed_message_json": text}, NOW, keys=_keys)
    assert dto.action == "door_open" and dto.station == STATION


def test_before_the_fix_this_was_unknown_field_now_a_pairing_secret_receiver_refuses_at_the_signature_stage():
    text = _msg(ha_bridge.BridgeKey(MATERIAL, KID))
    with pytest.raises(gv.V3Reject) as e:
        gv.contract_validate_v3("door_open", {"signed_message_json": text}, NOW)
    assert (e.value.stage, e.value.code) == ("signature", "bad_signature")


@pytest.mark.parametrize("kid, code", [(7, "wrong_type"), ("g1-NOTHEX!", "bad_format"), ("legacy", "bad_format")])
def test_a_malformed_kid_is_refused_at_the_schema_stage(kid, code):
    wire = json.loads(_msg(ha_bridge.BridgeKey(MATERIAL, KID)))
    wire["kid"] = kid
    with pytest.raises(gv.V3Reject) as e:
        gv.contract_validate_v3("door_open", {"signed_message_json": json.dumps(wire)}, NOW, keys=_keys)
    assert (e.value.stage, e.value.code) == ("schema", code)


def test_unknown_kid_tampered_kid_and_retired_legacy_are_bad_signature():
    wire = json.loads(_msg(ha_bridge.BridgeKey(MATERIAL, KID)))
    for kid in ("g2-0badc0de", bk.LEGACY_KID):
        swapped = {**wire, "kid": kid}
        with pytest.raises(gv.V3Reject) as e:
            gv.contract_validate_v3("door_open", {"signed_message_json": json.dumps(swapped)}, NOW, keys=_keys)
        assert (e.value.stage, e.value.code) == ("signature", "bad_signature"), kid
    kidless = _msg(gv.TEST_SECRET)
    with pytest.raises(gv.V3Reject) as e:  # the receiver's set no longer holds g0-legacy: the downgrade guard
        gv.contract_validate_v3("door_open", {"signed_message_json": kidless}, NOW, keys=_keys)
    assert e.value.code == "bad_signature"


def test_kidless_messages_are_unchanged_without_and_with_a_key_set_holding_the_pairing_secret():
    kidless = _msg(gv.TEST_SECRET)
    assert "kid" not in json.loads(kidless)
    a = gv.contract_validate_v3("door_open", {"signed_message_json": kidless}, NOW)
    b = gv.contract_validate_v3("door_open", {"signed_message_json": kidless}, NOW, keys=lambda k: gv.TEST_SECRET if k == bk.LEGACY_KID else None)
    assert a == b
