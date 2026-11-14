"""NVRMASK-295: privacy-mask writes to the NVR (T075, the write half), OFF by default.

A privacy mask blacks out part of the picture in live view AND in the recording for as long as it is set, so the write
follows the guarded NVR write pattern (CR-020 S2 / bulk encoding) and is off until an administrator turns the switch on:

1. read the channel's `privacyMask` document (and its capability document when the device publishes one);
2. validate the requested regions against the device's normalized frame and region limit;
3. PREVIEW: before -> after per camera, with the etag of the document that was read (`preview` below);
4. APPLY with the literal `confirm: true` and the etag of the preview: a fresh read whose etag differs is refused
   (`stale`), so nothing the person did not see is ever written; one camera at a time, partial apply (a camera that cannot
   be written is skipped with its reason; the first WRITE failure stops the rest, which are reported `not_attempted`);
5. PUT the new document, then DELETE every region the device still holds that is not wanted (see the quirk below),
   read back and VERIFY the semantic state (master switch + polygons; the device reorders the points);
6. a failed or diverging write puts the original back at once (same delete-aware restore) and says whether it succeeded;
7. every attempt is a row of `nvr_changes` (kind `privacy_mask`, the original document kept as `before_xml`) plus an
   audit row; the generic undo (`POST /nvr/changes/{id}/rollback`) restores the original in one step through
   `restore_change` here, refused when the camera's mask changed since (etag of the after document).

Device quirks measured on the lab NVR (DS-7616NXI-K2 family, V4.84.101, supervised test 2026-10-20, docs/legacy/KNOWN_QUIRKS.md):
- `.../privacyMask/capabilities` answers 403 notSupport: the limits fall back to 4 regions of 4 points.
- A region's own `<enabled>` reads `false` while it masks the picture; only the master switch counts (nvr.parse_privacy_mask).
- PUT with fewer regions MERGES: stored regions stay until `DELETE .../privacyMask/regions/<id>`.

The permission is `nvr.config.privacy` (sensitive, never implied below the system administrator), at installation scope AND
on each camera. No response, audit row or log line carries a device address, user name, password, serial number or MAC.
"""
from __future__ import annotations

import hashlib
import json
import re
import sqlite3
from typing import Any

import httpx

from ..audit import audit
from ..config import Settings
from ..db import get_setting
from ..errors import ApiError
from ..recorder_scope import PRIMARY, settings_for
from . import nvr
from .nvr import _client, _get
from .nvr_write import _probe, _put, _record, get_change, response_status

KIND = "privacy_mask"
PERMISSION = "nvr.config.privacy"
SWITCH_KEY = "nvr.privacy_mask_write"  # "false" (default) = no preview, no write; the read and the undo stay available
DEFAULT_MAX_REGIONS = 4
POINTS_PER_REGION = 4
MIN_SIDE = 4  # normalized units: a region narrower or lower than this is refused (it would mask nothing visible)
MAX_ITEMS = 64

OFF_HE = "כתיבת מסכות פרטיות כבויה בהגדרות המערכת."
STALE_HE = "המסכה במצלמה השתנתה מאז התצוגה המקדימה; יש לקרוא אותה שוב."


def mask_path(channel: int) -> str:
    return f"/ISAPI/System/Video/inputs/channels/{channel}/privacyMask"


def region_path(channel: int, region_id: str | int) -> str:
    return f"{mask_path(channel)}/regions/{region_id}"


def write_enabled(conn: sqlite3.Connection) -> bool:
    return (get_setting(conn, SWITCH_KEY, "false") or "false") == "true"


def ensure_enabled(conn: sqlite3.Connection, principal: Any, request_id: str | None = None) -> None:
    if not write_enabled(conn):
        audit(conn, actor=principal, action="nvr.privacy_mask", decision="denied", resource_type="nvr", reason="feature_disabled", request_id=request_id)
        raise ApiError(409, "feature_disabled", OFF_HE, details={"setting": SWITCH_KEY})


# ---------------------------------------------------------------- pure helpers

def state(xml: str) -> dict[str, Any]:
    """The semantic state of a privacyMask document: the master switch and each stored region's polygon (points sorted -
    the device answers them in its own order). Region-level flags are ignored (quirk above)."""
    parsed = nvr.parse_privacy_mask(xml)
    return {"enabled": bool(parsed["enabled"]),
            "regions": {str(r["id"]): sorted([int(p[0]), int(p[1])] for p in r["points"]) for r in parsed["regions"]}}  # type: ignore[index]


def etag(xml: str) -> str:
    return hashlib.sha256(json.dumps(state(xml), sort_keys=True).encode("utf-8")).hexdigest()[:24]


