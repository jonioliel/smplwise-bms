"""LEASE-BUILD slice L6 (CR-WISKEY-LEASE-REVOCATION-EVENT section 5, test N15): the C03 lookup decision and its one setting
`access.lookup_scope` (`holder` default | `holder_or_audit_readers`). Negative first: non-admin refused and audited, the wider
value needs the confirmation word, explicit deny wins under both values, a restore never loosens it."""
from __future__ import annotations

import json
import zipfile

import pytest
from fastapi.testclient import TestClient

from conftest import as_user, bind

from smplwise.db import Database, bump_permission_revision, new_id, now_iso, permission_revision, set_setting
from smplwise.main import create_app
from smplwise.rbac import Principal
from smplwise.services import capture_lease as cl
from smplwise.services import intercom_authority as ia

STATION = ia.STATION_SCOPE


def _p(name: str) -> Principal:
    return Principal(f"dev-{name}", name, name, "dev")


def _custom_role(db: Database, role_id: str, perms: list[str]) -> None:
    with db.connection() as conn:
        conn.execute("INSERT INTO custom_roles(id, name_he, permissions_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", (role_id, role_id, json.dumps(perms), now_iso(), now_iso()))
        bump_permission_revision(conn)


def _deny(db: Database, user: str, role: str, scope: tuple[str, str]) -> None:
    with db.connection() as conn:
        conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) VALUES (?, 'user', ?, ?, ?, ?, 'deny', ?, 'test', ?)",
                     (new_id(), f"dev-{user}", role, scope[0], scope[1], permission_revision(conn), now_iso()))
        bump_permission_revision(conn)


@pytest.fixture()
def world(settings):
    cl.reset_for_tests()
    c = TestClient(create_app(settings))
    for u in ("joni", "sam", "aud", "dina", "vera"):
        c.get("/api/v1/me", headers=as_user(u))
    bind(c, settings, "sam", "site_admin", "installation", "*")  # holds capture + people.manage everywhere
    bind(c, settings, "vera", "viewer", "installation", "*")
    db = Database(settings.db_path)
    _custom_role(db, "auditor_x", ["audit.read"])
    bind(c, settings, "aud", "auditor_x", "installation", "*")
    bind(c, settings, "dina", "site_admin", "installation", "*")
    bind(c, settings, "dina", "auditor_x", "installation", "*")
    _deny(db, "dina", "site_admin", (STATION, "entry-a"))  # an explicit deny of the original permission on the target
    yield c, db
    cl.reset_for_tests()


def decide(db: Database, who: str, action: str = "cards/capture_start", target: str = "entry-a") -> bool:
    with db.connection() as conn:
        return ia.lookup_allowed(conn, _p(who), action, target, "rev-7")


def test_n15_non_admin_cannot_change_the_setting_and_is_audited(world):
    c, db = world
    r = c.put("/api/v1/access/capture-lease/settings", json={"lookup_scope": "holder_or_audit_readers", "lookup_scope_confirm": cl.LOOKUP_WIDE_WORD}, headers=as_user("sam"))
    assert r.status_code == 403
    with db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE decision = 'denied' AND actor_username = 'sam'").fetchone()[0] >= 1
        assert cl.lookup_scope(conn) == "holder"
    assert c.get("/api/v1/access/capture-lease/settings", headers=as_user("vera")).status_code == 403


def test_n15_wider_value_needs_the_confirmation_word_and_is_audited_before_after(world):
    c, db = world
    r = c.put("/api/v1/access/capture-lease/settings", json={"lookup_scope": "holder_or_audit_readers"}, headers=as_user("joni"))
    assert r.status_code == 422 and r.json()["code"] == "confirm_required"
    r = c.put("/api/v1/access/capture-lease/settings", json={"lookup_scope": "holder_or_audit_readers", "lookup_scope_confirm": "yes"}, headers=as_user("joni"))
    assert r.status_code == 422
    r = c.put("/api/v1/access/capture-lease/settings", json={"lookup_scope": "holder_or_audit_readers", "lookup_scope_confirm": cl.LOOKUP_WIDE_WORD}, headers=as_user("joni"))
    assert r.status_code == 200 and r.json()["lookup_scope"] == "holder_or_audit_readers"
    with db.connection(mode="read") as conn:
        row = conn.execute("SELECT details_json FROM audit_log WHERE action = 'settings.changed' AND decision = 'allowed' ORDER BY rowid DESC LIMIT 1").fetchone()
        stored = conn.execute("SELECT COUNT(*) FROM settings WHERE value = ?", (cl.LOOKUP_WIDE_WORD,)).fetchone()[0]
    assert json.loads(row[0]) == {"key": cl.LOOKUP_KEY, "before": "holder", "after": "holder_or_audit_readers"}
    assert stored == 0, "the confirmation word is never stored"
    r = c.put("/api/v1/access/capture-lease/settings", json={"lookup_scope": "holder"}, headers=as_user("joni"))
    assert r.status_code == 200 and r.json()["lookup_scope"] == "holder", "narrowing needs no word"
    r = c.put("/api/v1/access/capture-lease/settings", json={"lookup_scope": "everyone"}, headers=as_user("joni"))
    assert r.status_code == 422


