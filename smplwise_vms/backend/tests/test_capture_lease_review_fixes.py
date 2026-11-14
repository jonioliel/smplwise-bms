"""LEASE-FIX: the fixes for the Fable review of pilot/LEASE-BUILD (private/planning/RELEASE_264_REVIEW_LEASE_BUILD.md), negative and
race tests first. Fakes only - no reader, door, card, bridge, WisKey or live system. Every race is made deterministic: the
competing change is injected at the exact point of the window (a dependency override, a monkeypatched step), never by timing."""
from __future__ import annotations

import sqlite3
from datetime import timedelta
from typing import Any

import pytest
from fastapi import Request
from fastapi.testclient import TestClient

from conftest import as_user
from lease_fixtures import lease_world, principal  # noqa: F401  (fixture)
from test_intercom_capture_lease import lease_of, route, start  # noqa: F401  (fixture)

from smplwise.errors import ApiError
from smplwise.main import create_app
from smplwise.routers import access_control as ac
from smplwise.services import capture_lease as cl
from smplwise.services import capture_lease_route
from smplwise.services import lease_events as le


def _calls(w, action: str) -> list[dict[str, Any]]:
    return [c for c in w.bridge.calls if "dto" in c and c["dto"].action == action]


def _live_rows(w) -> list[dict[str, Any]]:
    return [r for r in w.rows() if r["state"] in cl.LIVE]


def _issue(w, actor: str = "dev-a", station: str = "entry-a", person: str = "u1", src: str = "ingress") -> cl.Lease:
    snap = cl.REG.snapshot(actor, station, person)
    with w.db.connection(label="test.issue") as conn:
        return cl.issue(conn, principal=principal(actor, src), station_id=station, reader_id=0, person_id=person, person_revision=4, binding_revision=None,
                        decision_revision=cl.permission_revision(conn), start_request_id="r-x", snap=snap)


# ---------------------------------------------------------------- H1: the decision, the revision and the epochs in one gate

def _window(w, action) -> None:
    """Run `action` between the permission gate (read connection) and the write connection: during the body upload, which the
    caller controls (the review's window)."""

    async def raw_with_change(request: Request) -> bytes:
        body = await request.body()
        action()
        return body

    w.client.app.dependency_overrides[ac._raw_body] = raw_with_change


def test_h1_a_permission_change_during_the_body_upload_refuses_the_lease(route):
    w = route
    _window(w, w.bump)  # e.g. another administrator revoked the operator's binding: revision R -> R+1, nothing of theirs live yet
    sent = len(w.bridge.calls)
    r = start(w)
    assert r.status_code == 409 and r.json()["code"] == "capture_lease_stale", r.text
    assert not [c for c in w.bridge.calls[sent:] if "dto" in c and c["dto"].action == "capture_start"], "nothing signed, nothing sent"
    assert not _live_rows(w) and not cl.live_refs()
    w.client.app.dependency_overrides.clear()
    r = start(w)  # the next start decides afresh and is issued
    assert r.status_code == 200, r.text


def test_h1_an_epoch_move_during_the_body_upload_refuses_the_lease(route):
    w = route
    _window(w, lambda: cl.on_authority_change("second_factor_changed", user_ids=["dev-joni"]))  # nothing live: no trigger is queued
    r = start(w)
    assert r.status_code == 409 and r.json()["code"] == "capture_lease_stale", r.text
    assert not _live_rows(w)


def test_h1_the_decision_is_taken_again_on_the_write_connection(route):
    """A permission removed in the window WITHOUT a revision bump (a write that forgot it) is still refused: the decision is
    re-taken on the write connection, inside the transaction that would insert the ledger row."""
    w = route

    def deactivate() -> None:
        with w.db.connection(label="test.deactivate") as conn:
            conn.execute("UPDATE users SET active = 0 WHERE id = 'dev-joni'")

    _window(w, deactivate)
    sent = len(w.bridge.calls)
    r = start(w)
    assert r.status_code in (403, 401), r.text
    assert not [c for c in w.bridge.calls[sent:] if "dto" in c and c["dto"].action == "capture_start"]
    assert not _live_rows(w)


