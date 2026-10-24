"""CR-INSIGHT215 part 1: the monthly building report - ONE PDF for a manager or a committee (EXPANSION_IDEAS idea 23).

`build()` makes the report MODEL of one local calendar month (the installation zone) from data the system already keeps; `html_of()` makes the
printable HTML (Hebrew RTL first, English LTR; bundled fonts only - the Noto / Heebo decision of the bill PDF) that services/building_report_pdf.py
renders in the isolated render child of the bill PDF. One model, so the PDF and the preview always say the same numbers.

Sections (selectable; the order is fixed): summary, tickets (service requests), energy, elevators, generator, temperature, doors (unexplained
openings, CR part 2), cameras (camera / recorder health conditions), waste (CR part 3). A section the caller may not read, whose module is off or
whose insight switch is off is OMITTED and listed in `omitted` with the reason - the PDF prints nothing for it (CR section 6).

No person is named anywhere: counts, departments, vendors' absence, devices, rooms, meters and doors only; a ticket is its number, department
and age - never its title (free text may carry a name). Read-only."""
from __future__ import annotations

import datetime as dt
import hashlib
import html
import json
import sqlite3
from typing import Any, Callable
from zoneinfo import ZoneInfo

from . import insights_common as ic
from .bill_pdf_html import BRAND_URL
from .timeutil import zone

E = html.escape
TOP = 5
TICKET_SCAN = 20000
OPEN_TICKET = ("closed", "cancelled")
ELEVATOR_DOWN = ("fault", "out_of_service", "fire_service")

LABELS: dict[str, dict[str, str]] = {
    "he": {"title": "דוח בניין חודשי", "month": "חודש", "generated": "הופק", "digest": "תמצית התוכן", "zone": "אזור זמן", "site": "SmplWise Arx",
           "summary": "סיכום", "tickets": "בקשות שירות", "energy": "חשמל", "elevators": "מעליות", "generator": "גנרטור", "temperature": "טמפרטורות",
           "doors": "פתיחות דלת לא מוסברות", "cameras": "תקינות מצלמות והקלטה", "waste": "צריכת אנרגיה",
           "opened": "נפתחו", "closed": "נסגרו", "open_end": "פתוחות בסוף החודש", "overdue": "באיחור", "department": "מחלקה", "number": "מספר",
           "age_days": "ימים פתוחה", "oldest": "הבקשות הפתוחות הוותיקות", "median_close": "זמן סגירה חציוני (שעות)",
           "meter": "מונה", "kwh": "קוט״ש", "prev": "חודש קודם", "last_year": "אשתקד", "coverage": "כיסוי נתונים", "total": "סה״כ",
           "elevator": "מעלית", "fault_min": "תקלה", "out_min": "מושבתת", "fire_min": "פיקוד כבאים", "history_from": "היסטוריה זמינה מ-",
           "device": "התקן", "critical": "קריטי", "alert": "התראה", "info": "מידע", "alerts": "התראות",
           "unit": "יחידה", "alarms": "אזעקות", "warnings": "אזהרות", "excursion": "זמן מחוץ לטווח", "offline": "חיישן לא דיווח",
           "door": "דלת", "unexplained": "לא מוסברות", "openings": "פתיחות", "unverifiable": "לא ניתן לאמת", "not_configured": "לא הוגדרו זוגות דלת",
           "events": "אירועים", "minutes": "דקות", "camera": "מצלמה / מקליט", "recorder": "מקליט",
           "empty_room": "דלוק בחדר ריק", "after_hours": "דלוק בשעות הלילה", "anomalies": "חריגות צריכה בלילה", "night": "לילה",
           "change": "שינוי", "none": "אין", "no_data": "אין נתונים בחודש הזה", "min_u": "דק׳", "h_u": "שע׳",
           "s_tickets": "{o} נפתחו · {c} נסגרו · {e} פתוחות", "s_energy": "{k} קוט״ש · {d} מול חודש קודם",
           "s_elevators": "{m} דקות השבתה", "s_generator": "{n} התראות ({c} קריטיות)", "s_generator_runs": "{r} הפעלות · {h} שעות עבודה",
           "runs": "הפעלות", "run_hours": "שעות עבודה", "longest": "ההפעלה הארוכה (דק׳)", "meter_hours": "מונה שעות הבקר", "s_temperature": "{a} אזעקות · {o} מחוץ לטווח",
           "s_doors": "{u} פתיחות לא מוסברות מתוך {n}", "s_cameras": "{n} תקלות · {m} דקות", "s_waste": "{e} דק׳ בחדר ריק · {n} דק׳ בלילה · {a} חריגות צריכה"},
    "en": {"title": "Monthly building report", "month": "Month", "generated": "Generated", "digest": "Content digest", "zone": "Time zone", "site": "SmplWise Arx",
           "summary": "Summary", "tickets": "Service requests", "energy": "Electricity", "elevators": "Elevators", "generator": "Generator", "temperature": "Temperatures",
           "doors": "Unexplained door openings", "cameras": "Camera and recording health", "waste": "Energy consumption",
           "opened": "Opened", "closed": "Closed", "open_end": "Open at month end", "overdue": "Overdue", "department": "Department", "number": "Number",
           "age_days": "Days open", "oldest": "Oldest open requests", "median_close": "Median time to close (hours)",
           "meter": "Meter", "kwh": "kWh", "prev": "Previous month", "last_year": "Last year", "coverage": "Data coverage", "total": "Total",
           "elevator": "Elevator", "fault_min": "Fault", "out_min": "Out of service", "fire_min": "Fire service", "history_from": "History available from ",
           "device": "Device", "critical": "Critical", "alert": "Alert", "info": "Info", "alerts": "Alerts",
           "unit": "Unit", "alarms": "Alarms", "warnings": "Warnings", "excursion": "Time out of range", "offline": "Sensor silent",
           "door": "Door", "unexplained": "Unexplained", "openings": "Openings", "unverifiable": "Cannot verify", "not_configured": "No door pairs are set",
           "events": "Events", "minutes": "Minutes", "camera": "Camera / recorder", "recorder": "Recorder",
           "empty_room": "On in an empty room", "after_hours": "On at night", "anomalies": "Night consumption anomalies", "night": "Night",
           "change": "Change", "none": "None", "no_data": "No data this month", "min_u": "min", "h_u": "h",
           "s_tickets": "{o} opened · {c} closed · {e} open", "s_energy": "{k} kWh · {d} vs previous month",
           "s_elevators": "{m} minutes down", "s_generator": "{n} alerts ({c} critical)", "s_generator_runs": "{r} runs · {h} run hours",
           "runs": "Runs", "run_hours": "Run hours", "longest": "Longest run (min)", "meter_hours": "Controller hour meter", "s_temperature": "{a} alarms · {o} out of range",
           "s_doors": "{u} unexplained of {n} openings", "s_cameras": "{n} conditions · {m} minutes", "s_waste": "{e} min in empty rooms · {n} min at night · {a} anomalies"},
}


