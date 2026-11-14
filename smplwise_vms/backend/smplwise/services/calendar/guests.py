"""CALENDARS-298 sections 3.6 and 9 (+ owner answers C4) - guest name and phone of an entry booked on behalf of a customer or class.

Personal data lives only here, sealed with the installation key (connection_store, associated data bound to event, slot and field); never
in cal_events, notifications, audit rows, logs or API lists. Retention is a setting (`guest_retention_days`, 0-3650; 0 = erased when the
entry ends) and the owner can destroy everything at once (`purge_all`). The janitor erases due rows in one transaction per entry."""
from __future__ import annotations

import datetime as dt
import re
import sqlite3
from pathlib import Path
from typing import Any

from .. import connection_store as cs
from . import model

_PHONE = re.compile(r"^\+[1-9]\d{7,14}$")


def normalise_phone(raw: str) -> str:
    digits = re.sub(r"[\s\-().]", "", raw)
    if digits.startswith("00"):
        digits = "+" + digits[2:]
    elif digits.startswith("0") and not digits.startswith("00"):
        digits = "+972" + digits[1:]  # an Israeli local number
    return digits


def validate(items: Any, settings: dict[str, Any], on_behalf_kind: str) -> list[dict[str, str]]:
    if not items:
        return []
    if not settings["guest_details_enabled"]:
        raise model.Invalid("guests: guest details are switched off", "guests", "guests_disabled")
    if on_behalf_kind not in settings["guest_details_kinds"]:
        raise model.Invalid("guests: not allowed for this kind of booking", "guests", "guests_not_allowed")
    if not isinstance(items, list) or len(items) > model.MAX_GUESTS:
        raise model.Invalid(f"guests: at most {model.MAX_GUESTS}", "guests")
    out = []
    for g in items:
        if not isinstance(g, dict) or set(g) - {"name", "phone"}:
            raise model.Invalid("guests: {name, phone}", "guests")
        name = model._text(g.get("name"), "guests.name", 1, 80)
        phone = normalise_phone(model._text(g.get("phone") or "", "guests.phone", 0, 30))
        if phone and not _PHONE.match(phone):
            raise model.Invalid("guests.phone: a valid phone number", "guests.phone")
        out.append({"name": name, "phone": phone})
    return out


def erase_after_for(settings: dict[str, Any], base_end: dt.datetime) -> str:
    return model.iso(base_end + dt.timedelta(days=settings["guest_retention_days"]))


def store(conn: sqlite3.Connection, data_dir: Path, settings: dict[str, Any], event_id: str, items: list[dict[str, str]], *, erase_after: str) -> None:
    for i, g in enumerate(items, start=1):
        conn.execute("INSERT INTO cal_guest_details(event_id, seq, name_sealed, phone_sealed, erase_after) VALUES (?,?,?,?,?)",
                     (event_id, i, cs.seal_calendar_guest(data_dir, event_id, i, "name", g["name"]),
                      cs.seal_calendar_guest(data_dir, event_id, i, "phone", g["phone"]) if g["phone"] else None, erase_after))


def count(conn: sqlite3.Connection, event_id: str) -> int:
    return conn.execute("SELECT COUNT(*) FROM cal_guest_details WHERE event_id = ? AND erased_at IS NULL", (event_id,)).fetchone()[0]


def read(conn: sqlite3.Connection, data_dir: Path, event_id: str) -> dict[str, Any]:
    out, due = [], None
    for r in conn.execute("SELECT * FROM cal_guest_details WHERE event_id = ? AND erased_at IS NULL ORDER BY seq", (event_id,)).fetchall():
        due = r["erase_after"]
        try:
            name = cs.open_calendar_guest(data_dir, event_id, r["seq"], "name", r["name_sealed"])
            phone = cs.open_calendar_guest(data_dir, event_id, r["seq"], "phone", r["phone_sealed"]) if r["phone_sealed"] else ""
        except cs.SecretError:
            name, phone = "", ""
        out.append({"seq": r["seq"], "name": name, "phone": phone})
    return {"guests": out, "erase_after": due}


def erase_event(conn: sqlite3.Connection, event_id: str, now: str) -> int:
    cur = conn.execute("UPDATE cal_guest_details SET name_sealed = NULL, phone_sealed = NULL, erased_at = ? WHERE event_id = ? AND erased_at IS NULL", (now, event_id))
    return cur.rowcount


def purge_all(conn: sqlite3.Connection, now: str) -> int:
    """C4: destroys every guest record now (the sealed columns become NULL). Returns the number of guest records."""
    return conn.execute("UPDATE cal_guest_details SET name_sealed = NULL, phone_sealed = NULL, erased_at = ? WHERE erased_at IS NULL", (now,)).rowcount


def _base_end(ev: sqlite3.Row, settings: dict[str, Any], now: dt.datetime) -> dt.datetime:
    if ev["state"] in ("rejected", "withdrawn", "expired", "cancelled"):
        return model.parse_utc(ev["updated_at"], "u")  # it never happened: the decision time
    if ev["series_until"]:
        return model.parse_utc(ev["series_until"], "s")
    if ev["rrule"]:  # an open series: kept until the horizon, recomputed by the janitor as the horizon rolls
        return now + dt.timedelta(days=settings["series_horizon_days"])
    return model.parse_utc(ev["ends_at"], "e")


def reset_erase_after(conn: sqlite3.Connection, event_id: str, settings: dict[str, Any], now: dt.datetime) -> None:
    ev = conn.execute("SELECT * FROM cal_events WHERE id = ?", (event_id,)).fetchone()
    if ev is not None:
        conn.execute("UPDATE cal_guest_details SET erase_after = ? WHERE event_id = ? AND erased_at IS NULL", (erase_after_for(settings, _base_end(ev, settings, now)), event_id))


def recompute_all(conn: sqlite3.Connection, settings: dict[str, Any], now: dt.datetime) -> None:
    for (eid,) in conn.execute("SELECT DISTINCT event_id FROM cal_guest_details WHERE erased_at IS NULL").fetchall():
        reset_erase_after(conn, eid, settings, now)


def erase_preview(conn: sqlite3.Connection, settings: dict[str, Any], now: dt.datetime) -> int:
    """How many guest records the NEXT janitor run would erase under `settings` (shown before a retention change is saved)."""
    n = 0
    for r in conn.execute("SELECT g.event_id, COUNT(*) AS c FROM cal_guest_details g WHERE g.erased_at IS NULL GROUP BY g.event_id").fetchall():
        ev = conn.execute("SELECT * FROM cal_events WHERE id = ?", (r["event_id"],)).fetchone()
        if ev is not None and model.parse_utc(erase_after_for(settings, _base_end(ev, settings, now)), "x") <= now:
            n += r["c"]
    return n


def janitor_due(conn: sqlite3.Connection, now: dt.datetime) -> int:
    """Erases every record whose `erase_after` has passed; returns the count. One transaction per entry is the caller's loop."""
    total = 0
    for (eid,) in conn.execute("SELECT DISTINCT event_id FROM cal_guest_details WHERE erased_at IS NULL AND erase_after <= ?", (model.iso(now),)).fetchall():
        total += erase_event(conn, eid, model.iso(now))
    return total
