"""CR-INFRA-TEMPERATURE 2.9.1 - temperature control under Infrastructure (`/api/v1/infra/temperature...`). Read-only against the infrastructure:
nothing is ever sent to a device.

Permissions (docs/changes/CR-INFRA-TEMPERATURE.md section 4):
* reading the units, their history and the alert log needs `devices.read` and follows the device screens' scope rule (services/
  temperature_access.py): a unit is visible through its temperature sensor; its door part only through the door sensor. A unit the caller may
  not see answers the same 404 as one that does not exist. Operator answers carry friendly names, never entity ids (owner decision 7).
* acknowledging an alert and muting a unit's WARNINGS needs `infra.temperature.ack` (operator and above);
* defining, editing, ordering, deleting units, the installation defaults and the learned defrost windows need `infra.temperature.manage`
  (site_admin, system_admin; installation scope) - only these routes return entity ids;
* the alert routing (recipients, channels) needs `system.configure` to change (like the elevators).
Audit rows carry ids only."""
from __future__ import annotations

import csv
import datetime as dt
import io
import json
import sqlite3
import time
from typing import Any, Literal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..db import new_id, now_iso
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, require
from ..services import temperature as t
from ..services import temperature_access as ta
from ..services import temperature_defrost as learner
from ..services import temperature_runtime as rt
from ..services.timeutil import iso_utc

router = APIRouter()
MANAGE, ACK, CONFIGURE = "infra.temperature.manage", "infra.temperature.ack", "system.configure"
API = "/infra/temperature"


def now_ts() -> float:
    """The clock of the routes (tests replace it)."""
    return time.time()


def _err(status: int, code: str, **details: Any) -> ApiError:
    m = t.MESSAGES[code]
    return ApiError(status, code, m["he"], details={**details, "message_en": m["en"]})


def _invalid(e: t.Invalid) -> ApiError:
    return _err(422, e.code, fields=e.fields)


class _Body(BaseModel):
    model_config = ConfigDict(extra="forbid")


class FixedWindowIn(_Body):
    start: str = Field(min_length=1, max_length=8)
    minutes: int


class RecipientsIn(_Body):
    roles: list[str] = Field(default_factory=list, max_length=10)
    users: list[str] = Field(default_factory=list, max_length=100)
    groups: list[str] = Field(default_factory=list, max_length=20)


class UnitIn(_Body):
    name: str = Field(min_length=1, max_length=60)
    area_id: str | None = Field(default=None, max_length=128)
    kind: str = "fridge"
    temp_entity_id: str = Field(min_length=3, max_length=255)
    door_entity_id: str | None = Field(default=None, max_length=255)
    door_invert: bool = False
    low: float
    high: float
    band_mode: Literal["fixed", "setpoint"] = "fixed"
    rules: dict[str, Any] = Field(default_factory=dict)
    recipients: RecipientsIn | None = None
    defrost_mode: Literal["fixed", "learn", "none"] = "learn"
    defrost_windows: list[FixedWindowIn] = Field(default_factory=list, max_length=t.MAX_FIXED_WINDOWS)
    enabled: bool = True
    revision: int | None = None


class OrderIn(_Body):
    ids: list[str] = Field(max_length=500)


class SettingsIn(_Body):
    rules: dict[str, Any]
    row_version: int | None = None


class MuteIn(_Body):
    minutes: int | None = Field(default=None, ge=5, le=720)
    until_defrost_end: bool = False


class AckIn(_Body):
    event_id: str | None = Field(default=None, max_length=64)


class AlertKindIn(_Body):
    enabled: bool | None = None
    recipients: RecipientsIn | None = None
    channels: list[str] | None = Field(default=None, max_length=5)


class AlertsIn(_Body):
    kinds: dict[str, AlertKindIn] | None = None
    row_version: int | None = None