def test_h1_issue_without_a_gate_mark_is_refused(route, monkeypatch):
    w = route
    monkeypatch.setattr(cl, "gate_mark", lambda conn: None)
    r = start(w)
    assert r.status_code == 409 and r.json()["code"] == "capture_lease_stale", r.text


# ---------------------------------------------------------------- M1: check and live-cache insert under one lock

def test_m1_a_trigger_between_the_check_and_the_insert_refuses_and_leaves_nothing(lease_world, monkeypatch):
    w = lease_world
    real = cl.ensure_stream

    def stream_then_trigger(conn):
        found = real(conn)
        cl.on_authority_change("session_ended", user_ids=["dev-a"])  # nothing live yet: no Trigger is queued for this lease
        return found

    monkeypatch.setattr(cl, "ensure_stream", stream_then_trigger)
    with pytest.raises(ApiError) as e:
        _issue(w)
    assert e.value.code == "capture_lease_stale"
    assert not w.rows(), "the row (and its audit) were undone with the savepoint"
    assert not cl.live_refs()
    assert not w.audit("intercom.capture_lease.issue")
    monkeypatch.setattr(cl, "ensure_stream", real)
    assert _issue(w).lease_ref in cl.live_refs()


def test_m1_a_trigger_right_after_the_issue_finds_the_lease_live_and_revokes_it(lease_world):
    w = lease_world
    lease = _issue(w)
    assert cl.on_authority_change("session_ended", user_ids=["dev-a"]) == 1
    w.step(0.25)
    assert w.row(lease.lease_ref)["state"] == "revoked" and _calls(w, "lease_revoke")


# ---------------------------------------------------------------- M2: an ordinary confirm/cancel race never revokes everything

def test_m2_a_lease_ended_while_a_heartbeat_was_in_flight_is_not_unknown(lease_world):
    w = lease_world
    a = w.issue(actor="dev-a", station="entry-a")
    b = w.issue(actor="dev-b", station="entry-b", person="u2")

    def end_a_in_flight(dto, answer):
        if dto.action == "lease_heartbeat" and a.lease_ref in (answer.get("live_leases") or []):
            cl.finish(w.db, a.lease_ref, "destroyed", "confirmed")  # a request thread confirmed lease a meanwhile
        return answer

    w.bridge.answer_override = end_a_in_flight
    w.run(5.5)
    w.bridge.answer_override = None
    w.run(0.5)
    assert not [c for c in _calls(w, "lease_revoke") if c["dto"].params["reason"] == "unknown_lease_on_host"]
    assert w.row(b.lease_ref)["state"] == "active", "the other operator's capture is untouched"
    assert w.row(a.lease_ref)["reason"] == "confirmed"


def test_m2_a_lease_arx_never_issued_still_revokes_all(lease_world):
    w = lease_world
    a = w.issue()
    w.host.leases["11111111-2222-4333-8444-555555555555"] = {"session_id": "x", "actor": "dev-z", "station": "entry-z", "state": "waiting", "card": None,
                                                              "expires": w.clock.now() + 60}
    w.run(6)
    rv = _calls(w, "lease_revoke")
    assert rv and rv[-1]["dto"].params["reason"] == "unknown_lease_on_host" and w.row(a.lease_ref)["state"] == "revoked"


def test_m2_the_recently_ended_set_is_bounded():
    cl.reset_for_tests()
    with cl.REG.lock:
        for i in range(cl.RECENTLY_ENDED_MAX + 50):
            cl.REG.note_ended(f"ref-{i}")
    assert len(cl.REG.ended) <= cl.RECENTLY_ENDED_MAX
    cl.reset_for_tests()


# ---------------------------------------------------------------- M4: the owner's go-live permit is enforced in code

