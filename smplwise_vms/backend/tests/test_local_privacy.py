"""IDENT146 (docs/changes/CR-IDENT146.md): purge of local accounts disabled / deleted for 30 days, and the personal data export.

Threshold first (exactly at N days, not one second before), the switch off by default, audit rows never touched, other people's rows never
touched, the export allow-list (no hash / token / key material, no other person's data), the permission matrix. Fakes only."""
from __future__ import annotations

import datetime as dt
import json

import pytest

from test_local_identity import GOOD, Lx, lx  # noqa: F401 - the fixture
from smplwise.services import local_privacy as lpv

T0 = dt.datetime(2026, 9, 1, 12, 0, 0, tzinfo=dt.timezone.utc)


def iso(t: dt.datetime) -> str:
    return t.strftime("%Y-%m-%dT%H:%M:%SZ")


@pytest.fixture(autouse=True)
def _fresh():
    lpv.reset_for_tests()
    yield
    lpv.reset_for_tests()


def sql(lx, stmt: str, args=()) -> None:
    with lx.db.connection() as conn:
        conn.execute(stmt, args)


def settings_on(lx, **kv) -> None:
    r = lx.admin.patch("/api/v1/settings", json=kv)
    assert r.status_code == 200, r.text


def seed_person(lx, name: str) -> tuple[str, object]:
    """A signed-in local person with personal rows in several tables."""
    created, client = lx.ready(name)
    uid = created["user"]["id"]
    sql(lx, "INSERT INTO user_prefs(user_id, key, value_json, updated_at) VALUES(?, 'theme', '\"dark\"', ?)", (uid, iso(T0)))
    sql(lx, "INSERT INTO push_prefs(user_id, categories_json, quiet_json, updated_at) VALUES(?, '{}', '{}', ?)", (uid, iso(T0)))
    sql(lx, "INSERT INTO notify_known_devices(user_id, device_hash, first_seen_at) VALUES(?, 'abcdef0123456789', ?)", (uid, iso(T0)))
    sql(lx, "INSERT INTO ticket_saved_views(id, user_id, name, view_json, created_at, updated_at) VALUES(?, ?, 'mine', '{}', ?, ?)",
        ("tsv_" + name, uid, iso(T0), iso(T0)))
    sql(lx, """INSERT INTO auth_webauthn_credentials(id, user_id, credential_id, public_key, alg, label, rp_id, created_at)
               VALUES(?, ?, ?, 'PUBLICKEYMATERIAL', -7, 'my key', 'arx.test', ?)""", ("pk_" + name, uid, "CREDID-" + name, iso(T0)))
    return uid, client


def disable(lx, uid: str, at: dt.datetime, *, deleted: dt.datetime | None = None) -> None:
    sql(lx, "UPDATE users SET active = 0, disabled_at = ?, deleted_at = ? WHERE id = ?", (iso(at), iso(deleted) if deleted else None, uid))


def user(lx, uid: str) -> dict:
    return lx.rows("SELECT * FROM users WHERE id = ?", (uid,))[0]


def count(lx, table: str, col: str, uid: str) -> int:
    return lx.rows(f"SELECT COUNT(*) AS n FROM {table} WHERE {col} = ?", (uid,))[0]["n"]


# ---------------------------------------------------------------- settings

def test_defaults_are_off_and_days_cannot_go_below_30(lx):
    s = lx.admin.get("/api/v1/settings").json()["settings"]
    assert s["privacy.local_purge"] == "off" and s["privacy.personal_export"] == "off" and s["privacy.local_purge_days"] == 30
    assert lx.admin.patch("/api/v1/settings", json={"privacy.local_purge_days": 29}).status_code == 422
    settings_on(lx, **{"privacy.local_purge_days": 45})
    assert lx.admin.get("/api/v1/settings").json()["settings"]["privacy.local_purge_days"] == 45


# ---------------------------------------------------------------- purge

