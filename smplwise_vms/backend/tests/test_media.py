"""Settings, snapshots and the go2rtc adapter / live relay authorization (T015/T016 server side)."""
from __future__ import annotations

from dataclasses import replace

import pytest
from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import go2rtc as g2
from smplwise.services import nvr


def test_settings_read_and_patch_permissions(client, settings):
    s = client.get("/api/v1/settings").json()
    assert s["settings"]["media.transport_default"] == "mse" and s["can_edit"] is True
    r = client.patch("/api/v1/settings", json={"media.transport_default": "webrtc", "media.max_live_sessions": 4})
    assert r.status_code == 200 and r.json()["settings"]["media.transport_default"] == "webrtc" and r.json()["settings"]["media.max_live_sessions"] == 4
    assert client.patch("/api/v1/settings", json={"media.transport_default": "hls"}).status_code == 422
    bind(client, settings, "ron", "viewer", "installation", "*")
    assert client.get("/api/v1/settings", headers=as_user("ron")).json()["can_edit"] is False
    assert client.patch("/api/v1/settings", json={"media.transport_default": "auto"}, headers=as_user("ron")).status_code == 403


def test_stream_naming_and_namespace_guard(settings):
    assert g2.stream_name("nvr-1", 4, "sub") == "smplwise_nvr-1_ch4_sub"
    with pytest.raises(ValueError):
        g2.stream_name("nvr-1", 4, "hls")
    s = replace(settings, nvr_host="nvr.local", nvr_user="u", nvr_password="p@ss:1", go2rtc_url="http://go2rtc:1984")
    url = g2.hikvision_rtsp_url(s, 4, "main")
    assert url == "rtsp://u:p%40ss%3A1@nvr.local:554/Streaming/Channels/401"
    assert g2.redact_url(url) == "rtsp://***@nvr.local:554/Streaming/Channels/401"
    client = g2.Go2rtc(s)
    with pytest.raises(ValueError):
        client.ensure_stream("hik_cam1", "rtsp://x")
    with pytest.raises(ValueError):
        client.delete_stream("door-1")
    assert client.ws_url("smplwise_nvr-1_ch4_sub") == "ws://go2rtc:1984/api/ws?src=smplwise_nvr-1_ch4_sub"


class FakeGo2rtc:
    """Records writes; pretends two foreign streams already exist."""

    def __init__(self, *a, **k):
        pass

    store: dict[str, list[str]] = {"hik_cam1": ["rtsp://***@x/1"], "door-1": ["rtsp://***@x/2"]}
    writes: list[tuple[str, str]] = []

    def list_streams(self):
        return {n: g2.StreamInfo(name=n, sources=list(s), online=False) for n, s in self.store.items()}

    def ensure_stream(self, name, src):
        assert name.startswith("smplwise_")
        outcome = "unchanged" if self.store.get(name) == [src] else ("updated" if name in self.store else "created")
        self.store[name] = [src]
        self.writes.append((name, src))
        return outcome

    def info(self):
        return {"version": "1.9.14-fake"}


def test_streams_sync_only_touches_our_namespace(client, settings, monkeypatch):
    from smplwise.routers import media

    s = replace(settings, nvr_host="nvr.local", nvr_user="u", nvr_password="p", go2rtc_url="http://go2rtc:1984")
    c = TestClient(create_app(s))
    c.post("/api/v1/cameras", json={"channel": 1, "alias": "a"})
    c.post("/api/v1/cameras", json={"channel": 2, "alias": "b"})
    monkeypatch.setattr(media.g2, "Go2rtc", FakeGo2rtc)
    FakeGo2rtc.writes.clear()
    r = c.post("/api/v1/media/streams/sync").json()
    assert r["created"] == 4 and r["foreign_streams_untouched"] == 2 and all(n.startswith("smplwise_") for n, _ in FakeGo2rtc.writes)
    assert c.post("/api/v1/media/streams/sync").json()["unchanged"] == 4
    listing = c.get("/api/v1/media/streams").json()
    assert listing["foreign_streams"] == 2 and all("***" in src or "@" not in src for st in listing["streams"] for src in st["sources"])


