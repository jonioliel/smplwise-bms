"""CR-TK-ROUTER-COMMON-2438 (code review 2026-11-13: 01:F-08, 01:F-13, 01:F-20, theme T4 in the tickets area).

- F-08: the two people pickers (`GET /tickets/admin/directory`, the department manager's `people`) and `GET /tickets/admin/holders`
  read names and the active flag in batches (`store.display_names`), so their statement count does not grow with the number of users;
  the names are exactly `store.display_name`'s (ha_users first, then users, then the id).
- F-20: `GET /tickets/admin/departments` and `GET /tickets/dept-handlers` read the tickets settings document a fixed number of times,
  not once more per department.
- F-13: the shared helpers keep the audited 403 (action, reason, details) and the 422 envelope byte for byte.
- T4: the digest matrix's role expansion is services/notify_recipients.expand (same users, same order)."""
from __future__ import annotations

import pytest
from conftest import as_user, bind

from smplwise.db import Database
from smplwise.services.notify_visibility import principal_of
from smplwise.services.tickets import settings_doc, store
from smplwise.services.tickets.access import Viewer
from tickets_world import API, MAINT, build


@pytest.fixture()
def w(settings):
    return build(settings)


def _add_users(w, n: int, start: int = 0) -> None:
    with Database(w.settings.db_path).connection() as conn:
        for i in range(start, start + n):
            conn.execute("INSERT INTO users(id, username, display_name, source, active, first_seen_at, last_seen_at) "
                         "VALUES (?, ?, ?, 'dev', 1, '2026-11-14T00:00:00Z', '2026-11-14T00:00:00Z')", (f"extra-{i}", f"extra{i}", f"נוסף {i}"))


def _traced(w, fn):
    db = Database(w.settings.db_path)
    with db.connection(mode="read") as conn:
        seen: list[str] = []
        conn.set_trace_callback(seen.append)
        try:
            out = fn(conn)
        finally:
            conn.set_trace_callback(None)
    return len(seen), out


# ---------------------------------------------------------------- F-08: names in batches


def test_display_names_equals_display_name_for_every_kind_of_row(w):
    with Database(w.settings.db_path).connection() as conn:
        conn.execute("INSERT INTO ha_users(id, name, username, is_active, synced_at) VALUES ('ha-1', 'שם מהבית', 'u1', 1, '2026-11-14T00:00:00Z')")
        conn.execute("INSERT INTO ha_users(id, name, username, is_active, synced_at) VALUES ('ha-2', NULL, 'only-user', 1, '2026-11-14T00:00:00Z')")
        conn.execute("INSERT INTO ha_users(id, name, username, is_active, synced_at) VALUES ('ha-3', '', '', 1, '2026-11-14T00:00:00Z')")
        conn.execute("INSERT INTO users(id, username, display_name, source, active, first_seen_at, last_seen_at) "
                     "VALUES ('ha-3', 'fallback', '', 'dev', 1, '2026-11-14T00:00:00Z', '2026-11-14T00:00:00Z')")
        conn.execute("INSERT INTO users(id, username, display_name, source, active, first_seen_at, last_seen_at) "
                     "VALUES ('ha-1', 'ignored', 'ignored', 'dev', 1, '2026-11-14T00:00:00Z', '2026-11-14T00:00:00Z')")
        conn.execute("INSERT INTO users(id, username, display_name, source, active, first_seen_at, last_seen_at) "
                     "VALUES ('u-empty', '', '', 'dev', 1, '2026-11-14T00:00:00Z', '2026-11-14T00:00:00Z')")
    ids = ["ha-1", "ha-2", "ha-3", "u-empty", "nobody", "dev-tom", "", "dev-tom"]
    with Database(w.settings.db_path).connection(mode="read") as conn:
        one = {uid: store.display_name(conn, uid) for uid in ids}
        many = store.display_names(conn, ids)
    assert many == one
    assert many["ha-1"] == "שם מהבית" and many["ha-2"] == "only-user" and many["ha-3"] == "fallback" and many["nobody"] == "nobody"
    assert many[""] == ""


def test_display_names_reads_in_a_fixed_number_of_statements(w):
    _add_users(w, 30)
    ids = [f"extra-{i}" for i in range(30)]
    few, _ = _traced(w, lambda conn: store.display_names(conn, ids[:3]))
    lots, names = _traced(w, lambda conn: store.display_names(conn, ids))
    assert few == lots == 2
    assert names["extra-7"] == "נוסף 7"


