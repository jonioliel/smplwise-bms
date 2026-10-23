"""CR-READY96 slice 1: installation readiness - one score (0-100) and a checklist that says how complete and how safe an installation is.

    computed checks (measured here, read-only)  +  configured checks (a person attests, with name and time)
        -->  score = round(100 * sum(weight * fraction) / sum(weight))  over the APPLICABLE checks
        -->  level (building / almost / ready) + the hand-over ADVICE + the next steps ordered by the points they would add

Owner decisions of 2026-10-24 (docs/changes/CR-READY96.md, "Owner review 24.10 decisions"):
  * the hand-over threshold is ADVICE only - the installer may hand over earlier; nothing here ever blocks the attestation (it is recorded with
    `below_advice` and audited, so the hand-over report can say so);
  * every threshold and every weight is a setting (`readiness.*`, validated, audited), not a constant;
  * the page belongs to whoever configures the system (`system.configure` at the installation) - no other reader.

Nothing here writes to a device and nothing leaves the installation: the checks read this database, the backup folder and the cached health report
(`probe=False`, no network call). Slice 1 has no PDF report, no module checks beyond the tickets module and no technician-flag test (see the CR)."""
from __future__ import annotations

import datetime as dt
import json
import logging
import sqlite3
import zoneinfo
from pathlib import Path
from typing import Any, Callable

from ..audit import audit
from ..config import Settings
from ..db import get_setting, set_setting
from ..errors import ApiError
from ..rbac import Principal
from .timeutil import iso_utc, parse_utc

log = logging.getLogger("smplwise.readiness")
UTC = dt.timezone.utc

PERMISSION = "system.configure"  # read, check, attest and edit the thresholds: the wizard's permission holders (owner decision, form Q7)

# status: ok | attention | blocked | pending | not_applicable
OK, ATTENTION, BLOCKED, PENDING, NOT_APPLICABLE = "ok", "attention", "blocked", "pending", "not_applicable"
LEVELS = ("building", "almost", "ready")
LEVEL_TEXT = {"building": "בהקמה", "almost": "כמעט מוכן למסירה", "ready": "מוכן למסירה"}

# id -> (group, source, default weight, critical, title). The order is the order of the page.
CHECKS: dict[str, tuple[str, str, int, bool, str]] = {
    "cameras_connected": ("video", "computed", 12, True, "מצלמות מחוברות"),
    "cameras_verified": ("video", "computed", 12, False, "מצלמות מאומתות"),
    "places": ("map", "computed", 8, False, "קומות ומיקומים"),
    "people": ("people", "computed", 10, True, "אנשים והרשאות"),
    "notifications": ("notify", "computed", 10, False, "התראות"),
    "backup": ("data", "computed", 12, True, "גיבוי"),
    "remote": ("access", "computed", 8, False, "גישה מרחוק"),
    "time": ("system", "computed", 4, False, "שעון ואזור זמן"),
    "integrations": ("system", "computed", 10, False, "חיבורים לתשתית"),
    "modules": ("modules", "computed", 8, False, "מודולים פעילים"),
    "handover": ("handover", "configured", 6, False, "מסירה ללקוח"),
}
CRITICAL = frozenset(k for k, v in CHECKS.items() if v[3])
HANDOVER = "handover"
CHECK_IDS: tuple[str, ...] = tuple(CHECKS)  # the closed id set other consumers may name (the fleet report's `readiness.missing`, READYFLEET-295)
NOT_DONE = (ATTENTION, BLOCKED, PENDING)     # an applicable check in one of these is "missing"


def _int_in(lo: int, hi: int) -> Callable[[str], bool]:
    return lambda v: v.isdigit() and lo <= int(v) <= hi


SETTINGS: dict[str, tuple[str, Callable[[str], bool]]] = {
    "readiness.advice_score": ("90", _int_in(1, 100)),         # the score from which hand-over is advised (advice only; never blocks)
    "readiness.band_almost_min": ("50", _int_in(1, 99)),        # the score from which the level is "almost" (below it: "building")
    "readiness.cameras_seen_hours": ("24", _int_in(1, 720)),    # a camera counts as verified when the system saw it this recently
    "readiness.backup_max_age_days": ("7", _int_in(1, 365)),    # the newest local backup must be younger than this
    "readiness.notify_days": ("30", _int_in(1, 365)),           # a channel counts as reachable after a delivery this recently
    "readiness.history_keep": ("200", _int_in(10, 2000)),       # score history rows kept
    **{f"readiness.weight.{cid}": (str(spec[2]), _int_in(0, 100)) for cid, spec in CHECKS.items()},
}


