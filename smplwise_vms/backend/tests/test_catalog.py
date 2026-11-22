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


def test_site_edit_trims_like_create_and_refuses_an_unknown_time_zone(client, settings):
    """CR-BE-FOLLOWUPS-2470: PATCH /sites/{id} stored the name untrimmed (create trims) and took any time-zone string."""
    from smplwise.db import Database

    ids = seed_tree(client)
    url = f"/api/v1/sites/{ids['site']}"
    r = client.patch(url, json={"name": "  אתר חדש  ", "address": "  רחוב 2 ", "timezone": "Europe/London"})
    assert r.status_code == 200, r.text
    assert r.json()["name"] == "אתר חדש" and r.json()["address"] == "רחוב 2" and r.json()["timezone"] == "Europe/London"

    for bad in ("Mars/Olympus", "../etc/passwd", ""):
        r = client.patch(url, json={"timezone": bad})
        assert r.status_code == 422, (bad, r.text)
        body = r.json()
        assert body["code"] == "validation" and body["user_message"] and body["correlation_id"] and "timezone" in body["details"]
    r = client.patch(url, json={"name": "   "})
    assert r.status_code == 422 and r.json()["code"] == "validation" and "name" in r.json()["details"]

    site = next(s for s in client.get("/api/v1/sites").json()["sites"] if s["id"] == ids["site"])
    assert site["name"] == "אתר חדש" and site["timezone"] == "Europe/London", "a refused edit changes nothing"
    with Database(settings.db_path).connection() as conn:
        updates = [r[0] for r in conn.execute("SELECT details_json FROM audit_log WHERE action = 'site.update'").fetchall()]
    assert len(updates) == 1, "only the accepted edit is audited"
