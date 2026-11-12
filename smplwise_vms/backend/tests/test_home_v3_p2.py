"""HOME-V3-P2-2431: the home interface's family and building screens (round-27 mockup, phase 2).

The home-only allowlist (the modules' own calendar / notice routes in, their administration out), the new home categories, who is
home (the household sees each other; a hidden person is never listed to anyone else; hiding needs no permission), the feature map,
service requests (only the tickets the caller OPENED; module off = 404 everywhere), my notifications (muting reaches every own phone,
a critical category is never muted, the night window holds non-critical pushes except the alarm and the doors), scene-only schedules,
weather and the buses strip."""
from __future__ import annotations

import datetime as dt
from dataclasses import replace

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient
from test_whoin034_295 import ack, beacon, enable, phone, send, world  # noqa: F401 - `world` is a fixture
from tickets_world import build as tickets_build
from tickets_world import rid

from smplwise.services import home_family as hf
from smplwise.services import home_interface as hi
from smplwise.services import mobile_push

API = "/api/v1"


@pytest.fixture(autouse=True)
def _reset():
    hi.reset_state_for_tests()
    yield
    hi.reset_state_for_tests()


# ---------------------------------------------------------------- the allowlist and the categories

@pytest.mark.parametrize("path", [
    "/api/v1/calendar/occurrences", "/api/v1/calendar/rooms/day", "/api/v1/calendar/events", "/api/v1/calendar/events/evt_12/cancel",
    "/api/v1/calendar/events/evt_12/withdraw", "/api/v1/calendar/calendars", "/api/v1/notices", "/api/v1/notices/ntc_1/read",
    "/api/v1/automations/scene", "/api/v1/automations/scene/capture", "/api/v1/home/presence", "/api/v1/home/tickets/t1/notes", "/api/v1/home/schedules/s1/run",
    "/api/v1/me/calendar",
])
def test_family_routes_are_allowed_for_a_home_only_person(path):
    assert hi.home_allowed(path)


@pytest.mark.parametrize("path", [
    "/api/v1/calendar/maintenance", "/api/v1/calendar/connections", "/api/v1/calendar/events/evt_12/guests", "/api/v1/calendar/feeds",
    "/api/v1/notices/boards", "/api/v1/notices/tv-defaults", "/api/v1/notices/ntc_1/reads", "/api/v1/notices/ntc_1/publish",
    "/api/v1/tickets", "/api/v1/tickets/meta", "/api/v1/schedules", "/api/v1/schedules/s1/run", "/api/v1/automations/automation",
])
def test_family_administration_stays_refused_for_a_home_only_person(path):
    assert not hi.home_allowed(path)


def test_family_reads_are_get_only():
    """The same paths create a notice or a calendar: a home-only person may only read them."""
    for path in ("/api/v1/notices", "/api/v1/calendar/calendars", "/api/v1/calendar/occurrences"):
        assert hi.home_allowed(path, method="GET") and not hi.home_allowed(path, method="POST"), path
    assert not hi.home_allowed("/api/v1/notices/ntc_1", method="PATCH") and not hi.home_allowed("/api/v1/notices/ntc_1", method="GET")
    assert hi.home_allowed("/api/v1/calendar/events", method="POST")


def test_new_home_categories_exist():
    assert {"presence", "calendar", "notices", "tickets", "schedules"} <= set(hi.MODULES)


# ---------------------------------------------------------------- who is home

def _home_world(world):  # noqa: F811
    app, c, ids = world
    enable(c, ids)
    devs = {u: phone(c, u, f"{u:0<8}-0000-0000-0000-000000000000") for u in ("dana", "vera", "ruth")}
    for d, tok in devs.values():
        ack(c, d, tok)
    send(c, *devs["dana"], [beacon("b1")])  # dana is placed (home); vera and ruth have phones but no placement (away)
    return app, c, ids, devs


