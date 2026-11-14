"""CR-038 slice 3 - the device integration (section 12): the place of a device (12.2), the frozen 24 h history a device ticket carries
(12.3: person names removed, truncation, the security-domain rule of D3 / D23), device-originated creation, the device tab route
`GET /tickets/by-entity/{entity_id}` (tickets.view AND devices.read on the entity - review T18-3), the long-press setting D17 and its
/me flag. Fakes only: entities, anchors, rooms and history rows are written straight into the test database."""
from __future__ import annotations

import datetime as dt
import json
import sqlite3

import pytest
from conftest import as_user, bind
from tickets_world import API, MAINT, World, build, rid

from smplwise.db import Database
from smplwise.services.tickets import device_context, place

NOW = dt.datetime.now(dt.timezone.utc)


def iso(minutes_ago: float) -> str:
    return (NOW - dt.timedelta(minutes=minutes_ago)).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def raw(w: World) -> sqlite3.Connection:
    """A raw connection without foreign keys (the anchors name a plan version the test never uploads)."""
    conn = sqlite3.connect(w.settings.db_path, isolation_level=None)
    conn.execute("PRAGMA foreign_keys=OFF")
    return conn


def entity(conn, eid: str, name: str, *, registry: str | None = None, area: tuple[str, str] | None = None, ha_floor: str | None = None, device_class: str | None = None) -> None:
    conn.execute(
        "INSERT INTO ha_entities(entity_id, registry_id, name, domain, device_class, area_id, area_name, ha_floor_name, state, first_seen_at, updated_at) "
        "VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        (eid, registry, name, eid.split(".")[0], device_class, area[0] if area else None, area[1] if area else None, ha_floor, "on", iso(9999), iso(0)),
    )


def anchor(conn, aid: str, floor: str, eid: str, x: float, y: float) -> None:
    conn.execute(
        "INSERT INTO map_anchors(id, floor_id, plan_version_id, resource_type, resource_id, x, y, rotation_degrees, layer_id, revision, effective_from, created_by, updated_by, updated_at) "
        "VALUES (?,?,?,?,?,?,?,0,'devices',1,?,'test','test',?)",
        (aid, floor, "pv-test", "ha_entity", eid, x, y, iso(9999), iso(9999)),
    )


def room(conn, zid: str, floor: str, name: str, box: tuple[float, float, float, float], ha_area: str | None = None) -> None:
    x0, y0, x1, y1 = box
    poly = [{"x": x0, "y": y0}, {"x": x1, "y": y0}, {"x": x1, "y": y1}, {"x": x0, "y": y1}]
    conn.execute("INSERT INTO spatial_zones(id, floor_id, name, kind, polygon_json, created_at, updated_at) VALUES (?,?,?,'room',?,?,?)",
                 (zid, floor, name, json.dumps(poly), iso(9999), iso(9999)))
    if ha_area:
        conn.execute("UPDATE spatial_zones SET ha_area_id = ? WHERE id = ?", (ha_area, zid))


def activity(conn, eid: str, minutes_ago: float, actor: str, name: str | None, frm: str, to: str, **extra) -> None:
    conn.execute(
        "INSERT INTO device_activity(entity_id, domain, at_utc, kind, actor_type, actor_ref, actor_name, source_type, source_name, via, confidence, from_json, to_json) "
        "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (eid, eid.split(".")[0], iso(minutes_ago), "power", actor, "u-ref" if actor == "person" else None, name, extra.get("source_type"), extra.get("source_name"),
         "ha", "exact", json.dumps({"state": frm, **extra.get("from_attrs", {})}), json.dumps({"state": to})),
    )


