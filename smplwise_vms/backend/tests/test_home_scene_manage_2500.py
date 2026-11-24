"""HOME-FAVORITES-2500 (owner 22.11, Q75 = the recommendation "מי שמחזיק הרשאת ניהול סצנות, למשל מנהל הבית"): who edits scenes.

The home interface used to show a scene's edit controls only to a person holding `scene.manage` at INSTALLATION scope (the installation
administrator); a home manager whose role is bound to their own floor never saw them. The server rule did not change and is pinned here:
every scene write (create, update, delete, capture) needs `scene.manage` (anywhere for the gate, then the scope of every member), and a
person who only runs scenes gets 403 on each write and `can.edit = false` on the list. Q79's personal switch `scene_suggest` is a layout
key of the person's home preferences."""
from __future__ import annotations

from automations_fixture import *  # noqa: F401,F403
from automations_fixture import autos_app  # noqa: F401
from automations_fixture import API, OMER, create_item, directory, place, put_item, rid
from automations_fixture import grant as _raw_grant
from smplwise.routers.access import SENSITIVE as _SENSITIVE
from test_home_interface import _client, app  # noqa: F401

VERA = {"X-SW-Dev-User": "vera"}
READ = ["devices.read", "entity.state.read"]


def grant(c, user, name, permissions, scope_type, scope_id):
    """A custom role bound at a scope; its sensitive permissions are named apart (the documented recipe)."""
    return _raw_grant(c, user, name, [p for p in permissions if p not in _SENSITIVE], [p for p in permissions if p in _SENSITIVE], scope_type, scope_id)


def _world(c, tr):
    ids = seed_tree(c)
    place(c, ids["floor2"], "light.office", "climate.living_room")
    # the home manager: runs and edits the scenes of their floor (scene.manage + the control the members need)
    grant(c, "omer", "מנהל הבית", ["script.run", "devices.control", "scene.manage"] + READ, "floor", ids["floor2"])
    # a family member: runs the scenes of the same floor, never edits them
    grant(c, "vera", "בן משפחה", ["script.run", "devices.control"] + READ, "floor", ids["floor2"])
    # a non-HA-administrator saves only with HA's delegation switch on (CR-017 §9); on here, so the only difference left is scene.manage
    tr.delegated = True
    directory(c, tr.secret, delegated=True, changed_at="2026-11-22T09:00:00Z")
    return ids


def _scene(name="ערב בבית"):
    return {"name": name, "icon": None, "members": [{"entity_id": "light.office", "state": "on", "attributes": {"brightness": 120}}]}


def _listed(c, headers, name):
    r = c.get(f"{API}/automations", params={"kind": "scene", "limit": 500}, headers=headers)
    assert r.status_code == 200, r.text
    return next(i for i in r.json()["items"] if i["name"] == name)


def test_a_floor_scoped_scene_manager_creates_edits_and_deletes_a_scene_of_their_floor(autos_app):
    app_, s, c, fake, tr = autos_app
    _world(c, tr)
    r = create_item(c, "scene", _scene(), OMER)
    assert r.status_code == 201, r.text
    item = _listed(c, OMER, "ערב בבית")
    assert item["can"]["edit"] is True and item["can"]["run"] is True
    d = c.get(f"{API}/automations/scene/{item['id']}", headers=OMER).json()
    assert d["draft"]["members"][0]["entity_id"] == "light.office"
    r = put_item(c, "scene", item["id"], {**d["draft"], "name": "ערב רגוע"}, d["revision"], OMER)
    assert r.status_code == 200, r.text
    assert any(i["name"] == "ערב רגוע" for i in c.get(f"{API}/automations", params={"kind": "scene", "limit": 500}, headers=OMER).json()["items"])
    cap = c.post(f"{API}/automations/scene/capture", json={"entity_ids": ["light.office"]}, headers=OMER)
    assert cap.status_code == 200 and cap.json()["members"][0]["entity_id"] == "light.office"
    d = c.get(f"{API}/automations/scene/{item['id']}", headers=OMER).json()
    body = {"base_revision": d["revision"], "client_request_id": rid()}
    r = c.post(f"{API}/automations/scene/{item['id']}/delete", json=body, headers=OMER)
    assert r.status_code == 409 and r.json()["code"] == "confirmation_required", "a delete is always confirmed (the home sheet asks first)"
    r = c.post(f"{API}/automations/scene/{item['id']}/delete", json={**body, "client_request_id": rid(), "confirm": True}, headers=OMER)
    assert r.status_code == 200, r.text
    assert "trash_id" in r.json()


def test_a_member_who_only_runs_scenes_is_refused_every_scene_write(autos_app):
    app_, s, c, fake, tr = autos_app
    _world(c, tr)
    assert create_item(c, "scene", _scene(), OMER).status_code == 201
    item = _listed(c, VERA, "ערב בבית")
    assert item["can"]["run"] is True and item["can"]["edit"] is False and item["can"]["delete"] is False
    d = c.get(f"{API}/automations/scene/{item['id']}", headers=OMER).json()
    r = create_item(c, "scene", _scene("של ורה"), VERA)
    assert r.status_code == 403, r.text
    r = put_item(c, "scene", item["id"], {**d["draft"], "name": "שונה"}, d["revision"], VERA)
    assert r.status_code == 403, r.text
    r = c.post(f"{API}/automations/scene/{item['id']}/delete", json={"base_revision": d["revision"], "client_request_id": rid(), "confirm": True}, headers=VERA)
    assert r.status_code == 403, r.text
    assert c.post(f"{API}/automations/scene/capture", json={"entity_ids": ["light.office"]}, headers=VERA).status_code == 403
    # running stays theirs
    r = c.post(f"{API}/automations/scene/{item['id']}/apply", json={"client_request_id": rid()}, headers=VERA)
    assert r.status_code in (200, 202), r.text
    # and nothing of the scene changed
    assert _listed(c, OMER, "ערב בבית")["name"] == "ערב בבית"


def test_the_scene_manager_cannot_edit_a_scene_outside_their_floor(autos_app):
    app_, s, c, fake, tr = autos_app
    _world(c, tr)
    r = create_item(c, "scene", {"name": "חדר שינה", "icon": None, "members": [{"entity_id": "climate.bedroom_1", "state": "off", "attributes": {}}]}, OMER)
    assert r.status_code == 403, r.text


def test_the_home_feature_map_offers_new_scenes_only_to_a_scene_manager(autos_app):
    """GET /home/family: `scenes.capture` drives the home screen's "סצנה חדשה" - a floor-scoped scene.manage counts (anywhere)."""
    app_, s, c, fake, tr = autos_app
    _world(c, tr)
    assert c.get(f"{API}/home/family", headers=OMER).json()["features"]["scenes"]["capture"] is True
    assert c.get(f"{API}/home/family", headers=VERA).json()["features"]["scenes"]["capture"] is False


def test_the_scene_suggestion_switch_is_a_personal_layout_key(app):  # noqa: F811
    """Q79: "הצעה אחרי סצנה" is on unless the person turned it off; a boolean in their layout."""
    c = _client(app)
    r = c.put("/api/v1/home/prefs", json={"layout": {"scene_suggest": False}})
    assert r.status_code == 200, r.text
    assert r.json()["layout"]["scene_suggest"] is False
    assert c.get("/api/v1/home/prefs").json()["layout"]["scene_suggest"] is False
    assert c.put("/api/v1/home/prefs", json={"layout": {"scene_suggest": True}}).json()["layout"]["scene_suggest"] is True
