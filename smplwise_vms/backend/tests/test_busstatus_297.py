"""BUSSTATUS-297: a provider outage of the public-transport source (Open Bus Stride answering 5xx for hours, 27.10.2026) is a calm
"external data source unavailable" state, not a site fault - the system health stays out of "warning" until the outage outlasts the threshold
(default 6 h), the screens keep the last scheduled rows with their age, and a down provider is not hammered (Retry-After, 30-minute cap).
The provider is a local fake HTTP server answering 503 (no live call, no real host): `stride.BASE` is pointed at it."""
from __future__ import annotations

import datetime as dt
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from zoneinfo import ZoneInfo

import pytest

from transit_fake import FakeStride
from smplwise.services.transit import catalogue, health, model, poller, stride
from test_bustimes_295 import API, BASE, _board, _db, _digest, _loaded, _on

TZ = ZoneInfo("Asia/Jerusalem")


@pytest.fixture(autouse=True)
def _clean_poller_state():
    poller.HEALTH.__init__()
    poller._PROVIDERS.clear()
    poller._LAST_CATALOGUE_TRY.clear()
    yield


class _Handler(BaseHTTPRequestHandler):
    status = 503
    retry_after: str | None = None
    delay_s = 0.0
    hits = 0

    def do_GET(self):  # noqa: N802
        type(self).hits += 1
        if type(self).delay_s:
            threading.Event().wait(type(self).delay_s)
        try:
            self.send_response(type(self).status)
            if type(self).retry_after:
                self.send_header("Retry-After", type(self).retry_after)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"Service Unavailable")
        except OSError:  # the client gave up (the timeout test)
            pass

    def log_message(self, *a):
        pass


@pytest.fixture()
def fake_503_server(monkeypatch):
    _Handler.status, _Handler.retry_after, _Handler.delay_s, _Handler.hits = 503, None, 0.0, 0
    srv = HTTPServer(("127.0.0.1", 0), _Handler)
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    monkeypatch.setattr(stride, "BASE", f"http://127.0.0.1:{srv.server_address[1]}")
    yield _Handler
    srv.shutdown()
    srv.server_close()


# ---------------------------------------------------------------- the client against a fake 503 server

def test_a_503_is_one_error_kind_and_carries_retry_after(fake_503_server):
    fake_503_server.retry_after = "120"
    with pytest.raises(stride.StrideError) as e:
        stride.http_fetch("/gtfs_stops/list", {"limit": 1})
    assert e.value.kind == "http_503" and e.value.retry_after_s == 120 and fake_503_server.hits == 1
    fake_503_server.retry_after = "Wed, 21 Oct 2026 07:28:00 GMT"  # an HTTP date is ignored (only seconds are honoured)
    with pytest.raises(stride.StrideError) as e2:
        stride.http_fetch("/gtfs_stops/list", {})
    assert e2.value.kind == "http_503" and e2.value.retry_after_s is None


def test_a_timeout_is_unreachable_and_an_outage(fake_503_server, monkeypatch):
    monkeypatch.setattr(stride, "TIMEOUT_S", 0.2)
    fake_503_server.delay_s = 0.8
    with pytest.raises(stride.StrideError) as e:
        stride.http_fetch("/x", {})
    assert e.value.kind == "unreachable" and model.is_outage(e.value.kind)


def test_which_errors_are_a_provider_outage():
    for kind in ("http_500", "http_502", "http_503", "http_504", "http_429", "unreachable", "empty_catalogue", "bad_json", "bad_shape", "too_large"):
        assert model.is_outage(kind), kind
    for kind in ("http_400", "http_404", "http_403", "ValueError", "", None):
        assert not model.is_outage(kind), kind


# ---------------------------------------------------------------- backoff

