"""BUSSTATUS-297 (owner decisions): the source health survives a restart (settings store key `transit.health`, no migration), a failed nightly
catalogue download counts as the provider's outage, and the Settings document carries the outage threshold with its range. Fakes only."""
from __future__ import annotations

import datetime as dt

import pytest

from transit_fake import FakeStride
from smplwise.services.transit import model, poller, stride
from test_bustimes_295 import API, BASE, _db, _digest, _loaded, _on
from test_busstatus_297 import _view


@pytest.fixture(autouse=True)
def _clean_poller_state():
    poller.HEALTH.__init__()
    poller._PROVIDERS.clear()
    poller._LAST_CATALOGUE_TRY.clear()
    yield


def test_an_outage_survives_a_restart_without_an_unavailable_window(client, settings):
    _loaded(client, settings)
    db = _db(settings)
    fake = FakeStride(BASE)
    fake.fail = stride.StrideError("http_503")
    assert poller.poll_once(db, fake, BASE + dt.timedelta(minutes=1))["error"] == "http_503"
    poller.HEALTH.__init__()  # the process restarted: memory is empty, the database holds the state
    poller._PROVIDERS.clear()
    d = _digest(settings, BASE + dt.timedelta(minutes=40), {"enabled": True})  # before the loop's first pass
    assert d["state"] == "cached" and d["source_down"] is True and d["items"]
    assert _view(settings, 40)["state"] == "source_down"
    h = poller.HEALTH.view()
    assert h["consecutive_errors"] == 1 and h["last_error"] == "http_503" and h["failing_since"] == "2026-10-26T06:01:00Z"
    poller.HEALTH.__init__()
    assert poller.poll_once(db, fake, BASE + dt.timedelta(minutes=2))["skipped"] == "backoff"  # the breaker survives the restart too


def test_a_recovery_is_persisted_and_a_healthy_source_writes_nothing(client, settings):
    _loaded(client, settings)
    db = _db(settings)
    with db.connection(mode="read") as conn:
        assert conn.execute("SELECT 1 FROM settings WHERE key = ?", (poller.HEALTH_KEY,)).fetchone() is None  # a healthy poll wrote nothing
    fake = FakeStride(BASE)
    fake.fail = stride.StrideError("http_503")
    poller.poll_once(db, fake, BASE + dt.timedelta(minutes=5))
    fake.fail = None
    poller.poll_once(db, fake, BASE + dt.timedelta(minutes=30))
    poller.HEALTH.__init__()
    assert _view(settings, 31)["state"] == "ok" and poller.HEALTH.view()["consecutive_errors"] == 0


def test_a_failed_nightly_catalogue_download_counts_as_the_providers_outage(client, settings):
    fake = FakeStride(BASE)
    fake.fail = stride.StrideError("http_503")
    _on(client)
    res = poller.catalogue_pass(_db(settings), fake, BASE, force=True)
    assert res["error"] == "http_503"
    h = poller.HEALTH.view()
    assert h["consecutive_errors"] == 1 and h["last_error"] == "http_503" and model.is_outage(h["last_error"])
    poller.HEALTH.__init__()
    other = FakeStride(BASE)
    other.fail = stride.StrideError("http_404")  # not an outage: our request is wrong
    poller._LAST_CATALOGUE_TRY.clear()
    poller.catalogue_pass(_db(settings), other, BASE, force=True)
    assert poller.HEALTH.view()["consecutive_errors"] == 0


def test_the_settings_document_carries_the_threshold_and_its_range(client, settings):
    doc = client.get(f"{API}/transit/settings").json()
    assert doc["config"]["outage_warn_h"] == 6 and doc["limits"]["outage_warn_range"] == [1, 72]
    assert client.put(f"{API}/transit/settings", json={"outage_warn_h": 12}).json()["config"]["outage_warn_h"] == 12
