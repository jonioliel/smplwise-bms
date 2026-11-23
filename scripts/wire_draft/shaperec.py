"""pytest plugin: record the JSON shape of every answer FastAPI serialises (all routes), merged per route.

SHAPEREC_DIR=<dir> python -m pytest -p shaperec ...   -> <dir>/shapes-<pid>.json  {"METHOD /path": {"annotated": bool, "shape": ...}}
"""
from __future__ import annotations

import atexit
import json
import os
from pathlib import Path
from typing import Any

SHAPES: dict[str, dict[str, Any]] = {}
_DUMP: list[Any] = [None, 0.0]


def _kind(v: Any) -> str:
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "bool"
    if isinstance(v, int):
        return "int"
    if isinstance(v, float):
        return "float"
    if isinstance(v, str):
        return "str"
    if isinstance(v, list):
        return "list"
    if isinstance(v, dict):
        return "obj"
    return "other"


def merge(shape: dict[str, Any] | None, v: Any) -> dict[str, Any]:
    s = shape if shape is not None else {"n": 0, "kinds": {}}
    s["n"] += 1
    k = _kind(v)
    s["kinds"][k] = s["kinds"].get(k, 0) + 1
    if k == "str":
        vals = s.setdefault("strs", [])
        if len(vals) < 8 and v not in vals and len(v) < 40:
            vals.append(v)
    if k == "obj":
        o = s.setdefault("obj", {"n": 0, "keys": {}})
        o["n"] += 1
        for kk, vv in v.items():
            o["keys"][kk] = merge(o["keys"].get(kk), vv)
    if k == "list":
        s["list_n"] = s.get("list_n", 0) + 1
        if v:
            s["list_nonempty"] = s.get("list_nonempty", 0) + 1
        for item in v[:50]:
            s["items"] = merge(s.get("items"), item)
    return s


def pytest_configure(config):  # noqa: ARG001
    import fastapi.routing as fr


    original = fr.serialize_response

    async def recording(**kw: Any) -> Any:
        out = await original(**kw)
        try:
            ctx = kw.get("endpoint_ctx") or {}
            route = str(ctx.get("path") or "?")
            field = kw.get("field")
            body = json.loads(out) if isinstance(out, (bytes, bytearray)) else json.loads(json.dumps(out, default=str))
            ent = SHAPES.setdefault(route, {"annotated": field is not None, "shape": None})
            ent["shape"] = merge(ent["shape"], body)
            pt = type(kw.get("response_content")).__name__
            ent.setdefault("ptypes", [])
            if pt not in ent["ptypes"]:
                ent["ptypes"].append(pt)
        except Exception as exc:  # noqa: BLE001
            SHAPES.setdefault("__errors__", {"annotated": False, "shape": None, "err": []})["err"].append(repr(exc)[:200])
        if _DUMP[0] is not None:
            import time
            if time.monotonic() - _DUMP[1] > 60:
                _DUMP[1] = time.monotonic()
                _DUMP[0]()
        return out

    fr.serialize_response = recording
    import logging

    class _Drift(logging.Handler):
        def emit(self, record):
            msg = record.getMessage()[:300]
            d = SHAPES.setdefault("__drift__", {"annotated": False, "shape": None, "msgs": {}})["msgs"]
            d[msg] = d.get(msg, 0) + 1

    logging.getLogger("smplwise.wire").addHandler(_Drift(level=logging.ERROR))
    d = os.environ.get("SHAPEREC_DIR")
    if d:
        def dump() -> None:
            p = Path(d)
            p.mkdir(parents=True, exist_ok=True)
            (p / f"shapes-{os.getpid()}.json").write_text(json.dumps(SHAPES), encoding="utf-8")
        atexit.register(dump)
        _DUMP[0] = dump


def pytest_runtest_logreport(report):
    """Write every failure at once (a run that is stopped still leaves them): <SHAPEREC_DIR>/failures.txt."""
    if report.failed and os.environ.get("SHAPEREC_DIR"):
        with open(Path(os.environ["SHAPEREC_DIR"]) / "failures.txt", "a", encoding="utf-8") as fh:
            fh.write(f"=== {report.nodeid} ({report.when})\n{report.longreprtext[-4000:]}\n")