def test_the_admin_directory_picker_does_not_read_per_user(w):
    from smplwise.routers import tickets_admin

    def call(conn):
        return tickets_admin.directory(principal=principal_of(conn, "dev-joni"), conn=conn, q="")

    small, before = _traced(w, call)
    _add_users(w, 12)
    big, after = _traced(w, call)
    assert big == small, f"{small} statements with {len(before['users'])} users, {big} with {len(after['users'])}"
    assert len(after["users"]) == len(before["users"]) + 12
    assert {"id": "extra-3", "name": "נוסף 3"} in after["users"]
    assert after["users"] == sorted(after["users"], key=lambda u: u["name"])


def test_the_department_managers_people_picker_does_not_read_per_user(w, settings):
    from smplwise.services.tickets import dept_handlers

    bind(w.c, settings, "mona", "tickets_handlers", "installation", "*")

    def call(conn):
        return dept_handlers.people(Viewer(conn, principal_of(conn, "dev-mona")), "")

    small, before = _traced(w, call)
    _add_users(w, 12)
    big, after = _traced(w, call)
    assert big == small, f"{small} statements with {len(before['users'])} users, {big} with {len(after['users'])}"
    assert len(after["users"]) == len(before["users"]) + 12


def test_holders_reads_names_and_the_active_flag_in_batches(w, settings):
    from smplwise.routers import tickets_admin

    def call(conn):
        return tickets_admin.holders(principal=principal_of(conn, "dev-joni"), conn=conn)

    small, before = _traced(w, call)
    for u in ("hila", "omer", "ruth", "sami", "tali", "yoni"):
        bind(w.c, settings, u, "tickets_view", "installation", "*")
    big, after = _traced(w, call)
    added = len(after["users"]) - len(before["users"])
    assert added == 6
    # each new binding still costs its own role / scope reads (unchanged); the per-person name and active reads are gone
    per_binding = (big - small) / added
    assert per_binding <= 3, f"{small} -> {big} statements for {added} more holders"
    hila = next(u for u in after["users"] if u["id"] == "dev-hila")
    assert hila["active"] is True and hila["name"]


def test_eligible_assignees_keeps_its_answer(w):
    from smplwise.services.tickets import service

    with Database(w.settings.db_path).connection(mode="read") as conn:
        out = service.eligible_assignees(conn, MAINT, None)
    assert [r["id"] for r in out][0] == "dev-mona" and out[0]["member_role"] == "manager"
    assert {r["id"] for r in out} >= {"dev-mona", "dev-tom", "dev-gil"} and "dev-dina" not in {r["id"] for r in out}  # dina: tickets.view denied
    assert all(set(r) == {"kind", "id", "name", "member_role"} and r["name"] for r in out)


# ---------------------------------------------------------------- F-20: the settings document is read once per request


def _count_reads(monkeypatch, skip: tuple[str, ...] = ()) -> list[int]:
    """Counts settings_doc.read calls, except those made from a module in `skip` (its own per-row reads)."""
    import sys

    calls = [0]
    real = settings_doc.read

    def counting(conn):
        if sys._getframe(1).f_globals.get("__name__") not in skip:
            calls[0] += 1
        return real(conn)

    monkeypatch.setattr(settings_doc, "read", counting)
    return calls


def test_admin_departments_reads_the_settings_document_a_fixed_number_of_times(w, monkeypatch):
    calls = _count_reads(monkeypatch)
    assert w.c.get(f"{API}/tickets/admin/departments").status_code == 200
    two = calls[0]
    for key in ("garden", "security"):
        assert w.c.post(f"{API}/tickets/admin/departments", json={"key": key, "name": key, "icon": "sparkle"}).status_code == 201
    calls[0] = 0
    r = w.c.get(f"{API}/tickets/admin/departments")
    assert r.status_code == 200 and len(r.json()["departments"]) == 4
    assert calls[0] == two, f"{two} reads with 2 departments, {calls[0]} with 4"


