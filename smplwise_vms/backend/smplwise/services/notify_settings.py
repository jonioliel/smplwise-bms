"""The installation's notification settings (CR-018, NOTIFICATIONS_API.md `NotifySettings`): ONE row, edited only by a holder
of `notify.manage` - quiet hours with the severity x channel pass-through matrix, escalation, lock-screen detail, retention,
and the outgoing-mail block. There are no per-user preferences (owner decision 4b).

The outgoing-mail block (`email`) is READ here (host, port, security, user, from, recipients, last test, `password_set`); its WRITE side - the
PUT /notify/email route, the SMTP sender, the write-only password file `<data>/secrets/notify_email` (mode 600) - belongs to the e-mail channel
(services/notify_email.py, S4). The password is never part of this row, never returned by any API and never logged."""
from __future__ import annotations

import datetime as dt
import json
import re
import sqlite3
from pathlib import Path
from typing import Any

from ..config import Settings
from ..db import now_iso
from .notify_policy import SEVERITIES

DAYS_SUN_FIRST = ("sun", "mon", "tue", "wed", "thu", "fri", "sat")
RETENTION_CHOICES = (7, 14, 30, 60, 90)
LOCKSCREEN_LEVELS = ("generic", "type_place", "full")
CENTER_LAYOUTS = ("sheet", "page")  # owner 2026-10-01: a side glass sheet (default) or a full page under investigate on a desktop
FAILURES_AUDIENCES = ("admins", "visible")  # owner 2026-10-01: who hears of a schedule not executed / an automation failed
HHMM = re.compile(r"^([01][0-9]|2[0-3]):[0-5][0-9]$")
SECRET_NAME = "notify_email"

DEFAULT_QUIET = {"enabled": True, "from": "22:00", "to": "07:00", "days": list(DAYS_SUN_FIRST)}
DEFAULT_PASS = {"info": {"webpush": False, "email": False, "ha_mobile": False}, "alert": {"webpush": False, "email": False, "ha_mobile": False},
                "critical": {"webpush": True, "email": True, "ha_mobile": True}}
DEFAULT_ESCALATION = {"enabled": True, "after_min": 5, "steps": 2, "to": "managers"}


class SettingsInvalid(ValueError):
    """A refused change: `code` is the contract's error code, `status` its HTTP status."""

    def __init__(self, code: str, message: str, status: int = 422, details: dict[str, Any] | None = None):
        super().__init__(code)
        self.code, self.message, self.status, self.details = code, message, status, details or {}


# ---------------------------------------------------------------- the password file

def _data_dir(where: "Settings | Path") -> Path:
    """Callers hold either the add-on Settings or just the data directory (the notifier thread knows its Database only)."""
    return where.data_dir if hasattr(where, "data_dir") else Path(where)


def secret_path(settings: "Settings | Path") -> Path:
    return _data_dir(settings) / "secrets" / SECRET_NAME


def password_set(settings: "Settings | Path") -> bool:
    p = secret_path(settings)
    try:
        return p.is_file() and p.stat().st_size > 0
    except OSError:
        return False


def read_password(settings: "Settings | Path") -> str | None:
    try:
        text = secret_path(settings).read_text(encoding="utf-8")
    except OSError:
        return None
    return text or None


# ---------------------------------------------------------------- the row

def _json(text: str | None, default: Any) -> Any:
    try:
        v = json.loads(text or "")
        return v if v is not None else default
    except ValueError:
        return default


def _email_view(raw: dict[str, Any], settings: "Settings | Path | None") -> dict[str, Any]:
    host = str(raw.get("host") or "")
    port = raw.get("port") if isinstance(raw.get("port"), int) else 587
    recipients = [str(a) for a in (raw.get("recipients") or []) if isinstance(a, str)]
    sender = str(raw.get("from") or "")
    return {
        "configured": bool(host and sender and recipients and port),
        "host": host, "port": port, "security": raw.get("security") if raw.get("security") in ("starttls", "tls", "none") else "starttls",
        "user": str(raw.get("user") or ""), "password_set": password_set(settings) if settings is not None else False,
        "from": sender, "recipients": recipients, "last_test": raw.get("last_test") if isinstance(raw.get("last_test"), dict) else None,
    }


