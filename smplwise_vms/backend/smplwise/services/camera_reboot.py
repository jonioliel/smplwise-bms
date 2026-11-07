"""CAMERA-REBOOT-2407: reboot ONE camera (IPC) through its NVR (owner decision 2026-11-07; legacy parity row P09).

The legacy add-on (hikvision_nvr v1.5.27, `POST /api/nvr/cameras/{channel_id}/reboot`) sent ONE request to the NVR:
`GET /ISAPI/ContentMgmt/InputProxy/channels/{channel}/reboot` - the NVR proxies the reboot to the camera behind that channel
(the camera is never addressed directly, its own address and credentials stay on the NVR). Arx sends the same request shape.
The ISAPI documentation lists PUT for this resource, so when the device's answer proves the GET was NOT executed (HTTP 405, or
an ISAPI `notSupport` / `methodNotAllowed` answer) exactly ONE PUT follows. Any other failure is reported, never retried.

Guards, in order (the NVR reboot pattern of routers/nvr_write.py + the NVR-writes switch of services/nvr_write_switch.py):
  1. the sensitive permission `nvr.camera.reboot` at installation scope AND on the camera's own chain (T055 camera scope);
  2. the camera is known and has an NVR channel;
  3. the recorder speaks Hikvision ISAPI - Provision-ISR (and every other vendor) is refused: `camera_reboot_not_supported`
     (its API has no per-channel camera reboot Arx may use - docs/integrations/provision-isr/API_STUDY.md lists only the whole
     device `Reboot`, never from Arx);
  4. the recorder's switch "אפשר שינויי הגדרות ב־NVR" is on: `nvr_writes_off` otherwise;
  5. the confirmation (`confirm: true`, the screen's sensitive dialog);
  6. a rate limit: one reboot per camera every CAMERA_COOLDOWN_S, at most USER_PER_WINDOW reboots per user in USER_WINDOW_S.
Every refusal past the permission check and every outcome is an audit row `nvr.write` (`kind: camera_reboot`); a sent command
is a row of the NVR change log (no "before" document: it cannot be rolled back by mistake).
"""
from __future__ import annotations

import datetime as dt
import sqlite3
from typing import Any

import httpx

from ..audit import audit
from ..config import Settings
from ..errors import ApiError
from . import nvr_write_switch
from .nvr import _client
from .nvr_write import _record, response_status

PERMISSION = "nvr.camera.reboot"
KIND = "camera_reboot"
CAMERA_COOLDOWN_S = 300  # a camera takes 1-2 minutes to come back; a second press inside 5 minutes is refused
USER_PER_WINDOW = 3
USER_WINDOW_S = 600
NOT_EXECUTED_SUB = ("notSupport", "methodNotAllowed", "invalidOperation")


def reboot_path(channel: int) -> str:
    return f"/ISAPI/ContentMgmt/InputProxy/channels/{int(channel)}/reboot"


def vendor_of(settings: Settings) -> str:
    return str(settings.nvr_vendor or "").strip().lower() or "hikvision"


def supported(settings: Settings) -> bool:
    return vendor_of(settings) == "hikvision"


def writes_on(settings: Settings) -> bool:
    return nvr_write_switch.effective(settings.nvr_recorder_id, vendor_of(settings), dict(settings.nvr_extra or {}))


def _since(seconds: int) -> str:
    return (dt.datetime.now(dt.timezone.utc) - dt.timedelta(seconds=seconds)).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def cooldown_left(conn: sqlite3.Connection, camera_id: str) -> int:
    """Seconds until this camera may be rebooted again (0 = now). Counts commands the NVR accepted."""
    r = conn.execute("SELECT created_at FROM nvr_changes WHERE kind = ? AND camera_id = ? AND status IN ('applied', 'sending') ORDER BY created_at DESC LIMIT 1",
                     (KIND, camera_id)).fetchone()
    if r is None:
        return 0
    try:
        at = dt.datetime.fromisoformat(str(r["created_at"]).replace("Z", "+00:00"))
    except ValueError:
        return 0
    left = CAMERA_COOLDOWN_S - int((dt.datetime.now(dt.timezone.utc) - at).total_seconds())
    return max(0, left)


