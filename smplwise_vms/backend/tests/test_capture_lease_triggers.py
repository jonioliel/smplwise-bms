"""LEASE-BUILD slice L2 (CR-WISKEY-LEASE-REVOCATION-EVENT section 1.4): the 13 triggers wired to the existing hooks. Each test
fires the REAL hook site (not the lease hook directly, except where the site needs a live system) and checks the scope and
the reason of the revoke on the fake host. Fakes only."""
from __future__ import annotations

import json
import time
import types
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from conftest import as_user
from lease_fixtures import lease_world  # noqa: F401  (fixture)

from smplwise.db import bump_permission_revision
from smplwise.main import create_app
from smplwise.services import capture_lease as cl
from smplwise.services import ha_user_auth as hua
from smplwise.services import intercom_doors, intercom_sync, revocation

BACKEND = Path(__file__).resolve().parents[1]


def _last_revoke(w):
    rv = [c for c in w.bridge.calls if "dto" in c and c["dto"].action == "lease_revoke"]
    return rv[-1]["dto"] if rv else None


def test_t1_any_revision_bump_revokes_every_live_lease_without_re_check(lease_world):
    w = lease_world
    a = w.issue(actor="dev-a", station="entry-a")
    b = w.issue(actor="dev-b", station="entry-b")
    with w.db.connection() as conn:
        bump_permission_revision(conn)  # e.g. an unrelated binding edit by another administrator
    w.step(0.25)
    dto = _last_revoke(w)
    assert dto.params["scope"] == "all" and dto.params["reason"] == "permission_revision"
    assert {w.row(a.lease_ref)["state"], w.row(b.lease_ref)["state"]} == {"revoked"}


def test_t1_a_rolled_back_permission_change_still_revokes_safely(lease_world):
    w = lease_world
    a = w.issue()
    with pytest.raises(RuntimeError):
        with w.db.connection() as conn:
            bump_permission_revision(conn)
            raise RuntimeError("the caller's transaction fails")
    w.step(0.25)
    assert w.row(a.lease_ref)["state"] == "revoked", "over-revoking is the safe side: a revoke never un-revokes"


def test_t2_directory_disable_revokes_the_actor_first_then_strict_t1_revokes_all(lease_world):
    """CR N8 expects a second actor's lease untouched; the directory disable also bumps permission_revision (routers/ha.py),
    and the owner's strict T1 then revokes every live lease. Recorded as a CR contradiction in the report."""
    from smplwise.routers.ha import _apply_directory_to_users

    w = lease_world
    a = w.issue(actor="dev-a", station="entry-a")
    b = w.issue(actor="dev-b", station="entry-b")
    with w.db.connection() as conn:
        for uid in ("dev-a", "dev-b"):
            conn.execute("INSERT OR REPLACE INTO users(id, username, display_name, source, active, first_seen_at, last_seen_at) VALUES (?, ?, ?, 'ingress', 1, '2026-10-16T00:00:00Z', '2026-10-16T00:00:00Z')", (uid, uid, uid))
        req = types.SimpleNamespace(state=types.SimpleNamespace(correlation_id=None))
        _apply_directory_to_users(conn, req, {"dev-a": {"is_active": False}, "dev-b": {"is_active": True}})
    w.step(0.25)
    reasons = [(e["params"]["scope"], e["params"]["reason"]) for e in w.events("lease_revoke")]
    assert reasons[0] == ("actor", "actor_disabled") and ("all", "permission_revision") in reasons
    assert w.row(a.lease_ref)["reason"] == "actor_disabled" and w.row(b.lease_ref)["reason"] == "permission_revision"


def test_t2_actor_scope_alone_leaves_another_actor_untouched(lease_world):
    w = lease_world
    a = w.issue(actor="dev-a", station="entry-a")
    b = w.issue(actor="dev-b", station="entry-b")
    cl.on_authority_change("actor_removed", user_ids=["dev-a"])
    w.step(0.25)
    dto = _last_revoke(w)
    assert dto.params["scope"] == "actor" and dto.actor_id == "dev-a" and dto.station == "entry-a"
    assert w.row(a.lease_ref)["state"] == "revoked" and w.row(b.lease_ref)["state"] == "active" and cl.usable(b.lease_ref)
    assert b.lease_ref in w.host.leases


def test_t3_revocation_mark_and_changed_revoke_the_actor(lease_world):
    w = lease_world
    a = w.issue(actor="dev-a", station="entry-a")
    b = w.issue(actor="dev-b", station="entry-b")
    revocation.mark(["dev-a"])
    revocation.changed(["dev-b"])  # a grant too: the decision WisKey holds is no longer the fresh one
    w.step(0.25)
    assert [(e["params"]["scope"], e["params"]["reason"]) for e in w.events("lease_revoke")] == [("actor", "access_changed")] * 2
    assert w.row(a.lease_ref)["state"] == w.row(b.lease_ref)["state"] == "revoked"


