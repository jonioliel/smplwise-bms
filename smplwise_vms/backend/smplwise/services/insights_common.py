"""CR-INSIGHT215 (release line 2.15.0, docs/changes/CR-INSIGHT215.md): what the three insight services share.

* the switches (`settings` rows, default OFF - nothing is computed and every route of a switched-off part answers the uniform 404):
  `insights.doors.enabled`, `insights.waste.enabled`, `reports.building.enabled`;
* the settings document (`settings` row `insights.settings`, JSON): every threshold of the algorithms with its code default and bounds,
  validated as a whole (an unknown key or an out-of-range value is a 422 naming the field);
* the permissions (`insights.read`, `insights.manage`, `reports.building`) and the scope rule of a per-entity answer: an insight row is
  visible only through the entity it is about, with `insights.read` on that entity's floor (services/ha_scope.py, the device screens' rule);
* the range of a request (24h / 7d / 30d / custom of at most 31 days - the local state history keeps 30 days) and the state timeline of
  one entity out of the local state history (services/ha_history.py: `ha_state_history`), where a state nobody recorded is UNKNOWN, never
  the last value carried forward without bound.

Read-only: nothing here writes anything but the settings row, and nothing is ever sent to a device or to Home Assistant."""
from __future__ import annotations

import datetime as dt
import json
import re
import sqlite3
from dataclasses import dataclass
from typing import Any
from zoneinfo import ZoneInfo

from ..db import get_setting, set_setting
from ..rbac import INSTALLATION, Principal, require
from . import ha_scope
from .timeutil import iso_utc, parse_utc, zone

READ, MANAGE, REPORT = "insights.read", "insights.manage", "reports.building"
CONFIGURE = "system.configure"  # turning a switch on or off (the owner's switches; system administrators)
SW_DOORS, SW_WASTE, SW_REPORT = "insights.doors.enabled", "insights.waste.enabled", "reports.building.enabled"
SWITCHES = (SW_DOORS, SW_WASTE, SW_REPORT)
SETTINGS_KEY = "insights.settings"
HISTORY_DAYS = 31  # the local state history keeps 30 days (ha_history.RETENTION_DAYS); a custom range may not ask for more
RANGES = {"24h": 86400, "7d": 7 * 86400, "30d": 30 * 86400}
MAX_PAIRS = 100
MAX_REX = 4
_HHMM = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
_ENTITY = re.compile(r"^[a-z_]+\.[a-z0-9_]{1,200}$")
UNKNOWN_STATES = frozenset({"", "unknown", "unavailable", "none", "null"})

MESSAGES: dict[str, dict[str, str]] = {
    "insights_off": {"he": "הפריט לא נמצא.", "en": "Not found."},
    "validation": {"he": "ערך לא תקין.", "en": "Invalid value."},
    "range": {"he": "טווח לא תקין.", "en": "Invalid range."},
}

# Every number is a setting (section 3 of the CR). (default, min, max)
_NUM: dict[str, dict[str, tuple[float, float, float]]] = {
    "doors": {"before_s": (30, 5, 300), "after_s": (10, 0, 120), "min_open_s": (2, 0, 60)},
    "waste": {"empty_after_min": (20, 5, 240), "min_waste_min": (30, 5, 720), "night_min_min": (60, 10, 720),
              "energy_factor": (1.5, 1.1, 10.0), "energy_min_kwh": (1.0, 0.1, 1000.0), "baseline_weeks": (4, 2, 8),
              "baseline_min_coverage": (0.8, 0.5, 1.0)},
}
_INTS = {"before_s", "after_s", "min_open_s", "empty_after_min", "min_waste_min", "night_min_min", "baseline_weeks"}
WASTE_DOMAINS = ("light", "climate", "fan", "switch")
SECTIONS = ("summary", "tickets", "energy", "elevators", "generator", "temperature", "doors", "cameras", "waste")


class Invalid(ValueError):
    def __init__(self, fields: list[str]):
        super().__init__(",".join(fields))
        self.fields = fields


def code_defaults() -> dict[str, Any]:
    out: dict[str, Any] = {g: {k: v[0] for k, v in spec.items()} for g, spec in _NUM.items()}
    out["doors"]["pairs"] = []
    out["waste"].update(domains=["light", "climate"], night_from="22:00", night_to="06:00")
    out["report"] = {"sections": list(SECTIONS)}
    return out


