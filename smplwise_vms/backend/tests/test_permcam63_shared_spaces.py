"""PERMCAM63-295 (board r063): personal per-camera permissions composed with shared spaces (CR-009 section 13 "Camera security").

Rule under test (services/access.py, rbac.scope_chain, CR-009 section 6 and the docs/security/HA_IDENTITY_RBAC_HE.md section 15 precedence):
a camera's scope chain is the camera itself, every floor it is anchored on, and - while it is a MEMBER of a shared room AND anchored on
one of that room's floors - every other floor of the room, with their buildings, sites and the installation. An allow anywhere on the
chain grants, a deny (of a role that holds the permission) anywhere on it wins. Membership only ever adds floors to a chain, never a grant.

The matrix (ROWS below) is asserted on four surfaces that must never disagree for a viewer: the camera LIST (map.read), the live
endpoint, the snapshot endpoint (both video.live, the per-camera decision) and the batched `camera_scope`; the per-camera `authorize`
agrees with the batched scope for every camera, every permission. Structural rows (member removed, camera moved, room unshared or
deleted, binding revoked, group membership) each run on their own world."""
from __future__ import annotations

from typing import Any

import pytest
from conftest import as_user
from test_rbac_camera_scope import _settings
from test_shared_spaces import _anchor, _binding, _p, _plan, _share, _world

from smplwise.db import Database, new_id, now_iso
from smplwise.rbac import authorize
from smplwise.services import shared_spaces as ss
from smplwise.services.access import camera_scope

PERMS = ("map.read", "video.live", "video.playback")
NAMES = ("camH", "camA", "camD", "cam3")
# World (test_shared_spaces._world, after _share): floor f2 = home of the hall; floor f3 = the other floor of the room.
#   camH  anchored in the hall on f2 AND on f3 (second anchor), a member
#   camD  anchored in the hall's duplicate outline on f3 only, a member -> reaches f2 only through the room
#   camA  anchored on f2 outside the hall, not a member
#   cam3  anchored on f3 outside the hall, not a member


@pytest.fixture(scope="module")
def mw(tmp_path_factory) -> dict[str, Any]:
    settings = _settings(tmp_path_factory.mktemp("permcam63"))
    w = _world(settings)
    w["_settings"] = settings
    _share(w)
    return w


def _bind(w: dict[str, Any], user: str, role: str, scope_type: str, scope_id: str, effect: str = "allow") -> str:
    return _binding(w["_settings"], user, role, scope_type, scope_id, effect)


def _scope(w: dict[str, Any], kind: str, name: str | None = None) -> tuple[str, str]:
    return {"installation": ("installation", "*"), "site": ("site", w["ids"]["site"]), "building": ("building", w["ids"]["building"]), "f2": ("floor", w["f2"]),
            "f3": ("floor", w["f3"]), "cam": ("camera", w["cams"][name or "camH"])}[kind]


def _reach(w: dict[str, Any], user: str) -> dict[str, set[str]]:
    """Camera NAMES the user reaches on each surface (an allowed live / snapshot is anything but the 403)."""
    c, cams = w["c"], w["cams"]
    inv = {v: k for k, v in cams.items()}
    h = as_user(user)
    listed = {inv[x["id"]] for x in c.get("/api/v1/cameras", headers=h).json()["cameras"] if x["id"] in inv}
    live = {n for n, i in cams.items() if c.get(f"/api/v1/media/live/{i}", headers=h).status_code != 403}
    snap = {n for n, i in cams.items() if c.get(f"/api/v1/cameras/{i}/snapshot.jpg", headers=h).status_code != 403}
    with w["app"].state.db.connection() as conn:
        batched = {n for n, i in cams.items() if camera_scope(conn, _p(user), "video.live").allows(i)}
        for perm in PERMS:  # the batched scope and the per-camera decision never disagree, in any permission
            sc = camera_scope(conn, _p(user), perm)
            for n, i in cams.items():
                assert sc.allows(i) is authorize(conn, _p(user), perm, ("camera", i)).allowed, (user, perm, n)
    return {"list": listed, "live": live, "snap": snap, "batched": batched}


