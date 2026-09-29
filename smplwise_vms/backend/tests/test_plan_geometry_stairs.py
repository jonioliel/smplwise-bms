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
    assert mine["far"] == {"floor_id": ids["floor3"], "floor_name": "קומה 3", "level_name": "גלריה", "direction": "up", "level_elevation_m": 2.0, "datum_m": 3.0}
    assert theirs["far"] == {"floor_id": ids["floor2"], "floor_name": "קומה 2", "level_name": "מפלס ראשי", "direction": "down", "level_elevation_m": 0.0, "datum_m": -3.0}
    assert set(map(tuple, theirs["polyline"])) == set(map(tuple, mine["polyline"])), "the twin's footprint is the original's"
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
    unconfirmed = c.post(f"/api/v1/plan-versions/{v2}/geometry/link", json={"connector_id": "st1", "floor_id": f4["id"]})
    assert unconfirmed.status_code == 409 and unconfirmed.json()["code"] == "relink_confirm", "moving the link deletes the old twin: only when confirmed"
    assert _conn(c, v3) is not None
    moved = c.post(f"/api/v1/plan-versions/{v2}/geometry/link", json={"connector_id": "st1", "floor_id": f4["id"], "replace": True})
    assert moved.status_code == 200 and moved.json()["removed_floors"] == [ids["floor3"]]
    assert _conn(c, v3) is None and _conn(c, v4) is not None
    assert _conn(c, v2)["floor_ids"] == sorted([ids["floor2"], f4["id"]])
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT resource_id FROM audit_log WHERE action = 'geometry.connector.twin_delete'").fetchall()[0][0] == ids["floor3"]
    # another building is refused (review L11)
    other_site = c.post("/api/v1/sites", json={"name": "אתר אחר", "address": ""}).json()
    other_b = c.post(f"/api/v1/sites/{other_site['id']}/buildings", json={"name": "מבנה ב"}).json()
    far_floor = c.post(f"/api/v1/buildings/{other_b['id']}/floors", json={"name": "קומה זרה", "level": 1}).json()
    _plan(c, far_floor["id"], png_bytes())
    assert c.post(f"/api/v1/plan-versions/{v2}/geometry/link", json={"connector_id": "st1", "floor_id": far_floor["id"], "replace": True}).status_code == 422
    # an item of the same id on the target that is not this connector's twin is never taken over (review L10)
    _save(c, v3, connectors=[STAIRS("st2", level_to=None)])
    _save(c, v2, connectors=[*_draft(c, v2)["doc"]["connectors"], STAIRS("st2")])
    taken = c.post(f"/api/v1/plan-versions/{v2}/geometry/link", json={"connector_id": "st2", "floor_id": ids["floor3"]})
    assert taken.status_code == 409 and taken.json()["code"] == "twin_id_taken"


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
    assert codes(width_m=0.5) == ["size"] and codes(width_m=5.5) == ["size", "stair_landing"]
    assert codes(landing_depth_m=0.8) == ["stair_landing"], "a turning landing narrower than the stair: a warning (review L6)"
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


