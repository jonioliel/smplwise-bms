"""COMPLEXITY-3-2480 - characterisation of `services.plan_geometry.transform_crop` (radon CC 60: the curved / two-point / polyline wall
rules, the openings that follow a cut, the labels and the notes, in one body), recorded BEFORE the function was split.

The corpus (tests/fixtures/plan_transform_crop_char_2480.json, format: tests/support/char_corpus.py) is
- the 14 distinct documents the plan test files re-cropped on the unchanged code (test_plan_crop, test_plan_geometry_store,
  test_plan_geometry_model, test_wall_curves, ...) and one synthetic document with every wall shape the function reads (inside, cut,
  outside, polylines in and out, arcs kept / cut, malformed points, non-dict entries, NaN), openings on cut / dropped walls with t in
  and out of the cut, and labels in / out / malformed,
- each through old / new crop pairs (none, full, sub-crops, shifted, beyond the page, a corner) and document variants (no uncertainty,
  unusable or missing dimensions, collections that are not lists),
with the whole answer: the re-cropped document as its digest (support/char_digest.py) with the counts and the notes. The replay must
give the same answer."""
from __future__ import annotations

import copy

import pytest
from support import char_corpus as cc
from support.char_digest import digest

from smplwise.services import plan_geometry as pg

_CASES = cc.load("plan_transform_crop_char_2480.json")


def _answer(case):
    args = cc.decode(case["args"])
    try:
        out = pg.transform_crop(*copy.deepcopy(args))
        return {"result": cc.plain({"digest": digest(out), "walls": len(out.get("walls") or []) if isinstance(out.get("walls"), list) else None,
                                    "openings": len(out.get("openings") or []) if isinstance(out.get("openings"), list) else None,
                                    "notes": out.get("uncertainty", {}).get("notes")})}
    except Exception as exc:  # noqa: BLE001 - the exception is the recorded outcome
        return {"raises": cc.plain(cc.raised(exc))}


def test_the_corpus_is_broad():
    assert len(_CASES) >= 500
    notes = [n for c in _CASES if "result" in c for n in c["result"]["notes"] or []]
    assert any("הוצמדו" in n for n in notes), "a clamped point"
    assert any("קו שבור" in n for n in notes), "a flattened arc"
    assert any(n.startswith("פריט אחד") for n in notes) and any("הושמטו" in n for n in notes), "dropped items, one and many"


@pytest.mark.parametrize("index", range(len(_CASES)))
def test_transform_crop_replays_the_recorded_answer(index):
    case = _CASES[index]
    assert _answer(case) == cc.recorded(case), (case["doc"], case["variant"])
