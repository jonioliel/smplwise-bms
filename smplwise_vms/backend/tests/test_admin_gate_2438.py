"""CR-ADMIN-GATE-2438 - code review 02:P2-1, 02:P2-9 (lead decision L5), the router side of 02:P1-5.

1. rbac.require_system_admin is the one system-administrator gate: require("system.configure") first, then is_system_admin, then one
   audited refusal with the CALLER's action, resource, details and text (403 `not_system_admin`). The adopted routes keep their exact
   audit rows and texts; service_identity's kill switch keeps its own code `forbidden` (lead decision L6).
2. rbac.admin_count is the one administrator count: active users allowed `rbac.roles.manage` at the installation, decided exactly as
   authorize() decides it, in a bounded number of statements. The last-administrator guard and the setup wizard use it.
3. rbac.Evaluator: authorize() for many targets of one principal reads the bindings once; same decisions as authorize().
"""
from __future__ import annotations

import json

import pytest
from conftest import as_user, bind, seed_tree

from smplwise.db import Database, bump_permission_revision, new_id, now_iso, permission_revision
from smplwise.errors import ApiError
from smplwise.rbac import INSTALLATION, Evaluator, Principal, admin_count, authorize, require_system_admin, scope_chain

API = "/api/v1"


def _p(uid: str, source: str = "dev") -> Principal:
    return Principal(user_id=uid, username=uid, display_name=uid, source=source)


def _conn(settings):
    return Database(settings.db_path).connection()


@pytest.fixture(autouse=True)
def _bootstrap(client):
    """The bootstrap administrator (joni) is bound on the first request."""
    assert client.get(f"{API}/me").status_code == 200


def _user(conn, uid: str, *, active: int = 1, source: str = "dev") -> None:
    now = now_iso()
    conn.execute("INSERT OR REPLACE INTO users(id, username, display_name, source, active, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                 (uid, uid, uid, source, active, now, now))


def _bind(conn, kind: str, subject: str, role: str, effect: str = "allow", *, scope=("installation", "*"), expires: str | None = None,
          revoked: str | None = None) -> None:
    conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at, expires_at, revoked_at) "
                 "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'test', ?, ?, ?)",
                 (new_id(), kind, subject, role, scope[0], scope[1], effect, permission_revision(conn), now_iso(), expires, revoked))


def _group(conn, gid: str, *members: str) -> None:
    conn.execute("INSERT INTO groups(id, name, created_at) VALUES (?, ?, ?)", (gid, gid, now_iso()))
    for m in members:
        conn.execute("INSERT INTO group_members(group_id, user_id) VALUES (?, ?)", (gid, m))


def _configure_only_role(conn) -> str:
    """A role that carries system.configure but is not system_admin - not creatable through the API (system permissions are refused
    there), written straight to the table so the gate's SECOND step is reachable."""
    rid = "custom-configure-only"
    now = now_iso()
    conn.execute("INSERT INTO custom_roles(id, name_he, permissions_json, sensitive_json, created_at, updated_at) VALUES (?, 'תצורה', ?, '[]', ?, ?)",
                 (rid, json.dumps(["system.configure"]), now, now))
    bump_permission_revision(conn)
    return rid


def _slow_admin_count(conn) -> int:
    """The definition before this branch: one authorize() per active user."""
    return sum(1 for u in conn.execute("SELECT id, username, display_name, source FROM users WHERE active = 1").fetchall()
               if authorize(conn, Principal(u["id"], u["username"], u["display_name"], u["source"]), "rbac.roles.manage", INSTALLATION).allowed)


class _Counter:
    def __init__(self, conn):
        self.conn, self.n, self.sql = conn, 0, []

    def __enter__(self):
        def trace(stmt: str) -> None:
            self.n += 1
            self.sql.append(stmt)
        self.conn.set_trace_callback(trace)
        return self

    def __exit__(self, *exc):
        self.conn.set_trace_callback(None)


# ---------------------------------------------------------------- 1. the one gate

def test_the_gate_refuses_without_system_configure_through_require(client, settings):
    client.get(f"{API}/me", headers=as_user("nobody"))
    with _conn(settings) as conn:
        with pytest.raises(ApiError) as e:
            require_system_admin(conn, _p("dev-nobody"), action="x.read", text="טקסט")
        assert e.value.status == 403 and e.value.code == "forbidden", "step 1 is require(): its own code and audit row"
        row = conn.execute("SELECT action, reason FROM audit_log WHERE actor_user_id = 'dev-nobody' AND decision = 'denied' ORDER BY rowid DESC LIMIT 1").fetchone()
    assert tuple(row) == ("system.configure", "no_binding")


