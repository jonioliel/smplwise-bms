"""LEASE-BUILD slice L3 (CR-WISKEY-LEASE-REVOCATION-EVENT sections 1.2, 1.3, 3): the signed revocation stream. Negative first:
replay / duplicate (N2), gap (N3), conflict (N4), event lost then reconnect (N5), heartbeat silence (N6), clock (N7), restart
(N11), unknown stream (F6), unknown lease on the host (F7), ledger failure (F3), golden vectors and the door refactor. Fakes only."""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

import pytest

import lease_contract as lc
from lease_fixtures import lease_world  # noqa: F401  (fixture)

from smplwise.services import capture_lease as cl
from smplwise.services import lease_events as le
from smplwise.services import trusted_caller, trusted_door


def _revokes(w):
    return [c for c in w.bridge.calls if "dto" in c and c["dto"].action == "lease_revoke"]


# ---------------------------------------------------------------- contract

def test_golden_vectors_file_is_current_and_every_vector_behaves():
    assert json.loads(lc.VECTORS_FILE.read_text(encoding="utf-8")) == lc.build_vectors(), "regenerate with tests/lease_contract.py --write"
    data = lc.build_vectors()
    for case in data["accept"]:
        lc.validate(case["service"], {"signed_message_json": case["signed_message_json"]}, case["now"])
    for case in data["reject"]:
        with pytest.raises(lc.Reject) as e:
            lc.validate(case["service"], {"signed_message_json": case["signed_message_json"]}, case["now"])
        assert (e.value.stage, e.value.code) == (case["expect"]["stage"], case["expect"]["code"]), case["id"]


def test_production_signer_produces_the_golden_bytes():
    """The add-on's signer (trusted_caller.sign via lease_events.sign's parameters) gives exactly the vector bytes."""
    for vid, env in lc.accept_envelopes():
        wire = json.loads(next(c for c in lc.build_vectors()["accept"] if c["id"] == vid)["signed_message_json"])
        signed = trusted_caller.sign(lc.TEST_SECRET, protocol=cl.PROTOCOL, actions=le.ALL_ACTIONS, action=env["action"], actor_id=env["actor"]["id"],
                                     display_name=env["actor"]["display_name"], station=env["station"], params=env["params"], request_id=env["request_id"],
                                     lifetime_s=15, max_lifetime_s=15, max_bytes=8192, now=datetime.fromtimestamp(lc.gv._epoch(env["issued_at"]), tz=timezone.utc),
                                     nonce=env["nonce"])
        assert json.loads(signed.text) == wire, vid


def test_signer_refuses_locally_what_the_bridge_would_refuse():
    base = dict(protocol=cl.PROTOCOL, actions=le.ALL_ACTIONS, action="lease_revoke", actor_id="a", display_name="a", station="*", params={},
                request_id="00000000-0000-4000-8000-000000000001", max_lifetime_s=15, max_bytes=8192)
    with pytest.raises(trusted_caller.MessageInvalid):
        trusted_caller.sign("k", lifetime_s=16, **base)
    with pytest.raises(trusted_caller.MessageInvalid):
        trusted_caller.sign("k", lifetime_s=0, **base)
    with pytest.raises(trusted_caller.MessageInvalid):
        trusted_caller.sign("k", lifetime_s=15, **{**base, "actor_id": "a‮b"})
    with pytest.raises(trusted_caller.MessageInvalid):
        trusted_caller.sign("k", lifetime_s=15, **{**base, "params": {"x": "y" * 9000}})
    with pytest.raises(ValueError):
        trusted_caller.sign("k", lifetime_s=15, **{**base, "action": "door_open"})


