"""Owner-approved NVR writes: the "Notify Surveillance Center" linkage per channel (B1) and the change log with
rollback. Reading the state needs system.configure; writing needs the sensitive permission of the capability."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field

from ..audit import audit
from ..auth import current_principal, get_conn, settings_of
from ..db import unlocked
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, require
from ..services import nvr, nvr_schedule, nvr_system, nvr_write

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


class RecordIn(BaseModel):
    minutes: int = Field(default=10, ge=1, le=nvr_write.MANUAL_MAX_MIN)


def _camera_for_record(conn: sqlite3.Connection, principal: Principal, camera_id: str) -> sqlite3.Row:
    from ..services.access import require_camera

    cam = conn.execute("SELECT * FROM cameras WHERE id = ?", (camera_id,)).fetchone()
    if not cam:
        raise ApiError(404, "not_found", "המצלמה לא נמצאה.")
    require(conn, principal, "nvr.record.manual", INSTALLATION)
    require_camera(conn, principal, camera_id, "video.live")
    return cam


@router.get("/cameras/{camera_id}/record")
def record_status(camera_id: str, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """A1: the manual recording the VMS started for this camera (if any) and whether the caller may start one."""
    cam = conn.execute("SELECT * FROM cameras WHERE id = ?", (camera_id,)).fetchone()
    if not cam:
        raise ApiError(404, "not_found", "המצלמה לא נמצאה.")
    can = authorize(conn, principal, "nvr.record.manual", INSTALLATION).allowed
    return {"camera_id": camera_id, "active": nvr_write.manual_row(nvr_write.manual_active(conn, camera_id)), "can_write": can, "max_minutes": nvr_write.MANUAL_MAX_MIN, "track_id": cam["main_track"]}


@router.post("/cameras/{camera_id}/record/start", status_code=201)
def record_start(camera_id: str, body: RecordIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Start a manual recording on the camera's main track; the VMS stops it after `minutes` (default 10)."""
    cam = _camera_for_record(conn, principal, camera_id)
    if not cam["main_track"]:
        raise ApiError(409, "no_track", "למצלמה אין track ראשי ידוע (גילוי מה־NVR עדיין לא רץ).")
    with unlocked(conn):
        pass
    return nvr_write.start_manual(settings_of(request), conn, principal, camera_id, int(cam["main_track"]), body.minutes, request_id=_rid(request))


