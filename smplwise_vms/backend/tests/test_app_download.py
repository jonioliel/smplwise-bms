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


# ---- the APK bundled in the image (owner decision 2026-10-06) -------------------------------------------------------

import dataclasses
import hashlib

APK_BYTES = b"PK\x03\x04" + bytes(range(256)) * 40
APK_SHA = hashlib.sha256(APK_BYTES).hexdigest()
GOOD_META = {"version": "1.4.2", "applicationId": "com.smplwise.arx.app"}


def _bundle(tmp_path, meta=GOOD_META, data=APK_BYTES):
    d = tmp_path / "downloads"
    d.mkdir(exist_ok=True)
    (d / "SmplWiseArx.apk").write_bytes(data)
    if meta is not None:
        (d / "SmplWiseArx.apk.json").write_text(meta if isinstance(meta, str) else json.dumps(meta), encoding="utf-8")
    app_download.reset_cache_for_tests()
    return d


@pytest.fixture()
def bundled(arx, tmp_path):  # noqa: F811
    arx.app.state.settings = dataclasses.replace(arx.app.state.settings, downloads_dir=_bundle(tmp_path))
    return arx


def _offer(arx):
    return arx.client.get("/arx/api/v1/auth/app-download").json()


def test_absent_file_offers_nothing_and_the_route_is_404(arx, tmp_path):  # noqa: F811
    arx.app.state.settings = dataclasses.replace(arx.app.state.settings, downloads_dir=tmp_path / "nope")
    assert _offer(arx) == {"android": None}
    assert arx.client.get("/arx/api/v1/auth/app-download/file").status_code == 404
    assert arx.client.get("/arx/api/v1/auth/app-download/file").status_code == 404


def test_bundled_offer_carries_computed_hash_size_version(bundled):
    a = _offer(bundled)["android"]
    assert a == {"url": "api/v1/auth/app-download/file", "version": "1.4.2", "sha256": APK_SHA, "size": len(APK_BYTES), "bundled": True}


def test_download_headers_body_and_etag(bundled):
    r = bundled.client.get("/arx/api/v1/auth/app-download/file")
    assert r.status_code == 200 and r.content == APK_BYTES
    assert r.headers["content-type"] == "application/vnd.android.package-archive"
    assert r.headers["content-disposition"] == 'attachment; filename="SmplWiseArx-1.4.2.apk"'
    assert r.headers["etag"] == f'"{APK_SHA}"' and r.headers["x-content-type-options"] == "nosniff"
    assert bundled.client.get("/arx/api/v1/auth/app-download/file", headers={"If-None-Match": f'"{APK_SHA}"'}).status_code == 304
    h = bundled.client.head("/arx/api/v1/auth/app-download/file")
    assert h.status_code == 200 and h.content == b"" and h.headers["content-length"] == str(len(APK_BYTES))
    rng = bundled.client.get("/arx/api/v1/auth/app-download/file", headers={"Range": "bytes=0-9"})
    assert rng.status_code == 206 and rng.content == APK_BYTES[:10]


def test_local_channel_has_no_file_route(bundled):
    assert TestClient(bundled.app).get("/api/v1/auth/app-download/file").status_code == 404


@pytest.mark.parametrize("path", [
    "/arx/api/v1/auth/app-download/file/../../me", "/arx/api/v1/auth/app-download/file/%2e%2e/%2e%2e/etc/passwd",
    "/arx/api/v1/auth/app-download/SmplWiseArx.apk", "/arx/api/v1/auth/app-download/..%2f..%2fdata", "/arx/api/v1/auth/app-download/file/x",
])
def test_no_traversal_or_alternate_names(bundled, path):
    r = bundled.client.get(path)
    assert r.status_code in (404, 405) and r.content != APK_BYTES


@pytest.mark.parametrize("meta", [
    None, "not json", "[]", {"version": "1.0"}, {"applicationId": "com.smplwise.arx.app"},
    {"version": "1.0", "applicationId": "com.evil.app"}, {"version": "<b>1</b>", "applicationId": "com.smplwise.arx.app"},
    {"version": "1.0", "applicationId": "com.smplwise.arx.app", "sha256": "00" * 32},
])
def test_invalid_sidecar_offers_nothing(arx, tmp_path, meta):  # noqa: F811
    arx.app.state.settings = dataclasses.replace(arx.app.state.settings, downloads_dir=_bundle(tmp_path, meta))
    assert _offer(arx) == {"android": None}
    assert arx.client.get("/arx/api/v1/auth/app-download/file").status_code == 404


def test_sidecar_hash_matching_the_file_is_accepted(arx, tmp_path):  # noqa: F811
    arx.app.state.settings = dataclasses.replace(arx.app.state.settings, downloads_dir=_bundle(tmp_path, {**GOOD_META, "sha256": APK_SHA.upper()}))
    assert _offer(arx)["android"]["sha256"] == APK_SHA


def test_oversized_or_empty_file_is_refused(arx, tmp_path, monkeypatch):  # noqa: F811
    monkeypatch.setattr(app_download, "MAX_APK_BYTES", 100)
    arx.app.state.settings = dataclasses.replace(arx.app.state.settings, downloads_dir=_bundle(tmp_path))
    assert _offer(arx) == {"android": None}
    arx.app.state.settings = dataclasses.replace(arx.app.state.settings, downloads_dir=_bundle(tmp_path, data=b""))
    assert _offer(arx) == {"android": None}


def test_replaced_file_is_rehashed(bundled, tmp_path):
    assert _offer(bundled)["android"]["sha256"] == APK_SHA
    new = APK_BYTES + b"x"
    (tmp_path / "downloads" / "SmplWiseArx.apk").write_bytes(new)
    assert _offer(bundled)["android"]["sha256"] == hashlib.sha256(new).hexdigest()


def test_symlinked_apk_is_refused(arx, tmp_path):  # noqa: F811
    d = _bundle(tmp_path)
    real = tmp_path / "real.apk"
    real.write_bytes(APK_BYTES)
    (d / "SmplWiseArx.apk").unlink()
    try:
        (d / "SmplWiseArx.apk").symlink_to(real)
    except (OSError, NotImplementedError):
        pytest.skip("symlinks not permitted on this host")
    arx.app.state.settings = dataclasses.replace(arx.app.state.settings, downloads_dir=d)
    app_download.reset_cache_for_tests()
    assert _offer(arx) == {"android": None}


def test_admin_url_overrides_the_bundled_file(bundled):
    admin = TestClient(bundled.app)
    bundled.bind("dev-joni", "system_admin")
    assert _patch(admin, {"app.android_url": "https://downloads.example.com/arx.apk", "app.android_version": "9.9"}).status_code == 200
    a = _offer(bundled)["android"]
    assert a["url"] == "https://downloads.example.com/arx.apk" and "bundled" not in a
    assert _patch(admin, {"app.android_url": ""}).status_code == 200
    assert _offer(bundled)["android"]["bundled"] is True


def test_file_route_is_rate_limited(bundled):
    codes = [bundled.client.head("/arx/api/v1/auth/app-download/file", headers={"CF-Connecting-IP": "198.51.100.9"}).status_code for _ in range(8)]
    assert codes[:6] == [200] * 6 and codes[6:] == [429, 429]
    assert bundled.client.head("/arx/api/v1/auth/app-download/file", headers={"CF-Connecting-IP": "198.51.100.10"}).status_code == 200
