"""PLAN3D-R28-WIZARD2-2434: the plan wizard (frontend/src/plan-wizard/) against the real app - the exact API sequence its
wizard-backend.ts ApiBackend sends, in the wizard's order: upload -> version (the wizard's note) -> draft + detect ->
door-width estimate -> accept -> room detection -> room accept -> room tags / area -> the styled draft (document 2.2 room and
level materials, a catalog object) -> publish -> devices and cameras placed one by one after the publish (no retry; a refused
one is counted). The floor already has a published plan, so "the rooms attach to the new draft" is a real check, not a
coincidence of a single version. Also: the back-to-upload discard (an abandoned wizard draft would receive the anchors of the
published plan - the reason the wizard discards it), and the resume lookup (the newest draft carries the wizard's note).
Synthetic pictures only (fixtures/plan_detect, the apartment drawing); no device, NVR or Home Assistant is contacted."""
from __future__ import annotations

import dataclasses

from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient

import plan_detect_metrics as pm
from smplwise.db import now_iso
from smplwise.main import create_app

API = "/api/v1"
APARTMENT = next(png for name, _gt, png in pm.load_set() if name == "apartment")
WIZARD_NOTE = "אשף תוכנית חדשה"  # wizard-backend.ts WIZARD_NOTE: how the wizard (and its resume offer) knows its own drafts
AREA = "living_room"


def _app(settings):
    settings = dataclasses.replace(settings, max_render_px=1600)
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    floor = ids["floor2"]
    # the floor already has a published plan (another drawing): the wizard's draft must not be confused with it
    old_asset = c.post(f"{API}/floors/{floor}/plan-assets", files={"file": ("old.png", png_bytes(), "image/png")}).json()
    old = c.post(f"{API}/floors/{floor}/plan-versions", json={"asset_id": old_asset["id"]}).json()
    assert c.post(f"{API}/plan-versions/{old['id']}/publish").status_code == 200
    from smplwise.services.autosync import DEFAULT_RECORDER, ensure_recorder

    now = now_iso()
    with app.state.db.connection() as conn:
        conn.execute("INSERT INTO ha_areas(area_id, name, floor_id, position, updated_at) VALUES (?, 'סלון', NULL, 0, ?)", (AREA, now))
        for eid, dom, dc in (("light.living", "light", None), ("binary_sensor.living_motion", "binary_sensor", "motion")):
            conn.execute("INSERT INTO ha_entities(entity_id, name, domain, device_class, area_id, area_name, state, available, disabled, first_seen_at, updated_at)"
                         " VALUES (?, ?, ?, ?, ?, 'סלון', 'off', 1, 0, ?, ?)", (eid, eid, dom, dc, AREA, now, now))
        ensure_recorder(conn)
        for cid, ch in (("cam-hall", 1), ("cam-yard", 2)):
            conn.execute("INSERT INTO cameras(id, recorder_id, channel, name_source, sort_order, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'online', ?, ?)",
                         (cid, DEFAULT_RECORDER, ch, f"מצלמה {ch}", ch, now, now))
    return app, c, ids, old["id"]


def _start(c: TestClient, floor: str, png: bytes = APARTMENT, name: str = "apartment.png") -> dict:
    """Step 1 as the wizard does it: the asset, then a version with the wizard's note."""
    asset = c.post(f"{API}/floors/{floor}/plan-assets", files={"file": (name, png, "image/png")})
    assert asset.status_code == 201, asset.text
    v = c.post(f"{API}/floors/{floor}/plan-versions", json={"asset_id": asset.json()["id"], "page": 1, "rotation": 0, "crop": None, "notes": WIZARD_NOTE})
    assert v.status_code == 201, v.text
    assert v.json()["status"] == "draft" and v.json()["notes"] == WIZARD_NOTE
    return v.json()


def _draft(c: TestClient, vid: str) -> dict:
    r = c.get(f"{API}/plan-versions/{vid}/geometry?draft=true")
    assert r.status_code == 200, r.text
    return r.json()


