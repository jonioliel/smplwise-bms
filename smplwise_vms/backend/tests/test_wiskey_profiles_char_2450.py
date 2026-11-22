"""CR-BE-COMPLEXITY-B-2450 - characterisation of `services.wiskey_profiles.normalize_draft` (radon CC 94: the shape, every field, the field
conditions, every group and the id checks in one body), recorded BEFORE the function was split into one function per part.

The corpus (tests/fixtures/wiskey_profiles_draft_char_2450.json, format: tests/support/char_corpus.py) is
- every distinct call test_wiskey_profiles.py made on the unchanged code (14), and
- 500 seeded drafts: valid ones built from scratch (up to 12 fields with condition chains, up to 6 groups) and mutations of a base
  draft (bad shapes and types, labels, options, condition parents / values / cycles, duplicate ids, station lists, the 50-problem cap),
  each with and without a set of known stations,
with the whole answer: the normalised draft, or the DraftError with every problem in order. The replay must give the same answer."""
from __future__ import annotations

from collections import Counter

import pytest
from support import char_corpus as cc

from smplwise.services import wiskey_profiles as wp

_CASES = cc.load("wiskey_profiles_draft_char_2450.json")


def test_the_corpus_is_broad():
    assert len(_CASES) >= 500
    assert sum("result" in c for c in _CASES) >= 100, "normalised drafts"
    codes = Counter(p["code"] for c in _CASES if "raises" in c for p in c["raises"]["attrs"].get("problems", []))
    assert {"shape", "type", "id", "label", "too_many", "option", "duplicate", "empty", "parent", "value", "cycle", "station",
            "unknown_station"} <= set(codes), codes
    assert any(len(c["raises"]["attrs"].get("problems", [])) == 50 for c in _CASES if "raises" in c), "the 50-problem cap"


@pytest.mark.parametrize("index", range(len(_CASES)))
def test_normalize_draft_replays_the_recorded_answer(index):
    case = _CASES[index]
    assert cc.replay(wp.normalize_draft, case) == cc.recorded(case)
