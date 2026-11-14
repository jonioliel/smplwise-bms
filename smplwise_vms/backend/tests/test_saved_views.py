"""Saved views (live review F3): personal views for anyone who may watch the cameras, shared views only for
administrators (rbac.assign at the installation or at a site), cameras outside the reader's scope are left out
and counted, edits stay with the owner (or a system administrator), and the table travels with a project backup."""
from __future__ import annotations

from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import backup


def _cams(c: TestClient, n: int = 3) -> list[str]:
    return [c.post("/api/v1/cameras", json={"channel": i + 1, "alias": f"מצלמה {i + 1}"}).json()["id"] for i in range(n)]


def test_personal_and_shared_views(settings):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    cams = _cams(c)
    # a viewer bound to floor 2 may watch only what is anchored there: publish a plan and anchor camera 1 on it
    f2 = ids["floor2"]
    asset = c.post(f"/api/v1/floors/{f2}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{f2}/plan-versions", json={"asset_id": asset["id"]}).json()
    assert c.post(f"/api/v1/plan-versions/{v['id']}/publish").status_code == 200
    assert c.post(f"/api/v1/floors/{f2}/anchors", json={"resource_type": "camera", "resource_id": cams[0], "x": 0.2, "y": 0.2}).status_code == 201
    bind(c, settings, "ron", "viewer", "floor", f2)
    bind(c, settings, "site", "site_admin", "site", ids["site"])

    # the viewer saves a personal view with the camera he may watch
    r = c.post("/api/v1/views", json={"name": "הכניסה שלי", "cameras": [cams[0]], "cols": 1, "rows": 1}, headers=as_user("ron"))
    assert r.status_code == 201, r.text
    mine = r.json()
    assert mine["shared"] is False and mine["camera_names"] == ["מצלמה 1"] and mine["owner_username"] == "ron"
    # not a camera outside his scope, not a shared view, not an unknown camera
    assert c.post("/api/v1/views", json={"name": "x", "cameras": [cams[1]]}, headers=as_user("ron")).status_code == 403
    assert c.post("/api/v1/views", json={"name": "x", "cameras": [cams[0]], "shared": True}, headers=as_user("ron")).status_code == 403
    assert c.post("/api/v1/views", json={"name": "x", "cameras": ["nope"]}, headers=as_user("ron")).status_code == 422

    # the system admin shares a view with all three cameras (kiosk flag kept); the site admin shares one of its site
    r = c.post("/api/v1/views", json={"name": "כל הכניסות", "cameras": cams, "cols": 3, "rows": 1, "shared": True, "kiosk": True})
    assert r.status_code == 201, r.text
    shared = r.json()
    assert shared["shared"] and shared["kiosk"] and shared["cols"] == 3
    r = c.post("/api/v1/views", json={"name": "כניסה — אתר", "cameras": [cams[0]], "shared": True}, headers=as_user("site"))
    assert r.status_code == 201, r.text
    site_view = r.json()
    assert c.post("/api/v1/views", json={"name": "x", "cameras": [cams[1]], "shared": True}, headers=as_user("site")).status_code == 403, "a site admin may not put a camera outside the site in a view"

    # the viewer lists his own view and the shared ones, with the two cameras he may not watch left out
    lst = c.get("/api/v1/views", headers=as_user("ron")).json()
    assert lst["can_share"] is False and lst["can_manage_all"] is False
    assert {v["id"] for v in lst["views"]} == {mine["id"], shared["id"], site_view["id"]}
    assert all(v["shared"] for v in lst["views"][:2]) and lst["views"][-1]["id"] == mine["id"], "shared views first"
    sv = next(v for v in lst["views"] if v["id"] == shared["id"])
    assert sv["cameras"] == [cams[0]] and sv["hidden_cameras"] == 2
    # the site admin may share; the system admin sees every camera of the shared view but no personal view of others
    assert c.get("/api/v1/views", headers=as_user("site")).json()["can_share"] is True
    adm = c.get("/api/v1/views").json()
    assert adm["can_share"] and adm["can_manage_all"]
    assert {v["id"] for v in adm["views"]} == {shared["id"], site_view["id"]}
    assert next(v for v in adm["views"] if v["id"] == shared["id"])["hidden_cameras"] == 0

    # edits: the viewer cannot touch a shared view; the owner can; a site admin cannot edit the system admin's view;
    # the system admin can edit anyone's
    body = {"name": "כניסה — אתר 2", "cameras": [cams[0]], "cols": 2, "rows": 1, "shared": True, "kiosk": False}
    assert c.put(f"/api/v1/views/{site_view['id']}", json=body, headers=as_user("ron")).status_code == 403
    assert c.put(f"/api/v1/views/{shared['id']}", json=body, headers=as_user("site")).status_code == 403
    assert c.put(f"/api/v1/views/{site_view['id']}", json=body, headers=as_user("site")).status_code == 200
    assert c.put(f"/api/v1/views/{site_view['id']}", json={**body, "name": "כניסה — אתר 3"}).status_code == 200
    assert next(v for v in c.get("/api/v1/views").json()["views"] if v["id"] == site_view["id"])["name"] == "כניסה — אתר 3"
    # delete: the viewer cannot delete a shared view but deletes his own
    assert c.delete(f"/api/v1/views/{shared['id']}", headers=as_user("ron")).status_code == 403
    assert c.delete(f"/api/v1/views/{mine['id']}", headers=as_user("ron")).status_code == 200
    assert {v["id"] for v in c.get("/api/v1/views", headers=as_user("ron")).json()["views"]} == {shared["id"], site_view["id"]}
    assert c.delete(f"/api/v1/views/{mine['id']}", headers=as_user("ron")).status_code == 404, "soft-deleted rows are gone for the API"
    # audited, and part of a project backup
    with app.state.db.connection() as conn:
        actions = [r["action"] for r in conn.execute("SELECT action FROM audit_log WHERE action LIKE 'views.%' ORDER BY rowid").fetchall()]
    assert actions == ["views.create", "views.create", "views.create", "views.update", "views.update", "views.delete"]
    assert "saved_views" in backup.PROJECT_TABLES