@pytest.fixture
def w(settings) -> World:
    world = build(settings)
    conn = raw(world)
    f2, f3 = world.floors["floor2"], world.floors["floor3"]
    room(conn, "z-102", f2, "חדר 102", (0.0, 0.0, 0.5, 0.5))
    room(conn, "z-wing", f2, "אגף מערבי", (0.0, 0.0, 1.0, 1.0))  # the bigger room around it: the smallest one wins
    room(conn, "z-lobby", f3, "לובי", (0.0, 0.0, 1.0, 1.0), ha_area="area_lobby")
    entity(conn, "climate.ac_102", "מזגן חדר 102", registry="reg-ac-102")
    anchor(conn, "a-ac", f2, "climate.ac_102", 0.2, 0.2)
    entity(conn, "light.both_floors", "פס תאורה")
    anchor(conn, "a-l2", f2, "light.both_floors", 0.9, 0.9)
    anchor(conn, "a-l3", f3, "light.both_floors", 0.5, 0.5)
    entity(conn, "sensor.lobby_temp", "טמפרטורה לובי", area=("area_lobby", "לובי HA"))
    entity(conn, "sensor.loose", "חיישן חופשי", area=("area_x", "מחסן"), ha_floor="קומת קרקע")
    entity(conn, "fan.lobby", "מאוורר לובי")
    anchor(conn, "a-fan", f3, "fan.lobby", 0.4, 0.4)
    entity(conn, "lock.front", "דלת כניסה")
    anchor(conn, "a-lock", f2, "lock.front", 0.1, 0.1)
    entity(conn, "cover.shade", "תריס")
    anchor(conn, "a-cover", f2, "cover.shade", 0.1, 0.3)
    # the air conditioner's day: a person, an automation and a schedule; one row older than the 24 h window
    activity(conn, "climate.ac_102", 30, "person", "דנה כהן", "cool", "off")
    activity(conn, "climate.ac_102", 120, "automation", "קירור בוקר", "off", "cool", source_type="automation", source_name="קירור בוקר", from_attrs={"temperature": 22})
    activity(conn, "climate.ac_102", 60 * 30, "person", "יוסי לוי", "off", "cool")
    for i, s in enumerate(("21.5", "22.0", "22.4")):
        conn.execute("INSERT INTO ha_state_history(entity_id, state, changed_at, recorded_at) VALUES (?,?,?,?)", ("sensor.lobby_temp", s, iso(300 - i * 60), iso(0)))
    conn.close()
    return world


def device_ticket(w: World, user: str, eid: str, title: str = "לא מקרר", **extra):
    return w.c.post(f"{API}/tickets", json={"department_id": MAINT, "title": title, "client_request_id": rid(), "entity_id": eid, **extra}, headers=w.h(user))


# ---------------------------------------------------------------- 12.2 place resolution

def test_place_from_the_anchor_the_smallest_room_and_other_floors(w):
    with Database(w.settings.db_path).connection(mode="read") as conn:
        p = place.locate_entity(conn, "climate.ac_102")
        assert (p.floor_id, p.zone_id) == (w.floors["floor2"], "z-102") and p.building_id and p.site_id
        assert p.place_text.endswith(" · חדר 102") and len(p.place_text.split(" · ")) == 2, "<floor> · <room>; one building: no building name"
        both = place.locate_entity(conn, "light.both_floors")
        assert both.floor_id == w.floors["floor2"], "the lowest floor level is the place"
        assert both.zone_id == "z-wing" and len(both.others) == 1 and "(+ " in both.place_text
        linked = place.locate_entity(conn, "sensor.lobby_temp")
        assert (linked.floor_id, linked.zone_id, linked.area_id) == (w.floors["floor3"], "z-lobby", "area_lobby"), "no anchor: the room linked to its HA area"
        loose = place.locate_entity(conn, "sensor.loose")
        assert loose.floor_id is None and loose.site_id is None and loose.place_text == "קומת קרקע · מחסן", "HA names only: placeless for RBAC"
        assert place.locate_entity(conn, "light.nope") == place.Place()


# ---------------------------------------------------------------- device-originated creation + the frozen snapshot (12.3)