def user_count(conn: sqlite3.Connection, user_id: str | None) -> int:
    if not user_id:
        return 0
    return int(conn.execute("SELECT COUNT(*) FROM nvr_changes WHERE kind = ? AND actor_id = ? AND created_at >= ? AND status IN ('applied', 'failed', 'sending')",
                            (KIND, user_id, _since(USER_WINDOW_S))).fetchone()[0])


def state(conn: sqlite3.Connection, settings: Settings, camera_id: str, *, permitted: bool) -> dict[str, Any]:
    """What the camera screen shows: may this caller reboot this camera now, and if not, why (a closed list of reasons)."""
    reason: str | None = None
    if not supported(settings):
        reason = "not_supported"
    elif not permitted:
        reason = "no_permission"
    elif not writes_on(settings):
        reason = "writes_off"
    left = cooldown_left(conn, camera_id)
    if reason is None and left > 0:
        reason = "cooldown"
    return {"camera_id": camera_id, "supported": supported(settings), "permitted": permitted, "writes_enabled": writes_on(settings) if supported(settings) else False,
            "can_reboot": reason is None, "reason": reason, "cooldown_s": left, "recorder_id": settings.nvr_recorder_id}


def _deny(conn: sqlite3.Connection, principal: Any, camera_id: str, code: str, status: int, message: str, request_id: str | None, **details: Any) -> ApiError:
    audit(conn, actor=principal, action="nvr.write", decision="denied", resource_type="camera", resource_id=camera_id, reason=code, request_id=request_id,
          details={"kind": KIND, **details})
    return ApiError(status, code, message, details=details or None)


def _send(c: httpx.Client, path: str) -> tuple[bool, str, int]:
    """GET (the legacy request); one PUT only when the answer proves the GET was not executed. (ok, error code, http status)."""
    method_used = "GET"
    try:
        r = c.get(path)
        code, sub = response_status(r.text)
        if r.status_code == 405 or (sub in NOT_EXECUTED_SUB and r.status_code != 200):
            method_used = "PUT"
            r = c.put(path, content=b"", headers={"Content-Type": "application/xml"})
            code, sub = response_status(r.text)
    except httpx.HTTPError:
        return False, "source_unavailable", 0
    if r.status_code == 200 and (code is None or code == 1):
        return True, method_used, 200
    if r.status_code in (401, 403) and sub not in NOT_EXECUTED_SUB:
        return False, "source_forbidden", r.status_code
    if sub in NOT_EXECUTED_SUB or r.status_code == 405:
        return False, "nvr_not_supported", r.status_code
    return False, "nvr_rejected", r.status_code


MESSAGES = {
    "source_unavailable": ("ה־NVR אינו זמין כרגע.", 503),
    "source_forbidden": ("ה־NVR דחה את הבקשה (הרשאות המשתמש ב־NVR).", 503),
    "nvr_not_supported": ("ה־NVR אינו תומך בהפעלה מחדש של מצלמה בערוץ הזה.", 409),
    "nvr_rejected": ("ה־NVR דחה את פקודת ההפעלה מחדש.", 409),
}


