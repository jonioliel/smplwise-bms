"""Security review finding 3 (2026-10-04): the Hikvision ISAPI write routes (restart, clock, NTP, OSD, motion, schedules)
refuse a Provision recorder with 409 vendor_unsupported before any write leaves; no ISAPI client is even built, so the
recorder's credentials are never sent over Digest/http to it. Hikvision behaviour is covered by the existing write tests."""
from __future__ import annotations

import sys
import time
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

from smplwise.errors import ApiError
from smplwise.services import go2rtc as g2
from smplwise.services import nvr
from smplwise.services.recorders import provision_isr as pisr

sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from fake_provision import FakeProvision, settings_for  # noqa: E402

WEEK = [[{"begin": "00:00:00", "end": "24:00:00"}] for _ in range(7)]


@pytest.fixture()
def world(settings, monkeypatch):
    from smplwise.main import create_app

    pisr.clear_auth_cache()
    fake = FakeProvision()
    fake.shape = "live"
    fake.install(monkeypatch)
    built: list[str] = []
    real_client = nvr.httpx.Client

    def spy(*args, **kwargs):  # an ISAPI client (Digest, from nvr._client) built for the Provision recorder is a failure;
        if isinstance(kwargs.get("auth"), httpx.DigestAuth):  # the adapter's own clients (basic here) are not counted
            built.append(str(kwargs.get("base_url")))
        return real_client(*args, **kwargs)

    monkeypatch.setattr(nvr.httpx, "Client", spy)
    s = settings_for(settings, auth="basic", osd_names=False)
    app = create_app(s)
    with TestClient(app) as c:
        deadline = time.monotonic() + 20
        cam = None
        while time.monotonic() < deadline and cam is None:
            with app.state.db.connection(mode="read") as conn:
                cam = conn.execute("SELECT id FROM cameras WHERE recorder_id = 'nvr-1' AND channel = 1").fetchone()
            time.sleep(0.05)
        assert cam is not None
        fake.hits.clear()
        built.clear()
        yield c, cam["id"], fake, built


@pytest.mark.parametrize("method,path,body", [
    ("post", "/api/v1/nvr/reboot", {"confirm": "RESTART"}),
    ("put", "/api/v1/nvr/time", {"sync_now": True}),
    ("put", "/api/v1/nvr/ntp", {"host": "pool.ntp.org"}),
    ("put", "/api/v1/cameras/{cid}/osd", {"name_enabled": True}),
    ("put", "/api/v1/cameras/{cid}/motion", {"sensitivity": 50}),
    ("put", "/api/v1/cameras/{cid}/schedules/motion", {"days": WEEK}),
])
def test_isapi_writes_refuse_a_provision_recorder(world, method, path, body):
    c, cid, fake, built = world
    r = getattr(c, method)(path.format(cid=cid), json=body)
    assert r.status_code == 409, r.text
    assert r.json()["code"] == "vendor_unsupported"
    # background loops (sampling, sync) keep reading; the write route itself sent nothing but those reads
    writes = [h for h in fake.hits if not h.split(" ", 1)[1].lstrip("/").split("/")[0].startswith(("Get", "Search"))]
    assert writes == [], "the Provision device saw no write"
    assert built == [], "no ISAPI client was built, so no credentials went out"


def test_hikvision_rtsp_url_refuses_other_vendors(settings):
    s = settings_for(settings, auth="basic")
    with pytest.raises(ApiError) as e:
        g2.hikvision_rtsp_url(s, 1, "main")
    assert e.value.status == 409 and e.value.code == "vendor_unsupported"


@pytest.mark.parametrize("vendor", ["hikvision", "none", "", None])
def test_isapi_vendors_pass_the_guard(settings, vendor):
    import dataclasses

    nvr.ensure_isapi_vendor(dataclasses.replace(settings, nvr_vendor=vendor))
