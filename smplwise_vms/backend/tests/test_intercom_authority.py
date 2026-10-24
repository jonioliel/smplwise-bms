"""CR-036 S3: the access-control permissions and the projection filter (services/intercom_authority.py).

- the catalogue: the new permissions, their default roles (CR-036 2.3), the sensitive list, the labels the Settings roles screen
  shows (backend and the frontend fallback agree), the design contract agrees with roles.json;
- the Authority rules over the station chain: deny overrides, unrestricted vs restricted, the endpoint gate, fail closed;
- the views: stations (technical fields), people (visibility by assignment, the lowest level over visible stations, editable),
  events (employee number and portrait are sensitive).

Station scope is CR-033's (tests/intercom_station_scope.py: real once merged, a labelled double before). No device, Home
Assistant or WisKey is contacted."""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient
from intercom_station_scope import station_scope  # noqa: F401 - a fixture

from smplwise import rbac
from smplwise.db import Database
from smplwise.main import create_app
from smplwise.rbac import ROLES, Principal
from smplwise.routers.access import PERMISSION_LABELS, SENSITIVE
from smplwise.services import intercom_authority as ia

ROOT = Path(__file__).resolve().parents[3]
CONTRACT = json.loads((ROOT / "contracts" / "examples" / "role-catalog.design.json").read_text(encoding="utf-8"))

DEFAULTS = {
    # G2FIX-295: CR-039 7.2 (DOORWIN2-295) - the four single-permission door roles hold access.read + access.stations.read to see what they act on
    "access.stations.read": {"operator", "site_admin", "system_admin", "door_windows_manager", "door_windows_guard", "emergency_lock", "emergency_open", "security_manager"},
    "access.events.read": {"operator", "site_admin", "system_admin"},
    "access.events.export": {"site_admin", "system_admin"},
    "access.people.read": {"operator", "site_admin", "system_admin"},
    "access.people.sensitive": {"site_admin", "system_admin"},
    "access.people.message": {"site_admin", "system_admin"},
    "access.call": {"operator", "site_admin", "system_admin"},  # 2.4.9: operator added (owner decision 2026-10-13)
    "access.admin.read": {"site_admin", "system_admin"},
    "access.schedules.manage": {"system_admin"},
    "access.stations.manage": {"system_admin"},
    "access.groups.manage": {"system_admin"},
    "access.pin.generate": {"site_admin", "system_admin"},  # S11 (owner decision 2026-10-12, PG)
    "access.doors.open": {"site_admin", "system_admin", "door_opener"},  # WXPERM: the door-only permission (was access.release)
}


# ---------------------------------------------------------------- the catalogue

def test_the_new_permissions_have_the_cr036_default_roles():
    assert set(DEFAULTS) == set(ia.NEW_PERMISSIONS)
    for permission, holders in DEFAULTS.items():
        assert {r for r, perms in ROLES.items() if permission in perms} == holders, permission
    for role in ("viewer", "editor", "kiosk"):
        assert not any(p in ROLES[role] for p in DEFAULTS), f"{role} gains nothing: names stay with operator and above"
    assert "access.read" in ROLES["viewer"] and "access.read" not in ROLES["kiosk"], "access.read itself is unchanged"


def test_sensitivity_matches_the_cr036_table():
    assert set(ia.SENSITIVE_PERMISSIONS) <= set(SENSITIVE)
    assert not set(ia.READ_PERMISSIONS) & set(SENSITIVE), "the plain reads are not sensitive"
    contract_sensitive = set(CONTRACT["sensitive_permissions_not_implied"])
    assert set(ia.SENSITIVE_PERMISSIONS) <= contract_sensitive and not set(ia.READ_PERMISSIONS) & contract_sensitive


def test_the_design_contract_agrees_with_roles_json():
    for permission in DEFAULTS:
        assert {r["id"]: permission in r["permissions"] for r in CONTRACT["roles"]} == {r["id"]: permission in ROLES[r["id"]] for r in CONTRACT["roles"]}, permission


def test_every_new_permission_has_a_label_and_no_platform_name():
    for permission in DEFAULTS:
        label = PERMISSION_LABELS[permission]
        assert label.startswith("בקרת כניסה: "), permission
        for word in ("WisKey", "Home Assistant", "HA ", "Ingress"):
            assert word not in label, (permission, word)


