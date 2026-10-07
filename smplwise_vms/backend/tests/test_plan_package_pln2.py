"""PLN2: the plan package and the DXF with several levels and connectors.

Round trip: a plan with three levels, a door / window / labels / objects per level, a stairs model (L shape, two
flights, a landing) between two levels, an elevator, the connector a tribune derives, and stairs linked to another
floor - exported as a signed package, the draft changed (a level and its items removed, a connector moved), then
imported back: the document hash and the geometry hash equal the exported ones (replace), per level as well; merge
restores the package's items and keeps the local one; an import into another floor's version keeps the geometry hash.

The optional DXF in the package (assets/plan.dxf): a layer family per level, an IMAGE entity that names the plan
picture shipped beside it, the camera scope of the exporting person (review M2), a size bound on export and on import
(hashed, never parsed), and nothing of it in a package that did not ask for it (an importer before PLN2 would refuse
the file)."""
from __future__ import annotations

import copy
import hashlib
import io
import json
import zipfile

import ezdxf
import pytest
from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient
from test_plan_package import _audit, _export, _files, _import, _preview, _zip, repack
from test_security_review_220 import _deny_camera

from smplwise.main import create_app
from smplwise.services import geometry_store as store
from smplwise.services import plan_dxf_export as dx
from smplwise.services import plan_package as pp
from smplwise.services import signing

LEVELS = [{"id": "L0", "name": "קרקע", "elevation_m": 0.0, "ceiling_height_m": 3.0, "is_default": True, "external_ids": {}},
          {"id": "MEZ", "name": "יציע", "elevation_m": 1.6, "ceiling_height_m": 2.4, "is_default": False, "external_ids": {}},
          {"id": "L2", "name": "גלריה עליונה", "elevation_m": 3.2, "ceiling_height_m": 3.0, "is_default": False, "external_ids": {}}]


def WALL(wid: str, level: str, pl: list) -> dict:
    return {"id": wid, "level_id": level, "polyline": pl, "thickness_m": 0.2, "height_m": None, "base_z_m": 0, "kind": "interior", "confidence": 1,
            "source": "manual", "locked": False, "external_ids": {}}


def OPENING(oid: str, wall: str, kind: str) -> dict:
    return {"id": oid, "wall_id": wall, "t": 0.5, "kind": kind, "width_m": 0.9, "height_m": 2.1, "sill_m": 0 if kind == "door" else 0.9,
            "swing": "right" if kind == "door" else "none", "hinge": "start", "anchor_ref": None, "confidence": 1, "source": "manual", "external_ids": {}}


def OBJ(oid: str, item: str, level: str, pos, **kw) -> dict:
    o = {"id": oid, "item_id": item, "level_id": level, "position": list(pos), "rotation_deg": 0, "size": {"w_m": 0.45, "d_m": 0.45, "h_m": 0.85}, "z_m": 0,
         "params": {}, "label": None, "anchor_ref": None, "group_id": None, "confidence": 1, "source": "manual", "locked": False, "external_ids": {}}
    o.update(kw)
    return o


def CONN(cid: str, kind: str, a: str, b: str | None, pl: list, **kw) -> dict:
    c = {"id": cid, "kind": kind, "level_from": a, "level_to": b, "floor_ids": [], "polyline": pl, "width_m": 1.2, "label": None, "object_id": None,
         "source": "manual", "external_ids": {}}
    c.update(kw)
    return c


def _version(c: TestClient, floor_id: str, name: str = "plan.png") -> str:
    asset = c.post(f"/api/v1/floors/{floor_id}/plan-assets", files={"file": (name, png_bytes(), "image/png")}).json()
    vid = c.post(f"/api/v1/floors/{floor_id}/plan-versions", json={"asset_id": asset["id"]}).json()["id"]
    assert c.post(f"/api/v1/plan-versions/{vid}/publish").status_code == 200
    return vid


def _draft(c: TestClient, vid: str) -> dict:
    return c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()


