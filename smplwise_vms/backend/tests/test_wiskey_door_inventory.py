"""CR-033 slices D7 (the read-only door-path inventory, T12, T14, T16) and D9 (the run guard for Arx-started runs, rule
R-17, T17, T18, T19 revised) on fakes only. No Home Assistant, no bridge, no WisKey, no door, no key: the mirror tables
are seeded the way the entity / config / schedule sync would write them, the WisKey copy is FakeWisKeyFeed, the signed
transport is FakeTrustedBridge, the automations and schedules runs go through their existing fakes."""
from __future__ import annotations

import json
import uuid
from typing import Any

import pytest
from automations_fixture import autos_app  # noqa: F401  (the CR-017 fixture)
from conftest import as_user, bind
from schedules_fixture import sched_app  # noqa: F401  (the CR-014 fixture)
from fake_trusted_bridge import TEST_SECRET, FakeTrustedBridge, FakeWisKeyFeed, station
from fastapi.testclient import TestClient

from smplwise.db import Database, now_iso, set_setting
from smplwise.main import create_app
from smplwise.routers import access_control
from smplwise.services import door_path, door_run_guard, ha_client, intercom_sync, trusted_door

ENTRY = "01JTESTSTATIONENTRY000000A"  # synthetic config entry ids, shaped like opaque ConfigEntry ids
SIDE = "01JTESTSTATIONENTRY000000B"
DOCK = "01JTESTSTATIONENTRY000000C"
API = "/api/v1"
REG_ENTRANCE = "a" * 32  # a synthetic entity registry id (device actions name the entity by it)


@pytest.fixture(autouse=True)
def _clean():
    access_control.RELAYS.clear()
    intercom_sync.SYNC.reset()
    door_run_guard.set_conversion_source(None)
    yield
    access_control.RELAYS.clear()
    intercom_sync.SYNC.reset()
    door_run_guard.set_conversion_source(None)


# ================================================================ seeding the mirror

def entity(conn, eid: str, platform: str, *, entry: str | None = None, area: str | None = None, device: str | None = None, registry_id: str | None = None,
           attrs: dict[str, Any] | None = None, state: str = "locked", name: str | None = None) -> None:
    conn.execute(
        "INSERT INTO ha_entities(entity_id, registry_id, domain, name, platform, config_entry_id, area_id, device_id, state, attributes_json, state_seen_at, first_seen_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (eid, registry_id, eid.split(".")[0], name or eid.split(".")[1], platform, entry, area, device, state, json.dumps(attrs or {}), now_iso(), now_iso(), now_iso()),
    )


def door_map(conn, eid: str, station_id: str, relay: int) -> None:
    conn.execute("INSERT INTO intercom_door_map(entity_id, config_entry_id, physical_index, source, mapped_by, mapped_at) VALUES (?,?,?, 'manual', 'test', ?)", (eid, station_id, relay, now_iso()))


def item(conn, kind: str, item_id: str, cfg: dict[str, Any], *, via: str = "arx", versions: tuple[tuple[str, str], ...] | None = None, entity_state: str | None = None, rev: str | None = None) -> str:
    """One automation / script / scene in the config mirror, its entity, its meta row and its version history."""
    revision = rev or uuid.uuid4().hex[:16]
    eid = f"{kind}.{item_id}"
    conn.execute("INSERT INTO ha_config_items(kind, item_id, config_id, entity_id, source, revision, config_json, masked, seen_at, changed_at) VALUES (?,?,?,?, 'ui', ?, ?, 0, ?, ?)",
                 (kind, item_id, item_id, eid, revision, json.dumps(cfg, ensure_ascii=False), now_iso(), now_iso()))
    entity(conn, eid, kind if kind != "scene" else "homeassistant", state=entity_state or ("on" if kind == "automation" else "off"), name=cfg.get("alias") or cfg.get("name"))
    if via:
        conn.execute("INSERT INTO automation_meta(kind, item_id, created_via, created_by, created_by_username, updated_by_username, first_seen_at, last_seen_at) VALUES (?,?,?,?,?,?,?,?)",
                     (kind, item_id, via, "dev-cara", "cara", "cara", now_iso(), now_iso()))
    for v_via, v_rev in versions if versions is not None else (("arx", revision),):
        conn.execute("INSERT INTO automation_versions(kind, item_id, revision, config_json, masked, seen_at, via) VALUES (?,?,?,?,0,?,?)", (kind, item_id, v_rev if v_rev != "$" else revision, "{}", now_iso(), v_via))
    return revision


def write_row(conn, action: str, resource_id: str, actor: str, revision: str, **flags: Any) -> None:
    conn.execute("INSERT INTO audit_log(at, actor_user_id, actor_username, action, resource_type, resource_id, decision, details_json) VALUES (?,?,?,?,?,?, 'allowed', ?)",
                 (now_iso(), f"dev-{actor}", actor, action, "x", resource_id, json.dumps({"revision_after": revision, **flags})))


