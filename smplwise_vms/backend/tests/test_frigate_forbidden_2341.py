"""FRIGATE-FORBIDDEN-2341 - a Frigate recorder whose saved credentials Frigate refuses (the owner's home install, 2026-11-01: HTTP 401
on /api/login since the recorder was enabled, two WARNING lines a minute for three days).

Covered: the login lockout doubles per refusal of the SAME credentials (5 -> 10 -> 20 -> 30 -> 30 min) and never holds back other
credentials; the event reader waits out the lockout and logs one line per state change; the periodic discovery logs a repeated failure
once; the health card and the notification carry the exact Hebrew fix step. Everything runs against the FAKE Frigate."""
from __future__ import annotations

import dataclasses
import logging
import sys
import threading
from pathlib import Path

import pytest

from smplwise.db import Database, now_iso
from smplwise.errors import ApiError
from smplwise.services import events_ingest, recorder_health as rh, rules
from smplwise.services.recorders import frigate as fr
from smplwise.services.recorders import frigate_events as fe
from smplwise.services.recorders import frigate_http as fh

sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from fake_frigate import T0, FakeFrigate, settings_for  # noqa: E402

RID = "nvr-2"


class Clock:
    def __init__(self, t: float = 1000.0) -> None:
        self.t = t

    def __call__(self) -> float:
        return self.t


@pytest.fixture(autouse=True)
def _clean(monkeypatch):
    fh.clear_cache()
    fr.clear_cache()
    fe.STATES.clear()
    rh.reset()
    yield
    fh.clear_cache()
    fr.clear_cache()
    fe.STATES.clear()
    rh.reset()


@pytest.fixture()
def fake() -> FakeFrigate:
    f = FakeFrigate()
    f.login_ok = False  # the owner's case: every login answers 401
    return f


@pytest.fixture()
def mono(monkeypatch) -> Clock:
    c = Clock()
    monkeypatch.setattr(fh, "_monotonic", c)
    return c


def logins(fake: FakeFrigate) -> int:
    return fake.non_get.count("POST /api/login")


# ---------------------------------------------------------------------------------------------- the login lockout

def test_the_refusal_delay_doubles_up_to_thirty_minutes():
    assert [fh.refused_delay(n) for n in range(1, 7)] == [300.0, 600.0, 1200.0, 1800.0, 1800.0, 1800.0]


def test_the_same_refused_credentials_wait_longer_each_time(settings, fake, mono):
    a = fr.FrigateAdapter(RID, settings_for(settings), transport=fake.transport())
    for expected in (300.0, 600.0, 1200.0, 1800.0, 1800.0):
        with pytest.raises(ApiError) as e:
            a.http.login()
        assert e.value.code == "source_forbidden" and e.value.details["status"] == 401
        r = a.http.refusal()
        assert r["status"] == 401 and r["retry_in_s"] == expected
        sent = logins(fake)
        with pytest.raises(ApiError) as held:  # inside the lockout nothing is sent
            a.http.login()
        assert held.value.details["reason"] == "credentials_refused_backoff" and held.value.details["status"] == 401
        assert logins(fake) == sent
        mono.t += expected  # the lockout is over: the next call really tries again
    assert logins(fake) == 5


def test_new_credentials_are_tried_at_once_and_do_not_lift_the_old_lockout(settings, fake, mono):
    old = fr.FrigateAdapter(RID, settings_for(settings), transport=fake.transport())
    with pytest.raises(ApiError):
        old.http.login()
    fake.login_ok = True
    fixed = fr.FrigateAdapter(RID, settings_for(settings), transport=fake.transport())
    assert fixed.http.device_key == old.http.device_key, "same host, port, scheme and user: the same device"
    # the connection test of a corrected password (a different password than the refused one) is not held back
    wrong = dataclasses.replace(settings_for(settings), nvr_password="another-wrong-one")
    probe = fr.FrigateAdapter(RID, wrong, transport=fake.transport())
    assert probe.http.refusal() is None
    with pytest.raises(ApiError) as e:
        probe.http.login()
    assert e.value.details.get("reason") == "credentials", "a real login was sent, not the lockout answer"
    assert old.http.refusal()["strikes"] == 1, "the other password's refusal never touched the first one's"


