"""COMPLEXITY-3-2480 - characterisation of `services.automation_model.parse_action` (radon CC 61: the preflight, the container blocks
`choose` / `if` / `repeat`, delay, stop, a condition step and the service call in one body), recorded BEFORE the function was split.

The corpus (tests/fixtures/automation_parse_action_char_2480.json, format: tests/support/char_corpus.py) is
- every distinct raw action the automation test files passed on the unchanged code (the files of
  test_automation_parse_condition_char_2480.py: 1708, the nested steps of the containers included), and
- seeded mutations of them,
each replayed under two of the four contexts of support/char_digest.py (`bare` and one other, in turn). The answer is the whole block
(sha256 of its corpus encoding, key order included, with a readable summary) or the exception raised. The replay must give the same
answer."""
from __future__ import annotations

from collections import Counter

import pytest
from support import char_corpus as cc
from support.char_digest import CTX_NAMES, block_answer

from smplwise.services import automation_model as am

_CASES = cc.load("automation_parse_action_char_2480.json")


def test_the_corpus_is_broad():
    assert len(_CASES) >= 3000
    assert set(c["ctx"] for c in _CASES) == set(CTX_NAMES)
    types = Counter(c["result"]["summary"].get("type") for c in _CASES if "result" in c)
    assert {"choose", "if", "repeat_count", "delay", "stop", "condition", "service"} <= set(types), types
    reasons = Counter(c["result"]["summary"].get("reason") for c in _CASES if "result" in c)
    assert {"template", "unknown", "device", "unsupported_step", "disabled_step"} <= set(reasons), reasons


@pytest.mark.parametrize("index", range(len(_CASES)))
def test_parse_action_replays_the_recorded_answer(index):
    case = _CASES[index]
    assert block_answer(am.parse_action, case) == cc.recorded(case)
