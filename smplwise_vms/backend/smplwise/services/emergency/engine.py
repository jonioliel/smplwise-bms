"""CR-EMERG104 section 7.1: the single read path. One function per item reads an EXISTING signal in-process and returns the item's raw result
(status, a Hebrew sentence, the facts, the age of the fact and where to go to fix it). Nothing here writes, probes a device, calls Home Assistant,
the recorder, WisKey or the network: it reads tables and the in-memory states other screens already read. A reader that fails or finds its source
absent answers `unknown` - never green. Redaction by permission is the service's job (service.py); the statuses computed here are the truth that
counts in the verdict whoever is asking."""
from __future__ import annotations

import datetime as dt
import json
import sqlite3
from typing import Any

from ...config import Settings
from ...db import get_setting
from ..maintenance import model as mmodel
from . import access, model

HREF = {
    "generator": "#/infra/generator/live", "elevators": "#/infra/elevators", "maintenance": "#/tickets/maintenance", "health": "#/system/diagnostics?tab=health",
    "doors": "#/system/access-control", "notify": "#/system/notifications", "backup": "#/system/backup", "contacts": "#/tickets/maintenance/emergency",
}


def _row(status: str, summary: str, facts: list[dict[str, Any]] | None = None, *, age_s: float | None = None, href: str | None = None, critical: bool | None = None,
         code: str = "") -> dict[str, Any]:
    out: dict[str, Any] = {"status": status, "summary": summary, "facts": facts or [], "age_s": age_s, "href": href, "code": code}
    if critical is not None:
        out["critical"] = critical
    return out


def _unknown(summary: str, href: str | None = None, code: str = "no_data") -> dict[str, Any]:
    return _row("unknown", summary, href=href, code=code)


def _safe(fn, *args: Any) -> dict[str, Any]:
    try:
        return fn(*args)
    except Exception:  # noqa: BLE001 - one broken source never breaks the page; it reads "unknown", never green
        return _unknown("לא ניתן לאמת את המקור", code="source_error")


def _days_text(d: float | None) -> str:
    return "לא ידוע" if d is None else f"לפני {int(d)} ימים"


def _iso_to_dt(value: Any) -> dt.datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        t = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return t if t.tzinfo else t.replace(tzinfo=dt.timezone.utc)


class Ctx:
    """What a pass needs: the connection, the settings, the injected clock, the thresholds and the ledger's local date."""

    def __init__(self, conn: sqlite3.Connection, settings: Settings | None) -> None:
        self.conn = conn
        self.settings = settings
        self.now = access.now()
        self.now_iso = access.now_iso()
        self.th = model.merged_thresholds(_json_setting(conn, access.THRESHOLDS_KEY, {}))
        from ..maintenance import access as maccess

        self.maint_on = maccess.module_on(conn)
        self.today = maccess.today(conn, self.now)
        self.tickets_on = (get_setting(conn, "tickets.enabled", "false") or "false") == "true"


def _json_setting(conn: sqlite3.Connection, key: str, default: Any) -> Any:
    raw = get_setting(conn, key, None)
    if not raw:
        return default
    try:
        return json.loads(raw)
    except ValueError:
        return default


# ---------------------------------------------------------------- A. power

def _generators(ctx: Ctx) -> list[dict[str, Any]]:
    from .. import generator_core as core

    devs = ctx.conn.execute("SELECT id, name FROM generator_devices WHERE status <> 'removed' ORDER BY name").fetchall()
    if not devs:
        return []
    values = core.read_values_bulk(ctx.conn, [d["id"] for d in devs])
    from .. import elevators as elev

    connected = elev.mirror_connected()
    stale_s = core.int_setting(ctx.conn, "stale_after_s")
    out = []
    for d in devs:
        v = values.get(d["id"], {})
        avail = core.availability(v, connected)
        alerts = [r["severity"] for r in ctx.conn.execute("SELECT severity FROM generator_alerts WHERE device_id = ? AND cleared_at IS NULL", (d["id"],)).fetchall()]
        ledger = ctx.conn.execute("SELECT MAX(last_done_at) AS t FROM maint_tasks WHERE generator_id = ? AND category = 'generator' AND deleted_at IS NULL", (d["id"],)).fetchone()["t"] \
            if ctx.maint_on else None
        newest = max((_iso_to_dt(x.get("updated_at")) for x in v.values() if x.get("updated_at")), default=None, key=lambda t: t or dt.datetime.min.replace(tzinfo=dt.timezone.utc))
        age = (ctx.now - newest).total_seconds() if newest else None
        out.append({"id": d["id"], "name": d["name"], "values": v, "avail": avail, "alerts": alerts, "ledger_done": ledger, "age_s": age, "stale_s": stale_s})
    return out


