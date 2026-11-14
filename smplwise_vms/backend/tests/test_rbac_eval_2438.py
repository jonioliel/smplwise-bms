"""CR-RBAC-EVAL-2438 - two owner decisions (14.11.2026) on the RBAC evaluation.

1. Q-SEC-4 / O20 a (code review 02:P3-4): a permission granted on a building that was later deleted grants NOTHING - not on the
   building, not on its floors, areas or cameras, not in "permissions anywhere". The same for a deleted site or floor, for a place
   under a deleted parent, and for an orphaned scope row (a binding whose place row is gone). A DENY bound there still bites
   (fail closed), and a deleted building no longer sits under its site (scope_chain now agrees with station_chain).
2. Q-SEC-5 / O16 a (code review 01:F-05): one system-wide "active user" (services/active_users): disabled on either side
   (`users.active = 0` or `ha_users.is_active = 0`) is not active. The second-approver search of a supplier award uses it, and an
   organisation with ONE signer is never made to wait for a second one - neither when the award is made nor when the only other
   signer is disabled while an award waits for them.
"""
from __future__ import annotations

import pytest
from conftest import as_user, bind, seed_tree

from smplwise.db import Database, new_id, now_iso, permission_revision
from smplwise.rbac import (
    Principal,
    authorize,
    bindings_of,
    dead_places,
    effective_permissions,
    has_any_binding,
    permissions_anywhere,
    scope_chain,
)
from smplwise.services import active_users
from smplwise.services.access import camera_scope

from test_rbac_camera_scope import _anchor, _publish  # noqa: E402 - the same placement helpers the camera matrix uses
from test_tickets_rfq import _threshold, award, compare, kim, quote_row, quoted, s4, sent_rfq, vid  # noqa: F401 - s4 is a fixture
from tickets_s4_world import API


def _p(user: str) -> Principal:
    return Principal(user_id=f"dev-{user}", username=user, display_name=user, source="dev")


def _binding(settings, user: str, role: str, scope_type: str, scope_id: str, effect: str = "allow") -> None:
    with Database(settings.db_path).connection() as conn:
        conn.execute(
            "INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) "
            "VALUES (?, 'user', ?, ?, ?, ?, ?, ?, 'test', ?)",
            (new_id(), f"dev-{user}", role, scope_type, scope_id, effect, permission_revision(conn), now_iso()))


def _soft_delete(settings, table: str, row_id: str) -> None:
    """Straight to the row: the catalogue routes refuse to delete a building with live floors, but a restored archive or a hand
    edit can leave one - the evaluation must not depend on the route's order."""
    with Database(settings.db_path).connection() as conn:
        conn.execute(f"UPDATE {table} SET deleted_at = ? WHERE id = ?", (now_iso(), row_id))


def _read(settings):
    return Database(settings.db_path).connection(mode="read")


# ---------------------------------------------------------------- 1. a deleted place grants nothing

def test_building_grant_works_before_and_grants_nothing_after_the_building_is_deleted(client, settings):
    ids = seed_tree(client)
    bind(client, settings, "dana", "editor", "building", ids["building"])
    with _read(settings) as conn:
        assert authorize(conn, _p("dana"), "map.read", ("floor", ids["floor2"])).allowed
        assert authorize(conn, _p("dana"), "map.read", ("building", ids["building"])).allowed
        assert "map.read" in permissions_anywhere(conn, _p("dana"))
    _soft_delete(settings, "buildings", ids["building"])  # the floors are left live on purpose (the worst case)
    with _read(settings) as conn:
        for target in (("building", ids["building"]), ("floor", ids["floor2"]), ("floor", ids["floor3"])):
            d = authorize(conn, _p("dana"), "map.read", target)
            assert not d.allowed and d.reason == "no_binding", target
            assert effective_permissions(conn, _p("dana"), target) == [], target
        assert permissions_anywhere(conn, _p("dana")) == [], "a dead grant opens no navigation either"
        assert has_any_binding(conn, _p("dana")) is False
        assert bindings_of(conn, _p("dana")) == []
    me = client.get("/api/v1/me", headers=as_user("dana")).json()
    assert me["has_access"] is False and me["bindings"] == []
    r = client.get(f"/api/v1/floors/{ids['floor2']}/map", headers=as_user("dana"))
    assert r.status_code in (403, 404), r.text