def _manage_ro(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Principal:
    require(conn, principal, MANAGE, INSTALLATION)
    return principal


def _manage_w(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Principal:
    require(conn, principal, MANAGE, INSTALLATION)
    return principal


def _ack_w(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Principal:
    require(conn, principal, ACK, INSTALLATION)
    return principal


# ---------------------------------------------------------------- shaping

def _iso(ts: float) -> str:
    return iso_utc(dt.datetime.fromtimestamp(ts, dt.timezone.utc))


def _user_names(conn: sqlite3.Connection, ids: set[str]) -> dict[str, str]:
    ids = {i for i in ids if i}
    if not ids:
        return {}
    rows = conn.execute(f"SELECT id, username, display_name FROM users WHERE id IN ({','.join('?' * len(ids))})", list(ids)).fetchall()
    return {r["id"]: (r["display_name"] or r["username"] or "") for r in rows}


def _event_out(r: sqlite3.Row | dict[str, Any], names: dict[str, str], rules: dict[str, Any] | None = None) -> dict[str, Any]:
    d = dict(r)
    try:
        detail = json.loads(d.get("detail_json") or "{}") if "detail_json" in d else d.get("detail") or {}
    except ValueError:
        detail = {}
    out = {k: d.get(k) for k in ("id", "unit_id", "kind", "severity", "started_at", "warned_at", "alarmed_at", "ended_at", "value", "peak", "threshold", "suppressed", "ack_at")}
    out["ack_by_name"] = names.get(d.get("ack_by") or "", None) if d.get("ack_by") else None
    out["notified"] = bool(d.get("notification_id"))
    out["detail"] = {k: v for k, v in detail.items() if k in ("minutes", "until", "hard_max", "window", "closed", "events")}
    if rules is not None and d.get("severity") == "warning" and d.get("kind") in ("high", "low") and not d.get("ended_at"):
        z = rules["high_alarm_min" if d["kind"] == "high" else "low_alarm_min"]
        on = rules["high_alarm" if d["kind"] == "high" else "low_alarm"]
        st = rt._ts(d["started_at"])
        out["alarm_at"] = _iso(st + int(z) * 60) if on and st is not None else None
    return out


def _status(open_evs: dict[str, dict[str, Any]], value: float | None, connected: bool, off: bool = False) -> str:
    if not connected:
        return "unknown"
    if any(e["severity"] == "alarm" for e in open_evs.values()):
        return "alarm"
    if "offline" in open_evs or value is None:
        return "offline"
    if off:
        return "off"  # a climate unit switched off: a state, not an alarm (owner 2026-10-19)
    if any(e["kind"] in ("high", "low") for e in open_evs.values()):
        return "warning"
    return "ok"


class _Ctx:
    def __init__(self, conn: sqlite3.Connection, ts: float) -> None:
        self.conn, self.ts = conn, ts
        self.tz = t.site_zone(conn)
        self.defaults = t.load_defaults(conn)
        self.learned = t.learned_of(conn)
        self.connected = t.mirror_connected()
        self.areas = {r["area_id"]: r["name"] for r in conn.execute("SELECT area_id, name FROM ha_areas").fetchall()}


def _unit_out(ctx: _Ctx, u: sqlite3.Row, door_visible: bool, ents: dict[str, sqlite3.Row], *, spark: bool, manage: bool) -> dict[str, Any]:
    conn, ts = ctx.conn, ctx.ts
    rules = t.effective(ctx.defaults, t.overrides_of(u["rules_json"]))
    te = ents.get(u["temp_entity_id"])
    reading = t.reading_of(te, connected=ctx.connected)
    value = reading["value"]
    low, high = t.band_of(u, reading, rules)
    if not ctx.connected:
        last = conn.execute("SELECT v FROM infra_temp_samples WHERE unit_id = ? ORDER BY ts DESC LIMIT 1", (u["id"],)).fetchone()
        value_last = last[0] if last else None
    else:
        value_last = None
    open_evs = rt.open_events(conn, u["id"])
    if not door_visible:
        open_evs.pop("door", None)
    names = _user_names(conn, {e.get("ack_by") or "" for e in open_evs.values()})
    door: dict[str, Any] | None = None
    if u["door_entity_id"] and door_visible:
        de = ents.get(u["door_entity_id"])
        st = t.door_of(de["state"], invert=bool(u["door_invert"]), available=de["available"], removed=de["removed_at"], disabled=de["disabled"], connected=ctx.connected) if de is not None else None
        since = de["last_changed"] if de is not None and st is not None else None
        door = {"open": st, "since": since, "sensor_name": t.friendly(de)}
    wins = t.unit_windows(u, ctx.learned)
    minute = t.local_min(ts, ctx.tz)
    nxt = t.next_window_start(wins, ts, ctx.tz)
    dstate = learner.state_of(conn, u["id"]) if u["defrost_mode"] == "learn" else None
    lo = int(ts - 86400)
    st24 = t.stats(conn, u, rules, lo, int(ts), ts)
    out: dict[str, Any] = {
        "id": u["id"], "name": u["name"], "kind": u["kind"], "area_id": u["area_id"], "area_name": ctx.areas.get(u["area_id"] or ""),
        "low": low, "high": high, "hard_max": round(high + float(rules["defrost_hard_margin"]), 2), "band_mode": u["band_mode"],
        "source": reading["source"],
        "hvac": {k: reading[k] for k in ("setpoint", "setpoint_low", "setpoint_high", "hvac_mode", "hvac_action")} if reading["source"] == "climate" else None,
        "status": _status(open_evs, value, ctx.connected, t.is_off(reading, rules)), "value": value, "value_last": value_last,
        "updated_at": (te["last_updated"] or te["last_changed"]) if te is not None else None, "trend": t.trend_of(conn, u["id"], ts) if ctx.connected else None,
        "temp_sensor_name": t.friendly(te), "door": door,
        "events": [_event_out(e, names, rules) for e in sorted(open_evs.values(), key=lambda e: e["started_at"], reverse=True)],
        "defrost": {"mode": u["defrost_mode"], "in_window": t.in_defrost(wins, minute), "next_at": _iso(nxt) if nxt else None,
                    "state": (dstate or {}).get("state", "learning") if u["defrost_mode"] == "learn" else u["defrost_mode"],
                    "days": (dstate or {}).get("days", 0) if dstate else 0,
                    "windows": ([{"start_min": t.hhmm_min(w["start"]), "minutes": w["minutes"], "status": "fixed"} for w in t.fixed_of(u)] if u["defrost_mode"] == "fixed"
                                else [{"start_min": w["start_min"], "minutes": w["minutes"], "status": w["status"], "repeats": w["repeats"]} for w in ctx.learned.get(u["id"], [])] if u["defrost_mode"] == "learn" else [])},
        "muted_until": u["muted_until"] if u["muted_until"] and u["muted_until"] > _iso(ts) else None,
        "rules": {k: rules[k] for k in ("warn_on_excursion", "high_alarm", "high_alarm_min", "low_alarm", "low_alarm_min", "door_alarm", "door_alarm_min", "offline_warn",
                                         "offline_min", "quiet_enabled", "quiet_from", "quiet_to", "exclude_defrost_stats", "setpoint_tolerance", "alert_when_off", "learn_min_repeats", "learn_days")},
        "stats_24h": {k: st24[k] for k in ("min", "max", "avg", "out_min", "out_min_raw", "door_opens", "door_total_min", "door_longest_min", "alarms", "warnings")},
        "stale": not ctx.connected,
    }
    if spark:
        s = t.series(conn, u["id"], lo, int(ts), ts, max_points=288)
        out["spark"] = [[p[0], p[1], p[5]] if reading["source"] == "climate" else [p[0], p[1]] for p in s["points"]]
        out["doors_24h"] = t.door_intervals(conn, u["id"], lo, int(ts), ts) if door_visible else []
        out["defrost_24h"] = [[int(a), int(b)] for a, b in t.window_intervals(wins, lo, ts, ctx.tz)]
    if manage:
        out.update({"temp_entity_id": u["temp_entity_id"], "door_entity_id": u["door_entity_id"]})
    return out


def _visible(conn: sqlite3.Connection, principal: Principal) -> list[tuple[sqlite3.Row, bool]]:
    return ta.Scope(conn, principal).filter(t.units(conn, enabled_only=True))


# ---------------------------------------------------------------- operator routes

@router.get(API)
def list_units(spark: int = Query(1, ge=0, le=1), principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """Every enabled unit the caller may see with its live status, open alerts, 24-hour statistics and (spark=1) the 24-hour line. Empty = no units."""
    ctx = _Ctx(conn, now_ts())
    vis = _visible(conn, principal)
    ents = t.entity_rows(conn, [x for u, _d in vis for x in (u["temp_entity_id"], u["door_entity_id"])])
    manage = authorize(conn, principal, MANAGE, INSTALLATION).allowed
    items = [_unit_out(ctx, u, d, ents, spark=bool(spark), manage=manage) for u, d in vis]
    return {"units": items, "summary": t.summary([i["status"] for i in items]), "stale": not ctx.connected, "at": _iso(ctx.ts),
            "can_manage": manage, "can_ack": authorize(conn, principal, ACK, INSTALLATION).allowed}


def _one_visible(conn: sqlite3.Connection, principal: Principal, unit_id: str) -> tuple[sqlite3.Row, bool]:
    got = next(((u, d) for u, d in _visible(conn, principal) if u["id"] == unit_id), None)
    if got is None:
        raise _err(404, "unit_not_found")
    return got


# ---------------------------------------------------------------- the alert log (registered before /{unit_id})

def _log_query(conn: sqlite3.Connection, principal: Principal, unit: str | None, kind: str | None, severity: str | None, rng: str, start: str | None, end: str | None,
               limit: int, offset: int) -> tuple[list[dict[str, Any]], int, dict[str, sqlite3.Row]]:
    vis = {u["id"]: u for u, _d in _visible(conn, principal)}
    door_vis = {u["id"] for u, d in _visible(conn, principal) if d}
    try:
        lo, hi = t.parse_range(rng, start, end, now_ts())
    except ValueError as e:
        raise ApiError(422, "validation", "טווח לא תקין.", details={"fields": [str(e)], "message_en": "Invalid range."}) from None
    ids = [unit] if unit else list(vis)
    ids = [i for i in ids if i in vis]
    if not ids:
        return [], 0, vis
    where = [f"unit_id IN ({','.join('?' * len(ids))})", "started_at <= ?", "(ended_at IS NULL OR ended_at >= ?)"]
    args: list[Any] = [*ids, _iso(hi), _iso(lo)]
    if kind:
        kinds = ("high", "low") if kind == "temp" else ("ack", "mute") if kind == "act" else (kind,)
        where.append(f"kind IN ({','.join('?' * len(kinds))})")
        args += list(kinds)
    if severity:
        where.append("severity = ?")
        args.append(severity)
    sql = " AND ".join(where)
    rows = [r for r in conn.execute(f"SELECT * FROM infra_temp_events WHERE {sql} ORDER BY started_at DESC, id", args).fetchall()
            if r["kind"] != "door" or r["unit_id"] in door_vis]
    total = len(rows)
    page = rows[offset:offset + limit]
    names = _user_names(conn, {r["ack_by"] or "" for r in page})
    return [_event_out(r, names) for r in page], total, vis


@router.get(f"{API}/events")
def events(unit: str | None = Query(None, max_length=64), kind: str | None = Query(None, pattern="^(temp|high|low|door|offline|defrost|ack|mute|act)$"),
           severity: str | None = Query(None, pattern="^(info|warning|alarm)$"), range: str = Query("24h", pattern="^(24h|7d|30d|custom)$"),  # noqa: A002
           start: str | None = Query(None, alias="from", max_length=40), end: str | None = Query(None, alias="to", max_length=40),
           limit: int = Query(200, ge=1, le=1000), offset: int = Query(0, ge=0),
           principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The alert log: every opening and closing of an alert, long door openings, defrost cycles, sensor outages, acknowledges and mutes."""
    rows, total, vis = _log_query(conn, principal, unit, kind, severity, range, start, end, limit, offset)
    for r in rows:
        u = vis.get(r["unit_id"])
        r["unit_name"] = u["name"] if u else ""
    return {"events": rows, "total": total}


KIND_HE = {"high": "טמפרטורה מעל הטווח", "low": "טמפרטורה מתחת לטווח", "door": "דלת פתוחה", "offline": "חיישן לא מדווח", "defrost": "הפשרה", "ack": "אישור התראה", "mute": "השתקה"}
KIND_EN = {"high": "Above range", "low": "Below range", "door": "Door open", "offline": "Sensor not reporting", "defrost": "Defrost", "ack": "Acknowledged", "mute": "Muted"}
SEV_HE = {"info": "מידע", "warning": "אזהרה", "alarm": "אזעקה"}


@router.get(f"{API}/events.csv")
def events_csv(unit: str | None = Query(None, max_length=64), kind: str | None = Query(None, pattern="^(temp|high|low|door|offline|defrost|ack|mute|act)$"),
               severity: str | None = Query(None, pattern="^(info|warning|alarm)$"), range: str = Query("24h", pattern="^(24h|7d|30d|custom)$"),  # noqa: A002
               start: str | None = Query(None, alias="from", max_length=40), end: str | None = Query(None, alias="to", max_length=40),
               lang: str = Query("he", pattern="^(he|en)$"),
               principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Response:
    """The same log as CSV (UTF-8 with BOM for spreadsheet programs; local times of the installation zone plus the UTC instant)."""
    rows, _total, vis = _log_query(conn, principal, unit, kind, severity, range, start, end, 100000, 0)
    tz = t.site_zone(conn)
    buf = io.StringIO()
    w = csv.writer(buf)
    he = lang == "he"
    w.writerow(["זמן מקומי", "UTC", "יחידה", "אירוע", "חומרה", "ערך", "סף", "קיצון", "משך (דק׳)", "סטטוס", "אושר על ידי"] if he else
               ["Local time", "UTC", "Unit", "Event", "Severity", "Value", "Threshold", "Peak", "Duration (min)", "Status", "Acknowledged by"])
    now = now_ts()

    def loc(iso: str | None) -> str:
        if not iso:
            return ""
        return dt.datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(tz).strftime("%Y-%m-%d %H:%M")

    for r in rows:
        st = rt._ts(r["started_at"]) or now
        en = rt._ts(r["ended_at"]) if r["ended_at"] else now
        dur = "" if r["kind"] in ("ack", "mute") else str(round((en - st) / 60))
        u = vis.get(r["unit_id"])
        safe = lambda s: ("'" + s) if isinstance(s, str) and s[:1] in ("=", "+", "-", "@") else s  # noqa: E731 - no formula injection
        w.writerow([loc(r["started_at"]), r["started_at"], safe(u["name"] if u else ""), (KIND_HE if he else KIND_EN).get(r["kind"], r["kind"]),
                    SEV_HE.get(r["severity"], r["severity"]) if he else r["severity"], "" if r["value"] is None else f"{r['value']:.1f}",
                    "" if r["threshold"] is None else f"{r['threshold']:.1f}", "" if r["peak"] is None else f"{r['peak']:.1f}", dur,
                    ("פתוח" if he else "open") if not r["ended_at"] else ("נסגר" if he else "closed"), safe(r["ack_by_name"] or "")])
    stamp = dt.datetime.fromtimestamp(now, tz).strftime("%Y%m%d-%H%M")
    return Response(content="﻿" + buf.getvalue(), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="temperature-log-{stamp}.csv"'})


# ---------------------------------------------------------------- manage (registered before /{unit_id})

@router.get(f"{API}/manage")
def manage_list(principal: Principal = Depends(_manage_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    rows = t.units(conn)
    ents = t.entity_rows(conn, [x for r in rows for x in (r["temp_entity_id"], r["door_entity_id"])])
    items = []
    for r in rows:
        te, de = ents.get(r["temp_entity_id"]), ents.get(r["door_entity_id"] or "")
        items.append({"id": r["id"], "name": r["name"], "kind": r["kind"], "area_id": r["area_id"], "enabled": bool(r["enabled"]), "sort_order": r["sort_order"],
                      "revision": r["revision"], "temp_entity_id": r["temp_entity_id"], "temp_sensor_name": t.friendly(te), "temp_missing": te is None or bool(te["removed_at"]),
                      "door_entity_id": r["door_entity_id"], "door_sensor_name": t.friendly(de), "door_missing": bool(r["door_entity_id"]) and (de is None or bool(de["removed_at"])),
                      "door_invert": bool(r["door_invert"]), "low": r["low"], "high": r["high"], "band_mode": r["band_mode"],
                      "source": "climate" if r["temp_entity_id"].startswith("climate.") else "sensor", "rules": t.overrides_of(r["rules_json"]), "recipients": t.recipients_of(r),
                      "defrost_mode": r["defrost_mode"], "defrost_windows": t.fixed_of(r)})
    return {"units": items, "defaults": t.load_defaults(conn), "rule_specs": {k: {"type": s[0], "min": s[2], "max": s[3]} for k, s in t.RULES.items()},
            "kinds": list(t.KINDS), "templates": {k: list(v) for k, v in t.TEMPLATES.items()},
            "areas": [{"area_id": a["area_id"], "name": a["name"], "floor_name": a["floor_name"]} for a in conn.execute(
                "SELECT a.area_id, a.name, f.name AS floor_name FROM ha_areas a LEFT JOIN ha_floors f ON f.floor_id = a.floor_id ORDER BY a.position, a.name").fetchall()]}


@router.get(f"{API}/candidates")
def candidates(kind: str = Query("temp", pattern="^(temp|door)$"), q: str = Query("", max_length=80), principal: Principal = Depends(_manage_ro),
               conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The sensors the setter may link (devices.read scope): numeric degree sensors for `temp`, binary sensors for `door` (door / opening /
    window classes first). Friendly name first; the id for the setter, who manages the module."""
    from ..services import ha_scope

    doms = ("sensor", "climate") if kind == "temp" else ("binary_sensor",)
    marks = ",".join("?" * len(doms))
    rows = conn.execute(f"""SELECT entity_id, name, original_name, domain, device_class, unit, state, available, removed_at, disabled, area_name, attributes_json
                            FROM ha_entities WHERE domain IN ({marks}) AND removed_at IS NULL AND disabled = 0 ORDER BY name, entity_id""", doms).fetchall()
    if kind == "temp":
        rows = [r for r in rows if t.is_temperature_entity(r)]
    items = []
    for r in rows:
        rd = t.reading_of(r) if kind == "temp" else None
        items.append({"entity_id": r["entity_id"], "name": r["name"] or r["original_name"] or r["entity_id"], "device_class": r["device_class"], "area_name": r["area_name"],
                      "group": ("climate" if r["domain"] == "climate" else "sensor") if kind == "temp" else "door",
                      "value": rd["value"] if rd else None, "setpoint": rd["setpoint"] if rd else None, "hvac_mode": rd["hvac_mode"] if rd else None,
                      "state": (r["state"] if r["state"] in ("on", "off") else None) if kind == "door" else None})
    if kind == "temp":
        items.sort(key=lambda i: (0 if i["group"] == "sensor" else 1, i["name"]))
    if kind == "door":
        pref = ("door", "opening", "window", "garage_door")
        items.sort(key=lambda i: (0 if i["device_class"] in pref else 1, i["name"]))
    items, _ = ha_scope.scoped_rows(conn, principal, ta.READ, items)
    needle = q.strip().casefold()
    if needle:
        items = [i for i in items if needle in i["name"].casefold() or needle in i["entity_id"].casefold() or needle in (i["area_name"] or "").casefold()]
    return {"items": items[:500]}


@router.get(f"{API}/settings")
def get_settings(principal: Principal = Depends(_manage_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The installation defaults of every rule (each unit may override any of them)."""
    r = conn.execute("SELECT row_version FROM infra_temp_settings WHERE id = 1").fetchone()
    return {"rules": t.load_defaults(conn), "code_defaults": t.code_defaults(), "row_version": r["row_version"] if r else 0,
            "rule_specs": {k: {"type": s[0], "min": s[2], "max": s[3]} for k, s in {**t.RULES, **t.INSTALLATION}.items()}}


@router.put(f"{API}/settings")
def put_settings(body: SettingsIn, principal: Principal = Depends(_manage_w), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    r = conn.execute("SELECT row_version, rules_json FROM infra_temp_settings WHERE id = 1").fetchone()
    cur_v = r["row_version"] if r else 0
    if body.row_version is not None and body.row_version != cur_v:
        raise ApiError(409, "revision_conflict", "ההגדרות השתנו בינתיים.", details={"row_version": cur_v, "message_en": "The settings were changed meanwhile."})
    try:
        new = t.validate_rules(body.rules, installation=True)
    except t.Invalid as e:
        raise _invalid(e) from None
    conn.execute("""INSERT INTO infra_temp_settings(id, rules_json, row_version, updated_by, updated_at) VALUES (1, ?, 1, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET rules_json = excluded.rules_json, row_version = row_version + 1, updated_by = excluded.updated_by, updated_at = excluded.updated_at""",
                 (json.dumps(new), principal.user_id, now_iso()))
    audit(conn, actor=principal, action="infra.temperature.settings.update", decision="allowed", resource_type="infra_temperature_settings", resource_id="settings",
          details={"keys": sorted(new)})
    return get_settings(principal, conn)


def _alerts_reader(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Principal:
    if not authorize(conn, principal, MANAGE, INSTALLATION).allowed:
        require(conn, principal, CONFIGURE, INSTALLATION)
    return principal


def _alerts_writer(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Principal:
    require(conn, principal, CONFIGURE, INSTALLATION)
    return principal


@router.get(f"{API}/alerts")
def get_alerts(principal: Principal = Depends(_alerts_reader), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    from ..services import temperature_alerts

    return {**temperature_alerts.view(conn), "can_edit": authorize(conn, principal, CONFIGURE, INSTALLATION).allowed}


@router.put(f"{API}/alerts")
def put_alerts(body: AlertsIn, principal: Principal = Depends(_alerts_writer), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    from ..services import temperature_alerts

    try:
        out = temperature_alerts.save(conn, principal, body.model_dump(exclude_none=True))
    except temperature_alerts.AlertsInvalid as e:
        raise ApiError(409 if e.code == "revision_conflict" else 422, e.code, e.message, details={**e.details, "message_en": e.message_en}) from None
    return {**out, "can_edit": True}


def _validate_unit(conn: sqlite3.Connection, principal: Principal, body: UnitIn) -> dict[str, Any]:
    from ..services import ha_scope, temperature_alerts

    if body.area_id and conn.execute("SELECT 1 FROM ha_areas WHERE area_id = ?", (body.area_id,)).fetchone() is None:
        raise _err(422, "area_not_found", fields=["area_id"])
    if body.kind not in t.KINDS:
        raise ApiError(422, "validation", "סוג יחידה לא מוכר.", details={"fields": ["kind"], "message_en": "Unknown unit kind."})
    try:
        low, high = t.validate_band(body.low, body.high)
        rules = t.validate_rules(body.rules)
        mode, wins = t.validate_defrost(body.defrost_mode, [w.model_dump() for w in body.defrost_windows])
    except t.Invalid as e:
        raise _invalid(e) from None
    wide, floors = ha_scope.visible_floors(conn, principal, ta.READ)
    placed = None if wide else ha_scope.placements(conn)
    temp = body.temp_entity_id.strip()
    r = conn.execute("SELECT entity_id, domain, device_class, unit FROM ha_entities WHERE entity_id = ? AND removed_at IS NULL", (temp,)).fetchone()
    if r is None or not ha_scope.entity_visible(wide, floors, placed or {}, temp):
        raise _err(422, "sensor_not_found", fields=["temp_entity_id"])
    if not t.is_temperature_entity(r):
        raise _err(422, "not_temperature_sensor", fields=["temp_entity_id"])
    door = (body.door_entity_id or "").strip() or None
    if door:
        d = conn.execute("SELECT domain FROM ha_entities WHERE entity_id = ? AND removed_at IS NULL", (door,)).fetchone()
        if d is None or not ha_scope.entity_visible(wide, floors, placed or {}, door):
            raise _err(422, "sensor_not_found", fields=["door_entity_id"])
        if d["domain"] != "binary_sensor":
            raise _err(422, "not_door_sensor", fields=["door_entity_id"])
    if body.band_mode == "setpoint" and r["domain"] != "climate":
        raise ApiError(422, "validation", "טווח לפי נקודת היעד אפשרי רק ליחידת מיזוג.", details={"fields": ["band_mode"], "message_en": "A setpoint band needs a climate entity."})
    rec = None
    if body.recipients is not None:
        try:
            rec = temperature_alerts.validate_recipients(conn, body.recipients.model_dump(), "recipients")
        except temperature_alerts.AlertsInvalid as e:
            raise ApiError(422, e.code, e.message, details={**e.details, "message_en": e.message_en}) from None
    return {"temp": temp, "door": door, "low": low, "high": high, "rules": rules, "mode": mode, "wins": wins, "rec": rec}


def _name_taken(conn: sqlite3.Connection, name: str, except_id: str | None = None) -> bool:
    r = conn.execute("SELECT id FROM infra_temp_units WHERE name_key = ?", (t.name_key(name),)).fetchone()
    return r is not None and r["id"] != except_id


def _unit_row(conn: sqlite3.Connection, unit_id: str) -> sqlite3.Row:
    r = conn.execute("SELECT * FROM infra_temp_units WHERE id = ?", (unit_id,)).fetchone()
    if r is None:
        raise _err(404, "unit_not_found")
    return r


def _clean_name(name: str) -> str:
    n = " ".join(name.split())
    if not n:
        raise ApiError(422, "validation", "יש לתת שם.", details={"fields": ["name"], "message_en": "A name is required."})
    return n


def _manage_one(conn: sqlite3.Connection, principal: Principal, unit_id: str) -> dict[str, Any]:
    return next(u for u in manage_list(principal, conn)["units"] if u["id"] == unit_id)


@router.post(API, status_code=201)
def create(body: UnitIn, principal: Principal = Depends(_manage_w), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    name = _clean_name(body.name)
    v = _validate_unit(conn, principal, body)
    if _name_taken(conn, name):
        raise _err(409, "duplicate_name", fields=["name"])
    uid, at = new_id(), now_iso()
    nxt = conn.execute("SELECT COALESCE(MAX(sort_order), -1) + 1 FROM infra_temp_units").fetchone()[0]
    conn.execute("""INSERT INTO infra_temp_units(id, name, name_key, area_id, kind, temp_entity_id, door_entity_id, door_invert, low, high, band_mode, rules_json, recipients_json,
                    defrost_mode, defrost_json, sort_order, enabled, revision, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)""",
                 (uid, name, t.name_key(name), body.area_id or None, body.kind, v["temp"], v["door"], int(body.door_invert and bool(v["door"])), v["low"], v["high"], body.band_mode,
                  json.dumps(v["rules"]), json.dumps(v["rec"]) if v["rec"] is not None else None, v["mode"], json.dumps(v["wins"]), nxt, int(body.enabled), at, at))
    audit(conn, actor=principal, action="infra.temperature.create", decision="allowed", resource_type="infra_temp_unit", resource_id=uid)
    return _manage_one(conn, principal, uid)


@router.put(f"{API}/order")
def reorder(body: OrderIn, principal: Principal = Depends(_manage_w), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    have = {r[0] for r in conn.execute("SELECT id FROM infra_temp_units").fetchall()}
    if set(body.ids) != have or len(body.ids) != len(have):
        raise _err(422, "order_mismatch", fields=["ids"])
    conn.executemany("UPDATE infra_temp_units SET sort_order = ? WHERE id = ?", [(i, x) for i, x in enumerate(body.ids)])
    audit(conn, actor=principal, action="infra.temperature.reorder", decision="allowed", resource_type="infra_temp_unit", details={"ids": body.ids})
    return manage_list(principal, conn)


@router.put(f"{API}/{{unit_id}}")
def update(unit_id: str, body: UnitIn, principal: Principal = Depends(_manage_w), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    cur = _unit_row(conn, unit_id)
    if body.revision is not None and body.revision != cur["revision"]:
        raise _err(409, "revision_conflict", revision=cur["revision"])
    name = _clean_name(body.name)
    v = _validate_unit(conn, principal, body)
    if _name_taken(conn, name, unit_id):
        raise _err(409, "duplicate_name", fields=["name"])
    ts = now_ts()
    if cur["temp_entity_id"] != v["temp"] or (cur["door_entity_id"] or None) != v["door"] or (cur["enabled"] and not body.enabled):
        rt.close_all(conn, cur, ts, "changed")  # a different sensor: the open conditions were about the old one
    if cur["temp_entity_id"] != v["temp"]:
        conn.execute("DELETE FROM infra_temp_defrost_learned WHERE unit_id = ? AND status = 'learned'", (unit_id,))
    conn.execute("""UPDATE infra_temp_units SET name = ?, name_key = ?, area_id = ?, kind = ?, temp_entity_id = ?, door_entity_id = ?, door_invert = ?, low = ?, high = ?,
                    band_mode = ?, rules_json = ?, recipients_json = ?, defrost_mode = ?, defrost_json = ?, enabled = ?, revision = revision + 1, updated_at = ? WHERE id = ?""",
                 (name, t.name_key(name), body.area_id or None, body.kind, v["temp"], v["door"], int(body.door_invert and bool(v["door"])), v["low"], v["high"], body.band_mode,
                  json.dumps(v["rules"]), json.dumps(v["rec"]) if v["rec"] is not None else None, v["mode"], json.dumps(v["wins"]), int(body.enabled), now_iso(), unit_id))
    audit(conn, actor=principal, action="infra.temperature.update", decision="allowed", resource_type="infra_temp_unit", resource_id=unit_id)
    return _manage_one(conn, principal, unit_id)


@router.delete(f"{API}/{{unit_id}}", status_code=204)
def delete(unit_id: str, principal: Principal = Depends(_manage_w), conn: sqlite3.Connection = Depends(get_conn)) -> None:
    u = _unit_row(conn, unit_id)
    rt.close_all(conn, u, now_ts(), "removed")
    for tbl in ("infra_temp_samples", "infra_temp_samples_5m", "infra_temp_doors", "infra_temp_events", "infra_temp_defrost_learned", "infra_temp_defrost_state"):
        conn.execute(f"DELETE FROM {tbl} WHERE unit_id = ?", (unit_id,))
    conn.execute("DELETE FROM infra_temp_units WHERE id = ?", (unit_id,))
    audit(conn, actor=principal, action="infra.temperature.delete", decision="allowed", resource_type="infra_temp_unit", resource_id=unit_id)


# ---------------------------------------------------------------- learned defrost windows (manage)

@router.post(f"{API}/{{unit_id}}/defrost/{{start_min}}/{{decision}}")
def decide_window(unit_id: str, start_min: int, decision: Literal["confirm", "reject"], principal: Principal = Depends(_manage_w),
                  conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _unit_row(conn, unit_id)
    r = conn.execute("SELECT status FROM infra_temp_defrost_learned WHERE unit_id = ? AND start_min = ?", (unit_id, start_min)).fetchone()
    if r is None:
        raise _err(404, "window_not_found")
    conn.execute("UPDATE infra_temp_defrost_learned SET status = ?, decided_by = ?, decided_at = ? WHERE unit_id = ? AND start_min = ?",
                 ("confirmed" if decision == "confirm" else "rejected", principal.user_id, now_iso(), unit_id, start_min))
    audit(conn, actor=principal, action=f"infra.temperature.defrost.{decision}", decision="allowed", resource_type="infra_temp_unit", resource_id=unit_id,
          details={"start_min": start_min})
    return {"windows": [dict(x) for x in conn.execute("SELECT start_min, minutes, repeats, status FROM infra_temp_defrost_learned WHERE unit_id = ? ORDER BY start_min", (unit_id,)).fetchall()]}


@router.delete(f"{API}/{{unit_id}}/defrost/learned", status_code=204)
def clear_learned(unit_id: str, principal: Principal = Depends(_manage_w), conn: sqlite3.Connection = Depends(get_conn)) -> None:
    """Forgets every learned, confirmed and rejected window of the unit; the learner starts over (state `learning` until it has seen enough)."""
    _unit_row(conn, unit_id)
    conn.execute("DELETE FROM infra_temp_defrost_learned WHERE unit_id = ?", (unit_id,))
    conn.execute("DELETE FROM infra_temp_defrost_state WHERE unit_id = ?", (unit_id,))
    rt._LAST["learn"].pop(unit_id, None)
    audit(conn, actor=principal, action="infra.temperature.defrost.clear", decision="allowed", resource_type="infra_temp_unit", resource_id=unit_id)


# ---------------------------------------------------------------- operator acts (infra.temperature.ack)

@router.post(f"{API}/{{unit_id}}/ack")
def ack(unit_id: str, body: AckIn | None = None, principal: Principal = Depends(_ack_w), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Acknowledges the unit's open warnings and alarms (or one row): who and when go into the log; the notifications are acknowledged too
    (which stops the centre's escalation). The condition itself stays open until it ends."""
    from ..services import notify

    u, _d = _one_visible(conn, principal, unit_id)
    evs = [e for e in rt.open_events(conn, unit_id).values() if e["severity"] in ("warning", "alarm") and not e.get("ack_at")]
    if body and body.event_id:
        evs = [e for e in evs if e["id"] == body.event_id]
    if not evs:
        raise _err(409, "nothing_to_ack")
    at = _iso(now_ts())
    for e in evs:
        conn.execute("UPDATE infra_temp_events SET ack_by = ?, ack_at = ? WHERE id = ?", (principal.user_id, at, e["id"]))
        notify.ack_from_alert(conn, e.get("notification_id"), principal)
    rt.log_act(conn, unit_id, "ack", at, principal.user_id, {"events": [e["id"] for e in evs]})
    audit(conn, actor=principal, action="infra.temperature.ack", decision="allowed", resource_type="infra_temp_unit", resource_id=u["id"])
    return {"acked": len(evs), "at": at}


@router.post(f"{API}/{{unit_id}}/mute")
def mute(unit_id: str, body: MuteIn, principal: Principal = Depends(_ack_w), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Mutes the unit's WARNING notifications for a while (or until the end of its next defrost window). Alarms are never muted (owner decision 2)."""
    u, _d = _one_visible(conn, principal, unit_id)
    ts = now_ts()
    if body.until_defrost_end:
        tz = t.site_zone(conn)
        wins = t.unit_windows(u, t.learned_of(conn, [unit_id]))
        cur = [b for a, b in t.window_intervals(wins, ts - 86400, ts + 2 * 86400, tz) if b > ts]
        if not cur:
            raise ApiError(422, "validation", "אין חלון הפשרה ליחידה.", details={"fields": ["until_defrost_end"], "message_en": "The unit has no defrost window."})
        until = min(cur)
    elif body.minutes:
        until = ts + body.minutes * 60
    else:
        raise ApiError(422, "validation", "יש לבחור משך.", details={"fields": ["minutes"], "message_en": "Choose a duration."})
    until_iso = _iso(until)
    conn.execute("UPDATE infra_temp_units SET muted_until = ?, muted_by = ? WHERE id = ?", (until_iso, principal.user_id, unit_id))
    rt.log_act(conn, unit_id, "mute", _iso(ts), principal.user_id, {"until": until_iso, "minutes": round((until - ts) / 60)})
    audit(conn, actor=principal, action="infra.temperature.mute", decision="allowed", resource_type="infra_temp_unit", resource_id=unit_id, details={"until": until_iso})
    return {"muted_until": until_iso}


@router.delete(f"{API}/{{unit_id}}/mute")
def unmute(unit_id: str, principal: Principal = Depends(_ack_w), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _one_visible(conn, principal, unit_id)
    conn.execute("UPDATE infra_temp_units SET muted_until = NULL, muted_by = NULL WHERE id = ?", (unit_id,))
    audit(conn, actor=principal, action="infra.temperature.unmute", decision="allowed", resource_type="infra_temp_unit", resource_id=unit_id)
    return {"muted_until": None}


# ---------------------------------------------------------------- one unit (registered last)

@router.get(f"{API}/{{unit_id}}/history")
def history(unit_id: str, range: str = Query("24h", pattern="^(24h|7d|30d|custom)$"), start: str | None = Query(None, alias="from", max_length=40),  # noqa: A002
            end: str | None = Query(None, alias="to", max_length=40), points: int = Query(600, ge=50, le=t.MAX_POINTS),
            principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The chart of one unit: points [ts, avg, min, max, defrost], door openings, defrost windows and the statistics of the range."""
    u, door_vis = _one_visible(conn, principal, unit_id)
    ts = now_ts()
    try:
        lo, hi = t.parse_range(range, start, end, ts)
    except ValueError as e:
        raise ApiError(422, "validation", "טווח לא תקין.", details={"fields": [str(e)], "message_en": "Invalid range."}) from None
    rules = t.effective(t.load_defaults(conn), t.overrides_of(u["rules_json"]))
    tz = t.site_zone(conn)
    wins = t.unit_windows(u, t.learned_of(conn, [unit_id]))
    s = t.series(conn, unit_id, lo, hi, ts, max_points=points)
    st = t.stats(conn, u, rules, lo, hi, ts)
    if not door_vis:
        st.update(door_opens=0, door_total_min=0, door_longest_min=0)
    return {**s, "low": u["low"], "high": u["high"], "doors": t.door_intervals(conn, unit_id, lo, hi, ts) if door_vis else [],
            "defrost": [[int(a), int(b)] for a, b in t.window_intervals(wins, lo, hi, tz)], "stats": st, "zone": str(tz)}


@router.get(f"{API}/{{unit_id}}")
def get_one(unit_id: str, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    u, d = _one_visible(conn, principal, unit_id)
    ctx = _Ctx(conn, now_ts())
    ents = t.entity_rows(conn, [u["temp_entity_id"], u["door_entity_id"] or ""])
    return _unit_out(ctx, u, d, ents, spark=True, manage=authorize(conn, principal, MANAGE, INSTALLATION).allowed)
