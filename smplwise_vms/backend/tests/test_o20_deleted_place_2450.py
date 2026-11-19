"""CR-BE-COMPLEXITY-2450 - owner decision O20 a (code review 02:P3-4): a permission given on a site, building or floor that was later
deleted does NOT apply to the place's floors / children. Tested both ways: the same binding grants while the place is live and
grants nothing once it (or a parent) is deleted.

`rbac` got the rule in CR-RBAC-EVAL-2438 (tests/test_rbac_eval_2438.py). The scope-chain code that still disagreed with it was the
notice audience's own copy (services/notices/audience): a floor whose SITE was deleted was still reached through the site and the
building, and an allow bound on a deleted place still counted for a role audience and the read-receipt place line. This file pins
the whole matrix on the rbac side and the audience side, so the two can never drift apart again."""
from __future__ import annotations

import pytest
from conftest import bind, seed_tree

from smplwise.db import Database, now_iso
from smplwise.rbac import Principal, authorize, dead_places, scope_chain
from smplwise.services.notices import audience


def _p(user: str) -> Principal:
    return Principal(user_id=f"dev-{user}", username=user, display_name=user, source="dev")


def _soft_delete(settings, table: str, row_id: str) -> None:
    """Straight to the row (the catalogue routes refuse to delete a parent with live children; a restored archive or a hand edit
    can still leave one - the rule must not depend on the route's order)."""
    with Database(settings.db_path).connection() as conn:
        conn.execute(f"UPDATE {table} SET deleted_at = ? WHERE id = ?", (now_iso(), row_id))


def _read(settings):
    return Database(settings.db_path).connection(mode="read")


SCOPES = ("site", "building", "floor2")  # the place a user's viewer binding is on
TARGET = "floor2"  # the floor every decision below is asked about


def _users(client, settings, ids) -> dict[str, str]:
    """One viewer per place, plus one at the installation (never dead: the control of the matrix)."""
    users = {}
    for scope in SCOPES:
        user = f"o20-{scope}"
        bind(client, settings, user, "viewer", "floor" if scope.startswith("floor") else scope, ids[scope])
        users[scope] = user
    bind(client, settings, "o20-inst", "viewer", "installation", "*")
    users["installation"] = "o20-inst"
    return users


# the deleted place -> which bindings still reach floor2 afterwards in rbac. The installation is never dead. A deleted floor keeps
# its live parents: O20 is about a permission on the DELETED place (the floor's own binding dies); whether a live building's
# permission should still cover a deleted floor is not part of O20 (rbac keeps it, as on origin - recorded as an open question;
# the notice audience reaches no one through a dead floor, as it already did for a floor of a deleted building)
MATRIX = [
    ("sites", "site", {"installation"}),
    ("buildings", "building", {"installation"}),
    ("floors", "floor2", {"installation", "site", "building"}),
]


@pytest.mark.parametrize("table,deleted,still", MATRIX, ids=[m[1] for m in MATRIX])
def test_rbac_both_ways(client, settings, table, deleted, still):
    ids = seed_tree(client)
    users = _users(client, settings, ids)
    target = ("floor", ids[TARGET])
    with _read(settings) as conn:
        for scope, user in users.items():
            assert authorize(conn, _p(user), "map.read", target).allowed, f"before: {scope} reaches the floor"
    _soft_delete(settings, table, ids[deleted])
    with _read(settings) as conn:
        for scope, user in users.items():
            d = authorize(conn, _p(user), "map.read", target)
            if scope in still:
                assert d.allowed, f"after deleting {deleted}: {scope} still reaches it"
            else:
                assert not d.allowed and d.reason == "no_binding", f"after deleting {deleted}: {scope} must not reach the floor"


def test_a_live_sibling_floor_keeps_its_grants(client, settings):
    """The other direction of the rule: deleting floor2 takes nothing from floor3 - the building and site above it are live."""
    ids = seed_tree(client)
    users = _users(client, settings, ids)
    _soft_delete(settings, "floors", ids["floor2"])
    with _read(settings) as conn:
        for scope in ("site", "building", "installation"):
            assert authorize(conn, _p(users[scope]), "map.read", ("floor", ids["floor3"])).allowed, scope
        assert not authorize(conn, _p(users["floor2"]), "map.read", ("floor", ids["floor3"])).allowed, "never had it"
        assert dead_places(conn, {("floor", ids["floor3"]), ("building", ids["building"]), ("site", ids["site"])}) == set()


