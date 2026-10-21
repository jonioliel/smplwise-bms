"""F3A-295 / Fable review 3 DW-06: simulated triggers never count against the installation-wide storm cap of real starts, so a rule-token
holder firing simulated events cannot block a person's `open-for`. Simulations keep their own cap of the same size. FAKES ONLY (the W0
DoorwinWorld); the permit and LIVE_ENGINE_BUILT are switched on inside the test world only."""
from __future__ import annotations

import datetime as dt

import pytest
from fake_doorwin_adapters import ProductWorld
from fake_doorwin_world import DoorwinWorld

from smplwise.services import door_window_triggers as dwt

UTC = dt.timezone.utc
T0 = dt.datetime(2026, 11, 2, 5, 0, tzinfo=UTC)  # Monday 07:00 in Asia/Jerusalem


@pytest.fixture()
def pw(settings, monkeypatch):
    world = DoorwinWorld(start=T0)
    p = ProductWorld(settings, monkeypatch, world=world)
    p.windows_on()
    monkeypatch.setattr(dwt, "_now", p.now)
    monkeypatch.setattr(dwt, "DISPATCH", lambda run: run())
    dwt.reset_budget()
    return p


def _event_rule(p):
    r = p.post("/doors/windows/rules", name="event rule", kind="event", doors=[{"station_id": p.DOCK, "relay": 1}],
               trigger={"source": "ha_event", "duration_s": 3600, "max_per_day": 3, "cooldown_s": 0}, enable=True, confirmed=True)
    assert r.status_code == 201, r.text
    return r.json()["rule"]["id"], r.json()["token"]


def _seed(p, decision: str, n: int, rule_id: str | None = None) -> None:
    with p.db.connection() as conn:
        for i in range(n):
            conn.execute("INSERT INTO door_window_trigger_log(id, at, source, rule_id, station_id, relay, decision) VALUES (?, ?, 'ha_event', ?, ?, 1, ?)",
                         (f"{decision}-{i}", p.dw.iso(p.now() - dt.timedelta(minutes=5)), rule_id, p.DOCK, decision))


def _open_for(p, station: str):
    return p.post(f"/doors/windows/doors/{station}/1/open-for", duration_s=1800, confirmed=True)


def test_a_flood_of_simulated_events_does_not_block_a_persons_open_for(pw):
    rid, token = _event_rule(pw)
    _seed(pw, "simulated", dwt.STORM_PER_HOUR, rid)  # an hour's worth of simulated triggers from a token holder
    r = _open_for(pw, pw.ENTRY)
    assert r.status_code == 200 and r.json()["decision"]["decision"] == "started", r.text
    # ...while the simulations themselves are still capped (their own storm)
    out = dwt.fire_rule(pw.db, pw.settings, pw.now(), rule_id=rid, source="ha_event", trigger_ref="next", token=token)
    assert out["doors"][0]["reason"] == "storm"


def test_real_starts_still_hit_the_storm_cap(pw):
    _seed(pw, "started", dwt.STORM_PER_HOUR)
    r = _open_for(pw, pw.SIDE)
    assert r.status_code == 409 and r.json()["details"]["reason"] == "storm", r.text


def test_extensions_count_as_real_starts(pw):
    _seed(pw, "extended", dwt.STORM_PER_HOUR)
    assert _open_for(pw, pw.SIDE).json()["details"]["reason"] == "storm"
