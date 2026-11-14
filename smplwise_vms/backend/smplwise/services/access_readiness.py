"""EXTERNALBUILD-297 (slice X1): the READ-ONLY readiness check of the external access - which prerequisites are in place before the
owner turns it on, and which are missing, in plain Hebrew.

Every line is `ok` / `blocked` / `unknown` with a closed reason code and a short Hebrew text. `unknown` is never shown as `ok`: what this
check cannot see (no WisKey negotiation yet in this process, a messaging runtime that does not answer) stays unknown. Nothing here sends
a command to WisKey, a station, WhatsApp or Home Assistant, and nothing is written: the facts are read from the settings, the database,
the process's own state (the service channel's state, the last readback negotiation, the last write path the engine took) and the
messaging accounts service.

Used by `GET /access-grants/readiness` (system administrator), by the block in the external-access screen's settings, and by
`scripts/eccact_activation_status.py --readiness --db PATH` (database facts only: the runtime lines are `unknown` there)."""
from __future__ import annotations

import sqlite3
from typing import Any

from ..db import get_setting
from . import access_grants as ag

OK, BLOCKED, UNKNOWN = "ok", "blocked", "unknown"
PROVIDER_KEY = "access.station_media_provider"

TEXT = {
    # the switch
    "switch_on": "גישה זמנית לאנשים חיצוניים מופעלת.",
    "switch_off": "גישה זמנית לאנשים חיצוניים כבויה. ההפעלה נעשית בהגדרות על ידי מנהל מערכת.",
    # the write path
    "service_channel": "הכתיבה למערכת הכניסה עוברת בערוץ השירות של תשתית המערכת.",
    "direct_service_writer": "הכתיבה למערכת הכניסה עוברת בחיבור הישיר, בכותב השירות.",
    "direct_fallback": "נבחר החיבור הישיר, אבל הוא עדיין לא מקבל כתיבה מתהליך רקע. הכתיבה עוברת אוטומטית בערוץ השירות של תשתית המערכת.",
    "service_not_configured": "אין חיבור לתשתית המערכת בסביבה הזו, ולכן אי אפשר לכתוב למערכת הכניסה.",
    "service_not_installed": "רכיב מערכת הכניסה לא מותקן בתשתית המערכת.",
    "service_forbidden": "למשתמש השירות אין הרשאה לנהל אנשים במערכת הכניסה.",
    "service_not_ready": "ערוץ השירות למערכת הכניסה עדיין לא מוכן (מתחבר או לא זמין כרגע).",
    "runtime_unknown": "לא ניתן לדעת מכאן אם ערוץ השירות מוכן (הבדיקה רצה מחוץ לשרת).",
    # revoke proof
    "proof_v2": "אישור ביטול מלא: מערכת הכניסה מאשרת שהביטול הגיע לעמדות.",
    "proof_v1": "אישור ביטול חלקי: מערכת הכניסה מחזירה תשובה ישנה; ביטול ייסגר כ\"בוטל, לא אומת בצד השני\".",
    "proof_switch_off": "המתג לאישור ביטול ממערכת הכניסה כבוי. בלעדיו כל ביטול יישאר \"מבטל\" עם התראה כל שעה.",
    "proof_not_listed": "מערכת הכניסה לא מציעה את פקודת אישור הביטול.",
    "proof_capability_missing": "מערכת הכניסה מכירה את הפקודה אבל לא מאפשרת אותה כרגע.",
    "proof_not_negotiated": "עוד לא נבדק מול מערכת הכניסה אילו פקודות אישור ביטול זמינות (יתברר בקריאה הראשונה).",
    # WhatsApp
    "whatsapp_ok": "חשבון וואטסאפ לשליחת קודי כניסה מוגדר ומסוגל לשלוח.",
    "whatsapp_no_account": "לא הוגדר חשבון וואטסאפ לשימוש \"קודי כניסה לאנשים חיצוניים\".",
    "whatsapp_not_sendable": "חשבון הוואטסאפ של קודי הכניסה מוגדר אבל לא מסוגל לשלוח כרגע.",
    "whatsapp_unknown": "לא ניתן לבדוק כרגע את חשבון הוואטסאפ.",
    # stations and approvers
    "entrances_ok": "{n} עמדות מסומנות \"כניסה לאנשים חיצוניים\".",
    "entrances_none": "אף עמדה לא מסומנת \"כניסה לאנשים חיצוניים\". סמנו לפחות דלת אחת.",
    "approvers_ok": "{n} אנשים יכולים לאשר גישה זמנית.",
    "approvers_none": "אין אף אדם עם הרשאת אישור גישה זמנית.",
    # rules (information)
    "rules": "עד {days} ימים, עד {doors} דלתות, הקוד נשלח בערב שלפני בשעה {hour}:00; מאשרים מקומיים: {local}.",
    "one_time": "קוד חד-פעמי לספקים זמין (נבחר בבקשה או באישור). כניסה אחת, במאמץ מיטבי.",
    "visitors_on": "הזמנת מבקרים מופעלת ({n} עמדות מסומנות \"כניסת מבקרים\").",
    "visitors_off": "הזמנת מבקרים כבויה (אפשרית להפעלה בנפרד, אחרי גישת החוץ).",
    "last_write": "הכתיבה האחרונה: {path}.",
    "no_write_yet": "עוד לא נכתב דבר למערכת הכניסה מאז שהשרת עלה.",
}

