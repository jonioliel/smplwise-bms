"""NVR storage and recording plan, read-only (T051): disks and free space, the recording schedule of every
camera's main track, retention measured (the oldest recording the NVR still has) next to retention estimated
(capacity over the configured bitrates) with the reason for each number, and the list of things this pilot
does not do on the device (no format / RAID / delete, no schedule or quota writes)."""
from __future__ import annotations

import datetime as dt
import sqlite3
import threading
import time
from typing import Any

from ..config import Settings
from ..db import unlocked
from ..routers.settings import read_settings
from . import nvr, recordings
from .timeutil import iso_utc, nvr_wall_to_utc, utc_to_nvr_wall, zone

CACHE_S = 600
LOOKBACK_DAYS = 120
STORAGE = nvr.storage_status  # test seams
TRACKS = nvr.record_schedules
OLDEST = nvr.oldest_recording

MODE_LABEL = {"CMR": "רציף", "MOTION": "תנועה", "ALARM": "התראה", "EDR": "אירוע", "MANUAL": "ידני", "TIMING": "מתוזמן", "ALLEVENT": "כל אירוע", "MOTIONALARM": "תנועה או התראה"}
DAYS = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
LIMITS = {
    "writes": False,
    "notes": [
        "קריאה בלבד: אין format, אין RAID, אין מחיקת הקלטות ואין שינוי quota מתוך המערכת.",
        "שינוי מצב הקלטה, pre/post או quota דורש תמיכה מוכחת ב־ISAPI של הדגם, diff, אישור ותוכנית חזרה (לא בפיילוט).",
        "ISAPI ContentMgmt/Storage/quota ו־System/Video/inputs/…/overwrite מחזירים 403 ב־NVR של המעבדה (KNOWN_QUIRKS S9): מדיניות הדריסה אינה נקראת.",
    ],
}

_cache: dict[str, tuple[float, dict[str, Any]]] = {}
_lock = threading.Lock()


def mode_label(mode: str) -> str:
    return MODE_LABEL.get(mode.upper(), mode) if mode else ""


def schedule_summary(t: nvr.TrackSchedule | None) -> str:
    if t is None:
        return "אין track הקלטה ידוע"
    rec = [b for b in t.blocks if b["record"]]
    if not rec:
        return "ללא הקלטה מתוזמנת"
    days = {str(b["day"]) for b in rec}
    all_day = all(str(b["start"]) == "00:00:00" and str(b["end"]) == "00:00:00" for b in rec)
    modes = " / ".join(mode_label(m) for m in t.modes) or mode_label(t.default_mode) or "?"
    if days >= set(DAYS) and all_day:
        coverage = "כל השבוע, 24 שעות"
    elif days >= set(DAYS):
        coverage = "כל השבוע, לפי שעות"
    else:
        coverage = f"{len(days)} ימים בשבוע"
    return f"{modes} · {coverage}"


def report(settings: Settings, conn: sqlite3.Connection, fresh: bool = False, now: dt.datetime | None = None) -> dict[str, Any]:
    """Cached for CACHE_S seconds (the oldest-recording searches cost one NVR query per camera)."""
    if not fresh:
        with _lock:
            hit = _cache.get("report")
        if hit and time.time() - hit[0] < CACHE_S:
            return {**hit[1], "cached": True}
    tz_name = read_settings(conn)["time.zone"]
    cams = [dict(r) for r in conn.execute("SELECT * FROM cameras ORDER BY sort_order, channel").fetchall()]
    with unlocked(conn):
        out = build(settings, tz_name, cams, now or dt.datetime.now(dt.timezone.utc))
    with _lock:
        _cache["report"] = (time.time(), out)
    return out


def invalidate() -> None:
    with _lock:
        _cache.clear()


