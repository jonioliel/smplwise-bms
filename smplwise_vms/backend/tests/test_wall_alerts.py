"""CR-030 v2 (WDX): wall alert tiles (the notification core's open rows, filtered and scoped by the profile) and the photo
frame (own photo sets, EXIF stripped renditions, no source outside the product's folder)."""
from __future__ import annotations

import io

from conftest import as_user
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import notify

W = as_user("wall")
ADMIN = as_user("joni")


def _setup(settings):
    app = create_app(settings)
    c = TestClient(app)
    c.get("/api/v1/me", headers=ADMIN)
    c.get("/api/v1/me", headers=W)
    cams = [c.post("/api/v1/cameras", json={"channel": n, "alias": f"cam{n}"}).json()["id"] for n in (1, 2, 3)]
    r = c.post("/api/v1/wall/profiles", json={"user_id": "dev-wall", "title": "קבלה", "cameras": cams[:2]}, headers=ADMIN)
    assert r.status_code == 201, r.text
    return app, c, cams


def _emit(app, source, kind, subject, **kw):
    with app.state.db.connection() as conn:
        return notify.emit(conn, notify.Signal(source=source, subject_kind=kind, subject_id=subject, **kw))


def _patch(c, **cfg):
    r = c.patch("/api/v1/wall/profiles/dev-wall", json={"config": cfg}, headers=ADMIN)
    assert r.status_code == 200, r.text
    return r.json()


def test_alerts_are_scoped_to_the_cameras_and_filtered_by_the_profile(settings):
    app, c, cams = _setup(settings)
    own = _emit(app, "camera.offline", "camera", cams[0], params={"name": "cam1"})
    _emit(app, "camera.offline", "camera", cams[2], params={"name": "cam3"})  # not on this display
    _emit(app, "backup.failed", "system", "backup")  # a system row never reaches a wall
    got = c.get("/api/v1/wall/alerts", headers=W).json()["alerts"]
    assert [a["id"] for a in got] == [own] and got[0]["severity"] == "alert" and got[0]["camera_id"] == cams[0]
    assert c.get("/api/v1/wall/config", headers=W).json()["alerts"][0]["id"] == own
    _patch(c, alerts={"min_severity": "critical"})
    assert c.get("/api/v1/wall/alerts", headers=W).json()["alerts"] == []
    _patch(c, alerts={"min_severity": "alert", "categories": ["safety"]})
    assert c.get("/api/v1/wall/alerts", headers=W).json()["alerts"] == [], "category filter"
    _patch(c, alerts={"categories": ["device_faults"], "enabled": False})
    assert c.get("/api/v1/wall/alerts", headers=W).json()["alerts"] == [], "alerts off"


def test_nvr_fault_is_installation_wide_and_resolve_removes(settings):
    app, c, cams = _setup(settings)
    nid = _emit(app, "nvr.offline", "system", "nvr")
    assert [a["id"] for a in c.get("/api/v1/wall/alerts", headers=W).json()["alerts"]] == [nid]
    _emit(app, "nvr.offline", "system", "nvr", resolve=True)
    assert c.get("/api/v1/wall/alerts", headers=W).json()["alerts"] == []


def test_critical_sorts_first_and_place_scope(settings):
    app, c, cams = _setup(settings)
    _emit(app, "camera.offline", "camera", cams[0], params={"name": "cam1"})
    leak = _emit(app, "sensor.leak", "entity", "binary_sensor.leak", params={"name": "leak"}, area_id="area-x")
    got = c.get("/api/v1/wall/alerts", headers=W).json()["alerts"]
    assert got[0]["id"] == leak and got[0]["severity"] == "critical"
    c.patch("/api/v1/wall/profiles/dev-wall", json={"area_id": "area-y"}, headers=ADMIN)
    assert leak not in [a["id"] for a in c.get("/api/v1/wall/alerts", headers=W).json()["alerts"]], "a place subject outside the display's area"


def test_ack_needs_the_profile_flag_and_audits_the_wall_user(settings):
    app, c, cams = _setup(settings)
    nid = _emit(app, "camera.offline", "camera", cams[0], params={"name": "cam1"})
    assert c.post(f"/api/v1/wall/alerts/{nid}/ack", headers=W).status_code == 403, "ack is off by default"
    assert c.post(f"/api/v1/wall/alerts/{nid}/seen", headers=W).status_code == 200
    _patch(c, alerts={"ack_allowed": True})
    other = _emit(app, "camera.offline", "camera", cams[2], params={"name": "cam3"})
    assert c.post(f"/api/v1/wall/alerts/{other}/ack", headers=W).status_code == 404, "not this display's alert"
    assert c.post(f"/api/v1/wall/alerts/{nid}/ack", headers=W).json()["acknowledged"] is True
    assert c.get("/api/v1/wall/alerts", headers=W).json()["alerts"] == []
    with app.state.db.connection() as conn:
        row = conn.execute("SELECT actor_user_id, details_json FROM audit_log WHERE action = 'wall.alert.ack'").fetchone()
        n = conn.execute("SELECT state, acked_by FROM notifications WHERE id = ?", (nid,)).fetchone()
    assert row["actor_user_id"] == "dev-wall" and "wall" in row["details_json"]
    assert n["state"] == "acknowledged" and n["acked_by"] == "dev-wall"
    assert c.get("/api/v1/wall/alerts", headers=ADMIN).status_code == 403, "an admin who is not a wall user gets nothing"


