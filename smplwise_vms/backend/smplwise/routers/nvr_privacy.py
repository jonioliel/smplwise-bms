"""NVRMASK-295: privacy-mask read, preview and guarded apply (services/nvr_privacy.py). OFF by default (`nvr.privacy_mask_write`).

- `GET /cameras/{id}/privacy-mask` - the channel's mask as the NVR holds it, its etag and region limit (read-only; the
  NVR-settings read permissions, the camera in scope).
- `POST /nvr/privacy-masks/preview` - before -> after per camera with the etag each apply must carry; nothing is written.
- `POST /nvr/privacy-masks/apply` - `confirm: true` + the preview's etag per camera; one camera at a time, partial apply.
- The undo is the change log's `POST /nvr/changes/{id}/rollback` (routers/nvr_write.py -> nvr_privacy.restore_change).

Writes need `nvr.config.privacy` at installation scope and on every camera named (403, audited, before any device call).
The preview and the apply are local-only (remote_channel.BLOCKED_ON_REMOTE)."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from ..auth import current_principal, get_conn, settings_of
from ..db import unlocked
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, require
from ..recorder_scope import camera_settings
from ..services import nvr_privacy
from ..services.access import require_camera
from .nvr_write import _camera_config_scope, _require_read, _rid

router = APIRouter()

SKIP_CODES = ("stale", "validation", "nvr_not_supported", "source_forbidden")  # nothing was written for these: the next camera goes on


class RegionIn(BaseModel):
    points: list[list[int]] = Field(min_length=1, max_length=8)


class MaskItemIn(BaseModel):
    camera_id: str = Field(min_length=1, max_length=64)
    enabled: bool
    regions: list[RegionIn] = Field(default_factory=list, max_length=16)
    etag: str | None = Field(default=None, max_length=64)


class PreviewIn(BaseModel):
    items: list[MaskItemIn] = Field(min_length=1, max_length=nvr_privacy.MAX_ITEMS)


class ApplyIn(PreviewIn):
    confirm: bool = False


def _camera(conn: sqlite3.Connection, camera_id: str) -> sqlite3.Row:
    cam = conn.execute("SELECT * FROM cameras WHERE id = ?", (camera_id,)).fetchone()
    if not cam or cam["channel"] is None:
        raise ApiError(404, "not_found", "המצלמה לא נמצאה.", details={"camera_id": camera_id})
    return cam


def _name(cam: sqlite3.Row) -> str:
    return cam["alias"] or cam["name_source"] or f"ערוץ {cam['channel']}"


def _targets(conn: sqlite3.Connection, principal: Principal, items: list[MaskItemIn]) -> list[sqlite3.Row]:
    """The permission at installation, then on EVERY camera (audited 403 before 404, before any device call)."""
    require(conn, principal, nvr_privacy.PERMISSION, INSTALLATION)
    ids = [i.camera_id for i in items]
    if len(set(ids)) != len(ids):
        raise ApiError(422, "validation", "מצלמה מופיעה יותר מפעם אחת.")
    for cid in ids:
        require_camera(conn, principal, cid, nvr_privacy.PERMISSION)
    return [_camera(conn, cid) for cid in ids]


def _points(item: MaskItemIn) -> list[list[list[int]]]:
    return [r.points for r in item.regions]


@router.get("/cameras/{camera_id}/privacy-mask")
def get_privacy_mask(camera_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The channel's privacy mask as the NVR holds it (read-only): master switch, regions with the parser's active verdict, etag, limits."""
    _require_read(conn, principal)
    _camera_config_scope(conn, principal, camera_id, None)  # T055: 403 before 404
    cam = _camera(conn, camera_id)
    ch = int(cam["channel"])
    with unlocked(conn):
        info = nvr_privacy.read_mask(camera_settings(settings_of(request), cam), ch)
    return {"camera_id": camera_id, "channel": ch, "name": _name(cam), **nvr_privacy.view(info["xml"]), "etag": info["etag"],
            "max_regions": info["max_regions"], "points_per_region": nvr_privacy.POINTS_PER_REGION, "capabilities": info["capabilities"],
            "can_write": authorize(conn, principal, nvr_privacy.PERMISSION, INSTALLATION).allowed, "write_enabled": nvr_privacy.write_enabled(conn)}