def test_the_normal_route_order_floors_then_building_also_ends_the_grant(client, settings):
    ids = seed_tree(client)
    bind(client, settings, "dana", "editor", "building", ids["building"])
    for f in (ids["floor2"], ids["floor3"]):
        assert client.delete(f"/api/v1/floors/{f}").status_code == 204
    assert client.delete(f"/api/v1/buildings/{ids['building']}").status_code == 204
    with _read(settings) as conn:
        assert not authorize(conn, _p("dana"), "map.read", ("building", ids["building"])).allowed
        assert not authorize(conn, _p("dana"), "map.read", ("floor", ids["floor2"])).allowed
        assert permissions_anywhere(conn, _p("dana")) == []


def test_a_site_grant_no_longer_reaches_the_floors_of_a_deleted_building(client, settings):
    """scope_chain agrees with station_chain: a deleted building is cut from its site."""
    ids = seed_tree(client)
    bind(client, settings, "sami", "viewer", "site", ids["site"])
    with _read(settings) as conn:
        assert authorize(conn, _p("sami"), "map.read", ("floor", ids["floor2"])).allowed
    _soft_delete(settings, "buildings", ids["building"])
    with _read(settings) as conn:
        chain = scope_chain(conn, "floor", ids["floor2"])
        assert ("building", ids["building"]) in chain and ("site", ids["site"]) not in chain and chain[-1] == ("installation", "*")
        assert not authorize(conn, _p("sami"), "map.read", ("floor", ids["floor2"])).allowed
        assert authorize(conn, _p("sami"), "map.read", ("site", ids["site"])).allowed, "the live site itself is still theirs"


def test_a_deny_on_a_deleted_building_still_takes_access_away(client, settings):
    ids = seed_tree(client)
    bind(client, settings, "tal", "viewer", "installation", "*")
    _binding(settings, "tal", "viewer", "building", ids["building"], effect="deny")
    _soft_delete(settings, "buildings", ids["building"])
    with _read(settings) as conn:
        d = authorize(conn, _p("tal"), "map.read", ("floor", ids["floor2"]))
        assert not d.allowed and d.reason == "explicit_deny"
        assert authorize(conn, _p("tal"), "map.read", ("installation", "*")).allowed


def test_deleted_floor_and_deleted_site_grants_and_places_under_a_deleted_site(client, settings):
    ids = seed_tree(client)
    bind(client, settings, "fay", "viewer", "floor", ids["floor2"])
    bind(client, settings, "sid", "viewer", "site", ids["site"])
    bind(client, settings, "bob", "viewer", "building", ids["building"])
    _soft_delete(settings, "floors", ids["floor2"])
    _soft_delete(settings, "sites", ids["site"])  # the building under it stays live: an orphan below a deleted site
    with _read(settings) as conn:
        assert not authorize(conn, _p("fay"), "map.read", ("floor", ids["floor2"])).allowed
        assert permissions_anywhere(conn, _p("fay")) == []
        assert not authorize(conn, _p("sid"), "map.read", ("site", ids["site"])).allowed
        assert not authorize(conn, _p("sid"), "map.read", ("floor", ids["floor3"])).allowed
        assert not authorize(conn, _p("bob"), "map.read", ("floor", ids["floor3"])).allowed, "a building under a deleted site is dead too"
        assert dead_places(conn, {("site", ids["site"]), ("building", ids["building"]), ("floor", ids["floor2"]), ("floor", ids["floor3"]),
                                  ("installation", "*"), ("camera", "c1")}) == {
            ("site", ids["site"]), ("building", ids["building"]), ("floor", ids["floor2"]), ("floor", ids["floor3"])}


def test_an_orphaned_scope_row_grants_nothing(client, settings):
    """A binding whose place row no longer exists at all (a restored archive, a hand edit)."""
    seed_tree(client)
    client.get("/api/v1/me", headers=as_user("ola"))
    _binding(settings, "ola", "editor", "building", "ghost-building")
    _binding(settings, "ola", "viewer", "floor", "ghost-floor")
    with _read(settings) as conn:
        assert dead_places(conn, [("building", "ghost-building"), ("floor", "ghost-floor")]) == {("building", "ghost-building"), ("floor", "ghost-floor")}
        assert permissions_anywhere(conn, _p("ola")) == []
        assert has_any_binding(conn, _p("ola")) is False
        assert not authorize(conn, _p("ola"), "map.read", ("building", "ghost-building")).allowed


