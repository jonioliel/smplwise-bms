"""PLNS (owner decision D1, 2026-10-08): a furniture / structure item bound to a camera no longer names that camera to
a reader whose camera scope hides it - in the geometry reads (draft, published, history), the SVG / DXF exports and the
signed package - while the item itself stays and the stored document keeps its reference. A writer who was not shown a
reference does not lose it by saving or by importing their own package, and cannot bind a body to a hidden camera.

Users (fixtures of test_security_review_220 / conftest): the administrator (installation-wide), `ron` (viewer on the
floor, the vault camera denied), `edna` (editor on the floor, the vault camera denied), `cami` (viewer of the lobby camera
only: reaches the floor through a camera binding)."""
from __future__ import annotations

import io
import json
import zipfile

import pytest
from conftest import as_user, bind
from test_plan_geometry_binding import OBJ
from test_security_review_220 import _deny_camera, _plan_world

from smplwise.services import geometry_store as store
from smplwise.services import plan_anchor_scope as scope


def _ref(rtype: str, rid: str) -> dict:
    return {"resource_type": rtype, "resource_id": rid}


@pytest.fixture()
def bound(settings):
    """A published structure with three bodies: one on the lobby camera, one on the vault camera, one on an entity."""
    c, ids, vid = _plan_world(settings)
    lobby = c.post("/api/v1/cameras", json={"channel": 4, "alias": "לובי"}).json()
    vault = c.post("/api/v1/cameras", json={"channel": 5, "alias": "כספת"}).json()
    for cam, x in ((lobby, 0.3), (vault, 0.6)):
        assert c.post(f"/api/v1/floors/{ids['floor2']}/anchors", json={"resource_type": "camera", "resource_id": cam["id"], "x": x, "y": 0.4}).status_code == 201
    g = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()
    objects = [OBJ("o-lobby", item="light.ceiling", z_m=2.5, size={"w_m": 0.4, "d_m": 0.4, "h_m": 0.1}, anchor_ref=_ref("camera", lobby["id"])),
               OBJ("o-vault", item="light.ceiling", z_m=2.5, size={"w_m": 0.4, "d_m": 0.4, "h_m": 0.1}, anchor_ref=_ref("camera", vault["id"])),
               OBJ("o-lamp", item="light.ceiling", pos=(0.5, 0.7), z_m=2.5, size={"w_m": 0.4, "d_m": 0.4, "h_m": 0.1}, anchor_ref=_ref("ha_entity", "light.hall"))]
    r = c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": dict(g["doc"], objects=objects), "base_revision": g["geometry"]["revision"]})
    assert r.status_code == 200, r.text
    assert c.post(f"/api/v1/plan-versions/{vid}/geometry/publish").status_code == 200
    bind(c, settings, "ron", "viewer", "floor", ids["floor2"])
    bind(c, settings, "edna", "editor", "floor", ids["floor2"])
    bind(c, settings, "cami", "viewer", "camera", lobby["id"])
    for user in ("ron", "edna"):
        _deny_camera(settings, user, vault["id"])
    return c, ids, vid, lobby["id"], vault["id"]


def _objects(body: dict) -> dict[str, dict]:
    return {o["id"]: o for o in body["doc"]["objects"]}


def _stored(settings, vid: str, status: str) -> dict:
    from smplwise.db import Database

    with Database(settings.db_path).connection() as conn:
        row = store.draft_row(conn, vid) if status == "draft" else store.published_row(conn, vid)
        return store.load_doc(row)