def test_a_scoped_editor_cannot_move_a_link_off_a_floor_they_cannot_edit_and_a_twin_relinks_only_from_its_origin(settings):
    """Review B1: an editor of floors 3 and 4 re-linking the twin on floor 3 to floor 4 would have deleted floor 2's
    stairs. Every floor the connector names must be editable (403), a twin moves its link only from the original
    floor (409), and twin-delete needs both floors."""
    app, c, ids, v2, v3 = _setup(settings, same_sheet=True)
    f4 = c.post(f"/api/v1/buildings/{ids['building']}/floors", json={"name": "קומה 4", "level": 4}).json()
    v4 = _plan(c, f4["id"], png_bytes())
    _save(c, v2, connectors=[STAIRS()])
    assert c.post(f"/api/v1/plan-versions/{v2}/geometry/link", json={"connector_id": "st1", "floor_id": ids["floor3"]}).status_code == 200
    assert _conn(c, v3)["origin_floor_id"] == ids["floor2"] and _conn(c, v2)["origin_floor_id"] == ids["floor2"]
    bind(c, settings, "dana", "editor", "floor", ids["floor3"])
    bind(c, settings, "dana", "editor", "floor", f4["id"])
    dana = as_user("dana")
    r = c.post(f"/api/v1/plan-versions/{v3}/geometry/link", json={"connector_id": "st1", "floor_id": f4["id"], "replace": True}, headers=dana)
    assert r.status_code == 403
    assert _conn(c, v2) is not None and _conn(c, v4) is None, "floor 2's stairs are untouched"
    assert c.post(f"/api/v1/plan-versions/{v3}/geometry/twin-delete", json={"connector_id": "st1", "floor_id": ids["floor2"]}, headers=dana).status_code == 403
    # even an admin moves a twin's link only from the floor it was linked from
    r = c.post(f"/api/v1/plan-versions/{v3}/geometry/link", json={"connector_id": "st1", "floor_id": f4["id"], "replace": True})
    assert r.status_code == 409 and r.json()["code"] == "relink_from_origin" and "קשר מחדש מהקומה המקורית" in r.json()["user_message"]
    # changing only the level it reaches, from the twin's side, is fine
    assert c.post(f"/api/v1/plan-versions/{v3}/geometry/link", json={"connector_id": "st1", "floor_id": ids["floor2"]}).status_code == 200
    # within her floors dana links freely, and the draft she saves reaches no floor she cannot edit
    _save(c, v4, connectors=[STAIRS("st4")])
    assert c.post(f"/api/v1/plan-versions/{v4}/geometry/link", json={"connector_id": "st4", "floor_id": ids["floor3"]}, headers=dana).status_code == 200
    g3 = c.get(f"/api/v1/plan-versions/{v3}/geometry?draft=true", headers=dana).json()
    before2 = _draft(c, v2)["geometry"]["revision"]
    changed = [dict(x, flights=[{"steps": 9}], shape="straight") if x["id"] == "st1" else x for x in g3["doc"]["connectors"]]
    put = c.put(f"/api/v1/plan-versions/{v3}/geometry", json={"doc": dict(g3["doc"], connectors=changed), "base_revision": g3["geometry"]["revision"]}, headers=dana)
    assert put.status_code == 200
    assert _draft(c, v2)["geometry"]["revision"] == before2, "no write to floor 2 without map.edit there"
    # review M-a: never silently - the PUT names the floor left behind (neutrally: dana cannot read floor 2), and both
    # floors warn that the twins' models differ
    assert put.json()["twins_skipped"] == [{"floor_id": ids["floor2"], "name": "קומה אחרת"}]
    assert "connector_twin_model" in [i["code"] for i in put.json()["issues"] if i["id"] == "st1"]
    assert "connector_twin_model" in [i["code"] for i in _draft(c, v2)["issues"] if i["id"] == "st1"]
    assert "twins_skipped" not in c.put(f"/api/v1/plan-versions/{v4}/geometry", json={"doc": _draft(c, v4)["doc"], "base_revision": _draft(c, v4)["geometry"]["revision"]}, headers=dana).json()
    # a reader of floor 3 only sees no name of floor 2
    bind(c, settings, "rina", "viewer", "floor", ids["floor3"])
    assert c.post(f"/api/v1/plan-versions/{v3}/geometry/publish").status_code == 200
    seen = c.get(f"/api/v1/plan-versions/{v3}/geometry", headers=as_user("rina")).json()["doc"]["connectors"]
    far = next(x for x in seen if x["id"] == "st1")["far"]
    assert far["floor_name"] == "קומה אחרת" and far["level_name"] is None


