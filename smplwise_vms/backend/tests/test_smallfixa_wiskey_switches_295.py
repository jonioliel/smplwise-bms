"""SMALLFIXA-295 (Fable review 3 G-01 / G-03): the administrator's writer of the four `wiskey.acr5_*` switches, GET|PUT /wiskey/switches.

Negative cases first: no permission, a site administrator who is not a system administrator, an unknown key, a key that names a go-live
permit, a peer-seam key, a bad value, `on` without the consumer's permit - each refused, audited (closed reason, a key count only) and
nothing written. Then: every switch defaults OFF, a system administrator's write lands all-or-nothing with one audit row per switch, and
no request can move a build's go-live permit. FAKES ONLY: nothing contacts WisKey or Home Assistant (a switch only gates a later read)."""
from __future__ import annotations

import json

import pytest
from conftest import as_user, bind

from smplwise.db import Database
from smplwise.services import access_grants as ag
from smplwise.services import wiskey_acr5 as a5
from smplwise.services import wiskey_switches as ws

API = "/api/v1/wiskey/switches"
K1 = "wiskey.acr5_access_state"
K2 = "wiskey.acr5_normalize_user"


@pytest.fixture()
def db(settings):
    return Database(settings.db_path)


def _stored(db) -> dict[str, str]:
    with db.connection(mode="read") as conn:
        return {r[0]: r[1] for r in conn.execute("SELECT key, value FROM settings WHERE key LIKE 'wiskey.%'").fetchall()}


def _rows(db, decision: str | None = None) -> list[dict]:
    with db.connection(mode="read") as conn:
        q = "SELECT * FROM audit_log WHERE resource_id = 'wiskey.switches'" + (" AND decision = ?" if decision else "") + " ORDER BY id"
        return [dict(r) for r in conn.execute(q, (decision,) if decision else ()).fetchall()]


def _put(client, switches, user: str | None = None):
    return client.put(API, json={"switches": switches}, headers=as_user(user) if user else None)


# ---------------------------------------------------------------- negative cases first

def test_a_caller_without_system_configure_is_refused_and_audited(client, db):
    r = _put(client, {K1: "on"}, user="nobody")
    assert r.status_code == 403, r.text
    assert client.get(API, headers=as_user("nobody")).status_code == 403
    assert _stored(db) == {}
    with db.connection(mode="read") as conn:
        denied = conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'system.configure' AND decision = 'denied'").fetchone()[0]
    assert denied >= 2


def test_a_site_admin_who_is_not_a_system_admin_is_refused_and_audited(client, settings, db):
    bind(client, settings, "otto", "site_admin", "installation", "*")
    r = _put(client, {K1: "on"}, user="otto")
    assert r.status_code == 403 and r.json()["code"] in ("forbidden", "not_system_admin"), r.text
    assert client.get(API, headers=as_user("otto")).status_code == 403
    assert _stored(db) == {}
    with db.connection(mode="read") as conn:
        denied = conn.execute("SELECT COUNT(*) FROM audit_log WHERE actor_user_id = 'dev-otto' AND decision = 'denied' "
                              "AND action IN ('system.configure', 'settings.changed', 'settings.read')").fetchone()[0]
    assert denied == 2


def test_system_configure_without_being_a_system_admin_is_refused_and_audited(client, db, monkeypatch):
    from smplwise.routers import wiskey_switches as router

    assert client.get(API).status_code == 200  # control: the bootstrap administrator
    monkeypatch.setattr(router, "is_system_admin", lambda conn, user_id: False)
    r = _put(client, {K1: "on"})
    assert r.status_code == 403 and r.json()["code"] == "not_system_admin", r.text
    assert client.get(API).status_code == 403
    assert _stored(db) == {}
    assert [(x["action"], x["reason"]) for x in _rows(db, "denied")] == [("settings.changed", "not_system_admin"), ("settings.read", "not_system_admin")]


@pytest.mark.parametrize("key", ["wiskey.acr5_unknown", "wiskey.wall", "access.external_grants", "doors.windows.enabled",
                                 "wiskey.peer_receipt", "wiskey.peer_pin", "permission_revision" + "x"])
def test_an_unknown_key_is_refused_audited_and_nothing_is_written(client, db, key):
    expected = "permit_not_writable" if ws.PERMIT_RE.search(key) else "unknown_switch"
    r = _put(client, {K1: "on", key: "on"})
    assert r.status_code == 422 and r.json()["code"] == expected, r.text
    assert _stored(db) == {}, "all or nothing: the valid key in the same body was not written either"
    rows = _rows(db)
    assert len(rows) == 1 and rows[0]["decision"] == "denied" and rows[0]["reason"] == expected
    assert key not in (rows[0]["details_json"] or ""), "the caller's key text is never echoed into the audit row"
    assert json.loads(rows[0]["details_json"]) == {"keys": 2}


