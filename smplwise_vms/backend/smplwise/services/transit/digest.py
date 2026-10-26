"""BUSTIMES-295 - what a screen is told: a digest of OUR cache, never of the third party.

State (`state`), from the age of the cache (the oldest fetch among the screen's stops):
* `fresh`   age <= max(3 minutes, 3 x the poll interval): the rows come with a countdown (minutes), or the clock time from `clock_after_min` on;
* `cached`  age up to the installation's grace (default 30 minutes): the source is not answering; the screen shows the SCHEDULED clock times
            (no countdown) and "not updated since HH:MM" - planned data stays right for hours, which is why last-known is safe;
* `expired` older than the grace (or never fetched): the panel says it is unavailable and shows no row (the rotating slide is skipped);
* `off`     the module, the screen's switch or the stop selection is off: nothing is drawn.

The server drops what has passed, applies the walking-time offset, the window and the rows, and groups by line when asked. Local clock text
(`hm`) is made here in the installation's zone; the screen never converts from UTC. The digest carries stop codes and public line data only."""
from __future__ import annotations

import datetime as dt
import json
import sqlite3
from typing import Any
from zoneinfo import ZoneInfo

from ...db import get_setting
from . import catalogue, model, stride

DISTANCE_MIN_M = 25  # nearer than this the bus is "at the stop": no distance is printed
MORE_PER_GROUP = 2  # a grouped row shows the next arrival plus up to this many after it
NEXT_MAX_AGE_H = 12


def _hm(t: dt.datetime, tz: ZoneInfo) -> str:
    return t.astimezone(tz).strftime("%H:%M")


