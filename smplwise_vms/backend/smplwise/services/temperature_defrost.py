"""CR-INFRA-TEMPERATURE 2.9.1: learning a unit's defrost cycles from its own data (defrost mode `learn`, the default when no window is entered;
owner requirement 2026-10-19).

A defrost cycle is a recurring, short rise of the temperature: at about the same time of day, of a similar length and shape (a rise above the
local baseline and a fall back), NOT explained by an open door. The learner reads the five-minute history of the rolling period
(`learn_days`, default 7) and:

1. finds the rise episodes - the reading climbs at least `delta` above the median of the two hours before it (delta = max(1.5, 35 % of
   the band)), stays up 10..`defrost_max_min` minutes and comes back below half of that; an episode that starts while the door is open (or in
   the 15 minutes after it closed), one with a data gap inside, or one still rising at the end of the data is ignored;
2. clusters the episodes by their local start time (within 20 minutes, across midnight) and keeps a cluster seen on at least
   `learn_min_repeats` different days (default 3) AND on 60 % of the days covered, whose lengths are similar;
3. turns each kept cluster into a window: the median start minus 5 minutes, the longest length plus 10 minutes (5-minute steps).

Until the history covers `learn_min_repeats` days the state is `learning` and NOTHING is suppressed. Learned windows are shown as "learned"
with confirm / reject / clear; a rejected window is never suggested again (until the learned set is cleared). Learned and confirmed windows
are excluded from the out-of-range statistics (setting `exclude_defrost_stats`) and hold temperature alerts above the band (setting
`defrost_suppress`) - but never a reading above the hard maximum (high + `defrost_hard_margin`). Pure functions first; storage after."""
from __future__ import annotations

import datetime as dt
import math
import sqlite3
import statistics
from dataclasses import dataclass
from typing import Any
from zoneinfo import ZoneInfo

from .timeutil import iso_utc

STEP_S = 300
BASELINE_S = 7200
MIN_EPISODE_MIN = 10
DOOR_GRACE_S = 900
TOLERANCE_MIN = 20
LEAD_MIN = 5
TAIL_MIN = 10
MAX_GAP_S = 900
RUN_EVERY_S = 3600


@dataclass
class Episode:
    start: float      # unix seconds
    end: float
    peak: float
    base: float
    start_min: int    # local minute of the day
    day: str          # local date


def delta_of(low: float, high: float) -> float:
    return max(1.5, (high - low) * 0.35)


def _circ(a: int, b: int) -> int:
    d = abs(a - b) % 1440
    return min(d, 1440 - d)


def _local(ts: float, tz: ZoneInfo) -> dt.datetime:
    return dt.datetime.fromtimestamp(ts, dt.timezone.utc).astimezone(tz)


def detect_episodes(points: list[tuple[float, float]], doors: list[tuple[float, float]], low: float, high: float, max_min: int, tz: ZoneInfo) -> list[Episode]:
    """The rise episodes of a series of (ts, value) points (sorted, about five minutes apart)."""
    pts = sorted(points)
    delta = delta_of(low, high)
    out: list[Episode] = []
    i, n = 0, len(pts)
    while i < n:
        ts, v = pts[i]
        prior = [p[1] for p in pts[max(0, i - 40):i] if ts - BASELINE_S <= p[0] < ts]
        if len(prior) < 6:
            i += 1
            continue
        base = statistics.median(prior)
        if v - base < delta:
            i += 1
            continue
        # the episode: from i while the reading stays above half the rise
        j, peak, ok = i, v, True
        while j + 1 < n and pts[j + 1][1] - base >= delta / 2:
            if pts[j + 1][0] - pts[j][0] > MAX_GAP_S:
                ok = False
            j += 1
            peak = max(peak, pts[j][1])
        if j + 1 >= n:
            break  # still up at the end of the data: not a finished cycle
        if pts[j + 1][0] - pts[j][0] > MAX_GAP_S:
            ok = False
        start = pts[i - 1][0] if i > 0 else ts  # the rise began after the last point that was still at the baseline
        end = pts[j + 1][0]
        minutes = (end - start) / 60
        door = any(a <= ts and b + DOOR_GRACE_S >= start for a, b in doors)
        if ok and not door and MIN_EPISODE_MIN <= minutes <= max_min + 5:
            loc = _local(start, tz)
            out.append(Episode(start, end, peak, base, loc.hour * 60 + loc.minute, loc.date().isoformat()))
        i = j + 1
    return out


def cluster(episodes: list[Episode], min_repeats: int, days: float = 0.0) -> list[list[Episode]]:
    """Groups of episodes at about the same local time on at least `min_repeats` different days AND on most of the days the data covers
    (60 %: a compressor cycle that is not tied to the clock meets the same time of day only now and then), with similar lengths."""
    need = max(min_repeats, math.ceil(0.6 * math.floor(days + 0.05)))
    rest = list(episodes)
    groups: list[list[Episode]] = []
    while rest:
        best: list[Episode] = []
        for seed in rest:
            g = [e for e in rest if _circ(e.start_min, seed.start_min) <= TOLERANCE_MIN]
            if len({e.day for e in g}) > len({e.day for e in best}):
                best = g
        if len({e.day for e in best}) < need:
            break
        med = statistics.median((e.end - e.start) / 60 for e in best)
        similar = [e for e in best if 0.5 * med <= (e.end - e.start) / 60 <= 1.5 * med + 5]
        rest = [e for e in rest if e not in best]
        if len({e.day for e in similar}) >= need:
            groups.append(similar)
    return groups


