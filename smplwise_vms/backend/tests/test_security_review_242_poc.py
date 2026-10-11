"""Security review 2.4.2 (docs/security/SECURITY_REVIEW_242_2026-10-08.md): regression tests for the findings fixed in SEC243
and SEC244 (L1 for openings / glass panels and every handed hash, L3).

These started as proofs of concept that asserted the UNFIXED behaviour (SEC242); each one now asserts the fix. Fakes and the
in-process test client only; no device, no Frigate, no Home Assistant, no network."""
from __future__ import annotations

import copy
import json
import sys
import time
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from conftest import as_user  # noqa: E402
from test_plan_anchor_scope_plns import bound  # noqa: E402,F401  (fixture)
from test_plan_geometry_binding import OBJ  # noqa: E402

from smplwise import db as dbmod  # noqa: E402
from smplwise.services import geometry_store as store  # noqa: E402
from smplwise.services import ha_user_auth as hua  # noqa: E402
from smplwise.services import plan_anchor_scope as anchor_scope  # noqa: E402
from smplwise.services import plan_geometry as pg  # noqa: E402
from smplwise.services import wall_path  # noqa: E402
from smplwise.services.recorders import frigate_config as fcfg  # noqa: E402


def _objects(body: dict) -> dict[str, dict]:
    return {o["id"]: o for o in body["doc"]["objects"]}


# ---------------------------------------------------------------------------------------------- M1: curved-wall amplification

def _zigzag_wall(n: int, wid: str = "w-amp", y0: float = 0.4) -> dict:
    pts = [[0.4 + 0.0001 * (i % 2), y0 + 0.2 * i / n] for i in range(n + 1)]
    return {"id": wid, "level_id": "L0", "polyline": pts, "bulges": [wall_path.MAX_BULGE] * n, "thickness_m": 0.2, "height_m": None, "base_z_m": 0,
            "kind": "interior", "confidence": 1, "source": "manual", "locked": False, "external_ids": {}}


def test_m1_the_budget_counts_without_sampling_and_refuses_before_any_sampling(monkeypatch):
    # the arithmetic count is exactly what sampling produces
    small = _zigzag_wall(40)
    assert wall_path.sample_count(small, 4000, 3000) == (40, len(wall_path.sampled_wall(small, 4000, 3000)))
    calls = {"n": 0}
    monkeypatch.setattr(wall_path, "sample_with_s", lambda *a, **k: calls.__setitem__("n", calls["n"] + 1) or ([], []))
    t = time.perf_counter()
    # one wall past the corner cap
    with pytest.raises(wall_path.CurveLimit) as e:
        wall_path.check_walls([_zigzag_wall(3000)], 4000, 3000)
    assert e.value.code == "curve_corners" and e.value.wall_id == "w-amp"
    # many walls each under the corner cap: the document's arc segments
    with pytest.raises(wall_path.CurveLimit) as e:
        wall_path.check_walls([{**_zigzag_wall(500, f"w{i}"), "bulges": [0.01] * 500} for i in range(11)], 4000, 3000)
    assert e.value.code == "curve_segments"
    # few segments, but each one sampled to 128 points on a huge plan: the point budget
    big = [{"id": f"c{i}", "polyline": [[0.1, 0.1 + i * 1e-4], [0.9, 0.1 + i * 1e-4]], "bulges": [1.0]} for i in range(1600)]
    with pytest.raises(wall_path.CurveLimit) as e:
        wall_path.check_walls(big, 100000, 100000)
    assert e.value.code == "curve_points"
    assert calls["n"] == 0, "nothing was sampled"
    assert time.perf_counter() - t < 2.0
    # a realistic round room passes
    wall_path.check_walls([{"id": "r", "polyline": [[0.3, 0.5], [0.7, 0.5], [0.3, 0.5]], "bulges": [1.0, 1.0]}], 4000, 3000)