@router.post("/nvr/privacy-masks/preview")
def preview(body: PreviewIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Read every camera, validate the request against it and answer before -> after; nothing is written."""
    cams = _targets(conn, principal, body.items)
    nvr_privacy.ensure_enabled(conn, principal, _rid(request))
    out: list[dict[str, Any]] = []
    for item, cam in zip(body.items, cams):
        ch = int(cam["channel"])
        row: dict[str, Any] = {"camera_id": cam["id"], "channel": ch, "name": _name(cam)}
        try:
            with unlocked(conn):
                info = nvr_privacy.read_mask(camera_settings(settings_of(request), cam), ch)
            before = nvr_privacy.view(info["xml"])
            clean = nvr_privacy.validate(item.enabled, _points(item), before["normalized"], info["max_regions"])
            after_doc = nvr_privacy.document(info["xml"], item.enabled, clean)
            unchanged = nvr_privacy.state(after_doc) == nvr_privacy.state(info["xml"])
            row |= {"status": "unchanged" if unchanged else "ready", "etag": info["etag"], "max_regions": info["max_regions"],
                    "before": before, "after": {"enabled": item.enabled, "regions": [{"id": str(i), "points": p} for i, p in enumerate(clean, start=1)]}}
        except ApiError as exc:
            row |= {"status": "invalid" if exc.code == "validation" else "skipped", "reason": exc.code, "message": exc.user_message,
                    "details": {k: v for k, v in exc.details.items() if k != "path"}}
        out.append(row)
    return {"items": out, "ready": sum(1 for r in out if r["status"] == "ready"), "unchanged": sum(1 for r in out if r["status"] == "unchanged"),
            "invalid": sum(1 for r in out if r["status"] == "invalid"), "skipped": sum(1 for r in out if r["status"] == "skipped")}


@router.post("/nvr/privacy-masks/apply")
def apply(body: ApplyIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Write the confirmed preview: one camera at a time, each against the etag the person saw. A camera that cannot be
    written (stale, invalid, unsupported) is skipped with its reason; the first failed WRITE stops the rest."""
    cams = _targets(conn, principal, body.items)
    nvr_privacy.ensure_enabled(conn, principal, _rid(request))
    if body.confirm is not True:
        raise ApiError(422, "confirm_required", "יש לאשר את כתיבת המסכות.")
    if any(not i.etag for i in body.items):
        raise ApiError(422, "preview_required", "יש להציג תצוגה מקדימה לפני הכתיבה.")
    from .cameras import _ZONES_CACHE

    results: list[dict[str, Any]] = []
    stopped = False
    for item, cam in zip(body.items, cams):
        ch = int(cam["channel"])
        base = {"camera_id": cam["id"], "channel": ch}
        if stopped:
            results.append({**base, "status": "not_attempted"})
            continue
        try:
            with unlocked(conn):
                rec = nvr_privacy.write_camera(camera_settings(settings_of(request), cam), conn, principal, camera_id=cam["id"], channel=ch, enabled=item.enabled,
                                               regions=_points(item), expected_etag=item.etag or "", request_id=_rid(request))
            results.append({**base, "status": rec["status"], "change_id": rec["id"]})
        except ApiError as exc:
            if exc.code in SKIP_CODES and "change_id" not in exc.details:
                results.append({**base, "status": "skipped", "reason": exc.code, "message": exc.user_message})
            else:
                results.append({**base, "status": "failed", "reason": exc.code, "message": exc.user_message,
                                "change_id": exc.details.get("change_id"), "restored": exc.details.get("restored")})
                stopped = True
        finally:
            _ZONES_CACHE.pop(cam["id"], None)
    count = {s: sum(1 for r in results if r["status"] == s) for s in ("applied", "unchanged", "skipped", "failed", "not_attempted")}
    return {"results": results, **count}
