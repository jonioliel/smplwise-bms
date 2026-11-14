"""CAPEMERGENCY2-295, the two follow-ups of CAPEMERGENCY-295 (trigger T10 of CR-WISKEY-LEASE-REVOCATION-EVENT), behind the same capture
flags: (1) while a real emergency OPEN incident is in effect (its own state: applying / in_effect / in_effect_partial) a NEW capture lease
is refused with the closed code `capture_lease_emergency` and audited, and a lease that became live in the gap between the incident's
creation and its cancel is revoked too; (2) a real emergency LOCK also revokes live leases with the reason `emergency`. Drills never do
either. Fakes only: the scripted emergency engine, the fake lease bridge and host, the fake WisKey feed. Nothing reaches a door or WisKey."""
from __future__ import annotations

import datetime as dt
import json
import uuid

import pytest
from fastapi.testclient import TestClient
from fake_doorwin_adapters import ProductWorld
from lease_fixtures import lease_world  # noqa: F401  (fixture)

from smplwise.db import set_setting
from smplwise.errors import ApiError
from smplwise.services import capture_lease as cl
from smplwise.services import door_emergency as de
from smplwise.services import door_windows_engine as dwe


def _open_world(settings, monkeypatch) -> ProductWorld:
    pw = ProductWorld(settings, monkeypatch, go_live=True)
    pw.emergency_on()
    monkeypatch.setattr(dwe.WiskeyEmergencyEngine, "open_supported", True)
    assert pw.post("/doors/emergency/attestation", version=de.ATTESTATION_VERSION, accepted=True, confirmed=True).status_code == 200
    assert pw.put("/doors/emergency/settings", changes={"doors.emergency.open_enabled": "on"}, confirmed=True).status_code == 200
    return pw


@pytest.fixture()
def both(lease_world, settings, monkeypatch):  # noqa: F811
    return lease_world, _open_world(settings, monkeypatch)


def _press(pw, kind: str, *, drill: bool = False) -> dict:
    r = pw.press(kind, drill=drill)
    assert r.status_code == 201, r.text
    return r.json()["incident"]


def _emergency_revokes(w) -> list[dict]:
    return [e for e in w.events("lease_revoke") if e["params"]["reason"] == "emergency"]


def _refused(w, **kw) -> ApiError:
    with pytest.raises(ApiError) as caught:
        w.issue(**kw)
    return caught.value


def _lease_count(w) -> int:
    return len(w.rows())


# ---------------------------------------------------------------- (1) a new lease while an OPEN is in effect

def test_flag_off_shipped_build_no_emergency_refusal_and_no_sweep(settings, monkeypatch):
    """The constants as shipped: the route is off, so a start is refused with the plain `capture_lease_unavailable` (as before this
    change), never with the emergency code, nothing is audited by this change and the sweep does nothing."""
    assert cl.GO_LIVE_PERMITTED is False and cl.MIN_BRIDGE_FOR_CAPTURE_LEASE is None
    cl.reset_for_tests()
    pw = _open_world(settings, monkeypatch)
    inc = _press(pw, "open")
    assert inc["state"] == "in_effect"
    with pw.db.connection() as conn:
        with pytest.raises(ApiError) as caught:
            cl.ensure_issuable(conn)
    assert caught.value.code == "capture_lease_unavailable"
    assert cl.emergency_sweep(pw.db) == 0
    assert not pw.rows("SELECT id FROM audit_log WHERE action LIKE 'intercom.capture_lease.emergency%'")


def test_flag_switched_off_with_an_open_in_effect_refuses_as_unavailable_not_emergency(both):
    w, pw = both
    _press(pw, "open")
    with w.db.connection() as conn:
        set_setting(conn, cl.FLAG_KEY, "off")
    assert _refused(w).code == "capture_lease_unavailable"
    assert not w.audit(cl.EMERGENCY_REFUSE_AUDIT)


def test_flag_on_a_new_lease_is_refused_while_the_open_is_in_effect_and_audited(both):
    w, pw = both
    inc = _press(pw, "open")
    assert inc["state"] == "in_effect"
    exc = _refused(w)
    assert exc.status == 409 and exc.code == cl.EMERGENCY_CODE and exc.details["outcome"] == "not_sent"
    assert _lease_count(w) == 0 and not w.events("capture_start")
    rows = w.audit(cl.EMERGENCY_REFUSE_AUDIT)
    assert len(rows) == 1 and rows[0]["decision"] == "denied" and rows[0]["reason"] == "emergency"
    assert rows[0]["resource_id"] == f"emergency:{inc['id']}" and json.loads(rows[0]["details_json"]) == {"incident_id": inc["id"]}


