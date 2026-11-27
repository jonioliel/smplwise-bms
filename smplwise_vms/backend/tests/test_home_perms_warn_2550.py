"""HOME-PERMS-WARN-2550 (LOWS-BACKEND-2550 finding D-11, question 3 = a): the administrator's home-interface page warns when a person's
electricity bill / electricity / water category shows the whole site's data (there is no person -> billing customer binding yet).

The server half is a display hint on `GET /home/policies`, additive only:
* each person's `site_wide` - the categories whose permission the person holds installation-wide (bills = energy.bills, energy =
  energy.view, water = water.view; a floor-scoped water.view is NOT site-wide; a system administrator is never listed);
* `shared_scope` - the site's billing customers (not deleted), active electricity accounts, and electricity / water meters (not retired).
Nothing about what anybody may read changes."""
from __future__ import annotations

import sqlite3
from dataclasses import replace

import pytest
from conftest import as_user, bind, seed_tree
from fastapi.testclient import TestClient

from smplwise.services import home_interface as hi


@pytest.fixture()
def client(settings):
    hi.reset_state_for_tests()
    from smplwise.main import create_app

    a = create_app(replace(settings))
    c = TestClient(a)
    assert c.get("/api/v1/me").status_code == 200  # joni: the bootstrap system administrator
    yield c, a, settings
    hi.reset_state_for_tests()


def _row(c: TestClient, user: str) -> dict:
    return next(u for u in c.get("/api/v1/home/policies").json()["users"] if u["user_id"] == f"dev-{user}")


def test_site_wide_lists_the_installation_wide_reads_only(client):
    c, _a, s = client
    ids = seed_tree(c)
    bind(c, s, "dana", "operator", "installation", "*")  # energy.view + water.view, no energy.bills
    bind(c, s, "rina", "site_admin", "installation", "*")  # energy.bills too
    bind(c, s, "flo", "operator", "floor", ids["floor2"])  # floor-scoped: sees only her floor's water meters, no electricity
    bind(c, s, "vik", "viewer", "installation", "*")  # none of the three
    for u in ("dana", "rina", "flo", "vik"):
        assert c.get("/api/v1/me", headers=as_user(u)).status_code == 200
    assert _row(c, "dana")["site_wide"] == ["energy", "water"]
    assert _row(c, "rina")["site_wide"] == ["bills", "energy", "water"]
    assert _row(c, "flo")["site_wide"] == []
    assert _row(c, "vik")["site_wide"] == []
    assert _row(c, "joni")["site_wide"] == []  # a system administrator reads everything anyway: no warning for him


def test_shared_scope_counts_customers_accounts_and_meters(client):
    c, a, _s = client
    scope = c.get("/api/v1/home/policies").json()["shared_scope"]
    assert scope == {"customers": 0, "bill_accounts": 0, "energy_meters": 0, "water_meters": 0}
    with a.state.db.connection(mode="write") as conn:
        for cid, num, deleted in (("cu-1", "0001", None), ("cu-2", "0002", None), ("cu-3", "0003", "2026-11-01T00:00:00Z")):
            conn.execute("INSERT INTO energy_customers (id, customer_number, name, created_at, updated_at, deleted_at) VALUES (?, ?, 'x', "
                         "'2026-11-01T00:00:00Z', '2026-11-01T00:00:00Z', ?)", (cid, num, deleted))
    scope = c.get("/api/v1/home/policies").json()["shared_scope"]
    assert scope["customers"] == 2  # the deleted customer is not counted
    assert scope["bill_accounts"] == 0


def test_shared_scope_unknown_stays_null_without_the_tables():
    """An older database without the billing / meter tables: every count is unknown (null), never a made-up 0."""
    conn = sqlite3.connect(":memory:")
    try:
        assert hi.shared_scope(conn) == {"customers": None, "bill_accounts": None, "energy_meters": None, "water_meters": None}
    finally:
        conn.close()
