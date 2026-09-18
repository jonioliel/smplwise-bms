"""Alarm rules with a dry run (T052): trigger / scope / window / cooldown matching with a reason per step; alerts
raised once per rule and event, never for HA-owned rules, never producing events (no loops); dry run replays
stored events without writing; edits carry revision and author; permissions."""
from __future__ import annotations

import datetime as dt
import json

from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import correlation, ha_sync, rules as svc


def _event(app, eid: str, camera_id: str | None, occurred: str, etype: str = "motion", severity: str = "info") -> dict:
    with app.state.db.connection() as conn:
        conn.execute(
            "INSERT INTO events(id, source, raw_type, type, camera_id, channel, occurred_at, ended_at, received_at, state, count, severity, confidence, details_json, dedup_key, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (eid, "alertstream", "VMD", etype, camera_id, 1, occurred, None, occurred, "inactive", 1, severity, "measured", json.dumps({}), f"t:{eid}", occurred),
        )
        return dict(conn.execute("SELECT * FROM events WHERE id = ?", (eid,)).fetchone())


def test_window_logic():
    assert svc.in_window({}, dt.datetime(2026, 9, 16, 10, 0, tzinfo=dt.timezone.utc), "Asia/Jerusalem")[0] is True
    # Wednesday 13:00 local (UTC+3): inside mon-fri 09:00-18:00, outside 22:00-06:00 overnight, outside sat/sun
    at = dt.datetime(2026, 9, 16, 10, 0, tzinfo=dt.timezone.utc)
    assert svc.in_window({"days": ["mon", "tue", "wed", "thu", "fri"], "from": "09:00", "to": "18:00"}, at, "Asia/Jerusalem")[0] is True
    assert svc.in_window({"from": "22:00", "to": "06:00"}, at, "Asia/Jerusalem")[0] is False
    assert svc.in_window({"from": "22:00", "to": "06:00"}, dt.datetime(2026, 9, 16, 22, 30, tzinfo=dt.timezone.utc), "Asia/Jerusalem")[0] is True, "01:30 local is inside the overnight window"
    ok, why = svc.in_window({"days": ["sat", "sun"]}, at, "Asia/Jerusalem")
    assert ok is False and "wed" in why


