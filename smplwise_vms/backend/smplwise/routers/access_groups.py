"""VMS groups, the group impact preview and the all-or-nothing bulk routes (T082, R163/R164; security spec
docs/security/HA_IDENTITY_RBAC_HE.md §5-§7 and "Groups and delegation").

A group is a named set of HA users local to this installation. Role bindings on a group (role + scope) are inherited
by every member: effective permissions are the union of the user's own bindings and those of their groups, each still
evaluated as a (permission, scope) pair (rbac.authorize - nothing is unioned across scopes).

Who may do what:
- create / rename / delete a group: rbac.roles.manage installation-wide (the task's "rbac.manage"; a VMS system
  administrator). Delete is refused while the group still has members or bindings (the role-delete rule).
- membership and the group's bindings: rbac.assign on every scope involved. A delegated administrator (a site_admin,
  see routers/access.full_authority) only for a group whose bindings all lie in their reach, never a group they belong
  to, never adding or removing themselves (routers/access.check_delegation / group_reach_problem).
- every change bumps the group's revision; rename, membership and the group-binding routes carry the revision the
  client saw and a stale one is a 409 (the custom-role guard).

Bulk (membership replacement, POST /access/bindings/bulk): the permission gate runs before the body is read (an
unauthorised caller gets an audited 403, never a 422 for a body it was not entitled to send), JSON only (415), a byte
cap (413) and an item cap; every item passes the same checks as the single route, and the first refused item refuses
the whole request (nothing written; its index and id in `details`). Audit rows carry ids only."""
from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from typing import Any, Iterator, Literal

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..db import bump_permission_revision, new_id, now_iso
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, all_roles, authorize, effective_permissions, require, scope_name
from ..services import revocation
from .access import (
    PERMISSION_LABELS, BindingBody, active_user_ids, keep_an_admin, _active_bindings_sql, _binding_dict, _ensure_user_row, _group_members, _rid, _scope_exists,
    _subject_name, _terminate, affected_users, assigns_anywhere, check_delegation, full_authority,
    delegated_group_problem, insert_binding, revoke_one, touch_group, user_known, validate_binding,
)

router = APIRouter()

BULK_MAX_BYTES = 64 * 1024
BULK_MAX_BINDINGS = 50
MAX_MEMBERS = 500


# ---------------------------------------------------------------- envelope: permission before body, JSON only, caps