def test_live_places_are_untouched(client, settings):
    ids = seed_tree(client)
    bind(client, settings, "dana", "editor", "building", ids["building"])
    bind(client, settings, "fay", "viewer", "floor", ids["floor2"])
    with _read(settings) as conn:
        assert dead_places(conn, {("site", ids["site"]), ("building", ids["building"]), ("floor", ids["floor2"])}) == set()
        assert authorize(conn, _p("dana"), "map.read", ("floor", ids["floor3"])).allowed
        assert authorize(conn, _p("fay"), "map.read", ("floor", ids["floor2"])).allowed
        assert not authorize(conn, _p("fay"), "map.read", ("floor", ids["floor3"])).allowed
        assert scope_chain(conn, "floor", ids["floor2"]) == [("floor", ids["floor2"]), ("building", ids["building"]), ("site", ids["site"]), ("installation", "*")]


def test_the_camera_scope_follows_the_same_rule(client, settings):
    ids = seed_tree(client)
    cam = client.post("/api/v1/cameras", json={"channel": 1, "alias": "cam-b"}).json()["id"]
    _publish(client, ids["floor2"])
    _anchor(client, ids["floor2"], "camera", cam)
    bind(client, settings, "dana", "viewer", "building", ids["building"])
    bind(client, settings, "sami", "viewer", "site", ids["site"])
    with _read(settings) as conn:
        assert cam in camera_scope(conn, _p("dana"), "map.read").ids
        assert cam in camera_scope(conn, _p("sami"), "map.read").ids
    _soft_delete(settings, "buildings", ids["building"])
    with _read(settings) as conn:
        for user in ("dana", "sami"):
            scope = camera_scope(conn, _p(user), "map.read")
            assert cam not in scope.ids and not scope.everything, user
            assert not authorize(conn, _p(user), "map.read", ("camera", cam)).allowed, "the batched and the single decision agree"


# ---------------------------------------------------------------- 2. one "active user"

def _ha_user(settings, user_id: str, active: bool) -> None:
    with Database(settings.db_path).connection() as conn:
        conn.execute("INSERT OR REPLACE INTO ha_users(id, name, username, is_active, is_admin, synced_at) VALUES (?, ?, ?, ?, 0, ?)",
                     (user_id, user_id, user_id, 1 if active else 0, now_iso()))


def _users_active(settings, user_id: str, active: bool) -> None:
    with Database(settings.db_path).connection() as conn:
        conn.execute("UPDATE users SET active = ? WHERE id = ?", (1 if active else 0, user_id))


def test_one_active_user_definition_table(client, settings):
    for u in ("both-on", "users-off", "ha-off", "users-only"):
        client.get("/api/v1/me", headers=as_user(u))
    _ha_user(settings, "dev-both-on", True)
    _users_active(settings, "dev-users-off", False)
    _ha_user(settings, "dev-users-off", True)
    _ha_user(settings, "dev-ha-off", False)
    _ha_user(settings, "ha-only", True)
    _ha_user(settings, "ha-only-off", False)
    expected = {"dev-both-on": True, "dev-users-off": False, "dev-ha-off": False, "dev-users-only": True, "ha-only": True,
                "ha-only-off": False, "nobody": False}
    from smplwise.routers import access as access_router
    from smplwise.services.tickets import access as t_access, store, store_rfq

    with _read(settings) as conn:
        ids = active_users.active_user_ids(conn)
        for uid, want in expected.items():
            assert active_users.user_is_active(conn, uid) is want, uid
            assert (uid in ids) is want, uid
            assert store.user_is_active(conn, uid) is want, uid
        assert store.active_user_ids(conn) == ids
        assert access_router.active_user_ids(conn) == ids
        assert store_rfq.active_user_ids(conn) == sorted(ids), "the second-approver search walks the same people, sorted"
        assert active_users.is_disabled(conn, "nobody") is False, "no row on either side is not 'disabled'"
        viewer = t_access.Viewer(conn, Principal(user_id="dev-ha-off", username="ha-off", display_name="", source="dev"))
        assert viewer.anywhere == frozenset(), "a person disabled on the HA side holds no tickets permission"


def test_one_signer_only_the_award_over_the_threshold_is_final_at_once(s4, settings):
    """Owner note 14.11: many organisations have ONE signer. kim is the only one; the award is final on her approval."""
    kim(s4, settings)
    _threshold(s4, 100000)
    d = sent_rfq(s4)
    v = vid(d, s4.vendor["id"])
    quoted(s4, d["id"], v)
    r = award(s4, d["id"], quote_row(compare(s4, d["id"]), v), user="kim")
    assert r.status_code == 201, r.text
    assert r.json()["award"]["state"] == "approved" and r.json()["award"]["second_required"] is False