def test_device_ticket_carries_place_and_a_frozen_history_without_person_names(w):
    r = device_ticket(w, "tom", "climate.ac_102")
    assert r.status_code == 201, r.text
    t = r.json()
    assert t["origin"] == "device" and t["entity_id"] == "climate.ac_102" and t["device_name"] == "מזגן חדר 102" and "חדר 102" in t["place_text"]
    ctx = w.detail(t["id"], "tom")["device_context"]
    assert ctx["source"] == "device_activity" and ctx["count"] == 2 and ctx["truncated"] is False and ctx["withheld"] is None
    text = json.dumps(ctx, ensure_ascii=False)
    assert "דנה כהן" not in text and "יוסי לוי" not in text and "u-ref" not in text, "person names never stored"
    person, auto = ctx["lines"]
    assert person["actor"] == {"type": "person"} and auto["actor"] == {"type": "automation", "name": "קירור בוקר"}
    assert auto["from"] == {"state": "off", "temperature": 22} and "source" not in auto
    with Database(w.settings.db_path).connection(mode="read") as conn:
        row = conn.execute("SELECT entity_id, registry_id, floor_id, zone_id FROM tickets WHERE id = ?", (t["id"],)).fetchone()
        assert tuple(row) == ("climate.ac_102", "reg-ac-102", w.floors["floor2"], "z-102")
        audit = conn.execute("SELECT details_json FROM audit_log WHERE action = 'ticket.create' AND resource_id = ?", (t["id"],)).fetchone()[0]
        assert "דנה" not in audit and '"history":"device_activity"' in audit.replace(" ", "")
    assert any(e["kind"] == "device_context" and e["data"]["count"] == 2 for e in w.detail(t["id"])["events"])
    # frozen: a later change of the device never alters the ticket's snapshot
    conn = raw(w)
    activity(conn, "climate.ac_102", 1, "person", "דנה כהן", "off", "cool")
    conn.close()
    assert w.detail(t["id"], "tom")["device_context"]["count"] == 2


def test_snapshot_of_an_untracked_entity_is_its_state_history_and_truncation_is_flagged(w):
    t = device_ticket(w, "tom", "sensor.lobby_temp", "חם בלובי").json()
    ctx = w.detail(t["id"])["device_context"]
    assert ctx["source"] == "state_history" and [x["to"]["state"] for x in ctx["lines"]] == ["22.4", "22.0", "21.5"]
    assert ctx["lines"][0]["from"] == {"state": "22.0"}
    conn = raw(w)
    for i in range(device_context.LIMIT + 5):
        conn.execute("INSERT INTO ha_state_history(entity_id, state, changed_at, recorded_at) VALUES (?,?,?,?)", ("sensor.loose", str(i), iso(600 - i), iso(0)))
    conn.close()
    t2 = device_ticket(w, "tom", "sensor.loose", "חיישן").json()
    ctx2 = w.detail(t2["id"])["device_context"]
    assert ctx2["truncated"] is True and ctx2["count"] == device_context.LIMIT


def test_a_device_the_creator_cannot_read_is_unknown_and_the_place_decides_tickets_create(w, settings):
    assert device_ticket(w, "tom", "light.nope").status_code == 422
    # fred: operator on floor 2 only - the lobby sensor sits on floor 3 (not his), the air conditioner on floor 2 (his)
    r = device_ticket(w, "fred", "sensor.lobby_temp")
    assert r.status_code == 422 and r.json()["details"]["fields"][0] == {"field": "entity_id", "code": "unknown"}, "a hidden device does not leak"
    assert device_ticket(w, "fred", "climate.ac_102").status_code == 201
    # a viewer may read the lock but does not operate it: the lock is "unknown" to them in the module (the activity route's rule)
    bind(w.c, settings, "vera", "viewer", "installation", "*")
    bind(w.c, settings, "vera", "tickets_create", "installation", "*")
    assert device_ticket(w, "vera", "lock.front").status_code == 422
    assert device_ticket(w, "vera", "cover.shade").status_code == 201
    assert device_ticket(w, "tom", "lock.front").status_code == 201, "an operator operates locks (ha.entity.control)"
    # tickets.create must be held WHERE the ticket lies: gil holds it (and devices.read) on floor 3 only
    assert device_ticket(w, "gil", "climate.ac_102").status_code == 422, "floor 2: not a device gil may read"
    r = device_ticket(w, "gil", "light.both_floors")
    assert r.status_code == 403 and r.json()["code"] == "forbidden", "gil reads it on floor 3, but its place is the lowest floor (12.2)"
    assert device_ticket(w, "gil", "fan.lobby").status_code == 201


def test_create_answer_lists_the_other_open_tickets_of_the_device(w):
    first = device_ticket(w, "tom", "climate.ac_102").json()
    second = device_ticket(w, "tom", "climate.ac_102", "רעש").json()
    assert [x["id"] for x in second["open_for_entity"]] == [first["id"]]
    assert w.status("joni", first["id"], "cancelled", "כפול", duplicate_of=second["id"]).status_code == 200
    assert device_ticket(w, "tom", "climate.ac_102", "שלישי").json()["open_for_entity"][0]["id"] == second["id"]