def schedule(conn, sid: str, name: str, actions: list[dict[str, Any]], *, via: str = "arx", repeat: str = "repeat", enabled: bool = True) -> str:
    rev = uuid.uuid4().hex[:16]
    body = {"schedule_id": sid, "name": name, "weekdays": ["daily"], "repeat_type": repeat, "timeslots": [{"start": "08:00:00", "stop": None, "actions": actions}]}
    conn.execute("INSERT INTO schedule_cache(schedule_id, entity_id, revision, item_json, enabled, seen_at, changed_at) VALUES (?,?,?,?,?,?,?)",
                 (sid, f"switch.schedule_{sid}", rev, json.dumps(body, ensure_ascii=False), 1 if enabled else 0, now_iso(), now_iso()))
    conn.execute("INSERT INTO schedule_meta(schedule_id, created_via, created_by, created_by_username, updated_by_username, first_seen_at, last_seen_at) VALUES (?,?,?,?,?,?,?)",
                 (sid, via, "dev-cara", "cara", "cara", now_iso(), now_iso()))
    return rev


def unlock(target: Any, **extra: Any) -> dict[str, Any]:
    return {"action": "lock.unlock", "target": {"entity_id": target} if isinstance(target, str) else target, **extra}


@pytest.fixture()
def world(settings, monkeypatch):
    """An app with a served WisKey copy (entrance: one relay; side: one relay; dock: two relays), WisKey and ordinary
    locks, a lock group, a template lock, a WisKey button, users (ana: active door opener, ben: inactive), and calls to
    Home Assistant / the bridge / WisKey that fail the test if anything is ever sent."""
    feed = FakeWisKeyFeed([station(ENTRY, "כניסה ראשית"), station(SIDE, "דלת צד"), station(DOCK, "רציף", relays=[1, 2])]).install(monkeypatch)
    app = create_app(settings)
    c = TestClient(app)
    db = Database(settings.db_path)
    sent: list[Any] = []
    monkeypatch.setattr(ha_client, "call_bridge_execute", lambda *a, **k: sent.append(("execute", a)) or {"ok": True})
    monkeypatch.setattr(ha_client, "call_service", lambda *a, **k: sent.append(("service", a)) or {})
    bind(c, settings, "ana", "door_opener", "installation", "*")
    c.get(f"{API}/me", headers=as_user("ben"))
    with db.connection() as conn:
        conn.execute("UPDATE users SET active = 0 WHERE id = 'dev-ben'")
        entity(conn, "lock.entrance", "hikvision_intercom", entry=ENTRY, area="lobby", device="dev-ent", registry_id=REG_ENTRANCE, name="כניסה")
        entity(conn, "lock.side", "smplwise_intercom", entry=SIDE, name="צד")
        entity(conn, "lock.office", "nuki", area="office", name="משרד")
        entity(conn, "lock.all_doors", "group", attrs={"entity_id": ["lock.entrance", "lock.office"]}, name="כל הדלתות")
        entity(conn, "lock.virtual", "template", name="מנעול וירטואלי")
        entity(conn, "button.door_bell", "hikvision_intercom", entry=ENTRY, state="unknown", name="פעמון")
        entity(conn, "light.hall", "hue", area="lobby", state="off", name="אור לובי")
        door_map(conn, "lock.entrance", ENTRY, 1)
        set_setting(conn, "bridge.secret", TEST_SECRET)
        set_setting(conn, "bridge.paired_at", now_iso())
    return {"app": app, "c": c, "db": db, "feed": feed, "sent": sent, "settings": settings}


