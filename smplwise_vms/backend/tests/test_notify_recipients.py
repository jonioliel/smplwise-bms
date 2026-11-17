"""CR-RECIPIENTS-2436 (review 04:F03, F18, F05 managers part) and OWNER-R32-BACKEND-2438 (04:F02, owner decision O1 (a)): the ONE recipient expansion and validation of the alert modules.

`services/notify_recipients.expand` turns a saved `{roles, users, groups}` choice into user ids: the named users, the members of the named groups,
the holders of a routable role directly and (by default) through a group, live bindings only (not revoked, `allow`, not expired), active users only.
All four alert modules (temperature, water, elevator, generator) call it the same way; the generator keeps its own generator.view filter afterwards.
The table below is the contract, case by case."""
from __future__ import annotations

import datetime as dt
import sqlite3

import pytest

from smplwise.services import elevator_alerts, generator_alerts, notify, notify_recipients as nr, temperature_alerts, water_alerts

ROLES = ("viewer", "operator", "site_admin", "system_admin")
PAST = "2000-01-01T00:00:00Z"
FUTURE = "2999-01-01T00:00:00Z"


def _db() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.executescript(
        """CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT NOT NULL DEFAULT '', display_name TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT 'dev',
                              active INTEGER NOT NULL DEFAULT 1, first_seen_at TEXT NOT NULL DEFAULT '', last_seen_at TEXT NOT NULL DEFAULT '');
           CREATE TABLE groups (id TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT '');
           CREATE TABLE group_members (group_id TEXT NOT NULL, user_id TEXT NOT NULL, PRIMARY KEY (group_id, user_id));
           CREATE TABLE bindings (id TEXT PRIMARY KEY, subject_kind TEXT NOT NULL, subject_id TEXT NOT NULL, role_id TEXT NOT NULL, scope_type TEXT NOT NULL DEFAULT 'installation',
                                 scope_id TEXT NOT NULL DEFAULT '*', effect TEXT NOT NULL DEFAULT 'allow', permission_revision INTEGER NOT NULL DEFAULT 1,
                                 created_at TEXT NOT NULL DEFAULT '', expires_at TEXT, revoked_at TEXT);""")
    for uid, active in (("u_named", 1), ("u_member", 1), ("u_direct", 1), ("u_bygroup", 1), ("u_expired", 1), ("u_future", 1), ("u_revoked", 1),
                        ("u_deny", 1), ("u_inactive", 0), ("u_inactive_role", 0), ("u_other_role", 1)):
        conn.execute("INSERT INTO users(id, active) VALUES (?, ?)", (uid, active))
    for gid in ("g_named", "g_ops"):
        conn.execute("INSERT INTO groups(id) VALUES (?)", (gid,))
    conn.execute("INSERT INTO group_members VALUES ('g_named', 'u_member')")
    conn.execute("INSERT INTO group_members VALUES ('g_ops', 'u_bygroup')")
    rows = [
        ("b1", "user", "u_direct", "operator", "allow", None, None),
        ("b2", "group", "g_ops", "operator", "allow", None, None),
        ("b3", "user", "u_expired", "operator", "allow", PAST, None),
        ("b4", "user", "u_future", "operator", "allow", FUTURE, None),
        ("b5", "user", "u_revoked", "operator", "allow", None, PAST),
        ("b6", "user", "u_deny", "operator", "deny", None, None),
        ("b7", "user", "u_inactive_role", "operator", "allow", None, None),
        ("b8", "user", "u_other_role", "kiosk", "allow", None, None),
    ]
    conn.executemany("INSERT INTO bindings(id, subject_kind, subject_id, role_id, effect, expires_at, revoked_at) VALUES (?,?,?,?,?,?,?)", rows)
    return conn


# (case, recipients, expected with the defaults: an exact list, "id" = contains it, "not:id" = does not)
CASES = [
    ("named user", {"users": ["u_named"]}, ["u_named"]),
    ("group member", {"groups": ["g_named"]}, ["u_member"]),
    ("role held directly", {"roles": ["operator"]}, "u_direct"),
    ("role binding that expires later", {"roles": ["operator"]}, "u_future"),
    ("role held through a group", {"roles": ["operator"]}, "u_bygroup"),
    ("expired binding", {"roles": ["operator"]}, "not:u_expired"),
    ("revoked binding", {"roles": ["operator"]}, "not:u_revoked"),
    ("deny binding", {"roles": ["operator"]}, "not:u_deny"),
    ("inactive named user", {"users": ["u_inactive"]}, []),
    ("inactive role holder", {"roles": ["operator"]}, "not:u_inactive_role"),
    ("role that may not be routed", {"roles": ["kiosk"]}, []),
]


@pytest.mark.parametrize("case,rec,want", CASES, ids=[c[0] for c in CASES])
def test_expand_table_with_the_defaults(case, rec, want):
    conn = _db()
    got = nr.expand(conn, rec, ROLES)
    if isinstance(want, list):
        assert got == want, case
    elif want.startswith("not:"):
        assert want[4:] not in got, case
    else:
        assert want in got, case


