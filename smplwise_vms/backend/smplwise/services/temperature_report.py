"""CR-INFRA-TEMPERATURE 2.9.1 phase 2: the temperature report - one model, three outputs.

* `build()` - the report MODEL of one or more units over a range: per unit the band, the friendly sensor names (never an entity id), the
  statistics (out-of-range time excludes defrost per the unit's setting - owner decision 3), the door openings, the alerts of the range and
  the chart series (reading, climate setpoint, door and defrost intervals). Pure data, JSON-safe; the PDF and the WhatsApp text are both
  derived from it, so they always say the same numbers.
* `html_of()` - the printable HTML (he RTL / en LTR, bundled fonts only, inline SVG charts, one page per unit) rendered to PDF by
  services/temperature_pdf.py in the isolated render child of the bill PDF.
* `text_summary()` - the WhatsApp text summary (owner 2026-10-19, option A: text only; the PDF stays in the system).

Signature: the owner wants a signature LINE only now (decision 4); the model keeps `signature = {"mode": "line"}` so a future electronic
signature is a new mode, not a new report. The footer carries the UTC instant, the zone and a SHA-256 digest of the model (the content the
PDF was made from; a hash of the PDF itself cannot be printed inside it)."""
from __future__ import annotations

import datetime as dt
import hashlib
import html
import json
import sqlite3
from typing import Any
from zoneinfo import ZoneInfo

from . import temperature as t
from .timeutil import iso_utc

MAX_UNITS = 30
MAX_EVENTS = 60
CHART_POINTS = 360
E = html.escape

LABELS: dict[str, dict[str, str]] = {
    "he": {"title": "דוח טמפרטורה", "range": "טווח", "band": "טווח יעד", "sensor": "חיישן טמפרטורה", "door": "חיישן דלת", "none": "ללא",
           "min": "מינימום", "max": "מקסימום", "avg": "ממוצע", "out": "מחוץ לטווח", "out_raw": "כולל הפשרה", "doors": "פתיחות דלת", "alerts": "התראות",
           "chart": "גרף טמפרטורה", "events": "רשימת התראות ואירועים", "time": "זמן", "event": "אירוע", "value": "ערך", "dur": "משך",
           "sign": "חתימת מנהל", "date": "תאריך", "generated": "הופק", "digest": "תמצית התוכן", "zone": "אזור זמן", "min_u": "דק׳",
           "no_data": "אין נתונים בטווח", "no_events": "אין אירועים בטווח", "setpoint": "נקודת יעד", "excl": "זמן הפשרה לא נספר", "more": "ועוד {n}",
           "high": "טמפרטורה מעל {t}", "low": "טמפרטורה מתחת ל-{t}", "door_ev": "דלת פתוחה יותר מ-{m} דק׳", "offline": "החיישן לא דיווח",
           "defrost": "מחזור הפשרה", "ack": "התראה אושרה", "mute": "השתקה", "sev_alarm": "אזעקה", "sev_warning": "אזהרה", "sev_info": "מידע",
           "open": "פתוח", "site": "SmplWise Arx",
           "haccp": "דוח תאימות (HACCP)", "daily": "טבלה יומית", "day": "תאריך", "coverage": "כיסוי נתונים", "verdict": "תוצאה",
           "v_ok": "תקין", "v_exc": "חריגה", "v_none": "אין נתונים", "maint": "חלון תחזוקה: {r}", "by": "על ידי {n}", "days_ok": "ימים תקינים",
           "sign_name": "שם המנהל", "predict": "חריגה צפויה", "battery": "סוללת חיישן חלשה", "frozen": "ערך קפוא בחיישן",
           "recovery": "התאוששות איטית אחרי דלת", "duty": "זמן פעולת מדחס עולה"},
    "en": {"title": "Temperature report", "range": "Range", "band": "Target band", "sensor": "Temperature sensor", "door": "Door sensor", "none": "None",
           "min": "Minimum", "max": "Maximum", "avg": "Average", "out": "Out of range", "out_raw": "incl. defrost", "doors": "Door openings", "alerts": "Alerts",
           "chart": "Temperature chart", "events": "Alerts and events", "time": "Time", "event": "Event", "value": "Value", "dur": "Duration",
           "sign": "Manager signature", "date": "Date", "generated": "Generated", "digest": "Content digest", "zone": "Time zone", "min_u": "min",
           "no_data": "No data in the range", "no_events": "No events in the range", "setpoint": "Setpoint", "excl": "defrost time not counted", "more": "and {n} more",
           "high": "Temperature above {t}", "low": "Temperature below {t}", "door_ev": "Door open longer than {m} min", "offline": "The sensor did not report",
           "defrost": "Defrost cycle", "ack": "Alert acknowledged", "mute": "Muted", "sev_alarm": "Alarm", "sev_warning": "Warning", "sev_info": "Info",
           "open": "open", "site": "SmplWise Arx",
           "haccp": "Compliance report (HACCP)", "daily": "Daily table", "day": "Date", "coverage": "Data coverage", "verdict": "Result",
           "v_ok": "OK", "v_exc": "Excursion", "v_none": "No data", "maint": "Maintenance window: {r}", "by": "by {n}", "days_ok": "Days in range",
           "sign_name": "Manager name", "predict": "Predicted excursion", "battery": "Sensor battery low", "frozen": "Frozen sensor value",
           "recovery": "Slow recovery after the door", "duty": "Compressor run time rising"},
}
LAYOUTS: tuple[str, ...] = ("standard", "haccp")


