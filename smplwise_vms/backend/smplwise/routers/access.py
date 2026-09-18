"""Users from Home Assistant, VMS groups, role bindings, effective-permission preview and the RBAC audit
trail (chapters 8 and 40; docs/security/HA_IDENTITY_RBAC_HE.md §5-§12; contracts/access-api.design.json).

Identity comes only from Home Assistant (the bridge's directory push and the Ingress headers); nothing here
writes to HA. Every change bumps permission_revision, is audited with a before/after diff of the subject's
bindings, and closes the affected users' media sessions (services/revocation)."""
from __future__ import annotations

import datetime as dt
import json
import sqlite3
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field

from ..audit import audit
from ..auth import current_principal, get_conn, settings_of
from ..db import set_setting, bump_permission_revision, get_setting, new_id, now_iso, permission_revision, unlocked
from ..errors import ApiError
from ..rbac import INSTALLATION, ROLE_NAMES_HE, ROLES, Principal, all_roles, authorize, effective_permissions, require, role_permissions, scope_name
from ..services import ha_client, revocation
from ..services import playback as pb
from ..services.timeutil import parse_utc

router = APIRouter()

PERMISSION_LABELS: dict[str, str] = {
    "map.read": "צפייה במפה",
    "entity.state.read": "מצב ישויות HA",
    "video.live": "שידור חי",
    "video.playback": "ניגון הקלטות",
    "events.read": "צפייה באירועים",
    "events.ack": "סימון אירועים כטופלו",
    "map.import": "ייבוא תוכניות",
    "map.edit": "עריכת מפה",
    "map.publish": "פרסום תוכנית",
    "placement.edit": "הצבת ציוד על המפה",
    "views.edit": "עריכת תצוגות",
    "site.content.configure": "הגדרות תוכן מקומיות",
    "system.configure": "הגדרות מערכת",
    "sources.configure": "הגדרת מקורות (NVR / go2rtc)",
    "identity.directory.read": "צפייה בספריית המשתמשים",
    "rbac.assign": "שיוך תפקידים",
    "rbac.roles.manage": "ניהול תפקידים",
    "audit.read": "צפייה באודיט",
    "backup.manage": "גיבוי ושחזור",
    "video.export": "ייצוא וידאו",
    "ha.entity.control": "שליטה בישויות HA",
    "audio.talk": "דיבור דו־כיווני",
    "camera.ptz": "שליטת PTZ",
    "door.unlock": "פתיחת דלת",
    "alarm.disarm": "ניטרול אזעקה",
    "nvr.config.write": "כתיבה להגדרות ה־NVR",
    "nvr.config.events": "NVR: הפעלת התראות (Notify Surveillance Center) ולוחות זימון",
    "nvr.config.detection": "NVR: עריכת אזורי זיהוי תנועה ורגישות",
    "nvr.config.privacy": "NVR: עריכת מסכות פרטיות",
    "nvr.config.smart": "NVR: עריכת כללי Smart Event",
    "nvr.config.schedule": "NVR: עריכת לוח ההקלטה",
    "nvr.config.stream": "NVR: תצורת זרם (רזולוציה, bitrate)",
    "nvr.config.osd": "NVR: שם ערוץ ו־OSD",
    "nvr.config.time": "NVR: שעון ו־NTP",
    "nvr.record.manual": "NVR: הקלטה ידנית",
    "nvr.record.lock": "NVR: נעילת קטע הקלטה",
    "nvr.alarm_output": "NVR: הפעלת יציאת אזעקה",
    "nvr.storage.test": "NVR: בדיקת דיסק",
    "nvr.system.reboot": "NVR: הפעלה מחדש",
    "rules.ha_notify": "חוקים: התראה דרך Home Assistant (notify)",
}
SYSTEM_PERMISSIONS = {"system.configure", "sources.configure", "identity.directory.read", "rbac.roles.manage", "audit.read", "backup.manage"}  # rbac.assign is delegable (T082)
DEFAULT_DELEGABLE = ["viewer", "operator", "editor", "kiosk"]
SENSITIVE: list[str] = list(json.loads((Path(__file__).resolve().parents[1] / "roles.json").read_text(encoding="utf-8")).get("sensitive_permissions_not_implied", []))
SCOPE_TABLES = {"site": "sites", "building": "buildings", "floor": "floors"}
STALE_S = 300  # the integration pushes the directory every 60 s


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


# ---------------------------------------------------------------- shaping

def _subject_name(conn: sqlite3.Connection, kind: str, subject_id: str) -> str:
    if kind == "group":
        row = conn.execute("SELECT name FROM groups WHERE id = ?", (subject_id,)).fetchone()
        return row["name"] if row else subject_id
    ha = conn.execute("SELECT name, username FROM ha_users WHERE id = ?", (subject_id,)).fetchone()
    if ha and (ha["name"] or ha["username"]):
        return ha["name"] or ha["username"]
    vms = conn.execute("SELECT display_name, username FROM users WHERE id = ?", (subject_id,)).fetchone()
    if vms and (vms["display_name"] or vms["username"]):
        return vms["display_name"] or vms["username"]
    return subject_id