def test_expand_role_holders_exactly():
    assert sorted(nr.expand(_db(), {"roles": ["operator"]}, ROLES)) == ["u_bygroup", "u_direct", "u_future"]


def test_expand_order_and_duplicates():
    """Named users first, then group members, then direct role holders, then role holders through a group; each id once (dict.fromkeys)."""
    conn = _db()
    conn.execute("INSERT INTO group_members VALUES ('g_named', 'u_direct')")
    got = nr.expand(conn, {"users": ["u_named", "u_direct"], "groups": ["g_named"], "roles": ["operator", "viewer"]}, ROLES)
    assert got[:3] == ["u_named", "u_direct", "u_member"]
    assert set(got) == {"u_named", "u_direct", "u_member", "u_future", "u_bygroup"} and len(got) == len(set(got))


def test_generator_has_no_held_role_rule_any_more():
    """O1 (a): the generator joined the shared rules - the hold flag and the expansion switches are gone."""
    assert not hasattr(generator_alerts, "ROLE_EXPANSION")
    with pytest.raises(TypeError):
        nr.expand(_db(), {"roles": ["operator"]}, generator_alerts.ROUTABLE_ROLES, role_via_groups=False)  # type: ignore[call-arg]


def test_generator_roles_reach_group_holders_and_drop_expired():
    """O1 (a) on the shared function with the generator's roles: a role held through a group counts, an expired, revoked or denied binding does
    not, an inactive role holder is dropped."""
    conn = _db()
    got = nr.expand(conn, {"users": ["u_named", "u_inactive"], "roles": ["operator"]}, generator_alerts.ROUTABLE_ROLES)
    assert got[0] == "u_named" and "u_inactive" not in got
    assert {"u_direct", "u_future", "u_bygroup"} <= set(got)
    assert not {"u_expired", "u_revoked", "u_deny", "u_inactive_role"} & set(got)


def test_alert_modules_use_the_shared_expansion():
    assert temperature_alerts._expand.__module__ == "smplwise.services.temperature_alerts"  # the old private name stays for callers
    conn = _db()
    rec = {"users": ["u_named"], "groups": ["g_named"], "roles": ["operator"]}
    assert temperature_alerts._expand(conn, rec) == nr.expand(conn, rec, temperature_alerts.ROUTABLE_ROLES)
    assert water_alerts.ROUTABLE_ROLES == temperature_alerts.ROUTABLE_ROLES == elevator_alerts.ROUTABLE_ROLES


# ---------------------------------------------------------------- validation


class Invalid(ValueError):
    def __init__(self, code, message, message_en, details=None):
        super().__init__(code)
        self.code, self.message, self.message_en, self.details = code, message, message_en, details or {}


def _validate(conn, rec, **kw):
    return nr.validate(conn, rec, "f", ROLES, error=Invalid, role_message=("he", "en"), users_max=2, groups_max=1, **kw)


@pytest.mark.parametrize("rec,code,field", [
    ([], "validation", "f"),
    ({"roles": [], "extra": []}, "validation", "f"),
    ({"roles": "operator"}, "validation", "f"),
    ({"users": ["u_named", "u_member", "u_direct"]}, "validation", "f"),
    ({"groups": ["g_named", "g_ops"]}, "validation", "f"),
    ({"roles": ROLES + ("viewer",)}, "validation", "f"),
    ({"roles": ["kiosk"]}, "recipient_role", "f.roles"),
    ({"users": ["u_inactive"]}, "recipient_user", "f.users"),
    ({"users": ["nobody"]}, "recipient_user", "f.users"),
    ({"groups": ["g_none"]}, "recipient_group", "f.groups"),
])
def test_validate_refusals(rec, code, field):
    with pytest.raises(Invalid) as e:
        _validate(_db(), rec)
    assert e.value.code == code and e.value.details == {"fields": [field]}
    if code == "recipient_role":
        assert (e.value.message, e.value.message_en) == ("he", "en")


def test_validate_canonical_form():
    got = _validate(_db(), {"roles": ["system_admin", "viewer"], "users": ["u_named", "u_named"], "groups": ["g_ops"]})
    assert got == {"roles": ["viewer", "system_admin"], "users": ["u_named"], "groups": ["g_ops"]}


def test_validate_with_known_sets_runs_no_query():
    conn = _db()
    known = nr.Known(active_users={"u_named"}, group_ids={"g_ops"})
    seen: list[str] = []
    conn.set_trace_callback(seen.append)
    assert _validate(conn, {"users": ["u_named"], "groups": ["g_ops"]}, known=known)["users"] == ["u_named"]
    assert seen == []


