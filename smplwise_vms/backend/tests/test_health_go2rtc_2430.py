"""HEALTH-GO2RTC-2430 (lab 11.11): the go2rtc add-on was stopped for two days and every Arx call to it failed, yet GET /health said
`status: ok` and `go2rtc_configured: true`. Regression tests: reachability is tracked from the add-on's own go2rtc calls plus a light,
backoff-bounded probe; /health reports it (and `degraded`) while /healthz - the Supervisor watchdog - stays `ok`; the summary carries one
operator-worded item; the administrators get a system.health notice after five minutes that resolves on recovery; a refused live socket
says why in a JSON frame before it closes (HA ingress turns a bare 4503 into a plain 1000)."""
from __future__ import annotations

import json
from dataclasses import replace

import httpx
import pytest
from conftest import as_user, bind, seed_tree
from fastapi.testclient import TestClient
from notify_src_world import API, Clock, World, clock, fake_push, iso  # noqa: F401 - fixtures
from starlette.websockets import WebSocketDisconnect

from smplwise.main import create_app
from smplwise.services import go2rtc as g2
from smplwise.services import media_reach, notify_sources
from smplwise.services.media_reach import BACKOFF_MAX_S, OK_REFRESH_S, REACH, REACHABLE, UNKNOWN, UNREACHABLE

URL = "http://go2rtc-stopped.invalid:1984"


class FakeGo2rtc:
    """A go2rtc behind httpx.MockTransport: `down` raises a DNS-style ConnectError, otherwise it answers. Counts requests."""

    def __init__(self) -> None:
        self.down = True
        self.calls = 0

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.calls += 1
        if self.down:
            raise httpx.ConnectError("[Errno -2] Name or service not known", request=request)
        if request.url.path == "/api":
            return httpx.Response(200, json={"version": "1.9.9"})
        if request.url.path == "/api/streams" and request.method == "GET":
            return httpx.Response(200, json={})
        return httpx.Response(200, json={})


@pytest.fixture()
def fake(monkeypatch) -> FakeGo2rtc:
    f = FakeGo2rtc()
    monkeypatch.setattr(g2.Go2rtc, "_client", lambda self: httpx.Client(base_url=self.base, transport=httpx.MockTransport(f.handler), event_hooks=g2._REACH_HOOKS))
    return f


@pytest.fixture()
def gsettings(settings):
    return replace(settings, go2rtc_url=URL)


# ---------------------------------------------------------------- the tracker

def test_outcomes_set_state_since_and_the_backoff():
    REACH.record_failure("ConnectError", now=1000.0)
    v = REACH.view(type("S", (), {"go2rtc_url": URL})(), now=1005.0)
    assert v["state"] == UNREACHABLE and v["since"] and v["down_for_s"] == 5 and v["failures"] == 1 and v["last_error"] == "ConnectError"
    assert v["retry_in_s"] == 5  # first re-probe after BACKOFF_BASE_S = 10 s
    waits = []
    for i in range(6):
        waits.append(REACH.backoff_s())
        REACH.record_failure("ConnectError", now=1000.0 + i)
    assert waits == [10.0, 20.0, 40.0, 60.0, 60.0, 60.0] and max(waits) == BACKOFF_MAX_S
    since = REACH.view(type("S", (), {"go2rtc_url": URL})())["since"]
    assert since == v["since"], "a further failure never moves `since`"
    REACH.record_ok(now=2000.0)
    v2 = REACH.view(type("S", (), {"go2rtc_url": URL})(), now=2001.0)
    assert v2["state"] == REACHABLE and v2["failures"] == 0 and v2["down_for_s"] is None and v2["since"] != since and v2["last_error"] == "ConnectError"
    assert REACH.view(type("S", (), {"go2rtc_url": None})())["state"] == "not_configured"


def test_the_probe_runs_only_when_due_and_backs_off(gsettings, fake):
    assert REACH.view(gsettings)["state"] == UNKNOWN
    assert REACH.tick(gsettings, now=0.0) is True and fake.calls == 1
    assert REACH.state == UNREACHABLE
    # ten screens asking within the backoff window cause no further request
    for _ in range(10):
        REACH.tick(gsettings, now=REACH.last_contact + 1)
    assert fake.calls == 1
    t = REACH.last_contact
    assert REACH.tick(gsettings, now=t + 10.5) is True and fake.calls == 2  # 10 s, then 20 s ...
    assert REACH.tick(gsettings, now=REACH.last_contact + 15) is False and fake.calls == 2
    fake.down = False
    assert REACH.tick(gsettings, now=REACH.last_contact + 20.5) is True and REACH.state == REACHABLE
    # reachable and idle: one probe a minute at most
    n = fake.calls
    assert REACH.tick(gsettings, now=REACH.last_contact + OK_REFRESH_S - 1) is False and fake.calls == n
    # not configured: never a probe
    assert REACH.tick(replace(gsettings, go2rtc_url=None)) is False


