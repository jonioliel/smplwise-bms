"""TEMPEXPLAIN093-295 (board row r093): "why did the fridge warm at 03:00?" - a RULE-BASED explanation of a temperature excursion from the
signals Arx already stores. No external model, no guess beyond the data: every factor names the evidence it is based on.

Signals (all read from the stored history; nothing is asked from a device):
  maint        - a maintenance window was open (who wrote it and why);
  defrost      - the rise fell inside a defrost window (fixed or learned) and stayed below the hard maximum, short enough for a cycle;
  door         - the door was open shortly before / at the start (how many openings, how long, how long before);
  outage       - the mains were lost (the generator module's `mains_lost` alerts and its mains-failure runs, services/generator_log.py);
  compressor_off / compressor_no_power / compressor_on - the unit's power sensor (smart plug / current meter) shows the compressor stopped
                 for a long stretch, stopped reporting, or (for a LOW excursion) running without a pause;
  unit_off / setpoint - a climate unit was switched off, or its setpoint was changed;
  gap          - the sensor did not report for a while before (the reading after a gap is less certain), or a "sensor silent" event;
  spike        - a one-off jump that came back within minutes (a sensor glitch rather than a real warming);
  shared / local - the neighbouring units (same area, or every unit) warmed at the same time (a room / power cause) or did not (a cause
                 local to this unit);
  gradual      - nothing else explains it and the reading climbed slowly and steadily (typical of a cooling loss: compressor, seal, condenser).
Each factor has a score 0..100; the ones below `explain_min_score` are left out; the confidence follows the best score. Every window and
threshold is an installation setting (`explain_*` in services/temperature.py INSTALLATION, Settings > Infrastructure > Temperatures).

Pure core first (`explain`, driven by the unit tests with synthetic series), the loader after."""
from __future__ import annotations

import datetime as dt
import json
import sqlite3
import statistics
from typing import Any

from . import temperature as t
from .timeutil import iso_utc, parse_utc

NEIGHBORS_MAX = 12
EXPLAIN_KINDS = ("high", "low")


def _iso(ts: float | None) -> str | None:
    return iso_utc(dt.datetime.fromtimestamp(int(ts), dt.timezone.utc)) if ts is not None else None


def _overlap(a: float, b: float, lo: float, hi: float) -> float:
    return max(0.0, min(b, hi) - max(a, lo))


def _slope_h(pts: list[tuple[float, float]]) -> float | None:
    """Least-squares slope in degrees per hour; None with fewer than 4 points."""
    if len(pts) < 4:
        return None
    xs = [p[0] / 3600 for p in pts]
    ys = [p[1] for p in pts]
    mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
    den = sum((x - mx) ** 2 for x in xs)
    return None if den == 0 else sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / den


def _factor(key: str, score: float, **vars_: Any) -> dict[str, Any]:
    return {"key": key, "score": int(max(0, min(100, round(score)))), "vars": vars_}


