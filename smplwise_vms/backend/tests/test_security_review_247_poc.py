"""Security review 2.4.7 (docs/security/SECURITY_REVIEW_247_2026-10-12.md): proofs of concept.

Each test asserts the CURRENT (unfixed) behaviour of a finding on origin/integ/247, so it passes while the finding is open
and fails on purpose once a fix lands (invert it into a regression test then, or drop it). Fakes and the in-process test
client only; no device, no Home Assistant, no network, no GPU (every bake file here is synthetic).

Findings:
  F1 (Medium) - a room mask served by GET /floors/{id}/bakes/{id}/file carries the ids and projected positions of cameras a
      map.read reader is DENIED by camera scope (the SEC244 geometry / skins redaction does not reach the bake files).
  F2 (Low)    - GET /floors/{id}/bakes hands a scoped reader the STORED geometry doc_hash and geometry_key, the 2.4.2 L1
      hash oracle that SEC244 closed on the geometry / skins endpoints (plan_bakes uses skins_store.geometry_key, not the
      served/redacted served_geometry_key).
  I-A (Info)  - a saved walk position keeps arbitrary extra keys and a name far past the contract's maxLength 40 (only the
      stripped length 1..40 is checked); bounded only by the 16 MiB geometry-document body limit.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent))
from conftest import as_user, bind  # noqa: E402
from test_plan_geometry_binding import OBJ  # noqa: E402
from test_security_review_220 import _deny_camera, _plan_world  # noqa: E402


def _ref(rtype: str, rid: str) -> dict:
    return {"resource_type": rtype, "resource_id": rid}


def _mask_with_cameras(cams: list[dict], w: int = 800, h: int = 500) -> bytes:
    doc = {"version": 1, "preset": "iso", "width": w, "height": h,
           "rooms": [{"id": "z1", "floor": [[10, 10], [200, 10], [200, 150]], "top": [[10, 5], [200, 5], [200, 140]], "centre": [120, 60]}],
           "doors": [], "cameras": cams}
    return json.dumps(doc).encode("utf-8")


def _floor_with_hidden_camera(settings):
    """A published floor with a lobby camera, a vault camera, and an object bound to the vault camera; `ron` is a floor
    viewer denied the vault camera (so the geometry read withholds the vault reference from him)."""
    c, ids, vid = _plan_world(settings)
    fid = ids["floor2"]
    lobby = c.post("/api/v1/cameras", json={"channel": 4, "alias": "לובי"}).json()
    vault = c.post("/api/v1/cameras", json={"channel": 5, "alias": "כספת"}).json()
    for cam, x in ((lobby, 0.3), (vault, 0.6)):
        assert c.post(f"/api/v1/floors/{fid}/anchors", json={"resource_type": "camera", "resource_id": cam["id"], "x": x, "y": 0.4}).status_code == 201
    g = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()
    objects = [OBJ("o-vault", item="light.ceiling", z_m=2.5, size={"w_m": 0.4, "d_m": 0.4, "h_m": 0.1}, anchor_ref=_ref("camera", vault["id"]))]
    assert c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": dict(g["doc"], objects=objects), "base_revision": g["geometry"]["revision"]}).status_code == 200
    assert c.post(f"/api/v1/plan-versions/{vid}/geometry/publish").status_code == 200
    bind(c, settings, "ron", "viewer", "floor", fid)
    _deny_camera(settings, "ron", vault["id"])
    return c, ids, vid, fid, lobby["id"], vault["id"]


def test_poc_f1_a_room_mask_leaks_a_denied_cameras_id_and_position_to_a_scoped_viewer(settings):
    """F1 (Medium): the editor's browser bakes a mask that lists every camera of the floor (buildMask), the add-on stores it
    verbatim, and GET /floors/{id}/bakes/{id}/file serves it to anyone holding map.read on the floor - with no camera-scope
    redaction. `ron` sees the floor (viewer) but is DENIED the vault camera; the geometry read and the exports withhold that
    camera from him (SEC244), yet the mask file hands him its id and projected position."""
    c, ids, vid, fid, lobby, vault = _floor_with_hidden_camera(settings)
    # the geometry read already withholds the vault camera from ron (the SEC244 behaviour this finding bypasses)
    assert vault not in c.get(f"/api/v1/plan-versions/{vid}/geometry", headers=as_user("ron")).text

    key = c.get(f"/api/v1/floors/{fid}/bakes").json()["bake_key"]
    mask = _mask_with_cameras([{"id": lobby, "p": [240, 200]}, {"id": vault, "p": [420, 210]}])
    up = c.post(f"/api/v1/floors/{fid}/bakes", data={"kind": "mask", "level_id": "L0", "preset": "iso", "style": "", "band": "", "variant": "",
                                                     "bake_key": key, "recipe": "mask-1", "meta": ""},
                files={"file": ("mask.json", mask, "application/octet-stream")})
    assert up.status_code == 201, up.text
    bake_id = up.json()["id"]

    # ron (map.read on the floor, vault camera denied) lists and fetches the mask file
    listed = c.get(f"/api/v1/floors/{fid}/bakes", headers=as_user("ron"))
    assert listed.status_code == 200, listed.text
    served = c.get(f"/api/v1/floors/{fid}/bakes/{bake_id}/file", headers=as_user("ron"))
    assert served.status_code == 200, served.text
    body = served.json()
    ids_in_mask = {cam["id"] for cam in body["cameras"]}
    assert vault in ids_in_mask, "FINDING F1: the denied vault camera's id is served to a scoped reader in the mask"
    vault_cam = next(cam for cam in body["cameras"] if cam["id"] == vault)
    assert vault_cam["p"] == [420, 210], "FINDING F1: and its projected position, which the geometry read withholds"


def test_poc_f2_the_bakes_endpoint_hands_a_scoped_reader_the_stored_doc_hash_oracle(settings):
    """F2 (Low): plan_bakes.describe / bake_key build geometry_key and doc_hash from skins_store.geometry_key (the STORED
    document), not the SEC244 served_geometry_key. So GET /floors/{id}/bakes hands `ron` - from whom a camera reference is
    withheld - the stored doc_hash, while GET /geometry hands him a different (redacted) one: the 2.4.2 L1 hash oracle,
    reopened on this new route."""
    c, ids, vid, fid, lobby, vault = _floor_with_hidden_camera(settings)
    admin_hash = c.get(f"/api/v1/plan-versions/{vid}/geometry").json()["geometry"]["doc_hash"]  # the stored hash
    ron_geom_hash = c.get(f"/api/v1/plan-versions/{vid}/geometry", headers=as_user("ron")).json()["geometry"]["doc_hash"]
    assert ron_geom_hash != admin_hash, "precondition: SEC244 redacts the hash on the geometry read for ron"

    bakes = c.get(f"/api/v1/floors/{fid}/bakes", headers=as_user("ron"))
    assert bakes.status_code == 200, bakes.text
    assert bakes.json()["doc_hash"] == admin_hash, "FINDING F2: the bakes endpoint leaks the STORED doc_hash to a scoped reader"
    assert bakes.json()["doc_hash"] != ron_geom_hash, "FINDING F2: which differs from the redacted hash the geometry read gives him"


def test_poc_ia_a_walk_position_keeps_extra_keys_and_an_unbounded_name(settings):
    """I-A (Info): check_doc_fields / check validate the structural types of a walk position and the STRIPPED length of its
    name (1..40), but reject neither extra object keys nor a very long untrimmed name - the contract's maxLength 40 and
    additionalProperties are not enforced on the server. The only bound is the 16 MiB geometry-document body limit. Presentation
    data (per floor, map.edit), so no escalation; worth a line so the schema and the server agree."""
    from smplwise.services import plan_geometry as pg

    base = json.load(open(Path(__file__).resolve().parents[3] / "contracts" / "fixtures" / "plan_geometry" / "sample-v22.json", encoding="utf-8"))
    level_id = base["levels"][0]["id"]
    pos = {"id": "p1", "name": "lobby" + " " * 5000, "x": 0.5, "y": 0.5, "level_id": level_id, "heading_deg": 10.0,
           "payload": {"blob": "x" * 5000}}
    doc = dict(base, walk_positions=[pos])
    errors = [i for i in pg.validate(doc) if i.get("severity", "error") == "error"]
    assert errors == [], "FINDING I-A: a padded name (stripped len 1..40) and an arbitrary extra key both pass validation"
    assert len(json.dumps(doc)) > 10000, "the saved position is far larger than the schema's maxLength 40 name implies"
