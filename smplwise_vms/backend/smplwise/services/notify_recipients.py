"""CR-RECIPIENTS-2436 (review 04:F03): the ONE expansion and validation of a saved `{roles, users, groups}` recipients choice.

Who is told about a leak, a hot fridge, a stuck elevator or a generator fault is decided here. The alert modules (temperature, water, elevator,
generator) used to carry their own copies; they now call these two functions and keep only their own texts and limits.

    expand(conn, rec, routable_roles)        -> user ids, in this order, each once (dict.fromkeys):
        1. the named users                     (`users`)
        2. the members of the named groups     (`groups`)
        3. the holders of a routable role through a user binding
        4. the holders of a routable role through a group binding (the group's members)   [role_via_groups]
       A binding counts while it is not revoked, its effect is `allow` and it has not expired [role_expiry]. Only active users are returned
       [active_only]. The caller intersects the result with who may see the subject (services/notify.recipients_for).

    validate(conn, rec, field, routable_roles, error=..., role_message=..., users_max=..., groups_max=...)
        -> the canonical form {"roles": in routable order, "users": sorted unique, "groups": sorted unique}, or `error(code, he, en, details)`.

The bracketed switches exist for the generator alone: its rule today resolves roles through user bindings only and does not look at
`expires_at` (services/generator_alerts.ROLE_EXPANSION). Owner decision O1 decides whether it joins the defaults; that is a one-line change there.
"""
from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from typing import Any, Callable, Iterable

from ..db import now_iso

_FIELDS = frozenset({"roles", "users", "groups"})


def active_user_ids(conn: sqlite3.Connection) -> set[str]:
    return {r[0] for r in conn.execute("SELECT id FROM users WHERE active = 1").fetchall()}


def group_ids(conn: sqlite3.Connection) -> set[str]:
    return {r[0] for r in conn.execute("SELECT id FROM groups").fetchall()}


def expand(conn: sqlite3.Connection, rec: dict[str, Any], routable_roles: Iterable[str], *, role_via_groups: bool = True, role_expiry: bool = True,
           active_only: bool = True) -> list[str]:
    """The user ids a recipients choice reaches (see the module docstring for the order and the rules)."""
    out: list[str] = list(rec.get("users") or [])
    grps = rec.get("groups") or []
    if grps:
        marks = ",".join("?" * len(grps))
        out += [r[0] for r in conn.execute(f"SELECT user_id FROM group_members WHERE group_id IN ({marks})", grps).fetchall()]
    allowed = tuple(routable_roles)
    roles = [r for r in (rec.get("roles") or []) if r in allowed]
    if roles:
        marks = ",".join("?" * len(roles))
        expiry, args = ("AND (b.expires_at IS NULL OR b.expires_at > ?)", (*roles, now_iso())) if role_expiry else ("", tuple(roles))
        out += [r[0] for r in conn.execute(
            f"""SELECT DISTINCT b.subject_id FROM bindings b WHERE b.subject_kind = 'user' AND b.role_id IN ({marks})
                AND b.revoked_at IS NULL AND b.effect = 'allow' {expiry}""", args).fetchall()]
        if role_via_groups:
            out += [r[0] for r in conn.execute(
                f"""SELECT DISTINCT m.user_id FROM bindings b JOIN group_members m ON m.group_id = b.subject_id WHERE b.subject_kind = 'group' AND b.role_id IN ({marks})
                    AND b.revoked_at IS NULL AND b.effect = 'allow' {expiry}""", args).fetchall()]
    if not active_only:
        return list(dict.fromkeys(out))
    active = active_user_ids(conn)
    return [u for u in dict.fromkeys(out) if u in active]


@dataclass(frozen=True)
class Known:
    """The active users and the groups, read once by a caller that validates several choices in one save (the elevator states)."""
    active_users: set[str]
    group_ids: set[str]

    @classmethod
    def read(cls, conn: sqlite3.Connection) -> "Known":
        return cls(active_user_ids(conn), group_ids(conn))


def validate(conn: sqlite3.Connection, rec: Any, field: str, routable_roles: Iterable[str], *, error: Callable[..., Exception], role_message: tuple[str, str],
             users_max: int, groups_max: int, known: Known | None = None) -> dict[str, list[str]]:
    """A `{roles, users, groups}` body in canonical form, or `error(code, message_he, message_en, {"fields": [...]})`.

    Checks in this order: shape, role ids, named users (active), groups (existing). `role_message` is the module's own (he, en) text for a role
    that may not receive its alerts. Without `known` the users / groups are read when their check is reached."""
    allowed = tuple(routable_roles)
    if not isinstance(rec, dict) or set(rec) - _FIELDS:
        raise error("validation", "נמענים לא תקינים.", "Invalid recipients.", {"fields": [field]})
    roles, users, grps = rec.get("roles") or [], rec.get("users") or [], rec.get("groups") or []
    if not all(isinstance(x, list) for x in (roles, users, grps)) or len(users) > users_max or len(grps) > groups_max or len(roles) > len(allowed):
        raise error("validation", "נמענים לא תקינים.", "Invalid recipients.", {"fields": [field]})
    if any(r not in allowed for r in roles):
        raise error("recipient_role", role_message[0], role_message[1], {"fields": [f"{field}.roles"]})
    active = known.active_users if known is not None else active_user_ids(conn)
    if any(u not in active for u in users):
        raise error("recipient_user", "משתמש לא מוכר.", "Unknown user.", {"fields": [f"{field}.users"]})
    groups = known.group_ids if known is not None else group_ids(conn)
    if any(g not in groups for g in grps):
        raise error("recipient_group", "קבוצה לא מוכרת.", "Unknown group.", {"fields": [f"{field}.groups"]})
    return {"roles": [r for r in allowed if r in roles], "users": sorted(set(users)), "groups": sorted(set(grps))}