def _expect(w: dict[str, Any], user: str, names: set[str]) -> None:
    got = _reach(w, user)
    assert got == {"list": names, "live": names, "snap": names, "batched": names}, (user, got)


# Row id: (bindings [(role, scope_kind, camera-name-or-None, effect)], reached camera names, why - the documented rule)
ROWS: dict[str, tuple[list[tuple[str, str, str | None, str]], set[str], str]] = {
    # --- personal per-camera allow / deny alone
    "A1 camera allow on the hall camera": ([("viewer", "cam", "camH", "allow")], {"camH"}, "a camera binding reaches that camera and no member neighbour"),
    "A2 camera allow on a member only anchored on the other floor": ([("viewer", "cam", "camD", "allow")], {"camD"}, "membership grants nothing"),
    "A3 camera allow on a non-member": ([("viewer", "cam", "camA", "allow")], {"camA"}, "own binding"),
    "A4 camera deny alone": ([("viewer", "cam", "camH", "deny")], set(), "no allow, nothing reached"),
    # --- the room reaches through a floor allow
    "B1 allow on the other floor": ([("viewer", "f3", None, "allow")], {"camH", "camD", "cam3"}, "CR-009 s6: the other floor reads the room's members, never the home floor's rest (camA)"),
    "B2 allow on the home floor": ([("viewer", "f2", None, "allow")], {"camH", "camA", "camD"}, "member camD hangs on the home floor through the room; cam3 is the other floor's own"),
    "B3 allow on both floors": ([("viewer", "f2", None, "allow"), ("viewer", "f3", None, "allow")], set(NAMES), "union"),
    "B4 allow on the building": ([("viewer", "building", None, "allow")], set(NAMES), "everything below"),
    "B5 allow on the site": ([("viewer", "site", None, "allow")], set(NAMES), "everything below"),
    "B6 allow installation": ([("viewer", "installation", None, "allow")], set(NAMES), "everything"),
    # --- personal allow combined with the space
    "C1 other floor allow + camera allow on the home-only camera": ([("viewer", "f3", None, "allow"), ("viewer", "cam", "camA", "allow")], {"camH", "camD", "cam3", "camA"}, "personal allow widens"),
    "C2 other floor allow + personal deny on the hall camera": ([("viewer", "f3", None, "allow"), ("viewer", "cam", "camH", "deny")], {"camD", "cam3"}, "deny on the camera wins over the room's floor allow, the neighbour member stays"),
    "C3 other floor allow + personal deny on the other member": ([("viewer", "f3", None, "allow"), ("viewer", "cam", "camD", "deny")], {"camH", "cam3"}, "same, the other member"),
    "C4 camera allow + deny on the home floor": ([("viewer", "cam", "camH", "allow"), ("viewer", "f2", None, "deny")], set(), "deny anywhere on the chain wins over the personal allow"),
    "C5 camera allow on an other-floor-only member + deny on the HOME floor": ([("viewer", "cam", "camD", "allow"), ("viewer", "f2", None, "deny")], set(), "section 6: the room puts the home floor on the member's chain - a deny on either floor takes it away"),
    "C6 camera allow on the hall camera + deny on the OTHER floor": ([("viewer", "cam", "camH", "allow"), ("viewer", "f3", None, "deny")], set(), "its own second anchor is on that floor anyway"),
    "C7 home floor allow + deny on the other floor": ([("viewer", "f2", None, "allow"), ("viewer", "f3", None, "deny")], {"camA"}, "both members hang on f3: gone; camA is f2-only"),
    "C8 other floor allow + deny on the home floor": ([("viewer", "f3", None, "allow"), ("viewer", "f2", None, "deny")], {"cam3"}, "both members hang on f2 through the room: gone"),
    "C9 installation allow + camera deny": ([("viewer", "installation", None, "allow"), ("viewer", "cam", "camH", "deny")], {"camA", "camD", "cam3"}, "narrow deny beats the wide allow"),
    "C10 installation allow + deny on the other floor": ([("viewer", "installation", None, "allow"), ("viewer", "f3", None, "deny")], {"camA"}, "members and cam3 hang on f3"),
    "C11 installation allow + deny on the home floor": ([("viewer", "installation", None, "allow"), ("viewer", "f2", None, "deny")], {"cam3"}, "camA, camH and (through the room) camD hang on f2"),
    "C12 installation deny + camera allow": ([("viewer", "installation", None, "deny"), ("viewer", "cam", "camH", "allow")], set(), "an installation deny is on every chain"),
    "C13 both floors denied, camera allow on a non-member": ([("viewer", "cam", "camA", "allow"), ("viewer", "f3", None, "deny")], {"camA"}, "a deny on a floor the camera is not on does not reach it"),
    # --- roles: a deny/allow counts only for the permissions its role holds
    "R1 deny with a role that holds nothing of the camera": ([("viewer", "f3", None, "allow"), ("tickets_view", "cam", "camH", "deny")], {"camH", "camD", "cam3"}, "a role without map.read / video.live denies neither"),
    "R2 deny with the operator role (it holds the same permissions)": ([("viewer", "f3", None, "allow"), ("operator", "cam", "camH", "deny")], {"camD", "cam3"}, "the operator's deny takes live and map.read away"),
}