def test_floor_height_sets_the_rise_between_floors_from_either_side_and_to_non_default_levels(settings):
    """Owner 2026-09-29 + review M1: the rise between floors = the floor heights between them + the level it reaches
    there - the level it leaves here; far carries the datum and the target level's elevation."""
    app, c, ids, v2, v3 = _setup(settings, same_sheet=True)
    low = {"id": "L-low", "name": "מרתף", "elevation_m": -1.0, "ceiling_height_m": 2.4, "is_default": False, "external_ids": {}}
    _save(c, v2, floor_height_m=3.2, levels=[*_draft(c, v2)["doc"]["levels"], low], connectors=[STAIRS(level_from="L-low")])
    _save(c, v3, levels=[*_draft(c, v3)["doc"]["levels"], dict(GALLERY, elevation_m=1.5)])
    assert c.post(f"/api/v1/plan-versions/{v2}/geometry/link", json={"connector_id": "st1", "floor_id": ids["floor3"], "level_to": "L-gal"}).status_code == 200
    mine, theirs = _conn(c, v2), _conn(c, v3)
    assert (mine["far"]["datum_m"], mine["far"]["level_elevation_m"]) == (3.2, 1.5)  # rise here: 3.2 + 1.5 - (-1.0) = 5.7
    assert (theirs["far"]["datum_m"], theirs["far"]["level_elevation_m"]) == (-3.2, -1.0)  # from the gallery: -3.2 - 1.0 - 1.5 = -5.7
    assert theirs["level_from"] == "L-gal" and theirs["level_to"] == "L-low"
    # a floor in between counts its own height
    f4 = c.post(f"/api/v1/buildings/{ids['building']}/floors", json={"name": "קומה 4", "level": 4}).json()
    v4 = _plan(c, f4["id"], png_bytes())
    _save(c, v3, floor_height_m=4.0)
    _save(c, v2, connectors=[*_draft(c, v2)["doc"]["connectors"], STAIRS("st9")])
    assert c.post(f"/api/v1/plan-versions/{v2}/geometry/link", json={"connector_id": "st9", "floor_id": f4["id"]}).status_code == 200
    assert _conn(c, v2, "st9")["far"]["datum_m"] == 7.2 and _conn(c, v4, "st9")["far"]["datum_m"] == -7.2
    # review L-b: floor numbers that no floor has count the default height (floor 3 -> floor 6: 4.0 + 3.0 + 3.0)
    f6 = c.post(f"/api/v1/buildings/{ids['building']}/floors", json={"name": "קומה 6", "level": 6}).json()
    v6 = _plan(c, f6["id"], png_bytes())
    _save(c, v3, connectors=[*_draft(c, v3)["doc"]["connectors"], STAIRS("st6")])
    assert c.post(f"/api/v1/plan-versions/{v3}/geometry/link", json={"connector_id": "st6", "floor_id": f6["id"]}).status_code == 200
    assert _conn(c, v3, "st6")["far"]["datum_m"] == 10.0 and _conn(c, v6, "st6")["far"]["datum_m"] == -10.0
    # a repeated floor number keeps today's rule: the first floor of that number counts once
    twin4 = c.post(f"/api/v1/buildings/{ids['building']}/floors", json={"name": "קומה 4ב", "level": 4}).json()
    _save(c, _plan(c, twin4["id"], png_bytes()), floor_height_m=9.0)
    assert _conn(c, v3, "st6")["far"]["datum_m"] == 10.0, "floor 4 (created first) counts 3.0; the second floor 4 is ignored"
    # the height is validated
    assert [i["code"] for i in _save(c, v2, floor_height_m=1.0)["issues"]] == ["floor_height"]
    assert [i["code"] for i in _save(c, v2, floor_height_m=12.5)["issues"]] == ["floor_height"]


