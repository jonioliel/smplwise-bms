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
DELETE = "tickets.delete"  # owner 14.10: full deletion (services/tickets/deletion.py)
HANDLERS = "tickets.handlers"  # owner 2026-10-17: a department manager manages his departments' handlers (services/tickets/dept_handlers.py)
TECH_REQUESTS = "tickets.technician_requests"  # VPORTALRFQ (owner 2026-10-17): approve the portal's technician requests (portal_more.py)
TICKET_PERMISSIONS: tuple[str, ...] = (VIEW, CREATE, MANAGE, EXTERNAL, ALL_DEPARTMENTS, CONFIGURE, "tickets.costs.view", "tickets.costs",  # +S9 (D31)
                                       DELETE, HANDLERS, TECH_REQUESTS)
PAGE_DEFAULT, PAGE_MAX = 50, 200
SCAN_FACTOR = 5  # a page scans at most 5 x limit candidate rows, then returns short with a cursor (section 13.6)


def module_on(conn: sqlite3.Connection) -> bool:
    return (get_setting(conn, FEATURE_KEY, "false") or "false") == "true"


def public_ready(conn: sqlite3.Connection) -> bool:
    """Whether a ticket can be sent to an outside contact: the public handler page exists - the add-on option `tickets_public`
    is on, its listener runs and a public address is configured (slice 4, services/tickets/public_runtime.py). Otherwise external
    assignment answers 409 public_link_unavailable and Settings says what is missing."""
    from .public_runtime import RUNTIME

    return RUNTIME.ready(conn)


def text(conn: sqlite3.Connection, template: str) -> str:
    """A user-facing Hebrew message of the module, with its display name (D33)."""
    return naming.render_for(conn, template, "he")


def require_module(conn: sqlite3.Connection) -> None:
    """The uniform answer of every tickets route while the module is off (the `multimedia` precedent)."""
    if not module_on(conn):
        raise ApiError(404, "feature_disabled", text(conn, "מודול {the_tickets} כבוי בהגדרות המערכת."))


def not_found(conn: sqlite3.Connection) -> ApiError:
    return ApiError(404, "ticket_not_found", text(conn, "{the_ticket} לא {f:נמצאה|m:נמצא}."))


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
    return _decide(viewer, row)


def _decide(viewer: Viewer, row: dict[str, Any]) -> Seen | None:
    """visible() after the module switch: the place, the department roles, the creator and the current assignee."""
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


BATCH_IDS = 500  # ids per IN (...) read of visible_many (well under SQLite's bound-variable limit)


def visible_many(viewer: Viewer, ticket_ids: Any) -> dict[str, Seen | None]:
    """visible_by_id() for many ids at once (MGRDASH speed fix): the rows are read in batches of BATCH_IDS with the same SELECT as
    the single read and the module switch is read once; every row is then decided by the SAME rule as visible(). The answer maps
    every non-empty id asked for to its Seen or None (unknown, foreign or invisible - never says which)."""
    ids = list(dict.fromkeys(i for i in ticket_ids if i))
    if not ids:
        return {}
    if not module_on(viewer.conn):
        return dict.fromkeys(ids)
    rows: dict[str, dict[str, Any]] = {}
    for k in range(0, len(ids), BATCH_IDS):
        rows.update(store.ticket_rows_unchecked(viewer.conn, ids[k:k + BATCH_IDS]))
    return {i: (_decide(viewer, rows[i]) if i in rows else None) for i in ids}


def visible_by_ids(viewer: Viewer, ticket_ids: Any) -> dict[str, Seen]:
    """MGRDASH phases 4-5: visible_many() keeping only the tickets the caller may see (an absent id says nothing about why)."""
    return {i: s for i, s in visible_many(viewer, ticket_ids).items() if s is not None}


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


def open_by_dedupe_key_system(conn: sqlite3.Connection, key: str) -> dict[str, Any] | None:
    """CR-038 phase 2 (TKRULES-291): the OPEN ticket carrying a dedupe key, for the SYSTEM author only (the rule engine absorbing a
    repeat in services/tickets/create.create_by_rule). No person is behind this read and the row is never shown to one - every person's
    read keeps going through visible()."""
    return store.open_by_dedupe_key_unchecked(conn, key)


ENTITY_SCAN = 200  # a device tab scans at most this many of the device's tickets (open first, newest first)