@router.post("/cameras/{camera_id}/record/stop")
def record_stop(camera_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _camera_for_record(conn, principal, camera_id)
    r = nvr_write.stop_manual(settings_of(request), conn, principal, camera_id, request_id=_rid(request))
    if not r:
        raise ApiError(409, "not_recording", "אין הקלטה ידנית פעילה למצלמה הזו.")
    return r


# ---------------------------------------------------------------- 0.1.71: system (clock, storage, outputs, reboot, connection)

def _can(conn: sqlite3.Connection, principal: Principal) -> dict[str, bool]:
    return {key: authorize(conn, principal, perm, INSTALLATION).allowed for key, perm in
            (("time", "nvr.config.time"), ("storage", "nvr.storage.test"), ("alarm", "nvr.alarm_output"), ("reboot", "nvr.system.reboot"), ("osd", "nvr.config.osd"), ("connection", "system.configure"))}


@router.get("/nvr/system")
def system_status(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Clock + NTP, disks with S.M.A.R.T., alarm outputs - read-only, with what this user may write."""
    _require_read(conn, principal)
    settings = settings_of(request)
    out: dict[str, Any] = {"time": None, "disks": [], "outputs": [], "errors": {}, "can": _can(conn, principal)}
    with unlocked(conn):
        client = nvr_write._client(settings)
        try:
            for key, fn in (("time", lambda: nvr_system.time_status(settings, client=client)), ("disks", lambda: nvr_system.hdd_list(settings, client=client)), ("outputs", lambda: nvr_system.alarm_outputs(settings, client=client))):
                try:
                    out[key] = fn()
                except ApiError as exc:
                    out["errors"][key] = exc.code
        finally:
            client.close()
    return out


class TimeIn(BaseModel):
    sync_now: bool = False
    mode: str | None = Field(default=None, pattern="^(NTP|manual)$")


@router.put("/nvr/time")
def set_time(body: TimeIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "nvr.config.time", INSTALLATION)
    if not body.sync_now and not body.mode:
        raise ApiError(422, "validation", "אין מה לכתוב: סנכרון או מצב.")
    with unlocked(conn):
        if body.sync_now:
            return nvr_system.sync_clock(settings_of(request), conn, principal, mode=body.mode, request_id=_rid(request))
        return nvr_system.set_time_mode(settings_of(request), conn, principal, mode=body.mode or "NTP", request_id=_rid(request))


class NtpIn(BaseModel):
    host: str = Field(min_length=1, max_length=120, pattern=r"^[A-Za-z0-9.\-]+$")
    port: int = Field(default=123, ge=1, le=65535)
    interval_min: int | None = Field(default=None, ge=1, le=10080)


@router.put("/nvr/ntp")
def set_ntp(body: NtpIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "nvr.config.time", INSTALLATION)
    with unlocked(conn):
        return nvr_system.set_ntp(settings_of(request), conn, principal, host=body.host, port=body.port, interval_min=body.interval_min, request_id=_rid(request))


@router.post("/nvr/outputs/{output_id}/pulse", status_code=201)
def pulse_output(output_id: int, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "nvr.alarm_output", INSTALLATION)
    with unlocked(conn):
        return nvr_system.pulse_output(settings_of(request), conn, principal, output_id, request_id=_rid(request))


class SmartIn(BaseModel):
    kind: str = Field(default="short", pattern="^(short|extended)$")


@router.post("/nvr/storage/{hdd_id}/smart-test", status_code=201)
def smart_test(hdd_id: int, body: SmartIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "nvr.storage.test", INSTALLATION)
    with unlocked(conn):
        return nvr_system.start_smart_test(settings_of(request), conn, principal, hdd_id, body.kind, request_id=_rid(request))


class RebootIn(BaseModel):
    confirm: str = Field(max_length=20)


@router.post("/nvr/reboot", status_code=201)
def reboot_nvr(body: RebootIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The typed word is the second confirmation the owner asked for (no live video / recording for 1-2 minutes)."""
    require(conn, principal, "nvr.system.reboot", INSTALLATION)
    if body.confirm.strip().upper() != "RESTART":
        raise ApiError(422, "confirm_required", "יש להקליד RESTART כדי להפעיל מחדש.")
    with unlocked(conn):
        return nvr_system.reboot(settings_of(request), conn, principal, request_id=_rid(request))


@router.get("/nvr/connection")
def get_connection(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "system.configure", INSTALLATION)
    return nvr_system.connection_view(settings_of(request))


class ConnectionIn(BaseModel):
    host: str = Field(min_length=1, max_length=120, pattern=r"^[A-Za-z0-9.\-]+$")
    http_port: int = Field(default=80, ge=1, le=65535)
    rtsp_port: int = Field(default=554, ge=1, le=65535)
    user: str = Field(min_length=1, max_length=64)
    password: str | None = Field(default=None, max_length=128)  # absent = keep the current one


@router.put("/nvr/connection")
def set_connection(body: ConnectionIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """D4: test the new connection (deviceInfo), then persist it - Supervisor options + add-on restart inside HA, a
    data-dir file on a workstation - and use it in this process right away."""
    require(conn, principal, "system.configure", INSTALLATION)
    settings = settings_of(request)
    new = nvr_system.with_connection(settings, host=body.host, http_port=body.http_port, rtsp_port=body.rtsp_port, user=body.user, password=body.password)
    with unlocked(conn):
        info = nvr.device_info(new)  # raises source_unavailable / source_forbidden when the details are wrong
        where = nvr_system.save_connection(settings, new)
    request.app.state.settings = new
    audit(conn, actor=principal, action="nvr.connection.update", decision="allowed", resource_type="nvr", resource_id="connection", request_id=_rid(request),
          details={"host": body.host, "http_port": body.http_port, "rtsp_port": body.rtsp_port, "user": body.user, "password_changed": body.password is not None, "saved": where})
    return {"saved": where, "device": info, "restarting": where == "supervisor", **nvr_system.connection_view(new)}


class OsdIn(BaseModel):
    name_enabled: bool | None = None
    datetime_enabled: bool | None = None
    date_style: str | None = Field(default=None, pattern="^(MM-DD-YYYY|DD-MM-YYYY|YYYY-MM-DD|MM/DD/YYYY|DD/MM/YYYY|YYYY/MM/DD)$")
    time_style: str | None = Field(default=None, pattern="^(24hour|12hour)$")
    display_week: bool | None = None


def _channel_of(conn: sqlite3.Connection, camera_id: str) -> tuple[sqlite3.Row, int]:
    cam = conn.execute("SELECT id, channel, alias, name_source FROM cameras WHERE id = ?", (camera_id,)).fetchone()
    if not cam or cam["channel"] is None:
        raise ApiError(404, "not_found", "המצלמה לא נמצאה.")
    return cam, int(cam["channel"])


@router.get("/cameras/{camera_id}/osd")
def get_osd(camera_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _require_read(conn, principal)
    cam, ch = _channel_of(conn, camera_id)
    with unlocked(conn):
        st = nvr_system.osd_status(settings_of(request), ch)
    return {**st, "camera_id": camera_id, "channel": ch, "vms_name": cam["alias"] or cam["name_source"] or f"ערוץ {ch}",
            "can_write": authorize(conn, principal, "nvr.config.osd", INSTALLATION).allowed, "date_styles": list(nvr_system.DATE_STYLES)}


@router.put("/cameras/{camera_id}/osd")
def set_osd(camera_id: str, body: OsdIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "nvr.config.osd", INSTALLATION)
    _cam, ch = _channel_of(conn, camera_id)
    parts = [p for p, v in (("שם", body.name_enabled), ("תאריך ושעה", body.datetime_enabled), ("פורמט תאריך", body.date_style), ("פורמט שעה", body.time_style), ("יום בשבוע", body.display_week)) if v is not None]
    if not parts:
        raise ApiError(422, "validation", "אין מה לכתוב.")
    with unlocked(conn):
        return nvr_write.apply_change(settings_of(request), conn, principal, kind="osd", permission="nvr.config.osd", target=f"osd-{ch}", path=nvr_system.overlays_path(ch),
                                      mutate=lambda x: nvr_system.osd_document(x, name_enabled=body.name_enabled, datetime_enabled=body.datetime_enabled, date_style=body.date_style, time_style=body.time_style, display_week=body.display_week),
                                      note="OSD: " + " + ".join(parts), request_id=_rid(request))


class NameIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=32)  # absent = the VMS name


@router.post("/cameras/{camera_id}/osd/name", status_code=201)
def write_channel_name(camera_id: str, body: NameIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "nvr.config.osd", INSTALLATION)
    cam, ch = _channel_of(conn, camera_id)
    name = (body.name or cam["alias"] or cam["name_source"] or f"ערוץ {ch}")[:32]
    with unlocked(conn):
        rec = nvr_system.set_channel_name(settings_of(request), conn, principal, ch, name, request_id=_rid(request))
    return {**rec, "name": name}


# ---------------------------------------------------------------- 0.1.72: schedules (B5, C1) and smart rules (B4)

def _track_of(conn: sqlite3.Connection, camera_id: str) -> tuple[sqlite3.Row, int, int]:
    cam = conn.execute("SELECT id, channel, alias, name_source, main_track FROM cameras WHERE id = ?", (camera_id,)).fetchone()
    if not cam or cam["channel"] is None:
        raise ApiError(404, "not_found", "המצלמה לא נמצאה.")
    ch = int(cam["channel"])
    return cam, ch, int(cam["main_track"] or f"{ch}01")


@router.get("/cameras/{camera_id}/schedules")
def get_schedules(camera_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Arming schedules of motion / line crossing / intrusion and the main track's recording schedule (read-only)."""
    _require_read(conn, principal)
    _cam, ch, track = _track_of(conn, camera_id)
    settings = settings_of(request)
    out: dict[str, Any] = {"camera_id": camera_id, "channel": ch, "track_id": track, "arming": {}, "record": None, "unsupported": {},
                           "can": {"events": authorize(conn, principal, "nvr.config.events", INSTALLATION).allowed, "schedule": authorize(conn, principal, "nvr.config.schedule", INSTALLATION).allowed},
                           "modes": list(nvr_schedule.RECORD_MODES)}
    with unlocked(conn):
        client = nvr_write._client(settings)
        try:
            for kind in nvr_schedule.SCHEDULE_KINDS:
                status, text = nvr_write._probe(client, nvr_schedule.schedule_path(kind, ch))
                if status == 200:
                    out["arming"][kind] = nvr_schedule.week_from_schedule(text)
                else:
                    out["unsupported"][kind] = nvr_write.response_status(text)[1] or str(status)
            status, text = nvr_write._probe(client, nvr_schedule.track_path(track))
            if status == 200:
                out["record"] = nvr_schedule.record_from_track(text)
            else:
                out["unsupported"]["record"] = nvr_write.response_status(text)[1] or str(status)
        finally:
            client.close()
    return out


class WeekIn(BaseModel):
    days: list[list[dict[str, Any]]] = Field(min_length=7, max_length=7)


@router.put("/cameras/{camera_id}/schedules/{kind}")
def set_arming(camera_id: str, kind: str, body: WeekIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "nvr.config.events", INSTALLATION)
    if kind not in nvr_schedule.SCHEDULE_KINDS:
        raise ApiError(404, "not_found", "סוג לוח לא מוכר.")
    _cam, ch, _track = _track_of(conn, camera_id)
    days = nvr_schedule.check_week(body.days)
    active = sum(len(d) for d in days)
    settings = settings_of(request)
    path = nvr_schedule.schedule_path(kind, ch)
    with unlocked(conn):
        client = nvr_write._client(settings)
        try:
            status, _text = nvr_write._probe(client, path)
            if status != 200:
                raise ApiError(409, "nvr_not_supported", "לערוץ הזה אין לוח זימון מהסוג הזה ב־NVR.", details={"kind": kind, "status": status})
            return nvr_write.apply_change(settings, conn, principal, kind="schedule", permission="nvr.config.events", target=f"{kind}-schedule-{ch}", path=path,
                                          mutate=lambda x: nvr_schedule.schedule_document(x, days), note=f"לוח זימון {nvr_write.TYPE_LABEL.get(nvr_schedule.SCHEDULE_KINDS[kind][1], kind)}: {active} טווחים", request_id=_rid(request), client=client)
        finally:
            client.close()


class RecordScheduleIn(BaseModel):
    days: list[list[dict[str, Any]]] | None = Field(default=None, min_length=7, max_length=7)
    enabled: bool | None = None
    schedule_enabled: bool | None = None


@router.put("/cameras/{camera_id}/record-schedule")
def set_record_schedule(camera_id: str, body: RecordScheduleIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """C1: the weekly recording schedule of the main track; a mistake here means hours without recording, so the UI
    shows the difference first and the change log keeps the previous document for a one-click rollback."""
    require(conn, principal, "nvr.config.schedule", INSTALLATION)
    _cam, ch, track = _track_of(conn, camera_id)
    days = nvr_schedule.check_week(body.days, modes=True) if body.days is not None else None
    if days is None and body.enabled is None and body.schedule_enabled is None:
        raise ApiError(422, "validation", "אין מה לכתוב.")
    parts = [p for p, v in (("לוח שבועי", days), ("הקלטה", body.enabled), ("לוח פעיל", body.schedule_enabled)) if v is not None]
    with unlocked(conn):
        return nvr_write.apply_change(settings_of(request), conn, principal, kind="record_schedule", permission="nvr.config.schedule", target=f"track-{track}", path=nvr_schedule.track_path(track),
                                      mutate=lambda x: nvr_schedule.track_document(x, days, enabled=body.enabled, schedule_enabled=body.schedule_enabled), note="לוח הקלטה: " + " + ".join(parts), request_id=_rid(request))


@router.get("/cameras/{camera_id}/smart")
def get_smart(camera_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _require_read(conn, principal)
    _cam, ch, _track = _track_of(conn, camera_id)
    settings = settings_of(request)
    with unlocked(conn):
        client = nvr_write._client(settings)
        try:
            s1, line = nvr_write._probe(client, f"/ISAPI/Smart/LineDetection/{ch}")
            s2, field = nvr_write._probe(client, f"/ISAPI/Smart/FieldDetection/{ch}")
        finally:
            client.close()
    out = nvr_schedule.smart_from_docs(line if s1 == 200 else None, field if s2 == 200 else None)
    return {**out, "camera_id": camera_id, "channel": ch, "can_write": authorize(conn, principal, "nvr.config.smart", INSTALLATION).allowed}


class SmartRulesIn(BaseModel):
    line: dict[str, Any] | None = None
    field: dict[str, Any] | None = None


@router.put("/cameras/{camera_id}/smart")
def set_smart(camera_id: str, body: SmartRulesIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """B4: line crossing and intrusion rules - one recorded change per document; the zones cache is dropped so the
    camera screen shows the new shapes right away."""
    require(conn, principal, "nvr.config.smart", INSTALLATION)
    _cam, ch, _track = _track_of(conn, camera_id)
    if body.line is None and body.field is None:
        raise ApiError(422, "validation", "אין מה לכתוב.")
    from .cameras import _ZONES_CACHE

    settings = settings_of(request)
    results: dict[str, Any] = {}

    def write(key: str, spec: dict[str, Any], path: str, build: Any, note: str) -> None:
        """The lab firmware writes shapes and parameters but answers invalidOperation when the document is enabled
        through the NVR (the camera's own VCA resource decides): retry without the enable flag and say so."""
        try:
            results[key] = nvr_write.apply_change(settings, conn, principal, kind="smart", permission="nvr.config.smart", target=f"{key}-{ch}", path=path, mutate=lambda x: build(x, spec), note=note, request_id=_rid(request))
        except ApiError as exc:
            if exc.code != "source_forbidden" or not spec.get("enabled"):
                raise
            shapes = {k: v for k, v in spec.items() if k != "enabled"}
            results[key] = nvr_write.apply_change(settings, conn, principal, kind="smart", permission="nvr.config.smart", target=f"{key}-{ch}", path=path, mutate=lambda x: build(x, shapes), note=note + " (ההפעלה נדחתה)", request_id=_rid(request))
            results[key]["enable_refused"] = True

    with unlocked(conn):
        if body.line is not None:
            write("line", body.line, f"/ISAPI/Smart/LineDetection/{ch}", nvr_schedule.line_document, f"חציית קו: {len((body.line or {}).get('lines') or [])} קווים")
        if body.field is not None:
            write("field", body.field, f"/ISAPI/Smart/FieldDetection/{ch}", nvr_schedule.field_document, f"פריצה לאזור: {len((body.field or {}).get('regions') or [])} אזורים")
    _ZONES_CACHE.pop(camera_id, None)
    return results


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
