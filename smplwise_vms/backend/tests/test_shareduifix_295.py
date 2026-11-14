"""SHAREDUI-295: the external-access list carries the served WisKey copy's freshness, so the screen can show an honest "no connection to
WisKey since HH:MM" banner instead of last-known states as current. Read-only: the field grants nothing, names no station or person, and
when it cannot be read it says "not reachable" (never "connected"). FAKES ONLY (the Env of tests/test_access_grants.py, the served copy
set in memory); nothing reaches WisKey."""
from __future__ import annotations

import pytest
from conftest import bind
from fake_trusted_bridge import station
from test_access_grants import Env
from test_accessreq_293 import _get, _stations

from smplwise.services import access_grants as ag
from smplwise.services import access_request as ar
from smplwise.services import intercom_sync


@pytest.fixture()
def env(settings, monkeypatch):
    e = Env(settings, monkeypatch)
    monkeypatch.setattr(intercom_sync.STATE, "state", "ready")
    monkeypatch.setattr(intercom_sync.STATE, "fetched_at", "2026-10-20T06:41:00Z")
    _stations(station("st-a", "לובי ראשי", relays=[1, 2]))
    yield e
    with intercom_sync.SYNC._cache_lock:
        intercom_sync.SYNC._cache = None
    ag.reset_for_tests()


def test_the_list_says_when_wiskey_was_last_read_and_whether_it_answers(env):
    d = _get(env, "/access-grants").json()
    assert d["wiskey"] == {"as_of": "2026-10-20T06:41:00Z", "reachable": True, "has_copy": True}


def test_a_wiskey_that_does_not_answer_is_reported_with_the_last_copy_time(env, monkeypatch):
    monkeypatch.setattr(intercom_sync.STATE, "state", "error")
    d = _get(env, "/access-grants").json()
    assert d["wiskey"] == {"as_of": "2026-10-20T06:41:00Z", "reachable": False, "has_copy": True}


def test_no_copy_at_all_is_not_reachable(env):
    with intercom_sync.SYNC._cache_lock:
        intercom_sync.SYNC._cache = None
    d = _get(env, "/access-grants").json()
    assert d["wiskey"]["reachable"] is False and d["wiskey"]["has_copy"] is False


def test_an_unreadable_signal_fails_closed_and_never_fails_the_list(env, monkeypatch):
    def boom():
        raise RuntimeError("no state")

    monkeypatch.setattr(ar, "freshness", boom)
    r = _get(env, "/access-grants")
    assert r.status_code == 200, r.text
    assert r.json()["wiskey"] == {"as_of": None, "reachable": False, "has_copy": False}


def test_the_signal_names_nothing_and_a_viewer_gets_no_grants(env):
    bind(env.c, env.settings, "vw", "viewer", "installation", "*")
    d = _get(env, "/access-grants", "vw").json()
    assert set(d["wiskey"]) == {"as_of", "reachable", "has_copy"}, "no station, person or host in the signal"
    assert d["grants"] == [] and d["may_request"] is False
