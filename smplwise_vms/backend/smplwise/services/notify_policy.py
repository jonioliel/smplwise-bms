"""Notification sources and their policy (CR-018 section 5 / NOTIFICATIONS_API.md section 1).

The catalogue below is the ONE list of sources and their defaults. A policy row (`notify_policies`, administrator only,
notify.manage) is created from it the first time it is read and is then the administrator's: a later release that adds a
source adds its row, an edit is never overwritten. `emit()` (services/notify.py) reads the policy of its source: enabled,
severity, category, how long the condition must hold (`after_s`), the fold window, the resolve notice, who receives it
(`recipients`) and on which channels.

Titles and bodies are built here from templates and place parameters: ids and names of places and devices, never a person,
a visitor or an image.
"""
from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from typing import Any

from ..db import now_iso

SEVERITIES = ("info", "alert", "critical")
SEVERITY_RANK = {"info": 0, "alert": 1, "critical": 2}
CATEGORIES = ("safety", "alerts", "doors", "device_faults", "automations", "system", "security")
RECIPIENT_RULES = ("scope", "managers", "initiator", "users", "generator")  # generator: the routing saved on the generator screen (services/generator_alerts.py)
CHANNELS_V1 = ("inbox", "webpush", "email", "app")  # app = the SmplWise Arx phone app through the push relay (CR-027)
CHANNELS_RESERVED = ("ha_mobile", "whatsapp")
SUBJECT_KINDS = ("camera", "entity", "area", "alarm_panel", "door", "schedule", "automation", "bulk_job", "system", "session", "generator")
SEVERITY_LABEL_HE = {"info": "מידע", "alert": "התראה", "critical": "קריטי"}


@dataclass(frozen=True)
class Source:
    key: str
    label: str  # Hebrew, the settings tab's row
    category: str
    severity: str
    title: str  # the type, e.g. "דליפת מים"; `{name}` / `{place}` are filled from the signal's params
    body: str
    after_s: int = 0
    window_s: int = 0  # 0 = until the condition ends (resolve) - never folded by time
    resolve_notice: bool = False
    who: str = "scope"
    push: bool = True
    email: bool = False
    enabled: bool = True
    subject: str = "entity"
    resolve_text: str = "הסתיים"
    resolves: bool = True  # the source emits resolve signals; False = the acknowledge closes the row (rule alerts, results, sign-ins)


def _s(*a: Any, **k: Any) -> Source:
    return Source(*a, **k)


