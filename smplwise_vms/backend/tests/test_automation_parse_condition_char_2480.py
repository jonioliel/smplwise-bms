"""COMPLEXITY-3-2480 - characterisation of `services.automation_model.parse_condition` (radon CC 74: the preflight, the template and
device locks and one branch per condition type in one body), recorded BEFORE the function was split into one function per type.

The corpus (tests/fixtures/automation_parse_condition_char_2480.json, format: tests/support/char_corpus.py) is
- every distinct raw condition the automation test files passed on the unchanged code (test_automation_*, test_automations_*,
  test_kav079_*, test_building_presence_*, test_bridge_config_*, test_fake_ha_config: 353, the nested ones of `and` / `or` / `not` and
  of a `choose` / `if` included), and
- seeded mutations of them (a key dropped or added, a value of another type, `enabled` / `continue_on_error` / a secret, a template),
each replayed under the four contexts of support/char_digest.py (bare; names; Shabbat sensor + presence entity + tagged sensors + wall
buttons; an allow-list without template text), with `in_group` as the test made the call. The answer is the whole block (sha256 of its
corpus encoding, key order included, with a readable summary) or the exception raised. The replay must give the same answer."""
from __future__ import annotations

from collections import Counter

import pytest
from support import char_corpus as cc
from support.char_digest import CTX_NAMES, block_answer

from smplwise.services import automation_model as am

_CASES = cc.load("automation_parse_condition_char_2480.json")


def test_the_corpus_is_broad():
    assert len(_CASES) >= 1500
    assert set(c["ctx"] for c in _CASES) == set(CTX_NAMES)
    types = Counter(c["result"]["summary"].get("type") for c in _CASES if "result" in c)
    assert {"state", "numeric_state", "time", "sun", "trigger", "and", "or", "not", "shabbat", "presence"} <= set(types), types
    reasons = Counter(c["result"]["summary"].get("reason") for c in _CASES if "result" in c)
    assert {"template", "unknown", "device", "unsupported_step", "disabled_step"} <= set(reasons), reasons
    assert any(c["kwargs"].get("in_group") for c in _CASES)


@pytest.mark.parametrize("index", range(len(_CASES)))
def test_parse_condition_replays_the_recorded_answer(index):
    case = _CASES[index]
    assert block_answer(am.parse_condition, case) == cc.recorded(case)
