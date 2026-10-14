"""CR-038: ALL SQL of the tickets module (section 5, data-store decision Q11 / D16: the main SQLite file behind one storage layer -
a later move to another file or engine touches this module only).

Visibility rule: a ticket row is read here only by services/tickets/access.py (`ticket_row_unchecked`, `candidate_rows`,
`entity_ticket_rows_unchecked`); every
router, screen and later slice reaches a ticket through access.require_visible() / access.visible_page(). The names say "unchecked"
on purpose and tests/test_tickets_visibility.py fails when any other module calls them."""
from __future__ import annotations

import base64
import json
import sqlite3
from typing import Any, Iterable

from ...db import new_id, now_iso

# a ticket row with its CURRENT assignment (the one `current_assignment_id` names; NULL columns when unassigned)
_TICKET_SELECT = (
    "SELECT t.*, a.assignee_kind AS asg_kind, a.user_id AS asg_user_id, a.contact_id AS asg_contact_id, a.assignee_name AS asg_name, "
    "a.assigned_at AS asg_at, a.acknowledged_at AS asg_ack_at, a.ended_at AS asg_ended_at "
    "FROM tickets t LEFT JOIN ticket_assignments a ON a.id = t.current_assignment_id"
)


def _dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    return dict(row) if row is not None else None


# ---------------------------------------------------------------- people (names only; identity comes from Home Assistant)

def display_name(conn: sqlite3.Connection, user_id: str | None) -> str:
    if not user_id:
        return ""
    ha = conn.execute("SELECT name, username FROM ha_users WHERE id = ?", (user_id,)).fetchone()
    if ha and (ha["name"] or ha["username"]):
        return ha["name"] or ha["username"]
    u = conn.execute("SELECT display_name, username FROM users WHERE id = ?", (user_id,)).fetchone()
    if u and (u["display_name"] or u["username"]):
        return u["display_name"] or u["username"]
    return user_id


def group_name(conn: sqlite3.Connection, group_id: str) -> str:
    row = conn.execute("SELECT name FROM groups WHERE id = ?", (group_id,)).fetchone()
    return row["name"] if row else group_id


def user_is_active(conn: sqlite3.Connection, user_id: str) -> bool:
    u = conn.execute("SELECT active FROM users WHERE id = ?", (user_id,)).fetchone()
    if u is not None and not u["active"]:
        return False
    h = conn.execute("SELECT is_active FROM ha_users WHERE id = ?", (user_id,)).fetchone()
    if h is not None and not h["is_active"]:
        return False
    return u is not None or h is not None


def active_user_ids(conn: sqlite3.Connection) -> set[str]:
    ids = {r[0] for r in conn.execute("SELECT id FROM users WHERE active = 1").fetchall()}
    ids |= {r[0] for r in conn.execute("SELECT id FROM ha_users WHERE is_active = 1").fetchall()}
    ids -= {r[0] for r in conn.execute("SELECT id FROM users WHERE active = 0").fetchall()}
    ids -= {r[0] for r in conn.execute("SELECT id FROM ha_users WHERE is_active = 0").fetchall()}
    return ids


def groups(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute("SELECT id, name FROM groups ORDER BY name").fetchall()]


def group_ids_of(conn: sqlite3.Connection, user_id: str) -> list[str]:
    return [r[0] for r in conn.execute("SELECT group_id FROM group_members WHERE user_id = ?", (user_id,)).fetchall()]


def group_member_ids(conn: sqlite3.Connection, group_id: str) -> list[str]:
    return [r[0] for r in conn.execute("SELECT user_id FROM group_members WHERE group_id = ?", (group_id,)).fetchall()]


def active_bindings(conn: sqlite3.Connection, now: str) -> list[dict[str, Any]]:
    """Every binding in force (the "הרשאות" overview lists the ticket permissions they carry)."""
    return [dict(r) for r in conn.execute(
        "SELECT * FROM bindings WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?) ORDER BY created_at", (now,)).fetchall()]


# ---------------------------------------------------------------- departments, priorities, categories

DEPARTMENT_FIELDS = ("key", "name", "description", "icon", "color", "sort_order", "active", "reopen_days", "open_to_all",
                     # slice 2: the department's policy overrides (services/tickets/policy.py)
                     "auto_close_after_days", "share_history_external", "urgent_is_critical", "link_sliding_days", "link_cap_days",
                     "link_grace_hours", "send_hours_json")
PRIORITY_KEYS = ("urgent", "high", "normal", "low")
# section 13.1 defaults (minutes): unassigned, link not opened, acknowledge, stuck, stuck while waiting, resolve, remind every
SLA_DEFAULTS: dict[str, tuple[int, int, int, int, int, int, int]] = {
    "urgent": (15, 1440, 30, 60, 1440, 480, 30),
    "high": (60, 1440, 120, 480, 4320, 2880, 240),
    "normal": (240, 1440, 1440, 4320, 10080, 10080, 1440),
    "low": (1440, 1440, 4320, 10080, 20160, 43200, 4320),
}
PRIORITY_DEFAULTS: dict[str, tuple[str, int, str, int]] = {  # name, rank, notify severity, default
    "urgent": ("דחופה", 0, "critical", 0),
    "high": ("גבוהה", 1, "alert", 0),
    "normal": ("רגילה", 2, "alert", 1),
    "low": ("נמוכה", 3, "info", 0),
}


def departments(conn: sqlite3.Connection, *, include_inactive: bool = True) -> list[dict[str, Any]]:
    sql = "SELECT * FROM ticket_departments WHERE deleted_at IS NULL" + ("" if include_inactive else " AND active = 1")
    return [dict(r) for r in conn.execute(sql + " ORDER BY sort_order, name").fetchall()]


def department(conn: sqlite3.Connection, dept_id: str) -> dict[str, Any] | None:
    return _dict(conn.execute("SELECT * FROM ticket_departments WHERE id = ? AND deleted_at IS NULL", (dept_id,)).fetchone())


def department_any(conn: sqlite3.Connection, dept_id: str) -> dict[str, Any] | None:
    """A department row even when soft-deleted (a ticket keeps naming the department it was filed in)."""
    return _dict(conn.execute("SELECT * FROM ticket_departments WHERE id = ?", (dept_id,)).fetchone())


def category_any(conn: sqlite3.Connection, category_id: str) -> dict[str, Any] | None:
    return _dict(conn.execute("SELECT * FROM ticket_categories WHERE id = ?", (category_id,)).fetchone())


def department_key_taken(conn: sqlite3.Connection, key: str, except_id: str | None = None) -> bool:
    row = conn.execute("SELECT id FROM ticket_departments WHERE key = ? AND deleted_at IS NULL", (key,)).fetchone()
    return row is not None and row["id"] != except_id


def insert_department(conn: sqlite3.Connection, fields: dict[str, Any]) -> str:
    dept_id = new_id()
    now = now_iso()
    cols = [k for k in DEPARTMENT_FIELDS if k in fields]
    conn.execute(
        f"INSERT INTO ticket_departments(id, {', '.join(cols)}, revision, created_at, updated_at) VALUES (?, {', '.join('?' * len(cols))}, 1, ?, ?)",
        (dept_id, *[fields[k] for k in cols], now, now),
    )
    seed_department_defaults(conn, dept_id)
    return dept_id


def seed_department_defaults(conn: sqlite3.Connection, dept_id: str) -> None:
    """Four priorities and the default SLA matrix of section 13.1 for a new department."""
    now = now_iso()
    for key in PRIORITY_KEYS:
        name, rank, severity, is_default = PRIORITY_DEFAULTS[key]
        pid = new_id()
        conn.execute("INSERT INTO ticket_priorities(id, department_id, key, name, rank, notify_severity, is_default, active) VALUES (?,?,?,?,?,?,?,1)",
                     (pid, dept_id, key, name, rank, severity, is_default))
        un, lo, ack, st, sw, rs, rm = SLA_DEFAULTS[key]
        conn.execute(
            """INSERT INTO ticket_sla_rules(department_id, priority_id, unassigned_after_min, link_unopened_min, ack_within_min, stuck_after_min,
                   stuck_waiting_min, resolve_within_min, remind_every_min, max_reminders, manager_alert_after_steps, revision, updated_by, updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,2,1,1,NULL,?)""",
            (dept_id, pid, un, lo, ack, st, sw, rs, rm, now),
        )


