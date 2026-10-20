"""WISKEYFINAL2-281 (FAKES ONLY): the Arx-side findings of WisKey's round-5 STATIC review (R5-A1 .. R5-A7,
`private/planning/wiskey_reply5_answer_2026-10-19/PART_A_STATIC_REVIEW.txt`; PROPOSED, NOT_RUN against any WisKey, station or door).

Nothing here contacts WisKey, Home Assistant, a station, a door, a reader or WhatsApp: the engine is tests/fake_wiskey.FakeAccessEngine,
the sync layer runs on a private event loop with a fake send, the capture lease runs against the fake bridge and host, the clock is
injected. The proposed WisKey contracts ACR5-01..04 are NOT used (not accepted on the wire)."""
from __future__ import annotations

import asyncio
import json
import sqlite3
import threading
import time
from types import SimpleNamespace
from typing import Any

import pytest
from conftest import as_user, bind
from test_access_arrival import Arrival
from test_access_grants import APPROVER, VF, VU, Env
from test_intercom_capture_lease import lease_of, route, start, wait_state  # noqa: F401 - `route` is a fixture
from lease_fixtures import lease_world  # noqa: F401 - fixture used by `route`
from test_intercom import env as envelope

from smplwise.db import Database
from smplwise.errors import ApiError
from smplwise.services import access_grant_engine as age
from smplwise.services import access_grants as ag
from smplwise.services import intercom_authority as ia
from smplwise.services import intercom_sync
from smplwise.services import intercom_write_journal as wj
from smplwise.services import intercom_writes as iw
from smplwise.services.access_grant_engine import EngineError, EnginePerson
from smplwise.rbac import Principal

ADMIN = Principal("dev-joni", "joni", "joni", "ha")  # the test installation's system administrator (R6-A5: a privileged actor)


@pytest.fixture()
def env(settings, monkeypatch):
    e = Env(settings, monkeypatch)
    yield e
    ag.reset_for_tests()


@pytest.fixture()
def arr(settings, monkeypatch):
    a = Arrival(settings, monkeypatch)
    yield a
    ag.reset_for_tests()


def audits(env, action: str, gid: str) -> list[dict]:
    with env.db.connection(mode="read") as conn:
        rows = conn.execute("SELECT details_json, reason FROM audit_log WHERE action = ? AND resource_id = ? ORDER BY rowid", (action, gid)).fetchall()
    return [{**json.loads(r[0] or "{}"), "_reason": r[1]} for r in rows]


def ops_of(db, grant_id: str) -> list[dict]:
    with db.connection(mode="read") as conn:
        return wj.create_ops(conn, grant_id=grant_id)


def _approved(env, doors: dict | None = None) -> str:
    gid = env.request(doors=doors or {"st-a": [1]}).json()["grant"]["id"]
    assert env.approve(gid).status_code == 200
    return gid


def _later(env, **kw) -> None:
    env.clock[0] = env.clock[0] + ag.timedelta(**kw)


# ================================================================ R5-A1: an unknown create without a durable link is never terminalized


def _create_lands_then_unknown(env) -> list[str]:
    """users/create reaches WisKey (the person exists) but its answer is lost: `unknown`, no person id known to Arx."""
    created: list[str] = []
    original = env.engine.create_person

    def create_person(**kw):
        person = original(**kw)
        created.append(person.id)
        raise EngineError("unknown", "timeout")

    env.engine.create_person = create_person
    return created


def test_r5_a1_the_create_intent_is_durable_before_the_dispatch(env):
    gid = _approved(env)
    seen: list[list[dict]] = []
    original = env.engine.create_person

    def create_person(**kw):
        seen.append(ops_of(env.db, gid))
        return original(**kw)

    env.engine.create_person = create_person
    env.run()
    assert env.grant(gid)["state"] == "active"
    assert len(seen) == 1 and [o["state"] for o in seen[0]] == ["dispatched"], "recorded and committed BEFORE users/create was sent"
    assert seen[0][0]["target"] == wj.create_target(gid) and seen[0][0]["purpose_ref"]
    after = ops_of(env.db, gid)
    assert [o["state"] for o in after] == ["ok"] and after[0]["result_ref"] == env.person_of(gid)["id"]
    blob = json.dumps(after)
    assert not any(s in blob for s in env.engine.PIN_SENTINELS) and "יוסי" not in blob, "ids and codes only"