def _mins(t: dt.datetime, now: dt.datetime) -> int:
    return max(0, int((t - now).total_seconds() // 60))


def _quality(est: Any, est_age: float | None, state: str, limit_s: int) -> str:
    """`realtime` (shown as an ESTIMATE) = a vehicle position no older than the freshness limit while the source answers; `stale` = an estimate
    exists but its position is too old (or the source is down: the scheduled time is shown); `scheduled` = no estimate for the row."""
    if est is None:
        return "scheduled"
    return "realtime" if state == "fresh" and est_age is not None and est_age <= limit_s else "stale"


def round_distance(m: Any) -> int | None:
    """Metres as a screen prints them: to 50 m under 1 km, to 100 m (0.1 km) above; None when unknown or too close to matter."""
    if not isinstance(m, (int, float)) or isinstance(m, bool) or m < DISTANCE_MIN_M:
        return None
    return int(m / 50.0 + 0.5) * 50 if m < 1000 else int(m / 100.0 + 0.5) * 100  # half up, not banker's rounding


def _extra(row: dict[str, Any]) -> dict[str, Any]:
    out = {"scheduled_time": row["sched"], "estimated_time": row["est"], "quality": row["q"], "age_seconds": row["age"]}
    if row.get("dist") is not None:  # only a derived estimate with a fresh position carries a distance
        out["distance_m"], out["position_age_s"] = row["dist"], row["age"]
    return out


def _shape(row: dict[str, Any], t: dt.datetime, now: dt.datetime, tz: ZoneInfo) -> dict[str, Any]:
    """`at` is the instant the minutes count to: the estimate when it is real-time, else the schedule (the two are also given as they are)."""
    return {"line": row["line"], "dest": row["dest"], "stop": row["stop"], "at": row["at"], "hm": _hm(t, tz), "mins": _mins(t, now), **_extra(row)}


def _arrange(rows: list[dict[str, Any]], limit: int, group: str, now: dt.datetime, tz: ZoneInfo) -> dict[str, Any]:
    """Flat rows, or (group `always`, or `auto` with more arrivals than rows) one row per line + destination + stop with its next arrivals."""
    grouped = group == "always" or (group == "auto" and len(rows) > limit)
    if not grouped:
        items = [_shape(r, r["_t"], now, tz) for r in rows]
    else:
        by: dict[tuple[str, str, int], dict[str, Any]] = {}
        for r in rows:
            key = (r["line"], r["dest"], r["stop"])
            g = by.get(key)
            if g is None:
                by[key] = {**_shape(r, r["_t"], now, tz), "more": []}
            elif len(g["more"]) < MORE_PER_GROUP:
                g["more"].append({"at": r["at"], "hm": _hm(r["_t"], tz), "mins": _mins(r["_t"], now), "quality": r["q"]})
        items = list(by.values())
    return {"items": items[:limit], "overflow": max(0, len(items) - limit), "grouped": grouped}


def _state(age_s: float | None, grace_min: int, fresh_s: int = model.FRESH_S) -> str:
    if age_s is None:
        return "expired"
    if age_s <= fresh_s:
        return "fresh"
    if age_s <= max(fresh_s, grace_min * 60):
        return "cached"
    return "expired"


def build(conn: sqlite3.Connection, screen: dict[str, Any], now: dt.datetime, tz: ZoneInfo) -> dict[str, Any]:
    cfg = model.load_config(get_setting(conn, model.CONFIG_KEY, ""))
    codes = model.selection(cfg, screen) if cfg["enabled"] and screen.get("enabled") else []
    if not codes:
        return {"state": "off"}
    names = {s["code"]: s["name"] for s in cfg["stops"]}
    stops: list[dict[str, Any]] = []
    for c in codes:
        name = names.get(c) or (catalogue.get(conn, c) or {}).get("name") or str(c)
        stops.append({"code": c, "name": name})
    marks = ",".join("?" * len(codes))
    cached = {r["code"]: r for r in conn.execute(f"SELECT code, fetched_at, rows_json FROM transit_cache WHERE code IN ({marks})", codes).fetchall()}
    fetched = [stride.parse_time(cached[c]["fetched_at"]) for c in codes if c in cached]
    fetched = [f for f in fetched if f is not None]
    oldest = min(fetched) if fetched else None
    age = max(0.0, (now - oldest).total_seconds()) if oldest else None
    state = _state(age, cfg["stale_grace_min"], model.fresh_s(cfg))
    out: dict[str, Any] = {
        "state": state, "now": now.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "fetched_at": oldest.strftime("%Y-%m-%dT%H:%M:%SZ") if oldest else None,
        "age_s": int(age) if age is not None else None, "updated_hm": _hm(oldest, tz) if oldest else None, "layout": screen["layout"],
        "window_min": screen["window_min"], "rows": screen["rows"], "dwell_s": screen["dwell_s"], "clock_after_min": cfg["clock_after_min"],
        "stale_grace_min": cfg["stale_grace_min"], "refresh_s": model.screen_refresh_s(cfg, screen),
        "fresh_s": model.fresh_s(cfg), "position_fresh_s": model.position_fresh_s(cfg),
        "show_distance": model.show_distance(cfg, screen), "stops": stops, "multi": len(stops) > 1, "realtime": False,
    }
    limit_s, want_dist = model.position_fresh_s(cfg), model.show_distance(cfg, screen)
    fetched_at = {c: stride.parse_time(cached[c]["fetched_at"]) for c in codes if c in cached}
    if state == "expired":
        return out
    start = now + dt.timedelta(minutes=cfg["hide_closer_min"])
    end = now + dt.timedelta(minutes=screen["window_min"])
    every: list[dict[str, Any]] = []
    for c in codes:
        row = cached.get(c)
        if row is None:
            continue
        try:
            rows = json.loads(row["rows_json"] or "[]")
        except ValueError:
            rows = []
        cache_age = max(0.0, (now - fetched_at[c]).total_seconds()) if fetched_at.get(c) else 0.0
        for r in rows:
            sched = stride.parse_time(r.get("at"))
            if sched is None or not isinstance(r.get("line"), str):
                continue
            est = stride.parse_time(r.get("est")) if r.get("est") else None
            est_age = (float(r["est_age_s"]) + cache_age) if est is not None and isinstance(r.get("est_age_s"), (int, float)) else None
            q = _quality(est, est_age, state, limit_s)
            t = est if q == "realtime" and est is not None else sched
            if t <= now:
                continue
            every.append({"line": r["line"], "dest": str(r.get("dest") or ""), "stop": c, "at": t.strftime("%Y-%m-%dT%H:%M:%SZ"), "_t": t, "sched": r["at"],
                          "est": r.get("est") if est is not None else None, "q": q, "age": int(est_age if est_age is not None else cache_age),
                          "dist": round_distance(r.get("distance_m")) if q == "realtime" and want_dist else None})
    every.sort(key=lambda r: (r["_t"], r["line"]))
    inside = [r for r in every if start <= r["_t"] <= end]
    out.update(_arrange(inside, screen["rows"], screen["group"], now, tz))
    out["realtime"] = any(r["q"] == "realtime" for r in inside)
    later = next((r for r in every if r["_t"] > end), None)
    out["next"] = _shape(later, later["_t"], now, tz) if later is not None and not inside else None
    if screen["layout"] == "slide":
        cols = []
        for s in stops:
            mine = [r for r in inside if r["stop"] == s["code"]]
            nxt = next((r for r in every if r["stop"] == s["code"] and r["_t"] > end), None) if not mine else None
            cols.append({"stop": s["code"], "name": s["name"], **_arrange(mine, screen["rows"], screen["group"], now, tz),
                         "next": _shape(nxt, nxt["_t"], now, tz) if nxt else None})
        out["columns"] = cols
    return out
