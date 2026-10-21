"""SVCIDENT3 (the 2.7.0 security review S1 a, S4, S5; CR-USR2 section 12): the add-on side of the run fences - negative first.

- The per-installation allowlist `security.local_identity_runnable` of the scripts / scenes / automations Arx-only users may run: EMPTY by
  default; a run outside it is refused even with both switches on; a run inside it is not sent unless the bridge's own copy (directory push)
  lists it too; an extended item needs a 0.9.2 bridge (the run fences). Edited only by a system administrator on the local channel, audited;
  never restored from a backup.
- The go-live constant stays False (nothing here can turn the extended mode on).
- S4: the self-check says WisKey doors follow the add-on's switch alone. S5: a camera an Arx-only person enabled is not served once the mode is
  off, its opt-in and stream are removed by reconcile with ONE audit row, and a background refresh writes no identity row each time.
Fakes only: no Home Assistant, no device, no lab secrets."""
from __future__ import annotations

import asyncio
import json
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from bridge_loader import load
from smplwise.db import get_setting, set_setting
from smplwise.errors import ApiError
from smplwise.services import backup
from smplwise.services import service_identity as si
from test_service_identity import LID, SID, _local, _seed, db, lx_app  # noqa: F401 (fixtures)

SCRIPT = ("execute", ("script", "turn_on"))


def _on(db, *, addon: list[str] | None = None, bridge: list[str] | None = None, version: str = "0.9.6") -> None:
    with db.connection() as conn:
        set_setting(conn, si.EXTENDED_SETTING, "on")
        set_setting(conn, si.BRIDGE_EXTENDED, "true")
        set_setting(conn, si.BRIDGE_POLICY, "true")  # EXTID-295 (CR-USR2 13.6): the bridge reported a restricted service user
        set_setting(conn, "bridge.integration_version", version)
        if addon is not None:
            set_setting(conn, si.RUNNABLE_SETTING, json.dumps(addon))
        if bridge is not None:
            set_setting(conn, si.BRIDGE_RUNNABLE, json.dumps(bridge))


def _run(db, *, service="execute", item=("script", "turn_on"), feature=None, entity_id="script.evening"):
    feature = feature or ("automations.run" if service == "config_item" else "devices.control")
    with db.connection() as conn:
        return si.subject(conn, _local(), feature, bridge_service=service, item=item, entity_id=entity_id)


def _code(db, **kw) -> str:
    with pytest.raises(ApiError) as e:
        _run(db, **kw)
    return e.value.code


def _rows(db, action: str) -> list[dict]:
    with db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT decision, reason, details_json FROM audit_log WHERE action = ? ORDER BY rowid", (action,))]


@pytest.fixture()
def permit(monkeypatch):
    """The FUTURE enabled behaviour (like test_service_identity_extended): the go-live permit set for the test only."""
    monkeypatch.setattr(si, "EXTENDED_GO_LIVE_PERMITTED", True)


RUN_ITEMS = [("execute", ("script", "turn_on"), "script.evening"), ("execute", ("scene", "turn_on"), "scene.movie"),
             ("config_item", "trigger", "automation.night"), ("config_item", "run_script", "script.evening"), ("config_item", "apply_scene", "scene.movie")]


# ---------------------------------------------------------------- 0. the constant ships False; the list alone enables nothing

def test_the_go_live_constant_stays_false_and_a_list_changes_nothing_without_it(db):
    assert si.EXTENDED_GO_LIVE_PERMITTED is False
    _seed(db)
    _on(db, addon=["script.evening"], bridge=["script.evening"])
    assert _code(db) == "service_identity_refused"  # exactly the 2.6.4 refusal (never_local)
    assert _rows(db, "identity.service_identity.refused")[-1]["reason"] == "never_local"


# ---------------------------------------------------------------- 1. the allowlist: empty by default, every run refused

@pytest.mark.parametrize("service,item,entity", RUN_ITEMS)
def test_with_both_switches_on_a_run_outside_the_empty_default_list_is_refused(db, permit, service, item, entity):
    _seed(db)
    _on(db)  # nothing listed (the default)
    with db.connection(mode="read") as conn:
        assert si.runnable_ids(conn) == frozenset() and get_setting(conn, si.RUNNABLE_SETTING) is None
    assert _code(db, service=service, item=item, entity_id=entity) == "service_identity_not_runnable"
    row = _rows(db, "identity.service_identity.refused")[-1]
    assert row["reason"] == "not_runnable" and row["decision"] == "denied"
    assert _rows(db, "identity.service_identity.extended") == []