def test_r5_a1_an_unknown_create_with_no_link_stays_unresolved_and_escalated(env, monkeypatch):
    alerts: list[tuple[str, str, int]] = []
    monkeypatch.setattr(ag, "_notify", lambda conn, source, subject_id, kind, repeat=0: alerts.append((subject_id, kind, repeat)))
    gid = _approved(env)
    created = _create_lands_then_unknown(env)
    env.run()
    assert env.grant(gid)["state"] == "unknown" and env.grant(gid)["link_id"] is None
    assert [o["state"] for o in ops_of(env.db, gid)] == ["unknown"]
    summaries = []
    for _ in range(4):
        summaries.append(env.run())
        _later(env, hours=1, minutes=1)
    g = env.grant(gid)
    assert g["state"] == "revoking" and g["end_reason"] == "failed", "the authority is withdrawn in Arx, the grant is NOT finalized"
    assert all(s["revoked"] == 0 for s in summaries), "never counted as revoked"
    assert audits(env, "access.grant.revoked", gid) == [] and audits(env, "access.grant.end", gid) == []
    assert any(a.get("code") == "create_unresolved" for a in audits(env, "access.grant.revoke_retry", gid))
    assert env.engine.calls.count("create_person") == 1 and created, "never recreated blindly"
    mine = [a for a in alerts if a[0] == gid[:32] and a[1] == "revoke_pending"]
    assert len(mine) >= 2 and mine[-1][2] >= 1, "the managers are told again each hour"


def test_r5_a1_a_recovered_target_is_matched_and_then_cleaned_up(env):
    gid = _approved(env)
    created = _create_lands_then_unknown(env)
    env.run()
    env.run()
    assert env.grant(gid)["state"] == "revoking"
    op = [o for o in ops_of(env.db, gid) if o["state"] in wj.OPEN][0]
    # R6-A5: an administrator, with per-operation evidence, names THIS grant's one unresolved create
    ag._attach_recovered_person(env.db, gid, op["id"], created[0], actor=ADMIN, evidence_ref="case:recovery-0001")
    assert env.grant(gid)["link_id"] is not None
    _later(env, minutes=10)
    env.run()
    g = env.grant(gid)
    assert g["state"] == "failed" and env.engine.people[created[0]]["active"] is False, "stripped and verified like any other revoke"
    assert env.engine.calls.count("create_person") == 1


def test_r5_a1_a_recovered_target_is_never_attached_to_a_settled_or_foreign_create(env):
    gid = env.active_grant()
    with pytest.raises(ApiError) as e:
        ag._attach_recovered_person(env.db, gid, "op-x", "wk-0099", actor=ADMIN, evidence_ref="case:recovery-0001")
    assert e.value.code == "access_create_not_unresolved"


def test_r5_a1_a_refused_create_closes_without_a_revoked_audit(env):
    gid = _approved(env)
    env.engine.fail["create_person"] = "refused"
    summary = env.run()
    g = env.grant(gid)
    assert g["state"] == "failed" and summary["revoked"] == 0
    assert audits(env, "access.grant.revoked", gid) == []
    assert [o["state"] for o in ops_of(env.db, gid)] == ["refused"]


def test_r5_a1_a_pushed_grant_without_link_or_create_record_is_held(env):
    gid = _approved(env)
    env.sql("UPDATE access_grants SET state = 'revoking', pushed = 1, end_reason = 'manual', revoking_since = ? WHERE id = ?", ag.iso(ag.now()), gid)
    env.run()
    _later(env, hours=2)
    env.run()
    assert env.grant(gid)["state"] == "revoking", "no evidence that nothing was created: held, never finalized"
    assert audits(env, "access.grant.revoked", gid) == []


def test_r5_a1_no_new_create_for_a_subject_with_an_unresolved_create(env):
    gid = _approved(env)
    _create_lands_then_unknown(env)
    env.run()
    env.sql("UPDATE access_grants SET state = 'approved', pushed = 0 WHERE id = ?", gid)  # an operator re-approval path, say
    env.engine.create_person = lambda **kw: (_ for _ in ()).throw(AssertionError("a second users/create was sent"))
    env.run()
    assert env.grant(gid)["state"] in ("approved", "revoking")


# ================================================================ R5-A2: the whole intended timing policy is proven