# ---------------------------------------------------------------- the device tab route (section 8, review T18-3)

def test_by_entity_gates_module_permission_device_then_each_ticket(w, settings):
    url = f"{API}/tickets/by-entity/climate.ac_102"
    mine = device_ticket(w, "nora", "climate.ac_102", "של נורה").json()
    other = device_ticket(w, "tom", "climate.ac_102", "של תום").json()
    body = w.c.get(url, headers=w.h("tom")).json()
    assert {x["id"] for x in body["items"]} == {mine["id"], other["id"]} and body["open_count"] == 2
    assert body["entity"] == {"entity_id": "climate.ac_102", "name": "מזגן חדר 102", "domain": "climate", "tracked": True}
    assert body["can_create"] is True and body["history"]["count"] == 2 and "דנה" not in json.dumps(body, ensure_ascii=False)
    assert "חדר 102" in body["place_text"]
    # nora is not a member: only the ticket she opened
    assert [x["id"] for x in w.c.get(url, headers=w.h("nora")).json()["items"]] == [mine["id"]]
    # no tickets.view: an audited 403; tickets.view without devices.read on the entity: the uniform 404
    assert w.c.get(url, headers=w.h("vic")).status_code == 403
    assert w.c.get(url, headers=w.h("alda")).status_code == 404, "alda holds tickets.view everywhere but no devices.read"
    assert w.c.get(f"{API}/tickets/by-entity/sensor.lobby_temp", headers=w.h("fred")).status_code == 404, "placed on a floor fred may not read"
    assert w.c.get(f"{API}/tickets/by-entity/light.nope", headers=w.h("tom")).status_code == 404
    assert w.c.get(f"{API}/tickets/by-entity/NOT-AN-ENTITY", headers=w.h("tom")).status_code == 422
    # a lock: the module follows the activity route's rule (a viewer reads the device but does not operate it)
    bind(w.c, settings, "vera", "viewer", "installation", "*")
    bind(w.c, settings, "vera", "tickets_view", "installation", "*")
    assert w.c.get(f"{API}/tickets/by-entity/lock.front", headers=w.h("vera")).status_code == 404
    assert w.c.get(f"{API}/tickets/by-entity/lock.front", headers=w.h("tom")).status_code == 200
    vera = w.c.get(url, headers=w.h("vera")).json()
    assert vera["can_create"] is False and vera["history"] is None, "no tickets.create: no preview of what a new one would carry"
    # module off: the uniform feature_disabled
    assert w.c.patch(f"{API}/settings", json={"tickets.enabled": "false"}).status_code == 200
    assert w.c.get(url, headers=w.h("tom")).json()["code"] == "feature_disabled"


def test_by_entity_follows_a_rename_through_the_registry_id(w):
    t = device_ticket(w, "tom", "climate.ac_102").json()
    conn = raw(w)
    conn.execute("UPDATE ha_entities SET entity_id = 'climate.ac_room_102' WHERE entity_id = 'climate.ac_102'")
    conn.execute("UPDATE map_anchors SET resource_id = 'climate.ac_room_102' WHERE resource_id = 'climate.ac_102'")
    conn.close()
    body = w.c.get(f"{API}/tickets/by-entity/climate.ac_room_102", headers=w.h("tom")).json()
    assert [x["id"] for x in body["items"]] == [t["id"]]


def test_device_context_on_the_detail_is_internal_and_needs_the_device(w):
    t = device_ticket(w, "nora", "climate.ac_102").json()
    assert w.detail(t["id"], "nora")["device_context"] is None, "a creator who is not a member: no internal content"
    assert w.detail(t["id"], "tom")["device_context"]["count"] == 2
    assert w.detail(t["id"], "alda")["device_context"] is None, "all departments, but no devices.read on the entity"
    manual = w.create("tom")
    assert w.detail(manual["id"])["device_context"] is None


# ---------------------------------------------------------------- D3 / D23: the history for the handler

