"""VMS-local authorization: built-in roles (contracts/examples/role-catalog.design.json), scoped
bindings (installation ⊇ site ⊇ building ⊇ floor ⊇ camera) and default deny. Every action is evaluated as a
(permission, target) pair; capabilities are never unioned across scopes. An explicit deny anywhere on the
target's chain beats every allow on it (docs/security/HA_IDENTITY_RBAC_HE.md §15)."""
from __future__ import annotations

import json
import sqlite3
from contextvars import ContextVar
from dataclasses import dataclass, field
from pathlib import Path

from .db import database_of, now_iso, permission_revision
from .errors import forbidden

ROLES: dict[str, list[str]] = {
    role["id"]: list(role["permissions"]) for role in json.loads((Path(__file__).parent / "roles.json").read_text(encoding="utf-8"))["roles"]
}
ROLE_NAMES_HE: dict[str, str] = {
    role["id"]: role["name_he"] for role in json.loads((Path(__file__).parent / "roles.json").read_text(encoding="utf-8"))["roles"]
}

SCOPE_ORDER = ("installation", "site", "building", "floor", "camera", "access_control_station")
INSTALLATION = ("installation", "*")
STATION = "access_control_station"  # CR-033 D2: one WisKey station, scope_id = its opaque config entry id
# SEC-WXD L4: the only permissions a station-scope ALLOW binding may carry (door_opener and matching custom roles).
# WXD-INT (2.4.8 line): CR-036 S3 judges its station-level access permissions on this same chain
# (services/intercom_authority.py `Authority.station`), so a station role may carry them too; nothing outside `access.*`.
STATION_PERMISSIONS = frozenset({
    "access.read", "access.doors.open", "access.release",  # CR-033: the door rule (WXPERM: access.doors.open; access.release = its legacy name)
    "access.stations.read", "access.events.read", "access.events.export",  # CR-036 S3: per-station reads
    "access.people.read", "access.people.sensitive", "access.people.manage", "access.admin.read",
    "access.cards.capture",  # CR-036 S11 moves the person editor and card capture onto the station chain
    # 2.4.9 (owner decision 2026-10-13): the other station-chain permissions - PIN generation (S11), WhatsApp to the people of
    # the station (WA) and calls / announcements / talk (S18 + the 2.4.9 call re-gating) - may be carried by a station role
    "access.pin.generate", "access.people.message", "access.call",
    # CR-ARX-WISKEY-SHARED-IDENTITY D5 (owner answer 2): approving an external person's temporary door grant, per station
    "access.external.grant",
    # EXTERNALBUILD-297 (CR-VISITOR105 5.1): inviting a visitor to a station (the host's own approval inside the envelope)
    "access.visitor.invite",
    # CR-AUTODOORS-295: arming an automation's "open a door" block, per station
    "access.doors.automate",
    # STATIONPERM-295 (CR-STATION-PERMISSIONS-295): allowing / blocking a person's access per station, judged on that station
    "access.people.stations",
    # CR-039 7.1 (DOORWIN-295): door windows and emergency controls are judged on the station chain too
    "access.windows.manage", "access.windows.cancel", "access.emergency.lock", "access.emergency.open",
})

# WXPERM (owner decision 2026-10-13): legacy permission names and the permission each one now stands for. A role that lists
# the legacy name holds the new permission too (one direction only: the new name never implies the legacy one). Built-in roles
# (roles.json) list the new names only; the expansion keeps custom roles saved before the rename working with no migration -
# for allows AND for denies (a deny binding of such a role takes the new permission away as well), so nobody silently gains
# or loses access. `access.release` was the door permission (since 2.4.9 the door alone: calls and announcements moved onto
# access.call); the door rule (services/door_authority.py) now judges `access.doors.open`.
LEGACY_PERMISSIONS: dict[str, str] = {"access.release": "access.doors.open"}


def expand_legacy(perms: list[str] | set[str] | tuple[str, ...]) -> list[str]:
    """`perms` plus the permission each legacy name in it stands for (sorted, no duplicates)."""
    out = set(perms)
    out.update(LEGACY_PERMISSIONS[p] for p in perms if p in LEGACY_PERMISSIONS)
    return sorted(out)


