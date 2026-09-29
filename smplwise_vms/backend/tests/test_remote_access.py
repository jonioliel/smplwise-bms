"""CR-008 SmplWise Arx remote access: the add-on options, the `/arx` channel middleware, the HA-token session
exchange and the remote branch of the identity resolution."""
from __future__ import annotations

import json

import pytest

from smplwise.config import DEFAULT_REMOTE_PATH, load_settings, normalize_remote_path


# ---------------------------------------------------------------- 1. add-on options

def test_remote_options_default_off(tmp_path, monkeypatch):
    monkeypatch.delenv("SW_REMOTE_ACCESS", raising=False)
    monkeypatch.delenv("SW_REMOTE_PATH", raising=False)
    opts = tmp_path / "options.json"
    opts.write_text(json.dumps({"bootstrap_admin_username": "joni"}), encoding="utf-8")
    s = load_settings(opts)
    assert s.remote_access is False
    assert s.remote_path == "/arx"


def test_remote_options_from_options_file(tmp_path, monkeypatch):
    monkeypatch.setenv("SW_REMOTE_ACCESS", "false")
    opts = tmp_path / "options.json"
    opts.write_text(json.dumps({"remote_access": True, "remote_path": "/Remote/"}), encoding="utf-8")
    s = load_settings(opts)
    assert s.remote_access is True
    assert s.remote_path == "/remote"


def test_remote_options_from_environment(tmp_path, monkeypatch):
    monkeypatch.setenv("SW_REMOTE_ACCESS", "1")
    monkeypatch.setenv("SW_REMOTE_PATH", "arx")
    s = load_settings(tmp_path / "missing.json")
    assert s.remote_access is True and s.remote_path == "/arx"


@pytest.mark.parametrize("raw", ["/", "/api", "/auth", "/a/b", "/../x", "/hikvision-intercom", "/x y", "/" + "a" * 40])
def test_remote_path_rejects_unsafe_values(raw):
    assert normalize_remote_path(raw) == DEFAULT_REMOTE_PATH


def test_addon_manifest_declares_the_options():
    from pathlib import Path

    text = (Path(__file__).resolve().parents[2] / "config.yaml").read_text(encoding="utf-8")
    assert "  remote_access: false" in text and "  remote_path: /arx" in text
    assert "  remote_access: bool" in text and "  remote_path: match(" in text


# ---------------------------------------------------------------- 2. the /arx channel middleware

import dataclasses  # noqa: E402

from fastapi.testclient import TestClient  # noqa: E402

from smplwise.main import create_app  # noqa: E402


def _www(tmp_path):
    www = tmp_path / "www"
    www.mkdir(exist_ok=True)
    (www / "index.html").write_text("<!doctype html><title>Arx</title><sw-app></sw-app>", encoding="utf-8")
    (www / "sw.js").write_text("// no-op\n", encoding="utf-8")
    return www


def remote_client(settings, tmp_path, **over) -> TestClient:
    s = dataclasses.replace(settings, remote_access=True, www_dir=_www(tmp_path), **over)
    return TestClient(create_app(s))


def test_remote_off_is_404_everywhere_under_the_prefix(settings, tmp_path):
    c = TestClient(create_app(dataclasses.replace(settings, www_dir=_www(tmp_path))))
    for path in ("/arx", "/arx/", "/arx/api/v1/me", "/arx/sw.js", "/arx/index.html"):
        r = c.get(path, follow_redirects=False)
        assert r.status_code == 404, path
    # the local (Ingress / developer) paths are unchanged
    assert c.get("/api/v1/me").status_code == 200
    assert c.get("/").status_code == 200


def test_prefix_without_slash_redirects_308(settings, tmp_path):
    c = remote_client(settings, tmp_path)
    r = c.get("/arx", follow_redirects=False)
    assert r.status_code == 308 and r.headers["location"] == "/arx/"
    r = c.get("/arx?x=1", follow_redirects=False)
    assert r.headers["location"] == "/arx/?x=1"
    assert c.get("/arxfoo", follow_redirects=False).status_code != 308


