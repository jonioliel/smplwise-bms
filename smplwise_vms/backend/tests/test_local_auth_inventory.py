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
    # MFA-DEVICEKEY-2490: the phone key's sign-in challenge, remote channel only, guard-first (device_keys.py)
    ("POST", "/api/v1/auth/device-keys/sign-in/challenge"): 404,
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
    assert len(PUBLIC_ON_LOCAL) == 39  # 38 + MFA-DEVICEKEY-2490's remote-only sign-in challenge


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


# ---------------------------------------------------------------- CR-BRIDGE-PREVERIFY-2440 (review 05:P2-03): identity dependencies by name

def _full_identity() -> set:
    from smplwise import auth

    return {auth.current_principal, auth.current_principal_ro}


def _dependency_calls(dependant, out: list) -> list:
    for dep in dependant.dependencies:
        out.append(dep.call)
        _dependency_calls(dep, out)
    return out


def _name(call) -> str:
    return f"{getattr(call, '__module__', '?')}.{getattr(call, '__qualname__', repr(call))}"


def identity_outside_principal(app) -> dict[str, list[tuple[str, str]]]:
    """{dependency name: [(method, path template)]} for every HTTP route-method whose dependency tree never reaches
    `auth.current_principal` / `auth.current_principal_ro` - the routes that skip (or run by themselves) the cross-cutting steps of
    `auth.shared_steps`: the service-account refusal, the bootstrap grant, the required-sensors gate and the home-interface restriction.
    A route with no dependency at all is listed under `-`."""
    from fastapi.routing import iter_route_contexts

    full = _full_identity()
    out: dict[str, list[tuple[str, str]]] = {}
    for c in iter_route_contexts(app.router.routes):
        if not isinstance(c.original_route, APIRoute) or not c.path:
            continue
        calls = _dependency_calls(c.original_route.dependant, [])
        if any(call in full for call in calls):
            continue
        names = sorted({_name(call) for call in calls}) or ["-"]
        for method in sorted(set(c.methods or ()) - {"HEAD"}):
            for n in names:
                out.setdefault(n, []).append((method, c.path))
    return out


# Dependencies that resolve (or stand in for) an identity without `auth._principal`. A route reaching none of
# current_principal / current_principal_ro must reach only these - a new name here is a deliberate decision about the shared steps.
OUTSIDE_PRINCIPAL = {
    # the identity alone; the handler runs auth.shared_steps(light=True) on its own connection (routers/building_presence.py)
    "smplwise.auth.principal_light",
    # the phone app's device token / session callers: no shared step runs (routers/presence.py; left for the closing chain)
    "smplwise.routers.presence.session_caller", "smplwise.routers.presence.any_caller", "smplwise.routers.presence.device_caller",
    # the single-use notification action token; on the remote channel also a live session (routers/notifications.py)
    "smplwise.routers.notifications._remote_gate",
    # the calendar feed's own token-free connection (routers/calendar_feeds.py)
    "smplwise.routers.calendar_feeds.feed_conn",
    # the HMAC-signed bridge calls: screened on a read connection, then the write connection (routers/ha.py, auth.conn_after)
    "smplwise.auth.conn_after.<locals>.conn", "smplwise.auth.remote_first",
    "smplwise.routers.ha._ping_screened", "smplwise.routers.ha._directory_screened",
}
# Routes with no dependency at all that are not in PUBLIC_ON_LOCAL: they resolve the identity inside the handler (routers/remote.py:
# the remote channel's own session list, 401 on the local channel).
IN_HANDLER: set[tuple[str, str]] = {
    ("GET", "/api/v1/auth/sessions"), ("DELETE", "/api/v1/auth/sessions"), ("DELETE", "/api/v1/auth/sessions/{session_id}"),
    # MFA-TOKENS-2490 (found by MFA-SECFIX-2500's runner job): the own token list resolves the identity first inside its async handler
    # (routers/access_tokens.list_tokens -> _who, 401 for an anonymous caller) so it can read HA's list with the caller's own token
    ("GET", "/api/v1/auth/tokens"),
}


def test_identity_dependencies_outside_principal_are_listed(sweep):
    seen = identity_outside_principal(sweep.app)
    bare = set(seen.pop("-", [])) - set(PUBLIC_ON_LOCAL)
    assert set(seen) == OUTSIDE_PRINCIPAL, sorted(set(seen) ^ OUTSIDE_PRINCIPAL)
    assert bare == IN_HANDLER, sorted(bare ^ IN_HANDLER)
    assert len(seen["smplwise.auth.principal_light"]) == 8  # routers/building_presence.py, all of it