@pytest.mark.parametrize("state", ["applying", "in_effect_partial"])
def test_every_apply_state_counts_as_in_effect(both, state):
    w, pw = both
    inc = _press(pw, "open")
    with w.db.connection() as conn:
        conn.execute("UPDATE door_emergency_incidents SET state = ? WHERE id = ?", (state, inc["id"]))
    assert _refused(w).code == cl.EMERGENCY_CODE


def test_after_the_release_the_open_no_longer_holds_and_a_lease_is_issued(both):
    w, pw = both
    inc = _press(pw, "open")
    assert _refused(w).code == cl.EMERGENCY_CODE
    pw.t[0] += dt.timedelta(seconds=11)
    r = pw.release(inc["id"], kind="open")
    assert r.status_code in (200, 201), r.text
    with w.db.connection(mode="read") as conn:
        assert de.incident_row(conn, inc["id"])["state"] not in de.PHASE_STATES["apply"]
    lease = w.issue()
    assert w.row(lease.lease_ref)["state"] == "active"


def test_a_drill_open_never_refuses_a_lease(both):
    w, pw = both
    _press(pw, "open", drill=True)
    lease = w.issue()
    w.step(0.25)
    assert w.row(lease.lease_ref)["state"] == "active" and not w.audit(cl.EMERGENCY_REFUSE_AUDIT) and not _emergency_revokes(w)


def test_a_lock_in_effect_does_not_refuse_a_new_lease(both):
    w, pw = both
    _press(pw, "lock_secure")
    w.step(0.25)
    lease = w.issue()
    w.step(0.25)
    assert w.row(lease.lease_ref)["state"] == "active" and not w.audit(cl.EMERGENCY_REFUSE_AUDIT)


def test_the_incident_state_cannot_be_read_fails_closed(both, monkeypatch):
    w, _pw = both

    def boom(conn):
        raise RuntimeError("no incident table")

    monkeypatch.setattr(cl, "emergency_open_in_effect", boom)
    assert _refused(w).code == "capture_lease_unavailable"
    assert _lease_count(w) == 0


# ---------------------------------------------------------------- (1) the race gap: a lease live between the incident and the cancel

def test_gap_a_lease_issued_before_the_incident_commit_is_revoked_by_the_cancel(both, monkeypatch):
    """The issue's write transaction ran before the incident was committed (its emergency check saw nothing), the lease became live,
    and the incident's cancel then runs: the lease is revoked with the reason `emergency`."""
    w, pw = both
    with monkeypatch.context() as m:
        m.setattr(de, "cancel_capture_leases", lambda db, iid: 0)  # hold the gap open: the incident is in, its cancel not yet
        inc = _press(pw, "open")
        m.setattr(cl, "emergency_open_in_effect", lambda conn: None)  # the issue's transaction predates the incident's commit
        gap = w.issue()
    assert cl.usable(gap.lease_ref)
    assert de.cancel_capture_leases(w.db, inc["id"]) == 1
    assert not cl.usable(gap.lease_ref)
    w.step(0.25)
    row = w.row(gap.lease_ref)
    assert row["state"] == "revoked" and row["reason"] == "emergency"
    assert len(_emergency_revokes(w)) == 1 and len(w.audit(cl.EMERGENCY_AUDIT)) == 1


def test_gap_a_lease_live_after_the_cancel_ran_is_revoked_by_the_sweep_once(both, monkeypatch):
    """The cancel already ran (nothing live then); a lease whose issue raced the incident commit is live afterwards: the lease worker's
    sweep revokes it on its next round, audited `emergency_gap_cancel`, and a later round does nothing more."""
    w, pw = both
    inc = _press(pw, "open")
    assert not w.audit(cl.EMERGENCY_AUDIT)  # nothing was live at the cancel
    with monkeypatch.context() as m:
        m.setattr(cl, "emergency_open_in_effect", lambda conn: None)
        gap = w.issue()
    assert cl.usable(gap.lease_ref)
    w.step(0.25)  # the sweep queues, the trigger is applied in the same round
    w.step(0.25)
    row = w.row(gap.lease_ref)
    assert row["state"] == "revoked" and row["reason"] == "emergency"
    rows = w.audit(cl.EMERGENCY_SWEEP_AUDIT)
    assert len(rows) == 1 and rows[0]["resource_id"] == f"emergency:{inc['id']}" and gap.lease_ref in rows[0]["details_json"]
    w.run(1.0)
    assert len(w.audit(cl.EMERGENCY_SWEEP_AUDIT)) == 1 and len(_emergency_revokes(w)) == 1