def _session(uid: str, sid: str, exp: float) -> hua.RemoteSession:
    p = types.SimpleNamespace(user_id=uid, username=uid, display_name=uid, source="remote")
    now = time.time()
    return hua.RemoteSession(sid=sid, principal=p, token="t-" + sid, token_exp=exp, ha_user=None, client_ip="192.0.2.1", created_at=now, last_used=now, last_validated=now)


def test_t4_session_end_logout_revoke_and_expiry_revoke_the_actor_but_rotation_does_not(lease_world):
    w = lease_world
    a = w.issue(actor="dev-a", station="entry-a")
    with hua.STORE._lock:
        hua.STORE._sessions["s-rot"] = _session("dev-a", "s-rot", time.time() + 3600)
        hua.STORE._sessions["s-new"] = _session("dev-a", "s-new", time.time() + 3600)
        hua.STORE._drop_quietly_locked("s-rot", move_sockets_to="s-new")  # a cookie rotation
    w.step(0.25)
    assert w.row(a.lease_ref)["state"] == "active", "a rotation is not a session end"
    hua.STORE.drop_user("dev-a")  # sign out everywhere / an administrator's revoke
    w.step(0.25)
    assert w.row(a.lease_ref)["state"] == "revoked" and w.row(a.lease_ref)["reason"] == "session_ended"
    b = w.issue(actor="dev-b", station="entry-b")
    with hua.STORE._lock:
        hua.STORE._sessions["s-exp"] = _session("dev-b", "s-exp", time.time() - 1)
    assert hua.STORE.get("s-exp") is None  # expiry drops it
    w.step(0.25)
    assert w.row(b.lease_ref)["reason"] == "session_ended"
    text = (BACKEND / "smplwise" / "services" / "ha_user_auth.py").read_text(encoding="utf-8")
    assert "EXTENSION POINT (USR2 branches)" in text


def test_t6_second_factor_reset_by_an_administrator_revokes_the_actor(lease_world):
    w = lease_world
    c = TestClient(create_app(w.settings))  # no lifespan: the worker stays the test's
    for user in ("joni", "sam"):
        assert c.get("/api/v1/me", headers=as_user(user)).status_code == 200  # bootstrap first (it bumps the revision)
    w.step(0.25)
    lease = w.issue(actor="dev-sam", station="entry-a")
    r = c.delete("/api/v1/auth/second-factor/users/dev-sam", headers=as_user("joni"))
    assert r.status_code == 200, r.text
    w.step(0.25)
    assert w.row(lease.lease_ref)["reason"] == "second_factor_changed"
    text = (BACKEND / "smplwise" / "routers" / "second_factor.py").read_text(encoding="utf-8")
    assert text.count('capture_lease.on_authority_change("second_factor_changed"') == 3, "enrol confirmed, disabled, administrator reset"


def test_t7_placement_and_door_map_changes_revoke_the_station(lease_world):
    w = lease_world
    a = w.issue(actor="dev-a", station="entry-a")
    b = w.issue(actor="dev-b", station="entry-b")
    with w.db.connection() as conn:
        intercom_doors.set_placement(conn, "entry-a", None, None, "dev-admin")  # unplaced
    w.step(0.25)
    dto = _last_revoke(w)
    assert dto.params["scope"] == "station" and dto.station == "entry-a" and dto.params["reason"] == "binding_changed"
    assert w.row(a.lease_ref)["state"] == "revoked" and w.row(b.lease_ref)["state"] == "active"
    with w.db.connection() as conn:
        conn.execute("INSERT INTO intercom_door_map(entity_id, config_entry_id, physical_index, source, mapped_by, mapped_at, revision) VALUES ('lock.b', 'entry-b', 1, 'manual', 'x', 'now', 1)")
        intercom_doors.clear_mapping(conn, "lock.b")
    w.step(0.25)
    assert w.row(b.lease_ref)["reason"] == "binding_changed"


def test_t8_station_offline_lock_set_change_left_overview_and_feed_reconnect(lease_world):
    w = lease_world
    a = w.issue(actor="dev-a", station="entry-a")
    b = w.issue(actor="dev-b", station="entry-b")
    c = w.issue(actor="dev-c", station="entry-c")
    before = [{"id": "entry-a", "online": True, "locks": [1]}, {"id": "entry-b", "online": True, "locks": [1]}, {"id": "entry-c", "online": True, "locks": [1]}]
    after = [{"id": "entry-a", "online": False, "locks": [1]}, {"id": "entry-b", "online": True, "locks": [1, 2]}]
    intercom_sync.lease_station_diff(before, after)
    w.step(0.25)
    got = {e["params"]["reason"] for e in w.events("lease_revoke")}
    assert got == {"receiver_offline", "receiver_changed", "binding_changed"}
    assert w.row(a.lease_ref)["reason"] == "receiver_offline" and w.row(b.lease_ref)["reason"] == "receiver_changed" and w.row(c.lease_ref)["reason"] == "binding_changed"
    d = w.issue(actor="dev-d", station="entry-d")
    intercom_sync._lease_hook("feed_reconnect")
    w.step(0.25)
    dto = _last_revoke(w)
    assert dto.params["scope"] == "all" and dto.params["reason"] == "feed_reconnect" and w.row(d.lease_ref)["state"] == "revoked"
    src = (BACKEND / "smplwise" / "services" / "intercom_sync.py").read_text(encoding="utf-8")
    assert '_lease_hook("feed_reconnect")' in src and '_lease_hook("receiver_changed")  # T8' in src