def test_door_signer_is_unchanged_by_the_refactor():
    """trusted_door.sign_message delegates to trusted_caller: same body, same lifetime (30 s), same refusal code."""
    at = datetime(2026, 10, 3, 12, tzinfo=timezone.utc)
    s = trusted_door.sign_message(lc.TEST_SECRET, "door_open", "dev-sam", "סם", "entry-a", {"relay": 1}, "00000000-0000-4000-8000-000000000009", now=at)
    wire = json.loads(s.text)
    assert list(wire)[:8] == ["protocol", "actor", "action", "station", "params", "request_id", "issued_at", "expires_at"]
    assert wire["protocol"] == "wiskey-trusted-door-v1" and wire["expires_at"] == "2026-10-03T12:00:30Z" and wire["ts"] == int(at.timestamp())
    from smplwise.errors import ApiError

    with pytest.raises(ApiError) as e:
        trusted_door.sign_message(lc.TEST_SECRET, "door_open", "dev-sam", "a‮b", "entry-a", {"relay": 1}, "00000000-0000-4000-8000-000000000009")
    assert e.value.code == "door_message_invalid"


# ---------------------------------------------------------------- the stream

def test_nothing_is_sent_while_no_lease_is_live(lease_world):
    w = lease_world
    calls = len(w.bridge.calls)
    w.bump()
    cl.on_authority_change("session_ended", user_ids=["dev-sam"])
    w.run(30)
    assert len(w.bridge.calls) == calls, "no idle traffic: no revoke for nothing, no heartbeat without a live lease"


def test_n1_permission_change_mid_lease_revokes_all_within_one_second(lease_world):
    w = lease_world
    a = w.issue(actor="dev-a", station="entry-a")
    b = w.issue(actor="dev-b", station="entry-b")
    assert cl.usable(a.lease_ref) and cl.usable(b.lease_ref)
    w.bump()
    assert not cl.usable(a.lease_ref) and not cl.usable(b.lease_ref), "unusable at once, before the worker ran"
    w.step(0.25)
    rv = _revokes(w)
    assert len(rv) == 1 and rv[0]["dto"].params["scope"] == "all" and rv[0]["dto"].params["reason"] == "permission_revision" and rv[0]["dto"].station == "*"
    assert rv[0]["answer"]["result"] == "acknowledged" and rv[0]["answer"]["destroyed"] == 2
    assert not w.host.leases
    rows = {r["id"]: r for r in w.rows()}
    assert rows[a.lease_ref]["state"] == rows[b.lease_ref]["state"] == "revoked"
    assert rows[a.lease_ref]["reason"] == "permission_revision" and rows[a.lease_ref]["acked_at"] and rows[a.lease_ref]["ack_result"] == "acknowledged"
    assert rows[a.lease_ref]["revoke_sequence"] == rows[b.lease_ref]["revoke_sequence"] == rv[0]["dto"].params["sequence"]


def test_n2_replay_of_the_same_bytes_is_refused_and_a_duplicate_envelope_is_idempotent(lease_world):
    w = lease_world
    a = w.issue()
    w.bump()
    w.step(0.25)
    first = _revokes(w)[-1]
    replay = w.bridge.replay(w.bridge.calls.index(first))
    assert replay == {"result": "rejected", "stage": "state", "code": "replay"}
    # the same sequence and params in a NEW envelope: duplicate, the host state unchanged
    with w.db.connection(mode="read") as conn:
        signed = le.sign(conn, "lease_revoke", first["dto"].actor_id, first["dto"].actor_id, "*", first["dto"].params)
    answer = w.bridge.event(w.settings, signed.text)["service_response"]
    assert answer["result"] == "duplicate" and w.host.last_sequence == first["dto"].params["sequence"]
    kind, _ = le.classify(answer, signed.request_id, first["dto"].params["sequence"])
    assert kind == "duplicate" and kind in le.ACK_RESULTS
    assert w.row(a.lease_ref)["state"] == "revoked"


def test_n3_gap_destroys_everything_on_the_host_and_arx_marks_every_live_row(lease_world):
    w = lease_world
    a = w.issue(actor="dev-a", station="entry-a")
    b = w.issue(actor="dev-b", station="entry-b")
    cl.TEST_SKIP_NEXT_SEQUENCE = True
    cl.on_authority_change("session_ended", user_ids=["dev-a"])  # scope actor, but the sequence skips one
    w.step(0.25)
    rv = _revokes(w)[-1]
    assert rv["answer"]["result"] == "gap" and rv["answer"]["destroyed"] == 2 and not w.host.leases
    rows = {r["id"]: r for r in w.rows()}
    assert rows[a.lease_ref]["state"] == "revoked" and rows[a.lease_ref]["reason"] == "session_ended"
    assert rows[b.lease_ref]["state"] == "revoked" and rows[b.lease_ref]["reason"] == "host_gap"
    acked = [r for r in w.audit("intercom.capture_lease.event_acked") if '"gap"' in (r["details_json"] or "")]
    assert acked, "the gap answer is audited"
    with w.db.connection(mode="read") as conn:
        assert cl.route_on(conn), "the route stays on after a gap"


