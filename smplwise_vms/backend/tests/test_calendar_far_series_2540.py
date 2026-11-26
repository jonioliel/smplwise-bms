"""TIME-CORRECT-2540 / review finding D-04: a room's conflict check beyond the series cache horizon.

The occurrence cache holds a series only `series_horizon_days` ahead (a single entry in full), and the conflict check read only the cache:
a single booking far ahead never met an open series there (scenario A), a new series never met a single entry booked further ahead than its
own horizon window (the mirror case), and two series whose first common date lies past the horizon were never compared at all - the nightly
roll wrote both and nothing reported it. Through the real API on a temporary database, with a 60-day horizon so the dates stay short.

  py -3.12 -m pytest -q tests/test_calendar_far_series_2540.py
"""
from __future__ import annotations

import datetime as dt

import pytest
from fastapi.testclient import TestClient

from smplwise.config import Settings
from smplwise.main import create_app
from smplwise.db import Database
from smplwise.routers import calendar as cal_router
from smplwise.services.calendar import jobs, occ

API = "/api/v1"
UTC = dt.timezone.utc
NOW = dt.datetime(2026, 10, 5, 9, 0, tzinfo=UTC)  # a Monday; with a 60-day horizon the cache of a series ends on 04.12.2026
TUE = "FREQ=WEEKLY;BYDAY=TU"  # an open weekly series (no COUNT, no UNTIL)


def Z(y: int, m: int, d: int, hh: int, mm: int = 0) -> str:
    return f"{y}-{m:02d}-{d:02d}T{hh:02d}:{mm:02d}:00Z"


@pytest.fixture(scope="module")
def _app(tmp_path_factory):
    st = Settings(data_dir=tmp_path_factory.mktemp("cal2540") / "data", www_dir=None, in_addon=False, trusted_proxies=("172.30.32.2",), dev_user="joni",
                  bootstrap_admin_username="joni", nvr_host="nvr-placeholder.test", nvr_http_port=80, nvr_user=None, nvr_password=None, go2rtc_url=None,
                  log_level="warning", max_upload_bytes=5 * 1024 * 1024, max_pdf_pages=5, max_render_px=800, preview_px=300)
    c = TestClient(create_app(st))
    c.settings_obj = st
    c.get(f"{API}/me")
    return c


@pytest.fixture()
def cc(_app, monkeypatch):
    monkeypatch.setattr(cal_router, "_now", lambda: NOW)
    with Database(_app.settings_obj.db_path).connection() as c:
        for t in ("cal_occurrences", "cal_guest_details", "cal_approvals", "cal_event_rooms", "cal_events", "cal_members", "cal_calendars"):
            c.execute(f"DELETE FROM {t}")
        c.execute("DELETE FROM settings WHERE key LIKE 'calendar.%'")
        c.execute("DELETE FROM audit_log WHERE action = 'calendar.occurrence.collision'")
    r = _app.put(f"{API}/calendar/settings", json={"enabled": True, "series_horizon_days": 60})
    assert r.status_code == 200, r.text
    return _app


def room(c):
    r = c.post(f"{API}/calendar/calendars", json={"name": "חדר ישיבות", "type": "room", "color": "blue", "capacity": 10, "buffer_after_min": 0, "hours_mode": "always"})
    assert r.status_code == 201, r.text
    return r.json()["calendar"]


def book(c, cal, start, end, **kw):
    r = c.post(f"{API}/calendar/events", json={"calendar_id": cal["id"], "title": kw.pop("title", "ישיבה"), "start": start, "end": end, **kw})
    assert r.status_code == 201, r.text
    return r.json()


def cached_until(c, eid: str) -> str:
    with Database(c.settings_obj.db_path).connection() as conn:
        return conn.execute("SELECT MAX(occ_start) FROM cal_occurrences WHERE event_id = ?", (eid,)).fetchone()[0]


def test_a_single_booking_past_the_horizon_meets_the_open_series(cc):
    a = room(cc)
    series = book(cc, a, Z(2026, 11, 3, 16), Z(2026, 11, 3, 17), title="חוג", rrule=TUE)
    assert series["state"] == "confirmed"
    assert cached_until(cc, series["event"]["id"]) < "2026-12-05", "the cache really ends at the horizon (the premise of the finding)"
    # 02.03.2027 is a Tuesday, 17 weeks on: the series holds 18:00-19:00 local (16:00Z, winter time) there too
    far = book(cc, a, Z(2027, 3, 2, 16), Z(2027, 3, 2, 17))
    assert far["state"] == "pending", "the room is taken by the series on that Tuesday: a request waiting for the manager, never a second confirmed booking"
    assert far["event"]["contested"] is True
    # a Wednesday at the same hour stays free
    assert book(cc, a, Z(2027, 3, 3, 16), Z(2027, 3, 3, 17))["state"] == "confirmed"