def update_department(conn: sqlite3.Connection, dept_id: str, fields: dict[str, Any], expect_revision: int) -> bool:
    cols = [k for k in DEPARTMENT_FIELDS if k in fields]
    sets = ", ".join(f"{k} = ?" for k in cols)
    cur = conn.execute(
        f"UPDATE ticket_departments SET {sets + ', ' if sets else ''}revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ? AND deleted_at IS NULL",
        (*[fields[k] for k in cols], now_iso(), dept_id, expect_revision),
    )
    return cur.rowcount == 1


def soft_delete_department(conn: sqlite3.Connection, dept_id: str) -> None:
    now = now_iso()
    conn.execute("UPDATE ticket_departments SET deleted_at = ?, active = 0, revision = revision + 1, updated_at = ? WHERE id = ?", (now, now, dept_id))


def restore_department(conn: sqlite3.Connection, dept_id: str, key: str) -> None:
    """Undo a soft delete (owner 2026-10-14): the department row only; nothing under it was changed by the delete."""
    conn.execute("UPDATE ticket_departments SET deleted_at = NULL, active = 1, key = ?, revision = revision + 1, updated_at = ? WHERE id = ?",
                 (key, now_iso(), dept_id))


def deleted_departments(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute("SELECT * FROM ticket_departments WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC").fetchall()]


def open_ticket_count(conn: sqlite3.Connection, dept_id: str) -> int:
    return int(conn.execute("SELECT COUNT(*) FROM tickets WHERE department_id = ? AND status NOT IN ('closed', 'cancelled')", (dept_id,)).fetchone()[0])


def ticket_count(conn: sqlite3.Connection, dept_id: str) -> int:
    return int(conn.execute("SELECT COUNT(*) FROM tickets WHERE department_id = ?", (dept_id,)).fetchone()[0])


def priorities(conn: sqlite3.Connection, dept_id: str) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute("SELECT * FROM ticket_priorities WHERE department_id = ? ORDER BY rank", (dept_id,)).fetchall()]


def priority(conn: sqlite3.Connection, priority_id: str) -> dict[str, Any] | None:
    return _dict(conn.execute("SELECT * FROM ticket_priorities WHERE id = ?", (priority_id,)).fetchone())


def priority_by_key(conn: sqlite3.Connection, dept_id: str, key: str) -> dict[str, Any] | None:
    return _dict(conn.execute("SELECT * FROM ticket_priorities WHERE department_id = ? AND key = ?", (dept_id, key)).fetchone())


def default_priority(conn: sqlite3.Connection, dept_id: str) -> dict[str, Any] | None:
    row = conn.execute("SELECT * FROM ticket_priorities WHERE department_id = ? AND active = 1 ORDER BY is_default DESC, rank DESC LIMIT 1", (dept_id,)).fetchone()
    return _dict(row)


def update_priority(conn: sqlite3.Connection, priority_id: str, fields: dict[str, Any]) -> None:
    cols = [k for k in ("name", "notify_severity", "active", "is_default") if k in fields]
    if not cols:
        return
    if fields.get("is_default"):
        row = priority(conn, priority_id)
        if row:
            conn.execute("UPDATE ticket_priorities SET is_default = 0 WHERE department_id = ?", (row["department_id"],))
    conn.execute(f"UPDATE ticket_priorities SET {', '.join(f'{k} = ?' for k in cols)} WHERE id = ?", (*[fields[k] for k in cols], priority_id))


def categories(conn: sqlite3.Connection, dept_id: str, *, include_inactive: bool = True) -> list[dict[str, Any]]:
    sql = "SELECT * FROM ticket_categories WHERE department_id = ? AND deleted_at IS NULL" + ("" if include_inactive else " AND active = 1")
    return [dict(r) for r in conn.execute(sql + " ORDER BY sort_order, name", (dept_id,)).fetchall()]


def category(conn: sqlite3.Connection, category_id: str) -> dict[str, Any] | None:
    return _dict(conn.execute("SELECT * FROM ticket_categories WHERE id = ? AND deleted_at IS NULL", (category_id,)).fetchone())


def insert_category(conn: sqlite3.Connection, dept_id: str, fields: dict[str, Any]) -> str:
    cid = new_id()
    conn.execute(
        "INSERT INTO ticket_categories(id, department_id, parent_id, name, default_priority_id, domains_json, sort_order, active) VALUES (?,?,?,?,?,?,?,?)",
        (cid, dept_id, fields.get("parent_id"), fields["name"], fields.get("default_priority_id"), fields.get("domains_json", "[]"),
         int(fields.get("sort_order") or 0), int(fields.get("active", 1))),
    )
    return cid


def update_category(conn: sqlite3.Connection, category_id: str, fields: dict[str, Any]) -> None:
    cols = [k for k in ("name", "parent_id", "default_priority_id", "domains_json", "sort_order", "active") if k in fields]
    if cols:
        conn.execute(f"UPDATE ticket_categories SET {', '.join(f'{k} = ?' for k in cols)} WHERE id = ?", (*[fields[k] for k in cols], category_id))


def soft_delete_category(conn: sqlite3.Connection, category_id: str) -> None:
    conn.execute("UPDATE ticket_categories SET deleted_at = ?, active = 0 WHERE id = ?", (now_iso(), category_id))


# ---------------------------------------------------------------- department membership (section 8: WHERE a permission applies)

def members(conn: sqlite3.Connection, dept_id: str) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute("SELECT * FROM ticket_department_members WHERE department_id = ? ORDER BY member_role, added_at", (dept_id,)).fetchall()]


def member_row(conn: sqlite3.Connection, dept_id: str, kind: str, subject_id: str) -> dict[str, Any] | None:
    return _dict(conn.execute("SELECT * FROM ticket_department_members WHERE department_id = ? AND subject_kind = ? AND subject_id = ?", (dept_id, kind, subject_id)).fetchone())


def manager_count(conn: sqlite3.Connection, dept_id: str) -> int:
    return int(conn.execute("SELECT COUNT(*) FROM ticket_department_members WHERE department_id = ? AND member_role = 'manager'", (dept_id,)).fetchone()[0])


def upsert_member(conn: sqlite3.Connection, dept_id: str, kind: str, subject_id: str, role: str, notify_new: int, added_by: str) -> None:
    conn.execute(
        """INSERT INTO ticket_department_members(department_id, subject_kind, subject_id, member_role, notify_new, added_by, added_at)
           VALUES (?,?,?,?,?,?,?)
           ON CONFLICT(department_id, subject_kind, subject_id) DO UPDATE SET member_role = excluded.member_role, notify_new = excluded.notify_new""",
        (dept_id, kind, subject_id, role, notify_new, added_by, now_iso()),
    )


def delete_member(conn: sqlite3.Connection, dept_id: str, kind: str, subject_id: str) -> bool:
    return conn.execute("DELETE FROM ticket_department_members WHERE department_id = ? AND subject_kind = ? AND subject_id = ?", (dept_id, kind, subject_id)).rowcount == 1


def memberships_of(conn: sqlite3.Connection, user_id: str) -> dict[str, str]:
    """{department id: 'manager' | 'member'} of a user - direct rows and rows of the groups they belong to (manager wins);
    deleted and inactive departments included (the caller decides)."""
    out: dict[str, str] = {}
    for r in conn.execute(
        """SELECT m.department_id, m.member_role FROM ticket_department_members m JOIN ticket_departments d ON d.id = m.department_id
           WHERE d.deleted_at IS NULL AND ((m.subject_kind = 'user' AND m.subject_id = ?)
              OR (m.subject_kind = 'group' AND m.subject_id IN (SELECT group_id FROM group_members WHERE user_id = ?)))""",
        (user_id, user_id),
    ).fetchall():
        if out.get(r["department_id"]) != "manager":
            out[r["department_id"]] = r["member_role"]
    return out


def department_user_ids(conn: sqlite3.Connection, dept_id: str) -> dict[str, str]:
    """{user id: role} of every person who is a member of a department, directly or through a group (manager wins)."""
    out: dict[str, str] = {}
    for m in members(conn, dept_id):
        ids = [m["subject_id"]] if m["subject_kind"] == "user" else group_member_ids(conn, m["subject_id"])
        for uid in ids:
            if out.get(uid) != "manager":
                out[uid] = m["member_role"]
    return out


# ---------------------------------------------------------------- SLA rules (slice 2: one row per department x priority, 13.1)

SLA_COLUMNS = ("unassigned_after_min", "link_unopened_min", "ack_within_min", "stuck_after_min", "stuck_waiting_min", "resolve_within_min",
               "remind_every_min", "max_reminders", "manager_alert_after_steps")


