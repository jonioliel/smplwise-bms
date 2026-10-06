"""Plan Studio 5 (T088, ST5): the signed plan package and its re-import.

Round trip: a package exported and imported back into the same version restores the same document hash (and the same
geometry hash); the import is a dry run until confirmed, lands in the draft only, and reports what the package names that
this installation lacks. Hostile input: a changed file, a changed manifest, a missing signature, a path that climbs out,
a zip bomb, too many entries, an unexpected file, an unsupported package or document version - each refused before
anything is written, and the refusal audited. Signed by another installation: shown, then imported only on an explicit
confirmation. A stale draft revision or a changed result is a 409."""
from __future__ import annotations

import dataclasses
import hashlib
import io
import json
import pathlib
import sqlite3
import zipfile

import pytest
from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import plan_package as pp
from smplwise.services import signing

FIX = pathlib.Path(__file__).resolve().parents[3] / "contracts" / "fixtures" / "plan_geometry"
WALL = {"id": "w1", "level_id": "L0", "polyline": [[0.1, 0.2], [0.6, 0.2]], "thickness_m": 0.2, "height_m": None, "base_z_m": 0, "kind": "interior",
        "confidence": 1, "source": "manual", "locked": False, "external_ids": {}}


def _sample() -> dict:
    return json.loads((FIX / "sample-v2.json").read_text(encoding="utf-8"))


@pytest.fixture()
def world(settings):
    c = TestClient(create_app(settings))
    ids = seed_tree(c)
    asset = c.post(f"/api/v1/floors/{ids['floor2']}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    vid = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"]}).json()["id"]
    assert c.post(f"/api/v1/plan-versions/{vid}/publish").status_code == 200
    g = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()
    s = _sample()
    doc = dict(g["doc"], **{k: s[k] for k in ("levels", "walls", "openings", "labels", "objects", "connectors", "groups", "circuits")})
    r = c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": doc, "base_revision": 0})
    assert r.status_code == 200, r.text
    assert c.post(f"/api/v1/plan-versions/{vid}/geometry/publish").status_code == 200
    return c, ids, vid


def _export(c: TestClient, vid: str, draft: bool = False, headers: dict | None = None):
    return c.post(f"/api/v1/plan-versions/{vid}/package", json={"draft": draft}, headers=headers or {})


def _files(data: bytes) -> dict[str, bytes]:
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        return {n: z.read(n) for n in z.namelist()}