def seed_items(db: Database) -> dict[str, str]:
    """The T12 population: every way a saved item can reach (or seem to reach) a WisKey door."""
    revs: dict[str, str] = {}
    with db.connection() as conn:
        revs["a_direct"] = item(conn, "automation", "a_direct", {"alias": "פתיחת כניסה בבוקר", "triggers": [], "actions": [unlock("lock.entrance")]})
        write_row(conn, "automation.create", "automation:a_direct", "ana", revs["a_direct"], sensitive=True)
        item(conn, "automation", "a_edited", {"alias": "כניסה שונתה", "actions": [unlock("lock.entrance")]}, versions=(("arx", "r0"), ("external", "$")))
        item(conn, "script", "s_area", {"alias": "לובי", "sequence": [{"choose": [{"conditions": [], "sequence": [{"parallel": [{"action": "light.turn_on", "target": {"entity_id": "light.hall"}},
                                                                                                                       unlock({"area_id": "lobby"})]}]}]}]}, via="external")
        item(conn, "script", "s_chain", {"alias": "שרשרת", "sequence": [{"action": "script.turn_on", "target": {"entity_id": "script.s_area"}}]})
        item(conn, "automation", "a_template", {"alias": "תבנית", "actions": [unlock("{{ states('input_text.door') }}")]})
        item(conn, "automation", "a_label", {"alias": "תווית", "actions": [{"action": "script.turn_on", "target": {"label_id": "doors"}}]})
        item(conn, "automation", "a_light", {"alias": "רק אור", "actions": [{"action": "light.turn_on", "target": {"entity_id": "light.hall"}}]})
        item(conn, "automation", "a_nuki", {"alias": "מנעול רגיל", "actions": [unlock("lock.office")]})
        item(conn, "automation", "a_group", {"alias": "קבוצה", "actions": [unlock("lock.all_doors")]})
        item(conn, "automation", "a_virtual", {"alias": "וירטואלי", "actions": [unlock("lock.virtual")]})
        item(conn, "automation", "a_service", {"alias": "שירות", "actions": [{"action": "hikvision_intercom.unlock_door", "target": {"entity_id": "lock.side"}, "data": {"lock": 2}}]})
        item(conn, "automation", "a_device", {"alias": "פעולת התקן", "actions": [{"device_id": "dev-ent", "domain": "lock", "type": "unlock", "entity_id": REG_ENTRANCE}]})
        item(conn, "scene", "sc_open", {"name": "פתיחה", "entities": {"lock.entrance": "unlocked", "light.hall": "on"}})
        item(conn, "scene", "sc_close", {"name": "נעילה", "entities": {"lock.entrance": {"state": "locked"}}})
        item(conn, "script", "s_loop", {"alias": "לולאה", "sequence": [{"action": "script.s_loop"}]})
        item(conn, "automation", "a_off_step", {"alias": "שלב כבוי", "actions": [unlock("lock.entrance", enabled=False)]})
        item(conn, "automation", "a_unmapped", {"alias": "לא משויך", "actions": [unlock("lock.side")]})
        item(conn, "automation", "a_trig", {"alias": "מפעיל אוטומציה", "actions": [{"action": "automation.trigger", "target": {"entity_id": "automation.a_direct"}}]})
        item(conn, "automation", "a_button", {"alias": "כפתור", "actions": [{"action": "button.press", "target": {"entity_id": "button.door_bell"}}]})
        revs["sch1"] = schedule(conn, "sch1", "פתיחה יומית", [{"service": "lock.unlock", "entity_id": "lock.entrance", "service_data": {}}])
        write_row(conn, "schedule.create", "sch1", "ana", revs["sch1"], lowering=True)
        schedule(conn, "sch2", "חיצוני", [{"service": "script.s_chain", "entity_id": None, "service_data": {}}], via="external")
        revs["sch3"] = schedule(conn, "sch3", "חד פעמי", [{"service": "lock.unlock", "entity_id": "lock.entrance", "service_data": {}}], repeat="single")
        write_row(conn, "schedule.create", "sch3", "ben", revs["sch3"], lowering=True)
        schedule(conn, "sch4", "אורות", [{"service": "light.turn_on", "entity_id": "light.hall", "service_data": {}}])
        set_setting(conn, "home.widgets", json.dumps({"launcher": {"on": True, "items": [{"kind": "script", "id": "script.s_chain", "label": "שער"}]}}))
    return revs


def table_counts(db: Database) -> dict[str, int]:
    with db.connection(mode="read") as conn:
        names = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").fetchall()]
        return {n: conn.execute(f"SELECT COUNT(*) FROM \"{n}\"").fetchone()[0] for n in names}


# ================================================================ D7: the resolver

