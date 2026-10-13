"""CR-038 slice 1 - the module's settings API: departments (create / edit / delete with their rules), categories (one level, inside the
department), priorities (the default cannot be switched off), members with the escalation rule of review T19 (tickets.configure AND
manager of that department or all departments; nobody makes themself a manager of a department they do not manage, also not through
a group), the display settings document (D18 / D22, system.configure, revision-checked), the people picker and the "הרשאות" overview of
who holds a ticket permission through what (D25 / section 8.2), the six grant roles with their delegation defaults."""
from __future__ import annotations

import pytest
from conftest import as_user, bind

from smplwise.rbac import ROLES
from smplwise.routers.access import DEFAULT_DELEGABLE, SENSITIVE, delegation_block
from tickets_world import API, MAINT, build


@pytest.fixture()
def w(settings):
    return build(settings)


def _dept(w, dept_id: str, user: str = "joni") -> dict:
    return next(d for d in w.c.get(f"{API}/tickets/admin/departments", headers=as_user(user)).json()["departments"] if d["id"] == dept_id)


# ---------------------------------------------------------------- the gate

def test_the_settings_routes_need_the_settings_permission_at_installation_scope(w, settings):
    for user in ("mona", "tom", "alda", "vic"):
        assert w.c.get(f"{API}/tickets/admin/departments", headers=as_user(user)).status_code == 403, user
    bind(w.c, settings, "cora", "tickets_configure", "floor", w.floors["floor2"])
    assert w.c.get(f"{API}/tickets/admin/departments", headers=as_user("cora")).status_code == 403, "a floor-scoped grant does not configure departments"
    bind(w.c, settings, "cara", "tickets_configure", "installation", "*")
    assert w.c.get(f"{API}/tickets/admin/departments", headers=as_user("cara")).status_code == 200


# ---------------------------------------------------------------- departments

def test_department_lifecycle(w):
    r = w.c.post(f"{API}/tickets/admin/departments", json={"key": "hr", "name": "  משאבי ‮אנוש ", "description": "גיוס", "icon": "people", "color": "--sw-accent"})
    assert r.status_code == 201, r.text
    hr = r.json()
    assert hr["name"] == "משאבי אנוש" and [p["key"] for p in hr["priorities"]] == ["urgent", "high", "normal", "low"]
    assert [p["key"] for p in hr["priorities"] if p["is_default"]] == ["normal"] and hr["members"] == [], "joni sees every department: no first manager"
    with w.c.app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM ticket_sla_rules WHERE department_id = ?", (hr["id"],)).fetchone()[0] == 4
    assert w.c.post(f"{API}/tickets/admin/departments", json={"key": "hr", "name": "שוב"}).json()["code"] == "department_key_taken"
    for body in ({"key": "HR!", "name": "x"}, {"key": "ok-key", "name": ""}, {"key": "ok-key", "name": "x", "color": "#ff0000"}, {"name": "בלי מפתח"}):
        assert w.c.post(f"{API}/tickets/admin/departments", json=body).status_code == 422, body
    r = w.c.patch(f"{API}/tickets/admin/departments/{hr['id']}", json={"name": "HR", "reopen_days": 30, "revision": hr["revision"]})
    assert r.status_code == 200 and r.json()["name"] == "HR" and r.json()["reopen_days"] == 30
    assert w.c.patch(f"{API}/tickets/admin/departments/{hr['id']}", json={"name": "x", "revision": hr["revision"]}).json()["code"] == "department_stale"
    t = w.create("tom", "קליטת עובד", dept=hr["id"])
    assert w.c.delete(f"{API}/tickets/admin/departments/{hr['id']}").json()["code"] == "department_in_use"
    w.status("joni", t["id"], "cancelled", note="טעות")
    assert w.c.delete(f"{API}/tickets/admin/departments/{hr['id']}").status_code == 200
    assert all(d["id"] != hr["id"] for d in w.c.get(f"{API}/tickets/admin/departments").json()["departments"])
    assert w.detail(t["id"])["department"]["name"] == "HR", "a closed ticket keeps naming its (deleted) department"
    assert w.c.post(f"{API}/tickets/admin/departments", json={"key": "hr", "name": "מחדש"}).status_code == 201, "the key is free again"


def test_a_creator_without_all_departments_becomes_the_first_manager(w, settings):
    bind(w.c, settings, "cara", "tickets_configure", "installation", "*")
    r = w.c.post(f"{API}/tickets/admin/departments", json={"key": "it", "name": "מחשוב"}, headers=as_user("cara"))
    assert r.status_code == 201
    assert r.json()["members"] == [{"kind": "user", "id": "dev-cara", "name": "cara", "role": "manager", "notify_new": True, "added_at": r.json()["members"][0]["added_at"]}]


