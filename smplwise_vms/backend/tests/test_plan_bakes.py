"""CR-029 S3 (Plan Studio 6 stills, room masks, lightmaps; docs/changes/CR-029-ST7-S3-NOTES.md): the `plan.bakes` setting, the
upload (permission, keying by the bake key, slot rules, content sniffing, metadata refusal, size rules, the bounded decoder),
listing and serving (map.read, ETag / 304), slot replacement, stale rows when the structure changes, the map bundle's current
set, eviction under the caps, the regenerate jobs (open / reuse / claim / lease / finish), deletion with the floor, backup
coverage and the orphan sweep. No test renders anything: the files are synthetic."""
from __future__ import annotations

import io
import json
import struct
import zlib

import pytest
from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient
from PIL import Image

from smplwise.main import create_app
from smplwise.services import backup as backup_svc
from smplwise.services import plan_bakes as pb

WALL = {"id": "w1", "level_id": "L0", "polyline": [[0.1, 0.2], [0.6, 0.2]], "thickness_m": 0.2, "height_m": None, "base_z_m": 0, "kind": "interior",
        "confidence": 1, "source": "manual", "locked": False, "external_ids": {}}


def img(fmt: str = "WEBP", w: int = 800, h: int = 500, color=(200, 210, 220), mode: str = "RGB") -> bytes:
    buf = io.BytesIO()
    Image.new(mode, (w, h), color).save(buf, format=fmt)
    return buf.getvalue()


def with_png_chunk(png: bytes, ctype: bytes, body: bytes) -> bytes:
    chunk = struct.pack(">I", len(body)) + ctype + body + struct.pack(">I", zlib.crc32(ctype + body) & 0xFFFFFFFF)
    return png[:33] + chunk + png[33:]


def mask_doc(preset: str = "iso", w: int = 800, h: int = 500, **over) -> bytes:
    doc = {"version": 1, "preset": preset, "width": w, "height": h,
           "rooms": [{"id": "z1", "floor": [[10, 10], [200, 10], [200, 150]], "top": [[10, 5], [200, 5], [200, 140]], "centre": [120, 60]}],
           "doors": [{"id": "d1", "points": [[300, 300], [320, 300], [320, 330]]}], "cameras": [{"id": "cam1", "p": [400, 200]}]}
    doc.update(over)
    return json.dumps(doc).encode("utf-8")


def _floor_with_structure(c: TestClient) -> tuple[dict, str]:
    ids = seed_tree(c)
    fid = ids["floor2"]
    asset = c.post(f"/api/v1/floors/{fid}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{fid}/plan-versions", json={"asset_id": asset["id"]}).json()
    assert c.post(f"/api/v1/plan-versions/{v['id']}/publish").status_code == 200
    g = c.get(f"/api/v1/plan-versions/{v['id']}/geometry?draft=true").json()
    assert c.put(f"/api/v1/plan-versions/{v['id']}/geometry", json={"doc": dict(g["doc"], walls=[WALL]), "base_revision": 0}).status_code == 200
    assert c.post(f"/api/v1/plan-versions/{v['id']}/geometry/publish").status_code == 200
    return ids, v["id"]


class Up:
    def __init__(self, c: TestClient, fid: str, key: str):
        self.c, self.fid, self.key = c, fid, key

    def __call__(self, data: bytes, kind: str = "still", level: str = "L0", preset: str = "iso", style: str = "light", band: str = "day", variant: str = "off",
                 key: str | None = None, recipe: str = "still-q2.1", meta: str = "", headers=None, name: str = "f.bin"):
        if kind != "still":
            style = band = variant = ""
        if kind == "lightmap":
            preset = ""
        form = {"kind": kind, "level_id": level, "preset": preset, "style": style, "band": band, "variant": variant, "bake_key": key or self.key,
                "recipe": recipe, "meta": meta}
        return self.c.post(f"/api/v1/floors/{self.fid}/bakes", data=form, files={"file": (name, data, "application/octet-stream")}, headers=headers)


# ---------- the setting ----------