SOURCES: tuple[Source, ...] = (
    # ---- safety
    _s("sensor.leak", "דליפת מים", "safety", "critical", "דליפת מים", "{name} דיווח על מים.", resolve_notice=True, resolve_text="החיישן יבש"),
    _s("sensor.smoke", "עשן", "safety", "critical", "עשן", "{name} זיהה עשן.", resolve_notice=True, resolve_text="הגלאי נרגע"),
    _s("sensor.gas", "גז", "safety", "critical", "גז", "{name} זיהה גז.", resolve_notice=True, resolve_text="הגלאי נרגע"),
    _s("sensor.co", "פחמן חד־חמצני", "safety", "critical", "פחמן חד־חמצני", "{name} זיהה פחמן חד־חמצני.", resolve_notice=True, resolve_text="הגלאי נרגע"),
    _s("alarm.triggered", "אזעקה הופעלה", "safety", "critical", "אזעקה הופעלה", "{name} עבר למצב \"הופעלה\".", resolve_notice=True, subject="alarm_panel", resolve_text="האזעקה כובתה"),
    _s("alarm.arm_failed", "דריכת האזעקה נכשלה", "safety", "alert", "דריכת האזעקה נכשלה", "{name} לא אישר את הדריכה.", window_s=60, subject="alarm_panel", resolves=False),
    _s("alarm.state", "דריכה וניטרול של האזעקה", "doors", "info", "מצב האזעקה השתנה", "{name}: {state}.", window_s=60, push=False, enabled=False, subject="alarm_panel", resolves=False),
    # ---- faults
    _s("camera.offline", "מצלמה לא זמינה", "device_faults", "alert", "מצלמה לא זמינה", "{name} לא עונה למקליט.", after_s=120, subject="camera", resolve_text="המצלמה חזרה"),
    _s("nvr.offline", "מקליט לא זמין", "device_faults", "critical", "המקליט לא זמין", "אין תקשורת עם המקליט.", after_s=120, who="managers", email=True, subject="system", resolve_notice=True, resolve_text="המקליט חזר"),
    _s("nvr.storage", "אחסון המקליט", "device_faults", "critical", "תקלת אחסון במקליט", "{name}.", who="managers", email=True, subject="system", resolve_notice=True, resolve_text="האחסון תקין"),
    # CR-026 recorder health (services/recorder_health.py): per recorder; camera connectivity stays `camera.offline`
    _s("recorder.unreachable", "מקליט לא עונה", "device_faults", "critical", "מקליט לא עונה", "{name}: {detail}.", after_s=120, who="managers", email=True, subject="system", resolve_notice=True, resolve_text="המקליט חזר לענות"),
    _s("recorder.slow", "מקליט איטי", "device_faults", "info", "מקליט איטי", "{name}: {detail}.", after_s=300, who="managers", push=False, subject="system", resolve_text="זמן התגובה תקין"),
    _s("recorder.disk", "דיסק במקליט", "device_faults", "critical", "תקלת דיסק במקליט", "{name}: {detail}.", after_s=60, who="managers", email=True, subject="system", resolve_notice=True, resolve_text="הדיסק תקין"),
    _s("recorder.disk_space", "דיסק המקליט מתמלא", "device_faults", "info", "דיסק המקליט מתמלא", "{name}: {detail}.", who="managers", push=False, subject="system", resolve_text="יש מספיק מקום"),
    _s("recorder.recording", "מצלמה לא מקליטה", "device_faults", "alert", "מצלמה לא מקליטה", "{name}: {detail}.", after_s=60, who="managers", subject="camera", resolve_notice=True, resolve_text="ההקלטה חזרה"),
    _s("recorder.clock", "שעון המקליט", "device_faults", "alert", "שעון המקליט סוטה", "{name}: {detail}.", after_s=600, who="managers", push=False, subject="system", resolve_text="השעון תקין"),
    _s("recorder.certificate", "תעודת המקליט", "device_faults", "alert", "תעודת המקליט עומדת לפוג", "{name}: {detail}.", who="managers", push=False, email=True, subject="system", resolve_text="התעודה חודשה"),
    _s("device.unavailable", "התקן לא זמין", "device_faults", "info", "התקן לא זמין", "{name} לא זמין.", after_s=900, push=False, resolve_text="ההתקן חזר"),
    _s("device.battery_low", "סוללה חלשה", "device_faults", "info", "סוללה חלשה", "{name}: {level}.", window_s=86400, push=False, resolve_text="הסוללה הוחלפה"),
    _s("system.health", "תקלת מערכת", "system", "alert", "תקלת מערכת", "{name}.", after_s=300, who="managers", email=True, subject="system", resolve_text="התקלה נפתרה"),
    _s("backup.failed", "גיבוי נכשל", "system", "alert", "הגיבוי נכשל", "הגיבוי האוטומטי לא הסתיים.", window_s=86400, who="managers", push=False, email=True, subject="system", resolve_text="גיבוי הצליח"),
    _s("backup.stale", "גיבוי ישן", "system", "info", "הגיבוי ישן", "{name}.", window_s=86400, who="managers", push=False, email=True, subject="system", resolve_text="גיבוי הצליח"),
    _s("update.available", "עדכון זמין", "system", "info", "עדכון זמין", "גרסה {version} מוכנה להתקנה.", who="managers", push=False, email=True, subject="system", resolve_text="הגרסה הותקנה"),
    _s("notify.channel", "ערוץ התראות לא פועל", "system", "alert", "ערוץ התראות לא פועל", "{name}.", who="managers", push=False, subject="system", resolve_text="הערוץ חזר"),
    # ---- doors
    _s("opening.left_open", "דלת / חלון נשארו פתוחים", "doors", "alert", "פתוח זמן רב", "{name} פתוח יותר מ־{minutes} דקות.", after_s=600, resolve_text="נסגר"),
    _s("door.ring", "צלצול בדלת", "doors", "alert", "צלצול בדלת", "מישהו מצלצל ב{name}.", window_s=60, subject="door", resolve_text="הצלצול הסתיים"),
    # ---- automations
    _s("schedule.not_confirmed", "תזמון לא בוצע", "automations", "alert", "תזמון לא בוצע", "{name}: {detail}.", window_s=3600, who="managers", subject="schedule", resolve_text="הריצה הבאה אושרה"),
    _s("automation.failed", "אוטומציה נכשלה", "automations", "alert", "אוטומציה נכשלה", "{name}: {detail}.", window_s=600, who="managers", subject="automation", resolves=False),
    _s("automation.notify", "הודעה מאוטומציה", "automations", "alert", "הודעה מאוטומציה", "{name}.", window_s=600, subject="automation", resolves=False),
    _s("bulk.partial", "תוצאת פעולה קבוצתית / סצנה", "automations", "info", "פעולה קבוצתית", "{name}: {detail}.", window_s=3600, who="initiator", push=False, subject="bulk_job", resolves=False),
    # ---- security
    _s("security.new_signin", "כניסה חדשה / גישה מרחוק", "security", "alert", "כניסה חדשה לחשבון", "כניסה ממכשיר חדש. אם זה לא אתה - נתק את הכניסה.", window_s=3600, who="initiator", subject="session", resolves=False),
    _s("security.lockout", "נעילת קוד", "security", "alert", "נעילת קוד", "הוזנו קודים שגויים ונשארה נעילה זמנית.", window_s=3600, subject="session", resolves=False),
    # ---- alerts (rules, and the NVR smart events that only rules turn into notifications)
    _s("rule.alert", "התראות מחוקים", "alerts", "alert", "{name}", "{message}", window_s=300, subject="camera", resolve_text="טופל", resolves=False),
    _s("camera.motion", "תנועה (רק דרך חוקים)", "alerts", "info", "תנועה", "{name}.", window_s=300, push=False, enabled=False, subject="camera", resolves=False),
    _s("camera.person", "אדם (רק דרך חוקים)", "alerts", "info", "זיהוי אדם", "{name}.", window_s=300, push=False, enabled=False, subject="camera", resolves=False),
    _s("camera.vehicle", "רכב (רק דרך חוקים)", "alerts", "info", "זיהוי רכב", "{name}.", window_s=300, push=False, enabled=False, subject="camera", resolves=False),
)


