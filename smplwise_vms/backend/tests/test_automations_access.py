"""CR-017 owner decision 2026-10-01 (1b, supersedes the view-only model): a caller who may NOT edit and save automations (`automation.manage`) cannot reach automations AT ALL -
no list, no detail, no runs, no trace, no versions, no review, no templates, no catalog, no trash, no preview, no notification. At most they activate scenes and run scripts they
are allowed to. There is no `automation.view` permission any more. Four callers: the installer (administrator), a scoped editor (manage at one floor), a runner (only `script.run`
and the control of devices), and a would-be viewer (a built-in viewer role: nothing of the area)."""
from __future__ import annotations

from automations_fixture import *  # noqa: F401,F403
from automations_fixture import autos_app  # noqa: F401
from automations_fixture import API, OMER, create_item, draft_of, get_item, item_by_name, place, rid
from automations_fixture import grant as _raw_grant
from conftest import bind, seed_tree
from smplwise.routers.access import SENSITIVE as _SENSITIVE

READ = ["devices.read", "entity.state.read"]
VERA = {"X-SW-Dev-User": "vera"}
RUNNER = {"X-SW-Dev-User": "ron"}


def grant(c, user, name, permissions, sensitive, scope_type, scope_id):
    both = list(dict.fromkeys(list(permissions) + list(sensitive)))
    return _raw_grant(c, user, name, [p for p in both if p not in _SENSITIVE], [p for p in both if p in _SENSITIVE], scope_type, scope_id)


def _world(app, c):
    ids = seed_tree(c)
    place(c, ids["floor2"], "light.office", "climate.living_room", "switch.hall_lights", "binary_sensor.motion_hall")
    grant(c, "omer", "עורך קומה 2 (בדיקת גישה)", ["automation.manage", "scene.manage", "script.manage", "devices.control"] + READ, ["automation.manage", "scene.manage", "script.manage"], "floor", ids["floor2"])
    grant(c, "ron", "מפעיל סקריפטים (בדיקת גישה)", ["script.run", "devices.control"] + READ, [], "installation", "*")  # a runner: scripts and the control of devices, nothing more
    bind(c, app.state.settings if hasattr(app.state, "settings") else None, "vera", "viewer", "installation", "*") if False else None
    return ids


def test_the_automation_view_permission_no_longer_exists(autos_app):
    app, s, c, fake, tr = autos_app
    r = c.post(f"{API}/access/roles", json={"name": "צופה באוטומציות", "permissions": ["automation.view", "devices.read"], "sensitive": []})
    assert r.status_code in (400, 422) and "automation.view" in r.text, "a role cannot name it: it grants nothing and is not in the catalogue"
    perms = {p["id"] if isinstance(p, dict) else p for p in c.get(f"{API}/access/permissions").json().get("permissions", [])} if c.get(f"{API}/access/permissions").status_code == 200 else set()
    assert "automation.view" not in perms


def test_a_runner_sees_scripts_and_scenes_and_nothing_of_automations(autos_app):
    app, s, c, fake, tr = autos_app
    _world(app, c)
    st = c.get(f"{API}/automations/status", headers=RUNNER).json()
    assert st["can"]["manage"] is False and st["can"]["script_run"] is True and st["can"]["view"] is True
    assert st["counts"]["automations"] == 0 and st["counts"]["scripts"] >= 1 and "admin" not in st
    items = c.get(f"{API}/automations", params={"limit": 500}, headers=RUNNER).json()["items"]
    assert items and {i["kind"] for i in items} <= {"script", "scene"}, "the scene and script lists never leak an automation"
    admin_one = item_by_name(c, "מזגן סלון בבוקר")
    for path in ("", "/runs", "/versions"):
        r = c.get(f"{API}/automations/automation/{admin_one['id']}{path}", headers=RUNNER)
        assert r.status_code == 403 and r.json()["code"] == "forbidden", path
    for method, path in (("get", "/automations?kind=automation"), ("get", "/automations/review"), ("get", "/automations/templates"), ("get", "/automations/catalog"), ("get", "/automations/trash")):
        r = getattr(c, method)(f"{API}{path}", headers=RUNNER)
        assert r.status_code == 403, path
    r = c.post(f"{API}/automations/preview", json={"kind": "automation", "draft": draft_of("x")}, headers=RUNNER)
    assert r.status_code == 403
    assert c.post(f"{API}/automations/automation/{admin_one['id']}/dry-run", headers=RUNNER).status_code == 403
    assert c.put(f"{API}/automations/automation/{admin_one['id']}/meta", json={"favourite": True}, headers=RUNNER).status_code == 403
    # what they may still do: run a script they are allowed to run
    sc = next(i for i in items if i["kind"] == "script" and i["name"] == "קירור עם פרמטרים")
    r = c.post(f"{API}/automations/script/{sc['id']}/run", json={"client_request_id": rid(), "fields": {"temp": 22}}, headers=RUNNER)
    assert r.status_code == 202


