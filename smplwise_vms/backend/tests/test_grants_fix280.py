"""GRANTS-FIX280 (FAKES ONLY): the Fable review of the access-grants worker (private planning note of 2026-10-18, "SAFE AFTER FIXES"),
fixes F2, F3, F4 and F6. F1 and F5 are on pilot/WISKEYADAPT280, not here.

- F2 (H3): `needs_push` is cleared only by a compare-and-set on the revision the pass read, and only after a fresh read shows exactly the
  pushed scope; a narrowing the read cannot prove (a per-station merge kept a dropped station, or the record carries no door map) revokes
  the whole grant (fail closed) and is never audited `pushed`.
- F3 (H4): no approval and no provisioning onto a WisKey person Arx did not create (`origin = 'matched'`): 409 `access_person_not_ours`;
  a link matched after the approval fails the grant without any write to that person.
- F4 (M6): one process runs the worker - an exclusive OS lock beside the database; a second process stays in standby and does nothing.
- F6 (M7): the vendor page of one ticket never amends a live grant that belongs to another ticket / assignment (409 `arrival_other_ticket`).

Nothing here contacts WisKey, a station, a door or WhatsApp (tests/fake_wiskey.py)."""
from __future__ import annotations

import json
from dataclasses import replace

import pytest
from test_access_arrival import Arrival
from test_access_grants import APPROVER, VF, VU, Env

from smplwise.db import Database, new_id
from smplwise.services import access_grants as ag
from smplwise.services.access_grant_engine import KEEP


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
        rows = conn.execute("SELECT details_json FROM audit_log WHERE action = ? AND resource_id = ? ORDER BY rowid", (action, gid)).fetchall()
    return [json.loads(r[0] or "{}") for r in rows]


# ================================================================ F2 - narrowing: proof by readback, CAS on needs_push


def _merge_per_station(engine) -> None:
    """WisKey semantics NOT confirmed (review H3): `door_permissions` on update MERGES per station - a station left out stays granted."""
    original = engine.apply

    def apply(person_id, revision, *, doors, valid_from, valid_until, timing, active, pin=KEEP, **kw):
        kept = {k: list(v) for k, v in engine.people[person_id]["doors"].items()}
        out = original(person_id, revision, doors=doors, valid_from=valid_from, valid_until=valid_until, timing=timing, active=active, pin=pin, **kw)
        engine.people[person_id]["doors"] = {**kept, **{k: list(v) for k, v in doors.items()}}
        return engine._view(engine.people[person_id])

    engine.apply = apply


def test_a_narrowing_wiskey_merged_is_not_reported_pushed_and_revokes_the_grant(env):
    gid = env.active_grant(doors={"st-a": [1], "st-b": [1]})
    _merge_per_station(env.engine)
    r = env.request(doors={"st-a": [1]})
    assert r.status_code == 200 and r.json()["outcome"] == "merged"
    env.run()
    g = env.grant(gid)
    assert (g["state"], g["end_reason"]) == ("revoking", "station_changed"), "the dropped station is still in WisKey: fail closed"
    assert [a.get("kind") for a in audits(env, "access.grant.amend", gid)].count("pushed") == 0
    assert any(a.get("kind") == "push_unproven" for a in audits(env, "access.grant.amend", gid))
    env.run()
    g = env.grant(gid)
    assert (g["state"], g["end_reason"]) == ("revoked", "station_changed")
    assert env.person_of(gid)["doors"] == {} and env.person_of(gid)["pin"] is None


def test_a_narrowing_whose_readback_carries_no_door_map_is_not_proven(env):
    gid = env.active_grant(doors={"st-a": [1], "st-b": [1]})
    original = env.engine.get_person
    env.engine.get_person = lambda pid: replace(original(pid), doors={})  # ManagedUser.public: no door_permissions in the record
    env.request(doors={"st-a": [1]})
    env.run()
    g = env.grant(gid)
    assert (g["state"], g["end_reason"]) == ("revoking", "station_changed")
    assert not any(a.get("kind") == "pushed" for a in audits(env, "access.grant.amend", gid))