def test_categories_one_level_inside_the_department(w):
    d = w.c.post(f"{API}/tickets/admin/departments/{MAINT}/categories", json={"name": "מיזוג"}).json()
    hvac = next(c for c in d["categories"] if c["name"] == "מיזוג")
    d = w.c.post(f"{API}/tickets/admin/departments/{MAINT}/categories", json={"name": "מזגן מפוצל", "parent_id": hvac["id"]}).json()
    child = next(c for c in d["categories"] if c["name"] == "מזגן מפוצל")
    assert child["parent_id"] == hvac["id"]
    assert w.c.post(f"{API}/tickets/admin/departments/{MAINT}/categories", json={"name": "נכד", "parent_id": child["id"]}).status_code == 422, "one level only"
    other = w.c.post(f"{API}/tickets/admin/departments/{w.cleaning}/categories", json={"name": "רצפות"}).json()["categories"][0]
    assert w.c.post(f"{API}/tickets/admin/departments/{MAINT}/categories", json={"name": "x", "parent_id": other["id"]}).status_code == 422
    cats = w.c.patch(f"{API}/tickets/admin/categories/{hvac['id']}", json={"name": "מיזוג אוויר", "sort_order": 3}).json()["categories"]
    assert [c["name"] for c in cats] == ["מזגן מפוצל", "מיזוג אוויר"], "renamed, and ordered by sort_order"
    assert w.c.delete(f"{API}/tickets/admin/categories/{child['id']}").status_code == 200
    assert [c["name"] for c in _dept(w, MAINT)["categories"]] == ["מיזוג אוויר"]
    r = w.c.post(f"{API}/tickets", json={"department_id": MAINT, "title": "x", "category_id": child["id"], "client_request_id": "req-delcat-01"}, headers=as_user("tom"))
    assert r.status_code == 422, "a deleted category is not offered"


def test_priorities(w):
    prios = {p["key"]: p for p in _dept(w, MAINT)["priorities"]}
    assert w.c.patch(f"{API}/tickets/admin/priorities/{prios['normal']['id']}", json={"active": False}).json()["code"] == "priority_is_default"
    r = w.c.patch(f"{API}/tickets/admin/priorities/{prios['low']['id']}", json={"name": "לא דחוף", "is_default": True})
    assert r.status_code == 200
    after = {p["key"]: p for p in r.json()["priorities"]}
    assert after["low"]["is_default"] and not after["normal"]["is_default"] and after["low"]["name"] == "לא דחוף"
    assert w.c.patch(f"{API}/tickets/admin/priorities/{prios['urgent']['id']}", json={"active": False}).status_code == 200
    assert w.create("tom", "x")["priority"]["key"] == "low", "the new default"
    assert w.c.patch(f"{API}/tickets/admin/priorities/{prios['urgent']['id']}", json={"notify_severity": "loud"}).status_code == 422


# ---------------------------------------------------------------- members: the escalation rule (review T19)

def test_member_edits_need_management_of_that_department(w, settings):
    bind(w.c, settings, "mona", "tickets_configure", "installation", "*")  # mona: configure + manager of maintenance only
    assert w.c.put(f"{API}/tickets/admin/departments/{MAINT}/members/user/dev-nora", json={"role": "member"}, headers=as_user("mona")).status_code == 200
    r = w.c.put(f"{API}/tickets/admin/departments/{w.cleaning}/members/user/dev-nora", json={"role": "member"}, headers=as_user("mona"))
    assert r.status_code == 403 and r.json()["details"]["reason"] == "not_manager_of_department"
    assert w.c.delete(f"{API}/tickets/admin/departments/{w.cleaning}/members/user/dev-cleo", headers=as_user("mona")).status_code == 403
    assert _dept(w, w.cleaning, "joni")["members"][0]["id"] == "dev-cleo", "nothing changed"
    with w.c.app.state.db.connection(mode="read") as conn:
        reasons = [r[0] for r in conn.execute("SELECT reason FROM audit_log WHERE action = 'ticket.member.change' AND decision = 'denied'").fetchall()]
    assert reasons == ["not_manager_of_department", "not_manager_of_department"]