def _assign_holder(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Principal:
    """rbac.assign at some scope, checked before the body is looked at; the refusal is audited by require()."""
    if not assigns_anywhere(conn, principal):
        require(conn, principal, "rbac.assign", INSTALLATION)
    return principal


def _assign_gate_ro(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Principal:
    """The same gate on a READ connection, for the raw-body routes: the body is streamed after it and only then is the
    write transaction (BEGIN IMMEDIATE) opened - a slow upload never holds SQLite's single write lock (security review
    T082). The refusal is still audited (require() writes aside in read mode)."""
    if not assigns_anywhere(conn, principal):
        require(conn, principal, "rbac.assign", INSTALLATION)
    return principal


def _manager(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Principal:
    """rbac.roles.manage installation-wide (group lifecycle), before the body."""
    require(conn, principal, "rbac.roles.manage", INSTALLATION)
    return principal


async def _capped_body(request: Request) -> bytes:
    """The raw body, read only after the permission dependency, never more than BULK_MAX_BYTES."""
    declared = request.headers.get("content-length") or ""
    if declared.isdigit() and int(declared) > BULK_MAX_BYTES:
        raise ApiError(413, "payload_too_large", f"הבקשה גדולה מ־{BULK_MAX_BYTES // 1024} KB.")
    data = bytearray()
    async for chunk in request.stream():
        data += chunk
        if len(data) > BULK_MAX_BYTES:
            raise ApiError(413, "payload_too_large", f"הבקשה גדולה מ־{BULK_MAX_BYTES // 1024} KB.")
    return bytes(data)


def _is_json(content_type: str | None) -> bool:
    media = (content_type or "").split(";", 1)[0].strip().lower()
    return media == "application/json" or (media.startswith("application/") and media.endswith("+json"))


def _parse(request: Request, raw: bytes, model: type[BaseModel]) -> Any:
    if not _is_json(request.headers.get("content-type")):
        raise ApiError(415, "unsupported_media_type", "הבקשה חייבת להישלח כ־JSON (Content-Type: application/json).", details={"content_type": (request.headers.get("content-type") or "")[:100]})
    try:
        data = json.loads(raw) if raw.strip() else {}
    except (ValueError, RecursionError):
        raise ApiError(422, "validation", "גוף הבקשה אינו JSON תקין.", details={"fields": ["body"]}) from None
    try:
        return model.model_validate(data)
    except ValidationError as exc:
        fields = sorted({".".join(str(p) for p in err["loc"]) or "body" for err in exc.errors()})
        raise ApiError(422, "validation", "הבקשה אינה תקינה: " + ", ".join(fields), details={"fields": fields}) from None


@contextmanager
def _all_or_nothing(conn: sqlite3.Connection) -> Iterator[None]:
    """A savepoint around the writes of one request: any exception - an ApiError included, which the request
    transaction would otherwise COMMIT to keep refusal audit rows - rolls every write of the block back."""
    conn.execute("SAVEPOINT t082_all_or_nothing")
    try:
        yield
    except BaseException:
        conn.execute("ROLLBACK TO t082_all_or_nothing")
        conn.execute("RELEASE t082_all_or_nothing")
        raise
    conn.execute("RELEASE t082_all_or_nothing")


def _item_refusal(exc: ApiError, index: int, item_id: str, kind: str) -> ApiError:
    exc.details = {**(exc.details or {}), "item_index": index, "item_id": item_id, "item_kind": kind, "outcome": "nothing_written"}
    return exc


# ---------------------------------------------------------------- shaping

def _group_row(conn: sqlite3.Connection, group_id: str) -> sqlite3.Row:
    g = conn.execute("SELECT * FROM groups WHERE id = ?", (group_id,)).fetchone()
    if not g:
        raise ApiError(404, "group_unknown", "הקבוצה לא נמצאה.")
    return g


def _group_bindings(conn: sqlite3.Connection, group_id: str) -> list[sqlite3.Row]:
    return conn.execute(_active_bindings_sql("AND subject_kind = 'group' AND subject_id = ?"), (now_iso(), group_id)).fetchall()


def _group_dict(conn: sqlite3.Connection, g: sqlite3.Row, principal: Principal | None = None) -> dict[str, Any]:
    members = [{"id": uid, "name": _subject_name(conn, "user", uid)} for uid in _group_members(conn, g["id"])]
    out = {
        "id": g["id"],
        "name": g["name"],
        "created_at": g["created_at"],
        "revision": g["revision"],
        "updated_at": g["updated_at"],
        "members": sorted(members, key=lambda m: m["name"].lower()),
        "bindings": [_binding_dict(conn, b) for b in _group_bindings(conn, g["id"])],
    }
    if principal is not None:
        out["is_member"] = any(m["id"] == principal.user_id for m in members)
    return out


def _check_revision(g: sqlite3.Row, sent: int | None) -> None:
    if sent is not None and int(sent) != int(g["revision"]):
        raise ApiError(409, "stale_revision", "הקבוצה השתנתה בינתיים; טען מחדש.", details={"current_revision": g["revision"], "sent_revision": sent})


def _reach_or_refuse(conn: sqlite3.Connection, principal: Principal, group_id: str, action: str) -> None:
    """Membership of a group: rbac.assign on every scope it is bound to; a delegated administrator only for a group in
    their reach that they are not a member of."""
    if full_authority(conn, principal):
        for b in _group_bindings(conn, group_id):
            require(conn, principal, "rbac.assign", (b["scope_type"], b["scope_id"]))
        return
    problem = delegated_group_problem(conn, principal, group_id)
    if problem and problem["reason"] == "self_member":
        audit(conn, actor=principal, action=action, decision="denied", resource_type="group", resource_id=group_id, reason="delegation_self", details=problem)
        raise ApiError(403, "delegation_self", "מנהל מקומי אינו משנה קבוצה שהוא חבר בה.", details={"group_id": group_id, **problem})
    if problem:
        audit(conn, actor=principal, action=action, decision="denied", resource_type="group", resource_id=group_id, reason="delegation_group_scope", details=problem)
        raise ApiError(403, "delegation_group_scope", "הקבוצה משויכת מחוץ להיקף שבאחריותך (או שאין לה שיוך); רק מנהל המערכת מנהל אותה.", details={"group_id": group_id, **problem})


# ---------------------------------------------------------------- list / lifecycle

@router.get("/access/groups")
def list_groups(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Every group for a holder of identity.directory.read; a delegated administrator sees only the groups in reach."""
    full_dir = authorize(conn, principal, "identity.directory.read", INSTALLATION).allowed
    if not full_dir and not assigns_anywhere(conn, principal):
        require(conn, principal, "identity.directory.read", INSTALLATION)
    rows = conn.execute("SELECT * FROM groups ORDER BY name").fetchall()
    if not full_dir:
        rows = [g for g in rows if delegated_group_problem(conn, principal, g["id"]) is None]
    return {
        "groups": [_group_dict(conn, g, principal) for g in rows],
        "can_manage": authorize(conn, principal, "rbac.roles.manage", INSTALLATION).allowed,
        "delegated": not full_authority(conn, principal),
    }


class GroupBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=80)


class GroupPatch(GroupBody):
    revision: int = Field(ge=1)


def _name_taken(conn: sqlite3.Connection, name: str, except_id: str | None = None) -> bool:
    return conn.execute("SELECT 1 FROM groups WHERE name = ? AND id != ?", (name, except_id or "")).fetchone() is not None


@router.post("/access/groups", status_code=201)
def create_group(body: GroupBody, request: Request, principal: Principal = Depends(_manager), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    name = body.name.strip()
    if not name:
        raise ApiError(422, "validation", "שם הקבוצה ריק.")
    if _name_taken(conn, name):
        raise ApiError(409, "group_exists", "קבוצה בשם הזה כבר קיימת.")
    gid = new_id()
    now = now_iso()
    conn.execute("INSERT INTO groups(id, name, created_at, created_by, revision, updated_at, updated_by) VALUES (?, ?, ?, ?, 1, ?, ?)", (gid, name, now, principal.user_id, now, principal.user_id))
    audit(conn, actor=principal, action="rbac.group_create", decision="allowed", resource_type="group", resource_id=gid, request_id=_rid(request), details={"group_revision": 1})
    return _group_dict(conn, _group_row(conn, gid), principal)


@router.patch("/access/groups/{group_id}")
def rename_group(group_id: str, body: GroupPatch, request: Request, principal: Principal = Depends(_manager), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    g = _group_row(conn, group_id)
    _check_revision(g, body.revision)
    name = body.name.strip()
    if not name:
        raise ApiError(422, "validation", "שם הקבוצה ריק.")
    if _name_taken(conn, name, group_id):
        raise ApiError(409, "group_exists", "קבוצה בשם הזה כבר קיימת.")
    conn.execute("UPDATE groups SET name = ? WHERE id = ?", (name, group_id))
    grev = touch_group(conn, group_id, principal)
    audit(conn, actor=principal, action="rbac.group_rename", decision="allowed", resource_type="group", resource_id=group_id, request_id=_rid(request), details={"group_revision": grev})
    return _group_dict(conn, _group_row(conn, group_id), principal)


@router.delete("/access/groups/{group_id}")
def delete_group(group_id: str, request: Request, revision: int | None = Query(None, ge=1), principal: Principal = Depends(_manager), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Refused while the group has members or active bindings - remove them first (each of those is its own audited,
    previewed change); a deletion therefore never changes anyone's access."""
    g = _group_row(conn, group_id)
    _check_revision(g, revision)
    members = _group_members(conn, group_id)
    bindings = _group_bindings(conn, group_id)
    if members or bindings:
        raise ApiError(409, "group_in_use", "לקבוצה יש עדיין חברים או שיוכים; הסר אותם קודם.", details={"members": len(members), "bindings": len(bindings)})
    conn.execute("DELETE FROM groups WHERE id = ?", (group_id,))
    rev = bump_permission_revision(conn)
    audit(conn, actor=principal, action="rbac.group_delete", decision="allowed", resource_type="group", resource_id=group_id, request_id=_rid(request), details={"group_revision": g["revision"], "revision": rev})
    return {"deleted": group_id, "revision": rev}


# ---------------------------------------------------------------- membership (a bulk request)

class MembersBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    user_ids: list[str] = Field(default_factory=list, max_length=MAX_MEMBERS)
    revision: int = Field(ge=1)


def _wanted_members(conn: sqlite3.Connection, principal: Principal, before: list[str], user_ids: list[str]) -> tuple[list[str], set[str] | None]:
    """The membership asked for. A delegated administrator names only people their directory shows: members it does
    not show (inactive in HA or in the VMS) are kept, never removed by omission. Returns (wanted, visible or None)."""
    wanted = list(dict.fromkeys(u.strip() for u in user_ids if u.strip()))
    if full_authority(conn, principal):
        return wanted, None
    visible = active_user_ids(conn)
    return wanted + [u for u in before if u not in visible and u not in wanted], visible


@router.put("/access/groups/{group_id}/members")
def set_members(group_id: str, request: Request, principal: Principal = Depends(_assign_gate_ro), raw: bytes = Depends(_capped_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Replace the membership - a bulk request: every added or removed user is checked (known person; a delegated
    administrator never adds or removes themselves, and names only people their directory shows) and the first refused
    one refuses the whole call. Dependency order matters: gate (read connection) -> body -> write transaction."""
    body: MembersBody = _parse(request, raw, MembersBody)
    g = _group_row(conn, group_id)
    _reach_or_refuse(conn, principal, group_id, "rbac.group_members")
    _check_revision(g, body.revision)
    before = _group_members(conn, group_id)
    wanted, visible = _wanted_members(conn, principal, before, body.user_ids)
    added = [u for u in wanted if u not in before]
    removed = [u for u in before if u not in wanted]
    full = visible is None
    for i, uid in enumerate(added + removed):
        if not full and uid == principal.user_id:
            audit(conn, actor=principal, action="rbac.group_members", decision="denied", resource_type="group", resource_id=group_id, reason="delegation_self", details={"item_id": uid})
            raise _item_refusal(ApiError(403, "delegation_self", "מנהל מקומי אינו מצרף או מסיר את עצמו מקבוצה."), i, uid, "user")
        if uid in added and (not user_known(conn, uid) or (visible is not None and uid not in visible)):
            raise _item_refusal(ApiError(404, "user_unknown", "המשתמש לא נמצא בספריית Home Assistant."), i, uid, "user")
    if not added and not removed:
        return _group_dict(conn, g, principal)
    with keep_an_admin(conn):
        for uid in added:
            _ensure_user_row(conn, uid)
            conn.execute("INSERT INTO group_members(group_id, user_id) VALUES (?, ?)", (group_id, uid))
        for uid in removed:
            conn.execute("DELETE FROM group_members WHERE group_id = ? AND user_id = ?", (group_id, uid))
        rev = bump_permission_revision(conn)
        grev = touch_group(conn, group_id, principal)
    audit(conn, actor=principal, action="rbac.group_members", decision="allowed", resource_type="group", resource_id=group_id, request_id=_rid(request),
          details={"added": added, "removed": removed, "group_bindings": [b["id"] for b in _group_bindings(conn, group_id)], "revision": rev, "group_revision": grev})
    _terminate(conn, settings_of(request), set(removed))
    revocation.changed(set(added))
    return _group_dict(conn, _group_row(conn, group_id), principal)


# ---------------------------------------------------------------- the group's own bindings

class GroupBindingBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role_id: str = Field(min_length=1, max_length=60)
    scope_type: str = Field(pattern="^(installation|site|building|floor|camera)$")
    scope_id: str = Field(min_length=1, max_length=200)
    effect: str = Field(default="allow", pattern="^(allow|deny)$")
    expires_at: str | None = None
    revision: int = Field(ge=1)


@router.post("/access/groups/{group_id}/bindings", status_code=201)
def bind_group(group_id: str, body: GroupBindingBody, request: Request, principal: Principal = Depends(_assign_holder), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    b = BindingBody(subject_kind="group", subject_id=group_id, role_id=body.role_id, scope_type=body.scope_type, scope_id=body.scope_id, effect=body.effect, expires_at=body.expires_at)
    validate_binding(conn, principal, b)  # permission and scope first, then the group (404) and the delegation limits
    _check_revision(_group_row(conn, group_id), body.revision)
    bid, rev = insert_binding(conn, principal, request, b)
    if b.effect == "deny":
        _terminate(conn, settings_of(request), affected_users(conn, "group", group_id))
    else:
        revocation.changed(affected_users(conn, "group", group_id))
    return {"binding_id": bid, "revision": rev, "group": _group_dict(conn, _group_row(conn, group_id), principal)}


@router.delete("/access/groups/{group_id}/bindings/{binding_id}")
def unbind_group(group_id: str, binding_id: str, request: Request, revision: int = Query(..., ge=1), principal: Principal = Depends(_assign_holder), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    b = conn.execute("SELECT * FROM bindings WHERE id = ? AND revoked_at IS NULL AND subject_kind = 'group' AND subject_id = ?", (binding_id, group_id)).fetchone()
    if not b:
        raise ApiError(404, "not_found", "השיוך לא נמצא או כבר בוטל.")
    check_delegation(conn, principal, b["role_id"], (b["scope_type"], b["scope_id"]), "group", group_id, op="unbind", effect=b["effect"])
    _check_revision(_group_row(conn, group_id), revision)
    rev = revoke_one(conn, principal, request, b)
    _terminate(conn, settings_of(request), affected_users(conn, "group", group_id))
    return {"revoked": binding_id, "revision": rev, "group": _group_dict(conn, _group_row(conn, group_id), principal)}


# ---------------------------------------------------------------- impact preview

class ImpactBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    op: Literal["bind", "unbind", "members"]
    role_id: str | None = Field(default=None, max_length=60)
    scope_type: str | None = Field(default=None, pattern="^(installation|site|building|floor|camera)$")
    scope_id: str | None = Field(default=None, max_length=200)
    effect: str = Field(default="allow", pattern="^(allow|deny)$")
    binding_id: str | None = Field(default=None, max_length=200)
    user_ids: list[str] = Field(default_factory=list, max_length=MAX_MEMBERS)


class _Rollback(Exception):
    pass


@router.post("/access/groups/{group_id}/impact")
def group_impact(group_id: str, body: ImpactBody, principal: Principal = Depends(_assign_holder), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Before a group change is saved: every affected user with the permissions they gain or lose at each scope the
    change touches - bind/unbind: all members at the binding's scope; members: the users added or removed, at every
    scope the group is bound to. Computed by applying the change inside a savepoint and rolling it back; the same
    delegation checks as the change itself run first (a preview is never a way to look past one's reach)."""
    g = _group_row(conn, group_id)
    members = _group_members(conn, group_id)
    scopes: list[tuple[str, str]] = []
    users: list[tuple[str, str]] = []  # (user id, change)

    def apply() -> None:
        pass

    if body.op == "bind":
        if not body.role_id or not body.scope_type or not body.scope_id:
            raise ApiError(422, "validation", "נדרשים תפקיד והיקף.", details={"fields": ["role_id", "scope_type", "scope_id"]})
        if body.role_id not in all_roles(conn):
            raise ApiError(422, "role_unknown", "תפקיד לא מוכר.")
        scope = (body.scope_type, body.scope_id)
        require(conn, principal, "rbac.assign", scope)
        if not _scope_exists(conn, *scope):
            raise ApiError(422, "scope_unknown", "ההיקף (אתר / מבנה / קומה) לא נמצא.")
        check_delegation(conn, principal, body.role_id, scope, "group", group_id, op="bind", effect=body.effect)
        scopes, users = [scope], [(u, "member") for u in members]

        def apply() -> None:  # noqa: F811
            conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) VALUES (?, 'group', ?, ?, ?, ?, ?, 0, ?, ?)",
                         (new_id(), group_id, body.role_id, scope[0], scope[1], body.effect, principal.user_id, now_iso()))
    elif body.op == "unbind":
        b = conn.execute("SELECT * FROM bindings WHERE id = ? AND revoked_at IS NULL AND subject_kind = 'group' AND subject_id = ?", (body.binding_id or "", group_id)).fetchone()
        if not b:
            raise ApiError(404, "not_found", "השיוך לא נמצא או כבר בוטל.")
        check_delegation(conn, principal, b["role_id"], (b["scope_type"], b["scope_id"]), "group", group_id, op="unbind", effect=b["effect"])
        scopes, users = [(b["scope_type"], b["scope_id"])], [(u, "member") for u in members]

        def apply() -> None:  # noqa: F811
            conn.execute("UPDATE bindings SET revoked_at = ? WHERE id = ?", (now_iso(), b["id"]))
    else:
        _reach_or_refuse(conn, principal, group_id, "rbac.group_members")
        wanted, visible = _wanted_members(conn, principal, members, body.user_ids)
        if visible is not None:  # a delegated preview names only people their directory shows
            wanted = [u for u in wanted if u in visible or u in members]
        added = [u for u in wanted if u not in members]
        removed = [u for u in members if u not in wanted]
        scopes = list(dict.fromkeys((b["scope_type"], b["scope_id"]) for b in _group_bindings(conn, group_id)))
        users = [(u, "added") for u in added] + [(u, "removed") for u in removed]

        def apply() -> None:  # noqa: F811
            for uid in added:
                if user_known(conn, uid):
                    _ensure_user_row(conn, uid)
                    conn.execute("INSERT OR IGNORE INTO group_members(group_id, user_id) VALUES (?, ?)", (group_id, uid))
            for uid in removed:
                conn.execute("DELETE FROM group_members WHERE group_id = ? AND user_id = ?", (group_id, uid))

    def snapshot() -> dict[str, dict[tuple[str, str], set[str]]]:
        out: dict[str, dict[tuple[str, str], set[str]]] = {}
        for uid, _ in users:
            p = Principal(user_id=uid, username="", display_name="", source="ingress")
            out[uid] = {s: set(effective_permissions(conn, p, s)) for s in scopes}
        return out

    before = snapshot()
    try:
        with _all_or_nothing(conn):
            apply()
            after = snapshot()
            raise _Rollback()
    except _Rollback:
        pass
    rows = []
    for uid, change in users:
        per_scope = []
        for s in scopes:
            gained, lost = sorted(after[uid][s] - before[uid][s]), sorted(before[uid][s] - after[uid][s])
            per_scope.append({"scope_type": s[0], "scope_id": s[1], "scope_name": scope_name(conn, *s), "added": gained, "removed": lost})
        rows.append({"id": uid, "name": _subject_name(conn, "user", uid), "change": change,
                     "added": sorted({p for x in per_scope for p in x["added"]}), "removed": sorted({p for x in per_scope for p in x["removed"]}), "scopes": per_scope})
    rows.sort(key=lambda r: (r["change"], r["name"].lower()))
    return {
        "group_id": group_id,
        "op": body.op,
        "revision": g["revision"],
        "scopes": [{"scope_type": s[0], "scope_id": s[1], "scope_name": scope_name(conn, *s)} for s in scopes],
        "users": rows,
        "labels": PERMISSION_LABELS,
    }


# ---------------------------------------------------------------- bulk bindings

class BulkBindingsBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: list[BindingBody] = Field(min_length=1, max_length=BULK_MAX_BINDINGS)


@router.post("/access/bindings/bulk", status_code=201)
def bulk_bindings(request: Request, principal: Principal = Depends(_assign_gate_ro), raw: bytes = Depends(_capped_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Many bindings in one call, all or nothing: each item gets exactly the single route's checks (validate_binding -
    delegation, allow-list, ceiling, self, group reach, existence, duplicates) and so does the whole set against itself
    (no item twice); the first refused item refuses the request with its index and id and nothing is written."""
    body: BulkBindingsBody = _parse(request, raw, BulkBindingsBody)
    seen: dict[tuple[str, ...], int] = {}
    for i, item in enumerate(body.items):
        key = (item.subject_kind, item.subject_id, item.role_id, item.scope_type, item.scope_id, item.effect)
        if key in seen:
            raise _item_refusal(ApiError(409, "duplicate_item", "אותו שיוך מופיע פעמיים בבקשה.", details={"first_index": seen[key]}), i, item.subject_id, item.subject_kind)
        seen[key] = i
        try:
            validate_binding(conn, principal, item)
        except ApiError as exc:
            raise _item_refusal(exc, i, item.subject_id, item.subject_kind) from None
    created: list[dict[str, Any]] = []
    terminate: set[str] = set()
    granted: set[str] = set()
    with _all_or_nothing(conn):
        for i, item in enumerate(body.items):
            bid, rev = insert_binding(conn, principal, request, item, extra_audit={"bulk_index": i})
            created.append({"index": i, "binding_id": bid, "revision": rev})
            if item.effect == "deny":
                terminate |= affected_users(conn, item.subject_kind, item.subject_id)
            else:
                granted |= affected_users(conn, item.subject_kind, item.subject_id)
    audit(conn, actor=principal, action="rbac.bind_bulk", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request),
          details={"binding_ids": [c["binding_id"] for c in created], "count": len(created), "revision": created[-1]["revision"]})
    _terminate(conn, settings_of(request), terminate)
    revocation.changed(granted)
    return {"created": created, "revision": created[-1]["revision"]}
