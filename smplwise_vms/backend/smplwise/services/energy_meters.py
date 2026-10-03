"""CR-023 P1: the electricity meter registry (main DB `energy_meters`, `energy_meter_epochs`) and the meter validation
(CR-023 section 5: kWh versus kW).

A meter is an entity of the system infrastructure that reports a cumulative energy counter. Validation reads the state
mirror (`ha_entities`, kept by services/ha_sync.py) - it never calls the infrastructure. Accepted units: kWh, Wh, MWh
(converted to Wh by `unit_factor`); power units (W, kW...) and instantaneous sensors are refused with the operator
messages of the CR. The same check runs on the server when a meter is saved, so a client cannot register a non-energy
sensor by crafting a request. Messages never name the platform (copy rule)."""
from __future__ import annotations

import datetime as dt
import json
import re
import sqlite3
from dataclasses import dataclass
from typing import Any

from ..db import new_id, now_iso
from ..errors import ApiError, conflict, not_found

UNITS = {"kwh": ("kWh", 1000), "wh": ("Wh", 1), "mwh": ("MWh", 1_000_000)}
POWER_UNITS = {"w", "kw", "mw", "gw", "mw", "va", "kva"}
REJECTED_CLASSES = {"power", "apparent_power", "reactive_power", "current", "voltage", "energy_storage", "gas", "water", "monetary"}
RETURNED_RE = re.compile(r"(returned|export|injected|feed_?in|to_grid)", re.I)
NOT_NUMERIC_STATES = {None, "", "unavailable", "unknown", "none"}

MSG = {
    "domain_rejected": "אפשר לבחור רק חיישן שמודד צריכת חשמל מצטברת.",
    "power_unit": "החיישן מודד הספק רגעי (קילוואט), לא צריכה מצטברת. לחשבון חשמל צריך מונה שמציג קוט״ש.",
    "unit_rejected": "יחידת המידה היא {unit}. אפשר לבחור רק מונה שמודד קוט״ש, וואט־שעה או מגוואט־שעה.",
    "unit_missing": "לחיישן אין יחידת מידה. אפשר לבחור רק מונה שמודד קוט״ש, וואט־שעה או מגוואט־שעה.",
    "device_class_rejected": "החיישן אינו מונה צריכת חשמל. בחרו מונה שמציג קוט״ש.",
    "measurement": "החיישן מציג ערך רגעי ולא מונה מצטבר. בחרו מונה צריכה.",
    "state_not_numeric": "החיישן אינו מציג מספר. בחרו מונה שמציג קוט״ש.",
    "state_negative": "המונה מציג ערך שלילי. בחרו מונה צריכה.",
    "returned_energy": "מונה של אנרגיה מוחזרת לרשת. לא נתמך בחשבון צריכה.",
    "warn_total": "המונה מתאפס כל יום. מתאים, אבל מונה מצטבר עדיף.",
    "warn_no_device_class": "סוג החיישן לא מוגדר; היחידה מתאימה.",
    "warn_unavailable": "המונה לא מדווח כרגע. אפשר לשמור; הוא יוצג כלא מדווח עד שיחזור.",
    "warn_same_device": "כבר נבחר מונה מאותו מכשיר. ודאו שהצריכה לא תיספר פעמיים.",
    "ok": "",
}


@dataclass(frozen=True)
class Verdict:
    verdict: str          # ok | warning | rejected
    code: str
    message: str
    unit: str | None      # canonical unit when accepted
    unit_factor: int | None


def _attrs(row: Any) -> dict[str, Any]:
    try:
        a = json.loads(row["attributes_json"] or "{}")
    except (ValueError, TypeError, KeyError, IndexError):
        return {}
    return a if isinstance(a, dict) else {}