def test_history_is_never_shareable_for_security_domains_whatever_is_asked():
    snap = {"source": "device_activity", "withheld": None, "items": [{"at": "x"}]}
    for eid in ("lock.front", "alarm_control_panel.home", "cover.garage", "camera.gate"):
        assert device_context.share_history_allowed(eid, snap) is False
        assert device_context.resolve_share_history(eid, snap, True, {"share_history_external": 1}, 1) is False
    assert device_context.share_history_allowed("climate.ac", snap) is True
    assert device_context.share_history_allowed("climate.ac", {**snap, "withheld": "permission"}) is False
    assert device_context.share_history_allowed("climate.ac", {**snap, "source": "none"}) is False
    assert device_context.share_history_allowed(None, snap) is False
    # the three levels: per ticket wins, else the contact, else the department (default off)
    assert device_context.resolve_share_history("climate.ac", snap, None, {"share_history_external": 0}) is False
    assert device_context.resolve_share_history("climate.ac", snap, None, {"share_history_external": 1}) is True
    assert device_context.resolve_share_history("climate.ac", snap, None, {"share_history_external": 1}, 0) is False
    assert device_context.resolve_share_history("climate.ac", snap, True, {"share_history_external": 0}, 0) is True


def test_shareable_flag_on_the_detail(w):
    ac = device_ticket(w, "tom", "climate.ac_102").json()
    shade = device_ticket(w, "tom", "cover.shade").json()
    assert w.detail(ac["id"])["device_context"]["shareable"] is True
    assert w.detail(shade["id"])["device_context"]["shareable"] is False


def test_clean_activity_item_drops_names_sources_and_non_scalars():
    item = {"id": 5, "at": "t", "kind": "value", "actor": {"type": "person", "name": "דנה"}, "source": {"type": "automation", "name": "x"},
            "from": {"state": "on", "rgb_color": [1, 2, 3], "brightness_pct": 40}, "to": {"state": "on"}, "changed": ["brightness_pct"], "via": "arx"}
    assert device_context.clean_activity_item(item) == {"at": "t", "kind": "value", "from": {"state": "on", "brightness_pct": 40}, "to": {"state": "on"},
                                                        "changed": ["brightness_pct"], "actor": {"type": "person"}}


# ---------------------------------------------------------------- D17: the long-press setting and its /me flag

def test_long_press_setting_reaches_me(w, settings):
    assert w.c.get(f"{API}/me").json()["modules"]["tickets_long_press"] == "sheet", "default: today's behaviour"
    assert w.c.get(f"{API}/tickets/settings").json()["device_long_press"] == "sheet"
    assert w.c.put(f"{API}/tickets/settings", json={"revision": 0, "device_long_press": "popup"}).status_code == 422
    bind(w.c, settings, "cara", "tickets_configure", "installation", "*")
    assert w.c.put(f"{API}/tickets/settings", json={"revision": 0, "device_long_press": "menu"}, headers=as_user("cara")).status_code == 403
    r = w.c.put(f"{API}/tickets/settings", json={"revision": 0, "device_long_press": "menu"})
    assert r.status_code == 200 and r.json()["device_long_press"] == "menu" and r.json()["ui"]["detail"] == "drawer_fullscreen"
    assert w.c.get(f"{API}/me", headers=w.h("tom")).json()["modules"]["tickets_long_press"] == "menu"
    with Database(w.settings.db_path).connection(mode="read") as conn:
        details = conn.execute("SELECT details_json FROM audit_log WHERE action = 'tickets.settings.update' ORDER BY rowid DESC LIMIT 1").fetchone()[0]
    assert "device_long_press" in details


def test_meta_categories_carry_their_device_domains(w):
    cat = w.c.post(f"{API}/tickets/admin/departments/{MAINT}/categories", json={"name": "מיזוג"}).json()
    cid = next(c["id"] for c in cat["categories"] if c["name"] == "מיזוג")
    conn = raw(w)
    conn.execute("UPDATE ticket_categories SET domains_json = ? WHERE id = ?", (json.dumps(["climate", 7]), cid))
    conn.close()
    meta = w.c.get(f"{API}/tickets/meta", headers=w.h("tom")).json()
    got = next(c for d in meta["departments"] if d["id"] == MAINT for c in d["categories"] if c["id"] == cid)
    assert got["domains"] == ["climate"]
