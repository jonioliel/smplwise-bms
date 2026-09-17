"""Owner-approved NVR writes: the "Notify Surveillance Center" linkage per channel (B1) and the change log with
rollback. Reading the state needs system.configure; writing needs the sensitive permission of the capability."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field

from ..auth import current_principal, get_conn, settings_of
from ..db import unlocked
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, require
from ..services import nvr_write

router = APIRouter()
NOTIFY_PERMISSION = "nvr.config.events"


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


NVR_PERMISSIONS = ("nvr.config.events", "nvr.config.detection", "nvr.config.privacy", "nvr.config.smart", "nvr.config.schedule", "nvr.config.stream",
                   "nvr.config.osd", "nvr.config.time", "nvr.record.manual", "nvr.record.lock", "nvr.alarm_output", "nvr.storage.test", "nvr.system.reboot")


def _require_read(conn: sqlite3.Connection, principal: Principal) -> None:
    """The state and the log are readable by system administrators and by whoever may write anything to the NVR."""
    if authorize(conn, principal, "system.configure", INSTALLATION).allowed:
        return
    if any(authorize(conn, principal, perm, INSTALLATION).allowed for perm in NVR_PERMISSIONS):
        return
    require(conn, principal, NOTIFY_PERMISSION, INSTALLATION)


def _cameras(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute("SELECT id, channel, alias, name_source FROM cameras WHERE recorder_id = 'nvr-1' AND enabled = 1 AND channel IS NOT NULL ORDER BY channel").fetchall()


@router.get("/nvr/notify")
def notify_status(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Which channels notify the surveillance centre for motion and for the smart events (read-only probe)."""
    _require_read(conn, principal)
    settings = settings_of(request)
    cams = _cameras(conn)
    with unlocked(conn):
        status = nvr_write.notify_status(settings, [int(c["channel"]) for c in cams])
    channels = []
    for c in cams:
        types = status.get(int(c["channel"]), {})
        smart = {t: types[t] for t in nvr_write.SMART_TYPES if t in types}
        channels.append({
            "camera_id": c["id"], "channel": int(c["channel"]), "name": c["alias"] or c["name_source"] or f"ערוץ {c['channel']}",
            "motion": types.get("VMD", {"supported": False, "center": None}),
            "smart": smart,
            "smart_supported": sum(1 for v in smart.values() if v["supported"]),
            "smart_center": sum(1 for v in smart.values() if v["supported"] and v["center"]),
        })
    return {
        "channels": channels,
        "permission": NOTIFY_PERMISSION,
        "can_write": authorize(conn, principal, NOTIFY_PERMISSION, INSTALLATION).allowed,
        "labels": nvr_write.TYPE_LABEL,
    }


class NotifyIn(BaseModel):
    channels: list[int] | None = Field(default=None, max_length=64)  # None = every enabled camera
    smart: bool = False  # also the smart event types (line crossing, intrusion, region entrance / exiting)
    enabled: bool = True