def sla_rules(conn: sqlite3.Connection, dept_id: str) -> list[dict[str, Any]]:
    """The department's rows with their priority (most urgent first). A priority without a row (never expected: rows are seeded
    with the priorities) is listed with every threshold off and revision 0."""
    out = []
    for p in priorities(conn, dept_id):
        row = sla_rule(conn, dept_id, p["id"])
        out.append({"priority_id": p["id"], "priority_key": p["key"], "priority_name": p["name"], "priority_active": bool(p["active"]),
                    **({c: row[c] for c in SLA_COLUMNS} if row else {c: None for c in SLA_COLUMNS}),
                    "revision": row["revision"] if row else 0, "updated_at": row["updated_at"] if row else None,
                    "updated_by": row["updated_by"] if row else None})
    return out


def sla_rule(conn: sqlite3.Connection, dept_id: str, priority_id: str) -> dict[str, Any] | None:
    return _dict(conn.execute("SELECT * FROM ticket_sla_rules WHERE department_id = ? AND priority_id = ?", (dept_id, priority_id)).fetchone())


def write_sla_rule(conn: sqlite3.Connection, dept_id: str, priority_id: str, fields: dict[str, Any], expect_revision: int, by: str) -> bool:
    """Write the fields of one row (revision-checked; revision 0 creates a missing row). False when the revision moved."""
    now = now_iso()
    if expect_revision == 0:
        if sla_rule(conn, dept_id, priority_id) is not None:
            return False
        conn.execute("INSERT INTO ticket_sla_rules(department_id, priority_id, revision, updated_by, updated_at) VALUES (?,?,1,?,?)",
                     (dept_id, priority_id, by, now))
        expect_revision = 1
    cols = [c for c in SLA_COLUMNS if c in fields]
    sets = "".join(f"{c} = ?, " for c in cols)
    cur = conn.execute(
        f"UPDATE ticket_sla_rules SET {sets}revision = revision + 1, updated_by = ?, updated_at = ? WHERE department_id = ? AND priority_id = ? AND revision = ?",
        (*[fields[c] for c in cols], by, now, dept_id, priority_id, expect_revision),
    )
    return cur.rowcount == 1


def open_ticket_ids(conn: sqlite3.Connection, dept_id: str, *, priority_id: str | None = None, status: str | None = None) -> list[str]:
    """Ids of the department's open tickets (to recompute their dues after a rule or policy change). Ids only: no content."""
    sql = "SELECT id FROM tickets WHERE department_id = ? AND status NOT IN ('closed', 'cancelled')"
    args: list[Any] = [dept_id]
    if priority_id:
        sql += " AND priority_id = ?"
        args.append(priority_id)
    if status:
        sql += " AND status = ?"
        args.append(status)
    return [r[0] for r in conn.execute(sql, args).fetchall()]


def sla_inputs(conn: sqlite3.Connection, ticket_id: str) -> dict[str, Any] | None:
    """The clock columns of one ticket for services/tickets/sla.py - no title, description or person: nothing to show, so not a
    visibility bypass (the visibility guard lists the readers that return ticket content)."""
    row = conn.execute(
        """SELECT t.department_id, t.priority_id, t.status, t.created_at, t.last_activity_at, t.eta_at, t.done_at,
                  a.assigned_at AS assigned_at,
                  (SELECT MAX(ended_at) FROM ticket_assignments WHERE ticket_id = t.id) AS last_end,
                  (SELECT MAX(at) FROM ticket_events WHERE ticket_id = t.id AND kind = 'reopened') AS last_reopen
           FROM tickets t LEFT JOIN ticket_assignments a ON a.id = t.current_assignment_id AND a.ended_at IS NULL WHERE t.id = ?""",
        (ticket_id,),
    ).fetchone()
    if row is None:
        return None
    out = dict(row)
    out["unassigned_since"] = max(x for x in (row["created_at"], row["last_end"], row["last_reopen"]) if x)
    return out


def set_sla_dues(conn: sqlite3.Connection, ticket_id: str, dues: dict[str, str | None]) -> None:
    """The four derived clock columns only (the revision and `updated_at` do not move)."""
    conn.execute("UPDATE tickets SET ack_due_at = ?, stuck_due_at = ?, resolve_due_at = ?, next_check_at = ? WHERE id = ?",
                 (dues["ack_due_at"], dues["stuck_due_at"], dues["resolve_due_at"], dues["next_check_at"], ticket_id))


# ---------------------------------------------------------------- templates (slice 2: ticket templates; message templates are slice 5b's)

TEMPLATE_FIELDS = ("name", "title", "body", "category_id", "priority_key", "lang", "active", "purpose")


def templates(conn: sqlite3.Connection, dept_id: str | None, *, kind: str | None = None, include_inactive: bool = True) -> list[dict[str, Any]]:
    sql = "SELECT * FROM ticket_templates WHERE deleted_at IS NULL AND " + ("department_id IS NULL" if dept_id is None else "department_id = ?")
    args: list[Any] = [] if dept_id is None else [dept_id]
    if kind:
        sql += " AND kind = ?"
        args.append(kind)
    if not include_inactive:
        sql += " AND active = 1"
    return [dict(r) for r in conn.execute(sql + " ORDER BY name, id", args).fetchall()]


def template(conn: sqlite3.Connection, template_id: str) -> dict[str, Any] | None:
    return _dict(conn.execute("SELECT * FROM ticket_templates WHERE id = ? AND deleted_at IS NULL", (template_id,)).fetchone())


def insert_template(conn: sqlite3.Connection, dept_id: str | None, kind: str, fields: dict[str, Any], by: str) -> str:
    tid = new_id()
    cols = [k for k in TEMPLATE_FIELDS if k in fields]
    conn.execute(
        f"INSERT INTO ticket_templates(id, department_id, kind, {''.join(c + ', ' for c in cols)}revision, updated_by, updated_at) "
        f"VALUES (?, ?, ?, {''.join('?, ' for _ in cols)}1, ?, ?)",
        (tid, dept_id, kind, *[fields[c] for c in cols], by, now_iso()),
    )
    return tid


def update_template(conn: sqlite3.Connection, template_id: str, fields: dict[str, Any], expect_revision: int, by: str) -> bool:
    cols = [k for k in TEMPLATE_FIELDS if k in fields]
    sets = "".join(f"{c} = ?, " for c in cols)
    cur = conn.execute(
        f"UPDATE ticket_templates SET {sets}revision = revision + 1, updated_by = ?, updated_at = ? WHERE id = ? AND revision = ? AND deleted_at IS NULL",
        (*[fields[c] for c in cols], by, now_iso(), template_id, expect_revision),
    )
    return cur.rowcount == 1


def soft_delete_template(conn: sqlite3.Connection, template_id: str, by: str) -> None:
    now = now_iso()
    conn.execute("UPDATE ticket_templates SET deleted_at = ?, active = 0, revision = revision + 1, updated_by = ?, updated_at = ? WHERE id = ?",
                 (now, by, now, template_id))


# ---------------------------------------------------------------- tickets

def next_number(conn: sqlite3.Connection) -> int:
    """The next running number (one sequence for the whole installation, Q13). Inside the caller's write transaction."""
    conn.execute("INSERT OR IGNORE INTO ticket_sequence(name, value) VALUES ('ticket', 1000)")
    conn.execute("UPDATE ticket_sequence SET value = value + 1 WHERE name = 'ticket'")
    return int(conn.execute("SELECT value FROM ticket_sequence WHERE name = 'ticket'").fetchone()[0])


def insert_ticket(conn: sqlite3.Connection, row: dict[str, Any]) -> None:
    cols = list(row)
    conn.execute(f"INSERT INTO tickets({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))})", tuple(row[c] for c in cols))


def ticket_row_unchecked(conn: sqlite3.Connection, ticket_id: str) -> dict[str, Any] | None:
    """THE raw read of one ticket (with its current assignment). Visibility is NOT checked here: only services/tickets/access.py
    may call it (tests/test_tickets_visibility.py enforces that)."""
    return _dict(conn.execute(_TICKET_SELECT + " WHERE t.id = ?", (ticket_id,)).fetchone())


def ticket_by_number_unchecked(conn: sqlite3.Connection, number: int) -> dict[str, Any] | None:
    return _dict(conn.execute(_TICKET_SELECT + " WHERE t.number = ?", (number,)).fetchone())


def open_by_dedupe_key_unchecked(conn: sqlite3.Connection, key: str) -> dict[str, Any] | None:
    return _dict(conn.execute(_TICKET_SELECT + " WHERE t.dedupe_key = ? AND t.status NOT IN ('closed', 'cancelled')", (key,)).fetchone())