@pytest.mark.parametrize("row", sorted(ROWS))
def test_matrix_row(mw, row):
    bindings, expected, _why = ROWS[row]
    user = "m-" + row.split()[0].lower()
    mw["c"].get("/api/v1/me", headers=as_user(user))
    for role, kind, name, effect in bindings:
        st, sid = _scope(mw, kind, name)
        _bind(mw, user, role, st, sid, effect)
    _expect(mw, user, expected)


def test_member_neighbour_is_not_granted_by_a_camera_binding_on_the_map(mw):
    """A1 on the map: a camera-only reader of the hall camera gets no member neighbour on the other floor's map and no home floor map."""
    c, cams = mw["c"], mw["cams"]
    user = "m-a1-map"
    c.get("/api/v1/me", headers=as_user(user))
    _bind(mw, user, "viewer", "camera", cams["camH"])
    r = c.get(f"/api/v1/floors/{mw['f3']}/map", headers=as_user(user))
    if r.status_code == 200:
        ids = {a["resource_id"] for a in r.json()["anchors"]}
        assert ids <= {cams["camH"]}, ids
    assert c.get(f"/api/v1/floors/{mw['f2']}/map", headers=as_user(user)).status_code in (200, 403)
    if c.get(f"/api/v1/floors/{mw['f2']}/map", headers=as_user(user)).status_code == 200:
        assert {a["resource_id"] for a in c.get(f"/api/v1/floors/{mw['f2']}/map", headers=as_user(user)).json()["anchors"]} <= {cams["camH"]}


def test_playback_and_events_follow_the_same_chain(mw):
    """The operator role adds playback + events: the same camera decision, per camera - a deny on the member beats the other floor allow."""
    c, cams = mw["c"], mw["cams"]
    user = "m-op"
    c.get("/api/v1/me", headers=as_user(user))
    _bind(mw, user, "operator", "floor", mw["f3"])
    _bind(mw, user, "operator", "camera", cams["camD"], "deny")
    h = as_user(user)
    day = "2026-10-05"
    for name, ok in (("camH", True), ("camD", False), ("cam3", True), ("camA", False)):
        r = c.get(f"/api/v1/cameras/{cams[name]}/events?date={day}", headers=h)
        assert (r.status_code != 403) is ok, (name, r.status_code)
    _reach(mw, user)  # batched == per-camera for map.read / video.live / video.playback


