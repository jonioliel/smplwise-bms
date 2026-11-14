"""HOME-SIMPLE-2420: the home interface - per-person interface policy (defaults, switch, home-only enforced on the server), the rooms
overview (lights vs on/off switches; "house off" never reaches a non-light switch), favourites isolation, the wall panel's exit code."""
from __future__ import annotations

import sqlite3
from dataclasses import replace
from pathlib import Path

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.services import ha_client, ha_sync
from smplwise.services import home_interface as hi

T = "2026-11-10T10:00:00+00:00"


def _st(eid: str, state: str, name: str, **attrs) -> dict:
    return {"entity_id": eid, "state": state, "attributes": {"friendly_name": name, **attrs}, "last_changed": T, "last_updated": T}


STATES = [
    _st("light.living_main", "on", "Living main", brightness=128, supported_color_modes=["brightness"], color_mode="brightness"),
    _st("light.living_relay", "off", "Living relay", supported_color_modes=["onoff"], color_mode="onoff"),
    _st("switch.living_strip", "on", "Living strip"),  # typed as a light below
    _st("switch.boiler", "on", "Boiler"),  # an on/off load, NOT a light
    _st("switch.fridge", "on", "Fridge"),
    _st("climate.living", "cool", "Living AC", current_temperature=25, temperature=23, hvac_modes=["off", "cool", "heat", "auto"], min_temp=16, max_temp=30),
    _st("cover.living_blind", "open", "Living blind", current_position=60),
    _st("lock.front", "locked", "Front door"),
    _st("light.bed", "off", "Bed light", supported_color_modes=["brightness"]),
]
FLOORS = [{"floor_id": "ground", "name": "Ground", "level": 0, "icon": None}, {"floor_id": "first", "name": "First", "level": 1, "icon": None}]
AREAS = [{"area_id": "living", "name": "Living", "floor_id": "ground", "icon": None}, {"area_id": "bed", "name": "Bed", "floor_id": "first", "icon": None}]


def _reg(eid: str, area: str) -> dict:
    return {"entity_id": eid, "id": f"reg-{eid}", "area_id": area, "device_id": None, "entity_category": None}


REGISTRY = [_reg(s["entity_id"], "bed" if s["entity_id"] == "light.bed" else "living") for s in STATES]


@pytest.fixture()
def app(settings, monkeypatch):
    hi.reset_state_for_tests()
    s = replace(settings, ha_url="http://ha.local:8123", ha_token="secret-token-value")
    monkeypatch.setattr(ha_client, "get_states", lambda _s: STATES)
    from smplwise.main import create_app

    a = create_app(s)
    ha_sync.STATE.connected = True
    ha_sync.snapshot(a.state.db, s)
    with a.state.db.connection() as conn:
        ha_sync.apply_registry(conn, ha_client.registry_maps(REGISTRY, [], AREAS, FLOORS))
        ha_sync.apply_structure(conn, AREAS, FLOORS)
    yield a, s
    hi.reset_state_for_tests()


def _client(app) -> TestClient:
    c = TestClient(app[0])
    assert c.get("/api/v1/me").status_code == 200  # joni: the bootstrap system administrator
    return c


def _policy(c: TestClient, user: str, **body):
    return c.put(f"/api/v1/home/policies/dev-{user}", json=body)


# ---------------------------------------------------------------- defaults

def test_defaults_full_for_everyone(app):
    """HOME-SIMPLE-2421 (owner): a person nobody configured opens the full interface (2.42.0: home for a regular user); both may switch."""
    c = _client(app)
    bind(c, app[1], "dana", "operator", "installation", "*")
    admin = c.get("/api/v1/me").json()["interface"]
    assert admin["interface"] == "full" and admin["may_switch"] is True and admin["home_only"] is False and admin["configured"] is False
    user = c.get("/api/v1/me", headers=as_user("dana")).json()["interface"]
    assert user["interface"] == "full" and user["default_interface"] == "full" and user["may_switch"] is True and user["home_only"] is False


