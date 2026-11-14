"""F3A-295 / Fable review 3 G-01 (owner decision 2026-10-21): the four `wiskey.acr5_*` switches GATE the WisKey person readback. While
`wiskey.acr5_access_state` is off nothing is sent - not the overview negotiation, not users/access_state(_v2) - and the revoke verdict is
UNKNOWN (a revoke stays `revoking`); `schedules/normalize_user` needs `wiskey.acr5_normalize_user`. The switches default OFF and no route
writes them. FAKES ONLY: a fake SYNC and an in-memory settings table; nothing contacts WisKey, Home Assistant or a station."""
from __future__ import annotations

import contextlib
import json
import sqlite3
from pathlib import Path
from typing import Any

import pytest

from smplwise.services import access_grant_engine as age
from smplwise.services import access_grants as ag
from smplwise.services import wiskey_acr5 as a5
from smplwise.services import wiskey_readback as rb

FIX = Path(__file__).resolve().parent / "fixtures" / "wiskey_access_state_v2"
PERSON, REV = "person-a", 4
LISTED = ["users/access_state", "users/access_state_v2", "schedules/normalize_user", "users/get"]
CAPS = ["person_access_state_v1", "person_access_state_v2", "user_schedule_normalization_v1"]


def fx(name: str) -> dict[str, Any]:
    return json.loads((FIX / f"{name}.json").read_text(encoding="utf-8"))


class FakeSync:
    def __init__(self, answer: Any = None) -> None:
        self.answer = answer
        self.calls: list[tuple[str, str]] = []

    def command(self, settings, key, send, project, who="", channel="service", **kw):
        self.calls.append((key, channel))
        if key == "readback_api":
            return {"state": "ready", key: project({"api": {"commands": LISTED, "capabilities": CAPS}})}
        return {"state": "ready", key: self.answer}

    def write_gate(self, target):
        return None  # no write to the person is unsettled


class FakeDb:
    """`db.connection(mode=..., label=...)` over one in-memory settings table."""

    def __init__(self) -> None:
        self.conn = sqlite3.connect(":memory:", check_same_thread=False)
        self.conn.execute("CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT)")

    def set(self, key: str, value: str) -> None:
        self.conn.execute("INSERT OR REPLACE INTO settings(key, value) VALUES(?, ?)", (key, value))

    @contextlib.contextmanager
    def connection(self, mode: str = "write", label: str = ""):
        yield self.conn


@pytest.fixture()
def wired(monkeypatch):
    """The PRODUCT wiring (`access_grants.engine_for`) with the transport replaced by a fake SYNC."""
    db = FakeDb()
    sync = FakeSync(answer=fx("present_revoked_disabled_row_applied"))
    monkeypatch.setattr(ag, "ENGINE_FACTORY", None)
    monkeypatch.setattr(rb.intercom_sync, "SYNC", sync)
    engine = ag.engine_for(db)
    assert isinstance(engine, age.WiskeyServiceEngine) and isinstance(engine.access_state_reader, rb.LiveReadback)
    sid = fx("present_revoked_disabled_row_applied")["assignments"][0]["station_id"]
    engine.last_known_stations = lambda pid: frozenset({sid})
    return db, sync, engine


def _sent(sync: FakeSync) -> list[str]:
    return [k for k, _ in sync.calls]


def test_the_switches_default_off_and_the_permit_is_unchanged():
    assert a5.GO_LIVE_PERMITTED is True, "ECCACT-295 owner decision: unchanged by F3A"
    c = sqlite3.connect(":memory:")
    c.execute("CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT)")
    assert all(a5.consumer_on(c, key) is False for key in a5.FLAGS), "every wiskey.acr5_* switch defaults OFF"


def test_while_the_access_state_switch_is_off_nothing_is_sent_and_the_verdict_is_unknown(wired):
    db, sync, engine = wired
    assert engine.revocation_pending(PERSON, REV) is None
    assert engine.revocation_evidence(PERSON, REV) is None
    assert engine.station_removal_pending(PERSON, REV, "any-station") is None
    assert sync.calls == [], "no overview negotiation and no access_state read while wiskey.acr5_access_state is off"


def test_the_matching_switch_opens_the_readback_and_only_that_one(wired):
    db, sync, engine = wired
    db.set(a5.FLAGS["acr5_02"], "on")  # the normalize switch does not open the access_state read
    assert engine.revocation_pending(PERSON, REV) is None and sync.calls == []
    db.set(a5.FLAGS["acr5_01"], "on")
    assert engine.revocation_pending(PERSON, REV) is False, "a negotiated v2 answer can prove once its switch is on"
    assert "readback_api" in _sent(sync) and "access_state" in _sent(sync)


def test_turning_the_switch_off_again_stops_the_next_read(wired):
    db, sync, engine = wired
    db.set(a5.FLAGS["acr5_01"], "on")
    assert engine.revocation_pending(PERSON, REV) is False
    n = len(sync.calls)
    db.set(a5.FLAGS["acr5_01"], "off")
    assert engine.revocation_pending(PERSON, REV) is None and len(sync.calls) == n, "read fresh on every call, never cached"


def test_the_switch_needs_the_permit_too(wired, monkeypatch):
    db, sync, engine = wired
    db.set(a5.FLAGS["acr5_01"], "on")
    monkeypatch.setattr(a5, "GO_LIVE_PERMITTED", False)
    assert engine.revocation_pending(PERSON, REV) is None and sync.calls == []


def test_normalize_user_needs_its_own_switch():
    sync = FakeSync(answer={"schema_version": 1})
    state = {"acr5_01": True, "acr5_02": False}
    reader = rb.LiveReadback(None, sync=sync, gate=lambda key: state.get(key, False))
    with pytest.raises(rb.ReadbackUnavailable) as exc:
        reader.normalize_user({"x": 1})
    assert exc.value.code == "consumer_off" and sync.calls == []
    state["acr5_02"] = True
    reader.normalize_user({"x": 1})
    assert "normalized" in _sent(sync)


@pytest.mark.parametrize("gate", [lambda key: None, lambda key: "on", lambda key: 1 / 0])
def test_a_gate_that_does_not_say_exactly_true_is_off(gate):
    sync = FakeSync(answer=fx("present_empty_bookkeeping"))
    reader = rb.LiveReadback(None, sync=sync, gate=gate)
    with pytest.raises(rb.ReadbackUnavailable):
        reader(PERSON, REV)
    assert sync.calls == []


def test_an_unreadable_settings_store_is_off(monkeypatch):
    class Broken:
        @contextlib.contextmanager
        def connection(self, mode: str = "write", label: str = ""):
            raise sqlite3.OperationalError("locked")
            yield  # pragma: no cover

    sync = FakeSync(answer=fx("present_empty_bookkeeping"))
    monkeypatch.setattr(ag, "ENGINE_FACTORY", None)
    monkeypatch.setattr(rb.intercom_sync, "SYNC", sync)
    engine = ag.engine_for(Broken())
    assert engine.revocation_pending(PERSON, REV) is None and sync.calls == []
