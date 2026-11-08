"""CAMERA-STREAM-SOURCES-2410 (owner decision 08.11): a camera's video source - "from the recorder" (the default, unchanged) or
"manual address" (its own RTSP addresses, sealed in the database) - and the cameras without a recorder (live + snapshots only).

go2rtc is the REAL adapter (services/go2rtc.py) over an httpx MockTransport that records every request (streams, frames, probes) and
holds the other project's streams, which must never be touched. Names resolve through a fixed table (no real DNS). The camera
addresses, users and passwords are made up (192.0.2.0/24, TEST-NET-1); every test that can leak a secret greps for it."""
from __future__ import annotations

import datetime as dt
import io
import json
import logging
import sqlite3
import time
from dataclasses import replace

import httpx
import pytest
from conftest import as_user
from fastapi.testclient import TestClient
from PIL import Image

from smplwise.main import create_app
from smplwise.routers import media
from smplwise.services import camera_sources as cs
from smplwise.services import connection_store
from smplwise.services import go2rtc as g2
from smplwise.services import source_policy as sp

API = "/api/v1"
GO2RTC = "http://go2rtc.test:1984"
USER, PASSWORD, HOST = "cam-admin", "Sx-91-pass", "192.0.2.71"
MAIN = f"rtsp://{USER}:{PASSWORD}@{HOST}:554/Streaming/Channels/101"
SUB = f"rtsp://{USER}:{PASSWORD}@{HOST}:554/Streaming/Channels/102"
TOKEN = "qtok-55aa"
SECRETS = (PASSWORD, TOKEN)
DNS = {"127.0.0.1.nip.io": ["127.0.0.1"], "cam.lan": ["192.0.2.72"], "go2rtc.test": ["192.0.2.10"]}
FOREIGN = {
    "door-1": "rtsp://intercom:pw@203.0.113.5/1",  # the other project's stream
    "smplwise_nvr-1_ch1_sub": "rtsp://nvr-user:nvr-pw@203.0.113.9/Streaming/Channels/102",
}


def jpeg(w: int = 320, h: int = 240) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), (90, 120, 150)).save(buf, format="JPEG")
    return buf.getvalue()


class FakeGo2rtc:
    """go2rtc's HTTP API: GET/PUT/DELETE /api/streams and GET /api/frame.jpeg (by name, or a raw source + name = an in-memory stream).
    A source whose host is in `refuse` answers 500 with go2rtc's own words for it."""

    def __init__(self) -> None:
        self.store: dict[str, list[str]] = {n: [s] for n, s in FOREIGN.items()}
        self.requests: list[tuple[str, str, dict[str, str]]] = []
        self.refuse: dict[str, str] = {}  # host -> go2rtc's error text
        self.size = (320, 240)

    def _answer_frame(self, src: str) -> httpx.Response:
        for host, text in self.refuse.items():
            if host in src:
                return httpx.Response(500, text=f"{text} {src}")  # go2rtc echoes the source: it must never reach a caller
        return httpx.Response(200, content=jpeg(*self.size), headers={"content-type": "image/jpeg"})

    def handler(self, request: httpx.Request) -> httpx.Response:
        params = dict(request.url.params)
        self.requests.append((request.method, request.url.path, params))
        path = request.url.path
        if path == "/api" and request.method == "GET":
            return httpx.Response(200, json={"version": "1.9.14-fake"})
        if path == "/api/frame.jpeg":
            src, name = params.get("src", ""), params.get("name")
            if name:  # a raw source registers an in-memory stream
                self.store[name] = [src]
                return self._answer_frame(src)
            if src not in self.store:
                return httpx.Response(404, text="stream not found")
            return self._answer_frame(self.store[src][0])
        if path != "/api/streams":
            return httpx.Response(404)
        if request.method == "GET":
            if "src" in params:
                return httpx.Response(200 if params["src"] in self.store else 404, json={})
            return httpx.Response(200, json={n: {"producers": [{"url": s, "medias": ["video, recvonly, H264"]} for s in srcs]} for n, srcs in self.store.items()})
        if request.method == "PUT":
            self.store[params["name"]] = [params["src"]]
            return httpx.Response(200)
        if request.method == "DELETE":
            self.store.pop(params["src"], None)
            return httpx.Response(200)
        return httpx.Response(405)

    def writes(self) -> list[tuple[str, str]]:
        return [(m, p.get("name") or p.get("src") or "") for m, path, p in self.requests if m in ("PUT", "DELETE")]