TIMING = {"mode": "weekly", "timezone": "Asia/Jerusalem", "days": ["Thursday"], "dates": [], "periods": [{"start": "08:00", "end": "12:00"}]}


def _raw_person(policy: Any) -> dict:
    return {"id": "u", "revision": 4, "active": True, "group_ids": [], "permission_overrides": {}, "pin_configured": False, "valid_from": VF, "valid_until": VU,
            "assignments": {"st-a": {"enabled": True, "allowed_locks": [1], "desired_revision": 4, "applied_revision": 4, "sync_state": "synced"}},
            "access_timing_policy": policy}


def _scope(**over: Any) -> ag.Scope:
    base = dict(doors={"st-a": [1]}, valid_from=VF, valid_until=VU, timing=None, credential="pin")
    return ag.Scope(**{**base, **over})


def test_r5_a2_the_engine_person_keeps_mode_schedule_and_bindings():
    p = age.person_from_raw(_raw_person({"mode": "ha", "schedule": TIMING, "bindings": {}}))
    assert p.timing == TIMING and p.timing_policy == {"mode": "ha", "schedule": TIMING, "bindings": {}}
    assert age.person_from_raw(_raw_person(None)).timing_policy is None


@pytest.mark.parametrize("policy, proven", [
    ({"mode": "ha", "schedule": TIMING, "bindings": {}}, True),
    ({"mode": "native", "schedule": TIMING, "bindings": {}}, False),
    ({"mode": "ha", "schedule": TIMING, "bindings": {"st-a": "plan-1"}}, False),
    ({"mode": "ha", "schedule": TIMING}, False),
    ({"schedule": TIMING, "bindings": {}}, False),
    (None, False),
])
def test_r5_a2_scope_proof_needs_the_whole_requested_policy(policy, proven):
    p = age.person_from_raw(_raw_person(policy))
    assert ag.scope_proven(p, _scope(timing=TIMING)) is proven
    # no policy at all = no time restriction: BROADER than the requested schedule (R4-03 may activate it with the narrowing still to push)
    assert ag.readback_covers(p, _scope(timing=TIMING)) is (proven or policy is None)


def test_r5_a2_no_timing_requested_means_no_policy_at_all():
    assert ag.scope_proven(age.person_from_raw(_raw_person(None)), _scope()) is True
    assert ag.scope_proven(age.person_from_raw(_raw_person({"mode": "native", "schedule": None, "bindings": {}})), _scope()) is False


def test_r5_a2_a_native_policy_with_the_same_schedule_never_settles_an_unknown_outcome(env):
    gid = env.request(doors={"st-a": [1]}, timing=TIMING).json()["grant"]["id"]
    assert env.approve(gid).status_code == 200
    env.engine.unknown_after_apply = True
    env.run()
    assert env.grant(gid)["state"] == "unknown"
    original = env.engine._raw

    def raw(p):
        out = original(p)
        if out.get("access_timing_policy"):
            out["access_timing_policy"]["mode"] = "native"
        return out

    env.engine._raw = raw
    env.run()
    assert env.grant(gid)["state"] != "active"
    assert not any(a.get("after") == "unknown" for a in audits(env, "access.grant.activate", gid))


# ================================================================ R5-A3: grant state and pending sync are explicit


def _view(env, gid: str) -> dict:
    r = env.c.get(f"{ag_api()}/access-grants/{gid}")
    if r.status_code == 200:
        body = r.json()
        return body.get("grant", body)
    with env.db.connection(mode="read") as conn:
        from smplwise.rbac import Principal

        return ag.present(conn, Principal(user_id="dev-joni", username="joni", display_name="joni", source="ha"), ag.grant_row(conn, gid))


def ag_api() -> str:
    from tickets_world import API

    return API


def test_r5_a3_a_pending_narrowing_is_never_presented_as_applied(env):
    gid = env.active_grant(doors={"st-a": [1], "st-b": [1]})
    v = _view(env, gid)
    # R6-A3: provisioning trusted the write's answer (no post-write proof is recorded): accepted, never verified
    assert (v["grant_state"], v["needs_push"], v["pending_sync"], v["scope_verified"], v["doors_state"]) == ("active", False, False, False, "accepted")
    env.engine.offline = True  # the push cannot happen now
    env.request(doors={"st-a": [1]})
    env.run()
    v = _view(env, gid)
    assert v["grant_state"] == "active" and v["needs_push"] is True and v["pending_sync"] is True and v["scope_verified"] is False
    assert v["doors_state"] == "desired" and v["attention"] == "sync_pending"
    env.engine.offline = False
    env.run()
    v = _view(env, gid)
    assert (v["needs_push"], v["pending_sync"], v["scope_verified"], v["doors_state"]) == (False, False, False, "accepted")