@pytest.mark.parametrize("service,item,entity", RUN_ITEMS)
def test_a_listed_item_is_refused_without_its_entity_id_with_another_id_or_another_kind(db, permit, service, item, entity):
    _seed(db)
    other = {"script": "scene.movie", "scene": "script.evening", "automation": "script.evening"}[entity.split(".")[0]]
    _on(db, addon=[entity, other, "script.other"], bridge=[entity, other, "script.other"])
    for bad in (None, "", "script.other" if entity != "script.other" else "scene.x", other, "light.kitchen", "script.EVENING", ["script.evening"]):
        if bad == "script.other" and entity.startswith("script"):
            continue  # listed and the same kind: allowed (covered below)
        assert _code(db, service=service, item=item, entity_id=bad) == "service_identity_not_runnable", bad


def test_a_listed_item_needs_the_bridge_copy_too_then_goes_as_the_service_identity(db, permit):
    _seed(db)
    _on(db, addon=["script.evening"], bridge=[])
    assert _code(db) == "service_identity_runnable_bridge_missing"
    _on(db, addon=["script.evening"], bridge=["script.other"])
    assert _code(db) == "service_identity_runnable_bridge_missing"
    _on(db, addon=[], bridge=["script.evening"])  # the bridge's copy alone admits nothing
    assert _code(db) == "service_identity_not_runnable"
    _on(db, addon=["script.evening"], bridge=["script.evening"])
    assert _run(db) == {"user_id": SID, "on_behalf_of": {"kind": "local", "user_id": LID, "feature": "devices.control"}}
    details = json.loads(_rows(db, "identity.service_identity.extended")[-1]["details_json"])
    assert details["entity_id"] == "script.evening" and details["item"] == ["script", "turn_on"]


@pytest.mark.parametrize("version", ["0.9.0", "0.9.1", "0.9.2", "0.9.5"])
def test_an_older_bridge_gets_no_extended_item(db, permit, version):
    """0.9.1 has the switch but not the run fences (impact check, entity policy); 0.9.2-0.9.5 lack the V-01 fix and the policy report
    (EXTID-295, Fable review 4): no extended item is sent to them, listed or not."""
    _seed(db)
    _on(db, addon=["script.evening"], bridge=["script.evening"], version=version)
    assert _code(db) == "service_identity_extended_bridge_off"
    assert _code(db, item=("lock", "unlock"), entity_id=None) == "service_identity_extended_bridge_off"
    assert si.BRIDGE_EXTENDED_REQUIRED == "0.9.6"


def test_a_malformed_stored_list_is_empty(db, permit):
    _seed(db)
    _on(db, bridge=["script.evening"])
    for raw in ("not json", json.dumps({"script.evening": True}), json.dumps(["script.evening", "light.x"]), json.dumps([f"script.s{i}" for i in range(101)])):
        with db.connection() as conn:
            set_setting(conn, si.RUNNABLE_SETTING, raw)
            assert si.runnable_ids(conn) == frozenset(), raw
        assert _code(db) == "service_identity_not_runnable"


def test_items_that_run_nothing_ignore_the_list(db, permit):
    _seed(db)
    _on(db, addon=[], bridge=[])
    assert _run(db, item=("light", "turn_on"), entity_id=None)["on_behalf_of"]["feature"] == "devices.control"
    assert _run(db, item=("lock", "unlock"), entity_id="lock.front")["on_behalf_of"]["feature"] == "devices.control"  # a door: its own grant
    assert si.runnable_item("execute", ("light", "turn_on")) is None and si.runnable_item("execute", ["script", "turn_on"]) is None
    assert si.runnable_item("config_item", "upsert") is None


# ---------------------------------------------------------------- 2. the route: system administrator, local channel, audited