def _zip(files: dict[str, bytes]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for n, b in files.items():
            z.writestr(n, b)
    return buf.getvalue()


def repack(data: bytes, sign_with, *, files=None, manifest=None, doc=None) -> bytes:
    """Change the package and sign it again as a valid package of `sign_with` (Settings): the file hashes, the doc hash
    and the signature are recomputed, so only the change under test can be refused."""
    f = _files(data)
    if doc is not None:
        d = json.loads(f["plan.json"])
        doc(d)
        f["plan.json"] = json.dumps(d, ensure_ascii=False).encode("utf-8")
    if files is not None:
        files(f)
    m = json.loads(f["manifest.json"])
    from smplwise.services import geometry_store as store

    m["document"]["doc_hash"] = store.doc_hash(json.loads(f["plan.json"]))
    m["files"] = [{"path": n, "bytes": len(b), "sha256": hashlib.sha256(b).hexdigest(), "role": "x"} for n, b in f.items() if n not in pp.CONTROL_NAMES]
    if manifest is not None:
        manifest(m)
    mb = json.dumps(m, ensure_ascii=False).encode("utf-8")
    f["manifest.json"] = mb
    f["MANIFEST.sha256"] = hashlib.sha256(mb).hexdigest().encode() + b"  manifest.json\n"
    f[signing.SIG_NAME] = json.dumps(signing.sign_manifest(sign_with, mb)).encode("utf-8")
    return _zip(f)


def _preview(c: TestClient, vid: str, data: bytes, mode: str = "replace", headers: dict | None = None):
    return c.post(f"/api/v1/plan-versions/{vid}/package/preview?mode={mode}", files={"file": ("p.swplan.zip", data, "application/zip")}, headers=headers or {})


def _import(c: TestClient, vid: str, data: bytes, plan: dict, mode: str = "replace", accept_foreign: bool = False, headers: dict | None = None):
    q = f"mode={mode}&base_revision={plan['base_revision']}&expect_hash={plan['result_hash']}" + ("&accept_foreign=true" if accept_foreign else "")
    return c.post(f"/api/v1/plan-versions/{vid}/package/import?{q}", files={"file": ("p.swplan.zip", data, "application/zip")}, headers=headers or {})


def _audit(settings, action: str) -> list[dict]:
    con = sqlite3.connect(settings.db_path)
    con.row_factory = sqlite3.Row
    try:
        return [dict(r) for r in con.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY id", (action,)).fetchall()]
    finally:
        con.close()


def test_round_trip_restores_the_same_hash(world, settings):
    c, ids, vid = world
    published = c.get(f"/api/v1/plan-versions/{vid}/geometry").json()["geometry"]["doc_hash"]
    r = _export(c, vid)
    assert r.status_code == 200 and r.headers["content-type"] == "application/zip" and r.headers["content-disposition"].endswith('.swplan.zip"')
    files = _files(r.content)
    assert {"manifest.json", "MANIFEST.sha256", "manifest.sig.json", "plan.json", "rooms.json", "anchors.json", "catalog.json", "report.html"} <= set(files)
    assert any(n.startswith("assets/background.") for n in files) and any(n.startswith("assets/source.") for n in files)
    m = json.loads(files["manifest.json"])
    assert m["schema"] == pp.SCHEMA and m["document"]["doc_hash"] == published and m["plan"]["stage"] == "published"
    sig = json.loads(files["manifest.sig.json"])
    assert sig["alg"] == "Ed25519" and "private" not in json.dumps(sig).lower() and "BEGIN" not in json.dumps(sig)
    assert not any(n.endswith(".key") for n in files), "never a key file"
    # the draft drifts: one wall removed
    g = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()
    doc = dict(g["doc"], walls=g["doc"]["walls"][1:], openings=[o for o in g["doc"]["openings"] if o["wall_id"] != g["doc"]["walls"][0]["id"]])
    assert c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": doc, "base_revision": g["geometry"]["revision"]}).status_code == 200
    p = _preview(c, vid, r.content)
    assert p.status_code == 200, p.text
    plan = p.json()
    assert plan["origin"]["trust"] == "installation" and plan["origin"]["same_installation"] is True
    assert plan["same_version"] is True and plan["same_drawing"] is True
    assert plan["result_hash"] == published, "the dry run predicts the published hash"
    assert plan["diff"]["total"] > 0 and "walls" in plan["diff"]["collections"]
    assert "doc" not in plan and "_to_add" not in plan
    # nothing written by the dry run
    assert c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()["geometry"]["revision"] == g["geometry"]["revision"] + 1
    done = _import(c, vid, r.content, plan)
    assert done.status_code == 200, done.text
    out = done.json()
    assert out["result_hash"] == published == m["document"]["doc_hash"]
    assert out["result_geometry_hash"] == m["document"]["geometry_hash"]
    after = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()
    assert after["geometry"]["doc_hash"] == published and after["geometry"]["status"] == "draft"
    assert c.get(f"/api/v1/plan-versions/{vid}/geometry").json()["geometry"]["doc_hash"] == published, "the published structure is untouched"
    exp = _audit(settings, "geometry.package.export")
    imp = _audit(settings, "geometry.package.import")
    assert len(exp) == 1 and json.loads(exp[0]["details_json"])["doc_hash"] == published
    assert [a["decision"] for a in imp] == ["allowed"]
    det = json.loads(imp[0]["details_json"])
    assert det["mode"] == "replace" and det["result_hash"] == published and det["trust"] == "installation"


def test_merge_keeps_local_items_and_takes_the_package_copies(world):
    c, ids, vid = world
    pkg = _export(c, vid).content
    g = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()
    extra = dict(WALL, id="local-wall")
    first = dict(g["doc"]["walls"][0], thickness_m=0.35)
    walls = [first, *g["doc"]["walls"][1:], extra]
    assert c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": dict(g["doc"], walls=walls), "base_revision": g["geometry"]["revision"]}).status_code == 200
    rep = _preview(c, vid, pkg, "replace").json()
    mer = _preview(c, vid, pkg, "merge").json()
    assert rep["diff"]["collections"]["walls"]["removed"] == ["local-wall"]
    assert mer["diff"]["collections"]["walls"].get("removed", []) == [] and mer["diff"]["collections"]["walls"]["changed"] == [first["id"]]
    done = _import(c, vid, pkg, mer, mode="merge")
    assert done.status_code == 200, done.text
    after = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()["doc"]
    ids_now = {w["id"] for w in after["walls"]}
    assert "local-wall" in ids_now
    assert next(w for w in after["walls"] if w["id"] == first["id"])["thickness_m"] == g["doc"]["walls"][0]["thickness_m"] != 0.35


def test_stale_revision_and_changed_result_are_conflicts(world):
    c, ids, vid = world
    pkg = _export(c, vid).content
    plan = _preview(c, vid, pkg).json()
    stale = dict(plan, base_revision=plan["base_revision"] + 5)
    r = _import(c, vid, pkg, stale)
    assert r.status_code == 409 and r.json()["code"] == "stale_revision"
    bad = dict(plan, result_hash="0" * 64)
    r = _import(c, vid, pkg, bad)
    assert r.status_code == 409 and r.json()["code"] == "import_plan_changed"


@pytest.mark.parametrize("case,code", [
    ("tampered_file", "package_tampered"),
    ("tampered_manifest", "package_signature_invalid"),
    ("unsigned", "package_unsigned"),
    ("traversal", "package_unsafe"),
    ("absolute", "package_unsafe"),
    ("unexpected", "package_unsafe"),
    ("bomb", "package_unsafe"),
    ("many", "package_unsafe"),
    ("not_zip", "package_not_zip"),
    ("unlisted", "package_tampered"),
])
def test_hostile_packages_are_refused_before_anything_is_written(world, settings, case, code):
    c, ids, vid = world
    good = _export(c, vid).content
    f = _files(good)
    if case == "tampered_file":
        d = json.loads(f["plan.json"])
        d["walls"] = d["walls"][1:]
        f["plan.json"] = json.dumps(d).encode()
        data = _zip(f)
    elif case == "tampered_manifest":
        m = json.loads(f["manifest.json"])
        m["generated_by"] = "someone else"
        f["manifest.json"] = json.dumps(m).encode()
        data = _zip(f)
    elif case == "unsigned":
        f.pop(signing.SIG_NAME)
        data = _zip(f)
    elif case == "traversal":
        f["../evil.json"] = b"{}"
        data = _zip(f)
    elif case == "absolute":
        f["/etc/evil"] = b"x"
        data = _zip(f)
    elif case == "unexpected":
        data = repack(good, settings, files=lambda ff: ff.__setitem__("run.sh", b"echo hi"))
    elif case == "bomb":
        f["assets/background.png"] = b"\0" * (40 * 1024 * 1024)
        data = _zip(f)
    elif case == "many":
        for i in range(40):
            f[f"assets/x{i}"] = b"x"
        data = _zip(f)
    elif case == "not_zip":
        data = b"this is not a zip"
    else:  # a file that the signed list does not name
        f["assets/source.pdf"] = b"%PDF-1.4"
        data = _zip(f)
    before = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()["geometry"]
    p = _preview(c, vid, data)
    assert p.status_code == 422 and p.json()["code"] == code, p.text
    r = c.post(f"/api/v1/plan-versions/{vid}/package/import?mode=replace&base_revision={before['revision']}&expect_hash={'0' * 64}",
               files={"file": ("p.zip", data, "application/zip")})
    assert r.status_code == 422 and r.json()["code"] == code
    after = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()["geometry"]
    assert (after["revision"], after["doc_hash"]) == (before["revision"], before["doc_hash"])
    denied = [a for a in _audit(settings, "geometry.package.import") if a["decision"] == "denied"]
    assert len(denied) == 2 and json.loads(denied[-1]["details_json"])["code"] == code


def test_unsupported_versions_are_refused(world, settings):
    c, ids, vid = world
    good = _export(c, vid).content
    newer = repack(good, settings, manifest=lambda m: m.__setitem__("schema", "smplwise-plan-package/9"))
    r = _preview(c, vid, newer)
    assert r.status_code == 422 and r.json()["code"] == "package_unsupported"
    olddoc = repack(good, settings, doc=lambda d: d.__setitem__("schema_version", "1.0"))
    r = _preview(c, vid, olddoc)
    assert r.status_code == 422 and r.json()["code"] == "package_doc_version"
    broken = repack(good, settings, doc=lambda d: d.__setitem__("walls", "not a list"))
    r = _preview(c, vid, broken)
    assert r.status_code == 422 and r.json()["code"] == "geometry_structure"
    later = repack(good, settings, manifest=lambda m: m.__setitem__("app_version", "99.0.0"))
    r = _preview(c, vid, later)
    assert r.status_code == 200 and "newer_app_version" in r.json()["warnings"]


def test_a_package_of_another_installation_needs_a_confirmation(world, settings, tmp_path):
    c, ids, vid = world
    other = dataclasses.replace(settings, data_dir=tmp_path / "other")
    foreign = repack(_export(c, vid).content, other, manifest=lambda m: m["installation"].__setitem__("id", "another-site"))
    p = _preview(c, vid, foreign)
    assert p.status_code == 200
    plan = p.json()
    assert plan["origin"]["trust"] == "embedded_key_only" and plan["origin"]["same_installation"] is False
    r = _import(c, vid, foreign, plan)
    assert r.status_code == 409 and r.json()["code"] == "package_foreign"
    r = _import(c, vid, foreign, plan, accept_foreign=True)
    assert r.status_code == 200 and r.json()["origin"]["trust"] == "embedded_key_only"


def test_missing_entities_are_reported(world, settings):
    c, ids, vid = world
    anchors = {"anchors": [{"resource_type": "camera", "resource_id": "cam-gone", "name": "מצלמת חניה", "x": 0.3, "y": 0.3, "rotation_degrees": 0},
                           {"resource_type": "ha_entity", "resource_id": "light.gone", "name": "מנורה", "x": 0.4, "y": 0.4, "rotation_degrees": 0}]}
    rooms = {"rooms": [{"id": "zz", "name": "חדר ישיבות", "polygon": [{"x": 0.1, "y": 0.1}, {"x": 0.2, "y": 0.1}, {"x": 0.2, "y": 0.2}]}]}

    def change(f):
        f["anchors.json"] = json.dumps(anchors, ensure_ascii=False).encode()
        f["rooms.json"] = json.dumps(rooms, ensure_ascii=False).encode()

    data = repack(_export(c, vid).content, settings, files=change)
    plan = _preview(c, vid, data).json()
    ent = plan["entities"]
    assert {a["resource_id"] for a in ent["anchors_missing"]} == {"cam-gone", "light.gone"}
    assert ent["rooms_missing"] == ["חדר ישיבות"]
    assert ent["switches_missing"] == sorted({k["switch_entity_id"] for k in _sample()["circuits"]}) != []


def test_custom_items_travel_with_the_package(world, settings):
    c, ids, vid = world
    item = c.post("/api/v1/catalog/objects", json={"based_on": None, "names": {"he": "ספסל עץ", "en": "Wooden bench"}, "category": "seating", "shape": "box",
                                                   "size": {"w_m": 1.8, "d_m": 0.5, "h_m": 0.45}, "icon": "sofa", "role": "furniture"})
    assert item.status_code == 201, item.text
    iid = item.json()["id"]
    g = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()
    obj = dict(g["doc"]["objects"][0], id="bench-1", item_id=iid, anchor_ref=None, group_id=None, label="ספסל")
    assert c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": dict(g["doc"], objects=[*g["doc"]["objects"], obj]), "base_revision": g["geometry"]["revision"]}).status_code == 200
    pkg = _export(c, vid, draft=True)
    assert pkg.status_code == 200
    cat = json.loads(_files(pkg.content)["catalog.json"])
    assert [i["id"] for i in cat["items"]] == [iid]
    assert c.delete(f"/api/v1/catalog/objects/{iid}").status_code == 204
    plan = _preview(c, vid, pkg.content).json()
    assert plan["entities"]["items_added"] == [iid] and plan["entities"]["items_missing"] == []
    done = _import(c, vid, pkg.content, plan)
    assert done.status_code == 200, done.text
    lib = c.get("/api/v1/catalog/objects").json()
    assert any(i["id"] == iid for i in lib["items"])
    assert any(json.loads(a["details_json"]).get("via") == "plan_package" for a in _audit(settings, "catalog.import"))


def test_permissions(world, settings):
    c, ids, vid = world
    pkg = _export(c, vid).content
    bind(c, settings, "dana", "viewer", "floor", ids["floor2"])
    assert _export(c, vid, headers=as_user("dana")).status_code == 403
    assert _preview(c, vid, pkg, headers=as_user("dana")).status_code == 403
    r = c.post(f"/api/v1/plan-versions/{vid}/package/import?mode=replace&base_revision=0&expect_hash={'0' * 64}",
               files={"file": ("p.zip", pkg, "application/zip")}, headers=as_user("dana"))
    assert r.status_code == 403
    assert c.post(f"/api/v1/plan-versions/{vid}/package/preview?mode=sideways", files={"file": ("p.zip", pkg, "application/zip")}).status_code == 422


def test_import_into_another_drawing_is_flagged(world, settings):
    c, ids, vid = world
    pkg = _export(c, vid).content
    asset = c.post(f"/api/v1/floors/{ids['floor3']}/plan-assets", files={"file": ("other.png", png_bytes(800, 500, (250, 250, 240)), "image/png")}).json()
    v2 = c.post(f"/api/v1/floors/{ids['floor3']}/plan-versions", json={"asset_id": asset["id"]}).json()["id"]
    plan = _preview(c, v2, pkg).json()
    assert plan["same_drawing"] is False and plan["same_version"] is False and "other_drawing" in plan["warnings"]
    done = _import(c, v2, pkg, plan)
    assert done.status_code == 200, done.text
    doc = c.get(f"/api/v1/plan-versions/{v2}/geometry?draft=true").json()["doc"]
    assert doc["plan_version_id"] == v2 and doc["floor_id"] == ids["floor3"], "rebased on the target version"
    assert any("שרטוט אחר" in n for n in doc["uncertainty"]["notes"])
    assert done.json()["result_geometry_hash"] != "" and len(doc["walls"]) == len(_sample()["walls"])