def test_migration_keeps_existing_users_on_the_full_interface(tmp_path: Path):
    """Every user known when 0211 runs gets an explicit full row: an upgrade never moves anyone to the home interface."""
    sql = (Path(hi.__file__).resolve().parents[1] / "migrations" / "0211_home_interface.sql").read_text(encoding="utf-8")
    conn = sqlite3.connect(tmp_path / "m.db")
    conn.execute("CREATE TABLE users (id TEXT PRIMARY KEY)")
    conn.executemany("INSERT INTO users VALUES (?)", [("u1",), ("u2",)])
    conn.executescript(sql)
    rows = conn.execute("SELECT user_id, default_interface, may_switch, home_only FROM home_interface_policy ORDER BY user_id").fetchall()
    assert rows == [("u1", "full", 1, 0), ("u2", "full", 1, 0)]


# ---------------------------------------------------------------- switch

def test_switch_persists_when_allowed(app):
    c = _client(app)
    bind(c, app[1], "dana", "operator", "installation", "*")
    r = c.put("/api/v1/me/interface", headers=as_user("dana"), json={"interface": "full"})
    assert r.status_code == 200 and r.json()["interface"] == "full"
    assert c.get("/api/v1/home/interface", headers=as_user("dana")).json()["interface"] == "full"


def test_may_switch_false_refuses_the_other_interface(app):
    c = _client(app)
    bind(c, app[1], "dana", "operator", "installation", "*")
    assert _policy(c, "dana", default_interface="home", may_switch=False).status_code == 200
    r = c.put("/api/v1/me/interface", headers=as_user("dana"), json={"interface": "full"})
    assert r.status_code == 403 and r.json()["code"] == "interface_locked"
    assert c.put("/api/v1/me/interface", headers=as_user("dana"), json={"interface": "home"}).status_code == 200
    me = c.get("/api/v1/me", headers=as_user("dana")).json()["interface"]
    assert me["interface"] == "home" and me["may_switch"] is False
    # not home-only: the full interface's routes are still answered (the switch is a menu choice, not a restriction)
    res = c.get("/api/v1/devices/bulk-protected", headers=as_user("dana"))
    assert res.status_code != 403 or res.json().get("code") != "home_interface_only"


# ---------------------------------------------------------------- home only (server side)

FULL_ONLY = ["/api/v1/access/roles", "/api/v1/audit", "/api/v1/settings", "/api/v1/recorders", "/api/v1/identity/users", "/api/v1/devices/device-types",
             "/api/v1/devices/bulk-protected", "/api/v1/sites", "/api/v1/wall/profiles"]


def test_home_only_user_is_refused_on_full_only_routes(app):
    c = _client(app)
    bind(c, app[1], "dana", "operator", "installation", "*")
    # before: an operator reaches a full-interface route (whatever it answers, it is not the home gate)
    before = c.get("/api/v1/devices/bulk-protected", headers=as_user("dana"))
    assert before.status_code != 403 or before.json().get("code") != "home_interface_only"
    r = _policy(c, "dana", home_only=True)
    assert r.status_code == 200 and r.json()["home_only"] is True and r.json()["may_switch"] is False and r.json()["interface"] == "home"
    for path in FULL_ONLY:
        res = c.get(path, headers=as_user("dana"))
        assert res.status_code == 403 and res.json()["code"] == "home_interface_only", path
    # a write to a device's administrative leaf under an allowed prefix stays refused
    res = c.put("/api/v1/devices/entities/switch.boiler/device-type", headers=as_user("dana"), json={"kind": "light"})
    assert res.status_code == 403 and res.json()["code"] == "home_interface_only"
    # the home interface's own routes still answer
    for path in ("/api/v1/me", "/api/v1/home/overview", "/api/v1/home/prefs", "/api/v1/devices/tree", "/api/v1/notifications"):
        assert c.get(path, headers=as_user("dana")).status_code == 200, path
    # and the switch to the full interface is refused
    res = c.put("/api/v1/me/interface", headers=as_user("dana"), json={"interface": "full"})
    assert res.status_code == 403 and res.json()["code"] == "interface_locked"
    # the refusal is audited once per window, not per request
    with app[0].state.db.connection(mode="read") as conn:
        n = conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'home_interface.gate.refused' AND actor_user_id = 'dev-dana'").fetchone()[0]
    assert n == 1