class World:
    pass


@pytest.fixture()
def world(settings, monkeypatch):
    s = replace(settings, go2rtc_url=GO2RTC)
    app = create_app(s)
    c = TestClient(app)
    go = FakeGo2rtc()
    real = httpx.Client

    def factory(**kw):
        if str(kw.get("base_url", "")).rstrip("/") == GO2RTC:
            return real(transport=httpx.MockTransport(go.handler), **kw)
        return real(**kw)

    monkeypatch.setattr(g2.httpx, "Client", factory)
    monkeypatch.setattr(sp, "resolve_host", lambda host, timeout=2.0: list(DNS.get(host, [])))
    sp._RESOLVED.clear()
    sp._RESOLVED["go2rtc.test"] = (time.monotonic(), frozenset({"192.0.2.10"}))  # where go2rtc runs (go2rtc_targets resolves it itself)
    cs.reset_health()
    cs._TESTS.clear()
    cs._WRITTEN.clear()
    cs._last_reconcile = 0.0
    monkeypatch.setattr(cs, "WRITE_GRACE_S", 0.0)
    nvr_cam = c.post(f"{API}/cameras", json={"channel": 1, "alias": "כניסה"})
    assert nvr_cam.status_code == 201, nvr_cam.text
    w = World()
    w.app, w.s, w.c, w.go, w.nvr_cam = app, s, c, go, nvr_cam.json()["id"]
    yield w
    cs.reset_health()


def db_dump(app) -> str:
    with app.state.db.connection(mode="read") as conn:
        out = []
        for (name,) in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall():
            try:
                out.extend(str(tuple(r)) for r in conn.execute(f'SELECT * FROM "{name}"').fetchall())
            except sqlite3.Error:
                pass
        return "\n".join(out)


def audit_rows(app, action: str) -> list[dict]:
    with app.state.db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY rowid", (action,)).fetchall()]


def no_secret(text: str, where: str = "") -> None:
    for part in SECRETS:
        assert part not in text, f"{part!r} leaked {where}"


def add_standalone(w, name="חניה אחורית", main=MAIN, sub=SUB, area="parking", headers=None):
    return w.c.post(f"{API}/cameras/standalone", json={"name": name, "area_id": area, "main_url": main, "sub_url": sub}, headers=headers)


def cam_row(w, camera_id):
    with w.app.state.db.connection(mode="read") as conn:
        return cs.with_source(conn, conn.execute("SELECT * FROM cameras WHERE id = ?", (camera_id,)).fetchone())


# ---------------------------------------------------------------- the default is unchanged

def test_default_source_is_the_recorder_and_the_list_only_gains_fields(world):
    body = world.c.get(f"{API}/cameras").json()
    cam = next(c for c in body["cameras"] if c["id"] == world.nvr_cam)
    assert cam["video_source"] == "nvr" and cam["standalone"] is False and "area_id" not in cam
    for key in ("id", "recorder_id", "channel", "name", "status", "can_view_live", "recorder_enabled"):
        assert key in cam  # nothing renamed
    src = world.c.get(f"{API}/cameras/{world.nvr_cam}/source").json()
    assert src["mode"] == "nvr" and src["main"] is None and src["sub"] is None and src["revision"] == 0
    with world.app.state.db.connection(mode="read") as conn:
        row = conn.execute("SELECT * FROM cameras WHERE id = ?", (world.nvr_cam,)).fetchone()
        assert cs.with_source(conn, row) is row  # the recorder's camera row reaches the live path untouched
    assert media._base_name(row, "sub") == "smplwise_nvr-1_ch1_sub"


# ---------------------------------------------------------------- permission and audit

@pytest.mark.parametrize("method, path, body", [
    ("GET", "/cameras/{cam}/source", None),
    ("PUT", "/cameras/{cam}/source", {"mode": "manual", "main_url": MAIN}),
    ("POST", "/cameras/source/test", {"url": MAIN}),
    ("POST", "/cameras/standalone", {"name": "x", "main_url": MAIN}),
    ("DELETE", "/cameras/standalone/{cam}", None),
])
def test_every_route_needs_system_configure_and_the_refusal_is_audited(world, method, path, body):
    world.c.get(f"{API}/me", headers=as_user("guard"))
    r = world.c.request(method, API + path.format(cam=world.nvr_cam), json=body, headers=as_user("guard"))
    assert r.status_code == 403, r.text
    rows = audit_rows(world.app, "system.configure")
    assert rows and rows[-1]["decision"] == "denied" and rows[-1]["actor_username"] == "guard"
    no_secret(json.dumps(rows, default=str), "in the denial's audit row")
    assert not [w for w in world.go.writes() if w[1].startswith(cs.STREAM_PREFIX)]


