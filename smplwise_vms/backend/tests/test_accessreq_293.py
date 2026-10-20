"""ACCESSREQ-293: the server side of the manual "request external access" form (owner-approved mockup
private/planning/mockup_access_request_2026-10-20, owner decisions of 2026-10-20).

FAKES ONLY, like tests/test_access_grants.py (whose Env this file reuses): the access engine is tests/fake_wiskey.FakeAccessEngine, the
code transport FakeCodeTransport, the clock injected, the WisKey station list a served copy set in memory; the go-live permit is switched
on inside each test by the Env (monkeypatch). Nothing here reaches WisKey, a station, a door or WhatsApp.

 (a) the person who asked for a scope may not approve it (a second person must) - except a system administrator; fail closed, with the
     refusal code `access_grant_self_approval`, audited; "I approve now" is refused BEFORE anything is stored when not allowed;
 (b) a manager who may only request chooses the "entrance for external people" stations plus the stations of the ticket's building -
     in the form's door list AND where the request is stored (`access_grant_station_not_allowed`);
 (c) writing the name to WisKey stays manual by default;
 plus the purpose / notes fields, the approver list, the requester's notice tick, the notice route, migration 0127 (built as PROVISIONAL 0130)."""
from __future__ import annotations

import json
from datetime import timedelta
from pathlib import Path

import pytest
from conftest import as_user, bind
from fake_trusted_bridge import station
from test_access_grants import APPROVER, DUE, PHONE, Env
from tickets_world import API

from smplwise.db import new_id
from smplwise.services import access_grants as ag
from smplwise.services import intercom_sync

REQUESTER = ("tickets.manage", "tickets.external")


@pytest.fixture()
def env(settings, monkeypatch):
    e = Env(settings, monkeypatch)
    monkeypatch.setattr(intercom_sync.STATE, "state", "ready")
    monkeypatch.setattr(intercom_sync.STATE, "fetched_at", "2026-10-20T06:41:00Z")
    _stations(station("st-a", "לובי ראשי", relays=[1, 2]), station("st-b", "חניון"), station("st-c", "מרתף"), station("st-d", "גג"))
    yield e
    with intercom_sync.SYNC._cache_lock:
        intercom_sync.SYNC._cache = None
    ag.reset_for_tests()


def _stations(*raw) -> None:
    with intercom_sync.SYNC._cache_lock:
        intercom_sync.SYNC._cache = intercom_sync.project_overview({"stations": list(raw)})


def _role(env: Env, name: str, perms=(), sensitive=()) -> str:
    r = env.c.post(f"{API}/access/roles", json={"name": name, "description": "accessreq test", "permissions": list(perms), "sensitive": list(sensitive)})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _approver(env: Env, user: str, scope: tuple[str, str] = ("installation", "*")) -> None:
    bind(env.c, env.settings, user, _role(env, f"מאשר {user}", sensitive=APPROVER), *scope)


def _requester(env: Env, user: str) -> None:
    rid = _role(env, f"מבקש {user}", perms=[p for p in REQUESTER if p != "tickets.external"], sensitive=["tickets.external"])
    bind(env.c, env.settings, user, rid, "installation", "*")


def _get(env: Env, path: str, user: str | None = None):
    return env.c.get(f"{API}{path}", headers=as_user(user) if user else None)


def _audits(env: Env, action: str) -> list[tuple]:
    with env.db.connection(mode="read") as conn:
        return [tuple(r) for r in conn.execute("SELECT decision, reason, resource_id, details_json FROM audit_log WHERE action = ? ORDER BY rowid", (action,))]


def _grants(env: Env) -> int:
    return env.sql_count("SELECT COUNT(*) FROM access_grants")


def _entrance(env: Env, *sids: str) -> None:
    for sid in sids:
        env.sql("INSERT OR IGNORE INTO access_station_entrance(station_id, set_by, set_at) VALUES (?, 'test', '2026-10-20T06:00:00Z')", sid)


