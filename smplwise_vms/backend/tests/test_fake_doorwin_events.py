"""CR-039 W0 self-tests: the fake Home Assistant event source for event-triggered windows (9.1, 9.2, 9.5). Fakes only."""
from __future__ import annotations

from fake_doorwin_asserts import find_secrets
from fake_doorwin_clock import DoorwinScheduler, FakeDoorwinClock
from fake_doorwin_events import AUTOMATION_TRIGGERED, DOOR_WINDOW_EVENT, FakeHaEventSource

from smplwise.services.ha_sync import AUTOMATION_EVENTS

RULE = "6f1c2a0e-1111-4c4c-8a8a-000000000001"
TOKEN = "rule-token-SYNTHETIC-0001"


def _source():
    clock = FakeDoorwinClock()
    return clock, DoorwinScheduler(clock), None


def test_frames_have_home_assistants_event_shape():
    clock, sched, _ = _source()
    src = FakeHaEventSource(clock, sched)
    got: list[dict] = []
    sub = src.subscribe(DOOR_WINDOW_EVENT, got.append)
    src.door_window(RULE, TOKEN)
    frame = got[0]
    assert frame["id"] == sub and frame["type"] == "event"
    ev = frame["event"]
    assert ev["event_type"] == DOOR_WINDOW_EVENT and ev["data"] == {"rule_id": RULE, "token": TOKEN}
    assert ev["time_fired"] == clock.now_iso() and set(ev["context"]) == {"id", "parent_id", "user_id"} and ev["origin"] == "LOCAL"


def test_automation_triggered_is_the_type_ha_sync_already_mirrors():
    clock, sched, _ = _source()
    src = FakeHaEventSource(clock, sched)
    assert AUTOMATION_TRIGGERED in AUTOMATION_EVENTS
    got: list[dict] = []
    src.subscribe(AUTOMATION_TRIGGERED, got.append)
    src.subscribe(DOOR_WINDOW_EVENT, lambda f: (_ for _ in ()).throw(AssertionError("wrong type delivered")))
    src.automation_triggered("automation.lobby_open_window")
    assert got[0]["event"]["data"] == {"entity_id": "automation.lobby_open_window", "name": "lobby_open_window", "source": "state of binary_sensor.lobby_motion"}
    assert src.subscribed_types() == {AUTOMATION_TRIGGERED, DOOR_WINDOW_EVENT}


def test_disconnected_drops_and_duplicate_delivery_keeps_the_context():
    clock, sched, _ = _source()
    src = FakeHaEventSource(clock, sched)
    got: list[dict] = []
    src.subscribe(DOOR_WINDOW_EVENT, got.append)
    src.connected = False
    src.door_window(RULE, TOKEN)
    assert got == [] and len(src.dropped) == 1  # Home Assistant never replays
    src.connected = True
    src.deliver_twice = True
    src.door_window(RULE, TOKEN)
    assert len(got) == 2 and got[0]["event"]["context"]["id"] == got[1]["event"]["context"]["id"]


def test_storm_is_scheduled_deterministically():
    clock, sched, _ = _source()
    src = FakeHaEventSource(clock, sched)
    got: list[dict] = []
    src.subscribe(DOOR_WINDOW_EVENT, got.append)
    src.storm(25, 60, DOOR_WINDOW_EVENT, {"rule_id": RULE, "token": TOKEN})
    sched.advance(3600)
    assert len(got) == 25
    assert [f["event"]["context"]["id"] for f in got][:2] == ["01JCTX00000000000000000001", "01JCTX00000000000000000002"]


def test_forgeries():
    clock, sched, _ = _source()
    src = FakeHaEventSource(clock, sched)
    got: list[dict] = []
    src.subscribe(DOOR_WINDOW_EVENT, got.append)
    src.forged_wrong_token(RULE)
    src.forged_unknown_rule()
    src.forged_template(RULE)
    src.forged_extra_keys(RULE, TOKEN)
    src.forged_types()
    datas = [f["event"]["data"] for f in got]
    assert datas[0]["token"] != TOKEN and datas[1]["rule_id"] != RULE and "{{" in datas[2]["token"]
    assert set(datas[3]) == {"rule_id", "token", "duration_s", "doors"} and not isinstance(datas[4]["rule_id"], str)


def test_the_token_counts_as_a_secret():
    clock, sched, _ = _source()
    src = FakeHaEventSource(clock, sched)
    ev = src.door_window(RULE, TOKEN)
    assert find_secrets(ev, secrets=[TOKEN])  # an event frame itself must never be logged or audited as is