def prepare(settings: Settings, conn: sqlite3.Connection, principal: Any, cam: Any, *, confirm: bool, request_id: str | None = None) -> dict[str, Any]:
    """Guards 2-6 under the request's write lock, then the change-log row (`sending`) that reserves the camera: a second request
    racing this one sees it and is rate limited. The router checked the permission and the camera scope."""
    camera_id = str(cam["id"])
    channel = cam["channel"]
    if channel is None:
        raise _deny(conn, principal, camera_id, "no_channel", 409, "למצלמה אין ערוץ NVR ידוע.", request_id)
    if not supported(settings):
        raise _deny(conn, principal, camera_id, "camera_reboot_not_supported", 409, "הפעלה מחדש של מצלמה אינה נתמכת עבור סוג ה־NVR הזה.", request_id,
                    vendor=vendor_of(settings))
    if not writes_on(settings):
        raise _deny(conn, principal, camera_id, "nvr_writes_off", 409, "שינויים ב־NVR כבויים. אפשר להפעיל אותם בהגדרות החיבור של ה־NVR.", request_id,
                    recorder_id=settings.nvr_recorder_id)
    if confirm is not True:
        raise _deny(conn, principal, camera_id, "confirm_required", 422, "יש לאשר את ההפעלה מחדש של המצלמה.", request_id)
    left = cooldown_left(conn, camera_id)
    if left > 0:
        raise _deny(conn, principal, camera_id, "rate_limited", 429, "המצלמה הופעלה מחדש לפני רגע. אפשר לנסות שוב בעוד כמה דקות.", request_id,
                    retry_after_s=left, scope="camera")
    if user_count(conn, getattr(principal, "user_id", None)) >= USER_PER_WINDOW:
        raise _deny(conn, principal, camera_id, "rate_limited", 429, "יותר מדי הפעלות מחדש ברצף. אפשר לנסות שוב בעוד כמה דקות.", request_id,
                    retry_after_s=USER_WINDOW_S, scope="user")
    path = reboot_path(int(channel))
    rec = _record(conn, principal, kind=KIND, permission=PERMISSION, target=f"camera-{int(channel)}", path=path, before=None, after=None, status="sending",
                  note=f"הפעלה מחדש של מצלמה בערוץ {int(channel)}", recorder_id=settings.nvr_recorder_id)
    conn.execute("UPDATE nvr_changes SET camera_id = ? WHERE id = ?", (camera_id, rec["id"]))
    return {"change_id": rec["id"], "camera_id": camera_id, "path": path}


def send(settings: Settings, path: str, *, client: httpx.Client | None = None) -> tuple[bool, str, int]:
    """The one device command (run outside the write lock). Never retried beyond the documented GET -> PUT method step."""
    try:
        c = client or _client(settings)
    except ApiError as exc:  # NVR-less / disabled recorder / no credentials: nothing was sent
        return False, exc.code, exc.status
    try:
        return _send(c, path)
    finally:
        if client is None:
            c.close()


def finish(settings: Settings, conn: sqlite3.Connection, principal: Any, ticket: dict[str, Any], outcome: tuple[bool, str, int], *,
           request_id: str | None = None) -> dict[str, Any]:
    """The outcome on the change-log row and the audit row; a refusal raises (never retried)."""
    ok, detail, status = outcome
    cid, camera_id, path = ticket["change_id"], ticket["camera_id"], ticket["path"]
    if not ok:
        conn.execute("UPDATE nvr_changes SET status = 'failed', error = ? WHERE id = ?", (detail, cid))
        audit(conn, actor=principal, action="nvr.write", decision="denied", resource_type="camera", resource_id=camera_id, reason=detail, request_id=request_id,
              details={"kind": KIND, "path": path, "change_id": cid, "status": status})
        message, http = MESSAGES.get(detail, ("ה־NVR אינו זמין כרגע.", status if 400 <= status < 600 else 503))
        raise ApiError(http, detail, message, retryable=False, details={"change_id": cid})
    conn.execute("UPDATE nvr_changes SET status = 'applied' WHERE id = ?", (cid,))
    audit(conn, actor=principal, action="nvr.write", decision="allowed", resource_type="camera", resource_id=camera_id, request_id=request_id,
          details={"kind": KIND, "path": path, "change_id": cid, "method": detail, "permission": PERMISSION, "recorder_id": settings.nvr_recorder_id})
    row = conn.execute("SELECT id, kind, target, status, note, created_at FROM nvr_changes WHERE id = ?", (cid,)).fetchone()
    return {**{k: row[k] for k in row.keys()}, "camera_id": camera_id, "cooldown_s": CAMERA_COOLDOWN_S}