def test_an_answer_in_the_same_clock_tick_as_the_failure_still_counts(gsettings, fake, monkeypatch):
    """FLAKY-G2R-BACKOFF-2437: on Windows `time.time()` moves in ~15 ms steps, so a failed contact and the answer right after it can carry
    the same timestamp. `tick` used `last_contact` to see whether its probe recorded an outcome and took that answer for "no answer"
    (next probe in 10 s instead of 60 s). The clock is frozen here to make that case certain."""
    monkeypatch.setattr(media_reach.time, "time", lambda: 5000.0)
    assert REACH.tick(gsettings) is True and REACH.state == UNREACHABLE and REACH.last_contact == 5000.0
    fake.down = False
    assert REACH.tick(gsettings, now=6000.0) is True and REACH.state == REACHABLE
    assert REACH.last_contact == 5000.0, "the answer carries the failure's timestamp"
    assert REACH.next_probe_at == 5000.0 + OK_REFRESH_S, "the answer counted: the next probe after a minute, not after 10 s"


def test_any_go2rtc_call_feeds_the_tracker_but_a_slow_answer_does_not(gsettings, fake, monkeypatch):
    with pytest.raises(Exception):
        g2.Go2rtc(gsettings).list_streams()
    assert REACH.state == UNREACHABLE
    fake.down = False
    g2.Go2rtc(gsettings).list_streams()
    assert REACH.state == REACHABLE

    def slow(request):
        raise httpx.ReadTimeout("slow", request=request)

    monkeypatch.setattr(g2.Go2rtc, "_client", lambda self: httpx.Client(base_url=self.base, transport=httpx.MockTransport(slow), event_hooks=g2._REACH_HOOKS))
    with pytest.raises(Exception):
        g2.Go2rtc(gsettings).info()
    assert REACH.state == REACHABLE, "a read timeout says nothing about reachability"


# ---------------------------------------------------------------- /health, /healthz, /health/video, /health/summary

def test_health_reports_unreachable_and_degraded_while_healthz_stays_ok(gsettings, fake):
    c = TestClient(create_app(gsettings))
    REACH.record_failure("ConnectError")
    h = c.get("/api/v1/health").json()
    assert h["status"] == "degraded" and h["degraded_reasons"] == ["media_unreachable"]
    assert h["go2rtc_configured"] is True and h["media"]["state"] == UNREACHABLE and h["media"]["since"] and h["media"]["last_error"] == "ConnectError"
    assert URL not in json.dumps(h) and "go2rtc-stopped" not in json.dumps(h), "never the address"
    # the Supervisor watchdog target: no restart loop because the video service is down
    assert c.get("/healthz").json() == {"status": "ok"}
    # every signed-in user may ask the video state (the screens do before retrying); the probe runs at most once per backoff window
    ids = seed_tree(c)
    bind(c, gsettings, "ron", "viewer", "floor", ids["floor2"])
    calls = fake.calls
    v = c.get("/api/v1/health/video", headers=as_user("ron"))
    v2 = c.get("/api/v1/health/video", headers=as_user("ron"))
    assert v.status_code == 200 and v.json()["state"] == UNREACHABLE and v2.json()["state"] == UNREACHABLE
    assert fake.calls - calls <= 1
    # recovery: the next due probe settles it and /health is ok again
    fake.down = False
    REACH.next_probe_at = 0.0
    assert c.get("/api/v1/health/video").json()["state"] == REACHABLE
    h2 = c.get("/api/v1/health").json()
    assert h2["status"] == "ok" and h2["degraded_reasons"] == [] and h2["media"]["state"] == REACHABLE


def test_health_without_go2rtc_is_not_configured_and_ok(settings):
    c = TestClient(create_app(settings))
    h = c.get("/api/v1/health").json()
    assert h["media"]["state"] == "not_configured" and h["status"] == "ok"
    assert c.get("/api/v1/health/video").json()["state"] == "not_configured"