def test_home_only_never_applies_to_a_system_admin(app):
    c = _client(app)
    r = c.put("/api/v1/home/policies/dev-joni", json={"home_only": True})
    assert r.status_code == 422 and r.json()["code"] == "home_only_admin"
    assert c.get("/api/v1/access/roles").status_code == 200


def test_policy_page_needs_rbac_assign(app):
    c = _client(app)
    bind(c, app[1], "dana", "operator", "installation", "*")
    assert c.get("/api/v1/home/policies", headers=as_user("dana")).status_code == 403
    assert c.put("/api/v1/home/policies/dev-joni", headers=as_user("dana"), json={"may_switch": False}).status_code == 403
    body = c.get("/api/v1/home/policies").json()
    assert {u["user_id"] for u in body["users"]} >= {"dev-joni", "dev-dana"} and "lights" in body["modules"]


def test_gate_path_matching_is_whole_segment():
    assert hi.home_allowed("/api/v1/me") and hi.home_allowed("/api/v1/home/overview") and hi.home_allowed("/api/v1/ha/entities/light.a/actions")
    assert not hi.home_allowed("/api/v1/media-admin/x")  # "/media/" is a prefix, "/media-admin" is not
    assert not hi.home_allowed("/api/v1/homes")
    assert not hi.home_allowed("/api/v1/me/../access/roles")
    assert not hi.home_allowed("/api/v1//access")
    assert not hi.home_allowed("/api/v1/devices/entities/switch.a/bulk-protected")
    assert hi.home_allowed("/index.html")  # not an API route: not this gate's concern


# ---------------------------------------------------------------- overview

def test_overview_lights_vs_switches_and_house_off_excludes_non_light_switches(app):
    c = _client(app)
    assert c.put("/api/v1/devices/entities/switch.living_strip/device-type", json={"kind": "light"}).status_code == 200
    ov = c.get("/api/v1/home/overview").json()
    living = next(r for r in ov["rooms"] if r["id"] == "living")
    lights = {x["entity_id"]: x for x in living["lights"]}
    switches = {x["entity_id"]: x for x in living["switches"]}
    assert set(lights) == {"light.living_main", "light.living_relay", "switch.living_strip"}
    assert lights["light.living_main"]["dimmable"] is True and lights["light.living_relay"]["dimmable"] is False
    assert lights["switch.living_strip"]["kind"] == "switch" and lights["switch.living_strip"]["dimmable"] is False
    assert set(switches) == {"switch.boiler", "switch.fridge"} and all(x["dimmable"] is False for x in switches.values())
    assert switches["switch.fridge"]["protected"] is False  # nothing is guarded until an administrator approves it (Settings > protected switches)
    assert c.put("/api/v1/devices/entities/switch.fridge/bulk-protected", json={"protected": True}).status_code == 200
    living2 = next(r for r in c.get("/api/v1/home/overview").json()["rooms"] if r["id"] == "living")
    assert next(x for x in living2["switches"] if x["entity_id"] == "switch.fridge")["protected"] is True
    assert [x["entity_id"] for x in living["climate"]] == ["climate.living"] and [x["entity_id"] for x in living["shades"]] == ["cover.living_blind"]
    assert [x["entity_id"] for x in living["locks"]] == ["lock.front"]
    assert [f["id"] for f in ov["floors"]] == ["ground", "first"]
    # the home interface's "house off" is the lights_off bulk kind: it reaches the light-typed switch, never the boiler / fridge
    for scope, sid in (("building", "*"), ("area", "living")):
        p = c.get(f"/api/v1/devices/actions/preview?scope={scope}&id={sid}&kind=lights_off")
        assert p.status_code == 200, p.text
        text = p.text
        assert "switch.living_strip" in text and "light.living_main" in text
        assert "switch.boiler" not in text and "switch.fridge" not in text