def judge(row: Any, *, same_device_meter: bool = False) -> Verdict:
    """The validation verdict of one mirror row (CR-023 section 5)."""
    domain = (row["domain"] or "").lower()
    unit_raw = (row["unit"] or "").strip()
    unit = unit_raw.lower()
    dclass = (row["device_class"] or "").lower() or None
    attrs = _attrs(row)
    sclass = str(attrs.get("state_class") or "").lower() or None

    def rej(code: str) -> Verdict:
        return Verdict("rejected", code, MSG[code].format(unit=unit_raw or "-"), None, None)

    if domain != "sensor":
        return rej("domain_rejected")
    if unit in POWER_UNITS or dclass in {"power", "apparent_power"}:
        return rej("power_unit")
    if RETURNED_RE.search(row["entity_id"] or "") or RETURNED_RE.search(str(row["name"] or "")):
        return rej("returned_energy")
    if not unit:
        return rej("unit_missing")
    if unit not in UNITS:
        return rej("unit_rejected")
    if dclass in REJECTED_CLASSES:
        return rej("device_class_rejected")
    if sclass == "measurement":
        return rej("measurement")
    canon, factor = UNITS[unit]
    state = row["state"]
    warn: str | None = None
    if state is None or str(state).strip().lower() in NOT_NUMERIC_STATES:
        warn = "warn_unavailable"
    else:
        try:
            v = float(state)
        except (TypeError, ValueError):
            return rej("state_not_numeric")
        if v != v or v in (float("inf"), float("-inf")):
            return rej("state_not_numeric")
        if v < 0:
            return rej("state_negative")
    if warn is None and sclass == "total":
        warn = "warn_total"
    if warn is None and dclass is None:
        warn = "warn_no_device_class"
    if warn is None and same_device_meter:
        warn = "warn_same_device"
    if warn:
        return Verdict("warning", warn, MSG[warn], canon, factor)
    return Verdict("ok", "ok", "", canon, factor)


def numeric_wh(state: Any, factor: int) -> int | None:
    """The counter value in Wh, or None when the state is not a usable number (unavailable, text, negative, NaN)."""
    if state is None:
        return None
    text = str(state).strip()
    if text.lower() in NOT_NUMERIC_STATES:
        return None
    try:
        v = float(text)
    except ValueError:
        return None
    if v != v or v < 0 or v in (float("inf"),):
        return None
    return int(round(v * factor))


# ---------------------------------------------------------------- candidates

def candidates(conn: sqlite3.Connection, q: str | None, area_id: str | None, include_rejected: bool, limit: int) -> list[dict[str, Any]]:
    """Mirror sensors that could be meters, with their verdict. Searched by name (and entity id); energy-like sensors
    first. Names and the verdict only - never raw attributes."""
    where = ["e.removed_at IS NULL", "e.disabled = 0", "e.domain = 'sensor'"]
    args: list[Any] = []
    if q:
        where.append("(e.name LIKE ? OR e.original_name LIKE ? OR e.entity_id LIKE ?)")
        like = f"%{q.strip()}%"
        args += [like, like, like]
    if area_id:
        where.append("e.area_id = ?")
        args.append(area_id)
    rows = conn.execute(
        f"""SELECT e.entity_id, e.name, e.original_name, e.domain, e.device_class, e.unit, e.state, e.attributes_json, e.area_id, e.area_name, e.device_id
            FROM ha_entities e WHERE {' AND '.join(where)}
            ORDER BY CASE WHEN lower(COALESCE(e.unit, '')) IN ('kwh', 'wh', 'mwh') THEN 0 WHEN e.device_class = 'energy' THEN 1 ELSE 2 END, e.name, e.entity_id
            LIMIT ?""",
        (*args, max(limit * 4, limit)),
    ).fetchall()
    live = {r["source_ref"]: r["id"] for r in conn.execute("SELECT id, source_ref FROM energy_meters WHERE status <> 'retired'").fetchall()}
    devices = _live_devices(conn)
    out: list[dict[str, Any]] = []
    for r in rows:
        v = judge(r, same_device_meter=bool(r["device_id"]) and r["device_id"] in devices and r["entity_id"] not in live)
        if v.verdict == "rejected" and not include_rejected:
            continue
        attrs = _attrs(r)
        out.append({
            "ref": r["entity_id"], "name": r["name"] or r["original_name"] or r["entity_id"], "area_id": r["area_id"], "area_name": r["area_name"],
            "unit": r["unit"], "device_class": r["device_class"], "state_class": attrs.get("state_class"), "state": r["state"],
            "verdict": v.verdict, "code": v.code, "message": v.message, "already_meter_id": live.get(r["entity_id"]),
        })
        if len(out) >= limit:
            break
    return out