def deg(v: float | None) -> str:
    return "—" if v is None else f"{v:.1f}°".replace("-", "−")


def _local(ts: float, tz: ZoneInfo) -> dt.datetime:
    return dt.datetime.fromtimestamp(ts, dt.timezone.utc).astimezone(tz)


def _downsample(points: list[list[Any]], n: int) -> list[list[Any]]:
    if len(points) <= n:
        return points
    step = len(points) / n
    return [points[int(i * step)] for i in range(n)]


def daily(conn: sqlite3.Connection, u: sqlite3.Row, rules: dict[str, Any], lo: int, hi: int, tz: ZoneInfo, now_ts: float, door_visible: bool) -> list[dict[str, Any]]:
    """Phase 3 (idea 3, the HACCP compliance report): one row per LOCAL day of lo..hi - min / max / average, minutes out of the band (defrost
    excluded per the unit's setting), alarms, door openings and the data coverage (the share of the day with a live reading)."""
    out: list[dict[str, Any]] = []
    day = _local(lo, tz).date()
    last = _local(hi - 1, tz).date()
    while day <= last:
        a = max(lo, int(t.local_instant(day, 0, tz)))
        b = min(hi, int(t.local_instant(day + dt.timedelta(days=1), 0, tz)))
        if b > a:
            st = t.stats(conn, u, rules, a, b, now_ts)
            per = 1 if st["source"] == "raw" else 5
            cov = min(100.0, round(100 * st["samples"] * per / max(1, (b - a) / 60), 1))
            out.append({"day": day.isoformat(), "min": st["min"], "max": st["max"], "avg": st["avg"], "out_min": st["out_min"], "out_min_raw": st["out_min_raw"],
                        "alarms": st["alarms"], "door_opens": st["door_opens"] if door_visible else None, "coverage": cov,
                        "verdict": "none" if not st["samples"] else ("ok" if st["out_min"] == 0 and st["alarms"] == 0 else "exc")})
        day += dt.timedelta(days=1)
    return out


