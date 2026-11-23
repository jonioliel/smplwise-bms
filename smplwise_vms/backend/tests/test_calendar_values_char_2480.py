"""COMPLEXITY-3-2480 - characterisation of `services.calendar.model.calendar_values` (radon CC 55: every writable field of a calendar,
the room-only fields, the custom hours, min / max and the fields a create needs, in one body), recorded BEFORE the function was split.

The corpus (tests/fixtures/calendar_values_char_2480.json, format: tests/support/char_corpus.py) is
- every distinct call the calendar test files made on the unchanged code (test_calendar_*, test_wire_calendar_2470: 36), and
- a full room body and a full non-room body, as a create and as an update (current documents: none, empty, a custom-hours room, a
  maintenance calendar), each field set to 14 generic values (None, '', a number, bounds, a bool, a list ...) and its own edge values,
  removed, or sent alone,
with the whole answer: the column values or the `Invalid` raised (message, field, code). The replay must give the same answer."""
from __future__ import annotations

from collections import Counter

import pytest
from support import char_corpus as cc

from smplwise.services.calendar import model as cm

_CASES = cc.load("calendar_values_char_2480.json")


def _answer(case):
    return cc.replay(cm.calendar_values, case)


def test_the_corpus_is_broad():
    assert len(_CASES) >= 1500
    fields = Counter(c["raises"]["attrs"]["field"] for c in _CASES if "raises" in c)
    assert len(fields) >= 24, fields
    messages = {c["raises"]["args"][0] for c in _CASES if "raises" in c}
    assert {"type cannot change", "min_minutes > max_minutes", "hours_json is required for custom hours", "capacity and equipment are for room calendars"} <= messages
    assert sum(1 for c in _CASES if "result" in c) >= 300


@pytest.mark.parametrize("index", range(len(_CASES)))
def test_calendar_values_replays_the_recorded_answer(index):
    case = _CASES[index]
    assert _answer(case) == cc.recorded(case), case["label"]