def _live_devices(conn: sqlite3.Connection) -> set[str]:
    return {r[0] for r in conn.execute(
        "SELECT e.device_id FROM energy_meters m JOIN ha_entities e ON e.entity_id = m.source_ref WHERE m.status <> 'retired' AND e.device_id IS NOT NULL").fetchall()}


# ---------------------------------------------------------------- registry

COLUMNS = "m.id, m.source_kind, m.source_ref, m.display_name, m.unit, m.unit_factor, m.area_id, m.status, m.status_reason, m.max_kw, m.revision, m.created_at, m.created_by, m.updated_at, m.retired_at"
AREA_SQL = f"""SELECT {COLUMNS}, COALESCE(a.name, e.area_name) AS area_name, COALESCE(m.area_id, e.area_id) AS eff_area_id
               FROM energy_meters m LEFT JOIN ha_entities e ON e.entity_id = m.source_ref
               LEFT JOIN ha_areas a ON a.area_id = COALESCE(m.area_id, e.area_id)"""


def get(conn: sqlite3.Connection, meter_id: str) -> sqlite3.Row | None:
    return conn.execute(f"{AREA_SQL} WHERE m.id = ?", (meter_id,)).fetchone()


def list_rows(conn: sqlite3.Connection, include_retired: bool = False) -> list[sqlite3.Row]:
    where = "" if include_retired else " WHERE m.status <> 'retired'"
    return conn.execute(f"{AREA_SQL}{where} ORDER BY m.display_name, m.id").fetchall()


def require(conn: sqlite3.Connection, meter_id: str) -> sqlite3.Row:
    row = get(conn, meter_id)
    if row is None:
        raise not_found("המונה לא נמצא.")
    return row