def test_a_refused_caller_gets_the_403_before_the_body_is_read(world):
    world.c.get(f"{API}/me", headers=as_user("guard"))
    r = world.c.put(f"{API}/cameras/{world.nvr_cam}/source", content=b"not json at all", headers={**as_user("guard"), "content-type": "text/plain"})
    assert r.status_code == 403


# ---------------------------------------------------------------- saving: sealed, masked, never returned

def test_a_manual_source_is_sealed_masked_and_audited_without_the_address(world, caplog):
    caplog.set_level(logging.DEBUG)
    r = world.c.put(f"{API}/cameras/{world.nvr_cam}/source", json={"mode": "manual", "main_url": MAIN + f"?token={TOKEN}", "sub_url": SUB})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["mode"] == "manual" and body["revision"] == 1 and body["standalone"] is False
    assert body["main"] == {"url": f"rtsp://{USER}:***@{HOST}:554/Streaming/Channels/101?token=***", "has_password": True}
    assert body["sub"] == {"url": f"rtsp://{USER}:***@{HOST}:554/Streaming/Channels/102", "has_password": True}
    no_secret(r.text, "in the answer")
    no_secret(db_dump(world.app), "in the database")
    no_secret(caplog.text, "in a log line")
    rows = audit_rows(world.app, "camera.source.update")
    assert rows[-1]["decision"] == "allowed" and json.loads(rows[-1]["details_json"]) == {"mode": "manual", "main": True, "sub": True, "address_changed": True, "revision": 1}
    assert HOST not in json.dumps(rows, default=str) and USER not in json.dumps(rows, default=str)
    with world.app.state.db.connection(mode="read") as conn:
        row = cs.get_row(conn, world.nvr_cam)
    assert row["main_url_enc"].startswith("v1:")
    assert cs.open_urls(world.s, dict(row)) == {"main": MAIN + f"?token={TOKEN}", "sub": SUB}
    listed = world.c.get(f"{API}/cameras").json()["cameras"]
    assert next(c for c in listed if c["id"] == world.nvr_cam)["video_source"] == "manual"


def test_the_sealed_address_does_not_open_for_another_camera_or_profile(world):
    blob = connection_store.seal_camera_source(world.s.data_dir, "cam1", "main", MAIN)
    assert connection_store.open_camera_source(world.s.data_dir, "cam1", "main", blob) == MAIN
    for cid, profile in (("cam2", "main"), ("cam1", "sub")):
        with pytest.raises(connection_store.SecretError):
            connection_store.open_camera_source(world.s.data_dir, cid, profile, blob)
    with pytest.raises(connection_store.SecretError):
        connection_store.seal_camera_source(world.s.data_dir, "a|b", "main", MAIN)


def test_one_address_serves_both_profiles(world):
    r = world.c.put(f"{API}/cameras/{world.nvr_cam}/source", json={"mode": "manual", "sub_url": SUB})
    assert r.status_code == 200 and r.json()["main"] is None
    with world.app.state.db.connection(mode="read") as conn:
        assert cs.open_urls(world.s, dict(cs.get_row(conn, world.nvr_cam))) == {"main": SUB, "sub": SUB}


def test_the_masked_address_sent_back_keeps_the_stored_secret(world):
    first = world.c.put(f"{API}/cameras/{world.nvr_cam}/source", json={"mode": "manual", "main_url": MAIN + f"?token={TOKEN}", "sub_url": SUB}).json()
    again = world.c.put(f"{API}/cameras/{world.nvr_cam}/source", json={"mode": "manual", "main_url": first["main"]["url"], "sub_url": first["sub"]["url"],
                                                                         "if_revision": 1})
    assert again.status_code == 200, again.text
    assert again.json()["revision"] == 2
    assert json.loads(audit_rows(world.app, "camera.source.update")[-1]["details_json"])["address_changed"] is False
    with world.app.state.db.connection(mode="read") as conn:
        assert cs.open_urls(world.s, dict(cs.get_row(conn, world.nvr_cam)))["main"] == MAIN + f"?token={TOKEN}"
    # a new path on the same host with the password still masked: the stored password is kept
    moved = first["main"]["url"].replace("/101", "/201")
    assert world.c.put(f"{API}/cameras/{world.nvr_cam}/source", json={"mode": "manual", "main_url": moved}).status_code == 200
    with world.app.state.db.connection(mode="read") as conn:
        assert cs.open_urls(world.s, dict(cs.get_row(conn, world.nvr_cam)))["main"] == f"rtsp://{USER}:{PASSWORD}@{HOST}:554/Streaming/Channels/201?token={TOKEN}"


