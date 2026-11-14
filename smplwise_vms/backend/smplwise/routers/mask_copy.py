"""MASKCOPY62-295 slice 1: plan / preview of copying privacy masks from one camera to others (services/mask_copy.py).

`POST /nvr/privacy-masks/copy/plan` reads the source and each target mask (GET only), maps the regions into every target's
frame, validates them against each target's limits and answers the per-camera result. It never writes to a device; the apply
slice does not exist yet. OFF by default (`nvr.privacy_mask_copy`). Needs `nvr.config.privacy` at installation scope and on the
source AND every target (403, audited, before any device call). Local-only (remote_channel.BLOCKED_ON_REMOTE covers the prefix)."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from ..audit import audit
from ..auth import current_principal, get_conn, settings_of
from ..db import unlocked
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, require
from ..recorder_scope import camera_settings
from ..services import mask_copy, nvr_privacy
from ..services.access import require_camera
from .nvr_privacy import _camera, _name
from .nvr_write import _rid

router = APIRouter()


class CopyPlanIn(BaseModel):
    source_camera_id: str = Field(min_length=1, max_length=64)
    target_camera_ids: list[str] = Field(min_length=1, max_length=mask_copy.MAX_TARGETS)
    mode: str = Field(default="add", pattern="^(add|replace)$")


@router.post("/nvr/privacy-masks/copy/plan")
def plan(body: CopyPlanIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, nvr_privacy.PERMISSION, INSTALLATION)
    ids = [body.source_camera_id, *body.target_camera_ids]
    if len(set(body.target_camera_ids)) != len(body.target_camera_ids):
        raise ApiError(422, "validation", "מצלמה מופיעה יותר מפעם אחת.")
    if body.source_camera_id in body.target_camera_ids:
        raise ApiError(422, "validation", "מצלמת המקור אינה יכולה להיות גם יעד.", details={"reason": "source_is_target"})
    for cid in ids:
        require_camera(conn, principal, cid, nvr_privacy.PERMISSION)
    mask_copy.ensure_enabled(conn, principal, _rid(request))
    src_cam = _camera(conn, body.source_camera_id)
    tgt_cams = [_camera(conn, cid) for cid in body.target_camera_ids]
    cfg = settings_of(request)
    with unlocked(conn):
        src_info = nvr_privacy.read_mask(camera_settings(cfg, src_cam), int(src_cam["channel"]))
    src_view = nvr_privacy.view(src_info["xml"])
    regions = [r["points"] for r in src_view["regions"] if r["active"] and r["points"]]
    if not src_view["enabled"] or not regions:
        raise ApiError(422, "validation", "במצלמת המקור אין מסכת פרטיות פעילה להעתקה.", details={"reason": "source_has_no_active_mask"})
    rows: list[dict[str, Any]] = []
    for cam in tgt_cams:
        row: dict[str, Any] = {"camera_id": cam["id"], "channel": int(cam["channel"]), "name": _name(cam)}
        try:
            with unlocked(conn):
                info = nvr_privacy.read_mask(camera_settings(cfg, cam), int(cam["channel"]))
            row |= mask_copy.plan_target(regions, src_view["normalized"], nvr_privacy.view(info["xml"]), info["max_regions"], body.mode)
            row["etag"] = info["etag"]
        except ApiError as exc:
            row |= {"status": "skipped", "reason": exc.code, "message": exc.user_message}
        rows.append(row)
    count = {s: sum(1 for r in rows if r["status"] == s) for s in ("ready", "unchanged", "invalid", "conflict", "skipped")}
    audit(conn, actor=principal, action="nvr.privacy_mask_copy", decision="allowed", resource_type="nvr", resource_id=body.source_camera_id, request_id=_rid(request),
          details={"stage": "plan", "mode": body.mode, "targets": len(rows), **count})
    return {"stage": "plan", "device_write": False, "mode": body.mode, "confirmation_required": True,
            "warnings": [{"code": "scene_must_match", "message": mask_copy.SCENE_WARNING_HE},
                         *([{"code": "frame_differs", "message": mask_copy.FRAME_WARNING_HE}] if any(r.get("frame_differs") for r in rows) else [])],
            "mapping": mask_copy.MIRROR_NOTE,
            "source": {"camera_id": src_cam["id"], "channel": int(src_cam["channel"]), "name": _name(src_cam), "frame": src_view["normalized"], "etag": src_info["etag"],
                       "regions": [{"id": r["id"], "points": r["points"]} for r in src_view["regions"] if r["active"]]},
            "items": rows, **count, "plan_digest": mask_copy.plan_digest(src_cam["id"], src_info["etag"], body.mode, rows)}