def test_sweep_with_no_live_lease_touches_nothing(both, monkeypatch):
    w, pw = both
    _press(pw, "open")
    opened: list[str] = []
    real = w.db.connection

    def spy(*a, **kw):
        opened.append(kw.get("label") or "")
        return real(*a, **kw)

    monkeypatch.setattr(w.db, "connection", spy)
    assert cl.emergency_sweep(w.db) == 0
    assert "capture_lease.emergency_sweep" not in opened
    assert not w.audit(cl.EMERGENCY_SWEEP_AUDIT)


def test_sweep_leaves_a_lease_alone_when_no_open_is_in_effect(both):
    w, pw = both
    lease = w.issue()
    _press(pw, "open", drill=True)
    w.run(1.0)
    assert w.row(lease.lease_ref)["state"] == "active" and not w.audit(cl.EMERGENCY_SWEEP_AUDIT)


def test_a_failed_cancel_is_reconciled_by_the_sweep(both, monkeypatch):
    """The emergency cancel hook failed (the open still went out); the lease worker's next round revokes the live lease."""
    w, pw = both
    lease = w.issue()

    def boom(*a, **kw):
        raise RuntimeError("lease route down")

    with monkeypatch.context() as m:
        m.setattr(cl, "on_emergency_open", boom)
        inc = _press(pw, "open")
    assert inc["state"] == "in_effect" and inc["counts"]["ok"] == 4
    assert cl.usable(lease.lease_ref)
    w.step(0.25)
    w.step(0.25)
    row = w.row(lease.lease_ref)
    assert row["state"] == "revoked" and row["reason"] == "emergency" and len(w.audit(cl.EMERGENCY_SWEEP_AUDIT)) == 1


def test_a_sweep_failure_never_breaks_the_worker_round(both, monkeypatch):
    w, pw = both
    lease = w.issue()

    def boom(conn):
        raise RuntimeError("read failed")

    monkeypatch.setattr(cl, "emergency_open_in_effect", boom)
    assert cl.emergency_sweep(w.db) == 0
    w.step(0.25)  # the round goes on: heartbeat and janitor still run
    assert w.row(lease.lease_ref)["state"] == "active"


# ---------------------------------------------------------------- (2) an emergency LOCK revokes live leases (T10)

def test_flag_on_a_lock_revokes_active_leases_with_reason_emergency_and_audits_once(both):
    w, pw = both
    a = w.issue(actor="dev-a", station="entry-a")
    b = w.issue(actor="dev-b", station="entry-b")
    inc = _press(pw, "lock_secure")
    assert inc["state"] == "in_effect"
    assert not cl.usable(a.lease_ref) and not cl.usable(b.lease_ref)
    w.step(0.25)
    for ref in (a.lease_ref, b.lease_ref):
        row = w.row(ref)
        assert row["state"] == "revoked" and row["reason"] == "emergency"
    sent = _emergency_revokes(w)
    assert len(sent) == 1 and sent[0]["params"]["scope"] == "all"
    rows = w.audit(cl.EMERGENCY_AUDIT)
    assert len(rows) == 1 and rows[0]["resource_id"] == f"emergency:{inc['id']}" and '"kind": "lock_secure"' in rows[0]["details_json"]
    assert de.cancel_capture_leases(w.db, inc["id"]) == 0  # idempotent
    cl.REG.emergency_done.clear()
    assert de.cancel_capture_leases(w.db, inc["id"]) == 0  # the audit row holds it across a restart
    w.step(0.25)
    assert len(_emergency_revokes(w)) == 1 and len(w.audit(cl.EMERGENCY_AUDIT)) == 1


def test_flag_off_a_lock_leaves_a_live_lease_alone(both):
    w, pw = both
    lease = w.issue()
    with w.db.connection() as conn:
        set_setting(conn, cl.FLAG_KEY, "off")
    _press(pw, "lock_secure")
    w.step(0.25)
    assert w.row(lease.lease_ref)["state"] == "active" and not _emergency_revokes(w) and not w.audit(cl.EMERGENCY_AUDIT)


