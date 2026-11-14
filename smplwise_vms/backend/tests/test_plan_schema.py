"""Canonical plan geometry schema v1 (T059): the validator refuses out-of-bounds coordinates, invalid polygons, missing
calibration without a reason and duplicate ids; the export of a real version validates and serializes deterministically;
the JSON schema file and the validator agree on the required shape."""
from __future__ import annotations

import copy
import json
import pathlib

from conftest import png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import ha_sync, plan_schema

SCHEMA = pathlib.Path(__file__).resolve().parents[3] / "contracts" / "schemas" / "plan_geometry.v1.schema.json"


def _doc() -> dict:
    return {
        "schema_version": "1.0",
        "source": {"sha256": "a" * 64, "file_name": "plan.pdf", "mime": "application/pdf", "page": 1},
        "dimensions": {"width_px": 3000, "height_px": 2121, "scale_m_per_px": 0.01, "calibration": {"status": "measured", "reason": "typed"}},
        "transform": {"rotation": 0, "crop": None},
        "walls": [{"id": "w1", "polyline": [[0.1, 0.1], [0.9, 0.1]], "thickness_px": 12, "confidence": 0.8, "source": "auto"}],
        "doors": [{"id": "d1", "position": [0.5, 0.1], "wall_id": "w1", "width_px": 40, "entity_id": "lock.front", "confidence": 0.7, "source": "manual"}],
        "windows": [],
        "rooms": [{"id": "r1", "name": "לובי", "kind": "room", "polygon": [[0.1, 0.1], [0.5, 0.1], [0.5, 0.5], [0.1, 0.5]], "confidence": 0.9, "source": "manual"}],
        "connectors": [{"id": "c1", "kind": "stairs", "position": [0.8, 0.8], "floor_ids": [], "confidence": 0.5, "source": "manual"}],
        "uncertainty": {"overall": 0.3, "notes": []},
    }


def test_schema_file_and_validator_agree():
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    assert schema["properties"]["schema_version"] == {"const": "1.0"} and plan_schema.SCHEMA_VERSION == "1.0"
    assert set(schema["required"]) == {"schema_version", "source", "dimensions", "transform", "walls", "doors", "windows", "rooms", "connectors", "uncertainty"}
    assert set(schema["$defs"]["room"]["properties"]["kind"]["enum"]) == plan_schema.ROOM_KINDS
    assert set(schema["$defs"]["connector"]["properties"]["kind"]["enum"]) == plan_schema.CONNECTOR_KINDS
    assert plan_schema.validate(_doc()) == []


def test_validator_rejects_bad_geometry_and_ids():
    d = _doc()
    d["rooms"][0]["polygon"][1] = [1.2, 0.1]
    assert any("normalized" in e for e in plan_schema.validate(d))
    d = _doc()
    d["rooms"][0]["polygon"] = [[0.1, 0.1], [0.5, 0.5], [0.5, 0.1], [0.1, 0.5]]  # bow-tie
    assert any("intersects itself" in e for e in plan_schema.validate(d))
    d = _doc()
    d["rooms"][0]["polygon"] = [[0.1, 0.1], [0.2, 0.2], [0.3, 0.3]]  # collinear
    assert any("degenerate" in e for e in plan_schema.validate(d))
    d = _doc()
    d["dimensions"]["calibration"] = {"status": "missing"}
    assert any("reason is required" in e for e in plan_schema.validate(d))
    d = _doc()
    d["dimensions"]["scale_m_per_px"] = None
    assert any("scale_m_per_px" in e for e in plan_schema.validate(d))
    d = _doc()
    d["doors"][0]["id"] = "r1"
    assert any("duplicate id 'r1'" in e for e in plan_schema.validate(d))
    d = _doc()
    d["transform"]["crop"] = {"x": 0.5, "y": 0.5, "w": 0.6, "h": 0.2}
    assert any("exceeds" in e for e in plan_schema.validate(d))
    d = _doc()
    d["transform"]["rotation"] = 45
    d["connectors"][0]["kind"] = "portal"
    d["walls"][0]["confidence"] = 2
    errs = plan_schema.validate(d)
    assert len(errs) == 3 and any("rotation" in e for e in errs) and any("portal" not in e and "kind must be" in e for e in errs) and any("confidence" in e for e in errs)
    assert plan_schema.validate({}) and "schema_version must be 1.0" in plan_schema.validate({})


def test_export_of_a_real_version_validates_and_is_deterministic(settings):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    floor = ids["floor2"]
    asset = c.post(f"/api/v1/floors/{floor}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{floor}/plan-versions", json={"asset_id": asset["id"], "rotation": 90, "crop": {"x": 0.1, "y": 0.1, "w": 0.8, "h": 0.8}}).json()
    c.post(f"/api/v1/plan-versions/{v['id']}/publish")
    c.post(f"/api/v1/floors/{floor}/zones", json={"name": "לובי", "kind": "room", "polygon": [{"x": 0.2, "y": 0.2}, {"x": 0.5, "y": 0.2}, {"x": 0.5, "y": 0.5}, {"x": 0.2, "y": 0.5}]})
    with app.state.db.connection() as conn:
        ha_sync.upsert_state(conn, {"entity_id": "lock.front", "state": "locked", "last_changed": "2026-09-16T09:00:00+00:00", "attributes": {"friendly_name": "מנעול"}})
        ha_sync.upsert_state(conn, {"entity_id": "light.hall", "state": "on", "last_changed": "2026-09-16T09:00:00+00:00", "attributes": {}})
    c.post(f"/api/v1/floors/{floor}/anchors", json={"resource_type": "ha_entity", "resource_id": "lock.front", "x": 0.3, "y": 0.2, "layer_id": "doors"})
    c.post(f"/api/v1/floors/{floor}/anchors", json={"resource_type": "ha_entity", "resource_id": "light.hall", "x": 0.4, "y": 0.4, "layer_id": "lights"})
    with app.state.db.connection() as conn:
        doc = plan_schema.export_version(conn, v["id"])
        again = plan_schema.export_version(conn, v["id"])
    assert plan_schema.validate(doc) == [], plan_schema.validate(doc)
    assert doc["source"]["sha256"] == asset["sha256"] and doc["source"]["page"] == 1 and doc["transform"] == {"rotation": 90, "crop": {"x": 0.1, "y": 0.1, "w": 0.8, "h": 0.8}}
    assert doc["dimensions"]["calibration"]["status"] == "missing" and "calibration missing" in doc["uncertainty"]["notes"]
    assert [r["name"] for r in doc["rooms"]] == ["לובי"] and doc["rooms"][0]["source"] == "manual"
    assert [d["entity_id"] for d in doc["doors"]] == ["lock.front"], "a light is not a door"
    assert doc["walls"] == [] and doc["windows"] == [] and "not detected" in doc["uncertainty"]["notes"][0]
    assert plan_schema.canonical_json(doc) == plan_schema.canonical_json(again)
    shuffled = copy.deepcopy(doc)
    shuffled["rooms"][0] = dict(reversed(list(shuffled["rooms"][0].items())))
    assert plan_schema.canonical_json(shuffled) == plan_schema.canonical_json(doc), "key order does not change the canonical text"