def encode_cursor(last_activity_at: str, ticket_id: str) -> str:
    return base64.urlsafe_b64encode(f"{last_activity_at}|{ticket_id}".encode()).decode().rstrip("=")


def decode_cursor(cursor: str | None) -> tuple[str, str] | None:
    if not cursor:
        return None
    try:
        raw = base64.urlsafe_b64decode(cursor + "=" * (-len(cursor) % 4)).decode()
        at, tid = raw.split("|", 1)
    except (ValueError, UnicodeDecodeError):
        return None
    if not at or not tid or len(at) > 40 or len(tid) > 64:
        return None
    return at, tid


STATUS_GROUPS: dict[str, tuple[str, ...]] = {
    "open": ("new", "assigned", "acknowledged", "in_progress", "waiting_part", "done", "returned"),
    "unassigned": ("new", "returned"),
    "handling": ("assigned", "acknowledged", "in_progress", "waiting_part"),
    "done": ("done",),
    "closed": ("closed", "cancelled"),
}


def candidate_rows(
    conn: sqlite3.Connection,
    *,
    department_ids: Iterable[str] | None,
    user_id: str | None,
    statuses: Iterable[str] | None,
    department_id: str | None,
    query: str,
    after: tuple[str, str] | None,
    limit: int,
) -> list[dict[str, Any]]:
    """The SUPERSET prefilter of a list (section 13.6): department membership (`department_ids`; None = every department) OR the
    caller's own tickets (`user_id`: created by or currently assigned to them), plus the filters, newest activity first, keyset
    after `after`. Visibility is NOT decided here: access.visible_page() checks every row (unchecked on purpose)."""
    where: list[str] = []
    args: list[Any] = []
    scope_parts: list[str] = []
    if department_ids is not None:
        ids = list(dict.fromkeys(department_ids))
        if ids:
            scope_parts.append(f"t.department_id IN ({', '.join('?' * len(ids))})")
            args.extend(ids)
    else:
        scope_parts.append("1 = 1")
    if user_id:
        scope_parts.append("(t.created_by = ? OR (a.assignee_kind = 'user' AND a.user_id = ? AND a.ended_at IS NULL))")
        args.extend([user_id, user_id])
    if not scope_parts:
        return []
    where.append("(" + " OR ".join(scope_parts) + ")")
    if statuses is not None:
        sts = list(statuses)
        where.append(f"t.status IN ({', '.join('?' * len(sts))})")
        args.extend(sts)
    if department_id:
        where.append("t.department_id = ?")
        args.append(department_id)
    q = (query or "").strip()
    if q:
        digits = q.lstrip("#")
        if digits.isdigit() and len(digits) <= 9:
            where.append("(t.number = ? OR t.title LIKE ? ESCAPE '\\' OR t.device_name LIKE ? ESCAPE '\\')")
            like = "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
            args.extend([int(digits), like, like])
        else:
            like = "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
            where.append("(t.title LIKE ? ESCAPE '\\' OR t.device_name LIKE ? ESCAPE '\\' OR t.place_text LIKE ? ESCAPE '\\')")
            args.extend([like, like, like])
    if after:
        where.append("(t.last_activity_at < ? OR (t.last_activity_at = ? AND t.id < ?))")
        args.extend([after[0], after[0], after[1]])
    sql = _TICKET_SELECT + " WHERE " + " AND ".join(where) + " ORDER BY t.last_activity_at DESC, t.id DESC LIMIT ?"
    args.append(int(limit))
    return [dict(r) for r in conn.execute(sql, args).fetchall()]


def update_ticket(conn: sqlite3.Connection, ticket_id: str, fields: dict[str, Any], *, expect_revision: int | None = None, bump: bool = True) -> bool:
    """Write fields and move the revision; False when `expect_revision` no longer matches (the caller answers 409 ticket_stale).
    `bump=False`: progress that edits no field of the ticket (a note, a photo) leaves the revision where it is."""
    now = now_iso()
    cols = list(fields)
    sets = ", ".join(f"{c} = ?" for c in cols)
    sql = f"UPDATE tickets SET {sets + ', ' if sets else ''}{'revision = revision + 1, ' if bump else ''}updated_at = ? WHERE id = ?"
    args: list[Any] = [*[fields[c] for c in cols], now, ticket_id]
    if expect_revision is not None:
        sql += " AND revision = ?"
        args.append(expect_revision)
    return conn.execute(sql, args).rowcount == 1