def visible_for_entity(viewer: Viewer, entity_id: str, registry_id: str | None, limit: int = PAGE_DEFAULT) -> list[Seen]:
    """Slice 3, the device tab: the device's tickets this caller may see (by registry id first, then entity id - section 12.2), open
    ones first. The CALLER checked the device itself first (device_context.readable_entity: devices.read on the entity, the security
    rule) - this function decides every ticket row with the one rule above."""
    out: list[Seen] = []
    for row in store.entity_ticket_rows_unchecked(viewer.conn, entity_id, registry_id, ENTITY_SCAN):
        seen = visible(viewer, row)
        if seen is not None:
            out.append(seen)
            if len(out) >= limit:
                break
    return out


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


# ---------------------------------------------------------------- the board table (slice 6b, D24 - section 13.6; nothing above changed)

EXPORT_MAX_ROWS = 5000  # the CSV export: more visible rows -> 413 export_too_large
EXPORT_MAX_SCANNED = 50_000  # candidate rows an export may look at before it gives up the same way (a filter that is far too wide)


class ExportTooLarge(Exception):
    """More than EXPORT_MAX_ROWS visible rows (or EXPORT_MAX_SCANNED candidates) for the filter."""


def _table_superset(viewer: Viewer, scope: str) -> tuple[list[str] | None, str | None] | None:
    """The indexed superset of a table scope, exactly as visible_page() draws it: (department ids or None = every one, the caller's
    own id or None); None when nothing can match. `all` needs tickets.all_departments (403)."""
    all_depts = ALL_DEPARTMENTS in viewer.anywhere
    member_depts = list(viewer.roles)
    if scope == "all":
        if not all_depts:
            raise ApiError(403, "forbidden", text(viewer.conn, "אין הרשאה לכל המחלקות."), details={"permission": ALL_DEPARTMENTS})
        return None, None
    if scope == "department":
        dept_ids, user_id = member_depts, None
    elif scope == "mine":
        dept_ids, user_id = [], viewer.uid
    else:
        dept_ids, user_id = (None if all_depts else member_depts), viewer.uid
    if dept_ids is not None and not dept_ids and not user_id:
        return None
    return dept_ids, user_id


def _table_scan(viewer: Viewer, query: Any, after: tuple[list[Any], str] | None, scan_cap: int, batch_size: int):
    """Walk the candidates of a table query in its order from `after`, yielding (row, seen-or-None, position) - the caller stops.
    `position` is the keyset of the row (its sort values and id)."""
    superset = _table_superset(viewer, query.filters.scope)
    if superset is None:
        return
    dept_ids, user_id = superset
    scanned = 0
    n = len(query.sort)
    while scanned < scan_cap:
        want = min(batch_size, scan_cap - scanned)
        batch = store.table_rows_unchecked(viewer.conn, department_ids=dept_ids, user_id=user_id, me=viewer.uid, filters=query.filters,
                                           sort=query.sort, after=after, limit=want)
        for row in batch:
            scanned += 1
            after = ([row[f"_s{i}"] for i in range(n)], row["id"])
            seen = visible(viewer, row)
            if seen is not None and query.filters.stuck and not seen.full:
                seen = None  # TK251: the stuck kind is management information - a filter on it never matches a limited row
            yield row, seen, after
        if len(batch) < want:
            return


def visible_table_page(viewer: Viewer, query: Any, cursor_after: tuple[list[Any], str] | None, limit: int) -> tuple[list[Seen], tuple[list[Any], str] | None]:
    """A page of the board table (section 13.6): `query` is a services/tickets/table.Query (whitelisted sort and filters); every row
    passes visible(); at most SCAN_FACTOR x limit candidates are scanned - a page that did not fill comes back short WITH the position
    to continue from (the client keeps loading). Returns (the visible rows, the keyset of the last row looked at or None at the end)."""
    out: list[Seen] = []
    position = cursor_after
    cap = SCAN_FACTOR * limit
    scanned = 0
    exhausted = True
    for _row, seen, pos in _table_scan(viewer, query, cursor_after, cap, limit):
        scanned += 1
        position = pos
        if seen is not None:
            out.append(seen)
        if len(out) >= limit or scanned >= cap:
            exhausted = False
            break
    if exhausted:
        return out, None
    return out, position


def visible_export_rows(viewer: Viewer, query: Any) -> list[Seen]:
    """Every visible row of a table query (the CSV export), in the table's order. Raises ExportTooLarge past EXPORT_MAX_ROWS visible
    rows or EXPORT_MAX_SCANNED candidates."""
    out: list[Seen] = []
    scanned = 0
    for _row, seen, _pos in _table_scan(viewer, query, None, EXPORT_MAX_SCANNED + 1, 500):
        scanned += 1
        if scanned > EXPORT_MAX_SCANNED:
            raise ExportTooLarge()
        if seen is not None:
            out.append(seen)
            if len(out) > EXPORT_MAX_ROWS:
                raise ExportTooLarge()
    return out
