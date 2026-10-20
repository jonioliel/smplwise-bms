"""CR-INFRA-TEMPERATURE phase 3: what the stored history says about a unit beyond its band - all derived, never a reading.

* door <-> temperature (idea 2): per door opening the baseline before it, the peak during and after it, the rise and the RECOVERY time (from
  the closing until the reading is back near its baseline). A unit whose median recovery is slower than `recovery_slow_min` with at least
  MIN_OPENS openings is "slow": a suspected cooling fault (seal, gas, a dirty condenser) rather than a behaviour problem;
* compressor duty cycle (idea 6, needs an optional power sensor - a smart plug or a current meter, READ only): the share of minutes at or above
  `compressor_on_w` per local day; the last 3 full days against the 4 before (`duty_rise_pts`) = rising;
* sensor health (idea 8): the battery and the signal of the temperature sensor's own device (sibling entities of the same device: a battery
  percentage / a battery-low binary sensor, a signal strength in dBm or a link quality), the age of the reading, and a FROZEN reading (the
  same value for `frozen_min` minutes while the sensor reports - a stuck sensor looks "fine" otherwise).

The door and duty figures are recomputed hourly (services/temperature_runtime.py) into `infra_temp_insights` (migration 0125); the health is
cheap and computed live. Pure functions first (the unit tests drive them with synthetic series), storage after."""
from __future__ import annotations

import datetime as dt
import json
import sqlite3
import statistics
from typing import Any
from zoneinfo import ZoneInfo

from .timeutil import iso_utc, parse_utc

MIN_OPENS = 3              # a recovery verdict needs at least this many recovered openings
RECOVERY_CAP_MIN = 180     # not back after this long = "not recovered" (counted, excluded from the median)
BASE_WINDOW_S = 600        # the baseline: the median of the 10 minutes before the opening
PEAK_AFTER_S = 3600        # the peak is looked for until an hour after the closing
DOOR_DAYS = 7
DUTY_DAYS = 7
RUN_EVERY_S = 3600
LQI_WEAK = 40              # a zigbee link quality (0..255) below this is weak


# ---------------------------------------------------------------- door <-> temperature (pure)

def door_effects(points: list[tuple[float, float]], doors: list[tuple[float, float | None]], end_ts: float) -> list[dict[str, Any]]:
    """Per CLOSED door opening (opened, closed) over minute points [(ts, v)] sorted: {opened, closed, open_min, base, peak, rise, recovery_min}.
    recovery_min = None when the reading did not come back within RECOVERY_CAP_MIN, or the next opening interrupted it (then `interrupted`)."""
    out: list[dict[str, Any]] = []
    ds = sorted((a, b) for a, b in doors if b is not None)
    for i, (a, b) in enumerate(ds):
        before = [v for t, v in points if a - BASE_WINDOW_S <= t < a]
        if not before:
            continue
        base = statistics.median(before)
        nxt = ds[i + 1][0] if i + 1 < len(ds) else None
        horizon = min(x for x in (b + PEAK_AFTER_S, nxt, end_ts) if x is not None)
        during = [v for t, v in points if a <= t <= horizon]
        if not during:
            continue
        peak = max(during)
        rise = round(peak - base, 2)
        target = base + max(0.3, rise * 0.2)
        rec: float | None = None
        interrupted = False
        for t, v in points:
            if t < b:
                continue
            if nxt is not None and t >= nxt:
                interrupted = True
                break
            if t - b > RECOVERY_CAP_MIN * 60:
                break
            if v <= target:
                rec = (t - b) / 60
                break
        out.append({"opened": int(a), "closed": int(b), "open_min": round((b - a) / 60, 1), "base": round(base, 2), "peak": round(peak, 2), "rise": rise,
                    "recovery_min": None if rec is None else round(rec, 1), "interrupted": interrupted and rec is None})
    return out


def door_summary(effects: list[dict[str, Any]], slow_min: int) -> dict[str, Any]:
    """{opens, avg_rise, max_rise, median_recovery_min, unrecovered, slow}. `slow` needs MIN_OPENS recovered openings."""
    rec = [e["recovery_min"] for e in effects if e["recovery_min"] is not None]
    unrec = sum(1 for e in effects if e["recovery_min"] is None and not e["interrupted"])
    rises = [e["rise"] for e in effects]
    med = round(statistics.median(rec), 1) if rec else None
    return {"opens": len(effects), "avg_rise": round(sum(rises) / len(rises), 2) if rises else None, "max_rise": max(rises) if rises else None,
            "median_recovery_min": med, "unrecovered": unrec, "slow": bool(len(rec) >= MIN_OPENS and med is not None and med > slow_min)}


# ---------------------------------------------------------------- compressor duty cycle (pure)

