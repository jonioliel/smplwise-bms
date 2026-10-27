"""WXPERM (owner decisions 2026-10-13): access-control permissions are assignable to ANY role - never a role name.

What is proven (fakes only: no WisKey, station, door, phone or Home Assistant is contacted; no request here reaches a device):
- the default grant set of every access-control permission per built-in role (the whole table, so a change is deliberate);
- owner rule: every built-in role that may manage people (`access.people.manage`) may also send WhatsApp messages
  (`access.people.message`) - and the two stay separate permissions a custom role takes one without the other;
- the door-only permission `access.doors.open` replaces `access.release` in every built-in role that opened doors; the legacy
  name stays known, sensitive and honoured (rbac.LEGACY_PERMISSIONS) for allows AND denies, and a role edit that keeps it never
  reports a spurious removal;
- the custom-role matrix: a custom role holding exactly one access-control permission passes exactly that permission's gates
  (and none whose gate needs a second one: PIN / capture need people.manage, the CSV export needs the entry log) - each route
  is probed with a malformed body, so a caller who passes the gate is stopped by validation and nothing is sent;
- every one of these permissions is a catalogue entry a custom role may carry (labelled in Hebrew, none a system permission),
  the sensitive ones are listed as sensitive, and the roles screen lists them.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise import rbac
from smplwise.db import Database
from smplwise.main import create_app
from smplwise.rbac import LEGACY_PERMISSIONS, ROLES, Principal, expand_legacy, legacy_name_of, role_permissions
from smplwise.routers.access import PERMISSION_LABELS, SENSITIVE, SYSTEM_PERMISSIONS
from smplwise.services import door_authority
from smplwise.services import intercom_authority as ia

ROOT = Path(__file__).resolve().parents[3]
CONTRACT = json.loads((ROOT / "contracts" / "examples" / "role-catalog.design.json").read_text(encoding="utf-8"))
API = "/api/v1"
BUILTIN = ("viewer", "kiosk", "operator", "editor", "site_admin", "system_admin", "door_opener")
ADMINS = {"site_admin", "system_admin"}

# The default grant set of every access-control permission (owner decisions up to 2026-10-13). A change here is a product decision.
DEFAULT_GRANTS: dict[str, set[str]] = {
    "access.read": {"viewer", "operator", "editor", "site_admin", "system_admin", "door_opener"},
    "access.doors.open": {"site_admin", "system_admin", "door_opener"},  # WXPERM: the door-only permission
    "access.release": set(),  # WXPERM: legacy name of access.doors.open - honoured in custom roles, listed by no built-in role
    "access.call": {"operator", "site_admin", "system_admin"},  # 2.4.9: talk / calls / announcements
    "access.stations.read": {"operator", "site_admin", "system_admin"},
    "access.events.read": {"operator", "site_admin", "system_admin"},
    "access.events.export": ADMINS,
    "access.people.read": {"operator", "site_admin", "system_admin"},
    "access.people.sensitive": ADMINS,
    "access.people.manage": ADMINS,
    "access.people.message": ADMINS,  # owner rule: wherever people.manage is a default, so is people.message
    "access.pin.generate": ADMINS,
    "access.cards.capture": ADMINS,
    "access.admin.read": ADMINS,
    "access.schedules.manage": {"system_admin"},
    "access.stations.manage": {"system_admin"},
    "access.groups.manage": {"system_admin"},
    "access.external.grant": {"system_admin"},  # CR-ARX-WISKEY-SHARED-IDENTITY D5 (owner answer 2, 2026-10-17)
    "access.visitor.invite": {"system_admin"},  # EXTERNALBUILD-297 (CR-VISITOR105 5.1): the owner hands it out

    "access.doors.automate": {"system_admin"},  # CR-AUTODOORS-295: automations that open doors (arming), sensitive
    "access.people.stations": ADMINS,  # STATIONPERM-295 (owner decision 2026-10-21: system_admin and site_admin; editable per role / station)
    # CR-039 / DOORWIN-295 (owner decisions 2026-10-13): door windows and emergency controls
    "access.windows.manage": ADMINS,
    "access.windows.cancel": {"operator", "site_admin", "system_admin"},
    "access.emergency.lock": ADMINS,
    "access.emergency.open": {"system_admin"},  # system administrators only
}
SENSITIVE_ACCESS = {"access.doors.open", "access.release", "access.call", "access.events.export", "access.people.sensitive", "access.people.manage",
                    "access.people.message", "access.pin.generate", "access.cards.capture", "access.schedules.manage", "access.stations.manage",
                    "access.groups.manage", "access.external.grant", "access.doors.automate", "access.people.stations", "access.windows.manage",
                    "access.windows.cancel", "access.emergency.lock", "access.emergency.open", "access.visitor.invite"}


# ---------------------------------------------------------------- the default grant sets

def test_every_access_permission_has_its_default_grant_set():
    held = {p for perms in ROLES.values() for p in perms if p.startswith("access.")}
    assert held <= set(DEFAULT_GRANTS), f"an access permission without a recorded default: {held - set(DEFAULT_GRANTS)}"
    for permission, holders in DEFAULT_GRANTS.items():
        assert {r for r in BUILTIN if permission in ROLES[r]} == holders, permission
    assert ROLES["kiosk"] and not [p for p in ROLES["kiosk"] if p.startswith("access.")], "a wall display holds no access permission"


@pytest.mark.parametrize("role", BUILTIN)
def test_each_builtin_role_regression(role):
    """The access part of each built-in role, role by role: nothing gained or lost by the rename beyond access.release ->
    access.doors.open in exactly the roles that held access.release before."""
    expected = {p for p, holders in DEFAULT_GRANTS.items() if role in holders}
    assert {p for p in ROLES[role] if p.startswith("access.")} == expected


def test_the_design_contract_agrees_with_roles_json():
    for role in CONTRACT["roles"]:
        assert {p for p in role["permissions"] if p.startswith("access.")} == {p for p in ROLES[role["id"]] if p.startswith("access.")}, role["id"]
    assert SENSITIVE_ACCESS <= set(CONTRACT["sensitive_permissions_not_implied"])


def test_owner_rule_people_managers_also_send_whatsapp():
    for role, perms in ROLES.items():
        if "access.people.manage" in perms:
            assert "access.people.message" in perms, f"{role} may manage people, so it may also send WhatsApp messages"
    for role in CONTRACT["roles"]:
        if "access.people.manage" in role["permissions"]:
            assert "access.people.message" in role["permissions"], role["id"]


def test_catalogue_entries_are_assignable_and_labelled():
    for permission in DEFAULT_GRANTS:
        assert permission not in SYSTEM_PERMISSIONS, f"{permission} must stay assignable to a custom role"
        assert PERMISSION_LABELS.get(permission), permission
    for permission in SENSITIVE_ACCESS:
        assert permission in SENSITIVE, permission
    for permission in set(DEFAULT_GRANTS) - SENSITIVE_ACCESS:
        assert permission not in SENSITIVE, permission
    # the access-control service's own sensitive list (the existing audit behaviour) carries the new door permission
    assert ia.DOORS_OPEN == door_authority.DOOR_OPEN == "access.doors.open" and ia.DOORS_OPEN in ia.SENSITIVE_PERMISSIONS
    assert PERMISSION_LABELS["access.doors.open"] == "בקרת כניסה: פתיחת דלתות"
    assert "קודם" in PERMISSION_LABELS["access.release"], "the legacy name says it is the old name"
    assert set(rbac.STATION_PERMISSIONS) >= {"access.doors.open", "access.release", "access.call", "access.people.message", "access.pin.generate"}


def test_roles_screen_lists_the_permissions_and_the_legacy_map(settings):
    c = TestClient(create_app(settings))
    body = c.get(f"{API}/access/roles").json()
    for permission in DEFAULT_GRANTS:
        assert body["labels"][permission] == PERMISSION_LABELS[permission]
    assert SENSITIVE_ACCESS <= set(body["sensitive"])
    assert body["legacy_permissions"] == {"access.release": "access.doors.open"}


# ---------------------------------------------------------------- the legacy name: allows, denies, role edits

def test_expand_legacy_is_one_directional():
    assert LEGACY_PERMISSIONS == {"access.release": "access.doors.open"}
    assert expand_legacy(["access.release", "map.read"]) == ["access.doors.open", "access.release", "map.read"]
    assert expand_legacy(["access.doors.open"]) == ["access.doors.open"], "the new name never implies the legacy one"
    assert expand_legacy([]) == []


def _custom(c: TestClient, name: str, sensitive: list[str], permissions: list[str] | None = None) -> str:
    r = c.post(f"{API}/access/roles", json={"name": name, "description": "WXPERM test", "permissions": permissions or [], "sensitive": sensitive})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _principal(user: str) -> Principal:
    return Principal(f"dev-{user}", user, user, "dev")


def test_a_legacy_custom_role_keeps_its_door_and_its_deny(settings):
    c = TestClient(create_app(settings))
    c.get(f"{API}/me")
    legacy = _custom(c, "שחרור דלת ישן", ["access.release"])
    modern = _custom(c, "פתיחת דלתות", ["access.doors.open"])
    bind(c, settings, "leo", legacy, "installation", "*")  # a role saved before the rename
    bind(c, settings, "max", modern, "installation", "*")
    bind(c, settings, "dan", "door_opener", "installation", "*")
    bind(c, settings, "dee", "door_opener", "installation", "*")
    db = Database(settings.db_path)
    with db.connection() as conn:  # a deny of the LEGACY role (an administrator wrote it before the rename)
        conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) "
                     "VALUES ('wx-deny', 'user', 'dev-dee', ?, 'installation', '*', 'deny', 1, 'test', '2026-10-13T00:00:00Z')", (legacy,))
    with db.connection(mode="read") as conn:
        assert "access.doors.open" in role_permissions(conn, legacy) and "access.release" in role_permissions(conn, legacy)
        assert "access.release" not in role_permissions(conn, modern)
        assert legacy_name_of(conn, legacy, "access.doors.open") == "access.release"
        assert legacy_name_of(conn, modern, "access.doors.open") is None and legacy_name_of(conn, "site_admin", "access.doors.open") is None

        def door(user: str) -> door_authority.DoorDecision:
            return door_authority.check(conn, _principal(user), "entry-a", None, dev_mode=True)

        assert door("leo").allowed and door("leo").granted_by == "access.release", "the legacy grant opens, and the audit names it"
        assert door("max").allowed and door("max").granted_by == "access.doors.open"
        assert door("dan").allowed and door("dan").granted_by == "access.doors.open", "door_opener: no regression"
        d = door("dee")
        assert not d.allowed and d.reason == "explicit_deny", "a deny of the legacy role still refuses the door"
    me = c.get(f"{API}/me", headers=as_user("leo")).json()
    assert "access.doors.open" in me["permissions_installation"], "the screens see the new name for a legacy role"


def test_editing_a_legacy_role_without_touching_its_door_removes_nothing(settings):
    c = TestClient(create_app(settings))
    c.get(f"{API}/me")
    legacy = _custom(c, "משמרת ישנה", ["access.release"], permissions=["access.read"])
    bind(c, settings, "leo", legacy, "installation", "*")
    preview = c.post(f"{API}/access/roles/preview", json={"role_id": legacy, "permissions": ["access.read", "map.read"], "sensitive": ["access.release"]})
    assert preview.status_code == 200, preview.text
    assert preview.json()["removed"] == [] and preview.json()["added"] == ["map.read"], preview.json()
    rev = next(r for r in c.get(f"{API}/access/roles").json()["roles"] if r["id"] == legacy)["revision"]
    r = c.patch(f"{API}/access/roles/{legacy}", json={"name": "משמרת ישנה", "description": "x", "permissions": ["access.read", "map.read"], "sensitive": ["access.release"], "revision": rev})
    assert r.status_code == 200, r.text
    assert r.json()["impact"]["removed"] == []
    with Database(settings.db_path).connection(mode="read") as conn:
        assert door_authority.check(conn, _principal("leo"), "entry-a", None, dev_mode=True).allowed
    # switching to the new name: the door stays, nothing is reported removed
    rev = next(x for x in c.get(f"{API}/access/roles").json()["roles"] if x["id"] == legacy)["revision"]
    r = c.patch(f"{API}/access/roles/{legacy}", json={"name": "משמרת ישנה", "description": "x", "permissions": ["access.read", "map.read"], "sensitive": ["access.doors.open"], "revision": rev})
    assert r.status_code == 200 and r.json()["impact"]["removed"] == ["access.release"] and r.json()["impact"]["added"] == [], r.json()["impact"]
    with Database(settings.db_path).connection(mode="read") as conn:
        assert door_authority.check(conn, _principal("leo"), "entry-a", None, dev_mode=True).granted_by == "access.doors.open"


def test_the_grant_card_answers_for_legacy_and_new_custom_roles(settings):
    c = TestClient(create_app(settings))
    c.get(f"{API}/me")
    legacy = _custom(c, "ישן", ["access.release"], permissions=["access.read"])
    plain = _custom(c, "רגיל", [], permissions=["access.read"])
    card = {r["id"]: r for r in c.get(f"{API}/access/door-grants").json()["roles"]}
    assert card[legacy]["includes"] is True and card[plain]["includes"] is False
    assert {rid: card[rid]["answer"] for rid in ("site_admin", "system_admin", "operator", "viewer")} == {"site_admin": "yes", "system_admin": "yes", "operator": "per_user", "viewer": "never"}
    # on for a legacy role: nothing to add (it already opens doors)
    r = c.put(f"{API}/access/door-grants/roles/{legacy}", json={"enabled": True, "revision": card[legacy]["revision"], "confirmed": True})
    assert r.status_code == 200 and r.json()["revision"] == card[legacy]["revision"], r.text
    # off for a legacy role: the legacy name goes too - switching door opening off never leaves a door behind
    r = c.put(f"{API}/access/door-grants/roles/{legacy}", json={"enabled": False, "revision": card[legacy]["revision"], "confirmed": True})
    assert r.status_code == 200, r.text
    perms = next(x for x in c.get(f"{API}/access/roles").json()["roles"] if x["id"] == legacy)["permissions"]
    assert not {"access.release", "access.doors.open"} & set(perms)
    # on for a plain role: the NEW name
    r = c.put(f"{API}/access/door-grants/roles/{plain}", json={"enabled": True, "revision": card[plain]["revision"], "confirmed": True})
    assert r.status_code == 200, r.text
    perms = next(x for x in c.get(f"{API}/access/roles").json()["roles"] if x["id"] == plain)["permissions"]
    assert "access.doors.open" in perms and "access.release" not in perms


def test_the_notification_door_link_follows_the_door_permission(settings):
    from smplwise.services.notify_visibility import Reach

    c = TestClient(create_app(settings))
    c.get(f"{API}/me")
    legacy = _custom(c, "ישן", ["access.release"])
    bind(c, settings, "leo", legacy, "installation", "*")
    bind(c, settings, "sam", "site_admin", "installation", "*")
    bind(c, settings, "otto", "operator", "installation", "*")
    note = {"source": "door.ring", "subject_kind": "door", "subject_id": "entry-a", "params": {"name": "כניסה"}, "origin": {}, "category": "security"}
    with Database(settings.db_path).connection(mode="read") as conn:
        answers = {u: (Reach(conn, _principal(u)).door(note) or {}).get("can_open") for u in ("leo", "sam", "otto")}
    assert answers == {"leo": True, "sam": True, "otto": False}


# ---------------------------------------------------------------- the custom-role matrix: only X can do only X

BAD = b"{not json"
# permission -> the gates it opens: (method, path). Every probe carries a malformed body (or none), so a caller past the gate is
# stopped by validation or by the absent WisKey and nothing is sent; a caller refused by the gate gets 403 `forbidden`.
PROBES: dict[str, list[tuple[str, str]]] = {
    "access.doors.open": [("post", "/intercom/stations/entry-a/release")],
    "access.call": [("post", "/intercom/stations/entry-a/call"), ("post", "/intercom/stations/entry-a/tts"), ("post", "/access-control/stations/entry-a/talk")],
    "access.people.manage": [("post", "/intercom/people"), ("put", "/intercom/people/u1"), ("post", "/intercom/people/u1/delete"), ("post", "/intercom/people/u1/active")],
    "access.people.message": [("get", "/access-control/messaging"), ("post", "/access-control/people/u1/messages")],
    "access.events.export": [("get", "/access-control/events/export.csv")],
    "access.people.read": [("get", "/access-control/people")],
    "access.events.read": [("get", "/access-control/events")],
    "access.stations.read": [("get", "/access-control/schedules")],
    "access.admin.read": [("get", "/access-control/status/sync")],
    "access.read": [("get", "/access-control/stations")],
}
# gates that need TWO permissions (S11: on top of access.people.manage)
COMPOUND: dict[str, list[tuple[str, str]]] = {
    "access.pin.generate": [("post", "/intercom/people/pin-generate")],
    "access.cards.capture": [("post", "/intercom/people/u1/card-capture")],
}
ALL_PROBES = [p for probes in PROBES.values() for p in probes] + [p for probes in COMPOUND.values() for p in probes]
# what each probe's gate requires (all of it, anywhere): its own permission; S11 extras on top of people.manage; the CSV export
# also needs the entry log itself (routers/access_control_reads.py events_export)
REQUIRES: dict[tuple[str, str], frozenset[str]] = {
    **{p: frozenset({x}) for x, probes in PROBES.items() for p in probes},
    **{p: frozenset({x, "access.people.manage"}) for x, probes in COMPOUND.items() for p in probes},
    ("get", "/access-control/events/export.csv"): frozenset({"access.events.export", "access.events.read"}),
}


def expected_for(perms: set[str] | list[str]) -> set[tuple[str, str]]:
    effective = set(rbac.expand_legacy(list(perms)))
    return {p for p, need in REQUIRES.items() if need <= effective}


def _passes(c: TestClient, user: str, method: str, path: str) -> bool:
    headers = {**as_user(user), "Content-Type": "application/json"}
    r = c.request(method, API + path, content=None if method == "get" else BAD, headers=headers)
    if r.status_code == 403:
        assert r.json().get("code") in ("forbidden", "intercom_field_level", "intercom_person_scope"), (user, path, r.text)
        return r.json().get("code") != "forbidden"
    return True


@pytest.fixture()
def matrix(settings):
    c = TestClient(create_app(settings))
    c.get(f"{API}/me")
    users: dict[str, set[str]] = {}

    def role(user: str, perms: list[str]) -> None:
        sens = [p for p in perms if p in SENSITIVE]
        plain = [p for p in perms if p not in SENSITIVE]
        rid = _custom(c, f"רק {user}", sens, permissions=plain)
        bind(c, settings, user, rid, "installation", "*")
        users[user] = set(perms)

    for i, permission in enumerate(PROBES):
        role(f"only{i}", [permission])
    role("legacy", ["access.release"])
    role("pin", ["access.pin.generate"])
    role("capture", ["access.cards.capture"])
    role("mgrpin", ["access.people.manage", "access.pin.generate"])
    role("mgrcap", ["access.people.manage", "access.cards.capture"])
    role("exporter", ["access.events.read", "access.events.export"])  # the CSV export needs the entry log too
    role("mgrmsg", ["access.people.manage", "access.people.message"])  # the owner rule's pair, in a custom role
    return c, users


def test_a_custom_role_with_only_x_can_do_only_x(matrix):
    c, users = matrix
    for user, perms in users.items():
        expected = expected_for(perms)
        passed = {p for p in ALL_PROBES if _passes(c, user, *p)}
        assert passed == expected, (user, sorted(perms), sorted(passed ^ expected))


def test_no_role_at_all_passes_no_gate(matrix):
    c, _users = matrix
    c.get(f"{API}/me", headers=as_user("nobody"))
    assert not [p for p in ALL_PROBES if _passes(c, "nobody", *p)]


def test_a_door_only_role_reaches_no_people_call_or_message_route(matrix):
    """The door permission is door only: no call, announcement, talk, people directory, entry log or message."""
    c, users = matrix
    legacy = "legacy"
    assert users[legacy] == {"access.release"}
    door_only = next(u for u, p in users.items() if p == {"access.doors.open"})
    for user in (door_only, legacy):
        passed = {p for p in ALL_PROBES if _passes(c, user, *p)}
        assert passed == set(PROBES["access.doors.open"]), (user, passed)


def test_builtin_roles_pass_their_default_gates(settings):
    """Regression for the built-in roles over the same probes: each passes exactly the gates of its default grant set."""
    c = TestClient(create_app(settings))
    c.get(f"{API}/me")
    for role in ("viewer", "operator", "editor", "site_admin", "system_admin", "door_opener", "kiosk"):
        bind(c, settings, f"b-{role}", role, "installation", "*")
    for role in ("viewer", "operator", "editor", "site_admin", "system_admin", "door_opener", "kiosk"):
        expected = expected_for(set(ROLES[role]))
        passed = {p for p in ALL_PROBES if _passes(c, f"b-{role}", *p)}
        assert passed == expected, (role, sorted(passed ^ expected))