LABEL = {"switch": "המתג הראשי", "write_path": "נתיב הכתיבה למערכת הכניסה", "revoke_proof": "אישור ביטול ממערכת הכניסה",
         "whatsapp": "משלוח הקוד בוואטסאפ", "entrances": "דלתות כניסה לאנשים חיצוניים", "approvers": "מאשרים", "rules": "כללים",
         "one_time": "קוד חד-פעמי", "visitors": "מבקרים", "last_write": "כתיבה אחרונה"}
REQUIRED = ("write_path", "revoke_proof", "whatsapp", "entrances", "approvers")  # the switch itself is shown, not a prerequisite of turning it on


def _line(key: str, state: str, reason: str, **fmt: Any) -> dict[str, Any]:
    return {"key": key, "label": LABEL[key], "state": state, "reason": reason, "text": TEXT[reason].format(**fmt) if fmt else TEXT[reason],
            "required": key in REQUIRED}


def _provider(conn: sqlite3.Connection) -> str:
    try:
        return "auto" if (get_setting(conn, PROVIDER_KEY) or "local") == "auto" else "local"
    except sqlite3.Error:
        return "local"


def write_path_line(conn: sqlite3.Connection, *, runtime: bool) -> dict[str, Any]:
    """Where a grant write would go NOW: the direct service writer, or the local service channel (also the automatic fallback when the
    direct connection is selected but cannot take a service write). The service channel's own state decides ok / blocked / unknown."""
    provider = _provider(conn)
    if not runtime:
        line = _line("write_path", UNKNOWN, "runtime_unknown")
        line["provider"] = provider
        return line
    from . import access_service_writer as asw
    from . import intercom_sync, wiskey_direct_join

    join = wiskey_direct_join.installed()
    selected = False
    try:
        selected = join is not None and bool(join.selected())
    except Exception:  # noqa: BLE001
        selected = False
    if selected and asw.writer_for(join) is not None:
        line = _line("write_path", OK, "direct_service_writer")
    else:
        state = getattr(intercom_sync.STATE, "state", None)
        if state == "ready":
            line = _line("write_path", OK, "direct_fallback" if selected else "service_channel")
        elif state == "ha_not_configured":
            line = _line("write_path", BLOCKED, "service_not_configured")
        elif state == "not_installed":
            line = _line("write_path", BLOCKED, "service_not_installed")
        elif state == "forbidden":
            line = _line("write_path", BLOCKED, "service_forbidden")
        else:
            line = _line("write_path", UNKNOWN, "service_not_ready")
        line["fallback"] = selected
    line["provider"] = provider
    line["direct_selected"] = selected
    return line


def revoke_proof_line(conn: sqlite3.Connection, *, runtime: bool) -> dict[str, Any]:
    """The readback switch (`wiskey.acr5_access_state`) and, when on, the last negotiation THIS process made (no new WisKey call)."""
    from . import wiskey_acr5, wiskey_readback

    try:
        on = wiskey_acr5.consumer_on(conn, wiskey_readback.GATE_ACCESS_STATE)
    except Exception:  # noqa: BLE001
        on = False
    if not on:
        return _line("revoke_proof", BLOCKED, "proof_switch_off")
    last = wiskey_readback.last_negotiated() if runtime else None
    if last is None:
        return _line("revoke_proof", UNKNOWN, "proof_not_negotiated")
    version, reason = last.get("version"), last.get("reason")
    if version == 2:
        out = _line("revoke_proof", OK, "proof_v2")
    elif version == 1:
        out = _line("revoke_proof", OK, "proof_v1")
    elif reason == "capability_missing":
        out = _line("revoke_proof", BLOCKED, "proof_capability_missing")
    else:
        out = _line("revoke_proof", BLOCKED, "proof_not_listed")
    out["negotiated_at"] = last.get("at")
    return out