def test_reads_withhold_the_hidden_camera_and_keep_the_item(settings, bound):
    c, ids, vid, lobby, vault = bound
    admin = c.get(f"/api/v1/plan-versions/{vid}/geometry")
    assert admin.status_code == 200 and _objects(admin.json())["o-vault"]["anchor_ref"] == _ref("camera", vault)
    # the administrator's ETag is the stored hash, as before PLNS
    assert admin.headers["etag"].startswith(f'"{admin.json()["geometry"]["doc_hash"]}')
    ron = c.get(f"/api/v1/plan-versions/{vid}/geometry", headers=as_user("ron"))
    assert ron.status_code == 200 and vault not in ron.text
    objs = _objects(ron.json())
    assert objs["o-vault"]["anchor_ref"] is None, "the reference is withheld"
    # security review 2.4.2 M2 (owner decision 2026-10-09): the item stays, but not on the hidden camera's pose
    assert objs["o-vault"]["position"] == list(scope.WITHHELD_POSITION) != _objects(admin.json())["o-vault"]["position"]
    assert objs["o-vault"]["rotation_deg"] == 0
    assert objs["o-lobby"]["anchor_ref"] == _ref("camera", lobby) and objs["o-lamp"]["anchor_ref"] == _ref("ha_entity", "light.hall")
    # the stored row is unchanged and still identifies the revision; the ETag follows what ron is served
    assert ron.json()["geometry"]["doc_hash"] == admin.json()["geometry"]["doc_hash"]
    assert ron.headers["etag"] != admin.headers["etag"] and "-r" in ron.headers["etag"]
    assert c.get(f"/api/v1/plan-versions/{vid}/geometry", headers={**as_user("ron"), "If-None-Match": ron.headers["etag"]}).status_code == 304
    assert c.get(f"/api/v1/plan-versions/{vid}/geometry", headers={**as_user("ron"), "If-None-Match": admin.headers["etag"]}).status_code == 200, \
        "another reader's cached copy is never confirmed"
    # the historical read at the publish instant
    at = admin.json()["geometry"]["published_at"]
    hist = c.get(f"/api/v1/plan-versions/{vid}/geometry", params={"at": at}, headers=as_user("ron"))
    assert hist.status_code == 200 and vault not in hist.text and _objects(hist.json())["o-vault"]["anchor_ref"] is None
    # the editor's draft read
    draft = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true", headers=as_user("edna"))
    assert draft.status_code == 200 and vault not in draft.text and _objects(draft.json())["o-vault"]["anchor_ref"] is None
    # a camera-only reader: the lobby camera, neither the vault camera nor the entity
    cami = c.get(f"/api/v1/plan-versions/{vid}/geometry", headers=as_user("cami"))
    assert cami.status_code == 200 and vault not in cami.text and "light.hall" not in cami.text
    objs = _objects(cami.json())
    assert objs["o-lobby"]["anchor_ref"] == _ref("camera", lobby) and objs["o-vault"]["anchor_ref"] is None and objs["o-lamp"]["anchor_ref"] is None


def test_exports_withhold_the_hidden_camera(settings, bound):
    c, ids, vid, lobby, vault = bound
    for path in ("export.svg", "export.dxf"):
        mine = c.get(f"/api/v1/plan-versions/{vid}/{path}", headers=as_user("ron"))
        assert mine.status_code == 200, (path, mine.text)
        assert vault not in mine.content.decode("utf-8"), path
    assert vault in c.get(f"/api/v1/plan-versions/{vid}/export.dxf").content.decode("utf-8"), "the administrator's DXF is as before"
    assert vault not in c.get(f"/api/v1/plan-versions/{vid}/export.dxf?draft=true", headers=as_user("edna")).content.decode("utf-8")


def _package(c, vid: str, user: str | None, draft: bool = False) -> dict[str, bytes]:
    r = c.post(f"/api/v1/plan-versions/{vid}/package", json={"draft": draft, "dxf": True}, headers=as_user(user) if user else {})
    assert r.status_code == 200, r.text
    with zipfile.ZipFile(io.BytesIO(r.content)) as z:
        return {n: z.read(n) for n in z.namelist()}


