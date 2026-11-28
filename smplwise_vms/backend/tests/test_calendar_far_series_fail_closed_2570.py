# ruff: noqa: F811
"""FIX-COMMS-2570 / CU-04: the conflict check past the series cache must not fail open when a daily series expands past 2,000 occurrences
(TIME-CORRECT-2540 D-04). Through the real API, on the fixtures of test_calendar_far_series_2540."""
from __future__ import annotations

from test_calendar_far_series_2540 import API, Z, _app, book, cc, room  # noqa: F401 (fixtures)

from smplwise.services.calendar import occ

DAILY = "FREQ=DAILY"


def test_a_daily_series_meets_a_single_booking_six_years_ahead(cc):
    a = room(cc)
    # 08.03.2033 is about 2,350 days ahead: a daily series needs more than 2,000 expansions to reach it (before: the check returned [] and booked it)
    assert book(cc, a, Z(2033, 3, 8, 16), Z(2033, 3, 8, 17), title="event")["state"] == "confirmed"
    s = book(cc, a, Z(2026, 11, 3, 16), Z(2026, 11, 3, 17), title="club", rrule=DAILY)
    assert s["state"] == "pending", "the series' own date on 08.03.2033 is taken by the booking"


def test_a_check_too_large_to_finish_refuses_instead_of_saying_no_conflict(cc, monkeypatch):
    a = room(cc)
    assert book(cc, a, Z(2027, 3, 9, 16), Z(2027, 3, 9, 17))["state"] == "confirmed"
    monkeypatch.setattr(occ, "FAR_MAX_OCCURRENCES", 20)  # the ~95 daily dates up to the booking are more than the check may expand
    r = cc.post(f"{API}/calendar/events", json={"calendar_id": a["id"], "title": "club", "start": Z(2026, 11, 3, 16), "end": Z(2026, 11, 3, 17), "rrule": DAILY})
    assert r.status_code == 422, r.text
    assert "series_check_failed" in r.text


def test_the_refusal_has_english_text():
    from smplwise.errors import ApiError

    he = "לא ניתן להשלים את בדיקת ההתנגשויות של הסדרה (היא ארוכה מדי). קצרו את הסדרה או הגבילו אותה."
    assert "could not be completed" in ApiError(422, "series_check_failed", he).message_in("en")
