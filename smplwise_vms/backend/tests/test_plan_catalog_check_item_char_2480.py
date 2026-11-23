"""COMPLEXITY-3-2480 - characterisation of `services.plan_catalog.check_item` (radon CC 57: the id / names / tags / role / shape / size /
z / params / icon / colour checks, the realistic-3D fields and the built-in-only fields, in one body), recorded BEFORE the function was
split.

The corpus (tests/fixtures/plan_catalog_check_item_char_2480.json, format: tests/support/char_corpus.py) is
- the first 120 distinct calls the catalog test files made on the unchanged code (test_plan_catalog, test_plan_catalog_api,
  test_plan_package, test_plan_studio6, ...: the built-in file's items and the custom-item routes), items that are not objects, and
- five seed items (one per shape / light / material combination) with every field the function reads set to each of its edge values,
  to a value of another type or removed, each as a built-in and as a custom item, plus duplicate ids,
with the whole answer: the problem strings in order and the `ids` set after the call (the function adds the id it accepted). The
replay must give the same answer."""
from __future__ import annotations

import copy
import re
from collections import Counter

import pytest
from support import char_corpus as cc

from smplwise.services import plan_catalog as cat

_CASES = cc.load("plan_catalog_check_item_char_2480.json")


def _answer(case):
    args, kwargs = copy.deepcopy(cc.decode(case["args"])), cc.decode(case["kwargs"])
    try:
        problems = cat.check_item(*args, **kwargs)
        return {"result": cc.plain({"problems": problems, "ids_after": args[1]})}
    except Exception as exc:  # noqa: BLE001 - the exception is the recorded outcome
        return {"raises": cc.plain(cc.raised(exc))}


def test_the_corpus_is_broad():
    assert len(_CASES) >= 1500
    kinds = Counter(re.sub(r"^[^:]*: ", "", p)[:20] for c in _CASES if "result" in c for p in c["result"]["problems"])
    assert len(kinds) >= 23, kinds
    assert sum(1 for c in _CASES if "result" in c and not c["result"]["problems"]) >= 100, "items that pass"


@pytest.mark.parametrize("index", range(len(_CASES)))
def test_check_item_replays_the_recorded_answer(index):
    case = _CASES[index]
    assert _answer(case) == cc.recorded(case), case["label"]
