"""CR-LIVEEVENT100 (board r100) - the live event mode, backend (docs/changes/CR-LIVEEVENT100.md section 7, B-01..B-09). Fakes only: no
NVR, no Home Assistant, no door, no go2rtc. The incident is scoped to its floor; every panel keeps its own permission; nothing physical is
operated by any route here."""
from __future__ import annotations

import datetime as dt
import json

import pytest
from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient

from smplwise.db import new_id, now_iso, permission_revision, bump_permission_revision
from smplwise.main import create_app, janitor_tick
from smplwise.routers import incidents as incidents_router
from smplwise.services import ha_sync
from smplwise.services import incidents as svc

API = "/api/v1"


def _st(entity_id: str, state: str, **attrs):
    t = "2026-10-23T09:00:00+00:00"
    return {"entity_id": entity_id, "state": state, "last_changed": t, "last_updated": t, "attributes": attrs}


def _box(x0: float, y0: float, x1: float, y1: float) -> str:
    return json.dumps([{"x": x0, "y": y0}, {"x": x1, "y": y0}, {"x": x1, "y": y1}, {"x": x0, "y": y1}])


class World:
    """Two floors with a published plan; floor 2: a parking room (0.1..0.5) with camera A and a lock, a machine room beside it (0.5..0.9)
    with camera B, camera C far away on the floor; floor 3: camera D. Users: joni (system admin), dana (operator at floor 2), eve
    (events only at floor 2 + live video of camera A only), zed (events only at floor 2, no video at all)."""

    def __init__(self, settings) -> None:
        self.settings = settings
        self.app = create_app(settings)
        self.c = TestClient(self.app)
        self.ids = seed_tree(self.c)
        self.f2, self.f3 = self.ids["floor2"], self.ids["floor3"]
        self.cam = {}
        for key, ch, alias in (("A", 1, "חניון מזרח"), ("B", 2, "חדר מכונות"), ("C", 3, "כניסה רחוקה"), ("D", 4, "קומה 3")):
            self.cam[key] = self.c.post(f"{API}/cameras", json={"channel": ch, "alias": alias}).json()["id"]
        for floor in (self.f2, self.f3):
            asset = self.c.post(f"{API}/floors/{floor}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
            v = self.c.post(f"{API}/floors/{floor}/plan-versions", json={"asset_id": asset["id"]}).json()
            self.c.post(f"{API}/plan-versions/{v['id']}/publish")
        with self.app.state.db.connection() as conn:
            ha_sync.upsert_state(conn, _st("lock.parking", "unlocked", friendly_name="דלת חניון"))
            ha_sync.upsert_state(conn, _st("binary_sensor.machine_door", "off", device_class="door", friendly_name="דלת חדר מכונות"))
            ha_sync.upsert_state(conn, _st("light.far", "on", friendly_name="תאורה"))
            ha_sync.upsert_state(conn, _st("alarm_control_panel.home", "armed_away", friendly_name="אזעקה"))
            now = now_iso()
            for zid, name, poly in (("z-park", "חניון", _box(0.1, 0.1, 0.5, 0.5)), ("z-mach", "חדר מכונות", _box(0.5, 0.1, 0.9, 0.5))):
                conn.execute("INSERT INTO spatial_zones(id, floor_id, name, kind, polygon_json, created_at, updated_at) VALUES (?,?,?,'room',?,?,?)", (zid, self.f2, name, poly, now, now))
        self.place(self.f2, "camera", self.cam["A"], 0.30, 0.30)
        self.place(self.f2, "camera", self.cam["B"], 0.70, 0.30)
        self.place(self.f2, "camera", self.cam["C"], 0.95, 0.95)
        self.place(self.f3, "camera", self.cam["D"], 0.50, 0.50)
        self.place(self.f2, "ha_entity", "lock.parking", 0.32, 0.28)
        self.place(self.f2, "ha_entity", "binary_sensor.machine_door", 0.52, 0.30)
        self.place(self.f2, "ha_entity", "light.far", 0.33, 0.33)
        with self.app.state.db.connection() as conn:
            conn.execute("INSERT INTO custom_roles(id, name_he, permissions_json, created_at, updated_at) VALUES ('events_only', 'אירועים בלבד', ?, ?, ?)",
                         (json.dumps(["events.read", "events.ack", "map.read"]), now_iso(), now_iso()))
            bump_permission_revision(conn)
        bind(self.c, settings, "dana", "operator", "floor", self.f2)
        bind(self.c, settings, "eve", "events_only", "floor", self.f2)
        bind(self.c, settings, "eve", "kiosk", "camera", self.cam["A"])
        bind(self.c, settings, "zed", "events_only", "floor", self.f2)

    def place(self, floor: str, rt: str, rid: str, x: float, y: float) -> None:
        r = self.c.post(f"{API}/floors/{floor}/anchors", json={"resource_type": rt, "resource_id": rid, "x": x, "y": y, **({"layer_id": "doors"} if rt == "ha_entity" else {})})
        assert r.status_code == 201, r.text

    def h(self, user: str) -> dict[str, str]:
        return as_user(user)

    def enable(self, **extra) -> None:
        r = self.c.put(f"{API}/incidents/settings", json={"settings": {"incident.enabled": True, **extra}})
        assert r.status_code == 200, r.text

    def open_manual(self, floor: str | None = None, x: float = 0.3, y: float = 0.25, user: str | None = None, title: str = "פריצה · חניון"):
        return self.c.post(f"{API}/incidents", json={"floor_id": floor or self.f2, "x": x, "y": y, "title": title}, headers=self.h(user) if user else None)

    def event(self, cam_key: str = "A", eid: str | None = None) -> str:
        eid = eid or new_id()
        at = now_iso()
        with self.app.state.db.connection() as conn:
            conn.execute(
                "INSERT INTO events(id, source, raw_type, type, camera_id, channel, occurred_at, ended_at, received_at, state, count, severity, confidence, details_json, dedup_key, created_at) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (eid, "alertstream", "fielddetection", "field", self.cam[cam_key], 1, at, None, at, "inactive", 1, "alert", "measured", "{}", f"t:{eid}", at))
        return eid

    def rows(self, sql: str, args: tuple = ()) -> list:
        with self.app.state.db.connection() as conn:
            return [dict(r) for r in conn.execute(sql, args).fetchall()]

    def audit_actions(self) -> list[str]:
        return [r["action"] for r in self.rows("SELECT action FROM audit_log ORDER BY id")]


@pytest.fixture()
def w(settings) -> World:
    return World(settings)


# ---------------------------------------------------------------- B-01: OFF by default, everything closed

def test_b01_module_off_by_default_every_route_closed(w):
    assert w.c.get(f"{API}/me").json()["modules"]["incidents"] is False
    assert w.c.get(f"{API}/incidents/summary").json() == {"enabled": False, "open": 0, "latest_id": None, "red_dot": "off"}
    for method, path, body in (("get", "/incidents", None), ("post", "/incidents", {"floor_id": w.f2}), ("get", "/incidents/x", None),
                               ("get", "/incidents/x/cameras", None), ("get", "/incidents/x/doors", None), ("post", "/incidents/x/ack", None),
                               ("post", "/incidents/x/note", {"text": "a"}), ("post", "/incidents/x/close", {})):
        r = getattr(w.c, method)(API + path, **({"json": body} if body is not None else {}))
        assert r.status_code == 404 and r.json()["code"] == "feature_disabled", (path, r.text)
    s = w.c.get(f"{API}/incidents/settings").json()
    assert s["settings"]["incident.enabled"] is False and s["settings"]["incident.auto_open.alarm"] is False and s["can_edit"] is True
    # the alarm hook opens nothing while the module is off - even with the auto-open switch on
    w.c.put(f"{API}/incidents/settings", json={"settings": {"incident.auto_open.alarm": True}})
    with w.app.state.db.connection() as conn:
        assert svc.on_ha_state(conn, _st("alarm_control_panel.home", "armed_away"), _st("alarm_control_panel.home", "triggered")) is None
    assert w.rows("SELECT * FROM incidents") == []


# ---------------------------------------------------------------- B-09: every setting editable, bounded, audited

def test_b09_settings_bounds_permission_and_audit(w):
    bad = ({"incident.max_live": 7}, {"incident.max_live": 0}, {"incidents.retention_days": 29}, {"incidents.retention_days": 3651},
           {"incident.merge_window_s": 3601}, {"incident.merge_window_s": -1}, {"incident.red_dot": "always"}, {"incident.enabled": "true"},
           {"incident.max_live_phone": 3}, {"incident.unknown": 1}, {"incident.max_live": True})
    for body in bad:
        r = w.c.put(f"{API}/incidents/settings", json={"settings": body})
        assert r.status_code == 422, body
    assert w.rows("SELECT * FROM settings WHERE key LIKE 'incident%'") == [], "a refused PUT writes nothing"
    r = w.c.put(f"{API}/incidents/settings", json={"settings": {"incident.enabled": True, "incident.max_live": 6, "incident.merge_window_s": 0,
                                                                "incidents.retention_days": 30, "incident.red_dot": "off", "incident.header_clock": False}})
    assert r.status_code == 200
    s = r.json()["settings"]
    assert (s["incident.max_live"], s["incident.merge_window_s"], s["incidents.retention_days"], s["incident.red_dot"], s["incident.header_clock"]) == (6, 0, 30, "off", False)
    assert w.c.get(f"{API}/me").json()["modules"]["incidents"] is True
    acts = w.audit_actions()
    assert "incident.module.enable" in acts and "incident.settings" in acts
    # an operator reads the values but cannot change them
    assert w.c.get(f"{API}/incidents/settings", headers=w.h("dana")).json()["can_edit"] is False
    assert w.c.put(f"{API}/incidents/settings", json={"settings": {"incident.max_live": 2}}, headers=w.h("dana")).status_code == 403
    # a corrupt stored value reads as the default, never out of bounds
    with w.app.state.db.connection() as conn:
        conn.execute("UPDATE settings SET value = '99' WHERE key = 'incident.max_live'")
        assert svc.read_settings(conn)["incident.max_live"] == 4


# ---------------------------------------------------------------- B-02: open, merge window, floors

def test_b02_manual_open_merge_window_and_floors(w):
    w.enable()
    r = w.open_manual()
    assert r.status_code == 201 and r.json()["merged"] is False
    inc = r.json()["incident"]
    assert inc["status"] == "open" and inc["source"] == "manual" and inc["floor_id"] == w.f2 and inc["zone"] == "חניון"
    assert [s["kind"] for s in inc["steps"]][:1] == ["opened"]
    # a second trigger on the same floor inside the window (default 5 min) is a step of the open incident
    r2 = w.open_manual(title="יציאת חירום נפתחה")
    assert r2.json()["merged"] is True and r2.json()["incident"]["id"] == inc["id"]
    assert "event_added" in [s["kind"] for s in r2.json()["incident"]["steps"]]
    # another floor: its own incident
    r3 = w.open_manual(floor=w.f3)
    assert r3.json()["merged"] is False and r3.json()["incident"]["id"] != inc["id"]
    # merge window 0: every trigger its own incident
    w.c.put(f"{API}/incidents/settings", json={"settings": {"incident.merge_window_s": 0}})
    r4 = w.open_manual()
    assert r4.json()["merged"] is False and r4.json()["incident"]["id"] != inc["id"]
    listed = w.c.get(f"{API}/incidents?status=open").json()["incidents"]
    assert len(listed) == 3
    assert w.audit_actions().count("incident.open") == 3 and "incident.merge" in w.audit_actions()
    # validation: a point needs both coordinates; a floor that does not exist
    assert w.c.post(f"{API}/incidents", json={"floor_id": w.f2, "x": 0.2}).status_code == 422
    assert w.c.post(f"{API}/incidents", json={"floor_id": "nope"}).status_code == 404
    assert w.c.post(f"{API}/incidents", json={}).status_code == 422


def test_b02_open_from_event_and_from_the_alarm(w):
    w.enable()
    eid = w.event("A")
    r = w.c.post(f"{API}/incidents", json={"event_id": eid})
    assert r.status_code == 201, r.text
    inc = r.json()["incident"]
    assert inc["source"] == "event" and inc["source_ref"] == eid and inc["floor_id"] == w.f2 and inc["event_label"] == "חדירה לאזור"
    assert "חניון מזרח" in inc["title"]
    # the alarm hook: only with auto-open ON (default OFF)
    w.c.put(f"{API}/incidents/settings", json={"settings": {"incident.merge_window_s": 0}})
    with w.app.state.db.connection() as conn:
        assert svc.on_ha_state(conn, _st("alarm_control_panel.home", "armed_away"), _st("alarm_control_panel.home", "triggered")) is None
    w.c.put(f"{API}/incidents/settings", json={"settings": {"incident.auto_open.alarm": True}})
    with w.app.state.db.connection() as conn:
        assert svc.on_ha_state(conn, None, _st("alarm_control_panel.home", "triggered")) is None, "a first state is a start-up, not a trigger"
        assert svc.on_ha_state(conn, _st("alarm_control_panel.home", "triggered"), _st("alarm_control_panel.home", "triggered")) is None
        assert svc.on_ha_state(conn, _st("light.x", "off"), _st("light.x", "on")) is None
        row = svc.on_ha_state(conn, _st("alarm_control_panel.home", "armed_away"), _st("alarm_control_panel.home", "triggered"))
    assert row is not None and row["source"] == "alarm" and row["opened_by"] == "system" and row["title"].startswith("אזעקת פריצה")


def test_b02_open_here_from_the_map_and_from_the_alarm_screen(w):
    w.enable()
    anchor = w.rows("SELECT id FROM map_anchors WHERE resource_id = ? AND effective_to IS NULL", (w.cam["A"],))[0]["id"]
    r = w.c.post(f"{API}/incidents", json={"anchor_id": anchor}, headers=w.h("dana"))
    assert r.status_code == 201, r.text
    inc = r.json()["incident"]
    assert inc["source"] == "manual" and inc["floor_id"] == w.f2 and inc["anchor_id"] == anchor and "חניון מזרח" in inc["title"] and inc["zone"] == "חניון"
    cams = w.c.get(f"{API}/incidents/{inc['id']}/cameras").json()["cameras"]
    assert cams[0]["camera_id"] == w.cam["A"] and cams[0]["relation"] == "source", "the marker's own camera is first"
    d_anchor = w.rows("SELECT id FROM map_anchors WHERE resource_id = ? AND effective_to IS NULL", (w.cam["D"],))[0]["id"]
    assert w.c.post(f"{API}/incidents", json={"anchor_id": d_anchor}, headers=w.h("dana")).status_code == 403, "events.ack at the marker's floor"
    assert w.c.post(f"{API}/incidents", json={"anchor_id": "nope"}).status_code == 404
    # the alarm screen's button: the panel (no zone placed on a plan) opens without a location, at installation scope
    r = w.c.post(f"{API}/incidents", json={"alarm_panel": "alarm_control_panel.home"})
    assert r.status_code == 201 and r.json()["incident"]["source"] == "alarm" and r.json()["incident"]["opened_by"] == "joni"
    assert r.json()["incident"]["title"].startswith("אזעקת פריצה")
    assert w.c.post(f"{API}/incidents", json={"alarm_panel": "alarm_control_panel.home"}, headers=w.h("dana")).status_code == 403, "no location = installation scope"
    assert w.c.post(f"{API}/incidents", json={"alarm_panel": "alarm_control_panel.none"}).status_code == 404
    assert w.c.post(f"{API}/incidents", json={"alarm_panel": "light.x"}).status_code == 422
    w.place(w.f2, "ha_entity", "alarm_control_panel.home", 0.6, 0.3)  # the panel placed on floor 2: its incident is on that floor
    w.c.put(f"{API}/incidents/settings", json={"settings": {"incident.merge_window_s": 0}})
    r = w.c.post(f"{API}/incidents", json={"alarm_panel": "alarm_control_panel.home"}, headers=w.h("dana"))
    assert r.status_code == 201 and r.json()["incident"]["floor_id"] == w.f2


# ---------------------------------------------------------------- B-03: floor scope, cameras by video.live

def test_b03_floor_scope_and_camera_filter(w):
    w.enable()
    on2 = w.open_manual().json()["incident"]["id"]
    on3 = w.open_manual(floor=w.f3).json()["incident"]["id"]
    assert w.c.get(f"{API}/incidents/{on2}", headers=w.h("dana")).status_code == 200
    r = w.c.get(f"{API}/incidents/{on3}", headers=w.h("dana"))
    assert r.status_code == 403
    assert {i["id"] for i in w.c.get(f"{API}/incidents", headers=w.h("dana")).json()["incidents"]} == {on2}
    assert w.c.get(f"{API}/incidents/summary", headers=w.h("dana")).json()["open"] == 1
    assert w.c.get(f"{API}/incidents/summary").json()["open"] == 2
    assert w.c.post(f"{API}/incidents", json={"floor_id": w.f3}, headers=w.h("dana")).status_code == 403, "opening needs events.ack at that floor"
    # ranking: the camera in the same room first, then the adjacent room, then the rest of the floor; never another floor's camera
    cams = w.c.get(f"{API}/incidents/{on2}/cameras").json()
    assert [c["camera_id"] for c in cams["cameras"]] == [w.cam["A"], w.cam["B"], w.cam["C"]]
    assert [c["relation"] for c in cams["cameras"]] == ["same_zone", "adjacent_zone", "floor"] and cams["max_live"] == 4 and cams["max_live_phone"] == 1
    # eve may watch camera A only: the others are not listed at all
    assert [c["camera_id"] for c in w.c.get(f"{API}/incidents/{on2}/cameras", headers=w.h("eve")).json()["cameras"]] == [w.cam["A"]]
    # zed has no live video: the panel is forbidden, the incident itself is readable
    r = w.c.get(f"{API}/incidents/{on2}/cameras", headers=w.h("zed"))
    assert r.status_code == 403 and r.json()["details"]["permission"] == "video.live"
    assert w.c.get(f"{API}/incidents/{on2}", headers=w.h("zed")).status_code == 200
    assert w.c.get(f"{API}/incidents/{on2}", headers=w.h("nobody")).status_code == 403


# ---------------------------------------------------------------- B-04: doors - state with entity.state.read, who opened with access.events.read

def test_b04_doors_panel_permissions(w):
    w.enable()
    iid = w.open_manual().json()["incident"]["id"]
    with w.app.state.db.connection() as conn:
        conn.execute("INSERT INTO intercom_door_map(entity_id, config_entry_id, physical_index, source, mapped_at) VALUES ('lock.parking', 'st-1', 1, 'manual', ?)", (now_iso(),))
    full = w.c.get(f"{API}/incidents/{iid}/doors").json()
    by = {d["entity_id"]: d for d in full["doors"]}
    assert set(by) == {"lock.parking", "binary_sensor.machine_door"}, "a light near the point is not a door"
    assert by["lock.parking"]["state"] == "unlocked" and by["lock.parking"]["open"] is True and by["lock.parking"]["station_id"] == "st-1" and by["lock.parking"]["door"] == 1
    assert full["state_visible"] is True and full["window_s"] == 600
    eve = w.c.get(f"{API}/incidents/{iid}/doors", headers=w.h("eve")).json()
    e = {d["entity_id"]: d for d in eve["doors"]}["lock.parking"]
    assert eve["state_visible"] is False and e["state"] is None and e["open"] is None and "station_id" not in e, "no entity.state.read, no access.events.read"
    dana = {d["entity_id"]: d for d in w.c.get(f"{API}/incidents/{iid}/doors", headers=w.h("dana")).json()["doors"]}["lock.parking"]
    assert dana["state"] == "unlocked" and "station_id" not in dana, "the operator's access.events.read is at floor scope, not on the station"


# ---------------------------------------------------------------- B-06: acknowledge / note / close, audited

def test_b06_ack_note_close_audited(w):
    w.enable()
    eid = w.event("A")
    iid = w.c.post(f"{API}/incidents", json={"event_id": eid}).json()["incident"]["id"]
    r = w.c.post(f"{API}/incidents/{iid}/ack", headers=w.h("dana"))
    assert r.status_code == 200 and r.json()["acked_by"] and r.json()["acked_at"]
    assert w.rows("SELECT acked_at FROM events WHERE id = ?", (eid,))[0]["acked_at"], "the source event is acknowledged too"
    assert w.c.post(f"{API}/incidents/{iid}/ack", headers=w.h("dana")).status_code == 200
    first_by = r.json()["acked_by"]
    w.c.post(f"{API}/incidents/{iid}/ack")
    d = w.c.get(f"{API}/incidents/{iid}").json()
    assert d["acked_by"] == first_by, "the first acknowledger stays"
    assert [s["kind"] for s in d["steps"]].count("acked") >= 2, "one step per person, not per press"
    assert w.c.post(f"{API}/incidents/{iid}/note", json={"text": "שומר בדרך"}, headers=w.h("dana")).status_code == 200
    assert w.c.post(f"{API}/incidents/{iid}/note", json={"text": "   "}).status_code == 422
    assert w.c.post(f"{API}/incidents/{iid}/ack", headers=w.h("nobody")).status_code == 403
    r = w.c.post(f"{API}/incidents/{iid}/close", json={"note": "תרגיל"}, headers=w.h("dana"))
    assert r.status_code == 200 and r.json()["status"] == "closed" and r.json()["close_note"] == "תרגיל"
    assert w.c.post(f"{API}/incidents/{iid}/close", json={}).status_code == 409
    assert w.c.post(f"{API}/incidents/{iid}/ack").status_code == 409
    rows = w.rows("SELECT action, details_json FROM audit_log WHERE resource_type = 'incident' AND decision = 'allowed' ORDER BY id")
    acts = [r["action"] for r in rows]
    assert {"incident.open", "incident.ack", "incident.note", "incident.close"} <= set(acts)
    close = json.loads([r for r in rows if r["action"] == "incident.close"][0]["details_json"])
    assert close["note"] == "תרגיל" and close["duration_s"] >= 0 and len(close["acknowledgers"]) == 2
    assert "event.ack" in w.audit_actions()


# ---------------------------------------------------------------- B-07: the chain mirrors the notification and the door commands

def test_b07_chain_notification_ack_and_door_open(w):
    w.enable()
    iid = w.open_manual().json()["incident"]["id"]
    d = w.c.get(f"{API}/incidents/{iid}").json()
    notified = [s for s in d["steps"] if s["kind"] == "notified"]
    assert notified and notified[0]["recipients"], "the incident opened notification reached its recipients"
    assert d["pending"], "recipients wait until someone acknowledges"
    nid = w.rows("SELECT notification_id FROM incidents WHERE id = ?", (iid,))[0]["notification_id"]
    n = w.rows("SELECT link, source, subject_kind FROM notifications WHERE id = ?", (nid,))[0]
    assert n == {"link": f"#/investigate/incidents/{iid}", "source": "incident.opened", "subject_kind": "incident"}
    # only who may read the floor receives it: zed (events only at floor 2) yes; a floor-3 incident never reaches dana
    w.c.post(f"{API}/notifications/{nid}/ack")
    d = w.c.get(f"{API}/incidents/{iid}").json()
    assert any(s["kind"] == "acked" and s["ref_type"] == "notification" for s in d["steps"]) and d["pending"] == []
    # a door command near the incident (the audit outcome row of the release path)
    with w.app.state.db.connection() as conn:
        uid = conn.execute("SELECT id FROM users WHERE username = 'dana'").fetchone()[0]
        conn.execute("INSERT INTO audit_log(at, actor_user_id, actor_username, action, resource_type, resource_id, decision, permission_revision, details_json) "
                     "VALUES (?,?,?,?,?,?,?,?,?)", (now_iso(), uid, "dana", "intercom.release", "ha_entity", "lock.parking", "allowed", permission_revision(conn),
                                                     json.dumps({"phase": "outcome", "outcome": "ok"})))
        conn.execute("INSERT INTO audit_log(at, actor_user_id, actor_username, action, resource_type, resource_id, decision, permission_revision, details_json) "
                     "VALUES (?,?,?,?,?,?,?,?,?)", (now_iso(), uid, "dana", "intercom.release", "ha_entity", "lock.parking", "allowed", permission_revision(conn),
                                                     json.dumps({"phase": "attempt"})))
    admin = [s for s in w.c.get(f"{API}/incidents/{iid}").json()["steps"] if s["kind"] == "door_open"]
    assert len(admin) == 1 and admin[0]["actor"] and admin[0]["text"] == "דלת חניון", "one outcome row = one step (the attempt row is not)"
    eve = [s for s in w.c.get(f"{API}/incidents/{iid}", headers=w.h("eve")).json()["steps"] if s["kind"] == "door_open"]
    assert len(eve) == 1 and eve[0]["actor"] is None, "without access.events.read the step has no person"
    times = [s["at"] for s in w.c.get(f"{API}/incidents/{iid}").json()["steps"]]
    assert times == sorted(times)


def test_b07_notification_visibility_follows_the_floor(w):
    w.enable()
    iid = w.open_manual(floor=w.f3).json()["incident"]["id"]
    nid = w.rows("SELECT notification_id FROM incidents WHERE id = ?", (iid,))[0]["notification_id"]
    users = {r["username"] for r in w.rows("SELECT u.username FROM notification_recipients r JOIN users u ON u.id = r.user_id WHERE r.notification_id = ?", (nid,))}
    assert "joni" in users and "dana" not in users and "eve" not in users


# ---------------------------------------------------------------- B-08: retention

def test_b08_retention_prunes_closed_only_and_facts_survive(w):
    w.enable(**{"incident.merge_window_s": 0})
    eid = w.event("A")
    closed = w.c.post(f"{API}/incidents", json={"event_id": eid}).json()["incident"]["id"]
    w.c.post(f"{API}/incidents/{closed}/close", json={})
    still_open = w.open_manual().json()["incident"]["id"]
    old = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=400)).strftime("%Y-%m-%dT%H:%M:%SZ")
    with w.app.state.db.connection() as conn:
        conn.execute("DELETE FROM events WHERE id = ?", (eid,))  # the event is pruned first (events.retention_days < incident retention)
    d = w.c.get(f"{API}/incidents/{closed}").json()
    assert d["event_label"] == "חדירה לאזור", "the snapshot taken at open time survives the event"
    with w.app.state.db.connection() as conn:
        conn.execute("UPDATE incidents SET closed_at = ?, opened_at = ?", (old, old))
        conn.execute("UPDATE incidents SET closed_at = NULL WHERE id = ?", (still_open,))
    janitor_tick(w.app.state.db, w.settings)
    ids = {r["id"] for r in w.rows("SELECT id FROM incidents")}
    assert ids == {still_open}, "the closed incident past 365 days is pruned; an open one never"
    assert w.rows("SELECT * FROM incident_steps WHERE incident_id = ?", (closed,)) == []


# ---------------------------------------------------------------- nothing physical, ever

def test_no_route_operates_anything_physical():
    routes = [r for r in incidents_router.router.routes if isinstance(r, APIRoute)]
    paths = {(m, r.path) for r in routes for m in r.methods}
    assert paths == {
        ("GET", "/incidents/settings"), ("PUT", "/incidents/settings"), ("GET", "/incidents/summary"), ("GET", "/incidents"), ("POST", "/incidents"),
        ("GET", "/incidents/{incident_id}"), ("GET", "/incidents/{incident_id}/cameras"), ("GET", "/incidents/{incident_id}/doors"),
        ("POST", "/incidents/{incident_id}/ack"), ("POST", "/incidents/{incident_id}/note"), ("POST", "/incidents/{incident_id}/close"),
    }
    src = open(svc.__file__, encoding="utf-8").read() + open(incidents_router.__file__, encoding="utf-8").read()
    for word in ("ha_actions", "call_bridge", "sign_message", "trusted_door", "ha_client", "ha_bridge"):  # no path to a device command at all
        assert word not in src, word