def test_a_masked_password_never_travels_to_another_host(world):
    first = world.c.put(f"{API}/cameras/{world.nvr_cam}/source", json={"mode": "manual", "main_url": MAIN}).json()
    r = world.c.put(f"{API}/cameras/{world.nvr_cam}/source", json={"mode": "manual", "main_url": first["main"]["url"].replace(HOST, "192.0.2.99")})
    assert r.status_code == 422 and r.json()["code"] == "password_reenter"
    assert audit_rows(world.app, "camera.source.update")[-1]["decision"] == "denied"
    with world.app.state.db.connection(mode="read") as conn:
        assert cs.open_urls(world.s, dict(cs.get_row(conn, world.nvr_cam)))["main"] == MAIN  # unchanged


def test_a_stale_revision_is_refused(world):
    world.c.put(f"{API}/cameras/{world.nvr_cam}/source", json={"mode": "manual", "main_url": MAIN})
    r = world.c.put(f"{API}/cameras/{world.nvr_cam}/source", json={"mode": "manual", "main_url": SUB, "if_revision": 0})
    assert r.status_code == 409 and r.json()["code"] == "stale"


def test_mask_and_merge_units():
    assert cs.mask("rtsp://u:p@h/x") == ("rtsp://u:***@h/x", True)
    assert cs.mask("rtsp://u@h/x") == ("rtsp://u@h/x", False)
    assert cs.mask("rtsp://h:554/x?channel=1&password=zz") == ("rtsp://h:554/x?channel=1&password=***", True)
    assert cs.merge("rtsp://u:***@h/y", "rtsp://u:p@h/x") == "rtsp://u:p@h/y"
    assert cs.merge("rtsp://v:***@h/y", "rtsp://u:p@h/x") == "rtsp://v:p@h/y"  # a renamed user on the same host keeps the password
    for new, stored in (("rtsp://u:***@other/y", "rtsp://u:p@h/x"), ("rtsp://u:***@h:555/x", "rtsp://u:p@h/x"), ("rtsp://u:***@h/x", None),
                        ("rtsp://u:***@h/x", "rtsp://u@h/x"), ("rtsp://h/x?pwd=***", "rtsp://h/x")):
        with pytest.raises(Exception) as exc:
            cs.merge(new, stored)
        assert getattr(exc.value, "code", "") == "password_reenter"


# ---------------------------------------------------------------- the source policy on every new route

REFUSED = [
    ("rtsp://127.0.0.1/live", "source_not_allowed"),
    ("rtsp://u:p@127.1:554/live", "source_not_allowed"),
    ("rtsp://[::1]/live", "source_not_allowed"),
    ("rtsp://169.254.10.10/live", "source_not_allowed"),
    ("rtsp://localhost/live", "source_not_allowed"),
    ("rtsp://127.0.0.1.nip.io/live", "source_not_allowed"),  # a name that resolves to loopback
    ("rtsp://go2rtc.test:8554/door-1", "source_not_allowed"),  # go2rtc's own RTSP restream of another project's stream
    ("rtsp://192.0.2.10:1984/api", "source_not_allowed"),  # go2rtc's address on its API port
    ("rtsp://cam.lan/x?src=door-1", "source_not_allowed"),
    ("http://192.0.2.71/video.mjpg", "source_not_supported"),
    ("ffmpeg:rtsp://192.0.2.71/x#video=h264", "source_not_supported"),
    ("exec:/bin/sh", "source_not_supported"),
]


@pytest.mark.parametrize("url, code", REFUSED)
def test_every_new_route_refuses_what_the_source_policy_refuses(world, url, code):
    r = world.c.put(f"{API}/cameras/{world.nvr_cam}/source", json={"mode": "manual", "main_url": url})
    assert r.status_code == 422 and r.json()["code"] == code, r.text
    t = world.c.post(f"{API}/cameras/source/test", json={"url": url})
    assert t.status_code == 422 and t.json()["code"] == code, t.text
    a = add_standalone(world, main=url, sub=None)
    assert a.status_code == 422 and a.json()["code"] == code, a.text
    for action in ("camera.source.update", "camera.source.test", "camera.standalone.create"):
        rows = audit_rows(world.app, action)
        assert rows and rows[-1]["decision"] == "denied" and rows[-1]["reason"] == code, action
    assert not [w for w in world.go.writes() if w[0] == "PUT"]  # nothing reached go2rtc
    assert not any(r[1] == "/api/frame.jpeg" for r in world.go.requests)
    with world.app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM camera_stream_sources").fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM cameras WHERE recorder_id = 'standalone'").fetchone()[0] == 0


