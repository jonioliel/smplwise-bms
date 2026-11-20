"""CR-BE-COMPLEXITY-B-2450 - characterisation of `services.automation_model.validate_draft` (radon CC 108: the scene, header, trigger,
condition, action and script-field checks in one body), recorded BEFORE the function was split into one function per block family.

The corpus (tests/fixtures/automation_validate_draft_char_2450.json, format: tests/support/char_corpus.py) is
- every distinct call the automation test files made on the unchanged code (185: test_automation_*, test_automations_*,
  test_building_presence_2271 / _cockpit_2271, test_kav079_*), and
- up to three variants of each with a different context (notify targets, Shabbat sensor, allowed actions, presence entity, wall buttons,
  tagged presence sensors), answered by the unchanged code,
with the whole answer: every issue in order (path, code, message) or the exception raised. The replay must give the same answer."""
from __future__ import annotations

from collections import Counter

import pytest
from support import char_corpus as cc

from smplwise.services import automation_model as am

_CASES = cc.load("automation_validate_draft_char_2450.json")


def test_the_corpus_is_broad():
    assert len(_CASES) >= 600
    kinds = Counter(c["args"][0] for c in _CASES)
    assert {"automation", "script", "scene"} <= set(kinds), kinds
    codes = {i["code"] for c in _CASES if "result" in c for i in c["result"]}
    assert len(codes) >= 40, sorted(codes)
    assert {"duplicate_trigger_id", "too_deep", "wall_buttons_off", "notify_target_not_allowed", "field_key_invalid", "domain_not_allowed",
            "state_for_conflict", "presence_entity_missing", "count_invalid"} <= codes
    assert any(not c["result"] for c in _CASES if "result" in c), "a clean draft"


@pytest.mark.parametrize("index", range(len(_CASES)))
def test_validate_draft_replays_the_recorded_answer(index):
    case = _CASES[index]
    assert cc.replay(am.validate_draft, case) == cc.recorded(case)