def test_the_frontend_label_fallback_equals_the_backend_labels():
    source = (ROOT / "frontend" / "src" / "access-control" / "access.ts").read_text(encoding="utf-8")
    block = source.split("ACCESS_CONTROL_PERMISSION_LABELS: Record<AccessControlPermission, string> = {", 1)[1].split("};", 1)[0]
    labels = dict(re.findall(r"'([a-z.]+)': '([^']*)'", block))
    assert labels == {p: PERMISSION_LABELS[p] for p in DEFAULTS}
    listed = re.findall(r"'([a-z.]+)'", source.split("ACCESS_CONTROL_PERMISSIONS = [", 1)[1].split("]", 1)[0])
    assert sorted(listed) == sorted(ia.NEW_PERMISSIONS) and len(listed) == len(set(listed))
    roles_screen = (ROOT / "frontend" / "src" / "screens" / "system-access.ts").read_text(encoding="utf-8")
    assert "accessControlPermissionLabel(p)" in roles_screen, "the roles screen falls back to these labels"


def test_the_station_scope_name_is_cr033s():
    assert ia.STATION_SCOPE == "access_control_station"
    if hasattr(rbac, "STATION"):
        assert rbac.STATION == ia.STATION_SCOPE


def test_roles_screen_lists_the_new_permissions(settings):
    c = TestClient(create_app(settings))
    body = c.get("/api/v1/access/roles").json()
    for permission in DEFAULTS:
        assert body["labels"][permission] == PERMISSION_LABELS[permission]
    for permission in ia.SENSITIVE_PERMISSIONS:
        assert permission in body["sensitive"]


# ---------------------------------------------------------------- the Authority over the station chain

def authority(settings: Any, user: str) -> ia.Authority:
    """An Authority on a plain read connection to the test database (a dev principal's id is `dev-<name>`)."""
    import sqlite3

    conn = sqlite3.connect(settings.db_path)
    conn.row_factory = sqlite3.Row
    return ia.Authority(conn, Principal(user_id=f"dev-{user}", username=user, display_name=user, source="dev"))


@pytest.fixture()
def app_client(settings):
    c = TestClient(create_app(settings))
    c.get("/api/v1/me")  # the bootstrap administrator exists
    return c


def test_an_installation_binding_covers_every_station_and_is_unrestricted(settings, app_client):
    bind(app_client, settings, "otto", "operator", "installation", "*")
    auth = authority(settings, "otto")
    for sid in ("entry-a", "entry-b", "a-station-nobody-knows"):
        assert auth.station(ia.PEOPLE_READ, sid) and auth.station(ia.EVENTS_READ, sid) and auth.station(ia.STATIONS_READ, sid)
        assert not auth.station(ia.PEOPLE_SENSITIVE, sid), "an operator sees names only (owner answer 3)"
    assert auth.unrestricted(ia.PEOPLE_READ) and not auth.unrestricted(ia.PEOPLE_SENSITIVE)
    assert auth.anywhere(ia.EVENTS_READ) and not auth.anywhere(ia.EVENTS_EXPORT)
    assert auth.person_level(["entry-a"]) == ia.NAMES and auth.person_level([]) == ia.NAMES
    assert auth.event_level("entry-a") == ia.NAMES
    assert auth.station_level("entry-a") == ia.TECHNICAL


def test_a_viewer_keeps_the_entry_center_and_nothing_else(settings, app_client):
    bind(app_client, settings, "vera", "viewer", "installation", "*")
    auth = authority(settings, "vera")
    assert auth.station_level("entry-a") == ia.BASIC, "access.read without the technical details"
    assert auth.person_level(["entry-a"]) == ia.NONE and auth.person_level([]) == ia.NONE
    assert auth.event_level("entry-a") == ia.NONE
    assert not auth.anywhere(ia.PEOPLE_READ) and not auth.anywhere(ia.EVENTS_READ)


def test_ids_arx_will_not_evaluate_are_refused(settings, app_client):
    auth = authority(settings, "joni")  # the bootstrap system administrator
    assert auth.station(ia.READ, "entry-a")
    for bad in (None, "", 7, "x" * 129, "bad\nid", {"id": "entry-a"}):
        assert auth.station(ia.READ, bad) is False, bad
        assert auth.event_level(bad) == ia.NONE