def e01(ctx: Ctx) -> dict[str, Any]:
    gens = _generators(ctx)
    if not gens:
        return _unknown("לא זוהה גנרטור במערכת", HREF["generator"], "no_generator")
    statuses, facts = [], []
    ages: list[float] = []
    for g in gens:
        v = g["values"]
        ts = _iso_to_dt((v.get("last_test_at") or {}).get("value")) if (v.get("last_test_at") or {}).get("available") else None
        days = (ctx.now - ts).total_seconds() / 86400 if ts else None
        res_raw = (v.get("last_test_result") or {}).get("value")
        from .. import generator_catalog as cat

        result_ok = None if not res_raw else (False if cat.FAIL_RESULT.search(str(res_raw)) else True)
        led_days = model.age_days(g["ledger_done"], ctx.now_iso) if g["ledger_done"] else None
        stale = g["avail"] != "online" or (g["age_s"] is not None and g["age_s"] > 36 * 3600)
        if stale and days is None and led_days is None:
            st = "unknown"
        else:
            st = model.generator_test(None if stale else days, None if stale else result_ok, led_days, ctx.th)
        statuses.append(st)
        facts.append({"key": "last_test_days", "label": g["name"], "value": None if days is None else int(days)})
        if g["age_s"] is not None:
            ages.append(g["age_s"])
    st = model.worst(statuses)
    text = {"green": "בדיקת הגנרטור האחרונה בתוך החלון", "amber": "בדיקת הגנרטור האחרונה מתקרבת לגבול", "red": "הגנרטור לא נבדק בזמן או שהבדיקה נכשלה",
            "unknown": "לא ניתן לאמת בדיקת גנרטור"}[st]
    return _row(st, text, facts, age_s=max(ages) if ages else None, href=HREF["generator"], code="generator_test")


def e02(ctx: Ctx) -> dict[str, Any]:
    gens = _generators(ctx)
    if not gens:
        return _unknown("לא זוהה גנרטור במערכת", HREF["generator"], "no_generator")
    statuses, facts = [], []
    for g in gens:
        v = g["values"]

        def val(role: str) -> Any:
            x = v.get(role)
            return x.get("value") if x and x.get("available") else None

        if g["avail"] != "online" or (g["age_s"] is not None and g["age_s"] > g["stale_s"]):
            statuses.append("unknown")
            facts.append({"key": "state", "label": g["name"], "value": "stale"})
            continue
        fuel = val("fuel_pct")
        st = model.generator_state(fuel, val("engine_state"), val("controller_mode"), val("battery_v"), g["alerts"], ctx.th)
        statuses.append(st)
        facts.append({"key": "fuel_pct", "label": g["name"], "value": fuel})
    st = model.worst(statuses)
    text = {"green": "דלק ומצב הגנרטור תקינים", "amber": "דלק, מצב או התראה בגנרטור דורשים תשומת לב", "red": "דלק נמוך, תקלה או התראה קריטית בגנרטור",
            "unknown": "לא ניתן לאמת את מצב הגנרטור"}[st]
    ages = [g["age_s"] for g in gens if g["age_s"] is not None]
    return _row(st, text, facts, age_s=max(ages) if ages else None, href=HREF["generator"], code="generator_state")


