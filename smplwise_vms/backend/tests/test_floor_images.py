"""K88: own floor images - upload (PNG/JPEG, limits, replace), the file route, the alignment, delete, the map bundle part,
path confinement, permissions, body limit and the backup round trip."""
from __future__ import annotations

import io
import json
import zipfile

from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient
from PIL import Image

from smplwise import body_limit as bl
from smplwise.main import create_app
from smplwise.services import floor_images as fi


def _jpeg(w=320, h=200) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), (200, 180, 120)).save(buf, format="JPEG")
    return buf.getvalue()


def _setup(settings):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    return app, c, ids


def _up(c, fid, variant, data, mime="image/png", **kw):
    return c.post(f"/api/v1/floors/{fid}/images", data={"variant": variant}, files={"file": (f"x.{mime.split('/')[1]}", data, mime)}, **kw)


def test_upload_list_file_replace_delete(settings):
    app, c, ids = _setup(settings)
    fid = ids["floor2"]
    assert c.get(f"/api/v1/floors/{fid}/images").json() == {"floor_id": fid, "images": {"off": None, "on": None}, "layout": {"corners": fi.DEFAULT_CORNERS, "opacity": 1.0, "updated_at": None, "aligned": False}}
    r = _up(c, fid, "off", png_bytes(320, 200))
    assert r.status_code == 201, r.text
    off = r.json()
    assert off["variant"] == "off" and off["width"] == 320 and off["height"] == 200 and off["mime"] == "image/png" and off["replaced"] is False
    assert off["url"].startswith(f"api/v1/floors/{fid}/images/off?v=")
    r = _up(c, fid, "on", _jpeg(), "image/jpeg")
    assert r.status_code == 201 and r.json()["mime"] == "image/jpeg"
    # the files are confined under plans/floor-images/<floor>/ and served back as uploaded
    with app.state.db.connection() as conn:
        paths = [r["path"] for r in conn.execute("SELECT path FROM floor_images ORDER BY variant").fetchall()]
    assert all(p.startswith(f"plans/floor-images/{fid}/") for p in paths) and all((settings.data_dir / p).exists() for p in paths)
    f = c.get(f"/api/v1/floors/{fid}/images/off")
    assert f.status_code == 200 and f.headers["content-type"] == "image/png" and f.content[:8] == b"\x89PNG\r\n\x1a\n"
    assert c.get(f"/api/v1/floors/{fid}/images/on").headers["content-type"] == "image/jpeg"
    assert c.get(f"/api/v1/floors/{fid}/images/night").status_code == 404
    # replacing removes the old file
    old_path = settings.data_dir / paths[0]
    r = _up(c, fid, "off", png_bytes(300, 300, (10, 20, 30)))
    assert r.status_code == 201 and r.json()["replaced"] is True and r.json()["width"] == 300
    assert not old_path.exists()
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM floor_images WHERE floor_id = ?", (fid,)).fetchone()[0] == 2
    # the map bundle carries both urls and the default alignment
    part = c.get(f"/api/v1/floors/{fid}/map").json()["floor_images"]
    assert part["off"] and part["on"] and part["corners"] == fi.DEFAULT_CORNERS and part["opacity"] == 1.0
    assert c.get(f"/api/v1/floors/{ids['floor3']}/map").json()["floor_images"] is None
    # delete one, then the other: the layout goes with the last image
    assert c.put(f"/api/v1/floors/{fid}/images/layout", json={"corners": [[0, 0], [0.9, 0.05], [0.95, 1], [0.02, 0.98]], "opacity": 0.8}).status_code == 200
    assert c.delete(f"/api/v1/floors/{fid}/images/on").status_code == 204
    assert c.get(f"/api/v1/floors/{fid}/images/on").status_code == 404
    assert c.get(f"/api/v1/floors/{fid}/images").json()["layout"]["aligned"] is True
    assert c.delete(f"/api/v1/floors/{fid}/images/off").status_code == 204
    assert c.delete(f"/api/v1/floors/{fid}/images/off").status_code == 404
    assert c.get(f"/api/v1/floors/{fid}/images").json()["layout"]["aligned"] is False
    assert not any((settings.data_dir / "plans" / "floor-images" / fid).glob("*"))
    with app.state.db.connection() as conn:
        actions = [r["action"] for r in conn.execute("SELECT action FROM audit_log WHERE action LIKE 'floor_image.%' ORDER BY rowid").fetchall()]
    assert actions == ["floor_image.upload", "floor_image.upload", "floor_image.upload", "floor_image.layout", "floor_image.delete", "floor_image.delete"]