def view(xml: str) -> dict[str, Any]:
    """What a screen or the preview shows: the parsed document (with the parser's active/inactive verdict per region)."""
    parsed = nvr.parse_privacy_mask(xml)
    return {"enabled": parsed["enabled"], "normalized": parsed["normalized"], "active_regions": parsed["active_regions"],
            "regions": [{"id": r["id"], "active": r["enabled"], "points": r["points"]} for r in parsed["regions"]]}  # type: ignore[union-attr]


def max_regions_from_caps(status: int, text: str) -> int:
    if status == 200:
        m = re.search(r"<PrivacyMaskRegionList[^>]*\bsize=\"(\d+)\"", text) or re.search(r"<maxRegionNum[^>]*>(\d+)<", text)
        if m and 0 < int(m.group(1)) <= 32:
            return int(m.group(1))
    return DEFAULT_MAX_REGIONS


def _cross(o: list[int], a: list[int], b: list[int]) -> int:
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])


def validate(enabled: bool, regions: list[list[list[int]]], normalized: dict[str, int], max_regions: int) -> list[list[list[int]]]:
    """The regions as the device will get them, or 422 `validation` naming the first problem. Each region: exactly four
    points inside the device's normalized frame, a convex non-degenerate quadrilateral at least MIN_SIDE wide and high."""
    width, height = int(normalized.get("width") or 704), int(normalized.get("height") or 576)
    if len(regions) > max_regions:
        raise ApiError(422, "validation", f"המצלמה מקבלת עד {max_regions} אזורי מסכה.", details={"max_regions": max_regions, "got": len(regions)})
    if enabled and not regions:
        raise ApiError(422, "validation", "מסכה פעילה צריכה לפחות אזור אחד.", details={"reason": "enabled_without_regions"})
    out: list[list[list[int]]] = []
    for i, pts in enumerate(regions):
        bad = {"region": i + 1}
        if len(pts) != POINTS_PER_REGION or any(len(p) != 2 for p in pts):
            raise ApiError(422, "validation", "כל אזור מסכה הוא מרובע של ארבע נקודות.", details={**bad, "reason": "points"})
        clean = [[int(p[0]), int(p[1])] for p in pts]
        if any(not (0 <= x <= width and 0 <= y <= height) for x, y in clean):
            raise ApiError(422, "validation", "נקודה מחוץ לתמונה.", details={**bad, "reason": "out_of_frame", "width": width, "height": height})
        if len({(x, y) for x, y in clean}) != POINTS_PER_REGION:
            raise ApiError(422, "validation", "נקודות כפולות באזור.", details={**bad, "reason": "duplicate_points"})
        xs, ys = [p[0] for p in clean], [p[1] for p in clean]
        if max(xs) - min(xs) < MIN_SIDE or max(ys) - min(ys) < MIN_SIDE:
            raise ApiError(422, "validation", "האזור קטן מדי.", details={**bad, "reason": "too_small", "min_side": MIN_SIDE})
        turns = [_cross(clean[k], clean[(k + 1) % 4], clean[(k + 2) % 4]) for k in range(4)]
        if not (all(t > 0 for t in turns) or all(t < 0 for t in turns)):
            raise ApiError(422, "validation", "האזור חייב להיות מרובע קמור.", details={**bad, "reason": "not_convex"})
        out.append(clean)
    return out


def _regions_xml(regions: list[list[list[int]]]) -> str:
    parts = []
    for i, pts in enumerate(regions, start=1):
        coords = "".join(f"<RegionCoordinates><positionX>{x}</positionX><positionY>{y}</positionY></RegionCoordinates>" for x, y in pts)
        parts.append(f"<PrivacyMaskRegion><id>{i}</id><enabled>true</enabled><RegionCoordinatesList>{coords}</RegionCoordinatesList></PrivacyMaskRegion>")
    return "".join(parts)


_LIST_RE = re.compile(r"<PrivacyMaskRegionList(?P<attrs>(?:\s[^>]*?)?)\s*(?:/>|>.*?</PrivacyMaskRegionList>)", re.S)


def document(xml: str, enabled: bool, regions: list[list[list[int]]]) -> str:
    """The device's own document with the master switch and the region list replaced (ids 1..n); everything else as read."""
    m = _LIST_RE.search(xml)
    if not m:
        raise ApiError(409, "nvr_not_supported", "במסמך המסכה אין רשימת אזורים לעריכה.")
    head = xml[: m.start()]
    em = re.search(r"<enabled>\s*(true|false)\s*</enabled>", head)
    if not em:
        raise ApiError(409, "nvr_not_supported", "במסמך המסכה אין מתג הפעלה לעריכה.")
    head = head[: em.start()] + f"<enabled>{'true' if enabled else 'false'}</enabled>" + head[em.end():]
    return head + f"<PrivacyMaskRegionList{m.group('attrs')}>{_regions_xml(regions)}</PrivacyMaskRegionList>" + xml[m.end():]


