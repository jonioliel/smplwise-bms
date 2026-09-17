"""Writes to the NVR (owner-approved on 2026-09-17, one capability at a time).

Every change goes the same way: GET the document, derive the new one, PUT it, GET it again to verify, keep both
documents in `nvr_changes` (rollback = PUT the old one), and write an audit row. The permission that allows a
change is a sensitive one - never implied by a built-in role, granted only through a custom role. Recordings
are never touched here.
"""
from __future__ import annotations

import re
import sqlite3
from collections.abc import Callable
from typing import Any

import httpx

from ..audit import audit
from ..config import Settings
from ..db import new_id, now_iso
from ..errors import ApiError
from .nvr import _client, _get

CENTER_BLOCK = "<EventTriggerNotification><id>center</id><notificationMethod>center</notificationMethod></EventTriggerNotification>"
SMART_TYPES = ("linedetection", "fielddetection", "regionEntrance", "regionExiting")
NOTIFY_TYPES = ("VMD",) + SMART_TYPES
TYPE_LABEL = {"VMD": "זיהוי תנועה", "linedetection": "חציית קו", "fielddetection": "פריצה לאזור", "regionEntrance": "כניסה לאזור", "regionExiting": "יציאה מאזור"}


def trigger_path(event_type: str, channel: int) -> str:
    return f"/ISAPI/Event/triggers/{event_type}-{channel}"


# ---------------------------------------------------------------- document helpers (pure)

def has_center(xml: str) -> bool:
    return re.search(r"<notificationMethod>\s*center\s*</notificationMethod>", xml) is not None


def with_center(xml: str, on: bool) -> str:
    """The trigger document with "Notify Surveillance Center" added or removed; other linkages stay as they are."""
    if on == has_center(xml):
        return xml
    if on:
        m = re.search(r"<EventTriggerNotificationList([^>]*)/>", xml)
        if m:
            return xml[: m.start()] + f"<EventTriggerNotificationList{m.group(1)}>{CENTER_BLOCK}</EventTriggerNotificationList>" + xml[m.end():]
        if "</EventTriggerNotificationList>" in xml:
            return xml.replace("</EventTriggerNotificationList>", CENTER_BLOCK + "</EventTriggerNotificationList>", 1)
        return xml.replace("</EventTrigger>", f"<EventTriggerNotificationList>{CENTER_BLOCK}</EventTriggerNotificationList></EventTrigger>", 1)
    return re.sub(r"<EventTriggerNotification>\s*<id>center</id>.*?</EventTriggerNotification>\s*", "", xml, count=1, flags=re.S)


def _normalize(xml: str) -> str:
    return re.sub(r"\s+", "", xml)


def response_status(xml: str) -> tuple[int | None, str | None]:
    code = re.search(r"<statusCode>(\d+)</statusCode>", xml)
    sub = re.search(r"<subStatusCode>(.*?)</subStatusCode>", xml)
    return (int(code.group(1)) if code else None), (sub.group(1) if sub else None)


# ---------------------------------------------------------------- transport

def _probe(client: httpx.Client, path: str) -> tuple[int, str]:
    try:
        r = client.get(path)
    except httpx.HTTPError as exc:
        raise ApiError(503, "source_unavailable", "ה־NVR אינו זמין כרגע.", retryable=True, details={"path": path, "error": type(exc).__name__}) from exc
    return r.status_code, r.text


def _put(client: httpx.Client, path: str, xml: str) -> str:
    try:
        r = client.put(path, content=xml.encode("utf-8"), headers={"Content-Type": "application/xml"})
    except httpx.HTTPError as exc:
        raise ApiError(503, "source_unavailable", "ה־NVR אינו זמין כרגע.", retryable=True, details={"path": path, "error": type(exc).__name__}) from exc
    code, sub = response_status(r.text)
    if r.status_code in (401, 403):
        if sub == "notSupport":
            raise ApiError(409, "nvr_not_supported", "ה־NVR אינו תומך בשינוי הזה בנתיב הזה.", details={"path": path})
        raise ApiError(503, "source_forbidden", "ה־NVR דחה את הכתיבה (הרשאות המשתמש ב־NVR).", details={"path": path, "status": r.status_code, "sub": sub})
    if r.status_code != 200 or (code is not None and code != 1):
        raise ApiError(409, "nvr_rejected", "ה־NVR דחה את המסמך.", details={"path": path, "status": r.status_code, "code": code, "sub": sub})
    return r.text


# ---------------------------------------------------------------- change records

def _row(r: sqlite3.Row) -> dict[str, Any]:
    return {k: r[k] for k in r.keys() if k not in ("before_xml", "after_xml")} | {"has_before": bool(r["before_xml"]), "has_after": bool(r["after_xml"])}