def test_n15_holder_default_decides_by_the_original_actions_permission(world):
    c, db = world
    assert decide(db, "sam") is True
    assert decide(db, "joni") is True
    assert decide(db, "vera") is False
    assert decide(db, "aud") is False, "an audit reader is not a holder under the default"
    assert decide(db, "sam", "users/update") is True
    assert decide(db, "sam", "stations/reboot") is False, "an action outside the closed table is refused"
    assert decide(db, "sam", "cards/capture_start", "x" * 200) is False
    assert decide(db, "sam", "door_open") is False, "door actions decide by the door authority (sam holds no door grant)"


def test_n15_wider_value_admits_audit_readers_and_explicit_deny_still_wins(world):
    c, db = world
    assert decide(db, "dina") is False, "explicit deny refuses under holder"
    with db.connection() as conn:
        set_setting(conn, cl.LOOKUP_KEY, "holder_or_audit_readers")
    assert decide(db, "aud") is True
    assert decide(db, "vera") is False
    assert decide(db, "dina") is False, "explicit deny refuses under the wider value too (deny-overrides)"
    assert decide(db, "dina", target="entry-b") is True, "the deny is on entry-a only"
    with db.connection(mode="read") as conn:
        rows = conn.execute("SELECT decision, reason, details_json FROM audit_log WHERE action = 'intercom.lookup.decide' ORDER BY rowid").fetchall()
    assert rows and {json.loads(r[2])["basis"] for r in rows} >= {"holder", "audit_reader", "explicit_deny"}
    for r in rows:
        assert set(json.loads(r[2])) == {"original_action", "basis", "binding_revision"}


def test_garbage_setting_value_reads_as_holder(world):
    c, db = world
    with db.connection() as conn:
        set_setting(conn, cl.LOOKUP_KEY, "HOLDER_OR_AUDIT_READERS")
    assert decide(db, "aud") is False


def test_n15_restore_never_loosens_the_lease_settings_and_reports_the_dropped_value(world, settings):
    from smplwise.services import backup

    c, db = world
    with db.connection() as conn:
        entry = backup.create(settings, conn, "manual", include_access=False)
    path = backup.backups_dir(settings) / entry["name"]
    # an archive (hand-made or from an older build) that carries the WIDER value and the route switched on
    tampered = path.with_name("tampered-" + path.name)
    with zipfile.ZipFile(path) as src, zipfile.ZipFile(tampered, "w") as dst:
        for item in src.infolist():
            data = src.read(item.filename)
            if item.filename == "data/settings.json":
                rows = json.loads(data.decode("utf-8"))
                rows += [{"key": cl.LOOKUP_KEY, "value": "holder_or_audit_readers"}, {"key": cl.FLAG_KEY, "value": "on"}, {"key": cl.SECONDS_KEY, "value": "60"}]
                data = json.dumps(rows, ensure_ascii=False).encode("utf-8")
            dst.writestr(item, data)
    with db.connection() as conn:
        report = backup.restore(settings, conn, tampered, mode="replace", scope="project")
    assert report["capture_lease_settings"]["dropped"] == {cl.LOOKUP_KEY: "holder_or_audit_readers", cl.FLAG_KEY: "on", cl.SECONDS_KEY: "60"}
    with db.connection(mode="read") as conn:
        assert cl.lookup_scope(conn) == "holder" and cl.mode(conn) == "off" and cl.lease_seconds(conn) == 120
    assert {cl.FLAG_KEY, cl.SECONDS_KEY, cl.LOOKUP_KEY} <= backup.SETTINGS_KEEP


def test_n15_system_configure_without_system_admin_is_refused_not_system_admin(world, settings):
    c, db = world
    _custom_role(db, "cfg_x", ["system.configure"])
    c.get("/api/v1/me", headers=as_user("cfgu"))
    bind(c, settings, "cfgu", "cfg_x", "installation", "*")
    for body in ({"lookup_scope": "holder_or_audit_readers", "lookup_scope_confirm": cl.LOOKUP_WIDE_WORD}, {"capture_lease": "off"}, {"clock_reenable": True}):
        r = c.put("/api/v1/access/capture-lease/settings", json=body, headers=as_user("cfgu"))
        assert r.status_code == 403 and r.json()["code"] == "not_system_admin", r.text
    with db.connection(mode="read") as conn:
        n = conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'settings.changed' AND decision = 'denied' AND reason = 'not_system_admin' AND actor_username = 'cfgu'").fetchone()[0]
        assert n == 3 and cl.lookup_scope(conn) == "holder"


def test_l6_reading_the_settings_needs_a_system_administrator_too(world, settings):
    c, db = world
    _custom_role(db, "cfg_y", ["system.configure"])
    c.get("/api/v1/me", headers=as_user("cfgv"))
    bind(c, settings, "cfgv", "cfg_y", "installation", "*")
    r = c.get("/api/v1/access/capture-lease/settings", headers=as_user("cfgv"))
    assert r.status_code == 403 and r.json()["code"] == "not_system_admin", r.text
    r = c.put("/api/v1/access/capture-lease/settings", json={"degraded_reenable": True}, headers=as_user("cfgv"))
    assert r.status_code == 403 and r.json()["code"] == "not_system_admin", r.text
    assert c.get("/api/v1/access/capture-lease/settings", headers=as_user("joni")).status_code == 200