# ---------------------------------------------------------------- transport

def _delete(client: httpx.Client, path: str) -> None:
    try:
        r = client.delete(path)
    except httpx.HTTPError as exc:
        raise ApiError(503, "source_unavailable", "ה־NVR אינו זמין כרגע.", retryable=True, details={"path": path, "error": type(exc).__name__}) from exc
    code, sub = response_status(r.text)
    if r.status_code in (401, 403):
        raise ApiError(409 if sub == "notSupport" else 503, "nvr_not_supported" if sub == "notSupport" else "source_forbidden",
                       "ה־NVR דחה את מחיקת אזור המסכה.", details={"path": path, "status": r.status_code, "sub": sub})
    if r.status_code != 200 or (code is not None and code != 1):
        raise ApiError(409, "nvr_rejected", "ה־NVR דחה את מחיקת אזור המסכה.", details={"path": path, "status": r.status_code, "code": code, "sub": sub})


def _put_state(client: httpx.Client, channel: int, doc: str, wanted: dict[str, Any]) -> str:
    """PUT the document, then DELETE the stored regions that are not wanted (the device merges), and read back."""
    path = mask_path(channel)
    _put(client, path, doc)
    mid = _get(client, path)
    extra = [rid for rid in state(mid)["regions"] if rid not in wanted["regions"]]
    for rid in extra:
        _delete(client, region_path(channel, rid))
    return _get(client, path) if extra else mid


def _try_restore(client: httpx.Client, channel: int, original: str) -> bool:
    """True when the channel holds the original again - read first: a refused PUT usually left nothing to undo."""
    try:
        if state(_get(client, mask_path(channel))) == state(original):
            return True
        return state(_put_state(client, channel, original, state(original))) == state(original)
    except ApiError:
        return False


def read_mask(settings: Settings, channel: int, *, client: httpx.Client | None = None) -> dict[str, Any]:
    """GET the channel's document (and capability document) - read-only."""
    own = client is None
    c = client or _client(settings)
    try:
        status, text = _probe(c, mask_path(channel))
        if status in (401, 403, 404):
            raise ApiError(409, "nvr_not_supported", "הערוץ הזה אינו מפרסם מסכת פרטיות.", details={"status": status})
        if status != 200:
            raise ApiError(503, "source_error", "ה־NVR החזיר שגיאה.", retryable=True, details={"status": status})
        cs, ct = _probe(c, mask_path(channel) + "/capabilities")
    finally:
        if own:
            c.close()
    return {"xml": text, "etag": etag(text), "max_regions": max_regions_from_caps(cs, ct), "capabilities": "published" if cs == 200 else "not_published"}


# ---------------------------------------------------------------- change records

def _rec(conn: sqlite3.Connection, principal: Any, *, settings: Settings, camera_id: str, channel: int, before: str | None, after: str | None, status: str,
         error: str | None = None, note: str = "", rollback_of: str | None = None) -> dict[str, Any]:
    rec = _record(conn, principal, kind=KIND, permission=PERMISSION, target=f"privacy-{channel}", path=mask_path(channel), before=before, after=after,
                  status=status, error=error, rollback_of=rollback_of, note=note, recorder_id=settings.nvr_recorder_id)
    sb, sa = (state(before) if before else None), (state(after) if after else None)
    fields = {"enabled": [sb["enabled"] if sb else None, sa["enabled"] if sa else None],
              "regions": [len(sb["regions"]) if sb else None, len(sa["regions"]) if sa else None]}
    conn.execute("UPDATE nvr_changes SET camera_id = ?, etag_before = ?, etag_after = ?, fields_json = ? WHERE id = ?",
                 (camera_id, etag(before) if before else None, etag(after) if after else None, json.dumps(fields), rec["id"]))
    return {**rec, "camera_id": camera_id, "fields": fields}