def test_dept_handlers_reads_the_settings_document_a_fixed_number_of_times(w, monkeypatch):
    """The department level (the phone-unmask setting) is read once per request. Each member's own "verify with a code" switch
    (phone_verify, per member row) is not this finding's and is left out of the count."""
    calls = _count_reads(monkeypatch, skip=("smplwise.services.tickets.phone_verify",))
    r = w.c.get(f"{API}/tickets/dept-handlers", headers=as_user("mona"))
    assert r.status_code == 200 and len(r.json()["departments"]) == 1
    one = calls[0]
    w.member(w.cleaning, "mona", "manager")
    calls[0] = 0
    r = w.c.get(f"{API}/tickets/dept-handlers", headers=as_user("mona"))
    assert r.status_code == 200 and len(r.json()["departments"]) == 2
    assert calls[0] == one, f"{one} reads with 1 department, {calls[0]} with 2"


# ---------------------------------------------------------------- F-13: the shared helpers


def test_the_shared_403_keeps_action_reason_and_details(w):
    r = w.c.get(f"{API}/tickets/by-entity/light.hall", headers=as_user("nobody"))
    assert r.status_code == 403 and r.json()["details"] == {"permission": "tickets.view"}
    with Database(w.settings.db_path).connection(mode="read") as conn:
        row = conn.execute("SELECT action, decision, resource_type, resource_id, reason FROM audit_log ORDER BY id DESC LIMIT 1").fetchone()
    assert tuple(row) == ("tickets.view", "denied", "installation", "*", "no_binding")


def test_the_shared_422_envelope_is_the_same(w):
    from smplwise.routers import _tickets_common as tc

    with Database(w.settings.db_path).connection(mode="read") as conn:
        one = tc.invalid(conn, "months", "invalid")
        many = tc.invalid_fields(conn, [{"field": "a", "code": "b"}, {"field": "c", "code": "d"}])
    assert (one.status, one.code, one.user_message, one.details) == (422, "validation", "ערך לא תקין.", {"fields": [{"field": "months", "code": "invalid"}]})
    assert many.details == {"fields": [{"field": "a", "code": "b"}, {"field": "c", "code": "d"}]}


def test_no_tickets_router_copies_rid_or_builds_the_422_envelope_inline():
    import ast
    from pathlib import Path

    routers = Path(__file__).resolve().parents[1] / "smplwise" / "routers"
    offenders = []
    for path in sorted(routers.glob("tickets*.py")) + [routers / "home_ticket_photo.py"]:
        src = path.read_text(encoding="utf-8")
        tree = ast.parse(src)
        offenders += [f"{path.name}:{n.lineno} def {n.name}" for n in tree.body
                      if isinstance(n, ast.FunctionDef) and n.name in {"_rid", "_need_any"}]
        offenders += [f"{path.name}: inline 422" for _ in range(src.count('ApiError(422, "validation", text(conn, "ערך לא תקין.")'))]
    assert offenders == []


# ---------------------------------------------------------------- T4: one recipient expansion


def test_the_matrix_role_expansion_is_the_shared_one(w, settings):
    from smplwise.services import notify_recipients
    from smplwise.services.tickets import notify_matrix

    bind(w.c, settings, "hila", "tickets_view", "installation", "*")
    with Database(w.settings.db_path).connection() as conn:
        conn.execute("INSERT INTO groups(id, name, created_at) VALUES ('g-x', 'x', '2026-11-14T00:00:00Z')")
        conn.execute("INSERT INTO group_members(group_id, user_id) VALUES ('g-x', 'dev-vic')")
        conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) "
                     "VALUES ('b-x', 'group', 'g-x', 'tickets_view', 'installation', '*', 'allow', 1, 'test', '2026-11-14T00:00:00Z')")
        conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at, expires_at) "
                     "VALUES ('b-old', 'user', 'dev-omer', 'tickets_view', 'installation', '*', 'allow', 1, 'test', '2026-11-14T00:00:00Z', '2020-01-01T00:00:00Z')")
    with Database(w.settings.db_path).connection(mode="read") as conn:
        got = notify_matrix.role_members(conn, ["tickets_view", "operator"])
        shared = notify_recipients.expand(conn, {"roles": ["tickets_view", "operator"]}, ["tickets_view", "operator"], active_only=False)
    assert got == shared
    assert "dev-hila" in got and "dev-vic" in got and "dev-omer" not in got and "dev-mona" in got
    assert notify_matrix.role_members(conn=None, roles=[]) == []  # no roles: no statement at all