def test_upload_refusals(settings):
    app, c, ids = _setup(settings)
    fid = ids["floor2"]
    assert _up(c, fid, "day", png_bytes()).status_code == 422
    r = _up(c, fid, "off", b"GIF89a" + b"\x00" * 200, "image/gif")
    assert r.status_code == 415 and r.json()["code"] == "unsupported_format"
    r = _up(c, fid, "off", b"\x89PNG\r\n\x1a\n" + b"\x00" * 300)
    assert r.status_code == 422 and r.json()["code"] == "corrupt_image"
    r = _up(c, fid, "off", png_bytes(32, 32))
    assert r.status_code == 422 and r.json()["code"] == "too_small"
    assert _up(c, "nope", "off", png_bytes()).status_code == 404
    # a layout before any image
    assert c.put(f"/api/v1/floors/{fid}/images/layout", json={"corners": fi.DEFAULT_CORNERS}).status_code == 409
    assert _up(c, fid, "off", png_bytes()).status_code == 201
    assert c.put(f"/api/v1/floors/{fid}/images/layout", json={"corners": [[0, 0], [1, 0], [1, 1]]}).status_code == 422
    assert c.put(f"/api/v1/floors/{fid}/images/layout", json={"corners": [[0, 0], [0, 0], [0, 0], [0, 0]]}).status_code == 422
    assert c.put(f"/api/v1/floors/{fid}/images/layout", json={"corners": [[0, 0], [5, 0], [5, 5], [0, 5]]}).status_code == 422
    assert c.put(f"/api/v1/floors/{fid}/images/layout", json={"corners": fi.DEFAULT_CORNERS, "opacity": 0.1}).status_code == 422
    r = c.put(f"/api/v1/floors/{fid}/images/layout", json={"corners": [[-0.1, 0], [1.1, 0], [1.1, 1], [-0.1, 1]], "opacity": 0.5})
    assert r.status_code == 200 and r.json()["corners"][0] == [-0.1, 0.0] and r.json()["opacity"] == 0.5 and r.json()["aligned"] is True


def test_validate_limits_and_confinement(settings, tmp_path):
    big = io.BytesIO()
    Image.new("L", (6100, 6100)).save(big, format="PNG")
    try:
        fi.validate(big.getvalue())
        raise AssertionError("expected too_many_pixels")
    except fi.FloorImageError as exc:
        assert exc.code == "too_many_pixels"
    try:
        fi.validate(b"\xff\xd8\xff" + b"\x00" * (fi.MAX_BYTES + 1))
        raise AssertionError("expected payload_too_large")
    except fi.FloorImageError as exc:
        assert exc.code == "payload_too_large"
    for bad in ("../x.png", "/abs/x.png", "plans/floor-images/../../db.sqlite", "skins/f/x.png", "plans\\floor-images\\f\\x.png"):
        try:
            fi.confine_stored(settings, bad)
            raise AssertionError(bad)
        except fi.FloorImageStoreError:
            pass
    for bad_id in ("../x", "a/b", "x.y", ""):
        try:
            fi.check_floor_id(bad_id)
            raise AssertionError(bad_id)
        except fi.FloorImageStoreError:
            pass


def test_body_limit_rule(settings):
    scope = {"type": "http", "method": "POST", "path": "/api/v1/floors/f1/images", "root_path": ""}
    limit, name = bl.limit_for(scope, settings)
    assert name == "floor_image" and limit == fi.MAX_BYTES + bl.MULTIPART_SLACK
    scope["method"] = "PUT"
    scope["path"] = "/api/v1/floors/f1/images/layout"
    assert bl.limit_for(scope, settings)[1] == "default"


def test_permissions(settings):
    app, c, ids = _setup(settings)
    fid = ids["floor2"]
    assert _up(c, fid, "off", png_bytes()).status_code == 201
    bind(c, settings, "ron", "viewer", "floor", fid)
    h = as_user("ron")
    assert c.get(f"/api/v1/floors/{fid}/images", headers=h).status_code == 200
    assert c.get(f"/api/v1/floors/{fid}/images/off", headers=h).status_code == 200
    assert c.get(f"/api/v1/floors/{ids['floor3']}/images", headers=h).status_code == 403
    assert _up(c, fid, "on", png_bytes(), headers=h).status_code == 403
    assert c.put(f"/api/v1/floors/{fid}/images/layout", json={"corners": fi.DEFAULT_CORNERS}, headers=h).status_code == 403
    assert c.delete(f"/api/v1/floors/{fid}/images/off", headers=h).status_code == 403
    bind(c, settings, "dana", "editor", "floor", fid)
    assert _up(c, fid, "on", png_bytes(), headers=as_user("dana")).status_code == 201


def test_backup_round_trip(settings):
    app, c, ids = _setup(settings)
    fid = ids["floor2"]
    assert _up(c, fid, "off", png_bytes()).status_code == 201
    assert c.put(f"/api/v1/floors/{fid}/images/layout", json={"corners": [[0, 0], [0.9, 0], [0.9, 0.9], [0, 0.9]]}).status_code == 200
    r = c.post("/api/v1/backups", json={"note": "k88"})
    assert r.status_code == 201, r.text
    e = r.json()
    assert e["tables"]["floor_images"] == 1 and e["tables"]["floor_image_layout"] == 1
    d = c.get(f"/api/v1/backups/{e['name']}/download")
    with zipfile.ZipFile(io.BytesIO(d.content)) as z:
        names = z.namelist()
    assert any(n.startswith(f"files/plans/floor-images/{fid}/") for n in names), names
    name = e["name"]
    # wipe and restore: rows and the file come back
    assert c.delete(f"/api/v1/floors/{fid}/images/off").status_code == 204
    assert c.get(f"/api/v1/floors/{fid}/images/off").status_code == 404
    r = c.post(f"/api/v1/backups/{name}/restore", json={"mode": "replace", "scope": "project", "confirm": "RESTORE"})
    assert r.status_code == 200, r.text
    assert c.get(f"/api/v1/floors/{fid}/images/off").status_code == 200
    assert c.get(f"/api/v1/floors/{fid}/images").json()["layout"]["corners"] == [[0, 0], [0.9, 0], [0.9, 0.9], [0, 0.9]]
