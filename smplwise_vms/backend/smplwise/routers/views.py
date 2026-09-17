"""Saved views (live review F3): a named set of cameras with a layout that opens the live wall or the kiosk.
Personal views belong to their owner; shared views are visible to every signed-in user and need `rbac.assign`
(site administrators and up) to create or edit. Every camera in a view must be one the caller may watch live;
a reader who may not see one of a shared view's cameras gets the view with that camera left out and counted."""
from __future__ import annotations

import json
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..db import new_id, now_iso
from ..errors import ApiError, forbidden, not_found
from ..rbac import INSTALLATION, Principal, authorize, require
from ..services.access import camera_allowed, visible_camera_ids

router = APIRouter()
MAX_CAMERAS = 16


class ViewBody(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    cameras: list[str] = Field(min_length=1, max_length=MAX_CAMERAS)
    cols: int = Field(default=2, ge=1, le=4)
    rows: int = Field(default=2, ge=1, le=4)
    shared: bool = False
    kiosk: bool = False


def _can_manage_shared(conn: sqlite3.Connection, principal: Principal) -> bool:
    """Shared views are an administration act: rbac.assign at the installation or at any site (a site administrator)."""
    if authorize(conn, principal, "rbac.assign", INSTALLATION).allowed:
        return True
    for r in conn.execute("SELECT id FROM sites WHERE deleted_at IS NULL").fetchall():
        if authorize(conn, principal, "rbac.assign", ("site", r["id"])).allowed:
            return True
    return False


def _can_edit(conn: sqlite3.Connection, principal: Principal, row: sqlite3.Row) -> bool:
    if row["owner_user_id"] == principal.user_id:
        return True
    return authorize(conn, principal, "system.configure", INSTALLATION).allowed


def _view_dict(row: sqlite3.Row, visible: set[str] | None, names: dict[str, str]) -> dict[str, Any]:
    cams = [c for c in json.loads(row["cameras_json"] or "[]") if isinstance(c, str)]
    shown = cams if visible is None else [c for c in cams if c in visible]
    return {
        "id": row["id"], "name": row["name"], "cameras": shown, "camera_names": [names.get(c, c) for c in shown],
        "hidden_cameras": len(cams) - len(shown), "cols": row["cols"], "rows": row["rows"], "shared": bool(row["shared"]),
        "kiosk": bool(row["kiosk"]), "owner_user_id": row["owner_user_id"], "owner_username": row["owner_username"],
        "created_at": row["created_at"], "updated_at": row["updated_at"],
    }


def _names(conn: sqlite3.Connection) -> dict[str, str]:
    """Display names as the camera list shows them: two channels with the same name carry their channel number."""
    rows = conn.execute("SELECT id, alias, name_source, channel FROM cameras").fetchall()
    base = {r["id"]: (r["alias"] or r["name_source"] or f"ערוץ {r['channel']}") for r in rows}
    seen: dict[str, int] = {}
    for n in base.values():
        seen[n] = seen.get(n, 0) + 1
    return {r["id"]: (f"{base[r['id']]} · ערוץ {r['channel']}" if seen[base[r["id"]]] > 1 else base[r["id"]]) for r in rows}


def _check_cameras(conn: sqlite3.Connection, principal: Principal, cameras: list[str]) -> list[str]:
    seen: list[str] = []
    for cid in cameras:
        if cid in seen:
            continue
        if not conn.execute("SELECT 1 FROM cameras WHERE id = ?", (cid,)).fetchone():
            raise ApiError(422, "validation", "מצלמה בתצוגה לא נמצאה.", details={"camera_id": cid})
        if not camera_allowed(conn, principal, cid, "video.live"):
            raise forbidden("אין הרשאת צפייה חיה במצלמה שבתצוגה.", permission="video.live", target_type="camera", target_id=cid)
        seen.append(cid)
    return seen


@router.get("/views")
def list_views(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The caller's own views plus every shared view; cameras the caller may not watch are left out and counted."""
    visible = visible_camera_ids(conn, principal, "video.live")
    names = _names(conn)
    rows = conn.execute("SELECT * FROM saved_views WHERE deleted_at IS NULL AND (shared = 1 OR owner_user_id = ?) ORDER BY shared DESC, name COLLATE NOCASE", (principal.user_id,)).fetchall()
    return {
        "views": [_view_dict(r, visible, names) for r in rows],
        "can_share": _can_manage_shared(conn, principal),
        "can_manage_all": authorize(conn, principal, "system.configure", INSTALLATION).allowed,
    }


@router.post("/views", status_code=201)
def create_view(body: ViewBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    if body.shared and not _can_manage_shared(conn, principal):
        require(conn, principal, "rbac.assign", INSTALLATION)  # audited refusal
    cameras = _check_cameras(conn, principal, body.cameras)
    vid = new_id()
    now = now_iso()
    conn.execute(
        "INSERT INTO saved_views(id, name, cameras_json, cols, rows, shared, kiosk, owner_user_id, owner_username, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        (vid, body.name.strip(), json.dumps(cameras), body.cols, body.rows, int(body.shared), int(body.kiosk), principal.user_id, principal.username, now, now),
    )
    audit(conn, actor=principal, action="views.create", decision="allowed", resource_type="view", resource_id=vid,
          request_id=getattr(request.state, "correlation_id", None), details={"name": body.name.strip(), "cameras": len(cameras), "shared": body.shared, "kiosk": body.kiosk})
    return _view_dict(conn.execute("SELECT * FROM saved_views WHERE id = ?", (vid,)).fetchone(), None, _names(conn))


def _load(conn: sqlite3.Connection, view_id: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM saved_views WHERE id = ? AND deleted_at IS NULL", (view_id,)).fetchone()
    if not row:
        raise not_found("התצוגה לא נמצאה.")
    return row


@router.put("/views/{view_id}")
def update_view(view_id: str, body: ViewBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    row = _load(conn, view_id)
    if not _can_edit(conn, principal, row):
        raise forbidden("רק בעל התצוגה או מנהל מערכת יכולים לערוך אותה.", permission="views.edit", target_type="view", target_id=view_id)
    if body.shared and not bool(row["shared"]) and not _can_manage_shared(conn, principal):
        require(conn, principal, "rbac.assign", INSTALLATION)  # audited refusal
    cameras = _check_cameras(conn, principal, body.cameras)
    conn.execute(
        "UPDATE saved_views SET name = ?, cameras_json = ?, cols = ?, rows = ?, shared = ?, kiosk = ?, updated_at = ? WHERE id = ?",
        (body.name.strip(), json.dumps(cameras), body.cols, body.rows, int(body.shared), int(body.kiosk), now_iso(), view_id),
    )
    audit(conn, actor=principal, action="views.update", decision="allowed", resource_type="view", resource_id=view_id,
          request_id=getattr(request.state, "correlation_id", None), details={"name": body.name.strip(), "cameras": len(cameras), "shared": body.shared, "kiosk": body.kiosk})
    return _view_dict(conn.execute("SELECT * FROM saved_views WHERE id = ?", (view_id,)).fetchone(), None, _names(conn))


@router.delete("/views/{view_id}")
def delete_view(view_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    row = _load(conn, view_id)
    if not _can_edit(conn, principal, row):
        raise forbidden("רק בעל התצוגה או מנהל מערכת יכולים למחוק אותה.", permission="views.edit", target_type="view", target_id=view_id)
    conn.execute("UPDATE saved_views SET deleted_at = ?, updated_at = ? WHERE id = ?", (now_iso(), now_iso(), view_id))
    audit(conn, actor=principal, action="views.delete", decision="allowed", resource_type="view", resource_id=view_id,
          request_id=getattr(request.state, "correlation_id", None), details={"name": row["name"]})
    return {"id": view_id, "deleted": True}