def test_m1_validate_refuses_an_amplified_wall_as_structural(settings, bound):
    c, ids, vid, _lobby, _vault = bound
    doc = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()["doc"]
    issues = pg.validate(dict(doc, walls=[*doc["walls"], _zigzag_wall(3000)]))
    assert [(i["code"], i["structural"], i["id"]) for i in issues] == [("curve_corners", True, "w-amp")]
    assert issues[0]["message"] == wall_path.CURVE_LIMIT_MESSAGES["curve_corners"]


def test_m1_the_editor_route_refuses_an_amplified_wall_with_a_clean_422_and_samples_nothing(settings, bound):
    c, ids, vid, _lobby, _vault = bound
    g = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()
    calls = {"n": 0, "samples": 0}
    real = wall_path.sampled_wall

    def counting(wall, w, h, tol=wall_path.TOL_PX):
        out = real(wall, w, h, tol)
        calls["n"] += 1
        calls["samples"] += len(out)
        return out

    wall_path.sampled_wall = counting
    try:
        r = c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": dict(g["doc"], walls=[*g["doc"]["walls"], _zigzag_wall(3000)]),
                                                                  "base_revision": g["geometry"]["revision"]}, headers=as_user("edna"))
    finally:
        wall_path.sampled_wall = real
    assert r.status_code == 422, r.text
    body = r.json()
    assert body["code"] == "geometry_structure"
    assert [(i["code"], i["id"]) for i in body["details"]["issues"]] == [("curve_corners", "w-amp")]
    assert calls["samples"] == 0, "the amplified wall was never sampled"
    # the same document through candidate acceptance: refused the same way
    cand = dict(_zigzag_wall(3000, "imp-w1"), source="imported")
    r = c.post(f"/api/v1/plan-versions/{vid}/detect/accept", json={"accepted": ["imp-w1"], "candidates": {"walls": [cand]}, "base_revision": g["geometry"]["revision"]},
               headers=as_user("edna"))
    assert r.status_code == 422 and r.json()["code"] == "geometry_structure", r.text
    assert {i["code"] for i in r.json()["details"]["issues"]} == {"curve_corners"}
    # a modest curved wall still saves
    ok = {**_zigzag_wall(20, "w-ok"), "bulges": [0.2] * 20}
    r = c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": dict(g["doc"], walls=[*g["doc"]["walls"], ok]), "base_revision": g["geometry"]["revision"]},
              headers=as_user("edna"))
    assert r.status_code == 200, r.text


# ---------------------------------------------------------------------------------------------- M2: the hidden camera's position

def test_m2_a_body_bound_to_a_hidden_camera_no_longer_shows_the_cameras_position_and_heading(settings, bound):
    c, ids, vid, lobby, vault = bound
    ron = c.get(f"/api/v1/plan-versions/{vid}/geometry", headers=as_user("ron"))
    assert ron.status_code == 200 and vault not in ron.text
    anchors = c.get(f"/api/v1/floors/{ids['floor2']}/anchors", headers=as_user("ron")).json()["anchors"]
    assert not any(a["resource_id"] == vault for a in anchors)
    body = _objects(ron.json())["o-vault"]
    assert body["position"] != [0.6, 0.4] and body["position"] == list(anchor_scope.WITHHELD_POSITION) and body["rotation_deg"] == 0
    # the visible camera's body still follows its camera; the administrator still sees the real pose
    assert _objects(ron.json())["o-lobby"]["position"] == [0.3, 0.4]
    assert _objects(c.get(f"/api/v1/plan-versions/{vid}/geometry").json())["o-vault"]["position"] == [0.6, 0.4]


