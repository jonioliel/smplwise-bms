"""CR-INFRA-TEMPERATURE 2.9.1 - temperature control under Infrastructure: the rules, their installation defaults and per-unit overrides,
the live reading of a unit from the state mirror, the defrost windows in force, quiet hours, history queries and statistics.

A unit = ONE temperature sensor (`sensor.*`, numeric degrees), an optional door sensor (`binary_sensor.*`, optionally inverted), a target band
low..high, rule overrides and a defrost mode (fixed | learn | none). Nothing is ever sent to a device: everything is read from `ha_entities`.

Owner decisions 2026-10-19 (private/planning/mockup_temperature_2026-10-19/OWNER_DECISIONS.md), all of them SETTINGS (installation default,
per-unit override):
* a WARNING from the moment of an excursion; an ALARM after Z minutes out of the band, or a door open longer than X minutes;
* quiet hours hold WARNING notifications only - an alarm is never silenced (also not by a mute);
* out-of-range statistics exclude defrost windows (fixed or learned); the raw excursion stays on the chart;
* the defrost window is optional: fixed, learned automatically (the default) or none; a defrost window never hides a reading above the hard
  maximum (high + `defrost_hard_margin`).

Pure helpers first (the unit tests drive them with a fake clock); storage helpers after."""
from __future__ import annotations

import datetime as dt
import json
import math
import sqlite3
from typing import Any, Iterable
from zoneinfo import ZoneInfo

from .timeutil import iso_utc, parse_utc, zone

KINDS: tuple[str, ...] = ("fridge", "freezer", "coldroom", "pharma", "server", "room")
DEFROST_MODES: tuple[str, ...] = ("fixed", "learn", "none")
STATUSES: tuple[str, ...] = ("ok", "warning", "alarm", "offline", "off", "unknown")  # off = a climate unit switched off (a state, not an alarm)
BAND_MODES: tuple[str, ...] = ("fixed", "setpoint")
HVAC_MODES: tuple[str, ...] = ("off", "heat", "cool", "heat_cool", "auto", "dry", "fan_only")
EVENT_KINDS: tuple[str, ...] = ("high", "low", "door", "offline", "defrost", "ack", "mute")
SEVERITIES: tuple[str, ...] = ("info", "warning", "alarm")
DEAD = {"", "unknown", "unavailable", "none", "null", "nan"}
MAX_FIXED_WINDOWS = 6
T_MIN, T_MAX = -60.0, 150.0

# key -> (type, default, min, max). type: bool | int | float | hhmm. Every key may be overridden per unit (rules_json).
RULES: dict[str, tuple[str, Any, float | None, float | None]] = {
    "warn_on_excursion": ("bool", True, None, None),      # a warning from the moment the reading leaves the band
    "high_alarm": ("bool", True, None, None),
    "high_alarm_min": ("int", 10, 0, 1440),               # Z above the band
    "low_alarm": ("bool", True, None, None),
    "low_alarm_min": ("int", 15, 0, 1440),                # Z below the band
    "door_alarm": ("bool", True, None, None),
    "door_alarm_min": ("int", 10, 1, 1440),               # X
    "offline_warn": ("bool", True, None, None),
    "offline_min": ("int", 15, 1, 1440),                  # no live reading this long = "the sensor does not report"
    "quiet_enabled": ("bool", False, None, None),
    "quiet_from": ("hhmm", "23:00", None, None),
    "quiet_to": ("hhmm", "06:00", None, None),
    "exclude_defrost_stats": ("bool", True, None, None),  # owner decision 3
    "defrost_suppress": ("bool", True, None, None),       # no temperature alert above the band inside a defrost window (below the hard max)
    "defrost_hard_margin": ("float", 5.0, 0, 50),         # hard max = high + margin: a defrost window never hides a reading above it
    "hysteresis": ("float", 0.3, 0, 5),                   # back in the band only this far inside it (no flapping on the line)
    "learn_days": ("int", 7, 3, 30),                      # the learner's rolling period
    "learn_min_repeats": ("int", 3, 2, 14),               # a pattern must repeat on this many days
    "defrost_max_min": ("int", 60, 10, 180),              # a rise longer than this is not a defrost cycle
    "setpoint_tolerance": ("float", 2.0, 0.1, 20),        # climate units in band mode `setpoint`: the band is setpoint -/+ this
    "alert_when_off": ("bool", False, None, None),        # climate units: judge the band also while the unit is switched off
}
# installation-only settings (not per unit)
INSTALLATION: dict[str, tuple[str, Any, float | None, float | None]] = {
    "retention_days": ("int", 400, 35, 3650),             # the five-minute history (a year of audits by default)
}
RAW_KEEP_S = 35 * 86400
BUCKET_S = 300
RANGES = {"24h": 86400, "7d": 7 * 86400, "30d": 30 * 86400}
MAX_POINTS = 1500