def test_the_gate_refuses_a_configure_holder_who_is_not_system_admin_with_the_callers_values(client, settings):
    client.get(f"{API}/me", headers=as_user("cfg"))
    with _conn(settings) as conn:
        _bind(conn, "user", "dev-cfg", _configure_only_role(conn))
    with _conn(settings) as conn:
        with pytest.raises(ApiError) as e:
            require_system_admin(conn, _p("dev-cfg"), action="wiskey.pairing.probe", request_id="rq-1", resource_id="wiskey.switches",
                                 details={"keys": 3}, text="רק מנהל מערכת.")
        assert (e.value.status, e.value.code, e.value.user_message) == (403, "not_system_admin", "רק מנהל מערכת.")
        row = conn.execute("SELECT action, resource_type, resource_id, reason, request_id, details_json FROM audit_log WHERE actor_user_id = 'dev-cfg' "
                           "AND decision = 'denied' ORDER BY rowid DESC LIMIT 1").fetchone()
    assert tuple(row)[:5] == ("wiskey.pairing.probe", "installation", "wiskey.switches", "not_system_admin", "rq-1")
    assert json.loads(row[5]) == {"keys": 3}


def test_the_gate_passes_a_system_admin_and_skips_step_one_on_request(client, settings):
    with _conn(settings) as conn:
        require_system_admin(conn, _p("dev-joni"), action="x", text="t")  # the bootstrap administrator
        # configure_checked: the caller already ran require() (access_grants PUT keeps its order: configure, empty body, administrator)
        with pytest.raises(ApiError) as e:
            require_system_admin(conn, _p("dev-ghost"), action="x", text="t", configure_checked=True)
        assert e.value.code == "not_system_admin"


@pytest.mark.parametrize("method,path,body,action,text", [
    ("GET", "/access/visitors/settings", None, "settings.read", "רק מנהל מערכת יכול לשנות הגדרה זו."),
    ("GET", "/access-grants/readiness", None, "access.grant.readiness", "רק מנהל מערכת יכול לצפות בבדיקת המוכנות."),
    ("GET", "/access-grants/settings", None, "settings.read", "רק מנהל מערכת יכול לצפות בהגדרה זו."),
    ("GET", "/wiskey/switches", None, "settings.read", "רק מנהל מערכת יכול לצפות בהגדרה זו."),
    ("GET", "/access-station-permissions/settings", None, "settings.read", "רק מנהל מערכת יכול לטפל בהגדרה זו."),
    ("PUT", "/access/wiskey-visits/settings", {"push": "off"}, None, "רק מנהל מערכת יכול לשנות הגדרה זו."),
    ("POST", "/system/wiskey-pairing/probe", None, "wiskey.pairing.probe", "רק מנהל מערכת יכול לבדוק את החיבור החתום ל־WisKey."),
])
def test_adopted_routes_keep_their_refusal(client, settings, method, path, body, action, text):
    client.get(f"{API}/me", headers=as_user("cfg"))
    with _conn(settings) as conn:
        _bind(conn, "user", "dev-cfg", _configure_only_role(conn))
    r = client.request(method, f"{API}{path}", json=body, headers=as_user("cfg"))
    assert r.status_code == 403, r.text
    assert r.json()["code"] == "not_system_admin" and r.json()["user_message"] == text, r.json()
    if action:
        with _conn(settings) as conn:
            row = conn.execute("SELECT action, reason FROM audit_log WHERE actor_user_id = 'dev-cfg' AND decision = 'denied' ORDER BY rowid DESC LIMIT 1").fetchone()
        assert tuple(row) == (action, "not_system_admin")


def test_service_identity_kill_switch_keeps_code_forbidden(client, settings):
    """Lead decision L6: this route is not moved onto the shared gate - its order (administrator first) and code stay."""
    client.get(f"{API}/me", headers=as_user("cfg"))
    r = client.post(f"{API}/identity/extended-mode/off", json={"turn_off": True}, headers=as_user("cfg"))
    assert r.status_code == 403 and r.json()["code"] == "forbidden"


# ---------------------------------------------------------------- 2. the one administrator count

