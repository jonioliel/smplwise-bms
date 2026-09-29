"""Stairs between floors and stairs with a landing (T085, owner 2026-09-29: "stairs connect only between levels"). A
connector linked to another floor reaches a chosen LEVEL there (level_to names that floor's level); its twin is the
same stairs walked from the other floor (reversed), placed at the same plan coordinates when both plans share a frame
and at the centre of the other plan otherwise; the far floor and level are named on every read (far); deleting the
twin, a deleted floor and a missing twin are handled without ever blocking publish; the stairs model (shape, turn,
flights, landing depth) is validated."""
from __future__ import annotations

from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app

GALLERY = {"id": "L-gal", "name": "גלריה", "elevation_m": 2.0, "ceiling_height_m": 2.6, "is_default": False, "external_ids": {}}


def STAIRS(cid: str = "st1", **kw) -> dict:
    c = {"id": cid, "kind": "stairs", "level_from": "L0", "level_to": None, "floor_ids": [], "polyline": [[0.3, 0.5], [0.5, 0.5]], "width_m": 1.2, "label": None,
         "object_id": None, "source": "manual", "external_ids": {}}
    c.update(kw)
    return c


def _plan(c, floor_id: str, png: bytes) -> str:
    asset = c.post(f"/api/v1/floors/{floor_id}/plan-assets", files={"file": ("plan.png", png, "image/png")}).json()
    v = c.post(f"/api/v1/floors/{floor_id}/plan-versions", json={"asset_id": asset["id"]}).json()
    assert c.post(f"/api/v1/plan-versions/{v['id']}/publish").status_code == 200
    return v["id"]


def _draft(c, vid) -> dict:
    return c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()


def _save(c, vid, **fields) -> dict:
    g = _draft(c, vid)
    r = c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": dict(g["doc"], **fields), "base_revision": g["geometry"]["revision"]})
    assert r.status_code == 200, r.text
    return r.json()


def _setup(settings, same_sheet: bool):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    v2 = _plan(c, ids["floor2"], png_bytes())
    v3 = _plan(c, ids["floor3"], png_bytes() if same_sheet else png_bytes(800, 400, color=(250, 240, 240)))
    return app, c, ids, v2, v3


def _conn(c, vid, cid="st1") -> dict | None:
    return next((x for x in _draft(c, vid)["doc"]["connectors"] if x["id"] == cid), None)


def test_link_reaches_the_chosen_level_of_the_other_floor_and_both_twins_name_each_other(settings):
    app, c, ids, v2, v3 = _setup(settings, same_sheet=True)
    _save(c, v3, levels=[*_draft(c, v3)["doc"]["levels"], GALLERY])
    _save(c, v2, connectors=[STAIRS()])
    # the picker's list: the other floor with its levels, and whether it shares this plan's frame
    targets = c.get(f"/api/v1/plan-versions/{v2}/geometry/link-targets").json()["floors"]
    assert [(f["floor_id"], f["name"], f["level"], f["version_id"], f["same_frame"]) for f in targets] == [(ids["floor3"], "קומה 3", 3, v3, True)]
    assert [(lv["id"], lv["name"]) for lv in targets[0]["levels"]] == [("L0", "מפלס ראשי"), ("L-gal", "גלריה")]
    # a level of THIS floor is not a level of the other one
    bad = c.post(f"/api/v1/plan-versions/{v2}/geometry/link", json={"connector_id": "st1", "floor_id": ids["floor3"], "level_to": "L-nope"})
    assert bad.status_code == 422 and bad.json()["code"] == "validation"
    r = c.post(f"/api/v1/plan-versions/{v2}/geometry/link", json={"connector_id": "st1", "floor_id": ids["floor3"], "level_to": "L-gal"})
    assert r.status_code == 200, r.text
    assert r.json()["target"]["level_id"] == "L-gal" and r.json()["target"]["placement"] == "aligned"
    mine, theirs = _conn(c, v2), _conn(c, v3)
    assert mine["level_from"] == "L0" and mine["level_to"] == "L-gal" and mine["floor_ids"] == sorted([ids["floor2"], ids["floor3"]])
    assert theirs["level_from"] == "L-gal" and theirs["level_to"] == "L0", "the twin starts on the gallery and leads back to floor 2's main level"
    assert theirs["polyline"] == [[0.5, 0.5], [0.3, 0.5]] and not theirs.get("needs_placement"), "the same sheet: the same plan coordinates, walked back"
    assert mine["far"] == {"floor_id": ids["floor3"], "floor_name": "קומה 3", "level_name": "גלריה", "direction": "up"}
    assert theirs["far"] == {"floor_id": ids["floor2"], "floor_name": "קומה 2", "level_name": "מפלס ראשי", "direction": "down"}
    assert _draft(c, v2)["issues"] == [] and _draft(c, v3)["issues"] == []
    # the export labels the stairs with the other floor and level
    svg = c.get(f"/api/v1/plan-versions/{v2}/export.svg?draft=true")
    assert svg.status_code == 200 and "↑ קומה 3 · גלריה" in svg.text
    # a renamed floor shows at the next read
    assert c.patch(f"/api/v1/floors/{ids['floor3']}", json={"name": "גלריה עליונה"}).status_code == 200
    assert _conn(c, v2)["far"]["floor_name"] == "גלריה עליונה"