def build(conn: sqlite3.Connection, units: list[sqlite3.Row], door_visible: set[str], lo: int, hi: int, lang: str, now_ts: float, *,
          chart: bool = True, events: bool = True, signature: bool = True, layout: str = "standard") -> dict[str, Any]:
    """The report model. `units` are already filtered to what the caller may see; `door_visible` = the unit ids whose door sensor he sees.
    `layout` haccp (phase 3, idea 3) adds the daily table per unit (and the PDF leads with it)."""
    lang = lang if lang in LABELS else "he"
    layout = layout if layout in LAYOUTS else "standard"
    tz = t.site_zone(conn)
    defaults = t.load_defaults(conn)
    learned = t.learned_of(conn, [u["id"] for u in units])
    ents = t.entity_rows(conn, [x for u in units for x in (u["temp_entity_id"], u["door_entity_id"])])
    areas = {r["area_id"]: r["name"] for r in conn.execute("SELECT area_id, name FROM ha_areas").fetchall()}
    a_iso, b_iso = iso_utc(dt.datetime.fromtimestamp(lo, dt.timezone.utc)), iso_utc(dt.datetime.fromtimestamp(hi, dt.timezone.utc))
    out_units = []
    for u in units[:MAX_UNITS]:
        rules = t.effective(defaults, t.overrides_of(u["rules_json"]))
        st = t.stats(conn, u, rules, lo, hi, now_ts)
        dv = u["id"] in door_visible and bool(u["door_entity_id"])
        if not dv:
            st.update(door_opens=0, door_total_min=0, door_longest_min=0)
        item: dict[str, Any] = {
            "id": u["id"], "name": u["name"], "area": areas.get(u["area_id"] or ""), "low": u["low"], "high": u["high"], "band_mode": u["band_mode"],
            "tolerance": rules.get("setpoint_tolerance"), "source": "climate" if str(u["temp_entity_id"]).startswith("climate.") else "sensor",
            "sensor": t.friendly(ents.get(u["temp_entity_id"]), u["name"]), "door": t.friendly(ents.get(u["door_entity_id"] or ""), u["name"]) if dv else None,
            "excl_defrost": bool(rules.get("exclude_defrost_stats", True)), "stats": {k: st[k] for k in ("min", "max", "avg", "out_min", "out_min_raw", "door_opens",
                                                                                                      "door_total_min", "door_longest_min", "alarms", "warnings")},
        }
        if chart:
            s = t.series(conn, u["id"], lo, hi, now_ts, max_points=CHART_POINTS)
            item["points"] = [[p[0], p[1], p[5]] for p in _downsample(s["points"], CHART_POINTS)]
            item["doors"] = t.door_intervals(conn, u["id"], lo, hi, now_ts) if dv else []
            item["defrost"] = [[int(a), int(b)] for a, b in t.window_intervals(t.unit_windows(u, learned), lo, hi, tz)]
        if events:
            # phase 3: maintenance windows (with the reason and who - never an anonymous silence) and the health rows join the list
            rows = conn.execute("""SELECT e.kind, e.severity, e.started_at, e.ended_at, e.value, e.peak, e.threshold, e.detail_json,
                                          COALESCE(us.display_name, us.username) AS by_name FROM infra_temp_events e LEFT JOIN users us ON us.id = e.ack_by
                                   WHERE e.unit_id = ? AND e.started_at <= ? AND (e.ended_at IS NULL OR e.ended_at >= ?)
                                   AND e.kind IN ('high','low','door','offline','defrost','maint','predict','battery','frozen','recovery','duty')
                                   ORDER BY e.started_at DESC""", (u["id"], b_iso, a_iso)).fetchall()
            rows = [r for r in rows if r["kind"] != "door" or dv]
            evs = []
            for r in rows[:MAX_EVENTS]:
                d = dict(r)
                try:
                    det = json.loads(d.pop("detail_json") or "{}")
                except ValueError:
                    det = {}
                d["reason"] = str(det.get("reason") or "")[:120] if d["kind"] == "maint" else None
                if d["kind"] != "maint":
                    d.pop("by_name", None)
                evs.append(d)
            item["events"] = evs
            item["events_more"] = max(0, len(rows) - MAX_EVENTS)
        if layout == "haccp":
            item["daily"] = daily(conn, u, rules, lo, hi, tz, now_ts, dv)
        out_units.append(item)
    model: dict[str, Any] = {"v": 1, "lang": lang, "from": lo, "to": hi, "zone": str(tz), "generated": int(now_ts), "units": out_units,
                             "chart": chart, "events": events, "signature": {"mode": "line"} if signature else None, "layout": layout}
    model["digest"] = digest(model)
    return model


def digest(model: dict[str, Any]) -> str:
    body = {k: v for k, v in model.items() if k != "digest"}
    return hashlib.sha256(json.dumps(body, sort_keys=True, ensure_ascii=False, default=str).encode("utf-8")).hexdigest()


def range_text(model: dict[str, Any]) -> str:
    tz = ZoneInfo(model["zone"])
    a, b = _local(model["from"], tz), _local(model["to"], tz)
    return f"{a:%d.%m.%Y %H:%M} – {b:%d.%m.%Y %H:%M}"


