"""FIX-VIDEO-2570 (final deep review 2.56, area VIDEO-DEVICES). Fake NVR only (httpx MockTransport); nothing reaches a device.

- VD-02, the settings half: a generic NVR settings write (`nvr_write.apply_change`) whose document was sent but whose answer was lost
  (a read time-out, a dropped connection after the body, a 5xx from the recorder) is recorded `unknown` and audited `allowed` with
  `outcome: unknown` - never `failed` / `denied`; nothing is re-sent. "Nothing left" (a connect error) and a refusal stay failed / denied.
- The alarm route's "expires too far ahead" answer uses the same code as every other command route (422 `expires_too_far`)."""
from __future__ import annotations

import datetime as dt
import json

import httpx
import pytest
from fastapi.testclient import TestClient

from smplwise.errors import ApiError
from smplwise.main import create_app
from smplwise.routers import alarm as alarm_router
from smplwise.services import nvr_system, nvr_write
from test_nvr_system import FakeNvr

NTP_PATH = "/ISAPI/System/time/ntpServers/1"


class Flaky(FakeNvr):
    """`mode` for a settings PUT: None = answers; "read_timeout" = sent, no answer; "disconnect" = the link dropped after the body;
    "connect" = nothing left; "5xx" = the recorder says 500; "refuse" = 403 (an ISAPI refusal)."""

    def __init__(self):
        super().__init__()
        self.mode: str | None = None
        self.puts = 0
        inner = self.handler

        def handler(request: httpx.Request) -> httpx.Response:
            if request.method == "PUT" and request.url.path == NTP_PATH:
                self.puts += 1
                if self.mode == "read_timeout":
                    raise httpx.ReadTimeout("slow", request=request)
                if self.mode == "disconnect":
                    raise httpx.RemoteProtocolError("dropped", request=request)
                if self.mode == "connect":
                    raise httpx.ConnectError("down", request=request)
                if self.mode == "5xx":
                    return httpx.Response(500, text="boom")
                if self.mode == "refuse":
                    return httpx.Response(403, text="<ResponseStatus><statusCode>4</statusCode><subStatusCode>noPermission</subStatusCode></ResponseStatus>")
            return inner(request)

        self.handler = handler  # type: ignore[method-assign]


@pytest.fixture()
def fake(monkeypatch) -> Flaky:
    f = Flaky()
    for mod in (nvr_write, nvr_system):
        monkeypatch.setattr(mod, "_client", f.client)
    return f


def _ntp_rows(c: TestClient):
    changes = [x for x in c.get("/api/v1/nvr/changes").json()["changes"] if x["target"] == "ntp"]
    audit = c.get("/api/v1/audit?prefix=nvr.&limit=50").json()
    rows = audit if isinstance(audit, list) else next((v for v in audit.values() if isinstance(v, list)), [])
    return changes, [e for e in rows if e.get("action") == "nvr.write" and NTP_PATH in json.dumps(e.get("details") or {})]


@pytest.mark.parametrize("mode", ["read_timeout", "disconnect", "5xx"])
def test_a_settings_write_whose_answer_was_lost_is_unknown(settings, fake, mode):
    fake.mode = mode
    with TestClient(create_app(settings)) as c:
        r = c.put("/api/v1/nvr/ntp", json={"host": "pool.ntp.org", "interval_min": 60})
        assert r.status_code == 504, r.text
        body = r.json()
        assert body["code"] == "action_outcome_unknown" and body["details"]["outcome"] == "unknown", body
        assert fake.puts == 1, "sent once, never re-sent"
        changes, audit = _ntp_rows(c)
        assert [x["status"] for x in changes] == ["unknown"], changes
        assert body["details"]["change_id"] == changes[0]["id"]
        assert len(audit) == 1 and audit[0]["decision"] == "allowed" and audit[0]["details"]["outcome"] == "unknown", audit
        # an unknown change is not offered for undo (nothing known to undo)
        assert c.post(f"/api/v1/nvr/changes/{changes[0]['id']}/rollback").status_code == 409


@pytest.mark.parametrize("mode", ["connect", "refuse"])
def test_nothing_sent_or_refused_stays_failed_and_denied(settings, fake, mode):
    fake.mode = mode
    with TestClient(create_app(settings)) as c:
        r = c.put("/api/v1/nvr/ntp", json={"host": "pool.ntp.org", "interval_min": 60})
        assert r.status_code >= 400 and r.json().get("details", {}).get("outcome") != "unknown", r.text
        assert r.json()["code"] != "action_outcome_unknown"
        changes, audit = _ntp_rows(c)
        assert [x["status"] for x in changes] == ["failed"]
        assert len(audit) == 1 and audit[0]["decision"] == "denied"


def test_the_pulse_and_the_settings_writes_share_one_rule():
    """The alarm-output pulse (FIX-NVR-PULSE-2560) and every settings write read "sent, no answer" the same way."""
    for exc in (ApiError(503, "source_unavailable", "x", details={"error": "ReadTimeout"}), ApiError(409, "nvr_rejected", "x", details={"status": 502}),
                ApiError(503, "source_unavailable", "x", details={"error": "ConnectError"}), ApiError(409, "nvr_rejected", "x", details={"status": 403}),
                ApiError(503, "source_forbidden", "x", details={"status": 401})):
        assert nvr_system.pulse_outcome_unknown(exc) == nvr_write.put_outcome_unknown(exc)
    assert nvr_system.NOT_SENT_TRANSPORT_ERRORS is nvr_write.NOT_SENT_TRANSPORT_ERRORS


def test_alarm_expiry_too_far_has_the_common_code():
    now = dt.datetime.now(dt.timezone.utc)
    far = (now + dt.timedelta(minutes=10)).strftime("%Y-%m-%dT%H:%M:%SZ")
    with pytest.raises(ApiError) as e:
        alarm_router._envelope("req-1", far)
    assert e.value.status == 422 and e.value.code == "expires_too_far", (e.value.status, e.value.code)
    assert (e.value.details or {}).get("fields") == ["expires_at"]
    alarm_router._envelope("req-2", (now + dt.timedelta(minutes=4)).strftime("%Y-%m-%dT%H:%M:%SZ"))  # within 5 min: accepted
    with pytest.raises(ApiError) as past:
        alarm_router._envelope("req-3", (now - dt.timedelta(seconds=5)).strftime("%Y-%m-%dT%H:%M:%SZ"))
    assert past.value.status == 409 and past.value.code == "expired"