def test_far_is_computed_on_read_never_stored_and_a_rename_reaches_the_published_read(settings):
    """Review M4: far is not part of the stored document or its hash; the published read computes it too (with an ETag
    that follows it)."""
    app, c, ids, v2, v3 = _setup(settings, same_sheet=True)
    _save(c, v2, connectors=[STAIRS()])
    assert c.post(f"/api/v1/plan-versions/{v2}/geometry/link", json={"connector_id": "st1", "floor_id": ids["floor3"]}).status_code == 200
    assert c.post(f"/api/v1/plan-versions/{v2}/geometry/publish").status_code == 200
    with app.state.db.connection() as conn:
        assert all('"far"' not in r[0] for r in conn.execute("SELECT doc_json FROM plan_geometry").fetchall())
    pub = c.get(f"/api/v1/plan-versions/{v2}/geometry")
    assert pub.json()["doc"]["connectors"][0]["far"]["floor_name"] == "קומה 3"
    etag = pub.headers["etag"]
    assert c.get(f"/api/v1/plan-versions/{v2}/geometry", headers={"If-None-Match": etag}).status_code == 304
    hash_before = _draft(c, v2)["geometry"]["doc_hash"]
    assert c.patch(f"/api/v1/floors/{ids['floor3']}", json={"name": "גלריה עליונה"}).status_code == 200
    again = c.get(f"/api/v1/plan-versions/{v2}/geometry", headers={"If-None-Match": etag})
    assert again.status_code == 200 and again.json()["doc"]["connectors"][0]["far"]["floor_name"] == "גלריה עליונה"
    assert _draft(c, v2)["geometry"]["doc_hash"] == hash_before
    assert c.post(f"/api/v1/plan-versions/{v2}/geometry/publish").json()["unchanged"] is True, "a rename elsewhere publishes nothing here"
    # a far sent back by the editor is dropped on save
    d = _draft(c, v2)
    assert "far" not in _save(c, v2, connectors=d["doc"]["connectors"])["geometry"] and _draft(c, v2)["geometry"]["revision"] == d["geometry"]["revision"]


def test_a_camera_scoped_reader_learns_nothing_of_the_other_floor_from_far_or_the_etag(settings):
    """Review L-d: for a floor the reader may not read, far carries no name, level or heights, and the ETag (which
    follows far) does not move when that floor's name or levels change."""
    app, c, ids, v2, v3 = _setup(settings, same_sheet=True)
    _save(c, v3, levels=[*_draft(c, v3)["doc"]["levels"], GALLERY])
    _save(c, v2, connectors=[STAIRS()])
    assert c.post(f"/api/v1/plan-versions/{v2}/geometry/link", json={"connector_id": "st1", "floor_id": ids["floor3"], "level_to": "L-gal"}).status_code == 200
    assert c.post(f"/api/v1/plan-versions/{v2}/geometry/publish").status_code == 200
    cam = c.post("/api/v1/cameras", json={"channel": 1, "alias": "כניסה"}).json()
    assert c.post(f"/api/v1/floors/{ids['floor2']}/anchors", json={"resource_type": "camera", "resource_id": cam["id"], "x": 0.25, "y": 0.4, "rotation_degrees": 0}).status_code == 201
    bind(c, settings, "cami", "viewer", "camera", cam["id"])
    cami = as_user("cami")
    r = c.get(f"/api/v1/plan-versions/{v2}/geometry", headers=cami)
    assert r.status_code == 200 and r.json()["reach"] != "floor" and r.headers["etag"].endswith('-c"')
    assert r.json()["doc"]["connectors"][0]["far"] == {"floor_id": ids["floor3"], "floor_name": "קומה אחרת", "level_name": None, "direction": "up", "level_elevation_m": None, "datum_m": None}
    etag = r.headers["etag"]
    assert c.get(f"/api/v1/plan-versions/{v2}/geometry", headers={**cami, "If-None-Match": etag}).status_code == 304
    # floor 3 renamed, its gallery raised and its height changed: nothing of it reaches cami's ETag
    assert c.patch(f"/api/v1/floors/{ids['floor3']}", json={"name": "סודי"}).status_code == 200
    _save(c, v3, floor_height_m=4.5, levels=[dict(lv, elevation_m=2.2) if lv["id"] == "L-gal" else lv for lv in _draft(c, v3)["doc"]["levels"]])
    assert c.get(f"/api/v1/plan-versions/{v2}/geometry", headers={**cami, "If-None-Match": etag}).status_code == 304
    # a reader of both floors sees the change (and a new ETag)
    full = c.get(f"/api/v1/plan-versions/{v2}/geometry")
    assert full.json()["doc"]["connectors"][0]["far"]["floor_name"] == "סודי" and full.headers["etag"] != etag