def _binding_dict(conn: sqlite3.Connection, b: sqlite3.Row, via_group: str | None = None) -> dict[str, Any]:
    return {
        "id": b["id"],
        "subject_kind": b["subject_kind"],
        "subject_id": b["subject_id"],
        "subject_name": _subject_name(conn, b["subject_kind"], b["subject_id"]),
        "role_id": b["role_id"],
        "role_name": ROLE_NAMES_HE.get(b["role_id"], b["role_id"]),
        "scope_type": b["scope_type"],
        "scope_id": b["scope_id"],
        "scope_name": scope_name(conn, b["scope_type"], b["scope_id"]),
        "effect": b["effect"],
        "permission_revision": b["permission_revision"],
        "assigned_by": b["assigned_by"],
        "created_at": b["created_at"],
        "expires_at": b["expires_at"],
        "via_group": via_group,
    }


def _active_bindings_sql(extra: str = "") -> str:
    return f"SELECT * FROM bindings WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?) {extra} ORDER BY created_at"


def _user_bindings(conn: sqlite3.Connection, user_id: str) -> list[dict[str, Any]]:
    now = now_iso()
    out = [_binding_dict(conn, b) for b in conn.execute(_active_bindings_sql("AND subject_kind = 'user' AND subject_id = ?"), (now, user_id)).fetchall()]
    for g in conn.execute("SELECT g.id, g.name FROM groups g JOIN group_members m ON m.group_id = g.id WHERE m.user_id = ?", (user_id,)).fetchall():
        out += [_binding_dict(conn, b, via_group=g["name"]) for b in conn.execute(_active_bindings_sql("AND subject_kind = 'group' AND subject_id = ?"), (now, g["id"])).fetchall()]
    return out


def _binding_summary(conn: sqlite3.Connection, kind: str, subject_id: str) -> list[str]:
    now = now_iso()
    return [f"{b['role_id']}@{b['scope_type']}:{b['scope_id']}:{b['effect']}" for b in conn.execute(_active_bindings_sql("AND subject_kind = ? AND subject_id = ?"), (now, kind, subject_id)).fetchall()]


def _sync_status(ha: dict[str, Any] | None, vms: dict[str, Any] | None, paired: bool) -> str:
    if ha:
        if not ha["is_active"]:
            return "removed"
        try:
            age = (dt.datetime.now(dt.timezone.utc) - parse_utc(ha["synced_at"])).total_seconds()
        except ValueError:
            age = STALE_S + 1
        return "verified" if age <= STALE_S else "stale"
    if vms and vms.get("source") == "dev":
        return "dev"
    return "unavailable" if paired else "unknown"


def _users(conn: sqlite3.Connection, principal: Principal) -> list[dict[str, Any]]:
    ha = {r["id"]: dict(r) for r in conn.execute("SELECT * FROM ha_users").fetchall()}
    vms = {r["id"]: dict(r) for r in conn.execute("SELECT * FROM users").fetchall()}
    paired = bool(get_setting(conn, "bridge.paired_at"))
    groups_of: dict[str, list[dict[str, str]]] = {}
    for r in conn.execute("SELECT m.user_id, g.id, g.name FROM group_members m JOIN groups g ON g.id = m.group_id").fetchall():
        groups_of.setdefault(r["user_id"], []).append({"id": r["id"], "name": r["name"]})
    out = []
    for uid in sorted(set(ha) | set(vms), key=lambda i: (ha.get(i, {}).get("name") or vms.get(i, {}).get("display_name") or vms.get(i, {}).get("username") or i).lower()):
        h, v = ha.get(uid), vms.get(uid)
        active = bool(h["is_active"]) if h else bool(v["active"]) if v else False
        if h and v and not v["active"]:
            active = False
        out.append({
            "id": uid,
            "name": (h or {}).get("name") or (v or {}).get("display_name") or (v or {}).get("username") or uid,
            "username": (h or {}).get("username") or (v or {}).get("username") or "",
            "is_admin": bool((h or {}).get("is_admin")),
            "active": active,
            "source": "both" if h and v else "ha_directory" if h else "vms",
            "sync_status": _sync_status(h, v, paired),
            "synced_at": (h or {}).get("synced_at"),
            "first_seen_at": (v or {}).get("first_seen_at"),
            "last_seen_at": (v or {}).get("last_seen_at"),
            "groups": groups_of.get(uid, []),
            "bindings": _user_bindings(conn, uid),
            "is_self": uid == principal.user_id,
        })
    return out


def _ensure_user_row(conn: sqlite3.Connection, user_id: str) -> None:
    """A binding may be granted before the person ever opened the add-on: mirror the directory row into users."""
    if conn.execute("SELECT 1 FROM users WHERE id = ?", (user_id,)).fetchone():
        return
    ha = conn.execute("SELECT * FROM ha_users WHERE id = ?", (user_id,)).fetchone()
    if not ha:
        raise ApiError(404, "user_unknown", "המשתמש לא נמצא בספריית Home Assistant.")
    now = now_iso()
    conn.execute(
        "INSERT INTO users(id, username, display_name, source, active, first_seen_at, last_seen_at) VALUES (?, ?, ?, 'ingress', ?, ?, ?)",
        (user_id, ha["username"] or "", ha["name"] or ha["username"] or "", 1 if ha["is_active"] else 0, now, now),
    )


def _scope_exists(conn: sqlite3.Connection, scope_type: str, scope_id: str) -> bool:
    if scope_type == "installation":
        return scope_id == "*"
    table = SCOPE_TABLES.get(scope_type)
    if not table:
        return False
    return conn.execute(f"SELECT 1 FROM {table} WHERE id = ? AND deleted_at IS NULL", (scope_id,)).fetchone() is not None