def test_a_twin_moves_on_its_own_and_relinking_keeps_its_place_but_takes_the_new_level(settings):
    app, c, ids, v2, v3 = _setup(settings, same_sheet=True)
    _save(c, v3, levels=[*_draft(c, v3)["doc"]["levels"], GALLERY])
    _save(c, v2, connectors=[STAIRS()])
    assert c.post(f"/api/v1/plan-versions/{v2}/geometry/link", json={"connector_id": "st1", "floor_id": ids["floor3"]}).json()["target"]["level_id"] == "L0"
    # the person moves the twin on floor 3: floor 2's stairs stay where they are
    d3 = _draft(c, v3)
    _save(c, v3, connectors=[dict(x, polyline=[[0.6, 0.2], [0.6, 0.4]]) if x["id"] == "st1" else x for x in d3["doc"]["connectors"]])
    assert _conn(c, v2)["polyline"] == [[0.3, 0.5], [0.5, 0.5]]
    r = c.post(f"/api/v1/plan-versions/{v2}/geometry/link", json={"connector_id": "st1", "floor_id": ids["floor3"], "level_to": "L-gal"})
    assert r.json()["target"]["placement"] == "kept"
    theirs = _conn(c, v3)
    assert theirs["polyline"] == [[0.6, 0.2], [0.6, 0.4]] and theirs["level_from"] == "L-gal"
    again = c.post(f"/api/v1/plan-versions/{v2}/geometry/link", json={"connector_id": "st1", "floor_id": ids["floor3"], "level_to": "L-gal"})
    assert again.json()["target"]["revision"] == r.json()["target"]["revision"], "linking twice changes nothing on the other floor"


def test_plans_without_a_shared_frame_get_the_twin_at_the_centre_with_a_placement_hint(settings):
    app, c, ids, v2, v3 = _setup(settings, same_sheet=False)
    # floor 2 is 640 px = 6.4 m wide; floor 3 is not calibrated (estimated scale of an 800 px plan)
    assert c.patch(f"/api/v1/plan-versions/{v2}/calibration", json={"pairs": [{"a": [0, 0.5], "b": [1, 0.5], "metres": 6.4}]}).status_code == 200
    _save(c, v2, connectors=[STAIRS(polyline=[[0.1, 0.1], [0.4, 0.1]])])
    targets = c.get(f"/api/v1/plan-versions/{v2}/geometry/link-targets").json()["floors"]
    assert targets[0]["same_frame"] is False
    r = c.post(f"/api/v1/plan-versions/{v2}/geometry/link", json={"connector_id": "st1", "floor_id": ids["floor3"]})
    assert r.json()["target"]["placement"] == "centred"
    theirs = _conn(c, v3)
    assert theirs["needs_placement"] is True
    (x0, y0), (x1, y1) = theirs["polyline"]
    assert abs((x0 + x1) / 2 - 0.5) < 1e-6 and abs(y0 - 0.5) < 1e-6 and x0 > x1, "centred, walked back"
    d3 = _draft(c, v3)
    width_m = (x0 - x1) * d3["doc"]["dimensions"]["width_px"] * (0.2 / (0.006 * 800))
    assert abs(width_m - 0.3 * 6.4) < 0.01, "the same length in metres on the other plan"
    assert [(i["code"], i["severity"]) for i in d3["issues"]] == [("connector_placement", "warning")]
    # moving it (the editor drops needs_placement) clears the hint
    _save(c, v3, connectors=[{k: v for k, v in x.items() if k != "needs_placement"} for x in d3["doc"]["connectors"]])
    assert _draft(c, v3)["issues"] == []


