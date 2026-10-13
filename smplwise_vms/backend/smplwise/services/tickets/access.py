"""CR-038 section 8: the module switch and THE visibility rule of the tickets module.

WHAT a caller may do is a permission (tickets.view / create / manage / external / all_departments / configure); WHERE it applies is
the ticket's place (the RBAC scope chain, when the ticket has one) AND department membership (`ticket_department_members`, direct
or through a group). Departments are deliberately not an RBAC scope type (section 8).

    visible(ticket) = module on
        AND place_ok:  placed ticket -> authorize(tickets.view, place target)   (deny on the chain wins)
                       placeless     -> tickets.view held at ANY scope           (review T18-1: a floor-scoped creator keeps it)
        AND ( tickets.all_departments (same target / anywhere for placeless)
              OR member of the ticket's department (manager or member, direct or through a group)
              OR the creator
              OR the CURRENT internal assignee )

What a visible ticket shows depends on why it is visible (review T18-2): members, managers and all-departments holders see
everything (`Seen.full`); a creator or internal assignee who is not a member sees the card, the status, the assignee's name and
only the timeline rows / photos marked `visible_external` plus their own (`event_visible`, `attachment_visible`).

EVERY read of a ticket goes through this module: `require_visible()` for one ticket (an invisible, unknown or foreign id is the same
404 `ticket_not_found`), `visible_page()` for lists (an indexed SQL superset, then `visible()` per row). store.ticket_row_unchecked /
store.candidate_rows are called from here only (tests/test_tickets_visibility.py fails otherwise), so a later slice that adds a
route cannot read a ticket around this rule."""
from __future__ import annotations

import sqlite3
from dataclasses import dataclass, field
from typing import Any

from ...db import get_setting
from ...errors import ApiError
from ...rbac import INSTALLATION, Principal, authorize, permissions_anywhere
from . import naming, store

FEATURE_KEY = "tickets.enabled"
VIEW, CREATE, MANAGE, EXTERNAL, ALL_DEPARTMENTS, CONFIGURE = (
    "tickets.view", "tickets.create", "tickets.manage", "tickets.external", "tickets.all_departments", "tickets.configure",
)
TICKET_PERMISSIONS: tuple[str, ...] = (VIEW, CREATE, MANAGE, EXTERNAL, ALL_DEPARTMENTS, CONFIGURE)
PAGE_DEFAULT, PAGE_MAX = 50, 200
SCAN_FACTOR = 5  # a page scans at most 5 x limit candidate rows, then returns short with a cursor (section 13.6)


def module_on(conn: sqlite3.Connection) -> bool:
    return (get_setting(conn, FEATURE_KEY, "false") or "false") == "true"


def public_ready(conn: sqlite3.Connection) -> bool:
    """Whether a ticket can be sent to an outside contact: the public handler page (add-on option `tickets_public`, a configured
    public address - slice 4) exists. Always False in slice 1: external assignment answers 409 public_link_unavailable."""
    return False


def text(conn: sqlite3.Connection, template: str) -> str:
    """A user-facing Hebrew message of the module, with its display name (D33)."""
    return naming.render_for(conn, template, "he")


def require_module(conn: sqlite3.Connection) -> None:
    """The uniform answer of every tickets route while the module is off (the `multimedia` precedent)."""
    if not module_on(conn):
        raise ApiError(404, "feature_disabled", text(conn, "מודול ה{tickets} כבוי בהגדרות המערכת."))


def not_found(conn: sqlite3.Connection) -> ApiError:
    return ApiError(404, "ticket_not_found", text(conn, "ה{ticket} לא {f:נמצאה|m:נמצא}."))


def place_target(row: dict[str, Any]) -> tuple[str, str] | None:
    """The RBAC target of a placed ticket: its floor, else its building, else its site; None for a placeless ticket."""
    if row.get("floor_id"):
        return ("floor", row["floor_id"])
    if row.get("building_id"):
        return ("building", row["building_id"])
    if row.get("site_id"):
        return ("site", row["site_id"])
    return None