def test_m2_the_stored_doc_hash_no_longer_confirms_a_guessed_hidden_camera(settings, bound):
    c, ids, vid, lobby, vault = bound
    ron = c.get(f"/api/v1/plan-versions/{vid}/geometry", headers=as_user("ron")).json()
    stored_hash = _stored_hash(settings, vid)
    assert ron["geometry"]["doc_hash"] != stored_hash, "L1 (SEC244): the stored hash is not handed to ron at all"
    served = copy.deepcopy(ron["doc"])
    for k in [k for k in served if k not in _stored_keys(settings, vid)]:
        served.pop(k)
    for o in served["objects"]:
        if o["id"] == "o-vault":
            o["anchor_ref"] = {"resource_type": "camera", "resource_id": vault}
    assert store.doc_hash(served) != stored_hash, "the withheld pose is part of the stored hash: a right guess of the id is not confirmed"


def _stored_keys(settings, vid: str) -> set[str]:
    from smplwise.db import Database

    with Database(settings.db_path).connection(mode="read") as conn:
        return set(store.load_doc(store.published_row(conn, vid)))


def _stored_row(settings, vid: str, status: str = "published") -> tuple[str, dict]:
    from smplwise.db import Database

    with Database(settings.db_path).connection(mode="read") as conn:
        row = store.published_row(conn, vid) if status == "published" else store.draft_row(conn, vid)
        return row["doc_hash"], store.load_doc(row)


def _stored_hash(settings, vid: str, status: str = "published") -> str:
    return _stored_row(settings, vid, status)[0]


def test_m2_a_scoped_editor_saves_the_withheld_body_and_its_stored_pose_stays(settings, bound):
    c, ids, vid, lobby, vault = bound
    g = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true", headers=as_user("edna")).json()
    assert _objects(g)["o-vault"]["position"] == list(anchor_scope.WITHHELD_POSITION)
    r = c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": g["doc"], "base_revision": g["geometry"]["revision"]}, headers=as_user("edna"))
    assert r.status_code == 200, r.text
    from smplwise.db import Database

    with Database(settings.db_path).connection(mode="read") as conn:
        stored = {o["id"]: o for o in store.load_doc(store.draft_row(conn, vid))["objects"]}
    assert stored["o-vault"]["position"] == [0.6, 0.4] and stored["o-vault"]["anchor_ref"] == {"resource_type": "camera", "resource_id": vault}


def test_l2_anchor_hidden_answers_the_same_for_a_registered_camera_and_an_unknown_id(settings, bound):
    c, ids, vid, lobby, vault = bound
    g = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true", headers=as_user("edna")).json()

    def put(rid: str):
        extra = OBJ("o-probe", pos=(0.1, 0.9), anchor_ref={"resource_type": "camera", "resource_id": rid})
        return c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": dict(g["doc"], objects=[*g["doc"]["objects"], extra]),
                                                                      "base_revision": g["geometry"]["revision"]}, headers=as_user("edna"))

    hidden, unknown = put(vault), put("feedfacefeedface")
    assert hidden.status_code == unknown.status_code == 422
    assert hidden.json()["code"] == unknown.json()["code"] == "anchor_hidden"
    assert hidden.json()["details"] == unknown.json()["details"] == {"ids": ["o-probe"]}


# ---------------------------------------------------------------------------------------------- L1 (SEC244): openings and glass panels

def _door(oid: str, wall: str, anchor_ref=None) -> dict:
    return {"id": oid, "wall_id": wall, "t": 0.5, "kind": "door", "width_m": 0.9, "height_m": 2.1, "sill_m": 0, "swing": "right", "hinge": "start",
            "anchor_ref": anchor_ref, "confidence": 1, "source": "manual", "external_ids": {}}


