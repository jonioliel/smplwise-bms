"""CAPEMERGENCY-295 (trigger T10 of CR-WISKEY-LEASE-REVOCATION-EVENT): a real emergency OPEN revokes every live door-station card-capture
lease with the reason `emergency`, behind the existing capture flags. Each path drives the REAL emergency route (POST /doors/emergency/incidents)
against fakes only: the scripted emergency engine, the fake lease bridge and the fake WisKey host. Nothing reaches a door, a reader or WisKey."""
from __future__ import annotations

import datetime as dt

import pytest
from fake_doorwin_adapters import ProductWorld
from lease_fixtures import lease_world  # noqa: F401  (fixture)

from smplwise.db import set_setting
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
    """The lease route switched on inside the test (lease_world) and the emergency OPEN available (ProductWorld), on one database."""
    return lease_world, _open_world(settings, monkeypatch)


def _emergency_revokes(w) -> list[dict]:
    return [e for e in w.events("lease_revoke") if e["params"]["reason"] == "emergency"]


def _cancel_audit(w) -> list[dict]:
    return w.audit(cl.EMERGENCY_AUDIT)


def _open(pw) -> dict:
    r = pw.press("open")
    assert r.status_code == 201, r.text
    return r.json()["incident"]


# ---------------------------------------------------------------- flag off: nothing

def test_shipped_build_flag_off_the_open_does_nothing_to_leases(settings, monkeypatch):
    """The constants as shipped (no go-live permit, no bridge that offers lease_event, `access.capture_lease` off): no trigger, no audit."""
    assert cl.GO_LIVE_PERMITTED is False and cl.MIN_BRIDGE_FOR_CAPTURE_LEASE is None
    cl.reset_for_tests()
    seen: list[str] = []
    monkeypatch.setattr(cl, "on_authority_change", lambda reason, **kw: seen.append(reason) or 0)
    pw = _open_world(settings, monkeypatch)
    inc = _open(pw)
    assert inc["state"] == "in_effect" and inc["counts"]["ok"] == 4
    assert seen == [] and not pw.rows("SELECT id FROM audit_log WHERE action = ?", cl.EMERGENCY_AUDIT)


def test_flag_off_with_a_live_lease_leaves_it_alone(both):
    w, pw = both
    lease = w.issue()
    with w.db.connection() as conn:
        set_setting(conn, cl.FLAG_KEY, "off")  # the switch alone (no feature_off revoke): the hook must still read it as off
    inc = _open(pw)
    w.step(0.25)
    assert inc["counts"]["ok"] == 4
    assert w.row(lease.lease_ref)["state"] == "active" and not _emergency_revokes(w) and not _cancel_audit(w)


# ---------------------------------------------------------------- flag on + active lease: revoked with reason emergency

def test_flag_on_an_active_lease_is_revoked_with_reason_emergency_and_audited(both):
    w, pw = both
    a = w.issue(actor="dev-a", station="entry-a")
    b = w.issue(actor="dev-b", station="entry-b")
    inc = _open(pw)
    assert not cl.usable(a.lease_ref) and not cl.usable(b.lease_ref), "unusable from the instant of the open, before the worker writes"
    w.step(0.25)
    assert inc["state"] == "in_effect" and inc["counts"]["ok"] == 4
    for ref in (a.lease_ref, b.lease_ref):
        row = w.row(ref)
        assert row["state"] == "revoked" and row["reason"] == "emergency"
    sent = _emergency_revokes(w)
    assert len(sent) == 1 and sent[0]["params"]["scope"] == "all"
    rows = _cancel_audit(w)
    assert len(rows) == 1 and rows[0]["resource_id"] == f"emergency:{inc['id']}" and rows[0]["reason"] == "emergency"
    assert '"live_leases": 2' in rows[0]["details_json"]


def test_idempotent_a_second_cancel_for_the_same_incident_does_nothing(both):
    w, pw = both
    w.issue()
    inc = _open(pw)
    w.step(0.25)
    assert de.cancel_capture_leases(w.db, inc["id"]) == 0
    cl.REG.emergency_done.clear()  # what a restart does to the memory: the audit row still holds the incident
    assert de.cancel_capture_leases(w.db, inc["id"]) == 0
    w.step(0.25)
    assert len(_emergency_revokes(w)) == 1 and len(_cancel_audit(w)) == 1


def test_a_lock_or_a_drill_never_cancels_a_lease(both):
    w, pw = both
    lease = w.issue()
    drill = pw.press("open", drill=True)
    assert drill.status_code == 201, drill.text
    assert de.cancel_capture_leases(w.db, drill.json()["incident"]["id"]) == 0
    pw.t[0] += dt.timedelta(seconds=11)
    lock = pw.press("lock_secure")
    assert lock.status_code == 201, lock.text
    w.step(0.25)
    assert w.row(lease.lease_ref)["state"] == "active" and not _emergency_revokes(w) and not _cancel_audit(w)


# ---------------------------------------------------------------- no active lease: nothing

def test_no_active_lease_nothing_is_sent_or_audited(both):
    w, pw = both
    inc = _open(pw)
    w.step(0.25)
    assert inc["counts"]["ok"] == 4
    assert not w.events("lease_revoke") and not _cancel_audit(w)


# ---------------------------------------------------------------- a cancel failure never blocks the open

@pytest.mark.parametrize("where", ["hook", "route_on", "trigger"])
def test_a_cancel_failure_does_not_block_the_emergency_open(both, monkeypatch, where):
    w, pw = both
    w.issue()

    def boom(*a, **kw):
        raise RuntimeError("lease route down")

    target = {"hook": "on_emergency_open", "route_on": "route_on", "trigger": "on_authority_change"}[where]
    monkeypatch.setattr(cl, target, boom)
    inc = _open(pw)
    assert inc["state"] == "in_effect" and inc["counts"]["ok"] == 4
    assert len([c for c in pw.emergency.calls if c["phase"] == "apply" and c["kind"] == "open"]) == 4
    assert not _cancel_audit(w)