def test_nothing_is_purged_while_the_switch_is_off(lx):
    lx.enable()
    uid, _ = seed_person(lx, "maria")
    disable(lx, uid, T0)
    assert lpv.run(lx.db, now=T0 + dt.timedelta(days=400)) == {"purged": 0}
    assert user(lx, uid)["purged_at"] is None and count(lx, "user_prefs", "user_id", uid) == 1


def test_purge_exactly_at_the_threshold_and_not_a_second_before(lx):
    lx.enable()
    settings_on(lx, **{"privacy.local_purge": "on"})
    uid, _ = seed_person(lx, "maria")
    disable(lx, uid, T0)
    just_before = T0 + dt.timedelta(days=30) - dt.timedelta(seconds=1)
    assert lpv.run(lx.db, now=just_before) == {"purged": 0}
    assert user(lx, uid)["purged_at"] is None and count(lx, "auth_webauthn_credentials", "user_id", uid) == 1
    assert lpv.run(lx.db, now=T0 + dt.timedelta(days=30)) == {"purged": 1}
    assert user(lx, uid)["purged_at"] is not None
    assert lpv.run(lx.db, now=T0 + dt.timedelta(days=60)) == {"purged": 0}  # once


def test_purge_removes_personal_rows_anonymises_the_tombstone_and_keeps_audit(lx):
    lx.enable()
    settings_on(lx, **{"privacy.local_purge": "on"})
    uid, _ = seed_person(lx, "maria")
    other, _c = seed_person(lx, "nadav")
    lx.admin.patch(f"/api/v1/identity/local-users/{uid}", json={"email": "maria@example.org", "notes": "night shift"})
    lx.admin.delete(f"/api/v1/identity/local-users/{uid}")
    audit_before = lx.rows("SELECT COUNT(*) AS n FROM audit_log WHERE actor_user_id = ? OR resource_id = ?", (uid, uid))[0]["n"]
    assert audit_before > 0
    deleted_at = user(lx, uid)["deleted_at"]
    when = dt.datetime.strptime(deleted_at[:19], "%Y-%m-%dT%H:%M:%S").replace(tzinfo=dt.timezone.utc) + dt.timedelta(days=30)
    assert lpv.run(lx.db, now=when) == {"purged": 1}
    for table, col in (("user_prefs", "user_id"), ("push_prefs", "user_id"), ("notify_known_devices", "user_id"), ("ticket_saved_views", "user_id"),
                       ("auth_webauthn_credentials", "user_id"), ("auth_local_credentials", "user_id"), ("auth_local_sessions", "user_id"),
                       ("auth_local_links", "user_id")):
        assert count(lx, table, col, uid) == 0, table
    row = user(lx, uid)
    assert row["username"].startswith("purged-") and row["display_name"] == lpv.ANON_NAME
    assert row["email"] is None and row["notes"] is None and row["active"] == 0 and row["purged_at"]
    assert "maria" not in json.dumps(row).lower() and "maria@example.org" not in json.dumps(row)
    # legal-hold style exclusion: audit rows are untouched, plus exactly one purge row (ids and counts only)
    assert lx.rows("SELECT COUNT(*) AS n FROM audit_log WHERE (actor_user_id = ? OR resource_id = ?) AND action <> ?", (uid, uid, lpv.AUDIT_PURGED))[0]["n"] == audit_before
    purge_rows = lx.rows("SELECT * FROM audit_log WHERE action = ?", (lpv.AUDIT_PURGED,))
    assert len(purge_rows) == 1 and purge_rows[0]["resource_id"] == uid and "maria" not in (purge_rows[0]["details_json"] or "").lower()
    # another person is untouched
    assert count(lx, "user_prefs", "user_id", other) == 1 and count(lx, "auth_webauthn_credentials", "user_id", other) == 1
    assert user(lx, other)["purged_at"] is None and user(lx, other)["display_name"] == "Nadav"