@pytest.fixture()
def wall_bound(settings, bound):
    """The `bound` world with the vault camera bound ONLY to an opening and a glass panel (the case SEC243 left open): the
    body bound to it is removed, so nothing of the served document moves - only the references are withheld."""
    c, ids, vid, lobby, vault = bound
    g = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()
    ref = {"resource_type": "camera", "resource_id": vault}
    walls = [dict(w, glazing={"operable": [{"panel": 0, "operation": "tilt", "anchor_ref": ref}]}) if w["id"] == "w1" else w for w in g["doc"]["walls"]]
    doc = dict(g["doc"], walls=walls, openings=[_door("d-vault", "w1", ref)], objects=[o for o in g["doc"]["objects"] if o["id"] != "o-vault"])
    r = c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": doc, "base_revision": g["geometry"]["revision"]})
    assert r.status_code == 200, r.text
    assert c.post(f"/api/v1/plan-versions/{vid}/geometry/publish").status_code == 200
    return c, ids, vid, lobby, vault


def _ron_visible(vault: str):
    return lambda t, rid: not (t == "camera" and rid == vault)


def test_l1_a_withheld_reference_on_an_opening_or_a_glass_panel_is_never_confirmed_by_a_handed_hash(settings, wall_bound):
    c, ids, vid, lobby, vault = wall_bound
    stored_hash, stored = _stored_row(settings, vid)
    assert {o["id"]: o["anchor_ref"] for o in stored["openings"]}["d-vault"]["resource_id"] == vault, "stored unchanged"
    expected = store.doc_hash(anchor_scope.redact(stored, _ron_visible(vault))[0])
    assert expected != stored_hash
    ron = c.get(f"/api/v1/plan-versions/{vid}/geometry", headers=as_user("ron"))
    body = ron.json()
    assert ron.status_code == 200 and vault not in ron.text
    assert {o["id"]: o for o in body["doc"]["openings"]}["d-vault"]["anchor_ref"] is None
    assert {w["id"]: w for w in body["doc"]["walls"]}["w1"]["glazing"]["operable"][0]["anchor_ref"] is None
    # the opening keeps its own place on its wall (nothing is copied onto it from the anchor)
    assert {o["id"]: o for o in body["doc"]["openings"]}["d-vault"]["t"] == 0.5
    # the hashes ron is handed are those of what he is served
    assert body["geometry"]["doc_hash"] == expected and body["published_hash"] == expected
    # the oracle was: put a guessed id back into the withheld places and compare with the stored hash. Only the references
    # differ between stored and served here (no pose is withheld), so no answer to a scoped reader may carry the stored hash.
    answers = {
        "geometry": ron.text + ron.headers["etag"],
        "at": c.get(f"/api/v1/plan-versions/{vid}/geometry", params={"at": body["geometry"]["published_at"]}, headers=as_user("ron")).text,
        "timeline": c.get(f"/api/v1/plan-versions/{vid}/geometry/timeline", headers=as_user("ron")).text,
        "bundle": c.get(f"/api/v1/floors/{ids['floor2']}/map", headers=as_user("ron")).text,
        "draft": c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true", headers=as_user("edna")).text,
        "versions": c.get(f"/api/v1/plan-versions/{vid}/geometry/versions", headers=as_user("edna")).text,
        "skins": c.get(f"/api/v1/floors/{ids['floor2']}/skins", headers=as_user("edna")).text,
    }
    for name, text in answers.items():
        assert stored_hash not in text, name
        assert vault not in text, name
    # the timeline, the bundle and the `?at=` read agree, so the map's cache by hash still works
    tl = c.get(f"/api/v1/plan-versions/{vid}/geometry/timeline", headers=as_user("ron")).json()["timeline"]
    assert {p["id"]: p["doc_hash"] for p in tl}[body["geometry"]["id"]] == expected
    assert c.get(f"/api/v1/floors/{ids['floor2']}/map", headers=as_user("ron")).json()["geometry"]["doc_hash"] == expected
    # the administrator still gets the stored hash everywhere
    admin = c.get(f"/api/v1/plan-versions/{vid}/geometry").json()
    assert admin["geometry"]["doc_hash"] == stored_hash
    assert {p["id"]: p["doc_hash"] for p in c.get(f"/api/v1/plan-versions/{vid}/geometry/timeline").json()["timeline"]}[admin["geometry"]["id"]] == stored_hash
    assert c.get(f"/api/v1/floors/{ids['floor2']}/map").json()["geometry"]["doc_hash"] == stored_hash