def test_retry_after_lifts_the_backoff_but_never_beyond_an_hour(client, settings):
    fake = FakeStride(BASE)
    catalogue.refresh(_db(settings), fake, BASE, dt.date(2026, 10, 26))
    _on(client)
    _board(client)
    db = _db(settings)
    fake.fail = stride.StrideError("http_503", retry_after_s=600)
    poller.poll_once(db, fake, BASE)
    assert poller.HEALTH.backoff_until - BASE == dt.timedelta(seconds=600)  # the provider asked for 10 minutes (> the 60 s step)
    t = BASE + dt.timedelta(seconds=600)
    fake.fail = stride.StrideError("http_503", retry_after_s=999_999)
    poller.poll_once(db, fake, t)
    assert poller.HEALTH.backoff_until - t == dt.timedelta(seconds=3600)
    assert poller.HEALTH.view()["failing_since"] == "2026-10-26T06:00:00Z"  # the outage began at the first failure


def test_an_outage_is_retried_at_most_every_30_minutes_in_steady_state(client, settings):
    fake = FakeStride(BASE)
    catalogue.refresh(_db(settings), fake, BASE, dt.date(2026, 10, 26))
    _on(client)
    _board(client)
    db = _db(settings)
    fake.fail = stride.StrideError("http_503")
    t, tries = BASE, 0
    while t < BASE + dt.timedelta(hours=6):  # a loop pass every 30 s for 6 hours
        if poller.poll_once(db, fake, t).get("error"):
            tries += 1
        t += dt.timedelta(seconds=30)
    assert tries <= 16  # 60+120+240+480+900 s, then one every 30 minutes (was one every 8 minutes: about 45 tries)


# ---------------------------------------------------------------- health: calm until the threshold

def _view(settings, minutes):
    with _db(settings).connection(mode="read") as conn:
        return health.view(conn, BASE + dt.timedelta(minutes=minutes))


def test_a_provider_outage_is_source_down_not_down_until_the_threshold(client, settings):
    _loaded(client, settings)
    poller.HEALTH.fail(BASE + dt.timedelta(minutes=5), "http_503")
    assert _view(settings, 2)["state"] == "ok"
    h = _view(settings, 10)  # past the fresh window, within the grace: stale becomes the calm state while the provider fails
    assert h["state"] == "source_down" and h["outage"] is True and h["last_good_at"] == "2026-10-26T06:00:00Z"
    h = _view(settings, 40)  # past the 30-minute grace: used to be "down" (system warning)
    assert h["state"] == "source_down" and h["age_s"] == 40 * 60 and h["last_error"] == "http_503"
    assert _view(settings, 5 * 60 + 59)["state"] == "source_down"
    assert _view(settings, 6 * 60 + 1)["state"] == "down"  # the outage outlasted the 6 h default


def test_the_threshold_is_configurable(client, settings):
    _loaded(client, settings, outage_warn_h=1)
    poller.HEALTH.fail(BASE, "http_503")
    assert _view(settings, 59)["state"] == "source_down" and _view(settings, 61)["state"] == "down"
    assert client.put(f"{API}/transit/settings", json={"outage_warn_h": 0}).status_code == 422
    assert client.put(f"{API}/transit/settings", json={"outage_warn_h": 73}).status_code == 422


def test_a_fault_on_our_side_is_still_down_and_a_recovery_is_ok(client, settings):
    _loaded(client, settings)
    poller.HEALTH.fail(BASE, "ValueError")  # a crash in our own code, not the provider
    assert _view(settings, 40)["state"] == "down" and _view(settings, 40)["outage"] is False
    poller.HEALTH.__init__()
    assert _view(settings, 40)["state"] == "down"  # no error recorded at all (the loop is not running): also ours
    poller.HEALTH.fail(BASE, "http_503")
    poller.HEALTH.ok(BASE + dt.timedelta(minutes=1))
    assert _view(settings, 1)["state"] == "ok" and poller.HEALTH.view()["failing_since"] is None


