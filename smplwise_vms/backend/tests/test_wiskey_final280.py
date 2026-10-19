"""WISKEYFINAL-280 (FAKES ONLY): the composed grants worker - the round-3 worker (pilot/WISKEYR3-280) plus the intent of GRANTS-FIX280
(F2, F3, F4, F6; ported, not merged) and the fixes of WisKey round 4 (R4-03 .. R4-09, R4-13; `private/planning/wiskey_reply4_answer_2026-10-19/`,
WisKey's STATIC review - PROPOSED, NOT_RUN against any WisKey, station or door).

Nothing here contacts WisKey, Home Assistant, a station, a door or WhatsApp: the engine is tests/fake_wiskey.FakeAccessEngine, the sync
layer runs on a private event loop with a fake send, the clock is injected."""
from __future__ import annotations

import asyncio
import json
import threading
import time
from dataclasses import replace
from types import SimpleNamespace
from typing import Any

import pytest
from test_access_arrival import Arrival
from test_access_grants import APPROVER, VF, VU, Env

from smplwise.db import Database, new_id
from smplwise.errors import ApiError
from smplwise.services import access_grant_engine as age
from smplwise.services import access_grants as ag
from smplwise.services import intercom_adapter, intercom_authority, intercom_sync, wiskey_channels
from smplwise.services.access_grant_engine import KEEP, EngineError, EnginePerson, WiskeyServiceEngine
from smplwise.services.intercom_client import IntercomError


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


# ================================================================ F2 / R4-04: narrowing proven by a fresh read of the COMPLETE scope, CAS


def _merge_per_station(engine) -> None:
    """WisKey semantics NOT assumed (review H3): an update that MERGES per station - a station left out stays granted."""
    original = engine.apply

    def apply(person_id, revision, *, doors, valid_from, valid_until, timing, active, pin=KEEP, **kw):
        kept = {k: list(v) for k, v in engine.people[person_id]["doors"].items()}
        original(person_id, revision, doors=doors, valid_from=valid_from, valid_until=valid_until, timing=timing, active=active, pin=pin, **kw)
        engine.people[person_id]["doors"] = {**kept, **{k: list(v) for k, v in doors.items()}}
        return engine._view(engine.people[person_id])

    engine.apply = apply


def test_f2_a_merged_narrowing_is_never_pushed_and_revokes_the_grant(env):
    gid = env.active_grant(doors={"st-a": [1], "st-b": [1]})
    _merge_per_station(env.engine)
    r = env.request(doors={"st-a": [1]})
    assert r.status_code == 200 and r.json()["outcome"] == "merged"
    env.run()
    g = env.grant(gid)
    assert (g["state"], g["end_reason"]) == ("revoking", "station_changed")
    kinds = [a.get("kind") for a in audits(env, "access.grant.amend", gid)]
    assert "pushed" not in kinds and "push_unproven" in kinds
    env.run()
    assert (env.grant(gid)["state"], env.person_of(gid)["doors"], env.person_of(gid)["pin"]) == ("revoked", {}, None)


def test_f2_r4_04_a_readback_without_a_readable_door_map_proves_nothing(env):
    gid = env.active_grant(doors={"st-a": [1], "st-b": [1]})
    original = env.engine.apply

    def apply(*a, **kw):
        out = original(*a, **kw)
        env.engine.hide_doors = True  # the record after the write is a restricted projection: doors_known False
        return out

    env.engine.apply = apply
    env.request(doors={"st-a": [1]})
    env.run()
    g = env.grant(gid)
    assert (g["state"], g["end_reason"]) == ("revoking", "station_changed")
    unproven = [a for a in audits(env, "access.grant.amend", gid) if a.get("kind") == "push_unproven"]
    assert unproven and unproven[0]["doors_known"] is False