def e02b(ctx: Ctx) -> dict[str, Any]:
    """Information only: the generator carrying the load is a banner (amber, not a fault)."""
    gens = _generators(ctx)
    if not gens:
        return _unknown("לא זוהה גנרטור במערכת", HREF["generator"], "no_generator")
    carrying = [g["name"] for g in gens if g["avail"] == "online" and ((g["values"].get("on_load") or {}).get("value") is True or (g["values"].get("ats_position") or {}).get("value") == "generator")]
    mains = [(g["values"].get("mains_available") or {}).get("value") for g in gens if g["avail"] == "online"]
    if carrying:
        return _row("amber", "הגנרטור נושא את העומס כרגע", [{"key": "generator_on_load", "value": len(carrying)}], href=HREF["generator"], code="on_load")
    if not mains or all(m is None for m in mains):
        return _unknown("מצב הרשאות הרשת לא נקרא", HREF["generator"])
    return _row("green", "הבניין על הרשת", href=HREF["generator"], code="on_mains")


# ---------------------------------------------------------------- B. the ledger (owner q205 b: the closed emergency_slot column)

def _slot_tasks(ctx: Ctx, slot: str) -> list[sqlite3.Row]:
    return ctx.conn.execute("SELECT * FROM maint_tasks WHERE emergency_slot = ? AND deleted_at IS NULL AND active = 1 ORDER BY due_date", (slot,)).fetchall()


def _ledger_item(ctx: Ctx, item_id: str, slot: str, none_text: str, ok_text: str, amber_text: str, red_text: str) -> dict[str, Any]:
    if not ctx.maint_on:
        return _unknown("יומן התעודות כבוי", HREF["maintenance"], "ledger_off")
    tasks = _slot_tasks(ctx, slot)
    if not tasks:
        return _row("red", none_text, href=HREF["contacts"], code="unbound")
    states = [mmodel.due_state(mmodel.parse_date(t["due_date"], "due_date") if t["due_date"] else None, t["lead_days"], ctx.today).state for t in tasks]
    st = model.ledger_state(states)
    facts = [{"key": "task", "label": t["title"], "value": t["due_date"], "state": s, "task_id": t["id"]} for t, s in zip(tasks, states)]
    text = {"green": ok_text, "amber": amber_text, "red": red_text, "unknown": "אין תאריך תוקף לפריט בפנקס"}[st]
    return _row(st, text, facts, href=HREF["maintenance"], code=f"ledger_{st}")


def e03(ctx: Ctx) -> dict[str, Any]:
    return _ledger_item(ctx, "E03", "fire_certificate", "לא נקשרה תעודת בטיחות אש", "תעודת בטיחות האש בתוקף", "תעודת בטיחות האש קרובה לפקיעה", "תעודת בטיחות האש פגה")


def e04(ctx: Ctx) -> dict[str, Any]:
    return _ledger_item(ctx, "E04", "extinguishers", "לא נקשרה בדיקת מטפים", "בדיקת המטפים בתוקף", "בדיקת המטפים קרובה לפקיעה", "בדיקת המטפים פגה")


def e05(ctx: Ctx) -> dict[str, Any]:
    return _ledger_item(ctx, "E05", "hydrants_sprinklers", "לא נקשרה בדיקת ברזים וממטרות", "בדיקת הברזים והממטרות בתוקף", "בדיקת הברזים והממטרות קרובה לפקיעה", "בדיקת הברזים והממטרות פגה")


def e06(ctx: Ctx) -> dict[str, Any]:
    return _ledger_item(ctx, "E06", "emergency_lighting", "לא נקשרה בדיקת תאורת חירום", "בדיקת תאורת החירום בתוקף", "בדיקת תאורת החירום קרובה לפקיעה", "בדיקת תאורת החירום פגה")