def _num(group: str, key: str, value: Any, fields: list[str]) -> float | int | None:
    lo, hi = _NUM[group][key][1], _NUM[group][key][2]
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not (lo <= value <= hi):
        fields.append(f"{group}.{key}")
        return None
    return int(value) if key in _INTS else round(float(value), 3)


def _pair(conn: sqlite3.Connection | None, i: int, p: Any, fields: list[str]) -> dict[str, Any] | None:
    where = f"doors.pairs[{i}]"
    if not isinstance(p, dict) or set(p) - {"sensor_entity_id", "lock_entity_id", "rex_entity_ids", "invert"}:
        fields.append(where)
        return None
    sensor, lock, rex, inv = p.get("sensor_entity_id"), p.get("lock_entity_id"), p.get("rex_entity_ids") or [], p.get("invert", False)
    if not isinstance(sensor, str) or not _ENTITY.match(sensor) or not sensor.startswith("binary_sensor."):
        fields.append(f"{where}.sensor_entity_id")
    if lock is not None and (not isinstance(lock, str) or not _ENTITY.match(lock) or not lock.startswith("lock.")):
        fields.append(f"{where}.lock_entity_id")
    if (not isinstance(rex, list) or len(rex) > MAX_REX
            or any(not isinstance(r, str) or not _ENTITY.match(r) or r.split(".", 1)[0] not in ("binary_sensor", "button", "input_button", "event") for r in rex)):
        fields.append(f"{where}.rex_entity_ids")
    if not isinstance(inv, bool):
        fields.append(f"{where}.invert")
    if fields and any(f.startswith(where) for f in fields):
        return None
    if conn is not None:
        for eid in [sensor, *([lock] if lock else []), *rex]:
            row = conn.execute("SELECT 1 FROM ha_entities WHERE entity_id = ? AND removed_at IS NULL", (eid,)).fetchone()
            if row is None:
                fields.append(f"{where}.unknown_entity")
                return None
    return {"sensor_entity_id": sensor, "lock_entity_id": lock, "rex_entity_ids": list(dict.fromkeys(rex)), "invert": inv}


def validate(doc: Any, conn: sqlite3.Connection | None = None) -> dict[str, Any]:
    """The whole settings document checked against the bounds; Invalid(fields) names every bad field. Missing keys take the code default."""
    fields: list[str] = []
    if not isinstance(doc, dict) or set(doc) - {"doors", "waste", "report"}:
        raise Invalid(["settings"])
    out = code_defaults()
    for group in ("doors", "waste"):
        g = doc.get(group, {})
        if not isinstance(g, dict):
            fields.append(group)
            continue
        allowed = set(_NUM[group]) | ({"pairs"} if group == "doors" else {"domains", "night_from", "night_to"})
        for k in set(g) - allowed:
            fields.append(f"{group}.{k}")
        for k in _NUM[group]:
            if k in g:
                v = _num(group, k, g[k], fields)
                if v is not None:
                    out[group][k] = v
    d = doc.get("doors", {}) if isinstance(doc.get("doors", {}), dict) else {}
    if "pairs" in d:
        if not isinstance(d["pairs"], list) or len(d["pairs"]) > MAX_PAIRS:
            fields.append("doors.pairs")
        else:
            pairs = [_pair(conn, i, p, fields) for i, p in enumerate(d["pairs"])]
            sensors = [p["sensor_entity_id"] for p in pairs if p]
            if len(sensors) != len(set(sensors)):
                fields.append("doors.pairs.duplicate_sensor")
            out["doors"]["pairs"] = [p for p in pairs if p]
    w = doc.get("waste", {}) if isinstance(doc.get("waste", {}), dict) else {}
    if "domains" in w:
        if not isinstance(w["domains"], list) or not w["domains"] or any(x not in WASTE_DOMAINS for x in w["domains"]):
            fields.append("waste.domains")
        else:
            out["waste"]["domains"] = list(dict.fromkeys(w["domains"]))
    for k in ("night_from", "night_to"):
        if k in w:
            if not isinstance(w[k], str) or not _HHMM.match(w[k]):
                fields.append(f"waste.{k}")
            else:
                out["waste"][k] = w[k]
    if out["waste"]["night_from"] == out["waste"]["night_to"]:
        fields.append("waste.night_to")
    r = doc.get("report", {})
    if not isinstance(r, dict) or set(r) - {"sections"}:
        fields.append("report")
    elif "sections" in r:
        if not isinstance(r["sections"], list) or not r["sections"] or any(s not in SECTIONS for s in r["sections"]):
            fields.append("report.sections")
        else:
            out["report"]["sections"] = [s for s in SECTIONS if s in r["sections"]]
    if fields:
        raise Invalid(sorted(set(fields)))
    return out


