"""Security review 2.4.7 (docs/security/SECURITY_REVIEW_247_2026-10-12.md): regression tests of the fixes (task SEC247-fixes).

The three proofs of concept of the review asserted the OPEN behaviour; they are inverted here into regression tests of the
fixed behaviour, with tests for every new rule. Fakes and the in-process test client only; no device, no Home Assistant, no
network, no GPU (every bake file here is synthetic).

  F1 / M1 (Medium) - a room mask served by GET /floors/{id}/bakes/{id}/file, listed by GET /floors/{id}/bakes and by the floor
      map bundle goes through the reader's camera scope: a camera entry they may not see (by its anchor id or its camera id,
      or an id that resolves to nothing) is left out, and the sha256 / size / ETag / `?v=` they are handed are those of their
      copy. The stored file is untouched (the editor's bake / upload flow, and masks stored before the fix, are re-derived on
      every read).
  F2 / L1 (Low)    - GET /floors/{id}/bakes, the bundle's bakes part and the upload / job answers hand a scoped reader the
      SERVED bake key, geometry key and doc_hash (SEC244's served_geometry_key), never the stored ones; an upload is checked
      against the key the editor was handed and stored under the real key.
  I-A / I1 + I4    - a saved walk position: no key outside the contract, the name bounded as written, the id in the plain-id
      charset (refused at save); an unknown material id outside that charset is dropped on save. Documents 2.0 / 2.1 are
      untouched.
  I2               - a bake upload evicts the uploading floor's stale rows first; another floor's only as the last resort.
"""
from __future__ import annotations

import copy
import hashlib
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
from conftest import as_user, bind  # noqa: E402
from test_plan_geometry_binding import OBJ  # noqa: E402
from test_security_review_220 import _deny_camera, _plan_world  # noqa: E402

FIX = Path(__file__).resolve().parents[3] / "contracts" / "fixtures" / "plan_geometry"


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
    anchors = {}
    for cam, x in ((lobby, 0.3), (vault, 0.6)):
        r = c.post(f"/api/v1/floors/{fid}/anchors", json={"resource_type": "camera", "resource_id": cam["id"], "x": x, "y": 0.4})
        assert r.status_code == 201, r.text
        anchors[cam["id"]] = r.json()["id"]
    g = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()
    objects = [OBJ("o-vault", item="light.ceiling", z_m=2.5, size={"w_m": 0.4, "d_m": 0.4, "h_m": 0.1}, anchor_ref=_ref("camera", vault["id"]))]
    assert c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": dict(g["doc"], objects=objects), "base_revision": g["geometry"]["revision"]}).status_code == 200
    assert c.post(f"/api/v1/plan-versions/{vid}/geometry/publish").status_code == 200
    bind(c, settings, "ron", "viewer", "floor", fid)
    _deny_camera(settings, "ron", vault["id"])
    return c, ids, vid, fid, lobby["id"], vault["id"], anchors


def _upload(c, fid: str, key: str, data: bytes, kind: str = "mask", headers=None, **slot):
    form = {"kind": kind, "level_id": "L0", "preset": "iso", "style": "", "band": "", "variant": "", "bake_key": key,
            "recipe": "mask-1" if kind == "mask" else "still-q2.1", "meta": ""}
    form.update(slot)
    return c.post(f"/api/v1/floors/{fid}/bakes", data=form, files={"file": ("f.bin", data, "application/octet-stream")}, headers=headers)


def _webp(color=(200, 210, 220)) -> bytes:
    import io

    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (800, 500), color).save(buf, format="WEBP")
    return buf.getvalue()


# ---------------------------------------------------------------- M1: masks through the reader's camera scope

