"""LAZYMIC-295 (owner 2026-10-21): the remote channel's Permissions-Policy allows the microphone only while a feature that
uses it is ON - Arx push-to-talk (`access.station_media` = video_talk) or the embedded WisKey panel (the WisKey area is not
hidden, `ui.hide_wiskey`). Otherwise `microphone=()`. The camera policy never changes, the Ingress channel carries no
Arx Permissions-Policy, and the public (vendor) listener keeps `microphone=()` (test_camera_viewfinder_policy.py)."""
from __future__ import annotations

import dataclasses

import pytest
from fastapi.testclient import TestClient

from smplwise import remote_channel
from smplwise.main import create_app
from smplwise.services.tickets.public_http import SECURITY_HEADERS as PUBLIC_HEADERS

API = "/api/v1"
MIC_ON = "camera=(self), microphone=(self), geolocation=(), payment=(), usb=(), serial=(), bluetooth=()"
MIC_OFF = "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=()"
REMOTE_PATHS = ("/arx/", "/arx/index.html", "/arx/api/v1/me", "/arx/nope")


@pytest.fixture(autouse=True)
def _restore_mode():
    yield
    remote_channel.set_mic_allowed(True)


def _www(tmp_path):
    www = tmp_path / "www"
    www.mkdir(exist_ok=True)
    (www / "index.html").write_text("<!doctype html><title>Arx</title><sw-app></sw-app>", encoding="utf-8")
    return www


@pytest.fixture()
def client(settings, tmp_path):
    c = TestClient(create_app(dataclasses.replace(settings, remote_access=True, www_dir=_www(tmp_path))))
    assert c.get(f"{API}/me").status_code == 200  # the developer identity bootstraps as system_admin (local channel)
    return c


def _policies(resp) -> list[str]:
    return [v.decode("latin-1") for k, v in resp.headers.raw if k.lower() == b"permissions-policy"]


def _patch(c: TestClient, **values: str) -> None:
    r = c.patch(f"{API}/settings", json=values)
    assert r.status_code == 200, r.text


def _remote(c: TestClient) -> set[str]:
    seen = set()
    for path in REMOTE_PATHS:
        p = _policies(c.get(path))
        assert len(p) == 1, (path, p)
        seen.add(p[0])
    return seen


@pytest.mark.parametrize(("station_media", "hide_wiskey", "allowed"), [
    ("off", "false", True),  # the WisKey panel is embedded (its talk and microphone test)
    ("video", "false", True),
    ("video_talk", "false", True),
    ("off", "true", False),  # nothing that uses the microphone is on
    ("video", "true", False),
    ("video_talk", "true", True),  # Arx push-to-talk
    (None, None, True),  # the defaults
    ("garbage", "garbage", True),
])
def test_the_rule(station_media, hide_wiskey, allowed):
    assert remote_channel.mic_allowed_by(station_media, hide_wiskey) is allowed


def test_defaults_allow_the_microphone(client):
    assert _remote(client) == {MIC_ON}


def test_both_features_off_deny_the_microphone_on_every_remote_response(client):
    _patch(client, **{"access.station_media": "video", "ui.hide_wiskey": "true"})
    assert _remote(client) == {MIC_OFF}
    # the camera part is unchanged, only the microphone moved
    assert MIC_OFF.replace("microphone=()", "microphone=(self)") == MIC_ON


def test_switching_back_on_follows_at_once(client):
    _patch(client, **{"ui.hide_wiskey": "true"})
    assert _remote(client) == {MIC_OFF}
    _patch(client, **{"ui.hide_wiskey": "false"})
    assert _remote(client) == {MIC_ON}


def test_regression_talk_on_keeps_the_microphone_allowed(client):
    """Push-to-talk ON must never be blocked by the header, even with the WisKey area hidden."""
    _patch(client, **{"ui.hide_wiskey": "true", "access.station_media": "video_talk"})
    assert _remote(client) == {MIC_ON}
    _patch(client, **{"access.station_media": "off"})
    assert _remote(client) == {MIC_OFF}
    _patch(client, **{"access.station_media": "video_talk"})
    assert _remote(client) == {MIC_ON}


def test_a_route_cannot_widen_the_policy(client):
    """The remote edge replaces any Permissions-Policy a route sends (it is one of the channel's own headers)."""
    assert b"permissions-policy" in remote_channel._OWN


def test_restart_reads_the_stored_settings(settings, tmp_path):
    c = TestClient(create_app(dataclasses.replace(settings, remote_access=True, www_dir=_www(tmp_path))))
    assert c.get(f"{API}/me").status_code == 200
    _patch(c, **{"ui.hide_wiskey": "true"})
    remote_channel.set_mic_allowed(True)  # a fresh process starts from the default ...
    c2 = TestClient(create_app(dataclasses.replace(settings, remote_access=True, www_dir=_www(tmp_path))))
    assert _remote(c2) == {MIC_OFF}  # ... and create_app reads the stored settings before the first response


def test_a_restored_database_is_followed_by_the_background_pass(client):
    with client.app.state.db.connection() as conn:
        conn.execute("UPDATE settings SET value = 'true' WHERE key = 'ui.hide_wiskey'")
        if conn.execute("SELECT changes()").fetchone()[0] == 0:
            conn.execute("INSERT INTO settings(key, value) VALUES ('ui.hide_wiskey', 'true')")
    assert _remote(client) == {MIC_ON}  # not yet: the snapshot is refreshed by PATCH, start-up and the 30 s pass
    remote_channel.load_csp_mode(client.app.state.db)  # the 30 s pass (ha_user_auth.revalidate_loop)
    assert _remote(client) == {MIC_OFF}


def test_ingress_carries_no_arx_permissions_policy(client):
    _patch(client, **{"ui.hide_wiskey": "true"})
    for path in ("/", "/index.html", f"{API}/me"):
        assert _policies(client.get(path)) == [], path


def test_the_public_listener_keeps_the_microphone_denied():
    policy = dict(PUBLIC_HEADERS)[b"permissions-policy"].decode()
    assert "microphone=()" in policy and "camera=()" in policy
