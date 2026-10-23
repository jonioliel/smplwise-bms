"""CR-INSIGHT215 slice 3 (owner question 6, answer 262): how many times each generator ran in a month and for how long.

The generator tick (services/generator_runtime.py, every 15 s over the state mirror) calls `record()`; a run is the stretch in which the engine state
is running / starting / cooling (or, for a controller with no state, the speed is above the generator's own `running_rpm` threshold). One row per run
in `generator_runs`. A mirror that went silent for longer than `GAP_S` closes the open run at the last time it was seen (`interrupted`), so a
restart of the platform never invents hours. Hours come from the recorded start and end; when the controller also reports its own run-hours meter
the meter's difference is carried next to them (`meter_hours`). Runs shorter than the editable `generator.min_run_s` (a blip, a failed start) are
not counted. Read-only against the infrastructure; nothing here sends anything anywhere."""
from __future__ import annotations

import datetime as dt
import sqlite3
from typing import Any

from . import generator_core as core
from . import insights_common as ic

GAP_S = 300          # no pass for this long = the mirror (or the platform) was down: the open run ends at the last time it was seen
KEEP_DAYS = 400      # a year and a month of history: this month, the same month last year and room to spare
RUNNING_STATES = ("running", "starting", "cooling")


def _iso(ts: float) -> str:
    return dt.datetime.fromtimestamp(ts, dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _ts(value: str) -> float:
    return ic.ts_of(value)


def _running(values: dict[str, dict[str, Any]], th: dict[str, float]) -> bool | None:
    """True / False when the generator's state is known, None when no reading is available (a pass then changes nothing)."""
    def v(role: str) -> Any:
        item = values.get(role)
        return item["value"] if item and item["available"] else None

    state, rpm = v("engine_state"), v("rpm")
    if state is None and rpm is None:
        return None
    return state in RUNNING_STATES if state is not None else float(rpm) > th["running_rpm"]


def record(conn: sqlite3.Connection, now_ts: float) -> dict[str, int]:
    """One pass: open a run when a generator starts to run, keep it alive while it runs, close it when it stops (or when the pass gap says the
    mirror was down). Returns {"opened", "closed"}."""
    out = {"opened": 0, "closed": 0}
    now = _iso(now_ts)
    stored_th = core.jget(conn, "generator.thresholds", {})
    values = core.read_values_bulk(conn)
    open_rows = {r["device_id"]: r for r in conn.execute("SELECT id, device_id, last_seen_at FROM generator_runs WHERE ended_at IS NULL").fetchall()}
    for dev_id, vals in values.items():
        running = _running(vals, core.thresholds_from(stored_th, dev_id))
        row = open_rows.get(dev_id)
        meter = vals.get("run_hours")
        hours = float(meter["value"]) if meter and meter["available"] and meter["value"] is not None else None
        if row is not None and now_ts - _ts(row["last_seen_at"]) > GAP_S:
            conn.execute("UPDATE generator_runs SET ended_at = last_seen_at, interrupted = 1 WHERE id = ?", (row["id"],))
            out["closed"] += 1
            row = None
        if running is None:
            continue
        if running and row is None:
            conn.execute("INSERT INTO generator_runs(device_id, started_at, last_seen_at, hours_start) VALUES (?,?,?,?)", (dev_id, now, now, hours))
            out["opened"] += 1
        elif running and row is not None:
            conn.execute("UPDATE generator_runs SET last_seen_at = ?, hours_end = COALESCE(?, hours_end) WHERE id = ?", (now, hours, row["id"]))
        elif not running and row is not None:
            conn.execute("UPDATE generator_runs SET last_seen_at = ?, ended_at = ?, hours_end = COALESCE(?, hours_end) WHERE id = ?", (now, now, hours, row["id"]))
            out["closed"] += 1
    return out


def prune(conn: sqlite3.Connection, now_ts: float) -> int:
    return conn.execute("DELETE FROM generator_runs WHERE ended_at IS NOT NULL AND ended_at < ?", (_iso(now_ts - KEEP_DAYS * 86400),)).rowcount


def report(conn: sqlite3.Connection, lo: float, hi: float, min_run_s: float) -> dict[str, Any]:
    """Run counts and hours per generator inside [lo, hi). A run that crosses a bound counts in the month it STARTED (the count) and is clipped
    for the hours, so two consecutive months never share an hour. An open run counts up to `hi`."""
    a, b = _iso(lo), _iso(hi)
    out = []
    for d in conn.execute("SELECT id, name FROM generator_devices WHERE status <> 'removed' ORDER BY name").fetchall():
        rows = conn.execute("""SELECT started_at, ended_at, last_seen_at, hours_start, hours_end FROM generator_runs
                               WHERE device_id = ? AND started_at < ? AND (ended_at IS NULL OR ended_at > ?) ORDER BY started_at""", (d["id"], b, a)).fetchall()
        count, secs, longest, meter, meter_n, first_at = 0, 0.0, 0.0, 0.0, 0, None
        for r in rows:
            s = _ts(r["started_at"])
            e = _ts(r["ended_at"]) if r["ended_at"] else min(float(hi), _ts(r["last_seen_at"]))
            if e - s < min_run_s:
                continue
            clipped = max(0.0, min(e, hi) - max(s, lo))
            secs += clipped
            if s >= lo:
                count += 1
                longest = max(longest, e - s)
                first_at = first_at or r["started_at"]
                if r["hours_start"] is not None and r["hours_end"] is not None and r["hours_end"] >= r["hours_start"]:
                    meter += r["hours_end"] - r["hours_start"]
                    meter_n += 1
        out.append({"name": d["name"], "runs": count, "hours": round(secs / 3600, 1), "longest_min": int(longest // 60),
                    "meter_hours": round(meter, 1) if meter_n else None})
    return {"devices": out, "runs": sum(x["runs"] for x in out), "hours": round(sum(x["hours"] for x in out), 1), "min_run_s": int(min_run_s)}