def explain(*, kind: str, start_ts: float, end_ts: float | None, now_ts: float, peak: float | None, low: float, high: float, hard_max: float,
            points: list[tuple[float, float, int, float | None, float | None]], doors: list[tuple[float, float | None]] | None,
            defrost: list[tuple[float, float]], outages: list[dict[str, Any]], maint: list[tuple[float, float, str | None]],
            offline: list[tuple[float, float]], neighbors: list[dict[str, Any]], has_power: bool, rules: dict[str, Any]) -> dict[str, Any]:
    """The explanation of one excursion. points: raw minutes (ts, v, flags, setpoint, power W) sorted; doors None = the door is not visible
    (or the unit has none). Returns {factors, primary, confidence, profile}."""
    S = float(start_ts)
    E = float(end_ts if end_ts is not None else now_ts)
    look = int(rules["explain_lookback_min"]) * 60
    W_lo = S - look
    factors: list[dict[str, Any]] = []
    high_side = kind == "high"
    win_pts = [p for p in points if W_lo <= p[0] <= S]

    # maintenance window
    for a, b, reason in maint:
        if _overlap(a, b, S - 300, S + 60) > 0:
            factors.append(_factor("maint", 90, reason=reason or "", started_at=_iso(a)))
            break

    # defrost window (a high excursion only)
    if high_side:
        flagged = any(p[2] & 1 for p in points if S - 300 <= p[0] <= S + 300)
        win = next(((a, b) for a, b in defrost if a <= S + 60 and b >= S - 120), None)
        if win is not None or flagged:
            short = (E - S) <= int(rules["defrost_max_min"]) * 60
            below = peak is None or peak <= hard_max
            factors.append(_factor("defrost", 85 if short and below else 55, window_from=_iso(win[0]) if win else None,
                                   window_minutes=round((win[1] - win[0]) / 60) if win else None, above_hard_max=not below))

    # the door (a high excursion only; the door hardly lowers a reading)
    if high_side and doors:
        d_lo = S - int(rules["explain_door_lookback_min"]) * 60
        opens = [(a, b if b is not None else E) for a, b in doors if _overlap(a, b if b is not None else E, d_lo, S + 120) > 0]
        if opens:
            total = sum(_overlap(a, b, d_lo, S + 120) for a, b in opens)
            need = max(30, int(rules["explain_door_min_open_min"]) * 60)
            if total >= need:
                open_now = any(a <= S <= b for a, b in opens)
                lead = max(0, round((S - min(a for a, _b in opens)) / 60))
                score = min(92, 55 + total / 60 * 5 + (10 if open_now else 0))
                factors.append(_factor("door", score, count=len(opens), total_min=round(total / 60, 1),
                                       longest_min=round(max(b - a for a, b in opens) / 60, 1), lead_min=lead, open_at_start=open_now))

    # mains outage (the generator module)
    if high_side:
        p_lo = S - int(rules["explain_power_lookback_min"]) * 60
        hit = [o for o in outages if _overlap(o["from_ts"], o["to_ts"], p_lo, S + 60) > 0]
        if hit:
            o = max(hit, key=lambda x: _overlap(x["from_ts"], x["to_ts"], p_lo, S + 60))
            factors.append(_factor("outage", 88, outage_from=_iso(o["from_ts"]), outage_to=_iso(o["to_ts"]),
                                   minutes=round((o["to_ts"] - o["from_ts"]) / 60), lead_min=max(0, round((S - o["from_ts"]) / 60)), device_name=o.get("device_name") or ""))

    # the compressor (an optional power sensor)
    if has_power:
        on_w = float(rules["compressor_on_w"])
        need = int(rules["explain_compressor_off_min"]) * 60
        pw_pts = [(p[0], p[4]) for p in win_pts if p[4] is not None]
        if win_pts and not pw_pts:
            factors.append(_factor("compressor_no_power", 50 if high_side else 30))
        elif pw_pts:
            best, run_a, prev = 0.0, None, None
            want_on = not high_side
            for ts_, w in pw_pts:
                match = (w >= on_w) if want_on else (w < on_w)
                if match:
                    if run_a is None or (prev is not None and ts_ - prev > 180):
                        run_a = ts_
                    best = max(best, ts_ - run_a + 60)
                else:
                    run_a = None
                prev = ts_
            if high_side and best >= need:
                factors.append(_factor("compressor_off", 78, minutes=round(best / 60)))
            elif not high_side and best >= max(3600, need * 3):
                factors.append(_factor("compressor_on", 62, minutes=round(best / 60)))

    # a climate unit: switched off, or the setpoint changed
    if any(p[2] & 4 for p in win_pts):
        factors.append(_factor("unit_off", 82))
    sps = [p[3] for p in win_pts if p[3] is not None]
    if sps and max(sps) - min(sps) >= 1.0:
        factors.append(_factor("setpoint", 72, sp_from=round(sps[0], 1), sp_to=round(sps[-1], 1)))

    # a gap in the data before the start, or a "sensor silent" event
    gap_need = int(rules["explain_gap_min"]) * 60
    marks = [W_lo] + [p[0] for p in win_pts] + [S]
    gap = max((b - a for a, b in zip(marks, marks[1:])), default=0.0)
    silent = next(((a, b) for a, b in offline if _overlap(a, b, W_lo, S + 60) > 0), None)
    if silent is not None or gap >= gap_need:
        factors.append(_factor("gap", 50 if silent is not None else 42, gap_min=round(gap / 60), silent=silent is not None))

    # a spike: a one-off jump that came back within minutes
    if end_ts is not None and (E - S) <= int(rules["explain_spike_max_min"]) * 60:
        before = [p for p in points if S - 300 <= p[0] < S]
        after = [p for p in points if S <= p[0] <= E]
        if before and after:
            jump = (max(p[1] for p in after) - before[-1][1]) if high_side else (before[-1][1] - min(p[1] for p in after))
            if jump >= float(rules["explain_spike_jump"]):
                factors.append(_factor("spike", 66, jump=round(jump, 1)))

    # the neighbours: did they move at the same time?
    rise_need = float(rules["explain_neighbor_rise"])
    judged, moved = 0, []
    for nb in neighbors:
        base = [v for ts_, v in nb["points"] if W_lo - 1800 <= ts_ < W_lo]
        during = [v for ts_, v in nb["points"] if S - 900 <= ts_ <= min(E, S + 1800)]
        if not base or not during:
            continue
        judged += 1
        b0 = statistics.median(base)
        delta = (max(during) - b0) if high_side else (b0 - min(during))
        if delta >= rise_need:
            moved.append(nb["name"])
    if judged:
        if moved and len(moved) * 2 >= judged:
            factors.append(_factor("shared", 70 + (10 if len(moved) == judged else 0), n_moved=len(moved), n_total=judged, names=moved[:3]))
        elif not moved:
            factors.append(_factor("local", 35, n_total=judged))

    # the profile of the climb, and a slow steady rise as the last explanation
    climb = [(p[0], p[1]) for p in points if S - 900 <= p[0] <= min(E, S + 900)]
    rate = _slope_h(climb)
    strong = any(f["score"] >= 60 and f["key"] not in ("local",) for f in factors)
    if high_side and not strong:
        pre = [(p[0], p[1]) for p in win_pts]
        r_pre = _slope_h(pre)
        if r_pre is not None and 0.3 <= r_pre <= 4.0:
            factors.append(_factor("gradual", 45, rate_h=round(r_pre, 2)))

    min_score = int(rules["explain_min_score"])
    factors = sorted((f for f in factors if f["score"] >= min_score), key=lambda f: (-f["score"], f["key"]))
    lead = next((f for f in factors if f["key"] != "local"), None)
    top = lead["score"] if lead else 0
    conf = "high" if top >= 75 else "medium" if top >= 55 else "low" if lead else "none"
    return {"factors": factors, "primary": lead["key"] if lead else None, "confidence": conf,
            "profile": {"rate_h": round(rate, 2) if rate is not None else None, "duration_min": round((E - S) / 60), "ongoing": end_ts is None}}


