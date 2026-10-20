"""CR-INFRA-TEMPERATURE phase 3 (idea 11): a service ticket opened from a temperature unit or one of its alert rows - in the service module
(CR-038), through its ONE creation path (tickets.create.create_ticket) as the person who asked, never as the system.

* the ticket is a DEVICE ticket of the unit's temperature sensor (origin `device`): the module resolves the place itself and freezes the
  sensor's 24 h history as the creator may read it (device_context) - so the creator must see the sensor, as for the unit itself;
* the description carries the unit, the event, the values and the times (written here in the person's language), and the deep link back to
  the unit (`#/infra/temperature?unit=...`); the chart of the last 24 hours (or of the event) is attached as a picture through the module's
  one picture pipeline (`ticket_attach_chart`, on by default);
* two-way link: `infra_temp_tickets` (unit -> ticket) and the row's `ticket_id`; the alert log gets a `ticket` act row with the number;
* a repeat for the same row / unit while its ticket is open is absorbed by the module's dedupe (`temperature:<unit>:<row|unit>`) instead of a
  second ticket.

Permissions: seeing the unit (devices.read, scoped) AND tickets.create in the department (the module decides; 403 / 422 come from it)."""
from __future__ import annotations

import datetime as dt
import logging
import sqlite3
from pathlib import Path
from typing import Any

from ..db import now_iso
from ..errors import ApiError
from . import temperature as t
from .timeutil import iso_utc

log = logging.getLogger("smplwise.temperature.tickets")

KIND_TEXT = {
    "he": {"high": "טמפרטורה מעל {t}", "low": "טמפרטורה מתחת ל-{t}", "door": "דלת פתוחה יותר מ-{m} דק׳", "offline": "החיישן לא מדווח",
           "predict": "צפויה חריגה מהטווח", "battery": "סוללת החיישן חלשה", "frozen": "החיישן מדווח ערך קפוא", "recovery": "התאוששות איטית אחרי פתיחת דלת",
           "duty": "זמן פעולת המדחס עולה"},
    "en": {"high": "Temperature above {t}", "low": "Temperature below {t}", "door": "Door open longer than {m} min", "offline": "The sensor does not report",
           "predict": "An excursion is predicted", "battery": "Sensor battery low", "frozen": "The sensor reports a frozen value",
           "recovery": "Slow recovery after the door", "duty": "Compressor run time rising"},
}
WORDS = {
    "he": {"title": "{name}: {what}", "unit_title": "{name}: בדיקת יחידת קירור", "unit": "יחידה", "area": "אזור", "event": "אירוע", "since": "מאז",
           "value": "ערך נוכחי", "peak": "קיצון", "band": "טווח יעד", "stats": "24 שעות אחרונות", "min": "מינ׳", "max": "מקס׳", "avg": "ממוצע",
           "out": "מחוץ לטווח", "min_u": "דק׳", "link": "פרטי היחידה במערכת", "chart": "גרף 24 השעות מצורף כתמונה.", "door_opens": "פתיחות דלת"},
    "en": {"title": "{name}: {what}", "unit_title": "{name}: cooling unit check", "unit": "Unit", "area": "Area", "event": "Event", "since": "Since",
           "value": "Current value", "peak": "Peak", "band": "Target band", "stats": "Last 24 hours", "min": "min", "max": "max", "avg": "avg",
           "out": "out of range", "min_u": "min", "link": "The unit in the system", "chart": "The 24-hour chart is attached as a picture.", "door_opens": "door openings"},
}


def _deg(v: Any) -> str:
    return "—" if v is None else f"{float(v):.1f}°"


def _local(iso: str | None, tz: Any) -> str:
    if not iso:
        return ""
    return dt.datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(tz).strftime("%d.%m.%Y %H:%M")