def _structure(c: TestClient, vid: str) -> dict:
    """Steps 2-3: draft + detect, the door-width estimate (no measured calibration), accept everything (replace_auto)."""
    g = _draft(c, vid)
    r = c.post(f"{API}/plan-versions/{vid}/detect", json={"targets": ["walls", "openings"]})
    assert r.status_code == 200, r.text
    det = r.json()
    assert det["version_id"] == vid and det["walls"] and det["openings"]
    hint = det["calibration_hint"]
    assert hint and hint["method"] == "door_width"
    cal = c.patch(f"{API}/plan-versions/{vid}/calibration", json={"estimate": {"scale_m_per_px": hint["scale_m_per_px"], "method": "door_width", "reason": hint["reason"]}})
    assert cal.status_code == 200, cal.text
    g = _draft(c, vid)
    assert g["doc"]["dimensions"]["calibration"]["status"] == "estimated"
    accepted = [w["id"] for w in det["walls"]] + [o["id"] for o in det["openings"]]
    acc = c.post(f"{API}/plan-versions/{vid}/detect/accept", json={
        "accepted": accepted, "edits": {}, "replace_auto": True,
        "candidates": {"walls": det["walls"], "openings": det["openings"], "objects": det.get("objects", [])},
        "base_revision": g["geometry"]["revision"], "detector": det["detector"]})
    assert acc.status_code == 200, acc.text
    doc = acc.json()["doc"]
    assert len(doc["walls"]) == len(det["walls"]) and len(doc["openings"]) == len(det["openings"])
    return acc.json()


def _rooms(c: TestClient, floor: str, vid: str) -> list[dict]:
    """Step 4: room detection on the floor (the editor version = the wizard's draft), accept, tags + the area link."""
    d = c.post(f"{API}/floors/{floor}/zones/detect", json={"strength": "medium"})
    assert d.status_code == 200, d.text
    det = d.json()
    assert det["plan_version_id"] == vid, "room detection runs on the wizard's new draft, not on the published plan"
    assert det["rooms"], det  # the apartment drawing yields at least one closed room at "medium"
    names = ["סלון", *(f"חדר {i + 2}" for i in range(len(det["rooms"]) - 1))]
    kinds = ["room"] * len(det["rooms"])
    acc = c.post(f"{API}/floors/{floor}/zones/accept", json={"candidates": [{"polygon": r["polygon"], "name": n, "kind": k} for r, n, k in zip(det["rooms"], names, kinds)], "replace_auto": False})
    assert acc.status_code == 201, acc.text
    created = [z for zid in acc.json()["created"] for z in acc.json()["zones"] if z["id"] == zid]
    assert len(created) == len(det["rooms"])
    assert all(z["plan_version_id"] == vid for z in created), "the accepted rooms belong to the wizard's draft version"
    first = created[0]
    p = c.patch(f"{API}/zones/{first['id']}", json={"revision": first["revision"], "tags": ["living"], "area_id": AREA})
    assert p.status_code == 200, p.text
    assert p.json()["tags"] == ["living"]
    for z in created[1:]:
        assert c.patch(f"{API}/zones/{z['id']}", json={"revision": z["revision"], "tags": []}).status_code == 200
    return created


def _style(c: TestClient, vid: str, rooms: list[dict]) -> dict:
    """Step 5: the kit as applyKit writes it - the level's floor and ceiling height, a document room per zone with its floor
    material and tags, and one starter object tagged plan-wizard."""
    g = _draft(c, vid)
    doc = g["doc"]
    level = next((lv for lv in doc["levels"] if lv.get("is_default")), doc["levels"][0])
    doc["levels"] = [dict(lv, floor_material_id="oak", ceiling_height_m=2.8) if lv["id"] == level["id"] else lv for lv in doc["levels"]]
    doc["rooms"] = [{"id": z["id"], "level_id": level["id"], "tags": ["living"] if i == 0 else [], "floor_material_id": "oak" if i == 0 else "tiles_grey"} for i, z in enumerate(rooms)]
    xs = [p["x"] for p in rooms[0]["polygon"]]
    ys = [p["y"] for p in rooms[0]["polygon"]]
    doc["objects"] = [o for o in doc["objects"] if "plan-wizard" not in (o.get("tags") or [])] + [{
        "id": f"wz-{rooms[0]['id']}-0"[:64], "item_id": "table.side", "level_id": level["id"], "position": [round(sum(xs) / len(xs), 5), round(sum(ys) / len(ys), 5)],
        "rotation_deg": 0, "size": {"w_m": 0.5, "d_m": 0.5, "h_m": 0.55}, "z_m": 0, "params": {}, "label": None, "anchor_ref": None, "group_id": None,
        "confidence": 1, "source": "manual", "locked": False, "external_ids": {}, "tags": ["plan-wizard"]}]
    r = c.put(f"{API}/plan-versions/{vid}/geometry", json={"doc": doc, "base_revision": g["geometry"]["revision"]})
    assert r.status_code == 200, r.text
    saved = r.json()["doc"]
    assert saved["levels"][0]["floor_material_id"] == "oak" and {x["id"] for x in saved["rooms"]} == {z["id"] for z in rooms}
    assert any("plan-wizard" in (o.get("tags") or []) for o in saved["objects"])
    return r.json()