def test_deleting_the_twin_and_dangling_links_warn_but_never_block_publish(settings):
    app, c, ids, v2, v3 = _setup(settings, same_sheet=True)
    _save(c, v2, connectors=[STAIRS()])
    assert c.post(f"/api/v1/plan-versions/{v2}/geometry/link", json={"connector_id": "st1", "floor_id": ids["floor3"]}).status_code == 200
    # "למחוק גם בקומה השנייה?" - the editor removes its own copy and asks for the twin to go
    _save(c, v2, connectors=[])
    assert [i["code"] for i in _draft(c, v3)["issues"]] == ["connector_twin_missing"], "the twin left behind is flagged"
    assert c.post(f"/api/v1/plan-versions/{v3}/geometry/publish").status_code == 200, "a dangling link never blocks publish"
    assert c.post(f"/api/v1/plan-versions/{v2}/geometry/twin-delete", json={"connector_id": "st1", "floor_id": ids["floor2"]}).status_code == 422
    bind(c, settings, "dana", "viewer", "floor", ids["floor2"])
    assert c.post(f"/api/v1/plan-versions/{v2}/geometry/twin-delete", json={"connector_id": "st1", "floor_id": ids["floor3"]}, headers=as_user("dana")).status_code == 403
    r = c.post(f"/api/v1/plan-versions/{v2}/geometry/twin-delete", json={"connector_id": "st1", "floor_id": ids["floor3"]})
    assert r.status_code == 200 and r.json() == {"removed": True, "floor_id": ids["floor3"]}
    assert _conn(c, v3) is None and _draft(c, v3)["issues"] == []
    assert c.post(f"/api/v1/plan-versions/{v2}/geometry/twin-delete", json={"connector_id": "st1", "floor_id": ids["floor3"]}).json()["removed"] is False
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'geometry.connector.twin_delete'").fetchone()[0] == 1
    # a deleted floor: the stairs stay, flagged, and publish still works; the level gone on the other floor is flagged too
    _save(c, v3, levels=[*_draft(c, v3)["doc"]["levels"], GALLERY])
    _save(c, v2, connectors=[STAIRS()])
    assert c.post(f"/api/v1/plan-versions/{v2}/geometry/link", json={"connector_id": "st1", "floor_id": ids["floor3"], "level_to": "L-gal"}).status_code == 200
    _save(c, v3, levels=[lv for lv in _draft(c, v3)["doc"]["levels"] if lv["id"] != "L-gal"], connectors=[dict(x, level_from="L0") for x in _draft(c, v3)["doc"]["connectors"]])
    assert [i["code"] for i in _draft(c, v2)["issues"]] == ["connector_far_level"]
    assert c.delete(f"/api/v1/floors/{ids['floor3']}?force=true").status_code == 204
    d2 = _draft(c, v2)
    assert [i["code"] for i in d2["issues"]] == ["connector_far_missing"] and d2["doc"]["connectors"][0]["far"]["missing"] is True
    assert c.post(f"/api/v1/plan-versions/{v2}/geometry/publish").status_code == 200


def test_relinking_to_another_floor_removes_the_old_twin(settings):
    app, c, ids, v2, v3 = _setup(settings, same_sheet=True)
    f4 = c.post(f"/api/v1/buildings/{ids['building']}/floors", json={"name": "קומה 4", "level": 4}).json()
    v4 = _plan(c, f4["id"], png_bytes())
    _save(c, v2, connectors=[STAIRS()])
    assert c.post(f"/api/v1/plan-versions/{v2}/geometry/link", json={"connector_id": "st1", "floor_id": ids["floor3"]}).status_code == 200
    assert c.post(f"/api/v1/plan-versions/{v2}/geometry/link", json={"connector_id": "st1", "floor_id": f4["id"]}).status_code == 200
    assert _conn(c, v3) is None and _conn(c, v4) is not None
    assert _conn(c, v2)["floor_ids"] == sorted([ids["floor2"], f4["id"]])


def test_the_stairs_model_is_validated_and_a_u_stair_twin_keeps_its_flights_walked_back(settings):
    app, c, ids, v2, v3 = _setup(settings, same_sheet=True)
    u = STAIRS(shape="u", turn="right", flights=[{"steps": 12}, {"steps": 10}], landing_depth_m=1.2,
               polyline=[[0.3, 0.8], [0.3, 0.3], [0.45, 0.3], [0.45, 0.8]], level_to=None, floor_ids=[])
    ok = _save(c, v2, levels=[*_draft(c, v2)["doc"]["levels"], GALLERY], connectors=[dict(u, level_to="L-gal")])
    assert ok["issues"] == []

    def codes(**kw):
        return [i["code"] for i in _save(c, v2, connectors=[dict(u, level_to="L-gal", **kw)])["issues"]]

    assert codes(flights=[{"steps": 12}]) == ["stair_flights"], "a U has two flights"
    assert codes(flights=[{"steps": 0}, {"steps": 10}]) == ["stair_steps"]
    assert codes(flights=[{"steps": 61}, {"steps": 10}]) == ["stair_steps"]
    assert codes(flights=[]) == ["stair_flights"]
    assert codes(width_m=0.5) == ["size"] and codes(width_m=5.5) == ["size"]
    assert codes(landing_depth_m=0.1) == ["size"]
    assert codes(polyline=[[0.3, 0.8], [0.3, 0.3]]) == ["stair_path"]
    assert codes(shape="spiral") == ["enum"]
    typed = c.put(f"/api/v1/plan-versions/{v2}/geometry", json={"doc": dict(_draft(c, v2)["doc"], connectors=[dict(u, flights="12+10")]), "base_revision": _draft(c, v2)["geometry"]["revision"]})
    assert typed.status_code == 422, "flights of the wrong type refuse the save"
    # linked, the twin walks the U back: the flights swap and the turn side is read from its own path
    _save(c, v2, connectors=[u])
    assert c.post(f"/api/v1/plan-versions/{v2}/geometry/link", json={"connector_id": "st1", "floor_id": ids["floor3"]}).status_code == 200
    theirs = _conn(c, v3)
    assert theirs["flights"] == [{"steps": 10}, {"steps": 12}] and theirs["polyline"] == [[0.45, 0.8], [0.45, 0.3], [0.3, 0.3], [0.3, 0.8]]
    assert theirs["turn"] == "left" and theirs["shape"] == "u" and theirs["landing_depth_m"] == 1.2
    assert _draft(c, v3)["issues"] == []