class Viewer:
    """One caller's view of the module for one request: the permissions held anywhere, per place target and the department roles,
    each computed once (a list of 200 rows asks the same questions 200 times)."""

    def __init__(self, conn: sqlite3.Connection, principal: Principal):
        self.conn = conn
        self.principal = principal
        self._anywhere: frozenset[str] | None = None
        self._targets: dict[tuple[str, tuple[str, str]], bool] = {}
        self._roles: dict[str, str] | None = None
        self._installation: dict[str, bool] = {}

    @property
    def uid(self) -> str:
        return self.principal.user_id

    @property
    def anywhere(self) -> frozenset[str]:
        if self._anywhere is None:
            row = self.conn.execute("SELECT active FROM users WHERE id = ?", (self.uid,)).fetchone()
            active = row is None or bool(row["active"])
            self._anywhere = frozenset(permissions_anywhere(self.conn, self.principal)) if active else frozenset()
        return self._anywhere

    def holds(self, permission: str, row: dict[str, Any] | None = None) -> bool:
        """The permission where a ticket lies: on its place target, or at any scope for a placeless ticket (or no ticket)."""
        target = place_target(row) if row else None
        if target is None:
            return permission in self.anywhere
        key = (permission, target)
        if key not in self._targets:
            self._targets[key] = authorize(self.conn, self.principal, permission, target).allowed
        return self._targets[key]

    def holds_installation(self, permission: str) -> bool:
        if permission not in self._installation:
            self._installation[permission] = authorize(self.conn, self.principal, permission, INSTALLATION).allowed
        return self._installation[permission]

    @property
    def roles(self) -> dict[str, str]:
        if self._roles is None:
            self._roles = store.memberships_of(self.conn, self.uid)
        return self._roles

    def role(self, department_id: str) -> str | None:
        return self.roles.get(department_id)

    def is_manager(self, row: dict[str, Any]) -> bool:
        """Manager rights in the ticket's department (section 3): tickets.manage where the ticket lies AND (a manager member of its
        department OR tickets.all_departments there)."""
        if not self.holds(MANAGE, row):
            return False
        return self.role(row["department_id"]) == "manager" or self.holds(ALL_DEPARTMENTS, row)

    def manages_department(self, department_id: str) -> bool:
        """Manager rights in a department for a placeless action (the assignee picker, creating with an assignment)."""
        if MANAGE not in self.anywhere:
            return False
        return self.role(department_id) == "manager" or ALL_DEPARTMENTS in self.anywhere

    def is_assignee(self, row: dict[str, Any]) -> bool:
        """The CURRENT internal assignee: an active assignment of kind user naming this caller."""
        return row.get("asg_kind") == "user" and row.get("asg_user_id") == self.uid and not row.get("asg_ended_at")

    def can_create_in(self, dept: dict[str, Any]) -> bool:
        """tickets.create (a manual ticket is placeless: any scope) in an active department the caller is a member of, or that lets
        anyone open tickets (`open_to_all`)."""
        if CREATE not in self.anywhere or not dept.get("active") or dept.get("deleted_at"):
            return False
        return bool(self.role(dept["id"])) or bool(dept.get("open_to_all"))


@dataclass(frozen=True)
class Seen:
    """A ticket the caller may see, and why."""

    row: dict[str, Any]
    full: bool
    reasons: frozenset[str] = field(default_factory=frozenset)
    manager: bool = False
    assignee: bool = False


def visible(viewer: Viewer, row: dict[str, Any] | None) -> Seen | None:
    """THE rule (module docstring). None = the caller may not know the ticket exists."""
    if row is None or not module_on(viewer.conn):
        return None
    if not viewer.holds(VIEW, row):
        return None
    reasons: set[str] = set()
    if viewer.holds(ALL_DEPARTMENTS, row):
        reasons.add("all_departments")
    role = viewer.role(row["department_id"])
    if role:
        reasons.add(role)
    if row.get("created_by") == viewer.uid:
        reasons.add("creator")
    assignee = viewer.is_assignee(row)
    if assignee:
        reasons.add("assignee")
    if not reasons:
        return None
    full = bool(reasons & {"all_departments", "manager", "member"})
    return Seen(row=row, full=full, reasons=frozenset(reasons), manager=viewer.is_manager(row), assignee=assignee)


