"""CR-ROUTE-CHAR-2460: real API tests for the modelled routes whose response model was written from the code only
(docs/changes/CR-RESPONSE-MODELS-B-2450.md "Not done / open"), each with its happy path, its main refusal and its audit row.

Every happy path goes through the wire oracle (tests/support/wire_oracle.py, SW_WIRE_STRICT=1 from conftest): the modelled answer must
equal the route's own pre-model serialisation key for key and type for type. `Oracle.compared` proves the answer of THIS test was compared
(the count of the route grew), not an earlier test's."""
from __future__ import annotations

import json
from dataclasses import replace
from io import BytesIO

import pytest
from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from support import wire_oracle

API = "/api/v1"


class Oracle:
    """The oracle counts before a test step; `compared(...)` asserts each route key was compared again since."""

    def __init__(self) -> None:
        self.before = dict(wire_oracle.CHECKED)

    def compared(self, *keys: str) -> None:
        missing = [k for k in keys if wire_oracle.CHECKED.get(k, 0) <= self.before.get(k, 0)]
        assert not missing, f"never compared by the oracle in this test: {missing}"


def audit_rows(app, action: str, decision: str | None = None) -> list[dict]:
    q = "SELECT * FROM audit_log WHERE action = ?" + (" AND decision = ?" if decision else "") + " ORDER BY rowid"
    with app.state.db.connection() as conn:
        return [dict(r) for r in conn.execute(q, (action, decision) if decision else (action,)).fetchall()]


def _png(w: int = 400, h: int = 300) -> bytes:
    from PIL import Image

    buf = BytesIO()
    Image.new("RGB", (w, h), (30, 90, 200)).save(buf, format="PNG")
    return buf.getvalue()


# ---------------------------------------------------------------- cases: preserve a clip (T049 / T048)

def test_preserve_a_clip_creates_the_export_job_and_answers_the_item(settings, monkeypatch):
    from test_exports import fake_pages
    from test_recordings import set_track

    from smplwise.services import exports as ex
    from smplwise.services import nvr, recordings

    s = replace(settings, nvr_host="nvr.local", nvr_user="u", nvr_password="p")
    app = create_app(s)
    c = TestClient(app)  # no lifespan: the export worker is not started, the job stays queued
    ids = seed_tree(c)
    recordings.invalidate()
    cam = c.post(f"{API}/cameras", json={"channel": 1, "alias": "כניסה"}).json()
    set_track(s, cam["id"])
    monkeypatch.setattr(nvr, "search_recordings", fake_pages([("2026-09-14T10:00:00Z", "2026-09-14T10:02:00Z", "MOTION", "f1", 1000)]))
    monkeypatch.setattr(ex.WORKER, "wake", lambda: None)
    case = c.post(f"{API}/cases", json={"title": "שימור"}).json()
    clip = c.post(f"{API}/cases/{case['id']}/items",
                  json={"kind": "clip", "camera_id": cam["id"], "from_at": "2026-09-14T07:00:00Z", "to_at": "2026-09-14T07:05:00Z"}).json()

    # refusal: a viewer may not manage cases (audited 403), nothing is created
    bind(c, s, "ron", "viewer", "floor", ids["floor2"])
    r = c.post(f"{API}/cases/{case['id']}/items/{clip['id']}/preserve", headers=as_user("ron"))
    assert r.status_code == 403, r.text
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM export_jobs").fetchone()[0] == 0
    assert audit_rows(app, "case.item.preserve") == []

    o = Oracle()
    r = c.post(f"{API}/cases/{case['id']}/items/{clip['id']}/preserve")
    assert r.status_code == 201, r.text
    item = r.json()
    assert item["id"] == clip["id"] and item["kind"] == "clip" and item["camera_id"] == cam["id"] and item["export_job_id"]
    assert item["preservation"] == "preserving" and item["export"]["state"] == "queued" and item["imported"] is False
    o.compared(f"POST {API}/cases/{{case_id}}/items/{{item_id}}/preserve")
    rows = audit_rows(app, "case.item.preserve", "allowed")
    assert len(rows) == 1 and rows[0]["resource_id"] == case["id"]
    details = json.loads(rows[0]["details_json"])
    assert details["item"] == clip["id"] and details["job"] == item["export_job_id"] and details["camera_id"] == cam["id"]

    # a second press while the job is queued: 409, no second job
    r = c.post(f"{API}/cases/{case['id']}/items/{clip['id']}/preserve")
    assert r.status_code == 409 and r.json()["code"] == "already_preserving"
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM export_jobs").fetchone()[0] == 1