def _place(c: TestClient, floor: str, items: list[dict], headers: dict | None = None) -> dict:
    """Step 7 after the publish: one POST per item, never retried; a refusal is counted with its code."""
    placed, refused = [], []
    for it in items:
        r = c.post(f"{API}/floors/{floor}/anchors", json=it, headers=headers or {})
        if r.status_code == 201:
            placed.append(r.json())
        else:
            refused.append((it["resource_id"], r.status_code, r.json().get("code")))
    return {"placed": placed, "refused": refused}


def test_the_wizard_sequence_end_to_end(settings):
    app, c, ids, old = _app(settings)
    floor = ids["floor2"]
    v = _start(c, floor)
    vid = v["id"]
    _structure(c, vid)
    rooms = _rooms(c, floor, vid)
    _style(c, vid, rooms)
    # nothing reached the viewers yet: the published plan is still the old one
    assert c.get(f"{API}/floors/{floor}/map").json()["plan"]["id"] == old
    pub = c.post(f"{API}/plan-versions/{vid}/publish")
    assert pub.status_code == 200, pub.text
    assert pub.json()["status"] == "published"
    versions = {x["id"]: x["status"] for x in c.get(f"{API}/floors/{floor}/plan-versions").json()["versions"]}
    assert versions == {old: "archived", vid: "published"}
    g = c.get(f"{API}/plan-versions/{vid}/geometry")
    assert g.status_code == 200 and g.json()["doc"]["walls"], "publishing the version published its structure"
    assert {x["id"] for x in g.json()["doc"]["rooms"]} == {z["id"] for z in rooms}
    # devices, then cameras, one by one; the duplicate and the unknown camera are refused and counted, not retried
    level = g.json()["doc"]["levels"][0]["id"]
    items = [
        {"resource_type": "ha_entity", "resource_id": "light.living", "x": 0.4, "y": 0.4, "level_id": level},
        {"resource_type": "ha_entity", "resource_id": "binary_sensor.living_motion", "x": 0.42, "y": 0.41, "level_id": level},
        {"resource_type": "camera", "resource_id": "cam-hall", "x": 0.1, "y": 0.1, "level_id": level, "layer_id": "cameras"},
        {"resource_type": "camera", "resource_id": "cam-hall", "x": 0.2, "y": 0.2, "level_id": level, "layer_id": "cameras"},
        {"resource_type": "camera", "resource_id": "cam-none", "x": 0.3, "y": 0.3, "level_id": level, "layer_id": "cameras"},
    ]
    out = _place(c, floor, items)
    assert [a["resource_id"] for a in out["placed"]] == ["light.living", "binary_sensor.living_motion", "cam-hall"]
    assert out["refused"] == [("cam-hall", 409, "already_placed"), ("cam-none", 422, "validation")]
    assert all(a["plan_version_id"] == vid for a in out["placed"]), "the anchors stand on the published wizard version"
    m = c.get(f"{API}/floors/{floor}/map").json()
    assert m["plan"]["id"] == vid and not m["needs_alignment"]
    on_map = {(a["resource_type"], a["resource_id"]) for a in m["anchors"]}
    assert {("ha_entity", "light.living"), ("ha_entity", "binary_sensor.living_motion"), ("camera", "cam-hall")} <= on_map
    assert next(a for a in m["anchors"] if a["resource_id"] == "light.living")["layer_id"] == "lights"  # the server's layer by domain
    # the placed device is no longer offered by the wizard's catalogue query (placed=false)
    left = {e["entity_id"] for e in c.get(f"{API}/ha/entities?placed=false&limit=300").json()["entities"]}
    assert "light.living" not in left


