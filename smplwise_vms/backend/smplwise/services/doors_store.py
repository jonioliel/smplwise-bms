"""The SQL of the doors router (routers/doors.py: the door map, the "פתיחת דלתות" card, the trusted path; CR-ROUTER-SQL-B-2450, review
05:P2-07): every statement the router ran inline, moved here unchanged (same text, same arguments, same order of calls). The active-binding
query text stays services/rbac_admin._active_bindings_sql. The router keeps the permission checks, the delegation rules, the bridge calls
and the audit; each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3

from .rbac_admin import _active_bindings_sql

Rows = list[sqlite3.Row]


# ---------------------------------------------------------------- places (the door map's pickers)

def live_sites(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT id, name FROM sites WHERE deleted_at IS NULL ORDER BY sort_order, name").fetchall()


def live_buildings(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT id, site_id, name FROM buildings WHERE deleted_at IS NULL ORDER BY sort_order, name").fetchall()


# ---------------------------------------------------------------- the door-grants card

def card_binding_ids(conn: sqlite3.Connection) -> set[str]:
    """The bindings this card created. Raises sqlite3.OperationalError on a database without door_grant_bindings (the router answers none)."""
    return {r[0] for r in conn.execute("SELECT binding_id FROM door_grant_bindings").fetchall()}


def add_card_binding(conn: sqlite3.Connection, binding_id: str, created_at: str) -> None:
    conn.execute("INSERT INTO door_grant_bindings(binding_id, created_at) VALUES (?, ?)", (binding_id, created_at))


def active_allow_bindings(conn: sqlite3.Connection, now: str) -> Rows:
    return conn.execute(_active_bindings_sql("AND effect = 'allow'"), (now,)).fetchall()


def active_subject_role_bindings(conn: sqlite3.Connection, now: str, subject_kind: str, subject_id: str, role_id: str) -> Rows:
    return conn.execute(_active_bindings_sql("AND subject_kind = ? AND subject_id = ? AND role_id = ?"), (now, subject_kind, subject_id, role_id)).fetchall()


def groups(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT id, name FROM groups ORDER BY name").fetchall()


def live_custom_roles(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT id, name_he, sensitive_json, delegable, revision FROM custom_roles WHERE deleted_at IS NULL ORDER BY created_at").fetchall()


def live_custom_role(conn: sqlite3.Connection, role_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM custom_roles WHERE id = ? AND deleted_at IS NULL", (role_id,)).fetchone()


def custom_role_revision(conn: sqlite3.Connection, role_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT revision FROM custom_roles WHERE id = ?", (role_id,)).fetchone()


def set_role_sensitive(conn: sqlite3.Connection, role_id: str, sensitive_json: str, updated_by: str, updated_by_username: str, updated_at: str) -> None:
    """A custom role's sensitive list changed: the role's revision moves."""
    conn.execute("UPDATE custom_roles SET sensitive_json = ?, revision = revision + 1, updated_by = ?, updated_by_username = ?, updated_at = ? WHERE id = ?",
                 (sensitive_json, updated_by, updated_by_username, updated_at, role_id))


# ---------------------------------------------------------------- the status read of one open

def release_attempt(conn: sqlite3.Connection, request_id: str) -> sqlite3.Row | None:
    """The first audited `intercom.release` attempt row of the door request `request_id` (a validated UUID)."""
    return conn.execute(
        "SELECT actor_user_id, details_json FROM audit_log WHERE action = 'intercom.release' AND details_json LIKE ? AND details_json LIKE ? ORDER BY rowid LIMIT 1",
        (f'%"door_request_id": "{request_id}"%', '%"phase": "attempt"%'),
    ).fetchone()
