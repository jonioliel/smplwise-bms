"""HOME-PERMS-WARN-2550 (owner Q1 = a, LOWS-BACKEND-2550 D-11 follow-up): a home-only person reaches the electricity bill's routes only
the way the home interface's bill screen does - the "bills" category on AND energy.bills.

Before: the routes were on the home allow-list with the billing module's own check (energy.view OR energy.manage OR energy.bills), so a
home-only operator (energy.view, no energy.bills) read every account - customer name and number, formula, last bill - by calling
`GET /energy/accounts` directly, and a hidden "bills" category stopped only the bill file. After: refused 403 `home_bills_permission` /
`home_module_off`, audited, with no account data in the answer. People who are not home-only and system administrators are not judged."""
from __future__ import annotations

from dataclasses import replace

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.services import home_interface as hi

T0 = "2026-11-01T00:00:00Z"
CUSTOMER_NAME = "משפחת כהן-בדיקה"
CUSTOMER_NUMBER = "0457"
ROUTES = ("/api/v1/energy/accounts", "/api/v1/energy/accounts/acc-1/status", "/api/v1/energy/accounts/acc-1/periods", "/api/v1/energy/bills/bill-1/pdf")
DATA_ROUTES = ROUTES[:3]


@pytest.fixture()
def client(settings):
    hi.reset_state_for_tests()
    from smplwise.main import create_app

    a = create_app(replace(settings))
    c = TestClient(a)
    assert c.get("/api/v1/me").status_code == 200  # joni: the bootstrap system administrator
    with a.state.db.connection(mode="write") as conn:
        conn.execute("INSERT INTO energy_customers (id, customer_number, name, created_at, updated_at) VALUES ('cu-1', ?, ?, ?, ?)", (CUSTOMER_NUMBER, CUSTOMER_NAME, T0, T0))
        conn.execute("INSERT INTO energy_tariffs (id, name, created_at, updated_at) VALUES ('tariff-1', 'כללי', ?, ?)", (T0, T0))
        conn.execute("INSERT INTO energy_accounts (id, name, customer_id, formula_json, tariff_id, period_months, period_anchor_day, first_period_start, timezone, "
                     "auto_mode, status, revision, created_at, updated_at) VALUES ('acc-1', 'דירה 4', 'cu-1', '{\"m\": \"mtr-1\"}', 'tariff-1', 1, 1, '2026-09-01', "
                     "'Asia/Jerusalem', 'off', 'active', 1, ?, ?)", (T0, T0))
    yield c, a, settings
    hi.reset_state_for_tests()


def _person(c: TestClient, s, user: str, role: str, **policy) -> None:
    bind(c, s, user, role, "installation", "*")
    assert c.get("/api/v1/me", headers=as_user(user)).status_code == 200
    if policy:
        assert c.put(f"/api/v1/home/policies/dev-{user}", json=policy).status_code == 200


def _refusals(a, user: str) -> list[str]:
    with a.state.db.connection(mode="read") as conn:
        return [r[0] for r in conn.execute("SELECT reason FROM audit_log WHERE action = 'home_interface.bills.refused' AND actor_user_id = ? ORDER BY rowid", (f"dev-{user}",)).fetchall()]


def test_home_only_viewer_without_bill_permission_is_refused_every_bill_route(client):
    """The finding: energy.view alone (the operator role) used to read every account through the home allow-list."""
    c, a, s = client
    _person(c, s, "dana", "operator", home_only=True)  # all categories on (no list): only the permission is missing
    for route in ROUTES:
        r = c.get(route, headers=as_user("dana"))
        assert r.status_code == 403, (route, r.status_code)
        assert r.json()["code"] == "home_bills_permission", route
        assert CUSTOMER_NAME not in r.text and CUSTOMER_NUMBER not in r.text
    assert _refusals(a, "dana") == ["home_bills_permission"]  # audited (once per person and reason per window, the gate's rule)


def test_home_only_bill_holder_with_the_category_hidden_is_refused(client):
    c, a, s = client
    _person(c, s, "rina", "site_admin", home_only=True, modules=["lights", "energy"])
    for route in ROUTES:
        r = c.get(route, headers=as_user("rina"))
        assert r.status_code == 403 and r.json()["code"] == "home_module_off", (route, r.status_code)
        assert CUSTOMER_NAME not in r.text
    assert _refusals(a, "rina") == ["home_module_off"]


def test_home_only_bill_holder_with_the_category_on_reads_as_before(client):
    c, _a, s = client
    _person(c, s, "rina", "site_admin", home_only=True)
    r = c.get("/api/v1/energy/accounts", headers=as_user("rina"))
    assert r.status_code == 200 and r.json()["items"][0]["customer"]["name"] == CUSTOMER_NAME
    for route in DATA_ROUTES[1:]:
        assert c.get(route, headers=as_user("rina")).status_code == 200, route


def test_full_interface_people_and_the_system_administrator_are_not_judged(client):
    c, a, s = client
    _person(c, s, "omer", "operator")  # not home-only: the billing module's own rule (energy.view reads accounts without money)
    r = c.get("/api/v1/energy/accounts", headers=as_user("omer"))
    assert r.status_code == 200 and r.json()["items"][0]["customer"]["name"] == CUSTOMER_NAME
    assert c.get("/api/v1/energy/accounts/acc-1/periods", headers=as_user("omer")).status_code == 200
    _person(c, s, "tal", "site_admin")
    assert c.get("/api/v1/energy/accounts", headers=as_user("tal")).status_code == 200
    assert c.get("/api/v1/energy/accounts").status_code == 200  # joni, system administrator
    assert _refusals(a, "omer") == [] and _refusals(a, "tal") == []


def test_bills_route_matches_only_the_bill_routes():
    for route in ROUTES:
        assert hi.bills_route(route), route
    for route in ("/api/v1/energy/meters", "/api/v1/energy/tariffs", "/api/v1/energy/accounts/acc-1", "/api/v1/energy/accounts/acc-1/status/x",
                  "/api/v1/energy/bills/bill-1", "/api/v1/energy/customers"):
        assert not hi.bills_route(route), route