def event_title(ev: dict[str, Any] | None, lang: str) -> str:
    if ev is None:
        return ""
    k = KIND_TEXT[lang].get(ev["kind"], ev["kind"])
    return k.replace("{t}", _deg(ev.get("threshold"))).replace("{m}", str(int(ev.get("threshold") or 0)))


def draft(conn: sqlite3.Connection, u: sqlite3.Row, ev: dict[str, Any] | None, lang: str, now_ts: float, *, door_visible: bool) -> dict[str, str]:
    """The prefilled title and description (the dialog shows them editable; the server uses them when none are sent)."""
    lang = lang if lang in WORDS else "he"
    w = WORDS[lang]
    tz = t.site_zone(conn)
    rules = t.effective(t.load_defaults(conn), t.overrides_of(u["rules_json"]))
    ents = t.entity_rows(conn, [u["temp_entity_id"]])
    reading = t.reading_of(ents.get(u["temp_entity_id"]), connected=t.mirror_connected())
    low, high = t.band_of(u, reading, rules)
    area = conn.execute("SELECT name FROM ha_areas WHERE area_id = ?", (u["area_id"] or "",)).fetchone()
    st = t.stats(conn, u, rules, int(now_ts - 86400), int(now_ts), now_ts)
    title = w["title"].replace("{name}", u["name"]).replace("{what}", event_title(ev, lang)) if ev else w["unit_title"].replace("{name}", u["name"])
    lines = [f"{w['unit']}: {u['name']}" + (f" · {w['area']}: {area['name']}" if area else "")]
    if ev is not None:
        lines.append(f"{w['event']}: {event_title(ev, lang)} · {w['since']} {_local(ev['started_at'], tz)}")
        if ev.get("peak") is not None and ev["kind"] in ("high", "low"):
            lines.append(f"{w['peak']}: {_deg(ev['peak'])}")
    lines.append(f"{w['value']}: {_deg(reading['value'])} · {w['band']}: {_deg(low)}–{_deg(high)}")
    lines.append(f"{w['stats']}: {w['min']} {_deg(st['min'])} · {w['max']} {_deg(st['max'])} · {w['avg']} {_deg(st['avg'])} · "
                 f"{w['out']} {st['out_min']} {w['min_u']}" + (f" · {w['door_opens']} {st['door_opens']}" if door_visible and u["door_entity_id"] else ""))
    lines.append(f"{w['link']}: #/infra/temperature?unit={u['id']}")
    return {"title": title[:200], "description": "\n".join(lines)}


def chart_png(conn: sqlite3.Connection, u: sqlite3.Row, ev: dict[str, Any] | None, now_ts: float, *, door_visible: bool) -> bytes:
    from . import temperature_chart_png as png

    tz = t.site_zone(conn)
    lo, hi = int(now_ts - 86400), int(now_ts)
    s = t.series(conn, u["id"], lo, hi, now_ts, max_points=480)
    wins = t.unit_windows(u, t.learned_of(conn, [u["id"]]))
    mark = None
    if ev is not None:
        a = dt.datetime.fromisoformat(ev["started_at"].replace("Z", "+00:00")).timestamp()
        b = dt.datetime.fromisoformat(ev["ended_at"].replace("Z", "+00:00")).timestamp() if ev.get("ended_at") else None
        mark = (a, b)
    return png.render([[p[0], p[1], p[5]] for p in s["points"]], float(u["low"]), float(u["high"]), lo, hi, tz,
                      doors=t.door_intervals(conn, u["id"], lo, hi, now_ts) if door_visible else [],
                      defrost=[[int(a), int(b)] for a, b in t.window_intervals(wins, lo, hi, tz)], mark=mark)


