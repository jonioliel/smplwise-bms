"""BACKEND-SUITE-COST-2560: the shared route analysis of the test apps (tests/support/route_cache.py) changes nothing an app does.

1. Two plain applications on one router: each sees its OWN `dependency_overrides`, and a different include context (prefix,
   dependencies) is a different analysis.
2. The product application built with the cache answers like one built without it: the same OpenAPI document and the same
   status, body and content type for a sample of requests (an identity, a read, a 404, a 422 validation refusal)."""
from __future__ import annotations

import dataclasses

import pytest
from fastapi import APIRouter, Depends, FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel
from support import route_cache

from smplwise.main import create_app

pytestmark = pytest.mark.skipif(not route_cache.installed(), reason="route cache switched off (SW_TEST_ROUTE_CACHE=0)")


def who() -> str:
    return "real"


def tag() -> str:
    return "plain"


class Body(BaseModel):
    n: int


router = APIRouter()


@router.get("/who")
def get_who(name: str = Depends(who)) -> dict:
    return {"who": name}


@router.post("/echo")
def post_echo(body: Body) -> Body:
    return body


def _app(**include) -> FastAPI:
    app = FastAPI()
    app.include_router(router, **include)
    return app


def test_each_application_keeps_its_own_dependency_overrides():
    a, b = _app(), _app()
    a.dependency_overrides[who] = lambda: "override-a"
    hits = route_cache.STATS["hits"]
    ca, cb = TestClient(a), TestClient(b)
    assert ca.get("/who").json() == {"who": "override-a"}
    assert cb.get("/who").json() == {"who": "real"}, "an override of one app leaked into another through the shared analysis"
    b.dependency_overrides[who] = lambda: "override-b"
    assert cb.get("/who").json() == {"who": "override-b"} and ca.get("/who").json() == {"who": "override-a"}
    assert route_cache.STATS["hits"] > hits, "the second app reused the analysis of the first"


def test_a_different_include_context_is_a_different_analysis():
    plain, prefixed = TestClient(_app()), TestClient(_app(prefix="/p", dependencies=[Depends(tag)]))
    assert plain.get("/who").status_code == 200 and plain.get("/p/who").status_code == 404
    assert prefixed.get("/p/who").json() == {"who": "real"} and prefixed.get("/who").status_code == 404
    assert prefixed.post("/p/echo", json={"n": "x"}).status_code == 422
    assert prefixed.post("/p/echo", json={"n": 3}).json() == {"n": 3}


def test_a_value_that_cannot_be_a_key_is_never_cached():
    assert route_cache._freeze({"a": [1, (2, "x")]}) == route_cache._freeze({"a": [1, (2, "x")]})
    assert route_cache._freeze([{1, 2}]) is not route_cache._NOKEY
    assert route_cache._freeze([bytearray(b"x")]) is route_cache._NOKEY  # unhashable: the real path runs


# values that differ between ANY two fresh apps, cache or not (new ids, the bootstrap user's binding, clock stamps)
PER_APP = {"id", "user_id", "created_at", "updated_at", "last_seen", "now", "server_time", "permissions_fingerprint",
           "correlation_id"}


def _scrub(data):
    if isinstance(data, dict):
        return {k: _scrub(v) for k, v in data.items() if k not in PER_APP}
    if isinstance(data, list):
        return [_scrub(v) for v in data]
    return data


def _sample(client: TestClient) -> list:
    out = []
    for method, path, body in (("GET", "/api/v1/me", None), ("GET", "/api/v1/settings", None), ("GET", "/api/v1/__no_such_route__", None),
                               ("POST", "/api/v1/sites", {"name": 5}), ("GET", "/healthz", None)):
        r = client.request(method, path, json=body)
        data = r.json() if r.headers.get("content-type", "").startswith("application/json") else r.text
        out.append((method, path, r.status_code, r.headers.get("content-type"), _scrub(data)))
    return out


def test_the_product_app_answers_the_same_with_and_without_the_cache(settings, tmp_path):
    cached = TestClient(create_app(settings))
    route_cache.uninstall()
    try:
        assert not route_cache.installed()
        plain = TestClient(create_app(dataclasses.replace(settings, data_dir=tmp_path / "data_plain")))
        plain_sample, plain_openapi = _sample(plain), plain.app.openapi()
    finally:
        route_cache.install()
    assert route_cache.installed()
    assert _sample(cached) == plain_sample
    assert cached.app.openapi() == plain_openapi