def test_a_camera_the_editor_does_not_reach_is_refused_and_counted(settings):
    app, c, ids, _old = _app(settings)
    floor = ids["floor2"]
    vid = _start(c, floor)["id"]
    _structure(c, vid)
    assert c.post(f"{API}/plan-versions/{vid}/publish").status_code == 200
    bind(c, settings, "ella", "editor", "floor", floor)
    out = _place(c, floor, [
        {"resource_type": "ha_entity", "resource_id": "light.living", "x": 0.5, "y": 0.5},
        {"resource_type": "camera", "resource_id": "cam-yard", "x": 0.5, "y": 0.6},
    ], headers=as_user("ella"))
    # a floor editor places devices; a camera it does not already reach would widen who sees it (T055 B1): 403, counted
    assert [a["resource_id"] for a in out["placed"]] == ["light.living"]
    assert [(rid, st) for rid, st, _code in out["refused"]] == [("cam-yard", 403)]


def test_back_to_upload_an_abandoned_draft_would_take_the_anchors_so_the_wizard_discards_it(settings):
    app, c, ids, _old = _app(settings)
    floor = ids["floor2"]
    first = _start(c, floor)["id"]
    _structure(c, first)
    rooms_first = _rooms(c, floor, first)
    # "back" to the upload with another file: a second wizard version
    second = _start(c, floor, APARTMENT, "apartment-b.png")["id"]
    # the wizard's discard (after the person confirms): its rooms of the first pass, then the draft itself
    for z in rooms_first:
        assert c.delete(f"{API}/zones/{z['id']}").status_code == 204
    assert c.delete(f"{API}/plan-versions/{first}").status_code == 204
    assert first not in {x["id"] for x in c.get(f"{API}/floors/{floor}/plan-versions").json()["versions"]}
    _structure(c, second)
    _rooms(c, floor, second)  # the rooms attach to the second draft
    assert c.post(f"{API}/plan-versions/{second}/publish").status_code == 200
    out = _place(c, floor, [{"resource_type": "ha_entity", "resource_id": "light.living", "x": 0.5, "y": 0.5}])
    assert out["placed"][0]["plan_version_id"] == second, "with the abandoned draft gone the devices stand on the published plan"


def test_characterization_an_abandoned_draft_left_behind_receives_the_anchors(settings):
    """Why the wizard does not just leave the earlier draft (2433 known limit): the server places a new anchor on the floor's
    newest DRAFT when there is one (anchors._editor_version), so a draft left behind by "back" would take the devices the wizard
    places after publishing the other version - they would not stand on the published plan."""
    app, c, ids, _old = _app(settings)
    floor = ids["floor2"]
    abandoned = _start(c, floor)["id"]
    kept = _start(c, floor, APARTMENT, "apartment-2.png")["id"]
    _structure(c, kept)
    assert c.post(f"{API}/plan-versions/{kept}/publish").status_code == 200
    out = _place(c, floor, [{"resource_type": "ha_entity", "resource_id": "light.living", "x": 0.5, "y": 0.5}])
    assert out["placed"][0]["plan_version_id"] == abandoned
    assert c.delete(f"{API}/plan-versions/{abandoned}").json()["code"] == "has_anchors"


def test_resume_finds_the_newest_draft_by_the_wizard_note_and_its_rooms(settings):
    app, c, ids, old = _app(settings)
    floor = ids["floor2"]
    vid = _start(c, floor)["id"]
    _structure(c, vid)
    rooms = _rooms(c, floor, vid)
    # what the wizard reads when it opens again (wizard-backend.ts resumable()): the floor's versions, newest first
    versions = c.get(f"{API}/floors/{floor}/plan-versions").json()["versions"]
    drafts = [x for x in versions if x["status"] == "draft"]
    assert drafts[0]["id"] == vid and drafts[0]["notes"] == WIZARD_NOTE
    # the draft keeps the accepted structure, and the floor's zones of that version are the wizard's rooms
    assert _draft(c, vid)["doc"]["walls"]
    zones = c.get(f"{API}/floors/{floor}/zones").json()["zones"]
    mine = [z for z in zones if z.get("plan_version_id") == vid and z["source"] == "auto"]
    assert {z["id"] for z in mine} == {z["id"] for z in rooms}
    assert next(z for z in mine if z["name"] == "סלון")["tags"] == ["living"]
    # a studio draft made later is newer: the wizard does not offer to resume then
    asset = c.post(f"{API}/floors/{floor}/plan-assets", files={"file": ("studio.png", png_bytes(), "image/png")}).json()
    c.post(f"{API}/floors/{floor}/plan-versions", json={"asset_id": asset["id"], "notes": ""})
    drafts = [x for x in c.get(f"{API}/floors/{floor}/plan-versions").json()["versions"] if x["status"] == "draft"]
    assert drafts[0]["notes"] != WIZARD_NOTE