def test_f1_a_room_mask_is_served_through_the_readers_camera_scope(settings):
    """F1 (Medium), fixed: the editor's mask lists the lobby and the vault cameras (by anchor id, as buildMask writes it, and
    once by camera id) plus an entry that resolves to nothing. `ron` (viewer of the floor, vault denied) gets the lobby entry
    only - in the file, and the listing / bundle describe his copy - while the stored file and the administrator's view are
    exactly what the editor uploaded."""
    c, ids, vid, fid, lobby, vault, anchors = _floor_with_hidden_camera(settings)
    assert vault not in c.get(f"/api/v1/plan-versions/{vid}/geometry", headers=as_user("ron")).text  # SEC244 reference

    key = c.get(f"/api/v1/floors/{fid}/bakes").json()["bake_key"]
    mask = _mask_with_cameras([{"id": anchors[lobby], "p": [240, 200]}, {"id": anchors[vault], "p": [420, 210]},
                               {"id": vault, "p": [421, 211]}, {"id": "ghost-anchor", "p": [10, 10]}])
    up = _upload(c, fid, key, mask)
    assert up.status_code == 201, up.text
    bake_id, stored_sha = up.json()["id"], up.json()["sha256"]
    assert stored_sha == hashlib.sha256(mask).hexdigest()

    # the stored file is the editor's, untouched (the upload flow did not change)
    stored = next((settings.plans_dir / "bakes" / fid).iterdir())
    assert stored.read_bytes() == mask

    # ron: the denied camera is gone - by anchor id, by camera id, and the unresolvable entry too; nothing of its position
    served = c.get(f"/api/v1/floors/{fid}/bakes/{bake_id}/file", headers=as_user("ron"))
    assert served.status_code == 200, served.text
    body = served.json()
    assert body["cameras"] == [{"id": anchors[lobby], "p": [240, 200]}]
    assert vault not in served.text and anchors[vault] not in served.text and "ghost-anchor" not in served.text
    assert "420" not in served.text and "421" not in served.text
    assert body["rooms"] == json.loads(mask)["rooms"] and body["doors"] == []  # the rest of the mask is as stored
    assert served.headers["content-type"].startswith("application/json") and served.headers["x-content-type-options"] == "nosniff"
    ron_sha = hashlib.sha256(served.content).hexdigest()
    assert ron_sha != stored_sha and served.headers["etag"] == f'"{ron_sha}"'
    assert c.get(f"/api/v1/floors/{fid}/bakes/{bake_id}/file", headers={**as_user("ron"), "If-None-Match": f'"{ron_sha}"'}).status_code == 304
    # the stored file's ETag does not revalidate his copy (and the other way round), so a shared browser cache never mixes them
    assert c.get(f"/api/v1/floors/{fid}/bakes/{bake_id}/file", headers={**as_user("ron"), "If-None-Match": f'"{stored_sha}"'}).status_code == 200
    assert c.get(f"/api/v1/floors/{fid}/bakes/{bake_id}/file", headers={"If-None-Match": f'"{ron_sha}"'}).status_code == 200

    # the listing and the bundle describe ron's copy (sha256, bytes, ?v=), never the stored file
    listed = c.get(f"/api/v1/floors/{fid}/bakes", headers=as_user("ron"))
    assert listed.status_code == 200
    row = next(r for r in listed.json()["bakes"] if r["id"] == bake_id)
    assert row["sha256"] == ron_sha and row["bytes"] == len(served.content) and row["url"].endswith(f"?v={ron_sha[:16]}")
    assert stored_sha not in listed.text and stored_sha[:16] not in listed.text and vault not in listed.text and anchors[vault] not in listed.text
    bundle = c.get(f"/api/v1/floors/{fid}/map", headers=as_user("ron"))
    assert bundle.status_code == 200
    assert bundle.json()["bakes"]["levels"]["L0"]["masks"]["iso"]["url"].endswith(f"?v={ron_sha[:16]}")
    assert stored_sha[:16] not in bundle.text and anchors[vault] not in bundle.text and vault not in bundle.text

    # the administrator (nothing withheld) gets the stored bytes, the stored sha and the stored ?v= - unchanged behaviour
    admin = c.get(f"/api/v1/floors/{fid}/bakes/{bake_id}/file")
    assert admin.content == mask and admin.headers["etag"] == f'"{stored_sha}"'
    arow = next(r for r in c.get(f"/api/v1/floors/{fid}/bakes").json()["bakes"] if r["id"] == bake_id)
    assert arow["sha256"] == stored_sha and arow["bytes"] == len(mask) and arow["url"].endswith(f"?v={stored_sha[:16]}")
    assert c.get(f"/api/v1/floors/{fid}/map").json()["bakes"]["levels"]["L0"]["masks"]["iso"]["url"].endswith(f"?v={stored_sha[:16]}")