def test_l1_the_package_preview_and_import_hand_the_redacted_hashes(settings, wall_bound):
    from test_plan_anchor_scope_plns import _package, _preview_and_import

    c, ids, vid, lobby, vault = wall_bound
    files = _package(c, vid, "edna", draft=True)  # her own package (the `origin` block repeats the package's own hashes)
    preview, done = _preview_and_import(c, vid, files, "edna")
    stored_hash, stored = _stored_row(settings, vid, "draft")
    for answer in (preview, done):
        text = json.dumps({k: v for k, v in answer.items() if k != "origin"})
        assert stored_hash not in text and vault not in text
    assert done["result_hash"] == preview["result_hash"] == store.doc_hash(anchor_scope.redact(stored, _ron_visible(vault))[0])
    assert {o["id"]: o for o in stored["openings"]}["d-vault"]["anchor_ref"]["resource_id"] == vault, "the hidden reference stayed"


# ---------------------------------------------------------------------------------------------- L3 (SEC244): what a scoped editor was not shown

def test_l3_a_scoped_editor_cannot_overwrite_a_reference_she_was_not_shown(settings, bound):
    c, ids, vid, lobby, vault = bound
    g = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true", headers=as_user("edna")).json()
    lobby_ref = {"resource_type": "camera", "resource_id": lobby}
    objects = [dict(o, anchor_ref=lobby_ref) if o["id"] == "o-vault" else o for o in g["doc"]["objects"]]
    r = c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": dict(g["doc"], objects=objects), "base_revision": g["geometry"]["revision"]},
              headers=as_user("edna"))
    assert r.status_code == 200, r.text
    _h, stored = _stored_row(settings, vid, "draft")
    o = {x["id"]: x for x in stored["objects"]}["o-vault"]
    assert o["anchor_ref"] == {"resource_type": "camera", "resource_id": vault} and o["position"] == [0.6, 0.4], "the stored binding and pose stay"
    # an unknown camera id on the same item answers exactly like on an unbound item (L2 is not reopened)
    g = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true", headers=as_user("edna")).json()
    ghost = {"resource_type": "camera", "resource_id": "feedfacefeedface"}
    r = c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": dict(g["doc"], objects=[dict(x, anchor_ref=ghost) if x["id"] == "o-vault" else x for x in g["doc"]["objects"]]),
                                                              "base_revision": g["geometry"]["revision"]}, headers=as_user("edna"))
    assert r.status_code == 422 and r.json()["code"] == "anchor_hidden" and r.json()["details"] == {"ids": ["o-vault"]}


def test_l3_removing_an_item_bound_to_a_hidden_anchor_warns_and_is_audited(settings, bound):
    c, ids, vid, lobby, vault = bound
    g = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true", headers=as_user("edna")).json()
    r = c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": dict(g["doc"], objects=[o for o in g["doc"]["objects"] if o["id"] != "o-vault"]),
                                                              "base_revision": g["geometry"]["revision"]}, headers=as_user("edna"))
    assert r.status_code == 200, r.text
    assert ("anchor_hidden_removed", "o-vault", "objects") in {(i["code"], i["id"], i["path"]) for i in r.json()["issues"]}
    assert vault not in r.text
    from smplwise.db import Database

    with Database(settings.db_path).connection(mode="read") as conn:
        rows = conn.execute("SELECT details_json FROM audit_log WHERE action = 'geometry.anchor_hidden_removed'").fetchall()
    assert rows and "objects:o-vault" in rows[-1][0]
    # removing an item bound to a camera she sees: no such warning
    g = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true", headers=as_user("edna")).json()
    r = c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": dict(g["doc"], objects=[o for o in g["doc"]["objects"] if o["id"] != "o-lobby"]),
                                                              "base_revision": g["geometry"]["revision"]}, headers=as_user("edna"))
    assert r.status_code == 200 and "anchor_hidden_removed" not in r.text


