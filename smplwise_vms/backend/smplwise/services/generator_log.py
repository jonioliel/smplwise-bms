"""GENLOG092-295 (board row r092): the generator run log - every engine run (start tests, mains-failure runs, manual runs), its run hours
and fuel, the fuel refills and unexplained drops, and the test cadence (when the last test ran, when the next one is due).

Read-only and explanatory like the rest of the generator screen: everything is DERIVED from the values the state mirror already holds
(services/generator_core.read_values_bulk) on the generator tick (services/generator_runtime.py, every 15 s). Nothing is sent to the
controller, nothing is scheduled, nothing starts or stops an engine. Storage: migration `generator_run_log` (provisional 0175).

Running = the controller's "generator running" flag, else the engine state (running / cooling = running; stopped / fault = not), else the
rpm at or above the `running_rpm` threshold. An unknown reading changes nothing; a run without any reading for `no_data_close_min` is
closed at its last running reading (end_reason no_data). A run shorter than `min_run_s` is a blip and is not kept.

Classification of a run (decided at the start, refined while it lasts; the strongest signal wins and sticks):
  mains_failure - the mains were seen lost during the run or within `mains_lookback_s` before its start;
  test          - the controller is in test mode, or its last-start reason says test / exercise; or (`classify_unloaded_as_test`) a run
                  that never carried the load, with the mains present, no longer than `test_max_minutes`;
  manual        - the controller is in manual mode;
  other         - none of the above.
Every threshold and window is an installation setting (`generator.log`, Settings > Infrastructure > Generator > run log); the screen itself
is behind the default-off switch `generator.log_enabled` (the tracker records regardless, so the history exists once it is turned on)."""
from __future__ import annotations

import datetime as dt
import math
import re
import sqlite3
from typing import Any

from ..db import new_id
from . import generator_catalog as cat
from . import generator_core as core
from .timeutil import iso_utc

# key -> (type, default, min, max). type: int | float | bool
LOG_SPECS: dict[str, tuple[str, Any, float | None, float | None]] = {
    "min_run_s": ("int", 60, 10, 900),                 # shorter = a blip, not a run
    "mains_lookback_s": ("int", 120, 0, 1800),         # mains lost this long before the start still makes it a mains-failure run
    "test_min_minutes": ("int", 10, 1, 120),           # a test run shorter than this is marked short
    "test_max_minutes": ("int", 60, 5, 480),           # an unloaded run longer than this is not taken for a test
    "classify_unloaded_as_test": ("bool", True, None, None),
    "test_interval_days": ("int", 7, 0, 90),           # the expected cadence of test runs; 0 = not tracked
    "no_data_close_min": ("int", 30, 5, 1440),
    "refill_min_pct": ("float", 10.0, 2, 80),
    "refill_settle_min": ("int", 10, 1, 120),
    "drop_min_pct": ("float", 5.0, 1, 50),
    "fuel_window_h": ("int", 6, 1, 72),
    "retention_days": ("int", 730, 30, 1825),
}
KINDS = ("test", "mains_failure", "manual", "other")
PAGE_MAX = 50
RANGES = {"7d": 7 * 86400, "30d": 30 * 86400, "90d": 90 * 86400, "365d": 365 * 86400}
# the sticky reasons and their strength: a stronger one replaces a weaker one, never the other way
STICKY = {"mains_lost": 5, "mode_test": 4, "start_reason": 4, "mode_manual": 3}
_TEST_RX = re.compile(r"test|exercise|scheduled|מבחן|תרגול", re.I)
_MAINS_RX = re.compile(r"mains|utility|grid|fail|outage|רשת|הפסקת|נפילת", re.I)
_MANUAL_RX = re.compile(r"manual|remote|ידני", re.I)


class Invalid(ValueError):
    def __init__(self, key: str) -> None:
        super().__init__(key)
        self.key = key


# ---------------------------------------------------------------- settings

