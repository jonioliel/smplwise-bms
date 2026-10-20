"""SECFIX2-295 / PUB-07 (security review of the public surfaces, 2026-10-20): the local-identity and passkey PUBLIC routes run their guard
(`routers/local_identity._public_guard`: remote channel only, the feature switch, https behind the tunnel, login CSRF) BEFORE FastAPI
reads or validates the request body.

Before: the Pydantic body parameter was decoded and validated before the handler (and so the guard) ran, so on the LOCAL channel - where
these routes must read as 404 - a malformed body answered the 422 validation envelope: a peer on the hassio network learned the route
exists. Now the routes are served by `guarded_route.guarded(_public_guard)` (an APIRoute subclass whose handler runs the guard first),
so every refusal of the guard is the same answer whatever the body is; with the guard passed, a malformed body is the same 422 as before
(the contract of the remote channel is unchanged). Fakes only: no Home Assistant, no device."""
from __future__ import annotations

import json

import pytest
from fastapi.routing import APIRoute
from test_local_identity import Lx, ORIGIN  # noqa: F401 - the USR2 test app

from smplwise.routers import local_identity as li_router
from smplwise.routers import local_passkeys as lpk_router
from smplwise.services import ha_user_auth as hua

PUBLIC = (
    "/auth/local/sign-in",
    "/auth/local/sign-in/second-factor",
    "/auth/local/set-password",
    "/auth/local/reset/request",
    "/auth/local/reset/confirm",
    "/auth/local/sign-in/passkey/options",
    "/auth/local/sign-in/passkey",
    "/auth/local/passkey/options",
    "/auth/local/passkey",
)
WITH_BODY = tuple(p for p in PUBLIC if not p.endswith("/options"))
# bodies FastAPI's validation would refuse: not JSON, the wrong JSON type, an unknown key, a missing field, an oversized field
MALFORMED = (b"{not json", b"[]", b'"text"', b'{"unexpected": 1}', b"{}", b'{"username": "' + b"u" * 100 + b'", "password": "p"}')


@pytest.fixture()
def lx(settings, tmp_path, monkeypatch):
    a = Lx(settings, tmp_path, monkeypatch)
    yield a
    hua.reset_for_tests()


def _strip(r) -> tuple[int, str]:
    """(status, the body without its correlation id as canonical JSON) - hashable, byte-comparable."""
    d = r.json()
    d.pop("correlation_id", None)
    return r.status_code, json.dumps(d, sort_keys=True)


def _post(client, path: str, raw: bytes, **headers):
    return client.post(path, content=raw, headers={"content-type": "application/json", **headers})


# ---------------------------------------------------------------- the inventory: every public route is guarded first


def _routes(router) -> dict[str, APIRoute]:
    return {r.path: r for r in router.routes if isinstance(r, APIRoute)}


def test_every_public_local_identity_route_is_a_guard_first_route():
    routes = {**_routes(li_router.router), **_routes(lpk_router.router)}
    missing = [p for p in PUBLIC if p not in routes]
    assert missing == [], f"a public route moved: {missing}"
    plain = [p for p in PUBLIC if getattr(type(routes[p]), "guard", None) is not li_router._public_guard]
    assert plain == [], f"public routes whose body is parsed before the guard: {plain}"


def test_no_route_under_auth_local_outside_the_list_is_left_unguarded():
    """A NEW public route under /auth/local/ must join PUBLIC (and so the guard-first class): the self routes are authenticated
    (`current_principal`) and live elsewhere (`/auth/local/password` is the one authenticated route under this prefix)."""
    routes = {**_routes(li_router.router), **_routes(lpk_router.router)}
    authenticated = {"/auth/local/password"}
    extra = sorted(p for p in routes if p.startswith("/auth/local/") and p not in PUBLIC and p not in authenticated)
    assert extra == [], f"classify these routes (public -> PUBLIC + guarded; authenticated -> the set above): {extra}"


# ---------------------------------------------------------------- the local channel: always the 404, whatever the body


@pytest.mark.parametrize("path", PUBLIC)
def test_on_the_local_channel_every_body_is_the_same_404(lx, path):
    lx.enable()
    answers = {_strip(_post(lx.admin, "/api/v1" + path, raw, **ORIGIN)) for raw in MALFORMED}
    # a well-formed body for the route (the answer before this change too)
    answers.add(_strip(lx.admin.post("/api/v1" + path, json={"username": "a", "password": "b"} if "sign-in" == path.rsplit("/", 1)[-1] else {}, headers=ORIGIN)))
    statuses = {a[0] for a in answers}
    assert statuses == {404}, (path, answers)
    assert len({repr(a) for a in answers}) == 1, ("one byte-identical answer (correlation id aside)", path, answers)


def test_the_local_channel_404_is_the_guards_not_found_never_the_validation_envelope(lx):
    lx.enable()
    guarded = _strip(_post(lx.admin, "/api/v1/auth/local/sign-in", b"{not json", **ORIGIN))
    assert guarded[0] == 404 and json.loads(guarded[1])["code"] == "not_found", guarded
    assert "validation" not in guarded[1] and "msg" not in guarded[1], "no pydantic text reaches the answer"


# ---------------------------------------------------------------- the remote channel: the guard's refusals beat the body too


@pytest.mark.parametrize("path", WITH_BODY)
def test_feature_off_a_malformed_body_is_the_switch_refusal_not_a_422(lx, path):
    c = lx.remote()
    for raw in MALFORMED:
        r = _post(c, "/arx/api/v1" + path, raw)
        assert r.status_code == 403 and r.json()["code"] == "local_identity_off", (path, raw, r.text)


@pytest.mark.parametrize("path", WITH_BODY)
def test_without_the_same_origin_proof_a_malformed_body_is_the_csrf_refusal(lx, path):
    lx.enable()
    from fastapi.testclient import TestClient

    bare = TestClient(lx.app)
    for raw in MALFORMED:
        r = _post(bare, "/arx/api/v1" + path, raw, Origin="https://evil.example")
        assert r.status_code == 403 and r.json()["code"] == "csrf_refused", (path, raw, r.text)


@pytest.mark.parametrize("path", WITH_BODY)
def test_with_the_guard_passed_a_malformed_body_is_still_the_validation_422(lx, path):
    """The remote channel's contract is unchanged: the sign-in page still learns a malformed body is malformed."""
    lx.enable()
    c = lx.remote()
    r = _post(c, "/arx/api/v1" + path, b'{"unexpected": 1}')
    assert r.status_code == 422, (path, r.text)
    assert r.json()["code"] in ("validation", "validation_error"), r.text


def test_the_sign_in_still_works_end_to_end_through_the_guard_first_route(lx):
    lx.enable()
    _created, c = lx.ready("maria")
    assert c.get("/arx/api/v1/me").json()["user"]["source"] == "local"
    assert lx.sign_in(lx.remote(), "maria", "not the password").status_code == 401


def test_the_guard_runs_once_per_request(lx, monkeypatch):
    """The route class runs the guard; the handlers do not run it a second time (one switch read per request)."""
    lx.enable()
    calls: list[str] = []
    real = li_router._public_guard

    def counting(request):
        calls.append(request.url.path)
        return real(request)

    for router_mod in (li_router, lpk_router):
        for route in router_mod.router.routes:
            if isinstance(route, APIRoute) and getattr(type(route), "guard", None) is real:
                monkeypatch.setattr(type(route), "guard", staticmethod(counting))
    lx.sign_in(lx.remote(), "nobody", "x")
    assert len(calls) == 1, calls
