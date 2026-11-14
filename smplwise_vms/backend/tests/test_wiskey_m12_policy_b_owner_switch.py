"""WISKEY-RC7-ADOPT-2331 S1 (WisKey M12 policy B, owner 02.11): the owner's switch of the automatic WisKey installation
(`wiskey.auto_install`) on Arx's EXISTING authorized owner path `PUT /wiskey/switches` (system.configure + system administrator, audited
before / after) - adopted semantically instead of the contribution's `SettingsPatch` field (a second writer, not adopted).

Negative cases first: no permission, a site administrator, a non-system-administrator, a null / non-string value, `on` while the build
constant `wiskey_auto_install.OWNER_ON_PERMITTED` is False (owner default D1=b: refused with a closed Hebrew reason), a mixed body (all or
nothing), the generic settings route. Then: missing / null / unreadable / any value but `on` reads OFF; `off` is always allowed; with the
build constant flipped in the test only, the owner's ON lands with one audit row and installs nothing by itself. FAKES ONLY: no HA, no
WisKey, no component directory."""
from __future__ import annotations

import json

import pytest
from conftest import as_user, bind

from smplwise.db import Database, get_setting, set_setting
from smplwise.services import backup
from smplwise.services import wiskey_acr5 as a5
from smplwise.services import wiskey_auto_install as wai
from smplwise.services import wiskey_switches as ws

API = "/api/v1/wiskey/switches"
KEY = "wiskey.auto_install"
K1 = "wiskey.acr5_access_state"


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


@pytest.fixture()
def no_installer(monkeypatch):
    """Records any call into the installation writers / Core read: an HTTP switch change must never install anything by itself."""
    import importlib

    from smplwise.services import bridge_install

    targets = [(wai, "installer_step"), (wai, "stage_native_bundle"), (wai, "preflight_managed_runtime"),
               (wai, "request_component_restart"), (bridge_install, "install"), (bridge_install, "_copy_tree")]
    try:  # slice S2 (the Core runtime READ gate)
        targets.append((importlib.import_module("smplwise.services.wiskey_core_runtime_gate"), "read_core"))
    except ImportError:
        pass
    calls: list[str] = []
    for mod, name in targets:
        monkeypatch.setattr(mod, name, lambda *a, _n=name, **k: calls.append(_n), raising=False)
    return calls


# ---------------------------------------------------------------- the build constant (D1=b)

def test_this_build_refuses_the_owners_on():
    # owner default D1=b (02.11): shown, but ON is refused until the Core check can pass and the isolated lab is done. Flipping it is a
    # reviewed commit that must change this test too.
    assert wai.OWNER_ON_PERMITTED is False and wai.owner_on_permitted() is False
    assert KEY in ws.ALL_SWITCHES and KEY not in ws.SWITCHES and ws.INSTALL_SWITCH == wai.SWITCH_KEY == KEY
    assert not ws.PERMIT_RE.search(KEY)


# ---------------------------------------------------------------- negative cases first

def test_a_caller_without_system_configure_is_refused_and_nothing_is_written(client, db, no_installer):
    r = _put(client, {KEY: "on"}, user="nobody")
    assert r.status_code == 403, r.text
    assert client.get(API, headers=as_user("nobody")).status_code == 403
    assert _stored(db) == {} and no_installer == []
    with db.connection(mode="read") as conn:
        denied = conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'system.configure' AND decision = 'denied'").fetchone()[0]
    assert denied >= 2


def test_a_site_admin_who_is_not_a_system_admin_is_refused_and_audited(client, settings, db, monkeypatch, no_installer):
    monkeypatch.setattr(wai, "OWNER_ON_PERMITTED", True)  # even a build that permits ON never lets a non-system-administrator write it
    bind(client, settings, "otto", "site_admin", "installation", "*")
    r = _put(client, {KEY: "on"}, user="otto")
    assert r.status_code == 403 and r.json()["code"] in ("forbidden", "not_system_admin"), r.text
    assert _stored(db) == {} and no_installer == []
    with db.connection(mode="read") as conn:
        denied = conn.execute("SELECT COUNT(*) FROM audit_log WHERE actor_user_id = 'dev-otto' AND decision = 'denied' "
                              "AND action IN ('system.configure', 'settings.changed')").fetchone()[0]
    assert denied == 1


def test_system_configure_without_being_a_system_admin_is_refused_and_audited(client, db, monkeypatch, no_installer):
    from smplwise import rbac as router  # CR-ADMIN-GATE-2438: the route's gate is rbac.require_system_admin, which asks rbac.is_system_admin

    monkeypatch.setattr(wai, "OWNER_ON_PERMITTED", True)
    monkeypatch.setattr(router, "is_system_admin", lambda conn, user_id: False)
    r = _put(client, {KEY: "on"})
    assert r.status_code == 403 and r.json()["code"] == "not_system_admin", r.text
    assert _stored(db) == {} and no_installer == []
    (row,) = _rows(db, "denied")
    assert (row["action"], row["reason"], json.loads(row["details_json"])) == ("settings.changed", "not_system_admin", {"keys": 1})


@pytest.mark.parametrize("value", [None, True, 1, ["on"], {"on": True}])
def test_a_null_or_non_string_value_is_never_on(client, db, value, no_installer):
    r = client.put(API, json={"switches": {KEY: value}})
    assert r.status_code == 422, r.text
    assert _stored(db) == {} and no_installer == []
    with db.connection(mode="read") as conn:
        assert wai.switch_on(conn) is False


