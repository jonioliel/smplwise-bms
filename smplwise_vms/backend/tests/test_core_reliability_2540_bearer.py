"""CORE-RELIABILITY-2540, deep review SEC-5: the re-validation of a bearer session (an API client or integration that sends its
HA token on every request) was billed to the SIGN-IN rate limit of its address (10 a minute, 50 an hour). A busy client spent one
hit a minute, was dropped with 429 after about 50 minutes, and every browser sign-in from the same address was refused meanwhile;
while HA was away, every request was a failed (and billed) validation and the client got 503.

Now: the sign-in limit counts only tokens Arx does not know yet; an existing session's re-validation is bounded by its own cache;
while HA cannot be asked, the existing session is served and re-checked after the back-off (the cookie path's rule); a session is
never dropped for a rate limit. A NEW token is still limited exactly as before."""
# the shared fixture imported from its module is the test functions' argument (pytest injects it):
# ruff: noqa: F811
from __future__ import annotations

from fastapi.testclient import TestClient
from test_remote_access import arx  # noqa: F401 - the shared fixture (a remote-enabled app and a fake HA core)

from smplwise.services import ha_user_auth as hua


def _age(token: str) -> hua.RemoteSession:
    """The background pass is not running: let the session's last validation fall out of the bearer cache."""
    s = hua.STORE.get_bearer(hua.token_hash(token))
    assert s is not None
    s.last_validated -= hua.BEARER_CACHE_S + 1
    return s


def test_sec5_a_busy_token_client_is_not_billed_to_the_sign_in_limit(arx, monkeypatch):
    monkeypatch.setattr(hua, "IP_LIMITS", [(3600.0, 3)])
    monkeypatch.setattr(hua, "USER_LIMITS", [(3600.0, 3)])
    arx.flag("u-viewer")
    arx.bind("u-viewer", "viewer")
    arx.flag("u-owner")
    token = arx.token(arx.viewer)
    api = TestClient(arx.app)
    auth = {"Authorization": f"Bearer {token}"}
    assert api.get("/arx/api/v1/me", headers=auth).status_code == 200  # the first sign-in of this token: one hit
    dials = len(arx.core.dials)
    codes = []
    for _ in range(6):  # six re-validations, one per cache window
        _age(token)
        codes.append(api.get("/arx/api/v1/me", headers=auth).status_code)
    # before the fix: [200, 200, 429, ...] - and the session was dropped
    assert codes == [200] * 6, codes
    assert len(arx.core.dials) > dials, "the re-validations still ask HA (the token is still checked)"
    assert hua.STORE.get_bearer(hua.token_hash(token)) is not None
    # the address can still sign a browser in (the exchange uses the same address budget)
    assert arx.login(arx.owner).status_code == 200


def test_sec5_new_tokens_are_still_limited_per_address(arx, monkeypatch):
    monkeypatch.setattr(hua, "IP_LIMITS", [(3600.0, 2)])
    arx.flag("u-viewer")
    api = TestClient(arx.app)
    codes = [api.get("/arx/api/v1/me", headers={"Authorization": f"Bearer {arx.token(arx.viewer)}"}).status_code for _ in range(3)]
    assert codes == [200, 200, 429]
    assert arx.audit("auth.remote_session.rejected")[-1]["reason"] == "rate_limited_ip"


def test_sec5_an_ha_outage_serves_the_existing_session_and_backs_off(arx, monkeypatch):
    monkeypatch.setattr(hua, "IP_LIMITS", [(3600.0, 2)])
    arx.flag("u-viewer")
    arx.bind("u-viewer", "viewer")
    token = arx.token(arx.viewer)
    api = TestClient(arx.app)
    auth = {"Authorization": f"Bearer {token}"}
    assert api.get("/arx/api/v1/me", headers=auth).status_code == 200
    asked = {"n": 0}

    async def ha_away(*_a, **_kw):
        asked["n"] += 1
        raise hua.HaUnavailable("restart")

    monkeypatch.setattr(hua, "validate_token", ha_away)
    s = _age(token)
    r = api.get("/arx/api/v1/me", headers=auth)
    # before the fix: 503 ha_unavailable on every request, each one billed to the address
    assert r.status_code == 200 and r.json()["user"]["id"] == "u-viewer", r.text
    assert asked["n"] == 1 and s.recheck_after > 0
    for _ in range(5):  # within the back-off: served without asking HA again
        _age(token)
        assert api.get("/arx/api/v1/me", headers=auth).status_code == 200
    assert asked["n"] == 1
    s.recheck_after = 0  # the back-off is over and HA is still away: asked once more, served once more
    assert api.get("/arx/api/v1/me", headers=auth).status_code == 200 and asked["n"] == 2
    # a NEW token during the outage still gets the honest 503 (nothing to serve)
    fresh = api.get("/arx/api/v1/me", headers={"Authorization": f"Bearer {arx.token(arx.viewer)}"})
    assert fresh.status_code == 503 and fresh.json()["code"] == "ha_unavailable"


def test_sec5_a_revoked_or_refused_session_is_still_ended(arx, monkeypatch):
    arx.flag("u-viewer")
    arx.bind("u-viewer", "viewer")
    token = arx.token(arx.viewer)
    api = TestClient(arx.app)
    auth = {"Authorization": f"Bearer {token}"}
    assert api.get("/arx/api/v1/me", headers=auth).status_code == 200
    arx.flag("u-viewer", on=False)  # the remote-access flag removed: the next re-validation refuses and ends the session
    _age(token)
    r = api.get("/arx/api/v1/me", headers=auth)
    assert r.status_code == 403 and r.json()["code"] == "remote_not_allowed"
    assert hua.STORE.get_bearer(hua.token_hash(token)) is None