def test_rules_match_alerts_dry_run_and_permissions(settings):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    floor = ids["floor2"]
    cam_in = c.post("/api/v1/cameras", json={"channel": 1, "alias": "לובי"}).json()["id"]
    cam_out = c.post("/api/v1/cameras", json={"channel": 2, "alias": "חניה"}).json()["id"]
    asset = c.post(f"/api/v1/floors/{floor}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{floor}/plan-versions", json={"asset_id": asset["id"]}).json()
    c.post(f"/api/v1/plan-versions/{v['id']}/publish")
    c.post(f"/api/v1/floors/{floor}/anchors", json={"resource_type": "camera", "resource_id": cam_in, "x": 0.3, "y": 0.3})
    with app.state.db.connection() as conn:
        ha_sync.upsert_state(conn, {"entity_id": "binary_sensor.door", "state": "off", "last_changed": "2026-09-16T09:00:00+00:00", "attributes": {"device_class": "door", "friendly_name": "דלת"}})
    c.post(f"/api/v1/floors/{floor}/anchors", json={"resource_type": "ha_entity", "resource_id": "binary_sensor.door", "x": 0.35, "y": 0.3, "layer_id": "doors"})

    # the rule: motion or door events, on floor 2, at night (22:00-06:00 local), 10 minute cooldown, notify
    body = {"name": "תנועה בלילה בלובי", "trigger": {"types": ["motion", "door"], "severity_min": "info"}, "scope": {"floor_ids": [floor]}, "window": {"from": "22:00", "to": "06:00"}, "cooldown_s": 600, "actions": [{"kind": "notify", "message": "תנועה בלובי בלילה"}]}
    r = c.post("/api/v1/rules", json=body)
    assert r.status_code == 201, r.text
    rule = r.json()
    assert rule["enabled"] is True and rule["owner"] == "local" and rule["revision"] == 1 and rule["created_by_username"] and rule["alerts"] == {"total": 0, "open": 0}
    assert c.post("/api/v1/rules", json={**body, "actions": [{"kind": "webhook", "url": "http://x"}]}).status_code == 422, "only VMS notifications in the pilot"
    assert c.post("/api/v1/rules", json={**body, "owner": "ha"}).status_code == 422, "an HA-owned rule names its automation"
    lst = c.get("/api/v1/rules").json()
    assert [x["id"] for x in lst["rules"]] == [rule["id"]] and lst["action_kinds"] == ["notify", "ha_notify"]

    # events: 01:00 local = 22:00 UTC previous day
    night = "2026-09-15T22:00:00Z"
    e_night = _event(app, "n1", cam_in, night)
    e_night_soon = _event(app, "n2", cam_in, "2026-09-15T22:05:00Z")
    e_night_later = _event(app, "n3", cam_in, "2026-09-15T22:20:00Z")
    e_day = _event(app, "d1", cam_in, "2026-09-16T10:00:00Z")
    e_out = _event(app, "o1", cam_out, night)
    e_person = _event(app, "p1", cam_in, "2026-09-15T22:30:00Z", etype="person")
    with app.state.db.connection() as conn:
        tz = "Asia/Jerusalem"
        m = svc.match(conn, svc.row_to_rule(conn.execute("SELECT * FROM rules").fetchone()), {**e_night, "details": {}}, tz)
        assert m["fire"] is True and "מצלמה בהיקף" in m["reasons"] and any("בחלון" in x for x in m["reasons"])
        rule_row = svc.row_to_rule(conn.execute("SELECT * FROM rules").fetchone())
        assert svc.match(conn, rule_row, {**e_day, "details": {}}, tz)["fire"] is False
        assert "המצלמה מחוץ להיקף" in svc.match(conn, rule_row, {**e_out, "details": {}}, tz)["reasons"]
        assert svc.match(conn, rule_row, {**e_person, "details": {}}, tz)["reasons"] == ["סוג person אינו ברשימה"]
        # live evaluation: n1 fires, n2 is within the cooldown, n3 fires again; a second evaluation of n1 is not a second alert
        assert [a["event_id"] for a in svc.evaluate_event(conn, {**e_night, "details": {}}, tz)] == ["n1"]
        assert svc.evaluate_event(conn, {**e_night_soon, "details": {}}, tz) == []
        assert [a["event_id"] for a in svc.evaluate_event(conn, {**e_night_later, "details": {}}, tz)] == ["n3"]
        assert svc.evaluate_event(conn, {**e_night, "details": {}}, tz) == [] or conn.execute("SELECT COUNT(*) FROM rule_alerts WHERE event_id = 'n1'").fetchone()[0] == 1
        # a door transition from HA on the placed sensor fires too (source ha, type door)
        door = correlation.record_transition(conn, {"state": "off"}, {"entity_id": "binary_sensor.door", "state": "on", "last_changed": "2026-09-15T23:00:00+00:00", "attributes": {"device_class": "door", "friendly_name": "דלת"}})
        assert [a["rule_name"] for a in svc.evaluate_event(conn, door, tz)] == ["תנועה בלילה בלובי"]
        assert conn.execute("SELECT COUNT(*) FROM events").fetchone()[0] == 7, "alerts never create events (no loops)"
    alerts = c.get("/api/v1/rules/alerts").json()
    assert alerts["unacked"] == 3 and [a["event_id"] for a in alerts["alerts"]] == [door["id"], "n3", "n1"] and alerts["alerts"][0]["entity_id"] == "binary_sensor.door"
    assert alerts["alerts"][1]["message"] == "תנועה בלובי בלילה" and "מצלמה בהיקף" in alerts["alerts"][1]["reasons"]
    acked = c.post(f"/api/v1/rules/alerts/{alerts['alerts'][1]['id']}/ack").json()
    assert acked["acked_at"] and acked["acked_by_username"]
    assert c.get("/api/v1/rules/alerts?unacked=true").json()["unacked"] == 2
    assert c.get(f"/api/v1/rules/{rule['id']}").json()["alerts"] == {"total": 3, "open": 2}

    # dry run over the stored events: same matcher, in-memory cooldown, nothing written
    now = dt.datetime(2026, 9, 16, 12, 0, tzinfo=dt.timezone.utc)
    with app.state.db.connection() as conn:
        before = conn.execute("SELECT COUNT(*) FROM rule_alerts").fetchone()[0]
        d = svc.dry_run(conn, rule_row, 24, "Asia/Jerusalem", now=now)
        assert conn.execute("SELECT COUNT(*) FROM rule_alerts").fetchone()[0] == before
    assert d["evaluated"] == 7 and [x["event_id"] for x in d["would_fire"]] == ["n1", "n3", door["id"]] and [x["event_id"] for x in d["suppressed"]] == ["n2"]
    assert "cooldown" in d["suppressed"][0]["suppressed"] and d["not_matched"] == 3 and "יבשה" in d["note"]
    api = c.post("/api/v1/rules/dry-run", json={"rule": {**body, "cooldown_s": 0}, "hours": 336})
    assert api.status_code == 200, api.text
    assert [x["event_id"] for x in api.json()["would_fire"]][:2] == ["n1", "n2"], "no cooldown: the second night event would fire too"
    assert c.post("/api/v1/rules/dry-run", json={"rule_id": rule["id"], "hours": 336}).json()["rule_name"] == "תנועה בלילה בלובי"
    assert c.post("/api/v1/rules/dry-run", json={"hours": 5}).status_code == 422

    # edits: revision + author; disabling stops evaluation; HA-owned rules are never evaluated locally
    stale = c.patch(f"/api/v1/rules/{rule['id']}", json={**body, "revision": 9})
    assert stale.status_code == 409
    upd = c.patch(f"/api/v1/rules/{rule['id']}", json={**body, "enabled": False, "revision": 1}).json()
    assert upd["revision"] == 2 and upd["enabled"] is False and upd["updated_by_username"]
    e9 = _event(app, "n9", cam_in, "2026-09-15T23:30:00Z")
    e10 = _event(app, "n10", cam_in, "2026-09-15T23:45:00Z")
    with app.state.db.connection() as conn:
        assert svc.evaluate_event(conn, {**e9, "details": {}}, "Asia/Jerusalem") == [], "a disabled rule is silent"
        conn.execute("UPDATE rules SET enabled = 1, owner = 'ha', ha_automation_id = 'automation.night'")
        assert svc.evaluate_event(conn, {**e10, "details": {}}, "Asia/Jerusalem") == [], "an HA-owned rule is never evaluated locally"
        audits = [r[0] for r in conn.execute("SELECT action FROM audit_log WHERE action LIKE 'rule.%'").fetchall()]
    assert "rule.create" in audits and "rule.update" in audits and "rule.alert.ack" in audits

    # permissions: an operator neither manages rules nor sees alerts of other floors; a site admin manages
    bind(c, settings, "omer", "operator", "floor", ids["floor3"])
    assert c.get("/api/v1/rules", headers=as_user("omer")).status_code == 403
    assert c.get("/api/v1/rules/alerts", headers=as_user("omer")).status_code == 403, "no visible camera → explicit refusal, like the events list"
    bind(c, settings, "sara", "site_admin", "site", ids["site"])
    assert c.get("/api/v1/rules", headers=as_user("sara")).status_code == 403, "site scope does not grant installation-wide rule management"
    bind(c, settings, "adi", "site_admin", "installation", "*")
    assert c.get("/api/v1/rules", headers=as_user("adi")).status_code == 200
    assert c.delete(f"/api/v1/rules/{rule['id']}", headers=as_user("adi")).status_code == 204
    assert c.get("/api/v1/rules/alerts").json()["alerts"] == []