@pytest.mark.parametrize("value", ["ON", "true", "1", "", "on ", "enabled"])
def test_a_value_other_than_off_or_on_is_refused_and_audited(client, db, value):
    r = _put(client, {KEY: value})
    assert r.status_code == 422 and r.json()["code"] == "validation", r.text
    assert _stored(db) == {}
    assert [x["reason"] for x in _rows(db, "denied")] == ["validation"]


def test_on_is_refused_in_this_build_with_a_closed_hebrew_reason_and_audited(client, db, no_installer):
    r = _put(client, {KEY: "on"})
    assert r.status_code == 409, r.text
    body = r.json()
    assert body["code"] == "auto_install_not_permitted"
    text = json.dumps(body, ensure_ascii=False)
    assert "ההתקנה האוטומטית" in text and "המתג נשאר כבוי" in text
    assert not any(w in text.lower() for w in ("home assistant", "wiskey.auto_install", "owner_on_permitted"))
    assert _stored(db) == {} and no_installer == []
    (row,) = _rows(db)
    assert row["decision"] == "denied" and row["reason"] == "auto_install_not_permitted"
    assert json.loads(row["details_json"]) == {"keys": 1}
    with db.connection(mode="read") as conn:
        assert wai.switch_on(conn) is False


def test_a_mixed_body_is_all_or_nothing(client, db, monkeypatch):
    monkeypatch.setattr(a5, "GO_LIVE_PERMITTED", True)  # the acr5 key alone would be allowed
    r = _put(client, {K1: "on", KEY: "on"})
    assert r.status_code == 409 and r.json()["code"] == "auto_install_not_permitted", r.text
    assert _stored(db) == {}, "the permitted acr5 key in the same body was not written either"


def test_the_generic_settings_route_is_not_a_second_writer(client, db, no_installer):
    # the contribution's SettingsPatch field is NOT adopted: the generic route never writes this key, whatever the body says
    for value in ("on", "off", None, True):
        r = client.patch("/api/v1/settings", json={KEY: value})
        assert r.status_code in (200, 422), r.text
        assert KEY not in _stored(db)
    with db.connection(mode="read") as conn:
        assert wai.switch_on(conn) is False
    assert no_installer == []


# ---------------------------------------------------------------- OFF by default; missing / null / unreadable is not ON

def test_the_view_shows_the_switch_off_and_the_build_refusal(client, db):
    r = client.get(API)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["switches"][KEY] == "off" and body["auto_install_permitted"] is False
    assert set(body["switches"]) == set(ws.ALL_SWITCHES) and len(body["switches"]) == 5
    assert _stored(db) == {}, "a read writes nothing"


@pytest.mark.parametrize("stored", [None, "", "ON", "On", "true", "1", " on", "on\n", "yes", "null"])
def test_missing_null_or_any_value_but_on_reads_off(client, db, stored):
    if stored is not None:
        with db.connection() as conn:
            set_setting(conn, KEY, stored)
    with db.connection(mode="read") as conn:
        assert wai.switch_on(conn) is False and ws.mode(conn, KEY) == "off"
    assert wai.switch_on_db(db) is False
    assert client.get(API).json()["switches"][KEY] == "off"


def test_an_unreadable_switch_is_off():
    class Broken:
        def execute(self, *a, **k):
            raise RuntimeError("unreadable")

    assert wai.switch_on(Broken()) is False


def test_off_is_always_allowed_and_audited_before_after(client, db, no_installer):
    r = _put(client, {KEY: "off"})
    assert r.status_code == 200 and r.json()["switches"][KEY] == "off", r.text
    assert _stored(db) == {KEY: "off"} and no_installer == []
    (row,) = _rows(db, "allowed")
    assert row["action"] == "settings.changed" and json.loads(row["details_json"]) == {"key": KEY, "before": "off", "after": "off"}


def test_restore_keeps_the_live_value():
    assert KEY in backup.SETTINGS_KEEP


# ---------------------------------------------------------------- the owner's ON (build constant flipped in this test only)

def test_with_a_permitting_build_the_owners_on_is_written_audited_and_installs_nothing(client, db, monkeypatch, no_installer):
    monkeypatch.setattr(wai, "OWNER_ON_PERMITTED", True)
    assert client.get(API).json()["auto_install_permitted"] is True
    r = _put(client, {KEY: "on"})
    assert r.status_code == 200 and r.json()["switches"][KEY] == "on", r.text
    assert _stored(db) == {KEY: "on"}
    assert all(r.json()["switches"][k] == "off" for k in ws.SWITCHES)  # the acr5 read switches are untouched
    with db.connection(mode="read") as conn:
        assert wai.switch_on(conn) is True
    (row,) = _rows(db, "allowed")
    assert json.loads(row["details_json"]) == {"key": KEY, "before": "off", "after": "on"}
    assert no_installer == [], "the switch change itself never stages, restarts or reads Core"
    r = _put(client, {KEY: "off"})
    assert r.status_code == 200 and _stored(db) == {KEY: "off"}
    assert json.loads(_rows(db, "allowed")[-1]["details_json"]) == {"key": KEY, "before": "on", "after": "off"}


def test_the_service_refuses_directly_too(monkeypatch):
    for changes, code in (({KEY: None}, "validation"), ({KEY: "yes"}, "validation"), ({KEY: "on"}, "auto_install_not_permitted")):
        with pytest.raises(ws.SwitchRefused) as exc:
            ws.check(changes)
        assert exc.value.code == code
    monkeypatch.setattr(wai, "OWNER_ON_PERMITTED", "yes")  # only the literal True permits
    with pytest.raises(ws.SwitchRefused):
        ws.check({KEY: "on"})