def dur_text(minutes: float, lang: str) -> str:
    m = int(round(minutes))
    if lang == "en":
        return f"{m} min" if m < 60 else f"{m // 60} h {m % 60} min" if m % 60 else f"{m // 60} h"
    return f"{m} דק׳" if m < 60 else f"{m // 60} שע׳ {m % 60} דק׳" if m % 60 else f"{m // 60} שע׳"


def event_text(e: dict[str, Any], lang: str) -> str:
    L = LABELS[lang]
    k = e["kind"]
    if k == "high":
        return L["high"].replace("{t}", deg(e["threshold"]))
    if k == "low":
        return L["low"].replace("{t}", deg(e["threshold"]))
    if k == "door":
        return L["door_ev"].replace("{m}", str(int(e["threshold"] or 0)))
    if k == "maint":
        txt = L["maint"].replace("{r}", e.get("reason") or "")
        return f'{txt} · {L["by"].replace("{n}", e["by_name"])}' if e.get("by_name") else txt
    return L.get(k, k)


# ---------------------------------------------------------------- the chart (inline SVG, LTR geometry in both languages)

def chart_svg(u: dict[str, Any], lo: int, hi: int, tz: ZoneInfo) -> str:
    W, H, ml, mr, mt, mb = 700, 210, 40, 10, 10, 24
    pts = [p for p in u.get("points") or [] if p[1] is not None]
    vals = [p[1] for p in pts] + [p[2] for p in pts if p[2] is not None]
    pad = max(1.0, (u["high"] - u["low"]) * 0.25)
    vmin = int(min([u["low"] - pad, *vals]) // 1)
    vmax = int(-(-max([u["high"] + pad, *vals]) // 1))
    span = max(1, hi - lo)

    def X(ts: float) -> float:
        return ml + (ts - lo) / span * (W - ml - mr)

    def Y(v: float) -> float:
        return mt + (vmax - v) / max(1e-9, vmax - vmin) * (H - mt - mb)

    parts = [f'<svg class="chart" viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" direction="ltr">']
    step = max(1, round((vmax - vmin) / 5))
    v = vmin - vmin % step
    while v <= vmax:
        if v >= vmin:
            parts.append(f'<line x1="{ml}" x2="{W - mr}" y1="{Y(v):.1f}" y2="{Y(v):.1f}" stroke="#e3e8f0" stroke-width="0.6"/>'
                         f'<text x="{ml - 5}" y="{Y(v) + 3:.1f}" font-size="9" fill="#5b6a85" text-anchor="end">{v}°</text>')
        v += step
    parts.append(f'<rect x="{ml}" y="{Y(u["high"]):.1f}" width="{W - ml - mr}" height="{Y(u["low"]) - Y(u["high"]):.1f}" fill="#16a34a" fill-opacity="0.12"/>')
    for a, b in u.get("doors") or []:
        parts.append(f'<rect x="{X(a):.1f}" y="{mt}" width="{max(1.5, X(b) - X(a)):.1f}" height="{H - mt - mb}" fill="#7c3aed" fill-opacity="0.18"/>')
    for a, b in u.get("defrost") or []:
        parts.append(f'<rect x="{X(a):.1f}" y="{mt}" width="{max(1.0, X(b) - X(a)):.1f}" height="{H - mt - mb}" fill="#2563eb" fill-opacity="0.10"/>')
    for edge in (u["high"], u["low"]):
        parts.append(f'<line x1="{ml}" x2="{W - mr}" y1="{Y(edge):.1f}" y2="{Y(edge):.1f}" stroke="#16a34a" stroke-dasharray="4 3" stroke-width="0.8"/>')
    gap = max(900, (hi - lo) / CHART_POINTS * 3)
    d, sp, prev, prev_sp = "", "", None, None
    for ts, val, spv in pts:
        d += f'{"L" if prev is not None and ts - prev <= gap else "M"}{X(ts):.1f} {Y(val):.1f}'
        prev = ts
        if spv is not None:
            sp += f'H{X(ts):.1f}V{Y(spv):.1f}' if prev_sp is not None and ts - prev_sp <= gap else f'M{X(ts):.1f} {Y(spv):.1f}'
            prev_sp = ts
        else:
            prev_sp = None
    if sp:
        parts.append(f'<path d="{sp}" fill="none" stroke="#5b6a85" stroke-width="1" stroke-dasharray="5 3"/>')
    if d:
        parts.append(f'<path d="{d}" fill="none" stroke="#2563eb" stroke-width="1.4"/>')
        parts.append(f'<clipPath id="o{u["id"][:8]}"><rect x="0" y="0" width="{W}" height="{Y(u["high"]):.1f}"/><rect x="0" y="{Y(u["low"]):.1f}" width="{W}" height="{H}"/></clipPath>')
        parts.append(f'<path d="{d}" fill="none" stroke="#dc2626" stroke-width="1.8" clip-path="url(#o{u["id"][:8]})"/>')
    days = span > 1.5 * 86400
    n_ticks = 6
    for i in range(n_ticks + 1):
        ts = lo + span * i / n_ticks
        lab = _local(ts, tz).strftime("%d.%m" if days else "%H:%M")
        parts.append(f'<text x="{X(ts):.1f}" y="{H - 7}" font-size="9" fill="#5b6a85" text-anchor="middle">{lab}</text>')
    parts.append("</svg>")
    return "".join(parts)


# ---------------------------------------------------------------- the HTML (WeasyPrint)

def _css(lang: str) -> str:
    from .bill_pdf_html import ASSET_SCHEME

    fonts = "".join(f'@font-face {{ font-family: {fam}; src: url("{ASSET_SCHEME}{f}-{w}.ttf"); font-weight: {w}; }}\n'
                    for fam, f in (("HeeboHe", "Heebo-he"), ("HeeboLa", "Heebo-la"), ("NotoCy", "NotoSans-cy"), ("NotoAr", "NotoSansArabic-ar")) for w in (400, 700))
    side = "left" if lang == "he" else "right"
    return fonts + f"""
@page {{ size: A4; margin: 12mm 14mm 18mm;
  @bottom-center {{ content: counter(page) " / " counter(pages); font: 8pt HeeboLa; color: #5b6a85; }}
  @bottom-{side} {{ content: element(foot); }} }}
body {{ font-family: HeeboHe, HeeboLa, NotoCy, NotoAr; font-size: 9.5pt; color: #1d2433; }}
.unit {{ page-break-after: always; }} .unit:last-child {{ page-break-after: auto; }}
.hd {{ display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 1.5pt solid #1d2433; padding-bottom: 4pt; margin-bottom: 8pt; }}
.hd h1 {{ margin: 0; font-size: 15pt; }} .hd .brand {{ font-weight: 700; font-size: 11pt; }}
.sub {{ color: #5b6a85; font-size: 8.5pt; }}
.stats {{ display: flex; gap: 5pt; margin: 6pt 0 10pt; }}
.stats div {{ flex: 1; border: 0.6pt solid #d5dbe6; border-radius: 4pt; padding: 4pt 6pt; }}
.stats span {{ display: block; color: #5b6a85; font-size: 7.5pt; }} .stats b {{ font-size: 12pt; direction: ltr; unicode-bidi: isolate; }}
.stats small {{ display: block; color: #8a94a8; font-size: 6.5pt; }}
h2 {{ font-size: 10.5pt; margin: 10pt 0 4pt; }}
.chart {{ width: 100%; height: auto; }}
.legend {{ font-size: 7.5pt; color: #5b6a85; }}
table {{ width: 100%; border-collapse: collapse; font-size: 8.5pt; }}
th, td {{ border-bottom: 0.5pt solid #e3e8f0; padding: 3pt 4pt; text-align: start; }} th {{ color: #5b6a85; font-weight: 700; }}
.n {{ direction: ltr; unicode-bidi: isolate; white-space: nowrap; }}
table.daily td, table.daily th {{ padding: 2pt 4pt; font-size: 8pt; }} table.daily tr.exc td {{ color: #b91c1c; }} table.daily tr.none td {{ color: #8a94a8; }}
.sig {{ display: flex; gap: 24pt; margin-top: 22pt; }} .sig div {{ flex: 1; border-top: 0.8pt solid #1d2433; padding-top: 3pt; font-size: 8.5pt; }}
.foot {{ position: running(foot); font-size: 6.5pt; color: #8a94a8; }}
"""


def html_of(model: dict[str, Any]) -> str:
    lang = model["lang"]
    L = LABELS[lang]
    tz = ZoneInfo(model["zone"])
    gen = _local(model["generated"], tz)
    gen_utc = dt.datetime.fromtimestamp(model["generated"], dt.timezone.utc)
    foot = (f'<div class="foot">{E(L["site"])} · {E(L["generated"])} {gen:%d.%m.%Y %H:%M} ({E(model["zone"])}) · '
            f'<span class="n">{gen_utc:%Y-%m-%dT%H:%M:%SZ}</span> · {E(L["digest"])} <span class="n">sha256 {model["digest"][:16]}</span></div>')
    rng = range_text(model)
    pages = []
    for u in model["units"]:
        s = u["stats"]
        band = (f'{E(L["setpoint"])} ±{u["tolerance"]}°' if u["band_mode"] == "setpoint" else f'<span class="n">{deg(u["low"])}–{deg(u["high"])}</span>')
        out_extra = f'<small>{E(L["excl"])} · {E(L["out_raw"])} {E(dur_text(s["out_min_raw"], lang))}</small>' if u["excl_defrost"] and s["out_min_raw"] != s["out_min"] else ""
        stats = "".join(f'<div><span>{E(L[k])}</span><b>{v}</b>{x}</div>' for k, v, x in (
            ("min", deg(s["min"]), ""), ("max", deg(s["max"]), ""), ("avg", deg(s["avg"]), ""), ("out", E(dur_text(s["out_min"], lang)), out_extra),
            ("doors", f'{s["door_opens"]} · {E(dur_text(s["door_total_min"], lang))}' if u["door"] else "—", ""), ("alerts", str(s["alarms"] + s["warnings"]), "")))
        haccp = model.get("layout") == "haccp"
        body = [f'<div class="hd"><div><h1>{E(L["haccp"] if haccp else L["title"])} · {E(u["name"])}</h1><div class="sub">{E(u["area"] or "")} · {E(L["sensor"])}: {E(u["sensor"] or "—")}'
                f' · {E(L["door"])}: {E(u["door"] or L["none"])} · {E(L["band"])}: {band}</div><div class="sub">{E(L["range"])}: <span class="n">{E(rng)}</span></div></div>'
                f'<div class="brand">SmplWise</div></div>', f'<div class="stats">{stats}</div>']
        if haccp and u.get("daily") is not None:
            ok_days = sum(1 for d in u["daily"] if d["verdict"] == "ok")
            drows = "".join(
                f'<tr class="{d["verdict"]}"><td class="n">{dt.date.fromisoformat(d["day"]):%d.%m.%Y}</td><td class="n">{deg(d["min"])}</td><td class="n">{deg(d["max"])}</td>'
                f'<td class="n">{deg(d["avg"])}</td><td>{E(dur_text(d["out_min"], lang)) if d["out_min"] else "0"}</td><td class="n">{d["alarms"]}</td>'
                f'<td class="n">{"—" if d["door_opens"] is None else d["door_opens"]}</td><td class="n">{d["coverage"]:.0f}%</td><td>{E(L["v_" + d["verdict"]])}</td></tr>'
                for d in u["daily"])
            body.append(f'<h2>{E(L["daily"])} · {E(L["days_ok"])}: <span class="n">{ok_days}/{len(u["daily"])}</span></h2>'
                        f'<table class="daily"><thead><tr><th>{E(L["day"])}</th><th>{E(L["min"])}</th><th>{E(L["max"])}</th><th>{E(L["avg"])}</th><th>{E(L["out"])}</th>'
                        f'<th>{E(L["alerts"])}</th><th>{E(L["doors"])}</th><th>{E(L["coverage"])}</th><th>{E(L["verdict"])}</th></tr></thead><tbody>{drows}</tbody></table>')
        if model["chart"]:
            body.append(f'<h2>{E(L["chart"])}</h2>' + (chart_svg(u, model["from"], model["to"], tz) if u.get("points") else f'<p class="sub">{E(L["no_data"])}</p>'))
        if model["events"]:
            body.append(f'<h2>{E(L["events"])}</h2>')
            evs = u.get("events") or []
            if evs:
                rows = []
                for e in evs:
                    st = dt.datetime.fromisoformat(e["started_at"].replace("Z", "+00:00"))
                    en = dt.datetime.fromisoformat(e["ended_at"].replace("Z", "+00:00")) if e["ended_at"] else None
                    dur = E(dur_text((en - st).total_seconds() / 60, lang)) if en else E(L["open"])
                    val = deg(e["peak"] if e["ended_at"] else e["value"]) if e["kind"] in ("high", "low", "defrost", "offline") else "—"
                    rows.append(f'<tr><td class="n">{st.astimezone(tz):%d.%m %H:%M}</td><td>{E(event_text(e, lang))}</td><td>{E(L["sev_" + e["severity"]])}</td>'
                                f'<td class="n">{val}</td><td>{dur}</td></tr>')
                more = f'<p class="sub">{E(L["more"].replace("{n}", str(u["events_more"])))}</p>' if u.get("events_more") else ""
                body.append(f'<table><thead><tr><th>{E(L["time"])}</th><th>{E(L["event"])}</th><th></th><th>{E(L["value"])}</th><th>{E(L["dur"])}</th></tr></thead>'
                            f'<tbody>{"".join(rows)}</tbody></table>{more}')
            else:
                body.append(f'<p class="sub">{E(L["no_events"])}</p>')
        if model.get("signature") and model["signature"].get("mode") == "line":
            body.append(f'<div class="sig">{"<div>" + E(L["sign_name"]) + "</div>" if haccp else ""}<div>{E(L["sign"])}</div><div>{E(L["date"])}</div></div>')
        pages.append(f'<section class="unit">{"".join(body)}</section>')
    direction = "rtl" if lang == "he" else "ltr"
    return (f'<!doctype html><html lang="{lang}" dir="{direction}"><head><meta charset="utf-8"><style>{_css(lang)}</style></head><body>'
            f'{foot}{"".join(pages)}</body></html>')


def filename(model: dict[str, Any]) -> str:
    tz = ZoneInfo(model["zone"])
    kind = "haccp" if model.get("layout") == "haccp" else "report"
    return f"temperature-{kind}-{_local(model['to'], tz):%Y%m%d}.pdf"


# ---------------------------------------------------------------- the WhatsApp text (option A: text only)

TEXT = {
    "he": {"head": "Arx · דוח טמפרטורות", "line": "{name}: מינ׳ {min} · מקס׳ {max} · ממוצע {avg} · מחוץ לטווח {out} · התראות {alerts}",
           "pdf": "הדוח המלא (PDF) זמין במערכת.", "footer": "הודעה אוטומטית - אין להשיב.", "more": "ועוד {n} יחידות."},
    "en": {"head": "Arx · Temperature report", "line": "{name}: min {min} · max {max} · avg {avg} · out of range {out} · alerts {alerts}",
           "pdf": "The full report (PDF) is available in the system.", "footer": "Automatic message - do not reply.", "more": "and {n} more units."},
}
TEXT_MAX = 700


def text_summary(model: dict[str, Any], *, external: bool = False) -> str:
    """The WhatsApp message: the range, one line per unit with the key numbers, the PDF note and the footer, capped at TEXT_MAX. Unit names
    pass through the WhatsApp channel's own hygiene (one line, no markup, no link-looking token). `external` (TEMPVENDOR-295, a vendor):
    no "available in the system" note - the vendor has no access to the system; the document link line, when there is one, is added by the queue."""
    from .notify_whatsapp import clean

    lang = model["lang"] if model["lang"] in TEXT else "he"
    T = TEXT[lang]
    lines = [T["head"], "⁦" + range_text(model) + "⁩"]  # the range isolated left-to-right inside a right-to-left message
    tail = [T["footer"]] if external else [T["pdf"], T["footer"]]
    used = len("\n".join(lines + tail)) + 1
    shown = 0
    for u in model["units"]:
        s = u["stats"]
        line = (T["line"].replace("{name}", clean(u["name"], 40)).replace("{min}", deg(s["min"])).replace("{max}", deg(s["max"])).replace("{avg}", deg(s["avg"]))
                .replace("{out}", dur_text(s["out_min"], lang)).replace("{alerts}", str(s["alarms"] + s["warnings"])))
        more = T["more"].replace("{n}", str(len(model["units"]) - shown))
        if used + len(line) + 1 + len(more) + 1 > TEXT_MAX:
            lines.append(more)
            break
        lines.append(line)
        used += len(line) + 1
        shown += 1
    return "\n".join(lines + tail)[:TEXT_MAX]
