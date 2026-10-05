"""CR-031 GEN1: the generator value history (storage, downsampling, retention).

Storage: one raw sample per minute per numeric role (`generator_samples`, kept 3 days) and a five-minute rollup
(`generator_samples_5m`, kept `generator.history_retention_days`, default 35). Both are written by the 1-minute tick in
services/generator_runtime.py from the state mirror; nothing is requested from the infrastructure.

Query: ranges 1h / 24h / 7d / 30d / custom. The bucket step is chosen so that a series never exceeds `max_points`
(default 300, at most 1000); the raw table answers short ranges that lie inside its retention, the rollup everything else."""
from __future__ import annotations

import datetime as dt
import sqlite3
from typing import Any

from . import generator_catalog as cat
from . import generator_core as core

RAW_KEEP_S = 3 * 86400
BUCKET_S = 300
RANGES = {"1h": 3600, "24h": 86400, "7d": 7 * 86400, "30d": 30 * 86400}
MAX_POINTS = 1000
DEFAULT_POINTS = 300


def record(conn: sqlite3.Connection, now_ts: int) -> int:
    """One sample per available numeric role of every live generator for the minute of `now_ts`. Returns the rows written."""
    ts = now_ts - now_ts % 60
    bucket = ts - ts % BUCKET_S
    n = 0
    for dev_id, values in core.read_values_bulk(conn).items():
        for role, item in values.items():
            if cat.ROLES[role][0] != "num" or not item["available"] or item["value"] is None:
                continue
            v = float(item["value"])
            cur = conn.execute("INSERT OR IGNORE INTO generator_samples(device_id, role, ts, v) VALUES (?,?,?,?)", (dev_id, role, ts, v))
            if cur.rowcount == 0:
                continue  # this minute was already recorded (two ticks in one minute)
            n += 1
            conn.execute(
                """INSERT INTO generator_samples_5m(device_id, role, ts, v_avg, v_min, v_max, n) VALUES (?,?,?,?,?,?,1)
                   ON CONFLICT(device_id, role, ts) DO UPDATE SET v_avg = (v_avg * n + excluded.v_avg) / (n + 1), v_min = MIN(v_min, excluded.v_min),
                                                                  v_max = MAX(v_max, excluded.v_max), n = n + 1""",
                (dev_id, role, bucket, v, v, v))
    return n


def parse_range(rng: str, start: str | None, end: str | None, now_ts: int, retention_days: int) -> tuple[int, int]:
    """(from_ts, to_ts) of a request; raises ValueError('...') with a field name for an invalid one."""
    if rng in RANGES:
        return now_ts - RANGES[rng], now_ts
    if rng != "custom":
        raise ValueError("range")
    try:
        a = dt.datetime.fromisoformat((start or "").replace("Z", "+00:00"))
        b = dt.datetime.fromisoformat((end or "").replace("Z", "+00:00")) if end else dt.datetime.fromtimestamp(now_ts, dt.timezone.utc)
    except ValueError:
        raise ValueError("from") from None
    if a.tzinfo is None or b.tzinfo is None:
        raise ValueError("from")
    lo, hi = int(a.timestamp()), int(b.timestamp())
    if hi <= lo:
        raise ValueError("to")
    if hi - lo > retention_days * 86400:
        raise ValueError("span")
    return lo, hi


def query(conn: sqlite3.Connection, device_id: str, roles: list[str], lo: int, hi: int, max_points: int, now_ts: int) -> dict[str, Any]:
    """{step_s, source, from, to, series: {role: [{t, v, min, max}]}}; `t` is the bucket start in epoch seconds (UTC)."""
    max_points = max(10, min(int(max_points), MAX_POINTS))
    span = hi - lo
    use_raw = lo >= now_ts - RAW_KEEP_S and span <= 6 * 3600
    base = 60 if use_raw else BUCKET_S
    step = max(base, -(-span // max_points))
    step = -(-step // base) * base
    series: dict[str, list[dict[str, Any]]] = {}
    for role in roles:
        if use_raw:
            rows = conn.execute(
                "SELECT (ts - ts % ?) AS b, AVG(v) AS a, MIN(v) AS lo, MAX(v) AS hi FROM generator_samples WHERE device_id = ? AND role = ? AND ts >= ? AND ts < ? GROUP BY b ORDER BY b",
                (step, device_id, role, lo, hi)).fetchall()
        else:
            rows = conn.execute(
                "SELECT (ts - ts % ?) AS b, SUM(v_avg * n) / SUM(n) AS a, MIN(v_min) AS lo, MAX(v_max) AS hi FROM generator_samples_5m WHERE device_id = ? AND role = ? AND ts >= ? AND ts < ? GROUP BY b ORDER BY b",
                (step, device_id, role, lo, hi)).fetchall()
        series[role] = [{"t": r["b"], "v": round(r["a"], 3), "min": round(r["lo"], 3), "max": round(r["hi"], 3)} for r in rows]
    return {"step_s": step, "source": "raw" if use_raw else "rollup_5m", "from": lo, "to": hi, "series": series}


def prune(conn: sqlite3.Connection, now_ts: int) -> dict[str, int]:
    keep_days = core.int_setting(conn, "history_retention_days")
    a = conn.execute("DELETE FROM generator_samples WHERE ts < ?", (now_ts - RAW_KEEP_S,)).rowcount
    b = conn.execute("DELETE FROM generator_samples_5m WHERE ts < ?", (now_ts - keep_days * 86400,)).rowcount
    return {"raw": a, "rollup": b}