def load(conn: sqlite3.Connection) -> dict[str, Any]:
    """The saved document over the code defaults. An unreadable or invalid saved row reads as the defaults (fail safe: thresholds only)."""
    raw = get_setting(conn, SETTINGS_KEY, None)
    if not raw:
        return code_defaults()
    try:
        return validate(json.loads(raw))
    except (ValueError, TypeError):
        return code_defaults()


def save(conn: sqlite3.Connection, doc: dict[str, Any]) -> None:
    set_setting(conn, SETTINGS_KEY, json.dumps(doc, ensure_ascii=False, sort_keys=True))


def switch_on(conn: sqlite3.Connection, key: str) -> bool:
    """A switch is on only when its row says exactly "true"; missing, unreadable or anything else is OFF."""
    try:
        return (get_setting(conn, key, "false") or "false") == "true"
    except sqlite3.Error:
        return False


def switches(conn: sqlite3.Connection) -> dict[str, bool]:
    return {k: switch_on(conn, k) for k in SWITCHES}


def site_zone(conn: sqlite3.Connection) -> ZoneInfo:
    return zone(get_setting(conn, "time.zone", "Asia/Jerusalem") or "Asia/Jerusalem")


def parse_range(rng: str, start: str | None, end: str | None, now_ts: float) -> tuple[int, int]:
    """(lo, hi) unix seconds. ValueError for an unknown preset, a bound without a zone, an empty or a too long range."""
    if rng in RANGES:
        return int(now_ts) - RANGES[rng], int(now_ts)
    if rng != "custom":
        raise ValueError("range")
    a = parse_utc(start or "")
    b = parse_utc(end) if end else dt.datetime.fromtimestamp(now_ts, dt.timezone.utc)
    lo, hi = int(a.timestamp()), min(int(b.timestamp()), int(now_ts))
    if hi <= lo or hi - lo > HISTORY_DAYS * 86400:
        raise ValueError("to")
    return lo, hi


def iso(ts: float) -> str:
    return iso_utc(dt.datetime.fromtimestamp(ts, dt.timezone.utc))


def ts_of(value: str) -> float:
    return parse_utc(value).timestamp()


class Scope:
    """The caller's view: `sees(entity_id)` - `permission` on a floor the entity is placed on (or installation-wide). A caller who holds the
    permission nowhere gets the audited 403 at construction."""

    def __init__(self, conn: sqlite3.Connection, principal: Principal, permission: str = READ) -> None:
        wide, floors = ha_scope.visible_floors(conn, principal, permission)
        if not wide and not floors:
            require(conn, principal, permission, INSTALLATION)
        self.wide, self.floors = wide, floors
        self._placed: ha_scope.Placements | None = None
        self._conn = conn

    def sees(self, entity_id: str | None) -> bool:
        if not entity_id:
            return False
        if self.wide:
            return True
        if self._placed is None:
            self._placed = ha_scope.placements(self._conn)
        return ha_scope.entity_visible(False, self.floors, self._placed, entity_id)


@dataclass(frozen=True)
class Segment:
    start: float
    end: float
    state: str | None  # None = unknown (before the history, a gap, unavailable)


def timeline(conn: sqlite3.Connection, entity_id: str, lo: float, hi: float) -> list[Segment]:
    """The entity's states over [lo, hi) from the local state history, oldest first. The state at lo is the last recorded change at or
    before lo when one exists; otherwise the stretch up to the first recorded change is unknown. `unavailable` / `unknown` are unknown."""
    a, b = iso(lo), iso(hi)
    prev = conn.execute("SELECT state FROM ha_state_history WHERE entity_id = ? AND changed_at <= ? ORDER BY changed_at DESC, id DESC LIMIT 1",
                        (entity_id, a)).fetchone()
    rows = conn.execute("SELECT state, changed_at FROM ha_state_history WHERE entity_id = ? AND changed_at > ? AND changed_at < ? ORDER BY changed_at, id",
                        (entity_id, a, b)).fetchall()
    cur_state: str | None = _norm_state(prev["state"]) if prev is not None else None
    cur_at = float(lo)
    out: list[Segment] = []
    for r in rows:
        t = ts_of(r["changed_at"])
        s = _norm_state(r["state"])
        if s == cur_state:
            continue
        if t > cur_at:
            out.append(Segment(cur_at, t, cur_state))
        cur_state, cur_at = s, t
    if hi > cur_at:
        out.append(Segment(cur_at, float(hi), cur_state))
    return out