def test_f2_a_narrowing_is_pushed_only_after_a_fresh_read(env):
    gid = env.active_grant(doors={"st-a": [1], "st-b": [1]})
    calls0 = len(env.engine.calls)
    env.request(doors={"st-a": [1]})
    env.run()
    g = env.grant(gid)
    assert g["state"] == "active" and g["needs_push"] == 0 and env.person_of(gid)["doors"] == {"st-a": [1]}
    assert env.engine.calls[calls0:] == ["get_person", "apply", "get_person"], "read, write, then a FRESH read"
    pushed = [a for a in audits(env, "access.grant.amend", gid) if a.get("kind") == "pushed"]
    assert len(pushed) == 1 and pushed[0]["readback"] is True and pushed[0]["central_only"] is True and pushed[0]["stations_synced"] is True


def test_f2_a_second_narrowing_during_the_push_is_not_lost(env):
    gid = env.active_grant(doors={"st-a": [1, 2], "st-b": [1]})
    env.request(doors={"st-a": [1, 2]})
    original = env.engine.apply
    fired: list[int] = []

    def apply(*a, **kw):
        out = original(*a, **kw)
        if not fired:
            fired.append(1)
            env.request(doors={"st-a": [1]})  # commits in Arx while the first push is out
        return out

    env.engine.apply = apply
    env.run()
    g = env.grant(gid)
    assert json.loads(g["doors_json"]) == {"st-a": [1]} and g["needs_push"] == 1, "the CAS failed: the row still asks for a push"
    assert any(a.get("kind") == "push_superseded" for a in audits(env, "access.grant.amend", gid))
    env.run()
    g = env.grant(gid)
    assert g["state"] == "active" and g["needs_push"] == 0 and env.person_of(gid)["doors"] == {"st-a": [1]}


def test_r4_04_a_failed_readback_is_reconciled_before_any_second_write(env):
    gid = env.active_grant(doors={"st-a": [1], "st-b": [1]})
    env.request(doors={"st-a": [1]})
    original = env.engine.get_person
    seen: list[str] = []

    def get_person(pid):
        seen.append(pid)
        if len(seen) == 2:  # the read AFTER the write fails
            env.engine.fail["get_person"] = "not_sent"
        return original(pid)

    env.engine.get_person = get_person
    env.run()
    assert env.grant(gid)["needs_push"] == 1
    calls0 = len(env.engine.calls)
    env.run()
    assert env.grant(gid)["needs_push"] == 0
    assert env.engine.calls[calls0:] == ["get_person"], "the scope is already there: proven by the read, not written again"
    pushed = [a for a in audits(env, "access.grant.amend", gid) if a.get("kind") == "pushed"]
    assert pushed[-1]["written"] is False


def _person(**over: Any) -> EnginePerson:
    base = dict(id="p", revision=2, active=True, valid_from=VF, valid_until=VU, doors={"st-a": [1]}, doors_known=True, timing=None)
    # WISKEYFINAL2-281 (R5-A2): a person record carries its whole timing policy; this helper builds the one a grant push writes
    base["timing_policy"] = age.requested_policy(over.get("timing"))
    return EnginePerson(**{**base, **over})


def _scope(**over: Any) -> ag.Scope:
    base = dict(doors={"st-a": [1]}, valid_from=VF, valid_until=VU, timing=None, credential="pin")
    return ag.Scope(**{**base, **over})


TIMING = {"mode": "weekly", "timezone": "Asia/Jerusalem", "days": ["Thursday"], "periods": [{"start": "08:00", "end": "12:00"}]}


def test_r4_04_the_predicate_is_the_complete_scope_and_fails_closed():
    assert ag.scope_proven(_person(), _scope()) is True
    assert ag.scope_proven(_person(), _scope(timing=TIMING)) is False, "a timing-only narrowing WisKey did not take is not proven"
    assert ag.scope_proven(_person(timing=TIMING), _scope(timing=TIMING)) is True
    assert ag.scope_proven(_person(doors_known=False), _scope()) is False
    assert ag.scope_proven(_person(doors={"st-a": [1, 2]}), _scope()) is False
    assert ag.scope_proven(_person(group_ids=("g1",)), _scope()) is False, "a group adds doors the map does not show"
    assert ag.scope_proven(_person(active=False), _scope()) is False
    assert ag.scope_proven(_person(valid_until="2026-10-23T14:00:00Z"), _scope()) is False
    legacy = SimpleNamespace(id="p", revision=1, active=True, valid_from=VF, valid_until=VU, doors={"st-a": [1]}, group_ids=(), timing=None)
    assert ag.scope_proven(legacy, _scope()) is False, "an absent completeness flag is NOT 'carried' (fail closed)"