TEMPLATES: dict[str, tuple[float, float]] = {"fridge": (2, 6), "freezer": (-22, -16), "pharma": (2, 8), "server": (18, 24), "coldroom": (0, 4)}

MESSAGES: dict[str, dict[str, str]] = {
    "unit_not_found": {"he": "היחידה לא נמצאה.", "en": "The unit was not found."},
    "duplicate_name": {"he": "כבר יש יחידה בשם הזה.", "en": "A unit with this name already exists."},
    "not_temperature_sensor": {"he": "אפשר לבחור רק חיישן טמפרטורה.", "en": "Only a temperature sensor can be linked."},
    "not_door_sensor": {"he": "חיישן הדלת חייב להיות חיישן מצב (פתוח/סגור).", "en": "The door sensor must be a binary sensor."},
    "sensor_not_found": {"he": "החיישן לא נמצא.", "en": "The sensor was not found."},
    "band_invalid": {"he": "הסף התחתון חייב להיות נמוך מהעליון.", "en": "The low threshold must be below the high one."},
    "rule_invalid": {"he": "ערך לא תקין בכללים.", "en": "Invalid rule value."},
    "defrost_invalid": {"he": "חלון ההפשרה לא תקין.", "en": "Invalid defrost window."},
    "area_not_found": {"he": "האזור לא נמצא.", "en": "The area was not found."},
    "revision_conflict": {"he": "היחידה עודכנה בינתיים.", "en": "The unit was changed meanwhile."},
    "order_mismatch": {"he": "הסדר חייב לכלול את כל היחידות.", "en": "The order must list every unit."},
    "nothing_to_ack": {"he": "אין התראה פתוחה לאישור.", "en": "There is no open alert to acknowledge."},
    "window_not_found": {"he": "חלון ההפשרה לא נמצא.", "en": "The defrost window was not found."},
}


class Invalid(ValueError):
    def __init__(self, code: str, fields: list[str] | None = None) -> None:
        super().__init__(code)
        self.code, self.fields = code, fields or []


def name_key(name: str) -> str:
    return " ".join(name.split()).casefold()


# ---------------------------------------------------------------- rules: defaults, overrides, validation

def _hhmm_ok(v: Any) -> bool:
    if not isinstance(v, str) or len(v) != 5 or v[2] != ":":
        return False
    try:
        h, m = int(v[:2]), int(v[3:])
    except ValueError:
        return False
    return 0 <= h <= 23 and 0 <= m <= 59


def hhmm_min(v: str) -> int:
    return int(v[:2]) * 60 + int(v[3:])


def _check(key: str, spec: tuple[str, Any, float | None, float | None], v: Any) -> Any:
    typ, _d, lo, hi = spec
    if typ == "bool":
        if not isinstance(v, bool):
            raise Invalid("rule_invalid", [f"rules.{key}"])
        return v
    if typ == "hhmm":
        if not _hhmm_ok(v):
            raise Invalid("rule_invalid", [f"rules.{key}"])
        return v
    if isinstance(v, bool) or not isinstance(v, (int, float)) or (isinstance(v, float) and not math.isfinite(v)):
        raise Invalid("rule_invalid", [f"rules.{key}"])
    if typ == "int" and int(v) != v:
        raise Invalid("rule_invalid", [f"rules.{key}"])
    if (lo is not None and v < lo) or (hi is not None and v > hi):
        raise Invalid("rule_invalid", [f"rules.{key}"])
    return int(v) if typ == "int" else float(v)


def validate_rules(body: Any, *, installation: bool = False) -> dict[str, Any]:
    """A partial rule set (overrides or the installation defaults). `None` for a key of an override = inherit (dropped)."""
    if body is None:
        return {}
    if not isinstance(body, dict):
        raise Invalid("rule_invalid", ["rules"])
    specs = {**RULES, **(INSTALLATION if installation else {})}
    out: dict[str, Any] = {}
    for k, v in body.items():
        if k not in specs:
            raise Invalid("rule_invalid", [f"rules.{k}"])
        if v is None:
            continue
        out[k] = _check(k, specs[k], v)
    return out