def insert_event(
    conn: sqlite3.Connection,
    ticket_id: str,
    kind: str,
    *,
    actor_kind: str,
    actor_user_id: str | None = None,
    actor_name: str = "",
    assignment_id: str | None = None,
    from_status: str | None = None,
    to_status: str | None = None,
    body: str | None = None,
    data: dict[str, Any] | None = None,
    via: str = "app",
    visible_external: bool = False,
    at: str | None = None,
) -> int:
    cur = conn.execute(
        """INSERT INTO ticket_events(ticket_id, at, kind, actor_kind, actor_user_id, actor_name, assignment_id, from_status, to_status, body,
                                     data_json, via, visible_external) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (ticket_id, at or now_iso(), kind, actor_kind, actor_user_id, actor_name, assignment_id, from_status, to_status, body,
         json.dumps(data or {}, ensure_ascii=False, separators=(",", ":")), via, 1 if visible_external else 0),
    )
    return int(cur.lastrowid)


def events(conn: sqlite3.Connection, ticket_id: str) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute("SELECT * FROM ticket_events WHERE ticket_id = ? ORDER BY id", (ticket_id,)).fetchall()]


def assignments(conn: sqlite3.Connection, ticket_id: str) -> list[dict[str, Any]]:
    # rowid breaks a tie inside one second (random ids made two same-second assignments come back in either order)
    return [dict(r) for r in conn.execute("SELECT * FROM ticket_assignments WHERE ticket_id = ? ORDER BY assigned_at, rowid", (ticket_id,)).fetchall()]


def assignment(conn: sqlite3.Connection, assignment_id: str | None) -> dict[str, Any] | None:
    if not assignment_id:
        return None
    return _dict(conn.execute("SELECT * FROM ticket_assignments WHERE id = ?", (assignment_id,)).fetchone())


def last_assignment(conn: sqlite3.Connection, ticket_id: str) -> dict[str, Any] | None:
    return _dict(conn.execute("SELECT * FROM ticket_assignments WHERE ticket_id = ? ORDER BY assigned_at DESC, rowid DESC LIMIT 1", (ticket_id,)).fetchone())


def last_assignee_names(conn: sqlite3.Connection, ticket_ids: list[str]) -> dict[str, str]:
    """The name of the latest assignment of each ticket (for closed / returned tickets in a list)."""
    if not ticket_ids:
        return {}
    out: dict[str, str] = {}
    for r in conn.execute(
        f"SELECT ticket_id, assignee_name FROM ticket_assignments WHERE ticket_id IN ({', '.join('?' * len(ticket_ids))}) ORDER BY assigned_at, rowid",
        ticket_ids,
    ).fetchall():
        out[r["ticket_id"]] = r["assignee_name"]
    return out


def insert_assignment(conn: sqlite3.Connection, row: dict[str, Any]) -> str:
    aid = new_id()
    full = {"id": aid, **row}
    cols = list(full)
    conn.execute(f"INSERT INTO ticket_assignments({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))})", tuple(full[c] for c in cols))
    return aid


def update_assignment(conn: sqlite3.Connection, assignment_id: str, fields: dict[str, Any]) -> None:
    cols = list(fields)
    if cols:
        conn.execute(f"UPDATE ticket_assignments SET {', '.join(f'{c} = ?' for c in cols)} WHERE id = ?", (*[fields[c] for c in cols], assignment_id))


# ---------------------------------------------------------------- attachments

def attachments(conn: sqlite3.Connection, ticket_id: str) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute("SELECT * FROM ticket_attachments WHERE ticket_id = ? AND deleted_at IS NULL ORDER BY created_at, id", (ticket_id,)).fetchall()]


def attachment(conn: sqlite3.Connection, ticket_id: str, attachment_id: str) -> dict[str, Any] | None:
    return _dict(conn.execute("SELECT * FROM ticket_attachments WHERE id = ? AND ticket_id = ? AND deleted_at IS NULL", (attachment_id, ticket_id)).fetchone())


def attachment_count(conn: sqlite3.Connection, ticket_id: str) -> int:
    return int(conn.execute("SELECT COUNT(*) FROM ticket_attachments WHERE ticket_id = ? AND deleted_at IS NULL", (ticket_id,)).fetchone()[0])


def insert_attachment(conn: sqlite3.Connection, row: dict[str, Any]) -> None:
    cols = list(row)
    conn.execute(f"INSERT INTO ticket_attachments({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))})", tuple(row[c] for c in cols))


def soft_delete_attachment(conn: sqlite3.Connection, attachment_id: str, by: str) -> None:
    conn.execute("UPDATE ticket_attachments SET deleted_at = ?, deleted_by = ? WHERE id = ?", (now_iso(), by, attachment_id))


# ---------------------------------------------------------------- devices (slice 3: section 12 - place, history snapshot, the device tab)

def entity_row(conn: sqlite3.Connection, entity_id: str) -> dict[str, Any] | None:
    """A catalogued entity (never a removed one): what a device ticket names and where HA put it. No attribute is read."""
    return _dict(conn.execute(
        "SELECT entity_id, registry_id, name, original_name, domain, device_class, area_id, area_name, ha_floor_name FROM ha_entities "
        "WHERE entity_id = ? AND removed_at IS NULL", (entity_id,)).fetchone())


def entity_anchors(conn: sqlite3.Connection, entity_id: str) -> list[dict[str, Any]]:
    """The entity's CURRENT anchors on the maps (section 12.2), each with its floor, building and site (soft-deleted ones never), the
    lowest floor level first (an entity placed on two floors: the first one is the ticket's place, the others are named)."""
    return [dict(r) for r in conn.execute(
        """SELECT a.floor_id, a.x, a.y, f.name AS floor_name, f.level AS floor_level, b.id AS building_id, b.name AS building_name, s.id AS site_id
           FROM map_anchors a JOIN floors f ON f.id = a.floor_id JOIN buildings b ON b.id = f.building_id JOIN sites s ON s.id = b.site_id
           WHERE a.resource_type = 'ha_entity' AND a.resource_id = ? AND a.effective_to IS NULL
             AND f.deleted_at IS NULL AND b.deleted_at IS NULL AND s.deleted_at IS NULL
           ORDER BY f.level, f.sort_order, a.updated_at DESC""",
        (entity_id,),
    ).fetchall()]


def floor_zones(conn: sqlite3.Connection, floor_id: str) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute(
        "SELECT id, name, polygon_json FROM spatial_zones WHERE floor_id = ? AND deleted_at IS NULL", (floor_id,)).fetchall()]


def zone_place(conn: sqlite3.Connection, zone_id: str) -> dict[str, Any] | None:
    """A room with its floor, building and site (the fallback place of an entity without an anchor: the room linked to its HA area)."""
    return _dict(conn.execute(
        """SELECT z.id AS zone_id, z.name AS zone_name, f.id AS floor_id, f.name AS floor_name, b.id AS building_id, b.name AS building_name, s.id AS site_id
           FROM spatial_zones z JOIN floors f ON f.id = z.floor_id JOIN buildings b ON b.id = f.building_id JOIN sites s ON s.id = b.site_id
           WHERE z.id = ? AND z.deleted_at IS NULL AND f.deleted_at IS NULL AND b.deleted_at IS NULL AND s.deleted_at IS NULL""",
        (zone_id,),
    ).fetchone())


def site_building_count(conn: sqlite3.Connection, site_id: str) -> int:
    return int(conn.execute("SELECT COUNT(*) FROM buildings WHERE site_id = ? AND deleted_at IS NULL", (site_id,)).fetchone()[0])


def state_history(conn: sqlite3.Connection, entity_id: str, since: str, limit: int) -> list[dict[str, Any]]:
    """Source 2 of the snapshot (section 12.3): the 30-day state history of an entity that device_activity does not track, newest first."""
    return [dict(r) for r in conn.execute(
        "SELECT state, changed_at FROM ha_state_history WHERE entity_id = ? AND changed_at >= ? ORDER BY changed_at DESC, id DESC LIMIT ?",
        (entity_id, since, int(limit)),
    ).fetchall()]


def insert_device_context(conn: sqlite3.Connection, ticket_id: str, row: dict[str, Any]) -> None:
    conn.execute(
        """INSERT INTO ticket_device_context(ticket_id, entity_id, captured_at, window_from, window_to, source, items_json, coverage_json, truncated, withheld)
           VALUES (?,?,?,?,?,?,?,?,?,?)""",
        (ticket_id, row["entity_id"], row["captured_at"], row["window_from"], row["window_to"], row["source"],
         json.dumps(row.get("items") or [], ensure_ascii=False, separators=(",", ":")),
         json.dumps(row.get("coverage") or {}, ensure_ascii=False, separators=(",", ":")), 1 if row.get("truncated") else 0, row.get("withheld")),
    )


def device_context(conn: sqlite3.Connection, ticket_id: str) -> dict[str, Any] | None:
    """The frozen snapshot of a ticket (later history changes never alter it)."""
    row = conn.execute("SELECT * FROM ticket_device_context WHERE ticket_id = ?", (ticket_id,)).fetchone()
    if row is None:
        return None
    out = dict(row)
    for key, empty in (("items_json", []), ("coverage_json", {})):
        try:
            out[key[:-5]] = json.loads(out.pop(key) or "null") or empty
        except ValueError:
            out[key[:-5]] = empty
    return out


def entity_ticket_rows_unchecked(conn: sqlite3.Connection, entity_id: str, registry_id: str | None, limit: int) -> list[dict[str, Any]]:
    """The SUPERSET of a device's tickets (section 12.2 rename safety: by `registry_id` first, then `entity_id`): open ones first, newest
    first. Visibility is NOT decided here - access.visible_for_entity() checks every row (unchecked on purpose)."""
    where = "t.entity_id = ?"
    args: list[Any] = [entity_id]
    if registry_id:
        where = "(t.registry_id = ? OR t.entity_id = ?)"
        args = [registry_id, entity_id]
    sql = (_TICKET_SELECT + f" WHERE {where} ORDER BY CASE WHEN t.status IN ('closed', 'cancelled') THEN 1 ELSE 0 END, t.created_at DESC, t.id DESC LIMIT ?")
    return [dict(r) for r in conn.execute(sql, (*args, int(limit))).fetchall()]


# ---------------------------------------------------------------- idempotency of writes (review T22)

def request_get(conn: sqlite3.Connection, scope: str, client_request_id: str) -> dict[str, Any] | None:
    return _dict(conn.execute("SELECT * FROM ticket_requests WHERE scope = ? AND client_request_id = ?", (scope, client_request_id)).fetchone())


def request_put(conn: sqlite3.Connection, scope: str, client_request_id: str, route: str, status_code: int, response: Any) -> None:
    conn.execute(
        "INSERT OR IGNORE INTO ticket_requests(scope, client_request_id, route, status_code, response_json, at) VALUES (?,?,?,?,?,?)",
        (scope, client_request_id, route, status_code, json.dumps(response, ensure_ascii=False, separators=(",", ":")), now_iso()),
    )


def prune_requests(conn: sqlite3.Connection, before: str) -> int:
    return conn.execute("DELETE FROM ticket_requests WHERE at < ?", (before,)).rowcount


# ---------------------------------------------------------------- slice 6: the SLA monitor, the board, the notification bridge
# The monitor is a SYSTEM actor (no principal): it reads the open tickets it must look at through `monitor_rows_system` - called only by
# services/tickets/monitor.py (tests/test_tickets_monitor.py enforces that); people reach tickets through access.py as everywhere else.

_OPEN_SQL = "('new', 'assigned', 'acknowledged', 'in_progress', 'waiting_part', 'done', 'returned')"


def monitor_rows_system(conn: sqlite3.Connection, now: str, changed_since: str | None, limit: int) -> list[dict[str, Any]]:
    """The open tickets the SLA monitor must look at: never looked at (`next_check_at` NULL), due (`next_check_at <= now`), or
    changed since the monitor's previous run (`updated_at`, which every action moves - the monitor's own writes do not)."""
    sql = _TICKET_SELECT + f" WHERE t.status IN {_OPEN_SQL} AND (t.next_check_at IS NULL OR t.next_check_at <= ?"
    args: list[Any] = [now]
    if changed_since:
        sql += " OR t.updated_at >= ?"
        args.append(changed_since)
    sql += ") ORDER BY t.next_check_at IS NOT NULL, t.next_check_at, t.id LIMIT ?"
    args.append(int(limit))
    return [dict(r) for r in conn.execute(sql, args).fetchall()]


def ticket_row_system(conn: sqlite3.Connection, ticket_id: str) -> dict[str, Any] | None:
    """One ticket for a SYSTEM caller (the monitor, the notification bridge deciding recipients - who then pass access.visible per
    recipient). Never for a person's request: tests/test_tickets_monitor.py lists the only callers."""
    return _dict(conn.execute(_TICKET_SELECT + " WHERE t.id = ?", (ticket_id,)).fetchone())


def open_notification_keys(conn: sqlite3.Connection, prefix: str) -> list[str]:
    """Dedupe keys of the open notifications whose key starts with `prefix` (the bridge resolves a ticket's rows by prefix)."""
    like = prefix.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
    return [r[0] for r in conn.execute("SELECT DISTINCT dedupe_key FROM notifications WHERE state != 'resolved' AND dedupe_key LIKE ? ESCAPE '\\'", (like,)).fetchall()]


def done_rows_system(conn: sqlite3.Connection, limit: int) -> list[dict[str, Any]]:
    """`done` tickets of departments that close automatically (D10) - the monitor decides which are due."""
    return [dict(r) for r in conn.execute(
        _TICKET_SELECT + " JOIN ticket_departments d ON d.id = t.department_id WHERE t.status = 'done' AND t.done_at IS NOT NULL "
        "AND d.auto_close_after_days IS NOT NULL AND d.auto_close_after_days > 0 ORDER BY t.done_at LIMIT ?", (int(limit),)).fetchall()]


def set_sla_state(conn: sqlite3.Connection, ticket_id: str, fields: dict[str, Any]) -> None:
    """The monitor's bookkeeping columns (stuck_kind, stuck_level, reminders_sent, next_check_at, waiting_on / waiting_reason). It moves
    neither `revision` (a person editing the ticket never gets 409 because of the monitor) nor `updated_at` (that is the monitor's
    own "changed since" signal)."""
    allowed = ("stuck_kind", "stuck_level", "reminders_sent", "next_check_at", "waiting_on", "waiting_reason")
    cols = [c for c in fields if c in allowed]
    if cols:
        conn.execute(f"UPDATE tickets SET {', '.join(f'{c} = ?' for c in cols)} WHERE id = ?", (*[fields[c] for c in cols], ticket_id))


def ladder_marks(conn: sqlite3.Connection, ticket_id: str) -> tuple[dict[str, Any] | None, str | None]:
    """(the data of the latest 'stuck' timeline row, the time of the latest 'reminder' row after it) - the ladder's memory."""
    st = conn.execute("SELECT id, data_json FROM ticket_events WHERE ticket_id = ? AND kind = 'stuck' ORDER BY id DESC LIMIT 1", (ticket_id,)).fetchone()
    if st is None:
        return None, None
    try:
        data = json.loads(st["data_json"] or "{}")
    except ValueError:
        data = {}
    rem = conn.execute("SELECT at FROM ticket_events WHERE ticket_id = ? AND kind = 'reminder' AND id > ? ORDER BY id DESC LIMIT 1", (ticket_id, st["id"])).fetchone()
    return (data if isinstance(data, dict) else {}), (rem["at"] if rem else None)


def unassigned_since(conn: sqlite3.Connection, ticket: dict[str, Any]) -> str:
    """Since when nobody holds a `new` / `returned` ticket: the latest of its creation, the end of its last assignment and its reopen."""
    best = ticket.get("created_at") or ""
    r = conn.execute("SELECT MAX(ended_at) FROM ticket_assignments WHERE ticket_id = ?", (ticket["id"],)).fetchone()
    if r and r[0] and r[0] > best:
        best = r[0]
    r = conn.execute("SELECT MAX(at) FROM ticket_events WHERE ticket_id = ? AND kind = 'reopened'", (ticket["id"],)).fetchone()
    if r and r[0] and r[0] > best:
        best = r[0]
    return best


def _has_table(conn: sqlite3.Connection, name: str) -> bool:
    return conn.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", (name,)).fetchone() is not None


def current_link(conn: sqlite3.Connection, assignment_id: str | None) -> dict[str, Any] | None:
    """The newest handler link of an external assignment (slice 4's table; None before migration 0080 exists)."""
    if not assignment_id or not _has_table(conn, "ticket_links"):
        return None
    return _dict(conn.execute("SELECT * FROM ticket_links WHERE assignment_id = ? ORDER BY generation DESC, created_at DESC LIMIT 1", (assignment_id,)).fetchone())


def has_event_since(conn: sqlite3.Connection, ticket_id: str, kind: str, since: str) -> bool:
    return conn.execute("SELECT 1 FROM ticket_events WHERE ticket_id = ? AND kind = ? AND at >= ? LIMIT 1", (ticket_id, kind, since)).fetchone() is not None


def place_names(conn: sqlite3.Connection, ids: dict[str, set[str]]) -> dict[str, dict[str, Any]]:
    """Names (and the parent, the sort keys) of the places tickets point at: {'site:<id>': {...}, 'building:<id>': ..., 'floor:<id>': ...,
    'zone:<id>': ..., 'area:<id>': ...}. Deleted places keep their name (a ticket keeps naming where it was filed)."""
    out: dict[str, dict[str, Any]] = {}

    def fetch(kind: str, sql: str, keys: set[str]) -> None:
        keys = {k for k in keys if k}
        if not keys:
            return
        for r in conn.execute(sql.format(q=", ".join("?" * len(keys))), tuple(keys)).fetchall():
            out[f"{kind}:{r['id']}"] = dict(r)

    fetch("site", "SELECT id, name, sort_order FROM sites WHERE id IN ({q})", ids.get("site", set()))
    fetch("building", "SELECT id, name, site_id AS parent, sort_order FROM buildings WHERE id IN ({q})", ids.get("building", set()))
    fetch("floor", "SELECT id, name, building_id AS parent, level, sort_order FROM floors WHERE id IN ({q})", ids.get("floor", set()))
    fetch("zone", "SELECT id, name, floor_id AS parent FROM spatial_zones WHERE id IN ({q})", ids.get("zone", set()))
    fetch("area", "SELECT area_id AS id, name, floor_id AS parent FROM ha_areas WHERE area_id IN ({q})", ids.get("area", set()))
    return out


def manager_member_ids(conn: sqlite3.Connection, dept_id: str, *, notify_new_only: bool = False) -> list[str]:
    """User ids that are MANAGER members of a department (directly or through a group); `notify_new_only`: only rows with notify_new."""
    out: list[str] = []
    for m in members(conn, dept_id):
        if m["member_role"] != "manager" or (notify_new_only and not m["notify_new"]):
            continue
        ids = [m["subject_id"]] if m["subject_kind"] == "user" else group_member_ids(conn, m["subject_id"])
        for uid in ids:
            if uid not in out:
                out.append(uid)
    return out


# ---------------------------------------------------------------- the board table (slice 6b, D24 - section 13.6)
# Added by slice 6b; nothing above this line changed. The table's list and the CSV export read rows through
# table_rows_unchecked(), which - like candidate_rows() - is called from services/tickets/access.py only
# (tests/test_tickets_table.py guards it): it is the indexed SUPERSET, access.visible() decides every row.

from contextlib import contextmanager  # noqa: E402 - slice 6b keeps its additions in one block at the end
from typing import Iterator  # noqa: E402

_STATUS_ORDER_SQL = ("CASE t.status WHEN 'new' THEN 0 WHEN 'assigned' THEN 1 WHEN 'acknowledged' THEN 2 WHEN 'in_progress' THEN 3 "
                     "WHEN 'waiting_part' THEN 4 WHEN 'done' THEN 5 WHEN 'returned' THEN 6 WHEN 'closed' THEN 7 ELSE 8 END")
_NO_DUE = "9999-12-31T23:59:59Z"
# every expression is NOT NULL (a keyset comparison with NULL would drop rows): the sort key -> its SQL
TABLE_SORT_SQL: dict[str, str] = {
    "number": "t.number",
    "title": "t.title",
    "department": "COALESCE(d.name, '')",
    "priority": "COALESCE(p.rank, 99)",
    "status": _STATUS_ORDER_SQL,
    "assignee": "COALESCE(CASE WHEN a.ended_at IS NULL THEN a.assignee_name END, '')",
    "place": "COALESCE(t.place_text, '')",
    "device": "COALESCE(t.device_name, '')",
    "created": "t.created_at",
    "activity": "t.last_activity_at",
    "stuck": "CASE WHEN t.stuck_kind IS NULL THEN 0 ELSE 1 + COALESCE(t.stuck_level, 0) END",
    "sla": (f"CASE WHEN t.status IN ('closed', 'cancelled') THEN '{_NO_DUE}' ELSE min(COALESCE(t.ack_due_at, '{_NO_DUE}'), "
            f"COALESCE(t.stuck_due_at, '{_NO_DUE}'), COALESCE(t.resolve_due_at, '{_NO_DUE}')) END"),
    "cost": "COALESCE(t.cost_total_minor, -1)",  # slice 9 (0083): the approved / submitted total; no claim sorts first
}
_TABLE_FROM = (_TICKET_SELECT + " LEFT JOIN ticket_departments d ON d.id = t.department_id LEFT JOIN ticket_priorities p ON p.id = t.priority_id")


def _like(q: str) -> str:
    return "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"


def table_rows_unchecked(
    conn: sqlite3.Connection,
    *,
    department_ids: Iterable[str] | None,
    user_id: str | None,
    me: str,
    filters: Any,
    sort: tuple[tuple[str, str], ...],
    after: tuple[list[Any], str] | None,
    limit: int,
) -> list[dict[str, Any]]:
    """The SUPERSET of a table page (section 13.6): department membership (`department_ids`; None = every department) OR the caller's
    own tickets (`user_id`), the whitelisted `filters` (services/tickets/table.Filters), ordered by `sort` (keys of TABLE_SORT_SQL)
    with the id as the last tie-breaker, keyset after `after` (the last row's sort values and id). Each row carries its sort values
    as `_s0`, `_s1`... (the next cursor). Visibility is NOT decided here: access.visible_table_page() checks every row."""
    where: list[str] = []
    args: list[Any] = []
    scope_parts: list[str] = []
    if department_ids is not None:
        ids = list(dict.fromkeys(department_ids))
        if ids:
            scope_parts.append(f"t.department_id IN ({', '.join('?' * len(ids))})")
            args.extend(ids)
    else:
        scope_parts.append("1 = 1")
    if user_id:
        scope_parts.append("(t.created_by = ? OR (a.assignee_kind = 'user' AND a.user_id = ? AND a.ended_at IS NULL))")
        args.extend([user_id, user_id])
    if not scope_parts:
        return []
    where.append("(" + " OR ".join(scope_parts) + ")")
    f = filters
    if f.statuses is not None:
        where.append(f"t.status IN ({', '.join('?' * len(f.statuses))})")
        args.extend(f.statuses)
    if f.departments:
        where.append(f"t.department_id IN ({', '.join('?' * len(f.departments))})")
        args.extend(f.departments)
    if f.priorities:
        where.append(f"p.key IN ({', '.join('?' * len(f.priorities))})")
        args.extend(f.priorities)
    if f.assignee == "none":
        where.append("(t.current_assignment_id IS NULL OR a.id IS NULL OR a.ended_at IS NOT NULL)")
    elif f.assignee:
        kind, ident = ("user", me) if f.assignee == "me" else f.assignee.split(":", 1)
        column = "a.user_id" if kind == "user" else "a.contact_id"
        where.append(f"(a.assignee_kind = ? AND {column} = ? AND a.ended_at IS NULL)")
        args.extend([kind, ident])
    if f.floor:
        where.append("t.floor_id = ?")
        args.append(f.floor)
    if f.area:
        where.append("t.area_id = ?")
        args.append(f.area)
    if f.stuck == "any":
        where.append("t.stuck_kind IS NOT NULL")
    elif f.stuck:
        where.append("t.stuck_kind = ?")
        args.append(f.stuck)
    if f.waiting == "manager":
        where.append("t.waiting_on = 'manager'")
    if f.created_from:
        where.append("t.created_at >= ?")
        args.append(f.created_from)
    if f.created_to:
        where.append("t.created_at <= ?")
        args.append(f.created_to)
    if getattr(f, "cost_statuses", ()):  # slice 9 (0083)
        where.append(f"t.cost_status IN ({', '.join('?' * len(f.cost_statuses))})")
        args.extend(f.cost_statuses)
    q = (f.q or "").strip()
    if q:
        digits = q.lstrip("#")
        like = _like(q)
        if digits.isdigit() and len(digits) <= 9:
            where.append("(t.number = ? OR t.title LIKE ? ESCAPE '\\' OR t.device_name LIKE ? ESCAPE '\\')")
            args.extend([int(digits), like, like])
        else:
            where.append("(t.title LIKE ? ESCAPE '\\' OR t.device_name LIKE ? ESCAPE '\\' OR t.place_text LIKE ? ESCAPE '\\')")
            args.extend([like, like, like])
    exprs = [(TABLE_SORT_SQL[k], d) for k, d in sort]
    tie = exprs[0][1] if exprs else "desc"
    keys = exprs + [("t.id", tie)]
    if after is not None:
        values, last_id = after
        bound = [*values, last_id]
        ors: list[str] = []
        ors_args: list[Any] = []
        for i, (expr, direction) in enumerate(keys):
            parts = [f"{keys[j][0]} = ?" for j in range(i)] + [f"{expr} {'>' if direction == 'asc' else '<'} ?"]
            ors.append("(" + " AND ".join(parts) + ")")
            ors_args.extend(bound[: i + 1])
        where.append("(" + " OR ".join(ors) + ")")
        args.extend(ors_args)
    select_keys = ", ".join(f"{expr} AS _s{i}" for i, (expr, _d) in enumerate(exprs))
    sql = (_TABLE_FROM.replace("SELECT t.*,", f"SELECT {select_keys}, t.*,", 1) + " WHERE " + " AND ".join(where)
           + " ORDER BY " + ", ".join(f"{expr} {direction.upper()}" for expr, direction in keys) + " LIMIT ?")
    args.append(int(limit))
    return [dict(r) for r in conn.execute(sql, args).fetchall()]


def last_manual_reminder_at(conn: sqlite3.Connection, ticket_id: str) -> str | None:
    """When a manager last reminded the assignee by hand (bulk "remind": at most one manual reminder per ticket per hour)."""
    row = conn.execute("SELECT MAX(at) FROM ticket_events WHERE ticket_id = ? AND kind = 'reminder' AND json_extract(data_json, '$.manual') = 1",
                       (ticket_id,)).fetchone()
    return row[0] if row else None


@contextmanager
def item_transaction(conn: sqlite3.Connection, name: str = "ticket_item") -> Iterator[None]:
    """One bulk item in its OWN transaction inside the request's (a SAVEPOINT): everything the item wrote is undone when it raises,
    the items before and after it are kept (bulk actions are not all-or-nothing, section 13.6)."""
    conn.execute(f"SAVEPOINT {name}")
    try:
        yield
    except BaseException:
        conn.execute(f"ROLLBACK TO SAVEPOINT {name}")
        conn.execute(f"RELEASE SAVEPOINT {name}")
        raise
    conn.execute(f"RELEASE SAVEPOINT {name}")


# saved filters / layouts of the table (D24: private to the user, at most 20 each)

def saved_views(conn: sqlite3.Connection, user_id: str) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute("SELECT * FROM ticket_saved_views WHERE user_id = ? ORDER BY name, created_at, id", (user_id,)).fetchall()]