def test_setting_defaults_partial_updates_and_refusals(settings):
    assert pb.SETTING_DEFAULT == {"presets": ["iso"], "styles": ["light", "dark"], "bands": ["day", "sunset", "night"], "lightmap": True, "size": "1600x1000",
                                  "floor_cap_mb": 64, "total_cap_mb": 512}
    base = pb.stored_setting(None)
    assert pb.normalize_setting({"bands": ["night", "day"], "floor_cap_mb": "128"}, base) == {**base, "bands": ["day", "night"], "floor_cap_mb": 128}
    for bad in ({"presets": []}, {"presets": ["side"]}, {"styles": "light"}, {"lightmap": "yes"}, {"size": "4000x4000"}, {"floor_cap_mb": 3}, {"x": 1}, []):
        with pytest.raises(ValueError):
            pb.normalize_setting(bad, base)  # type: ignore[arg-type]
    assert pb.stored_setting('{"size": "1x1", "lightmap": false}') == {**base, "lightmap": False}
    app = create_app(settings)
    with TestClient(app) as c:
        assert c.get("/api/v1/settings").json()["settings"]["plan.bakes"] == base
        r = c.patch("/api/v1/settings", json={"plan.bakes": {"presets": ["iso", "top"], "lightmap": False}})
        assert r.status_code == 200, r.text
        assert r.json()["settings"]["plan.bakes"]["presets"] == ["iso", "top"] and r.json()["settings"]["plan.bakes"]["lightmap"] is False
        assert c.patch("/api/v1/settings", json={"plan.bakes": {"bands": ["noon"]}}).status_code == 422
        bind(c, settings, "dana", "viewer", "installation", "*")
        assert c.patch("/api/v1/settings", headers=as_user("dana"), json={"plan.bakes": {"lightmap": True}}).status_code == 403
        assert c.get("/api/v1/settings").json()["settings"]["plan.bakes"]["lightmap"] is False


def test_expected_slots_order_and_count():
    s = pb.stored_setting(None)
    slots = pb.expected_slots(["L0", "L1"], s)
    names = [pb.slot_id(x) for x in slots]
    # per level: one mask + 2 styles x 3 bands x off / on stills + one lightmap
    assert len(names) == 2 * (1 + 12 + 1)
    assert names[:3] == ["mask/L0/iso", "still/L0/iso/light/day/off", "still/L0/iso/light/day/on"] and names[13] == "lightmap/L0"
    assert len(set(names)) == len(names)


# ---------- upload, list, serve ----------

