"""CR-ACTIVE-USER-REST-2438 - the remaining local "active" checks use the ONE definition (services/active_users, owner decision O16 a).

For every place: a user disabled on the Home Assistant side only (`ha_users.is_active = 0`, `users.active` still 1 - the case the old
local checks let through) is refused; an active user passes the active step; a local (Arx-only) user without an `ha_users` row keeps
working; the service identity (a Home Assistant user with no Arx row) is never made "active" where an Arx account is required.
Places too heavy to drive here (the access-grants approver re-check, the partner token view, the presence device token, the schedule
owner issue) are held by the no-drift guard at the end, which fails if any module reads `users.active` for one id on its own again.
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest
from conftest import as_user, bind

from smplwise.db import Database, new_id, now_iso, permission_revision
from smplwise.rbac import Principal
from smplwise.services import active_users

API = "/api/v1"
SVC = "0123456789abcdef0123456789abcdef"  # a service-identity-shaped HA user: in ha_users, never in users


def _conn(settings):
    return Database(settings.db_path).connection()


def _p(uid: str, source: str = "dev") -> Principal:
    return Principal(user_id=uid, username=uid, display_name=uid, source=source)


def _ha(conn, uid: str, active: bool) -> None:
    conn.execute("INSERT OR REPLACE INTO ha_users(id, name, username, is_active, is_admin, synced_at) VALUES (?, ?, ?, ?, 0, ?)",
                 (uid, uid, uid, 1 if active else 0, now_iso()))


def _local(conn, uid: str = "l_rina") -> str:
    now = now_iso()
    conn.execute("INSERT OR REPLACE INTO users(id, username, display_name, source, active, first_seen_at, last_seen_at) VALUES (?, ?, ?, 'local', 1, ?, ?)",
                 (uid, uid, uid, now, now))
    return uid


def _bind(conn, uid: str, role: str) -> None:
    conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) "
                 "VALUES (?, 'user', ?, ?, 'installation', '*', 'allow', ?, 'test', ?)", (new_id(), uid, role, permission_revision(conn), now_iso()))


@pytest.fixture()
def people(client, settings):
    """dev-on (active both sides), dev-haoff (HA side disabled only), l_rina (local, no ha_users row), SVC (HA only)."""
    for u in ("on", "haoff"):
        client.get(f"{API}/me", headers=as_user(u))
    with _conn(settings) as conn:
        _ha(conn, "dev-on", True)
        _ha(conn, "dev-haoff", False)
        _local(conn)
        _ha(conn, SVC, True)
    return {"on": "dev-on", "off": "dev-haoff", "local": "l_rina", "svc": SVC}


def test_the_two_helpers(settings, people):
    with _conn(settings) as conn:
        assert [active_users.is_disabled(conn, people[k]) for k in ("on", "off", "local", "svc")] == [False, True, False, False]
        assert [active_users.has_active_account(conn, people[k]) for k in ("on", "off", "local", "svc")] == [True, False, True, False]
        assert active_users.is_disabled(conn, "nobody") is False and active_users.has_active_account(conn, "nobody") is False


# ---------------------------------------------------------------- /me

def test_me_reports_an_ha_disabled_user_as_inactive(client, settings, people):
    assert client.get(f"{API}/me", headers=as_user("on")).json()["active"] is True
    assert client.get(f"{API}/me", headers=as_user("haoff")).json()["active"] is False


# ---------------------------------------------------------------- the door rule, windows / emergency controls, the armer

def test_door_rule(settings, people, monkeypatch):
    from smplwise.services import door_authority, service_identity

    with _conn(settings) as conn:
        assert door_authority.check(conn, _p(people["off"]), "st-1", dev_mode=True).reason == "user_inactive"
        assert door_authority.check(conn, _p(people["on"]), "st-1", dev_mode=True).reason != "user_inactive"
        monkeypatch.setattr(service_identity, "local_door_ok", lambda conn, principal: True)  # the extended mode that admits a local user
        assert door_authority.check(conn, _p(people["local"], "local"), "st-1").reason not in ("user_inactive", "identity_unmapped")


def test_window_and_emergency_person_rule(settings, people, monkeypatch):
    from smplwise.services import door_windows, service_identity

    with _conn(settings) as conn:
        assert door_windows.identity_refusal(conn, _p(people["off"]), dev_mode=True) == "user_inactive"
        assert door_windows.identity_refusal(conn, _p(people["on"]), dev_mode=True) is None
        monkeypatch.setattr(service_identity, "local_door_ok", lambda conn, principal: True)
        assert door_windows.identity_refusal(conn, _p(people["local"], "local")) is None, "a local user keeps working"


def test_window_approver_and_trigger_actor(settings, people):
    from smplwise.services import door_window_triggers

    with _conn(settings) as conn:
        assert door_window_triggers._actor_ok(conn, people["off"], []) is False
        assert door_window_triggers._actor_ok(conn, people["on"], []) is True
        assert door_window_triggers._actor_ok(conn, people["local"], []) is True
        assert door_window_triggers._actor_ok(conn, people["svc"], []) is False, "the service identity is not an Arx person"


def test_automation_armer(settings, people):
    from smplwise.services import door_automation

    door = {"station_id": "st-1", "relay": 1}
    with _conn(settings) as conn:
        assert door_automation.armer_reason(conn, _p(people["off"]), door, True) == "user_inactive"
        assert door_automation.armer_reason(conn, _p(people["on"]), door, True) != "user_inactive"


def test_door_path_and_auto_door_principal_and_parity(settings, people):
    from smplwise.services import door_path, intercom_parity, wiskey_auto_door

    with _conn(settings) as conn:
        for uid, want in ((people["off"], False), (people["on"], True), (people["local"], True), (people["svc"], False)):
            assert door_path._user_active(conn, uid)[0] is want, uid
            assert (wiskey_auto_door._principal(conn, uid) is not None) is want, uid
            assert (intercom_parity.principal_of(conn, uid) is not None) is want, uid


# ---------------------------------------------------------------- emergency readiness

def test_emergency_view_and_reachable_contacts(settings, people):
    from smplwise.services.emergency import access as em_access, engine

    with _conn(settings) as conn:
        for uid in (people["on"], people["off"], people["local"]):
            _bind(conn, uid, "viewer")
    with _conn(settings) as conn:
        assert em_access.Viewer(conn, _p(people["off"])).held == frozenset()
        assert em_access.Viewer(conn, _p(people["on"])).held
        assert em_access.Viewer(conn, _p(people["local"], "local")).held, "a local user keeps working"
        now = now_iso()
        for uid in (people["on"], people["off"], people["svc"]):
            conn.execute("INSERT INTO emergency_contacts(id, display_name, user_id, created_by, created_at, updated_at) VALUES (?, ?, ?, 'test', ?, ?)",
                         (new_id(), uid, uid, now, now))
        reach, _verified = engine._reachable_contacts(engine.Ctx(conn, None))
    assert reach == 1, "only the active Arx account is a reachable route"


def test_maintenance_viewer(settings, people):
    from smplwise.services.maintenance import access as m_access

    with _conn(settings) as conn:
        _bind(conn, people["off"], "viewer")
        _bind(conn, people["on"], "viewer")
    with _conn(settings) as conn:
        assert m_access.Viewer(conn, _p(people["off"])).anywhere == frozenset()
        assert m_access.Viewer(conn, _p(people["on"])).anywhere


# ---------------------------------------------------------------- remote channel, bridge key contacts, access grants recovery

def test_remote_channel_policy(settings, people):
    from smplwise.services import ha_user_auth

    with _conn(settings) as conn:
        err = ha_user_auth.policy_refusal(conn, _p(people["off"], "remote"), None)
        assert err is not None and err.code == "remote_user_inactive"
        conn.execute("UPDATE users SET active = 0 WHERE id = ?", (people["on"],))
        err = ha_user_auth.policy_refusal(conn, _p(people["on"], "remote"), None)
        assert err is not None and err.code == "remote_user_inactive", "the users side still counts"


def test_bridge_key_owner_contacts(client, settings, people):
    from smplwise.services import bridge_key_notice

    bind(client, settings, "haoff", "system_admin", "installation", "*")
    bind(client, settings, "on", "system_admin", "installation", "*")
    with _conn(settings) as conn:
        assert bridge_key_notice.eligible(conn, people["on"]) is True
        assert bridge_key_notice.eligible(conn, people["off"]) is False
        assert bridge_key_notice.eligible(conn, people["svc"]) is False


def test_access_grants_recovery_actor_is_refused_when_ha_disabled(client, settings, people):
    """The private recovery helper refuses an administrator who is disabled on the HA side (it read users.active only)."""
    from smplwise.errors import ApiError
    from smplwise.services import access_grants

    bind(client, settings, "haoff", "system_admin", "installation", "*")
    with pytest.raises(ApiError) as e:
        access_grants._attach_recovered_person(Database(settings.db_path), "g-none", "op-1", "wk-person-1", actor=_p(people["off"]),
                                               evidence_ref="evidence:0001")
    assert e.value.code == "actor_inactive"


def test_notification_recipient_lists_follow_the_one_rule(client, settings, people):
    """CR-W2-FOLLOWUPS-2441: the notify module's lists of active users are the one rule's Arx accounts (the list form of
    has_active_account) - the same people as `users.active = 1` whenever the two sides agree, minus the HA-disabled otherwise."""
    from smplwise.services import active_users, notify, notify_recipients, notify_visibility

    with _conn(settings) as conn:
        ids = active_users.active_account_ids(conn)
        every = [r[0] for r in conn.execute("SELECT id FROM users ORDER BY id").fetchall()]
        assert ids == [u for u in every if active_users.has_active_account(conn, u)]
        assert people["on"] in ids and people["local"] in ids and people["off"] not in ids and people["svc"] not in ids
        assert notify._active_users(conn) == ids
        assert notify_recipients.active_user_ids(conn) == set(ids)
        assert notify_recipients.Known.read(conn).active_users == set(ids)
        assert [p.user_id for p in notify_visibility.active_principals(conn)] == ids
        assert [p.user_id for p in notify._active_principals(conn)] == ids
        assert notify_recipients.expand(conn, {"users": [people["on"], people["off"], people["svc"]]}, ()) == [people["on"]]
        # the two sides agree again: exactly the list the module read before
        conn.execute("UPDATE ha_users SET is_active = 1 WHERE id = ?", (people["off"],))
        before = [r[0] for r in conn.execute("SELECT id FROM users WHERE active = 1 ORDER BY id").fetchall()]
        assert active_users.active_account_ids(conn) == before and people["off"] in before
        assert [p.user_id for p in notify_visibility.active_principals(conn)] == before
        conn.execute("UPDATE users SET active = 0 WHERE id = ?", (people["on"],))
        assert people["on"] not in active_users.active_account_ids(conn)


def test_the_notify_module_builds_no_active_user_list_of_its_own():
    root = Path(__file__).resolve().parents[1] / "smplwise" / "services"
    pat = re.compile(r"FROM users WHERE active = 1")
    hits = [name for name in ("notify.py", "notify_recipients.py", "notify_visibility.py") if pat.search((root / name).read_text(encoding="utf-8"))]
    assert hits == [], hits


# ---------------------------------------------------------------- the no-drift guard

def test_no_module_reads_users_active_for_one_id_on_its_own():
    """Every per-id "is this user active" read goes through services/active_users (one definition). Lists of active users
    (`WHERE active = 1` over all users: recipients, pickers) are a separate follow-up and not matched here."""
    root = Path(__file__).resolve().parents[1] / "smplwise"
    pat = re.compile(r"SELECT active FROM users WHERE id")
    hits = [f"{p.relative_to(root)}" for p in root.rglob("*.py") if p.name != "active_users.py" and pat.search(p.read_text(encoding="utf-8"))]
    assert hits == [], hits