def test_r5_a3_an_unknown_or_approved_grant_is_not_a_verified_scope(env):
    gid = _approved(env)
    v = _view(env, gid)
    assert (v["grant_state"], v["pending_sync"], v["scope_verified"]) == ("approved", True, False)
    env.engine.unknown_after_apply = True
    env.run()
    v = _view(env, gid)
    assert (v["grant_state"], v["pending_sync"], v["scope_verified"]) == ("unknown", True, False)


def test_r5_a3_the_arrival_reply_tells_approval_from_a_verified_scope(arr):
    from test_wiskey_final280 import _live_grant

    gid = _live_grant(arr, assignment_id=None, source_ref=arr.ticket_id, source_kind="ticket")
    r = arr.post()
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["state"] == "approved" and body["grant_state"] == "approved"
    assert body["pending_sync"] is True and body["scope_verified"] is False, "approved by a human is not a station-sync claim"


# ================================================================ R5-A4: an incomplete before-scope is unknown in authorization consumers


def _superset(**over: Any) -> dict:
    # PERMOVR-293: a complete superset states its override stations (none here); without them the write gate fails closed
    base = {"id": "u1", "revision": 3, "assignments": [{"station_id": "st-a", "enabled": True, "doors": [1]}], "stations_known": True, "access_known": True,
            "override_stations": []}
    return {**base, **over}


class _Auth:
    def __init__(self, stations: set[str], unrestricted: bool = False) -> None:
        self.stations, self.all = stations, unrestricted
        self.principal = SimpleNamespace(user_id="u")

    def station(self, perm, sid):
        return self.all or sid in self.stations

    def unrestricted(self, perm):
        return self.all


def test_r5_a4_person_station_ids_is_unknown_for_an_incomplete_record():
    assert ia.person_station_ids(_superset()) == ["st-a"]
    assert ia.person_station_ids(_superset(stations_known=False)) is None
    assert ia.person_station_ids(_superset(stations_known=False, operator_editable=True)) is None


@pytest.mark.parametrize("over", [{"stations_known": False}, {"stations_known": False, "operator_editable": True}, {"access_known": False, "stations_known": False}])
def test_r5_a4_check_person_refuses_a_scoped_writer_on_a_partial_view(over):
    with pytest.raises(ApiError) as e:
        iw.check_person(_Auth({"st-a"}), _superset(**over), permissions=(iw.MANAGE,))
    assert e.value.status == 403 and e.value.code == "intercom_person_scope"
    assert iw.check_person(_Auth(set(), unrestricted=True), _superset(**over), permissions=(iw.MANAGE,)).person is not None
    assert iw.check_person(_Auth({"st-a"}), _superset(), permissions=(iw.MANAGE,)).stations == ["st-a"], "a complete record still decides per station"


def _scoped_approver(env) -> None:
    rid = env.role("מאשר א", APPROVER)
    bind(env.c, env.settings, "appr", rid, "access_control_station", "st-a")


def test_r5_a4_grant_approval_refuses_a_scoped_approver_when_the_person_is_partially_projected(env):
    gid = env.active_grant(doors={"st-a": [1]})
    r = env.request(doors={"st-a": [1, 2]})
    assert r.json()["outcome"] == "widening"
    _scoped_approver(env)
    env.engine.hide_doors = True  # the linked person's record: access fields redacted (doors_known False)
    r = env.approve(gid, user="appr")
    assert r.status_code == 403, r.text
    assert env.grant(gid)["pending_json"] is not None, "nothing approved"


def test_r5_a4_grant_approval_with_a_complete_person_still_decides_per_station(env):
    gid = env.active_grant(doors={"st-a": [1]})
    env.request(doors={"st-a": [1, 2]})
    _scoped_approver(env)
    r = env.approve(gid, user="appr")
    assert r.status_code == 200, r.text