def test_t9_switching_the_route_off_revokes_all_and_on_is_refused_without_a_bridge(lease_world, monkeypatch):
    w = lease_world
    c = TestClient(create_app(w.settings))
    for user in ("joni", "sam"):
        c.get("/api/v1/me", headers=as_user(user))
    w.step(0.25)
    lease = w.issue(actor="dev-sam")
    r = c.put("/api/v1/access/capture-lease/settings", json={"capture_lease": "off"}, headers=as_user("joni"))
    assert r.status_code == 200 and r.json()["capture_lease"] == "off", r.text
    w.step(0.25)
    assert w.row(lease.lease_ref)["reason"] == "feature_off"
    monkeypatch.setattr(cl, "MIN_BRIDGE_FOR_CAPTURE_LEASE", None)
    r = c.put("/api/v1/access/capture-lease/settings", json={"capture_lease": "on"}, headers=as_user("joni"))
    assert r.status_code == 409 and r.json()["code"] == "capture_lease_unavailable"
    with w.db.connection(mode="read") as conn:
        row = conn.execute("SELECT decision, reason FROM audit_log WHERE action = 'settings.changed' ORDER BY rowid DESC LIMIT 1").fetchone()
    assert tuple(row) == ("denied", "capture_lease_unavailable")


def test_t9_pairing_key_regeneration_revokes_all_and_resets_the_stream(lease_world):
    w = lease_world
    c = TestClient(create_app(w.settings))
    c.get("/api/v1/me", headers=as_user("joni"))
    w.step(0.25)
    lease = w.issue(actor="dev-sam")
    old_stream = w.host.stream_id
    r = c.get("/api/v1/ha/bridge/pairing?regenerate=true", headers=as_user("joni"))
    assert r.status_code == 200
    from smplwise.db import set_setting
    from fake_trusted_bridge import TEST_SECRET

    with w.db.connection() as conn:  # the test keeps signing with the TEST key (a real re-pair would give the bridge the new one)
        set_setting(conn, "bridge.secret", TEST_SECRET)
        set_setting(conn, "bridge.paired_at", "2026-10-16T11:30:00Z")
    w.step(0.25)
    w.step(0.25)
    assert w.row(lease.lease_ref)["reason"] == "repair"
    assert w.host.stream_id != old_stream and [e for e in w.events("lease_stream_reset") if e["params"]["reason"] == "repair"]


def test_t12_person_change_revokes_only_that_persons_lease(lease_world):
    w = lease_world
    a = w.issue(actor="dev-a", station="entry-a", person="u1")
    b = w.issue(actor="dev-b", station="entry-b", person="u2")
    cl.on_authority_change("person_changed", person_ids=["u1"])
    w.step(0.25)
    dto = _last_revoke(w)
    assert dto.params["scope"] == "lease" and dto.params["lease_ref"] == a.lease_ref and dto.params["reason"] == "person_changed"
    assert w.row(b.lease_ref)["state"] == "active"
    src = (BACKEND / "smplwise" / "routers" / "access_control.py").read_text(encoding="utf-8")
    assert src.count('capture_lease.on_authority_change("person_changed"') == 2, "people writes: success and unknown outcome"


def test_restore_revokes_all_and_asks_for_a_new_stream(lease_world):
    from smplwise.services import backup, lease_events

    w = lease_world
    lease = w.issue()
    with w.db.connection() as conn:
        entry = backup.create(w.settings, conn, "manual", include_access=False)
    path = backup.backups_dir(w.settings) / entry["name"]
    with w.db.connection() as conn:
        report = backup.restore(w.settings, conn, path, mode="merge", scope="project")
    assert report["capture_lease_settings"]["dropped"] == {}
    old_stream = w.host.stream_id
    w.step(0.25)
    w.step(0.25)
    assert w.row(lease.lease_ref)["reason"] == "restore"
    assert w.host.stream_id != old_stream
    assert lease_events.WORKER.reset_requested is None


def test_unknown_reason_and_hook_errors_never_break_the_caller(lease_world, monkeypatch):
    w = lease_world
    a = w.issue()
    assert cl.on_authority_change("because", user_ids=["dev-sam"]) == 1  # treated as access_changed
    w.step(0.25)
    assert w.row(a.lease_ref)["reason"] == "access_changed"

    class Boom:
        def __enter__(self):
            raise RuntimeError("lock")

        def __exit__(self, *a):
            return False

    monkeypatch.setattr(cl.REG, "lock", Boom())
    assert cl.on_authority_change("permission_revision", all=True) == 0 and cl.GUARDS.degraded, "an internal failure degrades the route, never raises"
    monkeypatch.undo()
