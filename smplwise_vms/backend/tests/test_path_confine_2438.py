"""CR-PATH-CONFINE-2438 (code review 2026-11-13, 05:P2-13, 05:P3-06).

P2-13: the plan and energy file routes relied on the restore-time check only, and that check accepted any restorable folder for any
file column - a restored `plan_versions.image_path` could name a stored bill (`energy/bills/...`), a ticket photo or a bake, and the
plan routes then served, copied or deleted it. Every file column now has its own folder (services/safe_paths.COLUMN_ROOTS), checked
at restore AND at every serving route; the ten module containment checks share one rule (`safe_paths.inside`).
P3-06: restored row ids that name a folder (cases, plan assets, cameras) were taken unchecked (only floors were checked), and two
name checks used `.match()` with `$`, which accepts a trailing newline."""
from __future__ import annotations

import hashlib
import json
import os
import zipfile
from pathlib import Path
from types import SimpleNamespace

import pytest
from conftest import png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.errors import ApiError
from smplwise.main import create_app
from smplwise.services import backup as backup_svc
from smplwise.services import bundle_import, floor_images, plan_bakes, safe_paths, wall_photos
from smplwise.services.maintenance import files as mfiles
from smplwise.services.skins import store as skins_store
from smplwise.services.tickets import attachments, image_intake
from test_energy_billing_api import API, SEPT, draft, golden_readings, issue, setup_billing, w  # noqa: F401 - `w` is a fixture

VICTIM = b"%PDF-1.7 a stored bill of another module"


def _plan(c: TestClient, floor_id: str) -> tuple[dict, dict]:
    r = c.post(f"/api/v1/floors/{floor_id}/plan-assets", files={"file": ("plan.png", png_bytes(320, 200), "image/png")})
    assert r.status_code == 201, r.text
    asset = r.json()
    v = c.post(f"/api/v1/floors/{floor_id}/plan-versions", json={"asset_id": asset["id"]})
    assert v.status_code in (200, 201), v.text
    return asset, v.json()


def _victim(settings) -> Path:
    """A file of another module under a folder a restore may write (RESTORABLE_ROOTS): a stored bill."""
    p = settings.data_dir / "energy" / "bills" / "2026" / "victim.pdf"
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(VICTIM)
    return p


# ---------------------------------------------------------------- the shared rule

def test_inside_column_roots_and_plan_asset_dir(tmp_path):
    root = tmp_path / "data"
    (root / "plans" / "a1").mkdir(parents=True)
    assert safe_paths.inside(root / "plans", root / "plans" / "a1" / "x.png") == (root / "plans" / "a1" / "x.png").resolve()
    for bad in (root / "plans", root / "plans-evil" / "x", root / "plans" / ".." / "x", tmp_path / "x"):
        assert safe_paths.inside(root / "plans", bad) is None, bad
    row = {"id": "a1", "asset_id": "a1", "storage_path": "plans/a1/source.png", "image_path": "plans/a1/version-v1.png"}
    assert safe_paths.column_file(root, "plan_assets", "storage_path", row) is not None
    assert safe_paths.column_file(root, "plan_versions", "image_path", row) is not None
    for bad in ("energy/bills/2026/x.pdf", "plans/a2/version-v1.png", "plans/bakes/f/x.png", "plans/a1/../a2/x.png", "/etc/passwd", "plans/a1", ""):
        assert safe_paths.column_file(root, "plan_versions", "image_path", dict(row, image_path=bad)) is None, bad
    for bad_id in ("bakes", "floor-images", "../x", "a.b", None):
        assert safe_paths.plan_asset_dir(root, bad_id) is None, bad_id
        assert safe_paths.column_file(root, "plan_versions", "image_path", dict(row, asset_id=bad_id)) is None, bad_id
    assert safe_paths.column_file(root, "energy_bills", "pdf_path", {"pdf_path": "energy/bills/2026/b.pdf"}) is not None
    assert safe_paths.column_file(root, "energy_bills", "pdf_path", {"pdf_path": "energy/assets/x.png"}) is None
    assert safe_paths.column_file(root, "energy_assets", "storage_path", {"storage_path": "energy/assets/x.png"}) is not None
    assert safe_paths.column_file(root, "floor_images", "path", {"path": "plans/floor-images/f/x.webp"}) is not None
    assert safe_paths.column_file(root, "plan_bakes", "path", {"path": "plans/floor-images/f/x.webp"}) is None


def test_every_restored_file_column_has_its_own_root():
    declared = {(t, c) for t, cols in backup_svc.FILE_COLUMNS.items() for c in cols}
    assert declared == set(safe_paths.COLUMN_ROOTS)