def write_camera(settings: Settings, conn: sqlite3.Connection, principal: Any, *, camera_id: str, channel: int, enabled: bool,
                 regions: list[list[list[int]]], expected_etag: str, request_id: str | None = None, client: httpx.Client | None = None) -> dict[str, Any]:
    """One camera: fresh read + etag check, validate, PUT (+ DELETE of unwanted stored regions), read back, verify.
    A failure after the device was touched puts the original back and reports whether that worked."""
    own = client is None
    c = client or _client(settings)
    note = f"מסכת פרטיות: {'פעילה' if enabled else 'כבויה'} · {len(regions)} אזורים"
    try:
        info = read_mask(settings, channel, client=c)
        before = info["xml"]
        if info["etag"] != expected_etag:
            raise ApiError(409, "stale", STALE_HE, details={"camera_id": camera_id})
        clean = validate(enabled, regions, nvr.parse_privacy_mask(before)["normalized"], info["max_regions"])  # type: ignore[arg-type]
        after = document(before, enabled, clean)
        wanted = state(after)
        if wanted == state(before):
            return _rec(conn, principal, settings=settings, camera_id=camera_id, channel=channel, before=before, after=before, status="unchanged", note=note)
        try:
            verify = _put_state(c, channel, after, wanted)
        except ApiError as exc:
            restored = _try_restore(c, channel, before)
            rec = _rec(conn, principal, settings=settings, camera_id=camera_id, channel=channel, before=before, after=after, status="failed", error=exc.code, note=note)
            audit(conn, actor=principal, action="nvr.write", decision="denied", resource_type="nvr", resource_id=f"privacy-{channel}", reason=exc.code, request_id=request_id,
                  details={"kind": KIND, "camera_id": camera_id, "change_id": rec["id"], "restored": restored})
            exc.details = {**exc.details, "change_id": rec["id"], "restored": restored}
            raise
        if state(verify) != wanted:
            restored = _try_restore(c, channel, before)
            rec = _rec(conn, principal, settings=settings, camera_id=camera_id, channel=channel, before=before, after=verify, status="diverged", error="verify_mismatch", note=note)
            audit(conn, actor=principal, action="nvr.write", decision="denied", resource_type="nvr", resource_id=f"privacy-{channel}", reason="verify_mismatch", request_id=request_id,
                  details={"kind": KIND, "camera_id": camera_id, "change_id": rec["id"], "restored": restored})
            raise ApiError(409, "nvr_verify_mismatch", "ה־NVR לא שמר את המסכה כפי שנשלחה" + ("; המצב הקודם הוחזר." if restored else "; ההחזרה למצב הקודם לא אומתה."),
                           details={"change_id": rec["id"], "restored": restored})
    finally:
        if own:
            c.close()
    rec = _rec(conn, principal, settings=settings, camera_id=camera_id, channel=channel, before=before, after=verify, status="applied", note=note)
    audit(conn, actor=principal, action="nvr.write", decision="allowed", resource_type="nvr", resource_id=f"privacy-{channel}", request_id=request_id,
          details={"kind": KIND, "camera_id": camera_id, "change_id": rec["id"], "permission": PERMISSION, "fields": rec["fields"]})
    return rec


def restore_change(settings: Settings, conn: sqlite3.Connection, principal: Any, change_id: str, *, request_id: str | None = None,
                   client: httpx.Client | None = None) -> dict[str, Any]:
    """The one-step undo of a privacy-mask change: the original document back exactly (master switch AND stored regions,
    deleting the ones the change added). Refused when the camera's mask changed since this change (its after-etag)."""
    orig = get_change(conn, change_id)
    if not orig or orig["kind"] != KIND:
        raise ApiError(404, "not_found", "השינוי לא נמצא.")
    if orig["status"] != "applied" or not orig["before_xml"]:
        raise ApiError(409, "not_rollbackable", "אין לשינוי הזה מסמך קודם להחזיר.", details={"status": orig["status"]})
    m = re.search(r"/channels/(\d+)/privacyMask$", orig["path"])
    if not m:
        raise ApiError(409, "not_rollbackable", "נתיב השינוי אינו מוכר.")
    channel = int(m.group(1))
    rec_id = orig["recorder_id"] if "recorder_id" in orig.keys() else PRIMARY
    settings = settings_for(settings, rec_id)
    original = orig["before_xml"]
    own = client is None
    c = client or _client(settings)
    try:
        current = _get(c, mask_path(channel))
        if orig["etag_after"] and etag(current) != orig["etag_after"]:
            raise ApiError(409, "changed_since", "המסכה במצלמה שונתה מאז השינוי הזה; אין החזרה אוטומטית.", details={"change_id": change_id})
        verify = _put_state(c, channel, original, state(original))
    finally:
        if own:
            c.close()
    ok = state(verify) == state(original)
    if ok:
        conn.execute("UPDATE nvr_changes SET status = 'rolled_back' WHERE id = ?", (change_id,))
    rec = _rec(conn, principal, settings=settings, camera_id=orig["camera_id"] or "", channel=channel, before=current, after=verify,
               status="applied" if ok else "diverged", error=None if ok else "verify_mismatch", note=f"החזר של {change_id}", rollback_of=change_id)
    audit(conn, actor=principal, action="nvr.rollback", decision="allowed" if ok else "denied", resource_type="nvr", resource_id=f"privacy-{channel}",
          reason=None if ok else "verify_mismatch", request_id=request_id, details={"kind": KIND, "change_id": rec["id"], "rollback_of": change_id})
    if not ok:
        raise ApiError(409, "nvr_verify_mismatch", "ההחזרה לא אומתה: המסכה במצלמה אינה זהה למקור.", details={"change_id": rec["id"]})
    return rec