def test_period_runs_from_the_latest_of_disabled_and_deleted(lx):
    lx.enable()
    settings_on(lx, **{"privacy.local_purge": "on"})
    uid, _ = seed_person(lx, "maria")
    disable(lx, uid, T0, deleted=T0 + dt.timedelta(days=20))
    assert lpv.run(lx.db, now=T0 + dt.timedelta(days=49)) == {"purged": 0}
    assert lpv.run(lx.db, now=T0 + dt.timedelta(days=50)) == {"purged": 1}


def test_active_re_enabled_and_non_local_users_are_never_purged(lx):
    lx.enable()
    settings_on(lx, **{"privacy.local_purge": "on"})
    active, _ = seed_person(lx, "maria")
    sql(lx, "UPDATE users SET disabled_at = ? WHERE id = ?", (iso(T0), active))  # re-enabled: active stays 1
    ha_user = "0123456789abcdef0123456789abcdef"
    sql(lx, "INSERT INTO users(id, username, display_name, source, active, first_seen_at, last_seen_at, disabled_at) VALUES(?, 'ha', 'Ha', 'ingress', 0, ?, ?, ?)",
        (ha_user, iso(T0), iso(T0), iso(T0)))
    assert lpv.run(lx.db, now=T0 + dt.timedelta(days=400)) == {"purged": 0}
    assert user(lx, active)["purged_at"] is None and user(lx, ha_user)["display_name"] == "Ha"


def test_a_stored_period_below_30_is_clamped(lx):
    lx.enable()
    settings_on(lx, **{"privacy.local_purge": "on"})
    sql(lx, "INSERT INTO settings(key, value) VALUES('privacy.local_purge_days', '1') ON CONFLICT(key) DO UPDATE SET value = '1'")
    uid, _ = seed_person(lx, "maria")
    disable(lx, uid, T0)
    assert lpv.run(lx.db, now=T0 + dt.timedelta(days=10)) == {"purged": 0}


def test_the_janitor_hook_runs_the_purge_and_never_raises(lx):
    lx.enable()
    settings_on(lx, **{"privacy.local_purge": "on"})
    uid, _ = seed_person(lx, "maria")
    disable(lx, uid, dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=31))
    lpv.janitor(lx.db)
    assert user(lx, uid)["purged_at"] is not None


# ---------------------------------------------------------------- export

def test_export_is_off_by_default_for_the_person_and_the_administrator(lx):
    lx.enable()
    uid, c = seed_person(lx, "maria")
    r = c.get("/arx/api/v1/auth/local/personal-data")
    assert r.status_code == 409 and r.json()["code"] == "personal_export_off"
    r = lx.admin.get(f"/api/v1/identity/local-users/{uid}/personal-data")
    assert r.status_code == 409 and r.json()["code"] == "personal_export_off"


def test_own_export_contents_and_nothing_secret_or_foreign(lx):
    lx.enable()
    settings_on(lx, **{"privacy.personal_export": "on"})
    uid, c = seed_person(lx, "maria")
    other, _c = seed_person(lx, "nadav")
    r = c.get("/arx/api/v1/auth/local/personal-data")
    assert r.status_code == 200 and "no-store" in r.headers["cache-control"] and "attachment" in r.headers["content-disposition"]
    b = r.json()
    assert b["format"] == "arx-personal-data/1" and b["subject_id"] == uid
    assert b["profile"]["username"] == "maria" and b["profile"]["display_name"] == "Maria"
    assert [p["key"] for p in b["preferences"]] == ["theme"] and b["push_preferences"] and b["known_sign_in_devices"]
    assert b["ticket_saved_views"][0]["name"] == "mine"
    assert b["passkeys"][0]["label"] == "my key" and b["sign_in_sessions"], "the person's own sign-in is listed"
    assert b["role_bindings"] and b["role_bindings"][0]["role_id"] == "viewer"
    text = r.text
    with lx.db.connection(mode="read") as conn:
        hashes = [row[0] for row in conn.execute("SELECT password_hash FROM auth_local_credentials WHERE password_hash IS NOT NULL").fetchall()]
        sids = [row[0] for row in conn.execute("SELECT sid_hash FROM auth_local_sessions").fetchall()]
    assert hashes and all(h not in text for h in hashes), "no password hash"
    assert all(s not in text for s in sids), "no session hash"
    for forbidden in ("CREDID-maria", "PUBLICKEYMATERIAL", "password_hash", "token_hash", "sid_hash", "secret_ct", "pin_hash", "p256dh", "https://"):
        assert forbidden not in text, forbidden
    for foreign in ("nadav", "Nadav", other, "CREDID-nadav"):
        assert foreign not in text, foreign
    audit = lx.rows("SELECT action, details_json FROM audit_log WHERE action = ?", (lpv.AUDIT_EXPORTED,))
    assert len(audit) == 1 and "maria" not in (audit[0]["details_json"] or "").lower()