def test_r4_04_station_application_is_reported_beside_the_central_proof_never_as_it():
    raw = {"id": "u", "revision": 4, "active": True, "group_ids": [], "permission_overrides": {}, "pin_configured": False,
           "assignments": {"st-a": {"enabled": True, "allowed_locks": [1], "desired_revision": 4, "applied_revision": 3, "sync_state": "pending"}}}
    p = age.person_from_raw(raw)
    assert p.doors_known is True and p.stations_synced is False
    raw["assignments"]["st-a"].update(applied_revision=4, sync_state="synced")
    assert age.person_from_raw(raw).stations_synced is True
    assert age.person_from_raw({**raw, "redacted_fields": ["access"]}).stations_synced is None


# ================================================================ R4-03: an unknown outcome is settled against the CURRENT scope (CAS)


def _unknown_grant(env, doors: dict) -> str:
    gid = env.request(doors=doors).json()["grant"]["id"]
    assert env.approve(gid).status_code == 200
    env.engine.unknown_after_apply = True  # the provisioning write LANDS (scope A), the answer is lost
    env.run()
    assert env.grant(gid)["state"] == "unknown"
    return gid


def test_r4_03_a_narrowing_during_the_settling_read_never_activates_the_old_scope(env):
    gid = _unknown_grant(env, {"st-a": [1], "st-b": [1]})
    original = env.engine.get_person
    fired: list[int] = []

    def get_person(pid):
        out = original(pid)
        if not fired:  # while resolve_unknown's read of scope A is out, an HTTP request narrows the still-unknown row to B
            fired.append(1)
            r = env.request(doors={"st-a": [1]})
            assert r.status_code == 200 and r.json()["outcome"] == "merged", r.text
        return out

    env.engine.get_person = get_person
    env.run()
    g = env.grant(gid)
    assert g["state"] == "unknown" and g["needs_push"] == 1, "the row moved: nothing decided on the stale read"
    assert any(a["_reason"] == "scope_moved" for a in audits(env, "access.grant.unknown", gid))
    env.run()  # a fresh read: WisKey still holds A (broader than B) - active, but only with the narrowing still to push
    g = env.grant(gid)
    assert (g["state"], g["needs_push"]) == ("active", 1)
    assert env.person_of(gid)["doors"] == {"st-a": [1], "st-b": [1]}
    env.run()
    g = env.grant(gid)
    assert (g["state"], g["needs_push"]) == ("active", 0) and env.person_of(gid)["doors"] == {"st-a": [1]}, "B written and proven"


def test_r4_03_a_read_that_proves_neither_scope_fails_the_grant(env):
    gid = _unknown_grant(env, {"st-a": [1]})
    env.engine.people[env.person_of(gid)["id"]]["doors"] = {"st-z": [1]}  # someone else's map: neither scope
    env.run()
    assert env.grant(gid)["state"] in ("revoking", "revoked", "failed")
    assert not any(a.get("after") == "unknown" for a in audits(env, "access.grant.activate", gid))


def test_r4_03_the_timing_counts_in_the_settlement(env):
    gid = _unknown_grant(env, {"st-a": [1]})
    env.engine.people[env.person_of(gid)["id"]]["timing"] = TIMING  # same doors and window, another schedule
    env.run()
    assert env.grant(gid)["state"] != "active"


# ================================================================ F3: approval / provisioning only onto a person Arx created