def load(conn: sqlite3.Connection, settings: "Settings | Path | None" = None) -> dict[str, Any]:
    """NotifySettings as the API returns it (no password)."""
    r = conn.execute("SELECT * FROM notify_settings WHERE id = 1").fetchone()
    if r is None:  # a database restored from before the migration: the defaults, revision 0
        return {"quiet": dict(DEFAULT_QUIET), "pass_through": json.loads(json.dumps(DEFAULT_PASS)), "escalation": dict(DEFAULT_ESCALATION), "lockscreen": "type_place",
                "image_in_push": False, "companion": {"critical_sound_safety": False}, "retention_days": 30, "deliveries_retention_days": 14,
                "center_layout": "sheet", "failures_audience": "admins", "email": _email_view({}, settings), "revision": 0, "updated_at": None}
    quiet = {**DEFAULT_QUIET, **{k: v for k, v in _json(r["quiet_json"], {}).items() if k in DEFAULT_QUIET}}
    passed = json.loads(json.dumps(DEFAULT_PASS))
    for sev, row in (_json(r["pass_json"], {}) or {}).items():
        if sev in passed and isinstance(row, dict):
            passed[sev].update({k: bool(v) for k, v in row.items() if k in passed[sev]})
    esc = {**DEFAULT_ESCALATION, **{k: v for k, v in _json(r["escalation_json"], {}).items() if k in DEFAULT_ESCALATION}}
    return {
        "quiet": quiet, "pass_through": passed, "escalation": esc, "lockscreen": r["lockscreen"], "image_in_push": False,
        "companion": {"critical_sound_safety": bool(_json(r["companion_json"], {}).get("critical_sound_safety"))},
        "retention_days": r["retention_days"], "deliveries_retention_days": 14,
        "center_layout": r["center_layout"] if r["center_layout"] in CENTER_LAYOUTS else "sheet",
        "failures_audience": r["failures_audience"] if r["failures_audience"] in FAILURES_AUDIENCES else "admins",
        "email": _email_view(_json(r["email_json"], {}), settings), "revision": r["revision"], "updated_at": r["updated_at"],
    }


def _validate_quiet(q: Any) -> dict[str, Any]:
    if not isinstance(q, dict):
        raise SettingsInvalid("validation", "שעות שקט לא תקינות.", details={"field": "quiet"})
    out = {**DEFAULT_QUIET}
    if "enabled" in q:
        out["enabled"] = bool(q["enabled"])
    for f in ("from", "to"):
        if f in q:
            if not isinstance(q[f], str) or not HHMM.match(q[f]):
                raise SettingsInvalid("quiet_invalid", "שעה לא תקינה (HH:MM).", details={"field": f"quiet.{f}"})
            out[f] = q[f]
    if out["from"] == out["to"]:
        raise SettingsInvalid("quiet_invalid", "שעות שקט דורשות שתי שעות שונות.", details={"field": "quiet"})
    if "days" in q:
        days = q["days"]
        if not isinstance(days, list) or any(d not in DAYS_SUN_FIRST for d in days):
            raise SettingsInvalid("quiet_invalid", "ימים לא תקינים.", details={"field": "quiet.days"})
        out["days"] = [d for d in DAYS_SUN_FIRST if d in days]
    return out


