"""SMALLFIXA-295 / Fable review 3 K-02 (after HMACACT2-295): a capture-lease event held by the bridge-key rotation pause has an age bound.

While a rotation pauses the trusted-door path, the lease event worker holds its queue (NotSendable `bridge_key_rotating`). No heartbeat
and no revoke reach the host meanwhile, so after SILENCE_S the host's own silence rule has destroyed every live lease. A held message is
therefore dropped after HELD_MAX_S (= SILENCE_S) - audited `held_expired`, never silently - and the hold itself is audited once, not on
every 2 s retry. A pause that lifts in time sends the message as before. FAKES ONLY: a recording transport, synthetic rotation rows, a
fake monotonic clock; nothing contacts Home Assistant, the bridge or WisKey."""
from __future__ import annotations

import json

import pytest

from smplwise.db import Database, now_iso, set_setting
from smplwise.services import bridge_rotation as br
from smplwise.services import capture_lease as cl
from smplwise.services import lease_events as le


class RecordingTransport:
    def __init__(self) -> None:
        self.events: list[str] = []

    def event(self, settings, text):
        self.events.append(text)
        return {"response": {"ok": False}}  # not a closed answer: the message stays pending (classified `invalid`)

    def request(self, settings, action, text):
        raise AssertionError("no lease request is expected here")


@pytest.fixture()
def rig(client, settings, monkeypatch):
    db = Database(settings.db_path)
    with db.connection() as conn:
        set_setting(conn, "bridge.paired_at", now_iso())
        set_setting(conn, "bridge.secret", "synthetic-test-secret-0001")
    clock = [1000.0]
    monkeypatch.setattr(cl, "mono", lambda: clock[0])
    monkeypatch.setattr(le, "AUTO_THREAD", False)
    transport = RecordingTransport()
    le.set_transport(transport)
    worker = le.LeaseWorker()
    worker.attach(db, settings)
    yield db, clock, transport, worker
    le.set_transport(None)
    cl.REG.wake = le.WORKER.wake  # a LeaseWorker registers itself as the registry's waker: give it back to the module's worker


def _rotation(db, state: str) -> None:
    with db.connection() as conn:
        conn.execute("DELETE FROM bridge_rotations")
        conn.execute("INSERT INTO bridge_rotations(id, mode, state, kid_from, kid_to, gen_from, gen_to, overlap_s, started_at) VALUES (?,?,?,?,?,?,?,?,?)",
                     ("rot-k02-test", "routine", state, "g0-legacy", "g1-aaaaaaaa", 0, 1, 90, now_iso()))


def _pending(clock, action: str = "lease_revoke") -> le.Pending:
    params = {"stream_id": "a" * 32, "sequence": 3, "scope": "all", "lease_ref": "*", "permission_revision": 1, "reason": "key_rotation",
              "revoked_at": now_iso()}
    return le.Pending(action, "a" * 32, 3, "smplwise-arx", "*", params, deadline=clock[0] + 300.0, created=clock[0])


def _failed(db) -> list[dict]:
    with db.connection(mode="read") as conn:
        rows = conn.execute("SELECT details_json FROM audit_log WHERE action = 'intercom.capture_lease.event_failed' ORDER BY id").fetchall()
    return [json.loads(r[0]) for r in rows]


def test_the_age_bound_is_the_hosts_silence_rule():
    assert le.HELD_MAX_S == le.SILENCE_S == 15.0
    assert le.HELD_MAX_S < le.DEADLINE_GRACE_S + cl.LEASE_MAX_S, "the hold ends long before the ordinary retry deadline"


@pytest.mark.parametrize("state", list(br.ACTIVE) + ["needs_repair"])
def test_a_held_message_is_audited_once_then_dropped_after_the_bound(rig, state):
    db, clock, transport, worker = rig
    _rotation(db, state)
    p = _pending(clock)
    worker._service(p)
    assert p.held_since == clock[0] and not p.done
    assert [r["code"] for r in _failed(db)] == [br.PAUSE_CODE], "the hold is audited when it starts"
    while clock[0] < 1000.0 + le.HELD_MAX_S - le.RETRY_S:  # every retry inside the bound: held, no new audit row
        clock[0] += le.RETRY_S
        worker._service(p)
        assert not p.done
    assert len(_failed(db)) == 1, "a retry under the pause adds no audit row (no flood every 2 s)"
    clock[0] = max(1000.0 + le.HELD_MAX_S, p.next_try)
    worker._service(p)
    assert p.done
    rows = _failed(db)
    assert [r["code"] for r in rows] == [br.PAUSE_CODE, "held_expired"]
    assert rows[-1]["action"] == "lease_revoke" and rows[-1]["sequence"] == 3 and rows[-1]["held_s"] >= le.HELD_MAX_S
    assert transport.events == [], "nothing left the add-on while paused"


def test_a_stream_reset_is_bounded_too_and_the_worker_forgets_it(rig):
    db, clock, transport, worker = rig
    _rotation(db, "switching")
    p = _pending(clock, "lease_stream_reset")
    worker.pending.append(p)
    worker._service(p)
    clock[0] += le.HELD_MAX_S
    worker.step()
    assert worker.pending == [] and transport.events == []
    assert [r["code"] for r in _failed(db)][-1] == "held_expired"


def test_a_pause_that_lifts_in_time_sends_the_message(rig):
    db, clock, transport, worker = rig
    _rotation(db, "published")
    p = _pending(clock)
    worker._service(p)
    assert p.held_since is not None and transport.events == []
    with db.connection() as conn:
        conn.execute("UPDATE bridge_rotations SET state = 'verified', ended_at = ?", (now_iso(),))
    clock[0] += le.RETRY_S
    worker._service(p)
    assert len(transport.events) == 1, "the held revoke goes out once the rotation is over"
    assert p.held_since is None and not p.done  # the fake's answer is not a closed one: it stays pending and retries as before


def test_a_new_pause_after_a_send_starts_a_new_hold(rig):
    db, clock, transport, worker = rig
    p = _pending(clock)
    worker._service(p)  # no rotation: sent
    assert len(transport.events) == 1 and p.held_since is None
    _rotation(db, "switched")
    clock[0] += le.RETRY_S
    worker._service(p)
    assert p.held_since == clock[0] and not p.done


def test_other_unsendable_reasons_are_unchanged(rig):
    """Only the rotation pause is bounded; `bridge_not_paired` keeps its per-attempt audit row and the ordinary deadline."""
    db, clock, transport, worker = rig
    with db.connection() as conn:
        conn.execute("DELETE FROM settings WHERE key = 'bridge.paired_at'")
    p = _pending(clock)
    for _ in range(3):
        worker._service(p)
        clock[0] += le.RETRY_S
    assert p.held_since is None and not p.done
    assert [r["code"] for r in _failed(db)] == ["bridge_not_paired"] * 3