def test_overview_follows_rooms_and_modules_of_the_policy(app):
    c = _client(app)
    bind(c, app[1], "dana", "operator", "installation", "*")
    assert _policy(c, "dana", rooms=["bed"], modules=["lights", "climate"]).status_code == 200
    ov = c.get("/api/v1/home/overview", headers=as_user("dana")).json()
    assert [r["id"] for r in ov["rooms"]] == ["bed"] and ov["modules"] == ["climate", "lights"]
    assert _policy(c, "dana", all_rooms=True, all_modules=True).status_code == 200
    ov = c.get("/api/v1/home/overview", headers=as_user("dana")).json()
    living = next(r for r in ov["rooms"] if r["id"] == "living")
    assert living["shades"] and living["locks"]


def test_overview_needs_devices_read(app):
    c = _client(app)
    c.get("/api/v1/me", headers=as_user("nobody"))
    assert c.get("/api/v1/home/overview", headers=as_user("nobody")).status_code == 403


# ---------------------------------------------------------------- favourites

def test_favourites_are_per_person(app):
    c = _client(app)
    bind(c, app[1], "dana", "operator", "installation", "*")
    bind(c, app[1], "eli", "operator", "installation", "*")
    r = c.put("/api/v1/home/prefs", headers=as_user("dana"), json={"favourites": {"living": [{"t": "light", "id": "light.living_main", "w": 2}]}, "layout": {"fav_rooms": ["living"], "start": "last"}})
    assert r.status_code == 200, r.text
    assert c.put("/api/v1/home/prefs", headers=as_user("eli"), json={"favourites": {"home": [{"t": "allLights"}]}}).status_code == 200
    dana = c.get("/api/v1/home/prefs", headers=as_user("dana")).json()
    eli = c.get("/api/v1/home/prefs", headers=as_user("eli")).json()
    assert dana["favourites"] == {"living": [{"t": "light", "id": "light.living_main", "w": 2}]} and dana["layout"] == {"fav_rooms": ["living"], "start": "last"}
    assert eli["favourites"] == {"home": [{"t": "allLights"}]} and eli["layout"] == {}
    # a room not named keeps its list; a bad item is refused
    assert c.put("/api/v1/home/prefs", headers=as_user("dana"), json={"favourites": {"bed": []}}).json()["favourites"]["living"]
    assert c.put("/api/v1/home/prefs", headers=as_user("dana"), json={"favourites": {"living": [{"t": "rm -rf"}]}}).status_code == 422
    assert c.put("/api/v1/home/prefs", headers=as_user("dana"), json={"favourites": {"../x": []}}).status_code == 422


def test_admin_seed_is_offered_to_everyone(app):
    c = _client(app)
    bind(c, app[1], "dana", "operator", "installation", "*")
    assert c.put("/api/v1/home/seed", json={"seed": {"living": [{"t": "light", "id": "light.living_main"}]}}).status_code == 200
    assert c.put("/api/v1/home/seed", headers=as_user("dana"), json={"seed": {}}).status_code == 403
    assert c.get("/api/v1/home/prefs", headers=as_user("dana")).json()["seed"] == {"living": [{"t": "light", "id": "light.living_main"}]}


# ---------------------------------------------------------------- wall panel

def test_kiosk_needs_a_room_and_forces_home_only(app):
    c = _client(app)
    bind(c, app[1], "wall", "operator", "installation", "*")
    assert _policy(c, "wall", kiosk=True).status_code == 422
    r = _policy(c, "wall", kiosk=True, kiosk_area_id="living")
    assert r.status_code == 200 and r.json()["kiosk"] is True and r.json()["home_only"] is True and r.json()["kiosk_area_id"] == "living"
    assert c.get("/api/v1/access/roles", headers=as_user("wall")).json()["code"] == "home_interface_only"


