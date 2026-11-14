"""KEYROT-HARNESS-295, plan steps 1 / 3 / 6: the door pause observed through the REAL door route while a rotation runs against the REAL
bridge (tests/keyrot_harness.py). The door itself is the existing fake trusted bridge of the door tests (no door, no WisKey): it records
every door_open that leaves Arx, so "nothing was sent" is checked, not assumed."""
from __future__ import annotations

import time

import pytest
from conftest import as_user
from test_wiskey_door_path import API, ENTRY, SIDE, env, map_all, signed, world  # noqa: F401  (fixtures)

import keyrot_harness as kh
from fake_trusted_bridge import TEST_SECRET
from smplwise.services import bridge_keys as bk, bridge_rotation as br, bridge_rotation_peer as peers, ha_client, trusted_door

REAL_CALL_SERVICE = ha_client.call_service  # captured at import: the door fixture replaces ha_client.call_service with the fake door bridge


@pytest.fixture(autouse=True)
def _status_rate():
    trusted_door.reset_status_rate()
    yield
    trusted_door.reset_status_rate()


def _open(world, station=ENTRY):
    return world["c"].post(f"{API}/intercom/stations/{station}/release", json=env(confirmed=True), headers=as_user("dana"))


def test_door_route_is_paused_for_exactly_the_rotation_window(world, signed, monkeypatch):
    attempts = kh.install_no_network(monkeypatch)
    clock = kh.Clock()
    monkeypatch.setattr(time, "time", clock)
    monkeypatch.setattr(br, "Engine", kh.clocked_engine(br, clock))
    rest = kh.HaRest()
    kh.install_rest(monkeypatch, rest)
    bk.reset_for_tests()
    c, db, settings = world["c"], world["db"], world["settings"]
    side = kh.BridgeSide(lambda: c, TEST_SECRET, clock)
    rest.side = side
    try:
        peers.set_peer_for_tests(peers.HaServicePeer(db, kh.ha_settings(settings), call_service=REAL_CALL_SERVICE))
        side.sync()
        # step 1: the door opens before any rotation
        assert _open(world).status_code == 200
        opens_before = len(signed.opens())
        during: list[tuple[str, int, str | None]] = []

        def try_door(op, data):
            r = _open(world, SIDE)
            body = r.json()
            during.append((op, r.status_code, body.get("code"), (body.get("details") or {}).get("outcome")))

        rest.before.append(try_door)
        r = c.post(f"{API}/system/bridge-key/rotations", json={"mode": "routine", "confirm": True})
        assert r.status_code == 200 and r.json()["rotation"]["state"] == "switched", r.text
        rest.before.remove(try_door)
        # step 3: refused at every bridge call of the rotation, and in the overlap; nothing left Arx
        assert [d[0] for d in during] == ["begin", "probe", "probe", "commit", "probe"]
        assert all(d[1:] == (503, br.PAUSE_CODE, "not_sent") for d in during), during
        overlap = _open(world, SIDE)
        assert overlap.status_code == 503 and overlap.json()["code"] == br.PAUSE_CODE
        assert len(signed.opens()) == opens_before, "no door_open was signed or sent while paused"
        with db.connection(mode="read") as conn:
            denied = conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'intercom.release' AND decision = 'denied' AND reason = ?",
                                  (br.PAUSE_CODE,)).fetchone()[0]
        assert denied == len(during) + 1, "every refusal is audited"
        # step 5/6: retire + verify, then the pause is gone
        clock.advance(92)
        v = c.get(f"{API}/system/bridge-key").json()
        assert v["last"]["state"] == "verified", v["last"]
        # K-07 (owner decision 2026-10-24: keep the Arx wire as built and document it): after the first rotation the door message
        # carries `kid` and signature v2. A receiver that knows only the pairing secret (every receiver deployed today) REFUSES it - no
        # longer at the schema stage (the reference accepts the optional `kid` now) but at the signature stage: nothing is opened
        after = _open(world, SIDE)
        assert not (after.status_code == 503 and after.json().get("code") == br.PAUSE_CODE), after.text
        assert len(signed.opens()) == opens_before + 1, "the door command leaves Arx again"
        last = signed.opens()[-1]
        assert "kid" in last["message"] and last["message"]["kid"] == v["last"]["kid_to"]
        assert last["response"]["result"] == "rejected" and last["response"]["code"] == "bad_signature", last["response"]
        assert not last["effects"]["dispatched"], "a refused open is never dispatched"
        assert after.status_code == 409 and after.json()["code"] == "door_refused"
        # K-07 fixed in the contract: a receiver that verifies through the bridge's key set (the real KeySet here) accepts the kid and opens
        trusted_door.reset_status_rate()
        signed.clock.offset_s = -round(clock.offset)  # the door's clock follows the host clock (Arx signs issued_at from datetime.now)
        signed.keys =lambda kid: side.ks._material(kid) if kid in side.ks.verifiable() else None
        fixed = _open(world, SIDE)
        assert fixed.status_code == 200, fixed.text
        last = signed.opens()[-1]
        assert last["message"]["kid"] == v["last"]["kid_to"] and last["response"]["result"] == "acknowledged", last["response"]
        assert last["effects"]["dispatched"]
        # the downgrade guard holds on that receiver: a kid-less message under the retired pairing secret is refused
        rid = trusted_door.new_request_id()
        old = trusted_door.sign_message(TEST_SECRET, "door_open", "dev-sam", "sam", SIDE, {"relay": 1}, rid)
        resp = signed.call_service(None, "smplwise_bridge", "door_open", {"signed_message_json": old.text}, return_response=True)
        assert resp["result"] == "rejected" and resp["code"] == "bad_signature", resp
    finally:
        side.stop()
        peers.set_peer_for_tests(None)
        bk.reset_for_tests()
    assert attempts == []
