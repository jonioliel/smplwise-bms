"""The corpus of a characterisation test (CR-BE-COMPLEXITY-B-2450): calls of a function recorded from the UNCHANGED code, replayed
after the function was split. JSON, with tags for what JSON cannot say, so a replay passes the function exactly what it got:
a tuple is `{"__tuple__": [...]}`, bytes `{"__bytes__": "<base64>"}`, a set `{"__set__": [...]}` (sorted when it can be),
a frozenset `{"__frozenset__": [...]}`. Every other value is plain JSON (dict keys are strings; NaN / infinity as Python writes them).

Recording a corpus from the existing tests: `SW_CHAR_RECORD=<module>:<function>=<out.json> PYTHONPATH=tests pytest -p support.char_record <files>`
(tests/support/char_record.py) - every distinct call and its result, in call order."""
from __future__ import annotations

import base64
import json
from pathlib import Path
from collections.abc import Callable
from typing import Any

FIXTURES = Path(__file__).resolve().parent.parent / "fixtures"


def encode(value: Any) -> Any:
    if isinstance(value, tuple):
        return {"__tuple__": [encode(v) for v in value]}
    if isinstance(value, (bytes, bytearray)):
        return {"__bytes__": base64.b64encode(bytes(value)).decode("ascii")}
    if isinstance(value, (set, frozenset)):
        items = [encode(v) for v in value]
        try:
            items = sorted(items)
        except TypeError:
            items = sorted(items, key=lambda v: json.dumps(v, sort_keys=True))
        return {"__frozenset__" if isinstance(value, frozenset) else "__set__": items}
    if isinstance(value, dict):
        out = {}
        for k, v in value.items():
            assert isinstance(k, str), f"a corpus dict key must be a string, got {k!r}"
            out[k] = encode(v)
        return out
    if isinstance(value, list):
        return [encode(v) for v in value]
    assert value is None or isinstance(value, (str, int, float, bool)), f"a corpus cannot hold {type(value).__name__}"
    return value


def decode(value: Any) -> Any:
    if isinstance(value, dict):
        if len(value) == 1:
            (tag, inner), = value.items()
            if tag == "__tuple__":
                return tuple(decode(v) for v in inner)
            if tag == "__bytes__":
                return base64.b64decode(inner)
            if tag == "__set__":
                return {decode(v) for v in inner}
            if tag == "__frozenset__":
                return frozenset(decode(v) for v in inner)
        return {k: decode(v) for k, v in value.items()}
    if isinstance(value, list):
        return [decode(v) for v in value]
    return value


def load(name: str) -> list[dict[str, Any]]:
    """The cases of tests/fixtures/<name> (still encoded: decode the parts a replay passes on)."""
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def dump(name: str, cases: list[dict[str, Any]]) -> None:
    (FIXTURES / name).write_text(json.dumps(cases, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8", newline="\n")


def plain(value: Any) -> Any:
    """A result as the corpus stores it (encode, then through JSON: what a recorded result is compared with)."""
    return json.loads(json.dumps(encode(value)))


def raised(exc: BaseException) -> dict[str, Any]:
    """An exception as the corpus stores it: its class name and its arguments."""
    return {"type": type(exc).__name__, "args": list(exc.args)}


def replay(func: Callable[..., Any], case: dict[str, Any]) -> dict[str, Any]:
    """Call `func` with the case's arguments: {"result": ...} or {"raises": ...}, as the corpus stores them."""
    args, kwargs = decode(case["args"]), decode(case["kwargs"])
    try:
        return {"result": plain(func(*args, **kwargs))}
    except Exception as exc:  # noqa: BLE001 - the exception is the recorded outcome
        return {"raises": plain(raised(exc))}


def recorded(case: dict[str, Any]) -> dict[str, Any]:
    """What the unchanged code answered for the case."""
    return {k: case[k] for k in ("result", "raises") if k in case}
