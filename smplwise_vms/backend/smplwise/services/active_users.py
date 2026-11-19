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
services/access.camera_scope; since CR-ACTIVE-USER-REST-2438 also routers/me (`active`), services/door_authority,
door_windows (the window / emergency person rule), door_automation (the armer), emergency/access, access_grants (the recovery actor and
the approver re-check) and bridge_key_notice (owner contacts); since CR-W2-FOLLOWUPS-2441 the notification recipients
(`active_account_ids` / `ACTIVE_ACCOUNT_SQL`: services/notify_recipients, notify._active_users, notify_visibility.active_principals).
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


# The list form of `has_active_account`, as a WHERE condition over `users` rows (the statement reads FROM users with no
# alias): an Arx account that is active under the one rule. For the lists that must hold Arx accounts only - a notification goes to
# a `users` row (its inbox, its principal); a person known only to the Home Assistant directory has none.
ACTIVE_ACCOUNT_SQL = "users.active = 1 AND NOT EXISTS (SELECT 1 FROM ha_users h WHERE h.id = users.id AND h.is_active = 0)"


def active_account_ids(conn: sqlite3.Connection) -> list[str]:
    """Every user id for which `has_active_account` is true, in id order, from one statement (CR-W2-FOLLOWUPS-2441)."""
    return [r[0] for r in conn.execute(f"SELECT id FROM users WHERE {ACTIVE_ACCOUNT_SQL} ORDER BY id").fetchall()]


def is_disabled(conn: sqlite3.Connection, user_id: str) -> bool:
    """True when the user is disabled on either side. A user with no row on a side is not disabled there (a local Arx-only identity
    has no `ha_users` row; a principal on its first request may have no row at all). One statement: rbac.authorize asks it on every
    decision (CR-ADMIN-GATE-2438)."""
    row = conn.execute("SELECT (SELECT active FROM users WHERE id = ?), (SELECT is_active FROM ha_users WHERE id = ?)", (user_id, user_id)).fetchone()
    return (row[0] is not None and not row[0]) or (row[1] is not None and not row[1])


def has_active_account(conn: sqlite3.Connection, user_id: str) -> bool:
    """An Arx account (a `users` row) that is active under the one rule: `users.active = 1` and not disabled on the Home Assistant side.
    For callers that refuse an unknown id (an approver, an armer, an owner contact, a recovery actor): stricter than `user_is_active`,
    which also accepts a person known only to the Home Assistant directory. CR-ACTIVE-USER-REST-2438."""
    row = conn.execute("SELECT (SELECT active FROM users WHERE id = ?), (SELECT is_active FROM ha_users WHERE id = ?)", (user_id, user_id)).fetchone()
    return bool(row[0]) and (row[1] is None or bool(row[1]))


def user_is_active(conn: sqlite3.Connection, user_id: str) -> bool:
    """The single-user form of `active_user_ids`: present on at least one side and disabled on none."""
    if is_disabled(conn, user_id):
        return False
    if conn.execute("SELECT 1 FROM users WHERE id = ?", (user_id,)).fetchone() is not None:
        return True
    return conn.execute("SELECT 1 FROM ha_users WHERE id = ?", (user_id,)).fetchone() is not None