def test_r5_a4_an_unrestricted_approver_may_approve_on_a_partial_projection(env):
    gid = env.active_grant(doors={"st-a": [1]})
    env.request(doors={"st-a": [1, 2]})
    env.engine.hide_doors = True
    assert env.approve(gid).status_code == 200


def test_r5_a4_matching_a_partially_projected_person_needs_unrestricted_people_manage(env):
    env.engine.add_person("wk-p", stations=["st-a", "st-z"], doors={"st-a": [1]})
    env.engine.hide_doors = True
    rid = env.role("מקשר", ["access.people.manage"])
    bind(env.c, env.settings, "linker", rid, "access_control_station", "st-a")
    cfg = env.c.post(f"{ag_api()}/access/roles", json={"name": "עורך קריאות", "description": "t", "permissions": [], "sensitive": ["tickets.configure"]})
    assert cfg.status_code == 201, cfg.text
    bind(env.c, env.settings, "linker", cfg.json()["id"], "installation", "*")
    env.engine.hide_doors = False
    ok = env.post("/access-grants/links", {"contact_id": env.tech2, "wiskey_person_id": "wk-p"}, user="linker")
    assert ok.status_code == 403 and ok.json()["details"]["target_id"] == "st-z", "control: a complete record decides per station"
    env.engine.add_person("wk-q", doors={"st-a": [1]})
    original = env.engine._raw

    def raw(p):  # a projection for a restricted caller: it may hold only the stations that caller sees (st-z withheld)
        return {**original(p), "operator_editable": True}

    env.engine._raw = raw
    r = env.post("/access-grants/links", {"contact_id": env.tech, "wiskey_person_id": "wk-q"}, user="linker")
    assert r.status_code == 403, r.text


# ================================================================ R5-A5: the signed capture-lease confirm uses the per-person gate


def test_r5_a5_the_lease_confirm_is_refused_while_the_person_has_a_write_out(route):
    w = route
    sid = start(w).json()["capture"]["session_id"]
    ref = lease_of(w, sid)["id"]
    w.host.present_card(ref)
    wait_state(w, sid, "captured")
    target = intercom_sync.person_target("u1")
    with intercom_sync.SYNC._unsettled_lock:
        intercom_sync.SYNC._writing.add(target)  # another write to the same person is being sent right now
    try:
        sent = len(w.bridge.calls)
        r = w.client.post(f"/api/v1/intercom/card-capture/{sid}/confirm", json=envelope(label="x", confirmed=True), headers=as_user("joni"))
        assert r.status_code == 409 and r.json()["code"] == "intercom_outcome_pending", r.text
        assert not [c for c in w.bridge.calls[sent:] if "dto" in c and c["dto"].action == "capture_confirm"], "nothing signed, nothing sent"
        assert wait_state(w, sid, "captured")["state"] == "captured", "the card still waits for approval"
    finally:
        with intercom_sync.SYNC._unsettled_lock:
            intercom_sync.SYNC._writing.discard(target)
    r = w.client.post(f"/api/v1/intercom/card-capture/{sid}/confirm", json=envelope(label="x", confirmed=True), headers=as_user("joni"))
    assert r.status_code == 200, r.text
    assert intercom_sync.SYNC.write_gate(target) is None


def test_r5_a5_an_unknown_lease_confirm_blocks_the_next_write_until_a_readback(route):
    w = route
    sid = start(w).json()["capture"]["session_id"]
    ref = lease_of(w, sid)["id"]
    w.host.present_card(ref)
    wait_state(w, sid, "captured")
    w.host.confirm_outcome = "sent_unknown"
    r = w.client.post(f"/api/v1/intercom/card-capture/{sid}/confirm", json=envelope(label="x", confirmed=True), headers=as_user("joni"))
    assert r.status_code == 504
    assert intercom_sync.SYNC.write_gate(intercom_sync.person_target("u1")) == "readback_required"


# ================================================================ R5-A6: durable intent/outcome and a recovery hold across restarts


class _Loop:
    def __init__(self) -> None:
        self.loop = asyncio.new_event_loop()
        self.thread = threading.Thread(target=self.loop.run_forever, daemon=True)
        self.thread.start()

    def close(self) -> None:
        self.loop.call_soon_threadsafe(self.loop.stop)
        self.thread.join(5)


@pytest.fixture()
def jdb(settings):
    db = Database(settings.db_path)
    db.migrate()
    return db


