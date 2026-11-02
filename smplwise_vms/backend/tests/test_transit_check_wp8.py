"""POLISH4-WP8 (owner-approved 02.11): `POST /transit/check` - the settings screen's "בדוק עכשיו". The loop polls only stops a screen uses,
so an installation whose screens do not show the stops kept showing a stale `http_503` for days with no way to ask again. The check asks the
source ONCE for the configured stops (the recorded fake, no live call), updates the health and answers it; it never loops, never changes a
setting, honours the provider's Retry-After but not our own backoff, needs `system.configure`, is audited and runs at most once per 30 s."""
from __future__ import annotations

import datetime as dt

import pytest

from conftest import as_user
from transit_fake import FakeStride
from smplwise.routers import transit as router
from smplwise.services.transit import catalogue, poller, stride
from test_bustimes_295 import API, BASE, _db, _on


@pytest.fixture(autouse=True)
def _clean_state():
    poller.HEALTH.__init__()
    poller._PROVIDERS.clear()
    poller._LAST_CATALOGUE_TRY.clear()
    router._CHECK["at"] = 0.0
    yield
    router._CHECK["at"] = 0.0


def _configured(client, settings, fake):
    """Stops configured, the catalogue loaded, NO screen showing them (codes_in_use 0, the state the lab showed)."""
    catalogue.refresh(_db(settings), fake, BASE, dt.date(2026, 10, 26))
    _on(client)
    client.app.state.transit_fetch = fake


def _fail_run(n: int, kind: str = "http_503") -> None:
    for i in range(n):
        poller.HEALTH.fail(BASE + dt.timedelta(minutes=i), kind)


def _audit_rows(settings, action: str) -> list[dict]:
    with _db(settings).connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT action, decision, details_json FROM audit_log WHERE action = ?", (action,)).fetchall()]


def test_a_success_clears_the_failure_run_and_records_the_success(client, settings):
    fake = FakeStride(BASE)
    _configured(client, settings, fake)
    _fail_run(21)
    before = client.get(f"{API}/transit/status").json()["health"]
    assert before["state"] == "off" and before["codes_in_use"] == 0 and before["consecutive_errors"] == 21 and before["last_error"] == "http_503"
    calls = fake.arrival_calls()
    r = client.post(f"{API}/transit/check")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["check"]["ok"] is True and body["check"]["codes"] == 1 and body["check"]["fetched"] == 1 and body["check"]["error"] is None
    assert fake.arrival_calls() == calls + 1  # ONE request for the one configured stop, no loop
    h = body["health"]
    assert h["consecutive_errors"] == 0 and h["last_ok_at"] is not None and h["backoff_until"] is None
    assert h["errors"] == 21  # the history count stays (what happened is not erased)
    rows = _audit_rows(settings, "transit.check")
    assert len(rows) == 1 and rows[0]["decision"] == "allowed"


def test_our_own_backoff_does_not_block_a_person_but_the_providers_retry_after_does(client, settings):
    fake = FakeStride(BASE)
    _configured(client, settings, fake)
    _fail_run(5)  # the breaker is open (our backoff), no Retry-After from the provider
    assert client.post(f"{API}/transit/check").json()["check"]["ok"] is True
    router._CHECK["at"] = 0.0
    poller.HEALTH.fail(dt.datetime.now(dt.timezone.utc), "http_503", retry_after_s=600)  # the provider asked for ten minutes
    calls = fake.arrival_calls()
    c = client.post(f"{API}/transit/check").json()["check"]
    assert c["skipped"] == "retry_after" and 500 < c["retry_after_s"] <= 600 and fake.arrival_calls() == calls


def test_a_503_is_recorded_as_one_more_error(client, settings):
    fake = FakeStride(BASE)
    _configured(client, settings, fake)
    _fail_run(2)
    fake.fail = stride.StrideError("http_503")
    body = client.post(f"{API}/transit/check").json()
    assert body["check"]["ok"] is False and body["check"]["error"] == "http_503" and body["check"]["fetched"] == 0
    assert body["health"]["consecutive_errors"] == 3 and body["health"]["last_error"] == "http_503" and body["health"]["errors"] == 3
    with _db(settings).connection(mode="read") as conn:  # persisted, so a restart remembers the result of the check
        assert '"consecutive":3' in (conn.execute("SELECT value FROM settings WHERE key = ?", (poller.HEALTH_KEY,)).fetchone()[0])


def test_the_settings_are_never_changed(client, settings):
    fake = FakeStride(BASE)
    _configured(client, settings, fake)
    cfg = client.get(f"{API}/transit/settings").json()["config"]
    client.post(f"{API}/transit/check")
    assert client.get(f"{API}/transit/settings").json()["config"] == cfg


def test_no_stops_is_answered_without_a_call(client, settings):
    fake = FakeStride(BASE)
    client.app.state.transit_fetch = fake
    body = client.post(f"{API}/transit/check").json()
    assert body["check"]["skipped"] == "no_stops" and fake.calls == []


def test_permission_system_configure(client, settings):
    fake = FakeStride(BASE)
    _configured(client, settings, fake)
    calls = len(fake.calls)
    assert client.post(f"{API}/transit/check", headers=as_user("dana")).status_code == 403
    assert len(fake.calls) == calls and _audit_rows(settings, "transit.check") == []


def test_one_check_per_30_seconds(client, settings):
    fake = FakeStride(BASE)
    _configured(client, settings, fake)
    assert client.post(f"{API}/transit/check").status_code == 200
    calls = fake.arrival_calls()
    r = client.post(f"{API}/transit/check")
    assert r.status_code == 429 and r.json()["code"] == "transit_check_rate_limited" and 0 < r.json()["details"]["retry_after_s"] <= 30
    assert fake.arrival_calls() == calls