def e07(ctx: Ctx) -> dict[str, Any]:
    if not ctx.maint_on:
        return _unknown("יומן התעודות כבוי", HREF["maintenance"], "ledger_off")
    tasks = _slot_tasks(ctx, "evacuation_round")
    if not tasks:
        return _row("red", "לא נקשר סבב פינוי", href=HREF["contacts"], code="unbound")
    states, results = [], []
    for t in tasks:
        states.append(mmodel.due_state(mmodel.parse_date(t["due_date"], "due_date") if t["due_date"] else None, t["lead_days"], ctx.today).state)
        r = ctx.conn.execute("SELECT result FROM maint_records WHERE task_id = ? AND kind = 'run' AND status = 'done' ORDER BY finished_at DESC LIMIT 1", (t["id"],)).fetchone()
        results.append(r["result"] if r else None)
    st = model.evacuation_round(states, results)
    text = {"green": "סבב פינוי בוצע בזמן", "amber": "סבב הפינוי קרוב למועדו או שנמצאו בו ליקויים", "red": "סבב הפינוי באיחור", "unknown": "אין נתוני ביצוע לסבב הפינוי"}[st]
    return _row(st, text, [{"key": "task", "label": t["title"], "value": t["due_date"]} for t in tasks], href=HREF["maintenance"], code="evacuation")


def e08(ctx: Ctx) -> dict[str, Any]:
    if not ctx.tickets_on:
        return _row("not_applicable", "מודול הקריאות כבוי", code="tickets_off")
    ids = [r["ticket_id"] for r in ctx.conn.execute(
        "SELECT ticket_id FROM maint_tasks WHERE emergency_slot IN ('fire_certificate','extinguishers','hydrants_sprinklers','emergency_lighting','evacuation_round') "
        "AND ticket_id IS NOT NULL AND deleted_at IS NULL").fetchall()]
    if not ids:
        return _row("green", "אין קריאות שירות פתוחות בנושא בטיחות אש", code="none_open")
    q = ",".join("?" * len(ids))
    rows = ctx.conn.execute(f"SELECT status, resolve_due_at FROM tickets WHERE id IN ({q}) AND status NOT IN ('done','closed','cancelled','returned')", ids).fetchall()
    past = sum(1 for r in rows if r["resolve_due_at"] and r["resolve_due_at"] < ctx.now_iso)
    st = model.ticket_requests(len(rows), past)
    text = {"green": "אין קריאות שירות פתוחות בנושא בטיחות אש", "amber": "יש קריאות בטיחות אש פתוחות", "red": "יש קריאות בטיחות אש פתוחות שחרגו מהיעד"}[st]
    return _row(st, text, [{"key": "open", "value": len(rows)}, {"key": "past_sla", "value": past}], href=HREF["maintenance"], code="tickets")


# ---------------------------------------------------------------- C. elevators

def e09(ctx: Ctx) -> dict[str, Any]:
    if not ctx.maint_on:
        return _unknown("יומן התעודות כבוי", HREF["maintenance"], "ledger_off")
    elevs = ctx.conn.execute("SELECT id, name FROM infra_elevators WHERE enabled = 1").fetchall()
    if not elevs:
        return _unknown("לא הוגדרו מעליות במערכת", HREF["elevators"], "no_elevators")
    statuses, facts = [], []
    for e in elevs:
        tasks = ctx.conn.execute("SELECT * FROM maint_tasks WHERE emergency_slot = 'elevator_inspection' AND elevator_id = ? AND deleted_at IS NULL AND active = 1", (e["id"],)).fetchall()
        states = [mmodel.due_state(mmodel.parse_date(t["due_date"], "due_date") if t["due_date"] else None, t["lead_days"], ctx.today).state for t in tasks]
        statuses.append(model.ledger_state(states))
        facts.append({"key": "elevator", "label": e["name"], "value": min((t["due_date"] for t in tasks if t["due_date"]), default=None)})
    st = model.worst(statuses)
    text = {"green": "בדיקות המעליות בתוקף", "amber": "בדיקת מעלית קרובה לפקיעה", "red": "בדיקת מעלית פגה או שלא נקשרה", "unknown": "חסר תאריך תוקף לבדיקת מעלית"}[st]
    return _row(st, text, facts, href=HREF["maintenance"], code="elevator_inspection")