def duty_days(buckets: list[tuple[float, int, int]], tz: ZoneInfo, lo: float, hi: float) -> list[dict[str, Any]]:
    """Per local day of lo..hi from five-minute buckets [(ts, pw_n, on_n)]: {day, pct, minutes} (pct None without a power reading)."""
    acc: dict[str, list[int]] = {}
    for ts, pw_n, on_n in buckets:
        if not lo <= ts < hi:
            continue
        day = dt.datetime.fromtimestamp(ts, dt.timezone.utc).astimezone(tz).date().isoformat()
        x = acc.setdefault(day, [0, 0])
        x[0] += pw_n
        x[1] += on_n
    out = []
    for day in sorted(acc):
        pw_n, on_n = acc[day]
        out.append({"day": day, "pct": round(100 * on_n / pw_n, 1) if pw_n else None, "minutes": pw_n})
    return out


def duty_summary(days: list[dict[str, Any]], rise_pts: int, today: str) -> dict[str, Any]:
    """{pct_24h-like latest, recent (last 3 full days), before (the 4 before), rising}. Today (partial) is shown, never judged."""
    full = [d for d in days if d["day"] != today and d["pct"] is not None and d["minutes"] >= 600]  # a judged day needs 10 h of power readings
    recent, before = full[-3:], full[-7:-3]
    r = round(sum(d["pct"] for d in recent) / len(recent), 1) if recent else None
    b = round(sum(d["pct"] for d in before) / len(before), 1) if before else None
    return {"recent": r, "before": b, "rising": bool(r is not None and b is not None and len(recent) >= 2 and len(before) >= 2 and r - b >= rise_pts),
            "today": next((d["pct"] for d in days if d["day"] == today), None)}


# ---------------------------------------------------------------- sensor health (live)

def _f(v: Any) -> float | None:
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    return x if x == x else None


def siblings(conn: sqlite3.Connection, device_id: str | None, exclude: str) -> list[sqlite3.Row]:
    if not device_id:
        return []
    return conn.execute("""SELECT entity_id, name, original_name, domain, device_class, unit, state, available, removed_at, disabled FROM ha_entities
                           WHERE device_id = ? AND entity_id != ? AND removed_at IS NULL AND disabled = 0""", (device_id, exclude)).fetchall()


def frozen_since(conn: sqlite3.Connection, unit_id: str, now_ts: float, minutes: int) -> str | None:
    """The ISO instant since when the sensor reports the SAME value, when that has lasted at least `minutes` with the readings live for most of
    it (80 %); None otherwise (or with `minutes` = 0)."""
    if minutes <= 0:
        return None
    lo = int(now_ts) - minutes * 60
    r = conn.execute("SELECT COUNT(*), MIN(v), MAX(v) FROM infra_temp_samples WHERE unit_id = ? AND ts >= ?", (unit_id, lo)).fetchone()
    if not r or not r[0] or r[0] < minutes * 0.8 or r[1] != r[2]:
        return None
    last_diff = conn.execute("SELECT MAX(ts) FROM infra_temp_samples WHERE unit_id = ? AND ts < ? AND v != ?", (unit_id, lo, r[1])).fetchone()
    since = (last_diff[0] + 60) if last_diff and last_diff[0] else lo
    return iso_utc(dt.datetime.fromtimestamp(since, dt.timezone.utc))


def health(conn: sqlite3.Connection, unit_id: str, temp: sqlite3.Row | None, source: str, rules: dict[str, Any], now_ts: float,
           *, connected: bool = True) -> dict[str, Any]:
    """{battery, battery_low, signal, signal_unit, signal_weak, age_min, frozen_since, issues: [...]} of the unit's temperature sensor."""
    out: dict[str, Any] = {"battery": None, "battery_low": False, "signal": None, "signal_unit": None, "signal_weak": False, "age_min": None,
                           "frozen_since": None, "issues": []}
    if temp is None:
        return out
    stamp = temp["last_changed"] or temp["last_updated"]
    if stamp:
        try:
            out["age_min"] = max(0, int((now_ts - parse_utc(stamp).timestamp()) / 60))
        except (ValueError, TypeError):
            pass
    for s in siblings(conn, temp["device_id"] if "device_id" in temp.keys() else None, temp["entity_id"]):
        if not s["available"] or str(s["state"] or "").lower() in ("unknown", "unavailable", ""):
            continue
        dc = s["device_class"] or ""
        if dc == "battery" and s["domain"] == "sensor" and out["battery"] is None:
            out["battery"] = _f(s["state"])
        elif dc == "battery" and s["domain"] == "binary_sensor":
            out["battery_low"] = out["battery_low"] or s["state"] == "on"
        elif dc == "signal_strength" and s["domain"] == "sensor" and out["signal"] is None:
            out["signal"], out["signal_unit"] = _f(s["state"]), "dBm"
        elif s["domain"] == "sensor" and out["signal"] is None and str(s["entity_id"]).endswith("linkquality"):
            out["signal"], out["signal_unit"] = _f(s["state"]), "lqi"
    if out["battery"] is not None and out["battery"] <= int(rules.get("battery_low_pct", 20)):
        out["battery_low"] = True
    if out["signal"] is not None:
        out["signal_weak"] = out["signal"] < (int(rules.get("signal_weak_dbm", -85)) if out["signal_unit"] == "dBm" else LQI_WEAK)
    if source == "sensor" and connected:  # a climate entity's current temperature often has whole-degree steps: never judged frozen
        out["frozen_since"] = frozen_since(conn, unit_id, now_ts, int(rules.get("frozen_min", 360)))
    if out["battery_low"]:
        out["issues"].append("battery")
    if out["frozen_since"]:
        out["issues"].append("frozen")
    if out["signal_weak"]:
        out["issues"].append("signal")
    return out