@router.put("/nvr/notify")
def set_notify(body: NotifyIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Add (or remove) "Notify Surveillance Center" on the motion trigger - and the smart triggers when asked - of the
    chosen channels. Each trigger is one recorded, reversible change; types a channel does not have are skipped."""
    require(conn, principal, NOTIFY_PERMISSION, INSTALLATION)
    settings = settings_of(request)
    cams = _cameras(conn)
    wanted = set(body.channels) if body.channels else {int(c["channel"]) for c in cams}
    known = {int(c["channel"]) for c in cams}
    if not wanted <= known:
        raise ApiError(422, "validation", "ערוץ לא מוכר.", details={"unknown": sorted(wanted - known)})
    types = list(nvr_write.NOTIFY_TYPES) if body.smart else ["VMD"]
    results: list[dict[str, Any]] = []
    client = nvr_write._client(settings)
    try:
        for ch in sorted(wanted):
            for t in types:
                path = nvr_write.trigger_path(t, ch)
                with unlocked(conn):
                    status, _text = nvr_write._probe(client, path)
                if status != 200:
                    results.append({"channel": ch, "type": t, "status": "skipped", "reason": "not_configured"})
                    continue
                try:
                    with unlocked(conn):
                        rec = nvr_write.apply_change(settings, conn, principal, kind="notify_center", permission=NOTIFY_PERMISSION, target=f"{t}-{ch}", path=path,
                                                     mutate=lambda x, on=body.enabled: nvr_write.with_center(x, on), note=("הפעלת" if body.enabled else "כיבוי") + " Notify Surveillance Center",
                                                     request_id=_rid(request), client=client)
                    results.append({"channel": ch, "type": t, "status": rec["status"], "change_id": rec["id"]})
                except ApiError as exc:
                    results.append({"channel": ch, "type": t, "status": "failed", "reason": exc.code})
    finally:
        client.close()
    return {"results": results, "applied": sum(1 for r in results if r["status"] == "applied"), "unchanged": sum(1 for r in results if r["status"] == "unchanged"),
            "skipped": sum(1 for r in results if r["status"] == "skipped"), "failed": sum(1 for r in results if r["status"] == "failed")}


class MotionIn(BaseModel):
    cells: list[list[bool]] | None = Field(default=None, max_length=64)
    sensitivity: int | None = Field(default=None, ge=0, le=100)
    enabled: bool | None = None


@router.put("/cameras/{camera_id}/motion")
def set_motion(camera_id: str, body: MotionIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """B2: write the camera's motion-detection grid, sensitivity and/or enabled flag to the NVR (one recorded,
    reversible change). Needs `nvr.config.detection` and the camera in the caller's live scope."""
    from ..services.access import require_camera
    from .cameras import _ZONES_CACHE

    if body.cells is None and body.sensitivity is None and body.enabled is None:
        raise ApiError(422, "validation", "אין מה לשנות.")
    cam = conn.execute("SELECT * FROM cameras WHERE id = ?", (camera_id,)).fetchone()
    if not cam or cam["channel"] is None:
        raise ApiError(404, "not_found", "המצלמה לא נמצאה.")
    require(conn, principal, "nvr.config.detection", INSTALLATION)
    require_camera(conn, principal, camera_id, "video.live")
    ch = int(cam["channel"])
    sensitivity = body.sensitivity
    if sensitivity is not None:
        with unlocked(conn):
            sensitivity = nvr_write.snap_sensitivity(sensitivity, nvr_write.motion_capabilities(settings_of(request), ch))
    parts = [p for p, v in (("רשת", body.cells), (f"רגישות {sensitivity}", sensitivity), ("הפעלה", body.enabled)) if v is not None]
    with unlocked(conn):
        rec = nvr_write.apply_change(settings_of(request), conn, principal, kind="detection", permission="nvr.config.detection", target=f"motion-{ch}",
                                     path=nvr_write.motion_path(ch), mutate=lambda x: nvr_write.motion_document(x, cells=body.cells, sensitivity=sensitivity, enabled=body.enabled),
                                     note="זיהוי תנועה: " + " + ".join(parts), request_id=_rid(request))
    _ZONES_CACHE.pop(camera_id, None)
    rec["sensitivity_written"] = sensitivity
    return rec


@router.get("/nvr/changes")
def list_changes(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn), limit: int = Query(50, ge=1, le=500)) -> dict[str, Any]:
    _require_read(conn, principal)
    return {"changes": nvr_write.list_changes(conn, limit)}


@router.get("/nvr/changes/{change_id}")
def get_change(change_id: str, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The change with both documents (for the "before / after" view)."""
    _require_read(conn, principal)
    r = nvr_write.get_change(conn, change_id)
    if not r:
        raise ApiError(404, "not_found", "השינוי לא נמצא.")
    return {k: r[k] for k in r.keys()}


@router.post("/nvr/changes/{change_id}/rollback", status_code=201)
def rollback_change(change_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    r = nvr_write.get_change(conn, change_id)
    if not r:
        raise ApiError(404, "not_found", "השינוי לא נמצא.")
    require(conn, principal, r["permission"], INSTALLATION)
    with unlocked(conn):
        return nvr_write.rollback(settings_of(request), conn, principal, change_id, request_id=_rid(request))
