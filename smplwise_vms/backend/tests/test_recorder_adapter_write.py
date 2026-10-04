"""CR-020 S2 (S2-03, S2-05): the fake NVR's stateful stream PUT and the Hikvision adapter's write methods against it -
capability discovery (direct path, then StreamingProxy, else not writable, cached), the guarded write (LIST read, etag
check, ONE PUT, LIST verify) and the mapping of every device answer of API 5.2. The backend's real httpx code runs; only
the HTTP answers are fake (tests/fixtures/fake_devices.py, `.test` hosts)."""
from __future__ import annotations

import dataclasses
import sys
from pathlib import Path

import pytest

from smplwise.errors import ApiError
from smplwise.services import nvr
from smplwise.services.recorders import hikvision
from smplwise.services.recorders.hikvision import HikvisionAdapter, put_result

sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from fake_devices import NVR_HOST, FakeDevices  # noqa: E402


@pytest.fixture()
def fake(monkeypatch) -> FakeDevices:
    f = FakeDevices()
    f.install(monkeypatch)
    f.nvr["channels"] = 2
    f.nvr["encodings"] = {"main": {"codec": "H.264", "svc": True, "width": 2560, "height": 1440, "bitrate_kbps": 3072, "quality": 60, "fps": 25, "bitrate_mode": "VBR", "profile": "High"},
                          "sub": {"codec": "H.264", "svc": None, "width": 640, "height": 360, "bitrate_kbps": 512, "bitrate_mode": "CBR", "fps": 20, "profile": "Baseline"}}
    return f


@pytest.fixture()
def ad(settings, fake) -> HikvisionAdapter:
    return HikvisionAdapter("nvr-1", dataclasses.replace(settings, nvr_host=NVR_HOST, nvr_user="reader", nvr_password="fake-password"))


def test_fake_put_is_stateful_and_other_writes_stay_refused(ad, fake):
    snap = ad.read_stream("101")
    assert snap.parsed["svc"] is True
    import httpx

    with httpx.Client(base_url=f"http://{NVR_HOST}") as c:
        r = c.put("/ISAPI/Streaming/channels/101", content=nvr.stream_document(snap.element, {"svc": False}).encode())
        assert r.status_code == 200 and "<statusCode>1</statusCode>" in r.text
        assert c.put("/ISAPI/System/Video/inputs/channels/1/motionDetection", content=b"<x/>").status_code == 403, "every other write is still refused"
        assert c.post("/ISAPI/System/reboot").status_code == 403
        single = c.get("/ISAPI/Streaming/channels/101").text
    assert "<SVC>" not in single, "the single-stream GET omits <SVC> like the lab firmware"
    assert ad.read_stream("101").parsed["svc"] is False, "the next LIST shows the PUT"
    assert fake.writes == ["nvr PUT /ISAPI/Streaming/channels/101", "nvr PUT /ISAPI/System/Video/inputs/channels/1/motionDetection", "nvr POST /ISAPI/System/reboot"]
    assert len(fake.nvr["put_bodies"]) == 1


def test_options_direct_path_and_cache(ad, fake):
    o = ad.stream_options("101")
    assert (o.writable, o.write_via, o.source, o.reason) == (True, "direct", "capabilities", None)
    assert o.options is not None and o.options["svc"] is True and o.options["codec"] == ["H.264", "H.265"]
    n = len([h for h in fake.hits if h.endswith("/capabilities")])
    assert ad.stream_options("101") == o and len([h for h in fake.hits if h.endswith("/capabilities")]) == n, "cached per process"
    assert ad.cached_options("101") == o and ad.cached_options("102") is None
    fake.nvr["dynamic_cap"] = {"H.265": ["2560x1440", "1920x1080"]}
    o265 = ad.stream_options("101", "H.265")
    assert o265.options is not None and o265.options["resolution"]["H.265"] == ["2560x1440", "1920x1080"], "dynamicCap lists for the codec asked for"
    with pytest.raises(ApiError) as e:
        ad.stream_options("101", "H.264<x>")
    assert e.value.code == "value_not_allowed"


def test_options_proxy_path_then_none(ad, fake):
    fake.nvr["caps_status"] = {"direct": 404, "proxy": 200}
    o = ad.stream_options("101")
    assert (o.writable, o.write_via, o.source) == (True, "proxy", "proxy_capabilities")
    fake.nvr["caps_status"] = {"direct": 403, "proxy": 404}
    n = ad.stream_options("102")
    assert (n.writable, n.write_via, n.options) == (False, None, None) and n.reason == "notSupport", "no capability document: not writable, the device's sub status kept"
    fake.nvr["caps_status"] = {"direct": 500, "proxy": 200}
    hikvision.clear_options_cache()
    with pytest.raises(ApiError) as e:
        ad.stream_options("201")
    assert e.value.code == "source_error", "a server error is not 'no capability' - nothing cached, no guess"