def visible_by_id(viewer: Viewer, ticket_id: str | None) -> Seen | None:
    """A ticket by id when the caller may see it, else None (never says which)."""
    if not ticket_id:
        return None
    return visible(viewer, store.ticket_row_unchecked(viewer.conn, ticket_id))


def require_visible(viewer: Viewer, ticket_id: str) -> Seen:
    """One ticket for a route: the uniform 404 for an id that is unknown, foreign or invisible to this caller."""
    seen = visible_by_id(viewer, ticket_id)
    if seen is None:
        raise not_found(viewer.conn)
    return seen


def visible_by_number(viewer: Viewer, number: int) -> Seen | None:
    return visible(viewer, store.ticket_by_number_unchecked(viewer.conn, number))


def visible_open_by_dedupe_key(viewer: Viewer, key: str) -> Seen | None:
    """The OPEN ticket carrying a dedupe key (phase 2's rule tickets absorb repeats), when the creator may see it."""
    return visible(viewer, store.open_by_dedupe_key_unchecked(viewer.conn, key))


def event_visible(seen: Seen, ev: dict[str, Any], uid: str) -> bool:
    return seen.full or bool(ev.get("visible_external")) or ev.get("actor_user_id") == uid


def attachment_visible(seen: Seen, att: dict[str, Any], uid: str) -> bool:
    return seen.full or bool(att.get("visible_external")) or (att.get("uploaded_by_kind") == "user" and att.get("uploaded_by") == uid)


SCOPES = ("visible", "mine", "department", "all")


def visible_page(
    viewer: Viewer,
    *,
    scope: str = "visible",
    statuses: tuple[str, ...] | None = None,
    department_id: str | None = None,
    query: str = "",
    cursor: str | None = None,
    limit: int = PAGE_DEFAULT,
) -> tuple[list[Seen], str | None]:
    """A page of the tickets this caller may see, newest activity first (keyset `cursor`). `scope`: `mine` = created by or
    assigned to the caller; `department` = the departments the caller is a member of; `all` = every department (needs
    tickets.all_departments); `visible` = everything visible. The SQL superset is indexed; `visible()` decides every row; at most
    SCAN_FACTOR x limit rows are scanned per page (the page may come back short, with a cursor to continue)."""
    conn = viewer.conn
    limit = max(1, min(int(limit), PAGE_MAX))
    all_depts = ALL_DEPARTMENTS in viewer.anywhere
    member_depts = list(viewer.roles)
    if scope == "all":
        if not all_depts:
            raise ApiError(403, "forbidden", text(conn, "אין הרשאה לכל המחלקות."), details={"permission": ALL_DEPARTMENTS})
        dept_ids, user_id = None, None
    elif scope == "department":
        dept_ids, user_id = member_depts, None
    elif scope == "mine":
        dept_ids, user_id = [], viewer.uid
    else:
        dept_ids, user_id = (None if all_depts else member_depts), viewer.uid
    if dept_ids is not None and not dept_ids and not user_id:
        return [], None
    after = store.decode_cursor(cursor)
    out: list[Seen] = []
    scanned = 0
    cap = SCAN_FACTOR * limit
    exhausted = False
    while len(out) < limit and scanned < cap:
        want = min(limit, cap - scanned)
        batch = store.candidate_rows(conn, department_ids=dept_ids, user_id=user_id, statuses=statuses, department_id=department_id,
                                     query=query, after=after, limit=want)
        for row in batch:
            scanned += 1
            after = (row["last_activity_at"], row["id"])
            seen = visible(viewer, row)
            if seen is not None:
                out.append(seen)
                if len(out) >= limit:
                    break
        if len(batch) < want:
            # a short batch is the end of the candidates - unless the page filled before its last row was looked at
            exhausted = not batch or after == (batch[-1]["last_activity_at"], batch[-1]["id"])
            break
    next_cursor = None if exhausted or after is None else store.encode_cursor(*after)
    return out, next_cursor
