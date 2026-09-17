"""הגדרות › מסך פתיחה / הסתרת המפה (0.1.68): stored, read back, and refused when out of range."""
from fastapi.testclient import TestClient

from smplwise.main import create_app


def test_start_route_and_hide_map_round_trip(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        before = c.get("/api/v1/settings").json()["settings"]
        assert before["ui.start_route"] == "explore" and before["ui.hide_map"] == "false"
        r = c.patch("/api/v1/settings", json={"ui.start_route": "wall", "ui.hide_map": "true"})
        assert r.status_code == 200, r.text
        after = c.get("/api/v1/settings").json()["settings"]
        assert after["ui.start_route"] == "wall" and after["ui.hide_map"] == "true"
        assert c.patch("/api/v1/settings", json={"ui.start_route": "kitchen"}).status_code == 422
        assert c.patch("/api/v1/settings", json={"ui.hide_map": "yes"}).status_code == 422
