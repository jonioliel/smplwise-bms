"""CR-RESPONSE-MODELS-B-2450: routes of the plans / anchors / zones routers that the router suites reach rarely, sent through the wire
oracle (tests/support/wire_oracle.py: the modelled answer must equal the route's pre-model serialisation, SW_WIRE_STRICT=1)."""
from __future__ import annotations

from conftest import png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from support import wire_oracle


def _through_oracle(*keys: str) -> None:
    missing = [k for k in keys if not wire_oracle.CHECKED.get(k)]
    assert not missing, f"never compared by the oracle: {missing}"


def test_plan_reads_anchor_list_and_realign_answer_as_before(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        ids = seed_tree(c)
        floor = ids["floor2"]
        cam = c.post("/api/v1/cameras", json={"channel": 3, "alias": "חניה"}).json()
        asset = c.post(f"/api/v1/floors/{floor}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
        v1 = c.post(f"/api/v1/floors/{floor}/plan-versions", json={"asset_id": asset["id"]}).json()
        assert c.post(f"/api/v1/plan-versions/{v1['id']}/publish").status_code == 200
        r = c.post(f"/api/v1/floors/{floor}/anchors", json={"resource_type": "camera", "resource_id": cam["id"], "x": 0.25, "y": 0.5, "rotation_degrees": 45})
        assert r.status_code == 201, r.text
        # a re-cropped draft: the anchor sits on the older version until it is realigned
        v2 = c.post(f"/api/v1/floors/{floor}/plan-versions", json={"asset_id": asset["id"], "crop": {"x": 0.1, "y": 0.1, "w": 0.8, "h": 0.8}}).json()
        assert c.get(f"/api/v1/floors/{floor}/plan-assets").status_code == 200
        r = c.get(f"/api/v1/plan-versions/{v2['id']}")
        assert r.status_code == 200 and r.json()["status"] == "draft"
        r = c.get(f"/api/v1/floors/{floor}/anchors")
        assert r.status_code == 200 and len(r.json()["anchors"]) == 1
        r = c.post(f"/api/v1/floors/{floor}/anchors/realign", json={"mode": "crop"})
        assert r.status_code == 200, r.text
        assert r.json()["mode"] == "crop" and r.json()["version_id"] == v2["id"]
        r = c.patch(f"/api/v1/cameras/{cam['id']}", json={"wall_hidden": True})
        assert r.status_code == 200 and r.json()["wall_hidden"] is True
        api = "/api/v1"
        _through_oracle(f"GET {api}/floors/{{floor_id}}/plan-assets", f"GET {api}/plan-versions/{{version_id}}", f"GET {api}/floors/{{floor_id}}/anchors",
                        f"POST {api}/floors/{{floor_id}}/anchors/realign", f"PATCH {api}/cameras/{{camera_id}}")