def test_f1_an_unrestricted_viewer_gets_the_stored_mask_and_a_scoped_one_with_nothing_hidden_too(settings):
    """A viewer whose camera scope withholds nothing gets the stored file byte for byte; so does ron for a mask that lists
    only cameras he may see (nothing to leave out: the stored sha is his)."""
    c, ids, vid, fid, lobby, vault, anchors = _floor_with_hidden_camera(settings)
    key = c.get(f"/api/v1/floors/{fid}/bakes").json()["bake_key"]
    mask = _mask_with_cameras([{"id": anchors[lobby], "p": [240, 200]}, {"id": anchors[vault], "p": [420, 210]}])
    bake_id = _upload(c, fid, key, mask).json()["id"]
    bind(c, settings, "vera", "viewer", "installation", "*")
    got = c.get(f"/api/v1/floors/{fid}/bakes/{bake_id}/file", headers=as_user("vera"))
    assert got.status_code == 200 and got.content == mask
    only_lobby = _mask_with_cameras([{"id": anchors[lobby], "p": [240, 200]}])
    r = _upload(c, fid, key, only_lobby)
    assert r.status_code == 201 and r.json()["id"] == bake_id  # the slot is replaced
    mine = c.get(f"/api/v1/floors/{fid}/bakes/{bake_id}/file", headers=as_user("ron"))
    assert mine.content == only_lobby and mine.headers["etag"] == f'"{hashlib.sha256(only_lobby).hexdigest()}"'


def test_f1_a_mask_stored_before_the_fix_is_sanitised_on_read(settings):
    """A mask row and file written the way the 2.4.7 candidate stored them (no change on disk by the fix): the scoped read
    derives the redacted copy from it - nothing needs migrating; and a mask whose file is gone is not served to him, nor
    described by the stored sha."""
    from smplwise.db import Database, new_id, now_iso
    from smplwise.services import plan_bakes as pb

    c, ids, vid, fid, lobby, vault, anchors = _floor_with_hidden_camera(settings)
    with Database(settings.db_path).connection() as conn:
        real = pb.bake_key(conn, fid)[0]
    legacy = _mask_with_cameras([{"id": anchors[vault], "p": [420, 210]}, {"id": anchors[lobby], "p": [240, 200]}])
    folder = settings.plans_dir / "bakes" / fid
    folder.mkdir(parents=True, exist_ok=True)
    sha = hashlib.sha256(legacy).hexdigest()
    path = folder / f"mask-legacy-{sha[:16]}.json"
    path.write_bytes(legacy)
    rid = new_id()
    with Database(settings.db_path).connection() as conn:
        conn.execute("INSERT INTO plan_bakes(id, floor_id, level_id, kind, preset, style, band, variant, bake_key, recipe, path, mime, width, height, bytes, sha256, meta_json, created_by, created_at) "
                     "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                     (rid, fid, "L0", "mask", "iso", "", "", "", real, "mask-1", path.resolve().relative_to(settings.data_dir.resolve()).as_posix(),
                      "application/json", 800, 500, len(legacy), sha, "{}", None, now_iso()))
    got = c.get(f"/api/v1/floors/{fid}/bakes/{rid}/file", headers=as_user("ron"))
    assert got.status_code == 200 and got.json()["cameras"] == [{"id": anchors[lobby], "p": [240, 200]}]
    assert path.read_bytes() == legacy  # nothing rewritten on disk
    # the file goes missing: ron gets a 404 and a listing without the stored sha; the administrator a 404 as before
    path.unlink()
    pb._MASK_IDS.clear()
    pb._MASK_SERVED.clear()
    assert c.get(f"/api/v1/floors/{fid}/bakes/{rid}/file", headers=as_user("ron")).status_code == 404
    assert c.get(f"/api/v1/floors/{fid}/bakes/{rid}/file").status_code == 404
    listed = c.get(f"/api/v1/floors/{fid}/bakes", headers=as_user("ron")).json()
    row = next(r for r in listed["bakes"] if r["id"] == rid)
    assert row["sha256"] is None and row["bytes"] is None and row["url"].endswith("?v=" + "0" * 16)
    assert sha not in json.dumps(listed) and sha[:16] not in json.dumps(listed)