def _match(env, person_id: str = "wk-staff") -> None:
    env.engine.add_person(person_id, stations=["st-a"], doors={"st-a": [1, 2]})
    env.engine.people[person_id]["pin"] = "OWN-PIN-SENTINEL"
    r = env.post("/access-grants/links", {"contact_id": env.tech, "wiskey_person_id": person_id})
    assert r.status_code == 200, r.text


def _untouched(env, person_id: str = "wk-staff") -> None:
    assert not {"apply", "strip", "pin_generate"} & set(env.engine.calls)
    p = env.engine.people[person_id]
    assert p["pin"] == "OWN-PIN-SENTINEL" and p["doors"] == {"st-a": [1, 2]} and p["active"] is True


def test_f3_approval_onto_a_matched_person_is_refused(env):
    _match(env)
    gid = env.request(doors={"st-a": [1]}).json()["grant"]["id"]
    r = env.approve(gid)
    assert r.status_code == 409 and r.json()["code"] == "access_person_not_ours", r.text
    env.run()
    assert env.grant(gid)["state"] == "requested"
    _untouched(env)


def test_f3_authority_is_answered_before_the_origin(env):
    env.engine.add_person("wk-9", stations=["st-z"])
    env.post("/access-grants/links", {"contact_id": env.tech, "wiskey_person_id": "wk-9"})
    rid = env.role("מאשר א", APPROVER)
    from conftest import bind

    bind(env.c, env.settings, "appr", rid, "access_control_station", "st-a")
    gid = env.request(doors={"st-a": [1]}).json()["grant"]["id"]
    r = env.approve(gid, user="appr")
    assert r.status_code == 403 and r.json()["details"]["target_id"] == "st-z"


def test_f3_a_link_matched_after_the_approval_fails_the_grant_without_a_write(env):
    gid = env.request(doors={"st-a": [1]}).json()["grant"]["id"]
    assert env.approve(gid).status_code == 200
    _match(env)
    env.run()
    g = env.grant(gid)
    assert (g["state"], g["end_reason"], g["pushed"]) == ("failed", "failed", 0)
    _untouched(env)
    assert any(a["_reason"] == "person_not_ours" for a in audits(env, "access.grant.fail", gid))


def test_f3_provision_now_on_a_matched_person_fails_the_same_way(env):
    gid = env.request(doors={"st-a": [1]}).json()["grant"]["id"]
    assert env.approve(gid).status_code == 200
    _match(env)
    assert env.post(f"/access-grants/{gid}/provision-now").status_code == 200
    assert env.grant(gid)["state"] == "failed"
    _untouched(env)


# ================================================================ R4-05: the origin guard at every later write


def _rematch(env, gid: str) -> str:
    """An existing grant whose link is (now) a matched one - the older behaviour, or a link changed later."""
    pid = env.person_of(gid)["id"]
    env.sql("UPDATE access_person_links SET origin = 'matched' WHERE wiskey_person_id = ?", pid)
    env.engine.calls.clear()
    return pid


def test_r4_05_no_narrowing_and_no_strip_through_a_matched_link(env):
    gid = env.active_grant(doors={"st-a": [1], "st-b": [1]})
    pid = _rematch(env, gid)
    before = dict(env.engine.people[pid])
    env.request(doors={"st-a": [1]})
    env.run()
    g = env.grant(gid)
    assert g["state"] == "revoking", "the authority is withdrawn in Arx"
    env.clock[0] = env.clock[0] + ag.timedelta(hours=1)
    env.run()
    g = env.grant(gid)
    assert g["state"] == "revoking", "never 'revoked' without a strip - the managers reconcile the matched person by hand"
    assert not {"apply", "strip"} & set(env.engine.calls)
    assert env.engine.people[pid]["doors"] == before["doors"] and env.engine.people[pid]["active"] is True
    assert any(a.get("code") == "person_not_ours" for a in audits(env, "access.grant.revoke_retry", gid))