def _ticket_in_building(env: Env, station_id: str) -> str:
    """A ticket whose building has `station_id` placed in it (the arrival page's "ticket's station" rule)."""
    site = env.c.post(f"{API}/sites", json={"name": "אתר בקשות", "address": "רחוב 1"}).json()
    building = env.c.post(f"{API}/sites/{site['id']}/buildings", json={"name": "מבנה בקשות"}).json()
    t = env.w.create("joni", title="תקלת מיזוג")
    env.sql("UPDATE tickets SET building_id = ? WHERE id = ?", building["id"], t["id"])
    env.sql("INSERT INTO intercom_station_placement(config_entry_id, building_id, assigned_at) VALUES (?, ?, '2026-10-20T06:00:00Z')", station_id, building["id"])
    return t["id"]


# ================================================================ migration 0127 (built as PROVISIONAL 0130; renumbered at integ/293)


def test_migration_0127_adds_the_columns_and_lets_a_requester_tick_the_notice(env):
    assert sorted(p.name for p in (Path(ag.__file__).parents[1] / "migrations").glob("0127_*.sql")) == ["0127_access_request_form.sql"]
    assert "Final number 0127" in (Path(ag.__file__).parents[1] / "migrations" / "0127_access_request_form.sql").read_text(encoding="utf-8").splitlines()[0]
    with env.db.connection(mode="read") as conn:
        cols = {r[1] for r in conn.execute("PRAGMA table_info(access_grants)")}
        assert {"purpose", "notes", "scope_requested_by"} <= cols
        assert 130 in {r[0] for r in conn.execute("SELECT version FROM schema_migrations")}
        ddl = conn.execute("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'access_grant_notices'").fetchone()[0]
        assert "'requester'" in ddl and "ON DELETE CASCADE" in ddl


# ================================================================ purpose and notes


def test_purpose_and_notes_are_stored_shown_and_never_leave_arx(env):
    r = env.request(purpose="החלפת מדחס במרתף", notes="NOTE-SENTINEL-77: לתאם עם השומר\nשורה שנייה")
    assert r.status_code == 200, r.text
    g = r.json()["grant"]
    assert g["purpose"] == "החלפת מדחס במרתף" and g["notes"].startswith("NOTE-SENTINEL-77") and g["self_requested"] is True
    gid = g["id"]
    assert env.approve(gid).status_code == 200, "a system administrator approves his own request (owner decision a)"
    env.run()
    env.clock[0] = DUE
    env.run()
    assert len(env.transport.sent) == 1
    _, text = env.transport.sent[0]
    assert "NOTE-SENTINEL-77" not in text and "מדחס" not in text, "neither the notes nor the purpose go into the code message"
    assert all("NOTE-SENTINEL-77" not in json.dumps(p, ensure_ascii=False) for p in env.engine.people.values()), "nothing of them reaches WisKey"
    with env.db.connection(mode="read") as conn:
        audit = " ".join(r[0] or "" for r in conn.execute("SELECT details_json FROM audit_log").fetchall())
    assert "NOTE-SENTINEL-77" not in audit and "מדחס" not in audit, "audit rows carry ids only"


def test_purpose_and_notes_validation(env):
    assert env.request(purpose="x" * 201).status_code == 422
    assert env.request(notes="x" * 1001).status_code == 422
    r = env.request(purpose="שורה\nשנייה")
    assert r.status_code == 422 and r.json()["details"]["code"] == "line_break", r.text
    r = env.request(purpose="abc‮def")
    assert r.status_code == 422 and r.json()["details"]["code"] == "characters", r.text
    r = env.request(purpose="   ")
    assert r.status_code == 200 and r.json()["grant"]["purpose"] is None


# ================================================================ owner decision (a): a second person approves


def test_a_requester_who_is_not_a_system_admin_cannot_approve_his_own_request(env):
    _approver(env, "rina")
    _approver(env, "igor")
    r = env.request(user="rina")
    assert r.status_code == 200, r.text
    gid = r.json()["grant"]["id"]
    assert r.json()["grant"]["self_requested"] is True
    a = env.approve(gid, user="rina")
    assert a.status_code == 403 and a.json()["code"] == "access_grant_self_approval", a.text
    assert env.grant(gid)["state"] == "requested" and env.engine.calls == []
    assert ("denied", "self_approval") == _audits(env, "access.grant.approve")[-1][:2]
    # the second person approves
    assert _get(env, f"/access-grants/{gid}", "igor").json()["grant"]["self_requested"] is False
    assert env.approve(gid, user="igor").status_code == 200
    assert env.grant(gid)["approved_by"] == "dev-igor"


