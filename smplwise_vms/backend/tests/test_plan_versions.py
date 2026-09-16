"""Plan version history (T038): diff preview before publish, restore of an archived version as a new published
version with anchors carried by geometry, optimistic revisions with clear conflicts, the floor map at an instant,
and archived images readable by viewers."""
from __future__ import annotations

from conftest import as_user, bind, png_bytes, seed_tree


def upload(client, floor_id, name, data, mime):
    return client.post(f"/api/v1/floors/{floor_id}/plan-assets", files={"file": (name, data, mime)})


def _versions(client, floor):
    return {v["id"]: v for v in client.get(f"/api/v1/floors/{floor}/plan-versions").json()["versions"]}


def test_diff_rollback_revisions_and_map_at(client, settings):
    ids = seed_tree(client)
    floor = ids["floor2"]
    cam = client.post("/api/v1/cameras", json={"channel": 1, "alias": "כניסה"}).json()
    asset = upload(client, floor, "plan.png", png_bytes(), "image/png").json()
    v1 = client.post(f"/api/v1/floors/{floor}/plan-versions", json={"asset_id": asset["id"]}).json()

    # a diff before the first publish has no base
    d0 = client.get(f"/api/v1/plan-versions/{v1['id']}/diff").json()
    assert d0["from"] is None and d0["to"]["id"] == v1["id"] and d0["geometry"]["same"] is False and d0["anchors"]["total"] == 0

    p1 = client.post(f"/api/v1/plan-versions/{v1['id']}/publish").json()
    assert p1["status"] == "published" and p1["revision"] == 2 and p1["archived_at"] is None
    a = client.post(f"/api/v1/floors/{floor}/anchors", json={"resource_type": "camera", "resource_id": cam["id"], "x": 0.25, "y": 0.4}).json()
    assert a["plan_version_id"] == v1["id"]

    # rotated version: the diff announces the geometry change and the item that will need alignment
    v2 = client.post(f"/api/v1/floors/{floor}/plan-versions", json={"asset_id": asset["id"], "rotation": 180, "notes": "מסובב"}).json()
    d = client.get(f"/api/v1/plan-versions/{v2['id']}/diff").json()
    assert d["from"]["id"] == v1["id"] and d["to"]["id"] == v2["id"] and d["geometry"]["same"] is False
    assert [c["field"] for c in d["geometry"]["changes"]] == ["rotation"] and d["geometry"]["changes"][0] == {"field": "rotation", "from": 0, "to": 180}
    assert d["anchors"]["total"] == 1 and d["anchors"]["carried"] == 0 and d["anchors"]["needs_alignment"] == 1
    assert d["anchors"]["items"][0]["name"] == "כניסה" and d["anchors"]["items"][0]["outcome"] == "needs_alignment"

    # a version with the same geometry carries everything; an explicit base works too
    v2b = client.post(f"/api/v1/floors/{floor}/plan-versions", json={"asset_id": asset["id"]}).json()
    d2 = client.get(f"/api/v1/plan-versions/{v2b['id']}/diff").json()
    assert d2["geometry"]["same"] is True and d2["geometry"]["changes"] == [] and d2["anchors"]["carried"] == 1
    assert client.get(f"/api/v1/plan-versions/{v2b['id']}/diff?against={v2['id']}").json()["geometry"]["changes"][0]["field"] == "rotation"
    assert client.delete(f"/api/v1/plan-versions/{v2b['id']}").status_code == 204

    client.post(f"/api/v1/plan-versions/{v2['id']}/publish")
    m = client.get(f"/api/v1/floors/{floor}/map").json()
    assert m["plan"]["id"] == v2["id"] and m["needs_alignment"] is True and m["at"] is None

    # history: statuses, archive dates, anchor counts, revisions bumped on every status change
    vs = _versions(client, floor)
    assert vs[v1["id"]]["status"] == "archived" and vs[v1["id"]]["archived_at"] and vs[v1["id"]]["revision"] == 3 and vs[v1["id"]]["anchors_on"] == 1
    assert vs[v2["id"]]["status"] == "published" and vs[v2["id"]]["anchors_on"] == 0 and vs[v2["id"]]["published_by"]

    # rollback guards: stale revision, stale published expectation, only archived versions
    r = client.post(f"/api/v1/plan-versions/{v1['id']}/rollback", json={"revision": 1})
    assert r.status_code == 409 and r.json()["code"] == "stale_revision" and r.json()["details"]["current_revision"] == 3
    r = client.post(f"/api/v1/plan-versions/{v1['id']}/rollback", json={"revision": 3, "expected_published_id": "0000000000000000"})
    assert r.status_code == 409 and r.json()["code"] == "stale_published" and r.json()["details"]["published_version_id"] == v2["id"]
    assert client.post(f"/api/v1/plan-versions/{v2['id']}/rollback", json={"revision": 1}).json()["code"] == "not_archived"

    # restore: a new published copy with v1's geometry; the anchor follows (same pixel space); v2 is archived
    restored = client.post(f"/api/v1/plan-versions/{v1['id']}/rollback", json={"revision": 3, "expected_published_id": v2["id"]})
    assert restored.status_code == 201, restored.text
    rv = restored.json()
    assert rv["status"] == "published" and rv["id"] not in (v1["id"], v2["id"]) and rv["rotation"] == 0 and rv["revision"] == 1 and "שחזור" in rv["notes"]
    m = client.get(f"/api/v1/floors/{floor}/map").json()
    assert m["plan"]["id"] == rv["id"] and m["needs_alignment"] is False and m["anchors"][0]["plan_version_id"] == rv["id"]
    vs = _versions(client, floor)
    assert vs[v2["id"]]["status"] == "archived" and vs[v1["id"]]["status"] == "archived" and vs[v1["id"]]["revision"] == 4 and vs[rv["id"]]["anchors_on"] == 1
    assert client.get(f"/api/v1/plan-versions/{rv['id']}/image.png").status_code == 200
    assert client.post(f"/api/v1/plan-versions/{v1['id']}/rollback", json={"revision": 3}).json()["code"] == "stale_revision", "a second restore of the same row needs the new revision"

    # the map at an instant: the version published then and the anchors effective then (timestamps set explicitly)
    with client.app.state.db.connection() as conn:
        conn.execute("UPDATE plan_versions SET published_at = '2026-09-01T10:00:00Z', archived_at = '2026-09-02T10:00:00Z' WHERE id = ?", (v1["id"],))
        conn.execute("UPDATE plan_versions SET published_at = '2026-09-02T10:00:00Z', archived_at = '2026-09-03T10:00:00Z' WHERE id = ?", (v2["id"],))
        conn.execute("UPDATE plan_versions SET published_at = '2026-09-03T10:00:00Z' WHERE id = ?", (rv["id"],))
        conn.execute("UPDATE map_anchors SET effective_from = '2026-09-01T12:00:00Z' WHERE id = ?", (a["id"],))
    before = client.get(f"/api/v1/floors/{floor}/map?at=2026-09-01T09:00:00Z").json()
    assert before["plan"]["id"] == rv["id"] and len(before["anchors"]) == 1 and before["at"] == "2026-09-01T09:00:00Z", "before the history begins the current map is shown"
    assert before["history"] == "current" and before["history_from"] == "2026-09-01T10:00:00Z"
    eleven = client.get(f"/api/v1/floors/{floor}/map?at=2026-09-01T11:00:00Z").json()
    assert eleven["anchors"] == [] and eleven["history"] == "exact" and eleven["plan"]["id"] == v1["id"], "placed at noon"
    day1 = client.get(f"/api/v1/floors/{floor}/map?at=2026-09-01T13:00:00Z").json()
    assert day1["plan"]["id"] == v1["id"] and len(day1["anchors"]) == 1 and day1["needs_alignment"] is False, "same geometry as the version the anchor sits on"
    day2 = client.get(f"/api/v1/floors/{floor}/map?at=2026-09-02T13:00:00Z").json()
    assert day2["plan"]["id"] == v2["id"] and day2["needs_alignment"] is True
    day3 = client.get(f"/api/v1/floors/{floor}/map?at=2026-09-03T13:00:00Z").json()
    assert day3["plan"]["id"] == rv["id"] and day3["needs_alignment"] is False
    assert client.get(f"/api/v1/floors/{floor}/map?at=yesterday").status_code == 422

    # a deleted anchor is still part of the past
    assert client.delete(f"/api/v1/map-anchors/{a['id']}").status_code == 204
    assert len(client.get(f"/api/v1/floors/{floor}/map?at=2026-09-03T13:00:00Z").json()["anchors"]) == 1
    assert client.get(f"/api/v1/floors/{floor}/map").json()["anchors"] == []


