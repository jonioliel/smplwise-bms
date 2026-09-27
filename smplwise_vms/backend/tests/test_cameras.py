from __future__ import annotations

from conftest import as_user, bind, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app


def test_manual_registration_and_visibility(client, settings):
    ids = seed_tree(client)
    c1 = client.post("/api/v1/cameras", json={"channel": 1, "alias": "כניסה"}).json()
    client.post("/api/v1/cameras", json={"channel": 2, "alias": "לובי"})
    assert client.post("/api/v1/cameras", json={"channel": 1, "alias": "כניסה ראשית"}).json()["id"] == c1["id"], "same channel keeps its id"
    all_cams = client.get("/api/v1/cameras").json()
    assert [c["channel"] for c in all_cams["cameras"]] == [1, 2] and all_cams["can_sync"] is True

    # viewer of floor 2 sees only cameras anchored on floor 2
    bind(client, settings, "ron", "viewer", "floor", ids["floor2"])
    assert client.get("/api/v1/cameras", headers=as_user("ron")).json()["cameras"] == []


def test_sync_without_nvr_configuration(client):
    r = client.post("/api/v1/cameras/sync")
    assert r.status_code == 503 and r.json()["code"] == "source_not_configured"


def test_grid_col_span_patch_and_validation(client):
    """T091: a camera's grid column span defaults to 1, is PATCHable up to 4, and rejects out-of-range values."""
    cam = client.post("/api/v1/cameras", json={"channel": 1, "alias": "פנורמי אולם ספורט"}).json()
    assert cam["grid_col_span"] == 1

    updated = client.patch(f"/api/v1/cameras/{cam['id']}", json={"grid_col_span": 2}).json()
    assert updated["grid_col_span"] == 2
    again = client.get("/api/v1/cameras").json()["cameras"]
    assert next(c for c in again if c["id"] == cam["id"])["grid_col_span"] == 2

    assert client.patch(f"/api/v1/cameras/{cam['id']}", json={"grid_col_span": 0}).status_code == 422
    assert client.patch(f"/api/v1/cameras/{cam['id']}", json={"grid_col_span": 5}).status_code == 422
    # rejection does not clobber the last valid value
    assert client.get("/api/v1/cameras").json()["cameras"][0]["grid_col_span"] == 2


def test_grid_col_span_requires_permission(client, settings):
    """T091: PATCHing grid_col_span needs sources.configure like every other camera field; a plain viewer is
    refused and the camera's value is left untouched."""
    cam = client.post("/api/v1/cameras", json={"channel": 1, "alias": "מצלמה"}).json()
    bind(client, settings, "ron", "viewer", "installation", "*")
    r = client.patch(f"/api/v1/cameras/{cam['id']}", json={"grid_col_span": 2}, headers=as_user("ron"))
    assert r.status_code == 403
    assert client.get("/api/v1/cameras").json()["cameras"][0]["grid_col_span"] == 1


def test_sort_order_patch_drives_listing_order(client):
    """T091: PATCHing sort_order end to end reorders GET /cameras (cameras.py: ORDER BY sort_order, channel)."""
    a = client.post("/api/v1/cameras", json={"channel": 1, "alias": "א"}).json()
    b = client.post("/api/v1/cameras", json={"channel": 2, "alias": "ב"}).json()
    c = client.post("/api/v1/cameras", json={"channel": 3, "alias": "ג"}).json()
    assert [x["id"] for x in client.get("/api/v1/cameras").json()["cameras"]] == [a["id"], b["id"], c["id"]]
    client.patch(f"/api/v1/cameras/{c['id']}", json={"sort_order": 0})
    client.patch(f"/api/v1/cameras/{a['id']}", json={"sort_order": 1})
    client.patch(f"/api/v1/cameras/{b['id']}", json={"sort_order": 2})
    assert [x["id"] for x in client.get("/api/v1/cameras").json()["cameras"]] == [c["id"], a["id"], b["id"]]


def test_a_populated_database_from_before_0023_upgrades(settings, tmp_path, monkeypatch):
    """A database created at migration 0022 with a registered camera: 0023 applies on top and the pre-existing
    row reads back with grid_col_span defaulting to 1 (the column's own DEFAULT, a plain ADD COLUMN with no
    index or trigger interactions), and a patch can then set it. The old-schema row is inserted with raw SQL
    (not through the API) so this exercises the OLD schema, not the current camera_row()'s expectations."""
    import shutil

    from smplwise import db as dbmod

    old_dir = tmp_path / "migrations_0022"
    old_dir.mkdir()
    for f in sorted(dbmod.MIGRATIONS_DIR.glob("*.sql")):
        if int(f.name.split("_", 1)[0]) <= 22:
            shutil.copy(f, old_dir / f.name)
    real_dir = dbmod.MIGRATIONS_DIR
    monkeypatch.setattr(dbmod, "MIGRATIONS_DIR", old_dir)
    with TestClient(create_app(settings)):
        pass  # applies migrations 1..22 and creates the schema
    with dbmod.Database(settings.db_path).connection() as conn:
        assert conn.execute("SELECT MAX(version) FROM schema_migrations").fetchone()[0] == 22
        now = dbmod.now_iso()
        conn.execute("INSERT INTO recorders(id, name, last_seen_at, created_at) VALUES ('nvr-1', 'NVR', ?, ?)", (now, now))
        conn.execute("INSERT INTO cameras(id, recorder_id, channel, name_source, created_at, updated_at) VALUES ('old-cam', 'nvr-1', 11, 'ישנה', ?, ?)", (now, now))
    monkeypatch.setattr(dbmod, "MIGRATIONS_DIR", real_dir)
    with TestClient(create_app(settings)) as c:
        got = next(x for x in c.get("/api/v1/cameras").json()["cameras"] if x["id"] == "old-cam")
        assert got["grid_col_span"] == 1
        r = c.patch("/api/v1/cameras/old-cam", json={"grid_col_span": 3})
        assert r.status_code == 200 and r.json()["grid_col_span"] == 3