def test_r4_05_no_code_is_written_to_a_matched_person(env):
    gid = env.active_grant(doors={"st-a": [1]})
    pid = _rematch(env, gid)
    env.clock[0] = ag.parse_iso(env.grant(gid)["code_due_at"])
    env.run()
    assert env.grant(gid)["state"] == "revoking"
    assert not {"pin_generate", "apply", "strip"} & set(env.engine.calls) and env.transport.sent == []
    assert env.engine.people[pid]["pin"] is None


def test_r4_05_an_unknown_outcome_on_a_matched_link_is_never_activated(env):
    gid = _unknown_grant(env, {"st-a": [1]})
    _rematch(env, gid)
    env.run()
    assert env.grant(gid)["state"] == "revoking" and "get_person" not in env.engine.calls


# ================================================================ F4 / R4-06: one process, and never two writers


def test_f4_a_second_process_cannot_take_the_worker_and_runs_nothing(env):
    owner, second = ag.Worker(), ag.Worker()
    assert owner._take_lease(env.db) is True
    try:
        gid = env.request().json()["grant"]["id"]
        assert env.approve(gid).status_code == 200
        env.sql("UPDATE access_grants SET code_state = 'queued' WHERE id = ?", gid)
        second.start(Database(env.db.path), env.settings)
        assert second.standby is True and not second.holds_lease()
        assert env.grant(gid)["code_state"] == "queued", "the start-up rewrite is the owner's alone"
        assert second.run_once(env.db)["provisioned"] == 0
        second.run_grant(env.db, gid)
        assert env.grant(gid)["state"] == "approved" and env.engine.calls == [], "no WisKey call from a process without the lease"
    finally:
        owner._drop_lease()
    second.run_once(env.db)  # the owner is gone: the standby process takes over (and only now does the start-up rewrite)
    try:
        assert second.holds_lease() and second.standby is False
        assert env.grant(gid)["state"] == "active" and env.grant(gid)["code_state"] == "not_delivered"
    finally:
        second.stop()
    assert not second.holds_lease()


def test_r4_06_stop_keeps_the_lease_while_a_pass_may_still_write(env, monkeypatch):
    monkeypatch.setattr(ag.Worker, "STOP_WAIT_S", 0.2)
    owner, other = ag.Worker(), ag.Worker()
    gid = env.request().json()["grant"]["id"]
    assert env.approve(gid).status_code == 200
    inside, release = threading.Event(), threading.Event()
    original = env.engine.get_person

    def slow_get(pid):
        inside.set()
        release.wait(10)  # a WisKey call that outlives the bounded shutdown wait
        return original(pid)

    env.engine.get_person = slow_get
    t = threading.Thread(target=owner.run_once, args=(env.db,))
    t.start()
    try:
        assert inside.wait(10)
        owner.stop()
        assert owner.holds_lease(), "the pass is still out: the lease is NOT handed over"
        assert other._take_lease(env.db) is False
    finally:
        release.set()
        t.join(10)
    assert not owner.holds_lease(), "the pass ended: only now is the lease given up"
    assert other._take_lease(env.db) is True
    other._drop_lease()


def test_r4_06_every_entry_point_needs_the_lease(env):
    holder, worker = ag.Worker(), ag.Worker()
    gid = env.request().json()["grant"]["id"]
    assert env.approve(gid).status_code == 200
    assert holder._take_lease(env.db)
    try:
        worker.run_grant(env.db, gid)
        assert worker.run_once(env.db) == {"redecided": 0, "reconciled": 0, "ended": 0, "provisioned": 0, "revoked": 0, "codes": 0}
        assert env.engine.calls == [] and env.grant(gid)["state"] == "approved"
    finally:
        holder._drop_lease()
    assert ag.Worker.lock_path(env.db) == ag.Worker.lock_path(Database(env.db.path)), "one canonical lock path"


# ================================================================ F6: the vendor page never amends another ticket's grant