def saved_view(conn: sqlite3.Connection, user_id: str, view_id: str) -> dict[str, Any] | None:
    return _dict(conn.execute("SELECT * FROM ticket_saved_views WHERE id = ? AND user_id = ?", (view_id, user_id)).fetchone())


def saved_view_count(conn: sqlite3.Connection, user_id: str) -> int:
    return int(conn.execute("SELECT COUNT(*) FROM ticket_saved_views WHERE user_id = ?", (user_id,)).fetchone()[0])


def saved_view_name_taken(conn: sqlite3.Connection, user_id: str, name: str, except_id: str | None = None) -> bool:
    row = conn.execute("SELECT id FROM ticket_saved_views WHERE user_id = ? AND name = ?", (user_id, name)).fetchone()
    return row is not None and row["id"] != except_id


def insert_saved_view(conn: sqlite3.Connection, user_id: str, name: str, view_json: str) -> str:
    view_id = new_id()
    now = now_iso()
    conn.execute("INSERT INTO ticket_saved_views(id, user_id, name, view_json, created_at, updated_at) VALUES (?,?,?,?,?,?)",
                 (view_id, user_id, name, view_json, now, now))
    return view_id


def update_saved_view(conn: sqlite3.Connection, user_id: str, view_id: str, fields: dict[str, Any]) -> bool:
    cols = [k for k in ("name", "view_json") if k in fields]
    sets = ", ".join(f"{k} = ?" for k in cols)
    cur = conn.execute(f"UPDATE ticket_saved_views SET {sets + ', ' if sets else ''}updated_at = ? WHERE id = ? AND user_id = ?",
                       (*[fields[k] for k in cols], now_iso(), view_id, user_id))
    return cur.rowcount == 1


