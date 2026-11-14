"""Camera image health (CAMHEALTH091, board r091): is the picture dark, blurred, frozen or shifted.

- GET  /camera-image-health                         the results of the cameras the caller may watch live (video.live), the counts
- POST /camera-image-health/check                   one pass now (system.configure; at most every 30 s; only while switched on)
- GET  /camera-image-health/settings                the switch, the interval and every threshold with its range (system.configure)
- PUT  /camera-image-health/settings                change them (system.configure, audited)
- POST /camera-image-health/{camera_id}/reference   {"action": "set" | "clear"}: the reference view of the shift check (system.configure, audited)

Recipients and channels of the alert are the notification policy of `camera.image` (PUT /notify/policies/camera.image). Names, states and
numbers only: never an image, an address, a credential or a stream source."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Body, Depends, Request

from ..audit import audit
from ..auth import current_principal, get_conn, settings_of
from ..db import database_of, unlocked
from ..errors import ApiError, not_found
from ..rbac import INSTALLATION, Principal, authorize, require
from ..services import camera_image_health as cih
from ..services.access import visible_camera_ids

router = APIRouter()
PERMISSION = "system.configure"


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _answer(conn: sqlite3.Connection, principal: Principal) -> dict[str, Any]:
    manage = authorize(conn, principal, PERMISSION, INSTALLATION).allowed
    visible = None if manage else visible_camera_ids(conn, principal, "video.live")
    return {**cih.view(conn, visible), "can_manage": manage}


@router.get("/camera-image-health")
def get_results(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """CAMHEALTH091: the image health of every camera the caller may watch live (names, states and numbers only)."""
    return _answer(conn, principal)


@router.post("/camera-image-health/check")
def check(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """CAMHEALTH091: sample the oldest cameras now (cache or existing sub stream; at most every 30 s); 409 while switched off."""
    require(conn, principal, PERMISSION, INSTALLATION)
    if not cih.load(conn)["enabled"]:
        raise ApiError(409, "camera_image_health_off", "בדיקת תמונת המצלמות כבויה.")
    db = database_of(conn)
    ran = False
    if db is not None:
        with unlocked(conn):
            ran = cih.check_now(db, settings_of(request))
    return {"checked": ran, **_answer(conn, principal)}


def _settings_answer(conn: sqlite3.Connection) -> dict[str, Any]:
    return {"values": cih.load(conn), "ranges": cih.ranges(), "cameras": cih.camera_choices(conn), "source": cih.SOURCE}


@router.get("/camera-image-health/settings")
def get_settings(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """CAMHEALTH091: the switch, the sampling interval and every threshold, with defaults and ranges."""
    require(conn, principal, PERMISSION, INSTALLATION)
    return _settings_answer(conn)


@router.put("/camera-image-health/settings")
def put_settings(request: Request, body: dict[str, Any] = Body(...), principal: Principal = Depends(current_principal),
                 conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """CAMHEALTH091: change the switch, the interval or thresholds (validated against their ranges; audited)."""
    require(conn, principal, PERMISSION, INSTALLATION)
    changes = cih.validate(body)
    cih.save(conn, changes)
    audit(conn, actor=principal, action="camera_image_health.settings", decision="allowed", resource_type="settings", resource_id=cih.SETTING_KEY,
          request_id=_rid(request), details={"changed": sorted(changes), **({"enabled": changes["enabled"]} if "enabled" in changes else {})})
    return _settings_answer(conn)


@router.post("/camera-image-health/{camera_id}/reference")
def reference(camera_id: str, request: Request, body: dict[str, Any] = Body(...), principal: Principal = Depends(current_principal),
              conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """CAMHEALTH091: make the latest sample the camera's reference view (`set`) or forget it (`clear`; the next usable sample becomes it)."""
    require(conn, principal, PERMISSION, INSTALLATION)
    action = body.get("action") if isinstance(body, dict) else None
    if action not in ("set", "clear"):
        raise ApiError(422, "validation", "פעולה לא מוכרת.", details={"field": "action"})
    if conn.execute("SELECT 1 FROM cameras WHERE id = ?", (camera_id,)).fetchone() is None:
        raise not_found("המצלמה לא נמצאה.")
    if action == "set":
        st = cih.STORE.get(camera_id)
        if st is None or st.thumb is None or st.error is not None:
            raise ApiError(409, "camera_image_no_sample", "אין דגימה עדכנית של המצלמה.")
        cih.set_reference(conn, camera_id, st.thumb, principal.user_id, auto=False)
    else:
        cih.clear_reference(conn, camera_id)
    audit(conn, actor=principal, action="camera_image_health.reference", decision="allowed", resource_type="camera", resource_id=camera_id,
          request_id=_rid(request), details={"action": action})
    return _answer(conn, principal)
