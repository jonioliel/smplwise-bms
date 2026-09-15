"""Export jobs API (chapter 27, T048): estimate → job → progress/cancel → scoped download."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel

from ..audit import audit
from ..auth import current_principal, get_conn, settings_of
from ..db import unlocked
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, require
from ..services import exports as ex
from ..services.access import camera_allowed
from ..services.timeutil import parse_utc
from .settings import read_settings

router = APIRouter()


class RangeBody(BaseModel):
    camera_id: str
    from_at: str
    to_at: str


def _camera_for_export(conn: sqlite3.Connection, principal: Principal, camera_id: str) -> sqlite3.Row:
    cam = conn.execute("SELECT * FROM cameras WHERE id = ?", (camera_id,)).fetchone()
    if not cam:
        raise ApiError(404, "not_found", "המצלמה לא נמצאה.")
    if not camera_allowed(conn, principal, camera_id, "video.export"):
        require(conn, principal, "video.export", ("installation", "*"))
    if not cam["main_track"]:
        raise ApiError(409, "no_track", "למצלמה אין track הקלטה ידוע; הרץ סנכרון מצלמות.")
    return cam


def _range(body: RangeBody):
    try:
        return parse_utc(body.from_at), parse_utc(body.to_at)
    except ValueError:
        raise ApiError(422, "validation", "הזמנים חייבים להיות UTC (Z).")


def _owned(conn: sqlite3.Connection, principal: Principal, job_id: str) -> dict[str, Any]:
    job = ex.get_job(conn, job_id)
    if not job:
        raise ApiError(404, "not_found", "עבודת הייצוא לא נמצאה.")
    if job["owner_user_id"] != principal.user_id and not authorize(conn, principal, "system.configure", INSTALLATION).allowed:
        raise ApiError(403, "forbidden", "עבודת הייצוא שייכת למשתמש אחר.")
    return job


@router.post("/exports/estimate")
def estimate(body: RangeBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    cam = _camera_for_export(conn, principal, body.camera_id)
    start, end = _range(body)
    s = read_settings(conn)
    with unlocked(conn):
        out = ex.estimate(settings_of(request), conn, cam, start, end, s["time.zone"])
    out["max_bytes"] = s["exports.max_mb"] * 1024 * 1024
    return out


@router.post("/exports", status_code=201)
def create(body: RangeBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    cam = _camera_for_export(conn, principal, body.camera_id)
    start, end = _range(body)
    s = read_settings(conn)
    if end <= start:
        raise ApiError(422, "validation", "טווח הייצוא ריק.")
    if (end - start) > ex.MAX_RANGE:
        raise ApiError(422, "validation", "טווח ייצוא מקסימלי: 6 שעות.")
    active = conn.execute("SELECT COUNT(*) FROM export_jobs WHERE owner_user_id = ? AND state IN ('queued','running')", (principal.user_id,)).fetchone()[0]
    if active >= 5:
        raise ApiError(429, "too_many_jobs", "יש כבר 5 עבודות ייצוא ממתינות; המתן לסיומן.", retryable=True)
    job = ex.create_job(conn, settings_of(request), principal, cam, start, end, s["time.zone"], s["exports.max_mb"] * 1024 * 1024)
    audit(conn, actor=principal, action="video.export.create", decision="allowed", resource_type="camera", resource_id=cam["id"],
          request_id=getattr(request.state, "correlation_id", None), details={"job": job["id"], "from": job["requested_from"], "to": job["requested_to"], "files": len(job["files"]), "estimate_bytes": job.get("estimate_bytes")})
    return job


@router.get("/exports")
def list_jobs(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    admin = authorize(conn, principal, "system.configure", INSTALLATION).allowed
    return {"jobs": ex.list_jobs(conn, None if admin else principal.user_id), "ffmpeg": bool(ex.ffmpeg_path())}


@router.get("/exports/{job_id}")
def get_job(job_id: str, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return _owned(conn, principal, job_id)


@router.post("/exports/{job_id}/cancel")
def cancel(job_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    job = _owned(conn, principal, job_id)
    ex.request_cancel(conn, job_id)
    audit(conn, actor=principal, action="video.export.cancel", decision="allowed", resource_type="camera", resource_id=job["camera_id"],
          request_id=getattr(request.state, "correlation_id", None), details={"job": job_id})
    return ex.get_job(conn, job_id) or job


@router.delete("/exports/{job_id}")
def delete(job_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    job = _owned(conn, principal, job_id)
    ex.delete_job(conn, settings_of(request), job_id)
    audit(conn, actor=principal, action="video.export.delete", decision="allowed", resource_type="camera", resource_id=job["camera_id"],
          request_id=getattr(request.state, "correlation_id", None), details={"job": job_id})
    return {"id": job_id, "deleted": True}


@router.get("/exports/{job_id}/download")
def download(job_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)):
    job = _owned(conn, principal, job_id)
    path = ex.output_path(settings_of(request), job)
    if not path or job["state"] not in ("done", "partial"):
        raise ApiError(409, "not_ready", "הקובץ עדיין לא מוכן.")
    audit(conn, actor=principal, action="video.export.download", decision="allowed", resource_type="camera", resource_id=job["camera_id"],
          request_id=getattr(request.state, "correlation_id", None), details={"job": job_id, "bytes": path.stat().st_size, "sha256": job.get("sha256")})
    return FileResponse(path, media_type=job.get("media_type") or "application/octet-stream", filename=job.get("output_name") or path.name, headers={"Cache-Control": "private, no-store"})


@router.get("/exports/{job_id}/manifest")
def manifest(job_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)):
    job = _owned(conn, principal, job_id)
    p = ex.job_dir(settings_of(request), job_id) / "manifest.json"
    if not job.get("manifest") or not p.is_file():
        raise ApiError(409, "not_ready", "המניפסט עדיין לא נוצר.")
    return FileResponse(p, media_type="application/json", filename=f"manifest-{job_id}.json")
