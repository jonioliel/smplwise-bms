"""STATIONPERM-295 (docs/changes/CR-STATION-PERMISSIONS-295.md), FAKES ONLY: a person's access per access-control station.

Nothing here contacts WisKey, a station, a door or a reader: the access engine is tests/fake_wiskey.FakeAccessEngine. The go-live
permit (access_grants.GO_LIVE_PERMITTED) is switched on INSIDE the tests that drive the flow (monkeypatch); the build as shipped keeps it
False and the switch off - the first tests pin exactly that. Real-WisKey checks are NOT_RUN (owner's separate permit)."""
from __future__ import annotations

import json
from pathlib import Path

import pytest
from conftest import as_user, bind
from fake_wiskey import FakeAccessEngine
from fastapi.testclient import TestClient

from smplwise import rbac
from smplwise.db import Database, new_id, now_iso, set_setting
from smplwise.main import create_app
from smplwise.rbac import Principal
from smplwise.services import access_grants as ag
from smplwise.services import access_station_permissions as sp
from smplwise.services.access_grant_engine import EngineError, WiskeyServiceEngine, station_access_payload

API = "/api/v1"
BASE = f"{API}/access-station-permissions"
P = "wk-p1"
NATIVE = {"mode": "native", "schedule": {"timezone": "Asia/Jerusalem", "periods": []}, "bindings": {"st-a": [1]}}