def test_the_runnable_route_is_local_only_system_admin_only_validated_and_audited(lx_app):
    lx = lx_app
    _seed(lx.db, bridge_reports=None)
    remote = lx.remote()
    assert remote.put("/arx/api/v1/identity/service-identity/runnable", json={"entity_ids": ["script.evening"]}).status_code == 404
    viewer = TestClient(lx.app, headers={"X-SW-Dev-User": "vera"})
    assert viewer.put("/api/v1/identity/service-identity/runnable", json={"entity_ids": ["script.evening"]}).status_code == 403
    lx.enable()
    created, c = lx.ready("maria", "site_admin")
    assert c.put("/arx/api/v1/identity/service-identity/runnable", json={"entity_ids": ["script.evening"]}).status_code in (403, 404)
    for bad in (["light.kitchen"], ["script.{{x}}"], [f"script.s{i}" for i in range(101)], ["script.evening", 3]):
        r = lx.admin.put("/api/v1/identity/service-identity/runnable", json={"entity_ids": bad})
        assert r.status_code == 422, (bad, r.text)
    assert lx.admin.put("/api/v1/identity/service-identity/runnable", json={"entity_ids": [], "extra": 1}).status_code == 422
    with lx.db.connection(mode="read") as conn:
        assert si.runnable_ids(conn) == frozenset()  # nothing stored by a refusal
    r = lx.admin.put("/api/v1/identity/service-identity/runnable", json={"entity_ids": ["Script.Evening ", "scene.movie", "scene.movie"]})
    assert r.status_code == 200, r.text
    assert r.json()["runnable"] == {"ids": ["scene.movie", "script.evening"], "bridge_ids": [], "agrees": False, "max": 100}
    r = lx.admin.put("/api/v1/identity/service-identity/runnable", json={"entity_ids": ["scene.movie", "automation.night"]})
    rows = lx.rows("SELECT decision, reason, details_json FROM audit_log WHERE action = 'identity.service_identity.runnable' ORDER BY rowid")
    assert [x["decision"] for x in rows].count("denied") >= 3 and rows[-1]["decision"] == "allowed"
    last = json.loads(rows[-1]["details_json"])
    assert (last["added"], last["removed"], last["count"]) == (["automation.night"], ["script.evening"], 2)
    assert "security.local_identity_runnable" in backup.SETTINGS_KEEP  # a restore never widens it


def test_the_bridge_copy_arrives_with_the_directory_push_and_the_card_shows_both(db, permit):
    _seed(db)
    with db.connection() as conn:
        si.note_directory_push(conn, {"service_identity": True, "service_user_id": SID, "local_identity_extended": True, "local_identity_runnable": ["script.evening"]})
        assert si.bridge_runnable_ids(conn) == frozenset({"script.evening"})
        si.note_directory_push(conn, {"service_identity": True, "service_user_id": SID, "local_identity_runnable": ["script.evening", "light.x"]})  # malformed: none
        assert si.bridge_runnable_ids(conn) == frozenset()
        si.note_directory_push(conn, {"service_identity": True, "service_user_id": SID})  # an older bridge: none
        assert si.bridge_runnable_ids(conn) == frozenset()
    _on(db, addon=["script.evening"], bridge=[])
    with db.connection(mode="read") as conn:
        st = si.status(conn)
    assert st["runnable"]["agrees"] is False and "runnable_mismatch" in {s["code"] for s in st["steps"]}
    _on(db, addon=["script.evening"], bridge=["script.evening"])
    with db.connection(mode="read") as conn:
        st = si.status(conn)
    assert st["runnable"]["agrees"] is True and "runnable_mismatch" not in {s["code"] for s in st["steps"]}


def test_the_add_on_table_matches_the_bridge_rules():
    rn = load("runnable")
    assert si.RUNNABLE_RE.pattern == rn.RUNNABLE_RE.pattern and si.MAX_RUNNABLE == rn.MAX_RUNNABLE
    assert {k for k in si.RUN_KIND} == {("execute", ("script", "turn_on")), ("execute", ("scene", "turn_on")), ("config_item", "trigger"),
                                        ("config_item", "run_script"), ("config_item", "apply_scene")}
    assert set(si.RUN_KIND.values()) == {"script", "scene", "automation"}
    # every runnable item of the add-on is an item the bridge fences (execute script / scene, the three config_item run ops)
    bsi = load("service_identity")
    assert {i for (svc, i) in si.RUN_KIND if svc == "config_item"} == bsi.AUTOMATION_RUN_OPS
    assert {i for (svc, i) in si.RUN_KIND if svc == "execute"} == bsi.SCRIPT_SCENE_PAIRS


# ---------------------------------------------------------------- 3. S4: WisKey doors follow the add-on switch alone (the card says so)

def test_the_self_check_says_wiskey_doors_follow_the_add_on_switch_alone(db, permit):
    _seed(db)
    _on(db)
    with db.connection(mode="read") as conn:
        st = si.status(conn)
    assert st["extended"]["doors_addon_only"] is True
    doors = next(a for a in st["allowed"] if a["key"] == "doors")
    assert "WisKey" in doors["he"] and "WisKey" in doors["en"] and "alone" in doors["en"]