def test_media_not_configured(client):
    client.post("/api/v1/cameras", json={"channel": 1, "alias": "a"})
    assert client.post("/api/v1/media/streams/sync").json()["code"] == "media_not_configured"


def test_live_info_and_ws_authorization(client, settings, monkeypatch):
    ids = seed_tree(client)
    cam = client.post("/api/v1/cameras", json={"channel": 1, "alias": "a"}).json()
    other = client.post("/api/v1/cameras", json={"channel": 2, "alias": "b"}).json()
    # anchor cam on floor 2 so a floor-2 viewer may watch it, but not `other`
    asset = client.post(f"/api/v1/floors/{ids['floor2']}/plan-assets", files={"file": ("p.png", png_bytes(), "image/png")}).json()
    v = client.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"]}).json()
    client.post(f"/api/v1/plan-versions/{v['id']}/publish")
    client.post(f"/api/v1/floors/{ids['floor2']}/anchors", json={"resource_type": "camera", "resource_id": cam["id"], "x": 0.5, "y": 0.5})
    bind(client, settings, "ron", "viewer", "floor", ids["floor2"])
    h = as_user("ron")
    info = client.get(f"/api/v1/media/live/{cam['id']}", headers=h).json()
    assert info["ws_path"].endswith(f"media/live/{cam['id']}/ws?profile=sub") and info["media_configured"] is False
    assert client.get(f"/api/v1/media/live/{other['id']}", headers=h).status_code == 403
    cams = client.get("/api/v1/cameras", headers=h).json()["cameras"]
    assert [c["id"] for c in cams] == [cam["id"]] and cams[0]["can_view_live"] is True
    # websocket: unauthorized camera is refused before any upstream connection
    from starlette.websockets import WebSocketDisconnect

    with pytest.raises((WebSocketDisconnect, Exception)):
        with client.websocket_connect(f"/api/v1/media/live/{other['id']}/ws?profile=sub", headers=h):
            pass


def test_snapshot_cache_and_permissions(client, settings, monkeypatch):
    ids = seed_tree(client)
    cam = client.post("/api/v1/cameras", json={"channel": 3, "alias": "c"}).json()
    calls: list[int] = []
    jpeg = b"\xff\xd8\xff" + b"\x00" * 64

    def fake_fetch(_settings, channel):
        calls.append(channel)
        return jpeg

    monkeypatch.setattr(nvr, "fetch_snapshot", fake_fetch)
    r = client.get(f"/api/v1/cameras/{cam['id']}/snapshot.jpg")
    assert r.status_code == 200 and r.headers["content-type"] == "image/jpeg" and r.content == jpeg and calls == [3]
    r2 = client.get(f"/api/v1/cameras/{cam['id']}/snapshot.jpg")
    assert r2.status_code == 200 and calls == [3], "served from cache within max_age"
    # NVR failure with a cached copy → stale copy flagged
    def failing(_settings, channel):
        from smplwise.errors import ApiError

        raise ApiError(503, "source_unavailable", "down", retryable=True)

    monkeypatch.setattr(nvr, "fetch_snapshot", failing)
    client.patch("/api/v1/settings", json={"snapshots.max_age_s": 5})
    import os, time

    path = settings.data_dir / "snapshots" / f"{cam['id']}.jpg"
    os.utime(path, (time.time() - 100, time.time() - 100))
    r3 = client.get(f"/api/v1/cameras/{cam['id']}/snapshot.jpg")
    assert r3.status_code == 200 and r3.headers.get("x-snapshot-stale") == "true"
    # a floor viewer without this camera on their floor gets 403
    bind(client, settings, "ron", "viewer", "floor", ids["floor2"])
    assert client.get(f"/api/v1/cameras/{cam['id']}/snapshot.jpg", headers=as_user("ron")).status_code == 403