def transitions(conn: sqlite3.Connection, entity_id: str, lo: float, hi: float) -> list[tuple[float, str | None, str | None]]:
    """[(instant, from, to)] of the recorded changes inside (lo, hi]; `from` is None when nothing was known before."""
    segs = timeline(conn, entity_id, lo, hi)
    return [(segs[i].start, segs[i - 1].state, segs[i].state) for i in range(1, len(segs))]


def _norm_state(s: Any) -> str | None:
    v = str(s).strip().lower() if s is not None else ""
    return None if v in UNKNOWN_STATES else v


def merge(iv: list[tuple[float, float]]) -> list[tuple[float, float]]:
    out: list[tuple[float, float]] = []
    for a, b in sorted(iv):
        if b <= a:
            continue
        if out and a <= out[-1][1]:
            out[-1] = (out[-1][0], max(out[-1][1], b))
        else:
            out.append((a, b))
    return out


def intersect(xs: list[tuple[float, float]], ys: list[tuple[float, float]]) -> list[tuple[float, float]]:
    out: list[tuple[float, float]] = []
    i = j = 0
    xs, ys = merge(xs), merge(ys)
    while i < len(xs) and j < len(ys):
        a, b = max(xs[i][0], ys[j][0]), min(xs[i][1], ys[j][1])
        if b > a:
            out.append((a, b))
        if xs[i][1] < ys[j][1]:
            i += 1
        else:
            j += 1
    return out


def subtract(xs: list[tuple[float, float]], ys: list[tuple[float, float]]) -> list[tuple[float, float]]:
    out: list[tuple[float, float]] = []
    ys = merge(ys)
    for a, b in merge(xs):
        cur = a
        for c, d in ys:
            if d <= cur or c >= b:
                continue
            if c > cur:
                out.append((cur, c))
            cur = max(cur, d)
        if cur < b:
            out.append((cur, b))
    return out


def local_windows(lo: float, hi: float, tz: ZoneInfo, hhmm_from: str, hhmm_to: str) -> list[tuple[float, float]]:
    """The local daily window from..to (crossing midnight when to <= from) as UTC intervals clipped to [lo, hi). Per local date, so a DST
    day is right on both sides."""
    fh, fm = map(int, hhmm_from.split(":"))
    th, tm = map(int, hhmm_to.split(":"))
    day = dt.datetime.fromtimestamp(lo, dt.timezone.utc).astimezone(tz).date() - dt.timedelta(days=1)
    last = dt.datetime.fromtimestamp(hi, dt.timezone.utc).astimezone(tz).date()
    out: list[tuple[float, float]] = []
    while day <= last:
        a = dt.datetime.combine(day, dt.time(fh, fm), tzinfo=tz)
        end_day = day + dt.timedelta(days=1) if (th, tm) <= (fh, fm) else day
        b = dt.datetime.combine(end_day, dt.time(th, tm), tzinfo=tz)
        out.append((max(lo, a.timestamp()), min(hi, b.timestamp())))
        day += dt.timedelta(days=1)
    return merge([(a, b) for a, b in out if b > a])


def total(iv: list[tuple[float, float]]) -> float:
    return sum(b - a for a, b in iv)


def entity_names(conn: sqlite3.Connection, ids: list[str]) -> dict[str, sqlite3.Row]:
    if not ids:
        return {}
    ids = list(dict.fromkeys(ids))
    rows = conn.execute(f"SELECT e.entity_id, e.name, e.original_name, e.area_id, COALESCE(a.name, e.area_name) AS area_name, fl.name AS floor_name, e.domain, e.device_class "
                        f"FROM ha_entities e LEFT JOIN ha_areas a ON a.area_id = e.area_id LEFT JOIN ha_floors fl ON fl.floor_id = a.floor_id WHERE e.entity_id IN ({','.join('?' * len(ids))})", ids).fetchall()
    return {r["entity_id"]: r for r in rows}


def friendly(row: sqlite3.Row | None, fallback: str) -> str:
    """A friendly name for a screen or the PDF - never the entity id (owner rule: operator answers carry names)."""
    if row is None:
        return fallback
    return (row["name"] or row["original_name"] or fallback)[:80]