@pytest.fixture()
def make_sync(monkeypatch, jdb):
    loops: list[_Loop] = []
    monkeypatch.setattr(intercom_sync.ha_client, "configured", lambda _settings: True)
    monkeypatch.setattr(intercom_sync.STATE, "state", "ready")

    def make(boot: str, clock=None) -> intercom_sync.IntercomSync:
        s = intercom_sync.IntercomSync()
        lp = _Loop()
        loops.append(lp)
        s._event_loop = lp.loop
        s._call = object()

        async def one_off(send, not_after, channel):
            return await send(None)

        s._one_off = one_off
        s.journal = wj.WriteJournal(jdb, boot_id=boot, clock=clock)
        return s

    yield make
    for lp in loops:
        lp.close()


def _rows(jdb, target: str) -> list[dict]:
    with jdb.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM intercom_write_ops WHERE target = ? ORDER BY started_ts", (target,)).fetchall()]


def _unclear(_call):
    async def go():
        from smplwise.services.intercom_client import UnclearAnswer

        raise UnclearAnswer("users/update", "storage_write_failed")
    return go()


def test_r5_a6_the_intent_is_durable_before_the_frame_is_sent(make_sync, jdb):
    s = make_sync("boot-1")
    target = intercom_sync.person_target("u1")
    seen: list[list[dict]] = []

    async def send(_call):
        seen.append(_rows(jdb, target))
        return {"id": "u1", "revision": 2, "pin_configured": True}

    s.action(None, "person", send, lambda raw: raw, "w", lane="config", target=target, free=True)
    assert [r["state"] for r in seen[0]] == ["dispatched"]
    rows = _rows(jdb, target)
    assert [r["state"] for r in rows] == ["ok"] and rows[0]["finished_ts"] is not None
    assert set(rows[0]) >= {"target", "op", "state"} and "913377" not in json.dumps(rows), "no PIN or hash material is stored"


def test_r5_a6_an_unknown_write_survives_a_restart_and_holds_the_next_write(make_sync, jdb):
    target = intercom_sync.person_target("u2")
    first = make_sync("boot-1")
    with pytest.raises(ApiError):
        first.action(None, "person", _unclear, lambda raw: raw, "w", lane="config", target=target, free=True)
    assert [r["state"] for r in _rows(jdb, target)] == ["unknown"]
    second = make_sync("boot-2")  # a restart / a standby takeover: the in-memory gate is empty
    assert second.write_gate(target) == "readback_required"
    sent: list[int] = []

    async def write(_call):
        sent.append(1)
        return {"id": "u2", "revision": 3}

    with pytest.raises(ApiError) as e:
        second.action(None, "person", write, lambda raw: raw, "w", lane="config", target=target, free=True)
    assert e.value.code == "intercom_outcome_pending" and e.value.details["outcome"] == "not_sent" and sent == []

    async def read(_call):
        return {"id": "u2", "revision": 3}

    second.command(None, "person", read, lambda raw: raw, target=target)  # a fresh readback, started after the call was over
    assert second.write_gate(target) is None and [r["state"] for r in _rows(jdb, target)] == ["reconciled"]
    second.action(None, "person", write, lambda raw: raw, "w", lane="config", target=target, free=True)
    assert sent == [1]


def test_r5_a6_a_write_cut_by_a_process_end_is_held_past_the_transport_limit(make_sync, jdb):
    target = intercom_sync.person_target("u3")
    now = [1_000_000.0]
    old = wj.WriteJournal(jdb, boot_id="boot-dead", clock=lambda: now[0])
    old.begin(target, "person", "config")  # dispatched, and the process ended before any answer
    s = make_sync("boot-new", clock=lambda: now[0])
    assert s.write_gate(target) == "outcome_pending", "the old call may still commit: a read now proves nothing"

    async def read(_call):
        return {"id": "u3", "revision": 1}

    s.command(None, "person", read, lambda raw: raw, target=target)
    assert s.write_gate(target) == "outcome_pending" and [r["state"] for r in _rows(jdb, target)] == ["dispatched"]
    now[0] += wj.HOLD_S + 1
    assert s.write_gate(target) == "readback_required"
    s.command(None, "person", read, lambda raw: raw, target=target)
    assert s.write_gate(target) is None


