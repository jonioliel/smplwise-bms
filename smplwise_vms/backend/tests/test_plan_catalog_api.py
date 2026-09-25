"""Plan Studio object library API (T085): the merged library for every map reader, custom items with "based on" for
catalog.manage only, built-in items never editable, export / import of the custom library (duplicates by id are
replaced, the created_at of a round trip is kept), the audit rows, the roles that hold the permission, the bundle's
catalog_revision and the backup of custom items."""
from __future__ import annotations

import io
import json
import pathlib
import zipfile
from dataclasses import replace

from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.rbac import ROLES
from smplwise.routers.access import PERMISSION_LABELS

ROOT = pathlib.Path(__file__).resolve().parents[3]


def test_library_read_scope_and_the_custom_item_lifecycle(settings):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    lib = c.get("/api/v1/catalog/objects").json()
    assert len(lib["items"]) == 153 and lib["revision"] == "2026.09.1:0:" and [x["id"] for x in lib["categories"]][:2] == ["structure", "circulation"]
    assert lib["items"][0] == dict(lib["items"][0], custom=False, based_on=None)
    # a floor-scoped viewer reads the library, a user without any binding does not, a viewer never manages it
    bind(c, settings, "vera", "viewer", "floor", ids["floor2"])
    assert c.get("/api/v1/catalog/objects", headers=as_user("vera")).status_code == 200
    assert c.get("/api/v1/catalog/objects", headers=as_user("nobody")).status_code == 403
    assert c.post("/api/v1/catalog/objects", json={"names": {"he": "x"}}, headers=as_user("vera")).status_code == 403
    # create based on a built-in lamp: what the body omits comes from the base
    r = c.post("/api/v1/catalog/objects", json={"based_on": "light.ceiling", "names": {"he": "מנורת אולם", "en": "Hall lamp"}, "size": {"w_m": 0.6, "d_m": 0.6, "h_m": 0.2}, "params": {"power_w": 120}})
    assert r.status_code == 201, r.text
    item = r.json()
    assert item["custom"] is True and item["based_on"] == "light.ceiling" and item["category"] == "lighting" and item["icon"] == "lamp" and item["z_ref"] == "ceiling" and item["z_m"] == -0.3
    assert item["anchor_kinds"] == ["light", "switch"] and item["params"] == {"power_w": 120} and item["role"] == "light" and item["created_by"] == "dev-joni"
    iid = item["id"]
    lib = c.get("/api/v1/catalog/objects").json()
    assert len(lib["items"]) == 154 and lib["revision"].startswith("2026.09.1:1:")
    # patch a field; a bad value is refused; built-in items are never touched
    assert c.patch(f"/api/v1/catalog/objects/{iid}", json={"z_m": -0.6, "tags": ["אולם"]}).json()["z_m"] == -0.6
    assert c.patch(f"/api/v1/catalog/objects/{iid}", json={"icon": "spaceship"}).status_code == 422
    assert c.patch(f"/api/v1/catalog/objects/{iid}", json={"size": {"w_m": 0.01, "d_m": 1, "h_m": 1}}).status_code == 422
    assert c.post("/api/v1/catalog/objects", json={"based_on": "nope", "names": {"he": "x"}}).status_code == 422
    assert c.post("/api/v1/catalog/objects", json={"names": {"he": ""}}).status_code == 422
    assert c.patch("/api/v1/catalog/objects/chair.basic", json={"z_m": 1}).status_code == 409
    assert c.delete("/api/v1/catalog/objects/chair.basic").status_code == 409
    assert c.patch("/api/v1/catalog/objects/missing", json={"z_m": 1}).status_code == 404
    # a custom item without a base takes the neutral defaults
    plain = c.post("/api/v1/catalog/objects", json={"names": {"he": "ארגז"}, "category": "storage"}).json()
    assert plain["shape"] == "box" and plain["size"] == {"w_m": 1.0, "d_m": 1.0, "h_m": 1.0} and plain["icon"] == "box" and plain["color_token"] == "object" and plain["z_ref"] == "floor"
    # export, delete, import back (ids kept; a second copy replaces the first)
    exp = c.get("/api/v1/catalog/export")
    assert exp.status_code == 200 and exp.headers["content-disposition"].startswith("attachment") and exp.json()["format"] == "smplwise-catalog-1"
    assert [x["id"] for x in exp.json()["items"]] == [iid, plain["id"]] and exp.json()["items"][0]["names"]["he"] == "מנורת אולם"
    assert c.delete(f"/api/v1/catalog/objects/{iid}").status_code == 204
    assert c.get("/api/v1/catalog/objects").json()["revision"].startswith("2026.09.1:1:")
    imp = c.post("/api/v1/catalog/import", json=exp.json())
    assert imp.status_code == 200, imp.text
    assert imp.json() == {"imported": 1, "replaced": 1, "revision": c.get("/api/v1/catalog/objects").json()["revision"]}
    back = c.get("/api/v1/catalog/objects").json()["items"]
    assert [x["id"] for x in back if x["custom"]] == [iid, plain["id"]], "a round trip keeps created_at, so the order holds"
    assert next(x for x in back if x["id"] == iid)["z_m"] == -0.6
    assert c.post("/api/v1/catalog/import", json={"format": "smplwise-catalog-1", "items": [{"id": "chair.basic", "names": {"he": "x"}}]}).status_code == 422
    assert c.post("/api/v1/catalog/import", json={"format": "smplwise-catalog-1", "items": [{"id": "BAD ID", "names": {"he": "x"}}]}).status_code == 422
    assert c.post("/api/v1/catalog/import", json={"format": "other", "items": []}).status_code == 422
    assert c.get("/api/v1/catalog/export", headers=as_user("vera")).status_code == 403
    with app.state.db.connection() as conn:
        acts = [r[0] for r in conn.execute("SELECT action FROM audit_log WHERE decision = 'allowed' AND (action LIKE 'catalog.item.%' OR action = 'catalog.import') ORDER BY rowid").fetchall()]
    assert acts == ["catalog.item.create", "catalog.item.update", "catalog.item.create", "catalog.item.delete", "catalog.import"]