def test_d7_resolver_finds_every_static_path_and_fails_closed_on_the_rest(world):
    """T12 (resolver half): direct, area, nested script, nested automation, a lock group, WisKey's own service with its
    relay, a device action by registry id and a scene member are door steps; a template target, a label, a template lock,
    a WisKey button and an unmapped lock are unresolved; a plain lock, a light, a disabled step, lock.lock and a cycle
    are not door steps."""
    seed_items(world["db"])
    with world["db"].connection(mode="read") as conn:
        r = door_path.Resolver(conn)
        assert r.present()

        def res(kind: str, iid: str) -> door_path.Resolution:
            out, row = r.resolve_item(kind, iid)
            assert row is not None
            return out

        for kind, iid in (("automation", "a_direct"), ("script", "s_area"), ("script", "s_chain"), ("automation", "a_group"), ("automation", "a_device"), ("scene", "sc_open"),
                          ("automation", "a_trig")):
            got = res(kind, iid)
            assert got.resolvable and got.doors() == [(ENTRY, 1)], (iid, got)
        chain = res("script", "s_chain")
        assert chain.door_steps[0].via == ("script.s_area",) and chain.refs == ["script.s_area"]
        assert "choose[0].sequence[0].parallel[1]" in res("script", "s_area").door_steps[0].path
        svc = res("automation", "a_service")
        assert svc.resolvable and svc.doors() == [(SIDE, 2)], "unlock_door: the target lock names the station, data.lock the relay"
        for iid, reason in (("a_template", "template_target"), ("a_label", "label_target"), ("a_virtual", "template_lock"), ("a_button", "wiskey_button")):
            got = res("automation", iid)
            assert got.has_door and not got.resolvable and [u.reason for u in got.unresolved] == [reason], (iid, got)
        unmapped = res("automation", "a_unmapped")
        assert unmapped.has_door and not unmapped.resolvable and unmapped.door_steps[0].problem == "unmapped"
        for kind, iid in (("automation", "a_light"), ("automation", "a_nuki"), ("automation", "a_off_step"), ("script", "s_loop")):
            assert not res(kind, iid).has_door, iid
        close = res("scene", "sc_close")
        assert not close.has_door and len(close.lock_steps) == 1
        assert r.resolve_schedule_slots({"timeslots": [{"actions": [{"service": "lock.unlock", "entity_id": "lock.entrance", "service_data": {}}]}]}).doors() == [(ENTRY, 1)]


def test_d7_unknown_scripts_and_templated_services_are_unresolved_only_where_a_door_could_hide(world):
    with world["db"].connection() as conn:
        r = door_path.Resolver(conn)
        assert [u.reason for u in r.resolve_actions([{"action": "script.turn_on", "target": {"entity_id": "script.nowhere"}}]).unresolved] == ["unknown_item"]
        assert [u.reason for u in r.resolve_actions([{"action": "{{ svc }}", "target": {"entity_id": "light.hall"}}]).unresolved] == ["template_service"]
        assert [u.reason for u in r.resolve_actions([unlock("lock.not_in_mirror")]).unresolved] == ["unknown_entity"]
        conn.execute("UPDATE ha_entities SET attributes_json = '{}' WHERE entity_id = 'lock.all_doors'")
        assert [u.reason for u in door_path.Resolver(conn).resolve_actions([unlock("lock.all_doors")]).unresolved] == ["group_lock"], "a group without known members"
        assert not r.resolve_actions([{"action": "light.turn_on", "target": {"entity_id": "{{ x }}"}}]).has_door, "a templated light is not a door"
        assert r.resolve_actions([unlock("all")]).doors() == [(ENTRY, 1)] and not r.resolve_actions([unlock("all")]).resolvable, "all locks: the unmapped side door too"
        deep: list[dict[str, Any]] = [unlock("lock.entrance")]
        for _ in range(door_path.MAX_DEPTH + 2):
            deep = [{"if": [], "then": deep}]
        assert r.resolve_actions(deep).doors() == [(ENTRY, 1)], "containers are not chain depth"


def test_d7_no_wiskey_door_means_nothing_to_judge(settings):
    """An installation without any WisKey lock: the resolver reports nothing present and the run guard is a no-op even for
    a templated step (it cannot reach a WisKey door that does not exist)."""
    app = create_app(settings)
    db = Database(settings.db_path)
    with db.connection() as conn:
        entity(conn, "lock.office", "nuki")
        item(conn, "automation", "a_tpl", {"alias": "x", "actions": [unlock("{{ x }}")]})
    with db.connection(mode="read") as conn:
        assert not door_path.Resolver(conn).present()
        assert door_run_guard.judge_item(conn, "automation", "a_tpl") is None
        assert door_path.inventory(conn)["items"] == [] and door_path.inventory(conn)["wiskey_present"] is False
    del app


# ================================================================ D7: the report

