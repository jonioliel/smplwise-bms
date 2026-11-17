"""CR-DEVICE-HTTP-2438 (code review 2026-11-13, finding 03:F15): today's errors of the ISAPI transport and today's readings of the
two ResponseStatus parsers, pinned BEFORE the shared device-HTTP code moved out of services/nvr.py into services/device_http.py.
Written and run green against the old code first; the move must keep every status, code, Hebrew message, retryable flag and the
details (keys AND their order: the JSON body is byte-compared) exactly as they were.

Fake transports only (httpx.MockTransport): nothing contacts a recorder."""
from __future__ import annotations

import json

import httpx
import pytest

from smplwise.errors import ApiError
from smplwise.services import nvr, nvr_write

UNAVAILABLE = "ה־NVR אינו זמין כרגע."


def failing(fail_on=lambda path: True, ok_text: str = "<x/>"):
    def handler(request: httpx.Request) -> httpx.Response:
        if fail_on(request.url.path):
            raise httpx.ConnectError("refused", request=request)
        return httpx.Response(200, text=ok_text)

    return lambda _settings=None, timeout=8.0: httpx.Client(transport=httpx.MockTransport(handler), base_url="http://nvr")


def body(exc: ApiError) -> str:
    return json.dumps([exc.status, exc.code, exc.user_message, exc.retryable, exc.details], ensure_ascii=False)


def expect(details: dict) -> str:
    return json.dumps([503, "source_unavailable", UNAVAILABLE, True, details], ensure_ascii=False)


def test_get_and_the_snapshot(settings, monkeypatch):
    monkeypatch.setattr(nvr, "_client", failing())
    with nvr._client(settings) as c, pytest.raises(ApiError) as e:
        nvr._get(c, "/ISAPI/System/deviceInfo")
    assert body(e.value) == expect({"path": "/ISAPI/System/deviceInfo", "error": "ConnectError"})
    with pytest.raises(ApiError) as e:
        nvr.fetch_snapshot(settings, 3)
    assert body(e.value) == expect({"op": "snapshot", "error": "ConnectError"})


def test_search_and_daily_distribution(settings, monkeypatch):
    monkeypatch.setattr(nvr, "_client", failing())
    with pytest.raises(ApiError) as e:
        nvr.search_recordings(settings, 101, "2026-11-01T00:00:00Z", "2026-11-01T01:00:00Z")
    assert body(e.value) == expect({"op": "search", "error": "ConnectError"})
    with pytest.raises(ApiError) as e:
        nvr.daily_distribution(settings, 101, 2026, 11)
    assert body(e.value) == expect({"op": "daily_distribution", "error": "ConnectError"})


def test_detection_zones_report_the_path_template(settings, monkeypatch):
    monkeypatch.setattr(nvr, "_client", failing())
    with pytest.raises(ApiError) as e:
        nvr.fetch_detection_zones(settings, 2)
    first = next(iter(nvr.ZONE_SOURCES.values()))[0]
    assert "{ch}" in first and body(e.value) == expect({"path": first, "error": "ConnectError"})


@pytest.mark.parametrize("broken", ["/ISAPI/PTZCtrl/channels/2/capabilities", "/ISAPI/PTZCtrl/channels/2/presets", "/ISAPI/System/TwoWayAudio/channels"])
def test_capabilities_each_read(settings, monkeypatch, broken):
    monkeypatch.setattr(nvr, "_client", failing(lambda p: p == broken))
    with pytest.raises(ApiError) as e:
        nvr.fetch_capabilities(settings, 2)
    assert body(e.value) == expect({"error": "ConnectError"})


def test_the_capped_read(settings, monkeypatch):
    monkeypatch.setattr(nvr, "_client", failing())
    with pytest.raises(ApiError) as e:
        nvr.fetch_streaming_document(settings)
    assert body(e.value) == expect({"path": "/ISAPI/Streaming/channels", "error": "ConnectError"})
    with nvr.deadline(0), pytest.raises(ApiError) as e:
        nvr.fetch_streaming_document(settings)
    assert body(e.value) == json.dumps([503, "source_timeout", "ה־NVR לא ענה בזמן.", False, {"op": "read", "error": "deadline"}], ensure_ascii=False)


