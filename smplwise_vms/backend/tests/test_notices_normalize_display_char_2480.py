"""COMPLEXITY-3-2480 - characterisation of `services.notices.model.normalize_display` (radon CC 53: every top-level display setting, the
TV choices, the blocks, weather, news feeds, night, burn-in and the transit block, lenient and strict, in one body), recorded BEFORE the
function was split.

The corpus (tests/fixtures/notices_normalize_display_char_2480.json, format: tests/support/char_corpus.py) is
- the first 150 distinct calls the notice-board test files made on the unchanged code (test_notice*, test_wire_notices_2470,
  test_brand_notice_tv_295, test_calendar_* through the home feeds), raw values that are not a dict, and
- the defaults with every top-level key, every TV choice, every block, the weather / news (feeds: http, credentials, spaces, too long,
  too many, ids) / night / burn-in documents and the captured transit blocks set to their edge values and 13 generic values, or sent
  alone, each lenient and strict,
with the whole answer: the normalized document or the exception raised (`Invalid` with its field, or the TypeError an unhashable value
gives). The replay must give the same answer."""
from __future__ import annotations

from collections import Counter

import pytest
from support import char_corpus as cc

from smplwise.services.notices import model as nm

_CASES = cc.load("notices_normalize_display_char_2480.json")


def _answer(case):
    return cc.replay(nm.normalize_display, case)


def test_the_corpus_is_broad():
    assert len(_CASES) >= 1200
    fields = Counter(c["raises"]["attrs"].get("field") for c in _CASES if "raises" in c)
    assert {"display.template", "display.design", "display.blocks.info", "display.weather.hours", "display.news.feeds", "display.night.dim"} <= set(fields), fields
    assert len(fields) >= 40
    assert sum(1 for c in _CASES if "result" in c) >= 800


@pytest.mark.parametrize("index", range(len(_CASES)))
def test_normalize_display_replays_the_recorded_answer(index):
    case = _CASES[index]
    assert _answer(case) == cc.recorded(case), case["label"]