def test_upload_needs_a_published_structure_and_map_edit(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        ids = seed_tree(c)
        fid = ids["floor2"]
        r = Up(c, fid, "0" * 64)(img())
        assert r.status_code == 409 and r.json()["code"] == "no_structure"
        assert c.get(f"/api/v1/floors/{fid}/bakes").json()["bake_key"] is None


def test_upload_list_serve_replace_and_permissions(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        ids, _ = _floor_with_structure(c)
        fid = ids["floor2"]
        info = c.get(f"/api/v1/floors/{fid}/bakes").json()
        key = info["bake_key"]
        assert len(key) == 64 and info["levels"] == ["L0"] and info["bakes"] == [] and info["complete"] is False and len(info["missing"]) == 14
        assert info["size"] == [1600, 1000]
        up = Up(c, fid, key)
        webp = img("WEBP")
        r = up(webp, meta=json.dumps({"renderer": "SwiftShader", "quality": 2}))
        assert r.status_code == 201, r.text
        row = r.json()
        assert row["slot"] == "still/L0/iso/light/day/off" and row["mime"] == "image/webp" and row["width"] == 800 and row["stale"] is False and row["identical"] is False
        stored = list((settings.plans_dir / "bakes" / fid).iterdir())
        assert len(stored) == 1 and stored[0].read_bytes() == webp
        # the same bytes again: identical; new bytes replace the slot's file (the old one goes)
        assert up(webp).json()["identical"] is True
        jpg = img("JPEG", color=(10, 20, 30))
        r2 = up(jpg)
        assert r2.status_code == 201 and r2.json()["id"] == row["id"] and r2.json()["mime"] == "image/jpeg"
        assert [p.read_bytes() for p in (settings.plans_dir / "bakes" / fid).iterdir()] == [jpg]
        # served with an ETag; a revalidation is a 304
        f = c.get(f"/api/v1/floors/{fid}/bakes/{row['id']}/file")
        assert f.status_code == 200 and f.content == jpg and f.headers["content-type"] == "image/jpeg" and f.headers["etag"] == f'"{r2.json()["sha256"]}"'
        assert c.get(f"/api/v1/floors/{fid}/bakes/{row['id']}/file", headers={"If-None-Match": f.headers["etag"]}).status_code == 304
        assert c.get(f"/api/v1/floors/{fid}/bakes/nope/file").status_code == 404
        # a viewer reads (map.read) but may not upload, regenerate or delete
        bind(c, settings, "vera", "viewer", "installation", "*")
        assert c.get(f"/api/v1/floors/{fid}/bakes", headers=as_user("vera")).status_code == 200
        assert c.get(f"/api/v1/floors/{fid}/bakes/{row['id']}/file", headers=as_user("vera")).status_code == 200
        assert up(webp, headers=as_user("vera")).status_code == 403
        assert c.post(f"/api/v1/floors/{fid}/bakes/regenerate", json={}, headers=as_user("vera")).status_code == 403
        assert c.delete(f"/api/v1/floors/{fid}/bakes/{row['id']}", headers=as_user("vera")).status_code == 403
        # nobody without a binding reads
        c.get("/api/v1/me", headers=as_user("eve"))
        assert c.get(f"/api/v1/floors/{fid}/bakes", headers=as_user("eve")).status_code == 403
        assert c.get(f"/api/v1/floors/{fid}/bakes/{row['id']}/file", headers=as_user("eve")).status_code == 403
        # an editor of the floor uploads
        bind(c, settings, "eddie", "editor", "floor", fid)
        assert up(img(color=(9, 9, 9)), variant="on", headers=as_user("eddie")).status_code == 201
        with app.state.db.connection() as conn:
            assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'plan.bake.upload' AND decision = 'allowed'").fetchone()[0] == 4
            d = json.loads(conn.execute("SELECT details_json FROM audit_log WHERE action = 'plan.bake.upload' ORDER BY rowid LIMIT 1").fetchone()[0])
            assert d["slot"] == "still/L0/iso/light/day/off" and d["bake_key"] == key and d["recipe"] == "still-q2.1"
        # delete one
        assert c.delete(f"/api/v1/floors/{fid}/bakes/{row['id']}").status_code == 204
        assert c.get(f"/api/v1/floors/{fid}/bakes/{row['id']}/file").status_code == 404


def test_upload_validation(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        ids, _ = _floor_with_structure(c)
        fid = ids["floor2"]
        key = c.get(f"/api/v1/floors/{fid}/bakes").json()["bake_key"]
        up = Up(c, fid, key)

        def code(r):
            return (r.status_code, r.json().get("code"))

        assert code(up(img(), key="f" * 64)) == (409, "geometry_changed")
        assert up(img(), key="nothex").status_code == 409  # any other key is outdated
        assert code(up(img(), level="L9")) == (422, "bad_slot")
        assert code(up(img(), style="neon")) == (422, "bad_slot")
        assert code(up(img(), band="noon")) == (422, "bad_slot")
        assert code(up(img(), recipe="Bad Recipe!")) == (422, "validation")
        assert code(up(b"GIF89a" + b"\0" * 64)) == (415, "unsupported_format")
        assert code(up(img("PNG"), kind="mask")) == (415, "unsupported_format")  # a mask is JSON
        assert code(up(img("WEBP", 256, 256), kind="lightmap")) == (415, "unsupported_format")  # a lightmap is PNG
        assert code(up(img("PNG", 300, 256), kind="lightmap")) == (422, "bad_size")
        assert code(up(img("WEBP", 320, 200))) == (422, "bad_size")
        assert code(up(with_png_chunk(img("PNG"), b"tEXt", b"Comment\0kitchen"))) == (422, "image_metadata")
        exif = Image.Exif()
        exif[0x010E] = "living room"
        buf = io.BytesIO()
        Image.new("RGB", (800, 500)).save(buf, format="JPEG", exif=exif.tobytes())
        assert code(up(buf.getvalue())) == (422, "image_metadata")
        buf = io.BytesIO()
        Image.new("RGB", (800, 500)).save(buf, format="WEBP", exif=exif.tobytes())
        assert code(up(buf.getvalue())) == (422, "image_metadata")
        truncated = img("PNG")[:-20]
        assert up(truncated).status_code == 422
        assert code(up(img(), meta="{bad")) == (422, "bad_meta")
        assert code(up(img(), meta=json.dumps({"secret": 1}))) == (422, "bad_meta")
        big = img("PNG", 2000, 1200)  # tiny when solid; pad past the still cap
        assert up(big + b"\0" * (pb.MAX_BYTES["still"] + 1)).status_code in (413, 422)
        # masks: strict documents
        assert up(mask_doc(), kind="mask").status_code == 201
        for bad in (mask_doc(preset="top"), mask_doc(extra=1), mask_doc(rooms=[{"id": "z1", "floor": [[1e9, 0]], "top": [], "centre": [0, 0]}]),
                    mask_doc(rooms=[{"id": "../x", "floor": [], "top": [], "centre": [0, 0]}]), mask_doc(width=10), b"{not json", mask_doc(version=2)):
            assert code(up(bad, kind="mask")) == (422, "corrupt_mask"), bad[:60]
        # a lightmap: PNG, power-of-two sides, the atlas layout in meta
        layout = {"version": 1, "surfaces": [{"kind": "floor", "level_id": "L0", "uv": [0, 0, 1, 1], "world": [0, 0, 10, 8], "y": 0}], "channels": {"ao": "r", "lamps": "g"}, "samples": 64, "texel_m": 0.1}
        r = up(img("PNG", 256, 128, mode="RGBA"), kind="lightmap", meta=json.dumps(layout))
        assert r.status_code == 201, r.text
        assert r.json()["meta"]["surfaces"][0]["world"] == [0, 0, 10, 8]
        assert code(up(img("PNG", 256, 128), kind="lightmap", meta=json.dumps({"surfaces": [{"kind": "wall"}]}))) == (422, "bad_meta")


def test_the_decoder_is_bounded(settings):
    data = img("PNG")
    assert pb.DECODE_SLOTS.acquire(timeout=1) and pb.DECODE_SLOTS.acquire(timeout=1)
    try:
        with pytest.raises(pb.BakeError) as e:
            pb.validate_file("still", "iso", data, wait_s=0.05)
        assert e.value.code == "busy"
    finally:
        pb.DECODE_SLOTS.release()
        pb.DECODE_SLOTS.release()
    assert pb.validate_file("still", "iso", data)[:3] == ("image/png", 800, 500)


# ---------- stale rows, the map bundle, eviction ----------

def test_a_structure_change_makes_the_bakes_stale_and_the_bundle_drops_them(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        ids, _ = _floor_with_structure(c)
        fid = ids["floor2"]
        key = c.get(f"/api/v1/floors/{fid}/bakes").json()["bake_key"]
        up = Up(c, fid, key)
        assert c.get(f"/api/v1/floors/{fid}/map").json()["bakes"] is None  # nothing baked yet
        assert up(img()).status_code == 201
        assert up(mask_doc(), kind="mask").status_code == 201
        b = c.get(f"/api/v1/floors/{fid}/map").json()["bakes"]
        assert b["bake_key"] == key and b["complete"] is False and b["stale_count"] == 0 and b["recipes"] == ["still-q2.1"]
        assert set(b["levels"]["L0"]["stills"]) == {"iso/light/day/off"} and "iso" in b["levels"]["L0"]["masks"]
        # a narrower setting makes the floor complete
        c.patch("/api/v1/settings", json={"plan.bakes": {"styles": ["light"], "bands": ["day"], "lightmap": False}})
        assert up(img(color=(1, 1, 1)), variant="on").status_code == 201
        assert c.get(f"/api/v1/floors/{fid}/map").json()["bakes"]["complete"] is True
        assert c.get(f"/api/v1/floors/{fid}/bakes").json()["complete"] is True
        # a new room changes the bake key: every row is stale, the bundle lists none, an upload with the old key is refused
        assert c.post(f"/api/v1/floors/{fid}/zones", json={"name": "חדר", "polygon": [{"x": 0.1, "y": 0.1}, {"x": 0.4, "y": 0.1}, {"x": 0.4, "y": 0.4}]}).status_code == 201
        info = c.get(f"/api/v1/floors/{fid}/bakes").json()
        assert info["bake_key"] != key and info["stale_count"] == 3 and all(r["stale"] for r in info["bakes"]) and info["complete"] is False
        b = c.get(f"/api/v1/floors/{fid}/map").json()["bakes"]
        assert b["levels"] == {} and b["stale_count"] == 3 and b["complete"] is False
        assert up(img()).json()["code"] == "geometry_changed"


def test_eviction_takes_stale_rows_first_and_never_a_current_one(settings, monkeypatch):
    app = create_app(settings)
    with TestClient(app) as c:
        ids, _ = _floor_with_structure(c)
        fid = ids["floor2"]
        key = c.get(f"/api/v1/floors/{fid}/bakes").json()["bake_key"]
        up = Up(c, fid, key)
        assert up(img(), band="day").status_code == 201
        assert up(img(color=(5, 5, 5)), band="night").status_code == 201
        mb = 1024 * 1024
        with app.state.db.connection() as conn:
            # pretend the night still is old and stale (another key) and both rows are big
            conn.execute("UPDATE plan_bakes SET bake_key = ?, bytes = ? WHERE band = 'night'", ("e" * 64, 11 * mb))
            conn.execute("UPDATE plan_bakes SET bytes = ? WHERE band = 'day'", (5 * mb,))
        c.patch("/api/v1/settings", json={"plan.bakes": {"floor_cap_mb": 16}})
        r = up(img(color=(7, 7, 7)), band="sunset")
        assert r.status_code == 201, r.text
        assert r.json()["evicted"] == [f"{fid}:still/L0/iso/light/night/off"]
        with app.state.db.connection() as conn:
            assert conn.execute("SELECT COUNT(*) FROM plan_bakes WHERE band = 'night'").fetchone()[0] == 0
            conn.execute("UPDATE plan_bakes SET bytes = ? WHERE band = 'sunset'", (11 * mb,))  # 5 + 11 = the whole floor cap, all current
        r = up(img(color=(8, 8, 8)), band="day", variant="on")
        assert r.status_code == 507 and r.json()["code"] == "bake_storage_full"
        with app.state.db.connection() as conn:
            assert conn.execute("SELECT COUNT(*) FROM plan_bakes").fetchone()[0] == 2  # nothing current was evicted


# ---------- jobs ----------

def test_regenerate_claim_lease_and_finish(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        ids, _ = _floor_with_structure(c)
        fid = ids["floor2"]
        key = c.get(f"/api/v1/floors/{fid}/bakes").json()["bake_key"]
        scope = {"levels": ["L0"], "presets": ["iso"], "styles": ["light"], "bands": ["day"], "lightmap": False}
        r = c.post(f"/api/v1/floors/{fid}/bakes/regenerate", json=scope)
        assert r.status_code == 200, r.text
        job = r.json()["job"]
        assert r.json()["created"] is True and job["status"] == "requested" and job["bake_key"] == key
        assert r.json()["expected"] == ["mask/L0/iso", "still/L0/iso/light/day/off", "still/L0/iso/light/day/on"]
        again = c.post(f"/api/v1/floors/{fid}/bakes/regenerate", json={})
        assert again.json()["created"] is False and again.json()["job"]["id"] == job["id"]  # one open request per floor
        assert c.post(f"/api/v1/floors/{fid}/bakes/regenerate", json={"bands": ["noon"]}).status_code == 422
        assert c.post(f"/api/v1/floors/{fid}/bakes/regenerate", json={"levels": ["L7"]}).status_code == 422
        assert c.get(f"/api/v1/floors/{fid}/bakes").json()["job"]["id"] == job["id"]
        cl = c.post(f"/api/v1/floors/{fid}/bakes/jobs/{job['id']}/claim")
        assert cl.status_code == 200 and cl.json()["job"]["status"] == "claimed" and cl.json()["job"]["lease_until"]
        bind(c, settings, "eddie", "editor", "floor", fid)
        other = c.post(f"/api/v1/floors/{fid}/bakes/jobs/{job['id']}/claim", headers=as_user("eddie"))
        assert other.status_code == 409 and other.json()["code"] == "job_claimed"
        assert c.post(f"/api/v1/floors/{fid}/bakes/jobs/{job['id']}/claim").status_code == 200  # the holder renews
        fin = c.post(f"/api/v1/floors/{fid}/bakes/jobs/{job['id']}/finish", json={"status": "done"})
        assert fin.status_code == 409 and fin.json()["code"] == "incomplete" and fin.json()["details"]["missing_count"] == 3
        up = Up(c, fid, key)
        assert up(mask_doc(), kind="mask").status_code == 201
        assert up(img()).status_code == 201
        assert up(img(color=(1, 2, 3)), variant="on").status_code == 201
        fin = c.post(f"/api/v1/floors/{fid}/bakes/jobs/{job['id']}/finish", json={"status": "done"})
        assert fin.status_code == 200 and fin.json()["job"]["status"] == "done"
        assert c.post(f"/api/v1/floors/{fid}/bakes/jobs/{job['id']}/finish", json={"status": "failed"}).json()["code"] == "job_closed"
        assert c.get(f"/api/v1/floors/{fid}/bakes").json()["job"] is None
        # a request may name a preset the setting does not list: done needs ITS slots, not the setting's
        j3 = c.post(f"/api/v1/floors/{fid}/bakes/regenerate", json={**scope, "presets": ["top"]}).json()["job"]
        f3 = c.post(f"/api/v1/floors/{fid}/bakes/jobs/{j3['id']}/finish", json={"status": "done"})
        assert f3.status_code == 409 and f3.json()["details"]["missing_count"] == 3
        assert c.post(f"/api/v1/floors/{fid}/bakes/jobs/{j3['id']}/finish", json={"status": "cancelled"}).status_code == 200
        # a failed request keeps a short, cleaned reason
        j2 = c.post(f"/api/v1/floors/{fid}/bakes/regenerate", json={}).json()["job"]
        f2 = c.post(f"/api/v1/floors/{fid}/bakes/jobs/{j2['id']}/finish", json={"status": "failed", "error": "WebGL <lost>"})
        assert f2.json()["job"]["error"] == "WebGL lost"
        with app.state.db.connection() as conn:
            steps = [json.loads(x[0])["step"] for x in conn.execute("SELECT details_json FROM audit_log WHERE action = 'plan.bake.job' ORDER BY rowid")]
        assert steps == ["claim", "claim", "done", "cancelled", "failed"]


def test_a_request_for_an_outdated_key_is_superseded(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        ids, _ = _floor_with_structure(c)
        fid = ids["floor2"]
        j1 = c.post(f"/api/v1/floors/{fid}/bakes/regenerate", json={}).json()["job"]
        assert c.post(f"/api/v1/floors/{fid}/zones", json={"name": "חדר", "polygon": [{"x": 0.1, "y": 0.1}, {"x": 0.4, "y": 0.1}, {"x": 0.4, "y": 0.4}]}).status_code == 201
        assert c.post(f"/api/v1/floors/{fid}/bakes/jobs/{j1['id']}/claim").json()["code"] == "geometry_changed"
        r = c.post(f"/api/v1/floors/{fid}/bakes/regenerate", json={}).json()
        assert r["created"] is True and r["job"]["id"] != j1["id"]
        with app.state.db.connection() as conn:
            assert conn.execute("SELECT status, error FROM plan_bake_jobs WHERE id = ?", (j1["id"],)).fetchone()[:] == ("cancelled", "superseded")


# ---------- deletion, backup, confinement ----------

def test_deleted_with_the_floor_and_by_the_delete_all_route(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        ids, _ = _floor_with_structure(c)
        fid = ids["floor2"]
        key = c.get(f"/api/v1/floors/{fid}/bakes").json()["bake_key"]
        up = Up(c, fid, key)
        assert up(img()).status_code == 201
        assert c.delete(f"/api/v1/floors/{fid}/bakes").status_code == 204
        assert c.get(f"/api/v1/floors/{fid}/bakes").json()["bakes"] == []
        assert up(img()).status_code == 201
        c.post(f"/api/v1/floors/{fid}/bakes/regenerate", json={})
        assert c.delete(f"/api/v1/floors/{fid}?force=true").status_code == 204
        assert not (settings.plans_dir / "bakes" / fid).exists()
        with app.state.db.connection() as conn:
            assert conn.execute("SELECT COUNT(*) FROM plan_bakes").fetchone()[0] == 0
            assert conn.execute("SELECT status FROM plan_bake_jobs").fetchone()[0] == "cancelled"
            d = json.loads(conn.execute("SELECT details_json FROM audit_log WHERE action = 'floor.delete'").fetchone()[0])
            assert d["bakes_deleted"] == 1


def test_backup_covers_the_bakes_and_a_restore_sweeps_orphans(settings):
    assert "plan_bakes" in backup_svc.PROJECT_TABLES and backup_svc.FILE_COLUMNS["plan_bakes"] == ["path"]
    assert "plan_bake_jobs" not in backup_svc.PROJECT_TABLES  # runtime state
    app = create_app(settings)
    with TestClient(app) as c:
        ids, _ = _floor_with_structure(c)
        fid = ids["floor2"]
        key = c.get(f"/api/v1/floors/{fid}/bakes").json()["bake_key"]
        data = img()
        assert Up(c, fid, key)(data).status_code == 201
        r = c.post("/api/v1/backups", json={})
        assert r.status_code in (200, 201), r.text
        name = r.json()["name"]
        # the file is in the archive under its row's path
        import zipfile
        with zipfile.ZipFile(settings.data_dir / "backups" / name) as z:
            rel = next(n for n in z.namelist() if "/bakes/" in n)
            assert z.read(rel) == data
        # lose the row and the file, restore: both come back
        with app.state.db.connection() as conn:
            path = conn.execute("SELECT path FROM plan_bakes").fetchone()[0]
            conn.execute("DELETE FROM plan_bakes")
        (settings.data_dir / path).unlink()
        rr = c.post(f"/api/v1/backups/{name}/restore", json={"mode": "replace", "confirm": "RESTORE"})
        assert rr.status_code == 200, rr.text
        assert (settings.data_dir / path).read_bytes() == data
        assert c.get(f"/api/v1/floors/{fid}/bakes").json()["bakes"][0]["sha256"]


def test_a_replace_restore_of_an_older_project_sweeps_bakes_of_floors_it_does_not_have(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        seed_tree(c)
        with app.state.db.connection() as conn:
            before = backup_svc.create(settings, conn)
        ids, _ = _floor_with_structure(c)  # a floor the archive does not have
        fid = ids["floor2"]
        key = c.get(f"/api/v1/floors/{fid}/bakes").json()["bake_key"]
        assert Up(c, fid, key)(img()).status_code == 201
        with app.state.db.connection() as conn:
            result = backup_svc.restore(settings, conn, backup_svc.backups_dir(settings) / before["name"], mode="replace")
            assert conn.execute("SELECT COUNT(*) FROM plan_bakes").fetchone()[0] == 0
        assert result["bakes_swept"] == 0  # the replace emptied the table; the folder is what the sweep removes
        assert not (settings.plans_dir / "bakes" / fid).exists()


def test_sweep_and_confinement(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        ids, _ = _floor_with_structure(c)
        fid = ids["floor2"]
        key = c.get(f"/api/v1/floors/{fid}/bakes").json()["bake_key"]
        assert Up(c, fid, key)(img()).status_code == 201
        stray = settings.plans_dir / "bakes" / fid / "still-0000-0000.webp"
        stray.write_bytes(b"x")
        ghost = settings.plans_dir / "bakes" / "ghostfloor"
        ghost.mkdir()
        (ghost / "a.png").write_bytes(b"x")
        canary = settings.data_dir / "canary.txt"
        canary.write_text("keep")
        with app.state.db.connection() as conn:
            conn.execute("INSERT INTO plan_bakes(id, floor_id, level_id, kind, bake_key, recipe, path, mime, bytes, sha256, created_at) VALUES ('p1', ?, 'L0', 'lightmap', ?, 'r', '../canary.txt', 'image/png', 1, 'x', 'now')", (fid, key))
            conn.execute("INSERT INTO plan_bake_jobs(id, floor_id, bake_key, scope_json, status, requested_at) VALUES ('j', ?, ?, '{}', 'requested', 'now')", (fid, key))
            assert pb.sweep_orphans(settings, conn) == 1  # the poisoned row goes, its path is never followed
            assert conn.execute("SELECT COUNT(*) FROM plan_bakes").fetchone()[0] == 1
        assert canary.read_text() == "keep" and not stray.exists() and not ghost.exists()
        for bad in ("../x", "/etc/passwd", "plans\\bakes\\x", ""):
            with pytest.raises(pb.BakeStoreError):
                pb.confine_stored(settings, bad)
        with pytest.raises(pb.BakeStoreError):
            pb.check_floor_id("../a")