def test_a_station_binding_covers_that_station_only(settings, app_client, station_scope):
    station_scope.bind("dev-sara", "operator", "entry-a")
    auth = authority(settings, "sara")
    assert auth.station(ia.PEOPLE_READ, "entry-a") and not auth.station(ia.PEOPLE_READ, "entry-b")
    assert auth.anywhere(ia.PEOPLE_READ) and not auth.unrestricted(ia.PEOPLE_READ)
    assert auth.person_level(["entry-a", "entry-b"]) == ia.NAMES, "visible through entry-a"
    assert auth.person_level(["entry-b"]) == ia.NONE
    assert auth.person_level([]) == ia.NONE, "a person with no assignment belongs to no station: unrestricted principals only"
    assert auth.visible_stations(ia.READ, ["entry-b", "entry-a", "entry-a"]) == ["entry-a"]


def test_deny_on_a_station_overrides_an_installation_allow(settings, app_client, station_scope):
    bind(app_client, settings, "sam", "site_admin", "installation", "*")
    station_scope.bind("dev-sam", "site_admin", "entry-b", effect="deny")
    auth = authority(settings, "sam")
    assert auth.station(ia.PEOPLE_READ, "entry-a") and not auth.station(ia.PEOPLE_READ, "entry-b")
    assert not auth.unrestricted(ia.PEOPLE_READ), "a station deny makes the principal restricted"
    assert auth.person_level(["entry-a"]) == ia.SENSITIVE
    assert auth.person_level(["entry-a", "entry-b"]) == ia.SENSITIVE, "the denied station is not visible, so it does not lower the level"
    assert auth.person_level(["entry-b"]) == ia.NONE
    assert auth.person_level([]) == ia.NONE
    assert auth.person_editable(["entry-a"]) and not auth.person_editable(["entry-a", "entry-b"]), "manage on EVERY station"


def test_the_lowest_level_over_the_visible_stations_wins(settings, app_client, station_scope):
    bind(app_client, settings, "otto", "operator", "installation", "*")
    station_scope.bind("dev-otto", "site_admin", "entry-a")  # sensitive on entry-a only
    auth = authority(settings, "otto")
    assert auth.person_level(["entry-a"]) == ia.SENSITIVE
    assert auth.person_level(["entry-a", "entry-b"]) == ia.NAMES, "names only while any visible station says names"
    assert auth.event_level("entry-a") == ia.SENSITIVE and auth.event_level("entry-b") == ia.NAMES
    assert not auth.unrestricted(ia.PEOPLE_SENSITIVE) and auth.anywhere(ia.PEOPLE_SENSITIVE)


def test_a_placed_station_follows_its_site(settings, app_client, station_scope):
    site = app_client.post("/api/v1/sites", json={"name": "אתר צפון"}).json()["id"]
    bind(app_client, settings, "nora", "operator", "site", site)
    station_scope.place("entry-a", site)
    auth = authority(settings, "nora")
    assert auth.station(ia.PEOPLE_READ, "entry-a") and not auth.station(ia.PEOPLE_READ, "entry-b")
    assert auth.anywhere(ia.PEOPLE_READ) and not auth.unrestricted(ia.PEOPLE_READ)


def test_floor_and_camera_bindings_neither_grant_nor_restrict(settings, app_client):
    tree_site = app_client.post("/api/v1/sites", json={"name": "S"}).json()["id"]
    building = app_client.post(f"/api/v1/sites/{tree_site}/buildings", json={"name": "B"}).json()["id"]
    floor = app_client.post(f"/api/v1/buildings/{building}/floors", json={"name": "F", "level": 1}).json()["id"]
    bind(app_client, settings, "fred", "operator", "floor", floor)
    assert not authority(settings, "fred").anywhere(ia.PEOPLE_READ), "a floor never contains a station"
    bind(app_client, settings, "sam", "site_admin", "installation", "*")
    db = Database(settings.db_path)
    from smplwise.db import new_id, now_iso, permission_revision

    with db.connection() as conn:
        conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) VALUES (?, 'user', 'dev-sam', 'operator', 'floor', ?, 'deny', ?, 'test', ?)",
                     (new_id(), floor, permission_revision(conn), now_iso()))
    assert authority(settings, "sam").unrestricted(ia.PEOPLE_READ), "a floor deny restricts no station"


def test_a_site_deny_counts_as_restricted_even_with_nothing_placed(settings, app_client):
    site = app_client.post("/api/v1/sites", json={"name": "S2"}).json()["id"]
    bind(app_client, settings, "sam", "site_admin", "installation", "*")
    db = Database(settings.db_path)
    from smplwise.db import new_id, now_iso, permission_revision

    with db.connection() as conn:
        conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) VALUES (?, 'user', 'dev-sam', 'operator', 'site', ?, 'deny', ?, 'test', ?)",
                     (new_id(), site, permission_revision(conn), now_iso()))
    auth = authority(settings, "sam")
    assert not auth.unrestricted(ia.PEOPLE_READ), "conservative: a site deny may cover a station placed there"
    assert auth.person_level([]) == ia.NONE