def _validate_pass(p: Any, current: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(p, dict) or set(p) - set(SEVERITIES):
        raise SettingsInvalid("validation", "מטריצת המעבר לא תקינה.", details={"field": "pass_through"})
    out = json.loads(json.dumps(current))
    for sev, row in p.items():
        if not isinstance(row, dict) or set(row) - {"webpush", "email", "ha_mobile"}:
            raise SettingsInvalid("validation", "מטריצת המעבר לא תקינה.", details={"field": f"pass_through.{sev}"})
        out[sev].update({k: bool(v) for k, v in row.items()})
    return out


def _validate_escalation(e: Any, current: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(e, dict):
        raise SettingsInvalid("escalation_invalid", "הגדרות ההסלמה לא תקינות.", details={"field": "escalation"})
    out = {**current}
    if "enabled" in e:
        out["enabled"] = bool(e["enabled"])
    if "after_min" in e:
        v = e["after_min"]
        if isinstance(v, bool) or not isinstance(v, int) or not 1 <= v <= 60:
            raise SettingsInvalid("escalation_invalid", "דקות ההסלמה: 1 עד 60.", details={"field": "escalation.after_min"})
        out["after_min"] = v
    if "steps" in e:
        v = e["steps"]
        if isinstance(v, bool) or not isinstance(v, int) or not 1 <= v <= 3:
            raise SettingsInvalid("escalation_invalid", "מספר שלבי ההסלמה: 1 עד 3.", details={"field": "escalation.steps"})
        out["steps"] = v
    if "to" in e:
        t = e["to"]
        if t != "managers" and not (isinstance(t, list) and t and len(t) <= 100 and all(isinstance(i, str) and 0 < len(i) <= 128 for i in t)):
            raise SettingsInvalid("escalation_invalid", "יעד ההסלמה: מנהלי התראות או משתמשים נבחרים.", details={"field": "escalation.to"})
        out["to"] = t if t == "managers" else sorted(set(t))
    return out


def update(conn: sqlite3.Connection, body: dict[str, Any], actor_user_id: str, expected_revision: int | None = None) -> tuple[dict[str, Any], list[str]]:
    """Apply a PUT body; returns (stored settings, the field names that changed). Raises SettingsInvalid."""
    cur = load(conn)
    if expected_revision is not None and expected_revision != cur["revision"]:
        raise SettingsInvalid("settings_conflict", "ההגדרות השתנו בינתיים; טען מחדש.", 412, {"current_revision": cur["revision"], "sent_revision": expected_revision})
    allowed = {"quiet", "pass_through", "escalation", "lockscreen", "image_in_push", "companion", "retention_days", "center_layout", "failures_audience", "revision", "base_revision", "deliveries_retention_days", "email", "updated_at"}
    unknown = sorted(set(body) - allowed)
    if unknown:
        raise SettingsInvalid("validation", "שדה לא מוכר.", details={"fields": unknown})
    new = {k: cur[k] for k in ("quiet", "pass_through", "escalation", "lockscreen", "retention_days", "center_layout", "failures_audience")}
    new["companion"] = dict(cur["companion"])
    if "quiet" in body:
        if not isinstance(body["quiet"], dict):
            raise SettingsInvalid("validation", "שעות שקט לא תקינות.", details={"field": "quiet"})
        new["quiet"] = _validate_quiet({**cur["quiet"], **body["quiet"]})
    if "pass_through" in body:
        new["pass_through"] = _validate_pass(body["pass_through"], cur["pass_through"])
    if "escalation" in body:
        new["escalation"] = _validate_escalation(body["escalation"], cur["escalation"])
    if "lockscreen" in body:
        if body["lockscreen"] not in LOCKSCREEN_LEVELS:
            raise SettingsInvalid("validation", "רמת פרטיות לא מוכרת.", details={"field": "lockscreen"})
        new["lockscreen"] = body["lockscreen"]
    if body.get("image_in_push"):
        raise SettingsInvalid("validation", "תמונה בהתראה תיתמך בשלב מאוחר יותר.", details={"field": "image_in_push"})
    if "companion" in body:
        c = body["companion"]
        if not isinstance(c, dict) or set(c) - {"critical_sound_safety"}:
            raise SettingsInvalid("validation", "הגדרת Companion לא תקינה.", details={"field": "companion"})
        new["companion"] = {"critical_sound_safety": bool(c.get("critical_sound_safety"))}
    if "retention_days" in body:
        if body["retention_days"] not in RETENTION_CHOICES or isinstance(body["retention_days"], bool):
            raise SettingsInvalid("validation", "תקופת שמירה: 7, 14, 30, 60 או 90 ימים.", details={"field": "retention_days"})
        new["retention_days"] = body["retention_days"]
    if "center_layout" in body:
        if body["center_layout"] not in CENTER_LAYOUTS:
            raise SettingsInvalid("validation", "center_layout: sheet או page.", details={"field": "center_layout"})
        new["center_layout"] = body["center_layout"]
    if "failures_audience" in body:
        if body["failures_audience"] not in FAILURES_AUDIENCES:
            raise SettingsInvalid("validation", "failures_audience: admins או visible.", details={"field": "failures_audience"})
        new["failures_audience"] = body["failures_audience"]
    changed = sorted(k for k in new if new[k] != cur[k])
    conn.execute(
        "UPDATE notify_settings SET quiet_json = ?, pass_json = ?, escalation_json = ?, lockscreen = ?, companion_json = ?, retention_days = ?, center_layout = ?, failures_audience = ?, revision = revision + 1, updated_by = ?, updated_at = ? WHERE id = 1",
        (json.dumps(new["quiet"]), json.dumps(new["pass_through"]), json.dumps(new["escalation"]), new["lockscreen"], json.dumps(new["companion"]), new["retention_days"], new["center_layout"], new["failures_audience"], actor_user_id, now_iso()),
    )
    return load(conn), changed


# ---------------------------------------------------------------- the e-mail block (read side; S4 writes it)

def store_last_test(conn: sqlite3.Connection, ok: bool, detail: str) -> None:
    """Record the result of the last e-mail test (S4's POST /notify/email/test) on the settings row."""
    raw = _json((conn.execute("SELECT email_json FROM notify_settings WHERE id = 1").fetchone() or {"email_json": "{}"})["email_json"], {})
    raw["last_test"] = {"at": now_iso(), "ok": ok, "detail": detail}
    conn.execute("UPDATE notify_settings SET email_json = ? WHERE id = 1", (json.dumps(raw),))


def email_internal(conn: sqlite3.Connection) -> dict[str, Any]:
    """The mail block with everything the sender needs except the password (read through read_password)."""
    r = conn.execute("SELECT email_json FROM notify_settings WHERE id = 1").fetchone()
    return _email_view(_json(r["email_json"] if r else "{}", {}), None)


# ---------------------------------------------------------------- quiet hours

def in_quiet_hours(quiet: dict[str, Any], at: dt.datetime, tz_name: str) -> bool:
    """Whether `at` falls in the installation's quiet hours. The window may cross midnight; a day in `days` names the day the
    window STARTS (a Monday 22:00-07:00 window covers Tuesday 02:00)."""
    if not quiet.get("enabled"):
        return False
    from .timeutil import zone

    local = at.astimezone(zone(tz_name))
    hm = local.strftime("%H:%M")
    start, end = quiet.get("from") or "22:00", quiet.get("to") or "07:00"
    days = quiet.get("days") or list(DAYS_SUN_FIRST)
    day = DAYS_SUN_FIRST[(local.weekday() + 1) % 7]  # python Monday=0 -> index 1
    prev = DAYS_SUN_FIRST[(local.weekday()) % 7]  # the day before
    if start < end:
        return start <= hm < end and day in days
    if hm >= start:
        return day in days
    if hm < end:
        return prev in days
    return False


def morning_after(quiet: dict[str, Any], at: dt.datetime, tz_name: str) -> dt.datetime:
    """The next instant the quiet window's `to` time occurs (the "until morning" snooze)."""
    from .timeutil import zone

    z = zone(tz_name)
    local = at.astimezone(z)
    h, m = (int(x) for x in (quiet.get("to") or "07:00").split(":"))
    target = local.replace(hour=h, minute=m, second=0, microsecond=0)
    if target <= local:
        target += dt.timedelta(days=1)
    return target.astimezone(dt.timezone.utc)


def failures_audience(conn: sqlite3.Connection) -> str:
    r = conn.execute("SELECT failures_audience FROM notify_settings WHERE id = 1").fetchone()
    return r["failures_audience"] if r and r["failures_audience"] in FAILURES_AUDIENCES else "admins"


def center_layout(conn: sqlite3.Connection) -> str:
    r = conn.execute("SELECT center_layout FROM notify_settings WHERE id = 1").fetchone()
    return r["center_layout"] if r and r["center_layout"] in CENTER_LAYOUTS else "sheet"
