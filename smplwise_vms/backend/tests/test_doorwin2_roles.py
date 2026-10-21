"""DOORWIN2-295 (CR-039 7.2 / 7.3): the four single-permission roles - `door_windows_manager`, `door_windows_guard`, `emergency_lock`,
`emergency_open` (the D25 pattern of CR-038 8.2). Each holds exactly its permission plus the two read permissions that let the holder see what they
act on; only the guard is delegable by default; emergency OPEN stays system_admin-only among the built-in roles. Arx RBAC is the only authority:
a role grants nothing outside its permission, a deny wins, a kiosk / wall account is refused whatever it holds. Negative first. Fakes only."""
from __future__ import annotations

import pytest
from fake_doorwin_adapters import ProductWorld

from smplwise.rbac import ROLES
from smplwise.routers.access import DEFAULT_DELEGABLE, PERMISSION_LABELS, SENSITIVE

SINGLE = {
    "door_windows_manager": "access.windows.manage",
    "door_windows_guard": "access.windows.cancel",
    "emergency_lock": "access.emergency.lock",
    "emergency_open": "access.emergency.open",
}
READS = ["access.read", "access.stations.read"]


@pytest.fixture()
def pw(settings, monkeypatch):
    return ProductWorld(settings, monkeypatch, go_live=False)


def test_each_role_holds_exactly_its_permission_and_the_two_reads():
    for role, perm in SINGLE.items():
        assert ROLES[role] == [*READS, perm], role
    assert [p for p in SINGLE.values() if p not in SENSITIVE] == [], "all four are sensitive: never implied, a custom role names them explicitly"
    assert all(PERMISSION_LABELS.get(p) for p in SINGLE.values())


def test_only_the_guard_is_delegable_by_default():
    assert "door_windows_guard" in DEFAULT_DELEGABLE
    assert not {"door_windows_manager", "emergency_lock", "emergency_open"} & set(DEFAULT_DELEGABLE)


def test_no_built_in_role_changed_its_door_permissions():
    holders = lambda perm: sorted(r for r, perms in ROLES.items() if perm in perms)
    assert holders("access.windows.manage") == ["door_windows_manager", "site_admin", "system_admin"]
    assert holders("access.windows.cancel") == ["door_windows_guard", "operator", "site_admin", "system_admin"]
    assert holders("access.emergency.lock") == ["emergency_lock", "site_admin", "system_admin"]
    assert holders("access.emergency.open") == ["emergency_open", "system_admin"], "owner decision 2026-10-13: system administrators only (a grant is per user)"
    for role in SINGLE:
        assert not any(p.startswith(("access.doors.", "access.release", "access.people", "system.")) for p in ROLES[role]), role


def test_the_roles_are_listed_with_their_hebrew_names(pw):
    roles = {r["id"]: r for r in pw.get("/access/roles").json()["roles"]}
    assert roles["door_windows_manager"]["name"] == "ניהול חלונות פתיחה" and roles["emergency_open"]["name"] == "פתיחת חירום"
    assert all(not roles[r].get("custom") for r in SINGLE)


@pytest.mark.parametrize("scope", ["installation", "station"])
def test_the_manager_can_define_windows_and_nothing_else(pw, scope):
    if scope == "installation":
        pw.bind("mia", "door_windows_manager")
    else:
        pw.bind("mia", "door_windows_manager", "access_control_station", pw.ENTRY)
    assert pw.rule(user="mia", enable=False).status_code == 201
    assert pw.get("/doors/windows/state", "mia").json()["can"]["manage"] is True
    assert pw.post("/doors/emergency/prepare", "mia", action="start", kind="lock_secure", drill=True).status_code == 403, "no emergency right"
    assert pw.put("/doors/windows/settings", "mia", changes={"doors.windows.enabled": "on"}, confirmed=True).status_code == 403, "no system.configure"
    assert pw.put("/doors/windows/calendar", "mia", days=[{"on_date": "2026-12-01", "day_type": "closed"}], confirmed=True).status_code == (200 if scope == "installation" else 403)
    assert pw.post("/access/bindings", "mia", subject_kind="user", subject_id="dev-x", role_id="viewer", scope_type="installation", scope_id="*").status_code == 403


def test_the_guard_can_end_a_window_but_not_define_one(pw):
    pw.windows_on()
    rid = pw.rule(periods=[{"weekday": 1, "start": "08:00", "end": "11:00"}]).json()["rule"]["id"]
    pw.sync()
    pw.bind("gus", "door_windows_guard")
    assert pw.rule(user="gus", enable=False).status_code == 403
    assert pw.post(f"/doors/windows/rules/{rid}/pause", "gus", confirmed=True).status_code == 403
    st = pw.get("/doors/windows/state", "gus").json()
    assert st["can"]["cancel"] is True and st["can"]["manage"] is False
    occ = next(o for o in st["occurrences"] if o["rule_id"] == rid)
    assert pw.post(f"/doors/windows/occurrences/{occ['id']}/end-now", "gus", confirmed=True).status_code in (200, 409), "allowed to try; not refused for a missing permission"
    assert pw.post(f"/doors/windows/doors/{pw.ENTRY}/1/open-for", "gus", duration_s=3600, confirmed=True).status_code == 403, "an event hold needs manage"


def test_emergency_lock_and_open_are_separate_rights(pw):
    pw.bind("lena", "emergency_lock")
    pw.bind("omer", "emergency_open")
    assert pw.post("/doors/emergency/prepare", "lena", action="start", kind="lock_secure", drill=True).status_code == 200
    assert pw.post("/doors/emergency/prepare", "lena", action="start", kind="open", drill=True).status_code == 403
    assert pw.post("/doors/emergency/prepare", "omer", action="start", kind="open", drill=True).status_code == 200
    assert pw.post("/doors/emergency/prepare", "omer", action="start", kind="lock_secure", drill=True).status_code == 403
    assert pw.rule(user="lena", enable=False).status_code == 403 and pw.rule(user="omer", enable=False).status_code == 403


def test_a_deny_on_a_station_beats_the_single_permission_role(pw):
    pw.bind("mia", "door_windows_manager")
    pw.bind("mia", "door_windows_manager", "access_control_station", pw.SIDE, effect="deny")
    assert pw.rule(user="mia", doors=[(pw.SIDE, 1)], enable=False).status_code == 403
    assert pw.rule(user="mia", doors=[(pw.ENTRY, 1)], enable=False).status_code == 201


def test_a_wall_account_is_refused_even_with_the_role(pw):
    pw.bind("wall1", "door_windows_manager")
    pw.bind("wall1", "kiosk")
    r = pw.rule(user="wall1", enable=False)
    assert r.status_code == 403 and r.json()["details"]["reason"] == "wall_account"


def test_a_delegated_administrator_hands_out_only_the_guard(pw):
    d = pw.get("/access/delegation").json()
    assert "door_windows_guard" in d["delegable_roles"]
    for r in ("door_windows_manager", "emergency_lock", "emergency_open"):
        assert r not in d["delegable_roles"], r