def test_viewer_reads_archived_images_but_cannot_restore(client, settings):
    ids = seed_tree(client)
    floor = ids["floor2"]
    asset = upload(client, floor, "plan.png", png_bytes(), "image/png").json()
    v1 = client.post(f"/api/v1/floors/{floor}/plan-versions", json={"asset_id": asset["id"]}).json()
    client.post(f"/api/v1/plan-versions/{v1['id']}/publish")
    v2 = client.post(f"/api/v1/floors/{floor}/plan-versions", json={"asset_id": asset["id"], "rotation": 90}).json()
    client.post(f"/api/v1/plan-versions/{v2['id']}/publish")
    bind(client, settings, "ron", "viewer", "floor", floor)
    h = as_user("ron")
    assert client.get(v1["image_url"], headers=h).status_code == 200, "archived plans stay readable for the historical map"
    old = client.get(f"/api/v1/floors/{floor}/map?at=2000-01-01T00:00:00Z", headers=h).json()
    assert old["plan"]["id"] == v2["id"] and old["history"] == "current" and old["history_from"]
    assert client.get(f"/api/v1/plan-versions/{v1['id']}/diff", headers=h).status_code == 403
    assert client.post(f"/api/v1/plan-versions/{v1['id']}/rollback", json={"revision": 3}, headers=h).status_code == 403
    assert client.get(f"/api/v1/floors/{floor}/plan-versions", headers=h).status_code == 403