@pytest.mark.parametrize("side", ["ha_users", "users"])
def test_a_signer_disabled_on_either_side_is_not_waited_for(s4, settings, side):
    """lea would be the second signer; disabled on one side only, she is not active, so kim's award is final."""
    kim(s4, settings, "kim", "lea")
    _threshold(s4, 100000)
    if side == "ha_users":
        _ha_user(settings, "dev-lea", False)  # users.active stays 1: the old search counted her
    else:
        _ha_user(settings, "dev-lea", True)
        _users_active(settings, "dev-lea", False)
    d = sent_rfq(s4)
    v = vid(d, s4.vendor["id"])
    quoted(s4, d["id"], v)
    r = award(s4, d["id"], quote_row(compare(s4, d["id"]), v), user="kim")
    assert r.status_code == 201, r.text
    assert r.json()["award"]["state"] == "approved", side


def test_an_active_second_signer_is_still_required(s4, settings):
    kim(s4, settings, "kim", "lea")
    _ha_user(settings, "dev-lea", True)
    _threshold(s4, 100000)
    d = sent_rfq(s4)
    v = vid(d, s4.vendor["id"])
    quoted(s4, d["id"], v)
    r = award(s4, d["id"], quote_row(compare(s4, d["id"]), v), user="kim")
    a = r.json()["award"]
    assert a["state"] == "pending_second"
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/awards/{a['id']}/confirm", json={"revision": a["revision"]}, headers=s4.h("kim"))
    assert r.status_code == 409 and r.json()["code"] == "second_approver_required", "two signers: the first never confirms herself"


def _pending_then_lea_disabled(s4, settings) -> tuple[dict, dict]:
    kim(s4, settings, "kim", "lea")
    _threshold(s4, 100000)
    d = sent_rfq(s4)
    v = vid(d, s4.vendor["id"])
    quoted(s4, d["id"], v)
    a = award(s4, d["id"], quote_row(compare(s4, d["id"]), v), user="kim").json()["award"]
    assert a["state"] == "pending_second"
    _ha_user(settings, "dev-lea", False)  # the only other signer leaves while the award waits for her
    return d, a


def test_when_the_second_signer_leaves_the_first_finishes_alone(s4, settings):
    d, a = _pending_then_lea_disabled(s4, settings)
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/awards/{a['id']}/confirm", json={"revision": a["revision"]}, headers=s4.h("joni"))
    assert r.status_code == 409 and r.json()["code"] == "second_approver_required", "only the first approver may finish it alone"
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/awards/{a['id']}/confirm", json={"revision": a["revision"]}, headers=s4.h("kim"))
    assert r.status_code == 200, r.text
    assert r.json()["award"]["state"] == "approved" and r.json()["rfq"]["state"] == "awarded"
    with _read(settings) as conn:
        row = conn.execute("SELECT details_json FROM audit_log WHERE action = 'ticket.rfq.award_confirm' ORDER BY rowid DESC LIMIT 1").fetchone()
    assert row is not None and '"sole_signer": true' in row[0]


def test_when_the_second_signer_leaves_the_first_may_withdraw(s4, settings):
    d, a = _pending_then_lea_disabled(s4, settings)
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/awards/{a['id']}/decline", json={"revision": a["revision"], "reason": "אין חותם שני"},
                  headers=s4.h("kim"))
    assert r.status_code in (200, 204), r.text
    with _read(settings) as conn:
        assert conn.execute("SELECT state FROM ticket_rfq_awards WHERE id = ?", (a["id"],)).fetchone()[0] == "declined"


def test_the_dashboard_offers_the_sole_signer_the_waiting_award(s4, settings):
    from smplwise.services.tickets import rfq as rfq_mod, store_quotes, store_rfq

    d, a = _pending_then_lea_disabled(s4, settings)
    with _read(settings) as conn:
        row = conn.execute("SELECT * FROM ticket_rfqs WHERE id = ?", (d["id"],)).fetchone()
        aw = store_rfq.award(conn, a["id"])
        q = store_quotes.quote(conn, aw["quote_id"])
        assert rfq_mod.second_signer(conn, "dev-kim", dict(row), aw, q) == "sole"
        assert rfq_mod.second_signer(conn, "dev-joni", dict(row), aw, q) is None
        assert rfq_mod.second_signer(conn, "dev-lea", dict(row), aw, q) is None