def delegable_roles(conn: sqlite3.Connection) -> list[str]:
    """Roles a delegated (non installation-wide) administrator may assign: the configured allowlist plus custom roles flagged delegable."""
    raw = get_setting(conn, "rbac.delegable_roles")
    try:
        chosen = [r for r in json.loads(raw) if isinstance(r, str)] if raw else list(DEFAULT_DELEGABLE)
    except ValueError:
        chosen = list(DEFAULT_DELEGABLE)
    custom = [r["id"] for r in conn.execute("SELECT id FROM custom_roles WHERE deleted_at IS NULL AND delegable = 1").fetchall()]
    return sorted(set(chosen) | set(custom))


def _check_delegation(conn: sqlite3.Connection, principal: Principal, role_id: str, scope: tuple[str, str], subject_kind: str = "user") -> None:
    """Pilot rule (§7) plus T082: only holders of rbac.assign on the target scope assign; system permissions and the
    system_admin role stay installation-wide and need installation-wide authority. A delegated administrator (site
    scope) may assign only allowlisted roles, only permissions they hold themselves at that scope (no self-escalation),
    and only to users (no cross-scope group membership through delegation)."""
    require(conn, principal, "rbac.assign", scope)
    perms = set(role_permissions(conn, role_id))
    wide = authorize(conn, principal, "rbac.assign", INSTALLATION).allowed
    if perms & SYSTEM_PERMISSIONS:
        if role_id == "system_admin" and scope != INSTALLATION:
            raise ApiError(422, "scope_not_allowed_for_role", "מנהל מערכת VMS מוקצה רק ברמת ההתקנה כולה.")
        if not wide:
            audit(conn, actor=principal, action="rbac.bind", decision="denied", resource_type=scope[0], resource_id=scope[1], reason="delegation_exceeded", details={"role_id": role_id})
            raise ApiError(403, "delegation_exceeded", "הקצאת תפקיד עם הרשאות מערכת דורשת סמכות על ההתקנה כולה.")
    if wide:
        return
    if role_id not in delegable_roles(conn):
        audit(conn, actor=principal, action="rbac.bind", decision="denied", resource_type=scope[0], resource_id=scope[1], reason="role_not_delegable", details={"role_id": role_id})
        raise ApiError(403, "role_not_delegable", "מנהל מקומי רשאי להקצות רק תפקידים מרשימת ההאצלה.", details={"delegable": delegable_roles(conn)})
    missing = sorted(perms - set(effective_permissions(conn, principal, scope)))
    if missing:
        audit(conn, actor=principal, action="rbac.bind", decision="denied", resource_type=scope[0], resource_id=scope[1], reason="delegation_escalation", details={"role_id": role_id, "missing": missing})
        raise ApiError(403, "delegation_escalation", "אי אפשר להאציל הרשאות שאין לך בהיקף הזה.", details={"missing": missing})
    if subject_kind != "user":
        audit(conn, actor=principal, action="rbac.bind", decision="denied", resource_type=scope[0], resource_id=scope[1], reason="delegation_groups", details={"role_id": role_id})
        raise ApiError(403, "delegation_groups", "מנהל מקומי משייך משתמשים בלבד; קבוצות חוצות היקפים מנוהלות על ידי מנהל המערכת.")


def _terminate(conn: sqlite3.Connection, settings: Any, user_ids: set[str]) -> None:
    """Immediate effect for revocations: mark the users (live/playback relays stop) and close playback sessions."""
    if not user_ids:
        return
    revocation.mark(user_ids)
    sessions = [s for uid in user_ids for s in pb.REGISTRY.by_user(uid)]
    if sessions:
        with unlocked(conn):
            for s in sessions:
                try:
                    pb.close(settings, s, "revoked")
                except Exception:  # noqa: BLE001 - never let a stream cleanup block the revocation
                    pass


def _group_members(conn: sqlite3.Connection, group_id: str) -> list[str]:
    return [r["user_id"] for r in conn.execute("SELECT user_id FROM group_members WHERE group_id = ?", (group_id,)).fetchall()]


def _last_admin_guard(conn: sqlite3.Connection, binding: sqlite3.Row) -> None:
    """The last active VMS system administrator cannot be removed through the product (§10)."""
    if binding["role_id"] != "system_admin" or (binding["scope_type"], binding["scope_id"]) != INSTALLATION or binding["effect"] != "allow":
        return
    now = now_iso()
    others = 0
    for b in conn.execute(_active_bindings_sql("AND role_id = 'system_admin' AND scope_type = 'installation' AND effect = 'allow' AND id != ?"), (now, binding["id"])).fetchall():
        if b["subject_kind"] == "user":
            u = conn.execute("SELECT active FROM users WHERE id = ?", (b["subject_id"],)).fetchone()
            others += 1 if (u is None or u["active"]) else 0
        else:
            others += conn.execute("SELECT COUNT(*) FROM group_members m JOIN users u ON u.id = m.user_id WHERE m.group_id = ? AND u.active = 1", (b["subject_id"],)).fetchone()[0]
    if others == 0:
        raise ApiError(409, "last_admin_protected", "זהו מנהל המערכת הפעיל האחרון; הקצה מנהל אחר לפני הסרה.")