@pytest.mark.parametrize("module,role_text", [
    (temperature_alerts, "This role cannot receive temperature alerts."),
    (water_alerts, "This role cannot receive water alerts."),
])
def test_module_validators_keep_their_own_texts(module, role_text):
    with pytest.raises(module.AlertsInvalid) as e:
        module.validate_recipients(_db(), {"roles": ["kiosk"]}, "kinds.alarm.recipients")
    assert e.value.code == "recipient_role" and e.value.message_en == role_text and e.value.details == {"fields": ["kinds.alarm.recipients.roles"]}


def test_elevator_validator_keeps_its_text_and_reads_the_sets_once():
    conn = _db()
    cur = elevator_alerts.default_settings()
    with pytest.raises(elevator_alerts.AlertsInvalid) as e:
        elevator_alerts._validate(conn, {"states": {"fault": {"recipients": {"roles": ["kiosk"]}}}}, cur)
    assert e.value.message_en == "This role cannot receive elevator alerts." and e.value.details == {"fields": ["states.fault.recipients.roles"]}
    seen: list[str] = []
    conn.set_trace_callback(seen.append)
    body = {"states": {r: {"recipients": {"users": ["u_named"], "groups": ["g_ops"]}} for r in list(elevator_alerts.el.ALERT_ROLES)[:2]}}
    out = elevator_alerts._validate(conn, body, cur)
    assert all(out["states"][r]["recipients"] == {"roles": [], "users": ["u_named"], "groups": ["g_ops"]} for r in body["states"])
    assert sum("FROM users" in s for s in seen) == 1 and sum("FROM groups" in s for s in seen) == 1


# ---------------------------------------------------------------- the rule registry in notify.py (F18)


def test_rule_registry_names_every_rule():
    assert set(notify.RECIPIENT_RULES) == {"scope", "managers", "initiator", "generator", "ticket_managers", "ticket_assignee", "elevator", "temperature",
                                           "energy_bills", "water", "maintenance", "notice", "calendar_attendee", "scenario", "rfq_managers", "bridge_key_owner"}


def test_registered_rule_and_fallback(monkeypatch):
    conn = _db()
    monkeypatch.setitem(notify.RECIPIENT_RULES, "test_rule", lambda c, n: ["u_named", "u_inactive", "u_named"])
    monkeypatch.setattr(notify.policies, "effective_recipients", lambda policy, audience: policy["recipients"])
    monkeypatch.setattr(notify.nsettings, "failures_audience", lambda c: "admins")
    seen_visibility: list[str] = []

    class _Reach:
        def __init__(self, c, p):
            self.p = p

        def can_see(self, n):
            seen_visibility.append(self.p.user_id)
            return True

    monkeypatch.setattr(notify, "Reach", _Reach)
    assert notify.recipients_for(conn, {"recipients": {"rule": "test_rule"}}, {}) == ["u_named"]  # deduplicated, inactive dropped by principal_of
    assert notify.recipients_for(conn, {"recipients": {"rule": "no_such_rule", "user_ids": ["u_direct"]}}, {}) == ["u_direct"]  # unknown rule: user_ids
    assert notify.recipients_for(conn, {"recipients": {"rule": "initiator"}}, {"initiator_user_id": "u_member"}) == ["u_member"]
    assert notify.recipients_for(conn, {"recipients": {"rule": "scenario"}}, {"origin": {"to": ["u_named", 3, "u_direct"]}}) == ["u_named", "u_direct"]
    notify.register_rule("test_rule_2", lambda c, n: ["u_direct"])
    try:
        assert notify.recipients_for(conn, {"recipients": {"rule": "test_rule_2"}}, {}) == ["u_direct"]
    finally:
        notify.RECIPIENT_RULES.pop("test_rule_2", None)


def test_lazy_rule_calls_the_module_function_at_call_time(monkeypatch):
    """A rule entry imports its module when called and looks the function up then, so a module stays importable without notify and a test may
    replace `<module>.recipient_users`."""
    monkeypatch.setattr(water_alerts, "recipient_users", lambda c, n: ["from_patch"])
    assert notify.RECIPIENT_RULES["water"](None, {}) == ["from_patch"]


# ---------------------------------------------------------------- managers() (F05, the managers part)


def test_managers_reads_the_users_once(monkeypatch):
    """Same holders, same order, but one users query instead of one per active user."""
    conn = _db()
    monkeypatch.setattr(notify, "authorize", lambda c, p, perm, scope: type("D", (), {"allowed": p.user_id in {"u_direct", "u_named", "u_inactive"}})())
    seen: list[str] = []
    conn.set_trace_callback(seen.append)
    assert notify.managers(conn) == ["u_direct", "u_named"]
    assert sum("FROM users" in s for s in seen) == 1


def test_managers_principals_match_principal_of():
    conn = _db()
    conn.execute("UPDATE users SET username = 'n', display_name = 'Named' WHERE id = 'u_named'")
    from smplwise.services.notify_visibility import principal_of

    by_id = {p.user_id: p for p in notify._active_principals(conn)}
    assert list(by_id) == [r[0] for r in conn.execute("SELECT id FROM users WHERE active = 1 ORDER BY id")]
    for uid, p in by_id.items():
        assert p == principal_of(conn, uid)