def test_export_audit_lists_only_the_persons_own_actions_without_details(lx):
    lx.enable()
    settings_on(lx, **{"privacy.personal_export": "on"})
    uid, c = seed_person(lx, "maria")
    sql(lx, "INSERT INTO audit_log(at, actor_user_id, actor_username, action, resource_type, resource_id, decision, details_json) "
            "VALUES(?, ?, 'maria', 'x.did', 'thing', 't1', 'allowed', '{\"secret_other\": \"zzz\"}')", (iso(T0), uid))
    sql(lx, "INSERT INTO audit_log(at, actor_user_id, actor_username, action, resource_type, resource_id, decision, details_json) "
            "VALUES(?, 'u-someone-else', 'someone', 'x.theirs', 'thing', 't2', 'allowed', NULL)", (iso(T0),))
    b = c.get("/arx/api/v1/auth/local/personal-data").json()
    actions = [a["action"] for a in b["audit_by_you"]]
    assert "x.did" in actions and "x.theirs" not in actions
    assert "zzz" not in json.dumps(b) and "someone" not in json.dumps(b)
    assert all("actor_user_id" not in a and "actor_username" not in a for a in b["audit_about_you"])


def test_administrator_export_on_request_and_permission_denials(lx):
    lx.enable()
    settings_on(lx, **{"privacy.personal_export": "on"})
    uid, c = seed_person(lx, "maria")
    other, c2 = seed_person(lx, "nadav")
    ok = lx.admin.get(f"/api/v1/identity/local-users/{uid}/personal-data")
    assert ok.status_code == 200 and ok.json()["subject_id"] == uid
    # a local person cannot read another person's bundle (identity.local.manage is system_admin only)
    denied = c2.get(f"/arx/api/v1/identity/local-users/{uid}/personal-data")
    assert denied.status_code in (403, 404), denied.text
    assert "maria" not in denied.text
    # a non-local caller has no own bundle
    r = lx.admin.get("/api/v1/auth/local/personal-data")
    assert r.status_code == 403 and r.json()["code"] == "not_local_identity"
    assert lx.admin.get("/api/v1/identity/local-users/l_UNKNOWN/personal-data").status_code == 404
    assert lx.rows("SELECT COUNT(*) AS n FROM audit_log WHERE action = ? AND decision = 'allowed'", (lpv.AUDIT_EXPORTED,))[0]["n"] == 1


def test_a_purged_person_has_nothing_left_to_export(lx):
    lx.enable()
    settings_on(lx, **{"privacy.local_purge": "on", "privacy.personal_export": "on"})
    uid, _ = seed_person(lx, "maria")
    disable(lx, uid, T0)
    assert lpv.run(lx.db, now=T0 + dt.timedelta(days=30)) == {"purged": 1}
    assert lx.admin.get(f"/api/v1/identity/local-users/{uid}/personal-data").status_code == 404