def test_an_inactive_user_gets_nothing(settings, app_client):
    bind(app_client, settings, "otto", "operator", "installation", "*")
    db = Database(settings.db_path)
    with db.connection() as conn:
        conn.execute("UPDATE users SET active = 0 WHERE id = 'dev-otto'")
    auth = authority(settings, "otto")
    assert not auth.anywhere(ia.PEOPLE_READ) and not auth.station(ia.READ, "entry-a") and auth.person_level(["entry-a"]) == ia.NONE


def test_any_error_while_deciding_is_a_refusal(settings, app_client, monkeypatch):
    auth = authority(settings, "joni")

    def boom(*_a: Any, **_k: Any) -> Any:
        raise RuntimeError("database is gone")

    monkeypatch.setattr(rbac, "authorize", boom)
    monkeypatch.setattr(rbac, "_active_bindings", boom)
    assert auth.station(ia.READ, "entry-a") is False
    assert auth.unrestricted(ia.PEOPLE_READ) is False and auth.anywhere(ia.PEOPLE_READ) is False
    assert auth.person_level([]) == ia.NONE and auth.event_level("entry-a") == ia.NONE


def test_decisions_are_never_shared_between_principals(settings, app_client):
    bind(app_client, settings, "vera", "viewer", "installation", "*")
    admin, viewer = authority(settings, "joni"), authority(settings, "vera")
    assert admin.person_level(["entry-a"]) == ia.SENSITIVE
    assert viewer.person_level(["entry-a"]) == ia.NONE, "a second principal's object knows nothing of the first's decisions"


# ---------------------------------------------------------------- the views

STATION_SUPERSET = {
    "id": "entry-a", "name": "Main gate", "online": True, "call_state": "ringing", "sync_state": "error", "lock_enabled": True,
    "locks": [{"physical_index": 1, "name": "Gate"}], "has_camera": True, "camera_entity": "camera.main_gate", "last_seen": "2026-09-27T08:00:00+00:00",
    "zone": {"kind": "iana", "name": "Asia/Jerusalem"},
    "technical": {"loaded": True, "last_error": "device_unavailable", "scan_error": None, "model": "DS-KV6113", "firmware": "V2.2", "capabilities": {"max_users": 500},
                  "clock": None, "event_status": None, "scanned_at": None, "scanning": False, "reconciled_at": None, "last_poll_ms": 40},
}
PERSON_SUPERSET = {
    "id": "u1", "display_name": "Dana", "employee_no": "1001", "active": True, "archived": False, "valid_from": None, "valid_until": "2027-01-01T00:00:00+00:00",
    "revision": 4, "access_category": "staff", "user_type": "normal", "identity_locked": False, "group_ids": ["staff"],
    "assignments": [{"station_id": "entry-a", "enabled": True, "doors": [1], "sync_state": "synced", "last_sync_at": None, "last_error": None},
                    {"station_id": "entry-b", "enabled": False, "doors": [1], "sync_state": "error", "last_sync_at": None, "last_error": "device_unavailable"}],
    "timing": None, "operator_editable": None,
    "phone": "+972500000000", "photo_configured": True, "profile": {"department": "Engineering"}, "responsible_person": "", "access_purpose": "",
}
EVENT_SUPERSET = {
    "id": "ev-2", "station_id": "entry-a", "timestamp": "2026-09-27T07:59:00+03:00", "received_at": "2026-09-27T04:59:01+00:00", "time_source": "device",
    "person_name": "Dana", "employee_no": "1001", "authentication": "card", "result": "granted", "event_type": "access_granted", "recovered": False, "door": 1,
    "evidence": {"identity_state": "identified"}, "source_identity": None, "portrait_ref": {"user_id": "u1", "revision": 1},
}


def set_policy(settings: Any, **values: str) -> None:
    """Write the CR-036 owner-answer settings straight to the test database (keys with dots: pass them as a dict)."""
    db = Database(settings.db_path)
    with db.connection() as conn:
        for key, value in values.items():
            conn.execute("INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", (key.replace("__", "."), value))