def test_a_replacement_of_a_requested_scope_blocks_both_requesters(env):
    _approver(env, "rina")
    _approver(env, "igor")
    gid = env.request(user="rina").json()["grant"]["id"]
    r = env.request(doors={"st-a": [1, 2]}, user="igor")
    assert r.json()["outcome"] == "replaced" and r.json()["grant"]["id"] == gid
    for user in ("rina", "igor"):
        a = env.approve(gid, user=user)
        assert a.status_code == 403 and a.json()["code"] == "access_grant_self_approval", (user, a.text)
    assert env.approve(gid).status_code == 200, "a third person (here the system administrator) approves"


def test_a_widening_is_approved_by_someone_other_than_who_asked_for_it(env):
    _approver(env, "rina")
    gid = env.active_grant()
    r = env.request(doors={"st-a": [1], "st-b": [1]}, user="rina")
    assert r.json()["outcome"] == "widening"
    a = env.approve(gid, user="rina")
    assert a.status_code == 403 and a.json()["code"] == "access_grant_self_approval"
    assert env.grant(gid)["pending_json"], "the widening still waits"
    # the original requester (the system administrator here) is a second person for this widening
    assert env.approve(gid).status_code == 200


def test_the_self_approval_check_fails_closed(env, monkeypatch):
    _approver(env, "rina")
    gid = env.request(user="rina").json()["grant"]["id"]
    import sqlite3

    def broken(*_a, **_k):
        raise sqlite3.OperationalError("disk I/O error")

    monkeypatch.setattr(ag, "is_system_admin", broken)
    a = env.approve(gid, user="rina")
    assert a.status_code == 403 and a.json()["code"] == "access_grant_self_approval"


def test_approve_now_by_a_system_admin_is_one_step(env):
    r = env.request(told=True, approve_now=True, purpose="ביקור")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["approval"] == {"approved": True} and body["grant"]["state"] == "approved"
    gid = body["grant"]["id"]
    assert env.grant(gid)["approved_by"] == "dev-joni"
    assert [n["via"] for n in body["grant"]["notice"]] == ["requester"], "the requester's tick is the notice; no second tick"
    env.run()
    assert env.grant(gid)["state"] == "active"


def test_approve_now_is_refused_before_anything_is_stored_when_not_allowed(env):
    _approver(env, "rina")
    _requester(env, "moshe")
    _entrance(env, "st-a")
    for user, code in (("rina", "access_grant_self_approval"), ("moshe", "access_grant_self_approval")):
        r = env.request(told=True, approve_now=True, user=user)
        assert r.status_code == 403 and r.json()["code"] == code, (user, r.text)
    r = env.request(told=False, approve_now=True)
    assert r.status_code == 409 and r.json()["code"] == "access_grant_notice"
    with env.db.connection() as conn:
        stale = env.contact(conn, name="מספר ישן", phone="972500000049", confirmed=env.clock[0] - timedelta(days=400))
    r = env.request(contact_id=stale, told=True, approve_now=True)
    assert r.status_code == 409 and r.json()["details"]["reason"] == "phone_not_fresh"
    assert _grants(env) == 0 and env.engine.calls == []
    assert {a[1] for a in _audits(env, "access.grant.approve")} >= {"self_approval", "notice", "phone_not_fresh"}
    # "no code" needs no confirmed number
    r = env.request(contact_id=stale, told=True, approve_now=True, credential="none")
    assert r.status_code == 200 and r.json()["approval"] == {"approved": True}, r.text


def test_approve_now_that_fails_after_storing_keeps_the_request_and_says_why(env, monkeypatch):
    def unavailable(*_a, **_k):
        raise ag.ApiError(503, "access_grant_engine_unavailable", "לא ניתן לקרוא כעת.")

    monkeypatch.setattr(ag, "_person_stations", unavailable)
    r = env.request(told=True, approve_now=True)
    assert r.status_code == 200, r.text
    assert r.json()["approval"]["approved"] is False and r.json()["approval"]["code"] == "access_grant_engine_unavailable"
    assert r.json()["grant"]["state"] == "requested"
    assert env.sql_count("SELECT COUNT(*) FROM notifications WHERE source = 'access.grant_request'") >= 1, "the approvers are told"