def legacy_name_of(conn: sqlite3.Connection, role_id: str | None, permission: str) -> str | None:
    """The legacy name through which `role_id` holds `permission` when it holds it ONLY that way (a custom role saved with
    `access.release` and without `access.doors.open`); None otherwise. For the audit rows: an administrator can see which
    grants still ride the old name."""
    if not role_id or role_id in ROLES:
        return None
    try:
        row = conn.execute("SELECT permissions_json, sensitive_json FROM custom_roles WHERE id = ?", (role_id,)).fetchone()
    except sqlite3.OperationalError:
        return None
    if row is None:
        return None
    raw = set(json.loads(row["permissions_json"])) | set(json.loads(row["sensitive_json"] or "[]"))
    if permission in raw:
        return None
    return next((old for old, new in LEGACY_PERMISSIONS.items() if new == permission and old in raw), None)


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
        # WXPERM: legacy names expanded (LEGACY_PERMISSIONS), so every check through role_permissions sees the new permission
        cached = {r["id"]: expand_legacy(set(json.loads(r["permissions_json"])) | set(json.loads(r["sensitive_json"] or "[]"))) for r in rows}
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
    source: str  # ingress | dev | remote | local (USR2: an Arx-only identity, remote channel only)
    # CR-008 P2: on the remote channel, how the caller proved who they are - "cookie" (an Arx session) or "bearer" (an HA
    # access token on every request, a native client); "" elsewhere. Not part of equality: the same user either way.
    via: str = field(default="", compare=False)
    # USR2 (owner answer Q3): a local principal's session showed the TOTP second factor at sign-in. Without it the
    # administrative permissions (LOCAL_ADMIN_PERMISSIONS) are refused. Meaningless for every other source.
    factor_ok: bool = field(default=False, compare=False)


# USR2 (owner answer Q3, docs/changes/CR-USR2-ARX-ONLY-IDENTITY.md): the administrative permissions. A local (Arx-only) principal
# can use one of them only in a session whose sign-in presented a TOTP code; until then authorize() refuses it with the reason
# `second_factor_required` (fail closed). The system permissions themselves never reach a local identity (only system_admin
# holds them and system_admin is never bound to one); they are listed so the rule stays true if a role ever changes.
LOCAL_ADMIN_PERMISSIONS = frozenset({
    "rbac.assign", "identity.directory.read", "system.configure", "identity.local.manage",
    "rbac.roles.manage", "sources.configure", "audit.read", "backup.manage", "nvr.configure", "system.update",
    "bridge.key.rotate",  # HMACACT2-295: starting / resuming a bridge key rotation (system_admin only)
    "partner.manage",  # PARTNERAPI113-295: the partner interface (system_admin only)
    "users.ha_manage",  # integ/264: USR1's system permission (system_admin only), listed for the same reason
})
LOCAL_ID_PREFIX = "l_"


def local_factor_gate(principal: Principal, permission: str) -> bool:
    """True when this permission is withheld from this principal by the USR2 second-factor rule."""
    return principal.source == "local" and permission in LOCAL_ADMIN_PERMISSIONS and not principal.factor_ok


@dataclass(frozen=True)
class Decision:
    allowed: bool
    reason: str
    binding_id: str | None = None
    role_id: str | None = None
    scope: tuple[str, str] | None = None