def code_defaults() -> dict[str, Any]:
    return {k: s[1] for k, s in {**RULES, **INSTALLATION}.items()}


def load_defaults(conn: sqlite3.Connection) -> dict[str, Any]:
    """The installation defaults: the code defaults overlaid with the saved row (unknown or invalid saved keys are ignored)."""
    out = code_defaults()
    try:
        r = conn.execute("SELECT rules_json FROM infra_temp_settings WHERE id = 1").fetchone()
    except sqlite3.Error:
        return out
    if r is None:
        return out
    try:
        saved = json.loads(r["rules_json"] or "{}")
    except ValueError:
        saved = {}
    for k, v in (saved.items() if isinstance(saved, dict) else []):
        spec = RULES.get(k) or INSTALLATION.get(k)
        if spec is None:
            continue
        try:
            out[k] = _check(k, spec, v)
        except Invalid:
            continue
    return out


def overrides_of(raw: str | None) -> dict[str, Any]:
    try:
        d = json.loads(raw or "{}")
    except ValueError:
        return {}
    out: dict[str, Any] = {}
    for k, v in (d.items() if isinstance(d, dict) else []):
        if k in RULES and v is not None:
            try:
                out[k] = _check(k, RULES[k], v)
            except Invalid:
                continue
    return out


def effective(defaults: dict[str, Any], overrides: dict[str, Any]) -> dict[str, Any]:
    return {**defaults, **{k: v for k, v in overrides.items() if k in RULES}}


def validate_band(low: Any, high: Any) -> tuple[float, float]:
    for f, v in (("low", low), ("high", high)):
        if isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) or not T_MIN <= v <= T_MAX:
            raise Invalid("band_invalid", [f])
    if not low < high:
        raise Invalid("band_invalid", ["low", "high"])
    return float(low), float(high)


def validate_defrost(mode: Any, windows: Any) -> tuple[str, list[dict[str, Any]]]:
    if mode not in DEFROST_MODES:
        raise Invalid("defrost_invalid", ["defrost_mode"])
    wins = windows or []
    if not isinstance(wins, list) or len(wins) > MAX_FIXED_WINDOWS:
        raise Invalid("defrost_invalid", ["defrost_windows"])
    out = []
    for i, w in enumerate(wins):
        if not isinstance(w, dict) or not _hhmm_ok(w.get("start")) or isinstance(w.get("minutes"), bool) or not isinstance(w.get("minutes"), int) or not 5 <= w["minutes"] <= 180:
            raise Invalid("defrost_invalid", [f"defrost_windows.{i}"])
        out.append({"start": w["start"], "minutes": w["minutes"]})
    if mode == "fixed" and not out:
        raise Invalid("defrost_invalid", ["defrost_windows"])
    return mode, (out if mode == "fixed" else [])


# ---------------------------------------------------------------- time helpers (local wall clock of the installation zone)

def site_zone(conn: sqlite3.Connection) -> ZoneInfo:
    from ..db import get_setting

    try:
        return zone(get_setting(conn, "time.zone", "Asia/Jerusalem") or "Asia/Jerusalem")
    except Exception:  # noqa: BLE001
        return zone("Asia/Jerusalem")


def local_min(ts: float, tz: ZoneInfo) -> int:
    d = dt.datetime.fromtimestamp(ts, dt.timezone.utc).astimezone(tz)
    return d.hour * 60 + d.minute


def in_span(minute: int, start: int, length: int) -> bool:
    """`minute` (0..1439) inside [start, start + length) on the 24-hour circle (a window may cross midnight)."""
    return (minute - start) % 1440 < length


def in_quiet(rules: dict[str, Any], minute: int) -> bool:
    if not rules.get("quiet_enabled"):
        return False
    a, b = hhmm_min(rules["quiet_from"]), hhmm_min(rules["quiet_to"])
    if a == b:
        return False
    return in_span(minute, a, (b - a) % 1440)


