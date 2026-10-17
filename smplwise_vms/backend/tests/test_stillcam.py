"""STILLCAM (a leftover of the Studio 6 security review): a still or a lightmap is drawn once, in one editor's browser, and the
same pixels are served to every reader of the floor. An object bound to a camera anchor stands at that camera's position (the
store copies the anchor's pose onto its body), so a still drawn before the fix shows a camera's place to a reader whose camera
scope hides that camera - the place the geometry read withholds from them (plan_anchor_scope.redact, security review 2.4.2 M2).

Fixed on both sides:
- the client bakes from a document without camera-bound bodies (map/still-bake.ts bakeSceneInput; recipes still-q2.2 and
  lightmap-2; tests/unit-still-camera-bodies.spec.ts);
- the server withholds a still or a lightmap of an OLDER recipe (drawn with the bodies) from a reader for whom the published
  structure binds an object to a camera they may not see - from the floor bundle, the bakes listing and the file route - and,
  fail closed, a stale one of an older recipe from every reader whose camera scope can withhold something.

The first test is the negative one: it asserted the open behaviour before the server change. Fakes and the in-process test
client only (synthetic image bytes; no device, no GPU).
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from conftest import as_user, bind  # noqa: E402
from test_security_review_247_poc import _floor_with_hidden_camera, _upload, _webp  # noqa: E402

OLD_STILL, NEW_STILL, OLD_LM, NEW_LM = "still-q2.1", "still-q2.2", "lightmap-1", "lightmap-2"
LM_META = '{"texel_m": 0.1, "surfaces": [{"kind": "floor", "level_id": "L0", "uv": [0, 0, 1, 1], "world": [0, 0, 10, 10], "y": 0}]}'


def _png(side: int = 64) -> bytes:
    import io

    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGBA", (side, side), (10, 20, 30, 255)).save(buf, format="PNG")
    return buf.getvalue()


def _bake(c, fid: str, key: str, still_recipe: str, lm_recipe: str) -> tuple[str, str]:
    s = _upload(c, fid, key, _webp(), kind="still", recipe=still_recipe, style="light", band="day", variant="off")
    assert s.status_code == 201, s.text
    lm = _upload(c, fid, key, _png(), kind="lightmap", recipe=lm_recipe, preset="", meta=LM_META)
    assert lm.status_code == 201, lm.text
    return s.json()["id"], lm.json()["id"]


def _level(c, fid: str, who: dict | None = None) -> dict:
    b = c.get(f"/api/v1/floors/{fid}/map", headers=who or {})
    assert b.status_code == 200, b.text
    return (b.json()["bakes"] or {}).get("levels", {}).get("L0", {"stills": {}, "masks": {}, "lightmap": None})


def test_an_older_still_and_lightmap_are_not_served_to_a_reader_denied_the_bound_camera(settings):
    """`ron` (floor viewer, vault camera denied) - the published structure binds a body to the vault camera. The still and
    lightmap of the pre-fix recipes (drawn with that body at the vault camera's place) are not in his bundle, not in his
    listing, and the file route answers 404; the administrator still gets both."""
    c, ids, vid, fid, lobby, vault, anchors = _floor_with_hidden_camera(settings)
    key = c.get(f"/api/v1/floors/{fid}/bakes").json()["bake_key"]
    still_id, lm_id = _bake(c, fid, key, OLD_STILL, OLD_LM)
    ron = as_user("ron")

    lv = _level(c, fid, ron)
    assert lv["stills"] == {} and lv["lightmap"] is None
    listed = c.get(f"/api/v1/floors/{fid}/bakes", headers=ron)
    assert listed.status_code == 200
    assert {r["id"] for r in listed.json()["bakes"]}.isdisjoint({still_id, lm_id})
    assert "still/L0/iso/light/day/off" in listed.json()["missing"] and "lightmap/L0" in listed.json()["missing"]
    for bid in (still_id, lm_id):
        assert c.get(f"/api/v1/floors/{fid}/bakes/{bid}/file", headers=ron).status_code == 404

    # the administrator (nothing withheld): unchanged
    admin = _level(c, fid)
    assert admin["stills"]["iso/light/day/off"]["recipe"] == OLD_STILL and admin["lightmap"]["recipe"] == OLD_LM
    for bid in (still_id, lm_id):
        assert c.get(f"/api/v1/floors/{fid}/bakes/{bid}/file").status_code == 200


def test_a_still_and_lightmap_of_the_fixed_recipes_are_served_to_him(settings):
    """Drawn without camera-bound bodies (still-q2.2 / lightmap-2): ron gets them like everyone."""
    c, ids, vid, fid, lobby, vault, anchors = _floor_with_hidden_camera(settings)
    key = c.get(f"/api/v1/floors/{fid}/bakes").json()["bake_key"]
    still_id, lm_id = _bake(c, fid, key, NEW_STILL, NEW_LM)
    ron = as_user("ron")
    lv = _level(c, fid, ron)
    assert lv["stills"]["iso/light/day/off"]["recipe"] == NEW_STILL and lv["lightmap"]["recipe"] == NEW_LM
    assert {still_id, lm_id} <= {r["id"] for r in c.get(f"/api/v1/floors/{fid}/bakes", headers=ron).json()["bakes"]}
    for bid in (still_id, lm_id):
        assert c.get(f"/api/v1/floors/{fid}/bakes/{bid}/file", headers=ron).status_code == 200
    # a later recipe counts as fixed too (the level-3 renderer)
    assert _upload(c, fid, key, _webp(), kind="still", recipe="still-q3.1", style="dark", band="day", variant="off").status_code == 201
    assert _level(c, fid, ron)["stills"]["iso/dark/day/off"]["recipe"] == "still-q3.1"


def test_an_older_still_is_served_where_nothing_hides_a_bound_camera(settings):
    """An unrestricted viewer, and ron on a floor whose bodies are bound only to cameras he may see, keep the older stills
    (no change where nothing leaks)."""
    c, ids, vid, fid, lobby, vault, anchors = _floor_with_hidden_camera(settings)
    key = c.get(f"/api/v1/floors/{fid}/bakes").json()["bake_key"]
    still_id, _lm = _bake(c, fid, key, OLD_STILL, OLD_LM)
    bind(c, settings, "vera", "viewer", "installation", "*")
    assert _level(c, fid, as_user("vera"))["stills"]["iso/light/day/off"]["recipe"] == OLD_STILL
    assert c.get(f"/api/v1/floors/{fid}/bakes/{still_id}/file", headers=as_user("vera")).status_code == 200

    # rebind the body to the lobby camera (ron sees it) and publish again: the older still is current for ron once rebaked
    g = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()
    objs = [dict(o, anchor_ref={"resource_type": "camera", "resource_id": lobby}) for o in g["doc"]["objects"]]
    assert c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": dict(g["doc"], objects=objs), "base_revision": g["geometry"]["revision"]}).status_code == 200
    assert c.post(f"/api/v1/plan-versions/{vid}/geometry/publish").status_code == 200
    key2 = c.get(f"/api/v1/floors/{fid}/bakes").json()["bake_key"]
    assert key2 != key
    still2, _lm2 = _bake(c, fid, key2, OLD_STILL, OLD_LM)
    lv = _level(c, fid, as_user("ron"))
    assert lv["stills"]["iso/light/day/off"]["recipe"] == OLD_STILL and lv["lightmap"]["recipe"] == OLD_LM
    assert c.get(f"/api/v1/floors/{fid}/bakes/{still2}/file", headers=as_user("ron")).status_code == 200


def test_a_stale_older_still_is_not_served_to_a_scoped_reader(settings):
    """A stale row of an older recipe was drawn from a structure the server no longer reads: fail closed for every reader whose
    camera scope can withhold something; the administrator still sees it listed and served."""
    c, ids, vid, fid, lobby, vault, anchors = _floor_with_hidden_camera(settings)
    key = c.get(f"/api/v1/floors/{fid}/bakes").json()["bake_key"]
    still_id, lm_id = _bake(c, fid, key, OLD_STILL, OLD_LM)
    new_still, _ = _bake(c, fid, key, NEW_STILL, NEW_LM)  # replaces both slots: then re-upload an old one into another slot
    old_dark = _upload(c, fid, key, _webp(), kind="still", recipe=OLD_STILL, style="dark", band="night", variant="on").json()["id"]
    assert c.post(f"/api/v1/floors/{fid}/zones", json={"name": "חדר", "polygon": [{"x": 0.1, "y": 0.1}, {"x": 0.4, "y": 0.1}, {"x": 0.4, "y": 0.4}]}).status_code == 201
    ron = as_user("ron")
    rows = {r["id"]: r for r in c.get(f"/api/v1/floors/{fid}/bakes", headers=ron).json()["bakes"]}
    assert old_dark not in rows and rows[new_still]["stale"] is True
    assert c.get(f"/api/v1/floors/{fid}/bakes/{old_dark}/file", headers=ron).status_code == 404
    assert c.get(f"/api/v1/floors/{fid}/bakes/{new_still}/file", headers=ron).status_code == 200
    admin = {r["id"]: r for r in c.get(f"/api/v1/floors/{fid}/bakes").json()["bakes"]}
    assert admin[old_dark]["stale"] is True
    assert c.get(f"/api/v1/floors/{fid}/bakes/{old_dark}/file").status_code == 200