def test_a_drill_lock_never_cancels_a_lease(both):
    w, pw = both
    lease = w.issue()
    inc = _press(pw, "lock_secure", drill=True)
    assert de.cancel_capture_leases(w.db, inc["id"]) == 0
    w.run(1.0)
    assert w.row(lease.lease_ref)["state"] == "active" and not _emergency_revokes(w) and not w.audit("intercom.capture_lease.emergency%")


def test_a_lock_with_no_live_lease_sends_and_audits_nothing(both):
    w, pw = both
    inc = _press(pw, "lock_secure")
    w.step(0.25)
    assert inc["counts"]["ok"] == 4 and not w.events("lease_revoke") and not w.audit(cl.EMERGENCY_AUDIT)


@pytest.mark.parametrize("where", ["hook", "route_on", "trigger"])
def test_a_cancel_failure_never_blocks_the_lock(both, monkeypatch, where):
    w, pw = both
    w.issue()

    def boom(*a, **kw):
        raise RuntimeError("lease route down")

    target = {"hook": "on_emergency_open", "route_on": "route_on", "trigger": "on_authority_change"}[where]
    monkeypatch.setattr(cl, target, boom)
    inc = _press(pw, "lock_secure")
    assert inc["state"] == "in_effect" and inc["counts"]["ok"] == 4
    assert len([c for c in pw.emergency.calls if c["phase"] == "apply" and c["kind"] == "lock_secure"]) == 4
    assert not w.audit(cl.EMERGENCY_AUDIT)


def test_an_unknown_kind_is_ignored_by_the_hook(both):
    w, _pw = both
    w.issue()
    with w.db.connection() as conn:
        assert cl.on_emergency_open(conn, "inc-x", "unlock_everything") == 0
    assert not w.audit(cl.EMERGENCY_AUDIT)


# ---------------------------------------------------------------- the real capture start route refuses with the closed code

def test_http_capture_start_is_refused_while_an_open_is_in_effect(lease_world, monkeypatch):  # noqa: F811
    """The capture start over HTTP (the lease route, fake feed and bridge): 409 `capture_lease_emergency`, nothing signed or sent, the
    route's own refusal row plus the emergency refusal row. The incident row is written directly (an emergency OPEN in effect)."""
    from conftest import as_user
    from fake_trusted_bridge import FakeWisKeyFeed, station
    from test_intercom import env

    from smplwise.main import create_app
    from smplwise.services import intercom_capture, intercom_sync

    w = lease_world
    monkeypatch.setattr(cl, "DEV_PRINCIPAL_ALLOWED", True)
    FakeWisKeyFeed([station("entry-a", "׳›׳ ׳™׳¡׳” ׳", relays=[1])]).install(monkeypatch)
    intercom_capture.CAPTURES.clear()
    try:
        c = TestClient(create_app(w.settings), raise_server_exceptions=False)
        assert c.get("/api/v1/me", headers=as_user("joni")).status_code == 200
        w.step(0.25)
        iid = uuid.uuid4().hex
        with w.db.connection() as conn:
            conn.execute("""INSERT INTO door_emergency_incidents(id, kind, scope_type, scope_id, drill, state, reason, actor_kind, requested_by, requested_at,
                                                                request_id, doors_total)
                            VALUES (?, 'open', 'installation', '*', 0, 'in_effect', '', 'person', 'joni', '2026-10-25T09:00:00Z', ?, 0)""", (iid, uuid.uuid4().hex))
        sent = len(w.bridge.calls)
        r = c.post("/api/v1/intercom/people/u1/card-capture", json=env(station_id="entry-a", reader_id=0, revision=4, confirmed=True), headers=as_user("joni"))
        assert r.status_code == 409 and r.json()["code"] == cl.EMERGENCY_CODE, r.text
        assert len(w.bridge.calls) == sent and _lease_count(w) == 0
        assert len(w.audit(cl.EMERGENCY_REFUSE_AUDIT)) == 1
        with w.db.connection(mode="read") as conn:
            assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE decision = 'denied' AND reason = ?", (cl.EMERGENCY_CODE,)).fetchone()[0] == 1
    finally:
        intercom_capture.CAPTURES.clear()
        intercom_sync.SYNC.reset()