def test_prefix_is_stripped_for_static_files(settings, tmp_path):
    c = remote_client(settings, tmp_path)
    r = c.get("/arx/")
    assert r.status_code == 200 and "<sw-app>" in r.text
    assert c.get("/arx/sw.js").status_code == 200


def test_remote_channel_never_uses_the_developer_identity(settings, tmp_path):
    """The test settings run in developer identity mode (SW_DEV_USER): the local API answers as `dev-joni`, the
    remote channel refuses all the same."""
    c = remote_client(settings, tmp_path)
    assert c.get("/api/v1/me").json()["user"]["id"] == "dev-joni"
    r = c.get("/arx/api/v1/me", headers={"X-SW-Dev-User": "joni"})
    assert r.status_code == 401 and r.json()["code"] == "remote_login_required"


def test_forged_ingress_headers_are_refused_on_the_remote_channel(settings, tmp_path):
    c = remote_client(settings, tmp_path, dev_user=None, trusted_proxies=("testclient",))
    forged = {"X-Remote-User-Id": "u-owner", "X-Remote-User-Name": "joni", "X-Remote-User-Display-Name": "Joni",
              "X-Ingress-Path": "/api/hassio_ingress/abc"}
    # the same headers from the trusted Ingress address are an identity on the local channel...
    assert c.get("/api/v1/me", headers=forged).json()["user"]["id"] == "u-owner"
    # ...and nothing on the remote one, even from that address
    r = c.get("/arx/api/v1/me", headers=forged)
    assert r.status_code == 401 and r.json()["code"] == "remote_login_required"


def test_remote_middleware_drops_identity_headers(settings):
    import asyncio

    from smplwise.remote_channel import RemoteChannel

    seen = {}

    async def inner(scope, receive, send):
        seen.update(scope)
        await send({"type": "http.response.start", "status": 200, "headers": []})
        await send({"type": "http.response.body", "body": b""})

    mw = RemoteChannel(inner, dataclasses.replace(settings, remote_access=True))
    scope = {"type": "http", "path": "/arx/api/v1/me", "root_path": "", "query_string": b"",
             "headers": [(b"x-remote-user-id", b"x"), (b"X-Ingress-Path", b"/p"), (b"x-sw-dev-user", b"joni"),
                         (b"x-hass-source", b"core"), (b"accept", b"*/*")]}
    sent = []

    async def send(m):
        sent.append(m)

    asyncio.run(mw(scope, None, send))
    assert seen["headers"] == [(b"accept", b"*/*")]
    assert seen["root_path"] == "/arx" and seen["path"] == "/arx/api/v1/me"
    assert seen["state"]["sw_channel"] == "remote"
    headers = dict(sent[0]["headers"])
    assert b"frame-ancestors 'self'" in headers[b"content-security-policy"]
    assert headers[b"x-frame-options"] == b"SAMEORIGIN"
    assert headers[b"cache-control"] == b"no-store"


def test_remote_responses_carry_security_headers(settings, tmp_path):
    c = remote_client(settings, tmp_path)
    for path in ("/arx/", "/arx/api/v1/me"):
        h = c.get(path).headers
        assert "frame-ancestors 'self'" in h["content-security-policy"]
        assert "script-src 'self'" in h["content-security-policy"]
        assert h["x-frame-options"] == "SAMEORIGIN"
        assert h["referrer-policy"] == "same-origin"
        assert "geolocation=()" in h["permissions-policy"]
        assert h["x-content-type-options"] == "nosniff"
    assert c.get("/arx/api/v1/me").headers["cache-control"] == "no-store"
    # the Ingress channel keeps its headers as they were
    assert "content-security-policy" not in c.get("/api/v1/me").headers


def test_remote_websocket_without_session_is_refused(settings, tmp_path):
    from starlette.websockets import WebSocketDisconnect

    c = remote_client(settings, tmp_path)
    with pytest.raises(WebSocketDisconnect):
        with c.websocket_connect("/arx/api/v1/me/ws", headers={"X-Remote-User-Id": "u-owner"}) as ws:
            ws.receive_text()