def test_a_requester_tick_spares_the_approver_a_second_tick(env):
    _requester(env, "moshe")
    _approver(env, "igor")
    _entrance(env, "st-a")
    gid = env.request(told=True, user="moshe").json()["grant"]["id"]
    a = env.approve(gid, user="igor", told=False)
    assert a.status_code == 200, a.text
    with env.db.connection(mode="read") as conn:
        rows = conn.execute("SELECT via, by_ref, version FROM access_grant_notices WHERE grant_id = ?", (gid,)).fetchall()
    assert [tuple(r) for r in rows] == [("requester", "dev-moshe", ag.NOTICE_VERSION)]


# ================================================================ owner decision (b): which doors a requester may choose


def test_grantable_doors_for_an_approver_a_requester_and_nobody(env):
    _approver(env, "anna", ("access_control_station", "st-a"))
    _requester(env, "moshe")
    _entrance(env, "st-b")
    tid = _ticket_in_building(env, "st-c")
    d = _get(env, "/access-grants/grantable-doors", "anna").json()
    by = {s["station_id"]: s for s in d["stations"]}
    assert set(by) == {"st-a", "st-b", "st-c", "st-d"}
    assert (by["st-a"]["may_request"], by["st-a"]["may_approve"], by["st-a"]["may_approve_pin"]) == (True, True, True)
    assert not any(by[s]["may_request"] for s in ("st-b", "st-c", "st-d")), "an approver without the ticket permissions: his own stations"
    assert [r["relay"] for r in by["st-a"]["relays"]] == [1, 2] and by["st-a"]["name"] == "לובי ראשי"
    assert d["reachable"] is True and d["as_of"] == "2026-10-20T06:41:00Z" and d["max_doors"] == 4 and d["max_days"] == 14
    m = _get(env, f"/access-grants/grantable-doors?ticket_id={tid}", "moshe").json()
    by = {s["station_id"]: s for s in m["stations"]}
    assert {s for s, x in by.items() if x["may_request"]} == {"st-b", "st-c"}, "entrances + the ticket's station (owner decision b)"
    assert not any(x["may_approve"] for x in by.values()) and by["st-b"]["entrance"] and by["st-c"]["ticket"]
    m = _get(env, "/access-grants/grantable-doors", "moshe").json()
    assert {s["station_id"] for s in m["stations"] if s["may_request"]} == {"st-b"}, "without a ticket: the entrances only"
    bind(env.c, env.settings, "vw", "viewer", "installation", "*")
    assert _get(env, "/access-grants/grantable-doors", "vw").status_code == 403
    assert _audits(env, "access.grant.request_form")[-1][:2] == ("denied", "no_binding")
    # the list tells the screen whether to offer the "request access" button
    assert (_get(env, "/access-grants", "moshe").json()["may_request"], _get(env, "/access-grants", "vw").json()["may_request"]) == (True, False)


def test_the_station_rule_is_enforced_where_the_request_is_stored(env):
    _requester(env, "moshe")
    _entrance(env, "st-b")
    tid = _ticket_in_building(env, "st-c")
    r = env.request(doors={"st-a": [1]}, user="moshe")
    assert r.status_code == 403 and r.json()["code"] == "access_grant_station_not_allowed" and r.json()["details"]["station_id"] == "st-a", r.text
    assert env.request(doors={"st-c": [1]}, user="moshe").status_code == 403, "the ticket's station needs the ticket"
    r = env.request(doors={"st-b": [1], "st-c": [1]}, user="moshe", ticket_id=tid)
    assert r.status_code == 200, r.text
    assert _audits(env, "access.grant.request")[0][:2] == ("denied", "station_not_allowed")


def test_without_a_wiskey_copy_the_list_is_empty_and_not_reachable(env, monkeypatch):
    with intercom_sync.SYNC._cache_lock:
        intercom_sync.SYNC._cache = None
    monkeypatch.setattr(intercom_sync.STATE, "state", "error")
    d = _get(env, "/access-grants/grantable-doors").json()
    assert d["stations"] == [] and d["reachable"] is False and d["has_copy"] is False


