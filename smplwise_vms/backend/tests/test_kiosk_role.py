"""Kiosk principal (T057): a user bound to the kiosk role sees the map and live video of its scope and nothing
else — no events, no HA control, no settings, no playback, no exports — so a wall display cannot be used to
unlock a door or change the system even when someone reaches its keyboard."""
from __future__ import annotations

from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.rbac import ROLES
from smplwise.services import ha_sync


def test_kiosk_role_is_live_and_map_only(settings):
    assert ROLES["kiosk"] == ["map.read", "video.live"]
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    f2 = ids["floor2"]
    cam = c.post("/api/v1/cameras", json={"channel": 1, "alias": "לובי"}).json()["id"]
    asset = c.post(f"/api/v1/floors/{f2}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{f2}/plan-versions", json={"asset_id": asset["id"]}).json()
    c.post(f"/api/v1/plan-versions/{v['id']}/publish")
    c.post(f"/api/v1/floors/{f2}/anchors", json={"resource_type": "camera", "resource_id": cam, "x": 0.3, "y": 0.3})
    with app.state.db.connection() as conn:
        ha_sync.upsert_state(conn, {"entity_id": "lock.front", "state": "locked", "last_changed": "2026-09-16T09:00:00+00:00", "attributes": {"friendly_name": "מנעול"}})
    bind(c, settings, "wall", "kiosk", "floor", f2)
    h = as_user("wall")
    me = c.get("/api/v1/me", headers=h).json()
    assert me["has_access"] is True and me["bindings"][0]["role_id"] == "kiosk"
    assert c.get(f"/api/v1/floors/{f2}/map", headers=h).status_code == 200
    assert c.get(f"/api/v1/media/live/{cam}", headers=h).status_code == 200
    assert c.get("/api/v1/cameras", headers=h).status_code == 200
    assert c.get("/api/v1/health/summary", headers=h).status_code == 200, "the wall shows system health without admin menus"
    for path in (f"/api/v1/cameras/{cam}/recordings?date=2026-09-16", "/api/v1/events", "/api/v1/cases", "/api/v1/storage", "/api/v1/audit", "/api/v1/health/report", "/api/v1/backups"):
        assert c.get(path, headers=h).status_code == 403, path
    action = {"allowed_action_id": "lock.unlock", "client_request_id": "r1", "expires_at": "2099-01-01T00:00:00Z"}
    assert c.post("/api/v1/ha/entities/lock.front/actions", json=action, headers=h).status_code == 403, "no unlock from a kiosk"
    assert c.patch("/api/v1/settings", json={"time.zone": "Europe/London"}, headers=h).status_code == 403
    assert c.post("/api/v1/exports", json={"camera_id": cam, "from_at": "2026-09-16T08:00:00Z", "to_at": "2026-09-16T08:01:00Z"}, headers=h).status_code == 403
    assert c.post(f"/api/v1/floors/{f2}/anchors", json={"resource_type": "ha_entity", "resource_id": "lock.front", "x": 0.2, "y": 0.2, "layer_id": "doors"}, headers=h).status_code == 403
