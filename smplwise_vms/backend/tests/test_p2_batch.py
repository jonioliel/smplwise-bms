"""0.1.73: label positions (R4), anchor realignment through crops (S4), the HA recorder as a secondary history
source (S2) and the HA notify rule action behind its sensitive permission (S5)."""
from __future__ import annotations

from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import ha_history
from smplwise.services import rules as rules_svc


def _floor_with_plan(c: TestClient):
    ids = seed_tree(c)
    asset = c.post(f"/api/v1/floors/{ids['floor2']}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    v1 = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"]}).json()
    assert c.post(f"/api/v1/plan-versions/{v1['id']}/publish").status_code == 200
    return ids, asset, v1


def test_label_positions_and_realign(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        ids, asset, v1 = _floor_with_plan(c)
        f = ids["floor2"]
        cam = c.post("/api/v1/cameras", json={"channel": 4, "alias": "חניה"}).json()
        a = c.post(f"/api/v1/floors/{f}/anchors", json={"resource_type": "camera", "resource_id": cam["id"], "x": 0.3, "y": 0.3, "rotation_degrees": 0, "field_of_view_degrees": 90, "label_pos": "top"}).json()
        assert a["label_pos"] == "top"
        a = c.patch(f"/api/v1/map-anchors/{a['id']}", json={"revision": a["revision"], "label_pos": "left"}).json()
        assert a["label_pos"] == "left"
        assert c.patch(f"/api/v1/map-anchors/{a['id']}", json={"revision": a["revision"], "label_pos": "middle"}).status_code == 422
        z = c.post(f"/api/v1/floors/{f}/zones", json={"name": "לובי", "polygon": [{"x": 0.1, "y": 0.1}, {"x": 0.4, "y": 0.1}, {"x": 0.4, "y": 0.3}]}).json()
        assert z["label_pos"] == "auto"
        z = c.patch(f"/api/v1/zones/{z['id']}", json={"revision": z["revision"], "label_pos": "bottom"}).json()
        assert z["label_pos"] == "bottom"
        assert c.get(f"/api/v1/floors/{f}/map").json()["zones"][0]["label_pos"] == "bottom"
        # a re-crop of the same drawing: the anchor stays on the old version until realigned through the crops
        v2 = c.post(f"/api/v1/floors/{f}/plan-versions", json={"asset_id": asset["id"], "crop": {"x": 0.25, "y": 0.25, "w": 0.5, "h": 0.5}}).json()
        assert "id" in v2, v2
        assert c.post(f"/api/v1/plan-versions/{v2['id']}/publish").status_code == 200
        m = c.get(f"/api/v1/floors/{f}/map").json()
        assert m["needs_alignment"] is True
        r = c.post(f"/api/v1/floors/{f}/anchors/realign", json={"mode": "crop"})
        assert r.status_code == 200, r.text
        assert r.json()["moved"] == 1 and r.json()["skipped"] == 0
        m = c.get(f"/api/v1/floors/{f}/map").json()
        assert m["needs_alignment"] is False
        pos = m["anchors"][0]["position"]
        assert abs(pos["x"] - 0.1) < 1e-6 and abs(pos["y"] - 0.1) < 1e-6, pos  # (0.3 - 0.25) / 0.5
        # a different drawing cannot be mapped: crop skips, accept re-stamps
        asset2 = c.post(f"/api/v1/floors/{f}/plan-assets", files={"file": ("plan2.png", png_bytes(), "image/png")}).json()
        v3 = c.post(f"/api/v1/floors/{f}/plan-versions", json={"asset_id": asset2["id"]}).json()
        assert c.post(f"/api/v1/plan-versions/{v3['id']}/publish").status_code == 200
        assert c.get(f"/api/v1/floors/{f}/map").json()["needs_alignment"] is True
        r = c.post(f"/api/v1/floors/{f}/anchors/realign", json={"mode": "crop"}).json()
        assert r["moved"] == 0 and r["skipped"] == 1 and r["needs_alignment"] is True
        r = c.post(f"/api/v1/floors/{f}/anchors/realign", json={"mode": "accept"}).json()
        assert r["moved"] == 1 and c.get(f"/api/v1/floors/{f}/map").json()["needs_alignment"] is False


def test_recorder_state_at_parses_minimal_response():
    data = [[{"entity_id": "light.hall", "state": "off", "last_changed": "2026-09-17T20:00:00+00:00"}, {"state": "on", "last_changed": "2026-09-17T21:30:00+00:00"}, {"state": "off", "last_changed": "2026-09-17T23:00:00+00:00"}],
            [{"entity_id": "binary_sensor.door", "state": "off", "last_changed": "2026-09-17T10:00:00+00:00"}]]
    out = ha_history.recorder_state_at(["light.hall", "binary_sensor.door"], "2026-09-17T22:00:00Z", fetch=lambda ids, start, end: data)
    assert out["light.hall"] == {"state": "on", "changed_at": "2026-09-17T21:30:00Z", "known": True, "reason": None, "source": "ha_recorder"}
    assert out["binary_sensor.door"]["state"] == "off"
    assert ha_history.recorder_state_at(["x"], "2026-09-17T22:00:00Z", fetch=lambda *a: (_ for _ in ()).throw(RuntimeError("down"))) == {}


def test_ha_secondary_setting_round_trip(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        assert c.get("/api/v1/settings").json()["settings"]["history.ha_secondary"] == "false"
        assert c.patch("/api/v1/settings", json={"history.ha_secondary": "true"}).status_code == 200
        assert c.get("/api/v1/settings").json()["settings"]["history.ha_secondary"] == "true"


def test_ha_notify_action_is_gated_and_delivered(settings, monkeypatch):
    sent: list[tuple[str, str, str]] = []
    monkeypatch.setattr(rules_svc, "HA_NOTIFY", lambda service, message, title: (sent.append((service, message, title)), "sent")[1])
    app = create_app(settings)
    with TestClient(app) as c:
        body = {"name": "אדם בלילה", "trigger": {"types": ["person"], "sources": [], "severity_min": "info"}, "actions": [{"kind": "ha_notify", "service": "mobile_app_phone", "message": "אדם זוהה"}]}
        bind(c, settings, "dan", "site_admin", "installation", "*")  # a built-in role with rules.manage
        h = as_user("dan")
        assert c.post("/api/v1/rules", json=body, headers=h).status_code == 403, "rules.manage alone is not enough"
        role = c.post("/api/v1/access/roles", json={"name": "מנהל חוקים", "description": "", "permissions": ["map.read"], "sensitive": ["rules.ha_notify"]}).json()
        assert "id" in role, role
        bind(c, settings, "dan", role["id"], "installation", "*")
        r = c.post("/api/v1/rules", json=body, headers=h)
        assert r.status_code == 201, r.text
        assert c.post("/api/v1/rules", json={**body, "actions": [{"kind": "ha_notify", "service": "bad service"}]}, headers=h).status_code == 422
        # a person event fires the rule and the notify goes through the hook
        with app.state.db.connection() as con:
            ev = {"id": "ev1", "type": "person", "source": "alertstream", "severity": "info", "camera_id": None, "occurred_at": "2026-09-17T22:00:00Z", "details": {}}
            fired = rules_svc.evaluate_event(con, ev, "Asia/Jerusalem")
        assert fired and fired[0]["ha_notify"] == {"mobile_app_phone": "sent"}
        assert sent == [("mobile_app_phone", "אדם זוהה", "אדם בלילה")]