def _live_grant(arr, *, assignment_id: str | None, source_ref: str | None, source_kind: str) -> str:
    gid = new_id()
    at = ag.iso(ag.now())
    with arr.db.connection() as conn:
        conn.execute("""INSERT INTO access_grants(id, subject_kind, subject_id, source_kind, source_ref, assignment_id, doors_json, valid_from, valid_until,
                        credential, state, requested_by, code_state, created_at, updated_at) VALUES (?, 'contact', ?, ?, ?, ?, '{"st-a": [1]}', ?, ?, 'pin',
                        'approved', 'dev-joni', 'pending', ?, ?)""",
                     (gid, arr.tech, source_kind, source_ref, assignment_id, f"{arr.day(2)}T05:00:00Z", f"{arr.day(9)}T14:00:00Z", at, at))
    return gid


def _row(arr, gid: str) -> dict:
    with arr.db.connection(mode="read") as conn:
        return dict(conn.execute("SELECT * FROM access_grants WHERE id = ?", (gid,)).fetchone())


@pytest.mark.parametrize("kind", ["other_assignment", "other_ticket_level", "manual"])
def test_f6_the_vendor_page_refuses_to_amend_another_tickets_grant(arr, kind):
    if kind == "other_assignment":
        gid = _live_grant(arr, assignment_id="asg-of-ticket-a", source_ref="ticket-a", source_kind="rfq_order")
    elif kind == "other_ticket_level":
        gid = _live_grant(arr, assignment_id=None, source_ref="ticket-a", source_kind="ticket")
    else:
        gid = _live_grant(arr, assignment_id=None, source_ref=None, source_kind="manual")
    before = _row(arr, gid)
    r = arr.post()
    assert r.status_code == 409 and "arrival_other_ticket" in r.text, r.text
    after = _row(arr, gid)
    assert (after["revision"], after["valid_from"], after["valid_until"], after["pending_json"]) == (
        before["revision"], before["valid_from"], before["valid_until"], before["pending_json"])
    assert arr.engine.calls == [] and arr.transport.sent == []


def test_f6_the_vendor_page_still_amends_its_own_tickets_grant(arr):
    gid = _live_grant(arr, assignment_id=None, source_ref=arr.ticket_id, source_kind="ticket")
    r = arr.post()
    assert r.status_code == 200 and r.json()["outcome"] in ("merged", "widening"), r.text
    assert _row(arr, gid)["revision"] > 1


# ================================================================ R4-07: atomic admission per person target, target on every caller


class _Loop:
    def __init__(self) -> None:
        self.loop = asyncio.new_event_loop()
        self.thread = threading.Thread(target=self.loop.run_forever, daemon=True)
        self.thread.start()

    def close(self) -> None:
        self.loop.call_soon_threadsafe(self.loop.stop)
        self.thread.join(5)


@pytest.fixture()
def live_sync(monkeypatch):
    s = intercom_sync.IntercomSync()
    lp = _Loop()
    s._event_loop = lp.loop
    s._call = object()
    monkeypatch.setattr(intercom_sync.ha_client, "configured", lambda _settings: True)
    monkeypatch.setattr(intercom_sync.STATE, "state", "ready")

    async def one_off(send, not_after, channel):
        return await send(None)

    monkeypatch.setattr(s, "_one_off", one_off)
    yield s
    lp.close()