def test_a_successful_login_clears_the_refusal(settings, fake, mono):
    a = fr.FrigateAdapter(RID, settings_for(settings), transport=fake.transport())
    with pytest.raises(ApiError):
        a.http.login()
    fake.login_ok = True  # Frigate's user was fixed on Frigate's side
    mono.t += 301
    assert a.http.login() and a.http.refusal() is None


# ---------------------------------------------------------------------------------------------- one log line per state

def test_failure_log_writes_one_warning_per_state_change(caplog):
    lg = logging.getLogger("smplwise.test_flog")
    flog = fe.FailureLog(lg, "poll", RID)
    with caplog.at_level(logging.DEBUG, logger="smplwise.test_flog"):
        assert flog.failed("source_forbidden", 300, {"status": 401}) is True
        for _ in range(20):
            assert flog.failed("source_forbidden", 600, {"status": 401}) is False
        flog.failed("source_unavailable", 5)
        flog.ok()
        flog.ok()
    warnings = [r for r in caplog.records if r.levelno == logging.WARNING]
    infos = [r for r in caplog.records if r.levelno == logging.INFO]
    assert len(warnings) == 2 and len(infos) == 1
    first = warnings[0].getMessage()
    assert "source_forbidden" in first and "HTTP 401" in first and "Settings > Connections" in first and "retry in 300s" in first
    assert "working again after source_unavailable" in infos[0].getMessage()


# ---------------------------------------------------------------------------------------------- the event reader

class Listener:
    def __init__(self, db, s) -> None:
        self.db, self.settings, self.recorder_id = db, s, RID
        self.state = events_ingest.IngestState()
        self.stop = threading.Event()
        self.tz_getter = lambda: "Asia/Jerusalem"


class NoWs:
    """A WebSocket that never connects (the reader's WS thread is not what this test counts)."""

    def __call__(self, url, **kwargs):
        raise OSError("not in this test")


@pytest.fixture()
def world(settings, fake, monkeypatch):
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    db = Database(settings.db_path)
    db.migrate()
    with db.connection() as conn:
        conn.execute("INSERT INTO recorders(id, name, created_at) VALUES (?, 'Frigate', ?)", (RID, now_iso()))
        conn.execute("UPDATE recorders SET vendor = 'frigate' WHERE id = ?", (RID,))
    s = settings_for(settings)
    monkeypatch.setattr(events_ingest, "publish", lambda ev: None)
    monkeypatch.setattr(rules, "evaluate_event", lambda conn, ev, tz, deliver=True: [])
    return {"db": db, "ad": fr.FrigateAdapter(RID, s, transport=fake.transport()), "lst": Listener(db, s)}


def test_the_reader_backs_off_and_logs_a_refusal_once(world, fake, mono, monkeypatch, caplog):
    """Two hours of refused credentials: one WARNING (not 120 + 60), and the logins follow 5/10/20/30/30 minutes (not every minute)."""
    monkeypatch.setenv("SW_FRIGATE_EVENTS", "1")
    t = {"v": T0}

    def clock():
        t["v"] += 60.0  # each loop round is one minute
        mono.t = t["v"]
        return t["v"]

    lst = world["lst"]
    with caplog.at_level(logging.DEBUG, logger="smplwise.frigate_events"):
        fe.run_loop(lst, adapter=world["ad"], ws_connect=NoWs(), clock=clock, max_rounds=120)
    lst.stop.set()
    polls = [r for r in caplog.records if r.levelno >= logging.WARNING and "frigate poll" in r.getMessage()]
    assert len(polls) == 1, [r.getMessage() for r in polls]
    assert "Settings > Connections" in polls[0].getMessage()
    # 0, +5, +10, +20, +30, +30 minutes -> 5 refusals in the first 95 minutes, a 6th at 125 is past the window
    assert 4 <= logins(fake) <= 6, logins(fake)
    assert fe.state_of(RID).last_poll_error == "source_forbidden" and lst.state.last_error == "source_forbidden"