def test_household_sees_each_other_and_a_hidden_person_is_never_listed(world):  # noqa: F811
    _app, c, _ids, _devs = _home_world(world)
    r = c.get(f"{API}/home/presence", headers=as_user("vera"))
    assert r.status_code == 200, r.text
    out = r.json()
    names = [p["name"] for p in out["people"]]
    assert out["people"][0]["me"] is True and set(names) >= {"dana", "vera", "ruth"}
    assert next(p for p in out["people"] if p["name"] == "dana")["home"] is True
    assert next(p for p in out["people"] if p["name"] == "ruth")["home"] is False
    # dana hides herself: gone for everyone else (not even counted), still listed to herself with me_hidden
    assert c.put(f"{API}/home/presence/me", json={"hidden": True}, headers=as_user("dana")).json() == {"hidden": True}
    other = c.get(f"{API}/home/presence", headers=as_user("vera")).json()
    assert "dana" not in [p["name"] for p in other["people"]] and other["home_count"] == 0
    me = c.get(f"{API}/home/presence", headers=as_user("dana")).json()
    assert me["me_hidden"] is True and me["people"][0]["me"] and me["home_count"] == 0
    # nothing about places leaves the route
    assert set(other["people"][0]) == {"user_id", "name", "me", "home", "at"}


def test_presence_needs_its_permission_and_its_category(world, settings):  # noqa: F811
    _app, c, _ids, _devs = _home_world(world)
    bind(c, settings, "kim", "kiosk", "installation", "*")  # a binding without presence.report
    assert c.get(f"{API}/home/presence", headers=as_user("kim")).status_code == 403
    # hiding needs no permission (it only restricts); showing again does
    assert c.put(f"{API}/home/presence/me", json={"hidden": True}, headers=as_user("kim")).status_code == 200
    assert c.put(f"{API}/home/presence/me", json={"hidden": False}, headers=as_user("kim")).status_code == 403
    assert c.put(f"{API}/home/policies/dev-vera", json={"modules": ["lights"]}).status_code == 200
    r = c.get(f"{API}/home/presence", headers=as_user("vera"))
    assert r.status_code == 403 and r.json()["code"] == "home_module_off"


def test_presence_is_empty_while_the_master_switch_is_off(world):  # noqa: F811
    _app, c, _ids = world
    out = c.get(f"{API}/home/presence", headers=as_user("vera")).json()
    assert out["enabled"] is False and out["people"] == []


def test_feature_map_reflects_switches_and_permissions(world):  # noqa: F811
    _app, c, _ids = world
    f = c.get(f"{API}/home/family", headers=as_user("vera")).json()["features"]
    assert set(f) == {"presence", "calendar", "notices", "transit", "tickets", "schedules", "scenes", "weather", "notif"}
    assert f["presence"] == {"on": False, "can": True}  # viewer holds presence.report
    assert f["tickets"]["on"] is False and f["tickets"]["create"] is False
    assert f["schedules"]["manage"] is False and f["scenes"]["capture"] is False
    assert f["weather"] is False and f["notif"] == {"phones": 0}


# ---------------------------------------------------------------- service requests

def test_a_resident_sees_only_the_tickets_they_opened(settings):
    w = tickets_build(settings)
    # nora (a creator who is not a member) opens one from the home interface, tom (a member) opens another
    r = w.c.post(f"{API}/home/tickets", json={"department_id": "dept-maintenance", "title": "נזילה במטבח", "where": "מטבח", "text": "מטפטף מהברז",
                                             "client_request_id": rid()}, headers=w.h("nora"))
    assert r.status_code == 201, r.text
    mine = r.json()["id"]
    other = w.create("tom", "נורה שרופה")["id"]
    out = w.c.get(f"{API}/home/tickets", headers=w.h("nora")).json()
    assert [t["id"] for t in out["items"]] == [mine] and out["items"][0]["step"] == 0 and out["items"][0]["place_text"] == "מטבח"
    assert out["can_create"] and any(c["department_id"] == "dept-maintenance" for c in out["categories"])
    # the member sees the department's tickets in the full interface, but the home list is only what HE opened
    assert [t["id"] for t in w.c.get(f"{API}/home/tickets", headers=w.h("tom")).json()["items"]] == [other]
    assert w.c.get(f"{API}/home/tickets/{other}", headers=w.h("nora")).status_code == 404
    assert w.c.get(f"{API}/home/tickets/{mine}", headers=w.h("tom")).status_code == 404  # visible to him as a member, but not his
    n = w.c.post(f"{API}/home/tickets/{mine}/notes", json={"text": "עדיין מטפטף"}, headers=w.h("nora"))
    assert n.status_code == 201, n.text


