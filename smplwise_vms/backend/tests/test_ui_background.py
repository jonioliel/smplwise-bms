"""CRY (2026-10-10): the background behind the glass. `ui.background` (builtin | none | custom) is a product setting (system.configure,
audited, readable by everyone); the two picture slots are uploaded, served and removed through /settings/background/{day|night}
(re-encoded JPEG, stamps in `ui.background_images`); a user's own `ui.background` lives in /me/prefs; the pictures travel with a backup."""
from __future__ import annotations

import io
import json
import zipfile
from dataclasses import replace

from conftest import as_user, bind, png_bytes
from fastapi.testclient import TestClient
from PIL import Image

from smplwise.main import create_app


def _webp_bytes(w: int = 64, h: int = 40) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), (40, 80, 160)).save(buf, format="WEBP")
    return buf.getvalue()


def test_ui_background_setting_round_trips_is_audited_and_validated(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        s = c.get("/api/v1/settings").json()["settings"]
        assert s["ui.background"] == "builtin" and s["ui.background_images"] == {"day": None, "night": None}
        for mode in ("none", "custom", "builtin"):
            r = c.patch("/api/v1/settings", json={"ui.background": mode})
            assert r.status_code == 200, (mode, r.text)
            assert r.json()["settings"]["ui.background"] == mode
        for bad in ("photo", "Builtin", "", "custom "):
            assert c.patch("/api/v1/settings", json={"ui.background": bad}).status_code == 422, bad
        assert c.patch("/api/v1/settings", json={"ui.skin": "crystal", "ui.background": "none"}).status_code == 200
        assert c.get("/api/v1/settings").json()["settings"]["ui.skin"] == "crystal"
        with app.state.db.connection() as conn:
            rows = [json.loads(r[0] or "{}") for r in conn.execute("SELECT details_json FROM audit_log WHERE action = 'settings.update' AND decision = 'allowed' ORDER BY rowid").fetchall()]
        assert {"ui.skin": "crystal", "ui.background": "none"} in rows
        bind(c, settings, "dana", "viewer", "installation", "*")
        assert c.get("/api/v1/settings", headers=as_user("dana")).json()["settings"]["ui.background"] == "none"
        assert c.patch("/api/v1/settings", json={"ui.background": "builtin"}, headers=as_user("dana")).status_code == 403


def test_background_pictures_upload_serve_delete_permissions_and_audit(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        bind(c, settings, "dana", "viewer", "installation", "*")
        # nothing yet: 404 for both slots, an unknown slot is 404 too
        assert c.get("/api/v1/settings/background/day").status_code == 404
        assert c.get("/api/v1/settings/background/dusk").status_code == 404
        # a viewer may not upload; the administrator may (PNG, by content)
        assert c.post("/api/v1/settings/background/day", files={"file": ("d.png", png_bytes(), "image/png")}, headers=as_user("dana")).status_code == 403
        r = c.post("/api/v1/settings/background/day", files={"file": ("d.png", png_bytes(), "image/png")})
        assert r.status_code == 201, r.text
        stamps = r.json()["images"]
        assert stamps["day"] and stamps["night"] is None
        assert c.get("/api/v1/settings").json()["settings"]["ui.background_images"] == stamps
        # WebP is accepted and re-encoded as JPEG; a text file and a broken image are refused by content
        r = c.post("/api/v1/settings/background/night", files={"file": ("n.webp", _webp_bytes(), "image/webp")})
        assert r.status_code == 201 and r.json()["images"]["night"]
        assert c.post("/api/v1/settings/background/night", files={"file": ("n.png", b"not an image", "image/png")}).status_code == 415
        assert c.post("/api/v1/settings/background/night", files={"file": ("n.png", b"\x89PNG broken", "image/png")}).status_code == 422
        # everyone signed in reads the picture (the page paints it); it is a JPEG, privately cacheable
        g = c.get("/api/v1/settings/background/day", headers=as_user("dana"))
        assert g.status_code == 200 and g.headers["content-type"] == "image/jpeg" and "private" in g.headers["cache-control"]
        assert Image.open(io.BytesIO(g.content)).format == "JPEG"
        assert (settings.data_dir / "ui_backgrounds" / "day.jpg").is_file()
        # remove: the file goes, the stamp is cleared, the viewer may not
        assert c.delete("/api/v1/settings/background/day", headers=as_user("dana")).status_code == 403
        r = c.delete("/api/v1/settings/background/day")
        assert r.status_code == 200 and r.json()["images"]["day"] is None and r.json()["images"]["night"]
        assert c.get("/api/v1/settings/background/day").status_code == 404
        assert not (settings.data_dir / "ui_backgrounds" / "day.jpg").exists()
        with app.state.db.connection() as conn:
            rows = [json.loads(r[0] or "{}") for r in conn.execute("SELECT details_json FROM audit_log WHERE action = 'settings.update' AND decision = 'allowed' ORDER BY rowid").fetchall()]
        assert {"ui.background_images": {"day": True}} in rows and {"ui.background_images": {"night": True}} in rows and {"ui.background_images": {"day": False}} in rows


def test_background_upload_bounds_the_picture_and_refuses_oversize(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        big = io.BytesIO()
        Image.new("RGB", (3000, 1500), (200, 210, 230)).save(big, format="PNG")
        r = c.post("/api/v1/settings/background/day", files={"file": ("big.png", big.getvalue(), "image/png")})
        assert r.status_code == 201, r.text
        im = Image.open(io.BytesIO(c.get("/api/v1/settings/background/day").content))
        assert max(im.size) == 2560 and im.size[0] == 2560 and im.size[1] == 1280
        too_big = b"\x89PNG" + b"\0" * (12 * 1024 * 1024)
        assert c.post("/api/v1/settings/background/night", files={"file": ("x.png", too_big, "image/png")}).status_code == 413


def test_own_background_preference_round_trips_and_is_validated(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        body = c.get("/api/v1/me/prefs").json()
        assert body["prefs"]["ui.background"] is None and "ui.background" not in body["stored"]
        r = c.put("/api/v1/me/prefs", json={"ui.background": "none"})
        assert r.status_code == 200 and r.json()["prefs"]["ui.background"] == "none" and "ui.background" in r.json()["stored"]
        bind(c, settings, "dana", "viewer", "installation", "*")
        assert c.put("/api/v1/me/prefs", headers=as_user("dana"), json={"ui.background": "custom"}).json()["prefs"]["ui.background"] == "custom"
        assert c.get("/api/v1/me/prefs").json()["prefs"]["ui.background"] == "none"  # another user is untouched
        for bad in ("photo", "", 3, True):
            assert c.put("/api/v1/me/prefs", json={"ui.background": bad}).status_code == 422, bad
        r = c.put("/api/v1/me/prefs", json={"ui.background": None})
        assert r.status_code == 200 and r.json()["prefs"]["ui.background"] is None and "ui.background" not in r.json()["stored"]


def test_background_pictures_travel_with_a_backup(settings, tmp_path):
    app = create_app(settings)
    with TestClient(app) as c:
        assert c.post("/api/v1/settings/background/night", files={"file": ("n.png", png_bytes(), "image/png")}).status_code == 201
        assert c.patch("/api/v1/settings", json={"ui.background": "custom"}).status_code == 200
        e = c.post("/api/v1/backups", json={"note": "bg"}).json()
        raw = c.get(f"/api/v1/backups/{e['name']}/download").content
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        assert "files/ui_backgrounds/night.jpg" in z.namelist()
        assert "files/ui_backgrounds/day.jpg" not in z.namelist()
    settings2 = replace(settings, data_dir=tmp_path / "data2")
    app2 = create_app(settings2)
    with TestClient(app2) as c2:
        up = c2.post("/api/v1/backups/upload", files={"file": ("copy.zip", raw, "application/zip")})
        assert up.status_code == 201
        res = c2.post(f"/api/v1/backups/{up.json()['name']}/restore", json={"mode": "replace", "scope": "project", "confirm": "RESTORE"})
        assert res.status_code == 200, res.text
        s = c2.get("/api/v1/settings").json()["settings"]
        assert s["ui.background"] == "custom" and s["ui.background_images"]["night"] and s["ui.background_images"]["day"] is None
        assert c2.get("/api/v1/settings/background/night").status_code == 200
        assert (settings2.data_dir / "ui_backgrounds" / "night.jpg").is_file()