def test_the_preview_names_the_far_conflict(cc):
    a = room(cc)
    sid = book(cc, a, Z(2026, 11, 3, 16), Z(2026, 11, 3, 17), rrule=TUE)["event"]["id"]
    r = cc.post(f"{API}/calendar/events/preview", json={"calendar_id": a["id"], "title": "x", "start": Z(2027, 3, 2, 16, 30), "end": Z(2027, 3, 2, 17, 30)})
    assert r.status_code == 200, r.text
    hits = r.json()["conflicts"]
    assert [(h["start"], h["end"]) for h in hits] == [("2027-03-02T16:00:00Z", "2027-03-02T17:00:00Z")]
    # the blocker itself (as the approval and the sync engine call it): the series' own id, not a cached row
    with Database(cc.settings_obj.db_path).connection() as conn:
        holder = conn.execute("SELECT * FROM cal_calendars WHERE id = ?", (a["id"],)).fetchone()
        rows = occ.blockers(conn, holder, [(dt.datetime(2027, 3, 2, 16, 30, tzinfo=UTC), dt.datetime(2027, 3, 2, 17, 30, tzinfo=UTC))], occ.model.read_settings(conn), now=NOW)
        assert [r["event_id"] for r in rows] == [sid]
        # excluded (the same booking moving itself): nothing
        assert occ.blockers(conn, holder, [(dt.datetime(2027, 3, 2, 16, 30, tzinfo=UTC), dt.datetime(2027, 3, 2, 17, 30, tzinfo=UTC))], occ.model.read_settings(conn),
                            now=NOW, exclude={sid}) == []


def test_a_cancelled_date_of_the_series_is_free_far_ahead(cc):
    a = room(cc)
    ev = book(cc, a, Z(2026, 11, 3, 16), Z(2026, 11, 3, 17), rrule=TUE)["event"]
    with Database(cc.settings_obj.db_path).connection() as conn:  # an exception date of the series (the series' own exdates)
        conn.execute("UPDATE cal_events SET exdates_json = ? WHERE id = ?", ('["2027-03-02T18:00"]', ev["id"]))
    assert book(cc, a, Z(2027, 3, 2, 16), Z(2027, 3, 2, 17))["state"] == "confirmed"
    assert book(cc, a, Z(2027, 3, 9, 16), Z(2027, 3, 9, 17))["state"] == "pending"


def test_the_mirror_a_new_series_meets_a_single_booking_further_ahead(cc):
    a = room(cc)
    assert book(cc, a, Z(2027, 3, 9, 16), Z(2027, 3, 9, 17), title="אירוע")["state"] == "confirmed"
    s = book(cc, a, Z(2026, 11, 3, 16), Z(2026, 11, 3, 17), title="חוג", rrule=TUE)
    assert s["state"] == "pending", "the series' 19th Tuesday falls on the booking of 09.03.2027"
    # a series that ends before it is free
    b = room(cc)
    assert book(cc, b, Z(2027, 3, 9, 16), Z(2027, 3, 9, 17))["state"] == "confirmed"
    assert book(cc, b, Z(2026, 11, 3, 16), Z(2026, 11, 3, 17), rrule=f"{TUE};COUNT=8")["state"] == "confirmed"


def test_the_nightly_roll_reports_two_series_that_first_meet_past_the_horizon(cc):
    a = room(cc)
    # every 3rd Tuesday from 03.11 and every 5th Tuesday from 10.11: their first common date is 15.12.2026 - past the cache edge of 04.12
    s1 = book(cc, a, Z(2026, 11, 3, 16), Z(2026, 11, 3, 17), rrule="FREQ=WEEKLY;INTERVAL=3;BYDAY=TU")["event"]["id"]
    s2 = book(cc, a, Z(2026, 11, 10, 16), Z(2026, 11, 10, 17), rrule="FREQ=WEEKLY;INTERVAL=5;BYDAY=TU")["event"]["id"]
    d = Database(cc.settings_obj.db_path)
    assert jobs.run(d, NOW)["collisions"] == 0  # the roll of today: nothing collides up to 04.12
    out = jobs.run(d, NOW + dt.timedelta(days=12))  # the roll of 17.10 writes up to 16.12: both series land on 15.12 16:00Z
    assert out["collisions"] == 1
    with d.connection() as conn:
        rows = conn.execute("SELECT details_json FROM audit_log WHERE action = 'calendar.occurrence.collision'").fetchall()
    assert len(rows) == 1
    assert s1 in rows[0][0] and s2 in rows[0][0] and "2026-12-15T16:00:00Z" in rows[0][0]
    assert "חוג" not in rows[0][0] and "ישיבה" not in rows[0][0], "ids and instants only, never a title"
    # the next night reports only what that roll added (nothing new)
    assert jobs.run(d, NOW + dt.timedelta(days=13))["collisions"] == 0
