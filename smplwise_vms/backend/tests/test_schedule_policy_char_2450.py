"""CR-BE-COMPLEXITY-B-2450 - characterisation of `services.schedule_policy.check_arguments` (radon CC 91: every argument kind and the
entity / required / exclusive / cover checks in one body), recorded BEFORE the function was split into one function per kind and check.

The corpus (tests/fixtures/schedule_policy_char_2450.json, format: tests/support/char_corpus.py) is
- every distinct call the schedule test files made on the unchanged code (149: test_schedules_model, _more_actions, _followup,
  _conditions, _review, _review2), and
- 1400 seeded calls: every service of SERVICE_ARGS (and an unknown one) with argument values valid, wrong-typed, on and past their
  bounds, control characters, codes, unknown or conflicting arguments, script variables, against entities with and without their own
  modes, ranges, steps, features, tones, sources, hidden sources, volume ceiling, positions and script fields, `dynamic` on and off,
with the whole answer: (problems in order, cleaned data). The replay must give the same answer."""
from __future__ import annotations

from collections import Counter

import pytest
from support import char_corpus as cc

from smplwise.services import schedule_policy as sp

_CASES = cc.load("schedule_policy_char_2450.json")


def test_the_corpus_is_broad():
    assert len(_CASES) >= 1500
    codes = Counter(p["code"] for c in _CASES for p in c["result"]["__tuple__"][0])
    assert set(codes) == {"code_not_allowed", "argument_not_allowed", "required", "out_of_range", "invalid_value", "argument_conflict"}, codes
    assert sum(1 for c in _CASES if not c["result"]["__tuple__"][0]) >= 500, "clean calls"
    services = {c["kwargs"]["service"] if "service" in c["kwargs"] else c["args"][0] for c in _CASES}
    assert set(sp.SERVICE_ARGS) <= services


@pytest.mark.parametrize("index", range(len(_CASES)))
def test_check_arguments_replays_the_recorded_answer(index):
    case = _CASES[index]
    assert cc.replay(sp.check_arguments, case) == cc.recorded(case)