def camera_floors(conn: sqlite3.Connection, camera_id: str) -> list[str]:
    """The live floors a camera is currently anchored on (a camera may sit on more than one map), and the other floors
    of a shared room it is anchored in (CR-009: the room is on both floors - services/shared_spaces is the one helper)."""
    from .services.shared_spaces import camera_shared_floors

    own = [
        r[0]
        for r in conn.execute(
            """SELECT DISTINCT a.floor_id FROM map_anchors a JOIN floors f ON f.id = a.floor_id
               WHERE a.resource_type = 'camera' AND a.resource_id = ? AND a.effective_to IS NULL AND f.deleted_at IS NULL ORDER BY a.floor_id""",
            (camera_id,),
        ).fetchall()
    ]
    return own + [f for f in camera_shared_floors(conn, camera_id) if f not in own]


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
    if target_type == STATION:
        return station_chain(conn, target_id)
    chain: list[tuple[str, str]] = []
    if target_type == "floor":
        row = conn.execute("SELECT id, building_id FROM floors WHERE id = ?", (target_id,)).fetchone()
        if not row:
            return [INSTALLATION]
        chain.append(("floor", row["id"]))
        target_type, target_id = "building", row["building_id"]
    if target_type == "building":
        row = conn.execute("SELECT id, site_id, deleted_at FROM buildings WHERE id = ?", (target_id,)).fetchone()
        if not row:
            return chain + [INSTALLATION]
        chain.append(("building", row["id"]))
        if row["deleted_at"] is not None:
            # CR-RBAC-EVAL-2438 (code review 02:P3-4, owner decision O20 a): a deleted building no longer sits under its site -
            # the same rule as station_chain. The building node stays in the chain so a DENY bound on it still bites; an ALLOW
            # bound on it grants nothing (_active_bindings drops allows on dead places).
            chain.append(INSTALLATION)
            return chain
        target_type, target_id = "site", row["site_id"]
    if target_type == "site":
        chain.append(("site", target_id))
    chain.append(INSTALLATION)
    return chain


def station_placement(conn: sqlite3.Connection, station_id: str) -> sqlite3.Row | None:
    """The station's placement row (migration 0077), or None - unplaced, or a database before the migration."""
    try:
        return conn.execute("SELECT site_id, building_id FROM intercom_station_placement WHERE config_entry_id = ?", (station_id,)).fetchone()
    except sqlite3.OperationalError:
        return None


def station_chain(conn: sqlite3.Connection, station_id: str) -> list[tuple[str, str]]:
    """CR-033 D2: a WisKey station and its ancestors. The installation contains every station; a site or a building
    contains it only when the station is placed under it (Settings, intercom_station_placement); an unplaced station
    hangs off the installation alone. A station is a leaf: no floor, camera or entity chain ever contains it, so a
    station binding grants nothing above or beside itself."""
    chain: list[tuple[str, str]] = [(STATION, station_id)]
    row = station_placement(conn, station_id)
    if row is not None and row["building_id"]:
        b = conn.execute("SELECT id, site_id FROM buildings WHERE id = ? AND deleted_at IS NULL", (row["building_id"],)).fetchone()
        if b is not None:
            chain += [("building", b["id"]), ("site", b["site_id"])]
    elif row is not None and row["site_id"]:
        s = conn.execute("SELECT id FROM sites WHERE id = ? AND deleted_at IS NULL", (row["site_id"],)).fetchone()
        if s is not None:
            chain.append(("site", s["id"]))
    chain.append(INSTALLATION)
    return chain


_PLACE_SCOPES = ("site", "building", "floor")


def dead_places(conn: sqlite3.Connection, nodes: set[tuple[str, str]] | list[tuple[str, str]]) -> set[tuple[str, str]]:
    """CR-RBAC-EVAL-2438 (code review 02:P3-4, owner decision Q-SEC-4 / O20 a): of the given (scope_type, scope_id) nodes, the
    places that no longer exist - a site, building or floor that is soft-deleted, whose row is gone (an orphaned scope row: a
    binding that outlived its place), or that hangs under a deleted or missing building / site. Installation, camera and station
    nodes are never reported here (a camera hangs on floors, which are judged here; a station has station_chain).
    At most three statements, only for the place types present."""
    out: set[tuple[str, str]] = set()
    for kind in _PLACE_SCOPES:
        ids = sorted({sid for st, sid in nodes if st == kind})
        if not ids:
            continue
        marks = ",".join("?" * len(ids))
        if kind == "site":
            sql = f"SELECT s.id FROM sites s WHERE s.id IN ({marks}) AND s.deleted_at IS NULL"
        elif kind == "building":
            sql = (f"SELECT b.id FROM buildings b JOIN sites s ON s.id = b.site_id "
                   f"WHERE b.id IN ({marks}) AND b.deleted_at IS NULL AND s.deleted_at IS NULL")
        else:
            sql = (f"SELECT f.id FROM floors f JOIN buildings b ON b.id = f.building_id JOIN sites s ON s.id = b.site_id "
                   f"WHERE f.id IN ({marks}) AND f.deleted_at IS NULL AND b.deleted_at IS NULL AND s.deleted_at IS NULL")
        live = {r[0] for r in conn.execute(sql, ids).fetchall()}
        out.update((kind, i) for i in ids if i not in live)
    return out


