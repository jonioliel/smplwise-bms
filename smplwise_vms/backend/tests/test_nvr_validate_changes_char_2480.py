"""COMPLEXITY-3-2480 - characterisation of `services.nvr_settings.validate_changes` (radon CC 60: the per-field membership / range /
lock checks, the smart-codec locks, the kept profile / resolution under a new codec and the diff, in one body), recorded BEFORE the
function was split into one function per check family.

The corpus (tests/fixtures/nvr_validate_changes_char_2480.json, format: tests/support/char_corpus.py) is
- every distinct call the NVR stream / encoding test files made on the unchanged code (test_nvr_encoding_*, test_nvr_stream_*,
  test_nvr_h264_bulk_2341: 406), and
- seeded mutations of them (the stream document, the device options or the request: a key dropped or added, a value of another
  type, a number moved),
with the whole answer: (changes, {field: [from, to]}, unchanged) or the `ApiError` raised (status, code, message, details). The replay
must give the same answer.

ADR019-FAMILY3-2510 (ADR-019 Step 1, family 3): the 137 recorded refusals that name a field gained the additive canonical
`details.fields` (= [details.field]) in the fixture; the legacy `field` and every other recorded value are unchanged."""
from __future__ import annotations

from collections import Counter

import pytest
from support import char_corpus as cc

from smplwise.services import nvr_settings

FUNC = nvr_settings.validate_changes
EXTRA_KEYS = ("codec", "profile", "resolution", "fps", "bitrate_mode", "bitrate_kbps", "gop", "quality", "svc", "smart_codec", "b_frames",
              "fields", "locks", "fps_full", "zz")
_CASES = cc.load("nvr_validate_changes_char_2480.json")


def _answer(case):
    return cc.replay(nvr_settings.validate_changes, case)


def test_the_corpus_is_broad():
    assert len(_CASES) >= 1200
    codes = Counter(c["raises"]["attrs"].get("code") for c in _CASES if "raises" in c)
    assert {"field_not_supported", "value_not_allowed", "field_locked"} <= set(codes), codes
    assert sum(1 for c in _CASES if "result" in c and c["result"]["__tuple__"][0]) >= 200, "changes that pass"
    assert any("result" in c and c["result"]["__tuple__"][2] for c in _CASES), "an unchanged field"


@pytest.mark.parametrize("index", range(len(_CASES)))
def test_validate_changes_replays_the_recorded_answer(index):
    case = _CASES[index]
    assert _answer(case) == cc.recorded(case)