# ---------------------------------------------------------------- 4. S5: a camera a local user enabled, after the mode goes off

def test_a_camera_a_local_user_enabled_stops_with_the_mode_and_is_removed_once(live, monkeypatch, permit):
    from test_ha_camera_live import ENTITY, STREAM, URL, FakeHass, FakeUser, signing, svc
    from smplwise.services import ha_bridge
    from smplwise.services import ha_camera_streams as hls

    db = live.app.state.db
    _seed(db)
    _on(db)
    with db.connection(mode="read") as conn:
        secret = ha_bridge.signing_key(conn)
    bridge_si = load("service_identity")

    def stream_source(_settings, payload):
        user = FakeUser(SID, admin=False)
        user.groups = [SimpleNamespace(id="arx_service", policy={"entities": {"domains": {"camera": True}}})]  # 0.9.6: a restricted service user
        hass = FakeHass({SID: user}, {ENTITY})

        async def getter(_hass, entity_id):
            return URL

        async def run():
            msg, refused = await bridge_si.screen(hass, signing.Verifier(secret), dict(payload), "stream_source", SID, True)
            if refused is not None:
                return refused
            return await svc.async_handle_stream_source(hass, bridge_si.PREVERIFIED, msg, admin_waived=True)

        original = svc._ha
        svc._ha = lambda: SimpleNamespace(get_stream_source=getter)
        try:
            return asyncio.run(run())
        finally:
            svc._ha = original

    hls.set_transport(SimpleNamespace(stream_source=stream_source))
    with db.connection() as conn:
        assert hls.enable(conn, live.s, _local(), ENTITY)["enabled"] is True
    assert live.go.store[STREAM] == [URL]
    # a refresh in the extended mode writes no identity row each time (review S5)
    monkeypatch.setattr(hls, "REREAD_MIN_INTERVAL_S", 0.0)
    before = len(_rows(db, "identity.service_identity.extended"))
    hls.mark_stale(ENTITY)
    assert hls.ensure_ready(db, live.s, ENTITY) == STREAM
    assert len(_rows(db, "identity.service_identity.extended")) == before
    # the mode goes off: the old stream is NOT served, and no identity refusal row is written per attempt
    with db.connection() as conn:
        set_setting(conn, si.EXTENDED_SETTING, "off")
    refused_before = len(_rows(db, "identity.service_identity.refused"))
    for _ in range(3):
        with pytest.raises(ApiError) as e:
            hls.ensure_ready(db, live.s, ENTITY)
        assert e.value.code == "ha_live_unavailable"
    assert len(_rows(db, "identity.service_identity.refused")) == refused_before
    # reconcile drops the opt-in and deletes the stream - one audit row
    out = hls.reconcile(db, live.s, force=True)
    assert out["dropped"] == 1 and out["deleted"] == 1 and STREAM not in live.go.store
    with db.connection(mode="read") as conn:
        assert ENTITY not in hls.enabled(conn)
    rows = [r for r in _rows(db, "camera_card.ha_live.disable") if r["reason"] == "extended_off"]
    assert len(rows) == 1
    assert hls.reconcile(db, live.s, force=True) == {"dropped": 0, "deleted": 0}
    assert len([r for r in _rows(db, "camera_card.ha_live.disable") if r["reason"] == "extended_off"]) == 1


def test_a_camera_a_home_assistant_user_enabled_is_untouched_by_the_mode(live):
    from test_ha_camera_live import ENTITY, STREAM
    from smplwise.services import ha_camera_streams as hls

    db = live.app.state.db
    with db.connection() as conn:
        cams = {ENTITY: {"enabled_at": "2026-10-17T00:00:00Z", "enabled_by": "u-ha"}}
        set_setting(conn, hls.KEY, json.dumps({"v": 1, "cameras": cams}))
        assert hls._local_off(conn, cams[ENTITY]) is False
        assert hls._local_off(conn, {"enabled_by": LID}) is True  # the mode is off (and the go-live constant False)
    out = hls.reconcile(db, live.s, force=True)
    assert out["dropped"] == 0
    with db.connection(mode="read") as conn:
        assert ENTITY in hls.enabled(conn)
    assert STREAM  # (the stream itself is reconcile's ordinary business)


from test_alarm import _fresh_limits  # noqa: E402,F401  (fixtures used by the camera fixture chain)
from test_camera_card import cam_app  # noqa: E402,F401
from test_devices import dev_app  # noqa: E402,F401
from test_ha_camera_live import _no_real_dns, live  # noqa: E402,F401