def whatsapp_line(db: Any) -> dict[str, Any]:
    if db is None:
        return _line("whatsapp", UNKNOWN, "whatsapp_unknown")
    try:
        from . import messaging_runtime as mr

        svc = mr.accounts_service(db)
        account = svc.resolve(ag.USE_KEY)
        if account is None or not getattr(account, "value", None):
            return _line("whatsapp", BLOCKED, "whatsapp_no_account")
        if not svc.status(account.key).sendable:
            return _line("whatsapp", BLOCKED, "whatsapp_not_sendable")
        return _line("whatsapp", OK, "whatsapp_ok")
    except Exception:  # noqa: BLE001 - "cannot tell" is unknown, never ok
        return _line("whatsapp", UNKNOWN, "whatsapp_unknown")


def _count_entrances(conn: sqlite3.Connection) -> int:
    try:
        return int(conn.execute("SELECT COUNT(*) FROM access_station_entrance").fetchone()[0])
    except sqlite3.Error:
        return 0


def count_approvers(conn: sqlite3.Connection) -> int:
    """Active users who hold every approve permission somewhere (the station-by-station check stays the approve route's)."""
    from ..rbac import permissions_anywhere

    n = 0
    perms = ag.approve_permissions("pin")
    for r in conn.execute("SELECT id FROM users WHERE active = 1").fetchall():
        try:
            held = permissions_anywhere(conn, ag.principal_of(r["id"]))
        except Exception:  # noqa: BLE001
            continue
        if all(p in held for p in perms):
            n += 1
    return n


def readiness(conn: sqlite3.Connection, db: Any = None, *, runtime: bool = True) -> dict[str, Any]:
    """The whole check. `runtime=False` (the CLI over a database file): the lines that need the running server are `unknown`."""
    from . import access_service_writer as asw
    from . import access_visitors as av

    lines: list[dict[str, Any]] = []
    lines.append(_line("switch", OK, "switch_on") if ag.enabled(conn) else _line("switch", BLOCKED, "switch_off"))
    lines.append(write_path_line(conn, runtime=runtime))
    lines.append(revoke_proof_line(conn, runtime=runtime))
    lines.append(whatsapp_line(db) if runtime else _line("whatsapp", UNKNOWN, "whatsapp_unknown"))
    n = _count_entrances(conn)
    lines.append(_line("entrances", OK, "entrances_ok", n=n) if n else _line("entrances", BLOCKED, "entrances_none"))
    lines[-1]["count"] = n
    a = count_approvers(conn)
    lines.append(_line("approvers", OK, "approvers_ok", n=a) if a else _line("approvers", BLOCKED, "approvers_none"))
    lines[-1]["count"] = a
    lines.append(_line("rules", OK, "rules", days=ag.max_days(conn), doors=ag.max_doors(conn), hour=ag.code_hour(conn),
                       local="כן" if ag.local_approvers(conn) else "לא"))
    lines.append(_line("one_time", OK, "one_time"))
    if av.enabled(conn):
        lines.append(_line("visitors", OK, "visitors_on", n=len(av.visitor_entrances(conn))))
    else:
        lines.append(_line("visitors", OK, "visitors_off"))
    if runtime:
        last = asw.last_path()
        if last.get("path"):
            path = {"direct_service_writer": "חיבור ישיר (כותב שירות)"}.get(last["path"], "ערוץ השירות")
            if last.get("reason") == "direct_service_writer_missing":
                path += " - במקום החיבור הישיר"
            line = _line("last_write", OK, "last_write", path=path)
            line.update({"path": last["path"], "path_reason": last["reason"], "at": last["at"], "fallbacks": last["fallbacks"]})
        else:
            line = _line("last_write", OK, "no_write_yet")
        line["required"] = False
        lines.append(line)
    missing = [ln["key"] for ln in lines if ln["required"] and ln["state"] == BLOCKED]
    unknown = [ln["key"] for ln in lines if ln["required"] and ln["state"] == UNKNOWN]
    ready = not missing and not unknown
    if ready:
        summary = "הכל מוכן להפעלה."
    elif missing:
        summary = "חסרים " + str(len(missing)) + " תנאים: " + ", ".join(LABEL[k] for k in missing) + "."
    else:
        summary = "אין חסרים ידועים, אבל לא כל התנאים נבדקו: " + ", ".join(LABEL[k] for k in unknown) + "."
    return {"ready": ready, "missing": missing, "unknown": unknown, "summary": summary, "lines": lines, "at": ag.iso(ag.now())}
