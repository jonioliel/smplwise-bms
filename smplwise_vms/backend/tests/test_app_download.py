"""Android app download offer on the Arx sign-in page: validation, the public route's exposure, audit."""
from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from smplwise.services import app_download

from test_remote_access import arx  # noqa: F401 - the remote-channel fixture

SHA = "ab" * 32


def _patch(admin, body):
    return admin.patch("/api/v1/settings", json=body)


@pytest.mark.parametrize("url", [
    "https://downloads.example.com/arx.apk",
    "https://example.com:8443/a/b.apk?x=1",
])
def test_valid_https_urls(url):
    assert app_download.valid_url(url) == url


@pytest.mark.parametrize("url", [
    "", "http://example.com/a.apk", "javascript:alert(1)", "ftp://example.com/a.apk", "//example.com/a.apk", "https://",
    "https://user:pw@example.com/a.apk", "https://exa mple.com/a.apk", "https://example.com/a.apk\nSet-Cookie: x",
    "https://example.com:99999/a.apk", "https:\\example.com\a.apk", "https://example.com/" + "a" * 2000, None, 5,
])
def test_invalid_urls(url):
    assert app_download.valid_url(url) is None


def test_off_by_default_and_public_route_exposes_nothing(arx):  # noqa: F811
    r = arx.client.get("/arx/api/v1/auth/app-download")
    assert r.status_code == 200 and r.json() == {"android": None}
    assert r.headers["cache-control"] == "no-store"
    assert TestClient(arx.app).get("/api/v1/auth/app-download").status_code == 404  # not on the local channel


def test_settings_validated_and_public_route_returns_only_url_version_hash(arx):  # noqa: F811
    admin = TestClient(arx.app)
    arx.bind("dev-joni", "system_admin")
    s = admin.get("/api/v1/settings").json()["settings"]
    assert s["app.android_url"] == "" and s["app.android_version"] == "" and s["app.android_sha256"] == ""
    for bad in ({"app.android_url": "http://example.com/a.apk"}, {"app.android_url": "https://u:p@example.com/a.apk"},
                {"app.android_url": "javascript:alert(1)"}, {"app.android_version": "1.0 <b>"}, {"app.android_sha256": "xyz"},
                {"app.android_sha256": "ab" * 31}):
        assert _patch(admin, bad).status_code == 422, bad
    assert arx.client.get("/arx/api/v1/auth/app-download").json() == {"android": None}  # nothing stored by the refused calls
    ok = _patch(admin, {"app.android_url": " https://downloads.example.com/arx.apk ", "app.android_version": "0.9.1", "app.android_sha256": SHA.upper()})
    assert ok.status_code == 200
    pub = arx.client.get("/arx/api/v1/auth/app-download")
    assert pub.status_code == 200
    assert pub.json() == {"android": {"url": "https://downloads.example.com/arx.apk", "version": "0.9.1", "sha256": SHA}}
    assert json.loads(arx.audit("settings.update")[-1]["details_json"])["app.android_url"] == "https://downloads.example.com/arx.apk"
    # clearing the address switches the offer off again
    assert _patch(admin, {"app.android_url": ""}).status_code == 200
    assert arx.client.get("/arx/api/v1/auth/app-download").json() == {"android": None}


def test_only_system_configure_may_set_it(arx):  # noqa: F811
    arx.bind("dev-dana", "viewer")
    r = TestClient(arx.app).patch("/api/v1/settings", json={"app.android_url": "https://example.com/a.apk"}, headers={"X-SW-Dev-User": "dana"})
    assert r.status_code == 403
    assert arx.client.get("/arx/api/v1/auth/app-download").json() == {"android": None}


def test_a_corrupt_stored_row_offers_nothing(arx):  # noqa: F811
    from smplwise.db import set_setting

    with arx.app.state.db.connection(mode="write", label="test") as conn:
        set_setting(conn, "app.android_url", "http://insecure.example.com/a.apk")
        set_setting(conn, "app.android_sha256", "nothex")
    assert arx.client.get("/arx/api/v1/auth/app-download").json() == {"android": None}