def test_d7_inventory_classifies_names_only_and_is_read_only(world):
    """T12 + T14 + T16: every item with a door step is listed by name, with origin, author, approver, state, last run, the
    run guard's answer and a suggestion; Arx-authored vs edited outside vs external; the approver is the confirmer of the
    live revision only; an autonomous item without a valid approver is marked for disabling (never disabled here); the
    report holds no entity id, station id or address; the request changes nothing and calls nothing."""
    c, db = world["c"], world["db"]
    seed_items(db)
    with db.connection() as conn:
        conn.execute("INSERT INTO automation_runs(id, kind, item_id, at, source, result) VALUES ('ru1', 'automation', 'a_direct', '2026-10-10T06:00:00Z', 'event', 'ok')")
    assert c.get(f"{API}/me").status_code == 200  # the caller's own user row first: the report itself must write nothing
    before = table_counts(db)
    r = c.get(f"{API}/intercom/door-path-inventory")
    assert r.status_code == 200, r.text
    inv = r.json()
    assert table_counts(db) == before, "read-only: no row written anywhere"
    assert world["sent"] == [] and world["feed"].sent == [], "nothing called"
    by = {i["key"]: i for i in inv["items"]}
    assert set(by) == {"automation:a_direct", "automation:a_edited", "script:s_area", "script:s_chain", "automation:a_template", "automation:a_label", "automation:a_group",
                       "automation:a_virtual", "automation:a_service", "automation:a_device", "scene:sc_open", "scene:sc_close", "automation:a_unmapped", "automation:a_trig",
                       "automation:a_button", "schedule:sch1", "schedule:sch2", "schedule:sch3", "launcher:0"}
    d = by["automation:a_direct"]
    assert (d["origin"], d["approver"], d["approver_status"], d["state"], d["autonomous"], d["disable_required"]) == ("arx_authored", "ana", "approved", "enabled", True, False)
    assert d["doors"] == ["כניסה ראשית · ממסר 1"] and d["run_guard"] == "refused_not_converted" and d["suggestion"] == "arx_event_job"
    assert d["last_run"] == {"at": "2026-10-10T06:00:00Z", "result": "ok"} and d["author"] == "cara"
    e = by["automation:a_edited"]
    assert e["origin"] == "arx_edited_externally" and e["approver"] is None and e["approver_status"] == "none" and e["disable_required"] is True, "T14"
    ext = by["script:s_area"]
    assert ext["origin"] == "external" and ext["suggestion"] == "external_untouched" and ext["disable_required"] is False, "T16: never touched"
    assert by["schedule:sch2"]["origin"] == "external" and by["schedule:sch2"]["disable_required"] is False
    s1 = by["schedule:sch1"]
    assert (s1["approver"], s1["approver_status"], s1["suggestion"], s1["disable_required"]) == ("ana", "approved", "hold_open_program", False)
    s3 = by["schedule:sch3"]
    assert (s3["approver_status"], s3["suggestion"], s3["disable_required"]) == ("inactive", "door_button", True), "an inactive approver does not count"
    assert by["scene:sc_close"]["run_guard"] == "unchanged" and by["scene:sc_close"]["suggestion"] == "remove_lock_step" and by["scene:sc_close"]["lock_steps"] == 1
    for key in ("automation:a_template", "automation:a_label", "automation:a_virtual", "automation:a_unmapped", "automation:a_button"):
        assert by[key]["run_guard"] == "refused_unresolvable" and by[key]["suggestion"] == "manual_review" and by[key]["unresolved"], key
    assert by["automation:a_unmapped"]["doors"] == ["צד"], "an unmapped door is named by the lock's own name"
    assert by["launcher:0"]["name"] == "שער" and by["launcher:0"]["kind"] == "launcher"
    assert inv["counts"]["items"] == 19 and inv["counts"]["unresolvable"] == 5
    text = r.text
    for secret in (ENTRY, SIDE, DOCK, "lock.entrance", "lock.side", "script.s_area", REG_ENTRANCE, "dev-ent"):
        assert secret not in text, secret


def test_d7_approver_must_cover_the_live_revision_and_hold_the_door(world):
    c, db = world["c"], world["db"]
    with db.connection() as conn:
        rev = item(conn, "automation", "a1", {"alias": "א", "actions": [unlock("lock.entrance")]})
        write_row(conn, "automation.create", "automation:a1", "ana", "old-revision", sensitive=True)  # an older revision
        write_row(conn, "automation.update", "automation:a1", "cara", rev, sensitive=False)  # live, but not sensitive content
        rev2 = item(conn, "automation", "a2", {"alias": "ב", "actions": [unlock("lock.entrance")]})
        write_row(conn, "automation.update", "automation:a2", "dora", rev2, sensitive=True)  # dora holds no door permission
    c.get(f"{API}/me", headers=as_user("dora"))
    by = {i["key"]: i for i in c.get(f"{API}/intercom/door-path-inventory").json()["items"]}
    assert by["automation:a1"]["approver_status"] == "none"
    assert by["automation:a2"]["approver"] == "dora" and by["automation:a2"]["approver_status"] == "no_permission" and by["automation:a2"]["disable_required"] is True


def test_d7_inventory_is_for_the_system_administrator_only(world):
    c = world["c"]
    r = c.get(f"{API}/intercom/door-path-inventory", headers=as_user("ana"))
    assert r.status_code == 403
    assert c.get(f"{API}/intercom/door-path-inventory").status_code == 200


# ================================================================ D9: the run guard on the automations screen