def list_changes(conn: sqlite3.Connection, limit: int = 50) -> list[dict[str, Any]]:
    return [_row(r) for r in conn.execute("SELECT * FROM nvr_changes ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()]


def get_change(conn: sqlite3.Connection, change_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM nvr_changes WHERE id = ?", (change_id,)).fetchone()


def _record(conn: sqlite3.Connection, principal: Any, *, kind: str, permission: str, target: str, path: str, before: str | None, after: str | None,
            status: str, error: str | None = None, rollback_of: str | None = None, note: str = "") -> dict[str, Any]:
    cid = new_id()
    conn.execute(
        "INSERT INTO nvr_changes(id, kind, permission, target, path, before_xml, after_xml, status, error, rollback_of, note, actor_id, actor_username, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (cid, kind, permission, target, path, before, after, status, error, rollback_of, note, getattr(principal, "user_id", None), getattr(principal, "username", None), now_iso()),
    )
    return _row(get_change(conn, cid))  # type: ignore[arg-type]


def apply_change(settings: Settings, conn: sqlite3.Connection, principal: Any, *, kind: str, permission: str, target: str, path: str,
                 mutate: Callable[[str], str], note: str = "", request_id: str | None = None, client: httpx.Client | None = None) -> dict[str, Any]:
    """GET → mutate → PUT → GET-verify → record + audit. `unchanged` when the document already says what was asked.
    The caller holds the request's connection; NVR I/O happens on `client` (opened here unless given)."""
    own = client is None
    c = client or _client(settings)
    try:
        before = _get(c, path)
        after = mutate(before)
        if after == before:
            return _record(conn, principal, kind=kind, permission=permission, target=target, path=path, before=before, after=after, status="unchanged", note=note)
        try:
            _put(c, path, after)
        except ApiError as exc:
            rec = _record(conn, principal, kind=kind, permission=permission, target=target, path=path, before=before, after=after, status="failed", error=exc.code, note=note)
            audit(conn, actor=principal, action="nvr.write", decision="denied", resource_type="nvr", resource_id=target, reason=exc.code, request_id=request_id, details={"kind": kind, "path": path, "change_id": rec["id"]})
            raise
        verify = _get(c, path)
    finally:
        if own:
            c.close()
    if _normalize(verify) == _normalize(before):
        # the device answered OK but kept its old document (e.g. a sensitivity outside the values it accepts)
        rec = _record(conn, principal, kind=kind, permission=permission, target=target, path=path, before=before, after=verify, status="no_effect", note=note)
        audit(conn, actor=principal, action="nvr.write", decision="denied", resource_type="nvr", resource_id=target, reason="no_effect", request_id=request_id, details={"kind": kind, "path": path, "change_id": rec["id"]})
        raise ApiError(409, "nvr_no_effect", "ה־NVR אישר את הכתיבה אבל לא שינה את ההגדרה (ערך מחוץ לטווח שהמכשיר מקבל?).", details={"path": path, "change_id": rec["id"]})
    rec = _record(conn, principal, kind=kind, permission=permission, target=target, path=path, before=before, after=verify, status="applied", note=note)
    audit(conn, actor=principal, action="nvr.write", decision="allowed", resource_type="nvr", resource_id=target, request_id=request_id,
          details={"kind": kind, "path": path, "change_id": rec["id"], "permission": permission, "note": note})
    return rec


def rollback(settings: Settings, conn: sqlite3.Connection, principal: Any, change_id: str, *, request_id: str | None = None, client: httpx.Client | None = None) -> dict[str, Any]:
    """PUT the document the change replaced; recorded as its own change pointing back at the original."""
    orig = get_change(conn, change_id)
    if not orig:
        raise ApiError(404, "not_found", "השינוי לא נמצא.")
    if orig["status"] not in ("applied", "rolled_back") or not orig["before_xml"]:
        raise ApiError(409, "not_rollbackable", "אין לשינוי הזה מסמך קודם להחזיר.", details={"status": orig["status"]})
    own = client is None
    c = client or _client(settings)
    try:
        _put(c, orig["path"], orig["before_xml"])
        verify = _get(c, orig["path"])
    finally:
        if own:
            c.close()
    conn.execute("UPDATE nvr_changes SET status = 'rolled_back' WHERE id = ?", (change_id,))
    rec = _record(conn, principal, kind=orig["kind"], permission=orig["permission"], target=orig["target"], path=orig["path"], before=orig["after_xml"], after=verify,
                  status="applied", rollback_of=change_id, note=f"החזר של {change_id}")
    audit(conn, actor=principal, action="nvr.rollback", decision="allowed", resource_type="nvr", resource_id=orig["target"], request_id=request_id,
          details={"kind": orig["kind"], "path": orig["path"], "change_id": rec["id"], "rollback_of": change_id})
    return rec


# ---------------------------------------------------------------- B2: motion detection grid + sensitivity

def motion_path(channel: int) -> str:
    return f"/ISAPI/System/Video/inputs/channels/{channel}/motionDetection"


_MOTION_CAPS: dict[int, dict[str, int]] = {}


def motion_capabilities(settings: Settings, channel: int, *, client: httpx.Client | None = None) -> dict[str, int]:
    """min / max / step of the sensitivity as the device reports them (cached per process); defaults 0 / 100 / 1."""
    if channel in _MOTION_CAPS:
        return _MOTION_CAPS[channel]
    own = client is None
    c = client or _client(settings)
    try:
        status, text = _probe(c, motion_path(channel) + "/capabilities")
    finally:
        if own:
            c.close()
    caps = {"min": 0, "max": 100, "step": 1}
    if status == 200:
        m = re.search(r"<sensitivityLevel([^>]*)>", text)
        if m:
            for key in ("min", "max", "step"):
                v = re.search(rf'{key}="(\d+)"', m.group(1))
                if v:
                    caps[key] = int(v.group(1))
    _MOTION_CAPS[channel] = caps
    return caps


def snap_sensitivity(value: int, caps: dict[str, int]) -> int:
    """The nearest value the device accepts (its min / max / step) - a value in between is silently ignored by the NVR."""
    step = max(1, caps.get("step", 1))
    lo, hi = caps.get("min", 0), caps.get("max", 100)
    snapped = lo + round((value - lo) / step) * step
    return max(lo, min(hi, snapped))


def bits_to_hex(cells: list[list[bool]], cols: int) -> str:
    """Inverse of nvr._hex_bits: each row packed MSB-first into ceil(cols/8) bytes, rows concatenated as hex."""
    row_bytes = (cols + 7) // 8
    width = row_bytes * 8
    out = []
    for row in cells:
        value = 0
        for c in range(cols):
            if c < len(row) and row[c]:
                value |= 1 << (width - 1 - c)
        out.append(format(value, f"0{row_bytes * 2}x"))
    return "".join(out)


def motion_document(xml: str, *, cells: list[list[bool]] | None, sensitivity: int | None, enabled: bool | None) -> str:
    """The motionDetection document with a new grid / sensitivity / enabled flag; every other setting stays as it is.
    The grid must match the device's granularity (rows x columns) - anything else is refused before any write."""
    rows_m = re.search(r"<rowGranularity>(\d+)</rowGranularity>", xml)
    cols_m = re.search(r"<columnGranularity>(\d+)</columnGranularity>", xml)
    if cells is not None:
        if not rows_m or not cols_m:
            raise ApiError(409, "nvr_not_supported", "המצלמה אינה מדווחת רשת זיהוי (regionType אינו grid).")
        rows, cols = int(rows_m.group(1)), int(cols_m.group(1))
        if len(cells) != rows or any(len(r) != cols for r in cells):
            raise ApiError(422, "validation", "הרשת אינה תואמת את המצלמה.", details={"rows": rows, "cols": cols, "got_rows": len(cells), "got_cols": len(cells[0]) if cells else 0})
        if not re.search(r"<gridMap>[0-9a-fA-F]*</gridMap>", xml):
            raise ApiError(409, "nvr_not_supported", "במסמך אין gridMap לעריכה.")
        xml = re.sub(r"<gridMap>[0-9a-fA-F]*</gridMap>", f"<gridMap>{bits_to_hex(cells, cols)}</gridMap>", xml, count=1)
    if sensitivity is not None:
        if not 0 <= sensitivity <= 100:
            raise ApiError(422, "validation", "רגישות בין 0 ל־100.")
        if not re.search(r"<sensitivityLevel>\d+</sensitivityLevel>", xml):
            raise ApiError(409, "nvr_not_supported", "במסמך אין sensitivityLevel לעריכה.")
        xml = re.sub(r"<sensitivityLevel>\d+</sensitivityLevel>", f"<sensitivityLevel>{sensitivity}</sensitivityLevel>", xml, count=1)
    if enabled is not None:
        xml = re.sub(r"(<MotionDetection[^>]*>\s*)<enabled>(true|false)</enabled>", lambda m: f"{m.group(1)}<enabled>{'true' if enabled else 'false'}</enabled>", xml, count=1)
    return xml


# ---------------------------------------------------------------- B1: Notify Surveillance Center

def notify_status(settings: Settings, channels: list[int], *, client: httpx.Client | None = None) -> dict[int, dict[str, Any]]:
    """Per channel: for motion and each smart event type, whether the trigger exists and whether it notifies the
    surveillance centre (a 403 notSupport / 404 means the type is not configured for that channel)."""
    own = client is None
    c = client or _client(settings)
    out: dict[int, dict[str, Any]] = {}
    try:
        for ch in channels:
            types: dict[str, dict[str, Any]] = {}
            for t in NOTIFY_TYPES:
                status, text = _probe(c, trigger_path(t, ch))
                types[t] = {"supported": status == 200, "center": has_center(text) if status == 200 else None}
            out[ch] = types
    finally:
        if own:
            c.close()
    return out