def setting(conn: sqlite3.Connection, key: str) -> str:
    default, valid = SETTINGS[key]
    v = get_setting(conn, key, default)
    return v if isinstance(v, str) and valid(v) else default


def settings_view(conn: sqlite3.Connection) -> dict[str, str]:
    return {k: setting(conn, k) for k in SETTINGS}


def _num(conn: sqlite3.Connection, key: str) -> int:
    return int(setting(conn, key))


def update_settings(conn: sqlite3.Connection, principal: Principal, changes: dict[str, Any], rid: str | None) -> dict[str, tuple[str, str]]:
    """Validate and store; {key: (before, after)} of what changed. Unknown key / bad value = 422; the "almost" band must stay below the advice score."""
    for key, value in changes.items():
        if key not in SETTINGS or not isinstance(value, str) or not SETTINGS[key][1](value):
            raise ApiError(422, "invalid_setting", "ערך לא תקין להגדרה.", details={"key": str(key)[:64]})
    merged = {**settings_view(conn), **changes}
    if int(merged["readiness.band_almost_min"]) >= int(merged["readiness.advice_score"]):
        raise ApiError(422, "invalid_setting", "סף 'כמעט מוכן' חייב להיות נמוך מציון המסירה המומלץ.", details={"key": "readiness.band_almost_min"})
    if all(int(merged[f"readiness.weight.{cid}"]) == 0 for cid in CHECKS):
        raise ApiError(422, "invalid_setting", "לפחות לבדיקה אחת חייב להיות משקל.", details={"key": "readiness.weight"})
    out: dict[str, tuple[str, str]] = {}
    for key, value in changes.items():
        before = setting(conn, key)
        if before != value:
            set_setting(conn, key, value)
            out[key] = (before, value)
            audit(conn, actor=principal, action="settings.changed", decision="allowed", resource_type="setting", resource_id=key, request_id=rid,
                  details={"key": key, "before": before, "after": value})
    return out


# ---------------------------------------------------------------- the checks

class Ctx:
    def __init__(self, conn: sqlite3.Connection, settings: Settings, now: dt.datetime) -> None:
        self.conn, self.settings, self.now = conn, settings, now
        self.t = {k: _num(conn, k) for k in SETTINGS if not k.startswith("readiness.weight.")}

    def ago(self, **kw: float) -> str:
        return iso_utc(self.now - dt.timedelta(**kw))


def _res(fraction: float | None, summary: str, facts: list[dict[str, Any]], next_: dict[str, str] | None, *, status: str | None = None) -> dict[str, Any]:
    """`fraction` None = not applicable."""
    return {"fraction": fraction, "summary": summary, "facts": facts, "next": next_, "status": status}


def _fact(label: str, value: str, ok: bool | None = None) -> dict[str, Any]:
    return {"label": label, "value": value, "ok": ok}