def _save(c: TestClient, vid: str, **fields) -> dict:
    g = _draft(c, vid)
    r = c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": dict(g["doc"], **fields), "base_revision": g["geometry"]["revision"]})
    assert r.status_code == 200, r.text
    return r.json()


def _multi_level_doc() -> dict:
    return {
        "levels": LEVELS,
        "walls": [WALL("w0a", "L0", [[0.1, 0.1], [0.9, 0.1]]), WALL("w0b", "L0", [[0.1, 0.1], [0.1, 0.9]]), WALL("wm1", "MEZ", [[0.5, 0.5], [0.9, 0.5]]),
                  WALL("w2a", "L2", [[0.2, 0.8], [0.8, 0.8]])],
        "openings": [OPENING("d0", "w0a", "door"), OPENING("n2", "w2a", "window")],
        "labels": [{"id": "lb0", "text": "לובי", "position": [0.4, 0.3], "level_id": "L0", "size": 14},
                   {"id": "lbm", "text": "יציע", "position": [0.7, 0.45], "level_id": "MEZ", "size": 14},
                   {"id": "lb2", "text": "גלריה", "position": [0.5, 0.7], "level_id": "L2", "size": 14}],
        "objects": [OBJ("o0", "chair.basic", "L0", (0.3, 0.4)), OBJ("o2", "extinguisher.co2", "L2", (0.6, 0.75), size={"w_m": 0.2, "d_m": 0.2, "h_m": 0.6}),
                    OBJ("trib", "tribune.stepped", "L0", (0.55, 0.65), size={"w_m": 3.0, "d_m": 2.0, "h_m": 1.2},
                        params={"rows": 4, "step_height_m": 0.3, "step_width_m": 0.5, "connects_levels": "MEZ"})],
        "connectors": [CONN("st-l", "stairs", "L0", "L2", [[0.2, 0.5], [0.2, 0.3], [0.35, 0.3]], width_m=1.0, shape="l", turn="left",
                            flights=[{"steps": 8}, {"steps": 9}], landing_depth_m=1.2),
                       CONN("lift", "elevator", "L0", "MEZ", [[0.8, 0.3], [0.85, 0.3]], width_m=1.5),
                       CONN("xf", "stairs", "L2", None, [[0.7, 0.7], [0.8, 0.7]])],
    }


@pytest.fixture()
def levels_world(settings):
    """floor2: the three-level plan, published; floor3: a plan, the far end of the linked stairs `xf`."""
    c = TestClient(create_app(settings))
    ids = seed_tree(c)
    vid = _version(c, ids["floor2"])
    other = _version(c, ids["floor3"], "other.png")
    saved = _save(c, vid, **_multi_level_doc())
    assert [i for i in saved["issues"] if i["severity"] == "error" and i["code"] != "connector_levels"] == [], saved["issues"]
    r = c.post(f"/api/v1/plan-versions/{vid}/geometry/link", json={"connector_id": "xf", "floor_id": ids["floor3"]})
    assert r.status_code == 200, r.text
    d = _draft(c, vid)
    assert d["issues"] == [] or all(i["severity"] != "error" for i in d["issues"]), d["issues"]
    assert {x["id"] for x in d["doc"]["connectors"]} == {"st-l", "lift", "xf", "cx-trib"}, "the tribune derives its connector"
    assert c.post(f"/api/v1/plan-versions/{vid}/geometry/publish").status_code == 200
    return c, ids, vid, other


