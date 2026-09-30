"""Setup wizard (T071, R141 / AT141): install → NVR → Home Assistant → go2rtc → floor → camera. One status per step
(done / todo / failed / skipped / not_applicable) with the evidence behind it, a Hebrew explanation with the concrete next action when a
step is not done, and a link to the settings section that fixes it.

How a step is evaluated:
- `local` (install, floor, camera): the add-on's own database and data directory - always current, no network.
- device steps (nvr, ha, go2rtc): GET /setup/state never touches a device. It shows the last on-demand probe (kept for
  LIVE_TTL_S) or, without one, what the background jobs already know (camera discovery, the go2rtc stream sync, the HA
  sync and bridge state), marked `source: background`. POST /setup/check/{step} runs that step's probe now with the same
  read-only calls the rest of the add-on uses - nvr.device_info / nvr.discover_channels / nvr_system.time_status,
  Go2rtc.info / Go2rtc.list_streams, ha_client.get_config - rate-limited per user and step, audited as a read.
  Nothing here writes to the NVR, go2rtc or Home Assistant.

Time checks (the NVR step and the HA step): the device clock against the add-on's (|drift| <= DRIFT_OK_S fine, up to
DRIFT_FAIL_S a warning, beyond that the step fails), and the NVR's UTC offset against the installation time zone at
this instant (a wrong DST rule on the NVR shifts every recording search by an hour, because searches are made in the
NVR's wall clock - KNOWN_QUIRKS T2)."""
from __future__ import annotations

import datetime as dt
import email.utils
import json
import math
import os
import re
import shutil
import sqlite3
import threading
import time
from concurrent.futures import Future, ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout
from typing import Any, Callable
from zoneinfo import ZoneInfo

from .. import __version__
from ..config import Settings
from ..db import now_iso
from ..errors import ApiError
from . import autosync, bridge_install, events_ingest, ha_client, ha_sync, nvr, nvr_system, stream_codecs
from . import go2rtc as g2
from .timeutil import zone
from ..mode import installation_mode, is_ha_only

STEPS = ("install", "nvr", "ha", "go2rtc", "floor", "camera")
TITLES = {
    "install": "התקנת ה־Add-on",
    "nvr": "חיבור ל־NVR",
    "ha": "Home Assistant והגשר",
    "go2rtc": "go2rtc (וידאו חי)",
    "floor": "קומה ותוכנית",
    "camera": "מצלמה על המפה",
}
DEVICE_STEPS = ("nvr", "ha", "go2rtc")

DRIFT_OK_S = 2
DRIFT_FAIL_S = 30
CHECK_EVERY_S = 5.0  # per user and step: "בדוק שוב" is a nudge, not a poll
LIVE_TTL_S = 600  # a live probe result is shown this long, then the background state again
MIN_FREE_BYTES = 512 * 1024**2  # the health report's own "error" line for /data

_lock = threading.Lock()
_live: dict[str, tuple[float, dict[str, Any]]] = {}
# NVR-less mode: the last successful go2rtc check, kept past LIVE_TTL_S - without an NVR no stream sync runs, so the
# background jobs never learn that go2rtc answers; reachability is the whole go2rtc step there
_go2rtc_ok: dict[str, Any] = {}
_last_check: dict[tuple[str, str], float] = {}

LINKS = {
    "connections": ("#/system/setup", "הגדרות › חיבורים"),
    "health": ("#/system/diagnostics?tab=health", "הגדרות › כללי › בריאות ועבודות"),
    "ha": ("#/system/diagnostics?tab=ha", "הגדרות › כללי › גשר Home Assistant"),
    "media": ("#/system/diagnostics?tab=media", "הגדרות › כללי › וידאו ומדיה"),
    "general": ("#/system/diagnostics", "הגדרות › כללי"),
    "sites": ("#/explore/sites", "מפה › אתרים ומבנים"),
    "devices": ("#/system/devices", "מצלמות › בריאות מצלמות"),
    "access": ("#/system/access", "הגדרות › משתמשים והרשאות"),
    "remote": ("#/system/diagnostics?tab=remote", "הגדרות › גישה מרחוק"),
}

# CR-008 D7: the streaming-channels GET inside the wizard's NVR check (CHECK_DEADLINE_S covers the whole check)
STREAMING_TIMEOUT_S = 3.0
# CR-008 D7: at most this many per-camera "main stream will not play over WebRTC" warnings; the rest are counted
MAX_CODEC_WARNINGS = 4


def _codec_fact(main: dict[str, int], total: int) -> dict[str, Any]:
    return _fact("זרם ראשי ב־WebRTC", f"{main['ok']} מתוך {total}" + (f" · {main['no']} לא יתנגנו" if main["no"] else "") + (f" · {main['unknown']} לא ידוע" if main["unknown"] else ""),
                 "warn" if main["no"] else "ok" if main["ok"] == total else "")


