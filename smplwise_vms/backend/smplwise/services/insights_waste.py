"""CR-INSIGHT215 part 3: the waste detector (EXPANSION_IDEAS ideas 26 and 14) - read-only, no model, every threshold a setting.

1. EMPTY ROOM (`empty_room`): a light / air conditioner (the domains of the setting `waste.domains`) is ON while its room (the Home Assistant
   area of the device) is EMPTY - every motion / occupancy / presence sensor of the area reported `off`, and none reported `on` within the last
   `empty_after_min` minutes (the presence decay). A stretch counts when it lasts at least `min_waste_min` minutes. A room whose sensors say
   nothing we can read (unavailable, before the history) is NOT empty: unknown is never waste.
2. AFTER HOURS (`after_hours`): for a device in an area WITHOUT a presence sensor (emptiness cannot be judged there), ON inside the nightly
   window `night_from`..`night_to` (installation zone) for at least `night_min_min` minutes. A device in an area with a presence sensor is judged
   by rule 1 only, so a minute is never counted twice.
3. NIGHT CONSUMPTION ANOMALY (`energy`): per active electricity meter and night (the same nightly window), the energy of the night against the
   MEDIAN of the same weekday's night over the previous `baseline_weeks` weeks (nights whose data coverage is at least `baseline_min_coverage`;
   at least two of them). An anomaly is `actual >= energy_factor x baseline` AND `actual - baseline >= energy_min_kwh`, on a night that is itself
   covered. Quarter-hour energy from the electricity store (raw Wh; the EL6 calibration factor is not applied - CR section 9).

Protected switches (CR-019: an administrator's protection - servers, fridges, pumps) are never listed. Presence is ROOM level only: the room
sensors of Home Assistant; no person, phone or presence-app datum is read (CR section 5). Read-only: the local state history, the entity
mirror, the meter registry and the electricity store; nothing is written and nothing is sent - turning a device off stays the operator's
explicit action on the existing screens."""
from __future__ import annotations

import datetime as dt
import hashlib
import sqlite3
import statistics
from typing import Any
from zoneinfo import ZoneInfo

from . import insights_common as ic

PRESENCE_CLASSES = ("motion", "occupancy", "presence")
OFF_CLIMATE = frozenset({"off"})
MAX_ITEMS = 200
MAX_DEVICES = 2000  # judged devices per request (a very large installation answers the first ones and says so)


def item_key(kind: str, ref: str) -> str:
    return hashlib.sha256(f"{kind}:{ref}".encode("utf-8")).hexdigest()[:12]


def _on(domain: str, state: str | None) -> bool:
    if state is None:
        return False
    if domain == "climate":
        return state not in OFF_CLIMATE
    return state == "on"


def _protected(conn: sqlite3.Connection) -> set[str]:
    try:
        return {r[0] for r in conn.execute("SELECT entity_id FROM device_bulk_protected WHERE source = 'manual' OR reviewed = 1").fetchall()}
    except sqlite3.Error:
        return set()


def _devices(conn: sqlite3.Connection, domains: list[str]) -> list[sqlite3.Row]:
    return conn.execute(f"""SELECT e.entity_id, e.name, e.original_name, e.domain, e.area_id, COALESCE(a.name, e.area_name) AS area_name, fl.name AS floor_name
                            FROM ha_entities e LEFT JOIN ha_areas a ON a.area_id = e.area_id LEFT JOIN ha_floors fl ON fl.floor_id = a.floor_id
                            WHERE e.removed_at IS NULL AND e.disabled = 0 AND e.domain IN ({','.join('?' * len(domains))})
                            ORDER BY e.entity_id LIMIT ?""", (*domains, MAX_DEVICES + 1)).fetchall()


def _presence_by_area(conn: sqlite3.Connection) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for r in conn.execute(f"""SELECT entity_id, area_id FROM ha_entities WHERE removed_at IS NULL AND disabled = 0 AND domain = 'binary_sensor'
                              AND device_class IN ({','.join('?' * len(PRESENCE_CLASSES))}) AND area_id IS NOT NULL AND area_id <> ''""",
                          PRESENCE_CLASSES).fetchall():
        out.setdefault(r["area_id"], []).append(r["entity_id"])
    return out