def test_l3_an_administrator_importing_a_scoped_editors_package_keeps_the_withheld_bindings(settings, wall_bound):
    from test_plan_anchor_scope_plns import _package, _preview_and_import

    c, ids, vid, lobby, vault = wall_bound
    # put the vault body back so an object, an opening and a glass panel are all bound to the hidden camera
    g = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()
    body = OBJ("o-vault2", item="light.ceiling", z_m=2.5, size={"w_m": 0.4, "d_m": 0.4, "h_m": 0.1}, anchor_ref={"resource_type": "camera", "resource_id": vault})
    assert c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": dict(g["doc"], objects=[*g["doc"]["objects"], body]),
                                                                 "base_revision": g["geometry"]["revision"]}).status_code == 200
    files = _package(c, vid, "edna", draft=True)
    manifest = json.loads(files["manifest.json"])
    assert manifest["document"]["redacted"] is True
    assert {(e["collection"], e["id"], e.get("panel")) for e in manifest["document"]["withheld"]} == {("objects", "o-vault2", None), ("openings", "d-vault", None), ("walls", "w1", 0)}
    assert vault.encode() not in files["manifest.json"] and vault.encode() not in files["plan.json"]
    preview, done = _admin_preview_and_import(c, vid, files)  # the administrator (unscoped) imports it
    assert "package_redacted" in preview["warnings"] and preview["withheld_restored"] == 3
    _h, stored = _stored_row(settings, vid, "draft")
    ref = {"resource_type": "camera", "resource_id": vault}
    assert {o["id"]: o for o in stored["objects"]}["o-vault2"]["anchor_ref"] == ref
    assert {o["id"]: o for o in stored["objects"]}["o-vault2"]["position"] == [0.6, 0.4], "on its anchor, not at the withheld centre"
    assert {o["id"]: o for o in stored["openings"]}["d-vault"]["anchor_ref"] == ref
    assert {w["id"]: w for w in stored["walls"]}["w1"]["glazing"]["operable"][0]["anchor_ref"] == ref
    # the administrator's own package is not marked
    assert "redacted" not in json.loads(_package(c, vid, None, draft=True)["manifest.json"])["document"]


def _admin_preview_and_import(c, vid: str, files: dict[str, bytes], mode: str = "replace"):
    import io
    import zipfile

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for n, b in files.items():
            z.writestr(n, b)
    data = buf.getvalue()
    p = c.post(f"/api/v1/plan-versions/{vid}/package/preview?mode={mode}", files={"file": ("p.swplan.zip", data, "application/zip")})
    assert p.status_code == 200, p.text
    q = f"mode={mode}&base_revision={p.json()['base_revision']}&expect_hash={p.json()['result_hash']}"
    r = c.post(f"/api/v1/plan-versions/{vid}/package/import?{q}", files={"file": ("p.swplan.zip", data, "application/zip")})
    assert r.status_code == 200, r.text
    return p.json(), r.json()