def test_a_stairs_model_change_reaches_the_twin_walked_back_from_its_own_start(settings):
    """Review M3: changing the shape, turn, flights, width or landing of linked stairs updates the twin (reversed
    flights, the other turn side) and regenerates its path from its own start and direction."""
    app, c, ids, v2, v3 = _setup(settings, same_sheet=True)
    _save(c, v2, connectors=[STAIRS(shape="straight", turn="none", flights=[{"steps": 12}], landing_depth_m=None, polyline=[[0.5, 0.8], [0.5, 0.5]])])
    assert c.post(f"/api/v1/plan-versions/{v2}/geometry/link", json={"connector_id": "st1", "floor_id": ids["floor3"]}).status_code == 200
    twin0 = _conn(c, v3)
    assert twin0["polyline"] == [[0.5, 0.5], [0.5, 0.8]]
    d = _draft(c, v2)
    u = [dict(x, shape="u", turn="right", flights=[{"steps": 8}, {"steps": 6}], landing_depth_m=1.2, polyline=[[0.5, 0.8], [0.5, 0.6], [0.6, 0.6], [0.6, 0.8]]) for x in d["doc"]["connectors"]]
    _save(c, v2, connectors=u)
    twin = _conn(c, v3)
    assert (twin["shape"], twin["turn"], twin["flights"], twin["landing_depth_m"]) == ("u", "left", [{"steps": 6}, {"steps": 8}], 1.2)
    assert len(twin["polyline"]) == 4 and twin["polyline"][0] == [0.5, 0.5], "the twin keeps its own start"
    assert twin["polyline"][1][0] == 0.5 and twin["polyline"][1][1] > 0.5, "and its own direction (down the plan, from the top)"
    assert twin["polyline"][2][0] > 0.5, "turning left walked down from the top is the same side as the original right turn"
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'geometry.connector.twin_sync'").fetchone()[0] == 1
    # owner 2026-09-29: the regenerated twin asks "ודא את המיקום" (a warning, never blocking) until moved or confirmed
    assert twin["check_placement"] is True
    d3 = _draft(c, v3)
    assert [(i["code"], i["severity"]) for i in d3["issues"]] == [("connector_check_placement", "warning")]
    assert c.post(f"/api/v1/plan-versions/{v3}/geometry/publish").status_code == 200
    confirmed = _save(c, v3, connectors=[{k: v for k, v in x.items() if k != "check_placement"} for x in d3["doc"]["connectors"]])  # "אישור מיקום"
    assert confirmed["issues"] == [] and "check_placement" not in _conn(c, v3)
    # a move alone does not touch the twin
    rev = _draft(c, v3)["geometry"]["revision"]
    _save(c, v2, connectors=[dict(x, polyline=[[q[0] + 0.01, q[1]] for q in x["polyline"]]) for x in _draft(c, v2)["doc"]["connectors"]])
    assert _draft(c, v3)["geometry"]["revision"] == rev
    # relinking brings the model along too
    _save(c, v3, levels=[*_draft(c, v3)["doc"]["levels"], GALLERY])
    _save(c, v2, connectors=[dict(x, width_m=1.4) for x in _draft(c, v2)["doc"]["connectors"]])
    assert c.post(f"/api/v1/plan-versions/{v2}/geometry/link", json={"connector_id": "st1", "floor_id": ids["floor3"], "level_to": "L-gal"}).status_code == 200
    assert _conn(c, v3)["width_m"] == 1.4 and _conn(c, v3)["level_from"] == "L-gal"
