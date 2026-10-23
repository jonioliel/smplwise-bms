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
        after = _open(world, SIDE)
        assert not (after.status_code == 503 and after.json().get("code") == br.PAUSE_CODE), after.text
        assert len(signed.opens()) == opens_before + 1, "the door command leaves Arx again"
        # FINDING K-07 (pinned): after the first rotation the door message carries `kid` on the wire (trusted_door.sign_message ->
        # trusted_caller.sign with a BridgeKey; the lease wire drops it with kid_on_wire=False, the door wire does not). The DTO v3
        # reference that every golden vector agrees with refuses it at the schema stage, so a v3 receiver refuses EVERY door open
        # after the first rotation (plan open question 7; CR section 15 "remain valid for g0-legacy")
        last = signed.opens()[-1]
        assert "kid" in last["message"] and last["message"]["kid"] == v["last"]["kid_to"]
        assert last["response"]["result"] == "rejected" and last["response"]["code"] == "unknown_field", last["response"]
        assert after.status_code == 409 and after.json()["code"] == "door_refused"
    finally:
        side.stop()
        peers.set_peer_for_tests(None)
        bk.reset_for_tests()
    assert attempts == []