def test_the_permission_sits_on_the_built_in_roles_and_the_labels(settings):
    assert all("catalog.manage" in ROLES[r] for r in ("editor", "site_admin", "system_admin"))
    assert all("catalog.manage" not in ROLES[r] for r in ("viewer", "operator", "kiosk"))
    assert PERMISSION_LABELS["catalog.manage"] == "ניהול ספריית העצמים"
    contract = json.loads((ROOT / "contracts" / "examples" / "role-catalog.design.json").read_text(encoding="utf-8"))
    assert {r["id"]: "catalog.manage" in r["permissions"] for r in contract["roles"]} == {r["id"]: "catalog.manage" in ROLES[r["id"]] for r in contract["roles"]}
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    bind(c, settings, "eli", "editor", "floor", ids["floor2"])
    assert "catalog.manage" in c.get("/api/v1/me", headers=as_user("eli")).json()["permissions_any"]
    assert c.post("/api/v1/catalog/objects", json={"names": {"he": "ארגז"}}, headers=as_user("eli")).status_code == 201, "an editor anywhere manages the shared library"


def test_the_bundle_carries_the_catalog_revision_and_backups_carry_custom_items(settings, tmp_path):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    asset = c.post(f"/api/v1/floors/{ids['floor2']}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"]}).json()
    assert c.post(f"/api/v1/plan-versions/{v['id']}/publish").status_code == 200
    assert c.get(f"/api/v1/floors/{ids['floor2']}/map").json()["catalog_revision"] == "2026.09.1:0:"
    item = c.post("/api/v1/catalog/objects", json={"based_on": "chair.basic", "names": {"he": "כיסא אולם"}}).json()
    assert c.get(f"/api/v1/floors/{ids['floor2']}/map").json()["catalog_revision"] == c.get("/api/v1/catalog/objects").json()["revision"]
    e = c.post("/api/v1/backups", json={"note": "with a custom item"}).json()
    assert e["tables"]["catalog_items"] == 1
    d = c.get(f"/api/v1/backups/{e['name']}/download")
    with zipfile.ZipFile(io.BytesIO(d.content)) as z:
        assert json.loads(z.read("data/catalog_items.json"))[0]["id"] == item["id"]
    app2 = create_app(replace(settings, data_dir=tmp_path / "data2"))
    c2 = TestClient(app2)
    up = c2.post("/api/v1/backups/upload", files={"file": ("copy.zip", d.content, "application/zip")}).json()
    assert c2.post(f"/api/v1/backups/{up['name']}/restore", json={"mode": "replace", "scope": "project", "confirm": "RESTORE"}).status_code == 200
    restored = [x for x in c2.get("/api/v1/catalog/objects").json()["items"] if x["custom"]]
    assert [x["id"] for x in restored] == [item["id"]] and restored[0]["names"]["he"] == "כיסא אולם" and restored[0]["based_on"] == "chair.basic"