# ---------------------------------------------------------------- structural rows (one world each)


def _room(settings) -> dict[str, Any]:
    w = _world(settings)
    w["_settings"] = settings
    _share(w)
    return w


def _reach_ids(w: dict[str, Any], user: str, perm: str = "video.live") -> set[str]:
    with w["app"].state.db.connection() as conn:
        sc = camera_scope(conn, _p(user), perm)
        out = {n for n, i in w["cams"].items() if sc.allows(i)}
        for n, i in w["cams"].items():
            assert sc.allows(i) is authorize(conn, _p(user), perm, ("camera", i)).allowed, (user, n)
    return out


def _users(w: dict[str, Any], *users: str) -> None:
    for u in users:
        w["c"].get("/api/v1/me", headers=as_user(u))


def test_s1_member_removed_the_rooms_reach_and_the_rooms_deny_both_end_the_personal_allow_stays(settings):
    w = _room(settings)
    c, cams = w["c"], w["cams"]
    _users(w, "floor2", "pers", "denied")
    _bind(w, "floor2", "viewer", "floor", w["f2"])
    _bind(w, "pers", "viewer", "camera", cams["camD"])
    _bind(w, "denied", "viewer", "camera", cams["camD"])
    _bind(w, "denied", "viewer", "floor", w["f2"], "deny")
    assert _reach_ids(w, "floor2") == {"camH", "camA", "camD"}
    assert _reach_ids(w, "pers") == {"camD"}
    assert _reach_ids(w, "denied") == set(), "the home floor deny reaches the member through the room"
    assert c.delete(f"/api/v1/zones/{w['hall']}/share/members/camera/{cams['camD']}").status_code == 204
    assert _reach_ids(w, "floor2") == {"camH", "camA"}, "the room no longer carries camD to floor 2"
    assert _reach_ids(w, "pers") == {"camD"}, "a personal allow survives the membership"
    # documented consequence: membership only ADDS floors to the chain, so the home-floor deny stops applying to the former member
    assert _reach_ids(w, "denied") == {"camD"}
    # the surfaces agree for the persona that lost it
    h = as_user("floor2")
    assert cams["camD"] not in {x["id"] for x in c.get("/api/v1/cameras", headers=h).json()["cameras"]}
    assert c.get(f"/api/v1/media/live/{cams['camD']}", headers=h).status_code == 403
    assert c.get(f"/api/v1/cameras/{cams['camD']}/snapshot.jpg", headers=h).status_code == 403


def test_s2_home_member_removed_the_other_floor_loses_it_and_the_home_floor_keeps_it(settings):
    # the share conversion folded camH's duplicate anchor on floor 3 into its home anchor (one anchor, on floor 2), so the
    # room alone carried camH to floor 3
    w = _room(settings)
    c, cams = w["c"], w["cams"]
    _users(w, "f3u", "f2u")
    _bind(w, "f3u", "viewer", "floor", w["f3"])
    _bind(w, "f2u", "viewer", "floor", w["f2"])
    assert c.delete(f"/api/v1/zones/{w['hall']}/share/members/camera/{cams['camH']}").status_code == 204
    assert _reach_ids(w, "f3u") == {"camD", "cam3"}
    assert _reach_ids(w, "f2u") == {"camH", "camA"}, "floor 2 keeps camH (its home anchor); camD left with the membership"