def delete_saved_view(conn: sqlite3.Connection, user_id: str, view_id: str) -> bool:
    return conn.execute("DELETE FROM ticket_saved_views WHERE id = ? AND user_id = ?", (view_id, user_id)).rowcount == 1


# ---------------------------------------------------------------- full deletion of ONE ticket (owner 14.10, services/tickets/deletion.py)
# The caller decided visibility and permissions (access.require_visible + deletion.check); these functions only count and remove rows.

def deletion_facts(conn: sqlite3.Connection, ticket_id: str) -> dict[str, Any]:
    """What a deletion would remove, as numbers and stored file paths only (never text): notes, photos, links, cost claims and
    their statuses, the files on disk (photos and invoice files, relative to the module's file root)."""
    one = lambda sql: int(conn.execute(sql, (ticket_id,)).fetchone()[0])  # noqa: E731
    photos = [r[0] for r in conn.execute("SELECT path FROM ticket_attachments WHERE ticket_id = ?", (ticket_id,)).fetchall()]
    cost_files = [r[0] for r in conn.execute("SELECT path FROM ticket_cost_files WHERE ticket_id = ? OR claim_id IN "
                                             "(SELECT id FROM ticket_cost_claims WHERE ticket_id = ?)", (ticket_id, ticket_id)).fetchall()]
    statuses = [r[0] for r in conn.execute("SELECT status FROM ticket_cost_claims WHERE ticket_id = ?", (ticket_id,)).fetchall()]
    return {
        "notes": one("SELECT COUNT(*) FROM ticket_events WHERE ticket_id = ? AND kind = 'note'"),
        "events": one("SELECT COUNT(*) FROM ticket_events WHERE ticket_id = ?"),
        "photos": len(photos),
        "links": one("SELECT COUNT(*) FROM ticket_links WHERE ticket_id = ?"),
        "live_links": one("SELECT COUNT(*) FROM ticket_links WHERE ticket_id = ? AND revoked_at IS NULL"),
        "claims": len(statuses),
        "claim_statuses": statuses,
        "cost_files": len(cost_files),
        "paths": photos + cost_files,
    }