def circular_median(mins: list[int]) -> int:
    """The median of minutes of the day, robust across midnight (rotated to the largest gap)."""
    s = sorted(mins)
    if len(s) == 1:
        return s[0]
    gaps = [((s[(k + 1) % len(s)] - s[k]) % 1440, k) for k in range(len(s))]
    _g, k = max(gaps)
    origin = s[(k + 1) % len(s)]
    rot = sorted((m - origin) % 1440 for m in s)
    return int((statistics.median(rot) + origin) % 1440)


def windows_from(groups: list[list[Episode]], max_min: int) -> list[dict[str, Any]]:
    out = []
    for g in groups:
        start = (circular_median([e.start_min for e in g]) - LEAD_MIN) % 1440
        start -= start % 5
        longest = max((e.end - e.start) / 60 for e in g)
        minutes = int(min(max_min + 15, -(-(longest + TAIL_MIN) // 5) * 5))
        out.append({"start_min": int(start), "minutes": minutes, "repeats": len({e.day for e in g}),
                    "first_seen": iso_utc(dt.datetime.fromtimestamp(min(e.start for e in g), dt.timezone.utc)),
                    "last_seen": iso_utc(dt.datetime.fromtimestamp(max(e.start for e in g), dt.timezone.utc))})
    return sorted(out, key=lambda w: w["start_min"])


def learn(points: list[tuple[float, float]], doors: list[tuple[float, float]], low: float, high: float, rules: dict[str, Any], tz: ZoneInfo) -> dict[str, Any]:
    """{state: learning | learned | none_found, days, episodes, windows}. Pure: the unit tests drive it with synthetic series."""
    days = (points[-1][0] - points[0][0]) / 86400 if len(points) > 1 else 0.0
    min_rep = int(rules.get("learn_min_repeats", 3))
    if days < min_rep - 0.05:
        return {"state": "learning", "days": round(days, 2), "episodes": 0, "windows": []}
    eps = detect_episodes(points, doors, low, high, int(rules.get("defrost_max_min", 60)), tz)
    wins = windows_from(cluster(eps, min_rep, days), int(rules.get("defrost_max_min", 60)))
    return {"state": "learned" if wins else "none_found", "days": round(days, 2), "episodes": len(eps), "windows": wins}


# ---------------------------------------------------------------- storage

def run_unit(conn: sqlite3.Connection, u: sqlite3.Row, rules: dict[str, Any], tz: ZoneInfo, now_ts: float) -> dict[str, Any]:
    """Runs the learner for one unit in mode `learn` and stores the result: fresh learned windows replace the previous learned ones; confirmed
    windows stay; a candidate near a rejected window is dropped."""
    lo = int(now_ts - int(rules.get("learn_days", 7)) * 86400)
    rows = conn.execute("SELECT ts, v_avg FROM infra_temp_samples_5m WHERE unit_id = ? AND ts >= ? ORDER BY ts", (u["id"], lo)).fetchall()
    points = [(float(r["ts"]), float(r["v_avg"])) for r in rows]
    from . import temperature as t

    doors = [(float(a), float(b)) for a, b in t.door_intervals(conn, u["id"], lo, int(now_ts), now_ts)]
    res = learn(points, doors, u["low"], u["high"], rules, tz)
    have = {r["start_min"]: dict(r) for r in conn.execute("SELECT * FROM infra_temp_defrost_learned WHERE unit_id = ?", (u["id"],)).fetchall()}
    kept = [h for h in have.values() if h["status"] in ("confirmed", "rejected")]
    if res["state"] != "learning":
        conn.execute("DELETE FROM infra_temp_defrost_learned WHERE unit_id = ? AND status = 'learned'", (u["id"],))
        for w in res["windows"]:
            near = next((h for h in kept if _circ(h["start_min"], w["start_min"]) <= TOLERANCE_MIN), None)
            if near is not None:
                if near["status"] == "confirmed":
                    conn.execute("UPDATE infra_temp_defrost_learned SET repeats = ?, last_seen = ? WHERE unit_id = ? AND start_min = ?",
                                 (w["repeats"], w["last_seen"], u["id"], near["start_min"]))
                continue
            conn.execute("""INSERT OR REPLACE INTO infra_temp_defrost_learned(unit_id, start_min, minutes, repeats, status, first_seen, last_seen)
                            VALUES (?,?,?,?, 'learned', ?, ?)""", (u["id"], w["start_min"], w["minutes"], w["repeats"], w["first_seen"], w["last_seen"]))
    has_any = conn.execute("SELECT 1 FROM infra_temp_defrost_learned WHERE unit_id = ? AND status IN ('learned','confirmed') LIMIT 1", (u["id"],)).fetchone()
    state = res["state"] if res["state"] == "learning" else ("learned" if has_any else "none_found")
    conn.execute("""INSERT INTO infra_temp_defrost_state(unit_id, state, ran_at, days, episodes) VALUES (?,?,?,?,?)
                    ON CONFLICT(unit_id) DO UPDATE SET state = excluded.state, ran_at = excluded.ran_at, days = excluded.days, episodes = excluded.episodes""",
                 (u["id"], state, iso_utc(dt.datetime.fromtimestamp(now_ts, dt.timezone.utc)), res["days"], res["episodes"]))
    return {**res, "state": state}


def state_of(conn: sqlite3.Connection, unit_id: str) -> dict[str, Any] | None:
    try:
        r = conn.execute("SELECT * FROM infra_temp_defrost_state WHERE unit_id = ?", (unit_id,)).fetchone()
    except sqlite3.Error:
        return None
    return dict(r) if r else None