def test_the_module_checks_keep_their_answers(settings, tmp_path):
    """The ten copies now call one rule; each keeps its error type and its answer for a good and a bad path."""
    d = settings.data_dir
    cases = [
        (lambda p: floor_images.confine(settings, p), floor_images.root(settings), floor_images.FloorImageStoreError),
        (lambda p: plan_bakes.confine(settings, p), plan_bakes.root(settings), plan_bakes.BakeStoreError),
        (lambda p: skins_store._confine(settings, p), skins_store.skins_root(settings), skins_store.SkinStoreError),
        (lambda p: image_intake.confine(d / "tickets", p), d / "tickets", image_intake.StorePathError),
    ]
    for fn, root, err in cases:
        assert fn(root / "f1" / "x.png") == (root / "f1" / "x.png").resolve()
        for bad in (root, root / ".." / "x", root.parent / (root.name + "-evil") / "x"):
            with pytest.raises(err):
                fn(bad)
    assert floor_images.confine_stored(settings, "plans/floor-images/f1/x.webp").name == "x.webp"
    for bad in ("../x", "plans/floor-images/../../x", "/abs", "a\\b", "plans/bakes/x"):
        with pytest.raises(floor_images.FloorImageStoreError):
            floor_images.confine_stored(settings, bad)
    with pytest.raises(skins_store.SkinStoreError):
        skins_store.confine_stored(settings, "skins/f1/../../keys/x")
    assert mfiles.path_of(d, "t1/" + "a" * 16 + ".pdf").name == "a" * 16 + ".pdf"
    assert attachments.path_of(d, "t1/" + "a" * 16 + ".jpg").name == "a" * 16 + ".jpg"
    for bad in ("../" + "a" * 16 + ".jpg", "t1/../" + "a" * 16 + ".jpg"):
        with pytest.raises(ValueError):
            attachments.path_of(d, bad)
    assert wall_photos._set_dir(settings, "set1").name == "set1"


# ---------------------------------------------------------------- 05:P2-13 at the serving routes