def _drop_dead_allows(conn: sqlite3.Connection, rows: list[sqlite3.Row]) -> list[sqlite3.Row]:
    """An ALLOW bound on a dead place (dead_places) grants nothing - not there, not on its floors, areas or cameras, and not in
    permissions_anywhere. A DENY bound there is kept: it can only take access away (fail closed)."""
    nodes = {(b["scope_type"], b["scope_id"]) for b in rows if b["effect"] != "deny" and b["scope_type"] in _PLACE_SCOPES}
    if not nodes:
        return rows
    dead = dead_places(conn, nodes)
    if not dead:
        return rows
    return [b for b in rows if b["effect"] == "deny" or (b["scope_type"], b["scope_id"]) not in dead]


def _active_bindings(conn: sqlite3.Connection, principal: Principal) -> list[sqlite3.Row]:
    """The principal's bindings in force (direct and through a group). An allow bound on a deleted / orphaned place is left out
    (`_drop_dead_allows`): every reader of this list - authorize, effective_permissions, permissions_anywhere, the camera scope,
    bindings_of (/me and the role checks built on it), has_any_binding - then agrees that it grants nothing."""
    now = now_iso()
    rows = conn.execute(
        """SELECT b.* FROM bindings b
           WHERE b.revoked_at IS NULL AND (b.expires_at IS NULL OR b.expires_at > ?)
             AND ((b.subject_kind = 'user' AND b.subject_id = ?)
                  OR (b.subject_kind = 'group' AND b.subject_id IN (SELECT group_id FROM group_members WHERE user_id = ?)))""",
        (now, principal.user_id, principal.user_id),
    ).fetchall()
    if str(principal.user_id or "").startswith(LOCAL_ID_PREFIX):
        # USR2 defence in depth: a local identity never holds system_admin, and never anything through a group (the routes refuse
        # both; a row written behind their back - a restored archive, a hand edit - still grants nothing)
        rows = [b for b in rows if b["role_id"] != "system_admin" and b["subject_kind"] == "user"]
    return _drop_dead_allows(conn, rows)


def _demo_refuses(conn: sqlite3.Connection, permission: str) -> bool:
    """CR-READY96: while the shared database handle is in demo mode, a physical-action / device-write / update / backup permission is never granted
    (services/demo_mode.BLOCKED_EXACT) - the first gate, ahead of any binding."""
    db = database_of(conn)
    if db is None or not getattr(db, "demo", False):
        return False
    from .services.demo_mode import blocked_permission

    return blocked_permission(permission)