@pytest.mark.parametrize("key", ["wiskey.go_live_permitted", "wiskey.acr5_go_live", "wiskey.GO-LIVE", "wiskey_acr5.GO_LIVE_PERMITTED",
                                 "access_grants.GO_LIVE_PERMITTED", "capture_lease.go_live_permitted", "wiskey.acr5_permit",
                                 "door_windows_engine.LIVE_ENGINE_BUILT.permit"])
def test_a_go_live_permit_key_is_refused_by_name_and_no_permit_moves(client, db, key):
    from smplwise.services import capture_lease, door_windows_engine

    before = (a5.GO_LIVE_PERMITTED, ag.GO_LIVE_PERMITTED, capture_lease.GO_LIVE_PERMITTED, door_windows_engine.LIVE_ENGINE_BUILT)
    for value in ("on", "off"):
        r = _put(client, {key: value})
        assert r.status_code == 422 and r.json()["code"] == "permit_not_writable", r.text
    assert (a5.GO_LIVE_PERMITTED, ag.GO_LIVE_PERMITTED, capture_lease.GO_LIVE_PERMITTED, door_windows_engine.LIVE_ENGINE_BUILT) == before
    assert capture_lease.GO_LIVE_PERMITTED is False and door_windows_engine.LIVE_ENGINE_BUILT is False
    assert _stored(db) == {}
    assert [x["reason"] for x in _rows(db, "denied")] == ["permit_not_writable", "permit_not_writable"]


@pytest.mark.parametrize("value", ["ON", "true", "1", "", "on "])
def test_a_value_other_than_off_or_on_is_refused(client, db, value):
    r = _put(client, {K1: value})
    assert r.status_code == 422 and r.json()["code"] == "validation", r.text
    assert _stored(db) == {}
    assert [x["reason"] for x in _rows(db, "denied")] == ["validation"]


def test_an_empty_body_or_extra_fields_are_refused(client, db):
    assert _put(client, {}).status_code == 422
    assert client.put(API, json={"switches": {K1: "on"}, "permit": True}).status_code == 422
    assert client.put(API, json={K1: "on"}).status_code == 422
    assert _stored(db) == {}


def test_on_is_refused_without_the_consumers_go_live_permit(client, db, monkeypatch):
    monkeypatch.setattr(a5, "GO_LIVE_PERMITTED", False)
    r = _put(client, {K1: "on"})
    assert r.status_code == 409 and r.json()["code"] == "wiskey_not_permitted", r.text
    assert _stored(db) == {}
    assert [x["reason"] for x in _rows(db, "denied")] == ["wiskey_not_permitted"]
    r = _put(client, {K1: "off"})  # turning a switch off is always allowed
    assert r.status_code == 200, r.text
    assert _stored(db) == {K1: "off"}


# ---------------------------------------------------------------- defaults and the allowed write

def test_every_switch_defaults_off_and_the_view_names_exactly_the_four(client, db):
    r = client.get(API)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["switches"] == {k: "off" for k in a5.FLAGS.values()} and len(body["switches"]) == 4
    assert body["go_live_permitted"] is a5.go_live_permitted()
    assert _stored(db) == {}, "a read writes nothing"
    with db.connection(mode="read") as conn:
        assert not any(a5.consumer_on(conn, k) for k in a5.FLAGS)


def test_a_system_admin_sets_switches_all_or_nothing_with_one_audit_row_each(client, db):
    r = _put(client, {K1: "on", K2: "on"})
    assert r.status_code == 200, r.text
    assert r.json()["switches"][K1] == "on" and r.json()["switches"][K2] == "on"
    assert r.json()["switches"]["wiskey.acr5_presence"] == "off" and r.json()["switches"]["wiskey.acr5_feature_plans"] == "off"
    assert _stored(db) == {K1: "on", K2: "on"}
    with db.connection(mode="read") as conn:
        assert a5.consumer_on(conn, "acr5_01") and a5.consumer_on(conn, "acr5_02") and not a5.consumer_on(conn, "acr5_03")
    allowed = [json.loads(x["details_json"]) for x in _rows(db, "allowed") if x["action"] == "settings.changed"]
    assert sorted(allowed, key=lambda d: d["key"]) == [{"key": K1, "before": "off", "after": "on"}, {"key": K2, "before": "off", "after": "on"}]
    r = _put(client, {K1: "off"})
    assert r.status_code == 200 and r.json()["switches"][K1] == "off"
    with db.connection(mode="read") as conn:
        assert not a5.consumer_on(conn, "acr5_01")
    last = json.loads(_rows(db, "allowed")[-1]["details_json"])
    assert last == {"key": K1, "before": "on", "after": "off"}


def test_the_service_refuses_directly_too():
    for changes, code in (({}, "validation"), ({"wiskey.go_live": "on"}, "permit_not_writable"), ({"x": "on"}, "unknown_switch"),
                          ({K1: "yes"}, "validation"), ({k: "off" for k in [*a5.FLAGS.values(), "a", "b", "c", "d", "e"]}, "validation")):
        with pytest.raises(ws.SwitchRefused) as exc:
            ws.check(changes)
        assert exc.value.code == code
