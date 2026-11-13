"""CR-BE-GATES-2436 (review finding 05:P1-09): the local (Ingress) channel's authentication inventory is pinned.

`tests/test_remote_access.py::test_every_route_needs_a_remote_session` sweeps the remote `/arx` channel. This is the same sweep for the
local channel: every HTTP route-method of the real app is called from an UNTRUSTED peer (the test client is not one of the trusted proxy
addresses, and the developer identity is off) carrying spoofed Ingress identity headers. Every one must answer 401, except the routes in
`PUBLIC_ON_LOCAL`: the by-design public set of review 05 section 2.2 (watchdog, sign-in brand, stamped images, signed bridge calls,
single-use action tokens, and the guard-first / remote-only / token-in-path routes that answer the uniform 404 while their feature is
off). A new route that forgets its identity dependency, or a public route that starts answering 401, fails here; a deliberate change
edits this set in the same commit.

Test only: no source file is touched, and nothing here sends a request with a valid identity.
"""
from __future__ import annotations

import dataclasses

import pytest
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient

from smplwise.main import create_app

SPOOFED = {
    "X-Remote-User-Id": "u-owner",
    "X-Remote-User-Name": "joni",
    "X-Remote-User-Display-Name": "Joni",
    "X-SW-Dev-User": "joni",
}

# (method, path template) -> the status an untrusted, unauthenticated caller gets today (review 05 section 2.2)
PUBLIC_ON_LOCAL: dict[tuple[str, str], int] = {
    # watchdog and the sign-in card
    ("GET", "/healthz"): 200,
    ("GET", "/api/v1/brand/public"): 200,
    # immutable stamped images (404 unless the stamp matches)
    ("GET", "/api/v1/brand/company-logo/{variant}/{filename}"): 404,
    ("GET", "/api/v1/brand/white-label/logo/{variant}/{filename}"): 404,
    # HMAC-signed bridge calls and the single-use notification action token (422 without a body)
    ("POST", "/api/v1/ha/bridge/ping"): 422,
    ("POST", "/api/v1/ha/bridge/directory"): 422,
    ("POST", "/api/v1/notifications/action"): 422,
    # guard-first app routes, off by default (app_refresh.py)
    ("POST", "/api/v1/auth/app/refresh"): 404,
    ("POST", "/api/v1/auth/app/refresh-challenge"): 404,
    ("POST", "/api/v1/auth/app/sign-out"): 404,
    ("POST", "/api/v1/auth/app/session"): 404,
    ("GET", "/api/v1/auth/app/whoami"): 404,
    ("GET", "/api/v1/auth/app/session/redeem"): 404,
    # remote channel only (remote.py)
    ("GET", "/api/v1/auth/remote-config"): 404,
    ("GET", "/api/v1/auth/app-download"): 404,
    ("GET", "/api/v1/auth/app-download/file"): 404,
    ("POST", "/api/v1/auth/session"): 404,
    ("DELETE", "/api/v1/auth/session"): 404,
    ("POST", "/api/v1/csp-report"): 404,
    # Arx-only sign-in, guard-first, off by default (local_identity.py, local_passkeys.py)
    ("POST", "/api/v1/auth/local/sign-in"): 404,
    ("POST", "/api/v1/auth/local/sign-in/second-factor"): 404,
    ("POST", "/api/v1/auth/local/sign-in/passkey/options"): 404,
    ("POST", "/api/v1/auth/local/sign-in/passkey"): 404,
    ("POST", "/api/v1/auth/local/set-password"): 404,
    ("POST", "/api/v1/auth/local/reset/request"): 404,
    ("POST", "/api/v1/auth/local/reset/confirm"): 404,
    ("POST", "/api/v1/auth/local/passkey/options"): 404,
    ("POST", "/api/v1/auth/local/passkey"): 404,
    ("GET", "/.well-known/assetlinks.json"): 404,
    # notice boards: the board token is in the path (notices.py)
    ("GET", "/api/v1/notices/display/{slug}"): 404,
    ("GET", "/api/v1/notices/display/{slug}/logo/company"): 404,
    ("GET", "/api/v1/notices/display/{slug}/news-logo/{source_id}"): 404,
    ("GET", "/api/v1/notices/display/{slug}/photo"): 404,
    ("GET", "/api/v1/notices/display/{slug}/photo-night"): 404,
    ("GET", "/api/v1/notices/display/{slug}/slide/{slide_id}"): 404,
    ("GET", "/api/v1/notices/display/{slug}/transit"): 404,
    ("GET", "/b/{slug}"): 404,
    # calendar feed: feed token in the path, rate limited (calendar_feeds.py)
    ("GET", "/api/v1/calendar/feed/{name}"): 404,
}


def test_the_public_set_is_the_reviewed_38():
    assert len(PUBLIC_ON_LOCAL) == 38


def _sweep_client(settings, tmp_path) -> TestClient:
    s = dataclasses.replace(settings, dev_user=None, in_addon=False)
    return TestClient(create_app(s))


def _concrete(path: str) -> str:
    return "/".join("x" if seg.startswith("{") else seg for seg in path.split("/"))


def http_routes(app) -> list[tuple[str, str]]:
    """Every (method, full path template) of the app's HTTP routes, HEAD twins left out. FastAPI 0.141 keeps an included router as one
    lazy `_IncludedRouter` entry in `app.routes`; `iter_route_contexts` walks those with their effective (prefixed) paths."""
    try:
        from fastapi.routing import iter_route_contexts
    except ImportError:  # an older FastAPI lists the routes flat
        contexts = [(r, getattr(r, "path", None), getattr(r, "methods", None)) for r in app.router.routes]
    else:
        contexts = [(c.original_route, c.path, c.methods) for c in iter_route_contexts(app.router.routes)]
    out = set()
    for original, path, methods in contexts:
        if isinstance(original, APIRoute) and path:
            for method in set(methods or ()) - {"HEAD"}:
                out.add((method, path))
    return sorted(out)


@pytest.fixture()
def sweep(settings, tmp_path):
    return _sweep_client(settings, tmp_path)


def test_the_sweep_sees_the_whole_app(sweep):
    assert len(http_routes(sweep.app)) > 1500  # 1,895 route-methods on 2026-11-13 (review 05 section 2.2)


def test_every_local_route_needs_an_identity(sweep):
    leaks, public_seen = [], {}
    for method, path in http_routes(sweep.app):
        r = sweep.request(method, _concrete(path), headers=SPOOFED)
        if (method, path) in PUBLIC_ON_LOCAL:
            public_seen[(method, path)] = r.status_code
        elif r.status_code != 401:
            leaks.append((method, path, r.status_code))
    assert leaks == [], "routes that do not answer 401 to an untrusted caller:\n" + "\n".join(f"LEAK {m} {p} {c}" for m, p, c in leaks)
    assert public_seen == PUBLIC_ON_LOCAL
