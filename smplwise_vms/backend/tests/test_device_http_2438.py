"""CR-DEVICE-HTTP-2438 (code review 2026-11-13, finding 03:F15): the shared device-HTTP code lives in services/device_http.py, the
Hikvision module re-exports its old names, one `request` maps a transport failure for every ISAPI read and write of nvr.py and
nvr_write.py, and one reader serves both views of a ResponseStatus body.

The byte-identical errors and readings are pinned in tests/test_device_http_pins_2438.py (written green against the old code first).
Fake transports only: nothing contacts a recorder."""
from __future__ import annotations

import inspect

import httpx
import pytest
from test_device_http_pins_2438 import BODIES

from smplwise.errors import ApiError
from smplwise.services import device_http, go2rtc, nvr, nvr_write
from smplwise.services.recorders import frigate_http


def test_the_old_names_are_the_shared_objects():
    for name in ("_DEADLINE", "_ssl_context", "bounded_timeout", "check_deadline", "deadline", "deadline_error", "past_deadline", "read_capped", "time_left"):
        assert getattr(nvr, name) is getattr(device_http, name), name
    assert go2rtc._verify() is device_http._ssl_context()
    with nvr.deadline(0):
        assert device_http.past_deadline() and frigate_http.nvr.past_deadline(), "one deadline for every adapter"
    assert not device_http.past_deadline()


def test_the_hikvision_module_no_longer_defines_them():
    src = inspect.getsource(nvr)
    for name in ("_ssl_context", "deadline", "time_left", "past_deadline", "deadline_error", "check_deadline", "bounded_timeout", "read_capped"):
        assert f"\ndef {name}(" not in src, name
    assert "contextvars.ContextVar" not in src


def test_the_unavailable_sentence_is_written_once():
    for module in (nvr, nvr_write):
        assert device_http.NVR_UNAVAILABLE not in inspect.getsource(module), module.__name__
    assert inspect.getsource(device_http).count(f'"{device_http.NVR_UNAVAILABLE}"') == 1


def _broken(_request: httpx.Request) -> httpx.Response:
    raise httpx.ReadTimeout("slow", request=_request)


def test_request_maps_a_transport_failure():
    c = httpx.Client(transport=httpx.MockTransport(_broken), base_url="http://nvr")
    for where, details in ((None, {"path": "/a", "error": "ReadTimeout"}), ({}, {"error": "ReadTimeout"}),
                           ({"op": "snapshot"}, {"op": "snapshot", "error": "ReadTimeout"}), ({"path": "/t/{ch}"}, {"path": "/t/{ch}", "error": "ReadTimeout"})):
        with pytest.raises(ApiError) as e:
            device_http.request(c, "GET", "/a", where=where)
        assert (e.value.status, e.value.code, e.value.user_message, e.value.retryable) == (503, "source_unavailable", "ה־NVR אינו זמין כרגע.", True)
        assert e.value.details == details and list(e.value.details) == list(details), "same keys in the same order"
        assert isinstance(e.value.__cause__, httpx.ReadTimeout)


def test_request_returns_any_answer_and_passes_the_arguments():
    seen = []

    def handler(r: httpx.Request) -> httpx.Response:
        seen.append((r.method, r.url.path, r.content, r.headers.get("content-type")))
        return httpx.Response(500, text="no")

    c = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://nvr")
    r = device_http.request(c, "PUT", "/doc", content=b"<a/>", headers={"Content-Type": "application/xml"})
    assert r.status_code == 500 and seen == [("PUT", "/doc", b"<a/>", "application/xml")]


def test_request_uses_the_clients_own_verb_so_a_test_double_still_works():
    class OnlyGet:
        def get(self, path):
            return httpx.Response(200, text=path)

    assert device_http.request(OnlyGet(), "GET", "/x").text == "/x"


def test_an_error_that_is_not_a_transport_failure_is_not_mapped():
    class Broken:
        def get(self, path):
            raise ValueError("bug")

    with pytest.raises(ValueError):
        device_http.request(Broken(), "GET", "/x")


@pytest.mark.parametrize("text,as_tuple,as_dict", BODIES)
def test_one_reader_two_views(text, as_tuple, as_dict):
    rs = device_http.read_response_status(text)
    assert (rs.code, rs.sub) == as_tuple and rs.document() == as_dict


def test_both_former_parsers_are_views_of_the_shared_reader(monkeypatch):
    class Fake:
        code, sub = 9, "x"

        def document(self):
            return {"status": "s", "sub": "x"}

    monkeypatch.setattr(device_http, "read_response_status", lambda text: Fake())
    assert nvr_write.response_status("<anything/>") == (9, "x")
    assert nvr._response_status("<anything/>") == {"status": "s", "sub": "x"}