def test_n4_conflict_same_sequence_different_body_destroys_everything(lease_world):
    w = lease_world
    a = w.issue(actor="dev-a", station="entry-a")
    b = w.issue(actor="dev-b", station="entry-b")
    cl.on_authority_change("session_ended", user_ids=["dev-a"])
    w.step(0.25)
    seq = _revokes(w)[-1]["dto"].params["sequence"]
    assert w.host.leases == {b.lease_ref: w.host.leases[b.lease_ref]}
    # a different body under the same sequence (test hook: Arx's counter went back)
    with w.db.write_aside() as conn:
        conn.execute("UPDATE capture_lease_stream SET next_sequence = ?", (seq,))
    cl.on_authority_change("session_ended", user_ids=["dev-b"])
    w.step(0.25)
    rv = _revokes(w)[-1]
    assert rv["dto"].params["sequence"] == seq and rv["answer"]["result"] == "conflict" and not w.host.leases
    assert w.row(b.lease_ref)["state"] == "revoked"
    assert [r for r in w.audit("intercom.capture_lease.event_acked") if '"conflict"' in (r["details_json"] or "")]
    assert w.row(a.lease_ref)["state"] == "revoked"


def test_n5_event_lost_then_reconnect_retries_with_new_envelopes_and_cancels_at_five_seconds(lease_world):
    w = lease_world
    a = w.issue()
    w.bridge.unreachable = True
    w.bump()
    w.run(7.0)
    attempts = [c for c in w.bridge.calls if c.get("answer") == "unreachable"]
    assert 3 <= len(attempts) <= 5, "retried every 2 s"
    assert w.row(a.lease_ref)["state"] == "revoked" and w.row(a.lease_ref)["acked_at"] is None, "revoked in the ledger the moment the trigger fired"
    texts = [c["text"] for c in attempts if c["text"].find('"lease_revoke"') >= 0]
    nonces = {json.loads(t)["nonce"] for t in texts}
    rids = {json.loads(t)["request_id"] for t in texts}
    seqs = {json.loads(t)["params"]["sequence"] for t in texts}
    assert len(nonces) == len(texts) and len(rids) == len(texts) and len(seqs) == 1, "new envelope, same sequence"
    assert [c for c in attempts if '"capture_cancel"' in c["text"]], "the lease's own capture_cancel at 5 s (F1)"
    w.bridge.unreachable = False
    w.run(2.5)
    row = w.row(a.lease_ref)
    assert row["acked_at"] and row["ack_result"] == "acknowledged"
    n = len(w.bridge.calls)
    w.run(6)
    assert not [c for c in w.bridge.calls[n:] if "dto" in c and c["dto"].action == "lease_revoke"], "the first answer stops the retries"
    failed = w.audit("intercom.capture_lease.event_failed")
    assert failed and all(set(json.loads(r["details_json"])) <= {"code", "sequence", "attempt", "action"} for r in failed), "code only"


def test_n5_variant_unreachable_past_expiry_plus_15_stops_and_stays_unacked(lease_world):
    w = lease_world
    a = w.issue()
    w.bridge.unreachable = True
    w.bump()
    w.run(140, tick=1.0)
    n = len(w.bridge.calls)
    w.run(10, tick=1.0)
    assert len(w.bridge.calls) == n, "retries stopped after lease_expires_at + 15 s"
    row = w.row(a.lease_ref)
    assert row["state"] == "revoked" and row["acked_at"] is None
    assert [r for r in w.audit("intercom.capture_lease.event_failed") if "deadline_passed" in (r["details_json"] or "")]