def open_ticket(conn: sqlite3.Connection, principal: Any, u: sqlite3.Row, ev: dict[str, Any] | None, body: dict[str, Any], data_dir: Path | None,
                now_ts: float, *, door_visible: bool, rid: str | None = None) -> dict[str, Any]:
    from ..db import unlocked
    from .tickets import access, attachments, create, service

    if not access.module_on(conn):
        raise ApiError(409, "tickets_unavailable", t.MESSAGES["tickets_unavailable"]["he"], details={"message_en": t.MESSAGES["tickets_unavailable"]["en"]})
    viewer = access.Viewer(conn, principal)
    lang = body.get("lang") if body.get("lang") in WORDS else "he"
    pre = draft(conn, u, ev, lang, now_ts, door_visible=door_visible)
    spec = create.TicketSpec(department_id=str(body.get("department_id") or ""), title=(body.get("title") or pre["title"]).strip()[:200],
                             description=body.get("description") if body.get("description") is not None else pre["description"],
                             priority_key=body.get("priority_key") or None, entity_id=u["temp_entity_id"], origin="device",
                             dedupe_key=f"temperature:{u['id']}:{ev['id'] if ev else 'unit'}")
    res = create.create_ticket(conn, spec, viewer, rid=rid)
    attached = False
    want_chart = body.get("attach_chart")
    if want_chart is None:
        want_chart = bool(t.load_defaults(conn).get("ticket_attach_chart", True))
    if res.kind == "created" and want_chart and data_dir is not None:
        seen = access.visible_by_id(viewer, res.ticket_id)
        try:
            if seen is not None:
                vis = service.check_attach(conn, viewer, seen, False, rid)
                data = chart_png(conn, u, ev, now_ts, door_visible=door_visible)
                with unlocked(conn):
                    stored = attachments.store(data_dir, res.ticket_id, data)
                seen = access.visible_by_id(viewer, res.ticket_id)
                if seen is not None:
                    service.record_attachment(conn, viewer, seen, stored, vis, rid)
                    attached = True
                else:
                    attachments.remove(data_dir, stored.rel_path)
        except (ApiError, attachments.Refused, ImportError, OSError, ValueError):
            log.warning("the chart picture could not be attached to the ticket", exc_info=True)  # the ticket itself stands
    if res.kind == "created":
        conn.execute("INSERT OR IGNORE INTO infra_temp_tickets(ticket_id, unit_id, event_id, number, created_by, created_at) VALUES (?,?,?,?,?,?)",
                     (res.ticket_id, u["id"], ev["id"] if ev else None, res.number, principal.user_id, now_iso()))
    if ev is not None:
        conn.execute("UPDATE infra_temp_events SET ticket_id = ? WHERE id = ? AND ticket_id IS NULL", (res.ticket_id, ev["id"]))
    from . import temperature_runtime as rt

    rt.log_act(conn, u["id"], "ticket", iso_utc(dt.datetime.fromtimestamp(now_ts, dt.timezone.utc).replace(microsecond=0)), principal.user_id,
               {"number": res.number, "ticket_id": res.ticket_id, "event": ev["id"] if ev else None, "absorbed": res.kind == "absorbed"})
    return {"ticket_id": res.ticket_id, "number": res.number, "result": res.kind, "chart_attached": attached}


def linked(conn: sqlite3.Connection, principal: Any, unit_id: str, limit: int = 3) -> list[dict[str, Any]]:
    """The unit's tickets the caller may see (the module's own rule decides; a hidden one is simply not listed)."""
    try:
        rows = conn.execute("SELECT * FROM infra_temp_tickets WHERE unit_id = ? ORDER BY created_at DESC LIMIT 20", (unit_id,)).fetchall()
    except sqlite3.Error:
        return []
    if not rows:
        return []
    from .tickets import access

    if not access.module_on(conn):
        return []
    viewer = access.Viewer(conn, principal)
    out = []
    for r in rows:
        seen = access.visible_by_id(viewer, r["ticket_id"])
        if seen is None:
            continue
        out.append({"ticket_id": r["ticket_id"], "number": r["number"], "event_id": r["event_id"], "status": seen.row.get("status"), "created_at": r["created_at"]})
        if len(out) >= limit:
            break
    return out