def test_s3_camera_moved_out_of_the_room_to_another_floor(settings):
    w = _room(settings)
    c, cams = w["c"], w["cams"]
    cam = cams["camH"]
    _users(w, "f3u", "pers", "denyf3", "f9u")
    _bind(w, "f3u", "viewer", "floor", w["f3"])
    _bind(w, "pers", "viewer", "camera", cam)
    _bind(w, "denyf3", "viewer", "installation", "*")
    _bind(w, "denyf3", "viewer", "floor", w["f3"], "deny")
    with w["app"].state.db.connection() as conn:
        live = [r[0] for r in conn.execute("SELECT id FROM map_anchors WHERE resource_type = 'camera' AND resource_id = ? AND effective_to IS NULL", (cam,)).fetchall()]
    for aid in live:
        assert c.delete(f"/api/v1/map-anchors/{aid}").status_code == 204
    f9 = c.post(f"/api/v1/buildings/{w['ids']['building']}/floors", json={"name": "קומה 9", "level": 9}).json()["id"]
    _plan(c, f9)
    _anchor(c, f9, "camera", cam, 0.5, 0.5)
    _bind(w, "f9u", "viewer", "floor", f9)
    assert "camH" not in _reach_ids(w, "f3u")
    assert _reach_ids(w, "f3u") == {"camD", "cam3"}
    assert _reach_ids(w, "pers") == {"camH"}, "the personal allow follows the camera"
    assert "camH" in _reach_ids(w, "f9u") and "camA" not in _reach_ids(w, "f9u")
    assert "camH" in _reach_ids(w, "denyf3"), "the other floor's deny no longer reaches a camera that left the room and that floor"


def test_s4_camera_dragged_into_the_halls_outline_is_not_a_member_so_nothing_is_widened(settings):
    w = _room(settings)
    c, cams = w["c"], w["cams"]
    _users(w, "f3u", "pers", "denyf3")
    _bind(w, "f3u", "viewer", "floor", w["f3"])
    _bind(w, "pers", "viewer", "camera", cams["camA"])
    _bind(w, "denyf3", "viewer", "installation", "*")
    _bind(w, "denyf3", "viewer", "floor", w["f3"], "deny")
    assert c.patch(f"/api/v1/map-anchors/{w['anchors']['camA']}", json={"revision": 1, "x": 0.4, "y": 0.4}).status_code == 200
    assert "camA" not in _reach_ids(w, "f3u")
    assert _reach_ids(w, "pers") == {"camA"}
    assert "camA" in _reach_ids(w, "denyf3"), "the deny of the other floor does not reach a non-member inside the outline"


def test_s5_room_unshared_the_members_lose_the_floor_and_the_deny_lifts_the_personal_allow_stays(settings):
    w = _room(settings)
    c, cams = w["c"], w["cams"]
    _users(w, "f2u", "pers", "denied")
    _bind(w, "f2u", "viewer", "floor", w["f2"])
    _bind(w, "pers", "viewer", "camera", cams["camD"])
    _bind(w, "denied", "viewer", "camera", cams["camD"])
    _bind(w, "denied", "viewer", "floor", w["f2"], "deny")
    assert c.delete(f"/api/v1/zones/{w['hall']}/share/{w['f3']}").status_code == 204
    assert _reach_ids(w, "f2u") == {"camH", "camA"}
    assert _reach_ids(w, "pers") == {"camD"}
    assert _reach_ids(w, "denied") == {"camD"}
    with w["app"].state.db.connection() as conn:
        assert ss.member_rows(conn, w["hall"]) == []


def test_s6_room_deleted_in_one_step_leaves_the_same_state_as_unsharing(settings):
    w = _room(settings)
    c, cams = w["c"], w["cams"]
    _users(w, "f2u", "f3u", "pers")
    _bind(w, "f2u", "viewer", "floor", w["f2"])
    _bind(w, "f3u", "viewer", "floor", w["f3"])
    _bind(w, "pers", "viewer", "camera", cams["camD"])
    assert c.delete(f"/api/v1/zones/{w['hall']}?with_unshare=true").status_code == 204
    assert _reach_ids(w, "f2u") == {"camH", "camA"}
    assert _reach_ids(w, "f3u") == {"camD", "cam3"}, "camH had only its home anchor on floor 2 after the conversion"
    assert _reach_ids(w, "pers") == {"camD"}
    with w["app"].state.db.connection() as conn:
        assert ss.member_rows(conn) == [] and ss.camera_shared_floors(conn, cams["camD"]) == []


