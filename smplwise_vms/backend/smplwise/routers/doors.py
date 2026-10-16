"""WisKey door administration (CR-033 slices D1, D2, D3, D4) - Settings only; operator screens show nothing new.

- Door map (D1, owner decision 18): `GET /intercom/door-map`, `PUT|DELETE /intercom/door-map/{entity_id}`,
  `POST /intercom/door-map/apply-suggestions` - system administrator (`system.configure`), audited `intercom.door.mapped`.
- Station placement (D2, decision 14): `PUT /intercom/stations/{station_id}/placement` - system administrator, audited
  `intercom.station.placed`; it moves the permission revision (a placement widens or narrows who a site / building binding
  covers).
- Door opening grants (D3, decision 13: "anyone I choose, not too complicated"): `GET /access/door-grants`,
  `POST /access/door-grants/subjects` (one switch per user / group: a `door_opener` binding at installation scope that this
  card created, or revoking exactly those), `PUT /access/door-grants/roles/{role_id}` (one switch per CUSTOM role: adds
  `access.doors.open` to its sensitive list, or removes it together with its legacy name `access.release` - WXPERM: switching
  door opening off must not leave the legacy grant behind). Built-in roles are shown read-only and are never changed here.
- The trusted path flag (D4): `GET|PUT /doors/settings` - `doors.trusted_path`, system administrator, confirmation,
  audited `settings.changed`; it cannot be switched on while no bridge offers the signed door_open.
- Door status (D4): `POST /doors/requests/{request_id}/status` - the read-only `door_open_status` of an open whose outcome
  is unknown, by the person who sent it (or a system administrator). Signed mode only.
- Door-path inventory (D7, decision 15): `GET /intercom/door-path-inventory` - READ ONLY, system administrator: every
  saved item that opens a WisKey door (services/door_path.py), by name only. No call, no write, no conversion.
- Blocks (WXUNBLK, owner 2026-10-13): `GET /doors/blocks` (read only) lists what the door path blocks - the script-backed
  (template / universal) entities and the saved items it refuses to run or enable - and `PUT /doors/blocks/entities/{entity_id}`
  releases ONE such entity by hand (a note is required) or blocks it again. System administrator (`system.configure`),
  confirmation, audited `intercom.door.entity_unblocked` / `intercom.door.entity_reblocked` (who, when, why). The release applies
  to that entity only: an item with a real WisKey door step stays refused (services/door_overrides.py, door_blocks.py).

Every switch carries an explicit `confirmed: true` from the client's confirmation step (never supplied by the server)."""
from __future__ import annotations

import json
import re
import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, Path, Request
from pydantic import BaseModel, Field, StrictBool, StrictInt

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..db import bump_permission_revision, get_setting, now_iso, set_setting
from ..errors import ApiError
from ..rbac import INSTALLATION, ROLES, STATION, Principal, authorize, require, role_name, role_permissions, scope_name
from ..services import door_authority, door_blocks, door_overrides, door_path, door_path_guard, ha_bridge, intercom_doors, intercom_sync, revocation, trusted_door
from . import access as acc

router = APIRouter()

CONFIGURE = "system.configure"
DOOR_ROLE = "door_opener"
DOOR_OPEN = door_authority.DOOR_OPEN  # WXPERM: the door-only permission
RELEASE = door_authority.RELEASE  # its legacy name (rbac.LEGACY_PERMISSIONS)
DOOR_GRANTS = (DOOR_OPEN, RELEASE)  # a custom role's own list "includes door opening" when it names either
MAX_ID = 128
REQUEST_ID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _confirmed(value: Any) -> None:
    if value is not True:
        raise ApiError(409, "confirmation_required", "השינוי דורש אישור מפורש.")


# ---------------------------------------------------------------- door map + station placement (D1, D2)

def _station_view(conn: sqlite3.Connection, s: dict[str, Any]) -> dict[str, Any]:
    placement = intercom_doors.placement_of(conn, s["id"])
    return {
        "id": s["id"],
        "name": s.get("name") or "",
        "online": bool(s.get("online")),
        "relays": [{"physical_index": int(lk["physical_index"]), "name": lk.get("name")} for lk in (s.get("locks") or []) if s.get("lock_enabled")],
        "placement": {"site_id": placement["site_id"], "building_id": placement["building_id"]} if placement else None,
    }