@pytest.fixture()
def autos(autos_app, monkeypatch):
    """The CR-017 automations app (FakeHaConfig + the real bridge code) plus WisKey: a WisKey lock in the fake world and
    mirror, a lock group over it, the door map, a WisKey copy, and scripts / scenes / automations with door steps."""
    from automations_transport import seed_mirror

    from smplwise.services import automations

    app, s, c, fake, tr = autos_app
    feed = FakeWisKeyFeed([station(ENTRY, "כניסה ראשית"), station(DOCK, "רציף", relays=[1, 2])]).install(monkeypatch)
    executed: list[dict[str, Any]] = []
    monkeypatch.setattr(ha_client, "call_bridge_execute", lambda _s, payload, *a, **k: executed.append(payload) or {"ok": True})
    fake.states["lock.entrance"] = {"entity_id": "lock.entrance", "state": "locked", "attributes": {"friendly_name": "כניסה"}, "last_changed": fake.iso()}
    fake.registry.append(fake._reg_row("lock.entrance", platform="hikvision_intercom", unique_id="ent_door_1"))
    fake.states["lock.all_doors"] = {"entity_id": "lock.all_doors", "state": "locked", "attributes": {"friendly_name": "כל הדלתות", "entity_id": ["lock.entrance"]}, "last_changed": fake.iso()}
    fake.registry.append(fake._reg_row("lock.all_doors", platform="group", unique_id="grp_doors"))
    scripts = {
        "door_script": {"alias": "פתיחת שער", "sequence": [{"action": "lock.unlock", "target": {"entity_id": "lock.entrance"}}]},
        "tpl_script": {"alias": "שער מחושב", "sequence": [{"action": "lock.unlock", "target": {"entity_id": "{{ states('input_text.door') }}"}}]},
        "outer_script": {"alias": "חיצוני", "sequence": [{"parallel": [{"action": "script.turn_on", "target": {"entity_id": "script.door_script"}}]}]},
        "conv_script": {"alias": "סקריפט שהוסב", "sequence": [{"action": "light.turn_on", "target": {"entity_id": "light.office"}}]},
        "conv_other": {"alias": "סקריפט שני שהוסב", "sequence": [{"action": "light.turn_on", "target": {"entity_id": "light.office"}}]},
    }
    for key, cfg in scripts.items():
        fake.scripts[key] = cfg
        fake._seed_script_entity(key, cfg)
    scene = {"id": "9001", "name": "פתיחה בבוקר", "entities": {"lock.entrance": "unlocked"}}
    fake.scenes.append(scene)
    fake._seed_scene_entity("scene.open_morning", "9001", scene)
    auto = {"id": "8001", "alias": "מפעיל את השער", "mode": "single", "triggers": [{"trigger": "time", "at": "06:00:00"}], "conditions": [],
            "actions": [{"action": "script.turn_on", "target": {"entity_id": "script.door_script"}}]}
    fake._seed_automation("automation.opens_gate", "8001", auto, True)
    seed_mirror(app.state.db, fake)
    with app.state.db.connection() as conn:
        door_map(conn, "lock.entrance", ENTRY, 1)
    automations.MIRROR.pull(None, "test")
    return {"app": app, "s": s, "c": c, "fake": fake, "tr": tr, "feed": feed, "executed": executed}


def _rid() -> str:
    return f"door-run-{uuid.uuid4().hex[:10]}"


def _runs(tr: Any) -> list[str]:
    return [b["op"] for b in tr.bridge_calls if b.get("op") in ("trigger", "run_script", "apply_scene")]


def _denied(db: Database, action: str) -> list[str]:
    with db.connection(mode="read") as conn:
        return [r[0] for r in conn.execute("SELECT reason FROM audit_log WHERE action = ? AND decision = 'denied' ORDER BY id", (action,)).fetchall()]


def test_d9_unconverted_and_unresolvable_items_are_refused_before_the_bridge(autos):
    """T19 revised: a script, a nested script inside a parallel branch, a scene member and an automation that calls the
    script are refused with the R-17 Hebrew messages, audited, and nothing reaches the bridge or a door."""
    c, tr, app = autos["c"], autos["tr"], autos["app"]
    for path in ("script/door_script/run", "script/outer_script/run", "scene/9001/apply", "automation/8001/run"):
        r = c.post(f"{API}/automations/{path}", json={"client_request_id": _rid(), "confirm": True})
        assert r.status_code == 409 and r.json()["code"] == "door_step_not_converted", (path, r.text)
        assert r.json()["user_message"] == "לא ניתן להריץ: יש בפריט פתיחת דלת שלא הוסבה"
    r = c.post(f"{API}/automations/script/tpl_script/run", json={"client_request_id": _rid(), "confirm": True})
    assert r.status_code == 409 and r.json()["code"] == "door_steps_unresolvable" and r.json()["user_message"] == "לא ניתן להריץ: לא ניתן לזהות את הדלתות בפריט"
    assert _runs(tr) == [] and autos["executed"] == [] and autos["feed"].sent == []
    assert _denied(app.state.db, "automation.run").count("door_step_not_converted") == 4
    # an ordinary script still runs
    assert c.post(f"{API}/automations/script/conv_script/run", json={"client_request_id": _rid()}).status_code == 202
    assert _runs(tr) == ["run_script"]