def test_summary_has_one_operator_worded_video_item(gsettings, fake):
    from smplwise.services import autosync

    c = TestClient(create_app(replace(gsettings, nvr_host="nvr.example", nvr_user="viewer", nvr_password="pw")))
    saved = dict(autosync.STATE)
    try:
        autosync.STATE["streams_last_error"] = "media_unavailable"
        REACH.record_failure("ConnectError")
        body = c.get("/api/v1/health/summary").json()
        items = {i["id"]: i for i in body["items"]}
        assert items["video_service"]["status"] == "error" and body["status"] == "error"
        assert "go2rtc" not in items["video_service"]["label"] and "שירות הווידאו לא זמין" in items["video_service"]["label"]
        assert "go2rtc" not in items, "the stream-sync warning says the same thing; one item"
        REACH.record_ok()
        items2 = {i["id"] for i in c.get("/api/v1/health/summary").json()["items"]}
        assert "video_service" not in items2 and "go2rtc" in items2  # back to the plain sync warning until the next sync
    finally:
        autosync.STATE.clear()
        autosync.STATE.update(saved)


# ---------------------------------------------------------------- the administrators' notice

@pytest.fixture()
def w(settings, clock) -> World:  # noqa: F811
    return World(settings, clock)


def test_admin_notice_after_fifteen_minutes_and_resolved_on_recovery(w, clock):  # noqa: F811
    # HEALTH-GO2RTC-FOLLOWUP-2431 (owner 11.11, answer 1): 15 minutes by default (was the policy's 5); the delay itself is a setting
    def run(on: bool):
        summary = {"status": "error" if on else "ok", "items": [{"id": "video_service", "status": "error", "label": "x"}] if on else []}
        with w.db.connection() as conn:
            return notify_sources.health_tick(conn, summary, {"known": True, "none": False, "age_s": 3600.0}, clock.now)

    run(True)
    clock.advance(seconds=890)
    run(True)
    assert w.rows("system.health") == [], "held for the default 15 minutes: a short go2rtc restart makes no row"
    clock.advance(seconds=20)
    run(True)
    rows = w.rows("system.health")
    assert [r["subject_id"] for r in rows] == ["video_service"] and "שירות הווידאו לא זמין" in rows[0]["body"]
    assert "go2rtc" not in rows[0]["body"] and w.recipients(rows[0]["id"]) == {"joni"}
    run(False)
    assert {r["subject_id"]: r["state"] for r in w.rows("system.health")} == {"video_service": "resolved"}
    assert media_reach.ATTENTION_AFTER_S == 900


# ---------------------------------------------------------------- the live socket says why before it closes

def _camera(c: TestClient) -> str:
    seed_tree(c)
    return c.post("/api/v1/cameras", json={"channel": 1, "alias": "a"}).json()["id"]


def _frames_then_close(c: TestClient, url: str) -> tuple[list[dict], int]:
    frames: list[dict] = []
    with pytest.raises(WebSocketDisconnect) as ei:
        with c.websocket_connect(url) as ws:
            for _ in range(5):
                frames.append(json.loads(ws.receive_text()))
    return frames, ei.value.code


def test_live_socket_sends_the_reason_before_4503_when_not_configured(settings):
    c = TestClient(create_app(settings))
    cam = _camera(c)
    frames, code = _frames_then_close(c, f"/api/v1/media/live/{cam}/ws?profile=sub")
    assert code == 4503 and frames[-1]["type"] == "error" and frames[-1]["value"] == "media_not_configured"
    assert frames[-1]["message"] == "שירות הווידאו לא זמין" and frames[-1]["media"] == "not_configured"


def test_live_socket_sends_the_reason_before_4503_when_unreachable(gsettings, fake):
    c = TestClient(create_app(replace(gsettings, nvr_host="nvr.example", nvr_user="viewer", nvr_password="pw")))
    cam = _camera(c)
    frames, code = _frames_then_close(c, f"/api/v1/media/live/{cam}/ws?profile=sub")
    assert code == 4503 and frames[-1]["type"] == "error" and frames[-1]["value"] == "media_unavailable" and frames[-1]["media"] == UNREACHABLE
    assert "go2rtc" not in frames[-1]["message"]
    assert REACH.state == UNREACHABLE, "the failed stream write itself marked the service down"