def _per_level_hash(doc: dict) -> dict[str, str]:
    """The geometry of each level on its own: its walls, their openings, labels, objects and the connectors that touch it."""
    out = {}
    for lv in doc["levels"]:
        lid = lv["id"]
        walls = sorted((w for w in doc["walls"] if w["level_id"] == lid), key=lambda w: w["id"])
        wall_ids = {w["id"] for w in walls}
        part = {"level": lv, "walls": walls, "openings": sorted((o for o in doc["openings"] if o["wall_id"] in wall_ids), key=lambda o: o["id"]),
                "labels": sorted((x for x in doc["labels"] if x["level_id"] == lid), key=lambda x: x["id"]),
                "objects": sorted((x for x in doc["objects"] if x["level_id"] == lid), key=lambda x: x["id"]),
                "connectors": sorted((x for x in doc["connectors"] if lid in (x["level_from"], x.get("level_to"))), key=lambda x: x["id"])}
        out[lid] = hashlib.sha256(json.dumps(part, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    return out


def _published(c: TestClient, vid: str) -> dict:
    return c.get(f"/api/v1/plan-versions/{vid}/geometry").json()


# ---------------------------------------------------------------- round trip with levels and connectors

def test_multi_level_round_trip_restores_the_document_and_geometry_hashes(levels_world, settings):
    c, ids, vid, other = levels_world
    pub = _published(c, vid)
    published, levels_before = pub["geometry"]["doc_hash"], _per_level_hash(pub["doc"])
    r = _export(c, vid)
    assert r.status_code == 200, r.text
    m = json.loads(_files(r.content)["manifest.json"])
    assert m["document"]["doc_hash"] == published and m["document"]["counts"]["levels"] == 3 and m["document"]["counts"]["connectors"] == 4
    assert "dxf" not in m and pp.DXF_NAME not in _files(r.content), "no DXF unless asked: an older importer refuses the file"
    shipped = json.loads(_files(r.content)["plan.json"])
    xf = next(x for x in shipped["connectors"] if x["id"] == "xf")
    assert xf["floor_ids"] == sorted([ids["floor2"], ids["floor3"]]) and "far" not in xf, "the cross-floor link travels, the computed far end does not"
    # the draft drifts: the upper level and everything on it removed, the elevator moved, a stair flight changed
    d = _draft(c, vid)["doc"]
    keep = lambda x: x.get("level_id") != "L2"  # noqa: E731
    drift = dict(d, levels=[lv for lv in d["levels"] if lv["id"] != "L2"], walls=[w for w in d["walls"] if keep(w)],
                 openings=[o for o in d["openings"] if o["wall_id"] != "w2a"], labels=[x for x in d["labels"] if keep(x)],
                 objects=[x for x in d["objects"] if keep(x)],
                 connectors=[dict(x, polyline=[[0.6, 0.3], [0.65, 0.3]]) if x["id"] == "lift" else x for x in d["connectors"] if x["id"] not in ("st-l", "xf")])
    _save(c, vid, **{k: drift[k] for k in ("levels", "walls", "openings", "labels", "objects", "connectors")})
    assert _draft(c, vid)["geometry"]["doc_hash"] != published
    plan = _preview(c, vid, r.content).json()
    assert plan["result_hash"] == published and plan["result_geometry_hash"] == m["document"]["geometry_hash"]
    diff = plan["diff"]["collections"]
    assert "L2" in diff["levels"]["added"] and {"st-l", "xf"} <= set(diff["connectors"]["added"]) and "lift" in diff["connectors"]["changed"]
    done = _import(c, vid, r.content, plan)
    assert done.status_code == 200, done.text
    assert done.json()["result_hash"] == published and done.json()["result_geometry_hash"] == m["document"]["geometry_hash"]
    after = _draft(c, vid)
    assert after["geometry"]["doc_hash"] == published
    assert pp.geometry_hash(store.strip_far(copy.deepcopy(after["doc"]))) == m["document"]["geometry_hash"], "the read adds `far`; the stored geometry is the same"
    assert _per_level_hash(after["doc"]) == levels_before, "every level comes back as it was"
    st = next(x for x in after["doc"]["connectors"] if x["id"] == "st-l")
    assert (st["shape"], st["turn"], st["flights"], st["landing_depth_m"]) == ("l", "left", [{"steps": 8}, {"steps": 9}], 1.2)
    # the other floor's twin is untouched by an import (it never writes another floor)
    assert [x["id"] for x in _draft(c, other)["doc"]["connectors"]] == ["xf"]
    assert [a["decision"] for a in _audit(settings, "geometry.package.import")] == ["allowed"]


def test_multi_level_merge_keeps_the_local_item_and_restores_the_package_items(levels_world):
    c, ids, vid, other = levels_world
    pkg = _export(c, vid).content
    published = _published(c, vid)["doc"]
    d = _draft(c, vid)["doc"]
    local = WALL("local-mez", "MEZ", [[0.6, 0.6], [0.9, 0.6]])
    _save(c, vid, walls=[*[w for w in d["walls"] if w["id"] != "wm1"], local], connectors=[x for x in d["connectors"] if x["id"] != "lift"])
    plan = _preview(c, vid, pkg, "merge").json()
    assert plan["diff"]["collections"]["walls"]["added"] == ["wm1"] and plan["diff"]["collections"]["walls"].get("removed", []) == []
    done = _import(c, vid, pkg, plan, mode="merge")
    assert done.status_code == 200, done.text
    after = _draft(c, vid)["doc"]
    assert {w["id"] for w in after["walls"]} == {w["id"] for w in published["walls"]} | {"local-mez"}
    assert {x["id"] for x in after["connectors"]} == {x["id"] for x in published["connectors"]}
    assert [lv["id"] for lv in after["levels"]] == [lv["id"] for lv in published["levels"]]
    # without the local wall every level is the exported one again (merge appends re-added items, so the collection
    # ORDER - part of the document hash - may differ; the per-level hash compares the items by id)
    _save(c, vid, walls=[w for w in after["walls"] if w["id"] != "local-mez"])
    assert _per_level_hash(_draft(c, vid)["doc"]) == _per_level_hash(_published(c, vid)["doc"])


def test_multi_level_package_into_another_version_keeps_the_geometry_hash(levels_world, settings):
    c, ids, vid, other = levels_world
    pkg = _export(c, vid).content
    m = json.loads(_files(pkg)["manifest.json"])
    # a second version of the same floor (same drawing size, another picture id): the geometry is the same thing
    v2 = _version(c, ids["floor2"], "plan-b.png")
    plan = _preview(c, v2, pkg).json()
    assert plan["same_version"] is False
    assert plan["result_geometry_hash"] == m["document"]["geometry_hash"]
    done = _import(c, v2, pkg, plan)
    assert done.status_code == 200, done.text
    doc = _draft(c, v2)["doc"]
    assert doc["plan_version_id"] == v2 and pp.geometry_hash(store.strip_far(copy.deepcopy(doc))) == m["document"]["geometry_hash"]
    assert _per_level_hash(doc) == _per_level_hash(_published(c, vid)["doc"])


# ---------------------------------------------------------------- the DXF in the package

def _dxf_of(pkg: bytes) -> ezdxf.document.Drawing:
    return ezdxf.read(io.StringIO(_files(pkg)[pp.DXF_NAME].decode("utf-8")))


def test_the_package_can_carry_the_dxf_with_the_picture_beside_it(levels_world, settings):
    c, ids, vid, other = levels_world
    published = _published(c, vid)["geometry"]["doc_hash"]
    r = c.post(f"/api/v1/plan-versions/{vid}/package", json={"draft": False, "dxf": True})
    assert r.status_code == 200, r.text
    files = _files(r.content)
    m = json.loads(files["manifest.json"])
    background = next(n for n in files if n.startswith("assets/background."))
    assert m["dxf"] == {"path": pp.DXF_NAME, "background": background, "included": True, "skipped": None}
    assert any(f["path"] == pp.DXF_NAME and f["role"] == "dxf" for f in m["files"]), "listed and hashed in the signed manifest"
    assert pp.DXF_NAME in files["report.html"].decode("utf-8")
    back = _dxf_of(r.content)
    assert not back.audit().has_errors
    layers = {lay.dxf.name for lay in back.layers}
    assert {f"SW_WALLS-{s}" for s in ("L0", "MEZ", "L2")} <= layers and "SW_WALLS" not in layers
    assert {e.get_xdata(dx.APP_ID)[0].value for e in back.modelspace() if e.dxf.layer == "SW_WALLS-MEZ"} == {"wm1"}
    # the stairs between L0 and L2 on both levels' connector layers; the elevator on L0 and MEZ; the cross-floor stairs on L2 only
    on = lambda cid: sorted(e.dxf.layer for e in back.modelspace() if e.dxftype() == "LWPOLYLINE" and e.get_xdata(dx.APP_ID)[0].value == cid)  # noqa: E731
    assert on("st-l") == ["SW_CONNECTORS-L0", "SW_CONNECTORS-L2"] and on("lift") == ["SW_CONNECTORS-L0", "SW_CONNECTORS-MEZ"] and on("xf") == ["SW_CONNECTORS-L2"]
    images = [e for e in back.modelspace() if e.dxftype() == "IMAGE"]
    assert len(images) == 1 and images[0].image_def.dxf.filename == background.split("/", 1)[1], "the IMAGE names the picture in the same folder"
    custom = dict(back.header.custom_vars)
    assert custom["SW_DOC_HASH"] == published and custom["SW_STAGE"] == "published" and custom["SW_LEVEL_MEZ"] == "יציע | 1.6 m"
    # the package with the DXF imports like any other and restores the same hash
    d = _draft(c, vid)["doc"]
    _save(c, vid, walls=d["walls"][1:], openings=[o for o in d["openings"] if o["wall_id"] != d["walls"][0]["id"]])
    plan = _preview(c, vid, r.content).json()
    assert plan["result_hash"] == published
    assert _import(c, vid, r.content, plan).status_code == 200
    assert _draft(c, vid)["geometry"]["doc_hash"] == published
    assert json.loads(_audit(settings, "geometry.package.export")[-1]["details_json"])["dxf"] is True


def test_a_changed_dxf_in_the_package_is_tampering(levels_world, settings):
    c, ids, vid, other = levels_world
    pkg = c.post(f"/api/v1/plan-versions/{vid}/package", json={"dxf": True}).content
    f = _files(pkg)
    f[pp.DXF_NAME] = f[pp.DXF_NAME].replace(b"SW_WALLS-L0", b"SW_WALLS-XX")
    r = _preview(c, vid, _zip(f))
    assert r.status_code == 422 and r.json()["code"] == "package_tampered"
    assert {"path": pp.DXF_NAME, "reason": "changed"} in r.json()["details"]["files"]
    # another file name next to it is not accepted, even signed
    other_name = repack(pkg, settings, files=lambda fs: fs.__setitem__("assets/plan2.dxf", b"0\nEOF\n"))
    r = _preview(c, vid, other_name)
    assert r.status_code == 422 and r.json()["code"] == "package_unsafe"


def test_the_dxf_size_is_bounded_on_export_and_on_import(levels_world, settings, monkeypatch):
    c, ids, vid, other = levels_world
    pkg = c.post(f"/api/v1/plan-versions/{vid}/package", json={"dxf": True}).content
    size = len(_files(pkg)[pp.DXF_NAME])
    monkeypatch.setattr(pp, "MAX_DXF_BYTES", size - 1)
    # import: refused on the declared size before it is hashed, and audited
    r = _preview(c, vid, pkg)
    assert r.status_code == 422 and r.json()["code"] == "package_file_too_large" and r.json()["details"]["path"] == pp.DXF_NAME
    assert _audit(settings, "geometry.package.import")[-1]["decision"] == "denied"
    # export: a DXF over the bound is left out and the manifest says so
    small = c.post(f"/api/v1/plan-versions/{vid}/package", json={"dxf": True})
    files = _files(small.content)
    assert pp.DXF_NAME not in files and json.loads(files["manifest.json"])["dxf"] == {"path": None, "background": None, "included": False, "skipped": "too_large"}
    monkeypatch.undo()
    # the package-wide limits of 2.2.1 still hold with the DXF present
    assert pp.LIMITS.max_entries == 16 and pp.MAX_PACKAGE_BYTES == 48 * 1024 * 1024 and pp.DXF_NAME in pp.DATA_NAMES
    assert len([n for n in pp.DATA_NAMES]) + len(pp.CONTROL_NAMES) + 2 <= pp.LIMITS.max_entries, "every known file fits the entry bound"


def test_the_dxf_in_the_package_and_the_level_dxf_respect_the_camera_scope(levels_world, settings):
    c, ids, vid, other = levels_world
    seen = c.post("/api/v1/cameras", json={"channel": 4, "alias": "מבואה-גלויה"}).json()
    hidden = c.post("/api/v1/cameras", json={"channel": 5, "alias": "כספת-מוסתרת"}).json()
    for cam, x in ((seen, 0.3), (hidden, 0.6)):
        assert c.post(f"/api/v1/floors/{ids['floor2']}/anchors", json={"resource_type": "camera", "resource_id": cam["id"], "x": x, "y": 0.4}).status_code == 201
    bind(c, settings, "ron", "viewer", "floor", ids["floor2"])
    bind(c, settings, "edna", "editor", "floor", ids["floor2"])
    for user in ("ron", "edna"):
        _deny_camera(settings, user, hidden["id"])
    # the multi-level DXF of the published structure (map.read)
    text = c.get(f"/api/v1/plan-versions/{vid}/export.dxf", headers=as_user("ron")).content.decode("utf-8")
    assert "SW_WALLS-MEZ" in text and seen["id"] in text and hidden["id"] not in text and "כספת-מוסתרת" not in text
    # the package of the draft with its DXF (map.edit)
    r = c.post(f"/api/v1/plan-versions/{vid}/package", json={"draft": True, "dxf": True}, headers=as_user("edna"))
    assert r.status_code == 200, r.text
    files = _files(r.content)
    dxf_text = files[pp.DXF_NAME].decode("utf-8")
    assert seen["id"] in dxf_text and hidden["id"] not in dxf_text and "כספת-מוסתרת" not in dxf_text
    assert [a["resource_id"] for a in json.loads(files["anchors.json"])["anchors"]] == [seen["id"]]
    devices = {e.get_xdata(dx.APP_ID)[0].value for e in ezdxf.read(io.StringIO(dxf_text)).modelspace() if e.dxf.layer == "SW_DEVICES"}
    assert devices == {f"camera:{seen['id']}"}
    # the administrator (no deny) gets both cameras in the package's DXF
    full = _files(c.post(f"/api/v1/plan-versions/{vid}/package", json={"draft": True, "dxf": True}).content)[pp.DXF_NAME].decode("utf-8")
    assert seen["id"] in full and hidden["id"] in full
    # a viewer cannot export the package at all
    assert c.post(f"/api/v1/plan-versions/{vid}/package", json={"dxf": True}, headers=as_user("ron")).status_code == 403


def test_signing_covers_the_dxf(levels_world, settings):
    """The DXF is one of the hashed files of the signed manifest; a valid package without it still verifies."""
    c, ids, vid, other = levels_world
    pkg = c.post(f"/api/v1/plan-versions/{vid}/package", json={"dxf": True}).content
    f = _files(pkg)
    sig = json.loads(f[signing.SIG_NAME])
    keyring = signing.load_keyring(settings)
    assert signing.verify_signature(sig, f["manifest.json"], keyring)["valid"]
    listed = {x["path"]: x["sha256"] for x in json.loads(f["manifest.json"])["files"]}
    assert listed[pp.DXF_NAME] == hashlib.sha256(f[pp.DXF_NAME]).hexdigest()
    with zipfile.ZipFile(io.BytesIO(pkg)) as z:
        assert len(z.namelist()) <= pp.LIMITS.max_entries
    stripped = repack(pkg, settings, files=lambda fs: fs.pop(pp.DXF_NAME))
    assert _preview(c, vid, stripped).status_code == 200
    assert store.doc_hash(json.loads(f["plan.json"])) == json.loads(f["manifest.json"])["document"]["doc_hash"]
