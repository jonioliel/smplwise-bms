"""CR-BE-COMPLEXITY-2450 - characterisation of `services.media_model.build` (the media dedupe ladder; code review 03:F22: "media_model.build,
documented rungs 1-6"), recorded BEFORE the function was split into one function per rung.

The corpus (tests/fixtures/media_model_char_2450.json) is every distinct `build()` call the media test files made on the unchanged code
(test_media_model, test_media_players_ladder, test_media_review_fixes, test_media_cast_caps, test_media_fake_ha, test_ha_names_2611):
the inputs, the fresh keys `new_key` handed out in order, and the whole resulting model (devices in order with every endpoint field,
suggestions in order, the endpoint -> device map). The replay hands out the same keys and must rebuild the same model exactly - and
must not ask for a key more or fewer."""
from __future__ import annotations

import dataclasses
import json
from pathlib import Path

import pytest

from smplwise.services import media_model as mm

CORPUS = Path(__file__).resolve().parent / "fixtures" / "media_model_char_2450.json"


def _cases() -> list[dict]:
    return json.loads(CORPUS.read_text(encoding="utf-8"))


def project(model: mm.Model) -> dict:
    """The whole model as plain data, in order (device order, endpoint order and suggestion order are behaviour)."""
    return {"devices": [[k, dataclasses.asdict(d)] for k, d in model.devices.items()],
            "suggestions": [dataclasses.asdict(s) for s in model.suggestions],
            "by_endpoint": [[k, v] for k, v in model.by_endpoint.items()]}


def replay(case: dict) -> dict:
    keys = list(case["keys"])

    def new_key() -> str:
        assert keys, "build() asked for more fresh keys than it did when the corpus was recorded"
        return keys.pop(0)

    model = mm.build(case["entities"], case["devices"], case["rules"], existing_keys=case["existing_keys"],
                     existing_anchors=case["existing_anchors"], new_key=new_key)
    assert not keys, "build() asked for fewer fresh keys than it did when the corpus was recorded"
    return json.loads(json.dumps(project(model)))


def test_the_corpus_is_broad():
    cases = _cases()
    assert len(cases) >= 50
    rungs = {e["rule"] for c in cases for _k, d in c["model"]["devices"] for e in d["endpoints"]}
    assert {"single", "device", "ma", "mac", "identifier", "manual"} <= rungs, rungs
    assert any(c["model"]["suggestions"] for c in cases), "suggestions are exercised"
    assert any(c["rules"] for c in cases), "administrator rules are exercised"
    assert any(c["existing_keys"] for c in cases), "stable keys are exercised"


@pytest.mark.parametrize("index", range(len(_cases())))
def test_build_replays_the_recorded_model(index):
    case = _cases()[index]
    assert replay(case) == case["model"]