# ---------------------------------------------------------------- catalog: one floor, the building picture

def test_read_one_floor_answers_floor_building_and_site(settings):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    o = Oracle()
    r = c.get(f"{API}/floors/{ids['floor2']}")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["floor"]["id"] == ids["floor2"] and body["floor"]["level"] == 2
    assert body["building"]["id"] == ids["building"] and body["site"]["id"] == ids["site"]
    o.compared(f"GET {API}/floors/{{floor_id}}")
    # a viewer of floor 2 reads floor 2, not floor 3 (the audited 403); an unknown floor is a 404
    bind(c, settings, "ron", "viewer", "floor", ids["floor2"])
    assert c.get(f"{API}/floors/{ids['floor2']}", headers=as_user("ron")).status_code == 200
    r = c.get(f"{API}/floors/{ids['floor3']}", headers=as_user("ron"))
    assert r.status_code == 403, r.text
    with app.state.db.connection() as conn:
        denied = conn.execute("SELECT COUNT(*) FROM audit_log WHERE decision = 'denied' AND actor_username = 'ron' AND resource_id = ?",
                              (ids["floor3"],)).fetchone()[0]
    assert denied >= 1
    assert c.get(f"{API}/floors/nope").status_code == 404


def test_delete_the_building_picture(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        ids = seed_tree(c)
        r = c.post(f"{API}/buildings/{ids['building']}/image", files={"file": ("b.png", _png(), "image/png")})
        assert r.status_code == 200 and r.json()["image_url"]
        bind(c, settings, "ron", "viewer", "floor", ids["floor2"])
        assert c.delete(f"{API}/buildings/{ids['building']}/image", headers=as_user("ron")).status_code == 403
        assert c.get(f"{API}/catalog/images/building/{ids['building']}").status_code == 200, "a refused delete keeps the picture"
        o = Oracle()
        r = c.delete(f"{API}/buildings/{ids['building']}/image")
        assert r.status_code == 200, r.text
        assert r.json()["id"] == ids["building"] and r.json()["image_url"] is None and r.json()["is_shared"] is False
        o.compared(f"DELETE {API}/buildings/{{building_id}}/image")
        assert c.get(f"{API}/catalog/images/building/{ids['building']}").status_code == 404
        # deleting again (no picture) answers the same building, still 200
        assert c.delete(f"{API}/buildings/{ids['building']}/image").json()["image_url"] is None
        assert c.delete(f"{API}/buildings/nope/image").status_code == 404
    rows = [json.loads(r["details_json"]) for r in audit_rows(app, "building.update", "allowed") if r["resource_id"] == ids["building"]]
    assert {"image": True} in rows and rows.count({"image": False}) == 2


def test_patch_a_site(settings):
    """`PATCH /sites/{id}` was answered only inside the off-box restore test; here its own happy path, refusal and audit row."""
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    bind(c, settings, "ron", "viewer", "floor", ids["floor2"])
    assert c.patch(f"{API}/sites/{ids['site']}", json={"name": "x"}, headers=as_user("ron")).status_code == 403
    o = Oracle()
    r = c.patch(f"{API}/sites/{ids['site']}", json={"name": "  אתר מעודכן", "address": "רחוב 2", "sort_order": 3})
    assert r.status_code == 200, r.text
    site = r.json()
    assert site["id"] == ids["site"] and site["address"] == "רחוב 2" and site["sort_order"] == 3 and site["image_url"] is None
    o.compared(f"PATCH {API}/sites/{{site_id}}")
    assert c.get(f"{API}/floors/{ids['floor2']}").json()["site"]["address"] == "רחוב 2"
    assert c.patch(f"{API}/sites/{ids['site']}", json={"name": ""}).status_code == 422
    assert c.patch(f"{API}/sites/nope", json={"name": "x"}).status_code == 404
    rows = [json.loads(r["details_json"]) for r in audit_rows(app, "site.update", "allowed") if r["resource_id"] == ids["site"]]
    assert rows == [{"name": "  אתר מעודכן", "address": "רחוב 2", "sort_order": 3}]


# ---------------------------------------------------------------- evidence signing key rotation (T067)

def test_rotate_the_signing_key(settings):
    app = create_app(settings)
    c = TestClient(app)
    seed = seed_tree(c)
    before = c.get(f"{API}/evidence/signing").json()
    assert "installation_id" in before
    bind(c, settings, "ron", "operator", "floor", seed["floor2"])
    r = c.post(f"{API}/evidence/signing/rotate", headers=as_user("ron"))
    assert r.status_code == 403, r.text
    assert c.get(f"{API}/evidence/signing").json()["active"] == before["active"], "a refused rotation changes nothing"
    o = Oracle()
    r = c.post(f"{API}/evidence/signing/rotate")
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["active"] != before["active"] and out["can_rotate"] is True and "installation_id" not in out, "only GET carries installation_id"
    assert [k["kid"] for k in out["keys"] if k["retired_at"] is None] == [out["active"]]
    o.compared(f"POST {API}/evidence/signing/rotate")
    rows = audit_rows(app, "evidence.key.rotate", "allowed")
    assert len(rows) == 1 and json.loads(rows[0]["details_json"]) == {"active": out["active"], "keys": len(out["keys"])}


# ---------------------------------------------------------------- wall: the photo-set upload, the announcement poll

@pytest.fixture()
def wall_admin(settings):
    app = create_app(settings)
    c = TestClient(app)
    c.get(f"{API}/me")
    return app, c


def test_upload_a_photo_into_a_wall_photo_set(wall_admin, settings):
    app, c = wall_admin
    created = c.post(f"{API}/wall/photo-sets", json={"name": "לובי"})
    assert created.status_code == 201, created.text
    sid = created.json()["id"]
    bind(c, settings, "ron", "operator", "installation", "*")
    r = c.post(f"{API}/wall/photo-sets/{sid}/upload", files={"file": ("a.png", png_bytes(), "image/png")}, headers=as_user("ron"))
    assert r.status_code == 403, r.text
    o = Oracle()
    r = c.post(f"{API}/wall/photo-sets/{sid}/upload", files={"file": ("a.png", png_bytes(), "image/png")})
    assert r.status_code == 201, r.text
    up = r.json()
    assert up["id"] and isinstance(up["bytes"], int) and up["bytes"] > 0
    o.compared(f"POST {API}/wall/photo-sets/{{set_id}}/upload")
    assert [p["id"] for p in c.get(f"{API}/wall/photo-sets/{sid}/photos").json()["photos"]] == [up["id"]]
    rows = audit_rows(app, "wall.photo_set.upload", "allowed")
    assert len(rows) == 1 and rows[0]["resource_id"] == sid and json.loads(rows[0]["details_json"]) == {"photo": up["id"], "bytes": up["bytes"]}
    # not an image, an unknown set
    bad = c.post(f"{API}/wall/photo-sets/{sid}/upload", files={"file": ("a.png", b"not an image", "image/png")})
    assert bad.status_code in (415, 422), bad.text
    assert c.post(f"{API}/wall/photo-sets/nope/upload", files={"file": ("a.png", png_bytes(), "image/png")}).status_code == 404