def _generator_sources() -> tuple[Source, ...]:
    """CR-031: one source per generator alert type (`generator.<key>`). Routing starts empty: the recipients rule `generator` finds nobody until an
    administrator saves a routing; no push / e-mail by default. The alert always lands in the generator's own history and in the centre."""
    from . import generator_catalog as gc

    return tuple(
        Source(f"generator.{t.key}", f"גנרטור: {t.title_he}", "device_faults", t.severity, t.title_he, t.body, who="generator", push=False, subject="generator", resolve_text="הסתיים", resolves=not t.event)
        for t in gc.ALERT_TYPES
    )


SOURCES = SOURCES + _generator_sources()
BY_KEY: dict[str, Source] = {s.key: s for s in SOURCES}


class _Safe(dict):
    def __missing__(self, key: str) -> str:
        return ""


def render(source: str, params: dict[str, Any]) -> tuple[str, str]:
    """(title, body) of a source from its template and the signal's params; each clipped to the contract's lengths."""
    s = BY_KEY.get(source)
    p = _Safe({k: ("" if v is None else str(v)) for k, v in params.items()})
    if s is None:
        return _clip(str(params.get("title") or source), 80), _clip(str(params.get("body") or ""), 180)
    return _clip(s.title.format_map(p) or s.label, 80), _clip(s.body.format_map(p), 180)


def _clip(text: str, n: int) -> str:
    text = " ".join(str(text or "").split())
    return text if len(text) <= n else text[: n - 1] + "…"


