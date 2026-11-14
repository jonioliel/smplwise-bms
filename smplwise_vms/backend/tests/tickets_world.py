"""CR-038 test fixtures: one installation with the tickets module on and a cast of people for the permission matrix.

    joni  system_admin (bootstrap)                      -> every ticket permission, all departments
    mona  operator + tickets_manage grant, MANAGER of maintenance
    tom   operator, MEMBER (technician) of maintenance
    nora  operator, member of nothing                    -> a creator who is not a member (limited view, review T18-2)
    fred  operator bound to floor 2 only, no membership  -> a floor-scoped creator of placeless tickets (review T18-1)
    gil   operator bound to floor 3 only, MEMBER of maintenance
    cleo  operator + tickets_manage grant, MANAGER of cleaning (another department)
    alda  tickets_view + tickets_all_departments grants  -> sees every department, manages nothing
    dina  operator, MEMBER of maintenance, with an installation-wide DENY of tickets_view
    vic   viewer                                         -> no ticket permission at all
Departments: the seeded "אחזקה" (dept-maintenance) and "ניקיון" (created through the API by joni)."""
from __future__ import annotations

import itertools
from dataclasses import dataclass, field
from typing import Any

from conftest import as_user, bind, seed_tree
from fastapi.testclient import TestClient

from smplwise.db import Database, new_id, now_iso, permission_revision
from smplwise.main import create_app

API = "/api/v1"
MAINT = "dept-maintenance"
_req = itertools.count(1)


def rid() -> str:
    return f"req-{next(_req):08d}-x"


@dataclass
class World:
    c: TestClient
    settings: Any
    floors: dict[str, str]
    cleaning: str
    ids: dict[str, str] = field(default_factory=dict)

    def h(self, user: str) -> dict[str, str]:
        return as_user(user)

    def create(self, user: str, title: str = "מזגן לא מקרר", dept: str = MAINT, **extra: Any) -> dict[str, Any]:
        r = self.c.post(f"{API}/tickets", json={"department_id": dept, "title": title, "client_request_id": rid(), **extra}, headers=self.h(user))
        assert r.status_code == 201, r.text
        return r.json()

    def get(self, user: str, ticket_id: str):
        return self.c.get(f"{API}/tickets/{ticket_id}", headers=self.h(user))

    def detail(self, ticket_id: str, user: str = "joni") -> dict[str, Any]:
        r = self.get(user, ticket_id)
        assert r.status_code == 200, r.text
        return r.json()

    def status(self, user: str, ticket_id: str, to: str, note: str | None = None, **extra: Any):
        rev = self.detail(ticket_id)["revision"]
        body: dict[str, Any] = {"to": to, "revision": rev, **extra}
        if note is not None:
            body["note"] = note
        return self.c.post(f"{API}/tickets/{ticket_id}/status", json=body, headers=self.h(user))

    def assign(self, user: str, ticket_id: str, assignee: str, **extra: Any):
        rev = self.detail(ticket_id)["revision"]
        return self.c.post(f"{API}/tickets/{ticket_id}/assign", json={"assignee": {"kind": "user", "id": f"dev-{assignee}"}, "revision": rev, **extra},
                           headers=self.h(user))

    def member(self, dept: str, user: str, role: str) -> None:
        r = self.c.put(f"{API}/tickets/admin/departments/{dept}/members/user/dev-{user}", json={"role": role})
        assert r.status_code == 200, r.text

    def place(self, ticket_id: str, floor_key: str) -> None:
        """Slice 3 resolves a device's place; here a ticket is placed on a floor directly (the data model is slice 1's)."""
        db = Database(self.settings.db_path)
        floor = self.floors[floor_key]
        with db.connection() as conn:
            row = conn.execute("SELECT building_id FROM floors WHERE id = ?", (floor,)).fetchone()
            site = conn.execute("SELECT site_id FROM buildings WHERE id = ?", (row["building_id"],)).fetchone()
            conn.execute("UPDATE tickets SET floor_id = ?, building_id = ?, site_id = ?, place_text = ? WHERE id = ?",
                         (floor, row["building_id"], site["site_id"], "קומה", ticket_id))

    def deny(self, user: str, role: str, scope_type: str = "installation", scope_id: str = "*") -> None:
        db = Database(self.settings.db_path)
        with db.connection() as conn:
            conn.execute(
                "INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) "
                "VALUES (?, 'user', ?, ?, ?, ?, 'deny', ?, 'test', ?)",
                (new_id(), f"dev-{user}", role, scope_type, scope_id, permission_revision(conn), now_iso()),
            )


def build(settings) -> World:
    c = TestClient(create_app(settings))
    c.get(f"{API}/me")  # joni bootstraps as system_admin
    floors = seed_tree(c)
    assert c.patch(f"{API}/settings", json={"tickets.enabled": "true"}).status_code == 200
    for u in ("mona", "tom", "nora", "cleo", "dina"):
        bind(c, settings, u, "operator", "installation", "*")
    bind(c, settings, "fred", "operator", "floor", floors["floor2"])
    bind(c, settings, "gil", "operator", "floor", floors["floor3"])
    bind(c, settings, "vic", "viewer", "installation", "*")
    for u in ("mona", "cleo"):
        bind(c, settings, u, "tickets_manage", "installation", "*")
    bind(c, settings, "alda", "tickets_view", "installation", "*")
    bind(c, settings, "alda", "tickets_all_departments", "installation", "*")
    r = c.post(f"{API}/tickets/admin/departments", json={"key": "cleaning", "name": "ניקיון", "icon": "sparkle"})
    assert r.status_code == 201, r.text
    w = World(c=c, settings=settings, floors=floors, cleaning=r.json()["id"])
    w.member(MAINT, "mona", "manager")
    w.member(MAINT, "tom", "member")
    w.member(MAINT, "gil", "member")
    w.member(MAINT, "dina", "member")
    w.member(w.cleaning, "cleo", "manager")
    w.deny("dina", "tickets_view")
    return w