class Evaluator:
    """CR-ADMIN-GATE-2438 (code review 02:P1-5): authorize() for MANY targets of one principal. The principal's active flag and
    bindings are read once and each role's permissions once; the scope chain is still resolved per target. The decision rule is
    authorize()'s own - authorize() is a one-shot Evaluator - so the two can never drift apart.

    Lifetime: one loop inside one request. It must not outlive a write to bindings, group memberships, roles or the user's active
    flag (build a new one after such a write, as keep_an_admin counts again after its block)."""

    def __init__(self, conn: sqlite3.Connection, principal: Principal):
        self.conn = conn
        self.principal = principal
        self._inactive: bool | None = None
        self._bindings: list[sqlite3.Row] | None = None
        self._perms: dict[str, frozenset[str]] = {}

    def _role(self, role_id: str) -> frozenset[str]:
        perms = self._perms.get(role_id)
        if perms is None:
            perms = self._perms[role_id] = frozenset(role_permissions(self.conn, role_id))
        return perms

    def _user_inactive(self) -> bool:
        """The system-wide rule (services/active_users, owner decision O16 a): disabled on EITHER side - `users.active = 0` or
        `ha_users.is_active = 0` - refuses (`user_inactive`). No row on a side is not disabled there, so a local (Arx-only) identity,
        which has no `ha_users` row, and a principal on its first request are judged by their bindings as before."""
        if self._inactive is None:
            from .services.active_users import is_disabled

            self._inactive = is_disabled(self.conn, self.principal.user_id)
        return self._inactive

    def authorize(self, permission: str, target: tuple[str, str]) -> Decision:
        if local_factor_gate(self.principal, permission):
            return Decision(False, "second_factor_required")
        if _demo_refuses(self.conn, permission):
            return Decision(False, "demo_mode")
        if self._user_inactive():
            return Decision(False, "user_inactive")
        chain = set(scope_chain(self.conn, *target))
        if self._bindings is None:
            self._bindings = _active_bindings(self.conn, self.principal)
        matched: Decision | None = None
        for b in self._bindings:
            if (b["scope_type"], b["scope_id"]) not in chain:
                continue
            if permission not in self._role(b["role_id"]):
                continue
            if b["effect"] == "deny":
                return Decision(False, "explicit_deny", b["id"], b["role_id"], (b["scope_type"], b["scope_id"]))
            matched = matched or Decision(True, "binding", b["id"], b["role_id"], (b["scope_type"], b["scope_id"]))
        return matched or Decision(False, "no_binding")


def authorize(conn: sqlite3.Connection, principal: Principal, permission: str, target: tuple[str, str]) -> Decision:
    return Evaluator(conn, principal).authorize(permission, target)


def require(conn: sqlite3.Connection, principal: Principal, permission: str, target: tuple[str, str]) -> Decision:
    decision = authorize(conn, principal, permission, target)
    if not decision.allowed:
        from .audit import audit  # local import: audit depends on db only

        audit(conn, actor=principal, action=permission, decision="denied", resource_type=target[0], resource_id=target[1], reason=decision.reason, under=decision)
        raise forbidden(permission=permission, target_type=target[0], target_id=target[1], reason=decision.reason)
    note_grant(decision, permission)
    return decision


# T055 audit: the allowing decisions of THIS request's require() calls, by permission (a context variable - every
# request runs in its own copied context, so nothing leaks between requests; an immutable tuple, so a nested context
# never edits its parent's). audit() records the binding, role and scope of the grant behind an "allowed" row that names
# no decision itself: the grant of the permission the action is named after (exact, or the longest permission the
# action extends: video.export -> video.export.create), else the request's latest grant.
_GRANTS: ContextVar[tuple[tuple[str, Decision], ...]] = ContextVar("sw_grants", default=())


def last_grant(action: str | None = None) -> Decision | None:
    grants = _GRANTS.get()
    if not grants:
        return None
    if action:
        exact = [d for p, d in grants if p == action]
        if exact:
            return exact[-1]
        prefixed = sorted(((p, d) for p, d in grants if p and action.startswith(p + ".")), key=lambda pd: len(pd[0]))
        if prefixed:
            return prefixed[-1][1]
    return grants[-1][1]


def note_grant(decision: Decision | None, permission: str = "") -> None:
    """Record an allowing decision for this request's audit rows (require() does it for every grant; a route that
    decides through authorize() - a placement rule, several permissions - calls it with the decision it used)."""
    if decision is not None and decision.allowed:
        _GRANTS.set(_GRANTS.get() + ((permission, decision),))