def test_a_mask_id_with_a_trailing_newline_is_refused(settings):
    """The mask id pattern is matched in full (a `$` let "cam1\\n" through): such a mask is corrupt_mask."""
    from smplwise.services import plan_bakes as pb

    for bad in ({"cameras": [{"id": "cam1\n", "p": [1, 1]}]}, {"doors": [{"id": "d1\n", "points": [[1, 1]]}]},
                {"rooms": [{"id": "z1\n", "floor": [[1, 1]], "top": [[1, 1]], "centre": [1, 1]}]}):
        doc = dict(json.loads(_mask_with_cameras([])), **bad)
        with pytest.raises(pb.BakeError) as e:
            pb.validate_mask(json.dumps(doc).encode("utf-8"), "iso")
        assert e.value.code == "corrupt_mask"
    assert pb.validate_mask(_mask_with_cameras([{"id": "cam1", "p": [1, 1]}]), "iso")[:2] == (800, 500)


# ---------------------------------------------------------------- L1: the served keys

def test_f2_the_bakes_endpoint_hands_a_scoped_reader_the_served_keys(settings):
    """F2 (Low), fixed: GET /floors/{id}/bakes hands `ron` (a camera reference withheld) the doc_hash his geometry read gives
    him, and a geometry key / bake key built over it - never the stored ones; the bundle's bake key is the same served key; the
    administrator's answers are the stored keys, unchanged."""
    c, ids, vid, fid, lobby, vault, anchors = _floor_with_hidden_camera(settings)
    from smplwise.db import Database
    from smplwise.services import plan_bakes as pb
    from smplwise.services.skins import store as skins_store

    admin_hash = c.get(f"/api/v1/plan-versions/{vid}/geometry").json()["geometry"]["doc_hash"]
    ron_geom_hash = c.get(f"/api/v1/plan-versions/{vid}/geometry", headers=as_user("ron")).json()["geometry"]["doc_hash"]
    assert ron_geom_hash != admin_hash
    with Database(settings.db_path).connection() as conn:
        real_key, real_gk = pb.bake_key(conn, fid)
        assert skins_store.geometry_key(conn, fid)[1] == admin_hash

    admin = c.get(f"/api/v1/floors/{fid}/bakes").json()
    assert (admin["bake_key"], admin["geometry_key"], admin["doc_hash"]) == (real_key, real_gk, admin_hash)  # unchanged for the administrator
    ron = c.get(f"/api/v1/floors/{fid}/bakes", headers=as_user("ron"))
    assert ron.status_code == 200, ron.text
    rj = ron.json()
    assert rj["doc_hash"] == ron_geom_hash, "the bakes endpoint hands ron the hash his geometry read gives him"
    assert rj["bake_key"] != real_key and rj["geometry_key"] != real_gk and len(rj["bake_key"]) == 64
    assert admin_hash not in ron.text and real_key not in ron.text and real_gk not in ron.text
    # the frontend's "a map showing a draft must not bake" check compares the bundle's geometry ref with doc_hash: they agree
    rb = c.get(f"/api/v1/floors/{fid}/map", headers=as_user("ron")).json()
    assert rb["geometry"]["doc_hash"] == rj["doc_hash"]
    # with a bake on the floor, the bundle hands ron the same served key and the administrator the stored one
    assert _upload(c, fid, real_key, _mask_with_cameras([])).status_code == 201
    rb = c.get(f"/api/v1/floors/{fid}/map", headers=as_user("ron"))
    assert rb.json()["bakes"]["bake_key"] == rj["bake_key"] and real_key not in rb.text
    assert c.get(f"/api/v1/floors/{fid}/map").json()["bakes"]["bake_key"] == real_key
    # the rows and the open job carry the served key for ron (and are current for him)
    assert c.post(f"/api/v1/floors/{fid}/bakes/regenerate", json={}).status_code == 200
    ron2 = c.get(f"/api/v1/floors/{fid}/bakes", headers=as_user("ron"))
    assert all(r["bake_key"] == rj["bake_key"] and r["stale"] is False for r in ron2.json()["bakes"])
    assert ron2.json()["job"]["bake_key"] == rj["bake_key"] and real_key not in ron2.text


