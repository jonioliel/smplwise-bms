"""CALENDARS-298 section 6 - who may do what in which calendar: installation permission AND per-calendar role, scope, visibility."""
from __future__ import annotations

import sqlite3
from typing import Any

from ...errors import ApiError
from ...rbac import INSTALLATION, Principal, _active_bindings, authorize, is_system_admin
from . import model

NOT_FOUND_HE = "היומן לא נמצא."


def scope_of(cal: sqlite3.Row | dict[str, Any]) -> tuple[str, str]:
    return ("floor", cal["floor_id"]) if cal["floor_id"] else INSTALLATION


def _role_ids(conn: sqlite3.Connection, principal: Principal) -> set[str]:
    return {b["role_id"] for b in _active_bindings(conn, principal) if b["effect"] == "allow"}


def _department_ids(conn: sqlite3.Connection, principal: Principal) -> set[str]:
    try:
        rows = conn.execute(
            """SELECT department_id FROM ticket_department_members
               WHERE (subject_kind = 'user' AND subject_id = ?)
                  OR (subject_kind = 'group' AND subject_id IN (SELECT group_id FROM group_members WHERE user_id = ?))""",
            (principal.user_id, principal.user_id)).fetchall()
    except sqlite3.Error:
        return set()
    return {r[0] for r in rows}


class Ctx:
    """Per-request memo of the principal's identity facts (roles, departments, admin flag) so a list does not repeat the lookups."""

    def __init__(self, conn: sqlite3.Connection, principal: Principal, data_dir: Any = None) -> None:
        self.conn, self.principal, self.data_dir = conn, principal, data_dir
        self.admin = is_system_admin(conn, principal.user_id)
        self.roles = _role_ids(conn, principal)
        self.departments = _department_ids(conn, principal)
        self._perm: dict[tuple[str, tuple[str, str]], bool] = {}

    def has(self, perm: str, target: tuple[str, str] = INSTALLATION) -> bool:
        k = (perm, target)
        if k not in self._perm:
            self._perm[k] = authorize(self.conn, self.principal, perm, target).allowed
        return self._perm[k]

    def role_in(self, cal: sqlite3.Row | dict[str, Any]) -> str | None:
        """The effective calendar role, or None. A role never exceeds the installation permissions (contract 6.2 rule 1): without
        `calendar.view` at the calendar's scope there is no role at all; `book` and above also need `calendar.book`."""
        target = scope_of(cal)
        if not self.has(model.PERM_VIEW, target):
            return None
        best: str | None = None

        def raise_to(r: str) -> None:
            nonlocal best
            if best is None or model.ROLE_RANK[r] > model.ROLE_RANK[best]:
                best = r

        if self.admin or cal["owner_user_id"] == self.principal.user_id:
            raise_to("manage")
        elif self.has(model.PERM_MANAGE, target):
            raise_to("edit")  # a site manager inside his scope
        for m in self.conn.execute("SELECT subject_kind, subject_id, cal_role FROM cal_members WHERE calendar_id = ?", (cal["id"],)).fetchall():
            k, sid = m["subject_kind"], m["subject_id"]
            if (k == "user" and sid == self.principal.user_id) or (k == "role" and sid in self.roles) or (k == "department" and sid in self.departments) or k == "everyone":
                raise_to(m["cal_role"])
        if best in ("book", "edit") and not (self.admin or self.has(model.PERM_BOOK, target)):
            best = "view"  # no booking permission: at most the view role (a manager keeps `manage`: he may approve without booking)
        return best

    def can_see(self, cal: sqlite3.Row | dict[str, Any]) -> bool:
        if not self.has(model.PERM_VIEW, scope_of(cal)):
            return False
        return self.role_in(cal) is not None or cal["visibility"] != "members"


def get_visible(ctx: Ctx, cid: str, *, include_archived: bool = False) -> sqlite3.Row:
    """The calendar row, or the uniform 404 (absent, never masked) when it is unknown, archived (unless asked) or outside the caller's reach."""
    row = ctx.conn.execute("SELECT * FROM cal_calendars WHERE id = ?", (cid,)).fetchone()
    if row is None or (row["archived_at"] and not include_archived) or not ctx.can_see(row):
        raise ApiError(404, "not_found", NOT_FOUND_HE)
    return row


def need_role(ctx: Ctx, cal: sqlite3.Row, minimum: str, perm: str | None = None) -> str:
    """Raises the audited-by-caller 403 when the effective role is below `minimum` (the caller audits via `deny`)."""
    role = ctx.role_in(cal)
    if role is None or model.ROLE_RANK[role] < model.ROLE_RANK[minimum] or (perm and not ctx.has(perm, scope_of(cal))):
        raise Denied(perm or "calendar.role", cal["id"], minimum)
    return role


class Denied(Exception):
    def __init__(self, permission: str, resource_id: str, need: str = "") -> None:
        super().__init__(permission)
        self.permission, self.resource_id, self.need = permission, resource_id, need


def detail_level(role: str | None, cal: sqlite3.Row, *, organizer: bool) -> str:
    """Contract 6.3: `full` (title, notes, organizer), `titles` (title, no notes), `busy` (nothing)."""
    if organizer or (role and model.ROLE_RANK[role] >= model.ROLE_RANK["edit"]):
        return "full"
    if role in ("view", "book") or cal["visibility"] == "details_to_all":
        return "titles"
    return "busy"
