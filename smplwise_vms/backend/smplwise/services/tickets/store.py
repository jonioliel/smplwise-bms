"""CR-038: ALL SQL of the tickets module (section 5, data-store decision Q11 / D16: the main SQLite file behind one storage layer -
a later move to another file or engine touches this module only).

Visibility rule: a ticket row is read here only by services/tickets/access.py (`ticket_row_unchecked`, `candidate_rows`); every
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