def windows_of(defrost_mode: str, fixed: list[dict[str, Any]], learned: list[dict[str, Any]]) -> list[tuple[int, int]]:
    """The defrost windows in force as (start minute, length): the fixed ones in mode `fixed`, the learned and confirmed ones in mode `learn`
    (a rejected one never), none in mode `none`."""
    if defrost_mode == "fixed":
        return [(hhmm_min(w["start"]), int(w["minutes"])) for w in fixed]
    if defrost_mode == "learn":
        return [(int(w["start_min"]), int(w["minutes"])) for w in learned if w.get("status") in ("learned", "confirmed")]
    return []


def in_defrost(windows: list[tuple[int, int]], minute: int) -> bool:
    return any(in_span(minute, s, n) for s, n in windows)


def next_window_start(windows: list[tuple[int, int]], ts: float, tz: ZoneInfo) -> float | None:
    """The next window start after `ts` (unix seconds), or None without windows."""
    if not windows:
        return None
    now_l = local_min(ts, tz)
    base = ts - (ts % 60)
    best = min(((s - now_l) % 1440 or 1440) for s, _n in windows)
    return base + best * 60


def window_intervals(windows: list[tuple[int, int]], lo: float, hi: float, tz: ZoneInfo) -> list[tuple[float, float]]:
    """The windows as absolute intervals (unix seconds) overlapping lo..hi, per local day (DST-correct: each day is converted on its own)."""
    if not windows:
        return []
    out: list[tuple[float, float]] = []
    d0 = dt.datetime.fromtimestamp(lo, dt.timezone.utc).astimezone(tz).date() - dt.timedelta(days=1)
    d1 = dt.datetime.fromtimestamp(hi, dt.timezone.utc).astimezone(tz).date()
    day = d0
    while day <= d1:
        for s, n in windows:
            a = dt.datetime.combine(day, dt.time(s // 60, s % 60), tz).timestamp()
            b = a + n * 60
            if b > lo and a < hi:
                out.append((max(a, lo), min(b, hi)))
        day += dt.timedelta(days=1)
    return sorted(out)


# ---------------------------------------------------------------- live readings

def temp_of(state: Any, *, unit: str | None = None, available: Any = 1, removed: Any = None, disabled: Any = 0, connected: bool = True) -> float | None:
    """Degrees C for a live numeric reading; None for anything that is not one (°F is converted)."""
    if not connected or removed or disabled or not available or state is None:
        return None
    s = str(state).strip().lower()
    if s in DEAD:
        return None
    try:
        v = float(s)
    except ValueError:
        return None
    if not math.isfinite(v):
        return None
    if unit and "f" in unit.lower() and "°" in unit:
        v = (v - 32) * 5 / 9
    return round(v, 2)


def door_of(state: Any, *, invert: bool = False, available: Any = 1, removed: Any = None, disabled: Any = 0, connected: bool = True) -> bool | None:
    """True = open, False = closed, None = no live value."""
    if not connected or removed or disabled or not available or state is None:
        return None
    s = str(state).strip().lower()
    if s == "on":
        return not invert
    if s == "off":
        return invert
    return None


def is_temperature_entity(r: sqlite3.Row | dict[str, Any]) -> bool:
    """A numeric sensor of degrees (device class temperature, or a °C / °F unit), or a climate entity (it reports current_temperature)."""
    if r["domain"] == "climate":
        return True
    if r["domain"] != "sensor":
        return False
    unit = (r["unit"] or "").strip()
    return r["device_class"] == "temperature" or unit in ("°C", "°F", "C", "F", "℃", "℉")


def _num(v: Any) -> float | None:
    if isinstance(v, bool) or v is None:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return round(f, 2) if math.isfinite(f) else None


def reading_of(r: Any, *, connected: bool = True) -> dict[str, Any]:
    """The live reading of a unit's temperature source: {source, value, setpoint, setpoint_low, setpoint_high, hvac_mode, hvac_action}.
    A sensor: value from its state. A climate entity (owner 2026-10-19): value = attribute current_temperature, setpoint = attribute
    temperature (or the middle of target_temp_low / high), mode = its state, action = attribute hvac_action. No live value = None."""
    out: dict[str, Any] = {"source": "sensor", "value": None, "setpoint": None, "setpoint_low": None, "setpoint_high": None, "hvac_mode": None, "hvac_action": None}
    if r is None:
        return out
    if r["domain"] == "climate":
        out["source"] = "climate"
        if not connected or r["removed_at"] or r["disabled"] or not r["available"] or str(r["state"] or "").strip().lower() in DEAD:
            return out
        try:
            a = json.loads(r["attributes_json"] or "{}")
        except ValueError:
            a = {}
        if not isinstance(a, dict):
            a = {}
        out["value"] = _num(a.get("current_temperature"))
        lo, hi = _num(a.get("target_temp_low")), _num(a.get("target_temp_high"))
        sp = _num(a.get("temperature"))
        out["setpoint_low"], out["setpoint_high"] = lo, hi
        out["setpoint"] = sp if sp is not None else (round((lo + hi) / 2, 2) if lo is not None and hi is not None else None)
        mode = str(r["state"]).strip().lower()
        out["hvac_mode"] = mode if mode in HVAC_MODES else None
        act = a.get("hvac_action")
        out["hvac_action"] = act if isinstance(act, str) and len(act) <= 20 else None
        return out
    out["value"] = temp_of(r["state"], unit=r["unit"], available=r["available"], removed=r["removed_at"], disabled=r["disabled"], connected=connected)
    return out


def band_of(u: Any, reading: dict[str, Any], rules: dict[str, Any]) -> tuple[float, float]:
    """The band in force: the stored low..high, or for a climate unit in band mode `setpoint` the live setpoint -/+ `setpoint_tolerance`
    (a heat_cool range: its low - tolerance .. its high + tolerance). While the setpoint is unknown: the stored band."""
    if u["band_mode"] == "setpoint" and reading.get("source") == "climate":
        tol = float(rules.get("setpoint_tolerance", 2.0))
        lo, hi = reading.get("setpoint_low"), reading.get("setpoint_high")
        if reading.get("hvac_mode") == "heat_cool" and lo is not None and hi is not None:
            return round(lo - tol, 2), round(hi + tol, 2)
        sp = reading.get("setpoint")
        if sp is not None:
            return round(sp - tol, 2), round(sp + tol, 2)
    return float(u["low"]), float(u["high"])


def is_off(reading: dict[str, Any], rules: dict[str, Any]) -> bool:
    """A climate unit switched off is a state of its own - not judged against the band unless `alert_when_off`."""
    return reading.get("source") == "climate" and reading.get("hvac_mode") == "off" and not rules.get("alert_when_off")


# ---------------------------------------------------------------- storage

def units(conn: sqlite3.Connection, *, enabled_only: bool = False) -> list[sqlite3.Row]:
    sql = "SELECT * FROM infra_temp_units" + (" WHERE enabled = 1" if enabled_only else "") + " ORDER BY sort_order, name_key, id"
    return conn.execute(sql).fetchall()


def entity_rows(conn: sqlite3.Connection, ids: Iterable[str]) -> dict[str, sqlite3.Row]:
    ids = [i for i in dict.fromkeys(ids) if i]
    if not ids:
        return {}
    rows = conn.execute(f"""SELECT entity_id, name, original_name, domain, device_class, unit, state, available, removed_at, disabled, last_changed, last_updated,
                                   area_name, attributes_json FROM ha_entities WHERE entity_id IN ({','.join('?' * len(ids))})""", ids).fetchall()
    return {r["entity_id"]: r for r in rows}


def friendly(r: sqlite3.Row | None) -> str:
    return (r["name"] or r["original_name"] or "") if r is not None else ""


def learned_of(conn: sqlite3.Connection, unit_ids: Iterable[str] | None = None) -> dict[str, list[dict[str, Any]]]:
    try:
        rows = conn.execute("SELECT * FROM infra_temp_defrost_learned ORDER BY unit_id, start_min").fetchall()
    except sqlite3.Error:
        return {}
    keep = set(unit_ids) if unit_ids is not None else None
    out: dict[str, list[dict[str, Any]]] = {}
    for r in rows:
        if keep is None or r["unit_id"] in keep:
            out.setdefault(r["unit_id"], []).append(dict(r))
    return out


def fixed_of(u: sqlite3.Row) -> list[dict[str, Any]]:
    try:
        d = json.loads(u["defrost_json"] or "[]")
    except ValueError:
        return []
    return [w for w in d if isinstance(w, dict) and _hhmm_ok(w.get("start")) and isinstance(w.get("minutes"), int)] if isinstance(d, list) else []


def unit_windows(u: sqlite3.Row, learned: dict[str, list[dict[str, Any]]]) -> list[tuple[int, int]]:
    return windows_of(u["defrost_mode"], fixed_of(u), learned.get(u["id"], []))


def recipients_of(u: sqlite3.Row) -> dict[str, list[str]] | None:
    if not u["recipients_json"]:
        return None
    try:
        d = json.loads(u["recipients_json"])
    except ValueError:
        return None
    if not isinstance(d, dict):
        return None
    return {k: [x for x in (d.get(k) or []) if isinstance(x, str)] for k in ("roles", "users", "groups")}


def mirror_connected() -> bool:
    from . import ha_sync

    return bool(ha_sync.STATE.connected)


# ---------------------------------------------------------------- history: samples, rollup, query, statistics

def record_sample(conn: sqlite3.Connection, unit_id: str, ts: int, v: float, flags: int, sp: float | None = None) -> bool:
    """One raw sample for the minute of `ts` (with the climate setpoint when there is one) plus the five-minute rollup. Returns False when that
    minute was already recorded."""
    ts -= ts % 60
    cur = conn.execute("INSERT OR IGNORE INTO infra_temp_samples(unit_id, ts, v, sp, flags) VALUES (?,?,?,?,?)", (unit_id, ts, v, sp, flags))
    if cur.rowcount == 0:
        return False
    bucket = ts - ts % BUCKET_S
    d = 1 if flags & 1 else 0
    conn.execute(
        """INSERT INTO infra_temp_samples_5m(unit_id, ts, v_avg, v_min, v_max, n, n_def, sp_avg, sp_n) VALUES (?,?,?,?,?,1,?,?,?)
           ON CONFLICT(unit_id, ts) DO UPDATE SET v_avg = (v_avg * n + excluded.v_avg) / (n + 1), v_min = MIN(v_min, excluded.v_min),
             v_max = MAX(v_max, excluded.v_max), n = n + 1, n_def = n_def + excluded.n_def,
             sp_avg = CASE WHEN excluded.sp_avg IS NULL THEN sp_avg WHEN sp_avg IS NULL THEN excluded.sp_avg
                           ELSE (sp_avg * sp_n + excluded.sp_avg) / (sp_n + 1) END,
             sp_n = sp_n + excluded.sp_n""",
        (unit_id, bucket, v, v, v, d, sp, 1 if sp is not None else 0))
    return True


def parse_range(rng: str, start: str | None, end: str | None, now_ts: float) -> tuple[int, int]:
    """(from_ts, to_ts) of a request; ValueError(field) for an invalid one. Custom ranges: ISO instants with a zone, at most 400 days."""
    if rng in RANGES:
        return int(now_ts - RANGES[rng]), int(now_ts)
    if rng != "custom":
        raise ValueError("range")
    try:
        a = parse_utc(start or "")
        b = parse_utc(end) if end else dt.datetime.fromtimestamp(now_ts, dt.timezone.utc)
    except (ValueError, TypeError):
        raise ValueError("from") from None
    lo, hi = int(a.timestamp()), int(b.timestamp())
    if hi <= lo or hi - lo > 400 * 86400:
        raise ValueError("to")
    return lo, hi


def series(conn: sqlite3.Connection, unit_id: str, lo: int, hi: int, now_ts: float, max_points: int = MAX_POINTS) -> dict[str, Any]:
    """Points [ts, avg, min, max, def, setpoint] over lo..hi (unix seconds). The raw minute table answers when the range lies inside its
    retention and is short enough; the five-minute rollup otherwise. Buckets are merged so the series never exceeds `max_points`. `def` = the
    bucket was mostly inside a defrost window; `setpoint` = the climate unit's mean setpoint (None for a sensor unit). A gap in the data is a
    gap in the list (never interpolated)."""
    span = hi - lo
    raw = lo >= now_ts - RAW_KEEP_S and span <= 3 * 86400
    if raw:
        rows = conn.execute("""SELECT ts, v AS a, v AS mn, v AS mx, 1 AS n, (flags & 1) AS d, sp, CASE WHEN sp IS NULL THEN 0 ELSE 1 END AS spn
                               FROM infra_temp_samples WHERE unit_id = ? AND ts >= ? AND ts <= ? ORDER BY ts""", (unit_id, lo, hi)).fetchall()
        step = 60
    else:
        rows = conn.execute("""SELECT ts, v_avg AS a, v_min AS mn, v_max AS mx, n, n_def AS d, sp_avg AS sp, sp_n AS spn FROM infra_temp_samples_5m
                               WHERE unit_id = ? AND ts >= ? AND ts <= ? ORDER BY ts""", (unit_id, lo - lo % BUCKET_S, hi)).fetchall()
        step = BUCKET_S
    width = step
    while span / width > max_points:
        width *= 2
    pts: list[list[Any]] = []
    acc: dict[int, list[float]] = {}
    order: list[int] = []
    for r in rows:
        b = int(r["ts"]) - (int(r["ts"]) - lo) % width if width > step else int(r["ts"])
        if b not in acc:
            acc[b] = [0.0, math.inf, -math.inf, 0, 0, 0.0, 0]
            order.append(b)
        x = acc[b]
        x[0] += r["a"] * r["n"]
        x[1] = min(x[1], r["mn"])
        x[2] = max(x[2], r["mx"])
        x[3] += r["n"]
        x[4] += r["d"]
        if r["sp"] is not None and r["spn"]:
            x[5] += r["sp"] * r["spn"]
            x[6] += r["spn"]
    for b in order:
        x = acc[b]
        pts.append([b, round(x[0] / x[3], 2), round(x[1], 2), round(x[2], 2), 1 if x[4] * 2 > x[3] else 0, round(x[5] / x[6], 2) if x[6] else None])
    return {"from": lo, "to": hi, "step": width, "source": "raw" if raw else "5m", "points": pts}


def door_intervals(conn: sqlite3.Connection, unit_id: str, lo: int, hi: int, now_ts: float) -> list[list[int]]:
    rows = conn.execute("""SELECT opened_at, closed_at FROM infra_temp_doors WHERE unit_id = ? AND opened_at < ? AND (closed_at IS NULL OR closed_at > ?)
                           ORDER BY opened_at""", (unit_id, iso_utc(dt.datetime.fromtimestamp(hi, dt.timezone.utc)), iso_utc(dt.datetime.fromtimestamp(lo, dt.timezone.utc)))).fetchall()
    out = []
    for r in rows:
        a = parse_utc(r["opened_at"]).timestamp()
        b = parse_utc(r["closed_at"]).timestamp() if r["closed_at"] else now_ts
        out.append([int(max(a, lo)), int(min(b, hi))])
    return out


def stats(conn: sqlite3.Connection, u: sqlite3.Row, rules: dict[str, Any], lo: int, hi: int, now_ts: float) -> dict[str, Any]:
    """min / max / avg, minutes out of the band (excluding defrost time when `exclude_defrost_stats`; `out_min_raw` always counts everything),
    door openings (count, total, longest) and the alert counts of lo..hi. From the raw minutes inside their retention, else the rollup."""
    low, high = u["low"], u["high"]
    tol = float(rules.get("setpoint_tolerance", 2.0))
    by_sp = u["band_mode"] == "setpoint"
    raw = lo >= now_ts - RAW_KEEP_S
    # each sample: (avg, min, max, n, skip, low, high); skip = inside a defrost window, or a climate unit switched off (flag 4)
    if raw:
        rows = conn.execute("SELECT v, sp, flags FROM infra_temp_samples WHERE unit_id = ? AND ts >= ? AND ts < ?", (u["id"], lo, hi)).fetchall()
        vals = [(r["v"], r["v"], r["v"], 1, r["flags"] & 5, *((r["sp"] - tol, r["sp"] + tol) if by_sp and r["sp"] is not None else (low, high))) for r in rows]
        per = 1
    else:
        rows = conn.execute("SELECT v_avg, v_min, v_max, n, n_def, sp_avg FROM infra_temp_samples_5m WHERE unit_id = ? AND ts >= ? AND ts < ?", (u["id"], lo - lo % BUCKET_S, hi)).fetchall()
        vals = [(r["v_avg"], r["v_min"], r["v_max"], r["n"], 1 if r["n_def"] * 2 > r["n"] else 0,
                 *((r["sp_avg"] - tol, r["sp_avg"] + tol) if by_sp and r["sp_avg"] is not None else (low, high))) for r in rows]
        per = 5
    out: dict[str, Any] = {"min": None, "max": None, "avg": None, "out_min": 0, "out_min_raw": 0, "samples": len(vals), "source": "raw" if raw else "5m"}
    if vals:
        out["min"] = round(min(v[1] for v in vals), 2)
        out["max"] = round(max(v[2] for v in vals), 2)
        n = sum(v[3] for v in vals)
        out["avg"] = round(sum(v[0] * v[3] for v in vals) / n, 2) if n else None
        for a, _mn, _mx, _n, d, blo, bhi in vals:
            if d & 4:
                continue  # a climate unit switched off is not "out of range" (owner 2026-10-19: off is a state)
            if a > bhi or a < blo:
                out["out_min_raw"] += per
                if not (d & 1 and rules.get("exclude_defrost_stats", True)):
                    out["out_min"] += per
    doors = door_intervals(conn, u["id"], lo, hi, now_ts)
    out["door_opens"] = len(doors)
    out["door_total_min"] = round(sum(b - a for a, b in doors) / 60)
    out["door_longest_min"] = round(max((b - a for a, b in doors), default=0) / 60)
    a_iso, b_iso = iso_utc(dt.datetime.fromtimestamp(lo, dt.timezone.utc)), iso_utc(dt.datetime.fromtimestamp(hi, dt.timezone.utc))
    out["alarms"] = conn.execute("SELECT COUNT(*) FROM infra_temp_events WHERE unit_id = ? AND alarmed_at IS NOT NULL AND started_at < ? AND (ended_at IS NULL OR ended_at >= ?)",
                                 (u["id"], b_iso, a_iso)).fetchone()[0]
    out["warnings"] = conn.execute("SELECT COUNT(*) FROM infra_temp_events WHERE unit_id = ? AND severity = 'warning' AND kind IN ('high','low','offline') AND started_at < ? AND (ended_at IS NULL OR ended_at >= ?)",
                                   (u["id"], b_iso, a_iso)).fetchone()[0]
    return out


def trend_of(conn: sqlite3.Connection, unit_id: str, now_ts: float) -> str | None:
    """`up` / `down` / `flat` from the last 30 minutes of raw samples (a change of 0.4 degrees or more), None with too few samples."""
    rows = conn.execute("SELECT ts, v FROM infra_temp_samples WHERE unit_id = ? AND ts >= ? ORDER BY ts", (unit_id, int(now_ts) - 1800)).fetchall()
    if len(rows) < 6:
        return None
    d = rows[-1]["v"] - rows[0]["v"]
    return "up" if d >= 0.4 else "down" if d <= -0.4 else "flat"


def rate_per_min(conn: sqlite3.Connection, unit_id: str, now_ts: float, minutes: int = 30) -> float | None:
    """Least-squares slope (degrees per minute) over the last `minutes` of raw samples; None with fewer than 6 samples."""
    rows = conn.execute("SELECT ts, v FROM infra_temp_samples WHERE unit_id = ? AND ts >= ? ORDER BY ts", (unit_id, int(now_ts) - minutes * 60)).fetchall()
    if len(rows) < 6:
        return None
    xs = [(r["ts"] - rows[0]["ts"]) / 60 for r in rows]
    ys = [r["v"] for r in rows]
    mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
    den = sum((x - mx) ** 2 for x in xs)
    if den == 0:
        return None
    return sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / den


def prune(conn: sqlite3.Connection, now_ts: float, retention_days: int) -> dict[str, int]:
    raw = conn.execute("DELETE FROM infra_temp_samples WHERE ts < ?", (int(now_ts - RAW_KEEP_S),)).rowcount
    agg = conn.execute("DELETE FROM infra_temp_samples_5m WHERE ts < ?", (int(now_ts - retention_days * 86400),)).rowcount
    cutoff = iso_utc(dt.datetime.fromtimestamp(now_ts - retention_days * 86400, dt.timezone.utc))
    ev = conn.execute("DELETE FROM infra_temp_events WHERE ended_at IS NOT NULL AND ended_at < ?", (cutoff,)).rowcount
    dr = conn.execute("DELETE FROM infra_temp_doors WHERE closed_at IS NOT NULL AND closed_at < ?", (cutoff,)).rowcount
    return {"raw": raw, "rollup": agg, "events": ev, "doors": dr}


def summary(statuses: list[str]) -> dict[str, int]:
    out = {s: 0 for s in STATUSES}
    for s in statuses:
        out[s] = out.get(s, 0) + 1
    return out