def test_write_happy_path_one_put_and_a_verified_reading(ad, fake):
    snap = ad.read_stream("101")
    doc = nvr.stream_document(snap.element, {"svc": False})
    out = ad.write_stream_encoding("101", snap.etag, doc, "direct")
    assert (out.device_status, out.reboot_required, out.verified.parsed["svc"]) == ("1", False, False)
    assert out.verified.etag != snap.etag and fake.writes == ["nvr PUT /ISAPI/Streaming/channels/101"]
    body = fake.nvr["put_bodies"][0]
    assert body == '<?xml version="1.0" encoding="UTF-8"?>' + doc, "the PUT body is the edited list element, nothing re-serialized"
    assert NVR_HOST not in body and "fake-password" not in body


def test_write_refuses_a_stale_etag_before_any_put(ad, fake):
    snap = ad.read_stream("101")
    fake.nvr["encodings_by_channel"] = {1: {"main": {"gop": 99}}}  # someone changed the stream on the NVR meanwhile
    with pytest.raises(ApiError) as e:
        ad.write_stream_encoding("101", snap.etag, nvr.stream_document(snap.element, {"svc": False}), "direct")
    assert (e.value.status, e.value.code) == (409, "stale") and fake.writes == []


@pytest.mark.parametrize("mode,expect", [
    ("busy", (409, "nvr_busy")), ("notsupport", (409, "nvr_not_supported")), ("invalid", (409, "nvr_rejected")), ("forbidden", (503, "source_forbidden")),
])
def test_device_refusals_are_mapped_and_never_retried(ad, fake, mode, expect):
    fake.nvr["put"] = {"status": mode}
    snap = ad.read_stream("101")
    with pytest.raises(ApiError) as e:
        ad.write_stream_encoding("101", snap.etag, nvr.stream_document(snap.element, {"svc": False}), "direct")
    assert (e.value.status, e.value.code) == expect and e.value.details.get("outcome") is None
    assert fake.writes == ["nvr PUT /ISAPI/Streaming/channels/101"], "exactly one PUT: no retry"
    assert ad.read_stream("101").parsed["svc"] is True


def test_reboot_required_and_unknown_outcomes(ad, fake):
    fake.nvr["put"] = {"status": "reboot"}
    snap = ad.read_stream("101")
    out = ad.write_stream_encoding("101", snap.etag, nvr.stream_document(snap.element, {"svc": False}), "direct")
    assert (out.device_status, out.reboot_required, out.verified.parsed["svc"]) == ("7", True, False)
    assert not any("reboot" in w for w in fake.writes), "Arx never reboots the NVR"
    for mode, applies in (("timeout", True), ("timeout", False), ("server_error", None)):
        fake.nvr["put"] = {"status": mode}
        fake.nvr["timeout_applies"] = bool(applies)
        snap = ad.read_stream("101")
        with pytest.raises(ApiError) as e:
            ad.write_stream_encoding("101", snap.etag, nvr.stream_document(snap.element, {"svc": not snap.parsed["svc"]}), "direct")
        assert (e.value.status, e.value.code, e.value.details.get("outcome")) == (503, "source_unavailable", "unknown"), mode
    assert fake.nvr["put_count"] == 4


def test_write_via_must_be_a_known_path_and_the_proxy_path_is_used_when_discovered(ad, fake):
    snap = ad.read_stream("101")
    with pytest.raises(ApiError):
        ad.write_stream_encoding("101", snap.etag, snap.element, "/ISAPI/System/reboot")
    fake.nvr["write_path"] = "proxy"
    out = ad.write_stream_encoding("101", snap.etag, nvr.stream_document(snap.element, {"svc": False}), "proxy")
    assert out.verified.parsed["svc"] is False and fake.writes == ["nvr PUT /ISAPI/ContentMgmt/StreamingProxy/channels/101"]


def test_put_result_table():
    ok = '<ResponseStatus><statusCode>1</statusCode><subStatusCode>ok</subStatusCode></ResponseStatus>'
    assert put_result(200, ok) == ("1", False)
    assert put_result(200, ok.replace(">1<", ">7<")) == ("7", True)
    for status, text, code in ((200, ok.replace(">1<", ">2<"), "nvr_busy"), (503, ok.replace(">1<", ">2<"), "nvr_busy"), (400, ok.replace(">1<", ">5<"), "nvr_rejected"),
                               (403, ok.replace("ok</sub", "notSupport</sub"), "nvr_not_supported"), (401, "", "source_forbidden"), (500, "x", "source_unavailable")):
        with pytest.raises(ApiError) as e:
            put_result(status, text)
        assert e.value.code == code, (status, text)