# ---------------------------------------------------------------- directory

@router.get("/identity/users")
def list_users(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "identity.directory.read", INSTALLATION)
    return {
        "users": _users(conn, principal),
        "directory": {
            "paired": bool(get_setting(conn, "bridge.paired_at")),
            "last_directory_at": get_setting(conn, "bridge.directory_at") or None,
            "users": conn.execute("SELECT COUNT(*) FROM ha_users").fetchone()[0],
        },
        "revision": permission_revision(conn),
        "can_assign": authorize(conn, principal, "rbac.assign", INSTALLATION).allowed,
    }


@router.post("/identity/sync")
def sync_directory(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Ask the bridge integration to push the HA user directory now (it pushes every 60 s anyway)."""
    require(conn, principal, "system.configure", INSTALLATION)
    settings = settings_of(request)
    if not get_setting(conn, "bridge.paired_at"):
        raise ApiError(503, "bridge_not_paired", "גשר SMPLWISE אינו מצומד ב־Home Assistant.")
    audit(conn, actor=principal, action="identity.sync", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request))
    try:
        with unlocked(conn):
            result = ha_client.call_service(settings, "smplwise_bridge", "sync_directory", {}, return_response=True)
    except ApiError as exc:
        if exc.code in ("service_not_found", "ha_error"):
            return {"requested": False, "note": "האינטגרציה המותקנת עדיין ללא שירות sync_directory; הספרייה נדחפת אוטומטית כל דקה.", "error": exc.code}
        raise
    return {"requested": True, "result": result}


# ---------------------------------------------------------------- roles

@router.get("/access/roles")
def list_roles(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "identity.directory.read", INSTALLATION)
    delegable = delegable_roles(conn)
    roles = []
    for rid, perms in ROLES.items():
        roles.append({
            "id": rid, "name": ROLE_NAMES_HE.get(rid, rid), "permissions": list(perms), "custom": False, "description": "", "revision": None, "delegable": rid in delegable,
            "sensitive_included": [p for p in perms if p in SENSITIVE], "sensitive_missing": [p for p in SENSITIVE if p not in perms], "system_role": bool(set(perms) & SYSTEM_PERMISSIONS),
        })
    for r in conn.execute("SELECT * FROM custom_roles WHERE deleted_at IS NULL ORDER BY created_at").fetchall():
        roles.append(_custom_role_dict(conn, r))
    return {"roles": roles, "labels": PERMISSION_LABELS, "sensitive": SENSITIVE, "system_permissions": sorted(SYSTEM_PERMISSIONS), "delegable_roles": delegable,
            "can_manage_roles": authorize(conn, principal, "rbac.roles.manage", INSTALLATION).allowed}


# ---------------------------------------------------------------- bindings

class BindingBody(BaseModel):
    subject_kind: str = Field(pattern="^(user|group)$")
    subject_id: str = Field(min_length=1, max_length=200)
    role_id: str = Field(min_length=1, max_length=60)
    scope_type: str = Field(pattern="^(installation|site|building|floor)$")
    scope_id: str = Field(min_length=1, max_length=200)
    effect: str = Field(default="allow", pattern="^(allow|deny)$")
    expires_at: str | None = None


@router.get("/access/bindings")
def list_bindings(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "rbac.assign", INSTALLATION)
    return {"bindings": [_binding_dict(conn, b) for b in conn.execute(_active_bindings_sql(), (now_iso(),)).fetchall()], "revision": permission_revision(conn)}


@router.post("/access/bindings", status_code=201)
def create_binding(body: BindingBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    if body.role_id not in all_roles(conn):
        raise ApiError(422, "role_unknown", "תפקיד לא מוכר.")
    scope = (body.scope_type, body.scope_id)
    if not _scope_exists(conn, *scope):
        raise ApiError(422, "scope_unknown", "ההיקף (אתר / מבנה / קומה) לא נמצא.")
    if body.expires_at:
        try:
            if parse_utc(body.expires_at) <= dt.datetime.now(dt.timezone.utc):
                raise ApiError(422, "validation", "expires_at כבר עבר.")
        except ValueError:
            raise ApiError(422, "validation", "expires_at חייב להיות UTC (Z).")
    _check_delegation(conn, principal, body.role_id, scope, body.subject_kind)
    if body.subject_kind == "user":
        _ensure_user_row(conn, body.subject_id)
    elif not conn.execute("SELECT 1 FROM groups WHERE id = ?", (body.subject_id,)).fetchone():
        raise ApiError(404, "group_unknown", "הקבוצה לא נמצאה.")
    dup = conn.execute(
        _active_bindings_sql("AND subject_kind = ? AND subject_id = ? AND role_id = ? AND scope_type = ? AND scope_id = ? AND effect = ?"),
        (now_iso(), body.subject_kind, body.subject_id, body.role_id, body.scope_type, body.scope_id, body.effect),
    ).fetchone()
    if dup:
        raise ApiError(409, "binding_exists", "השיוך הזה כבר קיים.", details={"binding_id": dup["id"]})
    before = _binding_summary(conn, body.subject_kind, body.subject_id)
    rev = bump_permission_revision(conn)
    bid = new_id()
    conn.execute(
        "INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at, expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        (bid, body.subject_kind, body.subject_id, body.role_id, body.scope_type, body.scope_id, body.effect, rev, principal.user_id, now_iso(), body.expires_at),
    )
    after = _binding_summary(conn, body.subject_kind, body.subject_id)
    audit(conn, actor=principal, action="rbac.bind", decision="allowed", resource_type=body.subject_kind, resource_id=body.subject_id, request_id=_rid(request),
          details={"binding_id": bid, "role_id": body.role_id, "scope": f"{body.scope_type}:{body.scope_id}", "effect": body.effect, "before": before, "after": after, "revision": rev})
    if body.effect == "deny":
        _terminate(conn, settings_of(request), {body.subject_id} if body.subject_kind == "user" else set(_group_members(conn, body.subject_id)))
    row = conn.execute("SELECT * FROM bindings WHERE id = ?", (bid,)).fetchone()
    return {**_binding_dict(conn, row), "revision": rev}


@router.delete("/access/bindings/{binding_id}")
def revoke_binding(binding_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    b = conn.execute("SELECT * FROM bindings WHERE id = ? AND revoked_at IS NULL", (binding_id,)).fetchone()
    if not b:
        raise ApiError(404, "not_found", "השיוך לא נמצא או כבר בוטל.")
    scope = (b["scope_type"], b["scope_id"])
    require(conn, principal, "rbac.assign", scope)
    _last_admin_guard(conn, b)
    before = _binding_summary(conn, b["subject_kind"], b["subject_id"])
    rev = bump_permission_revision(conn)
    conn.execute("UPDATE bindings SET revoked_at = ? WHERE id = ?", (now_iso(), binding_id))
    after = _binding_summary(conn, b["subject_kind"], b["subject_id"])
    audit(conn, actor=principal, action="rbac.unbind", decision="allowed", resource_type=b["subject_kind"], resource_id=b["subject_id"], request_id=_rid(request),
          details={"binding_id": binding_id, "role_id": b["role_id"], "scope": f"{b['scope_type']}:{b['scope_id']}", "before": before, "after": after, "revision": rev})
    affected = {b["subject_id"]} if b["subject_kind"] == "user" else set(_group_members(conn, b["subject_id"]))
    _terminate(conn, settings_of(request), affected)
    return {"revoked": binding_id, "revision": rev}


# ---------------------------------------------------------------- groups

class GroupBody(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class MembersBody(BaseModel):
    user_ids: list[str] = Field(default_factory=list, max_length=500)


def _group_dict(conn: sqlite3.Connection, g: sqlite3.Row) -> dict[str, Any]:
    members = [{"id": r["user_id"], "name": _subject_name(conn, "user", r["user_id"])} for r in conn.execute("SELECT user_id FROM group_members WHERE group_id = ?", (g["id"],)).fetchall()]
    return {
        "id": g["id"],
        "name": g["name"],
        "created_at": g["created_at"],
        "members": members,
        "bindings": [_binding_dict(conn, b) for b in conn.execute(_active_bindings_sql("AND subject_kind = 'group' AND subject_id = ?"), (now_iso(), g["id"])).fetchall()],
    }


@router.get("/access/groups")
def list_groups(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "identity.directory.read", INSTALLATION)
    return {"groups": [_group_dict(conn, g) for g in conn.execute("SELECT * FROM groups ORDER BY name").fetchall()]}


@router.post("/access/groups", status_code=201)
def create_group(body: GroupBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "rbac.assign", INSTALLATION)
    if conn.execute("SELECT 1 FROM groups WHERE name = ?", (body.name.strip(),)).fetchone():
        raise ApiError(409, "group_exists", "קבוצה בשם הזה כבר קיימת.")
    gid = new_id()
    conn.execute("INSERT INTO groups(id, name, created_at, created_by) VALUES (?, ?, ?, ?)", (gid, body.name.strip(), now_iso(), principal.user_id))
    audit(conn, actor=principal, action="rbac.group_create", decision="allowed", resource_type="group", resource_id=gid, request_id=_rid(request), details={"name": body.name.strip()})
    return _group_dict(conn, conn.execute("SELECT * FROM groups WHERE id = ?", (gid,)).fetchone())


@router.put("/access/groups/{group_id}/members")
def set_members(group_id: str, body: MembersBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Replace the membership. The actor must hold rbac.assign on every scope the group is bound to (§6)."""
    g = conn.execute("SELECT * FROM groups WHERE id = ?", (group_id,)).fetchone()
    if not g:
        raise ApiError(404, "group_unknown", "הקבוצה לא נמצאה.")
    require(conn, principal, "rbac.assign", INSTALLATION)
    for b in conn.execute(_active_bindings_sql("AND subject_kind = 'group' AND subject_id = ?"), (now_iso(), group_id)).fetchall():
        if not authorize(conn, principal, "rbac.assign", (b["scope_type"], b["scope_id"])).allowed:
            raise ApiError(403, "group_scope_exceeds_delegation", "הקבוצה משויכת להיקף שאינך מנהל.")
    wanted = set(body.user_ids)
    for uid in wanted:
        _ensure_user_row(conn, uid)
    before = set(_group_members(conn, group_id))
    for uid in before - wanted:
        conn.execute("DELETE FROM group_members WHERE group_id = ? AND user_id = ?", (group_id, uid))
    for uid in wanted - before:
        conn.execute("INSERT INTO group_members(group_id, user_id) VALUES (?, ?)", (group_id, uid))
    rev = bump_permission_revision(conn)
    audit(conn, actor=principal, action="rbac.group_members", decision="allowed", resource_type="group", resource_id=group_id, request_id=_rid(request),
          details={"added": sorted(wanted - before), "removed": sorted(before - wanted), "group_bindings": _binding_summary(conn, "group", group_id), "revision": rev})
    _terminate(conn, settings_of(request), before - wanted)
    return _group_dict(conn, g)


@router.delete("/access/groups/{group_id}")
def delete_group(group_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    g = conn.execute("SELECT * FROM groups WHERE id = ?", (group_id,)).fetchone()
    if not g:
        raise ApiError(404, "group_unknown", "הקבוצה לא נמצאה.")
    require(conn, principal, "rbac.assign", INSTALLATION)
    bindings = conn.execute(_active_bindings_sql("AND subject_kind = 'group' AND subject_id = ?"), (now_iso(), group_id)).fetchall()
    for b in bindings:
        require(conn, principal, "rbac.assign", (b["scope_type"], b["scope_id"]))
        _last_admin_guard(conn, b)
    members = set(_group_members(conn, group_id))
    now = now_iso()
    for b in bindings:
        conn.execute("UPDATE bindings SET revoked_at = ? WHERE id = ?", (now, b["id"]))
    conn.execute("DELETE FROM group_members WHERE group_id = ?", (group_id,))
    conn.execute("DELETE FROM groups WHERE id = ?", (group_id,))
    rev = bump_permission_revision(conn)
    audit(conn, actor=principal, action="rbac.group_delete", decision="allowed", resource_type="group", resource_id=group_id, request_id=_rid(request),
          details={"name": g["name"], "revoked_bindings": [b["id"] for b in bindings], "members": sorted(members), "revision": rev})
    _terminate(conn, settings_of(request), members)
    return {"deleted": group_id, "revision": rev}


# ---------------------------------------------------------------- preview + audit

class PreviewBody(BaseModel):
    user_id: str = Field(min_length=1, max_length=200)
    scope_type: str = Field(default="installation", pattern="^(installation|site|building|floor)$")
    scope_id: str = Field(default="*", min_length=1, max_length=200)


@router.post("/access/preview")
def preview(body: PreviewBody, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Effective permissions of a user at a scope, computed server-side; no impersonation (§12)."""
    scope = (body.scope_type, body.scope_id)
    if body.user_id != principal.user_id:
        require(conn, principal, "rbac.assign", scope)
    if not _scope_exists(conn, *scope):
        raise ApiError(422, "scope_unknown", "ההיקף לא נמצא.")
    u = conn.execute("SELECT * FROM users WHERE id = ?", (body.user_id,)).fetchone()
    subject = Principal(user_id=body.user_id, username=(u["username"] if u else ""), display_name=(u["display_name"] if u else ""), source=(u["source"] if u else "ingress"))
    active = bool(u["active"]) if u else True
    allowed = effective_permissions(conn, subject, scope) if active else []
    return {
        "user_id": body.user_id,
        "scope_type": body.scope_type,
        "scope_id": body.scope_id,
        "scope_name": scope_name(conn, *scope),
        "active": active,
        "allowed": allowed,
        "denied": [p for p in PERMISSION_LABELS if p not in allowed],
        "labels": PERMISSION_LABELS,
        "bindings": _user_bindings(conn, body.user_id),
        "revision": permission_revision(conn),
    }


@router.get("/audit")
def list_audit(
    principal: Principal = Depends(current_principal),
    conn: sqlite3.Connection = Depends(get_conn),
    prefix: str = Query("rbac.", max_length=60),
    actor: str | None = Query(None, max_length=200),
    resource_id: str | None = Query(None, max_length=200),
    limit: int = Query(100, ge=1, le=500),
) -> dict[str, Any]:
    require(conn, principal, "audit.read", INSTALLATION)
    sql = "SELECT * FROM audit_log WHERE action LIKE ?"
    args: list[Any] = [prefix + "%"]
    if actor:
        sql += " AND actor_username = ?"
        args.append(actor)
    if resource_id:
        sql += " AND resource_id = ?"
        args.append(resource_id)
    sql += " ORDER BY rowid DESC LIMIT ?"
    args.append(limit)
    rows = []
    for r in conn.execute(sql, args).fetchall():
        d = dict(r)
        try:
            d["details"] = json.loads(d.pop("details_json") or "{}")
        except (ValueError, KeyError):
            d["details"] = {}
        rows.append(d)
    return {"rows": rows}


# ---------------------------------------------------------------- custom roles and delegation (T082)

class CustomRoleBody(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    description: str = Field(default="", max_length=300)
    permissions: list[str] = Field(default_factory=list, max_length=40)
    sensitive: list[str] = Field(default_factory=list, max_length=20)
    delegable: bool = False


class CustomRolePatch(CustomRoleBody):
    revision: int = Field(ge=1)


class RolePreviewBody(BaseModel):
    role_id: str | None = Field(default=None, max_length=60)
    permissions: list[str] = Field(default_factory=list, max_length=40)
    sensitive: list[str] = Field(default_factory=list, max_length=20)


class DelegationBody(BaseModel):
    delegable_roles: list[str] = Field(default_factory=list, max_length=50)


def _custom_role_dict(conn: sqlite3.Connection, r: sqlite3.Row) -> dict[str, Any]:
    perms = json.loads(r["permissions_json"])
    sens = json.loads(r["sensitive_json"] or "[]")
    allp = sorted(set(perms) | set(sens))
    return {
        "id": r["id"], "name": r["name_he"], "description": r["description"], "permissions": allp, "custom": True, "revision": r["revision"], "delegable": bool(r["delegable"]),
        "sensitive_included": [p for p in allp if p in SENSITIVE], "sensitive_missing": [p for p in SENSITIVE if p not in allp], "system_role": False,
        "created_by_username": r["created_by_username"], "updated_by_username": r["updated_by_username"], "updated_at": r["updated_at"],
    }


def _validate_role_body(permissions: list[str], sensitive: list[str]) -> tuple[list[str], list[str]]:
    perms = sorted({p for p in permissions if p})
    sens = sorted({p for p in sensitive if p})
    unknown = [p for p in perms + sens if p not in PERMISSION_LABELS]
    if unknown:
        raise ApiError(422, "permission_unknown", "הרשאה לא מוכרת.", details={"unknown": unknown})
    if set(perms) & set(SENSITIVE):
        raise ApiError(422, "sensitive_in_permissions", "הרשאות רגישות ניתנות רק ברשימת ההרשאות הרגישות, במפורש.", details={"sensitive": sorted(set(perms) & set(SENSITIVE))})
    if set(perms) & SYSTEM_PERMISSIONS or set(sens) & SYSTEM_PERMISSIONS:
        raise ApiError(422, "system_permission_not_allowed", "הרשאות מערכת נשארות בתפקידים המובנים בלבד.", details={"system": sorted((set(perms) | set(sens)) & SYSTEM_PERMISSIONS)})
    if set(sens) - set(SENSITIVE):
        raise ApiError(422, "not_sensitive", "רק הרשאות מהרשימה הרגישה נכנסות לרשימת ההרשאות הרגישות.", details={"invalid": sorted(set(sens) - set(SENSITIVE))})
    if not perms and not sens:
        raise ApiError(422, "validation", "תפקיד חייב לכלול לפחות הרשאה אחת.")
    return perms, sens


def _role_impact(conn: sqlite3.Connection, role_id: str | None, new_perms: list[str]) -> dict[str, Any]:
    """Who is touched by a role change: bindings, users (direct and through groups), groups and scopes, plus the permission diff."""
    current = role_permissions(conn, role_id) if role_id else []
    out: dict[str, Any] = {"role_id": role_id, "added": sorted(set(new_perms) - set(current)), "removed": sorted(set(current) - set(new_perms)), "bindings": 0, "users": [], "groups": [], "scopes": []}
    if not role_id:
        return out
    now = now_iso()
    users: dict[str, str] = {}
    groups: dict[str, str] = {}
    scopes: set[str] = set()
    for b in conn.execute(_active_bindings_sql("AND role_id = ?"), (now, role_id)).fetchall():
        out["bindings"] += 1
        scopes.add(scope_name(conn, b["scope_type"], b["scope_id"]))
        if b["subject_kind"] == "user":
            u = conn.execute("SELECT display_name, username FROM users WHERE id = ?", (b["subject_id"],)).fetchone()
            users[b["subject_id"]] = (u["display_name"] or u["username"]) if u else b["subject_id"]
        else:
            g = conn.execute("SELECT name FROM groups WHERE id = ?", (b["subject_id"],)).fetchone()
            groups[b["subject_id"]] = g["name"] if g else b["subject_id"]
            for uid in _group_members(conn, b["subject_id"]):
                u = conn.execute("SELECT display_name, username FROM users WHERE id = ?", (uid,)).fetchone()
                users[uid] = (u["display_name"] or u["username"]) if u else uid
    out["users"] = [{"id": k, "name": v} for k, v in sorted(users.items(), key=lambda kv: kv[1])]
    out["groups"] = [{"id": k, "name": v} for k, v in sorted(groups.items(), key=lambda kv: kv[1])]
    out["scopes"] = sorted(scopes)
    return out


@router.post("/access/roles", status_code=201)
def create_custom_role(body: CustomRoleBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "rbac.roles.manage", INSTALLATION)
    perms, sens = _validate_role_body(body.permissions, body.sensitive)
    if body.name.strip() in ROLE_NAMES_HE.values() or conn.execute("SELECT 1 FROM custom_roles WHERE name_he = ? AND deleted_at IS NULL", (body.name.strip(),)).fetchone():
        raise ApiError(409, "role_name_taken", "כבר קיים תפקיד בשם הזה.")
    rid = f"custom-{new_id()[:8]}"
    now = now_iso()
    conn.execute(
        "INSERT INTO custom_roles(id, name_he, description, permissions_json, sensitive_json, delegable, revision, created_by, created_by_username, updated_by, updated_by_username, created_at, updated_at) VALUES (?,?,?,?,?,?,1,?,?,?,?,?,?)",
        (rid, body.name.strip(), body.description, json.dumps(perms), json.dumps(sens), int(body.delegable), principal.user_id, principal.username, principal.user_id, principal.username, now, now),
    )
    rev = bump_permission_revision(conn)
    audit(conn, actor=principal, action="rbac.role.create", decision="allowed", resource_type="role", resource_id=rid, request_id=_rid(request), details={"name": body.name.strip(), "permissions": perms, "sensitive": sens, "delegable": body.delegable, "revision": rev})
    return _custom_role_dict(conn, conn.execute("SELECT * FROM custom_roles WHERE id = ?", (rid,)).fetchone())


@router.post("/access/roles/preview")
def preview_role_change(body: RolePreviewBody, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Before saving: who holds the role today (users, groups, scopes) and which permissions the change adds or removes."""
    require(conn, principal, "rbac.roles.manage", INSTALLATION)
    perms, sens = _validate_role_body(body.permissions, body.sensitive)
    if body.role_id and body.role_id not in all_roles(conn):
        raise ApiError(404, "not_found", "התפקיד לא נמצא.")
    return {**_role_impact(conn, body.role_id, sorted(set(perms) | set(sens))), "labels": PERMISSION_LABELS}


@router.patch("/access/roles/{role_id}")
def update_custom_role(role_id: str, body: CustomRolePatch, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "rbac.roles.manage", INSTALLATION)
    if role_id in ROLES:
        raise ApiError(409, "builtin_role", "תפקידים מובנים אינם ניתנים לעריכה; צור תפקיד מותאם.")
    r = conn.execute("SELECT * FROM custom_roles WHERE id = ? AND deleted_at IS NULL", (role_id,)).fetchone()
    if not r:
        raise ApiError(404, "not_found", "התפקיד לא נמצא.")
    if body.revision != r["revision"]:
        raise ApiError(409, "stale_revision", "התפקיד השתנה בינתיים; טען מחדש.", details={"current_revision": r["revision"], "sent_revision": body.revision})
    perms, sens = _validate_role_body(body.permissions, body.sensitive)
    impact = _role_impact(conn, role_id, sorted(set(perms) | set(sens)))
    conn.execute(
        "UPDATE custom_roles SET name_he = ?, description = ?, permissions_json = ?, sensitive_json = ?, delegable = ?, revision = revision + 1, updated_by = ?, updated_by_username = ?, updated_at = ? WHERE id = ?",
        (body.name.strip(), body.description, json.dumps(perms), json.dumps(sens), int(body.delegable), principal.user_id, principal.username, now_iso(), role_id),
    )
    rev = bump_permission_revision(conn)
    if impact["removed"]:
        _terminate(conn, settings_of(request), {u["id"] for u in impact["users"]})
    audit(conn, actor=principal, action="rbac.role.update", decision="allowed", resource_type="role", resource_id=role_id, request_id=_rid(request),
          details={"added": impact["added"], "removed": impact["removed"], "affected_users": len(impact["users"]), "affected_bindings": impact["bindings"], "delegable": body.delegable, "revision": rev})
    return {**_custom_role_dict(conn, conn.execute("SELECT * FROM custom_roles WHERE id = ?", (role_id,)).fetchone()), "impact": impact}


@router.delete("/access/roles/{role_id}")
def delete_custom_role(role_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "rbac.roles.manage", INSTALLATION)
    if role_id in ROLES:
        raise ApiError(409, "builtin_role", "תפקידים מובנים אינם נמחקים.")
    r = conn.execute("SELECT * FROM custom_roles WHERE id = ? AND deleted_at IS NULL", (role_id,)).fetchone()
    if not r:
        raise ApiError(404, "not_found", "התפקיד לא נמצא.")
    impact = _role_impact(conn, role_id, [])
    if impact["bindings"]:
        raise ApiError(409, "role_in_use", "התפקיד עדיין משויך; בטל את השיוכים קודם.", details={"bindings": impact["bindings"], "users": impact["users"], "groups": impact["groups"]})
    conn.execute("UPDATE custom_roles SET deleted_at = ?, updated_by = ?, updated_by_username = ? WHERE id = ?", (now_iso(), principal.user_id, principal.username, role_id))
    rev = bump_permission_revision(conn)
    audit(conn, actor=principal, action="rbac.role.delete", decision="allowed", resource_type="role", resource_id=role_id, request_id=_rid(request), details={"name": r["name_he"], "revision": rev})
    return {"deleted": role_id, "revision": rev}


@router.get("/access/delegation")
def get_delegation(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "identity.directory.read", INSTALLATION)
    return {"delegable_roles": delegable_roles(conn), "default": DEFAULT_DELEGABLE, "rules": ["מנהל אתר משייך רק תפקידים מרשימה זו", "רק הרשאות שהוא מחזיק באותו היקף", "משתמשים בלבד, לא קבוצות", "בתוך היקף השיוך שלו בלבד", "אין שינוי של תפקידים גלובליים ואין בקשות מרובות"]}


@router.put("/access/delegation")
def set_delegation(body: DelegationBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "rbac.roles.manage", INSTALLATION)
    known = all_roles(conn)
    chosen = sorted({r for r in body.delegable_roles if r in known})
    blocked = [r for r in chosen if set(known[r]) & SYSTEM_PERMISSIONS]
    if blocked:
        raise ApiError(422, "system_role_not_delegable", "תפקיד עם הרשאות מערכת אינו ניתן להאצלה.", details={"blocked": blocked})
    before = delegable_roles(conn)
    set_setting(conn, "rbac.delegable_roles", json.dumps(chosen))
    rev = bump_permission_revision(conn)
    audit(conn, actor=principal, action="rbac.delegation.update", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request), details={"before": before, "after": delegable_roles(conn), "revision": rev})
    return {"delegable_roles": delegable_roles(conn), "revision": rev}