# ---------------------------------------------------------------- the loader

def _ts(iso: str | None) -> float | None:
    if not iso:
        return None
    try:
        return parse_utc(iso).timestamp()
    except (ValueError, TypeError):
        return None


def _points(conn: sqlite3.Connection, unit_id: str, lo: float, hi: float) -> list[tuple[float, float, int, float | None, float | None]]:
    rows = conn.execute("SELECT ts, v, flags, sp, pw FROM infra_temp_samples WHERE unit_id = ? AND ts >= ? AND ts <= ? ORDER BY ts", (unit_id, int(lo), int(hi))).fetchall()
    return [(float(r["ts"]), float(r["v"]), int(r["flags"] or 0), r["sp"], r["pw"]) for r in rows]


def find_event(conn: sqlite3.Connection, unit_id: str, at_ts: float) -> sqlite3.Row | None:
    """The high / low excursion of the unit in force at `at_ts`, else the nearest one starting within 30 minutes after it."""
    a = _iso(at_ts)
    r = conn.execute("""SELECT * FROM infra_temp_events WHERE unit_id = ? AND kind IN ('high', 'low') AND started_at <= ? AND (ended_at IS NULL OR ended_at >= ?)
                        ORDER BY started_at DESC LIMIT 1""", (unit_id, a, a)).fetchone()
    if r is not None:
        return r
    return conn.execute("""SELECT * FROM infra_temp_events WHERE unit_id = ? AND kind IN ('high', 'low') AND started_at > ? AND started_at <= ?
                           ORDER BY started_at LIMIT 1""", (unit_id, a, _iso(at_ts + 1800))).fetchone()