def test_kiosk_exit_code(app):
    c = _client(app)
    bind(c, app[1], "wall", "operator", "installation", "*")
    assert c.put("/api/v1/home/kiosk-code", json={"code": "12ab"}).status_code == 422
    assert c.put("/api/v1/home/kiosk-code", headers=as_user("wall"), json={"code": "4321"}).status_code == 403
    assert c.put("/api/v1/home/kiosk-code", json={"code": "4321"}).json() == {"kiosk_code_set": True}
    assert c.post("/api/v1/home/kiosk/exit", headers=as_user("wall"), json={"code": "0000"}).status_code == 403
    assert c.post("/api/v1/home/kiosk/exit", headers=as_user("wall"), json={"code": "4321"}).json() == {"ok": True}
    for _ in range(hi.KIOSK_TRIES):
        c.post("/api/v1/home/kiosk/exit", headers=as_user("wall"), json={"code": "9999"})
    assert c.post("/api/v1/home/kiosk/exit", headers=as_user("wall"), json={"code": "4321"}).status_code == 429


def test_gate_passes_on_a_database_from_before_0211():
    """A database without the policy table (before migration 0211) has no home-only person: the gate lets the request through."""
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    p = type("P", (), {"user_id": "u1"})()
    hi.enforce(conn, p, "/api/v1/cameras")  # must not raise


# ---------------------------------------------------------------- HOME-SIMPLE-2421

def test_new_default_is_full_for_everyone_and_the_setting_changes_it(app):
    c = _client(app)
    bind(c, app[1], "dana", "operator", "installation", "*")
    assert c.get("/api/v1/home/settings").json()["settings"] == {"default_mode": "full_all", "kiosk_exit": "code", "wallpaper": "none"}
    user = c.get("/api/v1/me", headers=as_user("dana")).json()["interface"]
    assert user["interface"] == "full" and user["default_interface"] == "full" and user["choose"] is False
    assert c.put("/api/v1/home/settings", json={"default_mode": "home_regular"}).status_code == 200
    assert c.get("/api/v1/me", headers=as_user("dana")).json()["interface"]["interface"] == "home"
    assert c.get("/api/v1/me").json()["interface"]["interface"] == "full"  # the administrator keeps the full interface
    assert c.put("/api/v1/home/settings", json={"default_mode": "choose"}).status_code == 200
    me = c.get("/api/v1/me", headers=as_user("dana")).json()["interface"]
    assert me["choose"] is True and me["interface"] == "home"  # the choice screen lives in the home interface
    r = c.put("/api/v1/me/interface", headers=as_user("dana"), json={"interface": "full"})
    assert r.status_code == 200 and r.json()["interface"] == "full" and r.json()["choose"] is False
    assert c.put("/api/v1/home/settings", json={"default_mode": "nope"}).status_code == 422
    assert c.put("/api/v1/home/settings", headers=as_user("dana"), json={"default_mode": "full_all"}).status_code == 403
    with app[0].state.db.connection() as conn:
        rows = conn.execute("SELECT action, details_json FROM audit_log WHERE action = 'home_interface.settings.set'").fetchall()
    assert len(rows) == 2


def test_existing_people_keep_their_interface_when_the_default_changes(app):
    """A person with a policy row is never moved by the installation setting; freeze_legacy_defaults keeps the 2.42.0 default of
    people who arrived without one (home for a regular user, full for an administrator)."""
    c = _client(app)
    bind(c, app[1], "dana", "operator", "installation", "*")
    bind(c, app[1], "rami", "operator", "installation", "*")
    with app[0].state.db.connection() as conn:
        conn.execute("DELETE FROM home_interface_policy")
        assert hi.freeze_legacy_defaults(conn) >= 3
        assert hi.freeze_legacy_defaults(conn) == 0
    assert c.get("/api/v1/me", headers=as_user("dana")).json()["interface"]["interface"] == "home"
    assert c.get("/api/v1/me").json()["interface"]["interface"] == "full"
    assert c.put("/api/v1/home/settings", json={"default_mode": "choose"}).status_code == 200
    assert c.get("/api/v1/me", headers=as_user("rami")).json()["interface"]["choose"] is False