def test_tickets_module_off_means_no_ticket_route(settings):
    w = tickets_build(settings)
    assert w.c.patch(f"{API}/settings", json={"tickets.enabled": "false"}).status_code == 200
    for r in (w.c.get(f"{API}/home/tickets", headers=w.h("nora")),
              w.c.post(f"{API}/home/tickets", json={"department_id": "dept-maintenance", "title": "x", "client_request_id": rid()}, headers=w.h("nora"))):
        assert r.status_code == 404 and r.json()["code"] == "feature_disabled"
    assert w.c.get(f"{API}/home/family", headers=w.h("nora")).json()["features"]["tickets"]["on"] is False


def test_a_viewer_without_ticket_permissions_is_refused(settings):
    w = tickets_build(settings)
    assert w.c.get(f"{API}/home/tickets", headers=w.h("vic")).status_code == 403


# ---------------------------------------------------------------- my notifications

def test_muting_reaches_every_own_phone_and_never_a_critical_category(world):  # noqa: F811
    _app, c, _ids = world
    for i in range(2):
        r = c.post(f"{API}/presence/devices", json={"name": f"טלפון {i}", "platform": "ios", "install_id": f"vera{i:0<4}-0000-0000-0000-000000000000"}, headers=as_user("vera"))
        assert r.status_code in (200, 201), r.text
    phone(c, "dana", "dana0000-0000-0000-0000-000000000000")
    r = c.put(f"{API}/home/notify", json={"muted": ["building", "safety"]}, headers=as_user("vera"))
    assert r.status_code == 200, r.text
    cats = {x["id"]: x for x in r.json()["categories"]}
    assert cats["building"]["on"] is False and cats["safety"]["on"] is True and cats["safety"]["critical"] is True
    assert r.json()["phones"] == 2
    with c.app.state.db.connection() as conn:
        rows = conn.execute("SELECT u.username, d.push_muted_json FROM mobile_devices d JOIN users u ON u.id = d.user_id").fetchall()
    assert {r["push_muted_json"] for r in rows if r["username"] == "vera"} == {'["building"]'}
    assert all(r["push_muted_json"] in (None, "[]") for r in rows if r["username"] == "dana")  # another person's phone is untouched
    assert c.put(f"{API}/home/notify", json={"muted": ["nope"]}, headers=as_user("vera")).status_code == 422


def test_night_window_validation_and_rule(world):  # noqa: F811
    _app, c, _ids = world
    assert c.put(f"{API}/home/notify", json={"dnd": {"enabled": True, "start": "25:00"}}, headers=as_user("vera")).status_code == 422
    assert c.put(f"{API}/home/notify", json={"dnd": {"enabled": True, "start": "07:00", "end": "07:00"}}, headers=as_user("vera")).status_code == 422
    r = c.put(f"{API}/home/notify", json={"dnd": {"enabled": True}}, headers=as_user("vera"))
    assert r.status_code == 200 and r.json()["dnd"] == {"enabled": True, "start": "22:00", "end": "07:00"}
    uid = "dev-vera"
    utc = dt.timezone.utc
    with c.app.state.db.connection() as conn:
        assert hf.dnd_active(conn, uid, dt.datetime(2026, 11, 11, 23, 30, tzinfo=utc), "UTC")
        assert hf.dnd_active(conn, uid, dt.datetime(2026, 11, 11, 3, 0, tzinfo=utc), "UTC")
        assert not hf.dnd_active(conn, uid, dt.datetime(2026, 11, 11, 12, 0, tzinfo=utc), "UTC")
        assert hf.dnd_active(conn, uid, dt.datetime(2026, 11, 11, 20, 30, tzinfo=utc), "Asia/Jerusalem")  # 22:30 local
        at = dt.datetime(2026, 11, 11, 23, 30, tzinfo=utc)
        assert mobile_push._dnd_holds(conn, uid, "building", at, "UTC")
        assert not mobile_push._dnd_holds(conn, uid, "doors", at, "UTC") and not mobile_push._dnd_holds(conn, uid, "security", at, "UTC")
        assert not mobile_push._dnd_holds(conn, uid, "safety", at, "UTC")
        assert not mobile_push._dnd_holds(conn, "dev-dana", "building", at, "UTC")  # nobody else is held


