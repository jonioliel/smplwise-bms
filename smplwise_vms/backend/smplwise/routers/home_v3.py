"""HOME-V3-P1-2430: the home interface's phase-1 additions (services/home_v3).

* `GET  /home/room-wallpapers`                 the administrator's wallpaper per room (rbac.assign) - everyone else reads the applied
                                                set in `GET /home/interface` (`room_wallpapers`)
* `PUT  /home/room-wallpapers/{room_key}`      set (`g:<gallery>`) or clear ("") one room's wallpaper for everyone (rbac.assign; audited)
* `PUT  /home/room-wallpapers/{room_key}/image`  the administrator's picture for one room (JPEG / PNG <= 2 MB, re-encoded; rbac.assign;
                                                only while the installation offers pictures; audited without the picture)
* `GET  /home/room-wallpapers/{room_key}/image`  that picture, to anyone signed in (it is the room's screen background)
* `DELETE /home/room-wallpapers/{room_key}/image`
* `GET  /home/guest-doors`                     the doors the caller may offer a guest - 404 unless the visitor switch is on AND the
                                                home administrator marked the caller (`guests`); the invitation itself is the existing
                                                `POST /access/visitors`, which checks `access.visitor.invite` per station again
"""
from __future__ import annotations

import base64
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, File, Request, Response, UploadFile
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..db import now_iso
from ..rbac import INSTALLATION, Principal, require
from ..services import home_interface as hi
from ..services import home_v3
from ._common import rid as _rid

router = APIRouter()
ADMIN = "rbac.assign"


def _room(room_key: str) -> str:
    if not hi.ROOM_KEY_RE.match(room_key):
        raise hi.HomeInterfaceError(422, "validation", "החדר אינו תקין.")
    return room_key


@router.get("/home/room-wallpapers")
def list_room_wallpapers(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    require(conn, principal, ADMIN, INSTALLATION)
    mode = hi.install_settings(conn)["wallpaper"]
    return {"walls": home_v3.room_wallpapers(conn, mode), "mode": mode, "gallery": list(hi.GALLERY)}


class WallBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    value: str = Field("", max_length=40)


@router.put("/home/room-wallpapers/{room_key}")
def put_room_wallpaper(room_key: str, body: WallBody, request: Request, principal: Principal = Depends(current_principal),
                       conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, ADMIN, INSTALLATION)
    _room(room_key)
    mode = hi.install_settings(conn)["wallpaper"]
    v = body.value or ""
    if v and (not v.startswith("g:") or v[2:] not in hi.GALLERY):
        raise hi.HomeInterfaceError(422, "validation", "רקע לא מוכר.")
    if v and mode == "none":
        raise hi.HomeInterfaceError(403, "wallpaper_off", "רקע לחדרים אינו פעיל בהתקנה הזו.")
    before = home_v3.stored_walls(conn).get(room_key)
    if not v:
        conn.execute("DELETE FROM home_room_image WHERE user_id = ? AND room_key = ?", (home_v3.SHARED, room_key))
    home_v3.set_room_wallpaper(conn, room_key, v or None)
    audit(conn, actor=principal, action="home_interface.room_wallpaper.set", decision="allowed", resource_type="setting", resource_id=home_v3.WALLS_KEY,
          request_id=_rid(request), details={"room": room_key, "before": before, "after": v or None})
    return {"walls": home_v3.room_wallpapers(conn, mode)}


@router.put("/home/room-wallpapers/{room_key}/image")
def put_room_wallpaper_image(room_key: str, request: Request, file: UploadFile = File(...), principal: Principal = Depends(current_principal),
                                   conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    from ..services.bill_pdf_logo import LogoError, sanitize_image
    from .home_interface import WALL_REFUSED

    require(conn, principal, ADMIN, INSTALLATION)
    _room(room_key)
    if hi.install_settings(conn)["wallpaper"] != "gallery_image":
        raise hi.HomeInterfaceError(403, "wallpaper_image_off", "תמונה לרקע אינה פעילה בהתקנה הזו.")
    raw = file.file.read(hi.WALL_IMAGE_BYTES + 1)
    try:
        mime, data = sanitize_image(raw, max_bytes=hi.WALL_IMAGE_BYTES, max_side=hi.WALL_IMAGE_SIDE)
    except LogoError as exc:
        raise hi.HomeInterfaceError(422, "image_refused", WALL_REFUSED.get(str(exc), "התמונה נדחתה."), details={"reason": str(exc)}) from None
    conn.execute(
        """INSERT INTO home_room_image (user_id, room_key, mime, data_b64, bytes, updated_at) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(user_id, room_key) DO UPDATE SET mime = excluded.mime, data_b64 = excluded.data_b64, bytes = excluded.bytes, updated_at = excluded.updated_at""",
        (home_v3.SHARED, room_key, mime, base64.b64encode(data).decode("ascii"), len(data), now_iso()),
    )
    home_v3.set_room_wallpaper(conn, room_key, "img")
    audit(conn, actor=principal, action="home_interface.room_wallpaper.image", decision="allowed", resource_type="setting", resource_id=home_v3.WALLS_KEY,
          request_id=_rid(request), details={"room": room_key, "bytes": len(data), "mime": mime})
    return {"ok": True, "walls": home_v3.room_wallpapers(conn, "gallery_image")}


@router.get("/home/room-wallpapers/{room_key}/image")
def get_room_wallpaper_image(room_key: str, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Response:
    _room(room_key)
    r = conn.execute("SELECT mime, data_b64 FROM home_room_image WHERE user_id = ? AND room_key = ?", (home_v3.SHARED, room_key)).fetchone()
    if r is None or hi.install_settings(conn)["wallpaper"] != "gallery_image":
        raise hi.HomeInterfaceError(404, "not_found", "אין תמונה.")
    return Response(base64.b64decode(r["data_b64"]), media_type=r["mime"], headers={"Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff"})


@router.delete("/home/room-wallpapers/{room_key}/image")
def delete_room_wallpaper_image(room_key: str, request: Request, principal: Principal = Depends(current_principal),
                                conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, ADMIN, INSTALLATION)
    _room(room_key)
    conn.execute("DELETE FROM home_room_image WHERE user_id = ? AND room_key = ?", (home_v3.SHARED, room_key))
    if home_v3.stored_walls(conn).get(room_key) == "img":
        home_v3.set_room_wallpaper(conn, room_key, None)
    audit(conn, actor=principal, action="home_interface.room_wallpaper.image_delete", decision="allowed", resource_type="setting", resource_id=home_v3.WALLS_KEY,
          request_id=_rid(request), details={"room": room_key})
    return {"ok": True, "walls": home_v3.room_wallpapers(conn, hi.install_settings(conn)["wallpaper"])}


@router.get("/home/guest-doors")
def guest_doors(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The doors the caller may put in a guest invitation. Hidden (404) unless the visitor invitations are on and the home administrator
    marked the caller; an empty list when the caller holds the invite permission on no station."""
    from ..services import access_visitors as av

    if not av.enabled(conn) or not hi.effective(conn, principal.user_id)["guests"]:
        raise av._hidden()
    return {"doors": home_v3.guest_doors(conn, principal)}