def test_a_scoped_editor_sees_the_automations_of_the_floor_and_the_installer_all(autos_app):
    app, s, c, fake, tr = autos_app
    _world(app, c)
    mine = c.get(f"{API}/automations", params={"kind": "automation", "limit": 500}, headers=OMER)
    assert mine.status_code == 200 and 0 < mine.json()["total"] < c.get(f"{API}/automations", params={"kind": "automation", "limit": 500}).json()["total"]
    assert c.get(f"{API}/automations/templates", headers=OMER).status_code == 200 and c.get(f"{API}/automations/catalog", headers=OMER).status_code == 200
    one = item_by_name(c, "מזגן סלון בבוקר", headers=OMER)
    assert get_item(c, "automation", one["id"], OMER).status_code == 200
    assert c.get(f"{API}/automations/automation/{one['id']}/runs", headers=OMER).status_code == 200
    assert c.get(f"{API}/automations/review", headers=OMER).status_code == 403, "the review list is installation-wide"
    assert c.get(f"{API}/automations/status").json()["counts"]["automations"] == 18


def test_a_caller_with_no_binding_at_all_is_closed_out_everywhere(autos_app):
    app, s, c, fake, tr = autos_app
    bind(c, s, "vera", "viewer", "installation", "*")
    st = c.get(f"{API}/automations/status", headers=VERA).json()
    assert st["can"]["view"] is False and st["counts"] == {"automations": 0, "scripts": 0, "scenes": 0, "running": 0, "attention": 0, "hidden": None}
    for path in ("/automations", "/automations?kind=automation", "/automations/trash", "/automations/templates", "/automations/review", "/automations/catalog"):
        assert c.get(f"{API}{path}", headers=VERA).status_code == 403, path
    it = item_by_name(c, "מזגן סלון בבוקר")
    assert c.get(f"{API}/automations/automation/{it['id']}", headers=VERA).status_code == 403


def test_the_notification_of_an_automation_reaches_only_its_managers(autos_app):
    """A failed run's news (`automation.failed`) with the audience widened to everyone who may see the automation: the scoped editor and the administrator - never the runner."""
    from smplwise.services import notify_visibility as nv

    app, s, c, fake, tr = autos_app
    _world(app, c)
    it = item_by_name(c, "מזגן סלון בבוקר")
    with app.state.db.connection(mode="read") as conn:
        note = {"subject_kind": "automation", "subject_id": it["id"], "origin": {}}
        assert nv.Reach(conn, nv.principal_of(conn, "dev-omer")).can_see(note) is True
        assert nv.Reach(conn, nv.principal_of(conn, "dev-joni")).can_see(note) is True
        assert nv.Reach(conn, nv.principal_of(conn, "dev-ron")).can_see(note) is False


def test_a_runner_has_no_editor_side_for_scripts_and_scenes_either(autos_app):
    """Security review 2026-10-02: preview (contract row 6: the kind's MANAGE permission) and the dry-run of an UNSAVED draft are editor actions, for scripts and
    scenes too. The runner keeps the dry-run of the stored script (row 17: the kind's permission)."""
    app, s, c, fake, tr = autos_app
    _world(app, c)
    items = c.get(f"{API}/automations", params={"limit": 500}, headers=RUNNER).json()["items"]
    sc = next(i for i in items if i["kind"] == "script")
    for kind in ("script", "scene"):
        r = c.post(f"{API}/automations/preview", json={"kind": kind, "draft": {}}, headers=RUNNER)
        assert r.status_code == 403 and r.json()["code"] == "forbidden", kind
    r = c.post(f"{API}/automations/preview", json={"kind": "script", "id": sc["id"], "draft": {}}, headers=RUNNER)
    assert r.status_code == 403, "the stored item behind `id` is not read for a runner"
    assert c.post(f"{API}/automations/script/{sc['id']}/dry-run", headers=RUNNER).status_code == 200, "the stored script's dry-run stays"
    r = c.post(f"{API}/automations/script/{sc['id']}/dry-run", json={"draft": {"alias": "x", "sequence": []}}, headers=RUNNER)
    assert r.status_code == 403 and r.json()["code"] == "forbidden"
    # the editor of the kind still has both
    detail = c.get(f"{API}/automations/script/{sc['id']}").json()
    assert c.post(f"{API}/automations/preview", json={"kind": "script", "id": sc["id"], "draft": detail["draft"]}).status_code == 200
    assert c.post(f"{API}/automations/script/{sc['id']}/dry-run", json={"draft": detail["draft"]}).status_code == 200