def effective_permissions(conn: sqlite3.Connection, principal: Principal, target: tuple[str, str]) -> list[str]:
    chain = set(scope_chain(conn, *target))
    allowed: set[str] = set()
    denied: set[str] = set()
    for b in _active_bindings(conn, principal):
        if (b["scope_type"], b["scope_id"]) not in chain:
            continue
        perms = role_permissions(conn, b["role_id"])
        (denied if b["effect"] == "deny" else allowed).update(perms)
    return sorted(p for p in allowed - denied if not local_factor_gate(principal, p))


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
        elif b["scope_type"] == STATION:
            # SEC-WXD L4 (CR-033 4.3): a station binding grants nothing above or beside itself - only the door permissions
            # count, and only for that station (whatever a custom role bound there carries, now or after an edit)
            allowed.update(p for p in perms if p in STATION_PERMISSIONS)
        else:
            allowed.update(perms)
    return sorted(p for p in allowed - denied_everywhere if not local_factor_gate(principal, p))


def role_name(conn: sqlite3.Connection, role_id: str) -> str:
    """A built-in role's Hebrew name as a screen shows it. A module's role name may carry its display name as a token (CR-038 D33:
    the tickets grant roles say "{tickets}"), rendered here with the configured name; a custom role keeps the name it was saved with."""
    name = ROLE_NAMES_HE.get(role_id)
    if name is None:
        return role_id
    if "{" in name:
        from .services.tickets import naming

        return naming.render_for(conn, name, "he")
    return name