def test_l3_service_rules():
    hidden = {"resource_type": "camera", "resource_id": "cam-hidden"}
    ok = {"resource_type": "camera", "resource_id": "cam-ok"}
    vis = lambda t, rid: t != "camera" or rid == "cam-ok"  # noqa: E731
    stored = {"objects": [{"id": "o1", "anchor_ref": hidden, "position": [0.6, 0.4], "rotation_deg": 30}],
              "openings": [{"id": "d1", "anchor_ref": hidden}],
              "walls": [{"id": "w1", "glazing": {"operable": [{"panel": 2, "operation": "tilt", "anchor_ref": hidden}]}}]}
    sent, _ = anchor_scope.redact(stored, vis)
    sent["objects"][0]["anchor_ref"] = ok
    sent["openings"][0]["anchor_ref"] = ok
    sent["walls"][0]["glazing"]["operable"][0]["anchor_ref"] = ok
    back, dropped = anchor_scope.carry_hidden(sent, stored, vis, lambda ref: True, strict=True)
    assert dropped == [] and back == stored, "whatever she sends, the hidden references (and the body's pose) stay"
    # a removed panel / opening / object is reported (and not brought back)
    gone = dict(sent, openings=[], objects=[], walls=[{"id": "w1", "glazing": None}])
    assert anchor_scope.removed_hidden(gone, stored, vis) == ["objects:o1", "openings:d1", "walls:w1"]
    assert anchor_scope.removed_hidden(back, stored, vis) == [] and anchor_scope.removed_hidden(gone, stored, None) == []
    # the served hash: stored when nothing is withheld, the redacted document's hash otherwise
    h = store.doc_hash(stored)
    assert anchor_scope.served_hash(h, lambda: stored, None) == h
    assert anchor_scope.served_hash(h, lambda: stored, lambda t, rid: True) == h
    assert anchor_scope.served_hash(h, lambda: stored, vis) == store.doc_hash(anchor_scope.redact(stored, vis)[0]) != h
    # cached: a second call does not load the document
    assert anchor_scope.served_hash(h, lambda: (_ for _ in ()).throw(AssertionError("loaded")), vis) != h


# ---------------------------------------------------------------------------------------------- L4: rate-limiter keys

def test_l4_a_single_request_from_a_fresh_address_is_not_persisted_and_live_keys_are_capped(tmp_path):
    d = dbmod.Database(tmp_path / "t.db")
    d.migrate()
    lim = hua.RateLimiter(clock=lambda: 1_000_000.0)
    n = 5000
    for i in range(n):  # one request each from n addresses
        assert lim.hit(f"ip:2001:db8::{i:x}", hua.IP_LIMITS)
    with d.connection() as conn:
        assert lim.flush(conn) == 0
    with d.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM block_counters WHERE scope = 'signin'").fetchone()[0] == 0
    # a key that comes near its limit is persisted
    for _ in range(5):
        assert lim.hit("ip:192.0.2.7", hua.IP_LIMITS)
    with d.connection() as conn:
        assert lim.flush(conn) == 1
    # the live keys are capped: cold keys go first, the hot one stays
    small = hua.RateLimiter(clock=lambda: 1_000_000.0)
    small.MAX_KEYS, small.LOW_WATER = 1000, 900
    for _ in range(5):
        small.hit("ip:hot", hua.IP_LIMITS)
    for i in range(3000):
        small.hit(f"ip:cold{i}", hua.IP_LIMITS)
    assert len(small._hits) <= 1000 and "ip:hot" in small._hits  # noqa: SLF001
    assert small.hit("ip:hot", [(60.0, 5)]) is False, "the hot key kept its count"


def test_l4_ipv6_addresses_share_one_bucket_per_64():
    assert hua.limit_ip("2001:db8:1:2::1") == hua.limit_ip("2001:db8:1:2:ffff:ffff:ffff:ffff") == "2001:db8:1:2::/64"
    assert hua.limit_ip("2001:db8:1:3::1") != hua.limit_ip("2001:db8:1:2::1")
    assert hua.limit_ip("192.0.2.4") == "192.0.2.4" and hua.limit_ip("::ffff:192.0.2.4") == "192.0.2.4"
    assert hua.limit_ip("") == "" and hua.limit_ip("not-an-address") == "not-an-address"


def test_l4_a_failed_flush_keeps_its_batch():
    import sqlite3

    lim = hua.RateLimiter(clock=lambda: 1_000_000.0)
    for _ in range(5):
        lim.hit("ip:192.0.2.9", hua.IP_LIMITS)
    conn = sqlite3.connect(":memory:")  # no block_counters table: the write fails
    assert lim.flush(conn) == 0
    assert "ip:192.0.2.9" in lim._dirty  # noqa: SLF001