def test_the_reader_logs_the_recovery_once_and_resets(world, fake, mono, monkeypatch, caplog):
    monkeypatch.setenv("SW_FRIGATE_EVENTS", "1")
    t = {"v": T0}

    def clock():
        t["v"] += 60.0
        mono.t = t["v"]
        if t["v"] > T0 + 600:
            fake.login_ok = True  # fixed on Frigate's side after ten minutes
        return t["v"]

    lst = world["lst"]
    with caplog.at_level(logging.INFO, logger="smplwise.frigate_events"):
        fe.run_loop(lst, adapter=world["ad"], ws_connect=NoWs(), clock=clock, max_rounds=40)
    lst.stop.set()
    back = [r for r in caplog.records if "frigate poll" in r.getMessage() and "working again" in r.getMessage()]
    assert len(back) == 1 and fe.state_of(RID).last_poll_error is None and lst.state.last_error is None and lst.state.last_heartbeat_at


# ---------------------------------------------------------------------------------------------- the periodic discovery

def test_a_repeated_periodic_discovery_failure_is_logged_once(monkeypatch, caplog):
    from smplwise.services import autosync

    def refused(*a, **k):
        raise ApiError(503, "source_forbidden", "x", details={"op": "login", "status": 401, "reason": "credentials"})

    monkeypatch.setattr(autosync, "sync_cameras", refused)
    autosync.RECORDER_STATE.pop(RID, None)

    class Db:
        def connection(self, mode="write"):
            import contextlib

            return contextlib.nullcontext(None)

    with caplog.at_level(logging.DEBUG, logger="smplwise.autosync"):
        for reason in ("startup", "periodic", "periodic", "periodic", "manual"):
            autosync._discover_one(Db(), None, RID, reason)
    warned = [r.getMessage() for r in caplog.records if r.levelno == logging.WARNING]
    assert len(warned) == 2 and "(startup, nvr-2)" in warned[0] and "(manual, nvr-2)" in warned[1], warned


# ---------------------------------------------------------------------------------------------- the health item

def test_the_health_card_names_the_exact_fix_step(settings):
    st = rh.RecState(RID, name="Frigate", vendor="frigate")
    now = 5_000_000.0
    rh.record(st, reachable=False, error="source_forbidden", latency_ms=None, reading=None, now_ts=now)
    card = rh._recorder_view(st, rh.thresholds_defaults(), now, {}, "Frigate")
    api = card["api"]
    assert api["state"] == "error" and api["text"] == "פרטי הגישה נדחו"
    assert api["action"].startswith("Frigate דוחה את שם המשתמש או הסיסמה השמורים.")
    assert "הגדרות › חיבורים" in api["action"] and "בדיקת חיבור" in api["action"]
    conds, _ = rh.evaluate(st, rh.thresholds_defaults(), now, {})
    down = [c for c in conds if c.source == "recorder.unreachable"]
    assert len(down) == 1 and down[0].active and "הגדרות › חיבורים" in down[0].params["detail"]


def test_an_outage_has_no_fix_step():
    st = rh.RecState(RID, name="Frigate", vendor="frigate")
    rh.record(st, reachable=False, error="source_unavailable", latency_ms=None, reading=None, now_ts=5_000_000.0)
    api = rh._recorder_view(st, rh.thresholds_defaults(), 5_000_000.0, {}, "Frigate")["api"]
    assert "action" not in api and api["text"] == "אין תקשורת"
    assert rh.error_action("source_forbidden", "hikvision").startswith("המקליט דוחה")