def settings(conn: sqlite3.Connection) -> dict[str, Any]:
    """The run log settings in force: the code defaults overlaid with the saved ones (an invalid saved value is ignored)."""
    out = {k: s[1] for k, s in LOG_SPECS.items()}
    stored = core.jget(conn, "generator.log", {})
    for k, v in (stored.items() if isinstance(stored, dict) else []):
        if k in LOG_SPECS:
            try:
                out[k] = check(k, v)
            except Invalid:
                continue
    return out


def enabled(conn: sqlite3.Connection) -> bool:
    return core.jget(conn, "generator.log_enabled", False) is True


def check(key: str, v: Any) -> Any:
    typ, _d, lo, hi = LOG_SPECS[key]
    if typ == "bool":
        if not isinstance(v, bool):
            raise Invalid(key)
        return v
    if isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(float(v)):
        raise Invalid(key)
    if typ == "int" and int(v) != v:
        raise Invalid(key)
    if (lo is not None and v < lo) or (hi is not None and v > hi):
        raise Invalid(key)
    return int(v) if typ == "int" else float(v)


def validate(body: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in body.items():
        if k not in LOG_SPECS:
            raise Invalid(k)
        out[k] = check(k, v)
    return out


def specs_out() -> dict[str, dict[str, Any]]:
    return {k: {"type": s[0], "default": s[1], "min": s[2], "max": s[3]} for k, s in LOG_SPECS.items()}


# ---------------------------------------------------------------- pure readings of the live values

def _val(values: dict[str, dict[str, Any]], role: str) -> Any:
    v = values.get(role)
    return v["value"] if v and v.get("available") and v.get("value") is not None else None


def running_of(values: dict[str, dict[str, Any]], running_rpm: float) -> bool | None:
    """True / False / None (unknown) from the running flag, else the engine state, else the rpm."""
    flag = _val(values, "generator_running")
    if isinstance(flag, bool):
        return flag
    es = _val(values, "engine_state")
    if es in ("running", "cooling"):
        return True
    if es in ("stopped", "fault"):
        return False
    rpm = _val(values, "rpm")
    if isinstance(rpm, (int, float)) and not isinstance(rpm, bool):
        return float(rpm) >= running_rpm
    return None


def mains_of(values: dict[str, dict[str, Any]], v_min: float) -> bool | None:
    """True = mains present, False = lost, None = no mains sensor: the mains flag, else the mains voltages against the minimum voltage."""
    flag = _val(values, "mains_available")
    if isinstance(flag, bool):
        return flag
    volts = [_val(values, r) for r in cat.MAINS_V]
    volts = [float(x) for x in volts if isinstance(x, (int, float)) and not isinstance(x, bool)]
    if volts:
        return max(volts) >= v_min
    return None


def on_load_of(values: dict[str, dict[str, Any]]) -> bool:
    """The generator carries the site's load: the on-load flag, the transfer switch / supply source on the generator, or real output."""
    if _val(values, "on_load") is True:
        return True
    if _val(values, "ats_position") == "generator" or _val(values, "supply_source") == "generator":
        return True
    kw, pct = _val(values, "gen_kw"), _val(values, "load_pct")
    return (isinstance(kw, (int, float)) and kw > 0.5) or (isinstance(pct, (int, float)) and pct >= 2)


def start_reason_kind(text: Any) -> str | None:
    if not isinstance(text, str) or not text.strip():
        return None
    if _TEST_RX.search(text):
        return "test"
    if _MAINS_RX.search(text):
        return "mains_failure"
    if _MANUAL_RX.search(text):
        return "manual"
    return None


def sticky_of(*, mode: Any, reason_kind: str | None, mains_lost_near: bool) -> tuple[str, str] | None:
    """The strongest sticky observation of this tick: (kind, reason) or None."""
    if mains_lost_near:
        return ("mains_failure", "mains_lost")
    if mode == "test":
        return ("test", "mode_test")
    if reason_kind in ("test", "mains_failure", "manual"):
        return (reason_kind, "start_reason")
    if mode == "manual":
        return ("manual", "mode_manual")
    return None


def decide(prev_kind: str, prev_reason: str | None, obs: tuple[str, str] | None, *, took_load: bool, mains_present: bool | None,
           duration_s: float, cfg: dict[str, Any]) -> tuple[str, str]:
    """The run's kind after this tick: a sticky reason holds unless a stronger one is seen; without one, an unloaded run with the mains
    present (and not longer than `test_max_minutes`) is a test when `classify_unloaded_as_test`, else other."""
    if prev_reason in STICKY and (obs is None or STICKY[prev_reason] >= STICKY[obs[1]]):
        return prev_kind, prev_reason
    if obs is not None:
        return obs
    if cfg["classify_unloaded_as_test"] and not took_load and mains_present is not False and duration_s <= int(cfg["test_max_minutes"]) * 60:
        return "test", "unloaded"
    return "other", "none"


# ---------------------------------------------------------------- the tracker (one pass per tick)

def _state(conn: sqlite3.Connection, device_id: str) -> dict[str, Any]:
    r = conn.execute("SELECT * FROM generator_log_state WHERE device_id = ?", (device_id,)).fetchone()
    if r is None:
        conn.execute("INSERT INTO generator_log_state(device_id) VALUES (?)", (device_id,))
        return {"device_id": device_id, "mains_lost_ts": None, "fuel_anchor_pct": None, "fuel_anchor_ts": None, "refill_from_pct": None,
                "refill_from_ts": None, "refill_peak_pct": None, "refill_last_ts": None}
    return dict(r)


def _save_state(conn: sqlite3.Connection, st: dict[str, Any]) -> None:
    conn.execute("""UPDATE generator_log_state SET mains_lost_ts = ?, fuel_anchor_pct = ?, fuel_anchor_ts = ?, refill_from_pct = ?, refill_from_ts = ?,
                    refill_peak_pct = ?, refill_last_ts = ? WHERE device_id = ?""",
                 (st["mains_lost_ts"], st["fuel_anchor_pct"], st["fuel_anchor_ts"], st["refill_from_pct"], st["refill_from_ts"], st["refill_peak_pct"],
                  st["refill_last_ts"], st["device_id"]))


def _num(x: Any) -> float | None:
    return float(x) if isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(float(x)) else None


def _close(conn: sqlite3.Connection, run: sqlite3.Row, end_ts: int, reason: str, values: dict[str, dict[str, Any]] | None, cfg: dict[str, Any],
           mains_present: bool | None) -> str:
    """Close an open run; a blip (shorter than `min_run_s`) is dropped. Returns closed | dropped."""
    if end_ts - run["start_ts"] < int(cfg["min_run_s"]):
        conn.execute("DELETE FROM generator_runs WHERE id = ?", (run["id"],))
        return "dropped"
    kind, why = run["kind"], run["kind_reason"]
    if why == "unloaded":  # the final word on an unloaded run: its whole length counts now
        kind, why = decide("other", None, None, took_load=bool(run["took_load"]), mains_present=mains_present, duration_s=end_ts - run["start_ts"], cfg=cfg)
    v = values or {}
    conn.execute("UPDATE generator_runs SET end_ts = ?, end_reason = ?, kind = ?, kind_reason = ?, hours_end = ?, fuel_end_pct = ?, fuel_end_l = ? WHERE id = ?",
                 (end_ts, reason, kind, why, _num(_val(v, "run_hours")), _num(_val(v, "fuel_pct")), _num(_val(v, "fuel_l")), run["id"]))
    return "closed"


def _fuel(conn: sqlite3.Connection, st: dict[str, Any], device_id: str, pct: float | None, ts: int, running: bool, cfg: dict[str, Any]) -> int:
    """The fuel events of one tick. Returns the events written (0 / 1)."""
    if pct is None:
        return 0
    if st["refill_from_pct"] is not None:  # a refill being folded: until the level stops rising for `refill_settle_min`
        if pct > float(st["refill_peak_pct"]) + 0.5:
            st["refill_peak_pct"], st["refill_last_ts"] = pct, ts
            return 0
        if ts - int(st["refill_last_ts"]) < int(cfg["refill_settle_min"]) * 60:
            return 0
        conn.execute("INSERT INTO generator_fuel_events(id, device_id, kind, start_ts, end_ts, from_pct, to_pct) VALUES (?,?, 'refill', ?,?,?,?)",
                     (new_id(), device_id, st["refill_from_ts"], st["refill_last_ts"], st["refill_from_pct"], st["refill_peak_pct"]))
        st.update(refill_from_pct=None, refill_from_ts=None, refill_peak_pct=None, refill_last_ts=None, fuel_anchor_pct=pct, fuel_anchor_ts=ts)
        return 1
    anchor = st["fuel_anchor_pct"]
    if anchor is None or (not running and ts - int(st["fuel_anchor_ts"] or ts) > int(cfg["fuel_window_h"]) * 3600):
        st["fuel_anchor_pct"], st["fuel_anchor_ts"] = pct, ts
        return 0
    if pct - float(anchor) >= float(cfg["refill_min_pct"]):
        st.update(refill_from_pct=float(anchor), refill_from_ts=int(st["fuel_anchor_ts"] or ts), refill_peak_pct=pct, refill_last_ts=ts)
        return 0
    if running:  # consumption while the engine runs is expected: the anchor follows the level
        st["fuel_anchor_pct"], st["fuel_anchor_ts"] = pct, ts
        return 0
    if float(anchor) - pct >= float(cfg["drop_min_pct"]):
        conn.execute("INSERT INTO generator_fuel_events(id, device_id, kind, start_ts, end_ts, from_pct, to_pct) VALUES (?,?, 'drop', ?,?,?,?)",
                     (new_id(), device_id, int(st["fuel_anchor_ts"] or ts), ts, float(anchor), pct))
        st["fuel_anchor_pct"], st["fuel_anchor_ts"] = pct, ts
        return 1
    return 0


def track(conn: sqlite3.Connection, now_ts: float, values_by_device: dict[str, dict[str, dict[str, Any]]] | None = None) -> dict[str, int]:
    """One pass over every live generator. Returns {started, closed, fuel}."""
    ts = int(now_ts)
    cfg = settings(conn)
    out = {"started": 0, "closed": 0, "fuel": 0}
    vb = core.read_values_bulk(conn) if values_by_device is None else values_by_device
    devices = [r[0] for r in conn.execute("SELECT id FROM generator_devices WHERE status <> 'removed'").fetchall()]
    for dev in devices:
        values = vb.get(dev, {})
        th = core.thresholds(conn, dev)
        st = _state(conn, dev)
        running = running_of(values, float(th["running_rpm"]))
        mains = mains_of(values, float(th["v_min"]))
        if mains is False:
            st["mains_lost_ts"] = ts
        run = conn.execute("SELECT * FROM generator_runs WHERE device_id = ? AND end_ts IS NULL", (dev,)).fetchone()
        if run is not None and running is False:
            out["closed"] += _close(conn, run, ts, "stopped", values, cfg, mains) == "closed"
            run = None
        elif run is not None and running is None and ts - int(run["last_run_ts"]) >= int(cfg["no_data_close_min"]) * 60:
            out["closed"] += _close(conn, run, int(run["last_run_ts"]), "no_data", None, cfg, mains) == "closed"
            run = None
        mode = _val(values, "controller_mode")
        if running is True:
            loaded = on_load_of(values)
            lookback = int(cfg["mains_lookback_s"])
            if run is None:
                lost_near = mains is False or (st["mains_lost_ts"] is not None and ts - int(st["mains_lost_ts"]) <= lookback)
                obs = sticky_of(mode=mode, reason_kind=start_reason_kind(_val(values, "last_start_reason")), mains_lost_near=lost_near)
                kind, why = decide("other", None, obs, took_load=loaded, mains_present=mains, duration_s=0, cfg=cfg)
                conn.execute(
                    """INSERT INTO generator_runs(id, device_id, start_ts, kind, kind_reason, mode_at_start, mains_at_start, took_load, hours_start, starts_start,
                                                  fuel_start_pct, fuel_start_l, peak_load_pct, peak_kw, last_run_ts) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (new_id(), dev, ts, kind, why, mode if isinstance(mode, str) else None, None if mains is None else int(mains), int(loaded),
                     _num(_val(values, "run_hours")), _num(_val(values, "starts")), _num(_val(values, "fuel_pct")), _num(_val(values, "fuel_l")),
                     _num(_val(values, "load_pct")), _num(_val(values, "gen_kw")), ts))
                out["started"] += 1
            else:
                took = bool(run["took_load"]) or loaded
                dur = ts - int(run["start_ts"])
                lost_near = st["mains_lost_ts"] is not None and int(st["mains_lost_ts"]) >= int(run["start_ts"]) - lookback
                # the last-start reason is read only near the start: later it may already describe the next start
                rk = start_reason_kind(_val(values, "last_start_reason")) if dur <= 300 else None
                obs = sticky_of(mode=mode, reason_kind=rk, mains_lost_near=lost_near)
                kind, why = decide(run["kind"], run["kind_reason"], obs, took_load=took, mains_present=mains, duration_s=dur, cfg=cfg)
                pl, pk = _num(_val(values, "load_pct")), _num(_val(values, "gen_kw"))
                conn.execute("""UPDATE generator_runs SET kind = ?, kind_reason = ?, took_load = ?, last_run_ts = ?,
                                peak_load_pct = CASE WHEN ? IS NULL THEN peak_load_pct WHEN peak_load_pct IS NULL OR ? > peak_load_pct THEN ? ELSE peak_load_pct END,
                                peak_kw = CASE WHEN ? IS NULL THEN peak_kw WHEN peak_kw IS NULL OR ? > peak_kw THEN ? ELSE peak_kw END WHERE id = ?""",
                             (kind, why, int(took), ts, pl, pl, pl, pk, pk, pk, run["id"]))
        out["fuel"] += _fuel(conn, st, dev, _num(_val(values, "fuel_pct")), ts, running is True, cfg)
        _save_state(conn, st)
    return out


def prune(conn: sqlite3.Connection, now_ts: float) -> dict[str, int]:
    keep = int(settings(conn)["retention_days"])
    cut = int(now_ts) - keep * 86400
    a = conn.execute("DELETE FROM generator_runs WHERE end_ts IS NOT NULL AND end_ts < ?", (cut,)).rowcount
    b = conn.execute("DELETE FROM generator_fuel_events WHERE end_ts < ?", (cut,)).rowcount
    return {"runs": a, "fuel_events": b}


# ---------------------------------------------------------------- reading the log

def _iso(ts: int | float | None) -> str | None:
    return iso_utc(dt.datetime.fromtimestamp(int(ts), dt.timezone.utc)) if ts is not None else None


def run_out(r: sqlite3.Row | dict[str, Any], now_ts: int, cfg: dict[str, Any]) -> dict[str, Any]:
    end = r["end_ts"]
    dur = (end if end is not None else now_ts) - r["start_ts"]
    hs, he = r["hours_start"], r["hours_end"]
    hours = round(he - hs, 2) if hs is not None and he is not None and he >= hs else round(dur / 3600, 2)
    fs, fe = r["fuel_start_pct"], r["fuel_end_pct"]
    ls, le = r["fuel_start_l"], r["fuel_end_l"]
    return {
        "id": r["id"], "kind": r["kind"], "kind_reason": r["kind_reason"], "started_at": _iso(r["start_ts"]), "ended_at": _iso(end), "open": end is None,
        "end_reason": r["end_reason"], "duration_s": int(dur), "hours": hours, "hours_from_counter": hs is not None and he is not None,
        "hours_start": hs, "hours_end": he, "took_load": bool(r["took_load"]), "mode_at_start": r["mode_at_start"],
        "mains_at_start": None if r["mains_at_start"] is None else bool(r["mains_at_start"]),
        "fuel_start_pct": fs, "fuel_end_pct": fe, "fuel_used_pct": round(fs - fe, 1) if fs is not None and fe is not None and fs >= fe else None,
        "fuel_used_l": round(ls - le, 1) if ls is not None and le is not None and ls >= le else None,
        "peak_load_pct": r["peak_load_pct"], "peak_kw": r["peak_kw"],
        "short": r["kind"] == "test" and end is not None and dur < int(cfg["test_min_minutes"]) * 60,
    }


def parse_range(rng: str, start: str | None, end: str | None, now_ts: int) -> tuple[int, int]:
    from .timeutil import parse_utc

    if rng in RANGES:
        return now_ts - RANGES[rng], now_ts
    if rng != "custom":
        raise ValueError("range")
    try:
        a = parse_utc(start or "")
        b = parse_utc(end) if end else dt.datetime.fromtimestamp(now_ts, dt.timezone.utc)
    except (ValueError, TypeError):
        raise ValueError("from") from None
    lo, hi = int(a.timestamp()), int(b.timestamp())
    if hi <= lo or hi - lo > 1825 * 86400:
        raise ValueError("to")
    return lo, hi


def summary(conn: sqlite3.Connection, device_id: str, lo: int, hi: int, now_ts: int, values: dict[str, dict[str, Any]] | None = None) -> dict[str, Any]:
    """The strip above the log: run counts per kind, run time, controller hours, fuel used / refilled in lo..hi; the last test and when the next
    one is due (by `test_interval_days`); the run now in progress; the counters now."""
    cfg = settings(conn)
    rows = conn.execute("SELECT * FROM generator_runs WHERE device_id = ? AND start_ts < ? AND (end_ts IS NULL OR end_ts > ?)", (device_id, hi, lo)).fetchall()
    runs = [run_out(r, now_ts, cfg) for r in rows]
    by_kind = {k: sum(1 for x in runs if x["kind"] == k) for k in KINDS}
    run_s = sum(min(r["end_ts"] if r["end_ts"] is not None else now_ts, hi) - max(r["start_ts"], lo) for r in rows)
    fuel_pct = round(sum(x["fuel_used_pct"] or 0 for x in runs), 1)
    fuel_l = [x["fuel_used_l"] for x in runs if x["fuel_used_l"] is not None]
    fev = conn.execute("SELECT kind, from_pct, to_pct FROM generator_fuel_events WHERE device_id = ? AND start_ts < ? AND end_ts >= ?", (device_id, hi, lo)).fetchall()
    last_test = conn.execute("SELECT * FROM generator_runs WHERE device_id = ? AND kind = 'test' ORDER BY start_ts DESC LIMIT 1", (device_id,)).fetchone()
    last_mf = conn.execute("SELECT * FROM generator_runs WHERE device_id = ? AND kind = 'mains_failure' ORDER BY start_ts DESC LIMIT 1", (device_id,)).fetchone()
    cur = conn.execute("SELECT * FROM generator_runs WHERE device_id = ? AND end_ts IS NULL", (device_id,)).fetchone()
    interval = int(cfg["test_interval_days"])
    due = int(last_test["start_ts"]) + interval * 86400 if last_test is not None and interval else None
    v = values if values is not None else core.read_values(conn, device_id)
    return {
        "runs": len(runs), "by_kind": by_kind, "run_s": int(max(0, run_s)), "hours": round(sum(x["hours"] for x in runs), 2),
        "fuel_used_pct": fuel_pct, "fuel_used_l": round(sum(fuel_l), 1) if fuel_l else None,
        "refills": sum(1 for f in fev if f["kind"] == "refill"), "refilled_pct": round(sum(f["to_pct"] - f["from_pct"] for f in fev if f["kind"] == "refill"), 1),
        "drops": sum(1 for f in fev if f["kind"] == "drop"),
        "short_tests": sum(1 for x in runs if x["short"]),
        "last_test": run_out(last_test, now_ts, cfg) if last_test is not None else None,
        "last_mains_failure": run_out(last_mf, now_ts, cfg) if last_mf is not None else None,
        "test_interval_days": interval, "next_test_due": _iso(due) if due else None, "test_overdue": bool(interval) and (due is None or due < now_ts),
        "current": run_out(cur, now_ts, cfg) if cur is not None else None,
        "counters": {"run_hours": _num(_val(v, "run_hours")), "starts": _num(_val(v, "starts")), "fuel_pct": _num(_val(v, "fuel_pct")), "fuel_l": _num(_val(v, "fuel_l"))},
    }


def list_runs(conn: sqlite3.Connection, device_id: str, lo: int, hi: int, now_ts: int, *, kind: str | None, page: int, page_size: int) -> dict[str, Any]:
    cfg = settings(conn)
    where, args = ["device_id = ?", "start_ts < ?", "(end_ts IS NULL OR end_ts > ?)"], [device_id, hi, lo]
    if kind:
        where.append("kind = ?")
        args.append(kind)
    sql = " AND ".join(where)
    total = conn.execute(f"SELECT COUNT(*) FROM generator_runs WHERE {sql}", args).fetchone()[0]
    rows = conn.execute(f"SELECT * FROM generator_runs WHERE {sql} ORDER BY start_ts DESC, id LIMIT ? OFFSET ?", (*args, page_size, (page - 1) * page_size)).fetchall()
    fev = conn.execute("SELECT * FROM generator_fuel_events WHERE device_id = ? AND start_ts < ? AND end_ts >= ? ORDER BY start_ts DESC LIMIT 20", (device_id, hi, lo)).fetchall()
    return {"runs": [run_out(r, now_ts, cfg) for r in rows], "total": total, "page": page, "page_size": page_size, "pages": max(1, -(-total // page_size)),
            "fuel_events": [{"id": f["id"], "kind": f["kind"], "started_at": _iso(f["start_ts"]), "ended_at": _iso(f["end_ts"]), "from_pct": f["from_pct"],
                             "to_pct": f["to_pct"], "delta_pct": round(f["to_pct"] - f["from_pct"], 1)} for f in fev]}


def mains_outages(conn: sqlite3.Connection, lo: int, hi: int) -> list[dict[str, Any]]:
    """For the temperature excursion explanation (r093): the mains outages of any generator overlapping lo..hi - the `mains_lost` alerts of the
    alert engine and the mains-failure runs of this log. [{from_ts, to_ts, source, device_name}]; empty when there is no generator."""
    out: list[dict[str, Any]] = []
    try:
        lo_iso, hi_iso = _iso(lo), _iso(hi)
        for r in conn.execute("""SELECT a.raised_at, a.cleared_at, d.name FROM generator_alerts a JOIN generator_devices d ON d.id = a.device_id
                                 WHERE a.alert_key = 'mains_lost' AND a.raised_at < ? AND (a.cleared_at IS NULL OR a.cleared_at > ?)""", (hi_iso, lo_iso)).fetchall():
            a = dt.datetime.fromisoformat(r["raised_at"].replace("Z", "+00:00")).timestamp()
            b = dt.datetime.fromisoformat(r["cleared_at"].replace("Z", "+00:00")).timestamp() if r["cleared_at"] else hi
            out.append({"from_ts": int(a), "to_ts": int(b), "source": "alert", "device_name": r["name"]})
        for r in conn.execute("""SELECT g.start_ts, g.end_ts, d.name FROM generator_runs g JOIN generator_devices d ON d.id = g.device_id
                                 WHERE g.kind = 'mains_failure' AND g.start_ts < ? AND (g.end_ts IS NULL OR g.end_ts > ?)""", (hi, lo)).fetchall():
            out.append({"from_ts": int(r["start_ts"]), "to_ts": int(r["end_ts"] if r["end_ts"] is not None else hi), "source": "run", "device_name": r["name"]})
    except (sqlite3.Error, ValueError):
        return []
    return sorted(out, key=lambda x: x["from_ts"])
