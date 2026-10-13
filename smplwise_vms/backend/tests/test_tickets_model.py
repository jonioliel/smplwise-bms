"""CR-038 slice 1 - the ticket model, pure (no database): the state machine of section 11.2 row by row and actor by actor, the
written-reason rule, the waiting flags, text hygiene (review T9: Cc and Cf stripped, bidi spoofing impossible, line feeds kept in
multi-line fields only), the field limits and the ETA window."""
from __future__ import annotations

import datetime as dt

import pytest

from smplwise.services.tickets import model

ALL = model.STATUSES

# section 11.2, written out once more by hand (the table a reviewer reads): (actor, from, to) that ARE allowed on the status route
EXPECTED: set[tuple[str, str, str]] = set()
_assignee_moves = {
    ("assigned", "acknowledged"),
    ("assigned", "in_progress"), ("acknowledged", "in_progress"), ("waiting_part", "in_progress"),
    ("acknowledged", "waiting_part"), ("in_progress", "waiting_part"),
    ("acknowledged", "done"), ("in_progress", "done"), ("waiting_part", "done"),
}
for frm, to in _assignee_moves:
    EXPECTED |= {("assignee", frm, to), ("link", frm, to), ("manager", frm, to)}
EXPECTED |= {("manager", "done", "closed"), ("manager", "done", "in_progress"), ("manager", "closed", "new")}
for s in ("new", "assigned", "acknowledged", "in_progress", "waiting_part", "returned"):
    EXPECTED.add(("manager", s, "closed"))
for s in ("new", "assigned", "acknowledged", "in_progress", "waiting_part", "done", "returned"):
    EXPECTED.add(("manager", s, "cancelled"))
EXPECTED |= {("inbound", "assigned", "acknowledged"), ("inbound", "assigned", "in_progress"), ("inbound", "acknowledged", "in_progress")}
EXPECTED.add(("system", "done", "closed"))


@pytest.mark.parametrize("actor", model.ACTORS)
def test_every_move_of_every_actor_matches_section_11_2(actor):
    for frm in ALL:
        for to in ALL:
            assert model.may_move(actor, frm, to) == ((actor, frm, to) in EXPECTED), (actor, frm, to)


def test_nobody_but_a_manager_or_the_system_closes():
    for actor in ("assignee", "link", "inbound"):
        assert not any(model.may_move(actor, frm, "closed") for frm in ALL), actor
    assert not any(model.may_move("inbound", frm, to) for frm in ALL for to in ("done", "waiting_part", "returned", "closed", "cancelled"))
    assert not model.may_move("inbound", "waiting_part", "in_progress"), "an advisory reply never leaves waiting-for-a-part"


def test_closed_and_cancelled_are_final_except_the_managers_reopen():
    for actor in model.ACTORS:
        for to in ALL:
            if (actor, to) != ("manager", "new"):
                assert not model.may_move(actor, "closed", to), (actor, to)
            assert not model.may_move(actor, "cancelled", to), (actor, to)


def test_assignment_and_return_sources():
    assert model.ASSIGN_FROM == {"new", "returned", "assigned", "acknowledged", "in_progress", "waiting_part", "done", "closed"}
    assert "cancelled" not in model.ASSIGN_FROM
    assert model.RETURN_FROM == {"assigned", "acknowledged", "in_progress", "waiting_part"}
    assert model.RETURN_KINDS == ("cannot_handle", "not_mine")


@pytest.mark.parametrize("frm, to, needed", [
    ("new", "closed", True), ("returned", "closed", True), ("in_progress", "closed", True), ("done", "closed", False),
    ("new", "cancelled", True), ("done", "cancelled", True), ("done", "in_progress", True),
    ("assigned", "acknowledged", False), ("in_progress", "done", False), ("closed", "new", False),
])
def test_a_written_reason_is_needed_exactly_where_the_spec_asks(frm, to, needed):
    assert model.note_required(frm, to) is needed


@pytest.mark.parametrize("status, kind, expected", [
    ("new", None, ("manager", "unassigned")),
    ("assigned", None, ("assignee", None)), ("acknowledged", None, ("assignee", None)),
    ("in_progress", None, ("assignee", None)), ("waiting_part", None, ("assignee", None)),
    ("done", None, ("manager", "done")),
    ("returned", "not_mine", ("manager", "not_mine")), ("returned", "cannot_handle", ("manager", "returned")),
    ("closed", None, ("none", None)), ("cancelled", None, ("none", None)),
])
def test_waiting_flags(status, kind, expected):
    assert model.waiting_for(status, kind) == expected


# ---------------------------------------------------------------- text hygiene (review T9)

def test_bidi_overrides_zero_width_and_controls_are_stripped():
    spoof = "בוצע‮ לא⁦ x⁩​‍‎‏\u0007\x00"
    cleaned = model.clean_text(spoof)
    assert cleaned == "בוצע לא x"
    for ch in "‪‫‬‭‮⁦⁧⁨⁩​‌‍‎‏﻿":
        assert ch not in model.clean_text(f"a{ch}b") and model.clean_text(f"a{ch}b") == "ab"


def test_single_line_fields_collapse_whitespace_and_multi_line_fields_keep_line_feeds():
    assert model.clean_text("  מזגן \n\t לא   מקרר  ") == "מזגן לא מקרר"
    assert model.clean_text("שורה 1\r\nשורה 2\rשורה 3", multiline=True) == "שורה 1\nשורה 2\nשורה 3"
    assert model.clean_text("a\n\n\n\n\nb\t c   ", multiline=True) == "a\n\nb  c"
    assert model.clean_text(None) == ""


def test_text_field_limits_are_judged_after_cleaning():
    assert model.text_field("​" * 500 + "כותרת", "title", required=True, max_len=10) == "כותרת"
    with pytest.raises(model.Invalid) as e:
        model.text_field("‮​  ", "title", required=True, max_len=120)
    assert e.value.problems == [model.Problem("title", "required")]
    with pytest.raises(model.Invalid) as e:
        model.text_field("x" * 121, "title", required=True, max_len=120)
    assert e.value.problems == [model.Problem("title", "too_long")]
    assert model.text_field("", "description", required=False, max_len=4000) == ""


def test_eta_window():
    now = dt.datetime(2026, 10, 13, 9, 0, tzinfo=dt.timezone.utc)
    assert model.parse_eta("2026-10-14T12:00:00Z", now) == "2026-10-14T12:00:00Z"
    assert model.parse_eta("2026-10-14T15:00:00+03:00", now) == "2026-10-14T12:00:00Z"
    assert model.parse_eta(None, now) is None and model.parse_eta("", now) is None
    for bad, code in (("2026-10-13T08:00:00Z", "past"), ("2027-02-01T00:00:00Z", "too_far"), ("tomorrow", "format"), ("2026-10-14T12:00:00", "format")):
        with pytest.raises(model.Invalid) as e:
            model.parse_eta(bad, now)
        assert e.value.problems[0].code == code, bad
    assert model.parse_eta("2026-10-13T08:57:00Z", now) == "2026-10-13T08:57:00Z", "five minutes of clock skew are allowed"


def test_client_request_id_shape():
    assert model.CLIENT_REQUEST_RE.fullmatch("8c2f0a3e-5b1d-4e7a-9f00-1234567890ab")
    assert not model.CLIENT_REQUEST_RE.fullmatch("short")
    assert not model.CLIENT_REQUEST_RE.fullmatch("has space in it")