def _mirror(conn: sqlite3.Connection, ref: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM ha_entities WHERE entity_id = ? AND removed_at IS NULL", (ref,)).fetchone()


def _check_source(conn: sqlite3.Connection, ref: str, *, ignore_meter: str | None = None) -> Verdict:
    row = _mirror(conn, ref)
    if row is None:
        raise ApiError(422, "meter_unit_rejected", "החיישן לא נמצא בתשתית המערכת.", details={"code": "source_missing"})
    dup = conn.execute("SELECT id FROM energy_meters WHERE source_ref = ? AND status <> 'retired' AND id IS NOT ?", (ref, ignore_meter)).fetchone()
    if dup:
        raise conflict("meter_duplicate", "החיישן כבר רשום כמונה.", meter_id=dup["id"])
    v = judge(row)
    if v.verdict == "rejected":
        raise ApiError(422, "meter_unit_rejected", v.message, details={"code": v.code})
    return v


def create(conn: sqlite3.Connection, *, source_ref: str, display_name: str | None, area_id: str | None, max_kw: float | None, actor: str | None) -> tuple[str, Verdict]:
    v = _check_source(conn, source_ref)
    row = _mirror(conn, source_ref)
    name = (display_name or "").strip() or (row["name"] if row is not None else "") or source_ref
    mid, now = new_id(), now_iso()
    conn.execute(
        """INSERT INTO energy_meters(id, source_kind, source_ref, display_name, unit, unit_factor, area_id, status, max_kw, revision, created_at, created_by, updated_at)
           VALUES (?, 'ha_entity', ?, ?, ?, ?, ?, 'active', ?, 1, ?, ?, ?)""",
        (mid, source_ref, name[:120], v.unit, v.unit_factor, area_id, float(max_kw) if max_kw else 100.0, now, actor, now),
    )
    conn.execute("INSERT INTO energy_meter_epochs(id, meter_id, started_at, reason, source_ref, created_by, created_at) VALUES (?, ?, ?, 'first', ?, ?, ?)",
                 (new_id(), mid, now, source_ref, actor, now))
    return mid, v


def _check_revision(row: sqlite3.Row, revision: int) -> None:
    if row["revision"] != revision:
        raise conflict("revision_conflict", "המונה השתנה בינתיים. רעננו ונסו שוב.", current_revision=row["revision"])


def update(conn: sqlite3.Connection, meter_id: str, revision: int, fields: dict[str, Any]) -> list[str]:
    row = require(conn, meter_id)
    _check_revision(row, revision)
    if row["status"] == "retired":
        raise conflict("meter_retired", "המונה הוצא משימוש.")
    sets: list[str] = []
    args: list[Any] = []
    changed: list[str] = []
    if "display_name" in fields and fields["display_name"] is not None:
        name = str(fields["display_name"]).strip()
        if not name:
            raise ApiError(422, "validation", "שם המונה חסר.", details={"fields": ["display_name"]})
        sets.append("display_name = ?"); args.append(name[:120]); changed.append("display_name")
    if "area_id" in fields:
        sets.append("area_id = ?"); args.append(fields["area_id"] or None); changed.append("area_id")
    if "max_kw" in fields and fields["max_kw"] is not None:
        sets.append("max_kw = ?"); args.append(float(fields["max_kw"])); changed.append("max_kw")
    if "status" in fields and fields["status"] is not None and fields["status"] != row["status"]:
        status = fields["status"]
        if status == "active":
            row_m = _mirror(conn, row["source_ref"])
            if row_m is not None and (row_m["unit"] or "").strip().lower() != row["unit"].lower():
                raise ApiError(422, "meter_unit_rejected", "יחידת המדידה של המונה השתנתה. אי אפשר להפעיל אותו מחדש; החליפו מונה.", details={"code": "unit_changed"})
        sets.append("status = ?"); args.append(status)
        sets.append("status_reason = ?"); args.append("manual" if status == "paused" else None)
        changed.append("status")
    if not sets:
        return []
    sets.append("revision = revision + 1"); sets.append("updated_at = ?"); args.append(now_iso())
    conn.execute(f"UPDATE energy_meters SET {', '.join(sets)} WHERE id = ?", (*args, meter_id))
    return changed


def accounts_using(conn: sqlite3.Connection, meter_id: str) -> list[dict[str, Any]]:
    """Active accounts of the billing branch whose formula uses the meter (contract section 2.3); [] before that table exists."""
    tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('energy_account_meters', 'energy_accounts')").fetchall()}
    if "energy_account_meters" not in tables:
        return []
    if "energy_accounts" in tables:
        cols = {r[1] for r in conn.execute("PRAGMA table_info(energy_accounts)").fetchall()}
        cond = []
        if "deleted_at" in cols:
            cond.append("a.deleted_at IS NULL")
        if "status" in cols:
            cond.append("COALESCE(a.status, '') <> 'closed'")
        where = (" AND " + " AND ".join(cond)) if cond else ""
        rows = conn.execute(f"SELECT DISTINCT a.id, a.name FROM energy_account_meters am JOIN energy_accounts a ON a.id = am.account_id WHERE am.meter_id = ?{where} ORDER BY a.name", (meter_id,)).fetchall()
        return [{"account_id": r[0], "name": r[1]} for r in rows]
    rows = conn.execute("SELECT DISTINCT account_id FROM energy_account_meters WHERE meter_id = ?", (meter_id,)).fetchall()
    return [{"account_id": r[0], "name": None} for r in rows]


def retire(conn: sqlite3.Connection, meter_id: str, revision: int) -> None:
    row = require(conn, meter_id)
    _check_revision(row, revision)
    if row["status"] == "retired":
        raise conflict("meter_retired", "המונה כבר הוצא משימוש.")
    used = accounts_using(conn, meter_id)
    if used:
        raise conflict("meter_in_use", "המונה משמש בחשבונות פעילים. הסירו אותו מהנוסחה קודם.", accounts=used)
    now = now_iso()
    conn.execute("UPDATE energy_meters SET status = 'retired', status_reason = NULL, retired_at = ?, updated_at = ?, revision = revision + 1 WHERE id = ?", (now, now, meter_id))
    conn.execute("UPDATE energy_meter_epochs SET ended_at = ? WHERE meter_id = ? AND ended_at IS NULL", (now, meter_id))


def current_epoch(conn: sqlite3.Connection, meter_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM energy_meter_epochs WHERE meter_id = ? AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1", (meter_id,)).fetchone()


def epochs(conn: sqlite3.Connection, meter_id: str) -> list[sqlite3.Row]:
    return conn.execute("SELECT * FROM energy_meter_epochs WHERE meter_id = ? ORDER BY started_at, created_at", (meter_id,)).fetchall()


def replace(conn: sqlite3.Connection, meter_id: str, revision: int, *, at: str, final_wh: int | None, start_wh: int | None,
            new_ref: str | None, note: str | None, actor: str | None) -> tuple[str, str]:
    """Close the current epoch and open a new one in the main DB (the store side is energy_store.start_epoch). Returns
    (new epoch id, reason)."""
    row = require(conn, meter_id)
    _check_revision(row, revision)
    if row["status"] == "retired":
        raise conflict("meter_retired", "המונה הוצא משימוש.")
    reason = "replaced"
    unit, factor = row["unit"], row["unit_factor"]
    ref = row["source_ref"]
    if new_ref and new_ref != row["source_ref"]:
        v = _check_source(conn, new_ref, ignore_meter=meter_id)
        reason, ref, unit, factor = "source_changed", new_ref, v.unit, v.unit_factor
    last = current_epoch(conn, meter_id)
    if last is not None and last["started_at"] >= at:
        raise ApiError(422, "validation", "מועד ההחלפה חייב להיות אחרי תחילת המונה הנוכחי.", details={"fields": ["at"]})
    conn.execute("UPDATE energy_meter_epochs SET ended_at = ?, end_reading_wh = ? WHERE meter_id = ? AND ended_at IS NULL", (at, final_wh, meter_id))
    eid = new_id()
    conn.execute("""INSERT INTO energy_meter_epochs(id, meter_id, started_at, start_reading_wh, reason, source_ref, note, created_by, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""", (eid, meter_id, at, start_wh, reason, ref, (note or None) and note[:500], actor, now_iso()))
    status, sreason = row["status"], row["status_reason"]
    if status == "paused" and sreason == "unit_changed":
        status, sreason = "active", None  # a new device with a valid unit resumes the meter
    conn.execute("UPDATE energy_meters SET source_ref = ?, unit = ?, unit_factor = ?, status = ?, status_reason = ?, revision = revision + 1, updated_at = ? WHERE id = ?",
                 (ref, unit, factor, status, sreason, now_iso(), meter_id))
    return eid, reason


def pause_for_unit_change(conn: sqlite3.Connection, meter_id: str) -> None:
    conn.execute("UPDATE energy_meters SET status = 'paused', status_reason = 'unit_changed', revision = revision + 1, updated_at = ? WHERE id = ? AND status = 'active'",
                 (now_iso(), meter_id))


def iso_to_epoch(text: str) -> int:
    from .timeutil import parse_utc

    return int(parse_utc(text).timestamp())


def epoch_to_iso(ts: int | None) -> str | None:
    if ts is None:
        return None
    return dt.datetime.fromtimestamp(ts, dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