def test_f2_a_stale_rows_stored_key_is_not_handed_to_a_scoped_reader(settings):
    """A row of an older structure: the administrator sees its stored key; `ron` gets null (the served keys cover only the
    current structure)."""
    c, ids, vid, fid, lobby, vault, anchors = _floor_with_hidden_camera(settings)
    key = c.get(f"/api/v1/floors/{fid}/bakes").json()["bake_key"]
    # still-q2.2: a stale still of an older recipe is withheld from ron altogether (STILLCAM, test_stillcam.py)
    assert _upload(c, fid, key, _webp(), kind="still", recipe="still-q2.2", style="light", band="day", variant="off").status_code == 201
    assert c.post(f"/api/v1/floors/{fid}/zones", json={"name": "חדר", "polygon": [{"x": 0.1, "y": 0.1}, {"x": 0.4, "y": 0.1}, {"x": 0.4, "y": 0.4}]}).status_code == 201
    admin = c.get(f"/api/v1/floors/{fid}/bakes").json()
    assert admin["bakes"][0]["stale"] is True and admin["bakes"][0]["bake_key"] == key
    ron = c.get(f"/api/v1/floors/{fid}/bakes", headers=as_user("ron"))
    assert ron.json()["bakes"][0]["stale"] is True and ron.json()["bakes"][0]["bake_key"] is None and key not in ron.text


def test_f2_a_scoped_editor_bakes_with_the_key_they_were_handed(settings):
    """The editor flow for an editor denied a camera: they bake with the served key (201), the row is stored under the real
    key (current for everyone), the job answers carry their served key, and sending the stored key - which they were never
    handed - is the ordinary 409 geometry_changed with their own key in the details (no oracle)."""
    c, ids, vid, fid, lobby, vault, anchors = _floor_with_hidden_camera(settings)
    bind(c, settings, "edna", "editor", "floor", fid)
    _deny_camera(settings, "edna", vault)
    real = c.get(f"/api/v1/floors/{fid}/bakes").json()["bake_key"]
    mine = c.get(f"/api/v1/floors/{fid}/bakes", headers=as_user("edna")).json()
    assert mine["bake_key"] != real
    assert mine["doc_hash"] == c.get(f"/api/v1/floors/{fid}/map", headers=as_user("edna")).json()["geometry"]["doc_hash"]
    job = c.post(f"/api/v1/floors/{fid}/bakes/regenerate", json={"styles": ["light"], "bands": ["day"], "lightmap": False}, headers=as_user("edna"))
    assert job.status_code == 200, job.text
    assert job.json()["job"]["bake_key"] == mine["bake_key"]
    claimed = c.post(f"/api/v1/floors/{fid}/bakes/jobs/{job.json()['job']['id']}/claim", headers=as_user("edna"))
    assert claimed.status_code == 200 and claimed.json()["job"]["bake_key"] == mine["bake_key"]
    refused = _upload(c, fid, real, _mask_with_cameras([{"id": anchors[lobby], "p": [240, 200]}]), headers=as_user("edna"))
    assert refused.status_code == 409 and refused.json()["code"] == "geometry_changed" and refused.json()["details"]["bake_key"] == mine["bake_key"]
    r = _upload(c, fid, mine["bake_key"], _mask_with_cameras([{"id": anchors[lobby], "p": [240, 200]}]), headers=as_user("edna"))
    assert r.status_code == 201, r.text
    assert r.json()["bake_key"] == mine["bake_key"] and r.json()["stale"] is False
    for variant in ("off", "on"):
        s = _upload(c, fid, mine["bake_key"], _webp((1, 2, 3) if variant == "on" else (4, 5, 6)), kind="still", style="light", band="day", variant=variant,
                    recipe="still-q2.1", headers=as_user("edna"))
        assert s.status_code == 201, s.text
    done = c.post(f"/api/v1/floors/{fid}/bakes/jobs/{job.json()['job']['id']}/finish", json={"status": "done"}, headers=as_user("edna"))
    assert done.status_code == 200, done.text
    assert done.json()["job"]["bake_key"] == mine["bake_key"]
    # stored under the real key: current for the administrator, the bundle complete for the requested scope
    admin = c.get(f"/api/v1/floors/{fid}/bakes").json()
    assert admin["stale_count"] == 0 and all(row["bake_key"] == real and not row["stale"] for row in admin["bakes"])
    from smplwise.db import Database

    with Database(settings.db_path).connection() as conn:
        assert {r[0] for r in conn.execute("SELECT bake_key FROM plan_bake_jobs WHERE floor_id = ?", (fid,))} == {real}


