"""CR-BE-GATES-2436 (review finding 02:P1-6, guard): no `async def` route handler opens a database connection on the server loop.

A connection in a coroutine waits for the single-writer lock (and may write an audit row) on the event loop itself; while it waits every
WebSocket and every other async route stalls. The safe shapes are a sync (`def`) handler, a `Depends(get_conn)` / `Depends(get_read_conn)`
dependency (FastAPI runs those in its thread pool), or `await run_in_threadpool(fn, ...)`.

The check is static (AST over smplwise/routers/*.py and smplwise/main.py): an async function carrying a route decorator
(`@<router>.get/post/put/patch/delete/api_route/websocket(...)`) must not
  1. call `<anything>.connection(...)` in its own body, or
  2. call, by plain name, a function of the same module whose body calls `.connection(...)` (one level deep: `_admin(request, ...)`).
Nested `def`s and lambdas are skipped (they are what gets passed to `run_in_threadpool`), and so is a function passed as an argument
rather than called.

`PENDING` lists the offenders known on 2026-11-13. They are fixed by another branch; the first test passes while every offender is in
that list, the second (xfail, strict) starts passing when the list can be emptied - then remove the entry and the mark.
"""
from __future__ import annotations

import ast
from pathlib import Path

import pytest

PKG = Path(__file__).resolve().parents[1] / "smplwise"
ROUTE_ATTRS = {"get", "post", "put", "patch", "delete", "head", "options", "api_route", "websocket", "route"}

# "<module path relative to smplwise/>::<handler>" -> the branch that removes it
PENDING = {
    "routers/wiskey_lineage.py::resolve": "pilot/AUTH-REVOKE-GATE-2435 (02:P1-6)",
}


def _is_route_decorator(dec: ast.expr) -> bool:
    return isinstance(dec, ast.Call) and isinstance(dec.func, ast.Attribute) and dec.func.attr in ROUTE_ATTRS


def _own_calls(fn: ast.AST):
    """Every Call node in the function's own body, not descending into nested defs / lambdas / classes."""
    stack = list(ast.iter_child_nodes(fn))
    while stack:
        node = stack.pop()
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda, ast.ClassDef)):
            continue
        if isinstance(node, ast.Call):
            yield node
        stack.extend(ast.iter_child_nodes(node))


def _opens_connection(fn: ast.AST) -> list[int]:
    return [c.lineno for c in _own_calls(fn) if isinstance(c.func, ast.Attribute) and c.func.attr == "connection"]


def _module_files() -> list[Path]:
    return sorted((PKG / "routers").rglob("*.py")) + [PKG / "main.py"]


def scan(tree: ast.Module) -> dict[str, list[str]]:
    """{handler name: [why]} for the routed async handlers of one parsed module that open a connection on the loop."""
    sync_helpers = {n.name: n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef)}
    found: dict[str, list[str]] = {}
    for node in ast.walk(tree):
        if not isinstance(node, ast.AsyncFunctionDef) or not any(_is_route_decorator(d) for d in node.decorator_list):
            continue
        why = [f"line {ln}: .connection(" for ln in _opens_connection(node)]
        for call in _own_calls(node):
            if isinstance(call.func, ast.Name) and call.func.id in sync_helpers:
                lines = _opens_connection(sync_helpers[call.func.id])
                if lines:
                    why.append(f"line {call.lineno}: {call.func.id}() opens a connection (line {lines[0]})")
        if why:
            found[node.name] = why
    return found


def offenders() -> dict[str, list[str]]:
    found: dict[str, list[str]] = {}
    for path in _module_files():
        rel = path.relative_to(PKG).as_posix()
        for name, why in scan(ast.parse(path.read_text(encoding="utf-8"), filename=str(path))).items():
            found[f"{rel}::{name}"] = why
    return found


def test_the_scan_sees_async_routes():
    count = 0
    for path in _module_files():
        tree = ast.parse(path.read_text(encoding="utf-8"))
        count += sum(1 for n in ast.walk(tree) if isinstance(n, ast.AsyncFunctionDef) and any(_is_route_decorator(d) for d in n.decorator_list))
    assert count >= 20, count  # 31 async handlers on 2026-11-13 (review 05 section 2.2); a broken scan finds none


def test_the_scan_catches_both_shapes():
    src = (
        "@router.post('/a')\nasync def a(request):\n    with request.app.state.db.connection(label='x') as conn:\n        pass\n"
        "def _gate(request):\n    with request.app.state.db.connection() as conn:\n        pass\n"
        "@router.post('/b')\nasync def b(request):\n    _gate(request)\n"
        "@router.post('/c')\nasync def c(request):\n    def work():\n        with request.app.state.db.connection() as conn:\n            pass\n"
        "    await run_in_threadpool(work)\n    await run_in_threadpool(_gate, request)\n"
    )
    assert set(scan(ast.parse(src))) == {"a", "b"}


def test_no_async_route_opens_a_connection_on_the_loop():
    new = {k: v for k, v in offenders().items() if k not in PENDING}
    assert new == {}, "an async route opens a database connection on the server loop; make it `def`, use a dependency or run_in_threadpool: " + repr(new)


@pytest.mark.xfail(strict=True, reason="02:P1-6 is fixed by pilot/AUTH-REVOKE-GATE-2435; after it merges, empty PENDING and remove this mark")
def test_pending_offenders_are_fixed():
    still = sorted(k for k in offenders() if k in PENDING)
    assert still == [], still
