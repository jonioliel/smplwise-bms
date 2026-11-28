"""FIX-NVR-PULSE-2560 (deep review VD-02, VD-04): the alarm-output pulse. Fake NVR only (httpx MockTransport); nothing reaches a device.

VD-02: a pulse that was sent and whose answer was lost is "unknown" in the change log and the audit - never failed / denied.
VD-04: the route needs confirm=true and a client request id; a repeated id answers the first result and sends nothing."""
from __future__ import annotations

import json

import httpx
import pytest
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import nvr_system, nvr_write
from test_nvr_system import FakeNvr

URL = "/api/v1/nvr/outputs/1/pulse"


class Flaky(FakeNvr):
    """`mode`: None = answers; "read_timeout" = the command left, no answer; "connect" = nothing left; "5xx" = the recorder says 500; "refuse" = 403."""

    def __init__(self):
        super().__init__()
        self.mode: str | None = None
        self.sent = 0
        inner = self.handler

        def handler(request: httpx.Request) -> httpx.Response:
            if request.method == "PUT" and request.url.path.endswith("/trigger"):
                self.sent += 1
                if self.mode == "read_timeout":
                    raise httpx.ReadTimeout("slow", request=request)
                if self.mode == "connect":
                    self.sent -= 1
                    raise httpx.ConnectError("down", request=request)
                if self.mode == "5xx":
                    return httpx.Response(500, text="boom")
                if self.mode == "refuse":
                    return httpx.Response(403, text="<ResponseStatus><statusCode>4</statusCode><subStatusCode>noPermission</subStatusCode></ResponseStatus>")
            return inner(request)

        self.handler = handler  # type: ignore[method-assign]


@pytest.fixture()
def fake(monkeypatch) -> Flaky:
    nvr_system._PULSE_SEEN.clear()
    f = Flaky()
    for mod in (nvr_write, nvr_system):
        monkeypatch.setattr(mod, "_client", f.client)
    return f


def _rows(c: TestClient):
    changes = [x for x in c.get("/api/v1/nvr/changes").json()["changes"] if x["kind"] == "alarm_output"]
    audit = c.get("/api/v1/audit?prefix=nvr.&limit=50").json()
    rows = audit if isinstance(audit, list) else next((v for v in audit.values() if isinstance(v, list)), [])
    return changes, [e for e in rows if e.get("action") == "nvr.write" and "alarm_output" in json.dumps(e.get("details") or {})]


# ---------------------------------------------------------------- VD-04

def test_pulse_needs_confirm_and_request_id(settings, fake):
    with TestClient(create_app(settings)) as c:
        assert c.post(URL).status_code == 422
        assert c.post(URL, json={}).status_code == 422
        assert c.post(URL, json={"confirm": True}).status_code == 422, "no request id"
        assert c.post(URL, json={"client_request_id": "a"}).status_code == 422, "no confirm"
        assert c.post(URL, json={"confirm": False, "client_request_id": "a"}).status_code == 422
        assert fake.sent == 0, "a refused request sends nothing"
        r = c.post(URL, json={"confirm": True, "client_request_id": "a"})
        assert r.status_code == 201 and fake.sent == 1


def test_repeated_request_id_pulses_once(settings, fake):
    with TestClient(create_app(settings)) as c:
        first = c.post(URL, json={"confirm": True, "client_request_id": "tab-1"})
        again = c.post(URL, json={"confirm": True, "client_request_id": "tab-1"})
        assert first.status_code == 201 and again.status_code == 201
        assert again.json()["id"] == first.json()["id"] and fake.sent == 1
        other = c.post(URL, json={"confirm": True, "client_request_id": "tab-2"})
        assert other.status_code == 201 and other.json()["id"] != first.json()["id"] and fake.sent == 2
        assert len(_rows(c)[0]) == 2


# ---------------------------------------------------------------- VD-02

def test_lost_answer_is_unknown_not_failed_or_denied(settings, fake):
    fake.mode = "read_timeout"
    with TestClient(create_app(settings)) as c:
        r = c.post(URL, json={"confirm": True, "client_request_id": "u-1"})
        assert r.status_code >= 500 and fake.sent == 1
        assert r.json()["details"]["outcome"] == "unknown", r.text
        changes, audit = _rows(c)
        assert [x["status"] for x in changes] == ["unknown"]
        assert len(audit) == 1 and audit[0]["decision"] == "allowed" and audit[0]["details"]["outcome"] == "unknown", audit
        # a resend with the same id does not pulse again; it repeats the unknown answer
        again = c.post(URL, json={"confirm": True, "client_request_id": "u-1"})
        assert again.status_code == r.status_code and again.json()["details"]["outcome"] == "unknown" and fake.sent == 1


def test_device_5xx_is_unknown(settings, fake):
    fake.mode = "5xx"
    with TestClient(create_app(settings)) as c:
        r = c.post(URL, json={"confirm": True, "client_request_id": "u-5"})
        assert r.json()["details"]["outcome"] == "unknown"
        assert [x["status"] for x in _rows(c)[0]] == ["unknown"]


@pytest.mark.parametrize("mode", ["connect", "refuse"])
def test_nothing_sent_or_refused_stays_failed_and_denied(settings, fake, mode):
    fake.mode = mode
    with TestClient(create_app(settings)) as c:
        r = c.post(URL, json={"confirm": True, "client_request_id": f"r-{mode}"})
        assert r.status_code >= 400 and r.json().get("details", {}).get("outcome") != "unknown", r.text
        changes, audit = _rows(c)
        assert [x["status"] for x in changes] == ["failed"]
        assert len(audit) == 1 and audit[0]["decision"] == "denied"
        # a refusal sent nothing: the same id may try again once the recorder answers
        fake.mode = None
        assert c.post(URL, json={"confirm": True, "client_request_id": f"r-{mode}"}).status_code == 201