def test_n6_heartbeat_every_five_seconds_and_silence_destroys_on_the_host_then_arx_reconciles(lease_world):
    w = lease_world
    a = w.issue()
    w.run(11)
    beats = [c for c in w.bridge.calls if "dto" in c and c["dto"].action == "lease_heartbeat"]
    assert 2 <= len(beats) <= 3 and beats[-1]["dto"].params["live_leases"] == [a.lease_ref]
    assert beats[-1]["dto"].params["sequence"] == w.host.last_sequence, "a heartbeat repeats the last sequence"
    assert len(w.audit("intercom.capture_lease.heartbeat_start")) == 1, "heartbeats are not audited per message"
    le.TEST_SUPPRESS_HEARTBEAT = True
    w.run(16)
    w.host.check_silence()  # the host's own timer
    assert not w.host.leases and ("silence" in {why for _, why in w.host.destroyed})
    le.TEST_SUPPRESS_HEARTBEAT = False
    w.run(5.5)
    row = w.row(a.lease_ref)
    assert row["state"] == "destroyed" and row["reason"] == "host_silence"
    w.run(2)
    assert len(w.audit("intercom.capture_lease.heartbeat_stop")) == 1


def test_f7_heartbeat_listing_a_lease_arx_does_not_hold_revokes_all(lease_world):
    w = lease_world
    a = w.issue(actor="dev-a", station="entry-a")
    w.host.leases["11111111-2222-4333-8444-555555555555"] = {"session_id": "x", "actor": "dev-z", "station": "entry-z", "state": "waiting", "card": None,
                                                              "expires": w.clock.now() + 60}
    w.run(5.5)
    w.run(0.5)
    rv = _revokes(w)
    assert rv and rv[-1]["dto"].params["scope"] == "all" and rv[-1]["dto"].params["reason"] == "unknown_lease_on_host"
    assert w.row(a.lease_ref)["state"] == "revoked" and not w.host.leases


def test_n7_untrusted_clock_revokes_all_stops_issuing_and_an_admin_re_enable_lifts_it(lease_world):
    w = lease_world
    a = w.issue()
    w.bridge.clock_invalid = True
    w.run(5.5)  # the heartbeat is answered time/clock_invalid
    assert cl.GUARDS.clock_untrusted
    w.run(0.5)
    assert w.row(a.lease_ref)["state"] == "revoked" and w.row(a.lease_ref)["reason"] == "clock_invalid"
    from smplwise.errors import ApiError

    w.bridge.clock_invalid = False
    with pytest.raises(ApiError) as e:
        w.issue(actor="dev-b", station="entry-b")
    assert e.value.code == "capture_lease_clock_invalid"
    cl.clock_trusted_again("administrator")
    w.issue(actor="dev-b", station="entry-b")


def test_n7_bridge_time_stage_refuses_a_future_or_expired_message(lease_world):
    w = lease_world
    with w.db.connection(mode="read") as conn:
        future = le.sign(conn, "lease_heartbeat", "a", "a", "*", {"stream_id": w.host.stream_id, "sequence": 1, "live_leases": [], "permission_revision": 1},
                         at=cl.now() + timedelta(seconds=2))
        past = le.sign(conn, "lease_heartbeat", "a", "a", "*", {"stream_id": w.host.stream_id, "sequence": 1, "live_leases": [], "permission_revision": 1},
                       at=cl.now() - timedelta(seconds=30))
    assert w.bridge.event(w.settings, future.text) == {"result": "rejected", "stage": "time", "code": "not_yet_valid"}
    assert w.bridge.event(w.settings, past.text) == {"result": "rejected", "stage": "time", "code": "expired"}
    kind, data = le.classify({"result": "rejected", "stage": "time", "code": "not_yet_valid"}, "x")
    assert kind == "rejected" and data["code"] in le.CLOCK_CODES