def test_plan_routes_never_serve_copy_or_delete_another_modules_file(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        ids = seed_tree(c)
        asset, v = _plan(c, ids["floor2"])
        victim = _victim(settings)
        assert c.get(f"/api/v1/plan-versions/{v['id']}/image.png").status_code == 200, "the product's own path still serves"
        with app.state.db.connection() as conn:
            conn.execute("UPDATE plan_versions SET image_path = ?, stylized_path = ? WHERE id = ?", ("energy/bills/2026/victim.pdf", "energy/bills/2026/victim.pdf", v["id"]))
        for tail in ("image.png", "source.png", "stylized.png"):
            r = c.get(f"/api/v1/plan-versions/{v['id']}/{tail}")
            assert r.status_code == 404 and r.content != VICTIM, tail
        assert c.post(f"/api/v1/plan-versions/{v['id']}/stylize", json={}).status_code == 404
        assert c.delete(f"/api/v1/plan-versions/{v['id']}").status_code == 204
        assert victim.read_bytes() == VICTIM, "never deleted"
        with app.state.db.connection() as conn:
            conn.execute("UPDATE plan_assets SET storage_path = ? WHERE id = ?", ("energy/bills/2026/victim.pdf", asset["id"]))
        for cached in (settings.plans_dir / asset["id"]).glob("page-*.png"):  # the rendered page is derived: render it again
            cached.unlink()
        r = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"], "page": 1, "rotation": 90})
        assert r.status_code == 404 and victim.read_bytes() == VICTIM


def test_the_bill_pdf_route_never_serves_another_modules_file(w):  # noqa: F811 - pytest fixture
    golden_readings(w)
    s = setup_billing(w)
    b = issue(w, draft(w, s["account"]["id"], SEPT).json()).json()
    stored = w.c.get(f"{API}/bills/{b['id']}/pdf").content
    victim = w.settings.data_dir / "plans" / "a1" / "secret.png"
    victim.parent.mkdir(parents=True, exist_ok=True)
    victim.write_bytes(VICTIM)
    with w.db.connection() as conn:
        conn.execute("UPDATE energy_bills SET pdf_path = ?, pdf_sha256 = ? WHERE id = ?", ("plans/a1/secret.png", hashlib.sha256(VICTIM).hexdigest(), b["id"]))
    r = w.c.get(f"{API}/bills/{b['id']}/pdf")
    assert r.status_code == 200 and r.content != VICTIM and r.content.startswith(stored[:4]), "rendered again from the snapshot"


# ---------------------------------------------------------------- 05:P2-13 and 05:P3-06 at restore

def test_a_crafted_archive_cannot_point_a_plan_row_at_another_folder_or_name_a_folder_by_id(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        ids = seed_tree(c)
        asset, v = _plan(c, ids["floor2"])
        case = c.post("/api/v1/cases", json={"title": "תיק"}).json()
        item = c.post(f"/api/v1/cases/{case['id']}/items", json={"kind": "note", "note": "x"}).json()
        with app.state.db.connection() as conn:
            good = backup_svc.create(settings, conn)
        src = backup_svc.backups_dir(settings) / good["name"]
        crafted = backup_svc.backups_dir(settings) / "crafted-columns.zip"
        victim = _victim(settings)
        with zipfile.ZipFile(src) as zin, zipfile.ZipFile(crafted, "w") as zout:
            for info in zin.infolist():
                body = zin.read(info.filename)
                if info.filename == "data/plan_versions.json":
                    rows = json.loads(body)
                    t = next(r for r in rows if r["id"] == v["id"])
                    rows += [dict(t, id="pvbill", image_path="energy/bills/2026/victim.pdf"),  # a bill (a restorable root)
                             dict(t, id="pvbake", image_path="plans/bakes/f/x.png"),  # another module's plan folder
                             dict(t, id="pvother", stylized_path="plans/otherasset/x.png"),  # another asset's folder
                             dict(t, id="pvorphan", asset_id="../a", image_path="plans/../a/x.png")]
                    body = json.dumps(rows).encode("utf-8")
                if info.filename == "data/plan_assets.json":
                    rows = json.loads(body)
                    rows += [dict(rows[0], id="../a", storage_path="plans/../a/source.png", sha256="1" * 64)]
                    body = json.dumps(rows).encode("utf-8")
                if info.filename == "data/cases.json":
                    rows = json.loads(body)
                    rows += [dict(rows[0], id="..")]
                    body = json.dumps(rows).encode("utf-8")
                if info.filename == "data/case_items.json":
                    rows = json.loads(body)
                    rows += [dict(rows[0], id="ci2", case_id="..")]
                    body = json.dumps(rows).encode("utf-8")
                zout.writestr(info, body)
        with app.state.db.connection() as conn:
            res = backup_svc.restore(settings, conn, crafted, mode="replace")
            skipped = res["skipped_unsafe"]
            assert skipped.get("plan_versions") == 4 and skipped.get("plan_assets") == 1, skipped
            assert skipped.get("cases") == 1 and skipped.get("case_items") == 1, skipped
            assert {r[0] for r in conn.execute("SELECT id FROM plan_versions")} == {v["id"]}
            assert {r[0] for r in conn.execute("SELECT id FROM plan_assets")} == {asset["id"]}
            assert {r[0] for r in conn.execute("SELECT id FROM cases")} == {case["id"]}
            assert {r[0] for r in conn.execute("SELECT id FROM case_items")} == {item["id"]}
        assert c.get("/api/v1/plan-versions/pvbill/image.png").status_code == 404
        assert c.delete("/api/v1/plan-versions/pvbill").status_code == 404
        assert victim.read_bytes() == VICTIM
        assert c.get(f"/api/v1/plan-versions/{v['id']}/image.png").status_code == 200, "the product's own rows and files come back"


def test_a_restored_camera_with_a_folder_steering_id_is_skipped(settings):
    data = {"cameras": [{"id": "../thumbs", "recorder_id": "r"}, {"id": "cam1", "recorder_id": "r"}],
            "map_anchors": [{"id": "a1", "camera_id": "../thumbs"}, {"id": "a2", "camera_id": "cam1"}]}
    skipped = backup_svc._unsafe_rows(settings, data)
    assert skipped == {"cameras": 1, "map_anchors": 1}
    assert [r["id"] for r in data["cameras"]] == ["cam1"] and [r["id"] for r in data["map_anchors"]] == ["a2"]


# ---------------------------------------------------------------- 05:P3-06 `fullmatch`

def test_a_trailing_newline_is_never_a_name():
    assert bundle_import.files_to_store({"files": [{"path": "clips/a.mp4\n", "sha256": "a" * 64}, {"path": "clips/b.mp4", "sha256": "b" * 64}]}) == {"clips/b.mp4": "b" * 64}


@pytest.mark.skipif(os.name != "posix", reason="a file name with a newline exists only on POSIX")
def test_the_backup_routes_refuse_a_name_with_a_trailing_newline(settings):
    from smplwise.routers import backup as backup_router

    d = backup_svc.backups_dir(settings)
    d.mkdir(parents=True, exist_ok=True)
    (d / "a.zip\n").write_bytes(b"PK")
    req = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(settings=settings)), state=SimpleNamespace())
    with pytest.raises(ApiError):
        backup_router._path(req, "a.zip\n")