# ---------------------------------------------------------------- I2: eviction stays on the uploading floor first

def test_i2_eviction_takes_the_uploading_floors_stale_rows_first_and_others_only_as_last_resort(settings):
    from smplwise.db import Database, new_id, now_iso

    c, ids, vid, fid, lobby, vault, anchors = _floor_with_hidden_camera(settings)
    other = ids["floor3"]  # no published structure: every row of it is stale
    mb = 1024 * 1024
    key = c.get(f"/api/v1/floors/{fid}/bakes").json()["bake_key"]
    assert _upload(c, fid, key, _webp(), kind="still", style="light", band="day", variant="off").status_code == 201

    def fake_row(floor_id: str, band: str, size: int, created_at: str) -> str:
        folder = settings.plans_dir / "bakes" / floor_id
        folder.mkdir(parents=True, exist_ok=True)
        p = folder / f"still-{band}-{floor_id[:6]}.webp"
        p.write_bytes(b"x")
        rid = new_id()
        with Database(settings.db_path).connection() as conn:
            conn.execute("INSERT INTO plan_bakes(id, floor_id, level_id, kind, preset, style, band, variant, bake_key, recipe, path, mime, width, height, bytes, sha256, meta_json, created_by, created_at) "
                         "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                         (rid, floor_id, "L0", "still", "iso", "light", band, "off", "e" * 64, "still-q2.1", p.resolve().relative_to(settings.data_dir.resolve()).as_posix(),
                          "image/webp", 800, 500, size, "0" * 64, "{}", None, created_at))
        return rid

    # the other floor's stale row is the OLDEST; this floor's stale row is newer - the old order would take the other floor's
    fake_row(other, "night", 64 * mb, "2020-01-01T00:00:00Z")
    fake_row(fid, "sunset", 64 * mb, now_iso())
    assert c.patch("/api/v1/settings", json={"plan.bakes": {"floor_cap_mb": 256, "total_cap_mb": 128}}).status_code == 200
    r = _upload(c, fid, key, _webp((9, 9, 9)), kind="still", style="dark", band="day", variant="off")
    assert r.status_code == 201, r.text
    assert r.json()["evicted"] == [f"{fid}:still/L0/iso/light/sunset/off"], "this floor's stale row goes first"
    with Database(settings.db_path).connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM plan_bakes WHERE floor_id = ?", (other,)).fetchone()[0] == 1, "the other floor is untouched"
        # now only another floor's stale row can make room: this floor's rows are all current and big
        conn.execute("UPDATE plan_bakes SET bytes = ? WHERE floor_id = ? AND band = 'day' AND style = 'light'", (100 * mb, fid))
    r = _upload(c, fid, key, _webp((7, 7, 7)), kind="still", style="dark", band="night", variant="off")
    assert r.status_code == 201, r.text
    assert r.json()["evicted"] == [f"{other}:still/L0/iso/light/night/off"], "another floor's stale row only as the last resort"
    with Database(settings.db_path).connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM plan_bakes WHERE floor_id = ?", (other,)).fetchone()[0] == 0
        d = json.loads(conn.execute("SELECT details_json FROM audit_log WHERE action = 'plan.bake.upload' ORDER BY rowid DESC LIMIT 1").fetchone()[0])
        assert d["evicted"] == [f"{other}:still/L0/iso/light/night/off"]  # the cross-floor eviction is in the audit row
        # and a current row is still never evicted
        conn.execute("UPDATE plan_bakes SET bytes = ? WHERE floor_id = ? AND band = 'night' AND style = 'dark'", (30 * mb, fid))
    r = _upload(c, fid, key, _webp((5, 5, 5)), kind="still", style="dark", band="sunset", variant="off")
    assert r.status_code == 507 and r.json()["code"] == "bake_storage_full"