def test_nobody_makes_themself_a_manager_of_a_department_they_do_not_manage(w, settings):
    bind(w.c, settings, "tom", "tickets_configure", "installation", "*")  # tom: configure + only a MEMBER of maintenance
    r = w.c.put(f"{API}/tickets/admin/departments/{MAINT}/members/user/dev-tom", json={"role": "manager"}, headers=as_user("tom"))
    assert r.status_code == 403, "a member is not a manager: no member edits at all"
    # joni sees every department, yet is not a manager member of cleaning: he may name others, never himself
    assert w.c.put(f"{API}/tickets/admin/departments/{w.cleaning}/members/user/dev-tom", json={"role": "manager"}).status_code == 200
    r = w.c.put(f"{API}/tickets/admin/departments/{w.cleaning}/members/user/dev-joni", json={"role": "manager"})
    assert r.status_code == 403 and r.json()["details"]["reason"] == "self_escalation"
    assert w.c.put(f"{API}/tickets/admin/departments/{w.cleaning}/members/user/dev-joni", json={"role": "member"}).status_code == 200
    # ... nor through a group he belongs to
    with w.c.app.state.db.connection() as conn:
        conn.execute("INSERT INTO groups(id, name, created_at) VALUES ('g-ops', 'צוות', '2026-10-13T00:00:00Z')")
        conn.execute("INSERT INTO group_members(group_id, user_id) VALUES ('g-ops', 'dev-joni')")
    r = w.c.put(f"{API}/tickets/admin/departments/{w.cleaning}/members/group/g-ops", json={"role": "manager"})
    assert r.status_code == 403 and r.json()["details"]["reason"] == "self_escalation"
    # a manager may promote another member and change their own membership within a department they already manage
    bind(w.c, settings, "cleo", "tickets_configure", "installation", "*")
    assert w.c.put(f"{API}/tickets/admin/departments/{w.cleaning}/members/user/dev-cleo", json={"role": "manager", "notify_new": False},
                   headers=as_user("cleo")).status_code == 200


def test_group_membership_counts_and_the_first_manager_is_told_about_new_tickets(w):
    with w.c.app.state.db.connection() as conn:
        conn.execute("INSERT INTO groups(id, name, created_at) VALUES ('g-tech', 'טכנאים', '2026-10-13T00:00:00Z')")
        conn.execute("INSERT INTO group_members(group_id, user_id) VALUES ('g-tech', 'dev-nora')")
    assert w.c.put(f"{API}/tickets/admin/departments/{MAINT}/members/group/g-tech", json={"role": "member"}).status_code == 200
    t = w.create("tom", "ברז דולף")
    assert w.get("nora", t["id"]).json()["view"] == "full", "a member through a group sees the department's tickets"
    names = {u["id"] for u in w.c.get(f"{API}/tickets/assignees?department_id={MAINT}", headers=as_user("mona")).json()["users"]}
    assert "dev-nora" in names
    hr = w.c.post(f"{API}/tickets/admin/departments", json={"key": "hr2", "name": "כוח אדם"}).json()
    first = w.c.put(f"{API}/tickets/admin/departments/{hr['id']}/members/user/dev-mona", json={"role": "manager"}).json()["members"]
    second = w.c.put(f"{API}/tickets/admin/departments/{hr['id']}/members/user/dev-cleo", json={"role": "manager"}).json()["members"]
    flags = {m["id"]: m["notify_new"] for m in second}
    assert first[0]["notify_new"] is True and flags == {"dev-mona": True, "dev-cleo": False}
    assert w.c.put(f"{API}/tickets/admin/departments/{hr['id']}/members/user/dev-ghost", json={"role": "member"}).json()["code"] == "user_unknown"


# ---------------------------------------------------------------- display settings (D18 / D22)

def test_display_settings_document(w, settings):
    doc = w.c.get(f"{API}/tickets/settings").json()
    assert (doc["revision"], doc["ui"]) == (0, {"detail": "drawer_fullscreen", "new_ticket": "sheet"})
    assert w.c.get(f"{API}/tickets/settings", headers=as_user("mona")).status_code == 403
    bind(w.c, settings, "cara", "tickets_configure", "installation", "*")
    assert w.c.put(f"{API}/tickets/settings", json={"revision": 0, "ui": {"detail": "drawer"}}, headers=as_user("cara")).status_code == 403, \
        "the installation document is system.configure (section 14.1)"
    r = w.c.put(f"{API}/tickets/settings", json={"revision": 0, "ui": {"detail": "fullscreen", "new_ticket": "dialog"}})
    assert r.status_code == 200 and (r.json()["revision"], r.json()["ui"]) == (1, {"detail": "fullscreen", "new_ticket": "dialog"})
    assert w.c.put(f"{API}/tickets/settings", json={"revision": 0, "ui": {"detail": "drawer"}}).json()["code"] == "settings_stale"
    assert w.c.put(f"{API}/tickets/settings", json={"revision": 1, "ui": {"detail": "popup"}}).status_code == 422
    assert w.c.put(f"{API}/tickets/settings", json={"revision": 1, "links": {"cap_days": 3}}).status_code == 422, "slice 2 accepts links: the cap is 7-365 days"
    assert w.c.get(f"{API}/tickets/module", headers=as_user("vic")).json()["ui"] == {"detail": "fullscreen", "new_ticket": "dialog"}
    with w.c.app.state.db.connection() as conn:
        conn.execute("UPDATE settings SET value = '{\"revision\": 4, \"ui\": {\"detail\": \"bogus\"}}' WHERE key = 'tickets.settings'")
    got = w.c.get(f"{API}/tickets/settings").json()
    assert (got["revision"], got["ui"]) == (4, {"detail": "drawer_fullscreen", "new_ticket": "sheet"}), "invalid reads as default"