def _codec_warnings(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """The settings hints of the cameras whose main stream will not play over WebRTC (stream_codecs.hints shape)."""
    out = [_warning("main_not_webrtc", str(it["hint"]), _link("remote")) for it in items[:MAX_CODEC_WARNINGS]]
    if len(items) > MAX_CODEC_WARNINGS:
        out.append(_warning("main_not_webrtc_more", f"ועוד {len(items) - MAX_CODEC_WARNINGS} מצלמות שהזרם הראשי שלהן לא יתנגן ב־WebRTC; הפירוט בבריאות המערכת.", _link("health")))
    return out


def reset() -> None:
    """Forget cached probe results and the rate limiter (tests, the fixture backend's control API)."""
    with _lock:
        _live.clear()
        _inflight.clear()
        _last_check.clear()
        _go2rtc_ok.clear()


# ---------------------------------------------------------------- building blocks

def _link(key: str, href: str | None = None, label: str | None = None) -> dict[str, str]:
    h, l = LINKS[key]
    return {"href": href or h, "label": label or l}


def _problem(code: str, message: str, action: str, link: dict[str, str] | None) -> dict[str, Any]:
    return {"code": code, "message": message, "action": action, "link": link}


def _fact(label: str, value: Any, tone: str = "") -> dict[str, Any]:
    return {"label": label, "value": "—" if value in (None, "") else str(value), "tone": tone}


def _step(step_id: str, status: str, summary: str, *, facts: list[dict[str, Any]], evidence: dict[str, Any], settings_link: dict[str, str],
          problem: dict[str, Any] | None = None, warnings: list[dict[str, Any]] | None = None, source: str = "local", checked_at: str | None = None) -> dict[str, Any]:
    return {
        "id": step_id, "index": STEPS.index(step_id) + 1, "title": TITLES[step_id], "status": status, "summary": summary,
        "facts": facts, "evidence": evidence, "problem": problem, "warnings": warnings or [], "settings_link": settings_link,
        "source": source, "checked_at": checked_at or now_iso(),
    }


def _warning(code: str, message: str, link: dict[str, str] | None = None) -> dict[str, Any]:
    return {"code": code, "message": message, "link": link}


def _signed(n: int) -> str:
    return f"+{n}" if n > 0 else str(n)


def _fmt_offset(off: dt.timedelta | None) -> str | None:
    if off is None:
        return None
    total = int(off.total_seconds())
    sign = "+" if total >= 0 else "-"
    total = abs(total)
    return f"{sign}{total // 3600:02d}:{(total % 3600) // 60:02d}"


def _fmt_bytes(n: int) -> str:
    return f"{n / 1024**3:.1f} GB" if n >= 1024**3 else f"{n / 1024**2:.0f} MB"


# ---------------------------------------------------------------- time checks

def drift_level(drift_s: int | None) -> str:
    """ok (|d| <= DRIFT_OK_S) · warn (<= DRIFT_FAIL_S) · fail · unknown."""
    if drift_s is None:
        return "unknown"
    a = abs(drift_s)
    return "ok" if a <= DRIFT_OK_S else "warn" if a <= DRIFT_FAIL_S else "fail"


def nvr_time_check(local_time: str | None, tz: ZoneInfo, now: dt.datetime) -> dict[str, Any]:
    """The NVR's clock (its ISAPI localTime) against the add-on's, and its UTC offset against the installation zone at
    this instant. A localTime without an offset is read as the installation zone's wall clock; its DST is then unknown."""
    expected = now.astimezone(tz).utcoffset()
    out: dict[str, Any] = {"local_time": local_time, "zone": tz.key, "expected_offset": _fmt_offset(expected), "offset": None, "drift_s": None, "level": "unknown", "dst": "unknown"}
    if not local_time:
        return out
    try:
        parsed = dt.datetime.fromisoformat(local_time.strip().replace("Z", "+00:00"))
    except ValueError:
        return out
    if parsed.tzinfo is None:
        instant = parsed.replace(tzinfo=tz)
    else:
        # the device reports its wall clock (summer time applied) tagged with the zone's STANDARD offset: read the
        # digits in the installation zone (nvr_system.device_instant); the tag alone is then no longer evidence
        instant = nvr_system.device_instant(local_time, tz) or parsed
        out["offset"] = _fmt_offset(parsed.utcoffset())
        out["dst"] = "ok" if parsed.utcoffset() == expected or (instant != parsed and abs((instant - now).total_seconds()) <= DRIFT_FAIL_S) else "mismatch"
    out["drift_s"] = round((instant - now).total_seconds())
    out["level"] = drift_level(out["drift_s"])
    return out


def ha_time_check(date_header: str | None, ha_zone: str | None, tz: ZoneInfo, now: dt.datetime) -> dict[str, Any]:
    """HA's clock from its response's Date header (one-second resolution) and its configured time zone."""
    out: dict[str, Any] = {"ha_time": None, "drift_s": None, "level": "unknown", "ha_zone": ha_zone, "zone": tz.key, "zone_match": (ha_zone == tz.key) if ha_zone else None}
    if date_header:
        try:
            ha_now = email.utils.parsedate_to_datetime(date_header)
        except (TypeError, ValueError):
            ha_now = None
        if ha_now is not None and ha_now.tzinfo is not None:
            out["ha_time"] = ha_now.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            out["drift_s"] = round((ha_now - now).total_seconds())
            out["level"] = drift_level(out["drift_s"])
    return out


def _drift_fact(label: str, check: dict[str, Any]) -> dict[str, Any]:
    d = check.get("drift_s")
    tone = {"ok": "ok", "warn": "warn", "fail": "err"}.get(check.get("level"), "")
    return _fact(label, "לא נמדד" if d is None else f"{_signed(d)} שנ׳", tone)


# ---------------------------------------------------------------- step 1: install (local)

def _system_admins(conn: sqlite3.Connection) -> int:
    return conn.execute(
        """SELECT COUNT(*) FROM bindings WHERE role_id = 'system_admin' AND scope_type = 'installation' AND effect = 'allow'
           AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?)""", (now_iso(),)).fetchone()[0]


def install_step(settings: Settings, conn: sqlite3.Connection, identity_source: str, *, deep: bool = False) -> dict[str, Any]:
    """The add-on itself: its version, the database, /data (writable, free space) and the first administrator. `deep`
    (the on-demand check) runs SQLite's quick_check; the state view only proves the database answers."""
    try:
        if deep:
            integrity = conn.execute("PRAGMA quick_check").fetchone()[0]
            db_ok = integrity == "ok"
        else:
            integrity = None
            db_ok = conn.execute("SELECT 1").fetchone()[0] == 1
    except sqlite3.Error as exc:
        integrity, db_ok = type(exc).__name__, False
    writable = os.access(settings.data_dir, os.W_OK)
    try:
        du = shutil.disk_usage(settings.data_dir)
        free, total = du.free, du.total
    except OSError:
        free = total = None
    admins = _system_admins(conn)
    tz_name = _tz_name(conn)
    evidence = {"version": __version__, "db_ok": db_ok, "integrity": integrity, "data_dir_writable": writable, "free_bytes": free, "total_bytes": total,
                "system_admins": admins, "bootstrap_admin_configured": bool(settings.bootstrap_admin_username), "identity_source": identity_source,
                "in_addon": settings.in_addon, "time_zone": tz_name}
    facts = [
        _fact("גרסה", __version__),
        _fact("מסד נתונים", ("תקין" if db_ok else f"שגיאה ({integrity})") + (" · quick_check" if deep and db_ok else ""), "ok" if db_ok else "err"),
        _fact("תיקיית הנתונים (/data)", ("ניתנת לכתיבה" if writable else "לא ניתנת לכתיבה") + (f" · פנוי {_fmt_bytes(free)} מתוך {_fmt_bytes(total)}" if free is not None else ""),
              "ok" if writable and (free is None or free >= MIN_FREE_BYTES) else "err"),
        _fact("מנהלי מערכת", admins, "ok" if admins else "warn"),
        _fact("מקור הזהות", "Home Assistant Ingress" if identity_source == "ingress" else identity_source),
        _fact("אזור הזמן של ההתקנה", tz_name),
    ]
    link = _link("health")
    problem = None
    if not db_ok:
        problem = _problem("db_error", f"בסיס הנתונים של ה־Add-on אינו תקין ({integrity}).",
                           "שחזרו את הגיבוי האחרון (הגדרות › כללי › גיבוי ושחזור) ובדקו את יומן ה־Add-on ב־Home Assistant.", _link("general", "#/system/diagnostics?tab=backup", "הגדרות › כללי › גיבוי ושחזור"))
    elif not writable:
        problem = _problem("data_not_writable", "ה־Add-on אינו יכול לכתוב לתיקיית הנתונים שלו (/data).",
                           "הפעילו מחדש את ה־Add-on מ־Home Assistant › הגדרות › Add-ons; אם זה חוזר, בדקו את הדיסק של Home Assistant.", link)
    elif free is not None and free < MIN_FREE_BYTES:
        problem = _problem("disk_full", f"נותרו רק {_fmt_bytes(free)} פנויים בדיסק של ה־Add-on.",
                           "פנו מקום: מחקו ייצואים וגיבויים ישנים (הגדרות › אחסון) או הגדילו את הדיסק של Home Assistant.", _link("general", "#/system/storage", "הגדרות › אחסון"))
    warnings = []
    if admins == 0:
        warnings.append(_warning("no_system_admin", "אין עדיין מנהל מערכת בשיוך ישיר; ההרשאה הנוכחית מגיעה מתפקיד מותאם. מומלץ לשייך מנהל מערכת.", _link("access")))
    if problem:
        return _step("install", "failed", problem["message"], facts=facts, evidence=evidence, settings_link=link, problem=problem, warnings=warnings)
    return _step("install", "done", f"גרסה {__version__} · בסיס הנתונים ו־/data תקינים", facts=facts, evidence=evidence, settings_link=link, warnings=warnings)


def _tz_name(conn: sqlite3.Connection) -> str:
    from ..routers.settings import read_settings  # lazy: services stay importable without the routers

    return str(read_settings(conn).get("time.zone") or "Asia/Jerusalem")


# ---------------------------------------------------------------- step 2: NVR

NVR_ERRORS = {
    "source_not_configured": ("פרטי ה־NVR לא הוגדרו.", "מלאו כתובת, משתמש וסיסמה ב־Home Assistant › Add-ons › SmplWise Arx › Configuration (nvr_host, nvr_username, nvr_password), או ב"),
    "nvr_not_configured": ("פרטי ה־NVR לא הוגדרו.", "מלאו כתובת, משתמש וסיסמה ב־Home Assistant › Add-ons › SmplWise Arx › Configuration (nvr_host, nvr_username, nvr_password), או ב"),
    "source_unavailable": ("ה־NVR לא ענה.", "ודאו שה־NVR דולק ומחובר לרשת, ושהכתובת ופורט ה־HTTP נכונים; לתיקון הכתובת: "),
    "source_forbidden": ("ה־NVR דחה את שם המשתמש או הסיסמה.", "בדקו את המשתמש והסיסמה (מומלץ משתמש ייעודי עם הרשאות צפייה והקלטות בלבד) ועדכנו אותם ב"),
    "source_error": ("ה־NVR החזיר שגיאה לבקשת קריאה.", "ודאו שלמשתמש ה־NVR יש הרשאות צפייה והקלטות ושה־ISAPI פעיל ב־NVR; פרטי החיבור ב"),
}


def _nvr_problem(code: str, detail: str | None = None) -> dict[str, Any]:
    message, action = NVR_ERRORS.get(code, (f"קריאה מה־NVR נכשלה ({code}).", "בדקו את פרטי החיבור ב"))
    link = _link("connections")
    return _problem(code, message + (f" ({detail})" if detail else ""), f"{action}{link['label']}.", link)


def _looks_like_address(host: str) -> bool:
    h = host.strip().strip("[]")
    return bool(re.fullmatch(r"[0-9.]+", h)) or ":" in h


def _nvr_configured(settings: Settings) -> bool:
    return bool(settings.nvr_host and settings.nvr_user and settings.nvr_password)


def _recorder(conn: sqlite3.Connection) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM recorders WHERE id = ?", (autosync.DEFAULT_RECORDER,)).fetchone()


def _alert_warning() -> dict[str, Any] | None:
    ing = events_ingest.STATE.as_dict()
    if ing.get("connected"):
        return None
    return _warning("alert_stream_down", "זרם ההתראות (alertStream) מה־NVR אינו מחובר כרגע; אירועי תנועה ייגזרו מההקלטות כל 10 דקות עד שיתחבר.", _link("connections"))


def nvr_background(settings: Settings, conn: sqlite3.Connection) -> dict[str, Any]:
    link = _link("connections")
    if not _nvr_configured(settings):
        p = _nvr_problem("nvr_not_configured")
        return _step("nvr", "failed", p["message"], facts=[_fact("מוגדר ב־Add-on options", "לא", "err")], evidence={"configured": False}, settings_link=link, problem=p, source="background")
    ds = dict(autosync.STATE)
    rec = _recorder(conn)
    cams = conn.execute("SELECT COUNT(*) FROM cameras").fetchone()[0]
    evidence = {"configured": True, "model": rec["model"] if rec else None, "firmware": rec["firmware"] if rec else None, "channels": cams,
                "discovery_last_ok": ds.get("cameras_last_ok"), "discovery_last_error": ds.get("cameras_last_error"), "time": None}
    facts = [_fact("דגם · קושחה", f"{evidence['model'] or '—'} · {evidence['firmware'] or '—'}"), _fact("ערוצים רשומים", cams),
             _fact("גילוי אחרון תקין", ds.get("cameras_last_ok")), _fact("שעון מול ה־Add-on", "לא נבדק עדיין — לחצו \"בדוק שוב\"")]
    codecs = stream_codecs.summary(conn, with_names=True)
    evidence["video_codecs"] = {k: v for k, v in codecs.items() if k != "main_not_webrtc"}
    if codecs["checked"]:
        facts.append(_codec_fact(codecs["main"], codecs["checked"]))
    warnings = [w for w in (_alert_warning(),) if w] + _codec_warnings(codecs["main_not_webrtc"])
    if ds.get("cameras_last_error"):
        p = _nvr_problem(str(ds["cameras_last_error"]))
        return _step("nvr", "failed", p["message"], facts=facts, evidence=evidence, settings_link=link, problem=p, warnings=warnings, source="background", checked_at=ds.get("cameras_last_run"))
    if ds.get("cameras_last_ok"):
        return _step("nvr", "done", f"{evidence['model'] or 'NVR'} · {cams} ערוצים (לפי הגילוי האחרון)", facts=facts, evidence=evidence, settings_link=link,
                     warnings=warnings, source="background", checked_at=ds.get("cameras_last_ok"))
    p = _problem("not_checked", "ה־NVR עוד לא נבדק מאז שה־Add-on עלה.", "לחצו \"בדוק שוב\" כדי לקרוא את פרטי ה־NVR, הערוצים והשעון עכשיו.", link)
    return _step("nvr", "todo", p["message"], facts=facts, evidence=evidence, settings_link=link, problem=p, warnings=warnings, source="background")


def nvr_probe(settings: Settings, tz_name: str, now: dt.datetime | None = None, disabled: set[int] | frozenset[int] = frozenset()) -> dict[str, Any]:
    """deviceInfo, the channel / track list (the capabilities the rest of the add-on relies on) and the clock - read-only,
    device calls only (no database). The caller checks that the NVR is configured."""
    link = _link("connections")
    tz = zone(tz_name)
    t0 = time.monotonic()
    try:
        info = nvr.device_info(settings)
    except ApiError as exc:
        p = _nvr_problem(exc.code, (exc.details or {}).get("error"))
        return _step("nvr", "failed", p["message"], facts=[_fact("מוגדר ב־Add-on options", "כן", "ok"), _fact("תשובה", "אין", "err")],
                     evidence={"configured": True, "reachable": False, "error": exc.code}, settings_link=link, problem=p, source="live")
    except Exception as exc:  # noqa: BLE001 - an unparsable answer is a failed step, never a 500
        p = _nvr_problem("source_error", type(exc).__name__)
        return _step("nvr", "failed", p["message"], facts=[], evidence={"configured": True, "reachable": False, "error": type(exc).__name__}, settings_link=link, problem=p, source="live")
    ms = int((time.monotonic() - t0) * 1000)
    warnings: list[dict[str, Any]] = []
    channels: list[nvr.DiscoveredChannel] = []
    channel_error = None
    try:
        channels = nvr.discover_channels(settings)
    except ApiError as exc:
        channel_error = exc.code
    except Exception as exc:  # noqa: BLE001
        channel_error = type(exc).__name__
    online = sum(1 for c in channels if c.online)
    offline = sum(1 for c in channels if c.online is False)
    with_tracks = sum(1 for c in channels if c.main_track and c.sub_track)
    # CR-008 D7: the main / sub stream encodings (a read-only GET with a short timeout inside the check's budget) -
    # which main streams will not play over WebRTC; counted over the enabled cameras, as /health and the report do
    codec_items: list[dict[str, Any]] = []
    codec_main = {"ok": 0, "no": 0, "unknown": 0}
    codec_error = None
    codec_channels = [c for c in channels if c.channel not in disabled]
    if codec_channels:
        try:
            encodings = nvr.fetch_stream_encodings(settings, timeout=STREAMING_TIMEOUT_S)
        except ApiError as exc:
            encodings, codec_error = {}, exc.code
        except Exception as exc:  # noqa: BLE001
            encodings, codec_error = {}, type(exc).__name__
        for c in codec_channels:
            enc = stream_codecs.build(c, encodings.get(c.channel), None, error=codec_error, now=now_iso()) or {}
            main = enc.get("main")
            verdict = str((main or {}).get("webrtc") or "unknown")
            codec_main[verdict if verdict in codec_main else "unknown"] += 1
            hint = stream_codecs.main_hint(c.name or f"ערוץ {c.channel}", c.channel, main, info.get("model"))
            if hint:
                codec_items.append({"channel": c.channel, "name": c.name, "reason": (main or {}).get("reason"), "hint": hint})
    profiles: list[str] = []
    for c in channels:
        s = c.stream or {}
        label = " ".join(str(x) for x in (s.get("codec"), s.get("resolution"), f"{s['fps']:g}fps" if s.get("fps") else None) if x)
        if label and label not in profiles:
            profiles.append(label)
    try:
        ts = nvr_system.time_status(settings)
        time_check = nvr_time_check(ts.get("local_time"), tz, now or dt.datetime.now(dt.timezone.utc))
        # the NTP server is reduced to "set / a name or an address": a LAN server's address is private (CLAUDE.md), and
        # this result is cached and served to every system administrator
        ntp_host = str((ts.get("ntp") or {}).get("host") or "")
        time_check.update({"mode": ts.get("mode"), "device_zone": ts.get("time_zone"), "ntp_configured": bool(ntp_host),
                           "ntp_is_hostname": bool(ntp_host) and not _looks_like_address(ntp_host)})
    except ApiError as exc:
        time_check = {"level": "unknown", "error": exc.code, "drift_s": None, "dst": "unknown", "zone": tz.key}
    except (ValueError, TypeError, AttributeError) as exc:  # an odd value in the clock / NTP document (portNo, interval ...)
        time_check = {"level": "unknown", "error": f"unparsable ({type(exc).__name__})", "drift_s": None, "dst": "unknown", "zone": tz.key}
    evidence = {"configured": True, "reachable": True, "ms": ms, "model": info.get("model"), "firmware": info.get("firmware"), "device_type": info.get("device_type"),
                "channels": len(channels), "online": online, "offline": offline, "with_tracks": with_tracks, "profiles": profiles[:6], "channel_error": channel_error,
                "time": time_check, "video_codecs": {"main": codec_main, "error": codec_error, "main_not_webrtc": len(codec_items)}}
    facts = [
        _fact("דגם · קושחה", f"{info.get('model') or '—'} · {info.get('firmware') or '—'}", "ok"),
        _fact("ערוצים", f"{len(channels)} · {online} מקוונים" + (f" · {offline} לא מקוונים" if offline else ""), "ok" if channels else "err"),
        _fact("ערוצים עם זרם ראשי ומשני", f"{with_tracks} מתוך {len(channels)}", "ok" if channels and with_tracks == len(channels) else "warn"),
        _fact("פרופילי וידאו שנמצאו", " · ".join(profiles[:4]) if profiles else "—"),
        *([_codec_fact(codec_main, len(codec_channels))] if codec_channels else []),
        _drift_fact("שעון ה־NVR מול ה־Add-on", time_check),
        _fact("אזור זמן (היסט)", f"{time_check.get('offset') or '?'} · צפוי {time_check.get('expected_offset')} ({tz.key})",
              {"ok": "ok", "mismatch": "err"}.get(time_check.get("dst"), "warn")),
    ]
    if channel_error or not channels:
        p = _problem("no_channels", "ה־NVR ענה, אבל לא החזיר ערוצים" + (f" ({channel_error})." if channel_error else "."),
                     f"ודאו שהמצלמות מחוברות ל־NVR ושלמשתמש ה־NVR יש הרשאת צפייה בכל הערוצים; פרטי החיבור ב{link['label']}.", link)
        return _step("nvr", "failed", p["message"], facts=facts, evidence=evidence, settings_link=link, problem=p, source="live")
    if time_check.get("dst") == "mismatch":
        p = _problem("nvr_dst_mismatch", f"ה־NVR מדווח היסט {time_check['offset']} מ־UTC, אבל ב־{tz.key} ההיסט עכשיו {time_check['expected_offset']} — כלל שעון הקיץ / אזור הזמן ב־NVR שגוי.",
                     "עד שזה יתוקן, חיפוש הקלטות ואירועים יסטה בשעה. תקנו את אזור הזמן ואת שעון הקיץ בהגדרות ה־NVR (Configuration › System › Time Settings), ואז בדקו שוב.", link)
        return _step("nvr", "failed", p["message"], facts=facts, evidence=evidence, settings_link=link, problem=p, source="live")
    if time_check.get("level") == "fail":
        p = _problem("nvr_clock_drift", f"שעון ה־NVR סוטה ב־{_signed(time_check['drift_s'])} שניות משעון ה־Add-on (מותר עד {DRIFT_FAIL_S}).",
                     f"אירועים והקלטות יוצגו בזמן שגוי. הגדירו NTP ב־NVR או סנכרנו את השעון עכשיו ב{link['label']} › מערכת ה־NVR › שעון.", link)
        return _step("nvr", "failed", p["message"], facts=facts, evidence=evidence, settings_link=link, problem=p, source="live")
    if time_check.get("level") == "warn":
        warnings.append(_warning("nvr_clock_drift", f"שעון ה־NVR סוטה ב־{_signed(time_check['drift_s'])} שניות (עד {DRIFT_OK_S} תקין). מומלץ NTP ב־NVR.", link))
    elif time_check.get("level") == "unknown":
        warnings.append(_warning("nvr_clock_unknown", "שעון ה־NVR לא נקרא" + (f" ({time_check['error']})" if time_check.get("error") else "") + "; הסטייה לא נבדקה.", link))
    if time_check.get("dst") == "unknown" and time_check.get("level") != "unknown":
        warnings.append(_warning("nvr_dst_unknown", "ה־NVR לא ציין היסט מ־UTC בשעון שלו; לא ניתן לוודא את שעון הקיץ.", link))
    if with_tracks < len(channels):
        warnings.append(_warning("tracks_missing", f"ל־{len(channels) - with_tracks} ערוצים אין זרם ראשי ומשני ב־NVR; ניגון או תצוגה חיה בהם עלולים להיכשל.", _link("devices")))
    if offline:
        warnings.append(_warning("channels_offline", f"{offline} ערוצים לא מקוונים ב־NVR.", _link("devices")))
    warnings.extend(_codec_warnings(codec_items))
    w = _alert_warning()
    if w:
        warnings.append(w)
    return _step("nvr", "done", f"{info.get('model') or 'NVR'} · קושחה {info.get('firmware') or '?'} · {len(channels)} ערוצים", facts=facts, evidence=evidence,
                 settings_link=link, warnings=warnings, source="live")


# ---------------------------------------------------------------- step 3: Home Assistant and the bridge

def _ha_not_configured(settings: Settings) -> dict[str, Any]:
    link = _link("ha")
    if settings.in_addon:
        action = "ה־Add-on לא קיבל גישה ל־Home Assistant מה־Supervisor. עדכנו את ה־Add-on לגרסה האחרונה והפעילו אותו מחדש."
    else:
        action = "מחוץ ל־Add-on: הגדירו HA_URL ו־HA_TOKEN (Long-Lived Access Token) בסביבת השרת והפעילו אותו מחדש."
    return _problem("ha_not_configured", "אין ל־Add-on חיבור ל־Home Assistant.", action, link)


HA_ERRORS = {
    "ha_unavailable": ("Home Assistant לא ענה ל־Add-on.", "ודאו ש־Home Assistant פועל; אם הוא הופעל מחדש עכשיו, המתינו דקה ובדקו שוב."),
    "ha_forbidden": ("Home Assistant דחה את הגישה של ה־Add-on.", "הפעילו מחדש את ה־Add-on כדי שיקבל אסימון חדש מה־Supervisor; מחוץ ל־Add-on החליפו את HA_TOKEN."),
    "ha_error": ("Home Assistant החזיר שגיאה.", "בדקו את יומן Home Assistant (הגדרות › מערכת › יומנים) ובדקו שוב."),
    "check_timeout": ("Home Assistant לא ענה בזמן (הבדיקה הופסקה אחרי 20 שניות).", "Home Assistant עונה לאט מדי: אם הוא הופעל מחדש עכשיו, המתינו דקה ובדקו שוב."),
}


def _bridge_view(conn: sqlite3.Connection) -> dict[str, Any]:
    from ..db import get_setting

    st = bridge_install.status(conn=conn)
    paired = bool(get_setting(conn, "bridge.secret")) and bool(get_setting(conn, "bridge.paired_at"))
    try:
        users = conn.execute("SELECT COUNT(*) FROM ha_users").fetchone()[0]
    except sqlite3.OperationalError:
        users = 0
    # a paired integration that reported an empty version has no active version at all, which bridge_install reads as
    # "copied, never loaded" - forever. Paired means it is loaded; its version is unknown, not a pending restart.
    version_unknown = paired and not st.get("active_version")
    pending = st.get("state") in ("installed_pending", "update_pending") and not version_unknown
    return {"state": st.get("state"), "installed_version": st.get("installed_version"), "active_version": st.get("active_version"), "source_version": st.get("source_version"),
            "paired": paired, "restart_pending": pending, "version_unknown": version_unknown, "directory_users": users, "last_error": st.get("last_error")}


def ha_step(settings: Settings, conn: sqlite3.Connection, *, live: dict[str, Any] | None = None, source: str = "background") -> dict[str, Any]:
    """Configured, the WebSocket sync connected, the bridge integration paired and loaded (no restart pending); with
    `live` (the /api/config probe) also HA's version, time zone and clock."""
    link = _link("ha")
    hs = ha_sync.STATE.as_dict()
    bridge = _bridge_view(conn)
    evidence: dict[str, Any] = {"configured": ha_client.configured(settings), "connected": bool(hs.get("connected")), "ha_version": (live or {}).get("version") or hs.get("ha_version"),
                                "entities": hs.get("entities", 0), "last_error": hs.get("last_error"), "bridge": bridge, "time": (live or {}).get("time"), "reachable": (live or {}).get("reachable")}
    bridge_label = {"active": "פעיל", "installed_pending": "הותקן · ממתין להפעלה מחדש של HA", "update_pending": "עדכון ממתין להפעלה מחדש של HA",
                    "not_installed": "לא מותקן", "not_available": "התקנה ידנית", "error": "שגיאת התקנה"}.get(str(bridge["state"]), str(bridge["state"]))
    facts = [
        _fact("חיבור (WebSocket)", "מחובר" if evidence["connected"] else "מנותק", "ok" if evidence["connected"] else "err"),
        _fact("גרסת Home Assistant", evidence["ha_version"]),
        _fact("ישויות בקטלוג", evidence["entities"]),
        _fact("אינטגרציית הגשר", f"{bridge_label} · גרסה {bridge['active_version'] or bridge['installed_version'] or '—'}", "warn" if bridge["restart_pending"] else ""),
        _fact("צימוד הגשר", "מצומד" if bridge["paired"] else "לא מצומד", "ok" if bridge["paired"] else "err"),
        _fact("ממתין להפעלה מחדש של HA", "כן" if bridge["restart_pending"] else "לא", "err" if bridge["restart_pending"] else "ok"),
    ]
    tc = evidence["time"]
    if tc:
        facts.append(_drift_fact("שעון HA מול ה־Add-on", tc))
        facts.append(_fact("אזור הזמן ב־HA", f"{tc.get('ha_zone') or '—'}" + ("" if tc.get("zone_match") in (None, True) else f" (בהתקנה: {tc.get('zone')})"), "warn" if tc.get("zone_match") is False else ""))
        if tc.get("nvr_ha_s") is not None:
            facts.append(_fact("שעון ה־NVR מול HA", f"{_signed(tc['nvr_ha_s'])} שנ׳", {"ok": "ok", "warn": "warn", "fail": "err"}.get(drift_level(tc["nvr_ha_s"]), "")))
    elif source == "background":
        facts.append(_fact("שעון HA מול ה־Add-on", "לא נבדק עדיין — לחצו \"בדוק שוב\""))

    def failed(p: dict[str, Any]) -> dict[str, Any]:
        return _step("ha", "failed", p["message"], facts=facts, evidence=evidence, settings_link=link, problem=p, source=source)

    if not evidence["configured"]:
        return failed(_ha_not_configured(settings))
    if live and live.get("error"):
        message, action = HA_ERRORS.get(live["error"], (f"קריאה מ־Home Assistant נכשלה ({live['error']}).", "בדקו שוב בעוד רגע."))
        return failed(_problem(live["error"], message, action, link))
    if not evidence["connected"]:
        return failed(_problem("ha_disconnected", "סנכרון המצבים עם Home Assistant מנותק" + (f" ({hs['last_error']})." if hs.get("last_error") else "."),
                               "ה־Add-on מתחבר מחדש לבד תוך דקה. אם זה נמשך — הפעילו מחדש את ה־Add-on ובדקו את יומן Home Assistant.", link))
    if bridge["restart_pending"]:
        return failed(_problem("ha_restart_pending", "אינטגרציית SMPLWISE Bridge הועתקה ל־Home Assistant אבל עוד לא נטענה.",
                               "הפעילו מחדש את Home Assistant (הגדרות › מערכת › הפעלה מחדש); עד אז שירותים חדשים נענים \"השירות אינו מורשה\".", link))
    if bridge["state"] == "error":
        return failed(_problem("bridge_copy_failed", f"העתקת אינטגרציית הגשר ל־Home Assistant נכשלה ({bridge['last_error']}).",
                               f"לחצו \"התקנת הגשר\" ב{link['label']}, או העתיקו את custom_components/smplwise_bridge ידנית.", link))
    if not bridge["paired"]:
        return failed(_problem("bridge_not_paired", "הגשר (SMPLWISE Bridge) עוד לא צומד ל־Arx.",
                               "ב־Home Assistant › הגדרות › Devices & services אשרו את \"SMPLWISE Bridge\" (קוד הצימוד כבר ממולא); בהתקנה ידנית קוד הצימוד מופיע ב"
                               + link["label"] + ".", link))
    if tc and tc.get("level") == "fail":
        return failed(_problem("ha_clock_drift", f"שעון Home Assistant סוטה ב־{_signed(tc['drift_s'])} שניות משעון ה־Add-on (מותר עד {DRIFT_FAIL_S}).",
                               "Home Assistant ו־ה־Add-on רצים על אותה מכונה, כך שסטייה כזו מעידה על שעון מערכת שגוי: בדקו את NTP של מערכת ההפעלה של Home Assistant (הגדרות › מערכת › כללי).", link))
    warnings = []
    if bridge["version_unknown"]:
        warnings.append(_warning("bridge_version_unknown", "הגשר מצומד אבל לא דיווח את הגרסה שלו, כך שלא ידוע אם הוא מעודכן. לחצו \"התקנת הגשר\" ב"
                                 + link["label"] + " והפעילו מחדש את Home Assistant פעם אחת.", link))
    if tc and tc.get("level") == "warn":
        warnings.append(_warning("ha_clock_drift", f"שעון Home Assistant סוטה ב־{_signed(tc['drift_s'])} שניות מה־Add-on.", link))
    if tc and tc.get("zone_match") is False:
        warnings.append(_warning("ha_zone_mismatch", f"אזור הזמן ב־Home Assistant ({tc['ha_zone']}) שונה מזה של ההתקנה ({tc['zone']}); שעות בהיסטוריית HA יוצגו אחרת מזמני האירועים. אזור הזמן של ההתקנה נקבע ב־" + LINKS["media"][1] + ".", _link("media")))
    if tc and tc.get("nvr_ha_s") is not None and drift_level(tc["nvr_ha_s"]) in ("warn", "fail"):
        warnings.append(_warning("nvr_ha_drift", f"שעון ה־NVR ושעון Home Assistant רחוקים זה מזה ב־{abs(tc['nvr_ha_s'])} שניות; התאמת דלת–מצלמה עלולה לפספס.", _link("connections")))
    return _step("ha", "done", f"Home Assistant {evidence['ha_version'] or ''} · הגשר פעיל ומצומד · {evidence['entities']} ישויות".replace("  ", " "), facts=facts,
                 evidence=evidence, settings_link=link, warnings=warnings, source=source)


def ha_probe(settings: Settings, tz_name: str, now: dt.datetime | None = None) -> dict[str, Any]:
    """HA's /api/config (version, time zone, Date header) - the device part only; ha_step composes it with the sync and
    bridge state when the state is built. The caller checks that HA is configured."""
    try:
        config, date_header = ha_client.get_config(settings)
    except ApiError as exc:
        return {"error": exc.code, "reachable": False, "checked_at": now_iso()}
    tc = ha_time_check(date_header, config.get("time_zone"), zone(tz_name), now or dt.datetime.now(dt.timezone.utc))
    return {"version": config.get("version"), "time": tc, "reachable": True, "checked_at": now_iso()}


def _with_nvr_gap(live: dict[str, Any]) -> dict[str, Any]:
    """The NVR-HA clock gap from the latest cached results of both checks, whichever of them ran last."""
    tc = dict(live.get("time") or {})
    nvr_time = ((_cached_live("nvr") or {}).get("evidence") or {}).get("time") or {}
    if tc.get("drift_s") is not None and nvr_time.get("drift_s") is not None:
        tc["nvr_ha_s"] = int(nvr_time["drift_s"]) - int(tc["drift_s"])
    return {**live, "time": tc or None}


# ---------------------------------------------------------------- step 4: go2rtc

GO2RTC_ERRORS = {
    "media_not_configured": ("כתובת go2rtc לא הוגדרה.", "מלאו go2rtc_url (למשל http://<כתובת HA>:1984) ב־Home Assistant › Add-ons › SmplWise Arx › Configuration והפעילו מחדש."),
    "media_unavailable": ("go2rtc לא ענה.", "ודאו שה־Add-on של go2rtc מותקן ופועל ושהכתובת go2rtc_url נכונה (כולל הפורט, בדרך כלל 1984)."),
    "media_error": ("go2rtc החזיר שגיאה.", "אם ה־API של go2rtc מוגן בסיסמה, מלאו go2rtc_api_username ו־go2rtc_api_password ב־Configuration של ה־Add-on."),
}


def _go2rtc_problem(code: str, detail: str | None = None) -> dict[str, Any]:
    message, action = GO2RTC_ERRORS.get(code, (f"go2rtc: {code}.", "בדקו את go2rtc_url ואת מצב ה־Add-on של go2rtc."))
    return _problem(code, message + (f" ({detail})" if detail else ""), action, _link("media"))


def _expected_streams(conn: sqlite3.Connection) -> list[str]:
    return [g2.stream_name(r["recorder_id"], r["channel"], p) for r in conn.execute("SELECT recorder_id, channel FROM cameras WHERE enabled = 1 ORDER BY channel") for p in ("sub", "main")]


def go2rtc_background(settings: Settings, conn: sqlite3.Connection) -> dict[str, Any]:
    link = _link("media")
    if not settings.go2rtc_url:
        p = _go2rtc_problem("media_not_configured")
        return _step("go2rtc", "failed", p["message"], facts=[_fact("מוגדר ב־Add-on options", "לא", "err")], evidence={"configured": False}, settings_link=link, problem=p, source="background")
    if is_ha_only(settings):
        # NVR-less mode: no camera streams exist or are synced; the step is go2rtc answering (WisKey station video)
        with _lock:
            ok = dict(_go2rtc_ok)
        if ok:
            ev = ok.get("evidence") or {}
            return _step("go2rtc", "done", f"go2rtc {ev.get('version') or '?'} ענה בבדיקה האחרונה", facts=ok.get("facts") or [], evidence=ev, settings_link=link,
                         source="background", checked_at=ok.get("checked_at"))
        p = _problem("not_checked", "go2rtc עוד לא נבדק מאז שה־Add-on עלה.", "לחצו \"בדוק שוב\" כדי לבדוק שהוא עונה.", link)
        return _step("go2rtc", "todo", p["message"], facts=[_fact("מוגדר ב־Add-on options", "כן", "ok")], evidence={"configured": True}, settings_link=link, problem=p, source="background")
    ds = dict(autosync.STATE)
    expected = len(_expected_streams(conn))
    evidence = {"configured": True, "expected_streams": expected, "sync_last_ok": ds.get("streams_last_ok"), "sync_last_error": ds.get("streams_last_error")}
    facts = [_fact("זרמים צפויים (2 לכל מצלמה פעילה)", expected), _fact("סנכרון זרמים אחרון תקין", ds.get("streams_last_ok")), _fact("גרסה", "לא נבדקה עדיין — לחצו \"בדוק שוב\"")]
    if ds.get("streams_last_error") and ds.get("streams_last_error") != "media_not_configured":
        p = _go2rtc_problem(str(ds["streams_last_error"]))
        return _step("go2rtc", "failed", p["message"], facts=facts, evidence=evidence, settings_link=link, problem=p, source="background", checked_at=ds.get("streams_last_run"))
    if ds.get("streams_last_ok"):
        return _step("go2rtc", "done", f"{expected} זרמים שלנו מסונכרנים (לפי הסנכרון האחרון)", facts=facts, evidence=evidence, settings_link=link, source="background", checked_at=ds.get("streams_last_ok"))
    p = _problem("not_checked", "go2rtc עוד לא נבדק מאז שה־Add-on עלה.", "לחצו \"בדוק שוב\" כדי לקרוא את הגרסה ואת הזרמים עכשיו.", link)
    return _step("go2rtc", "todo", p["message"], facts=facts, evidence=evidence, settings_link=link, problem=p, source="background")


def go2rtc_probe(settings: Settings, expected: list[str]) -> dict[str, Any]:
    """go2rtc's /api (version) and /api/streams: our `smplwise_` streams against what the cameras need (`expected`, read
    from the database before the call); others are only counted - their names are another product's business (the lab
    go2rtc also serves the intercom project). Device calls only; the caller checks that go2rtc is configured."""
    link = _link("media")
    try:
        client = g2.Go2rtc(settings)
        info = client.info()
        streams = client.list_streams()
    except ApiError as exc:
        p = _go2rtc_problem(exc.code, str((exc.details or {}).get("status") or (exc.details or {}).get("error") or "") or None)
        return _step("go2rtc", "failed", p["message"], facts=[_fact("מוגדר ב־Add-on options", "כן", "ok"), _fact("תשובה", "אין", "err")],
                     evidence={"configured": True, "reachable": False, "error": exc.code}, settings_link=link, problem=p, source="live")
    except Exception as exc:  # noqa: BLE001
        p = _go2rtc_problem("media_error", type(exc).__name__)
        return _step("go2rtc", "failed", p["message"], facts=[], evidence={"configured": True, "reachable": False, "error": type(exc).__name__}, settings_link=link, problem=p, source="live")
    ours = sorted(n for n in streams if n.startswith(g2.STREAM_PREFIX))
    online = sum(1 for n in ours if streams[n].online)
    foreign = len(streams) - len(ours)
    missing = [n for n in expected if n not in streams]
    version = info.get("version") if isinstance(info, dict) else None
    evidence = {"configured": True, "reachable": True, "version": version, "streams": ours, "online": online, "foreign": foreign, "expected_streams": len(expected), "missing": missing}
    facts = [
        _fact("גרסה", version, "ok" if version else ""),
        _fact("זרמי smplwise_ ב־go2rtc", f"{len(ours)} · {online} פעילים כרגע", "ok" if ours else "err"),
        _fact("זרמים צפויים (2 לכל מצלמה פעילה)", f"{len(expected)} · חסרים {len(missing)}", "ok" if not missing else "warn"),
        _fact("זרמים של מוצרים אחרים", f"{foreign} · לא נוגעים בהם"),
    ]
    if expected and not ours:
        p = _problem("no_streams", "ב־go2rtc אין אף זרם smplwise_, כך שאין וידאו חי.",
                     f"לחצו \"סנכרון זרמים\" ב{link['label']} (יוצר רק זרמי smplwise_; זרמים אחרים לא משתנים), ואז בדקו שוב.", link)
        return _step("go2rtc", "failed", p["message"], facts=facts, evidence=evidence, settings_link=link, problem=p, source="live")
    warnings = []
    if missing:
        warnings.append(_warning("streams_missing", f"חסרים {len(missing)} זרמים של מצלמות פעילות (למשל {missing[0]}); \"סנכרון זרמים\" ישלים אותם.", link))
    if not expected and not is_ha_only(settings):
        warnings.append(_warning("no_cameras_yet", "אין עדיין מצלמות רשומות, ולכן אין זרמים לבדוק; הזרמים ייווצרו אחרי גילוי המצלמות מה־NVR.", _link("connections")))
    return _step("go2rtc", "done", f"go2rtc {version or '?'} · {len(ours)} זרמים שלנו ({online} פעילים)", facts=facts, evidence=evidence, settings_link=link, warnings=warnings, source="live")


# ---------------------------------------------------------------- steps 5-6: floor and camera (local)

def _published_floors(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute(
        """SELECT f.id, f.name, b.name AS building, MAX(v.published_at) AS published_at FROM floors f
           JOIN buildings b ON b.id = f.building_id AND b.deleted_at IS NULL
           JOIN sites s ON s.id = b.site_id AND s.deleted_at IS NULL
           JOIN plan_versions v ON v.floor_id = f.id AND v.status = 'published'
           WHERE f.deleted_at IS NULL GROUP BY f.id ORDER BY b.sort_order, f.sort_order, f.level""").fetchall()


def floor_step(conn: sqlite3.Connection) -> dict[str, Any]:
    link = _link("sites")
    sites = conn.execute("SELECT id FROM sites WHERE deleted_at IS NULL ORDER BY sort_order").fetchall()
    buildings = conn.execute("SELECT b.id FROM buildings b JOIN sites s ON s.id = b.site_id AND s.deleted_at IS NULL WHERE b.deleted_at IS NULL ORDER BY b.sort_order").fetchall()
    floors = conn.execute(
        """SELECT f.id, f.name FROM floors f JOIN buildings b ON b.id = f.building_id AND b.deleted_at IS NULL JOIN sites s ON s.id = b.site_id AND s.deleted_at IS NULL
           WHERE f.deleted_at IS NULL ORDER BY b.sort_order, f.sort_order, f.level""").fetchall()
    published = _published_floors(conn)
    drafts = {r[0] for r in conn.execute("SELECT DISTINCT floor_id FROM plan_versions WHERE status = 'draft'")}
    pub_ids = {r["id"] for r in published}
    evidence = {"sites": len(sites), "buildings": len(buildings), "floors": len(floors), "floors_published": len(published),
                "published": [{"id": r["id"], "name": r["name"], "building": r["building"], "published_at": r["published_at"]} for r in published[:10]],
                "without_plan": [{"id": r["id"], "name": r["name"], "draft": r["id"] in drafts} for r in floors if r["id"] not in pub_ids][:10]}
    facts = [
        _fact("אתרים · מבנים · קומות", f"{len(sites)} · {len(buildings)} · {len(floors)}", "ok" if floors else "warn"),
        _fact("קומות עם תוכנית מפורסמת", f"{len(published)} מתוך {len(floors)}", "ok" if published else "warn"),
    ]
    if published:
        facts.append(_fact("לדוגמה", " · ".join(f"{r['building']} / {r['name']}" for r in published[:3])))
    if not sites or not buildings:
        p = _problem("no_building", "עדיין אין אתר ומבנה במערכת.", f"צרו אתר ובתוכו מבנה ב{link['label']}.", link)
        return _step("floor", "todo", p["message"], facts=facts, evidence=evidence, settings_link=link, problem=p)
    if not floors:
        b = buildings[0]["id"]
        p = _problem("no_floor", "למבנה עדיין אין קומות.", "הוסיפו קומה למבנה (כפתור \"קומה חדשה\").", {"href": f"#/explore/buildings/{b}/floors", "label": "מפה › קומות המבנה"})
        return _step("floor", "todo", p["message"], facts=facts, evidence=evidence, settings_link=link, problem=p)
    if not published:
        f = floors[0]
        if f["id"] in drafts:
            p = _problem("plan_not_published", f"לקומה \"{f['name']}\" יש תוכנית בטיוטה שעוד לא פורסמה.", "פתחו את הייבוא, בדקו את התוכנית ופרסמו אותה; רק תוכנית מפורסמת מוצגת במפה.",
                         {"href": f"#/explore/floors/{f['id']}/import", "label": "ייבוא ופרסום התוכנית"})
        else:
            p = _problem("no_plan", f"לקומה \"{f['name']}\" עדיין אין תוכנית.", "העלו תוכנית (PDF, PNG, JPG או DXF), כווננו סיבוב וחיתוך ופרסמו.",
                         {"href": f"#/explore/floors/{f['id']}/import", "label": "ייבוא תוכנית לקומה"})
        return _step("floor", "todo", p["message"], facts=facts, evidence=evidence, settings_link=link, problem=p)
    warnings = []
    if len(published) < len(floors):
        f = next(r for r in floors if r["id"] not in pub_ids)
        warnings.append(_warning("floors_without_plan", f"ל־{len(floors) - len(published)} קומות אין עדיין תוכנית מפורסמת (למשל \"{f['name']}\").",
                                 {"href": f"#/explore/floors/{f['id']}/import", "label": "ייבוא תוכנית"}))
    return _step("floor", "done", f"{len(published)} קומות עם תוכנית מפורסמת", facts=facts, evidence=evidence, settings_link=link, warnings=warnings)


def _has_stream(caps_json: str | None) -> bool:
    try:
        return bool(json.loads(caps_json or "{}").get("stream"))
    except (ValueError, AttributeError):
        return False


def camera_step(conn: sqlite3.Connection, nvr_status: str) -> dict[str, Any]:
    cams = conn.execute("SELECT id, channel, alias, name_source, enabled, status, capabilities_json FROM cameras ORDER BY sort_order, channel").fetchall()
    placed_rows = conn.execute(
        """SELECT DISTINCT a.resource_id, a.floor_id FROM map_anchors a JOIN floors f ON f.id = a.floor_id AND f.deleted_at IS NULL
           WHERE a.resource_type = 'camera' AND a.effective_to IS NULL""").fetchall()
    placed = {r["resource_id"] for r in placed_rows}
    published = _published_floors(conn)
    name = {r["id"]: (r["alias"] or r["name_source"] or f"ערוץ {r['channel']}") for r in cams}
    unplaced = [r["id"] for r in cams if r["enabled"] and r["id"] not in placed]
    with_stream = sum(1 for r in cams if _has_stream(r["capabilities_json"]))
    offline = sum(1 for r in cams if r["status"] == "offline")
    placed_known = [cid for cid in placed if cid in name]
    editor = {"href": f"#/explore/floors/{published[0]['id']}/edit", "label": "עורך התוכנית (הצבת מצלמות)"} if published else _link("sites")
    evidence = {"cameras": len(cams), "enabled": sum(1 for r in cams if r["enabled"]), "placed": len(placed_known), "unplaced": [{"id": c, "name": name[c]} for c in unplaced[:10]],
                "with_stream_profile": with_stream, "offline": offline}
    facts = [
        _fact("מצלמות רשומות (פעילות)", f"{len(cams)} ({evidence['enabled']})", "ok" if cams else "warn"),
        _fact("מוצבות על מפה", f"{len(placed_known)} מתוך {evidence['enabled']}", "ok" if placed_known else "warn"),
        _fact("עם פרופיל זרם ידוע מה־NVR", f"{with_stream} מתוך {len(cams)}", "ok" if cams and with_stream == len(cams) else ""),
    ]
    if not cams:
        if nvr_status != "done":
            p = _problem("waiting_for_nvr", "אין עדיין מצלמות, כי שלב ה־NVR לא הושלם.", "השלימו את שלב ה־NVR; המצלמות מתגלות ממנו לבד תוך דקה.", _link("connections"))
            return _step("camera", "skipped", p["message"], facts=facts, evidence=evidence, settings_link=editor, problem=p)
        p = _problem("no_cameras", "ה־NVR מחובר אבל עוד אין מצלמות רשומות.", "גילוי המצלמות רץ בהפעלה וכל 10 דקות; להפעלה מיידית לחצו \"סנכרון מה־NVR\" ב"
                     + LINKS["devices"][1] + ".", _link("devices"))
        return _step("camera", "todo", p["message"], facts=facts, evidence=evidence, settings_link=editor, problem=p)
    if not published:
        p = _problem("waiting_for_floor", "אין עדיין קומה עם תוכנית מפורסמת להציב עליה מצלמות.", "השלימו את שלב הקומה, ואז הציבו מצלמה בעורך התוכנית.", _link("sites"))
        return _step("camera", "skipped", p["message"], facts=facts, evidence=evidence, settings_link=editor, problem=p)
    if not placed_known:
        p = _problem("no_camera_placed", "אף מצלמה עוד לא מוצבת על מפה.", "פתחו את עורך התוכנית, גררו מצלמה מהרשימה אל מקומה וכוונו את קונוס הראייה. ההצבה נשמרת ב־Arx בלבד.", editor)
        return _step("camera", "todo", p["message"], facts=facts, evidence=evidence, settings_link=editor, problem=p)
    warnings = []
    if unplaced:
        warnings.append(_warning("cameras_unplaced", f"{len(unplaced)} מצלמות עוד לא מוצבות (למשל \"{name[unplaced[0]]}\").", editor))
    if offline:
        warnings.append(_warning("cameras_offline", f"{offline} מצלמות מדווחות כלא מקוונות ב־NVR.", _link("devices")))
    return _step("camera", "done", f"{len(placed_known)} מצלמות מוצבות על המפה", facts=facts, evidence=evidence, settings_link=editor, warnings=warnings)


# ---------------------------------------------------------------- NVR-less mode (mode.py)

NVR_LESS_SKIP = "דילוג - מצב ללא NVR"
NVR_LESS_ACTION = ("להוספת NVR בהמשך: מלאו nvr_host, nvr_username ו־nvr_password ב־Home Assistant › Add-ons › SmplWise Arx › "
                   "Configuration והפעילו מחדש את ה־Add-on. הנתונים (מפות, תוכניות, הרשאות) נשארים כמו שהם, בלי הסבה.")


def not_applicable_step(step_id: str, summary: str, problem: dict[str, Any], link: dict[str, str], *, label: str = NVR_LESS_SKIP) -> dict[str, Any]:
    """A step that is not part of this installation: neither done nor failed, and not counted in `total`."""
    return _step(step_id, "not_applicable", summary, facts=[_fact("מצב ההתקנה", "Home Assistant בלבד (ללא NVR)")], evidence={"configured": False, "mode": "ha_only"},
                 settings_link=link, problem=problem) | {"status_label": label}


def nvr_less_steps(settings: Settings) -> dict[str, dict[str, Any]]:
    """The NVR and camera steps (and go2rtc while it is not configured - optional here, only WisKey station video uses it)
    in the NVR-less mode."""
    conn_link = _link("connections")
    p = _problem("nvr_less_mode", "ההתקנה פועלת במצב ללא NVR (Home Assistant בלבד) - הדילוג מכוון.", NVR_LESS_ACTION, conn_link)
    out = {
        "nvr": not_applicable_step("nvr", "לא מוגדר - דילוג מכוון: ההתקנה פועלת ללא NVR.", p, conn_link),
        "camera": not_applicable_step("camera", "אין מצלמות NVR במצב ללא NVR; המפה מציגה ישויות Home Assistant.", p, _link("sites")),
    }
    if not settings.go2rtc_url and not settings.wiskey_user:  # WisKey station stills and video need go2rtc
        g = _problem("go2rtc_optional", "go2rtc לא מוגדר - במצב ללא NVR הוא רשות.", "go2rtc נדרש רק לווידאו של עמדות WisKey; להפעלה מלאו go2rtc_url ב־Configuration של ה־Add-on והפעילו מחדש.", _link("media"))
        out["go2rtc"] = not_applicable_step("go2rtc", "לא מוגדר - רשות במצב ללא NVR (וידאו עמדות WisKey בלבד).", g, _link("media"), label="דילוג - לא מוגדר (רשות)")
    return out


# ---------------------------------------------------------------- state and checks

def _cached_live(step_id: str) -> dict[str, Any] | None:
    with _lock:
        hit = _live.get(step_id)
    if hit and time.time() - hit[0] < LIVE_TTL_S:
        return hit[1]
    return None


def _remember(step_id: str, result: dict[str, Any]) -> None:
    with _lock:
        _live[step_id] = (time.time(), result)
        if step_id == "go2rtc":
            _go2rtc_ok.clear()  # a failed check forgets the last success: it must not read "done" once the cache expires
            if result.get("status") == "done":
                _go2rtc_ok.update(result)


BACKGROUND: dict[str, Callable[[Settings, sqlite3.Connection], dict[str, Any]]] = {
    "nvr": nvr_background,
    "ha": lambda s, c: ha_step(s, c),
    "go2rtc": go2rtc_background,
}


def build_state(settings: Settings, conn: sqlite3.Connection, identity_source: str, *, deep_install: bool = False) -> dict[str, Any]:
    """Every step without touching a device: local steps now, device steps from the last live probe or the background."""
    steps: dict[str, dict[str, Any]] = {"install": install_step(settings, conn, identity_source, deep=deep_install)}
    skipped = nvr_less_steps(settings) if is_ha_only(settings) else {}
    for sid in DEVICE_STEPS:
        if sid in skipped:
            steps[sid] = skipped[sid]
            continue
        live = _cached_live(sid)
        if sid == "ha" and live is not None:
            # the cached HA result is the probe's own facts (reachability, version, clock); the bridge / sync part may have
            # moved on since (HA restarted, the bridge paired) and is read now, and so is the NVR-HA clock gap
            steps[sid] = ha_step(settings, conn, live=_with_nvr_gap(live), source="live") | {"checked_at": live["checked_at"]}
        else:
            steps[sid] = live if live is not None else BACKGROUND[sid](settings, conn)
    steps["floor"] = floor_step(conn)
    steps["camera"] = skipped.get("camera") or camera_step(conn, steps["nvr"]["status"])
    ordered = [steps[s] for s in STEPS]
    required = [s for s in ordered if s["status"] != "not_applicable"]  # a step skipped on purpose is not counted
    done = sum(1 for s in required if s["status"] == "done")
    nxt = next((s["id"] for s in required if s["status"] != "done"), None)
    return {
        "version": __version__, "mode": installation_mode(settings), "checked_at": now_iso(), "steps": ordered, "done": done, "total": len(required),
        "ready": done == len(required), "next": nxt,
        "thresholds": {"drift_ok_s": DRIFT_OK_S, "drift_fail_s": DRIFT_FAIL_S}, "check_every_s": CHECK_EVERY_S, "live_ttl_s": LIVE_TTL_S,
    }


def rate_limit(user_id: str, step_id: str) -> float | None:
    """Take this user's slot for the step (one per CHECK_EVERY_S, atomically: parallel requests get one slot); returns the
    previous slot for `refund`."""
    now = time.monotonic()
    with _lock:
        last = _last_check.get((user_id, step_id))
        if last is not None and now - last < CHECK_EVERY_S:
            wait = max(1, math.ceil(CHECK_EVERY_S - (now - last)))
            raise ApiError(429, "check_rate_limited", f"השלב נבדק לפני רגע; אפשר לבדוק שוב בעוד {wait} שניות.", retryable=True, details={"retry_after_s": wait, "step": step_id})
        _last_check[(user_id, step_id)] = now
    return last


def refund(user_id: str, step_id: str, previous: float | None) -> None:
    """A check that failed with an unexpected error (a 500) gives its slot back."""
    with _lock:
        if previous is None:
            _last_check.pop((user_id, step_id), None)
        else:
            _last_check[(user_id, step_id)] = previous


# ---------------------------------------------------------------- on-demand checks (device calls with a deadline)

CHECK_DEADLINE_S = 20.0  # a whole check, however many device calls it makes (each has its own shorter timeout)
_pool = ThreadPoolExecutor(max_workers=3, thread_name_prefix="setup-check")
_inflight: dict[str, Future] = {}

TIMEOUT_TEXT = {
    "nvr": ("ה־NVR", "ה־NVR עונה לאט מדי: ודאו שהוא לא עמוס (למשל בזמן חיפוש או ייצוא) ושהרשת אליו תקינה, ואז בדקו שוב.", "connections"),
    "go2rtc": ("go2rtc", "go2rtc עונה לאט מדי: ודאו שה־Add-on של go2rtc פועל ושאינו עמוס, ואז בדקו שוב.", "media"),
    "ha": ("Home Assistant", "Home Assistant עונה לאט מדי: אם הוא הופעל מחדש עכשיו, המתינו דקה ובדקו שוב.", "ha"),
}


def configured(settings: Settings, step_id: str) -> bool:
    return {"nvr": _nvr_configured(settings), "go2rtc": bool(settings.go2rtc_url), "ha": ha_client.configured(settings)}.get(step_id, False)


def prepare(conn: sqlite3.Connection, step_id: str) -> dict[str, Any]:
    """What a probe needs from the database, read before the device calls so that no read transaction spans them."""
    disabled = {int(r[0]) for r in conn.execute("SELECT channel FROM cameras WHERE enabled = 0").fetchall()} if step_id == "nvr" else set()
    return {"tz": _tz_name(conn), "expected": _expected_streams(conn) if step_id == "go2rtc" else [], "disabled": disabled}


def _probe(settings: Settings, step_id: str, inputs: dict[str, Any]) -> dict[str, Any]:
    if step_id == "nvr":
        return nvr_probe(settings, inputs["tz"], disabled=frozenset(inputs.get("disabled") or ()))
    if step_id == "go2rtc":
        return go2rtc_probe(settings, [] if is_ha_only(settings) else inputs["expected"])  # NVR-less: no camera streams expected
    return ha_probe(settings, inputs["tz"])


def _timed_out(step_id: str) -> dict[str, Any]:
    who, action, link_key = TIMEOUT_TEXT[step_id]
    if step_id == "ha":
        return {"error": "check_timeout", "reachable": False, "checked_at": now_iso()}
    p = _problem("check_timeout", f"{who} לא ענה בזמן (הבדיקה הופסקה אחרי {CHECK_DEADLINE_S:g} שניות).", action, _link(link_key))
    return _step(step_id, "failed", p["message"], facts=[_fact("תשובה", "לא בזמן", "err")], evidence={"configured": True, "reachable": False, "error": "check_timeout"},
                 settings_link=_link(link_key), problem=p, source="live")


def run_check(settings: Settings, step_id: str, inputs: dict[str, Any]) -> dict[str, Any] | None:
    """Probe one device step now - device calls only, no database connection - within CHECK_DEADLINE_S, and remember the
    result. A probe of the same step that is still running (a slow device) is joined, not started twice. Local steps and
    unconfigured devices need no probe: the state re-reads them. An unexpected error propagates (the caller refunds)."""
    if step_id not in DEVICE_STEPS or not configured(settings, step_id) or (step_id == "nvr" and is_ha_only(settings)):
        return None
    with _lock:
        fut = _inflight.get(step_id)
        if fut is None or fut.done():
            fut = _pool.submit(_probe, settings, step_id, inputs)
            _inflight[step_id] = fut
    try:
        result = fut.result(timeout=CHECK_DEADLINE_S)
    except FutureTimeout:
        result = _timed_out(step_id)
    _remember(step_id, result)
    return result
