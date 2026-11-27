"""One route analysis per test process instead of one per test application (BACKEND-SUITE-COST-2560).

Since fastapi 0.141 every application builds, lazily and per included router, an "effective route context" for each API route:
the dependency tree (`get_dependant`, `inspect.signature` of every dependency), the request body field and the response model
fields (a pydantic TypeAdapter each). The product builds it once per process: it has one application. The backend tests build a
fresh application for almost every test (`create_app` in the `client` fixture and in the test worlds), so the suite runs the
same analysis thousands of times. A cProfile of three `test_tickets_dept_handlers.py` tests: `_populate_api_route_state`
6,771 calls, 133 s of the 181 s fixture time (73 %).

The analysis is a pure function of the route and of the include context it is mounted with (prefix, tags, dependencies,
responses, response class, ...). The ONE per-application input is `dependency_overrides_provider` (the application whose
`dependency_overrides` a request consults). So `_EffectiveRouteContext.from_api_route` is memoised on everything except that
provider, and every application gets its OWN context object (`dataclasses.replace`) that carries its own provider; the analysed
parts (dependant, body and response fields) are shared, as they are shared by every request of the one production app.

What keeps this honest (tests/test_route_cache.py):
  * an application built with the cache answers exactly like one built without it (status, body, headers of a sample of routes,
    and the OpenAPI document);
  * `app.dependency_overrides` of one application never reaches another one;
  * anything that changes the route or the include context (another endpoint, prefix, dependency, response model) is a
    different key, so a test that builds an app after changing them gets a fresh analysis;
  * a value that cannot be frozen into a key (an unhashable object) is never cached: the real path runs.

SW_TEST_ROUTE_CACHE=0 switches it off (the real per-application analysis, as before). If fastapi's private names change, nothing is
patched and the real path runs (install() returns False).
"""
from __future__ import annotations

import dataclasses
import os
import threading
from typing import Any

from starlette.routing import BaseRoute, Router

_LOCK = threading.Lock()
_REFS: dict[int, Any] = {}
_CACHE: dict[tuple, tuple[Any, Any]] = {}
STATS = {"hits": 0, "misses": 0, "uncached": 0}
_NOKEY = object()

# what of the original route feeds the analysis (fastapi.routing._EffectiveRouteContext.from_api_route reads these)
_ROUTE_ATTRS = ("path", "endpoint", "response_model", "status_code", "tags", "dependencies", "summary", "description",
                "response_description", "responses", "deprecated", "methods", "operation_id", "response_model_include",
                "response_model_exclude", "response_model_by_alias", "response_model_exclude_unset",
                "response_model_exclude_defaults", "response_model_exclude_none", "include_in_schema", "response_class", "name",
                "callbacks", "openapi_extra", "generate_unique_id_function", "strict_content_type", "stream_item_type")


def enabled() -> bool:
    return os.environ.get("SW_TEST_ROUTE_CACHE", "1") != "0"


def _freeze(value: Any) -> Any:
    """A hashable key for `value`, or _NOKEY. Containers by content, dataclasses by type + fields, everything else by itself
    (functions, classes, enums, routers: identity or their own hash)."""
    if value is None or isinstance(value, (str, int, float, bool, bytes)):
        return value
    if isinstance(value, (list, tuple)):
        items = tuple(_freeze(v) for v in value)
        return _NOKEY if any(i is _NOKEY for i in items) else ("seq", items)
    if isinstance(value, (set, frozenset)):
        items = [_freeze(v) for v in value]
        return _NOKEY if any(i is _NOKEY for i in items) else ("set", frozenset(items))
    if isinstance(value, dict):
        items = tuple((_freeze(k), _freeze(v)) for k, v in value.items())
        return _NOKEY if any(k is _NOKEY or v is _NOKEY for k, v in items) else ("map", items)
    if dataclasses.is_dataclass(value) and not isinstance(value, type):
        items = tuple(_freeze(getattr(value, f.name)) for f in dataclasses.fields(value))
        return _NOKEY if any(i is _NOKEY for i in items) else ("dc", type(value), items)
    if type(value).__name__ == "DefaultPlaceholder":
        inner = _freeze(getattr(value, "value", _NOKEY))
        return _NOKEY if inner is _NOKEY else ("default", inner)
    if isinstance(value, (Router, BaseRoute)):
        # a router or route defines __eq__ without __hash__: keyed by identity (the module-level routers every test app
        # includes); kept alive in _REFS so an id is never reused for another object while the cache holds it
        _REFS[id(value)] = value
        return ("ref", type(value), id(value))
    try:
        hash(value)
    except TypeError:
        return _NOKEY
    return ("obj", value)


def _key(original_route: Any, include_context: Any) -> Any:
    ctx = tuple((f.name, _freeze(getattr(include_context, f.name))) for f in dataclasses.fields(include_context)
                if f.name != "dependency_overrides_provider")
    route = tuple((a, _freeze(getattr(original_route, a, None))) for a in _ROUTE_ATTRS)
    if any(v is _NOKEY for _, v in ctx) or any(v is _NOKEY for _, v in route):
        return _NOKEY
    return (id(original_route), type(original_route), ctx, route)


def install() -> bool:
    """Memoise fastapi's per-application route analysis (once per process). Returns True when patched."""
    if not enabled():
        return False
    try:
        from fastapi import routing
    except ImportError:  # pragma: no cover - fastapi is a dependency of the backend
        return False
    cls = getattr(routing, "_EffectiveRouteContext", None)
    raw = cls.__dict__.get("from_api_route") if cls is not None else None
    if not isinstance(raw, classmethod) or getattr(raw.__func__, "_sw_route_cache", False) or not dataclasses.is_dataclass(cls) \
            or "dependency_overrides_provider" not in {f.name for f in dataclasses.fields(cls)}:
        return False
    real = raw.__get__(None, cls)

    def from_api_route(klass, *, original_route, include_context):  # noqa: ANN001 - fastapi's signature
        key = _key(original_route, include_context)
        if key is _NOKEY:
            STATS["uncached"] += 1
            return real(original_route=original_route, include_context=include_context)
        provider = include_context.dependency_overrides_provider
        with _LOCK:
            hit = _CACHE.get(key)
        if hit is not None and hit[0] is original_route:
            STATS["hits"] += 1
            return dataclasses.replace(hit[1], dependency_overrides_provider=provider)
        STATS["misses"] += 1
        built = real(original_route=original_route, include_context=include_context)
        with _LOCK:
            # the cached template never holds an application: each copy gets the provider of the app it is built for
            _CACHE[key] = (original_route, dataclasses.replace(built, dependency_overrides_provider=None))
        return built

    from_api_route._sw_route_cache = True  # type: ignore[attr-defined]
    from_api_route._sw_raw = raw  # type: ignore[attr-defined]
    cls.from_api_route = classmethod(from_api_route)
    return True


def uninstall() -> None:
    """Back to fastapi's own analysis (tests/test_route_cache.py builds its reference app this way)."""
    from fastapi import routing

    cur = routing._EffectiveRouteContext.__dict__.get("from_api_route")
    fn = getattr(cur, "__func__", None)
    if fn is not None and getattr(fn, "_sw_route_cache", False):
        routing._EffectiveRouteContext.from_api_route = fn._sw_raw


def installed() -> bool:
    from fastapi import routing

    return getattr(getattr(routing._EffectiveRouteContext.__dict__.get("from_api_route"), "__func__", None), "_sw_route_cache", False)