def test_the_package_carries_the_redacted_document_with_matching_hashes(settings, bound):
    from smplwise.services import plan_package as pp

    c, ids, vid, lobby, vault = bound
    mine = _package(c, vid, "edna")
    for name, data in mine.items():
        assert vault.encode() not in data, name
    plan = json.loads(mine["plan.json"])
    manifest = json.loads(mine["manifest.json"])
    assert {o["id"]: o["anchor_ref"] for o in plan["objects"]}["o-vault"] is None
    assert manifest["document"]["doc_hash"] == store.doc_hash(plan) and manifest["document"]["geometry_hash"] == pp.geometry_hash(plan)
    assert b"SW_DOC_HASH" in mine["assets/plan.dxf"] and manifest["document"]["doc_hash"].encode() in mine["assets/plan.dxf"]
    # the administrator's package is the stored document, byte for byte as before
    full = _package(c, vid, None)
    stored = _stored(settings, vid, "published")
    assert json.loads(full["manifest.json"])["document"]["doc_hash"] == store.doc_hash(stored) and vault.encode() in full["plan.json"]


def _preview_and_import(c, vid: str, data_files: dict[str, bytes], user: str, mode: str = "replace"):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for n, b in data_files.items():
            z.writestr(n, b)
    data = buf.getvalue()
    p = c.post(f"/api/v1/plan-versions/{vid}/package/preview?mode={mode}", files={"file": ("p.swplan.zip", data, "application/zip")}, headers=as_user(user))
    assert p.status_code == 200, p.text
    q = f"mode={mode}&base_revision={p.json()['base_revision']}&expect_hash={p.json()['result_hash']}"
    r = c.post(f"/api/v1/plan-versions/{vid}/package/import?{q}", files={"file": ("p.swplan.zip", data, "application/zip")}, headers=as_user(user))
    assert r.status_code == 200, r.text
    return p.json(), r.json()


def test_a_scoped_editor_saves_and_reimports_without_losing_the_hidden_reference(settings, bound):
    c, ids, vid, lobby, vault = bound
    g = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true", headers=as_user("edna")).json()
    doc = g["doc"]
    for o in doc["objects"]:
        if o["id"] == "o-vault":
            o["label"] = "מנורה"  # an edit of the item whose reference edna was not shown
    r = c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": doc, "base_revision": g["geometry"]["revision"]}, headers=as_user("edna"))
    assert r.status_code == 200, r.text
    assert vault not in r.text and _objects(r.json())["o-vault"]["label"] == "מנורה"
    stored = {o["id"]: o for o in _stored(settings, vid, "draft")["objects"]}
    assert stored["o-vault"]["anchor_ref"] == _ref("camera", vault) and stored["o-vault"]["label"] == "מנורה", "the stored reference stays"
    # her own package of the draft re-imports (replace) without dropping the reference either
    files = _package(c, vid, "edna", draft=True)
    preview, done = _preview_and_import(c, vid, files, "edna")
    assert "anchor_hidden" not in preview["warnings"]
    assert {o["id"]: o for o in _stored(settings, vid, "draft")["objects"]}["o-vault"]["anchor_ref"] == _ref("camera", vault)
    # merge too
    _preview_and_import(c, vid, _package(c, vid, "edna", draft=True), "edna", mode="merge")
    assert {o["id"]: o for o in _stored(settings, vid, "draft")["objects"]}["o-vault"]["anchor_ref"] == _ref("camera", vault)
    # the administrator still publishes the bound body
    assert c.post(f"/api/v1/plan-versions/{vid}/geometry/publish").status_code == 200
    assert {o["id"]: o for o in _stored(settings, vid, "published")["objects"]}["o-vault"]["anchor_ref"] == _ref("camera", vault)