def test_station_view_by_level(settings, app_client):
    bind(app_client, settings, "vera", "viewer", "installation", "*")
    bind(app_client, settings, "otto", "operator", "installation", "*")
    full = ia.view_station(authority(settings, "joni"), STATION_SUPERSET)
    assert full["technical"]["model"] == "DS-KV6113" and full["errors"] == {"last_error": "device_unavailable", "scan_error": None}
    basic = ia.view_station(authority(settings, "vera"), STATION_SUPERSET)
    assert basic["technical"] is None and basic["errors"] is None and basic["online"] is True and "DS-KV6113" not in json.dumps(basic)
    assert basic["call_state"] == "ringing", "answer 3 (2026-10-12): the call hint is shown to everyone who sees the station"
    operator = ia.view_station(authority(settings, "otto"), STATION_SUPERSET)
    assert operator["technical"]["model"] == "DS-KV6113" and operator["sync_state"] == "error" and operator["errors"] is None, "answer 5: no error text for an operator"
    assert ia.view_station(authority(settings, "nobody"), STATION_SUPERSET) is None
    full["locks"].append("x")
    assert STATION_SUPERSET["locks"] == [{"physical_index": 1, "name": "Gate"}], "a view is a detached copy"


def test_person_view_by_level(settings, app_client, station_scope):
    bind(app_client, settings, "otto", "operator", "installation", "*")
    station_scope.bind("dev-sara", "operator", "entry-a")
    admin = ia.view_person(authority(settings, "joni"), PERSON_SUPERSET)
    assert admin["level"] == ia.SENSITIVE and admin["employee_no"] == "1001" and admin["phone"] == "+972500000000" and admin["editable"] is True
    assert admin["stations"][1]["last_error"] == "device_unavailable"
    operator = ia.view_person(authority(settings, "otto"), PERSON_SUPERSET)
    text = json.dumps(operator, ensure_ascii=False)
    assert operator["level"] == ia.NAMES and operator["display_name"] == "Dana" and operator["editable"] is False
    assert operator["employee_no"] == "1001", "answer 2 (2026-10-12): the employee number is a names-level field"
    assert operator["stations"][1]["sync_state"] == "error" and operator["stations"][1]["last_error"] is None, "answer 5"
    for private in ("+972500000000", "Engineering", "device_unavailable"):
        assert private not in text, private
    sara = ia.view_person(authority(settings, "sara"), PERSON_SUPERSET)
    assert [a["station_id"] for a in sara["stations"]] == ["entry-a"], "the out-of-scope assignment is omitted, not greyed"
    assert "entry-b" not in json.dumps(sara)
    assert ia.view_person(authority(settings, "sara"), {**PERSON_SUPERSET, "assignments": [PERSON_SUPERSET["assignments"][1]]}) is None
    unknown = {**PERSON_SUPERSET, "assignments": None}
    assert ia.view_person(authority(settings, "sara"), unknown) is None, "unknown assignments: unrestricted principals only"
    assert ia.view_person(authority(settings, "joni"), unknown)["stations"] is None, "unknown stays unknown, never an empty list"
    assert ia.view_person(authority(settings, "joni"), {**PERSON_SUPERSET, "operator_editable": False})["editable"] is False


def test_the_administrator_settings_move_the_fields_back(settings, app_client):
    bind(app_client, settings, "otto", "operator", "installation", "*")
    set_policy(settings, **{"access.employee_no_sensitive": "true", "access.event_portrait_sensitive": "true", "access.sync_errors_everyone": "true"})
    auth = authority(settings, "otto")
    person = ia.view_person(auth, PERSON_SUPERSET)
    assert person["employee_no"] is None and person["stations"][1]["last_error"] == "device_unavailable"
    assert ia.view_person(auth, PERSON_SUPERSET, legacy=True)["employee_no"] is None
    event = ia.view_event(auth, EVENT_SUPERSET)
    assert event["employee_no"] is None and event["portrait"] is None
    assert ia.view_station(auth, STATION_SUPERSET)["errors"]["last_error"] == "device_unavailable"
    assert not auth.employee_no_everywhere()
    admin = authority(settings, "joni")
    assert ia.view_event(admin, EVENT_SUPERSET)["employee_no"] == "1001" and ia.view_event(admin, EVENT_SUPERSET)["portrait"] is True


def test_an_unreadable_setting_takes_the_safe_choice(settings, app_client):
    bind(app_client, settings, "otto", "operator", "installation", "*")
    set_policy(settings, **{"access.employee_no_sensitive": "maybe", "access.event_portrait_sensitive": "", "access.event_portrait_audit": "0", "access.sync_errors_everyone": "yes"})
    auth = authority(settings, "otto")
    assert auth.policy(ia.EMPLOYEE_NO_SENSITIVE) is True and auth.policy(ia.PORTRAIT_SENSITIVE) is True
    assert auth.policy(ia.PORTRAIT_AUDIT) is True and auth.policy(ia.SYNC_ERRORS_EVERYONE) is False


