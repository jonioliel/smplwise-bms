"""STILLCAM-SKIN (the follow-up of STILLCAM, a leftover of the Studio 6 security review): the control image of an AI floor
skin is drawn once, in one editor's browser, from the published structure, and is the picture a provider is asked to make
photoreal - the skin made from it is meant for every reader of the floor. An object bound to a camera anchor stands at that
camera's position (plan_geometry.apply_anchor_positions copies the anchor's pose onto the body), so a control image drawn
before the fix shows the place of a camera that a reader's camera scope hides (plan_anchor_scope.redact, review 2.4.2 M2).

Fixed on both sides:
- the client draws the control scene without camera-bound bodies (map/skin-control.ts controlSceneInput ->
  withoutCameraBodies) and sends its recipe `control-2` with the upload (tests/unit-skin-control-camera-bodies.spec.ts);
- the server refuses an upload without a recipe that omits those bodies (a cached older client), never reports a control
  of an older recipe as current (so it is captured again and can never become a skin's source), and withholds it from the
  floor's skins listing for every editor whose camera scope can withhold something (fail closed, as the stills rule does
  for a stale older still).

Negative first: every test below except the last failed before the server change. Fakes and the in-process test client
only (synthetic PNG bytes; no device, no GPU, no provider).
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from conftest import as_user, bind  # noqa: E402
from test_plan_skins import control_png  # noqa: E402
from test_security_review_220 import _deny_camera  # noqa: E402
from test_security_review_247_poc import _floor_with_hidden_camera  # noqa: E402

NEW = "control-2"


def _up(c, fid: str, key: str, recipe: str | None, state: str = "all_off", headers=None, data: bytes | None = None):
    form = {"state": state, "geometry_key": key}
    if recipe is not None:
        form["recipe"] = recipe
    return c.post(f"/api/v1/floors/{fid}/skins/control-image", data=form, files={"file": ("c.png", data or control_png(), "image/png")}, headers=headers)


def _legacy_control(c, settings, fid: str, key: str, state: str = "all_off") -> str:
    """A control image as the code before the fix stored it: `control-<state>-<key16>.png`, no recipe anywhere."""
    from smplwise.db import Database, new_id, now_iso

    data = control_png(color=(90, 80, 70))
    folder = settings.data_dir / "skins" / fid
    folder.mkdir(parents=True, exist_ok=True)
    (folder / f"control-{state}-{key[:16]}.png").write_bytes(data)
    cid = new_id()
    with Database(settings.db_path).connection() as conn:
        conn.execute(
            "INSERT INTO plan_skin_controls(id, floor_id, state_key, geometry_key, sha256, bytes, width, height, path, created_by, created_at) "
            "VALUES (?, ?, ?, ?, 'legacy', ?, 1536, 1024, ?, NULL, ?)",
            (cid, fid, state, key, len(data), f"skins/{fid}/control-{state}-{key[:16]}.png", now_iso()),
        )
    return cid


def _scoped_editor(c, settings, fid: str, vault: str) -> dict:
    bind(c, settings, "eddie", "editor", "floor", fid)
    _deny_camera(settings, "eddie", vault)
    return as_user("eddie")


def test_an_upload_from_a_client_that_draws_camera_bound_bodies_is_refused(settings):
    """No recipe (the client before the fix, e.g. a cached bundle) or an older one: 409, nothing stored. control-2 and later: stored."""
    c, ids, vid, fid, lobby, vault, anchors = _floor_with_hidden_camera(settings)
    key = c.get(f"/api/v1/floors/{fid}/skins").json()["geometry_key"]
    for recipe in (None, "control-1", "control-x", ""):
        r = _up(c, fid, key, recipe)
        assert r.status_code == 409 and r.json()["code"] == "control_recipe_outdated", (recipe, r.text)
    assert c.get(f"/api/v1/floors/{fid}/skins").json()["controls"] == []
    r = _up(c, fid, key, NEW)
    assert r.status_code == 201, r.text
    assert r.json()["recipe"] == NEW
    assert (settings.data_dir / "skins" / fid / f"control-2-all_off-{key[:16]}.png").exists()
    assert _up(c, fid, key, "control-3", state="all_on").status_code == 201  # a later recipe counts as fixed too


def test_a_control_stored_before_the_fix_is_never_current(settings):
    """The administrator still sees the older control listed, but never as current (it is captured again); re-capturing the
    same bytes under the new recipe is not reported as identical to it."""
    c, ids, vid, fid, lobby, vault, anchors = _floor_with_hidden_camera(settings)
    key = c.get(f"/api/v1/floors/{fid}/skins").json()["geometry_key"]
    cid = _legacy_control(c, settings, fid, key)
    rows = {x["id"]: x for x in c.get(f"/api/v1/floors/{fid}/skins").json()["controls"]}
    assert rows[cid]["current"] is False and rows[cid]["recipe"] is None
    first = _up(c, fid, key, NEW, data=control_png(color=(90, 80, 70)))
    assert first.status_code == 201 and first.json()["identical"] is False
    assert not (settings.data_dir / "skins" / fid / f"control-all_off-{key[:16]}.png").exists()  # the older file goes
    rows = c.get(f"/api/v1/floors/{fid}/skins").json()["controls"]
    assert [(x["recipe"], x["current"]) for x in rows] == [(NEW, True)]


def test_a_control_stored_before_the_fix_is_withheld_from_a_camera_scoped_editor(settings):
    """`eddie` (floor editor, vault camera denied) - the published structure binds a body to the vault camera. The control
    stored before the fix (drawn with that body at the vault camera's place) is not in his listing; the administrator keeps
    seeing it listed."""
    c, ids, vid, fid, lobby, vault, anchors = _floor_with_hidden_camera(settings)
    key = c.get(f"/api/v1/floors/{fid}/skins").json()["geometry_key"]
    cid = _legacy_control(c, settings, fid, key)
    eddie = _scoped_editor(c, settings, fid, vault)
    mine = c.get(f"/api/v1/floors/{fid}/skins", headers=eddie)
    assert mine.status_code == 200, mine.text
    assert cid not in {x["id"] for x in mine.json()["controls"]}
    assert cid in {x["id"] for x in c.get(f"/api/v1/floors/{fid}/skins").json()["controls"]}


def test_a_control_of_the_fixed_recipe_is_current_for_the_scoped_editor_too(settings):
    """Drawn without camera-bound bodies: eddie captures with the key he was handed and sees it current (positive case)."""
    c, ids, vid, fid, lobby, vault, anchors = _floor_with_hidden_camera(settings)
    eddie = _scoped_editor(c, settings, fid, vault)
    served = c.get(f"/api/v1/floors/{fid}/skins", headers=eddie).json()["geometry_key"]
    r = _up(c, fid, served, NEW, headers=eddie)
    assert r.status_code == 201, r.text
    rows = c.get(f"/api/v1/floors/{fid}/skins", headers=eddie).json()["controls"]
    assert [(x["recipe"], x["current"], x["geometry_key"]) for x in rows] == [(NEW, True, served)]
    admin = c.get(f"/api/v1/floors/{fid}/skins").json()["controls"]
    assert [(x["recipe"], x["current"]) for x in admin] == [(NEW, True)]
