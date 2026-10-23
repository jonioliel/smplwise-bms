"""MASKCOPY62-295 (slice 1): plan / preview of copying one camera's privacy masks to other cameras. NO device write.

Pure planning on top of the NVRMASK-295 reads (`nvr_privacy.read_mask`, a GET) and validation (`nvr_privacy.validate`):

- a mask is stored in the device's normalized frame (704x576 on the lab family), so a region maps between cameras by scaling
  each axis by target/source frame size (rounded, clamped to the frame). That is geometrically right ONLY when both cameras
  view the same scene from the same place; every plan carries that warning and `confirmation_required: true`;
- two modes: `add` (default - the target keeps the regions it has, the copied ones are appended, identical ones are not
  duplicated; never removes an existing mask) and `replace` (the target ends with exactly the copied regions);
- per target a status: `ready`, `unchanged`, `invalid` (a scaled region fails the device rules), `conflict` (too many
  regions for the target's limit), `skipped` (the target cannot be read / has no mask support);
- `plan_digest` binds the plan to the source and target etags and the resulting states, for the later apply slice.

Nothing here writes to a device, and the apply slice (not built) must go through nvr_privacy.write_camera with the owner's
per-action approval. Responses carry no device address, user name, password, serial number or MAC.
"""
from __future__ import annotations

import hashlib
import json
import sqlite3
from typing import Any

from ..audit import audit
from ..db import get_setting
from ..errors import ApiError
from . import nvr_privacy

SWITCH_KEY = "nvr.privacy_mask_copy"  # "false" (default) = no plan
MODES = ("add", "replace")
MAX_TARGETS = nvr_privacy.MAX_ITEMS
OFF_HE = "העתקת מסכות פרטיות כבויה בהגדרות המערכת."
SCENE_WARNING_HE = "המסכה נכונה גיאומטרית רק אם המצלמות מצלמות את אותה סצנה מאותו מקום; יש לבדוק כל מצלמה בתצוגה המקדימה."
FRAME_WARNING_HE = "גודל המסגרת המנורמלת שונה בין המצלמות; הקואורדינטות הותאמו ביחס."
MIRROR_NOTE = "points are scaled per axis (x by target/source width, y by target/source height); no rotation, mirror or lens correction"


def copy_enabled(conn: sqlite3.Connection) -> bool:
    return (get_setting(conn, SWITCH_KEY, "false") or "false") == "true"


def ensure_enabled(conn: sqlite3.Connection, principal: Any, request_id: str | None = None) -> None:
    if not copy_enabled(conn):
        audit(conn, actor=principal, action="nvr.privacy_mask_copy", decision="denied", resource_type="nvr", reason="feature_disabled", request_id=request_id)
        raise ApiError(409, "feature_disabled", OFF_HE, details={"setting": SWITCH_KEY})


def _frame(norm: dict[str, Any]) -> dict[str, int]:
    return {"width": int(norm.get("width") or 704), "height": int(norm.get("height") or 576)}


def scale_points(points: list[list[int]], src: dict[str, Any], dst: dict[str, Any]) -> list[list[int]]:
    """One polygon from the source frame into the target frame: per-axis ratio, rounded half up, clamped to the frame."""
    s, d = _frame(src), _frame(dst)
    out = []
    for x, y in points:
        out.append([min(max(int(x * d["width"] / s["width"] + 0.5), 0), d["width"]),
                    min(max(int(y * d["height"] / s["height"] + 0.5), 0), d["height"])])
    return out


def _key(points: list[list[int]]) -> tuple[tuple[int, int], ...]:
    return tuple(sorted((int(p[0]), int(p[1])) for p in points))


def plan_target(source_regions: list[list[list[int]]], source_frame: dict[str, Any], target_view: dict[str, Any], target_max: int, mode: str) -> dict[str, Any]:
    """The plan for one readable target: the regions it would end with, per-region problems and the status."""
    frame = _frame(target_view["normalized"])
    existing = [r["points"] for r in target_view["regions"] if r["points"]]
    copied: list[list[list[int]]] = []
    problems: list[dict[str, Any]] = []
    for i, pts in enumerate(source_regions, start=1):
        scaled = scale_points(pts, source_frame, frame)
        try:
            copied.append(nvr_privacy.validate(True, [scaled], frame, target_max)[0])
        except ApiError as exc:
            problems.append({"source_region": i, "reason": exc.details.get("reason", exc.code), "points": scaled})
    base: dict[str, Any] = {"frame": frame, "frame_differs": frame != _frame(source_frame), "max_regions": target_max,
                            "before": {"enabled": bool(target_view["enabled"]), "regions": [{"id": r["id"], "points": r["points"]} for r in target_view["regions"]]}}
    if problems:
        return {**base, "status": "invalid", "reason": "validation", "problems": problems}
    if mode == "replace":
        final = copied
    else:
        final = []
        seen: set[tuple[tuple[int, int], ...]] = set()
        for p in [*existing, *copied]:
            if _key(p) not in seen:
                seen.add(_key(p))
                final.append(p)
    if len(final) > target_max:
        return {**base, "status": "conflict", "reason": "too_many_regions",
                "details": {"max_regions": target_max, "needed": len(final), "existing": len(existing), "copied": len(copied)}}
    try:
        final = nvr_privacy.validate(True, final, frame, target_max)
    except ApiError as exc:  # a region the target already holds fails the device rules: it is not rewritten silently
        return {**base, "status": "conflict", "reason": exc.details.get("reason", exc.code), "details": {"existing_region_invalid": True}}
    same = bool(target_view["enabled"]) and {_key(p) for p in final} == {_key(p) for p in existing} and len(final) == len(existing)
    after = {"enabled": True, "regions": [{"id": str(i), "points": p} for i, p in enumerate(final, start=1)]}
    return {**base, "status": "unchanged" if same else "ready", "after": after,
            "added": 0 if mode == "replace" else max(0, len(final) - len(existing)),
            "removed": len({_key(p) for p in existing} - {_key(p) for p in final})}


def plan_digest(source_id: str, source_etag: str, mode: str, rows: list[dict[str, Any]]) -> str:
    material = {"source": source_id, "source_etag": source_etag, "mode": mode,
                "targets": [{"camera_id": r["camera_id"], "status": r["status"], "etag": r.get("etag"), "after": r.get("after")} for r in rows]}
    return hashlib.sha256(json.dumps(material, sort_keys=True).encode("utf-8")).hexdigest()[:32]