def test_a_narrowing_with_replace_semantics_is_pushed_only_after_the_readback(env):
    gid = env.active_grant(doors={"st-a": [1], "st-b": [1]})
    calls0 = len(env.engine.calls)
    env.request(doors={"st-a": [1]})
    env.run()
    g = env.grant(gid)
    assert g["state"] == "active" and g["needs_push"] == 0 and env.person_of(gid)["doors"] == {"st-a": [1]}
    assert env.engine.calls[calls0:] == ["get_person", "apply", "get_person"], "write, then a FRESH read"
    pushed = [a for a in audits(env, "access.grant.amend", gid) if a.get("kind") == "pushed"]
    assert len(pushed) == 1 and pushed[0].get("readback") is True


def test_a_second_narrowing_that_lands_while_the_first_push_is_out_is_not_lost(env):
    gid = env.active_grant(doors={"st-a": [1, 2], "st-b": [1]})
    env.request(doors={"st-a": [1, 2]})
    assert env.grant(gid)["needs_push"] == 1
    original = env.engine.apply
    fired = []

    def apply(*a, **kw):
        out = original(*a, **kw)
        if not fired:  # while the first push is out, a second narrowing commits in Arx (revision moves, needs_push already 1)
            fired.append(1)
            env.request(doors={"st-a": [1]})
        return out

    env.engine.apply = apply
    env.run()
    g = env.grant(gid)
    assert json.loads(g["doors_json"]) == {"st-a": [1]} and g["needs_push"] == 1, "the CAS failed: the row still asks for a push"
    assert env.person_of(gid)["doors"] == {"st-a": [1, 2]}, "WisKey holds the first (wider) map for now"
    assert any(a.get("kind") == "push_superseded" for a in audits(env, "access.grant.amend", gid))
    env.run()
    g = env.grant(gid)
    assert g["state"] == "active" and g["needs_push"] == 0 and env.person_of(gid)["doors"] == {"st-a": [1]}


def test_a_readback_that_fails_after_the_push_keeps_needs_push_for_the_next_pass(env):
    gid = env.active_grant(doors={"st-a": [1], "st-b": [1]})
    env.request(doors={"st-a": [1]})
    original = env.engine.get_person
    seen = []

    def get_person(pid):
        seen.append(pid)
        if len(seen) == 2:  # the read AFTER the write
            env.engine.fail["get_person"] = "not_sent"
        return original(pid)

    env.engine.get_person = get_person
    env.run()
    g = env.grant(gid)
    assert g["state"] == "active" and g["needs_push"] == 1
    env.run()
    assert env.grant(gid)["needs_push"] == 0


# ================================================================ F3 - only a person Arx created


def _match(env, person_id: str = "wk-staff") -> None:
    env.engine.add_person(person_id, stations=["st-a"], doors={"st-a": [1, 2]})
    env.engine.people[person_id]["pin"] = "OWN-PIN-SENTINEL"
    r = env.post("/access-grants/links", {"contact_id": env.tech, "wiskey_person_id": person_id})
    assert r.status_code == 200, r.text


def test_approval_onto_a_matched_wiskey_person_is_refused_and_nothing_is_written(env):
    _match(env)
    gid = env.request(doors={"st-a": [1]}).json()["grant"]["id"]
    r = env.approve(gid)
    assert r.status_code == 409 and r.json()["code"] == "access_person_not_ours", r.text
    assert env.grant(gid)["state"] == "requested"
    env.run()
    assert "apply" not in env.engine.calls and "strip" not in env.engine.calls
    p = env.engine.people["wk-staff"]
    assert p["pin"] == "OWN-PIN-SENTINEL" and p["doors"] == {"st-a": [1, 2]} and p["active"] is True


def test_the_approver_still_needs_authority_before_the_origin_is_answered(env):
    env.engine.add_person("wk-9", stations=["st-z"])
    env.post("/access-grants/links", {"contact_id": env.tech, "wiskey_person_id": "wk-9"})
    rid = env.role("מאשר א", APPROVER)
    from conftest import bind

    bind(env.c, env.settings, "appr", rid, "access_control_station", "st-a")
    gid = env.request(doors={"st-a": [1]}).json()["grant"]["id"]
    r = env.approve(gid, user="appr")
    assert r.status_code == 403 and r.json()["details"]["target_id"] == "st-z"


