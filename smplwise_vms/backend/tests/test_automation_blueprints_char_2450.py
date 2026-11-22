"""CR-BE-COMPLEXITY-B-2450 - characterisation of `services.automation_blueprints.validate_definition` (radon CC 61: the header, the
parameters, the rules and the template checks in one body), recorded BEFORE the function was split into one function per part.

The corpus (tests/fixtures/automation_blueprints_char_2450.json, format: tests/support/char_corpus.py) is the 8 built-in blueprints and
up to 60 seeded mutations of each (header values, parameter keys / types / labels / domains / roles, duplicate and unused parameters,
rules, template keys and mode, trigger / condition / action steps, parameter references and conversions), plus non-object definitions,
with the whole answer: every problem in order, or the exception the unchanged code raised. The replay must give the same answer.

CR-IFC-SPLIT-2460 updated 16 cases on purpose (95, 123, 144, 160, 164, 168, 180, 215, 266, 272, 284, 295, 313, 317, 320, 364): a list or
object as a trigger / condition type raised TypeError; each now records the problem list (the type "not allowed")."""
from __future__ import annotations

import pytest
from support import char_corpus as cc

from smplwise.services import automation_blueprints as bps

_CASES = cc.load("automation_blueprints_char_2450.json")


def test_the_corpus_is_broad():
    assert len(_CASES) >= 350
    problems = [p for c in _CASES if "result" in c for p in c["result"]]
    for text in ("definition is not an object", "unknown keys", "bad id", "bad version", "bad category", "bad title", "bad description",
                 "parameters: 1-12 required", "bad or duplicate parameter key", "bad type", "label required", "domains required",
                 "forbidden domain", "role must be watch or control", "bad rule", "template: keys must be", "template: mode must be",
                 "undeclared parameter", "bad conversion", "is never used", "trigger type not allowed", "keys not allowed",
                 "a trigger is required", "condition type not allowed", "an action is required"):
        assert any(text in p for p in problems), text
    assert sum(1 for c in _CASES if "result" in c and not c["result"]) >= 8, "the built-in blueprints are clean"


@pytest.mark.parametrize("index", range(len(_CASES)))
def test_validate_definition_replays_the_recorded_answer(index):
    case = _CASES[index]
    assert cc.replay(bps.validate_definition, case) == cc.recorded(case)