def e10(ctx: Ctx) -> dict[str, Any]:
    from .. import elevators as elev

    elevs = ctx.conn.execute("SELECT id, name FROM infra_elevators WHERE enabled = 1").fetchall()
    if not elevs:
        return _unknown("לא הוגדרו מעליות במערכת", HREF["elevators"], "no_elevators")
    if not elev.mirror_connected():
        return _unknown("החיבור לחיישני המעליות מנותק", HREF["elevators"], "mirror_down")
    sensors = elev.sensors_of(ctx.conn, [e["id"] for e in elevs])
    states, unmonitored = [], False
    for e in elevs:
        rows = sensors.get(e["id"], [])
        if not rows:
            unmonitored = True
            continue
        states.append(elev.live_of(rows, connected=True)["state"])
    st = model.elevator_states(states, unmonitored)
    text = {"green": "המעליות מנוטרות ותקינות", "amber": "מעלית עם דלת פתוחה או מחוץ לשירות", "red": "יש מעלית בתקלה", "unknown": "ניטור המעליות אינו מלא"}[st]
    facts = [{"key": "elevators", "value": len(elevs)}, {"key": "fire_service", "value": sum(1 for s in states if s == "fire_service")}]
    return _row(st, text, facts, href=HREF["elevators"], code="elevator_live")


# ---------------------------------------------------------------- D. doors (read only)

def e11(ctx: Ctx) -> dict[str, Any]:
    from .. import door_emergency as de
    from .. import intercom_sync

    on = (get_setting(ctx.conn, de.ENABLED, "false") == "true") or (get_setting(ctx.conn, de.OPEN_ENABLED, "false") == "true")
    if not on:
        return _row("not_applicable", "בקרת חירום בדלתות כבויה", href=HREF["doors"], critical=False, code="doors_off")
    attested = ctx.conn.execute("SELECT 1 FROM door_emergency_attestation WHERE id = 1").fetchone() is not None
    last = ctx.conn.execute("SELECT MAX(requested_at) AS t FROM door_emergency_incidents WHERE drill = 1").fetchone()["t"]
    days = model.age_days(last, ctx.now_iso) if last else None
    st = model.door_controls(True, attested, True, intercom_sync.STATE.state, days, ctx.th)
    text = {"green": "בקרות החירום בדלתות מוכנות", "amber": "בקרות החירום בדלתות מוכנות, אך לא נערך תרגיל לאחרונה", "red": "בקרות החירום בדלתות אינן מוכנות", "unknown": "לא ניתן לאמת את בקרות החירום בדלתות"}[st]
    return _row(st, text, [{"key": "drill_days", "value": None if days is None else int(days)}, {"key": "attested", "value": attested}], href=HREF["doors"], critical=True, code="doors_ready")


def e12(ctx: Ctx) -> dict[str, Any]:
    from .. import door_emergency as de

    if (get_setting(ctx.conn, de.ENABLED, "false") != "true") and (get_setting(ctx.conn, de.OPEN_ENABLED, "false") != "true"):
        return _row("not_applicable", "בקרת חירום בדלתות כבויה", href=HREF["doors"], critical=False, code="doors_off")
    unconfirmed = ctx.conn.execute("SELECT COUNT(*) FROM door_window_occurrences WHERE state = 'relock_unconfirmed'").fetchone()[0]
    open_n = ctx.conn.execute("SELECT COUNT(*) FROM door_emergency_incidents WHERE drill = 0 AND state IN ('applying','in_effect','in_effect_partial','releasing')").fetchone()[0]
    st = model.door_faults(unconfirmed, open_n)
    text = "אין תקלת דלת ואין אירוע חירום פתוח" if st == "green" else "יש דלת שלא ננעלה בוודאות או אירוע חירום פתוח"
    return _row(st, text, [{"key": "unconfirmed", "value": unconfirmed}, {"key": "open_incidents", "value": open_n}], href=HREF["doors"], critical=True, code="door_faults")


# ---------------------------------------------------------------- E. people (owner q203 b: the dedicated list)