def _matrix(conn) -> None:
    for uid in ("a-direct", "a-group", "a-denied", "a-group-denied", "a-expired", "a-revoked", "a-inactive", "a-viewer", "l_local", "a-two-rows"):
        _user(conn, uid, active=0 if uid == "a-inactive" else 1, source="local" if uid.startswith("l_") else "dev")
    _bind(conn, "user", "a-direct", "system_admin")
    _group(conn, "g-admins", "a-group", "a-group-denied", "l_local")
    _bind(conn, "group", "g-admins", "system_admin")
    _bind(conn, "user", "a-denied", "system_admin")
    _bind(conn, "user", "a-denied", "system_admin", "deny")
    _group(conn, "g-deny", "a-group-denied")
    _bind(conn, "group", "g-deny", "system_admin", "deny")
    _bind(conn, "user", "a-expired", "system_admin", expires="2000-01-01T00:00:00Z")
    _bind(conn, "user", "a-revoked", "system_admin", revoked="2000-01-01T00:00:00Z")
    _bind(conn, "user", "a-inactive", "system_admin")
    _bind(conn, "user", "a-viewer", "viewer")
    _bind(conn, "user", "l_local", "system_admin")
    _bind(conn, "user", "a-two-rows", "system_admin")
    _bind(conn, "user", "a-two-rows", "system_admin")
    _bind(conn, "user", "a-direct", "system_admin", scope=("site", "s-1"))  # a site row never counts


def test_admin_count_equals_authorize_over_the_matrix(client, settings):
    with _conn(settings) as conn:
        _matrix(conn)
    with _conn(settings) as conn:
        expected = _slow_admin_count(conn)
        assert admin_count(conn) == expected == 4, "joni (bootstrap), a-direct, a-group, a-two-rows"


def test_admin_count_is_a_bounded_number_of_statements(client, settings):
    """02:P1-5: 200 active users, 50 of them administrators - one pass, not one authorize() per user."""
    with _conn(settings) as conn:
        for i in range(200):
            _user(conn, f"u{i:03d}")
            if i % 4 == 0:
                _bind(conn, "user", f"u{i:03d}", "system_admin")
    with _conn(settings) as conn:
        with _Counter(conn) as c:
            n = admin_count(conn)
        assert n == 51  # 50 + the bootstrap administrator
        assert c.n <= 10, c.sql


def test_the_setup_wizard_counts_people_not_rows(client, settings):
    """02:P2-9 / L5: the wizard used to count system_admin allow ROWS (a deny, an inactive user or two rows for one person were wrong)."""
    from smplwise.services import setup_wizard

    with _conn(settings) as conn:
        _matrix(conn)
    with _conn(settings) as conn:
        assert setup_wizard._system_admins(conn) == admin_count(conn) == 4


def test_the_last_administrator_guard_still_holds(client, settings):
    from smplwise.routers import access as acc

    with _conn(settings) as conn:
        assert acc.admin_count(conn) == 1
        joni = conn.execute("SELECT id FROM bindings WHERE subject_id = 'dev-joni' AND role_id = 'system_admin'").fetchone()[0]
    r = client.delete(f"{API}/access/bindings/{joni}")
    assert r.status_code == 409 and r.json()["code"] == "last_admin", r.text


# ---------------------------------------------------------------- 3. the evaluator

def test_the_evaluator_decides_exactly_like_authorize(client, settings):
    ids = seed_tree(client)
    bind(client, settings, "dana", "site_admin", "building", ids["building"])
    with _conn(settings) as conn:
        _bind(conn, "user", "dev-dana", "site_admin", "deny", scope=("floor", ids["floor3"]))
    targets = [INSTALLATION, ("site", ids["site"]), ("building", ids["building"]), ("floor", ids["floor2"]), ("floor", ids["floor3"]), ("floor", "ghost")]
    with _conn(settings) as conn:
        ev = Evaluator(conn, _p("dev-dana"))
        for perm in ("rbac.assign", "map.read", "system.configure"):
            for t in targets:
                assert ev.authorize(perm, t) == authorize(conn, _p("dev-dana"), perm, t), (perm, t)


def test_the_scope_picker_reads_the_bindings_once(client, settings):
    ids = seed_tree(client)
    for n in range(6):
        client.post(f"{API}/buildings/{ids['building']}/floors", json={"name": f"ק{n}", "level": 10 + n})
    bind(client, settings, "dana", "site_admin", "site", ids["site"])
    from smplwise.routers.access import assign_scopes

    with _conn(settings) as conn:
        with _Counter(conn) as c:
            out = assign_scopes(conn, _p("dev-dana"))
        assert {o["type"] for o in out} >= {"site", "building", "floor"}
        reads = [s for s in c.sql if "FROM bindings b" in s and "group_members" in s]
        # one for the evaluator, the rest for the camera picker (camera_scope, full_authority) - not one per site / building / floor
        # (nine nodes here: before this branch, one bindings read each)
        assert len(reads) <= 3, f"{len(reads)} bindings reads"
        assert scope_chain(conn, "floor", ids["floor2"])[-1] == INSTALLATION