class FakeConversions:
    """What slice D10a will provide: the Arx door steps of converted items at their live revision."""

    def __init__(self, doors: dict[tuple[str, str], list[door_run_guard.ConvertedDoor]]) -> None:
        self.doors_of = doors

    def doors(self, conn, kind, item_id, revision):  # noqa: ANN001
        return self.doors_of.get((kind, item_id))


def test_d9_a_converted_run_opens_each_door_through_the_door_path_with_its_own_request_id(autos):
    """T17/T19 revised: the converted item runs without door steps in the infrastructure, then every door is opened through
    the one door path (interim transport here: the station release), never through execute / lock.unlock; one confirmation
    covers the run; every door has its own request id and its own attempt + outcome rows with the real operator, origin
    and the item's revision; two runs never share a request id."""
    c, tr, app, feed = autos["c"], autos["tr"], autos["app"], autos["feed"]
    doors = [door_run_guard.ConvertedDoor(ENTRY, 1, "lock.entrance", "sequence[1]"), door_run_guard.ConvertedDoor(DOCK, 2, None, "sequence[2]")]
    door_run_guard.set_conversion_source(FakeConversions({("script", "conv_script"): doors, ("script", "conv_other"): [door_run_guard.ConvertedDoor(DOCK, 1)]}))
    r = c.post(f"{API}/automations/script/conv_script/run", json={"client_request_id": _rid()})
    assert r.status_code == 409 and r.json()["code"] == "confirmation_required" and _runs(tr) == [] and feed.sent == []
    r = c.post(f"{API}/automations/script/conv_script/run", json={"client_request_id": _rid(), "confirm": True})
    assert r.status_code == 202, r.text
    body = r.json()
    assert _runs(tr) == ["run_script"] and autos["executed"] == []
    assert [d["outcome"] for d in body["doors"]] == ["sent", "sent"] and [d["door"] for d in body["doors"]] == ["כניסה ראשית", "רציף"]
    assert [s["frames"][0]["lock"] for s in feed.sent] == [1, 2], "one station release per door step"
    r2 = c.post(f"{API}/automations/script/conv_other/run", json={"client_request_id": _rid(), "confirm": True})
    assert r2.status_code == 202 and r2.json()["doors"][0]["outcome"] == "sent"
    with app.state.db.connection(mode="read") as conn:
        rows = [json.loads(x[0]) | {"actor": x[1]} for x in conn.execute("SELECT details_json, actor_user_id FROM audit_log WHERE action = 'intercom.release' ORDER BY id").fetchall()]
    attempts = [d for d in rows if d.get("phase") == "attempt"]
    outcomes = [d for d in rows if d.get("phase") == "outcome"]
    assert len(attempts) == 3 and len(outcomes) == 3
    ids = [d["door_request_id"] for d in attempts]
    assert len(set(ids)) == 3, "per-door request ids, across runs too"
    for d in attempts:
        assert d["entry_point"] == "run" and d["transport"] == "trusted_door" and d["actor"] == "dev-joni" and d["origin"].startswith("script:conv_")
        assert d["item_revision"] and d["run_op_id"]
    assert {d["door_request_id"] for d in outcomes} == set(ids)


def test_d9_signed_mode_sends_one_door_open_per_door_with_the_real_actor(autos, monkeypatch):
    c, tr, app = autos["c"], autos["tr"], autos["app"]
    monkeypatch.setattr(trusted_door, "MIN_BRIDGE_FOR_TRUSTED_PATH", "0.9.0")
    bridge = FakeTrustedBridge({ENTRY: [1], DOCK: [1, 2]}).install(monkeypatch)
    with app.state.db.connection() as conn:
        set_setting(conn, "bridge.integration_version", "0.9.0")
        set_setting(conn, trusted_door.FLAG_KEY, "on")
        set_setting(conn, "bridge.secret", TEST_SECRET)
    tr.secret = TEST_SECRET
    door_run_guard.set_conversion_source(FakeConversions({("script", "conv_script"): [door_run_guard.ConvertedDoor(ENTRY, 1), door_run_guard.ConvertedDoor(DOCK, 2)]}))
    r = c.post(f"{API}/automations/script/conv_script/run", json={"client_request_id": _rid(), "confirm": True})
    assert r.status_code == 202, r.text
    opens = bridge.opens()
    assert len(opens) == 2 and [o["message"]["params"]["relay"] for o in opens] == [1, 2]
    assert {o["message"]["actor"]["id"] for o in opens} == {"dev-joni"} and len({o["message"]["request_id"] for o in opens}) == 2
    assert bridge.other_calls == [] and autos["executed"] == [] and autos["feed"].sent == []


