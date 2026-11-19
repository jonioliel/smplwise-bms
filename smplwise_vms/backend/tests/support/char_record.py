"""A pytest plugin that records the calls of one function into a characterisation corpus (CR-BE-COMPLEXITY-B-2450).

    SW_CHAR_RECORD=smplwise.services.temperature_explain:explain=/tmp/explain.json PYTHONPATH=tests pytest -p support.char_record tests/test_x.py

The module attribute is wrapped for the session: every call made through it (the tests' own calls and the package's calls through
the module) is recorded with its keyword and positional arguments and its result (or the exception it raised), in the corpus format of support.char_corpus;
identical calls are kept once. A call whose arguments or result the format cannot hold (a connection, an object) is skipped and
counted. Recording is a development step: no test runs with this plugin."""
from __future__ import annotations

import copy
import importlib
import json
import os

from support.char_corpus import encode, raised

_CASES: list[dict] = []
_SEEN: set[str] = set()
_SKIPPED = [0]
_TARGET: dict = {}


def _keep(before: dict, outcome: dict) -> None:
    try:
        case = {**before, **{k: encode(v) for k, v in outcome.items()}}
    except (AssertionError, TypeError):
        _SKIPPED[0] += 1
        return
    key = json.dumps(before, sort_keys=True)
    if key not in _SEEN:
        _SEEN.add(key)
        _CASES.append(case)


def pytest_configure(config):
    spec = os.environ.get("SW_CHAR_RECORD")
    if not spec:
        return
    target, out = spec.split("=", 1)
    module_name, func_name = target.split(":")
    mod = importlib.import_module(module_name)
    original = getattr(mod, func_name)

    def wrapper(*args, **kwargs):
        try:
            before = encode({"args": list(copy.deepcopy(args)), "kwargs": copy.deepcopy(kwargs)})
        except (AssertionError, TypeError, copy.Error):
            before = None
        try:
            result = original(*args, **kwargs)
        except Exception as exc:
            if before is not None:
                _keep(before, {"raises": raised(exc)})
            raise
        if before is not None:
            _keep(before, {"result": result})
        else:
            _SKIPPED[0] += 1
        return result

    setattr(mod, func_name, wrapper)
    _TARGET.update(mod=mod, name=func_name, original=original, out=out)


def pytest_unconfigure(config):
    if not _TARGET:
        return
    setattr(_TARGET["mod"], _TARGET["name"], _TARGET["original"])
    with open(_TARGET["out"], "w", encoding="utf-8", newline="\n") as fh:
        json.dump(_CASES, fh, ensure_ascii=False, separators=(",", ":"))
    print(f"\nchar_record: {len(_CASES)} distinct calls of {_TARGET['name']} written to {_TARGET['out']} ({_SKIPPED[0]} skipped)")