def test_a_scoped_editor_cannot_bind_a_body_to_a_hidden_camera(settings, bound):
    c, ids, vid, lobby, vault = bound
    g = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true", headers=as_user("edna")).json()
    before = _stored(settings, vid, "draft")
    sneaky = OBJ("o-new", pos=(0.1, 0.9), anchor_ref=_ref("camera", vault))
    r = c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": dict(g["doc"], objects=[*g["doc"]["objects"], sneaky]), "base_revision": g["geometry"]["revision"]},
              headers=as_user("edna"))
    assert r.status_code == 422 and r.json()["code"] == "anchor_hidden" and r.json()["details"]["ids"] == ["o-new"]
    assert vault not in json.dumps(r.json()["details"])
    # nor by rebinding an existing body
    moved = [dict(o, anchor_ref=_ref("camera", vault)) if o["id"] == "o-lobby" else o for o in g["doc"]["objects"]]
    r = c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": dict(g["doc"], objects=moved), "base_revision": g["geometry"]["revision"]}, headers=as_user("edna"))
    assert r.status_code == 422 and r.json()["code"] == "anchor_hidden"
    assert _stored(settings, vid, "draft") == before, "nothing was written"
    # security review 2.4.2 L2: for her, a camera reference to nothing known is refused the same way (no existence oracle)
    ghost = [*g["doc"]["objects"], OBJ("o-ghost", pos=(0.2, 0.9), anchor_ref=_ref("camera", "no-such-camera"))]
    r = c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": dict(g["doc"], objects=ghost), "base_revision": g["geometry"]["revision"]}, headers=as_user("edna"))
    assert r.status_code == 422 and r.json()["code"] == "anchor_hidden" and r.json()["details"]["ids"] == ["o-ghost"]
    assert _stored(settings, vid, "draft") == before, "nothing was written"
    # a camera she may see binds as before
    ok = [*g["doc"]["objects"], OBJ("o-new", pos=(0.1, 0.9), anchor_ref=_ref("camera", lobby))]
    r = c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": dict(g["doc"], objects=ok), "base_revision": g["geometry"]["revision"]}, headers=as_user("edna"))
    assert r.status_code == 200, r.text
    assert _objects(r.json())["o-new"]["position"] == [0.3, 0.4], "bound to the lobby camera's anchor"
    # an unscoped writer's reference to nothing known is left alone (a warning, as before)
    g = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()
    ghost = [*g["doc"]["objects"], OBJ("o-ghost", pos=(0.2, 0.9), anchor_ref=_ref("camera", "no-such-camera"))]
    r = c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": dict(g["doc"], objects=ghost), "base_revision": g["geometry"]["revision"]})
    assert r.status_code == 200, r.text
    assert ("anchor_missing", "o-ghost") in {(i["code"], i["id"]) for i in r.json()["issues"]}


def test_a_package_that_binds_a_hidden_camera_imports_without_that_reference(settings, bound):
    c, ids, vid, lobby, vault = bound
    files = _package(c, vid, None, draft=True)  # the administrator's package names the vault camera
    preview, done = _preview_and_import(c, vid, files, "edna")
    assert "anchor_hidden" not in preview["warnings"], "the same item keeps the reference it has here"
    assert {o["id"]: o for o in _stored(settings, vid, "draft")["objects"]}["o-vault"]["anchor_ref"] == _ref("camera", vault)
    # a package that binds ANOTHER item to the vault camera: that reference is dropped, with the warning
    from test_plan_package import repack

    def add(d):
        d["objects"].append(OBJ("o-new", pos=(0.1, 0.9), anchor_ref=_ref("camera", vault)))

    tampered = repack(_zip(files), settings, doc=add)
    with zipfile.ZipFile(io.BytesIO(tampered)) as z:
        tampered_files = {n: z.read(n) for n in z.namelist()}
    preview, done = _preview_and_import(c, vid, tampered_files, "edna")
    assert "anchor_hidden" in preview["warnings"] and "anchor_hidden" in done["warnings"]
    objs = {o["id"]: o for o in _stored(settings, vid, "draft")["objects"]}
    assert objs["o-new"]["anchor_ref"] is None and objs["o-vault"]["anchor_ref"] == _ref("camera", vault)


