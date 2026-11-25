"""MFA-STEPUP-GATES-2490: a static scan of the route table for the step-up ratchet (tests/test_mfa_stepup_gates_2490.py).

For every write route (POST / PUT / PATCH / DELETE) it walks the code the route can run - the endpoint, its FastAPI dependencies
and, transitively, every function of the `smplwise` package they call (module functions, imported names, function-local imports,
closures of dependency wrappers, the constructors of package classes) - and collects:

* `hooked`: the gated permissions passed to `rbac.require()` (the central hook gates those: services/step_up.on_grant);
* `other`: the gated permissions referenced in ANY other way (authorize(), permission sets, custom authorities, door_authority...),
  i.e. a use the hook does not see;
* `guards`: whether the code reaches an explicit `step_up.guard()` / `step_up.guard_action()` / `step_up.on_grant()` call (an
  authority that grants a gated change without require() calls the hook itself).

A string constant counts when it is one of the permissions the scan is asked about, written literally or through a module-level
name (`DISARM = "alarm.disarm"`). Only function bodies are scanned, never module-level tables. The scan over-approximates on purpose
(a reference is not necessarily an authorisation): a route it flags is either gated explicitly or listed with a reason."""
from __future__ import annotations

import ast
import importlib
import inspect
import textwrap
import types
from dataclasses import dataclass, field
from typing import Any, Iterable

PACKAGE = "smplwise"
SKIP_MODULES = ("smplwise.services.step_up", "smplwise.audit", "smplwise.db", "smplwise.errors", "smplwise.test_reset", "smplwise.wire")


@dataclass
class Summary:
    hooked: set[str] = field(default_factory=set)
    other: set[str] = field(default_factory=set)
    guards: bool = False
    refs: set[tuple[str, str]] = field(default_factory=set)  # (permission, function) for every reference outside require()
    param_hooked: set[str] = field(default_factory=set)  # this function's own parameters that reach require() (never merged)

    def merge(self, other: "Summary") -> None:
        self.hooked |= other.hooked
        self.other |= other.other
        self.refs |= other.refs
        self.guards = self.guards or other.guards


def _ours(obj: Any) -> bool:
    mod = getattr(obj, "__module__", None) or ""
    return (mod == PACKAGE or mod.startswith(PACKAGE + ".")) and not mod.startswith(SKIP_MODULES)


def _unwrap(fn: Any) -> Any:
    while isinstance(fn, (staticmethod, classmethod)):
        fn = fn.__func__
    return getattr(fn, "__func__", fn)