def bindings_of(conn: sqlite3.Connection, principal: Principal) -> list[dict]:
    out = []
    for b in _active_bindings(conn, principal):
        out.append({
            "id": b["id"],
            "subject_kind": b["subject_kind"],
            "role_id": b["role_id"],
            "role_name": role_name(conn, b["role_id"]),
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
    if scope_type == STATION:
        # the station's name from the WisKey copy the add-on serves; never its opaque id on a screen
        from .services import intercom_sync

        station = intercom_sync.SYNC.station(scope_id)
        return f"עמדה · {station['name']}" if station and station.get("name") else "עמדת אינטרקום (לא זמינה כרגע)"
    table = {"site": "sites", "building": "buildings", "floor": "floors"}[scope_type]
    row = conn.execute(f"SELECT name FROM {table} WHERE id = ?", (scope_id,)).fetchone()
    return row["name"] if row else scope_id


def permissions_fingerprint(conn: sqlite3.Connection, principal: Principal) -> str:
    """A short hash of everything this user's access depends on - the active flag and each active binding (direct or
    through a group) with its role's current permissions, scope, effect and expiry. It moves exactly when the user's
    effective access may have changed, unlike the installation-wide permission_revision (T055: the shell re-fetches
    /me and the navigation when /me/ws or /me?known= says it moved)."""
    import hashlib

    from .services.active_users import is_disabled

    parts = [f"active={0 if is_disabled(conn, principal.user_id) else 1}"]  # moves when either side disables the user
    for b in sorted(_active_bindings(conn, principal), key=lambda r: r["id"]):
        parts.append("|".join((b["id"], b["role_id"], ",".join(sorted(role_permissions(conn, b["role_id"]))), b["scope_type"], b["scope_id"], b["effect"], b["expires_at"] or "")))
    return hashlib.sha256("\n".join(parts).encode("utf-8")).hexdigest()[:16]


def has_any_binding(conn: sqlite3.Connection, principal: Principal) -> bool:
    return bool(_active_bindings(conn, principal))


def is_system_admin(conn: sqlite3.Connection, user_id: str) -> bool:
    """Is this user an administrator of the installation: an active (not revoked, not expired) `system_admin` allow-binding
    at the installation scope - direct or through a group, resolved exactly like authorize() - and no installation-wide
    deny of that role. It answers "is THIS user a system administrator" (the administrator-only routes, require_system_admin;
    the directory sync). It is NOT the installation's administrator COUNT: that is admin_count below (lead decision L5), which the
    last-administrator guard and the setup wizard use. A Home Assistant admin flag alone never makes anyone one (it is information
    only). Callers check the active flag themselves (require_system_admin does, through require()). USR2: never true for a local
    (Arx-only) identity."""
    if str(user_id or "").startswith(LOCAL_ID_PREFIX):
        return False
    admin = False
    for b in _active_bindings(conn, Principal(user_id=user_id, username="", display_name="", source="internal")):
        if b["role_id"] != "system_admin" or (b["scope_type"], b["scope_id"]) != INSTALLATION:
            continue
        if b["effect"] == "deny":
            return False
        admin = True
    return admin


def require_system_admin(conn: sqlite3.Connection, principal: Principal, *, action: str, text: str, request_id: str | None = None,
                         resource_type: str = "installation", resource_id: str = "*", details: dict | None = None,
                         configure_checked: bool = False) -> None:
    """CR-ADMIN-GATE-2438 (code review 02:P2-1): the ONE system-administrator gate of the administrator-only routes.

    1. require("system.configure") at the installation - the inactive user, an explicit deny, demo mode and the local
       second-factor rule, audited by require() itself (skipped when the caller already ran it: `configure_checked`);
    2. is_system_admin - otherwise one audited refusal (`action`, reason `not_system_admin`, the caller's resource and details)
       and 403 `not_system_admin` with the caller's own Hebrew `text`.
    Each call site passes exactly the values it wrote by hand before, so its audit rows and texts are unchanged."""
    if not configure_checked:
        require(conn, principal, "system.configure", INSTALLATION)
    if is_system_admin(conn, principal.user_id):
        return
    from .audit import audit
    from .errors import ApiError

    extra = {} if details is None else {"details": details}
    audit(conn, actor=principal, action=action, decision="denied", resource_type=resource_type, resource_id=resource_id,
          reason="not_system_admin", request_id=request_id, **extra)
    raise ApiError(403, "not_system_admin", text)


ADMIN_PERMISSION = "rbac.roles.manage"


def admin_count(conn: sqlite3.Connection) -> int:
    """CR-ADMIN-GATE-2438 (code review 02:P2-9, lead decision L5): the ONE "administrator count" of the installation - the active
    users for whom `rbac.roles.manage` is allowed at the installation, exactly as authorize() decides it (allow and deny, direct
    and through groups, expiry, revocation, demo mode, the local second-factor rule; security review T082 M3). Used by the
    last-administrator guard (routers/access.keep_an_admin, routers/ha_users) and the setup wizard.

    Code review 02:P1-5 (router side): the bindings, the group memberships and the users are read ONCE (three statements plus the
    role table) and every user is decided in memory, instead of one authorize() - four to eleven statements - per active user.
    Never cached across calls: keep_an_admin counts again after its writes."""
    if _demo_refuses(conn, ADMIN_PERMISSION):
        return 0
    now = now_iso()
    rows = conn.execute(
        """SELECT subject_kind, subject_id, role_id, effect FROM bindings
           WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?) AND scope_type = 'installation' AND scope_id = '*'""",
        (now,)).fetchall()
    holds = {r["role_id"]: ADMIN_PERMISSION in role_permissions(conn, r["role_id"]) for r in rows}
    rows = [r for r in rows if holds[r["role_id"]]]
    if not rows:
        return 0
    members: dict[str, set[str]] = {}
    for m in conn.execute("SELECT group_id, user_id FROM group_members").fetchall():
        members.setdefault(m["user_id"], set()).add(m["group_id"])
    ha_off = {r[0] for r in conn.execute("SELECT id FROM ha_users WHERE is_active = 0").fetchall()}  # authorize's rule (services/active_users)
    n = 0
    for u in conn.execute("SELECT id, source FROM users WHERE active = 1").fetchall():
        uid = u["id"]
        if uid in ha_off:
            continue
        if u["source"] == "local":  # USR2: never without the second factor, and a count has no session (local_factor_gate)
            continue
        local = str(uid or "").startswith(LOCAL_ID_PREFIX)
        groups = members.get(uid, set())
        allowed = False
        for b in rows:
            if b["subject_kind"] == "user":
                if b["subject_id"] != uid:
                    continue
            elif b["subject_kind"] != "group" or b["subject_id"] not in groups or local:
                continue
            if local and b["role_id"] == "system_admin":
                continue
            if b["effect"] == "deny":
                allowed = False
                break
            allowed = True
        n += 1 if allowed else 0
    return n
