from __future__ import annotations

from conftest import seed_tree


def test_tree_crud_and_delete_guards(client):
    ids = seed_tree(client)
    tree = client.get("/api/v1/sites").json()
    assert tree["can_create_site"] is True
    site = tree["sites"][0]
    assert site["name"] == "אתר בדיקה" and len(site["buildings"]) == 1
    floors = site["buildings"][0]["floors"]
    assert [f["name"] for f in floors] == ["קומה 3", "קומה 2"], "floors are ordered by level descending"
    assert floors[0]["has_plan"] is False and floors[0]["anchor_count"] == 0

    # rename floor and building
    assert client.patch(f"/api/v1/floors/{ids['floor2']}", json={"name": "קומה שנייה", "level": 2}).json()["name"] == "קומה שנייה"
    assert client.patch(f"/api/v1/buildings/{ids['building']}", json={"name": "מבנה ראשי"}).json()["name"] == "מבנה ראשי"

    # cannot delete a site/building with children
    assert client.delete(f"/api/v1/sites/{ids['site']}").json()["code"] == "has_children"
    assert client.delete(f"/api/v1/buildings/{ids['building']}").json()["code"] == "has_children"

    # delete floors, then building, then site
    assert client.delete(f"/api/v1/floors/{ids['floor3']}").status_code == 204
    assert client.delete(f"/api/v1/floors/{ids['floor2']}").status_code == 204
    assert client.delete(f"/api/v1/buildings/{ids['building']}").status_code == 204
    assert client.delete(f"/api/v1/sites/{ids['site']}").status_code == 204
    assert client.get("/api/v1/sites").json()["sites"] == []


def test_validation_and_not_found(client):
    assert client.post("/api/v1/sites", json={"name": ""}).status_code == 422
    r = client.get("/api/v1/floors/nope")
    assert r.status_code == 404 and r.json()["code"] == "not_found" and r.json()["correlation_id"]


def test_audit_rows_written(client, settings):
    from smplwise.db import Database

    seed_tree(client)
    with Database(settings.db_path).connection() as conn:
        actions = [r[0] for r in conn.execute("SELECT action FROM audit_log ORDER BY id").fetchall()]
    assert actions[0] == "rbac.bootstrap_admin"
    assert "site.create" in actions and "floor.create" in actions