def build(settings: Settings, tz_name: str, cams: list[dict[str, Any]], now: dt.datetime) -> dict[str, Any]:
    out: dict[str, Any] = {
        "generated_at": iso_utc(now), "cached": False,
        "nvr": {"configured": bool(settings.nvr_host and settings.nvr_user), "reachable": False, "error": None},
        "disks": [], "nas": [], "totals": None, "work_mode": None, "schedule_error": None, "cameras": [],
        "retention": {"measured_days_min": None, "measured_days_max": None, "measured_reason": "", "estimated_days": None, "estimated_reason": "", "bitrate_total_kbps": 0, "lookback_days": LOOKBACK_DAYS},
        "limits": LIMITS,
    }
    if not out["nvr"]["configured"]:
        out["retention"]["measured_reason"] = out["retention"]["estimated_reason"] = "ה־NVR לא מוגדר"
        return out
    try:
        st = STORAGE(settings)
    except Exception as exc:  # noqa: BLE001 - an unreachable NVR is reported, never raised into the screen
        out["nvr"]["error"] = type(exc).__name__
        out["retention"]["measured_reason"] = out["retention"]["estimated_reason"] = f"אין תשובה מה־NVR ({type(exc).__name__})"
        return out
    out["nvr"]["reachable"] = True
    out["work_mode"] = st["work_mode"]
    for key in ("disks", "nas"):
        out[key] = [{"id": d.id, "name": d.name, "kind": d.kind, "status": d.status, "capacity_mb": d.capacity_mb, "free_mb": d.free_mb, "used_mb": max(0, d.capacity_mb - d.free_mb), "property": d.property, "path": d.path} for d in st[key]]
    cap = sum(d["capacity_mb"] for d in out["disks"] + out["nas"])
    free = sum(d["free_mb"] for d in out["disks"] + out["nas"])
    out["totals"] = {"capacity_mb": cap, "free_mb": free, "used_mb": max(0, cap - free), "used_pct": round(100 * (cap - free) / cap, 1) if cap else None, "disks": len(out["disks"]), "nas": len(out["nas"]), "disks_ok": sum(1 for d in out["disks"] + out["nas"] if d["status"] == "ok")}
    tracks: dict[int, nvr.TrackSchedule] = {}
    try:
        tracks = {t.track_id: t for t in TRACKS(settings)}
    except Exception as exc:  # noqa: BLE001
        out["schedule_error"] = f"תוכנית ההקלטה לא נקראה ({type(exc).__name__})"
    tz = zone(tz_name)
    start_wall = utc_to_nvr_wall(now - dt.timedelta(days=LOOKBACK_DAYS), tz)
    end_wall = utc_to_nvr_wall(now, tz)
    total_kbps = 0
    recording_cams = 0
    for cam in cams:
        track = int(cam["main_track"]) if cam["main_track"] else None
        t = tracks.get(track) if track else None
        # placeholder channels report nonsense stream facts (resolution 0x0, framerate 2^32); do not show them
        fps = t.description.get("fps") if t else None
        fps = None if not fps or float(fps) > 240 else fps
        resolution = t.description.get("resolution") if t else None
        resolution = None if resolution in (None, "", "0x0") else resolution
        entry: dict[str, Any] = {
            "camera_id": cam["id"], "name": cam["alias"] or cam["name_source"] or f"ערוץ {cam['channel']}", "channel": cam["channel"], "track_id": track,
            "has_schedule": t is not None, "enable_flag": t.enable_flag if t else None, "default_mode": t.default_mode if t else None, "modes": t.modes if t else [],
            "summary": schedule_summary(t) if (t or not track) else "ה־track לא נמצא בתוכנית ההקלטה", "pre_s": t.pre_s if t else None, "post_s": t.post_s if t else None,
            "expiry": t.expiry if t else None, "save_audio": t.save_audio if t else None,
            "bitrate_kbps": t.description.get("bitrate_kbps") if t else None, "resolution": resolution, "fps": fps,
            "oldest_recording_at": None, "retention_days": None, "retention_reason": "",
        }
        if t and t.description.get("bitrate_kbps") and any(b["record"] for b in t.blocks):
            total_kbps += int(t.description["bitrate_kbps"])
            recording_cams += 1
        if track:
            try:
                with recordings._search_lock:  # KNOWN_QUIRKS S2: one search at a time
                    raw = OLDEST(settings, track, start_wall, end_wall)
                if raw:
                    oldest = nvr_wall_to_utc(raw, tz)
                    entry["oldest_recording_at"] = iso_utc(oldest)
                    entry["retention_days"] = round(max(0.0, (now - oldest).total_seconds() / 86400), 1)
                    entry["retention_reason"] = f"ההקלטה המוקדמת ביותר שה־NVR מצא בחיפוש {LOOKBACK_DAYS} ימים אחורה"
                else:
                    entry["retention_reason"] = f"לא נמצאו הקלטות ב־{LOOKBACK_DAYS} הימים האחרונים"
            except Exception as exc:  # noqa: BLE001
                entry["retention_reason"] = f"החיפוש נכשל ({type(exc).__name__})"
        else:
            entry["retention_reason"] = "אין track הקלטה ידוע; הרץ סנכרון מצלמות"
        out["cameras"].append(entry)
    measured = [c["retention_days"] for c in out["cameras"] if c["retention_days"] is not None]
    r = out["retention"]
    r["measured_days_min"] = min(measured) if measured else None
    r["measured_days_max"] = max(measured) if measured else None
    r["measured_reason"] = (
        f"נמדד: ההקלטה המוקדמת ביותר לכל מצלמה בחיפוש {LOOKBACK_DAYS} ימים אחורה ({len(measured)} מתוך {len(out['cameras'])} מצלמות ענו)"
        if measured else "לא נמדד: אף מצלמה לא החזירה הקלטה בחלון החיפוש"
    )
    r["bitrate_total_kbps"] = total_kbps
    if total_kbps and cap:
        bytes_per_day = total_kbps * 1000 / 8 * 86400
        r["estimated_days"] = round(cap * 1024 * 1024 / bytes_per_day, 1)
        r["estimated_reason"] = f"אומדן: קיבולת כוללת חלקי קצב הסיביות המוגדר של {recording_cams} מצלמות בהקלטה רציפה מלאה ({total_kbps} kbps). הקלטה לפי תנועה כותבת פחות, ולכן בפועל נשמר יותר"
    else:
        r["estimated_reason"] = "אין אומדן: חסר קצב סיביות ב־tracks או שאין קיבולת"
    return out