def empty_intervals(conn: sqlite3.Connection, sensors: list[str], lo: float, hi: float, decay_s: float) -> list[tuple[float, float]]:
    """When the room was KNOWN empty: every sensor known `off`, minus every `on` stretch extended by the decay."""
    known_off: list[tuple[float, float]] | None = None
    occupied: list[tuple[float, float]] = []
    for s in sensors:
        segs = ic.timeline(conn, s, lo - decay_s, hi)
        off = [(g.start, g.end) for g in segs if g.state == "off"]
        occupied += [(g.start, g.end + decay_s) for g in segs if g.state is not None and g.state != "off"]
        known_off = off if known_off is None else ic.intersect(known_off, off)
    if not known_off:
        return []
    return ic.intersect(ic.subtract(known_off, occupied), [(lo, hi)])


def devices(conn: sqlite3.Connection, scope: ic.Scope | None, lo: float, hi: float, cfg: dict[str, Any], tz: ZoneInfo) -> dict[str, Any]:
    rows = _devices(conn, list(cfg["domains"]))
    truncated = len(rows) > MAX_DEVICES
    rows = rows[:MAX_DEVICES]
    protected = _protected(conn)
    presence = _presence_by_area(conn)
    night = ic.local_windows(lo, hi, tz, cfg["night_from"], cfg["night_to"])
    decay, min_waste, min_night = cfg["empty_after_min"] * 60.0, cfg["min_waste_min"] * 60.0, cfg["night_min_min"] * 60.0
    empty_cache: dict[str, list[tuple[float, float]]] = {}
    items: list[dict[str, Any]] = []
    judged = 0
    for r in rows:
        eid = r["entity_id"]
        if eid in protected or (scope is not None and not scope.sees(eid)):
            continue
        judged += 1
        segs = ic.timeline(conn, eid, lo, hi)
        on = ic.merge([(g.start, g.end) for g in segs if _on(r["domain"], g.state)])
        if not on:
            continue
        sensors = presence.get(r["area_id"] or "", [])
        if sensors:
            if r["area_id"] not in empty_cache:
                empty_cache[r["area_id"]] = empty_intervals(conn, sensors, lo, hi, decay)
            kind, hits = "empty_room", [x for x in ic.merge(ic.intersect(on, empty_cache[r["area_id"]])) if x[1] - x[0] >= min_waste]
        else:
            kind, hits = "after_hours", [x for x in ic.merge(ic.intersect(on, night)) if x[1] - x[0] >= min_night]
        if not hits:
            continue
        items.append({"key": item_key(kind, eid), "kind": kind, "name": ic.friendly(r, "התקן"), "area": r["area_name"], "floor": r["floor_name"], "domain": r["domain"],
                      "minutes": int(ic.total(hits) // 60), "segments": len(hits), "longest_min": int(max(b - a for a, b in hits) // 60),
                      "first_at": ic.iso(hits[0][0]), "last_at": ic.iso(hits[-1][1])})
    items.sort(key=lambda x: (-x["minutes"], x["name"]))
    return {"items": items[:MAX_ITEMS], "items_more": max(0, len(items) - MAX_ITEMS), "judged": judged, "truncated": truncated,
            "minutes": {k: sum(i["minutes"] for i in items if i["kind"] == k) for k in ("empty_room", "after_hours")}}


def _night_of(day: dt.date, tz: ZoneInfo, hhmm_from: str, hhmm_to: str) -> tuple[int, int]:
    fh, fm = map(int, hhmm_from.split(":"))
    th, tm = map(int, hhmm_to.split(":"))
    a = dt.datetime.combine(day, dt.time(fh, fm), tzinfo=tz)
    b = dt.datetime.combine(day + dt.timedelta(days=1) if (th, tm) <= (fh, fm) else day, dt.time(th, tm), tzinfo=tz)
    return int(a.timestamp()), int(b.timestamp())


def _window_wh(buckets: dict[int, tuple[int, int]], a: int, b: int, bucket_s: int) -> tuple[int, float]:
    wh = cov = 0
    t = a - a % bucket_s
    while t < b:
        hit = buckets.get(t)
        if hit is not None:
            wh += hit[0]
            cov += hit[1]
        t += bucket_s
    return wh, min(1.0, cov / max(1, b - a))


def energy(conn: sqlite3.Connection, store: Any, scope: ic.Scope | None, lo: float, hi: float, cfg: dict[str, Any], tz: ZoneInfo) -> dict[str, Any]:
    """Night consumption anomalies per active meter, for every night that ENDED inside [lo, hi). `store` None = no electricity store here."""
    if store is None:
        return {"available": False, "items": [], "meters": 0}
    try:
        meters = conn.execute("SELECT id, display_name, source_ref FROM energy_meters WHERE status = 'active' ORDER BY display_name").fetchall()
    except sqlite3.Error:
        return {"available": False, "items": [], "meters": 0}
    weeks, factor = int(cfg["baseline_weeks"]), float(cfg["energy_factor"])
    min_wh, min_cov = float(cfg["energy_min_kwh"]) * 1000.0, float(cfg["baseline_min_coverage"])
    first = dt.datetime.fromtimestamp(lo, dt.timezone.utc).astimezone(tz).date() - dt.timedelta(days=1)
    last = dt.datetime.fromtimestamp(hi, dt.timezone.utc).astimezone(tz).date()
    nights = []
    d = first
    while d <= last:
        a, b = _night_of(d, tz, cfg["night_from"], cfg["night_to"])
        if lo <= b <= hi:
            nights.append((d, a, b))
        d += dt.timedelta(days=1)
    items: list[dict[str, Any]] = []
    shown = 0
    bucket_s = int(getattr(store, "BUCKET_S", 900) or 900)
    for m in meters:
        if scope is not None and not scope.sees(m["source_ref"]):
            continue
        shown += 1
        if not nights:
            continue
        span_lo = nights[0][1] - weeks * 7 * 86400
        buckets = {bk: (wh, cs) for bk, wh, cs, _q in store.intervals(m["id"], span_lo - span_lo % bucket_s, nights[-1][2])}
        for day, a, b in nights:
            wh, cov = _window_wh(buckets, a, b, bucket_s)
            if cov < min_cov:
                continue
            base = []
            for k in range(1, weeks + 1):
                pa, pb = _night_of(day - dt.timedelta(days=7 * k), tz, cfg["night_from"], cfg["night_to"])
                pwh, pcov = _window_wh(buckets, pa, pb, bucket_s)
                if pcov >= min_cov:
                    base.append(pwh)
            if len(base) < 2:
                continue
            baseline = statistics.median(base)
            if wh >= factor * baseline and wh - baseline >= min_wh:
                items.append({"key": item_key("energy", f"{m['id']}:{day.isoformat()}"), "kind": "energy", "name": m["display_name"], "night": day.isoformat(),
                              "from": ic.iso(a), "to": ic.iso(b), "kwh": round(wh / 1000, 2), "baseline_kwh": round(baseline / 1000, 2),
                              "ratio": round(wh / baseline, 2) if baseline > 0 else None, "baseline_nights": len(base)})
    items.sort(key=lambda x: (x["night"], x["name"]), reverse=True)
    return {"available": True, "items": items[:MAX_ITEMS], "items_more": max(0, len(items) - MAX_ITEMS), "meters": shown}


def report(conn: sqlite3.Connection, store: Any, scope: ic.Scope | None, lo: float, hi: float, cfg: dict[str, Any] | None = None) -> dict[str, Any]:
    cfg = cfg or ic.load(conn)["waste"]
    tz = ic.site_zone(conn)
    return {"from": ic.iso(lo), "to": ic.iso(hi), "zone": str(tz), "night": {"from": cfg["night_from"], "to": cfg["night_to"]},
            "devices": devices(conn, scope, lo, hi, cfg, tz), "energy": energy(conn, store, scope, lo, hi, cfg, tz)}