def _reachable_contacts(ctx: Ctx) -> tuple[int, int]:
    rows = ctx.conn.execute("SELECT * FROM emergency_contacts WHERE deleted_at IS NULL AND active = 1").fetchall()
    reach = verified = 0
    for r in rows:
        route = bool(r["phone"] or r["email"])
        if not route and r["user_id"]:
            u = ctx.conn.execute("SELECT active FROM users WHERE id = ?", (r["user_id"],)).fetchone()
            route = bool(u and u["active"])
        if not route:
            continue
        reach += 1
        d = model.age_days(r["last_verified_at"], ctx.now_iso) if r["last_verified_at"] else None
        if d is not None and d <= ctx.th["contact_verify_days"]:
            verified += 1
    return reach, verified


def e13(ctx: Ctx) -> dict[str, Any]:
    reach, verified = _reachable_contacts(ctx)
    st = model.contacts(reach, verified, int(ctx.th["contacts_min"]))
    text = {"green": "רשימת אנשי החירום מלאה ונבדקה", "amber": "רשימת אנשי החירום חלקית או שלא נבדקה לאחרונה", "red": "אין אף איש קשר חירום שאפשר להגיע אליו"}[st]
    return _row(st, text, [{"key": "reachable", "value": reach}, {"key": "verified", "value": verified}], href=HREF["contacts"], code="contacts")


def e14(ctx: Ctx) -> dict[str, Any]:
    if not ctx.maint_on:
        return _unknown("יומן התעודות כבוי", HREF["maintenance"], "ledger_off")
    vids = [r["vendor_id"] for r in ctx.conn.execute("SELECT DISTINCT vendor_id FROM maint_tasks WHERE emergency_slot IS NOT NULL AND vendor_id IS NOT NULL AND deleted_at IS NULL").fetchall()]
    if not vids:
        return _unknown("לא קשורים ספקים לפריטי החירום", HREF["maintenance"], "no_vendors")
    bad = warn = 0
    for vid in vids:
        v = ctx.conn.execute("SELECT active, erased_at, phone_e164, email FROM ticket_contacts WHERE id = ?", (vid,)).fetchone()
        if v is None or v["erased_at"] or not v["active"] or not (v["phone_e164"] or v["email"]):
            bad += 1
            continue
        exp = ctx.conn.execute("SELECT 1 FROM maint_tasks WHERE vendor_id = ? AND kind = 'vendor_document' AND deleted_at IS NULL AND due_date IS NOT NULL AND due_date < ?",
                               (vid, ctx.today.isoformat())).fetchone()
        warn += 1 if exp else 0
    st = model.suppliers(len(vids), bad, warn)
    text = {"green": "ספקי החירום פעילים ויש דרך ליצור קשר", "amber": "לספק חירום יש מסמך שפג", "red": "ספק חירום לא פעיל או בלי דרך ליצור קשר", "unknown": "לא קשורים ספקים"}[st]
    return _row(st, text, [{"key": "suppliers", "value": len(vids)}], href=HREF["maintenance"], code="suppliers")


# ---------------------------------------------------------------- F. delivery and records