def test_a_link_matched_after_the_approval_fails_the_grant_without_touching_the_person(env):
    gid = env.request(doors={"st-a": [1]}).json()["grant"]["id"]
    assert env.approve(gid).status_code == 200
    _match(env)
    assert env.grant(gid)["link_id"], "match_link attaches the approved grant to the matched person"
    env.run()
    g = env.grant(gid)
    assert (g["state"], g["end_reason"], g["pushed"]) == ("failed", "failed", 0)
    assert "apply" not in env.engine.calls and "strip" not in env.engine.calls
    p = env.engine.people["wk-staff"]
    assert p["pin"] == "OWN-PIN-SENTINEL" and p["doors"] == {"st-a": [1, 2]} and p["active"] is True
    with env.db.connection(mode="read") as conn:
        reasons = [r[0] for r in conn.execute("SELECT reason FROM audit_log WHERE action = 'access.grant.fail' AND resource_id = ?", (gid,)).fetchall()]
    assert "person_not_ours" in reasons


def test_provision_now_on_a_matched_person_is_refused_the_same_way(env):
    gid = env.request(doors={"st-a": [1]}).json()["grant"]["id"]
    assert env.approve(gid).status_code == 200
    _match(env)
    r = env.post(f"/access-grants/{gid}/provision-now")
    assert r.status_code == 200, r.text
    assert env.grant(gid)["state"] == "failed" and "apply" not in env.engine.calls


# ================================================================ F4 - one process runs the worker


def test_a_second_process_cannot_take_the_worker_and_runs_nothing(env):
    owner, second = ag.Worker(), ag.Worker()
    assert owner._take_lease(env.db) is True
    try:
        gid = env.request().json()["grant"]["id"]
        assert env.approve(gid).status_code == 200
        env.sql("UPDATE access_grants SET code_state = 'queued' WHERE id = ?", gid)
        second.start(Database(env.db.path), env.settings)
        assert second.standby is True and second._thread is None, "no thread in the second process"
        assert env.grant(gid)["code_state"] == "queued", "the start-up rewrite is the owner's alone"
        assert second.run_once(env.db) == {"redecided": 0, "reconciled": 0, "ended": 0, "provisioned": 0, "revoked": 0, "codes": 0}
        second.run_grant(env.db, gid)
        assert env.grant(gid)["state"] == "approved" and env.engine.calls == [], "no WisKey call from the standby process"
    finally:
        owner._drop_lease()
    assert second._take_lease(env.db) is True, "the lock is free once the owner is gone"
    second._drop_lease()


# ================================================================ F6 - the vendor page never amends another ticket's grant


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
def test_the_vendor_page_refuses_to_amend_a_grant_of_another_ticket(arr, kind):
    if kind == "other_assignment":
        gid = _live_grant(arr, assignment_id="asg-of-ticket-a", source_ref="ticket-a", source_kind="rfq_order")
    elif kind == "other_ticket_level":
        gid = _live_grant(arr, assignment_id=None, source_ref="ticket-a", source_kind="ticket")
    else:
        gid = _live_grant(arr, assignment_id=None, source_ref=None, source_kind="manual")
    before = _row(arr, gid)
    r = arr.post()  # a narrower window than the live grant: before F6 it merged at once into the other ticket's grant
    assert r.status_code == 409 and "arrival_other_ticket" in r.text, r.text
    after = _row(arr, gid)
    assert (after["revision"], after["valid_from"], after["valid_until"], after["pending_json"]) == (
        before["revision"], before["valid_from"], before["valid_until"], before["pending_json"])
    with arr.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM access_grant_notices WHERE grant_id = ?", (gid,)).fetchone()[0] == 0, "rolled back"
    assert arr.engine.calls == [] and arr.transport.sent == []


def test_the_vendor_page_still_amends_a_grant_of_its_own_ticket(arr):
    gid = _live_grant(arr, assignment_id=None, source_ref=arr.ticket_id, source_kind="ticket")
    r = arr.post()
    assert r.status_code == 200 and r.json()["outcome"] in ("merged", "widening"), r.text  # same assignment: test_access_arrival
    assert _row(arr, gid)["revision"] > 1
