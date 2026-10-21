"""DOORWIN2-295 (CR-039 11 / 13, owner decision 2026-10-13): the spoken announcement of an emergency start. OFF until the owner has heard the phrase in a
drill: the `announce` policy channel is off by default, and even when an administrator turns it on for the emergency sources, NOTHING is spoken
until the owner has typed his own phrase (`doors.emergency.announce_phrase`, empty by default). The phrase is his text, spoken verbatim (a drill says
"drill" first), never the notification title, never filtered by the lock-screen level. The speaker, the players and the engine are the test fakes of
test_announce_extras; no real speaker is contacted."""
from __future__ import annotations

import datetime as dt

import pytest
from notify_world import API, World, fake_push  # noqa: F401 - fixture
from test_announce_extras import Players, Speaker, announce_rows, enable, route, world  # noqa: F401 - `world` is the fixture

pytestmark = pytest.mark.usefixtures("daytime_clock")
SETTINGS = f"{API}/doors/emergency/settings"
STARTED, DRILL = "door.emergency.started", "door.emergency.drill"


def phrase(w: World, text: str):
    return w.c.put(SETTINGS, json={"changes": {"doors.emergency.announce_phrase": text}, "confirmed": True})


def emit(w: World, source: str = STARTED, key: str = "e1") -> str:
    w.clock["now"] += dt.timedelta(minutes=2)
    nid = w.emit(source, "door", f"emergency:{key}", params={"kind": "נעילת כל הדלתות", "scope": "הכול", "count": 4}, dedupe_key=f"{source}:{key}").id
    w.flush()
    return nid


def test_the_phrase_is_empty_by_default_and_validated(world):
    w = world
    assert w.c.get(SETTINGS).json()["settings"]["doors.emergency.announce_phrase"] == ""
    assert phrase(w, "x" * 121).status_code == 422
    assert phrase(w, "פינוי\nמיידי").status_code == 422
    assert phrase(w, "אנא פנו את הבניין").status_code == 200
    assert w.c.get(SETTINGS).json()["settings"]["doors.emergency.announce_phrase"] == "אנא פנו את הבניין"
    assert phrase(w, "").status_code == 200 and w.c.get(SETTINGS).json()["settings"]["doors.emergency.announce_phrase"] == ""


def test_the_emergency_sources_do_not_announce_by_default(world):
    w = world
    enable(w)
    route(w, min_severity="info")
    for source in (STARTED, DRILL):
        assert w.c.get(f"{API}/notify/policies/{source}").json()["channels"]["announce"] is False
    nid = emit(w)
    assert announce_rows(w, nid) == [] and w.speaker.calls == []


def test_a_policy_channel_without_a_phrase_speaks_nothing(world):
    w = world
    enable(w)
    route(w, min_severity="info")
    w.set_policy(STARTED, channels={"announce": True})
    nid = emit(w)
    assert [(r["status"], r["reason"]) for r in announce_rows(w, nid)] == [("skipped", "no_phrase")] and w.speaker.calls == [], "OFF until heard in a drill"


def test_the_owners_phrase_is_spoken_verbatim_and_not_the_title(world):
    w = world
    enable(w)
    route(w, min_severity="info")
    w.set_policy(STARTED, channels={"announce": True})
    phrase(w, "אנא פנו את הבניין בהליכה")
    nid = emit(w)
    assert [r["status"] for r in announce_rows(w, nid)] == ["sent"]
    assert len(w.speaker.calls) == 1 and w.speaker.calls[0][2] == "אנא פנו את הבניין בהליכה"
    w.set_settings(lockscreen="generic")
    emit(w, key="e2")
    assert w.speaker.calls[-1][2] == "אנא פנו את הבניין בהליכה", "the lock-screen level hides titles, not the owner's own phrase"


def test_a_drill_says_drill_first(world):
    w = world
    enable(w)
    route(w, min_severity="info")
    w.set_policy(DRILL, channels={"announce": True})
    nid = emit(w, DRILL)
    assert [(r["status"], r["reason"]) for r in announce_rows(w, nid)] == [("skipped", "no_phrase")]
    phrase(w, "אנא פנו את הבניין")
    nid = emit(w, DRILL, "e3")
    assert [r["status"] for r in announce_rows(w, nid)] == ["sent"] and w.speaker.calls[-1][2] == "תרגיל. אנא פנו את הבניין"


def test_other_sources_are_spoken_as_before(world):
    w = world
    enable(w)
    route(w)
    w.set_policy("camera.offline", channels={"announce": True})
    phrase(w, "אנא פנו את הבניין")
    w.clock["now"] += dt.timedelta(minutes=2)
    w.emit("camera.offline", "camera", w.cam, params={"name": "לובי"}, dedupe_key="n1")
    w.flush()
    assert len(w.speaker.calls) == 1 and "לובי" in w.speaker.calls[0][2] and "פנו" not in w.speaker.calls[0][2]