def test_f6_unknown_stream_twice_resets_the_stream_and_revokes_all(lease_world):
    w = lease_world
    a = w.issue()
    w.host.stream_id = "f" * 32  # the host lost Arx's stream
    w.bump()
    w.step(0.25)
    w.run(2.5)
    resets = [c for c in w.bridge.calls if "dto" in c and c["dto"].action == "lease_stream_reset"]
    assert len(resets) == 2, "the fixture's announce + the reset after two unknown_stream answers"
    assert resets[-1]["answer"]["result"] == "acknowledged" and w.host.stream_id == resets[-1]["dto"].params["stream_id"]
    assert w.row(a.lease_ref)["state"] == "revoked"


def test_f6_an_answer_naming_another_request_is_not_an_acknowledgement(lease_world):
    w = lease_world
    a = w.issue()
    w.bridge.answer_override = lambda dto, answer: {**answer, "request_id": "00000000-0000-4000-8000-000000000000"} if dto.action == "lease_revoke" else answer
    w.bump()
    w.run(4.5)
    assert w.row(a.lease_ref)["acked_at"] is None and len(_revokes(w)) >= 2
    w.bridge.answer_override = None
    w.run(2.5)
    assert w.row(a.lease_ref)["acked_at"] is not None


def test_f3_ledger_failure_sends_revoke_all_and_degrades_the_route(lease_world, monkeypatch):
    w = lease_world
    a = w.issue()

    def broken(conn, trigger, send=True):
        raise __import__("sqlite3").OperationalError("disk I/O error")

    monkeypatch.setattr(cl, "revoke", broken)
    w.bump()
    w.step(0.25)
    assert cl.GUARDS.degraded
    rv = _revokes(w)[-1]
    assert rv["dto"].params["scope"] == "all" and rv["dto"].params["reason"] == "ledger_unavailable"
    assert rv["answer"]["result"] in ("duplicate", "conflict", "stale", "gap", "acknowledged") and not w.host.leases
    assert not cl.usable(a.lease_ref)
    assert [r for r in w.audit("intercom.capture_lease.event_failed") if "ledger_unavailable" in (r["details_json"] or "")]
    from smplwise.errors import ApiError

    with pytest.raises(ApiError) as e:
        w.issue(actor="dev-b", station="entry-b")
    assert e.value.code == "capture_lease_unavailable"


def test_n11_shutdown_revokes_all_within_two_seconds_and_startup_resets_the_stream(lease_world):
    w = lease_world
    a = w.issue(actor="dev-a", station="entry-a")
    b = w.issue(actor="dev-b", station="entry-b")
    le.WORKER.on_shutdown()
    rv = _revokes(w)[-1]
    assert rv["dto"].params["reason"] == "shutdown" and rv["dto"].params["scope"] == "all" and not w.host.leases
    # a restart with live rows (simulated: rows written live, the process memory gone)
    c = w.issue(actor="dev-c", station="entry-c")
    cl.REG.live.clear()
    old_stream = w.host.stream_id
    le.WORKER.reset()
    le.WORKER.on_startup(w.db, w.settings)
    assert w.row(c.lease_ref)["state"] == "revoked" and w.row(c.lease_ref)["reason"] == "startup"
    w.step(0.25)
    resets = [x for x in w.bridge.calls if "dto" in x and x["dto"].action == "lease_stream_reset"]
    assert resets[-1]["answer"]["result"] == "acknowledged" and w.host.stream_id != old_stream and not w.host.leases
    assert resets[-1]["dto"].params["previous_stream_id"] == old_stream and resets[-1]["dto"].params["reason"] == "startup"
    assert w.row(a.lease_ref)["state"] == "revoked" and w.row(b.lease_ref)["state"] == "revoked"


def test_n11_startup_with_nothing_live_and_the_route_off_sends_nothing(settings, monkeypatch):
    from smplwise.db import Database

    cl.reset_for_tests()
    le.reset_for_tests()
    monkeypatch.setattr(le, "AUTO_THREAD", False)
    sent = []

    class Spy:
        def event(self, s, text):
            sent.append(text)

        def request(self, s, a, text):
            sent.append(text)

    le.set_transport(Spy())
    db = Database(settings.db_path)
    db.migrate()
    le.WORKER.on_startup(db, settings)
    le.WORKER.step()
    assert sent == [] and not le.WORKER.pending
    with db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM capture_lease_stream").fetchone()[0] == 0
    le.reset_for_tests()