def _enabled_cameras(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute("SELECT id, status, last_seen_at FROM cameras WHERE enabled = 1").fetchall()


def _ha_only(c: Ctx) -> bool:
    from ..mode import is_ha_only

    try:
        return is_ha_only(c.settings)
    except Exception:  # noqa: BLE001 - a settings object without a recorder block (a test) is a full installation
        return False


def check_cameras_connected(c: Ctx) -> dict[str, Any]:
    cams = _enabled_cameras(c.conn)
    if not cams and _ha_only(c):
        return _res(None, "ההתקנה פועלת ללא NVR - אין מצלמות לבדוק.", [], None)
    online = sum(1 for r in cams if r["status"] == "online")
    nxt = {"label": "פתיחת אשף ההתקנה", "href": "#/system/wizard"}
    if not cams:
        return _res(0.0, "לא נמצאו מצלמות פעילות.", [_fact("מצלמות פעילות", "0", False)], nxt)
    return _res(online / len(cams), f"{online} מתוך {len(cams)} מצלמות מחוברות.", [_fact("מחוברות", f"{online}/{len(cams)}", online == len(cams))],
                None if online == len(cams) else nxt)


def check_cameras_verified(c: Ctx) -> dict[str, Any]:
    cams = _enabled_cameras(c.conn)
    if not cams and _ha_only(c):
        return _res(None, "ההתקנה פועלת ללא NVR.", [], None)
    cutoff = c.ago(hours=c.t["readiness.cameras_seen_hours"])
    seen = sum(1 for r in cams if r["last_seen_at"] and r["last_seen_at"] >= cutoff)
    nxt = {"label": "בדיקת מצלמות באשף", "href": "#/system/wizard"}
    if not cams:
        return _res(0.0, "אין מצלמות לאימות.", [], nxt)
    return _res(seen / len(cams), f"{seen} מתוך {len(cams)} מצלמות נראו ב-{c.t['readiness.cameras_seen_hours']} השעות האחרונות.",
                [_fact("נראו לאחרונה", f"{seen}/{len(cams)}", seen == len(cams))], None if seen == len(cams) else nxt)


def check_places(c: Ctx) -> dict[str, Any]:
    floors = c.conn.execute("SELECT id FROM floors WHERE deleted_at IS NULL").fetchall()
    nxt = {"label": "למפה ולתוכניות", "href": "#/explore/sites"}
    if not floors:
        return _res(0.0, "אין קומות מוגדרות.", [_fact("קומות", "0", False)], nxt)
    with_plan = c.conn.execute(
        "SELECT COUNT(DISTINCT v.floor_id) FROM plan_versions v JOIN floors f ON f.id = v.floor_id AND f.deleted_at IS NULL WHERE v.status = 'published'").fetchone()[0]
    parts = [with_plan / len(floors)]
    facts = [_fact("קומות עם תוכנית מפורסמת", f"{with_plan}/{len(floors)}", with_plan == len(floors))]
    cams = _enabled_cameras(c.conn)
    if cams:
        placed = c.conn.execute(
            "SELECT COUNT(DISTINCT a.resource_id) FROM map_anchors a JOIN cameras k ON k.id = a.resource_id AND k.enabled = 1 "
            "WHERE a.resource_type = 'camera' AND a.effective_to IS NULL").fetchone()[0]
        parts.append(placed / len(cams))
        facts.append(_fact("מצלמות על המפה", f"{placed}/{len(cams)}", placed == len(cams)))
    f = sum(parts) / len(parts)
    return _res(f, f"{with_plan} מתוך {len(floors)} קומות עם תוכנית" + (f" · {facts[1]['value']} מצלמות ממוקמות." if len(facts) > 1 else "."), facts, None if f >= 1 else nxt)


def check_people(c: Ctx) -> dict[str, Any]:
    now = iso_utc(c.now)
    rows = c.conn.execute(
        "SELECT b.role_id, b.scope_type, b.subject_id FROM bindings b JOIN users u ON u.id = b.subject_id AND u.active = 1 "
        "WHERE b.subject_kind = 'user' AND b.effect = 'allow' AND b.revoked_at IS NULL AND (b.expires_at IS NULL OR b.expires_at > ?)", (now,)).fetchall()
    admins = {r["subject_id"] for r in rows if r["role_id"] == "system_admin" and r["scope_type"] == "installation"}
    others = {r["subject_id"] for r in rows if r["role_id"] != "system_admin"}
    f = 0.5 * bool(admins) + 0.5 * bool(others)
    nxt = {"label": "משתמשים והרשאות", "href": "#/system/access"}
    return _res(f, f"{len(admins)} מנהלי מערכת · {len(others)} משתמשים עם תפקיד.",
                [_fact("מנהל מערכת", str(len(admins)), bool(admins)), _fact("משתמשים עם תפקיד", str(len(others)), bool(others))], None if f >= 1 else nxt)


def check_notifications(c: Ctx) -> dict[str, Any]:
    since = c.ago(days=c.t["readiness.notify_days"])
    try:
        subs = {r[0] for r in c.conn.execute("SELECT DISTINCT kind FROM push_subscriptions").fetchall()}
        recent = c.conn.execute("SELECT channel, status FROM notification_deliveries WHERE created_at >= ?", (since,)).fetchall()
    except sqlite3.OperationalError:
        subs, recent = set(), []
    attempted = {r["channel"] for r in recent if r["status"] != "skipped"}
    reached = {r["channel"] for r in recent if r["status"] == "sent"}
    configured = subs | attempted
    nxt = {"label": "הגדרות התראות", "href": "#/system/notifications"}
    if not configured:
        return _res(0.0, "לא הוגדר ערוץ התראות.", [_fact("ערוצים", "0", False)], nxt)
    f = len(reached & configured) / len(configured)
    return _res(f, f"{len(reached & configured)} מתוך {len(configured)} ערוצים הגיעו ליעד ב-{c.t['readiness.notify_days']} הימים האחרונים.",
                [_fact("ערוצים שהוגדרו", str(len(configured)), True), _fact("הגיעו ליעד", str(len(reached & configured)), f >= 1)], None if f >= 1 else nxt)


def check_backup(c: Ctx) -> dict[str, Any]:
    from . import backup as backup_svc
    from . import backup_drill

    backups = [b for b in backup_svc.list_backups(c.settings) if b.get("valid")]
    newest = max((b["created_at"] for b in backups), default=None)
    young = bool(newest) and newest >= c.ago(days=c.t["readiness.backup_max_age_days"])
    sealed = any((b.get("sensitive") or {}).get("state") == "encrypted" for b in backups)
    last = backup_drill.read_last(c.settings)
    drill_ok = bool(last) and last.get("result") == "PASS"
    try:
        offbox = c.conn.execute(
            "SELECT 1 FROM backup_offbox_runs r JOIN backup_offbox_targets t ON t.id = r.target_id AND t.enabled = 1 WHERE r.ok = 1 AND r.verified = 1 LIMIT 1").fetchone() is not None
    except sqlite3.OperationalError:
        offbox = False
    facts = [_fact(f"גיבוי מקומי מ-{c.t['readiness.backup_max_age_days']} הימים האחרונים", "כן" if young else "לא", young),
             _fact("גיבוי עם סיסמת גיבוי", "כן" if sealed else "לא", sealed),
             _fact("תרגיל שחזור עבר", "כן" if drill_ok else "לא", drill_ok),
             _fact("גיבוי מחוץ למכשיר נבדק", "כן" if offbox else "לא", offbox)]
    f = sum(1 for x in facts if x["ok"]) / 4
    return _res(f, f"{sum(1 for x in facts if x['ok'])} מתוך 4 תנאי הגיבוי מתקיימים.", facts, None if f >= 1 else {"label": "גיבוי ושחזור", "href": "#/system/diagnostics?tab=backup"})


def check_remote(c: Ctx) -> dict[str, Any]:
    if not getattr(c.settings, "remote_access", False):
        return _res(None, "הגישה מרחוק כבויה בהחלטה.", [], None)
    mfa = (get_setting(c.conn, "remote.require_mfa_admin", "false") or "false") == "true"
    policy = get_setting(c.conn, "remote.policy", "flag") or "flag"
    f = 0.5 + 0.5 * mfa
    return _res(f, "גישה מרחוק פעילה" + (" עם אימות למנהלים." if mfa else " בלי אימות דו-שלבי למנהלים."),
                [_fact("מדיניות", policy, True), _fact("אימות למנהלים", "נדרש" if mfa else "לא נדרש", mfa)], None if mfa else {"label": "אבטחה", "href": "#/system/security"})


def check_time(c: Ctx) -> dict[str, Any]:
    tz = get_setting(c.conn, "time.zone", "") or ""
    try:
        zoneinfo.ZoneInfo(tz)
        valid = bool(tz)
    except Exception:  # noqa: BLE001 - an unknown zone name
        valid = False
    return _res(1.0 if valid else 0.0, f"אזור הזמן: {tz}." if valid else "אזור הזמן לא תקין.", [_fact("אזור זמן", tz or "-", valid)],
                None if valid else {"label": "הגדרות כלליות", "href": "#/system/diagnostics"})


def check_integrations(c: Ctx) -> dict[str, Any]:
    from . import health_report

    try:
        report = health_report.build(c.settings, c.conn, probe=False)
    except Exception:  # noqa: BLE001 - the health report must never take the readiness page down
        log.warning("readiness: health report unavailable", exc_info=True)
        return _res(0.0, "דוח הבריאות לא זמין.", [], {"label": "בריאות ועבודות", "href": "#/system/diagnostics?tab=health"}, status=ATTENTION)
    wanted = [x for x in report.get("checks", []) if x["id"] in ("nvr", "go2rtc", "ha_sync", "bridge") and x["status"] != "off"]
    if not wanted:
        return _res(None, "אין חיבורים לבדוק.", [], None)
    score = sum(1.0 if x["status"] == "ok" else 0.5 if x["status"] == "warn" else 0.0 for x in wanted)
    f = score / len(wanted)
    return _res(f, f"{sum(1 for x in wanted if x['status'] == 'ok')} מתוך {len(wanted)} חיבורים תקינים.", [_fact(x["label"], x["status"], x["status"] == "ok") for x in wanted],
                None if f >= 1 else {"label": "בריאות ועבודות", "href": "#/system/diagnostics?tab=health"})


def check_modules(c: Ctx) -> dict[str, Any]:
    from .tickets import access as tickets_access

    if not tickets_access.module_on(c.conn):
        return _res(None, "אין מודולים אופציונליים פעילים.", [], None)
    n = c.conn.execute("SELECT COUNT(*) FROM ticket_departments WHERE active = 1").fetchone()[0]
    return _res(1.0 if n else 0.0, f"{n} מחלקות פעילות במודול הבקשות." if n else "מודול הבקשות פעיל ואין בו מחלקה.", [_fact("מחלקות", str(n), n > 0)],
                None if n else {"label": "הגדרות המודול", "href": "#/system/tickets?tab=departments"})


def check_handover(c: Ctx) -> dict[str, Any]:
    row = c.conn.execute("SELECT done, note, payload_json, user_id, updated_at FROM readiness_attestations WHERE check_id = ?", (HANDOVER,)).fetchone()
    if row is None or not row["done"]:
        return _res(0.0, "המסירה ללקוח עדיין לא נרשמה.", [], None, status=PENDING)
    payload = json.loads(row["payload_json"] or "{}")
    facts = [_fact("נרשם", row["updated_at"], True)]
    if payload.get("customer_name"):
        facts.append(_fact("לקוח", str(payload["customer_name"]), True))
    if payload.get("below_advice"):
        facts.append(_fact("נמסר מתחת לציון המומלץ", f"ציון {payload.get('score_at')}", False))
    return _res(1.0, "המסירה נרשמה.", facts, None)


FUNCS: dict[str, Callable[[Ctx], dict[str, Any]]] = {
    "cameras_connected": check_cameras_connected, "cameras_verified": check_cameras_verified, "places": check_places, "people": check_people,
    "notifications": check_notifications, "backup": check_backup, "remote": check_remote, "time": check_time, "integrations": check_integrations,
    "modules": check_modules, "handover": check_handover,
}


# ---------------------------------------------------------------- the report

def _status_of(cid: str, r: dict[str, Any]) -> str:
    if r["fraction"] is None:
        return NOT_APPLICABLE
    if r["status"]:
        return r["status"]
    if r["fraction"] >= 1.0:
        return OK
    return BLOCKED if cid in CRITICAL else ATTENTION


def level_of(conn: sqlite3.Connection, score: int) -> str:
    if score >= _num(conn, "readiness.advice_score"):
        return "ready"
    return "almost" if score >= _num(conn, "readiness.band_almost_min") else "building"


def evaluate(conn: sqlite3.Connection, settings: Settings, now: dt.datetime | None = None) -> dict[str, Any]:
    """The whole report, computed now. Pure read."""
    now = now or dt.datetime.now(UTC)
    ctx = Ctx(conn, settings, now)
    weights = {cid: _num(conn, f"readiness.weight.{cid}") for cid in CHECKS}
    checks: list[dict[str, Any]] = []
    for cid, (group, source, _w, critical, title) in CHECKS.items():
        try:
            r = FUNCS[cid](ctx)
        except Exception:  # noqa: BLE001 - one failing check never hides the others
            log.warning("readiness check %s failed", cid, exc_info=True)
            r = _res(0.0, "הבדיקה נכשלה.", [], None, status=ATTENTION)
        status = _status_of(cid, r)
        applicable = status != NOT_APPLICABLE and weights[cid] > 0
        checks.append({"id": cid, "group": group, "source": source, "title": title, "weight": weights[cid], "critical": critical, "status": status,
                       "fraction": None if r["fraction"] is None else round(r["fraction"], 4), "summary": r["summary"], "facts": r["facts"], "next": r["next"],
                       "applicable": applicable, "checked_at": iso_utc(now)})
    total = sum(x["weight"] for x in checks if x["applicable"])
    got = sum(x["weight"] * x["fraction"] for x in checks if x["applicable"])
    score = round(100 * got / total) if total else 0
    for x in checks:  # points this check would still add: its missing share of the whole
        x["gain"] = round(100 * x["weight"] * (1 - x["fraction"]) / total) if x["applicable"] and total and x["fraction"] is not None else 0
    advice = _num(conn, "readiness.advice_score")
    blockers = [x["id"] for x in checks if x["applicable"] and x["critical"] and x["fraction"] is not None and x["fraction"] < 1.0]
    nxt = sorted((x for x in checks if x["applicable"] and x["status"] in (ATTENTION, BLOCKED, PENDING) and x["next"]), key=lambda x: (-(1 - x["fraction"]) * x["weight"], x["id"]))
    handover = next((x for x in checks if x["id"] == HANDOVER), None)
    return {"score": score, "level": level_of(conn, score), "level_text": LEVEL_TEXT[level_of(conn, score)], "checks": checks, "checked_at": iso_utc(now),
            "handover": {"advice_score": advice, "advice_met": score >= advice and not blockers, "blockers": blockers, "may_hand_over": True,  # advice only: always allowed
                         "done": bool(handover and handover["status"] == OK)},
            "next_steps": [{"id": x["id"], "title": x["title"], "label": x["next"]["label"], "href": x["next"]["href"], "gain": x["gain"]} for x in nxt],
            "bands": {"almost_min": _num(conn, "readiness.band_almost_min"), "advice": advice}}


# ---------------------------------------------------------------- history and the handover attestation

def last_history(conn: sqlite3.Connection, limit: int = 20) -> list[dict[str, Any]]:
    return [{"at": r["at"], "score": r["score"], "level": r["level"], "blockers": json.loads(r["blockers_json"])}
            for r in conn.execute("SELECT * FROM readiness_history ORDER BY id DESC LIMIT ?", (limit,)).fetchall()]


def chip(conn: sqlite3.Connection) -> dict[str, Any] | None:
    """The cheap block for /me (system.configure holders): the last recorded score, never a computation."""
    r = conn.execute("SELECT score, level, at FROM readiness_history ORDER BY id DESC LIMIT 1").fetchone()
    return {"score": r["score"], "level": r["level"], "at": r["at"]} if r else None


def record(conn: sqlite3.Connection, report: dict[str, Any]) -> bool:
    """Write one history row when the score or any status changed since the last row. True = a row was written."""
    snap = {x["id"]: {"status": x["status"], "fraction": x["fraction"]} for x in report["checks"]}
    last = conn.execute("SELECT score, checks_json FROM readiness_history ORDER BY id DESC LIMIT 1").fetchone()
    if last is not None and last["score"] == report["score"] and json.loads(last["checks_json"]) == snap:
        return False
    conn.execute("INSERT INTO readiness_history(at, score, level, blockers_json, checks_json) VALUES (?,?,?,?,?)",
                 (report["checked_at"], report["score"], report["level"], json.dumps(report["handover"]["blockers"]), json.dumps(snap)))
    keep = _num(conn, "readiness.history_keep")
    conn.execute("DELETE FROM readiness_history WHERE id NOT IN (SELECT id FROM readiness_history ORDER BY id DESC LIMIT ?)", (keep,))
    return True


def attest(conn: sqlite3.Connection, settings: Settings, principal: Principal, check_id: str, done: bool, note: str, payload: dict[str, Any], rid: str | None) -> dict[str, Any]:
    """The installer records (or withdraws) the hand-over. Never refused for a low score: the advice is shown, the fact is recorded."""
    if check_id != HANDOVER:
        raise ApiError(404, "check_not_configurable", "אי אפשר לאשר את הבדיקה הזו ידנית.")
    before = evaluate(conn, settings)
    below = bool(done) and not before["handover"]["advice_met"]
    stored = {**payload, "below_advice": below, "score_at": before["score"], "blockers_at": before["handover"]["blockers"]} if done else {}
    stamp = iso_utc(dt.datetime.now(UTC))
    conn.execute("INSERT INTO readiness_attestations(check_id, done, note, payload_json, user_id, updated_at) VALUES (?,?,?,?,?,?) "
                 "ON CONFLICT(check_id) DO UPDATE SET done = excluded.done, note = excluded.note, payload_json = excluded.payload_json, user_id = excluded.user_id, updated_at = excluded.updated_at",
                 (check_id, int(bool(done)), note[:500], json.dumps(stored, ensure_ascii=False), principal.user_id, stamp))
    audit(conn, actor=principal, action="readiness.handover", decision="allowed", resource_type="installation", resource_id="*", request_id=rid,
          details={"done": bool(done), "score": before["score"], "below_advice": below, "blockers": before["handover"]["blockers"]})
    report = evaluate(conn, settings)
    record(conn, report)
    return report