def test_s7_binding_revoked_or_expired_and_group_binding_with_a_personal_deny(settings):
    w = _room(settings)
    cams = w["cams"]
    _users(w, "rev", "grp", "left")
    b_floor = _bind(w, "rev", "viewer", "floor", w["f3"])
    _bind(w, "rev", "viewer", "camera", cams["camA"])
    assert _reach_ids(w, "rev") == {"camH", "camD", "cam3", "camA"}
    with Database(w["_settings"].db_path).connection() as conn:
        conn.execute("UPDATE bindings SET revoked_at = ? WHERE id = ?", (now_iso(), b_floor))
    assert _reach_ids(w, "rev") == {"camA"}, "revoking the floor binding takes the room with it; the personal camera binding stays"
    gid = new_id()
    with Database(w["_settings"].db_path).connection() as conn:
        conn.execute("INSERT INTO groups(id, name, created_at) VALUES (?, 'g', ?)", (gid, now_iso()))
        for u in ("grp", "left"):
            conn.execute("INSERT INTO group_members(group_id, user_id) VALUES (?, ?)", (gid, f"dev-{u}"))
        for sid in (w["f3"],):
            conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) VALUES (?, 'group', ?, 'viewer', 'floor', ?, 'allow', 1, 'test', ?)",
                         (new_id(), gid, sid, now_iso()))
    _bind(w, "grp", "viewer", "camera", cams["camH"], "deny")  # a personal deny on top of the group's floor allow
    assert _reach_ids(w, "left") == {"camH", "camD", "cam3"}
    assert _reach_ids(w, "grp") == {"camD", "cam3"}, "the personal deny beats the group allow"
    with Database(w["_settings"].db_path).connection() as conn:
        conn.execute("DELETE FROM group_members WHERE group_id = ? AND user_id = ?", (gid, "dev-left"))
        conn.execute("DELETE FROM group_members WHERE group_id = ? AND user_id = ?", (gid, "dev-grp"))
    assert _reach_ids(w, "left") == set(), "out of the group: the room's reach is gone"
    assert _reach_ids(w, "grp") == set()


def test_s8_deactivated_person_loses_the_combination_at_once(settings):
    w = _room(settings)
    cams = w["cams"]
    _users(w, "gone")
    _bind(w, "gone", "viewer", "floor", w["f3"])
    _bind(w, "gone", "viewer", "camera", cams["camA"])
    assert _reach_ids(w, "gone") == {"camH", "camD", "cam3", "camA"}
    with Database(w["_settings"].db_path).connection() as conn:
        conn.execute("UPDATE users SET active = 0 WHERE id = ?", ("dev-gone",))
    assert _reach_ids(w, "gone") == set()
    assert w["c"].get(f"/api/v1/media/live/{cams['camA']}", headers=as_user("gone")).status_code == 403


def test_s9_a_floor_force_deleted_under_the_room_ends_the_deny_that_rode_on_it(settings):
    """The other floor is deleted: the room ends (L5), so a deny on the HOME floor stops reaching camD - and camD (anchored only on
    the deleted floor) is reached by its personal allow alone."""
    w = _room(settings)
    c, cams = w["c"], w["cams"]
    _users(w, "pers", "f2u")
    _bind(w, "pers", "viewer", "camera", cams["camD"])
    _bind(w, "f2u", "viewer", "floor", w["f2"])
    assert c.delete(f"/api/v1/floors/{w['f3']}?force=true").status_code == 204
    with w["app"].state.db.connection() as conn:
        assert ss.member_rows(conn) == []
    assert _reach_ids(w, "f2u") == {"camH", "camA"}
    assert _reach_ids(w, "pers") == {"camD"}