# ---------------------------------------------------------------- I1 / I4: walk positions and material ids (document 2.2)

def _v22() -> dict:
    return json.loads((FIX / "sample-v22.json").read_text(encoding="utf-8"))


def _structural(doc: dict) -> list[dict]:
    from smplwise.services import plan_geometry as pg

    return [i for i in pg.validate(doc) if i["structural"]]


def test_ia_a_walk_position_with_extra_keys_or_a_padded_name_is_refused(settings):
    """I-A (Info), fixed: the PoC's position (a name padded to 5005 characters, an extra `payload` key) no longer validates -
    both are structural (refused at save, never stored)."""
    base = _v22()
    level_id = base["levels"][0]["id"]
    pos = {"id": "p1", "name": "lobby" + " " * 5000, "x": 0.5, "y": 0.5, "level_id": level_id, "heading_deg": 10.0, "payload": {"blob": "x" * 5000}}
    codes = {i["code"] for i in _structural(dict(base, walk_positions=[pos]))}
    assert {"unknown_field", "name"} <= codes
    assert {i["code"] for i in _structural(dict(base, walk_positions=[dict(pos, name="lobby")]))} == {"unknown_field"}
    no_extra = {k: v for k, v in pos.items() if k != "payload"}
    assert {i["code"] for i in _structural(dict(base, walk_positions=[no_extra]))} == {"name"}


@pytest.mark.parametrize(("over", "ok"), [
    ({"name": "x" * 40}, True), ({"name": "x" * 41}, False), ({"name": " lobby "}, True), ({"name": " " * 41}, False),
    ({"id": "wp-1"}, True), ({"id": "a.b:c_d-9"}, True), ({"id": "A" * 64}, True), ({"id": "A" * 65}, False),
    ({"id": "wp 1"}, False), ({"id": "<b>x</b>"}, False), ({"id": "עמדה"}, False), ({"id": "-wp"}, False), ({"id": "wp/1"}, False),
    ({"id": "wp\n"}, False), ({"is_default": True}, True), ({"extra": 1}, False), ({"label": "x"}, False),
])
def test_ia_walk_position_edge_cases(over, ok):
    base = _v22()
    pos = dict(base["walk_positions"][1], **over)
    doc = dict(base, walk_positions=[base["walk_positions"][0], pos])
    assert (not _structural(doc)) is ok, (over, _structural(doc))


def test_ia_a_blank_name_stays_a_value_error():
    from smplwise.services import plan_geometry as pg

    base = _v22()
    doc = dict(base, walk_positions=[dict(base["walk_positions"][0], name="   ")])
    issues = pg.validate(doc)
    assert not any(i["structural"] for i in issues) and any(i["code"] == "name" and i["severity"] == "error" for i in issues)