def _zip(files: dict[str, bytes]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for n, b in files.items():
            z.writestr(n, b)
    return buf.getvalue()


# ---------------------------------------------------------------- the service rules (glass panels, openings, no-op)

def _visible(rtype: str, rid) -> bool:
    return rtype != "camera" or rid == "cam-ok"


def _doc() -> dict:
    return {"objects": [{"id": "o1", "anchor_ref": _ref("camera", "cam-hidden")}, {"id": "o2", "anchor_ref": _ref("camera", "cam-ok")}],
            "openings": [{"id": "d1", "anchor_ref": _ref("camera", "cam-hidden")}],
            "walls": [{"id": "g1", "glazing": {"operable": [{"panel": 0, "operation": "tilt", "anchor_ref": _ref("camera", "cam-hidden")},
                                                             {"panel": 1, "operation": "tilt", "anchor_ref": _ref("ha_entity", "binary_sensor.w")}]}}]}


def test_redact_covers_objects_openings_and_glass_panels_and_leaves_the_input_alone():
    doc = _doc()
    out, changed = scope.redact(doc, _visible)
    assert changed and "cam-hidden" not in json.dumps(out)
    assert out["objects"][1]["anchor_ref"] == _ref("camera", "cam-ok") and out["walls"][0]["glazing"]["operable"][1]["anchor_ref"] == _ref("ha_entity", "binary_sensor.w")
    assert doc == _doc(), "the stored document is never changed"
    same, changed = scope.redact(doc, None)
    assert same is doc and not changed
    clean, changed = scope.redact(out, _visible)
    assert clean is out and not changed


def test_carry_hidden_gives_back_what_the_writer_was_not_shown():
    stored = _doc()
    sent, _ = scope.redact(stored, _visible)
    sent["objects"][0]["label"] = "x"
    back, dropped = scope.carry_hidden(sent, stored, _visible, lambda ref: True, strict=True)
    assert dropped == [] and back["objects"][0] == {"id": "o1", "anchor_ref": _ref("camera", "cam-hidden"), "label": "x"}
    assert back["openings"] == stored["openings"] and back["walls"] == stored["walls"]
    # a new hidden reference: refused when strict, dropped otherwise - whether or not it names something known here
    # (security review 2.4.2 L2), and so is a new camera reference to nothing known
    sent["objects"].append({"id": "o3", "anchor_ref": _ref("camera", "cam-hidden")})
    with pytest.raises(scope.HiddenAnchor) as e:
        scope.carry_hidden(sent, stored, _visible, lambda ref: True, strict=True)
    assert e.value.items == ["o3"]
    back, dropped = scope.carry_hidden(sent, stored, _visible, lambda ref: True, strict=False)
    assert dropped == ["o3"] and back["objects"][2]["anchor_ref"] is None
    with pytest.raises(scope.HiddenAnchor):
        scope.carry_hidden(sent, stored, _visible, lambda ref: False, strict=True)
    unknown = dict(sent, objects=[*sent["objects"][:2], {"id": "o4", "anchor_ref": _ref("camera", "cam-ok")}])
    with pytest.raises(scope.HiddenAnchor) as e:
        scope.carry_hidden(unknown, stored, _visible, lambda ref: False, strict=True)
    assert e.value.items == ["o4"]
    assert scope.carry_hidden(unknown, stored, _visible, lambda ref: True, strict=True)[1] == []
    # an item the writer deleted stays deleted; a full-scope writer is not touched
    gone = dict(sent, objects=[sent["objects"][1]])
    assert [o["id"] for o in scope.carry_hidden(gone, stored, _visible, lambda ref: True, strict=True)[0]["objects"]] == ["o2"]
    assert scope.carry_hidden(sent, stored, None, lambda ref: True, strict=True) == (sent, [])