# ---------------------------------------------------------------- storage

def compute(conn: sqlite3.Connection, u: sqlite3.Row, rules: dict[str, Any], tz: ZoneInfo, now_ts: float) -> dict[str, Any]:
    """The hourly figures of one unit: door effects of the last DOOR_DAYS days and the duty cycle of the last DUTY_DAYS days."""
    from . import temperature as t

    lo = int(now_ts - DOOR_DAYS * 86400)
    data: dict[str, Any] = {"door": None, "duty": None}
    if u["door_entity_id"]:
        pts = [(float(r["ts"]), float(r["v"])) for r in conn.execute("SELECT ts, v FROM infra_temp_samples WHERE unit_id = ? AND ts >= ? ORDER BY ts",
                                                                    (u["id"], lo - BASE_WINDOW_S)).fetchall()]
        doors = [(float(a), float(b)) for a, b in t.door_intervals(conn, u["id"], lo, int(now_ts), now_ts)]
        # door_intervals clips an opening still open at now_ts; only CLOSED openings are judged
        open_now = conn.execute("SELECT opened_at FROM infra_temp_doors WHERE unit_id = ? AND closed_at IS NULL", (u["id"],)).fetchone()
        if open_now is not None:
            st = parse_utc(open_now["opened_at"]).timestamp()
            doors = [d for d in doors if d[0] < st - 1]
        eff = door_effects(pts, doors, now_ts)
        data["door"] = {**door_summary(eff, int(rules.get("recovery_slow_min", 30))), "last": eff[-5:]}
    if u["power_entity_id"]:
        dlo = int(now_ts - DUTY_DAYS * 86400)
        rows = conn.execute("SELECT ts, pw_n, on_n FROM infra_temp_samples_5m WHERE unit_id = ? AND ts >= ? ORDER BY ts", (u["id"], dlo - dlo % 300)).fetchall()
        days = duty_days([(float(r["ts"]), int(r["pw_n"]), int(r["on_n"])) for r in rows], tz, dlo, now_ts + 1)
        today = dt.datetime.fromtimestamp(now_ts, dt.timezone.utc).astimezone(tz).date().isoformat()
        r24 = conn.execute("SELECT SUM(pw_n), SUM(on_n) FROM infra_temp_samples_5m WHERE unit_id = ? AND ts >= ?", (u["id"], int(now_ts - 86400))).fetchone()
        data["duty"] = {**duty_summary(days, int(rules.get("duty_rise_pts", 15)), today), "days": days,
                        "pct_24h": round(100 * r24[1] / r24[0], 1) if r24 and r24[0] else None}
    conn.execute("""INSERT INTO infra_temp_insights(unit_id, data_json, computed_at) VALUES (?,?,?)
                    ON CONFLICT(unit_id) DO UPDATE SET data_json = excluded.data_json, computed_at = excluded.computed_at""",
                 (u["id"], json.dumps(data, ensure_ascii=False), iso_utc(dt.datetime.fromtimestamp(now_ts, dt.timezone.utc))))
    return data


def load(conn: sqlite3.Connection, unit_ids: list[str] | None = None) -> dict[str, dict[str, Any]]:
    try:
        rows = conn.execute("SELECT unit_id, data_json, computed_at FROM infra_temp_insights").fetchall()
    except sqlite3.Error:
        return {}
    keep = set(unit_ids) if unit_ids is not None else None
    out: dict[str, dict[str, Any]] = {}
    for r in rows:
        if keep is not None and r["unit_id"] not in keep:
            continue
        try:
            d = json.loads(r["data_json"] or "{}")
        except ValueError:
            d = {}
        out[r["unit_id"]] = {**(d if isinstance(d, dict) else {}), "computed_at": r["computed_at"]}
    return out