def test_i4_an_unknown_material_id_outside_the_plain_charset_is_dropped_on_save_and_never_an_error():
    from smplwise.services import plan_catalog as cat
    from smplwise.services import plan_geometry as pg

    base = _v22()
    base["walls"][1]["material_id"] = "<img src=x>"
    base["rooms"][0]["floor_material_id"] = "שיש"
    base["levels"][0]["ceiling_material_id"] = "floor_oak"  # an alias: becomes its id
    # validate alone: unknown ids are warnings, never errors (an older library still opens the document)
    assert [i for i in pg.validate(base) if i["severity"] == "error"] == []
    out = pg.normalize(base, cat.builtin()["items"])
    assert "material_id" not in out["walls"][1] and "floor_material_id" not in out["rooms"][0]
    assert out["walls"][0]["material_id"] == "no_such_material"  # an unknown id in the plain charset stays (a newer library)
    assert out["levels"][0]["ceiling_material_id"] == "oak"
    assert base["walls"][1]["material_id"] == "<img src=x>"  # the input is untouched


def test_i4_a_document_whose_only_22_field_was_an_unsafe_material_falls_back_to_its_old_version():
    from smplwise.services import geometry_store as store
    from smplwise.services import plan_catalog as cat
    from smplwise.services import plan_geometry as pg

    doc = json.loads((FIX / "sample-v2.json").read_text(encoding="utf-8"))
    before = store.doc_hash(doc)
    doc2 = copy.deepcopy(doc)
    doc2["walls"][0]["material_id"] = "bad id"
    assert pg.document_version(doc2) == "2.2"
    out = pg.normalize(doc2, cat.builtin()["items"])
    assert pg.document_version(out) == "2.0" and store.doc_hash(pg.normalize(doc, cat.builtin()["items"])) == store.doc_hash(out)
    assert store.doc_hash(doc) == before


@pytest.mark.parametrize("name", ["sample-v2.json", "sample-v2-glass.json", "sample-curved.json"])
def test_documents_20_and_21_are_untouched_by_the_new_rules(name):
    """Documents 2.0 / 2.1 carry no walk position and no material id: the Studio 6 normalisation leaves them deep-equal (so
    their stored bytes and hashes stay exactly as they are) and validation reports nothing new."""
    from smplwise.services import geometry_store as store
    from smplwise.services import plan_geometry as pg
    from smplwise.services import plan_studio6 as s6

    doc = json.loads((FIX / name).read_text(encoding="utf-8"))
    h = store.doc_hash(doc)
    copy_ = copy.deepcopy(doc)
    s6.normalize(copy_)
    assert copy_ == doc and store.doc_hash(copy_) == h
    assert not {i["code"] for i in pg.validate(doc)} & {"unknown_field", "id", "name"}


def test_ia_the_save_route_refuses_and_accepts_as_the_contract_says(settings):
    """Through PUT /geometry: an extra key or a padded name is a 422 geometry_structure (nothing stored); a clean position and
    an unsafe material id (dropped) save; publishing still works."""
    c, ids, vid = _plan_world(settings)
    g = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()
    doc, rev = g["doc"], g["geometry"]["revision"]
    level = doc["levels"][0]["id"] if doc.get("levels") else "L0"
    good = {"id": "wp-a", "name": "כניסה", "x": 0.2, "y": 0.2, "level_id": level, "heading_deg": 90.0, "is_default": True}
    for bad in (dict(good, note="x"), dict(good, name="כניסה" + " " * 100), dict(good, id="wp a")):
        r = c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": dict(doc, walk_positions=[bad]), "base_revision": rev})
        assert r.status_code == 422 and r.json()["code"] == "geometry_structure", r.text
    walls = [dict(doc["walls"][0], material_id="<script>")]
    r = c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": dict(doc, walk_positions=[good], walls=walls), "base_revision": rev})
    assert r.status_code == 200, r.text
    saved = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()["doc"]
    assert saved["walk_positions"] == [good] and "material_id" not in saved["walls"][0] and saved["schema_version"] == "2.2"
    assert c.post(f"/api/v1/plan-versions/{vid}/geometry/publish").status_code == 200