def test_the_settings_are_product_settings(settings, app_client):
    body = app_client.get("/api/v1/settings").json()["settings"]
    assert {k: body[k] for k in ia.POLICY_DEFAULTS} == {
        "access.employee_no_sensitive": "false", "access.event_portrait_sensitive": "false", "access.event_portrait_audit": "true", "access.sync_errors_everyone": "false",
        "access.unknown_person_uniform_404": "true",  # SECFIX2-295, default on since the owner decision 2026-10-21 (FABLEFIX-295)
    }
    r = app_client.patch("/api/v1/settings", json={"access.employee_no_sensitive": "true", "access.event_portrait_audit": "false"})
    assert r.status_code == 200 and r.json()["settings"]["access.employee_no_sensitive"] == "true"
    assert app_client.patch("/api/v1/settings", json={"access.sync_errors_everyone": "sometimes"}).status_code == 422
    bind(app_client, settings, "otto", "operator", "installation", "*")
    assert app_client.patch("/api/v1/settings", json={"access.employee_no_sensitive": "false"}, headers=as_user("otto")).status_code == 403


def test_legacy_person_view_keeps_the_phase1b_shape(settings, app_client):
    bind(app_client, settings, "vera", "viewer", "installation", "*")
    bind(app_client, settings, "otto", "operator", "installation", "*")
    admin = ia.view_person(authority(settings, "joni"), PERSON_SUPERSET, legacy=True)
    assert set(admin) == {"id", "employee_no", "display_name", "active", "valid_from", "valid_until", "revision", "group_ids", "stations"}
    assert admin["employee_no"] == "1001" and admin["stations"][0] == {"station_id": "entry-a", "enabled": True, "doors": [1], "sync_state": "synced"}
    assert ia.view_person(authority(settings, "otto"), PERSON_SUPERSET, legacy=True)["employee_no"] == "1001", "answer 2 of 2026-10-12"
    assert ia.view_person(authority(settings, "vera"), PERSON_SUPERSET, legacy=True) is None, "a viewer holds no access.people.read"


def test_event_view_by_level(settings, app_client, station_scope):
    bind(app_client, settings, "otto", "operator", "installation", "*")
    station_scope.bind("dev-sara", "operator", "entry-b")
    admin = ia.view_event(authority(settings, "joni"), EVENT_SUPERSET, detail=True)
    assert admin["employee_no"] == "1001" and admin["portrait"] is True and admin["person_name"] == "Dana" and admin["evidence"] == {"identity_state": "identified"}
    operator = ia.view_event(authority(settings, "otto"), EVENT_SUPERSET, detail=True)
    assert operator["employee_no"] == "1001" and operator["portrait"] is True, "answers 2 and 4 of 2026-10-12: the events view is enough"
    assert ia.view_event(authority(settings, "otto"), {**EVENT_SUPERSET, "portrait_ref": None})["portrait"] is False
    assert ia.view_event(authority(settings, "sara"), EVENT_SUPERSET) is None, "another station's event is omitted"
    assert ia.view_event(authority(settings, "joni"), {**EVENT_SUPERSET, "station_id": None}) is None, "a row without a station is dropped"
    row = ia.view_event(authority(settings, "joni"), EVENT_SUPERSET)
    assert "evidence" not in row and "portrait_ref" not in row and "u1" not in json.dumps(row), "the list row carries no detail fields and no person id"


def test_the_gate_audits_a_refusal(settings, app_client):
    bind(app_client, settings, "vera", "viewer", "installation", "*")
    db = Database(settings.db_path)
    with db.connection() as conn:
        principal = Principal(user_id="dev-vera", username="vera", display_name="vera", source="dev")
        with pytest.raises(Exception) as exc:
            ia.require_anywhere(conn, principal, ia.PEOPLE_READ)
        assert getattr(exc.value, "status", None) == 403
    with db.connection() as conn:
        row = conn.execute("SELECT action, decision, actor_user_id FROM audit_log WHERE action = ? ORDER BY at DESC LIMIT 1", (ia.PEOPLE_READ,)).fetchone()
    assert row is not None and row["decision"] == "denied" and row["actor_user_id"] == "dev-vera"