# ---------------------------------------------------------------- pickers and the permissions overview

def test_directory_and_holders(w, settings):
    d = w.c.get(f"{API}/tickets/admin/directory?q=to").json()
    assert {u["id"] for u in d["users"]} >= {"dev-tom"} and all(set(u) == {"id", "name"} for u in d["users"])
    bind(w.c, settings, "ezra", "tickets_external", "installation", "*")
    with w.c.app.state.db.connection() as conn:
        conn.execute("INSERT INTO groups(id, name, created_at) VALUES ('g-desk', 'מוקד', '2026-10-13T00:00:00Z')")
        conn.execute("INSERT INTO group_members(group_id, user_id) VALUES ('g-desk', 'dev-vic')")
        conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) "
                     "VALUES ('b-desk', 'group', 'g-desk', 'tickets_view', 'installation', '*', 'allow', 1, 'test', '2026-10-13T00:00:00Z')")
    users = {u["id"]: u for u in w.c.get(f"{API}/tickets/admin/holders").json()["users"]}
    ezra = users["dev-ezra"]["grants"]
    assert [(g["via"], g["role_id"], g["permissions"], g["scope_name"]) for g in ezra] == [("grant", "tickets_external", ["tickets.external"], "כל ההתקנה")]
    assert any(g["via"] == "group" and g["group_name"] == "מוקד" for g in users["dev-vic"]["grants"])
    assert any(g["via"] == "role" and g["role_id"] == "operator" for g in users["dev-tom"]["grants"])
    assert any(g["effect"] == "deny" for g in users["dev-dina"]["grants"]), "a deny is listed too"
    assert "dev-alda" in users and "dev-fred" in users


def test_the_grant_roles_and_their_delegation_defaults():
    grants = {r: ROLES[r] for r in ROLES if r.startswith("tickets_")}
    assert grants == {
        "tickets_view": ["tickets.view"], "tickets_create": ["tickets.create"], "tickets_manage": ["tickets.manage"],
        "tickets_all_departments": ["tickets.all_departments"], "tickets_external": ["tickets.external"], "tickets_configure": ["tickets.configure"],
    }
    for sens in ("tickets.all_departments", "tickets.external", "tickets.configure", "messaging.accounts.manage"):
        assert sens in SENSITIVE
    for plain in ("tickets.view", "tickets.create", "tickets.manage"):
        assert plain not in SENSITIVE
    assert {"tickets_view", "tickets_create", "tickets_manage"} <= set(DEFAULT_DELEGABLE)
    assert not {"tickets_all_departments", "tickets_external", "tickets_configure"} & set(DEFAULT_DELEGABLE)
    assert {r: [p for p in ROLES[r] if p.startswith("tickets.")] for r in ("viewer", "kiosk", "editor", "door_opener", "operator", "site_admin")} == {
        "viewer": [], "kiosk": [], "editor": [], "door_opener": [], "operator": ["tickets.view", "tickets.create"],
        "site_admin": ["tickets.view", "tickets.create", "tickets.manage", "tickets.external"],
    }
    assert sorted(p for p in ROLES["system_admin"] if p.startswith(("tickets.", "messaging."))) == sorted([
        "tickets.view", "tickets.create", "tickets.manage", "tickets.external", "tickets.all_departments", "tickets.configure", "messaging.accounts.manage"])


def test_a_site_admin_may_delegate_the_plain_grants_only(w, settings):
    sites = w.c.get(f"{API}/sites").json()
    site_id = sites["sites"][0]["id"] if isinstance(sites, dict) else sites[0]["id"]
    bind(w.c, settings, "sita", "site_admin", "site", site_id)
    h = as_user("sita")
    ok = w.c.post(f"{API}/access/bindings", json={"subject_kind": "user", "subject_id": "dev-nora", "role_id": "tickets_manage", "scope_type": "site", "scope_id": site_id}, headers=h)
    assert ok.status_code == 201, ok.text
    no = w.c.post(f"{API}/access/bindings", json={"subject_kind": "user", "subject_id": "dev-nora", "role_id": "tickets_external", "scope_type": "site", "scope_id": site_id}, headers=h)
    assert no.status_code == 403 and no.json()["code"] == "role_not_delegable"
    with w.c.app.state.db.connection(mode="read") as conn:
        assert delegation_block(conn, "tickets_external") is None, "the owner may still add it to the allow-list (section 8.2)"