def test_r4_07_a_second_write_to_the_same_person_is_never_admitted_while_the_first_is_out(live_sync):
    target = intercom_sync.person_target("u1")
    gate = threading.Event()
    sent: list[str] = []

    def writer(tag: str):
        async def send(_call):
            sent.append(tag)
            while not gate.is_set():
                await asyncio.sleep(0.01)
            return {"id": "u1", "revision": 2}
        return send

    first: dict[str, Any] = {}
    t = threading.Thread(target=lambda: first.update(r=live_sync.action(None, "person", writer("first"), lambda raw: raw, "w", lane="config", target=target, free=True)))
    t.start()
    try:
        deadline = time.monotonic() + 5
        while not sent and time.monotonic() < deadline:
            time.sleep(0.01)
        assert sent == ["first"]
        assert live_sync.write_gate(target) == "outcome_pending", "a write in flight blocks the gate (and the engine's readback)"
        with pytest.raises(ApiError) as e:  # even a caller willing to wait for the lane's slot is refused at once
            live_sync.action(None, "person", writer("second"), lambda raw: raw, "w", lane="config", target=target, free=True, slot_wait=2)
        assert e.value.code == "intercom_outcome_pending" and e.value.details["outcome"] == "not_sent"
        assert sent == ["first"], "nothing of the second write was sent"
    finally:
        gate.set()
        t.join(10)
    assert first["r"]["person"]["revision"] == 2 and live_sync.write_gate(target) is None
    live_sync.action(None, "person", writer("third"), lambda raw: raw, "w", lane="config", target=target, free=True)
    assert sent == ["first", "third"]


def test_r4_07_an_admitted_write_that_ends_unknown_keeps_the_target_blocked(live_sync):
    target = intercom_sync.person_target("u2")

    async def unclear(_call):
        from smplwise.services.intercom_client import UnclearAnswer

        raise UnclearAnswer("users/update", "storage_write_failed")

    with pytest.raises(ApiError):
        live_sync.action(None, "person", unclear, lambda raw: raw, "w", lane="config", target=target, free=True)
    assert live_sync.write_gate(target) == "readback_required" and target not in live_sync._writing


def test_r4_07_the_adapter_reload_of_one_person_is_a_targeted_readback(monkeypatch):
    seen: list[Any] = []

    def command(settings, key, send, project, **kw):
        seen.append(kw.get("target"))
        return {"state": "ready", key: None}

    monkeypatch.setattr(intercom_sync.SYNC, "command", command)
    auth = SimpleNamespace(principal=SimpleNamespace(user_id="u"))
    intercom_adapter.IntercomAdapter().person(None, auth, "wk-7", legacy=True)
    assert seen == ["person:wk-7"]


def test_r4_07_the_engine_generates_no_pin_for_a_person_with_an_unsettled_write(monkeypatch):
    monkeypatch.setattr(ag, "GO_LIVE_PERMITTED", True)
    target = intercom_sync.person_target("wk-2")
    sent: list[int] = []
    monkeypatch.setattr(intercom_sync.SYNC, "command", lambda *a, **kw: sent.append(1))
    try:
        with intercom_sync.SYNC._unsettled_lock:
            intercom_sync.SYNC._writing.add(target)
        with pytest.raises(EngineError) as e:
            WiskeyServiceEngine(settings=None).pin_generate("wk-2")
        assert (e.value.kind, e.value.code) == ("not_sent", "outcome_pending") and sent == []
    finally:
        intercom_sync.SYNC.reset()


# ================================================================ R4-08: the frame's own keys cannot be overridden


@pytest.mark.parametrize("kw", [{"type": "hikvision_intercom/users/delete"}, {"id": 99}, {"type": "x", "id": 1}])
def test_r4_08_a_reserved_key_is_refused_before_anything_is_sent(kw):
    sent: list[Any] = []

    async def raw_call(msg_type: str, **kwargs: Any) -> Any:
        sent.append((msg_type, kwargs))
        return {"success": True, "result": {}}

    guarded = wiskey_channels.guard(raw_call, "read")
    with pytest.raises(IntercomError) as e:
        asyncio.run(guarded("hikvision_intercom/users/get", user_id="u1", **kw))
    assert e.value.code == wiskey_channels.RESERVED_KEY and sent == []
    asyncio.run(guarded("hikvision_intercom/users/get", user_id="u1"))
    assert sent == [("hikvision_intercom/users/get", {"user_id": "u1"})]


def test_r4_08_the_transport_serialises_its_own_type_and_id_last():
    import inspect

    from smplwise.services import ha_client

    assert ha_client.RESERVED_FRAME_KEYS == frozenset({"id", "type"})
    src = inspect.getsource(ha_client.ws_session)
    assert '{**kw, "id": mid, "type": msg_type}' in src and "RESERVED_FRAME_KEYS.intersection(kw)" in src