def explain_unit(conn: sqlite3.Connection, u: sqlite3.Row, *, event: sqlite3.Row | None, at_ts: float | None, now_ts: float, door_visible: bool,
                 neighbor_units: list[sqlite3.Row]) -> dict[str, Any]:
    """Load the signals around one excursion (`event`) or a moment (`at_ts`, no event) of unit `u` and explain it. `neighbor_units` are the
    other units the caller may see (their names appear in the answer)."""
    from . import generator_log as glog

    defaults = t.load_defaults(conn)
    rules = t.effective(defaults, t.overrides_of(u["rules_json"]))
    low, high = float(u["low"]), float(u["high"])
    hard_max = high + float(rules["defrost_hard_margin"])
    if event is not None:
        S = _ts(event["started_at"]) or now_ts
        E = _ts(event["ended_at"])
        kind = event["kind"]
        peak = event["peak"]
    else:
        S, E, peak = float(at_ts if at_ts is not None else now_ts), None, None
        kind = "high"
    look = int(rules["explain_lookback_min"]) * 60
    widest = max(look, int(rules["explain_door_lookback_min"]) * 60, int(rules["explain_power_lookback_min"]) * 60)
    lo = S - widest - 1800
    hi = min(now_ts, (E if E is not None else now_ts) + 1800, S + 6 * 3600)
    points = _points(conn, u["id"], lo, hi)
    if event is None:
        # a moment without an excursion row: the side follows the reading at that moment against the band (above the middle = a warming)
        near = [p[1] for p in points if S - 300 <= p[0] <= S + 300]
        if near:
            kind = "low" if statistics.median(near) < (low + high) / 2 else "high"
            peak = max(near) if kind == "high" else min(near)
    doors = None
    if door_visible and u["door_entity_id"]:
        rows = conn.execute("SELECT opened_at, closed_at FROM infra_temp_doors WHERE unit_id = ? AND opened_at <= ? AND (closed_at IS NULL OR closed_at >= ?)",
                            (u["id"], _iso(hi), _iso(lo))).fetchall()
        doors = [(_ts(r["opened_at"]) or 0.0, _ts(r["closed_at"])) for r in rows]
    tz = t.site_zone(conn)
    wins = t.unit_windows(u, t.learned_of(conn, [u["id"]]))
    defrost = t.window_intervals(wins, lo, hi, tz)
    outages = glog.mains_outages(conn, int(lo), int(hi))
    maint, offline = [], []
    for r in conn.execute("""SELECT kind, started_at, ended_at, detail_json FROM infra_temp_events WHERE unit_id = ? AND kind IN ('maint', 'offline')
                             AND started_at <= ? AND (ended_at IS NULL OR ended_at >= ?)""", (u["id"], _iso(hi), _iso(lo))).fetchall():
        a = _ts(r["started_at"]) or lo
        b = _ts(r["ended_at"]) or hi
        if r["kind"] == "maint":
            try:
                reason = (json.loads(r["detail_json"] or "{}") or {}).get("reason")
            except ValueError:
                reason = None
            maint.append((a, b, reason if isinstance(reason, str) else None))
        else:
            offline.append((a, b))
    scope = rules.get("explain_neighbor_scope", "area")
    cands = [x for x in neighbor_units if x["id"] != u["id"] and (scope == "all" or not u["area_id"] or x["area_id"] == u["area_id"])][:NEIGHBORS_MAX]
    neighbors = [{"name": x["name"], "points": [(p[0], p[1]) for p in _points(conn, x["id"], S - look - 1800, min(hi, S + 1800))]} for x in cands]
    if not points:
        return {"unit_id": u["id"], "event_id": event["id"] if event is not None else None, "kind": kind, "started_at": _iso(S), "ended_at": _iso(E),
                "peak": peak, "factors": [], "primary": None, "confidence": "none", "reason": "no_samples", "profile": None,
                "neighbors_scope": scope, "generated_at": _iso(now_ts)}
    out = explain(kind=kind, start_ts=S, end_ts=E, now_ts=now_ts, peak=peak, low=low, high=high, hard_max=hard_max, points=points, doors=doors,
                  defrost=defrost, outages=outages, maint=maint, offline=offline, neighbors=neighbors, has_power=bool(u["power_entity_id"]), rules=rules)
    return {"unit_id": u["id"], "event_id": event["id"] if event is not None else None, "kind": kind, "started_at": _iso(S), "ended_at": _iso(E), "peak": peak,
            "low": low, "high": high, **out, "reason": None, "neighbors_scope": scope, "generated_at": _iso(now_ts)}