class MonthError(ValueError):
    pass


def month_bounds(month: str | None, tz: ZoneInfo, now_ts: float) -> tuple[str, int, int]:
    """("YYYY-MM", lo, hi) of a local calendar month; the default is the previous month; a month that has not started is refused; the current
    month ends now."""
    now_local = dt.datetime.fromtimestamp(now_ts, dt.timezone.utc).astimezone(tz)
    if not month:
        first = (now_local.replace(day=1) - dt.timedelta(days=1)).replace(day=1)
        y, m = first.year, first.month
    else:
        try:
            y, m = int(month[:4]), int(month[5:7])
            if len(month) != 7 or month[4] != "-" or not (1 <= m <= 12) or y < 2000:
                raise ValueError
        except ValueError:
            raise MonthError("month") from None
    a = dt.datetime(y, m, 1, tzinfo=tz)
    b = dt.datetime(y + (m == 12), m % 12 + 1, 1, tzinfo=tz)
    lo, hi = int(a.timestamp()), min(int(b.timestamp()), int(now_ts))
    if hi <= lo:
        raise MonthError("month")
    return f"{y:04d}-{m:02d}", lo, hi


def _clip(a: float, b: float | None, lo: float, hi: float) -> float:
    return max(0.0, min(b if b is not None else hi, hi) - max(a, lo))


# ---------------------------------------------------------------- the sections