def test_the_system_health_does_not_warn_during_a_provider_outage_and_warns_after_the_threshold(client, settings):
    """The wall clock decides here (the report reads `now`): the cache is written with real times, then aged by hand."""
    now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
    fake = FakeStride(now)
    catalogue.refresh(_db(settings), fake, now, now.astimezone(TZ).date())
    _on(client)
    _board(client)
    poller.poll_once(_db(settings), fake, now)

    def age(minutes):
        with _db(settings).connection() as conn:
            conn.execute("UPDATE transit_cache SET fetched_at = ?", ((now - dt.timedelta(minutes=minutes)).strftime("%Y-%m-%dT%H:%M:%SZ"),))

    age(40)
    poller.HEALTH.fail(now, "http_503")
    report = client.get(f"{API}/health/report").json()
    check = next(c for c in report["checks"] if c["id"] == "transit")
    assert check["status"] == "ok" and check["meta"]["state"] == "source_down" and check["meta"]["outage"] is True
    assert "אינו זמין" in check["message"] and check["meta"]["last_good_at"]
    summary = client.get(f"{API}/health/summary").json()
    assert all(i["id"] != "transit" for i in summary["items"])  # no system warning for a provider outage
    age(7 * 60)
    summary = client.get(f"{API}/health/summary").json()
    item = next(i for i in summary["items"] if i["id"] == "transit")
    assert item["status"] == "warn" and "תקלה אצל הספק" in item["label"]


# ---------------------------------------------------------------- the screens

def test_the_card_keeps_the_last_rows_with_their_age_while_the_provider_is_down(client, settings):
    _loaded(client, settings)
    poller.HEALTH.fail(BASE, "http_503")
    d = _digest(settings, BASE + dt.timedelta(minutes=40), {"enabled": True, "window_min": 60})
    assert d["state"] == "cached" and d["source_down"] is True and d["partial"] is False  # past the 30-minute grace, rows still there
    assert d["age_s"] == 40 * 60 and d["updated_hm"] == "08:00" and [i["hm"] for i in d["items"]] == ["09:05", "09:36"]
    assert all(i["quality"] != "realtime" for i in d["items"])  # scheduled times, no countdown


def test_a_long_outage_says_unknown_not_no_buses_and_a_day_later_unavailable(client, settings):
    _loaded(client, settings)
    poller.HEALTH.fail(BASE, "http_503")
    d = _digest(settings, BASE + dt.timedelta(hours=4), {"enabled": True, "window_min": 60})  # the cached window (to +2.5 h) is behind us
    assert d["state"] == "cached" and d["source_down"] and d["partial"] is True and d["items"] == []
    d = _digest(settings, BASE + dt.timedelta(hours=25), {"enabled": True})
    assert d["state"] == "expired" and d["source_down"] is True and "items" not in d


def test_without_an_outage_or_with_no_grace_the_old_rules_hold(client, settings):
    _loaded(client, settings)
    d = _digest(settings, BASE + dt.timedelta(minutes=40), {"enabled": True})  # nothing recorded against the provider
    assert d["state"] == "expired" and d["source_down"] is False and "items" not in d
    poller.HEALTH.fail(BASE, "ValueError")  # our own crash is not the provider
    assert _digest(settings, BASE + dt.timedelta(minutes=40), {"enabled": True})["state"] == "expired"
    poller.HEALTH.fail(BASE, "http_503")
    client.put(f"{API}/transit/settings", json={"stale_grace_min": 0})  # 0 = no last-known data at all
    assert _digest(settings, BASE + dt.timedelta(minutes=40), {"enabled": True})["state"] == "expired"


def test_the_fresh_digest_carries_no_outage_flag(client, settings):
    _loaded(client, settings)
    poller.HEALTH.fail(BASE, "http_503")  # a single failed pass while the cache is still fresh
    d = _digest(settings, BASE + dt.timedelta(seconds=30), {"enabled": True})
    assert d["state"] == "fresh" and d["source_down"] is False
