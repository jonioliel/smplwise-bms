"""HMACACT2-295: door commands are paused while a bridge-key rotation is in progress (CR-034 A1) - a door command is never signed
while the key set may be half switched. Refused with a clear reason (503 `bridge_key_rotating`, `outcome: not_sent`) and audited; the
capture-lease event worker holds its queue (NotSendable, retried). Nothing is dropped silently. Fakes only: the fake trusted bridge
of the door tests, synthetic rotation rows. No flag is flipped by these tests beyond the per-test database."""
from __future__ import annotations

import pytest
from conftest import as_user
from test_wiskey_door_path import API, ENTRY, SIDE, env, map_all, signed, world  # noqa: F401  (fixtures)

from smplwise.db import now_iso, set_setting
from smplwise.services import bridge_rotation as br
from smplwise.services import lease_events, trusted_door


@pytest.fixture(autouse=True)
def _status_rate():
    trusted_door.reset_status_rate()
    yield
    trusted_door.reset_status_rate()


def _rotation(world, state: str) -> None:
    with world["db"].connection() as conn:
        conn.execute("DELETE FROM bridge_rotations")
        conn.execute("INSERT INTO bridge_rotations(id, mode, state, kid_from, kid_to, gen_from, gen_to, overlap_s, started_at) VALUES (?,?,?,?,?,?,?,?,?)",
                     ("rot-pause-test", "routine", state, "g0-legacy", "g1-aaaaaaaa", 0, 1, 90, now_iso()))


def _open(world, station=ENTRY):
    return world["c"].post(f"{API}/intercom/stations/{station}/release", json=env(confirmed=True), headers=as_user("dana"))


def test_pause_states_are_the_unfinished_rotation_states():
    assert set(br.PAUSE_STATES) == set(br.ACTIVE) | {"needs_repair"}
    assert not set(br.PAUSE_STATES) & set(br.TERMINAL)


@pytest.mark.parametrize("state", list(br.ACTIVE) + ["needs_repair"])
def test_every_unfinished_state_pauses_a_door_open_and_nothing_is_sent(world, signed, state):
    assert _open(world).status_code == 200  # control: no rotation, the open goes
    opens_before = len(signed.opens())
    from smplwise.routers import access_control

    access_control.RELAYS.clear()
    _rotation(world, state)
    r = _open(world, SIDE)
    assert r.status_code == 503, r.text
    body = r.json()
    assert body["code"] == br.PAUSE_CODE and body["details"]["outcome"] == "not_sent"
    assert len(signed.opens()) == opens_before, "no door_open left the add-on"
    with world["db"].connection(mode="read") as conn:
        denied = conn.execute("SELECT reason FROM audit_log WHERE action = 'intercom.release' AND decision = 'denied' AND reason = ?", (br.PAUSE_CODE,)).fetchall()
    assert len(denied) == 1, "the refusal is audited, not silent"


@pytest.mark.parametrize("state", ["verified", "verify_failed", "rolled_back", "retired"])
def test_a_finished_rotation_does_not_pause(world, signed, state):
    _rotation(world, state)
    assert _open(world).status_code == 200


def test_the_pause_lifts_when_the_rotation_finishes(world, signed):
    _rotation(world, "switched")
    assert _open(world).status_code == 503
    with world["db"].connection() as conn:
        conn.execute("UPDATE bridge_rotations SET state = 'verified', ended_at = ?", (now_iso(),))
    assert _open(world).status_code == 200


def test_switching_the_rotation_off_lifts_the_pause(world, signed):
    """An administrator who turned the rotation off is not locked out of the doors by a rotation nothing drives any more."""
    _rotation(world, "needs_repair")
    assert _open(world).status_code == 503
    with world["db"].connection() as conn:
        set_setting(conn, br.FLAG_KEY, "off")
        assert br.door_commands_paused(conn) is False
    assert _open(world).status_code == 200


def test_the_status_read_is_paused_too(world, signed):
    r = _open(world)
    assert r.status_code == 200
    rid = r.json()["door_request_id"]
    _rotation(world, "switching")
    st = world["c"].post(f"{API}/doors/requests/{rid}/status", headers=as_user("dana"))
    assert st.status_code == 503 and st.json()["code"] == br.PAUSE_CODE and st.json()["details"]["outcome"] == "not_sent"
    assert len(signed.statuses()) == 0


def test_capture_lease_messages_are_held_not_dropped(world):
    """The lease event worker treats NotSendable as `retry later`: a paused rotation raises it before anything is signed."""
    with world["db"].connection() as conn:
        set_setting(conn, "bridge.paired_at", now_iso())
        set_setting(conn, "bridge.secret", "synthetic-test-secret-0001")
        assert lease_events._secret(conn)  # control: no rotation, a secret
    _rotation(world, "published")
    with world["db"].connection(mode="read") as conn:
        with pytest.raises(lease_events.NotSendable) as exc:
            lease_events.sign(conn, "capture_start", "u", "n", "st", {})
    assert exc.value.code == br.PAUSE_CODE