class Scanner:
    def __init__(self, permissions: Iterable[str]) -> None:
        self.permissions = frozenset(permissions)
        from smplwise import rbac
        from smplwise.services import step_up

        self.require_fns = {rbac.require}
        self.guard_fns = {step_up.guard, step_up.guard_action, step_up.on_grant}
        self._memo: dict[Any, Summary] = {}
        self._busy: set[Any] = set()

    # ------------------------------------------------------------ resolution

    def _local_imports(self, fn: Any, tree: ast.AST) -> dict[str, Any]:
        out: dict[str, Any] = {}
        mod_name = fn.__module__
        pkg = mod_name.rsplit(".", 1)[0]
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom):
                try:
                    if node.level:
                        base = mod_name if getattr(inspect.getmodule(fn), "__path__", None) else pkg
                        parts = base.split(".")
                        anchor = ".".join(parts[: len(parts) - (node.level - 1)]) if node.level > 1 else base
                        target = anchor + ("." + node.module if node.module else "")
                    else:
                        target = node.module or ""
                    module = importlib.import_module(target)
                except Exception:  # noqa: BLE001 - an unresolvable import is simply not followed
                    continue
                for alias in node.names:
                    value = getattr(module, alias.name, None)
                    if value is None:
                        try:
                            value = importlib.import_module(f"{target}.{alias.name}")
                        except Exception:  # noqa: BLE001
                            continue
                    out[alias.asname or alias.name] = value
            elif isinstance(node, ast.Import):
                for alias in node.names:
                    try:
                        out[alias.asname or alias.name.split(".")[0]] = importlib.import_module(alias.name if alias.asname else alias.name.split(".")[0])
                    except Exception:  # noqa: BLE001
                        continue
        return out

    def _resolve(self, node: ast.AST, names: dict[str, Any], glb: dict[str, Any]) -> Any:
        if isinstance(node, ast.Name):
            if node.id in names:
                return names[node.id]
            if node.id in glb:
                return glb[node.id]
            return getattr(__builtins__, node.id, None) if not isinstance(__builtins__, dict) else __builtins__.get(node.id)
        if isinstance(node, ast.Attribute):
            base = self._resolve(node.value, names, glb)
            if isinstance(base, (types.ModuleType, type)):
                return getattr(base, node.attr, None)
        return None

    # ------------------------------------------------------------ scanning

    def summary(self, fn: Any) -> Summary:
        fn = _unwrap(fn)
        if isinstance(fn, type):
            init = fn.__dict__.get("__init__")
            return self.summary(init) if init is not None and _ours(init) else Summary()
        if not inspect.isfunction(fn) or not _ours(fn):
            return Summary()
        if fn in self._memo:
            return self._memo[fn]
        if fn in self._busy:
            return Summary()
        self._busy.add(fn)
        try:
            out = self._scan(fn)
        finally:
            self._busy.discard(fn)
        self._memo[fn] = out
        return out

    def _scan(self, fn: Any) -> Summary:
        out = Summary()
        try:
            tree = ast.parse(textwrap.dedent(inspect.getsource(fn)))
        except (OSError, TypeError, SyntaxError, IndentationError):
            return out
        glb = getattr(fn, "__globals__", {})
        names = self._local_imports(fn, tree)
        for cell in (getattr(fn, "__closure__", None) or ()):  # a dependency wrapper (read_gate(check)): follow what it closes over
            try:
                value = cell.cell_contents
            except ValueError:
                continue
            if inspect.isfunction(value) or isinstance(value, type):
                out.merge(self.summary(value))
        try:
            params = list(inspect.signature(fn).parameters.values())
        except (TypeError, ValueError):
            params = []
        own = {p.name for p in params}
        in_require: set[int] = set()

        def into_require(arg: ast.AST) -> None:
            in_require.update(id(n) for n in ast.walk(arg))
            out.param_hooked.update(n.id for n in ast.walk(arg) if isinstance(n, ast.Name) and n.id in own)

        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                callee = self._resolve(node.func, names, glb)
                if callee in self.require_fns:
                    for arg in list(node.args) + [k.value for k in node.keywords]:
                        into_require(arg)
                elif callee in self.guard_fns:
                    out.guards = True
                elif inspect.isfunction(_unwrap(callee)) and _ours(_unwrap(callee)):
                    # a wrapper that hands its parameter to require() (bridge_key._gate(..., permission)): the argument is hooked too
                    target = _unwrap(callee)
                    hooked = self.summary(target).param_hooked
                    if not hooked:
                        continue
                    try:
                        names_of = [p.name for p in inspect.signature(target).parameters.values() if p.kind in (p.POSITIONAL_ONLY, p.POSITIONAL_OR_KEYWORD)]
                    except (TypeError, ValueError):
                        continue
                    for i, arg in enumerate(node.args):
                        if i < len(names_of) and names_of[i] in hooked:
                            into_require(arg)
                    for k in node.keywords:
                        if k.arg in hooked:
                            into_require(k.value)
        fdef = next((n for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))), None)
        if fdef is not None and out.param_hooked:  # a default value of a parameter that reaches require() (`permission: str = CONFIGURE`)
            positional = fdef.args.posonlyargs + fdef.args.args
            for a, d in zip(positional[len(positional) - len(fdef.args.defaults):], fdef.args.defaults):
                if a.arg in out.param_hooked:
                    into_require(d)
            for a, d in zip(fdef.args.kwonlyargs, fdef.args.kw_defaults):
                if d is not None and a.arg in out.param_hooked:
                    into_require(d)
        for node in ast.walk(tree):
            value: Any = None
            if isinstance(node, ast.Constant) and isinstance(node.value, str):
                value = node.value
            elif isinstance(node, (ast.Name, ast.Attribute)) and isinstance(getattr(node, "ctx", None), ast.Load):
                resolved = self._resolve(node, names, glb)
                if isinstance(resolved, str):
                    value = resolved
                elif inspect.isfunction(resolved) or isinstance(resolved, type):
                    if resolved in self.guard_fns:
                        out.guards = True
                    elif resolved not in self.require_fns:
                        out.merge(self.summary(resolved))
                    continue
            if value in self.permissions:
                if id(node) in in_require:
                    out.hooked.add(value)
                else:
                    out.other.add(value)
                    out.refs.add((value, f"{fn.__module__}.{fn.__qualname__}"))
        return out

    def route_summary(self, route: Any) -> Summary:
        out = Summary()
        seen: set[int] = set()

        def deps(dependant: Any) -> None:
            for d in dependant.dependencies:
                if id(d) in seen:
                    continue
                seen.add(id(d))
                if d.call is not None:
                    out.merge(self.summary(d.call))
                deps(d)

        out.merge(self.summary(route.endpoint))
        deps(route.dependant)
        return out


WRITE_METHODS = ("POST", "PUT", "PATCH", "DELETE")


def write_routes(app: Any, prefix: str = "/api/v1") -> list[tuple[str, str, Any]]:
    """(method, template without the API prefix, route) for every write route of the app."""
    from fastapi.routing import APIRoute

    def walk(routes: Any, base: str = "") -> Iterable[tuple[str, Any]]:
        for r in routes:
            original = getattr(r, "original_router", None)
            if original is not None:  # newer FastAPI includes routers lazily (_IncludedRouter): the prefix is on the include context
                yield from walk(original.routes, base + (getattr(getattr(r, "include_context", None), "prefix", "") or ""))
                continue
            if isinstance(r, APIRoute):
                yield base + r.path, r
                continue
            inner = getattr(r, "routes", None)
            if inner is not None and getattr(r, "endpoint", None) is None:
                yield from walk(inner, base + (getattr(r, "prefix", "") or ""))

    out = []
    for full, route in walk(app.routes):
        if not full.startswith(prefix + "/"):
            continue
        for method in sorted(route.methods or ()):
            if method in WRITE_METHODS:
                out.append((method, full[len(prefix):], route))
    return out