def e15(ctx: Ctx) -> dict[str, Any]:
    since = (ctx.now - dt.timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%SZ")
    rows = ctx.conn.execute(
        "SELECT d.status AS status, COUNT(*) AS n FROM notification_deliveries d JOIN notifications n ON n.id = d.notification_id "
        "WHERE d.created_at >= ? AND n.severity IN ('critical','alert') GROUP BY d.status", (since,)).fetchall()
    by = {r["status"]: r["n"] for r in rows}
    sent, failed = by.get("sent", 0), by.get("failed", 0) + by.get("gone", 0)
    oldest = ctx.conn.execute("SELECT MIN(created_at) AS t FROM notify_outbox").fetchone()["t"]
    backlog = (ctx.now - _iso_to_dt(oldest)).total_seconds() / 60 if oldest and _iso_to_dt(oldest) else None
    st = model.deliveries(sent, failed, backlog, ctx.th)
    text = {"green": "ההתראות נמסרות", "amber": "חלק מההתראות נכשלות או תקועות בתור", "red": "ההתראות אינן נמסרות", "unknown": "אין עדיין נתוני מסירה של התראות"}[st]
    return _row(st, text, [{"key": "sent", "value": sent}, {"key": "failed", "value": failed}, {"key": "backlog_min", "value": None if backlog is None else int(backlog)}],
                href=HREF["notify"], code="deliveries")


def e16(ctx: Ctx) -> dict[str, Any]:
    if ctx.settings is None:
        return _unknown("הגדרות הגיבוי אינן זמינות", HREF["backup"])
    from .. import backup as backup_svc
    from .. import backup_drill

    entries = [e for e in backup_svc.list_backups(ctx.settings) if e.get("valid", True)]
    local = model.age_days(entries[0]["created_at"], ctx.now_iso) if entries else None
    last = backup_drill.read_last(ctx.settings, backup_drill.LAST_FILE)
    drill = model.age_days((last or {}).get("finished_at"), ctx.now_iso) if last and last.get("result") == "PASS" else None
    off = backup_drill.read_last(ctx.settings, backup_drill.LAST_OFFBOX_FILE)
    offbox = model.age_days((off or {}).get("finished_at"), ctx.now_iso) if off and off.get("result") == "PASS" else None
    st = model.backup(local, drill, offbox, ctx.th)
    text = {"green": "יש גיבוי עדכני, שחזור נבדק ויעד חיצוני נבדק", "amber": "יש גיבוי, אך שחזור או יעד חיצוני לא נבדקו לאחרונה", "red": "אין גיבוי עדכני"}[st]
    return _row(st, text, [{"key": "backup_days", "value": None if local is None else round(local, 1)}, {"key": "drill_days", "value": None if drill is None else int(drill)},
                           {"key": "offbox_days", "value": None if offbox is None else int(offbox)}], age_s=None if local is None else local * 86400, href=HREF["backup"], code="backup")


# ---------------------------------------------------------------- G. cameras and recording

def e17(ctx: Ctx) -> dict[str, Any]:
    from .. import recorder_health as rh

    recs = ctx.conn.execute("SELECT id, name FROM recorders").fetchall()
    if not recs:
        return _unknown("אין מקליט מוגדר", HREF["health"], "no_recorder")
    import time

    now_ts = ctx.now.timestamp()
    reach: list[bool | None] = []
    bad_disk: list[bool] = []
    rec_exc: list[bool] = []
    degraded: list[bool] = []
    ages: list[float] = []
    for r in recs:
        s = rh.STORE.get(r["id"])
        if s is None or s.checked_at is None or now_ts - s.checked_at > ctx.th["recorder_stale_s"]:
            reach.append(None)
            continue
        ages.append(now_ts - s.checked_at)
        reach.append(bool(s.reachable))
        disks = list(getattr(s.reading, "disks", None) or []) if s.reading is not None else []
        chans = list(getattr(s.reading, "channels", None) or []) if s.reading is not None else []
        bad_disk.append(any(d.state in ("error", "missing", "unformatted") for d in disks))
        degraded.append(any(d.state in ("read_only", "locked") for d in disks))
        rec_exc.append(any(c.record_state == "exception" for c in chans))
    go = None
    if ctx.settings is not None and getattr(ctx.settings, "go2rtc_url", None):
        from .. import health_report

        cached = health_report._probe_cache.get("go2rtc")
        go = cached[1].get("status") if cached else None
    st = model.recorders(reach, bad_disk, rec_exc, go, degraded)
    text = {"green": "המקליטים פועלים ומקליטים", "amber": "דיסק במקליט לקריאה בלבד או איטי", "red": "מקליט לא זמין, דיסק תקול או חריג הקלטה", "unknown": "אין קריאה עדכנית מהמקליטים"}[st]
    return _row(st, text, [{"key": "recorders", "value": len(recs)}], age_s=max(ages) if ages else None, href=HREF["health"], code="recorders")


def emergency_camera_ids(conn: sqlite3.Connection) -> list[str]:
    v = _json_setting(conn, access.CAMERAS_KEY, [])
    return [x for x in v if isinstance(x, str)] if isinstance(v, list) else []


def e18(ctx: Ctx) -> dict[str, Any]:
    rows = ctx.conn.execute("SELECT id, status FROM cameras WHERE enabled = 1").fetchall()
    marked = set(emergency_camera_ids(ctx.conn))
    if not rows:
        return _unknown("אין מצלמות מוגדרות", HREF["health"], "no_cameras") | {"critical": bool(marked)}
    online = sum(1 for r in rows if r["status"] == "online")
    pct = 100.0 * online / len(rows)
    mk_off = sum(1 for r in rows if r["id"] in marked and r["status"] != "online")
    st = model.cameras(pct, mk_off, ctx.th)
    text = {"green": "המצלמות מחוברות", "amber": "חלק מהמצלמות לא מחוברות", "red": "מצלמות חירום מנותקות או רוב המצלמות לא מחוברות"}[st]
    return _row(st, text, [{"key": "online_pct", "value": round(pct, 1)}, {"key": "marked", "value": len(marked)}, {"key": "marked_offline", "value": mk_off}], href=HREF["health"],
                critical=bool(marked), code="cameras")


def e19(ctx: Ctx) -> dict[str, Any]:
    if ctx.settings is None:
        return _unknown("הגדרות המקליטים אינן זמינות", HREF["health"])
    from .. import health_report

    checks = health_report._recorder_time_checks(ctx.settings, ctx.conn)
    if not checks:
        return _unknown("אין קריאת שעון מהמקליטים", HREF["health"], "no_clock")
    order = {"ok": 0, "warn": 1, "error": 2}
    w = max((c["status"] for c in checks), key=lambda s: order.get(s, 0))
    st = model.clock(w)
    text = {"green": "שעון המקליטים תקין", "amber": "שעון מקליט שונה משעון הבניין", "red": "שעון מקליט שגוי; חותמות הזמן בראיות לא אמינות"}[st]
    return _row(st, text, [{"key": "recorders", "value": len(checks)}], href=HREF["health"], code="clock")


READERS = {"E01": e01, "E02": e02, "E02b": e02b, "E03": e03, "E04": e04, "E05": e05, "E06": e06, "E07": e07, "E08": e08, "E09": e09, "E10": e10, "E11": e11, "E12": e12,
           "E13": e13, "E14": e14, "E15": e15, "E16": e16, "E17": e17, "E18": e18, "E19": e19}


def run_all(ctx: Ctx) -> dict[str, dict[str, Any]]:
    return {k: _safe(fn, ctx) for k, fn in READERS.items()}


def banners(ctx: Ctx) -> list[dict[str, Any]]:
    """Live states that are EVENTS, not defects (CR section 6): fire service on, a real emergency incident open, the generator carrying the load."""
    out: list[dict[str, Any]] = []
    try:
        from .. import elevators as elev

        elevs = ctx.conn.execute("SELECT id, name FROM infra_elevators WHERE enabled = 1").fetchall()
        if elevs and elev.mirror_connected():
            sensors = elev.sensors_of(ctx.conn, [e["id"] for e in elevs])
            n = sum(1 for e in elevs if sensors.get(e["id"]) and elev.live_of(sensors[e["id"]], connected=True)["state"] == "fire_service")
            if n:
                out.append({"code": "fire_service", "count": n, "text": "פיקוד כבאים פעיל - אירוע בעיצומו"})
    except Exception:  # noqa: BLE001
        pass
    try:
        r = ctx.conn.execute("SELECT requested_at FROM door_emergency_incidents WHERE drill = 0 AND state IN ('applying','in_effect','in_effect_partial','releasing') ORDER BY requested_at DESC LIMIT 1").fetchone()
        if r:
            out.append({"code": "door_incident", "since": r["requested_at"], "text": "אירוע חירום פתוח בדלתות"})
    except Exception:  # noqa: BLE001
        pass
    try:
        if e02b(ctx)["code"] == "on_load":
            out.append({"code": "on_load", "text": "הגנרטור נושא את העומס כרגע"})
    except Exception:  # noqa: BLE001
        pass
    return out