def test_a_building_under_a_deleted_site_keeps_the_site_node_for_a_deny(client, settings):
    """The site stays in the chain (a deny bound on it still bites); an allow there is dead and grants nothing."""
    ids = seed_tree(client)
    _soft_delete(settings, "sites", ids["site"])
    with _read(settings) as conn:
        chain = scope_chain(conn, "floor", ids["floor2"])
    assert chain == [("floor", ids["floor2"]), ("building", ids["building"]), ("site", ids["site"]), ("installation", "*")]


# ---------------------------------------------------------------- the notice audience (services/notices/audience)

@pytest.mark.parametrize("table,deleted,still", MATRIX, ids=[m[1] for m in MATRIX])
def test_floor_audience_both_ways(client, settings, table, deleted, still):
    ids = seed_tree(client)
    users = _users(client, settings, ids)
    aud = {"floors": [ids[TARGET]]}
    with _read(settings) as conn:
        for scope, user in users.items():
            assert audience.in_audience(conn, f"dev-{user}", aud), f"before: {scope} is in the floor's audience"
    _soft_delete(settings, table, ids[deleted])
    with _read(settings) as conn:
        for scope, user in users.items():
            # a floor that is itself dead (deleted, or under a deleted parent) is reached by no one through it - not even from the
            # installation (CR-RBAC-EVAL-2438 already had that for a deleted building; a deleted site and a deleted floor agree now)
            assert not audience.in_audience(conn, f"dev-{user}", aud), f"after deleting {deleted}: {scope}"


def test_the_site_case_was_the_gap(client, settings):
    """Before this branch: a floor of a live building under a deleted site was still reached through the site's allow."""
    ids = seed_tree(client)
    bind(client, settings, "o20-sami", "viewer", "site", ids["site"])
    _soft_delete(settings, "sites", ids["site"])
    with _read(settings) as conn:
        assert audience._floor_chain(conn, ids["floor2"]) == set()
        assert not audience.in_audience(conn, "dev-o20-sami", {"floors": [ids["floor2"]]})
        assert audience._live_bindings(conn, "dev-o20-sami") == []


def test_role_audience_both_ways(client, settings):
    """A role audience counts a binding of the role only while its place is live."""
    ids = seed_tree(client)
    bind(client, settings, "o20-role", "viewer", "building", ids["building"])
    aud = {"roles": ["viewer"]}
    with _read(settings) as conn:
        assert audience.in_audience(conn, "dev-o20-role", aud)
    _soft_delete(settings, "buildings", ids["building"])
    with _read(settings) as conn:
        assert not audience.in_audience(conn, "dev-o20-role", aud), "a role held only on a deleted building is not held"
    bind(client, settings, "o20-role", "viewer", "installation", "*")
    with _read(settings) as conn:
        assert audience.in_audience(conn, "dev-o20-role", aud), "a live binding of the role still counts"


def test_receipt_place_line_both_ways(client, settings):
    ids = seed_tree(client)
    bind(client, settings, "o20-fay", "viewer", "floor", ids["floor2"])
    with _read(settings) as conn:
        assert audience.places_of(conn, ["dev-o20-fay"]) == {"dev-o20-fay": "קומה 2"}
    _soft_delete(settings, "buildings", ids["building"])  # the floor row stays live: it is dead through its building
    with _read(settings) as conn:
        assert audience.places_of(conn, ["dev-o20-fay"]) == {"dev-o20-fay": ""}


def test_a_live_tree_is_untouched(client, settings):
    ids = seed_tree(client)
    users = _users(client, settings, ids)
    with _read(settings) as conn:
        for scope, user in users.items():
            assert audience.in_audience(conn, f"dev-{user}", {"floors": [ids["floor3"]]}) is (scope != "floor2"), scope
        assert len(audience._live_bindings(conn, f"dev-{users['site']}")) == 1