def tickets(conn: sqlite3.Connection, principal: Any, lo: int, hi: int, now_ts: float) -> dict[str, Any]:
    """Counted over the tickets the caller may see (services/tickets/access.visible - the module's one rule)."""
    from .tickets import access as ta

    a, b = ic.iso(lo), ic.iso(hi)
    ids = [r[0] for r in conn.execute(
        f"""SELECT id FROM tickets WHERE (created_at >= ? AND created_at < ?) OR (closed_at >= ? AND closed_at < ?)
            OR (created_at < ? AND status NOT IN ({','.join('?' * len(OPEN_TICKET))})) OR (created_at < ? AND closed_at >= ?) LIMIT ?""",
        (a, b, a, b, b, *OPEN_TICKET, b, b, TICKET_SCAN)).fetchall()]
    seen = ta.visible_by_ids(ta.Viewer(conn, principal), ids)
    rows = [s.row for s in seen.values()]
    depts = {r["id"]: r["name"] for r in conn.execute("SELECT id, name FROM ticket_departments").fetchall()}
    opened = [r for r in rows if a <= r["created_at"] < b]
    closed = [r for r in rows if r["closed_at"] and a <= r["closed_at"] < b]
    open_end = [r for r in rows if r["created_at"] < b and (not r["closed_at"] or r["closed_at"] >= b) and (r["status"] not in OPEN_TICKET or r["closed_at"])]
    overdue = [r for r in open_end if r["resolve_due_at"] and r["resolve_due_at"] < b]
    hours = sorted((ic.ts_of(r["closed_at"]) - ic.ts_of(r["created_at"])) / 3600 for r in closed if r["status"] == "closed")
    by: dict[str, dict[str, int]] = {}
    for r in opened:
        by.setdefault(r["department_id"], {"opened": 0, "closed": 0})["opened"] += 1
    for r in closed:
        by.setdefault(r["department_id"], {"opened": 0, "closed": 0})["closed"] += 1
    oldest = sorted(open_end, key=lambda r: r["created_at"])[:TOP]
    return {"opened": len(opened), "closed": len(closed), "open_end": len(open_end), "overdue": len(overdue),
            "median_close_h": round(hours[len(hours) // 2], 1) if hours else None,
            "by_department": sorted(({"name": depts.get(k, "—"), **v} for k, v in by.items()), key=lambda x: (-x["opened"], x["name"])),
            "oldest_open": [{"number": r["number"], "department": depts.get(r["department_id"], "—"), "age_days": int((hi - ic.ts_of(r["created_at"])) // 86400)} for r in oldest],
            "truncated": len(ids) >= TICKET_SCAN}


def energy(conn: sqlite3.Connection, store: Any, tz: ZoneInfo, lo: int, hi: int) -> dict[str, Any]:
    if store is None:
        return {"available": False, "meters": []}
    d0 = dt.datetime.fromtimestamp(lo, dt.timezone.utc).astimezone(tz).date()
    d1 = dt.datetime.fromtimestamp(hi - 1, dt.timezone.utc).astimezone(tz).date() + dt.timedelta(days=1)
    p0 = (d0 - dt.timedelta(days=1)).replace(day=1)
    ly0, ly1 = d0.replace(year=d0.year - 1), d1.replace(year=d1.year - 1) if not (d1.month == 2 and d1.day == 29) else d1.replace(year=d1.year - 1, day=28)
    out = []
    for m in conn.execute("SELECT id, display_name FROM energy_meters WHERE status <> 'retired' ORDER BY display_name").fetchall():
        def kwh(a: dt.date, b: dt.date) -> tuple[float | None, float]:
            rows = store.daily(m["id"], a, b)
            days = max(1, (b - a).days)
            wh = sum(r[0] for r in rows.values() if r[1] > 0)
            cov = sum(min(1.0, r[1] / max(1, r[2])) for r in rows.values()) / days
            return (round(wh / 1000, 1) if rows else None), round(cov * 100)
        cur, cov = kwh(d0, d1)
        prev, _ = kwh(p0, d0)
        ly, _ = kwh(ly0, ly1)
        out.append({"name": m["display_name"], "kwh": cur, "prev_kwh": prev, "last_year_kwh": ly, "coverage": cov})
    tot = round(sum(x["kwh"] or 0 for x in out), 1)
    ptot = round(sum(x["prev_kwh"] or 0 for x in out), 1)
    return {"available": True, "meters": out, "total_kwh": tot, "prev_total_kwh": ptot,
            "change_pct": round((tot - ptot) / ptot * 100, 1) if ptot else None}


def elevators(conn: sqlite3.Connection, lo: int, hi: int) -> dict[str, Any]:
    a, b = ic.iso(lo), ic.iso(hi)
    items = []
    for e in conn.execute("SELECT id, name FROM infra_elevators WHERE enabled = 1 ORDER BY sort_order, name").fetchall():
        prev = conn.execute("SELECT at, state FROM infra_elevator_states WHERE elevator_id = ? AND at <= ? ORDER BY at DESC LIMIT 1", (e["id"], a)).fetchone()
        rows = conn.execute("SELECT at, state FROM infra_elevator_states WHERE elevator_id = ? AND at > ? AND at < ? ORDER BY at", (e["id"], a, b)).fetchall()
        segs: list[tuple[float, str]] = ([(float(lo), prev["state"])] if prev is not None else []) + [(ic.ts_of(r["at"]), r["state"]) for r in rows]
        mins = dict.fromkeys(ELEVATOR_DOWN, 0.0)
        for i, (t, st) in enumerate(segs):
            end = segs[i + 1][0] if i + 1 < len(segs) else float(hi)
            if st in mins:
                mins[st] += (end - t) / 60
        items.append({"name": e["name"], "fault_min": int(mins["fault"]), "out_min": int(mins["out_of_service"]), "fire_min": int(mins["fire_service"]),
                      "history_from": ic.iso(segs[0][0]) if segs and segs[0][0] > lo else (None if segs else None), "has_data": bool(segs)})
    return {"items": items, "down_min": sum(i["fault_min"] + i["out_min"] + i["fire_min"] for i in items)}


def generator(conn: sqlite3.Connection, lo: int, hi: int, parts: tuple[bool, bool] = (True, True)) -> dict[str, Any]:
    """The generator section: the alerts of the month (`parts[0]`) and the run counts and hours (`parts[1]`, slice 3, owner answer 262)."""
    from . import insights_generator

    alerts, runs = parts
    runs_out = insights_generator.report(conn, lo, hi, ic.load(conn)["generator"]["min_run_s"]) if runs else None
    if not alerts:
        return {"alerts": False, "devices": [], "total": 0, "critical": 0, "runs": runs_out}
    a, b = ic.iso(lo), ic.iso(hi)
    out = []
    for d in conn.execute("SELECT id, name FROM generator_devices ORDER BY name").fetchall():
        rows = conn.execute("SELECT alert_key, severity, count FROM generator_alerts WHERE device_id = ? AND raised_at >= ? AND raised_at < ?", (d["id"], a, b)).fetchall()
        sev = {s: sum(1 for r in rows if r["severity"] == s) for s in ("critical", "alert", "info")}
        keys: dict[str, int] = {}
        for r in rows:
            keys[r["alert_key"]] = keys.get(r["alert_key"], 0) + 1
        out.append({"name": d["name"], **sev, "total": len(rows), "top": [{"key": k, "count": n} for k, n in sorted(keys.items(), key=lambda kv: (-kv[1], kv[0]))[:TOP]]})
    return {"alerts": True, "devices": out, "total": sum(x["total"] for x in out), "critical": sum(x["critical"] for x in out), "runs": runs_out}


def temperature(conn: sqlite3.Connection, lo: int, hi: int) -> dict[str, Any]:
    a, b = ic.iso(lo), ic.iso(hi)
    out = []
    for u in conn.execute("SELECT id, name FROM infra_temp_units WHERE enabled = 1 ORDER BY sort_order, name").fetchall():
        rows = conn.execute("SELECT kind, severity, started_at, ended_at FROM infra_temp_events WHERE unit_id = ? AND started_at < ? AND (ended_at IS NULL OR ended_at >= ?) "
                            "AND kind IN ('high','low','offline')", (u["id"], b, a)).fetchall()
        band = [r for r in rows if r["kind"] in ("high", "low")]
        out.append({"name": u["name"], "alarms": sum(1 for r in band if r["severity"] == "alarm"), "warnings": sum(1 for r in band if r["severity"] == "warning"),
                    "out_min": int(sum(_clip(ic.ts_of(r["started_at"]), ic.ts_of(r["ended_at"]) if r["ended_at"] else None, lo, hi) for r in band) // 60),
                    "offline": sum(1 for r in rows if r["kind"] == "offline")})
    out.sort(key=lambda x: (-x["alarms"], -x["out_min"], x["name"]))
    return {"units": out, "alarms": sum(x["alarms"] for x in out), "out_min": sum(x["out_min"] for x in out)}


def cameras(conn: sqlite3.Connection, lo: int, hi: int) -> dict[str, Any]:
    a, b = ic.iso(lo), ic.iso(hi)
    rows = conn.execute("""SELECT source, subject_kind, subject_id, first_at, resolved_at FROM notifications
                           WHERE (source LIKE 'camera.%' OR source LIKE 'recorder.%') AND first_at < ? AND (resolved_at IS NULL OR resolved_at >= ?)""", (b, a)).fetchall()
    names = {r["id"]: (r["alias"] or r["name_source"] or f"#{r['channel']}") for r in conn.execute("SELECT id, alias, name_source, channel FROM cameras").fetchall()}
    by: dict[str, dict[str, Any]] = {}
    total_min = 0.0
    for r in rows:
        mins = _clip(ic.ts_of(r["first_at"]), ic.ts_of(r["resolved_at"]) if r["resolved_at"] else None, lo, hi) / 60
        total_min += mins
        label = names.get(r["subject_id"] or "", None) if r["subject_kind"] == "camera" else None
        key = label or "recorder"
        x = by.setdefault(key, {"name": label, "count": 0, "minutes": 0.0})
        x["count"] += 1
        x["minutes"] += mins
    top = sorted(by.values(), key=lambda x: (-x["minutes"], -x["count"]))[:TOP]
    return {"events": len(rows), "minutes": int(total_min), "top": [{"name": x["name"], "count": x["count"], "minutes": int(x["minutes"])} for x in top]}


# ---------------------------------------------------------------- the model

def build(conn: sqlite3.Connection, principal: Any, sections: list[str], month: str | None, lang: str, now_ts: float, *,
          allowed: Callable[[str], str | None], store: Any = None, generator_parts: tuple[bool, bool] = (True, True)) -> dict[str, Any]:
    """The report model. `allowed(section)` returns None when the caller may have the section, else the reason it is omitted
    (`not_permitted`, `module_off`, `switch_off`) - decided by the route (permissions) so this module only reads data."""
    lang = lang if lang in LABELS else "he"
    tz = ic.site_zone(conn)
    mo, lo, hi = month_bounds(month, tz, now_ts)
    wanted = [s for s in ic.SECTIONS if s in sections]
    data: dict[str, Any] = {}
    omitted: list[dict[str, str]] = []
    builders: dict[str, Callable[[], dict[str, Any]]] = {
        "tickets": lambda: tickets(conn, principal, lo, hi, now_ts),
        "energy": lambda: energy(conn, store, tz, lo, hi),
        "elevators": lambda: elevators(conn, lo, hi),
        "generator": lambda: generator(conn, lo, hi, generator_parts),
        "temperature": lambda: temperature(conn, lo, hi),
        "doors": lambda: _doors(conn, lo, hi),
        "cameras": lambda: cameras(conn, lo, hi),
        "waste": lambda: _waste(conn, store, lo, hi),
    }
    for s in wanted:
        if s == "summary":
            continue
        why = allowed(s)
        if why:
            omitted.append({"section": s, "reason": why})
            continue
        data[s] = builders[s]()
    shown = [s for s in wanted if s in data or (s == "summary" and data)]
    if "summary" in shown:
        data["summary"] = summary(data, lang)
    model: dict[str, Any] = {"v": 1, "lang": lang, "month": mo, "zone": str(tz), "from": lo, "to": hi, "generated": int(now_ts),
                             "sections": shown, "omitted": omitted, "data": data}
    model["digest"] = digest(model)
    return model


def _doors(conn: sqlite3.Connection, lo: int, hi: int) -> dict[str, Any]:
    from . import insights_doors

    r = insights_doors.report(conn, None, lo, hi)
    return {"configured": r["configured"], "total": r["total"], "ranking": r["ranking"][:TOP],
            "doors": [{"name": d["name"], "openings": d["openings"], "unexplained": d["unexplained"], "unverifiable": d["unverifiable"]} for d in r["doors"]]}


def _waste(conn: sqlite3.Connection, store: Any, lo: int, hi: int) -> dict[str, Any]:
    from . import insights_waste

    r = insights_waste.report(conn, store, None, lo, hi)
    return {"minutes": r["devices"]["minutes"], "top": r["devices"]["items"][:TOP], "anomalies": len(r["energy"]["items"]) + r["energy"].get("items_more", 0),
            "anomaly_top": r["energy"]["items"][:TOP]}


def summary(data: dict[str, Any], lang: str) -> list[dict[str, str]]:
    """One line per included section, in the section order."""
    L = LABELS[lang]
    out = []
    for s in ic.SECTIONS:
        d = data.get(s)
        if d is None or s == "summary":
            continue
        if s == "tickets":
            t = L["s_tickets"].format(o=d["opened"], c=d["closed"], e=d["open_end"])
        elif s == "energy":
            ch = d.get("change_pct")
            t = L["s_energy"].format(k=_num(d.get("total_kwh")), d="—" if ch is None else f"{ch:+.1f}%") if d.get("available") else L["no_data"]
        elif s == "elevators":
            t = L["s_elevators"].format(m=d["down_min"])
        elif s == "generator":
            t = L["s_generator"].format(n=d["total"], c=d["critical"]) if d.get("alerts", True) else ""
            if d.get("runs") is not None:
                t = (t + " · " if t else "") + L["s_generator_runs"].format(r=d["runs"]["runs"], h=_num(d["runs"]["hours"]))
        elif s == "temperature":
            t = L["s_temperature"].format(a=d["alarms"], o=dur_text(d["out_min"], lang))
        elif s == "doors":
            t = L["s_doors"].format(u=d["total"]["unexplained"], n=d["total"]["openings"]) if d["configured"] else L["not_configured"]
        elif s == "cameras":
            t = L["s_cameras"].format(n=d["events"], m=d["minutes"])
        else:
            t = L["s_waste"].format(e=d["minutes"]["empty_room"], n=d["minutes"]["after_hours"], a=d["anomalies"])
        out.append({"section": s, "title": L[s], "text": t})
    return out


def digest(model: dict[str, Any]) -> str:
    body = {k: v for k, v in model.items() if k != "digest"}
    return hashlib.sha256(json.dumps(body, sort_keys=True, ensure_ascii=False, default=str).encode("utf-8")).hexdigest()


def _num(v: Any) -> str:
    if v is None:
        return "—"
    return f"{v:,.1f}" if isinstance(v, float) else f"{v:,}"


def dur_text(minutes: float, lang: str) -> str:
    m = int(round(minutes))
    L = LABELS[lang]
    return f"{m} {L['min_u']}" if m < 60 else f"{m // 60} {L['h_u']} {m % 60} {L['min_u']}" if m % 60 else f"{m // 60} {L['h_u']}"


def filename(model: dict[str, Any]) -> str:
    return f"building-report-{model['month']}.pdf"


# ---------------------------------------------------------------- the HTML (WeasyPrint)

def _css(lang: str) -> str:
    from .bill_pdf_html import ASSET_SCHEME

    fonts = "".join(f'@font-face {{ font-family: {fam}; src: url("{ASSET_SCHEME}{f}-{w}.ttf"); font-weight: {w}; }}\n'
                    for fam, f in (("HeeboHe", "Heebo-he"), ("HeeboLa", "Heebo-la"), ("NotoCy", "NotoSans-cy"), ("NotoAr", "NotoSansArabic-ar")) for w in (400, 700))
    side = "left" if lang == "he" else "right"
    return fonts + f"""
@page {{ size: A4; margin: 14mm 14mm 18mm;
  @bottom-center {{ content: counter(page) " / " counter(pages); font: 8pt HeeboLa; color: #5b6a85; }}
  @bottom-{side} {{ content: element(foot); }} }}
body {{ font-family: HeeboHe, HeeboLa, NotoCy, NotoAr; font-size: 9.5pt; color: #1d2433; }}
.hd {{ border-bottom: 1.5pt solid #1d2433; padding-bottom: 4pt; margin-bottom: 10pt; display: flex; justify-content: space-between; align-items: flex-end; }}
.hd h1 {{ margin: 0; font-size: 17pt; }} .brand {{ font-weight: 700; font-size: 11pt; }} .brand img {{ display: block; height: 8mm; width: auto; }}
.sub {{ color: #5b6a85; font-size: 8.5pt; }}
h2 {{ font-size: 12pt; margin: 14pt 0 5pt; border-bottom: 0.6pt solid #d5dbe6; padding-bottom: 2pt; break-after: avoid; }}
section {{ break-inside: auto; }}
.sum {{ width: 100%; border-collapse: collapse; }} .sum td {{ padding: 5pt 6pt; border-bottom: 0.5pt solid #e3e8f0; font-size: 10pt; }}
.sum td.k {{ font-weight: 700; width: 32%; }}
.kpis {{ display: flex; gap: 5pt; margin: 4pt 0 8pt; }}
.kpis div {{ flex: 1; border: 0.6pt solid #d5dbe6; border-radius: 4pt; padding: 4pt 6pt; }}
.kpis span {{ display: block; color: #5b6a85; font-size: 7.5pt; }} .kpis b {{ font-size: 13pt; direction: ltr; unicode-bidi: isolate; }}
table {{ width: 100%; border-collapse: collapse; font-size: 8.5pt; }} tr {{ break-inside: avoid; }}
th, td {{ border-bottom: 0.5pt solid #e3e8f0; padding: 3pt 4pt; text-align: start; }} th {{ color: #5b6a85; font-weight: 700; }}
.n {{ direction: ltr; unicode-bidi: isolate; white-space: nowrap; }}
.foot {{ position: running(foot); font-size: 6.5pt; color: #8a94a8; }}
"""


def _table(head: list[str], rows: list[list[str]], L: dict[str, str]) -> str:
    if not rows:
        return f'<p class="sub">{E(L["no_data"])}</p>'
    th = "".join(f"<th>{E(h)}</th>" for h in head)
    body = "".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rows)
    return f"<table><thead><tr>{th}</tr></thead><tbody>{body}</tbody></table>"


def _kpis(items: list[tuple[str, Any]], L: dict[str, str]) -> str:
    return '<div class="kpis">' + "".join(f'<div><span>{E(L[k])}</span><b>{E(_num(v) if not isinstance(v, str) else v)}</b></div>' for k, v in items) + "</div>"


def _n(v: Any) -> str:
    return f'<span class="n">{E(_num(v))}</span>'


def section_html(s: str, d: dict[str, Any], lang: str) -> str:
    L = LABELS[lang]
    if s == "tickets":
        body = _kpis([("opened", d["opened"]), ("closed", d["closed"]), ("open_end", d["open_end"]), ("overdue", d["overdue"]),
                      ("median_close", d["median_close_h"])], L)
        body += _table([L["department"], L["opened"], L["closed"]], [[E(x["name"]), _n(x["opened"]), _n(x["closed"])] for x in d["by_department"]], L)
        if d["oldest_open"]:
            body += f'<h3 class="sub">{E(L["oldest"])}</h3>' + _table([L["number"], L["department"], L["age_days"]],
                                                                      [[_n(x["number"]), E(x["department"]), _n(x["age_days"])] for x in d["oldest_open"]], L)
        return body
    if s == "energy":
        if not d.get("available"):
            return f'<p class="sub">{E(L["no_data"])}</p>'
        body = _kpis([("total", d["total_kwh"]), ("prev", d["prev_total_kwh"]), ("change", "—" if d["change_pct"] is None else f'{d["change_pct"]:+.1f}%')], L)
        return body + _table([L["meter"], L["kwh"], L["prev"], L["last_year"], L["coverage"]],
                             [[E(m["name"]), _n(m["kwh"]), _n(m["prev_kwh"]), _n(m["last_year_kwh"]), f'<span class="n">{m["coverage"]}%</span>'] for m in d["meters"]], L)
    if s == "elevators":
        return _table([L["elevator"], L["fault_min"], L["out_min"], L["fire_min"], L["coverage"]],
                      [[E(x["name"]), E(dur_text(x["fault_min"], lang)), E(dur_text(x["out_min"], lang)), E(dur_text(x["fire_min"], lang)),
                        (E(L["history_from"]) + f'<span class="n">{E(x["history_from"][:10])}</span>') if x["history_from"] else ("" if x["has_data"] else E(L["no_data"]))]
                       for x in d["items"]], L)
    if s == "generator":
        body = ""
        runs = d.get("runs")
        if runs is not None:
            body += _kpis([("runs", runs["runs"]), ("run_hours", runs["hours"])], L)
            body += _table([L["device"], L["runs"], L["run_hours"], L["longest"], L["meter_hours"]],
                           [[E(x["name"]), _n(x["runs"]), _n(x["hours"]), _n(x["longest_min"]), _n(x["meter_hours"]) if x["meter_hours"] is not None else "—"] for x in runs["devices"]], L)
        if d.get("alerts", True):
            body += _table([L["device"], L["critical"], L["alert"], L["info"]], [[E(x["name"]), _n(x["critical"]), _n(x["alert"]), _n(x["info"])] for x in d["devices"]], L)
        return body
    if s == "temperature":
        return _table([L["unit"], L["alarms"], L["warnings"], L["excursion"], L["offline"]],
                      [[E(x["name"]), _n(x["alarms"]), _n(x["warnings"]), E(dur_text(x["out_min"], lang)), _n(x["offline"])] for x in d["units"]], L)
    if s == "doors":
        if not d["configured"]:
            return f'<p class="sub">{E(L["not_configured"])}</p>'
        body = _kpis([("openings", d["total"]["openings"]), ("unexplained", d["total"]["unexplained"]), ("unverifiable", d["total"]["unverifiable"])], L)
        return body + _table([L["door"], L["openings"], L["unexplained"], L["unverifiable"]],
                             [[E(x["name"]), _n(x["openings"]), _n(x["unexplained"]), _n(x["unverifiable"])] for x in d["doors"]], L)
    if s == "cameras":
        body = _kpis([("events", d["events"]), ("minutes", d["minutes"])], L)
        return body + _table([L["camera"], L["events"], L["minutes"]], [[E(x["name"] or L["recorder"]), _n(x["count"]), _n(x["minutes"])] for x in d["top"]], L)
    if s == "waste":
        body = _kpis([("empty_room", d["minutes"]["empty_room"]), ("after_hours", d["minutes"]["after_hours"]), ("anomalies", d["anomalies"])], L)
        body += _table([L["device"], L["minutes"], ""], [[E(x["name"] + (f' · {x["area"]}' if x.get("area") else "")), _n(x["minutes"]), E(L[x["kind"]])] for x in d["top"]], L)
        if d["anomaly_top"]:
            body += f'<h3 class="sub">{E(L["anomalies"])}</h3>' + _table([L["meter"], L["night"], L["kwh"], ""],
                                                                         [[E(x["name"]), f'<span class="n">{E(x["night"])}</span>', _n(x["kwh"]),
                                                                           f'<span class="n">×{x["ratio"] if x["ratio"] is not None else "—"}</span>'] for x in d["anomaly_top"]], L)
        return body
    return ""


def html_of(model: dict[str, Any]) -> str:
    lang = model["lang"]
    L = LABELS[lang]
    tz = zone(model["zone"])
    gen = dt.datetime.fromtimestamp(model["generated"], dt.timezone.utc)
    foot = (f'<div class="foot">{E(L["site"])} · {E(L["generated"])} {gen.astimezone(tz):%d.%m.%Y %H:%M} ({E(model["zone"])}) · '
            f'<span class="n">{gen:%Y-%m-%dT%H:%M:%SZ}</span> · {E(L["digest"])} <span class="n">sha256 {model["digest"][:16]}</span></div>')
    parts = [f'<div class="hd"><div><h1>{E(L["title"])}</h1><div class="sub">{E(L["month"])}: <span class="n">{E(model["month"])}</span></div></div>'
             f'<div class="brand"><img src="{BRAND_URL}" alt="SmplWise"></div></div>']
    for s in model["sections"]:
        d = model["data"].get(s)
        if s == "summary":
            rows = "".join(f'<tr><td class="k">{E(x["title"])}</td><td>{E(x["text"])}</td></tr>' for x in d or [])
            parts.append(f'<section data-section="summary"><h2>{E(L["summary"])}</h2><table class="sum">{rows}</table></section>')
        elif d is not None:
            parts.append(f'<section data-section="{s}"><h2>{E(L[s])}</h2>{section_html(s, d, lang)}</section>')
    direction = "rtl" if lang == "he" else "ltr"
    return (f'<!doctype html><html lang="{lang}" dir="{direction}"><head><meta charset="utf-8"><title>{E(L["title"])}</title><style>{_css(lang)}</style></head>'
            f'<body>{foot}{"".join(parts)}</body></html>')


def plain_lines(model: dict[str, Any]) -> list[tuple[str, float]]:
    """The fallback engine's content: (text, size) lines with the same numbers (no tables)."""
    lang = model["lang"]
    L = LABELS[lang]
    out: list[tuple[str, float]] = [(L["title"], 16), (f'{L["month"]}: {model["month"]}', 10)]
    for s in model["sections"]:
        d = model["data"].get(s)
        if d is None:
            continue
        out.append((L[s], 12))
        if s == "summary":
            out += [(f'{x["title"]}: {x["text"]}', 9.5) for x in d]
        elif s == "tickets":
            out.append((f'{L["opened"]} {d["opened"]} · {L["closed"]} {d["closed"]} · {L["open_end"]} {d["open_end"]} · {L["overdue"]} {d["overdue"]}', 9))
            out += [(f'{x["name"]}: {x["opened"]} / {x["closed"]}', 8.5) for x in d["by_department"]]
        elif s == "energy" and d.get("available"):
            out += [(f'{m["name"]}: {_num(m["kwh"])} {L["kwh"]} · {L["prev"]} {_num(m["prev_kwh"])} · {L["last_year"]} {_num(m["last_year_kwh"])}', 8.5) for m in d["meters"]]
        elif s == "elevators":
            out += [(f'{x["name"]}: {L["fault_min"]} {dur_text(x["fault_min"], lang)} · {L["out_min"]} {dur_text(x["out_min"], lang)}', 8.5) for x in d["items"]]
        elif s == "generator":
            if d.get("runs") is not None:
                out += [(f'{x["name"]}: {L["runs"]} {x["runs"]} · {L["run_hours"]} {_num(x["hours"])}', 8.5) for x in d["runs"]["devices"]]
            out += [(f'{x["name"]}: {L["critical"]} {x["critical"]} · {L["alert"]} {x["alert"]} · {L["info"]} {x["info"]}', 8.5) for x in d["devices"]]
        elif s == "temperature":
            out += [(f'{x["name"]}: {L["alarms"]} {x["alarms"]} · {L["excursion"]} {dur_text(x["out_min"], lang)}', 8.5) for x in d["units"]]
        elif s == "doors" and d["configured"]:
            out += [(f'{x["name"]}: {L["openings"]} {x["openings"]} · {L["unexplained"]} {x["unexplained"]}', 8.5) for x in d["doors"]]
        elif s == "cameras":
            out += [(f'{x["name"] or L["recorder"]}: {x["count"]} · {x["minutes"]} {L["min_u"]}', 8.5) for x in d["top"]]
        elif s == "waste":
            out += [(f'{x["name"]}: {x["minutes"]} {L["min_u"]} · {L[x["kind"]]}', 8.5) for x in d["top"]]
    return out
