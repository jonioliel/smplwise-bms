"""COMPLEXITY-3-2480 - characterisation of `services.plan_geometry.merge_candidates` (radon CC 68: the candidate pool checks, the edits,
the host checks, replace_auto, the orphan check and the re-issue, in one body), recorded BEFORE the function was split.

The corpus (tests/fixtures/plan_merge_candidates_char_2480.json, format: tests/support/char_corpus.py) is
- nine distinct calls the plan test files made on the unchanged code (test_plan_geometry_model, test_wall_curves, test_plan_detect_api,
  test_plan_dxf_map, test_plan_wizard_api_2434, ...; the draft reduced to the collections the merge reads), and
- seeded mutations of each: replace_auto flipped, the accepted list (none, all, reversed with a duplicate, unknown ids), edits (not a dict,
  forbidden fields, a three-point polyline with and without bulges, every editable field, a curved candidate re-cornered), an accepted id
  already in the draft, broken candidates (not a dict, no / empty id, no candidate prefix, another source, a duplicate), opening hosts (a
  list, an orphan, a wall of the draft), a draft holding items of both sources with locked ones and manual openings, a bare draft,
with the whole answer: the merged document as its digest (support/char_digest.py) with the counts, or the `CandidateError` raised (code,
user message, ids). Re-issued ids come from a deterministic source (`re-1`, `re-2` ... per call). The replay must give the same answer."""
from __future__ import annotations

import copy
import itertools
from collections import Counter

import pytest
from support import char_corpus as cc
from support.char_digest import digest

from smplwise.services import plan_geometry as pg

_CASES = cc.load("plan_merge_candidates_char_2480.json")


def _ids():
    n = itertools.count(1)
    return lambda: f"re-{next(n)}"


def _answer(case):
    args = cc.decode(case["args"])
    try:
        doc, counts = pg.merge_candidates(*copy.deepcopy(args), new_id_fn=_ids())
        return {"result": cc.plain({"digest": digest(doc), "counts": counts, "walls": len(doc.get("walls", [])), "openings": len(doc.get("openings", []))})}
    except Exception as exc:  # noqa: BLE001 - the exception is the recorded outcome
        return {"raises": cc.plain(cc.raised(exc))}


def test_the_corpus_is_broad():
    assert len(_CASES) >= 250
    codes = Counter(c["raises"]["attrs"]["code"] for c in _CASES if "raises" in c)
    assert {"candidate_shape", "candidate_source", "duplicate_candidate", "unknown_candidate", "orphan_opening"} <= set(codes), codes
    results = [c["result"]["counts"] for c in _CASES if "result" in c]
    assert sum(1 for r in results if r["reided"]) >= 10, "re-issued ids"
    assert sum(1 for r in results if r["removed_auto"]) >= 10 and any(r["removed_manual_openings"] for r in results), "replace_auto"


@pytest.mark.parametrize("index", range(len(_CASES)))
def test_merge_candidates_replays_the_recorded_answer(index):
    case = _CASES[index]
    assert _answer(case) == cc.recorded(case), (case["base"], case["mutation"])
