"""CR-BE-COMPLEXITY-B-2450 - characterisation of `services.temperature_explain.explain` (radon CC 114: every signal of the excursion
explanation in one body), recorded BEFORE the function was split into one function per signal.

The corpus (tests/fixtures/temperature_explain_char_2450.json, format: tests/support/char_corpus.py) is
- every distinct call test_tempexplain_093.py and test_be_twins_2440.py made on the unchanged code (28), and
- 260 seeded synthetic excursions (high / low, ongoing or closed, with and without doors, defrost windows, outages, maintenance,
  silent stretches, power readings, setpoint / mode flags, neighbours that moved or not, and rule values off their defaults),
with the whole answer each gave: the factors in order with their scores and evidence, the primary factor, the confidence and the
profile. The replay must give the same answer exactly."""
from __future__ import annotations

from collections import Counter

import pytest
from support import char_corpus as cc

from smplwise.services import temperature_explain as tx

CORPUS = "temperature_explain_char_2450.json"
_CASES = cc.load(CORPUS)


def test_the_corpus_is_broad():
    assert len(_CASES) >= 250
    keys = Counter(f["key"] for c in _CASES for f in c["result"]["factors"])
    assert set(keys) == {"maint", "defrost", "door", "outage", "compressor_no_power", "compressor_off", "compressor_on", "unit_off",
                         "setpoint", "gap", "spike", "shared", "local", "gradual"}, keys
    assert {c["result"]["confidence"] for c in _CASES} == {"high", "medium", "low", "none"}
    assert {c["kwargs"]["kind"] for c in _CASES} == {"high", "low"}
    assert any(c["kwargs"]["end_ts"] is None for c in _CASES), "an ongoing excursion"


@pytest.mark.parametrize("index", range(len(_CASES)))
def test_explain_replays_the_recorded_answer(index):
    case = _CASES[index]
    assert cc.replay(tx.explain, case) == cc.recorded(case)