@router.get("/intercom/door-map")
def door_map(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Every WisKey lock entity with its mapping (and whether it resolves right now), the `single_relay` suggestion for
    the unambiguous ones, the stations of the WisKey copy with their relays and placement, and the sites and buildings a
    station may be placed under. Names only on screen; ids are keys."""
    require(conn, principal, CONFIGURE, INSTALLATION)
    state, overview = intercom_sync.SYNC.served(settings_of(request))
    stations = {s["id"]: s for s in intercom_sync.SYNC.stations()}
    suggestions = intercom_doors.suggestions(conn)
    rows = {r["entity_id"]: r for r in intercom_doors.map_rows(conn)}
    locks = []
    for e in intercom_doors.wiskey_locks(conn):
        row = rows.get(e["entity_id"])
        mapping = None
        if row is not None:
            problem = intercom_doors.row_valid(conn, row, e["config_entry_id"])
            station = stations.get(row["config_entry_id"])
            mapping = {"station_id": row["config_entry_id"], "station_name": station["name"] if station else None, "relay": int(row["physical_index"]),
                       "source": row["source"], "mapped_at": row["mapped_at"], "valid": problem is None, "problem": problem}
        sug = suggestions.get(e["entity_id"])
        locks.append({
            "entity_id": e["entity_id"], "name": e["name"] or e["entity_id"], "removed": bool(e["removed_at"]), "disabled": bool(e["disabled"]),
            "station_id": e["config_entry_id"] if e["config_entry_id"] in stations else None,
            "mapping": mapping,
            "suggestion": {"station_id": sug.station_id, "relay": sug.relay} if sug else None,
        })
    sites = [{"id": s["id"], "name": s["name"]} for s in conn.execute("SELECT id, name FROM sites WHERE deleted_at IS NULL ORDER BY sort_order, name").fetchall()]
    buildings = [{"id": b["id"], "site_id": b["site_id"], "name": b["name"]} for b in conn.execute("SELECT id, site_id, name FROM buildings WHERE deleted_at IS NULL ORDER BY sort_order, name").fetchall()]
    return {"state": state, "has_copy": overview is not None, "stations": [_station_view(conn, s) for s in stations.values()], "locks": locks, "sites": sites, "buildings": buildings}


class MappingBody(BaseModel):
    station_id: str = Field(min_length=1, max_length=MAX_ID)
    relay: StrictInt = Field(ge=1, le=64)
    confirmed: Any = None


@router.put("/intercom/door-map/{entity_id}")
def set_door_mapping(body: MappingBody, request: Request, entity_id: str = Path(min_length=3, max_length=255), principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Manual mapping (`source = manual`): the administrator picks the relay of one WisKey lock entity."""
    require(conn, principal, CONFIGURE, INSTALLATION)
    _confirmed(body.confirmed)
    before = intercom_doors.map_row(conn, entity_id)
    row = intercom_doors.set_mapping(conn, entity_id, body.station_id, body.relay, "manual", principal.user_id)
    audit(conn, actor=principal, action="intercom.door.mapped", decision="allowed", resource_type="ha_entity", resource_id=entity_id, request_id=_rid(request),
          details={"station": body.station_id, "relay": body.relay, "source": "manual", "replaced": before is not None})
    return {"mapping": row}


@router.delete("/intercom/door-map/{entity_id}")
def clear_door_mapping(request: Request, entity_id: str = Path(min_length=3, max_length=255), principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, CONFIGURE, INSTALLATION)
    removed = intercom_doors.clear_mapping(conn, entity_id)
    audit(conn, actor=principal, action="intercom.door.unmapped", decision="allowed", resource_type="ha_entity", resource_id=entity_id, request_id=_rid(request), details={"removed": removed})
    return {"removed": removed}


class ConfirmBody(BaseModel):
    confirmed: Any = None


@router.post("/intercom/door-map/apply-suggestions")
def apply_suggestions(body: ConfirmBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Store every current `single_relay` suggestion (unambiguous: one relay, one WisKey lock entity on that station)."""
    require(conn, principal, CONFIGURE, INSTALLATION)
    _confirmed(body.confirmed)
    applied = []
    for entity_id, target in intercom_doors.suggestions(conn).items():
        intercom_doors.set_mapping(conn, entity_id, target.station_id, target.relay, "single_relay", principal.user_id)
        audit(conn, actor=principal, action="intercom.door.mapped", decision="allowed", resource_type="ha_entity", resource_id=entity_id, request_id=_rid(request),
              details={"station": target.station_id, "relay": target.relay, "source": "single_relay"})
        applied.append(entity_id)
    return {"applied": applied}


class PlacementBody(BaseModel):
    site_id: str | None = Field(default=None, max_length=200)
    building_id: str | None = Field(default=None, max_length=200)
    confirmed: Any = None


@router.put("/intercom/stations/{station_id}/placement")
def place_station(body: PlacementBody, request: Request, station_id: str = Path(min_length=1, max_length=MAX_ID), principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Place a station under a building or a site (or nowhere: installation bindings only)."""
    require(conn, principal, CONFIGURE, INSTALLATION)
    _confirmed(body.confirmed)
    if not intercom_doors.station_known(conn, station_id):
        raise ApiError(404, "intercom_station_not_found", "העמדה לא נמצאה.")
    before = intercom_doors.placement_of(conn, station_id)
    row = intercom_doors.set_placement(conn, station_id, body.site_id, body.building_id, principal.user_id)
    rev = bump_permission_revision(conn)
    audit(conn, actor=principal, action="intercom.station.placed", decision="allowed", resource_type=STATION, resource_id=station_id, request_id=_rid(request),
          details={"site_id": row["site_id"] if row else None, "building_id": row["building_id"] if row else None,
                   "before": {"site_id": before["site_id"], "building_id": before["building_id"]} if before else None, "revision": rev})
    return {"placement": {"site_id": row["site_id"], "building_id": row["building_id"]} if row else None, "scope_name": scope_name(conn, STATION, station_id)}


# ---------------------------------------------------------------- door opening grants (D3)

def _card_bindings(conn: sqlite3.Connection) -> set[str]:
    try:
        return {r[0] for r in conn.execute("SELECT binding_id FROM door_grant_bindings").fetchall()}
    except sqlite3.OperationalError:
        return set()


def _may_manage_subjects(conn: sqlite3.Connection, principal: Principal) -> bool:
    """The user / group switches: full RBAC authority, or a delegated administrator when door_opener is on the delegation
    allow-list (each switch then goes through the existing delegation checks)."""
    return acc.full_authority(conn, principal) or (acc.assigns_anywhere(conn, principal) and DOOR_ROLE in acc.delegable_roles(conn))


def _builtin_answer(role_id: str, perms: list[str]) -> str:
    if role_id in ("viewer", "kiosk"):
        return "never"
    return "yes" if DOOR_OPEN in perms else "per_user"


@router.get("/access/door-grants")
def door_grants(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The "פתיחת דלתות" card: per user and group whether this card granted door opening (`granted`), and the other
    bindings that also let them open (listed read-only as "שיוך אחר"); per role whether it includes door opening, custom
    roles switchable, built-in roles read-only."""
    can_roles = authorize(conn, principal, "rbac.roles.manage", INSTALLATION).allowed
    can_subjects = _may_manage_subjects(conn, principal)
    if not can_roles and not can_subjects:
        require(conn, principal, "rbac.roles.manage", INSTALLATION)  # the audited 403
    card = _card_bindings(conn)
    now = now_iso()
    active = conn.execute(acc._active_bindings_sql("AND effect = 'allow'"), (now,)).fetchall()
    by_subject: dict[tuple[str, str], list[sqlite3.Row]] = {}
    for b in active:
        by_subject.setdefault((b["subject_kind"], b["subject_id"]), []).append(b)
    full = acc.full_authority(conn, principal)

    def subject_row(kind: str, sid: str, name: str, is_active: bool) -> dict[str, Any]:
        mine, other = [], []
        for b in by_subject.get((kind, sid), []):
            if b["id"] in card and b["role_id"] == DOOR_ROLE:
                mine.append(b["id"])
            elif DOOR_OPEN in role_permissions(conn, b["role_id"]):  # expanded: a legacy access.release role counts too
                if full or acc.delegated_sees(conn, principal, b):
                    other.append({"binding_id": b["id"], "role_name": role_name(conn, b["role_id"]), "scope_name": scope_name(conn, b["scope_type"], b["scope_id"])})
        return {"kind": kind, "id": sid, "name": name, "active": is_active, "granted": bool(mine), "other": other}

    users = []
    for u in acc._users(conn, principal):
        if not full and not u["active"]:
            continue
        if door_authority.is_wall_account(conn, u["id"]):
            continue  # SEC-WXD L1: a wall display is not offered as a person who opens doors (the door rule refuses it anyway)
        users.append(subject_row("user", u["id"], u["name"], bool(u["active"])))
    groups = [subject_row("group", g["id"], g["name"], True) for g in conn.execute("SELECT id, name FROM groups ORDER BY name").fetchall()]
    if not full:
        reach = {g["id"] for g in groups if acc.delegated_group_problem(conn, principal, g["id"]) is None}
        groups = [g for g in groups if g["id"] in reach]
    roles = []
    for rid, perms in ROLES.items():
        if rid == DOOR_ROLE:
            continue
        roles.append({"id": rid, "name": role_name(conn, rid), "custom": False, "includes": DOOR_OPEN in perms, "editable": False, "answer": _builtin_answer(rid, perms)})  # CR-038 D33: names rendered
    for r in conn.execute("SELECT id, name_he, sensitive_json, delegable, revision FROM custom_roles WHERE deleted_at IS NULL ORDER BY created_at").fetchall():
        sens = json.loads(r["sensitive_json"] or "[]")
        roles.append({"id": r["id"], "name": r["name_he"], "custom": True, "includes": any(p in sens for p in DOOR_GRANTS), "editable": can_roles, "delegable": bool(r["delegable"]), "revision": r["revision"]})
    return {"users": users, "groups": groups, "roles": roles if can_roles else [], "can_manage_roles": can_roles, "can_manage_subjects": can_subjects, "delegated": not full}


class SubjectSwitch(BaseModel):
    subject_kind: Literal["user", "group"]
    subject_id: str = Field(min_length=1, max_length=200)
    enabled: StrictBool
    confirmed: Any = None


@router.post("/access/door-grants/subjects")
def switch_subject(body: SubjectSwitch, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """On: one `door_opener` binding at installation scope ("כל הדלתות"), through the same checks as any binding (delegation,
    known subject, no duplicate) and recorded as this card's. Off: revoke exactly the door_opener bindings this card
    created for the subject; bindings made elsewhere stay."""
    if not _may_manage_subjects(conn, principal):
        require(conn, principal, "rbac.roles.manage", INSTALLATION)
    _confirmed(body.confirmed)
    card = _card_bindings(conn)
    now = now_iso()
    mine = [b for b in conn.execute(acc._active_bindings_sql("AND subject_kind = ? AND subject_id = ? AND role_id = ?"), (now, body.subject_kind, body.subject_id, DOOR_ROLE)).fetchall() if b["id"] in card]
    if body.enabled:
        if mine:
            return {"granted": True, "binding_id": mine[0]["id"], "revision": int(get_setting(conn, "permission_revision", "1") or 1)}
        if body.subject_kind == "user" and door_authority.is_wall_account(conn, body.subject_id):
            # SEC-WXD L1: never a door grant for a wall display (CR-033 4.1 step 1 refuses it at the door anyway)
            raise ApiError(422, "wall_account", "מסך קיר אינו מקבל הרשאה לפתיחת דלתות.")
        bb = acc.BindingBody(subject_kind=body.subject_kind, subject_id=body.subject_id, role_id=DOOR_ROLE, scope_type="installation", scope_id="*")
        acc.validate_binding(conn, principal, bb, request)
        bid, rev = acc.insert_binding(conn, principal, request, bb, extra_audit={"via": "door_grants_card"})
        conn.execute("INSERT INTO door_grant_bindings(binding_id, created_at) VALUES (?, ?)", (bid, now_iso()))
        revocation.changed(acc.affected_users(conn, body.subject_kind, body.subject_id))
        return {"granted": True, "binding_id": bid, "revision": rev}
    rev = None
    for b in mine:
        rev = acc.revoke_one(conn, principal, request, b)
    if mine:
        acc._terminate(conn, settings_of(request), acc.affected_users(conn, body.subject_kind, body.subject_id))
    return {"granted": False, "revoked": [b["id"] for b in mine], "revision": rev}


class RoleSwitch(BaseModel):
    enabled: StrictBool
    revision: StrictInt = Field(ge=1)
    confirmed: Any = None


@router.put("/access/door-grants/roles/{role_id}")
def switch_role(role_id: str, body: RoleSwitch, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Add `access.doors.open` to a CUSTOM role's sensitive list, or remove it AND its legacy name `access.release` (the role's
    revision and the permission revision move, as any role edit). Built-in roles are never changed by a setting (owner
    default for open question 1)."""
    require(conn, principal, "rbac.roles.manage", INSTALLATION)
    _confirmed(body.confirmed)
    if role_id in ROLES:
        raise ApiError(409, "builtin_role", "תפקידים מובנים אינם משתנים כאן; אפשר לתת למשתמשים בנפרד.")
    r = conn.execute("SELECT * FROM custom_roles WHERE id = ? AND deleted_at IS NULL", (role_id,)).fetchone()
    if not r:
        raise ApiError(404, "not_found", "התפקיד לא נמצא.")
    if body.revision != r["revision"]:
        raise ApiError(409, "stale_revision", "התפקיד השתנה בינתיים; טען מחדש.", details={"current_revision": r["revision"]})
    perms = json.loads(r["permissions_json"])
    sens = set(json.loads(r["sensitive_json"] or "[]"))
    if body.enabled:
        if r["delegable"]:
            raise ApiError(422, "sensitive_role_not_delegable", "תפקיד שניתן להאצלה אינו יכול לכלול פתיחת דלתות; בטלו קודם את ההאצלה שלו.")
        if not sens & set(DOOR_GRANTS):  # a legacy access.release already opens doors: nothing to add
            sens.add(DOOR_OPEN)
    else:
        sens.difference_update(DOOR_GRANTS)
    if not perms and not sens:
        raise ApiError(422, "validation", "תפקיד חייב לכלול לפחות הרשאה אחת.")
    new_sens = sorted(sens)
    impact = acc._role_impact(conn, role_id, sorted(set(perms) | set(new_sens)))
    if not impact["added"] and not impact["removed"]:
        return {"id": role_id, "includes": body.enabled, "revision": r["revision"]}
    conn.execute("UPDATE custom_roles SET sensitive_json = ?, revision = revision + 1, updated_by = ?, updated_by_username = ?, updated_at = ? WHERE id = ?",
                 (json.dumps(new_sens), principal.user_id, principal.username, now_iso(), role_id))
    rev = bump_permission_revision(conn)
    if impact["removed"]:
        acc._terminate(conn, settings_of(request), {u["id"] for u in impact["users"]})
    else:
        revocation.changed({u["id"] for u in impact["users"]})
    audit(conn, actor=principal, action="rbac.role.update", decision="allowed", resource_type="role", resource_id=role_id, request_id=_rid(request),
          details={"added": impact["added"], "removed": impact["removed"], "affected_users": len(impact["users"]), "affected_bindings": impact["bindings"], "via": "door_grants_card", "revision": rev})
    row = conn.execute("SELECT revision FROM custom_roles WHERE id = ?", (role_id,)).fetchone()
    return {"id": role_id, "includes": body.enabled, "revision": row["revision"], "permission_revision": rev}


# ---------------------------------------------------------------- the trusted path flag and the status read (D4)

def _settings_view(conn: sqlite3.Connection) -> dict[str, Any]:
    return {"trusted_path": trusted_door.mode(conn), "trusted_path_available": trusted_door.trusted_path_available(conn),
            "editor_block": door_path_guard.editor_mode(conn), "editor_allowed_available": door_path_guard.ALLOWED_SELECTABLE,
            "lock_jobs": door_path_guard.wiskey_lock_jobs(conn)}


@router.get("/doors/settings")
def door_settings(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, CONFIGURE, INSTALLATION)
    return _settings_view(conn)


class DoorSettingsBody(BaseModel):
    trusted_path: Literal["off", "on"] | None = None
    editor_block: Literal["blocked", "allowed"] | None = None
    confirmed: Any = None


@router.put("/doors/settings")
def set_door_settings(body: DoorSettingsBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """`doors.trusted_path`: `off` (default; the interim transport) or `on` (the signed door_open only). Switching on is an
    owner-approved step and is refused while no bridge offering door_open is known (fail closed).
    `doors.editor_block` (CR-033 D8): `blocked` (default) or `allowed`; `allowed` is refused until new door steps can be stored
    as Arx door steps (D10a). Either key may be sent alone."""
    require(conn, principal, CONFIGURE, INSTALLATION)
    _confirmed(body.confirmed)
    if body.trusted_path is None and body.editor_block is None:
        raise ApiError(422, "validation", "לא נשלחה הגדרה לשינוי.")
    if body.trusted_path is not None:
        before = trusted_door.mode(conn)
        if body.trusted_path == "on" and not trusted_door.trusted_path_available(conn):
            audit(conn, actor=principal, action="settings.changed", decision="denied", resource_type="installation", resource_id="*", request_id=_rid(request),
                  reason="trusted_path_unavailable", details={"key": trusted_door.FLAG_KEY, "requested": "on"})
            raise ApiError(409, "trusted_path_unavailable", "נתיב פתיחה מאובטח עדיין אינו זמין בגשר.")
        if body.trusted_path != before:
            set_setting(conn, trusted_door.FLAG_KEY, body.trusted_path)
            audit(conn, actor=principal, action="settings.changed", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request),
                  details={"key": trusted_door.FLAG_KEY, "before": before, "after": body.trusted_path})
    if body.editor_block is not None:
        before = door_path_guard.editor_mode(conn)
        if body.editor_block == "allowed" and not door_path_guard.ALLOWED_SELECTABLE:
            audit(conn, actor=principal, action="settings.changed", decision="denied", resource_type="installation", resource_id="*", request_id=_rid(request),
                  reason="editor_allowed_unavailable", details={"key": door_path_guard.EDITOR_KEY, "requested": "allowed"})
            raise ApiError(409, "editor_allowed_unavailable", "יתאפשר לאחר השלמת הסבת הפריטים.")
        if body.editor_block != before:
            set_setting(conn, door_path_guard.EDITOR_KEY, body.editor_block)
            audit(conn, actor=principal, action="settings.changed", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request),
                  details={"key": door_path_guard.EDITOR_KEY, "before": before, "after": body.editor_block})
    return _settings_view(conn)


@router.post("/doors/requests/{request_id}/status")
def door_status(request: Request, request_id: str = Path(min_length=36, max_length=36), principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The read-only `door_open_status` of one open (decision DR-11: an unknown outcome is resolved only by reading, never by
    signing the open again). Only the person whose open it was, or a system administrator; signed mode only - the interim
    transport has no status read."""
    if not REQUEST_ID.fullmatch(request_id):
        raise ApiError(422, "validation", "מזהה הבקשה אינו תקין.")
    row = conn.execute(
        "SELECT actor_user_id, details_json FROM audit_log WHERE action = 'intercom.release' AND details_json LIKE ? AND details_json LIKE ? ORDER BY rowid LIMIT 1",
        (f'%"door_request_id": "{request_id}"%', '%"phase": "attempt"%'),
    ).fetchone()
    if row is None:
        raise ApiError(404, "not_found", "הבקשה לא נמצאה.")
    if row["actor_user_id"] != principal.user_id:
        require(conn, principal, CONFIGURE, INSTALLATION)
    details = json.loads(row["details_json"] or "{}")
    if details.get("mode") != "signed" or trusted_door.mode(conn) != "on":
        raise ApiError(409, "door_status_unavailable", "בדיקת מצב אינה זמינה לפקודה הזו.")
    secret = ha_bridge.signing_key(conn)
    if not secret:
        raise ApiError(503, "bridge_not_paired", "אין חיבור לתשתית המערכת")
    trusted_door.status_rate(principal.user_id)  # SEC-WXD I7: a read, but it signs and calls the bridge
    p = principal
    signed = trusted_door.sign_message(secret, "door_open_status", p.user_id, trusted_door.actor_name(p), str(details.get("station") or ""),
                                       {"target_request_id": request_id}, trusted_door.new_request_id())
    audit(conn, actor=principal, action="intercom.release.status", decision="allowed", resource_type=STATION, resource_id=str(details.get("station") or ""), request_id=_rid(request),
          details={"door_request_id": request_id, "status_request_id": signed.request_id, "body_sha256": signed.body_sha256})
    from ..db import unlocked

    with unlocked(conn):
        answer = trusted_door.call_bridge(settings_of(request), "door_open_status", signed.text)
    outcome, code = trusted_door.classify(answer, signed.request_id)
    return {"door_request_id": request_id, "outcome": outcome, "code": code, "text": trusted_door.OUTCOME_TEXT.get(outcome, "")}


# ---------------------------------------------------------------- the read-only door-path inventory (D7)

@router.get("/intercom/door-path-inventory")
def door_path_inventory(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """"פריטים שפותחים דלתות": the automations, scripts, scenes, schedules and home-screen launcher buttons whose steps open
    a WisKey door (directly or through a group, an area, a device or a nested script / scene / automation, resolved
    statically), or may open one (a step that cannot be resolved), with origin, author, approver, state, last run, what an
    Arx-started run does now and a conversion suggestion. Read-only over Arx's own database: nothing is converted,
    disabled or sent. Names only - no entity ids, station ids or addresses."""
    require(conn, principal, CONFIGURE, INSTALLATION)
    return door_path.inventory(conn, dev_mode=bool(settings_of(request).dev_user))


# ---------------------------------------------------------------- the blocks screen: what the door path blocks, and the one release (WXUNBLK)

@router.get("/doors/blocks")
def door_blocks_list(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """"חסימות פתיחת דלתות": the entities the door path blocks (template / universal ones, while a WisKey door exists) with their
    state - blocked, or released by an administrator (why, who, when) - and the saved automations, scripts, scenes, schedules and
    launcher buttons it refuses to run or enable, each with the reason (a real door step, or only virtual devices). Read only over
    Arx's own mirror: nothing is called, released or sent. System administrator only."""
    require(conn, principal, CONFIGURE, INSTALLATION)
    return door_blocks.listing(conn, dev_mode=bool(settings_of(request).dev_user))


class EntityBlockBody(BaseModel):
    unblocked: StrictBool
    note: str | None = Field(default=None, max_length=2000)
    confirmed: Any = None


@router.put("/doors/blocks/entities/{entity_id}")
def set_entity_block(body: EntityBlockBody, request: Request, entity_id: str = Path(min_length=3, max_length=255), principal: Principal = Depends(current_principal),
                     conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Release ONE blocked entity (`unblocked: true`, with a note saying why - required) or block it again (`unblocked: false`).
    Explicit, audited (`intercom.door.entity_unblocked` / `intercom.door.entity_reblocked`: who, when, why) and reversible. It
    changes how the guards judge THIS entity and nothing else: an item with a real WisKey door step stays refused, a WisKey lock
    or an entity mapped to an intercom door is never released, and `execute` for a WisKey door stays blocked. Only a script-backed
    (template / universal) entity is accepted, and only while a WisKey door exists."""
    require(conn, principal, CONFIGURE, INSTALLATION)
    _confirmed(body.confirmed)
    if not door_overrides.ENTITY_ID.fullmatch(entity_id):
        raise door_blocks.note_error("bad_entity")
    current = door_overrides.read(conn).get(entity_id)
    r = door_path.Resolver(conn, ignore_overrides=True)
    ent = r.entity(entity_id) or {}
    facts = {"domain": ent.get("domain") or entity_id.split(".", 1)[0], "platform": ent.get("platform")}
    who = principal.username or principal.display_name or principal.user_id
    if body.unblocked:
        reason = door_blocks.releasable(conn, r, entity_id)
        if reason is not None:
            audit(conn, actor=principal, action="intercom.door.entity_unblocked", decision="denied", resource_type="ha_entity", resource_id=entity_id, request_id=_rid(request),
                  reason=reason, details=facts)
            raise door_blocks.refusal(reason)
        try:
            entry = door_overrides.release(conn, entity_id, note=body.note or "", by=principal.user_id, by_name=who)
        except door_overrides.OverrideError as exc:
            audit(conn, actor=principal, action="intercom.door.entity_unblocked", decision="denied", resource_type="ha_entity", resource_id=entity_id, request_id=_rid(request),
                  reason=exc.code, details=facts)
            raise door_blocks.note_error(exc.code) from None
        audit(conn, actor=principal, action="intercom.door.entity_unblocked", decision="allowed", resource_type="ha_entity", resource_id=entity_id, request_id=_rid(request),
              details={**facts, "note": entry.note, "replaced": current is not None, **({"previous_note": current.note, "previous_by": current.by} if current else {})})
        return {"entity_id": entity_id, "state": "unblocked", "override": entry.public(), "changed": True}
    removed = door_overrides.reblock(conn, entity_id)
    if removed is None:
        return {"entity_id": entity_id, "state": "blocked", "override": None, "changed": False}
    why = door_overrides.clean_note(body.note)[: door_overrides.NOTE_MAX]
    audit(conn, actor=principal, action="intercom.door.entity_reblocked", decision="allowed", resource_type="ha_entity", resource_id=entity_id, request_id=_rid(request),
          details={**facts, "released_note": removed.note, "released_by": removed.by, "released_at": removed.at, **({"note": why} if why else {})})
    return {"entity_id": entity_id, "state": "blocked", "override": None, "changed": True}