def test_m4_go_live_permit_is_off_in_the_build_and_blocks_on_whatever_bridge_is_known(lease_world, monkeypatch):
    w = lease_world
    import importlib

    import smplwise.services.capture_lease as fresh

    src = importlib.util.find_spec(fresh.__name__).origin
    assert "\nGO_LIVE_PERMITTED = False" in open(src, encoding="utf-8").read(), "Fable review 2: the capture lease stays locked"
    monkeypatch.setattr(cl, "GO_LIVE_PERMITTED", False)  # the production value; the bridge IS available in this world
    with w.db.connection(mode="read") as conn:
        assert cl.bridge_available(conn) and cl.mode(conn) == "on"
        assert not cl.route_on(conn), "on + a bridge is still off without the go-live permit"
    with pytest.raises(ApiError) as e:
        w.issue(activate=False)
    assert e.value.code == "capture_lease_unavailable"
    c = TestClient(create_app(w.settings))
    c.get("/api/v1/me", headers=as_user("joni"))
    assert c.put("/api/v1/access/capture-lease/settings", json={"capture_lease": "off"}, headers=as_user("joni")).status_code == 200
    r = c.put("/api/v1/access/capture-lease/settings", json={"capture_lease": "on"}, headers=as_user("joni"))
    assert r.status_code == 409 and r.json()["code"] == "capture_lease_not_permitted", r.text
    view = c.get("/api/v1/access/capture-lease/settings", headers=as_user("joni")).json()
    assert view["capture_lease"] == "off" and view["capture_lease_go_live_permitted"] is False and view["capture_lease_available"] is True
    with w.db.connection(mode="read") as conn:
        row = conn.execute("SELECT decision, reason FROM audit_log WHERE action = 'settings.changed' ORDER BY rowid DESC LIMIT 1").fetchone()
    assert tuple(row) == ("denied", "capture_lease_not_permitted")


# ---------------------------------------------------------------- M3: "database is locked" is retried; an administrator re-enables

def _locked(times: list[int], real):
    def revoke(conn, trigger, send=True):
        if times[0] > 0:
            times[0] -= 1
            raise sqlite3.OperationalError("database is locked")
        return real(conn, trigger, send=send)

    return revoke


def test_m3_a_transient_lock_is_retried_and_stays_closed_meanwhile(lease_world, monkeypatch):
    w = lease_world
    a = w.issue()
    monkeypatch.setattr(cl, "revoke", _locked([2], cl.revoke))
    w.bump()
    w.step(0.25)
    assert cl.GUARDS.ledger_busy and not cl.GUARDS.degraded
    assert not cl.usable(a.lease_ref), "fail closed at once: the epochs moved"
    with pytest.raises(ApiError) as e:
        w.issue(actor="dev-b", station="entry-b", activate=False)
    assert e.value.code == "capture_lease_unavailable"
    beats = len(_calls(w, "lease_heartbeat"))
    w.run(6)  # the retries (0.5 s, then 1 s) - and no heartbeat may tell the host the lease is fine meanwhile
    assert len(_calls(w, "lease_heartbeat")) == beats
    assert not cl.GUARDS.ledger_busy and not cl.GUARDS.degraded
    assert w.row(a.lease_ref)["state"] == "revoked" and w.row(a.lease_ref)["reason"] == "permission_revision"
    assert [c for c in _calls(w, "lease_revoke") if c["dto"].params["reason"] == "permission_revision"]


def test_m3_a_persistent_lock_degrades_and_an_administrator_re_enables(lease_world, monkeypatch):
    w = lease_world
    a = w.issue()
    real = cl.revoke
    monkeypatch.setattr(cl, "revoke", _locked([99], real))
    w.bump()
    w.run(4)
    assert cl.GUARDS.degraded and not cl.GUARDS.ledger_busy
    assert [c for c in _calls(w, "lease_revoke") if c["dto"].params["reason"] == "ledger_unavailable"]
    assert w.row(a.lease_ref)["state"] == "active", "the ledger could not follow (the host was told to destroy everything)"
    monkeypatch.setattr(cl, "revoke", real)
    c = TestClient(create_app(w.settings))
    for u in ("joni", "sam"):
        c.get("/api/v1/me", headers=as_user(u))
    r = c.put("/api/v1/access/capture-lease/settings", json={"degraded_reenable": True}, headers=as_user("sam"))
    assert r.status_code == 403 and cl.GUARDS.degraded
    r = c.put("/api/v1/access/capture-lease/settings", json={"degraded_reenable": True}, headers=as_user("joni"))
    assert r.status_code == 200 and r.json()["degraded"] is False, r.text
    assert w.row(a.lease_ref)["state"] == "revoked" and w.row(a.lease_ref)["reason"] == "ledger_unavailable"
    assert len(w.audit("intercom.capture_lease.degraded_reenable")) == 1
    w.step(0.25)  # the requested new stream is announced before the next lease
    assert w.issue(actor="dev-b", station="entry-b").lease_ref


