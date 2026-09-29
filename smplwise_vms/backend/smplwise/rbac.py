"""VMS-local authorization: built-in roles (contracts/examples/role-catalog.design.json), scoped
bindings (installation ⊇ site ⊇ building ⊇ floor ⊇ camera) and default deny. Every action is evaluated as a
(permission, target) pair; capabilities are never unioned across scopes. An explicit deny anywhere on the
target's chain beats every allow on it (docs/security/HA_IDENTITY_RBAC_HE.md §15)."""
from __future__ import annotations

import json
import sqlite3
from contextvars import ContextVar
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

SCOPE_ORDER = ("installation", "site", "building", "floor", "camera")
INSTALLATION = ("installation", "*")

_CUSTOM_CACHE: dict[tuple[str, int], dict[str, list[str]]] = {}


def custom_roles(conn: sqlite3.Connection) -> dict[str, list[str]]:
    """Custom roles (T082) as {id: permissions}; cached per (database, permission revision) - every role change bumps
    the revision, and the database file keeps two databases in one process (tests) from sharing a cache entry."""
    try:
        dbfile = str(conn.execute("PRAGMA database_list").fetchone()[2])
    except sqlite3.Error:
        dbfile = ""
    rev = (dbfile, permission_revision(conn))
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


def camera_floors(conn: sqlite3.Connection, camera_id: str) -> list[str]:
    """The live floors a camera is currently anchored on (a camera may sit on more than one map)."""
    return [
        r[0]
        for r in conn.execute(
            """SELECT DISTINCT a.floor_id FROM map_anchors a JOIN floors f ON f.id = a.floor_id
               WHERE a.resource_type = 'camera' AND a.resource_id = ? AND a.effective_to IS NULL AND f.deleted_at IS NULL ORDER BY a.floor_id""",
            (camera_id,),
        ).fetchall()
    ]


def scope_chain(conn: sqlite3.Connection, target_type: str, target_id: str) -> list[tuple[str, str]]:
    """Return the target and all its ancestors, e.g. floor → building → site → installation.

    A camera (T055) is its own node; its ancestors are EVERY floor it is anchored on (with their buildings and
    sites) and the installation - an unanchored camera hangs off the installation alone. Deny-overrides in
    authorize() then applies across the whole chain (docs/security/HA_IDENTITY_RBAC_HE.md §15)."""
    if target_type == "camera":
        chain = [("camera", target_id)]
        for fid in camera_floors(conn, target_id):
            for node in scope_chain(conn, "floor", fid):
                if node not in chain:
                    chain.append(node)
        if INSTALLATION not in chain:
            chain.append(INSTALLATION)
        return chain
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

        audit(conn, actor=principal, action=permission, decision="denied", resource_type=target[0], resource_id=target[1], reason=decision.reason, under=decision)
        raise forbidden(permission=permission, target_type=target[0], target_id=target[1], reason=decision.reason)
    _LAST_GRANT.set(decision)
    return decision


# T055 audit: the allowing decision of the latest require() in THIS request (a context variable - every request runs in
# its own copied context, so nothing leaks between requests). audit() records its binding, role and scope on an
# "allowed" row that names no decision itself - the config and command rows of the routers that enforce with require().
_LAST_GRANT: ContextVar[Decision | None] = ContextVar("sw_last_grant", default=None)


def last_grant() -> Decision | None:
    return _LAST_GRANT.get()


def note_grant(decision: Decision | None) -> None:
    """For a route that decides through authorize() rather than require() (a placement rule, several permissions):
    the allowing decision its audit rows should record."""
    if decision is not None and decision.allowed:
        _LAST_GRANT.set(decision)


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


def permissions_anywhere(conn: sqlite3.Connection, principal: Principal) -> list[str]:
    """Permissions the user holds at any scope: the union of the allow bindings' roles, minus what an installation-wide
    deny takes away everywhere. For the shell's navigation (0.1.81, owner decision 2026-09-22): a floor-scoped viewer
    has no installation-level permission at all, yet must still see the map and the live area."""
    allowed: set[str] = set()
    denied_everywhere: set[str] = set()
    for b in _active_bindings(conn, principal):
        perms = role_permissions(conn, b["role_id"])
        if b["effect"] == "deny":
            if (b["scope_type"], b["scope_id"]) == INSTALLATION:
                denied_everywhere.update(perms)
        else:
            allowed.update(perms)
    return sorted(allowed - denied_everywhere)


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
    if scope_type == "camera":
        row = conn.execute("SELECT alias, name_source, channel FROM cameras WHERE id = ?", (scope_id,)).fetchone()
        return f"מצלמה · {row['alias'] or row['name_source'] or 'ערוץ ' + str(row['channel'])}" if row else scope_id
    table = {"site": "sites", "building": "buildings", "floor": "floors"}[scope_type]
    row = conn.execute(f"SELECT name FROM {table} WHERE id = ?", (scope_id,)).fetchone()
    return row["name"] if row else scope_id


def permissions_fingerprint(conn: sqlite3.Connection, principal: Principal) -> str:
    """A short hash of everything this user's access depends on - the active flag and each active binding (direct or
    through a group) with its role's current permissions, scope, effect and expiry. It moves exactly when the user's
    effective access may have changed, unlike the installation-wide permission_revision (T055: the shell re-fetches
    /me and the navigation when /me/ws or /me?known= says it moved)."""
    import hashlib

    user = conn.execute("SELECT active FROM users WHERE id = ?", (principal.user_id,)).fetchone()
    parts = [f"active={1 if user is None or user['active'] else 0}"]
    for b in sorted(_active_bindings(conn, principal), key=lambda r: r["id"]):
        parts.append("|".join((b["id"], b["role_id"], ",".join(sorted(role_permissions(conn, b["role_id"]))), b["scope_type"], b["scope_id"], b["effect"], b["expires_at"] or "")))
    return hashlib.sha256("\n".join(parts).encode("utf-8")).hexdigest()[:16]


def has_any_binding(conn: sqlite3.Connection, principal: Principal) -> bool:
    return bool(_active_bindings(conn, principal))