# ---------------------------------------------------------------- the stored policy

def default_row(s: Source) -> dict[str, Any]:
    return {
        "source": s.key, "enabled": s.enabled, "severity": s.severity, "category": s.category, "after_s": s.after_s, "dedupe_window_s": s.window_s,
        "resolve_notice": s.resolve_notice, "recipients": {"rule": s.who}, "channels": {"inbox": True, "webpush": s.push, "email": s.email, "app": False, "ha_mobile": False, "whatsapp": False},
    }


def ensure_defaults(conn: sqlite3.Connection) -> int:
    """Create the policy row of every catalogue source that has none; returns how many were created."""
    have = {r[0] for r in conn.execute("SELECT source FROM notify_policies").fetchall()}
    n = 0
    for s in SOURCES:
        if s.key in have:
            continue
        d = default_row(s)
        conn.execute(
            "INSERT INTO notify_policies(source, enabled, severity, category, after_s, dedupe_window_s, resolve_notice, recipients_json, channels_json, revision, updated_at) VALUES (?,?,?,?,?,?,?,?,?,1,?)",
            (s.key, int(d["enabled"]), d["severity"], d["category"], d["after_s"], d["dedupe_window_s"], int(d["resolve_notice"]), json.dumps(d["recipients"]), json.dumps(d["channels"]), now_iso()),
        )
        n += 1
    return n


def row_to_policy(r: sqlite3.Row) -> dict[str, Any]:
    try:
        recipients = json.loads(r["recipients_json"] or "{}")
    except ValueError:
        recipients = {}
    try:
        channels = json.loads(r["channels_json"] or "{}")
    except ValueError:
        channels = {}
    rec: dict[str, Any] = {"rule": recipients.get("rule") if recipients.get("rule") in RECIPIENT_RULES else "scope"}
    if rec["rule"] == "users" or recipients.get("user_ids"):
        rec["user_ids"] = [str(u) for u in (recipients.get("user_ids") or [])][:100]
    return {
        "source": r["source"], "enabled": bool(r["enabled"]), "severity": r["severity"], "category": r["category"], "after_s": r["after_s"],
        "dedupe_window_s": r["dedupe_window_s"], "resolve_notice": bool(r["resolve_notice"]), "recipients": rec,
        "channels": {"inbox": True, "webpush": bool(channels.get("webpush")), "email": bool(channels.get("email")), "app": bool(channels.get("app")), "ha_mobile": False, "whatsapp": False},
        "revision": r["revision"],
    }


