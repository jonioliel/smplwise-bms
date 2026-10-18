"""BUGS-1018: (1) the schedules screen stayed "stale" while the infrastructure was connected - the mirror was only re-pulled when it had
never synced, so a dead periodic pull or a remembered failure kept the banner for good, and the retry button only re-read the status;
(2) the user menu kept "restart needed" after the platform was restarted by hand - a stored reason cleared only after a restart that
Arx itself started. Fakes only."""
from __future__ import annotations

import datetime as dt

import pytest
from schedules_fixture import *  # noqa: F401,F403
from schedules_fixture import sched_app  # noqa: F401

from smplwise.db import set_setting
from smplwise.services import bridge_install, ha_sync, platform_restart, schedules

API = "/api/v1"


def _status(c, **params):
    return c.get(f"{API}/schedules/status", params=params).json()


# ---------------------------------------------------------------- bug 1

def test_a_connected_system_with_an_old_mirror_is_re_pulled_not_stale(sched_app):
    app, s, c, fake, tr = sched_app
    _status(c)  # first pull
    n = tr.ws_calls.count("scheduler")
    fake._t += dt.timedelta(minutes=schedules.STALE_AFTER_S // 60 + 5)  # the periodic pull died: nothing refreshed for 30 minutes
    st = _status(c)
    assert tr.ws_calls.count("scheduler") == n + 1, "the request re-checked"
    assert st["stale"] is False and st["available"] == "ok"


def test_a_remembered_failure_is_re_checked_when_the_system_is_back(sched_app):
    app, s, c, fake, tr = sched_app
    _status(c)
    tr.up = False
    assert schedules.MIRROR.pull(None, "test") == {"error": "ha_unavailable"}
    tr.up = True
    fake._t += dt.timedelta(minutes=2)
    st = _status(c)
    assert st["available"] == "ok" and st["stale"] is False


def test_the_retry_button_pulls_now_but_a_plain_read_keeps_the_wait(sched_app):
    app, s, c, fake, tr = sched_app
    _status(c)
    with app.state.db.connection() as conn:  # an error was just recorded: within the 30 s wait a plain read does not pull
        st = schedules.MIRROR.state(conn)
        st.update(last_error="home_assistant_error", last_attempt_at=schedules._iso(fake.now()))
        schedules.MIRROR._save(conn, st)
    n = tr.ws_calls.count("scheduler")
    assert _status(c)["available"] == "error" and tr.ws_calls.count("scheduler") == n
    st = _status(c, recheck="true")
    assert tr.ws_calls.count("scheduler") == n + 1 and st["available"] == "ok" and st["stale"] is False


def test_a_down_system_stays_stale_after_a_retry(sched_app):
    app, s, c, fake, tr = sched_app
    _status(c)
    tr.up = False
    st = _status(c, recheck="true")
    assert st["available"] == "ha_unavailable" and st["stale"] is True


# ---------------------------------------------------------------- bug 2

@pytest.fixture()
def conn(settings):
    from smplwise.main import create_app

    app = create_app(settings)
    with app.state.db.connection() as c:
        yield c


def _bridge(monkeypatch, installed, running):
    monkeypatch.setitem(bridge_install.STATE, "installed_version", installed)
    monkeypatch.setitem(bridge_install.STATE, "config_dir", "/homeassistant")
    monkeypatch.setitem(bridge_install.STATE, "last_error", None)


def test_files_copied_flag_on_then_restart_with_matching_version_flag_off(conn, monkeypatch):
    _bridge(monkeypatch, "0.9.2", None)
    set_setting(conn, "bridge.integration_version", "0.9.1")  # the platform still runs the old copy
    platform_restart.add_reason(conn, "release", "2.7.1")
    got = platform_restart.reasons(conn)
    assert [r["code"] for r in got] == ["bridge", "release"] and got[0]["running"] == "0.9.1" and got[0]["version"] == "0.9.2"
    # negative first: a restart whose bridge still reports the old version clears the stored reason but never the bridge one
    ha_sync._note_platform_back(_DbOf(conn), "9999-01-01T00:00:00Z")
    assert [r["code"] for r in platform_restart.reasons(conn)] == ["bridge"], "still differs: the flag stays and says which versions"
    # the bridge reports the version that is installed
    set_setting(conn, "bridge.integration_version", "0.9.2")
    assert platform_restart.reasons(conn) == []


def test_a_reason_added_after_the_drop_survives_the_reconnect(conn, monkeypatch):
    _bridge(monkeypatch, "0.9.2", "0.9.2")
    set_setting(conn, "bridge.integration_version", "0.9.2")
    platform_restart.add_reason(conn, "release", "2.7.1")
    ha_sync._note_platform_back(_DbOf(conn), "2000-01-01T00:00:00Z")  # the platform dropped long before the reason existed
    assert [r["code"] for r in platform_restart.reasons(conn)] == ["release"]


class _DbOf:
    """A Database look-alike that hands out the test's connection."""

    def __init__(self, conn):
        self._c = conn

    def connection(self, **_kw):
        import contextlib

        return contextlib.nullcontext(self._c)