# ================================================================ approvers


def test_approvers_for_the_chosen_stations_names_only_and_never_the_caller_unless_admin(env):
    _approver(env, "anna", ("access_control_station", "st-a"))
    _approver(env, "igor")
    _requester(env, "moshe")
    _entrance(env, "st-a")
    r = _get(env, "/access-grants/approvers?stations=st-a", "moshe").json()
    names = [a["name"] for a in r["approvers"]]
    assert set(names) >= {"anna", "igor"} and r["self_approval"] is False and all(not a["me"] for a in r["approvers"])
    assert set(r["approvers"][0]) == {"name", "me"}, "names only"
    r = _get(env, "/access-grants/approvers?stations=st-a,st-b", "moshe").json()
    assert "anna" not in [a["name"] for a in r["approvers"]], "anna may approve st-a only"
    r = _get(env, "/access-grants/approvers?stations=st-a", "igor").json()
    assert "igor" not in [a["name"] for a in r["approvers"]] and r["self_approval"] is False, "owner decision (a): not the caller"
    r = _get(env, "/access-grants/approvers?stations=st-a").json()
    assert any(a["me"] for a in r["approvers"]) and r["self_approval"] is True, "a system administrator may approve his own request"
    assert _get(env, "/access-grants/approvers?stations=", "moshe").status_code == 422
    assert _get(env, "/access-grants/approvers?stations=*", "moshe").status_code == 422
    bind(env.c, env.settings, "vw", "viewer", "installation", "*")
    assert _get(env, "/access-grants/approvers?stations=st-a", "vw").status_code == 403


def test_a_local_identity_is_listed_only_when_local_approvers_are_on(env):
    rid = _role(env, "מאשר מקומי", sensitive=APPROVER)
    with env.db.connection() as conn:
        lid = "l_" + new_id()[:12]
        conn.execute("INSERT INTO users(id, username, display_name, source, active, first_seen_at, last_seen_at) VALUES (?, 'loc', 'מקומי', 'local', 1, 't', 't')", (lid,))
        conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) "
                     "VALUES (?, 'user', ?, ?, 'installation', '*', 'allow', 0, 'test', 't')", (new_id(), lid, rid))
    assert "מקומי" not in [a["name"] for a in _get(env, "/access-grants/approvers?stations=st-a").json()["approvers"]]
    env.sql("INSERT OR REPLACE INTO settings(key, value) VALUES (?, 'on')", ag.LOCAL_KEY)
    assert "מקומי" in [a["name"] for a in _get(env, "/access-grants/approvers?stations=st-a").json()["approvers"]]


# ================================================================ the notice route, decision (c), the permits


@pytest.mark.parametrize("lang", ["he", "en", "ar", "ru"])
def test_the_notice_route_serves_the_notice_in_the_persons_language(env, lang):
    r = _get(env, f"/access-grants/notice?lang={lang}")
    assert r.status_code == 200, r.text
    with env.db.connection(mode="read") as conn:
        assert r.json() == {"lang": lang, "version": ag.NOTICE_VERSION, "text": ag.notice_text(conn, lang), "attest": ag.NOTICE_ATTEST[lang]}


def test_the_notice_route_refuses_an_unknown_language_and_a_caller_who_may_not_request(env):
    assert _get(env, "/access-grants/notice?lang=fr").status_code == 422
    bind(env.c, env.settings, "vw", "viewer", "installation", "*")
    assert _get(env, "/access-grants/notice?lang=he", "vw").status_code == 403


def test_pushing_the_name_to_wiskey_stays_manual_by_default_and_the_permits_stay_off(env):
    assert _get(env, "/access-grants").json()["screen"]["name_sync"] == "manual", "owner decision (c)"
    src = Path(ag.__file__).read_text(encoding="utf-8")
    assert "\nGO_LIVE_PERMITTED = False\n" in src, "the go-live permit is not in this build"
    assert env.request(credential="card").json()["code"] == "access_grant_card_not_built", "the card (extended identity) stays locked"