def test_switch_classification_suggests_and_the_admin_marks_many(app):
    c = _client(app)
    body = c.get("/api/v1/home/switches").json()
    rows = {r["entity_id"]: r for r in body["switches"]}
    assert set(rows) == {"switch.living_strip", "switch.boiler", "switch.fridge"}
    assert all(r["class"] == "not_light" for r in rows.values())
    assert rows["switch.boiler"]["suggest"] == "protected" and rows["switch.boiler"]["suggest_reason"]
    assert rows["switch.living_strip"]["suggest"] == "light"  # "strip" is a lighting word
    r = c.post("/api/v1/home/switches", json={"entity_ids": ["switch.living_strip"], "mark": "light"})
    assert r.status_code == 200 and r.json()["changed"] == 1
    r = c.post("/api/v1/home/switches", json={"entity_ids": ["switch.boiler", "switch.fridge", "switch.nope"], "mark": "protected"})
    assert r.status_code == 200 and r.json()["changed"] == 2 and r.json()["refused"] == 1
    rows = {r["entity_id"]: r for r in c.get("/api/v1/home/switches").json()["switches"]}
    assert rows["switch.living_strip"]["class"] == "light" and rows["switch.living_strip"]["suggest"] is None
    assert rows["switch.boiler"]["class"] == "protected" and rows["switch.fridge"]["class"] == "protected"
    living = next(x for x in c.get("/api/v1/home/overview").json()["rooms"] if x["id"] == "living")
    assert "switch.living_strip" in {x["entity_id"] for x in living["lights"]}
    assert all(x["protected"] for x in living["switches"])
    # back: a light marked "not a light" leaves the lights list; protection removed from the fridge
    assert c.post("/api/v1/home/switches", json={"entity_ids": ["switch.living_strip", "switch.fridge"], "mark": "not_light"}).json()["changed"] == 2
    rows = {r["entity_id"]: r for r in c.get("/api/v1/home/switches").json()["switches"]}
    assert rows["switch.living_strip"]["class"] == "not_light" and rows["switch.fridge"]["class"] == "not_light"
    with app[0].state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'home_interface.switch_class.batch'").fetchone()[0] == 3
    bind(c, app[1], "dana", "operator", "installation", "*")
    assert c.get("/api/v1/home/switches", headers=as_user("dana")).status_code == 403
    assert c.post("/api/v1/home/switches", headers=as_user("dana"), json={"entity_ids": ["switch.boiler"], "mark": "light"}).status_code == 403


def test_house_off_and_room_off_never_reach_a_protected_or_not_light_switch_after_bulk_marking(app):
    c = _client(app)
    c.post("/api/v1/home/switches", json={"entity_ids": ["switch.living_strip"], "mark": "light"})
    c.post("/api/v1/home/switches", json={"entity_ids": ["switch.boiler"], "mark": "protected"})
    for scope, sid in (("building", "*"), ("area", "living")):
        text = c.get(f"/api/v1/devices/actions/preview?scope={scope}&id={sid}&kind=lights_off").text
        assert "switch.living_strip" in text and "switch.boiler" not in text and "switch.fridge" not in text


def test_kiosk_exit_setting_none_closes_the_exit(app):
    c = _client(app)
    bind(c, app[1], "wall", "operator", "installation", "*")
    assert _policy(c, "wall", kiosk=True, kiosk_area_id="living").status_code == 200
    c.put("/api/v1/home/kiosk-code", json={"code": "4321"})
    assert c.put("/api/v1/home/settings", json={"kiosk_exit": "none"}).status_code == 200
    assert c.get("/api/v1/me", headers=as_user("wall")).json()["interface"]["kiosk_exit"] == "none"
    r = c.post("/api/v1/home/kiosk/exit", headers=as_user("wall"), json={"code": "4321"})
    assert r.status_code == 403 and r.json()["code"] == "kiosk_no_exit"
    c.put("/api/v1/home/settings", json={"kiosk_exit": "code"})
    assert c.post("/api/v1/home/kiosk/exit", headers=as_user("wall"), json={"code": "4321"}).json() == {"ok": True}