def test_websocket_pushes_alerts(settings):
    app, c, cams = _setup(settings)
    with c.websocket_connect("/api/v1/wall/ws", headers=W) as ws:
        assert ws.receive_json()["type"] == "hello"
        nid = _emit(app, "camera.offline", "camera", cams[0], params={"name": "cam1"})
        for _ in range(6):
            msg = ws.receive_json()
            if msg["type"] == "alerts":
                assert [a["id"] for a in msg["payload"]["alerts"]] == [nid]
                break
        else:
            raise AssertionError("no alerts frame")


def _png(w=64, h=48, exif=False):
    from PIL import Image

    im = Image.new("RGB", (w, h), (200, 30, 30))
    buf = io.BytesIO()
    if exif:
        e = Image.Exif()
        e[0x010F] = "SecretMaker"
        im.save(buf, "JPEG", exif=e)
    else:
        im.save(buf, "PNG")
    return buf.getvalue()


def _mk_set(c, name="משפחה"):
    r = c.post("/api/v1/wall/photo-sets", json={"name": name}, headers=ADMIN)
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _up(c, sid, data, name="a.jpg", ctype="image/jpeg", who=ADMIN):
    return c.post(f"/api/v1/wall/photo-sets/{sid}/upload", files={"file": (name, data, ctype)}, headers=who)


def test_photo_upload_strips_exif_and_limits(settings):
    app, c, cams = _setup(settings)
    sid = _mk_set(c)
    assert _up(c, sid, _png(), who=W).status_code == 403, "admins only"
    r = _up(c, sid, _png(3000, 100, exif=True))
    assert r.status_code == 201, r.text
    assert r.json()["w"] == 1920, "1920-wide rendition"
    pid = r.json()["id"]
    data = c.get(f"/api/v1/wall/photo-sets/{sid}/photos/{pid}", headers=ADMIN).content
    assert b"SecretMaker" not in data and b"Exif" not in data
    assert _up(c, sid, b"not an image").status_code == 422
    from PIL import Image

    gif = io.BytesIO()
    Image.new("RGB", (8, 8)).save(gif, "GIF")
    assert _up(c, sid, gif.getvalue(), "x.gif", "image/gif").status_code == 415
    assert _up(c, sid, b"0" * (8 * 1024 * 1024 + 10)).status_code == 413
    sets = c.get("/api/v1/wall/photo-sets", headers=ADMIN).json()["sets"]
    assert sets[0]["count"] == 1 and sets[0]["name"] == "משפחה"


def test_frame_serves_only_the_profiles_own_set(settings):
    app, c, cams = _setup(settings)
    sid = _mk_set(c)
    other = _mk_set(c, "אחר")
    pid = _up(c, sid, _png()).json()["id"]
    opid = _up(c, other, _png()).json()["id"]
    assert c.get("/api/v1/wall/frame/list", headers=W).json()["photos"] == [], "frame off"
    for folder in ("../etc", "/share", "media-source://media_source/local/x", "snapshots"):
        r = c.patch("/api/v1/wall/profiles/dev-wall", json={"config": {"frame": {"enabled": True, "folder": folder}}}, headers=ADMIN)
        assert r.status_code in (403, 422), (folder, r.status_code)
    assert c.patch("/api/v1/wall/profiles/dev-wall", json={"config": {"frame": {"enabled": True}}}, headers=ADMIN).status_code == 422, "enabled needs a folder"
    _patch(c, frame={"enabled": True, "folder": sid})
    lst = c.get("/api/v1/wall/frame/list", headers=W).json()["photos"]
    assert [p["id"] for p in lst] == [pid]
    got = c.get(f"/api/v1/wall/frame/{pid}", headers=W)
    assert got.status_code == 200 and got.headers["content-type"] == "image/jpeg"
    assert c.get(f"/api/v1/wall/frame/{opid}", headers=W).status_code == 404, "another set's photo"
    assert c.get("/api/v1/wall/frame/..%2f..%2fsmplwise.db", headers=W).status_code == 404
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT 1 FROM audit_log WHERE action = 'wall.frame.folder_set'").fetchone() is not None
    # deleting the set turns the frame off and moves the version
    v = c.get("/api/v1/wall/profiles/dev-wall", headers=ADMIN).json()["version"]
    d = c.delete(f"/api/v1/wall/photo-sets/{sid}", headers=ADMIN).json()
    assert d["profiles_turned_off"] == 1
    p = c.get("/api/v1/wall/profiles/dev-wall", headers=ADMIN).json()
    assert p["version"] == v + 1 and p["config"]["frame"]["enabled"] is False and p["config"]["frame"]["folder"] is None
    assert c.get(f"/api/v1/wall/frame/{pid}", headers=W).status_code == 404


def test_photo_set_ids_are_plain(settings):
    app, c, cams = _setup(settings)
    sid = _mk_set(c)
    for bad in ("A", "x" * 60, "..%2fx"):
        assert c.get(f"/api/v1/wall/photo-sets/{bad}/photos", headers=ADMIN).status_code in (403, 404, 422)
    assert c.delete(f"/api/v1/wall/photo-sets/{sid}/photos/zzzz", headers=ADMIN).status_code == 404