# ================================================================ R4-09: the read adapter keeps the completeness marker


def _raw(**over: Any) -> dict[str, Any]:
    base = {"id": "u1", "revision": 3, "display_name": "Dana", "active": True, "group_ids": [], "permission_overrides": {}, "pin_configured": True,
            "assignments": {"st-a": {"enabled": True, "allowed_locks": [1], "sync_state": "synced"}}}
    return {**base, **over}


@pytest.mark.parametrize("over, stations_known", [
    ({}, True), ({"redacted_fields": []}, False), ({"operator_editable": True}, False), ({"operator_editable": False}, False),
    ({"redacted_fields": ["assignments"]}, False), ({"redacted_fields": "access"}, False),
])
def test_r4_09_the_adapter_projection_uses_the_same_completeness_reading(over, stations_known):
    p = intercom_adapter.project_person(_raw(**over))
    assert p["stations_known"] is stations_known, over
    assert p["stations_known"] == intercom_sync.person_scope(_raw(**over))["stations_known"]
    if over.get("redacted_fields") in (["assignments"], "access"):
        assert p["assignments"] is None and p["access_known"] is False, "withheld, never an empty list"


def test_r4_09_a_partial_view_is_never_marked_complete():
    person = intercom_adapter.project_person(_raw(assignments={"st-a": {"enabled": True, "allowed_locks": [1]},
                                                               "st-b": {"enabled": True, "allowed_locks": [1]}}))
    assert person["stations_known"] is True

    class Auth:
        def __init__(self, sees: set[str]) -> None:
            self.sees = sees

        def person_level(self, ids):
            return intercom_authority.NAMES

        def employee_no_for(self, level):
            return False

        def station(self, perm, sid):
            return sid in self.sees

        def sync_errors(self, sid):
            return False

        def person_editable(self, ids):
            return False

        def unrestricted(self, perm):
            return False

    assert intercom_authority.view_person(Auth({"st-a", "st-b"}), person)["stations_known"] is True
    assert intercom_authority.view_person(Auth({"st-a"}), person)["stations_known"] is False


# ================================================================ R4-13: employee_no is the server's


def test_r4_13_create_omits_employee_no_and_stores_what_wiskey_returns(env):
    seen: list[dict] = []
    original = env.engine.create_person

    def create_person(**kw):
        seen.append(dict(kw))
        return original(**kw)

    env.engine.create_person = create_person
    gid = env.active_grant(doors={"st-a": [1]})
    assert seen and "employee_no" not in seen[0]
    with env.db.connection(mode="read") as conn:
        link = ag.link_row(conn, env.grant(gid)["link_id"])
    assert link["employee_no"] == env.person_of(gid)["employee_no"] and len(link["employee_no"]) == 9 and link["employee_no"].isdigit()
    assert "employee_no" not in age.apply_payload(doors={"st-a": [1]}, valid_from=VF, valid_until=VU, timing=None, active=True), "never sent on update"
    assert "employee_no" not in age.create_payload(display_name="x", category="visitor", responsible_person="r", access_purpose="")


def test_r4_01_the_composed_worker_keeps_the_round_3_protections(env):
    """R4-01: the composition did not drop the round-3 behaviour - user_not_found never ends a revoke, no revoke without the readback AND
    the sync status, a missing person refuses the approval."""
    gid = env.active_grant(doors={"st-a": [1]})
    env.engine.sync_lag = True
    assert env.post(f"/access-grants/{gid}/revoke").status_code == 200
    assert env.grant(gid)["state"] == "revoking", "a pending revocation in the sync status keeps it revoking"
    pid = env.person_of(gid)["id"]
    del env.engine.people[pid]
    env.clock[0] = env.clock[0] + ag.timedelta(minutes=10)
    env.run()
    assert env.grant(gid)["state"] == "revoking", "user_not_found is not proof of cleanup"
