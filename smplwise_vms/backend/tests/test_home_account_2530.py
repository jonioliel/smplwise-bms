"""HOME-T120-REST-2530 (task T120): a home-only person manages their OWN account from the home interface ("החשבון שלי": security, my
sign-ins, language). No server change was needed - the home-only gate already lets the person's own /auth/* and /me/* routes through
(services/home_interface.HOME_ALLOWED_PREFIXES) - so this file pins that behaviour: the own-account routes the sheet calls are never refused
by the home gate, the administrator's account routes stay refused (by the gate, or by the route's own permission), and the gate grants
nothing (a home-only operator gets the same answer an operator gets)."""
from __future__ import annotations

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.services import home_interface as hi

# what the home sheet calls: sw-account-security (authenticator, recovery codes, passkeys, phone keys, tokens), sw-remote-sessions
# (scope=own), sw-lang-prefs (GET / PUT /me/prefs)
OWN_READS = ["/api/v1/auth/second-factor", "/api/v1/auth/recovery-codes", "/api/v1/auth/passkeys", "/api/v1/auth/device-keys", "/api/v1/auth/tokens",
             "/api/v1/auth/sessions?scope=own", "/api/v1/auth/step-up", "/api/v1/me/prefs"]
# the administrator's account pages (user management): outside the home interface
ADMIN_OUTSIDE = ["/api/v1/security/user-factors/dev-joni", "/api/v1/identity/local-users/dev-joni/passkeys", "/api/v1/security/factor-policy", "/api/v1/identity/users"]


@pytest.fixture()
def app(settings):
    hi.reset_state_for_tests()
    from smplwise.main import create_app

    a = create_app(settings)
    yield a, settings
    hi.reset_state_for_tests()


def _client(app) -> TestClient:
    c = TestClient(app[0])
    assert c.get("/api/v1/me").status_code == 200  # joni: the bootstrap system administrator
    return c


def _home_only(c: TestClient, app, user: str) -> None:
    bind(c, app[1], user, "operator", "installation", "*")
    r = c.put(f"/api/v1/home/policies/dev-{user}", json={"home_only": True})
    assert r.status_code == 200 and r.json()["home_only"] is True


def _not_gate(res) -> bool:
    return not (res.status_code == 403 and res.json().get("code") in ("home_interface_only", "home_module_off"))


def test_the_gate_lets_the_own_account_routes_through():
    for path in OWN_READS:
        assert hi.home_allowed(path.split("?")[0]), path
    for path in ADMIN_OUTSIDE:
        assert not hi.home_allowed(path), path


def test_home_only_person_reaches_their_own_account(app):
    c = _client(app)
    bind(c, app[1], "ron", "operator", "installation", "*")  # the same role, full interface: the reference answers
    _home_only(c, app, "dana")
    for path in OWN_READS:
        ref = c.get(path, headers=as_user("ron"))
        res = c.get(path, headers=as_user("dana"))
        assert _not_gate(res), (path, res.json())
        assert res.status_code == ref.status_code, (path, res.status_code, ref.status_code)  # the gate neither refuses nor grants
    # the language choice is saved (sw-lang-prefs: PUT /me/prefs {"ui.lang"})
    res = c.put("/api/v1/me/prefs", headers=as_user("dana"), json={"ui.lang": "en"})
    assert res.status_code == 200 and res.json()["prefs"]["ui.lang"] == "en"
    # the authenticator enrolment starts (the route's own rules decide; the home gate does not stand in the way)
    res = c.post("/api/v1/auth/second-factor/enroll", headers=as_user("dana"), json={})
    ref = c.post("/api/v1/auth/second-factor/enroll", headers=as_user("ron"), json={})
    assert _not_gate(res) and res.status_code == ref.status_code, (res.status_code, ref.status_code)


def test_home_only_person_never_reaches_the_administrators_account_pages(app):
    c = _client(app)
    _home_only(c, app, "dana")
    for path in ADMIN_OUTSIDE:
        res = c.get(path, headers=as_user("dana"))
        assert res.status_code == 403 and res.json()["code"] == "home_interface_only", path
    # inside the allowed /auth/ prefix the administrator's lists answer the route's own refusal (an operator has no such permission)
    for path in ("/api/v1/auth/second-factor/users", "/api/v1/auth/second-factor/overrides"):
        res = c.get(path, headers=as_user("dana"))
        assert res.status_code == 403, (path, res.status_code)
        assert res.json()["code"] != "home_interface_only", path