def test_an_address_naming_a_foreign_go2rtc_stream_is_refused_at_test_and_write_time(world):
    t = world.c.post(f"{API}/cameras/source/test", json={"url": "rtsp://cam.lan:554/door-1"})
    assert t.status_code == 422 and t.json()["code"] == "source_not_allowed"
    assert not any(r[1] == "/api/frame.jpeg" for r in world.go.requests)
    # stored (the name check needs go2rtc's list, which only the write sees): the stream is never written
    assert world.c.put(f"{API}/cameras/{world.nvr_cam}/source", json={"mode": "manual", "main_url": "rtsp://cam.lan:554/Door-1"}).status_code == 200
    with pytest.raises(Exception) as exc:
        media.ensure_camera_stream(world.s, cam_row(world, world.nvr_cam), "sub")
    assert exc.value.code == "source_not_allowed"
    assert not [w for w in world.go.writes() if w[0] == "PUT"]
    assert world.go.store["door-1"] == [FOREIGN["door-1"]]


# ---------------------------------------------------------------- "test stream"

def test_the_stream_test_returns_a_preview_and_leaves_nothing_behind(world, caplog):
    caplog.set_level(logging.DEBUG)
    world.go.size = (1920, 1080)
    r = world.c.post(f"{API}/cameras/source/test", json={"url": MAIN, "profile": "main"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ok"] is True and (body["width"], body["height"]) == (1920, 1080) and body["preview"].startswith("data:image/jpeg;base64,")
    no_secret(r.text, "in the answer")
    no_secret(caplog.text, "in a log line")
    probes = [n for n in world.go.store if n.startswith(cs.PROBE_PREFIX)]
    assert probes == []  # the throwaway stream was deleted
    assert set(world.go.store) == set(FOREIGN)  # nothing else was created or touched
    deleted = [w[1] for w in world.go.writes() if w[0] == "DELETE"]
    assert deleted and all(n.startswith(cs.PROBE_PREFIX) for n in deleted)
    rows = audit_rows(world.app, "camera.source.test")
    assert json.loads(rows[-1]["details_json"]) == {"profile": "main", "outcome": "ok"}


@pytest.mark.parametrize("text, code", [("401 Unauthorized", "auth_failed"), ("dial tcp: i/o timeout", "unreachable"), ("404 Not Found", "path_not_found"),
                                        ("streams: unexpected", "no_video")])
def test_a_failing_stream_test_says_why_in_hebrew_and_never_echoes_go2rtc(world, text, code):
    world.go.refuse[HOST] = text
    r = world.c.post(f"{API}/cameras/source/test", json={"url": MAIN})
    assert r.status_code == 200
    body = r.json()
    assert body == {"ok": False, "code": code, "message": cs.TEST_TEXT[code]}
    no_secret(r.text, "in a failed test")
    assert HOST not in r.text


def test_the_test_of_a_saved_camera_completes_the_masked_address_and_records_the_codec(world):
    saved = world.c.put(f"{API}/cameras/{world.nvr_cam}/source", json={"mode": "manual", "main_url": MAIN}).json()
    r = world.c.post(f"{API}/cameras/source/test", json={"url": saved["main"]["url"], "camera_id": world.nvr_cam, "profile": "main"})
    assert r.status_code == 200 and r.json()["ok"] is True
    # the probe stream got the full stored address (the password came from the database, never from the screen)
    probes = [p for m, path, p in world.go.requests if path == "/api/frame.jpeg" and p.get("name", "").startswith(cs.PROBE_PREFIX)]
    assert probes and probes[-1]["src"] == MAIN
    src = world.c.get(f"{API}/cameras/{world.nvr_cam}/source").json()
    assert src["probe"]["main"]["width"] == 320 and src["health"]["state"] == "ok"


def test_the_stream_test_is_rate_limited(world):
    for _ in range(cs.TEST_MAX_PER_MIN):
        assert world.c.post(f"{API}/cameras/source/test", json={"url": MAIN}).status_code == 200
    r = world.c.post(f"{API}/cameras/source/test", json={"url": MAIN})
    assert r.status_code == 429 and r.json()["code"] == "rate_limited"


def test_the_stream_test_needs_go2rtc(world):
    world.app.state.settings = replace(world.s, go2rtc_url=None)
    r = world.c.post(f"{API}/cameras/source/test", json={"url": MAIN})
    assert r.status_code == 409 and r.json()["code"] == "webrtc_server_required"  # NVRLESS-CAMERAS-2411 (was media_not_configured)


# ---------------------------------------------------------------- live and snapshots from the manual source

def test_a_manual_source_streams_from_its_own_go2rtc_stream_not_the_recorder(world):
    world.c.put(f"{API}/cameras/{world.nvr_cam}/source", json={"mode": "manual", "main_url": MAIN, "sub_url": SUB})
    cam = cam_row(world, world.nvr_cam)
    name = media.ensure_camera_stream(world.s, cam, "sub")
    assert name == f"smplwise_cam_{world.nvr_cam}_sub" and world.go.store[name] == [SUB]
    assert media.ensure_camera_stream(world.s, cam, "main") == f"smplwise_cam_{world.nvr_cam}_main"
    assert media.transcode_name(cam, "main") == f"smplwise_cam_{world.nvr_cam}_main_h264"
    assert "smplwise_nvr-1_ch1_main" not in world.go.store  # the recorder's stream is not created for it
    assert world.go.store["smplwise_nvr-1_ch1_sub"] == [FOREIGN["smplwise_nvr-1_ch1_sub"]]
    info = world.c.get(f"{API}/media/live/{world.nvr_cam}").json()
    assert info["ws_path"].endswith(f"/media/live/{world.nvr_cam}/ws?profile=sub")
    listing = world.c.get(f"{API}/media/streams").json()
    shown = next(s for s in listing["streams"] if s["name"] == name)
    no_secret(json.dumps(shown), "in GET /media/streams")
    assert shown["sources"] == ["rtsp://***"]  # the scheme only: neither the host nor a query token


def test_switching_back_to_the_recorder_removes_the_manual_streams(world):
    world.c.put(f"{API}/cameras/{world.nvr_cam}/source", json={"mode": "manual", "main_url": MAIN})
    media.ensure_camera_stream(world.s, cam_row(world, world.nvr_cam), "sub")
    r = world.c.put(f"{API}/cameras/{world.nvr_cam}/source", json={"mode": "nvr"})
    assert r.status_code == 200 and r.json()["mode"] == "nvr"
    assert not [n for n in world.go.store if n.startswith(cs.STREAM_PREFIX)]
    assert world.go.store["door-1"] == [FOREIGN["door-1"]]
    with world.app.state.db.connection(mode="read") as conn:
        assert cs.get_row(conn, world.nvr_cam) is None


# ---------------------------------------------------------------- cameras without a recorder

def test_a_camera_without_a_recorder_is_listed_like_any_camera_but_is_not_a_recorder(world):
    r = add_standalone(world)
    assert r.status_code == 201, r.text
    cam = r.json()
    no_secret(r.text, "in the create answer")
    assert cam["recorder_id"] == cs.STANDALONE and cam["standalone"] is True and cam["name"] == "חניה אחורית" and cam["area_id"] == "parking"
    listed = world.c.get(f"{API}/cameras").json()
    row = next(c for c in listed["cameras"] if c["id"] == cam["id"])
    assert row["standalone"] is True and row["video_source"] == "manual" and row["can_view_live"] is True and row["area_id"] == "parking"
    assert {"id": cs.STANDALONE, "name": cs.STANDALONE_NAME, "vendor": "standalone"} in listed["recorders"]
    recorders = world.c.get(f"{API}/recorders").json()["recorders"]
    assert cs.STANDALONE not in [x["id"] for x in recorders]  # never listed, read or given an adapter as a recorder
    with world.app.state.db.connection(mode="read") as conn:
        from smplwise.services.recorders import registry

        assert cs.STANDALONE not in registry.recorder_ids(conn)
        assert cs.STANDALONE not in [r["id"] for r in connection_store.further_recorders(conn)]
    src = world.c.get(f"{API}/cameras/{cam['id']}/source").json()
    assert src["standalone"] is True and src["capabilities"] == {"live": True, "snapshot": True, "recording": False, "playback": False, "events": False, "reboot": False}
    created = audit_rows(world.app, "camera.standalone.create")[-1]
    assert created["decision"] == "allowed" and created["resource_id"] == cam["id"]
    no_secret(created["details_json"], "in the create audit row")


def test_a_camera_without_a_recorder_plays_and_pictures_from_its_own_address(world):
    cam = add_standalone(world).json()
    assert world.c.get(f"{API}/media/live/{cam['id']}").status_code == 200
    snap = world.c.get(f"{API}/cameras/{cam['id']}/snapshot.jpg")
    assert snap.status_code == 200 and snap.content.startswith(b"\xff\xd8\xff")
    name = f"smplwise_cam_{cam['id']}_sub"
    assert world.go.store[name] == [SUB]
    frames = [p for m, path, p in world.go.requests if path == "/api/frame.jpeg"]
    assert frames == [{"src": name}]  # by name only: no source in a frame query
    assert cs.health_view(cam["id"])["state"] == "ok"


def test_a_camera_without_a_recorder_never_reaches_a_recorder_path(world):
    cam = add_standalone(world).json()
    with world.app.state.db.connection(mode="read") as conn:
        bare = conn.execute("SELECT * FROM cameras WHERE id = ?", (cam["id"],)).fetchone()
    with pytest.raises(Exception) as exc:
        media.ensure_camera_stream(world.s, bare, "sub")  # a row that was not given its source: refused, never a recorder connection
    assert exc.value.code == "source_missing"
    from smplwise.recorder_scope import settings_for

    rs = settings_for(world.s, cs.STANDALONE)
    assert rs.nvr_host is None  # no connection: every device call answers 409 at the device boundary
    r = world.c.put(f"{API}/cameras/{cam['id']}/source", json={"mode": "nvr"})
    assert r.status_code == 409 and r.json()["code"] == "standalone_needs_source"


def test_the_stream_sync_creates_the_manual_streams_and_skips_the_recorder_for_them(world):
    cam = add_standalone(world).json()
    world.c.patch(f"{API}/cameras/{world.nvr_cam}", json={"enabled": False})  # the recorder's camera has no credentials in this world
    with world.app.state.db.connection() as conn:
        from smplwise.services import autosync

        out = autosync.ensure_streams(world.s, conn, reason="manual")
    assert f"smplwise_cam_{cam['id']}_sub" in out["streams"] and f"smplwise_cam_{cam['id']}_main" in out["streams"]
    assert not any(n.startswith("smplwise_standalone_") for n in world.go.store)


def test_removing_a_camera_without_a_recorder(world):
    cam = add_standalone(world).json()
    media.ensure_camera_stream(world.s, cam_row(world, cam["id"]), "sub")
    nvr = world.c.delete(f"{API}/cameras/standalone/{world.nvr_cam}")
    assert nvr.status_code == 409 and nvr.json()["code"] == "not_standalone"
    r = world.c.delete(f"{API}/cameras/standalone/{cam['id']}")
    assert r.status_code == 200 and r.json() == {"camera_id": cam["id"], "deleted": True}
    assert cam["id"] not in [c["id"] for c in world.c.get(f"{API}/cameras").json()["cameras"]]
    assert not [n for n in world.go.store if n.startswith(cs.STREAM_PREFIX)]
    assert audit_rows(world.app, "camera.standalone.delete")[-1]["decision"] == "allowed"


def test_a_camera_without_a_recorder_is_offered_to_the_area_camera_cards(world):
    cam = add_standalone(world).json()
    world.app.state.settings = replace(world.s, ha_url="http://ha.local:8123", ha_token="t")
    with world.app.state.db.connection(mode="read") as conn:
        from smplwise.rbac import Principal
        from smplwise.services import camera_cards as cc

        who = conn.execute("SELECT id, username FROM users WHERE username = 'joni'").fetchone()
        out = cc.eligible(conn, Principal(user_id=who["id"], username="joni", display_name="", source="dev"))
    group = next(g for g in out["recorders"] if g["recorder_id"] == cs.STANDALONE)
    assert group["name"] == cs.STANDALONE_NAME and group["cameras"][0]["camera_id"] == cam["id"]


# ---------------------------------------------------------------- a failing manual source: no fallback, an alert

def test_a_failing_manual_source_raises_the_alert_and_resolves_when_it_works(world, daytime_clock):
    from smplwise.services import notify, notify_sources

    cam = add_standalone(world).json()
    world.go.refuse[HOST] = "dial tcp: i/o timeout"
    db = world.app.state.db
    for _ in range(cs.FAIL_CONFIRM):
        cs.check_once(db, world.s, force=True)
    assert cs.health_view(cam["id"])["state"] == "failing"
    with db.connection(mode="read") as conn:
        assert conn.execute("SELECT status FROM cameras WHERE id = ?", (cam["id"],)).fetchone()[0] == "offline"
    notify_sources.reset()
    now = notify.now_utc()
    with db.connection() as conn:
        cs.tick(conn, now)  # the policy's hold (after_s) starts
        cs.tick(conn, now + dt.timedelta(seconds=600))
        rows = conn.execute("SELECT source, subject_id, state, title FROM notifications WHERE source = 'camera.source'").fetchall()
    assert rows and rows[0]["subject_id"] == cam["id"] and rows[0]["state"] != "resolved"
    # still the manual source: nothing was pointed at a recorder
    assert world.go.store[f"smplwise_cam_{cam['id']}_sub"] == [SUB]
    world.go.refuse.clear()
    cs.check_once(db, world.s, force=True)
    assert cs.health_view(cam["id"])["state"] == "ok"
    with db.connection() as conn:
        cs.tick(conn, now + dt.timedelta(seconds=700))
        state = conn.execute("SELECT state FROM notifications WHERE source = 'camera.source'").fetchone()[0]
        assert conn.execute("SELECT status FROM cameras WHERE id = ?", (cam["id"],)).fetchone()[0] == "online"
    assert state == "resolved"


def test_a_camera_without_a_recorder_never_raises_camera_offline(world, daytime_clock):
    from smplwise.services import notify, notify_sources

    cam = add_standalone(world).json()
    with world.app.state.db.connection() as conn:
        conn.execute("UPDATE cameras SET status = 'offline' WHERE id = ?", (cam["id"],))
        notify_sources.cameras_tick(conn, notify.now_utc())
        assert conn.execute("SELECT COUNT(*) FROM notifications WHERE source = 'camera.offline' AND subject_id = ?", (cam["id"],)).fetchone()[0] == 0


def test_the_notification_source_is_registered():
    from smplwise.services.notify_policy import SOURCES

    src = next(s for s in SOURCES if s.key == "camera.source")
    assert src.subject == "camera" and src.category == "device_faults" and src.who == "managers"


# ---------------------------------------------------------------- reconcile: ours only

def test_reconcile_deletes_unwanted_manual_streams_only(world):
    cam = add_standalone(world).json()
    media.ensure_camera_stream(world.s, cam_row(world, cam["id"]), "sub")
    world.go.store["smplwise_cam_0123456789abcdef_main"] = ["rtsp://x/1"]  # a source removed while go2rtc was down
    world.go.store["smplwise_cam_0123456789abcdef_main_h264"] = ["ffmpeg:smplwise_cam_0123456789abcdef_main#video=h264"]
    world.go.store["smplwise_cam_notours"] = ["rtsp://y/1"]  # not the exact shape: never touched
    out = cs.reconcile(world.app.state.db, world.s, force=True)
    assert out["deleted"] == 2
    assert f"smplwise_cam_{cam['id']}_sub" in world.go.store and "smplwise_cam_notours" in world.go.store
    assert set(FOREIGN) <= set(world.go.store)
    assert all(w[1].startswith(cs.STREAM_PREFIX) for w in world.go.writes() if w[0] == "DELETE")


def test_stream_names_stay_in_the_feature_namespace():
    assert cs.stream_name("0123456789abcdef", "sub") == "smplwise_cam_0123456789abcdef_sub"
    for bad in ("../x", "a b", "", "x" * 65, "probe_1"):
        with pytest.raises(ValueError):
            cs.stream_name(bad, "sub")
    with pytest.raises(ValueError):
        cs.stream_name("abc", "other")
    with pytest.raises(ValueError):
        cs._delete(g2.Go2rtc(replace(_settings_stub(), go2rtc_url=GO2RTC)), "door-1")


def _settings_stub():
    from smplwise.config import Settings
    from pathlib import Path

    return Settings(data_dir=Path("."), www_dir=None, in_addon=False, trusted_proxies=(), dev_user=None, bootstrap_admin_username=None, nvr_host=None,
                    nvr_http_port=80, nvr_user=None, nvr_password=None, go2rtc_url=None, log_level="warning", max_upload_bytes=1, max_pdf_pages=1,
                    max_render_px=1, preview_px=1)

