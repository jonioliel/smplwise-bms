"""VMS-local authorization: built-in roles (contracts/examples/role-catalog.design.json), scoped
bindings (installation ⊇ site ⊇ building ⊇ floor) and default deny. Every action is evaluated as a
(permission, target) pair; capabilities are never unioned across scopes."""
from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from pathlib import Path

from .db import now_iso, permission_revision
from .errors import forbidden

ROLES: dict[str, list[str]] = {
    role["id"]: list(role["permissions"]) for role in json.loads((Path(__file__).parent / "roles.json").read_text(encoding="utf-8"))["roles"]
}
ROLE_NAMES_HE: dict[str, str] = {
    role["id"]: role["name_he"] for role in json.loads((Path(__file__).parent / "roles.json").read_text(encoding="utf-8"))["roles"]
}

SCOPE_ORDER = ("installation", "site", "building", "floor")
INSTALLATION = ("installation", "*")

_CUSTOM_CACHE: dict[int, dict[str, list[str]]] = {}


def custom_roles(conn: sqlite3.Connection) -> dict[str, list[str]]:
    """Custom roles (T082) as {id: permissions}; cached per permission revision, which every role change bumps."""
    rev = permission_revision(conn)
    cached = _CUSTOM_CACHE.get(rev)
    if cached is None:
        try:
            rows = conn.execute("SELECT id, permissions_json, sensitive_json FROM custom_roles WHERE deleted_at IS NULL").fetchall()
        except sqlite3.OperationalError:  # before the migration ran
            rows = []
        cached = {r["id"]: sorted(set(json.loads(r["permissions_json"])) | set(json.loads(r["sensitive_json"] or "[]"))) for r in rows}
        _CUSTOM_CACHE.clear()
        _CUSTOM_CACHE[rev] = cached
    return cached


def role_permissions(conn: sqlite3.Connection, role_id: str) -> list[str]:
    return ROLES.get(role_id) or custom_roles(conn).get(role_id, [])


def all_roles(conn: sqlite3.Connection) -> dict[str, list[str]]:
    return {**ROLES, **custom_roles(conn)}


@dataclass(frozen=True)
class Principal:
    user_id: str
    username: str
    display_name: str
    source: str  # ingress | dev


@dataclass(frozen=True)
class Decision:
    allowed: bool
    reason: str
    binding_id: str | None = None
    role_id: str | None = None
    scope: tuple[str, str] | None = None


def scope_chain(conn: sqlite3.Connection, target_type: str, target_id: str) -> list[tuple[str, str]]:
    """Return the target and all its ancestors, e.g. floor → building → site → installation."""
    chain: list[tuple[str, str]] = []
    if target_type == "floor":
        row = conn.execute("SELECT id, building_id FROM floors WHERE id = ?", (target_id,)).fetchone()
        if not row:
            return [INSTALLATION]
        chain.append(("floor", row["id"]))
        target_type, target_id = "building", row["building_id"]
    if target_type == "building":
        row = conn.execute("SELECT id, site_id FROM buildings WHERE id = ?", (target_id,)).fetchone()
        if not row:
            return chain + [INSTALLATION]
        chain.append(("building", row["id"]))
        target_type, target_id = "site", row["site_id"]
    if target_type == "site":
        chain.append(("site", target_id))
    chain.append(INSTALLATION)
    return chain


def _active_bindings(conn: sqlite3.Connection, principal: Principal) -> list[sqlite3.Row]:
    now = now_iso()
    return conn.execute(
        """SELECT b.* FROM bindings b
           WHERE b.revoked_at IS NULL AND (b.expires_at IS NULL OR b.expires_at > ?)
             AND ((b.subject_kind = 'user' AND b.subject_id = ?)
                  OR (b.subject_kind = 'group' AND b.subject_id IN (SELECT group_id FROM group_members WHERE user_id = ?)))""",
        (now, principal.user_id, principal.user_id),
    ).fetchall()


def authorize(conn: sqlite3.Connection, principal: Principal, permission: str, target: tuple[str, str]) -> Decision:
    user = conn.execute("SELECT active FROM users WHERE id = ?", (principal.user_id,)).fetchone()
    if user is not None and not user["active"]:
        return Decision(False, "user_inactive")
    chain = set(scope_chain(conn, *target))
    matched: Decision | None = None
    for b in _active_bindings(conn, principal):
        if (b["scope_type"], b["scope_id"]) not in chain:
            continue
        if permission not in role_permissions(conn, b["role_id"]):
            continue
        if b["effect"] == "deny":
            return Decision(False, "explicit_deny", b["id"], b["role_id"], (b["scope_type"], b["scope_id"]))
        matched = matched or Decision(True, "binding", b["id"], b["role_id"], (b["scope_type"], b["scope_id"]))
    return matched or Decision(False, "no_binding")


def require(conn: sqlite3.Connection, principal: Principal, permission: str, target: tuple[str, str]) -> Decision:
    decision = authorize(conn, principal, permission, target)
    if not decision.allowed:
        from .audit import audit  # local import: audit depends on db only

        audit(conn, actor=principal, action=permission, decision="denied", resource_type=target[0], resource_id=target[1], reason=decision.reason)
        raise forbidden(permission=permission, target_type=target[0], target_id=target[1], reason=decision.reason)
    return decision


def effective_permissions(conn: sqlite3.Connection, principal: Principal, target: tuple[str, str]) -> list[str]:
    chain = set(scope_chain(conn, *target))
    allowed: set[str] = set()
    denied: set[str] = set()
    for b in _active_bindings(conn, principal):
        if (b["scope_type"], b["scope_id"]) not in chain:
            continue
        perms = role_permissions(conn, b["role_id"])
        (denied if b["effect"] == "deny" else allowed).update(perms)
    return sorted(allowed - denied)


def bindings_of(conn: sqlite3.Connection, principal: Principal) -> list[dict]:
    out = []
    for b in _active_bindings(conn, principal):
        out.append({
            "id": b["id"],
            "subject_kind": b["subject_kind"],
            "role_id": b["role_id"],
            "role_name": ROLE_NAMES_HE.get(b["role_id"], b["role_id"]),
            "scope_type": b["scope_type"],
            "scope_id": b["scope_id"],
            "scope_name": scope_name(conn, b["scope_type"], b["scope_id"]),
            "effect": b["effect"],
            "permission_revision": b["permission_revision"],
        })
    return out


def scope_name(conn: sqlite3.Connection, scope_type: str, scope_id: str) -> str:
    if scope_type == "installation":
        return "כל ההתקנה"
    table = {"site": "sites", "building": "buildings", "floor": "floors"}[scope_type]
    row = conn.execute(f"SELECT name FROM {table} WHERE id = ?", (scope_id,)).fetchone()
    return row["name"] if row else scope_id


def has_any_binding(conn: sqlite3.Connection, principal: Principal) -> bool:
    return bool(_active_bindings(conn, principal))