def test_d9_a_converted_run_needs_the_door_permission_of_the_real_operator(autos):
    """The door authority judges every door with the person who pressed run, before the run: no permission, nothing runs."""
    from automations_fixture import grant

    c, tr = autos["c"], autos["tr"]
    door_run_guard.set_conversion_source(FakeConversions({("script", "conv_script"): [door_run_guard.ConvertedDoor(ENTRY, 1)]}))
    grant(c, "omer", "מריץ סקריפטים", ["script.run", "devices.read"], [], "installation", "*")
    r = c.post(f"{API}/automations/script/conv_script/run", json={"client_request_id": _rid(), "confirm": True}, headers=as_user("omer"))
    assert r.status_code == 403 and r.json()["user_message"] == "אין הרשאה לפתוח דלת זו", r.text
    assert _runs(tr) == [] and autos["feed"].sent == []


def test_d9_a_door_step_back_in_a_converted_item_is_refused(autos):
    door_run_guard.set_conversion_source(FakeConversions({("script", "door_script"): [door_run_guard.ConvertedDoor(ENTRY, 1)]}))
    r = autos["c"].post(f"{API}/automations/script/door_script/run", json={"client_request_id": _rid(), "confirm": True})
    assert r.status_code == 409 and r.json()["code"] == "door_step_not_converted" and _runs(autos["tr"]) == []


def test_d9_tiles_never_run_a_chain_that_reaches_a_wiskey_door(autos):
    """A script / scene on a device tile or map card, and a lock group over a WisKey lock, are refused before execute."""
    c = autos["c"]

    def press(eid: str, action: str) -> Any:
        return c.post(f"{API}/ha/entities/{eid}/actions", json={"allowed_action_id": action, "client_request_id": _rid(), "expires_at": "2099-01-01T00:00:00Z", "confirmation_grant": "confirmed"})

    for eid, action in (("script.door_script", "script.turn_on"), ("scene.open_morning", "scene.turn_on")):
        r = press(eid, action)
        assert r.status_code == 409 and r.json()["code"] == "door_step_not_converted", (eid, r.text)
    # a lock group: the mirror keeps no member list for it, so what it unlocks is unknown - refused, fail closed
    r = press("lock.all_doors", "lock.unlock")
    assert r.status_code == 409 and r.json()["code"] == "door_steps_unresolvable", r.text
    assert autos["executed"] == []
    door_run_guard.set_conversion_source(FakeConversions({("script", "conv_script"): [door_run_guard.ConvertedDoor(ENTRY, 1)]}))
    r = press("script.conv_script", "script.turn_on")
    assert r.status_code == 409 and r.json()["code"] == "use_automations_screen" and autos["executed"] == []
    assert _denied(autos["app"].state.db, "ha.action").count("door_step_not_converted") == 2
    r = press("script.outer_script", "script.turn_on")
    assert r.status_code == 409 and autos["executed"] == []


# ================================================================ D9: a schedule's "run now"

def test_d9_schedule_run_now_with_a_door_step_is_refused(sched_app, monkeypatch):
    """T17: a schedule slot that opens a WisKey door is never run from Arx through the component."""
    from schedules_fixture import post_json, rid

    from smplwise.services import schedules

    app, s, c, fake, tr = sched_app
    sid = fake._add({"name": "פתיחת שער", "weekdays": ["daily"], "repeat_type": "repeat",
                     "timeslots": [{"start": "08:00:00", "stop": None, "conditions": [], "condition_type": None, "track_conditions": False,
                                    "actions": [{"service": "lock.unlock", "entity_id": "lock.front_door", "service_data": {}}]}]})
    import fake_scheduler

    fake_scheduler.seed_mirror(app.state.db, fake)
    schedules.MIRROR.pull(None, "t")
    with app.state.db.connection() as conn:
        conn.execute("UPDATE ha_entities SET platform = 'hikvision_intercom', config_entry_id = ? WHERE entity_id = 'lock.front_door'", (ENTRY,))
        door_map(conn, "lock.front_door", ENTRY, 1)
    ops: list[str] = []
    real = tr.bridge
    monkeypatch.setattr(tr, "bridge", lambda payload: ops.append(payload.get("op")) or real(payload))
    r = post_json(c, f"/schedules/{sid}/run", {"slot_index": 0, "confirm": True, "client_request_id": rid()})
    assert r.status_code == 409 and r.json()["code"] == "door_step_not_converted", r.text
    assert "run" not in ops
    assert _denied(app.state.db, "schedule.run") == ["door_step_not_converted"]