def _png(w: int = 40, h: int = 30) -> bytes:
    import io

    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (w, h), (40, 60, 90)).save(buf, "PNG")
    return buf.getvalue()


def test_wallpaper_gallery_choice_is_validated_per_person(app):
    c = _client(app)
    assert c.put("/api/v1/home/prefs", json={"layout": {"wallpapers": {"living": "g:dusk"}}}).json()["layout"]["wallpapers"] == {"living": "g:dusk"}
    assert c.put("/api/v1/home/prefs", json={"layout": {"wallpapers": {"living": "g:nope"}}}).status_code == 422
    assert c.put("/api/v1/home/prefs", json={"layout": {"wallpapers": {"living": "https://x"}}}).status_code == 422
    assert c.put("/api/v1/home/prefs", json={"layout": {"wallpapers": {"living": ""}}}).json()["layout"]["wallpapers"] == {}


def test_wallpaper_personal_picture_only_when_enabled_and_only_its_owner(app):
    c = _client(app)
    bind(c, app[1], "dana", "operator", "installation", "*")
    files = {"file": ("w.png", _png(), "image/png")}
    r = c.put("/api/v1/home/wallpaper/living", files=files)
    assert r.status_code == 403 and r.json()["code"] == "wallpaper_image_off"
    assert c.put("/api/v1/home/settings", json={"wallpaper": "gallery_image"}).status_code == 200
    r = c.put("/api/v1/home/wallpaper/living", files={"file": ("w.png", _png(), "image/png")})
    assert r.status_code == 200, r.text
    assert r.json()["layout"]["wallpapers"] == {"living": "img"}
    got = c.get("/api/v1/home/wallpaper/living")
    assert got.status_code == 200 and got.headers["content-type"] in ("image/jpeg", "image/png") and got.headers["cache-control"].startswith("private")
    assert c.get("/api/v1/home/wallpaper/living", headers=as_user("dana")).status_code == 404  # another person's picture is never served
    bad = c.put("/api/v1/home/wallpaper/living", files={"file": ("w.gif", b"GIF89a....", "image/gif")})
    assert bad.status_code == 422 and bad.json()["code"] == "image_refused"
    big = c.put("/api/v1/home/wallpaper/living", files={"file": ("w.png", b"\x89PNG\r\n\x1a\n" + b"0" * (hi.WALL_IMAGE_BYTES + 10), "image/png")})
    assert big.status_code in (413, 422)
    assert c.delete("/api/v1/home/wallpaper/living").json()["layout"]["wallpapers"] == {}
    assert c.get("/api/v1/home/wallpaper/living").status_code == 404
    c.put("/api/v1/home/wallpaper/living", files={"file": ("w.png", _png(), "image/png")})
    c.put("/api/v1/home/settings", json={"wallpaper": "none"})
    assert c.get("/api/v1/home/wallpaper/living").status_code == 404  # turned off for the installation: not served


def test_migration_0212_creates_the_picture_table(tmp_path: Path):
    sql = (Path(hi.__file__).resolve().parents[1] / "migrations" / "0212_home_interface_2421.sql").read_text(encoding="utf-8")
    conn = sqlite3.connect(tmp_path / "m.db")
    conn.executescript(sql)
    cols = [r[1] for r in conn.execute("PRAGMA table_info(home_room_image)").fetchall()]
    assert cols == ["user_id", "room_key", "mime", "data_b64", "bytes", "updated_at"]


def test_overview_locks_carry_the_unlock_reason(app):
    c = _client(app)
    living = next(x for x in c.get("/api/v1/home/overview").json()["rooms"] if x["id"] == "living")
    lock = next(x for x in living["locks"] if x["entity_id"] == "lock.front")
    # the same reason the devices panel says for this caller (the one function door_authority.unlock_reason)
    panel = c.get("/api/v1/ha/entities/lock.front").json()
    assert lock["unlock_reason"] == panel["unlock_reason"] and lock["can_unlock"] is (panel["unlock_reason"] == "ok")