# ---------------------------------------------------------------- scene schedules, weather, buses

def test_scene_schedule_draft_is_scene_only():
    d = hf.scene_draft("בוקר", "scene.morning", "07:00", ["mon", "sun", "tue"])
    assert d["weekdays"] == ["sun", "mon", "tue"] and d["slots"] == [{"start": "07:00", "actions": [{"service": "scene.turn_on", "entity_id": "scene.morning"}]}]
    assert hf.scene_draft("", "scene.x", "23:30", list(hf.DAYS))["weekdays"] == ["daily"]
    for bad in (("x", "light.kitchen", "07:00", ["mon"]), ("x", "scene.a", "7:00", ["mon"]), ("x", "scene.a", "07:00", [])):
        with pytest.raises(hf.HomeFamilyError):
            hf.scene_draft(*bad)
    one = {"slots": [{"actions": [{"service": "scene.turn_on", "entity_id": "scene.a"}]}]}
    assert hf.is_scene_schedule(one) == "scene.a"
    assert hf.is_scene_schedule({"slots": [{"actions": [{"service": "light.turn_on", "entity_id": "light.a"}]}]}) is None
    assert hf.is_scene_schedule({"slots": [{"actions": [{"service": "scene.turn_on", "entity_id": "scene.a"}, {"service": "scene.turn_on", "entity_id": "scene.b"}]}]}) is None


def test_schedules_off_answers_feature_disabled(world):  # noqa: F811
    _app, c, _ids = world
    r = c.get(f"{API}/home/schedules")
    assert r.status_code == 404 and r.json()["code"] == "feature_disabled"


def test_buses_strip_is_off_without_the_transit_module(world):  # noqa: F811
    _app, c, _ids = world
    assert c.get(f"{API}/home/buses", headers=as_user("vera")).json()["state"] == "off"


T = "2026-11-11T10:00:00+00:00"


def test_weather_now_hours_and_days(settings, monkeypatch):
    from smplwise.main import create_app
    from smplwise.services import ha_client, ha_sync

    soon = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)
    fc = [{"datetime": (soon + dt.timedelta(hours=i)).isoformat(), "condition": "cloudy", "temperature": 20 - i, "precipitation_probability": 10} for i in range(10)]
    states = [{"entity_id": "weather.home", "state": "sunny", "last_changed": T, "last_updated": T,
               "attributes": {"friendly_name": "Home", "temperature": 22, "apparent_temperature": 23, "wind_speed": 12, "wind_speed_unit": "km/h", "humidity": 40, "forecast": fc}}]
    s = replace(settings, ha_url="http://ha.local:8123", ha_token="secret-token-value")
    monkeypatch.setattr(ha_client, "get_states", lambda _s: states)
    a = create_app(s)
    ha_sync.STATE.connected = True
    ha_sync.snapshot(a.state.db, s)
    c = TestClient(a)
    c.get(f"{API}/me")
    w = c.get(f"{API}/home/weather").json()["weather"]
    assert w["now"]["t"] == 22 and w["now"]["feels"] == 23 and w["now"]["wind"] == 12 and w["now"]["rain"] == 10
    assert len(w["hours"]) >= 1 and "days" in w
    assert c.get(f"{API}/home/family").json()["features"]["weather"] is True