def test_m3_a_locked_ack_record_is_retried_before_degrading(lease_world, monkeypatch):
    w = lease_world
    a = w.issue()
    real = cl.mark_acked
    left = [1]

    def mark(conn, stream_id, sequence, result):
        if left[0]:
            left[0] -= 1
            raise sqlite3.OperationalError("database is locked")
        return real(conn, stream_id, sequence, result)

    monkeypatch.setattr(cl, "mark_acked", mark)
    w.bump()
    w.step(0.25)
    assert not cl.GUARDS.degraded and w.row(a.lease_ref)["acked_at"] is not None


# ---------------------------------------------------------------- lows

def test_l1_bridge_stage_and_code_are_bounded_before_audit_and_replies():
    long = "a" * 65
    for bad in ({"stage": long, "code": "x"}, {"stage": "time", "code": long}, {"stage": "time", "code": "Bad-Code"}, {"stage": "time", "code": "x\n<y>"}):
        assert le.classify({"result": "rejected", "request_id": "rid", **bad}, "rid") == ("invalid", {"code": "invalid_response"})
        assert capture_lease_route.classify_request({"result": "rejected", "request_id": "rid", **bad}, "rid", "capture_status") == ("unknown", {"code": "invalid_response"})
    assert le.classify({"result": "rejected", "stage": "time", "code": "clock_invalid", "request_id": "rid"}, "rid") == ("rejected", {"code": "time/clock_invalid"})


def test_l2_the_heartbeat_lists_issued_leases_too(lease_world):
    w = lease_world
    a = w.issue(activate=False)
    w.run(5.5)
    beats = _calls(w, "lease_heartbeat")
    assert beats and beats[-1]["dto"].params["live_leases"] == [a.lease_ref]


def test_l3_a_live_cache_entry_without_a_committed_row_is_dropped(lease_world):
    w = lease_world
    snap = cl.REG.snapshot("dev-a", "entry-a", "u1")
    with cl.REG.lock:  # what a failed commit after issue() used to leave behind
        cl.REG.live["zombie"] = cl.LiveLease("zombie", "dev-a", "entry-a", 0, "u1", cl.now() + timedelta(seconds=60), snap)
    assert cl.has_live()
    w.run(1.25)  # one janitor round
    assert "zombie" not in cl.live_refs() and not cl.has_live()


def test_l3_a_failed_commit_after_issue_leaves_no_live_entry(route, monkeypatch):
    w = route

    def boom(self):
        raise RuntimeError("commit failed")

    monkeypatch.setattr(ac._Action, "attempt", boom)
    r = start(w)
    assert r.status_code == 500
    assert not cl.live_refs()


def test_l5_dev_and_kiosk_principals_never_get_a_lease(lease_world):
    w = lease_world
    assert cl.DEV_PRINCIPAL_ALLOWED is False
    for src in ("dev", "kiosk"):
        with pytest.raises(ApiError) as e:
            _issue(w, src=src)
        assert e.value.status == 403
    assert not w.rows()


def test_l7_an_expired_lease_reads_expired_not_revoked(lease_world):
    w = lease_world
    a = w.issue()
    w.clock.advance(cl.LEASE_MAX_S + 1)
    assert cl.expired(a.lease_ref) and not cl.usable(a.lease_ref)
