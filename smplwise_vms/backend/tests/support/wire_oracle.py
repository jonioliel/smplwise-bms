"""The wire oracle (code review 07:F8 step 2): every answer a route serialises through a response model (`smplwise/wire`) is compared,
in the same request, with what the route answered before it had one - FastAPI's serialisation of the returned dict as `dict[str, Any]`
(the route's old return annotation; `jsonable_encoder` for a route that had none). The comparison is on the parsed JSON and strict about
keys, values and types (`1` is not `1.0`, `true` is not `1`, an absent key is not `null`), so "the model describes the JSON exactly" is
checked by every test that reaches such a route, not only by the characterisation tests.

Key ORDER is reported, not failed (`ORDER_DIFFS`): JSON objects are unordered, and a few objects already came out in two orders before
the models (a stored settings document read back with sorted keys next to the same object built in code). The models declare the
order the routes build their dicts in.

Installed once per test process from conftest.py (`install()`); a mismatch raises `WireMismatch` inside the request, which the
TestClient re-raises in the test. `SW_WIRE_ORACLE=0` switches it off (a timing measurement)."""
from __future__ import annotations

import json
import os
import re
from typing import Any

from fastapi.encoders import jsonable_encoder
from pydantic import TypeAdapter

_LEGACY = TypeAdapter(dict[str, Any])
_INSTALLED = False
_DUMP: Any = None  # set by _record_coverage() when SW_WIRE_COVERAGE_DIR is given
CHECKED: dict[str, int] = {}  # "METHOD path" -> answers compared (the characterisation tests read it)
ORDER_DIFFS: dict[str, set[str]] = {}  # "METHOD path" -> JSON paths of objects whose key order the model changed


class WireMismatch(AssertionError):
    pass


def same(a: Any, b: Any, where: str = "$", order: list[str] | None = None) -> str | None:
    """None when equal as JSON with identical types, else where they first differ. Objects whose keys come in another order are
    appended to `order` (when given)."""
    if type(a) is not type(b):
        return f"{where}: {type(a).__name__} {a!r:.80} != {type(b).__name__} {b!r:.80}"
    if isinstance(a, dict):
        if set(a) != set(b):
            return f"{where}: keys {sorted(set(a) ^ set(b))} only on one side"
        if order is not None and list(a) != list(b):
            order.append(where)
        for k in a:
            d = same(a[k], b[k], f"{where}.{k}", order)
            if d:
                return d
        return None
    if isinstance(a, list):
        if len(a) != len(b):
            return f"{where}: length {len(a)} != {len(b)}"
        for i, (x, y) in enumerate(zip(a, b)):
            d = same(x, y, f"{where}[{i}]", order)
            if d:
                return d
        return None
    return None if a == b else f"{where}: {a!r:.80} != {b!r:.80}"


def _is_wire(field: Any) -> bool:
    import types
    import typing

    from smplwise.wire import WireModel

    ann = getattr(getattr(field, "field_info", None), "annotation", None)
    members = typing.get_args(ann) if isinstance(ann, types.UnionType) or typing.get_origin(ann) is typing.Union else (ann,)
    return bool(members) and all(isinstance(m, type) and issubclass(m, WireModel) for m in members)


def legacy_json(content: Any, had_annotation: bool = True) -> Any:
    """The pre-model answer of a returned value, parsed."""
    if had_annotation:
        return json.loads(_LEGACY.dump_json(content))
    return json.loads(json.dumps(jsonable_encoder(content), ensure_ascii=False))


# routes that had no return annotation before their model (FastAPI used jsonable_encoder + JSONResponse for them)
UNANNOTATED: set[str] = {"POST /api/v1/energy/tariffs/{tid}/versions"}


def install() -> None:
    global _INSTALLED
    if _INSTALLED or os.environ.get("SW_WIRE_ORACLE") == "0":
        return
    import fastapi.routing as fr

    original = fr.serialize_response

    async def checked(**kw: Any) -> Any:
        out = await original(**kw)
        field = kw.get("field")
        if field is None or not _is_wire(field):
            return out
        ctx = kw.get("endpoint_ctx") or {}
        route = str(ctx.get("path") or ctx.get("function") or "?")
        modelled = json.loads(out) if isinstance(out, (bytes, bytearray)) else json.loads(json.dumps(out))
        before = legacy_json(kw["response_content"], route not in UNANNOTATED)
        order: list[str] = []
        diff = same(modelled, before, "$", order)
        if order:
            ORDER_DIFFS.setdefault(route, set()).update(re.sub(r"\[\d+\]", "[]", o) for o in order)
        if diff:
            raise WireMismatch(f"{route}: the modelled answer differs from the route's own dict at {diff}")
        CHECKED[route] = CHECKED.get(route, 0) + 1
        if CHECKED[route] == 1 and _DUMP is not None:
            _DUMP()  # a route seen for the first time: the file is current even if the run is stopped before it ends
        return out

    fr.serialize_response = checked
    _INSTALLED = True
    _record_coverage()


def _record_coverage() -> None:
    """CR-ROUTE-CHAR-2460: `SW_WIRE_COVERAGE_DIR=<dir>` writes, when the test process ends, the routes this process compared
    (`<dir>/oracle-<pid>.json`, {"METHOD path": answers}); `scripts/wire_route_coverage.py` lists the modelled routes no file names.
    One file per process, so xdist workers and parallel runs never write the same file. The file is also rewritten whenever a route is
    compared for the first time (at most once per modelled route), so a stopped run still leaves what it saw."""
    out = os.environ.get("SW_WIRE_COVERAGE_DIR")
    if not out:
        return
    import atexit
    from pathlib import Path

    def dump() -> None:
        d = Path(out)
        d.mkdir(parents=True, exist_ok=True)
        (d / f"oracle-{os.getpid()}.json").write_text(json.dumps(CHECKED, indent=0, sort_keys=True), encoding="utf-8")

    global _DUMP
    _DUMP = dump
    atexit.register(dump)