# ---------------------------------------------------------------------------------------------- L5: the instance-schema walk

class _Http:
    def __init__(self, doc):
        self.doc = doc

    def get_json(self, *a, **kw):
        return self.doc


class _Adapter:
    def __init__(self, doc):
        self.http = _Http(doc)


def test_l5_a_self_referencing_instance_schema_is_walked_once():
    doc = {"properties": {"cameras": {"additionalProperties": {"$ref": "#/$defs/C"}}},
           "$defs": {"C": {"anyOf": [{"$ref": "#/$defs/C"}]}}}
    out = fcfg.FrigateConfig(_Adapter(doc)).frigate_schema_check()
    assert out["checked"] is True and "detect.fps" in out["missing"]


def test_l5_an_exponential_instance_schema_is_linear_and_a_huge_one_is_not_concluded():
    depth = 60
    defs = {f"D{i}": {"anyOf": [{"$ref": f"#/$defs/D{i + 1}"}, {"$ref": f"#/$defs/D{i + 1}"}]} for i in range(depth)}
    defs[f"D{depth}"] = {"type": "object"}
    doc = {"properties": {"cameras": {"additionalProperties": {"$ref": "#/$defs/D0"}}}, "$defs": defs}
    t = time.perf_counter()
    out = fcfg.FrigateConfig(_Adapter(doc)).frigate_schema_check()
    assert out["checked"] is True and time.perf_counter() - t < 2.0
    wide = {"properties": {"cameras": {"anyOf": [{"type": "object"} for _ in range(fcfg.SCHEMA_WALK_MAX + 10)]}}}
    assert fcfg.FrigateConfig(_Adapter(wide)).frigate_schema_check() == {"checked": False, "missing": []}


# ---------------------------------------------------------------------------------------------- L6: zone delete + undo

from test_frigate_control import BASE, World, _clean, world  # noqa: E402,F401  (fixtures)


def test_l6_zone_delete_then_undo_keeps_the_fields_arx_does_not_model(world):
    world.policy(config=True)
    cam = world.cams()["cam_front"]
    world.fake.cameras["cam_front"]["zones"]["porch"] = {"coordinates": "0.1,0.1,0.5,0.1,0.5,0.5", "inertia": 5,
                                                         "filters": {"person": {"min_area": 5000}}, "speed_threshold": 2.5}
    gone = world.call("POST", f"{BASE}/cameras/{cam}/config/zones/porch/delete", json={"confirm": True, "supervised": True})
    assert gone.status_code == 200 and gone.json()["verified"] is True
    assert "porch" not in world.fake.cameras["cam_front"]["zones"]
    undo = world.call("POST", f"{BASE}/changes/{world.changes()[0]['id']}/revert", json={"confirm": True})
    assert undo.status_code == 200 and undo.json()["verified"] is True
    back = world.fake.cameras["cam_front"]["zones"]["porch"]
    assert back["filters"] == {"person": {"min_area": 5000}} and back["speed_threshold"] == 2.5 and back["inertia"] == 5


def test_l6_a_zone_whose_extra_fields_cannot_be_put_back_is_not_deleted(world):
    world.policy(config=True)
    cam = world.cams()["cam_front"]
    world.fake.cameras["cam_front"]["zones"]["porch"] = {"coordinates": "0.1,0.1,0.5,0.1,0.5,0.5", "filters": {"person.x": {"min_area": 1}}}
    r = world.call("POST", f"{BASE}/cameras/{cam}/config/zones/porch/delete", json={"confirm": True, "supervised": True})
    assert r.status_code == 409 and r.json()["code"] == "frigate_zone_not_reversible"
    assert "porch" in world.fake.cameras["cam_front"]["zones"], "nothing was written"