def list_policies(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    if not _read_only(conn):
        ensure_defaults(conn)
    rows = {r["source"]: row_to_policy(r) for r in conn.execute("SELECT * FROM notify_policies").fetchall()}
    out = []
    for s in SOURCES:  # the catalogue's order; a stored row of a source this release no longer knows is not listed
        out.append(rows.get(s.key) or {**default_row(s), "revision": 0})
    return out


def _read_only(conn: sqlite3.Connection) -> bool:
    try:
        return bool(conn.execute("PRAGMA query_only").fetchone()[0])
    except sqlite3.Error:
        return False


def get_policy(conn: sqlite3.Connection, source: str) -> dict[str, Any] | None:
    if source not in BY_KEY:
        return None
    r = conn.execute("SELECT * FROM notify_policies WHERE source = ?", (source,)).fetchone()
    if r is None:
        if _read_only(conn):
            return {**default_row(BY_KEY[source]), "revision": 0}
        ensure_defaults(conn)
        r = conn.execute("SELECT * FROM notify_policies WHERE source = ?", (source,)).fetchone()
    return row_to_policy(r)


def source_info(source: str) -> dict[str, Any]:
    s = BY_KEY[source]
    return {"source": s.key, "label": s.label, "subject_kind": s.subject, "category": s.category}


# owner 2026-10-01: who is told that a schedule was not executed / an automation failed is ONE installation setting
# (`failures_audience`: admins | visible), not a per-source choice - these two sources follow it unless the administrator named users
FAILURE_SOURCES = ("schedule.not_confirmed", "automation.failed")


def effective_recipients(policy: dict[str, Any], audience: str) -> dict[str, Any]:
    """The recipient rule that actually applies: the policy's, except that the failure sources follow `failures_audience`
    (`admins` -> managers, `visible` -> everyone who may see the schedule / automation) while the policy says managers or scope."""
    rec = policy.get("recipients") or {"rule": "scope"}
    if policy.get("source") in FAILURE_SOURCES and rec.get("rule") in ("managers", "scope"):
        return {"rule": "managers" if audience == "admins" else "scope"}
    return rec


class PolicyInvalid(ValueError):
    def __init__(self, code: str, message: str, details: dict[str, Any] | None = None):
        super().__init__(code)
        self.code, self.message, self.details = code, message, details or {}


def validate_update(source: str, body: dict[str, Any]) -> dict[str, Any]:
    """The columns a PUT may change, validated. `ha_mobile` / `whatsapp` true is refused (`channel_reserved`, v1)."""
    out: dict[str, Any] = {}
    for f in ("enabled", "resolve_notice"):  # real booleans only: the string "false" is truthy and must never silently switch something on
        if f in body and not isinstance(body[f], bool):
            raise PolicyInvalid("validation", "הערך חייב להיות כן/לא.", {"field": f})
    if "enabled" in body:
        out["enabled"] = body["enabled"]
    if "severity" in body:
        if body["severity"] not in SEVERITIES:
            raise PolicyInvalid("validation", "חומרה לא מוכרת.", {"field": "severity"})
        out["severity"] = body["severity"]
    if "category" in body:
        if body["category"] not in CATEGORIES:
            raise PolicyInvalid("validation", "קטגוריה לא מוכרת.", {"field": "category"})
        out["category"] = body["category"]
    for f, hi in (("after_s", 86400), ("dedupe_window_s", 7 * 86400)):
        if f in body:
            v = body[f]
            if isinstance(v, bool) or not isinstance(v, int) or not 0 <= v <= hi:
                raise PolicyInvalid("validation", "ערך מספרי מחוץ לטווח.", {"field": f})
            out[f] = v
    if "resolve_notice" in body:
        out["resolve_notice"] = body["resolve_notice"]
    if "recipients" in body:
        r = body["recipients"] or {}
        rule = r.get("rule")
        if rule not in RECIPIENT_RULES:
            raise PolicyInvalid("validation", "כלל נמענים לא מוכר.", {"field": "recipients.rule"})
        if source in FAILURE_SOURCES and rule in ("managers", "scope"):
            rule = None  # decided by the installation setting `failures_audience`; the stored rule stays as it is (the client sends the whole body back)
        rec: dict[str, Any] = {"rule": rule}
        if rule is None:
            pass
        elif rule == "users":
            ids = r.get("user_ids")
            if not isinstance(ids, list) or not ids or not all(isinstance(i, str) and 0 < len(i) <= 128 for i in ids) or len(ids) > 100:
                raise PolicyInvalid("validation", "יש לבחור משתמש אחד לפחות.", {"field": "recipients.user_ids"})
            rec["user_ids"] = sorted(set(ids))
        if rule is not None:
            out["recipients_json"] = json.dumps(rec)
    if "channels" in body:
        ch = body["channels"] or {}
        if not isinstance(ch, dict) or any(k in ch and not isinstance(ch[k], bool) for k in ("inbox", "webpush", "email", "ha_mobile", "whatsapp", "app")):
            raise PolicyInvalid("validation", "ערוצים: ערכי כן/לא בלבד.", {"field": "channels"})
        for reserved in CHANNELS_RESERVED:
            if ch.get(reserved):
                raise PolicyInvalid("channel_reserved", "הערוץ הזה עדיין לא זמין.", {"channel": reserved})
        if ch.get("inbox") is False:
            raise PolicyInvalid("validation", "מרכז ההתראות פעיל תמיד.", {"field": "channels.inbox"})
        out["channels_json"] = json.dumps({"inbox": True, "webpush": bool(ch.get("webpush")), "email": bool(ch.get("email")), "app": bool(ch.get("app")), "ha_mobile": False, "whatsapp": False})
    return out
