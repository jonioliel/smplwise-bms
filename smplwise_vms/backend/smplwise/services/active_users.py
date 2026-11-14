"""CR-RBAC-EVAL-2438 (code review 01:F-05, owner decision Q-SEC-5 / O16 a): the ONE system-wide definition of an "active user".

A person can be recorded on two sides: the add-on's own `users` row (`active`) and the Home Assistant directory copy `ha_users`
(`is_active`). The two are normally kept in step (routers/ha_users._set_active writes both), but a directory sync or a restored
archive can leave them apart. The rule, everywhere:

    disabled on EITHER side = not active.
    active = present on at least one side, and not disabled on any side.

`is_disabled` is the weaker question ("is a disabled flag set anywhere?") for callers that judge a principal who may have no row
at all yet (a first request, a test principal): those keep treating "no row" as "not disabled", as they always did.

Callers: services/tickets/store (user_is_active, active_user_ids), services/tickets/store_rfq.active_user_ids (the second-approver
search of a supplier award), services/tickets/access.Viewer.anywhere, routers/access.active_user_ids (the delegated directory), and since CR-ADMIN-GATE-2438
(lead decision on question 1 of CR-RBAC-EVAL-2438) rbac itself: authorize() / Evaluator, admin_count, permissions_fingerprint, and
services/access.camera_scope.
"""
from __future__ import annotations

import sqlite3


def active_user_ids(conn: sqlite3.Connection) -> set[str]:
    """Every active user id (see the module docstring). Four short statements, independent of the number of users' bindings."""
    ids = {r[0] for r in conn.execute("SELECT id FROM users WHERE active = 1").fetchall()}
    ids |= {r[0] for r in conn.execute("SELECT id FROM ha_users WHERE is_active = 1").fetchall()}
    ids -= {r[0] for r in conn.execute("SELECT id FROM users WHERE active = 0").fetchall()}
    ids -= {r[0] for r in conn.execute("SELECT id FROM ha_users WHERE is_active = 0").fetchall()}
    return ids


def is_disabled(conn: sqlite3.Connection, user_id: str) -> bool:
    """True when the user is disabled on either side. A user with no row on a side is not disabled there (a local Arx-only identity
    has no `ha_users` row; a principal on its first request may have no row at all). One statement: rbac.authorize asks it on every
    decision (CR-ADMIN-GATE-2438)."""
    row = conn.execute("SELECT (SELECT active FROM users WHERE id = ?), (SELECT is_active FROM ha_users WHERE id = ?)", (user_id, user_id)).fetchone()
    return (row[0] is not None and not row[0]) or (row[1] is not None and not row[1])


def user_is_active(conn: sqlite3.Connection, user_id: str) -> bool:
    """The single-user form of `active_user_ids`: present on at least one side and disabled on none."""
    if is_disabled(conn, user_id):
        return False
    if conn.execute("SELECT 1 FROM users WHERE id = ?", (user_id,)).fetchone() is not None:
        return True
    return conn.execute("SELECT 1 FROM ha_users WHERE id = ?", (user_id,)).fetchone() is not None