def cancel_ticket_outbox(conn: sqlite3.Connection, ticket_id: str, at: str) -> int:
    """Queued / held messages of the ticket never go out (the worker claims only 'queued' / 'held' rows)."""
    return conn.execute("UPDATE ticket_outbox SET state = 'cancelled', updated_at = ? WHERE ticket_id = ? AND state IN ('queued', 'held')",
                        (at, ticket_id)).rowcount


def purge_ticket(conn: sqlite3.Connection, ticket_id: str) -> dict[str, int]:
    """Every row of the ticket and everything hanging off it, explicitly (not relying on ON DELETE CASCADE / SET NULL): the link
    children, the links, the outbox and inbound rows, the cost files / revisions / decisions / claims, photos, device context,
    events, assignments, the idempotency answers that carry its id, other tickets' `duplicate_of` pointing at it, then the ticket.
    Returns the number of rows removed per table. The caller runs it inside one transaction (or a bulk item's savepoint)."""
    out: dict[str, int] = {}

    def run(table: str, sql: str, args: tuple[Any, ...]) -> None:
        out[table] = out.get(table, 0) + conn.execute(sql, args).rowcount

    links = "(SELECT id FROM ticket_links WHERE ticket_id = ?)"
    for child in ("ticket_link_sessions", "ticket_link_codes", "ticket_link_failures", "ticket_link_access", "ticket_link_redeems"):
        run(child, f"DELETE FROM {child} WHERE link_id IN {links}", (ticket_id,))
    run("ticket_links", "DELETE FROM ticket_links WHERE ticket_id = ?", (ticket_id,))
    run("ticket_outbox", "DELETE FROM ticket_outbox WHERE ticket_id = ?", (ticket_id,))
    run("ticket_inbound", "DELETE FROM ticket_inbound WHERE ticket_id = ?", (ticket_id,))
    claims = "(SELECT id FROM ticket_cost_claims WHERE ticket_id = ?)"
    run("ticket_cost_revision_files", "DELETE FROM ticket_cost_revision_files WHERE file_id IN (SELECT id FROM ticket_cost_files WHERE ticket_id = ? "
        f"OR claim_id IN {claims}) OR revision_id IN (SELECT id FROM ticket_cost_revisions WHERE claim_id IN {claims})",
        (ticket_id, ticket_id, ticket_id))
    run("ticket_cost_files", f"DELETE FROM ticket_cost_files WHERE ticket_id = ? OR claim_id IN {claims}", (ticket_id, ticket_id))
    run("ticket_cost_decisions", f"DELETE FROM ticket_cost_decisions WHERE claim_id IN {claims}", (ticket_id,))
    run("ticket_cost_revisions", f"DELETE FROM ticket_cost_revisions WHERE claim_id IN {claims}", (ticket_id,))
    run("ticket_cost_claims", "DELETE FROM ticket_cost_claims WHERE ticket_id = ?", (ticket_id,))
    run("ticket_attachments", "DELETE FROM ticket_attachments WHERE ticket_id = ?", (ticket_id,))
    run("ticket_device_context", "DELETE FROM ticket_device_context WHERE ticket_id = ?", (ticket_id,))
    run("ticket_events", "DELETE FROM ticket_events WHERE ticket_id = ?", (ticket_id,))
    conn.execute("UPDATE tickets SET current_assignment_id = NULL WHERE id = ?", (ticket_id,))
    run("ticket_assignments", "DELETE FROM ticket_assignments WHERE ticket_id = ?", (ticket_id,))
    like = "%" + ticket_id.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
    run("ticket_requests", "DELETE FROM ticket_requests WHERE response_json LIKE ? ESCAPE '\\'", (like,))
    conn.execute("UPDATE tickets SET duplicate_of = NULL WHERE duplicate_of = ?", (ticket_id,))
    run("tickets", "DELETE FROM tickets WHERE id = ?", (ticket_id,))
    return {k: v for k, v in out.items() if v}


def folder_in_use(conn: sqlite3.Connection, ticket_id: str) -> bool:
    """Whether a row still names the folder `<data>/tickets/<ticket_id>/`: the ticket, a photo, or an invoice file (a claim of a
    purged ticket keeps its files there, 11A.11)."""
    return any(conn.execute(sql, (ticket_id,)).fetchone() for sql in (
        "SELECT 1 FROM tickets WHERE id = ?", "SELECT 1 FROM ticket_attachments WHERE ticket_id = ? LIMIT 1",
        "SELECT 1 FROM ticket_cost_files WHERE ticket_id = ? LIMIT 1"))


def ticket_rows_left(conn: sqlite3.Connection, ticket_id: str) -> dict[str, int]:
    """Tests and the orphan sweep: rows still naming the ticket, per table (empty = nothing left)."""
    checks = {
        "tickets": "SELECT COUNT(*) FROM tickets WHERE id = ?",
        "ticket_events": "SELECT COUNT(*) FROM ticket_events WHERE ticket_id = ?",
        "ticket_assignments": "SELECT COUNT(*) FROM ticket_assignments WHERE ticket_id = ?",
        "ticket_attachments": "SELECT COUNT(*) FROM ticket_attachments WHERE ticket_id = ?",
        "ticket_device_context": "SELECT COUNT(*) FROM ticket_device_context WHERE ticket_id = ?",
        "ticket_links": "SELECT COUNT(*) FROM ticket_links WHERE ticket_id = ?",
        "ticket_outbox": "SELECT COUNT(*) FROM ticket_outbox WHERE ticket_id = ?",
        "ticket_inbound": "SELECT COUNT(*) FROM ticket_inbound WHERE ticket_id = ?",
        "ticket_cost_claims": "SELECT COUNT(*) FROM ticket_cost_claims WHERE ticket_id = ?",
        "ticket_cost_files": "SELECT COUNT(*) FROM ticket_cost_files WHERE ticket_id = ?",
    }
    left = {t: int(conn.execute(sql, (ticket_id,)).fetchone()[0]) for t, sql in checks.items()}
    return {t: n for t, n in left.items() if n}
