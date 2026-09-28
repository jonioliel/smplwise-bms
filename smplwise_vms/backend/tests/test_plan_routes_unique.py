"""T087 tuning (0.1.89 list): `POST /floors/{id}/anchors/realign` was declared twice in routers/anchors.py (a copy that
FastAPI silently shadows - the first one answers, an edit to the second would do nothing). No two routes of the API
routers may share a method and a path. Read from each router's own route list (every router is mounted under the same
/api/v1 prefix in main.py), which does not depend on how a FastAPI version wraps included routers."""
from __future__ import annotations

import importlib
import pkgutil
from collections import Counter

from fastapi import APIRouter
from fastapi.routing import APIRoute

import smplwise.routers as routers_pkg


def _routes() -> Counter[tuple[str, str]]:
    seen: Counter[tuple[str, str]] = Counter()
    for info in pkgutil.iter_modules(routers_pkg.__path__):
        mod = importlib.import_module(f"smplwise.routers.{info.name}")
        router = getattr(mod, "router", None)
        if not isinstance(router, APIRouter):
            continue
        for r in router.routes:
            if isinstance(r, APIRoute):
                for m in r.methods:
                    seen[(m, router.prefix + r.path)] += 1
    return seen


def test_no_route_is_declared_twice():
    seen = _routes()
    dupes = sorted(f"{m} {p}" for (m, p), n in seen.items() if n > 1)
    assert dupes == []
    assert seen[("POST", "/floors/{floor_id}/anchors/realign")] == 1
