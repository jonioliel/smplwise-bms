"""CR-BE-COMPLEXITY-B-2450 - characterisation of `services.plan_ifc.build` (radon CC 146: the project head, storeys, walls, openings,
rooms, objects, connectors, anchors and the containment relations in one body), recorded BEFORE the function was split into one
function per collection.

The corpus (tests/fixtures/plan_ifc_build_char_2450.json, format: tests/support/char_corpus.py) is 150 seeded exports of the contract
sample plans (contracts/fixtures/plan_geometry: sample-v2, -v2-glass, -curved, -curve-points, -v22) with mutations (items dropped,
duplicated, malformed or not objects; opening positions and kinds; object catalog items, positions, sizes, rotations; default levels and
elevations; connector kinds, levels and polylines; wall paths, bulges and thickness; north / schema / calibration), zones (valid, on
another level, broken polygons), anchors, catalog items, one level or all, and the frame size. The answer is the sha256 and length of the
written IFC text (byte-identical: the entity numbering follows the order of writing) and the counts per collection, or the exception the
unchanged code raised. The replay must give the same answer."""
from __future__ import annotations

import hashlib

import pytest
from support import char_corpus as cc

from smplwise.services import plan_ifc

_CASES = cc.load("plan_ifc_build_char_2450.json")


def _build(*args, **kwargs):
    data, counts = plan_ifc.build(*args, **kwargs)
    return {"sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data), "counts": counts}


def test_the_corpus_is_broad():
    assert len(_CASES) >= 150
    written = [c["result"]["counts"] for c in _CASES if "result" in c]
    for coll in ("levels", "walls", "openings", "rooms", "objects", "connectors", "anchors"):
        assert sum(1 for k in written if k[coll]) >= 20, coll
    assert any(c["kwargs"]["level"] is not None for c in _CASES), "one level"
    assert len({c["result"]["sha256"] for c in _CASES if "result" in c}) >= 140, "distinct files"


@pytest.mark.parametrize("index", range(len(_CASES)))
def test_build_replays_the_recorded_file(index):
    case = _CASES[index]
    assert cc.replay(_build, case) == cc.recorded(case)