class Env:
    def __init__(self, settings, monkeypatch, *, go_live: bool = True) -> None:
        monkeypatch.setattr(ag, "GO_LIVE_PERMITTED", go_live)
        self.engine = FakeAccessEngine()
        monkeypatch.setattr(ag, "ENGINE_FACTORY", lambda db: self.engine)
        self.settings = settings
        self.c = TestClient(create_app(settings))
        self.c.get(f"{API}/me")  # joni: the bootstrap system administrator
        self.db = Database(settings.db_path)
        if go_live:
            with self.db.connection() as conn:
                set_setting(conn, sp.FLAG_KEY, "on")
        # a staff person: st-a through a group, st-b personally allowed, st-d personally blocked
        self.engine.add_person(P, category="staff", group_doors={"st-a": [1]}, doors={"st-b": [1, 2]}, overrides={"st-b": "allow", "st-d": "deny"})

    def view(self, user: str | None = None):
        return self.c.get(f"{BASE}/people/{P}", headers=as_user(user) if user else None)

    def rev(self, station: str) -> int:
        with self.db.connection(mode="read") as conn:
            row = sp.row_of(conn, P, station)
        return row["revision"] if row else 0

    def row(self, station: str) -> dict | None:
        with self.db.connection(mode="read") as conn:
            return sp.row_of(conn, P, station)

    def put(self, station: str, effect: str, relays=None, user: str | None = None, revision: int | None = None):
        body = {"effect": effect, "revision": self.rev(station) if revision is None else revision}
        if relays is not None:
            body["relays"] = relays
        return self.c.put(f"{BASE}/people/{P}/stations/{station}", json=body, headers=as_user(user) if user else None)

    def post(self, station: str, what: str, user: str | None = None):
        return self.c.post(f"{BASE}/people/{P}/stations/{station}/{what}", json={"revision": max(1, self.rev(station))}, headers=as_user(user) if user else None)

    def role(self, name: str, permissions: list[str], sensitive: list[str]) -> str:
        r = self.c.post(f"{API}/access/roles", json={"name": name, "description": "station permission test", "permissions": permissions, "sensitive": sensitive})
        assert r.status_code == 201, r.text
        return r.json()["id"]

    def audits(self, action_prefix: str = "access.station_permission.") -> list[dict]:
        with self.db.connection(mode="read") as conn:
            return [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action LIKE ? ORDER BY rowid", (action_prefix + "%",)).fetchall()]

    def person(self) -> dict:
        return self.engine.people[P]


@pytest.fixture()
def env(settings, monkeypatch):
    return Env(settings, monkeypatch)


def station_manager(env: Env, user: str, station: str, *, grant: bool) -> None:
    """`user` holds people.read + people.manage (+ people.stations when `grant`) on ONE station only."""
    sens = ["access.people.manage"] + (["access.people.stations"] if grant else [])
    rid = env.role(f"st-{user}-{int(grant)}", ["access.people.read"], sens)
    bind(env.c, env.settings, user, rid, rbac.STATION, station)


# ================================================================ negative first: the build as shipped is OFF


def test_the_switch_cannot_be_turned_on_without_the_owners_go_live_permit(settings, monkeypatch):
    e = Env(settings, monkeypatch, go_live=False)
    assert ag.GO_LIVE_PERMITTED is False
    r = e.c.put(f"{BASE}/settings", json={"station_permissions": "on"})
    assert r.status_code == 409 and r.json()["code"] == "station_permissions_not_permitted", r.text
    assert e.c.get(f"{BASE}/settings").json() == {"station_permissions": "off", "go_live_permitted": False}
    for r in (e.view(), e.put("st-c", "allow", [1]), e.post("st-c", "sync")):
        assert r.status_code == 404 and r.json()["code"] == "station_permissions_off", r.text
    assert e.engine.calls == [] and e.engine.updates == []
    denied = [a for a in e.audits("settings.changed") if a["decision"] == "denied"]
    assert denied and denied[-1]["reason"] == "station_permissions_not_permitted"


def test_a_setting_left_on_does_nothing_without_the_permit(settings, monkeypatch):
    e = Env(settings, monkeypatch, go_live=False)
    with e.db.connection() as conn:
        set_setting(conn, sp.FLAG_KEY, "on")  # e.g. restored from somewhere: still off
        assert sp.enabled(conn) is False
    assert e.view().status_code == 404


def test_the_live_engine_refuses_and_writes_only_the_two_access_fields(monkeypatch):
    monkeypatch.setattr(ag, "GO_LIVE_PERMITTED", False)
    with pytest.raises(EngineError) as exc:
        WiskeyServiceEngine(None).set_station_access("wk-x", 3, overrides={"st-a": "allow"}, doors={"st-a": [1]})
    assert exc.value.kind == "not_permitted"
    data = station_access_payload(overrides={"st-a": "allow", "st-b": "deny"}, doors={"st-a": [2, 1, 1]})
    assert data == {"permission_overrides": {"st-a": "allow", "st-b": "deny"}, "door_permissions": {"st-a": [1, 2]}}
    for bad in ({"overrides": {"st-a": "deny"}, "doors": {"st-a": [1]}}, {"overrides": {"st-a": "allow"}, "doors": {"st-a": [3]}},
                {"overrides": {"st-a": "allow"}, "doors": {"st-a": []}}, {"overrides": {"st-a": "maybe"}, "doors": {}}):
        with pytest.raises(ValueError):
            station_access_payload(**bad)


def test_the_permission_is_catalogued_station_scoped_sensitive_and_held_by_both_admin_roles():
    roles = json.loads((Path(rbac.__file__).parent / "roles.json").read_text(encoding="utf-8"))
    holders = {r["id"] for r in roles["roles"] if sp.PERMISSION in r["permissions"]}
    assert holders == {"system_admin", "site_admin"}  # owner decision 2026-10-21
    assert sp.PERMISSION in roles["sensitive_permissions_not_implied"] and sp.PERMISSION in rbac.STATION_PERMISSIONS


def test_the_migration_carries_its_final_number_and_ids_only(env):
    sql = (Path(sp.__file__).parents[1] / "migrations" / "0134_access_station_permissions.sql").read_text(encoding="utf-8")
    assert sql.splitlines()[0].startswith("-- Final number 0134")
    with env.db.connection(mode="read") as conn:
        cols = {r[1] for r in conn.execute("PRAGMA table_info(access_station_permissions)").fetchall()}
    assert {"wiskey_person_id", "station_id", "effect", "relays_json", "sync_state", "request_effect", "revision"} <= cols
    assert not [c for c in cols if any(w in c for w in ("name", "phone", "pin", "card", "schedule", "timing"))], cols


# ================================================================ the view: groups, personal entries, blocks


def test_the_view_tells_group_personal_and_blocked_apart(env):
    r = env.view()
    assert r.status_code == 200, r.text
    v = r.json()
    rows = {s["station_id"]: s for s in v["stations"]}
    assert v["read"] == "fresh" and v["grant_live"] is False and v["self"] is False
    assert (rows["st-a"]["source"], rows["st-a"]["enabled"]) == ("group", True)
    assert (rows["st-b"]["source"], rows["st-b"]["relays"]) == ("personal", [1, 2])
    assert (rows["st-d"]["source"], rows["st-d"]["enabled"]) == ("blocked", False)
    assert rows["st-a"]["actions"]["deny"] and not rows["st-a"]["actions"]["inherit"]
    assert rows["st-d"]["actions"]["inherit"] and not rows["st-d"]["actions"]["deny"]
    assert env.engine.updates == [], "a read never writes"


def test_a_person_the_caller_cannot_see_is_the_uniform_404(env):
    env.c.get(f"{API}/me", headers=as_user("vic"))
    r = env.view("vic")
    assert r.status_code == 404 and r.json()["code"] != "station_permissions_off", r.text


# ================================================================ decisions (fakes): allow, block, follow groups


def test_allow_writes_the_complete_overrides_and_only_the_new_station_doors(env):
    r = env.put("st-c", "allow", [1])
    assert r.status_code == 200, r.text
    assert r.json() == {"outcome": "decided", "sync_state": "applied", "code": None}
    p = env.person()
    assert p["overrides"] == {"st-b": "allow", "st-d": "deny", "st-c": "allow"}, "every other personal entry carried over"
    assert p["doors"]["st-c"] == [1] and p["doors"]["st-b"] == [1, 2] and p["doors"]["st-a"] == [1]
    assert env.engine.updates[-1] == {"method": "set_station_access", "overrides": p["overrides"], "doors": ["st-c"]}
    row = env.row("st-c")
    assert (row["effect"], row["sync_state"], row["decided_by"], row["proof_at"] is not None) == ("allow", "applied", "dev-joni", True)
    acts = env.audits()
    assert [a["action"] for a in acts] == ["access.station_permission.allow", "access.station_permission.push"]
    for a in acts:
        d = json.loads(a["details_json"])
        assert a["resource_type"] == rbac.STATION and a["resource_id"] == "st-c" and d["person"] == P
        assert "relays" not in d and "doors" not in d, "no relay map in the audit (D06)"


def test_block_beats_the_group_and_is_applied_only_when_no_revocation_is_pending(env):
    env.engine.sync_lag = True
    r = env.put("st-a", "deny")
    assert r.status_code == 200 and r.json()["sync_state"] == "unverified" and r.json()["code"] == "revocation_pending", r.text
    assert "st-a" not in env.person()["doors"] and env.person()["overrides"]["st-a"] == "deny"
    env.engine.settle_revocations()
    s = env.post("st-a", "sync")
    assert s.status_code == 200 and s.json()["sync_state"] == "applied", s.text
    assert env.engine.updates[-1]["method"] == "set_station_access" and len(env.engine.updates) == 1, "already blocked: the sync only read back"


def test_follow_groups_removes_the_personal_entry_and_the_group_applies_again(env):
    assert env.put("st-a", "deny").json()["sync_state"] == "applied"
    r = env.put("st-a", "inherit")
    assert r.status_code == 200 and r.json()["sync_state"] == "applied", r.text
    assert "st-a" not in env.person()["overrides"] and env.person()["doors"]["st-a"] == [1]
    rows = {s["station_id"]: s for s in env.view().json()["stations"]}
    assert rows["st-a"]["source"] == "group" and rows["st-a"]["record"]["effect"] == "inherit"


def test_a_stale_arx_revision_is_refused(env):
    assert env.put("st-c", "allow", [1]).status_code == 200
    r = env.put("st-c", "deny", revision=1)
    assert r.status_code == 409 and r.json()["code"] == "station_permission_revision", r.text


def test_relays_are_checked(env):
    for relays in ([], [3], [True], None):
        r = env.put("st-c", "allow", relays)
        assert r.status_code == 422, (relays, r.text)
    assert env.put("st-c", "deny", [1]).status_code == 422


# ================================================================ RBAC: the one station, request-only managers, self, grants


def test_a_station_holder_decides_on_his_station_even_when_the_person_has_others(env):
    station_manager(env, "mona", "st-a", grant=True)
    r = env.put("st-a", "allow", [1, 2], user="mona")
    assert r.status_code == 200 and r.json()["sync_state"] == "applied", r.text
    assert env.person()["overrides"]["st-b"] == "allow", "the stations outside her reach are untouched"
    r = env.put("st-b", "deny", user="mona")
    assert r.status_code == 403, r.text
    assert env.audits()[-1]["decision"] == "denied" and env.audits()[-1]["reason"] == "no_binding"
    rows = {s["station_id"] for s in env.view("mona").json()["stations"]}
    assert rows == {"st-a"}, "stations without people.read are omitted"


def test_a_request_only_manager_requests_a_widening_and_cannot_approve_it(env):
    station_manager(env, "mona", "st-a", grant=False)
    station_manager(env, "dana", "st-a", grant=True)
    before = len(env.engine.updates)
    r = env.put("st-a", "allow", [1, 2], user="mona")
    assert r.status_code == 200 and r.json() == {"outcome": "requested"}, r.text
    assert len(env.engine.updates) == before, "a request writes nothing to WisKey"
    row = env.row("st-a")
    assert (row["effect"], row["request_effect"], row["requested_by"]) == (None, "allow", "dev-mona")
    mine = {s["station_id"]: s for s in env.view("mona").json()["stations"]}["st-a"]
    assert mine["request"]["mine"] is True and mine["actions"]["approve"] is False and mine["actions"]["refuse"] is True
    a = env.post("st-a", "approve", user="mona")
    assert a.status_code == 403, a.text
    ok = env.post("st-a", "approve", user="dana")
    assert ok.status_code == 200 and ok.json()["sync_state"] == "applied", ok.text
    assert env.person()["doors"]["st-a"] == [1, 2] and env.row("st-a")["request_effect"] is None
    # a narrowing needs no approval: the request-only manager blocks at once
    b = env.put("st-a", "deny", user="mona")
    assert b.status_code == 200 and b.json()["outcome"] == "decided", b.text


def test_a_requester_may_withdraw_and_a_holder_may_refuse(env):
    station_manager(env, "mona", "st-a", grant=False)
    assert env.put("st-c", "allow", [1], user="mona").status_code == 403, "no binding on st-c"
    assert env.put("st-a", "allow", [1, 2], user="mona").json()["outcome"] == "requested"
    r = env.post("st-a", "refuse")
    assert r.status_code == 200 and env.row("st-a") is None
    assert [a["action"] for a in env.audits()][-1] == "access.station_permission.refuse"


def test_no_self_service_unless_system_admin(env):
    station_manager(env, "mona", "st-a", grant=True)
    with env.db.connection() as conn:
        conn.execute("INSERT INTO access_person_links(id, subject_kind, subject_id, wiskey_person_id, origin, linked_by, linked_at) VALUES (?, 'user', 'dev-mona', ?, 'matched', 'dev-joni', ?)",
                     (new_id(), P, now_iso()))
    r = env.put("st-a", "deny", user="mona")
    assert r.status_code == 403 and r.json()["code"] == "station_permission_self", r.text
    assert env.view("mona").json()["self"] is True


def test_a_person_owned_by_a_live_external_grant_is_refused(env):
    lid = new_id()
    with env.db.connection() as conn:
        conn.execute("INSERT INTO access_person_links(id, subject_kind, subject_id, wiskey_person_id, origin, linked_by, linked_at) VALUES (?, 'contact', 'c-1', ?, 'created_from_arx', 'dev-joni', ?)",
                     (lid, P, now_iso()))
        conn.execute("""INSERT INTO access_grants(id, subject_kind, subject_id, link_id, source_kind, doors_json, valid_from, valid_until, credential, state,
                        requested_by, created_at, updated_at) VALUES (?, 'contact', 'c-1', ?, 'manual', '{"st-a":[1]}', '2026-10-21T05:00:00Z',
                        '2026-10-21T14:00:00Z', 'pin', 'active', 'dev-joni', ?, ?)""", (new_id(), lid, now_iso(), now_iso()))
    r = env.put("st-c", "allow", [1])
    assert r.status_code == 409 and r.json()["code"] == "station_permission_grant_live", r.text
    assert env.view().json()["grant_live"] is True and env.engine.updates == []


def test_a_bearer_client_is_not_an_interactive_session(env):
    with env.db.connection(mode="read") as conn:
        assert sp._session_ok(conn, Principal(user_id="u1", username="u", display_name="u", source="remote", via="bearer")) is False
        assert sp._session_ok(conn, Principal(user_id="u1", username="u", display_name="u", source="remote", via="cookie")) is True


# ================================================================ timing policy: mode, schedule and bindings stay together


def test_native_mode_needs_an_existing_binding_and_the_policy_is_never_written(settings, monkeypatch):
    e = Env(settings, monkeypatch)
    e.engine.add_person(P, category="staff", group_doors={"st-a": [1]}, policy=NATIVE)
    r = e.put("st-c", "allow", [1])
    assert r.status_code == 409 and r.json()["code"] == "station_permission_timing_binding", r.text
    ok = e.put("st-a", "allow", [1, 2])
    assert ok.status_code == 200 and ok.json()["sync_state"] == "applied", ok.text
    assert e.person()["policy"] == NATIVE, "the policy is untouched"
    assert all(set(u) == {"method", "overrides", "doors"} for u in e.engine.updates)
    assert e.put("st-a", "deny").json()["sync_state"] == "applied", "a block never needs the policy"


def test_an_unreadable_policy_refuses_an_allow_but_not_a_block(settings, monkeypatch):
    e = Env(settings, monkeypatch)
    e.engine.add_person(P, category="staff", group_doors={"st-a": [1]}, policy={"mode": "native", "schedule": {}, "bindings": {}, "surprise": 1})
    r = e.put("st-c", "allow", [1])
    assert r.status_code == 409 and r.json()["code"] == "station_permission_timing_unreadable", r.text
    assert e.put("st-a", "deny").status_code == 200


# ================================================================ outcomes: restricted read, unknown, unreachable


def test_a_restricted_read_never_writes_a_partial_overrides_map(env):
    env.engine.hide_doors = True
    r = env.put("st-a", "deny")
    assert r.status_code == 200 and r.json() == {"outcome": "decided", "sync_state": "pending", "code": "projection_restricted"}, r.text
    assert env.engine.updates == []


def test_an_unknown_outcome_is_read_back_never_resent(env):
    env.engine.unknown_after_apply = True
    r = env.put("st-c", "allow", [1])
    assert r.status_code == 200 and r.json()["sync_state"] == "applied", r.text  # it landed: the read-back proves it
    assert len(env.engine.updates) == 1
    env.engine.unknown_before_apply = True
    r = env.put("st-c", "deny")
    assert r.json()["sync_state"] == "unverified" and len(env.engine.updates) == 1, r.text


def test_an_unreachable_wiskey_keeps_the_decision_pending_and_sync_sends_it(env):
    env.engine.offline = True
    r = env.put("st-a", "deny")
    assert r.status_code == 200 and r.json()["sync_state"] == "pending" and r.json()["code"] == "not_sent", r.text
    assert env.row("st-a")["effect"] == "deny", "the Arx decision stands"
    env.engine.offline = False
    s = env.post("st-a", "sync")
    assert s.status_code == 200 and s.json()["sync_state"] == "applied", s.text


def test_a_revision_moved_in_wiskey_is_reread_once(env):
    real = env.engine.set_station_access
    calls = {"n": 0}

    def racing(person_id, revision, **kw):
        calls["n"] += 1
        if calls["n"] == 1:
            env.engine.edit_elsewhere(person_id)  # someone saved in WisKey's own panel between our read and our write
        return real(person_id, revision, **kw)

    env.engine.set_station_access = racing  # type: ignore[method-assign]
    r = env.put("st-c", "allow", [1])
    assert r.status_code == 200 and r.json()["sync_state"] == "applied" and calls["n"] == 2, r.text