def test_r5_a6_no_write_is_sent_when_the_intent_cannot_be_recorded(make_sync, jdb, monkeypatch):
    s = make_sync("boot-1")
    sent: list[int] = []

    async def write(_call):
        sent.append(1)
        return {"id": "u4", "revision": 2}

    class _Broken:  # R6-A2: the admission transaction itself cannot be opened
        def connection(self, *a, **kw):
            raise sqlite3.OperationalError("database is locked")

    s.journal = wj.WriteJournal(_Broken(), boot_id="boot-1")
    with pytest.raises(ApiError) as e:
        s.action(None, "person", write, lambda raw: raw, "w", lane="config", target=intercom_sync.person_target("u4"), free=True)
    assert e.value.details["outcome"] == "not_sent" and sent == []


def test_r5_a6_reads_and_untargeted_commands_are_not_journaled(make_sync, jdb):
    s = make_sync("boot-1")

    async def read(_call):
        return {"id": "u5", "revision": 1}

    s.command(None, "person", read, lambda raw: raw, target=intercom_sync.person_target("u5"))
    s.action(None, "x", read, lambda raw: raw, "w", lane="config", free=True)
    with jdb.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM intercom_write_ops").fetchone()[0] == 0


# ================================================================ R5-A7: malformed identity / revision / assignment rows fail closed


def _raw(**over: Any) -> dict:
    base = {"id": "u", "revision": 4, "active": True, "group_ids": [], "permission_overrides": {}, "pin_configured": False,
            "assignments": {"st-a": {"enabled": True, "allowed_locks": [1], "desired_revision": 4, "applied_revision": 4, "sync_state": "synced"}}}
    return {**base, **over}


@pytest.mark.parametrize("over", [{"revision": True}, {"revision": False}, {"id": ""}, {"id": 7}, {"revision": 4.0}])
def test_r5_a7_a_malformed_identity_or_revision_is_not_a_person(over):
    with pytest.raises(ValueError):
        age.person_from_raw(_raw(**over))


def test_r5_a7_bool_bookkeeping_revisions_are_not_integers():
    row = {"enabled": True, "allowed_locks": [1], "desired_revision": True, "applied_revision": True, "sync_state": "synced"}
    assert age.person_from_raw(_raw(assignments={"st-a": row})).stations_synced is None


def test_r5_a7_no_enabled_assignment_is_no_evidence_not_synced():
    p = age.person_from_raw(_raw(assignments={}))
    assert p.doors_known is True and p.doors == {} and p.stations_synced is None
    off = {"enabled": False, "allowed_locks": [1], "desired_revision": 4, "applied_revision": 4, "sync_state": "synced"}
    assert age.person_from_raw(_raw(assignments={"st-a": off})).stations_synced is None


@pytest.mark.parametrize("assignments", [
    {"st-a": "enabled"},
    {"st-a": {"enabled": "yes", "allowed_locks": [1]}},
    {"st-a": {"enabled": True, "allowed_locks": [1, True]}},
    {"st-a": {"enabled": True, "allowed_locks": "1"}},
    {"st-a": {"enabled": True, "allowed_locks": [1]}, 7: {"enabled": True, "allowed_locks": [2]}},
])
def test_r5_a7_a_malformed_assignment_row_makes_the_door_map_unknown(assignments):
    p = age.person_from_raw(_raw(assignments=assignments))
    assert p.doors_known is False and p.doors == {} and p.stations_synced is None


@pytest.mark.parametrize("over", [{"permission_overrides": {"st-b": "maybe"}}, {"permission_overrides": {"st-b": None}}, {"group_ids": ["g", 3]}])
def test_r5_a7_malformed_overrides_or_groups_make_the_access_unknown(over):
    p = age.person_from_raw(_raw(**over))
    assert p.doors_known is False


def test_r5_a7_a_malformed_row_is_never_revoke_proof(env):
    gid = env.active_grant(doors={"st-a": [1]})
    original = env.engine._raw

    def raw(p):
        out = original(p)
        out["assignments"]["st-x"] = "garbage"  # a row the parser cannot read: the map shrinks unless it fails closed
        return out

    env.engine._raw = raw
    assert env.post(f"/access-grants/{gid}/revoke").status_code == 200
    env.run()
    assert env.grant(gid)["state"] == "revoking", "a malformed readback proves nothing"