def test_the_write_transport(settings):
    c = failing()()
    with pytest.raises(ApiError) as e:
        nvr_write._probe(c, "/ISAPI/Event/triggers/VMD-1")
    assert body(e.value) == expect({"path": "/ISAPI/Event/triggers/VMD-1", "error": "ConnectError"})
    with pytest.raises(ApiError) as e:
        nvr_write._put(c, "/ISAPI/Event/triggers/VMD-1", "<EventTrigger/>")
    assert body(e.value) == expect({"path": "/ISAPI/Event/triggers/VMD-1", "error": "ConnectError"})


def test_the_probe_retries_a_stale_nonce_once():
    calls = []

    def handler(request):
        calls.append(request.method)
        return httpx.Response(401 if len(calls) == 1 else 200, text="<doc/>")

    c = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://nvr")
    assert nvr_write._probe(c, "/p") == (200, "<doc/>") and calls == ["GET", "GET"]


def test_the_write_answers_keep_their_codes():
    def client(status, text):
        return httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(status, text=text)), base_url="http://nvr")

    rs = "<ResponseStatus><statusCode>{c}</statusCode><statusString>s</statusString><subStatusCode>{s}</subStatusCode></ResponseStatus>"
    assert nvr_write._put(client(200, rs.format(c=1, s="ok")), "/p", "<a/>") == rs.format(c=1, s="ok")
    cases = [
        (403, rs.format(c=4, s="notSupport"), [409, "nvr_not_supported", {"path": "/p"}]),
        (401, rs.format(c=4, s="badAuth"), [503, "source_forbidden", {"path": "/p", "status": 401, "sub": "badAuth"}]),
        (200, rs.format(c=6, s="badXmlContent"), [409, "nvr_rejected", {"path": "/p", "status": 200, "code": 6, "sub": "badXmlContent"}]),
        (500, "<html>oops</html>", [409, "nvr_rejected", {"path": "/p", "status": 500, "code": None, "sub": None}]),
    ]
    for status, text, want in cases:
        with pytest.raises(ApiError) as e:
            nvr_write._put(client(status, text), "/p", "<a/>")
        assert [e.value.status, e.value.code, e.value.details] == want and list(e.value.details) == list(want[2])


# ---------------------------------------------------------------- the two ResponseStatus readings

NS = 'xmlns="http://www.hikvision.com/ver20/XMLSchema"'
BODIES = [
    # (body, nvr_write.response_status, nvr._response_status)
    (f'<?xml version="1.0" encoding="UTF-8"?><ResponseStatus version="2.0" {NS}><requestURL>/x</requestURL><statusCode>4</statusCode>'
     '<statusString>Invalid Operation</statusString><subStatusCode>notSupport</subStatusCode></ResponseStatus>',
     (4, "notSupport"), {"status": "Invalid Operation", "sub": "notSupport"}),
    ('<ResponseStatus><statusCode>1</statusCode><statusString>OK</statusString><subStatusCode>ok</subStatusCode></ResponseStatus>',
     (1, "ok"), {"status": "OK", "sub": "ok"}),
    ('<ResponseStatus><statusCode>6</statusCode><statusString>Invalid Content</statusString></ResponseStatus>', (6, None), {"status": "Invalid Content", "sub": ""}),
    ('<ResponseStatus><subStatusCode>badAuthorization</subStatusCode></ResponseStatus>', (None, "badAuthorization"), {"status": "", "sub": "badAuthorization"}),
    ('<EventTrigger><statusCode>1</statusCode></EventTrigger>', (1, None), {}),
    ('<html><body>401 Unauthorized</body></html>', (None, None), {}),
    ('', (None, None), {}),
    ('not xml at all <statusCode>7</statusCode>', (7, None), {}),
    ('<ResponseStatus><statusCode>x</statusCode></ResponseStatus>', (None, None), {"status": "", "sub": ""}),
]


@pytest.mark.parametrize("text,as_tuple,as_dict", BODIES)
def test_the_two_readings(text, as_tuple, as_dict):
    assert nvr_write.response_status(text) == as_tuple
    assert nvr._response_status(text) == as_dict


def test_the_ssl_context_is_built_once_and_shared_with_go2rtc():
    from smplwise.services import go2rtc

    assert nvr._ssl_context() is nvr._ssl_context() is go2rtc._verify()
