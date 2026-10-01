"""CR-018 S2: the real CR-014 run settlement (services/schedules.settle_runs) reaches the notification pipeline - a SENSITIVE schedule whose run the
devices did not confirm tells the administrators, a confirmed run of the same schedule resolves it, an ordinary schedule says nothing."""
from __future__ import annotations

import datetime as dt
import json

from notify_src_world import clock  # noqa: F401 - fixture
from schedules_fixture import *  # noqa: F401,F403
from schedules_fixture import sched_app  # noqa: F401
from test_schedules_trash_runs import _runs, _settle, _set_state, _trigger

from smplwise.services import schedules


def _rows(app, source="schedule.not_confirmed"):
    with app.state.db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM notifications WHERE source = ? ORDER BY first_at", (source,)).fetchall()]


def test_a_sensitive_schedule_run_that_was_not_confirmed_notifies_and_a_confirmed_one_resolves(sched_app, clock):
    app, s, c, fake, tr = sched_app
    sid = next(i for i, it in fake.items.items() if it["name"] == "Arm the home panel")
    assert c.get("/api/v1/schedules").status_code == 200
    fake.tick(13 * 3600)
    _trigger(app, fake, sid)
    assert _runs(c)[0]["sensitive"] is True
    _set_state(app, "alarm_control_panel.home_panel", "disarmed")  # the panel did not arm
    assert _settle(app, fake) == 1
    assert _runs(c)[0]["result"] == "not_confirmed"
    rows = _rows(app)
    assert len(rows) == 1 and rows[0]["state"] == "open" and rows[0]["subject_kind"] == "schedule" and rows[0]["subject_id"] == sid
    assert "Arm the home panel" in rows[0]["body"]
    with app.state.db.connection(mode="read") as conn:
        got = {r[0] for r in conn.execute("SELECT user_id FROM notification_recipients WHERE notification_id = ?", (rows[0]["id"],))}
    assert got == {"dev-joni"}, "the administrators (notify.failures_audience default)"
    # the schedule's next run is confirmed: the row resolves
    with app.state.db.connection() as conn:
        conn.execute("INSERT INTO schedule_runs(id, schedule_id, slot_index, started_at, result, sensitive, via) VALUES ('r-next', ?, 0, ?, 'pending', 1, 'component')", (sid, (fake.now()).isoformat().replace("+00:00", "Z")))
    _set_state(app, "alarm_control_panel.home_panel", "armed_home")
    _settle(app, fake, 30)
    assert _rows(app)[0]["state"] == "resolved"


def test_an_ordinary_schedule_that_was_not_confirmed_says_nothing(sched_app, clock):
    app, s, c, fake, tr = sched_app
    fake.world[SHABBAT]["state"] = "on"  # noqa: F405
    _set_state(app, SHABBAT, "on")  # noqa: F405
    sid = next(i for i, it in fake.items.items() if it["name"] == "Hall lights on rest days")
    assert c.get("/api/v1/schedules").status_code == 200
    fake.tick(5 * 3600 + 60)
    _trigger(app, fake, sid)
    _set_state(app, "switch.hall_lights", "off")
    assert _settle(app, fake) == 1
    assert _runs(c)[0]["result"] == "not_confirmed" and _runs(c)[0]["sensitive"] is False
    assert _rows(app) == []
