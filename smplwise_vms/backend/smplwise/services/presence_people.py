"""WHOIN034-295 (board r034): "who is in the building" - the people the phone app currently places inside, by floor and area.

Read-only over what CR-027 already stores (services/presence.py): the CURRENT presence state of each registered device (from its
newest enter / exit / fix), and the newest `beacon` and `network` sensor reports in the retention-limited event log, matched
against the administrator's beacons and Wi-Fi sites (הגדרות › אפליקציה לנייד › מקומות). Nothing is written but a throttled audit row.

Placement, most precise first, per device:
1. a BEACON report (sensor `beacon`, value `beacon_id` - or `uuid` with `major` / `minor` - and `proximity`) no older than
   `people.beacon_max_age_minutes`, at `people.min_proximity` or nearer, of a configured beacon: its site, floor and area;
2. a NETWORK report (sensor `network`, value `ssid_hash`) no older than `people.wifi_max_age_minutes` matching a Wi-Fi site: its
   site and (optional) floor;
3. the GEOFENCE state: `inside: true` no older than `people.stale_minutes`: its site only.
A newer `inside: false` (an exit, a fix outside every geofence) beats an older beacon / network report: the person left.
A person with several phones takes the most precise, then the newest placement.

Privacy (CR-027 section 3, the employee notice is not final - the master switch stays OFF per installation until it is):
- nothing at all while `presence.enabled` is off;
- a device counts only while its phone reports the sensor ON (location with `sharing: true` for the geofence state) and it
  acknowledged the CURRENT notice version (a new notice withdraws everyone until they acknowledge again);
- a person on the opt-out list (self-service, `PUT presence/people/me`) is never named and never placed on a floor or an area:
  they appear only in the installation-wide `hidden` count, so the total stays right for an evacuation;
- `people.show_names: false` shows counts only, never a name;
- the caller sees a person only where they hold `presence.view` (a floor-scoped holder sees that floor; a person placed on a
  site only needs it at installation scope), and the read is audited once per viewer per 10 minutes, without names."""
from __future__ import annotations

import datetime as dt
import json
import sqlite3
import threading
import time
from typing import Any

from ..rbac import INSTALLATION, Principal, authorize
from . import presence as P

VIEW = "presence.view"
AUDIT_EVERY_S = 600
_PRECISION = {"beacon": 3, "wifi": 2, "geofence": 1}
_AUDITED: dict[str, float] = {}
_LOCK = threading.Lock()


def reset() -> None:
    with _LOCK:
        _AUDITED.clear()


def should_audit(user_id: str) -> bool:
    """One `presence.people.view` audit row per viewer per AUDIT_EVERY_S (the screen polls)."""
    now = time.monotonic()
    with _LOCK:
        if now - _AUDITED.get(user_id, -AUDIT_EVERY_S) < AUDIT_EVERY_S:
            return False
        _AUDITED[user_id] = now
        if len(_AUDITED) > 5000:
            _AUDITED.clear()
            _AUDITED[user_id] = now
        return True


def _value(text: str | None) -> dict[str, Any]:
    try:
        v = json.loads(text) if text else {}
    except ValueError:
        return {}
    return v if isinstance(v, dict) else {}


def _latest_sensor(conn: sqlite3.Connection, device_id: str, sensor: str, since: str) -> tuple[dict[str, Any], str] | None:
    r = conn.execute(
        "SELECT value_json, at FROM mobile_presence_events WHERE device_id = ? AND type = 'sensor' AND sensor = ? AND at >= ? ORDER BY at DESC LIMIT 1",
        (device_id, sensor, since),
    ).fetchone()
    return (_value(r["value_json"]), r["at"]) if r else None


def match_beacon(value: dict[str, Any], beacons: list[dict[str, Any]]) -> dict[str, Any] | None:
    """The configured beacon a `beacon` sensor value names: by `beacon_id`, else by `uuid` (+ `major` / `minor` when the beacon has them)."""
    bid = value.get("beacon_id")
    if isinstance(bid, str) and bid:
        return next((b for b in beacons if b.get("id") == bid), None)
    uuid = str(value.get("uuid") or "").strip().lower()
    if not uuid:
        return None
    for b in beacons:
        if str(b.get("uuid") or "").lower() != uuid:
            continue
        if b.get("major") is not None and value.get("major") != b.get("major"):
            continue
        if b.get("minor") is not None and value.get("minor") != b.get("minor"):
            continue
        return b
    return None


def match_wifi(value: dict[str, Any], wifi_sites: list[dict[str, Any]]) -> dict[str, Any] | None:
    h = value.get("ssid_hash")
    if not isinstance(h, str) or not h:
        # PRESENCE307 (phone mode, the default): the server already derived the match when the event arrived and did NOT keep the hash,
        # only `wifi_match` / `wifi_site_id` (a configured site). The floor is then known only when every Wi-Fi network of that site
        # names the same floor; otherwise the person is placed on the site only.
        site = value.get("wifi_site_id")
        if value.get("wifi_match") is not True or not isinstance(site, str) or not site:
            return None
        of_site = [w for w in wifi_sites if w.get("site_id") == site]
        floors = {w.get("floor_id") for w in of_site}
        if len(floors) == 1 and None not in floors:
            return of_site[0]
        return {"site_id": site, "floor_id": None}
    h = h.lower()
    return next((w for w in wifi_sites if h in (w.get("ssid_hashes") or [])), None)


def _proximity_ok(value: dict[str, Any], min_proximity: str) -> bool:
    prox = value.get("proximity")
    if prox not in P.PROXIMITY:
        return False
    return P.PROXIMITY.index(prox) <= P.PROXIMITY.index(min_proximity)


def place_device(conn: sqlite3.Connection, d: sqlite3.Row, st: dict[str, Any], now: dt.datetime) -> dict[str, Any] | None:
    """Where one device places its user right now, or None (outside, unknown, stale, or not shared)."""
    ps = st["people"]
    allowed = set(st["sensors_allowed"])
    status = P._json(d["status_json"], {})
    sensors = status.get("sensors") if isinstance(status.get("sensors"), dict) else {}
    presence = P._json(d["presence_json"], {})
    loc_on = "location" in allowed and sensors.get("location") == "on" and bool(status.get("sharing"))
    left_at = presence.get("at") if loc_on and presence.get("inside") is False and isinstance(presence.get("at"), str) else None
    found: list[dict[str, Any]] = []
    if "beacon" in allowed and sensors.get("beacon") == "on" and st["beacons"]:
        got = _latest_sensor(conn, d["id"], "beacon", P.iso(now - dt.timedelta(minutes=ps["beacon_max_age_minutes"])))
        if got and _proximity_ok(got[0], ps["min_proximity"]):
            b = match_beacon(got[0], st["beacons"])
            if b is not None:
                found.append({"source": "beacon", "site_id": b.get("site_id"), "floor_id": b.get("floor_id"), "zone_id": b.get("zone_id"), "at": got[1]})
    if "network" in allowed and sensors.get("network") == "on" and st["wifi_sites"]:
        got = _latest_sensor(conn, d["id"], "network", P.iso(now - dt.timedelta(minutes=ps["wifi_max_age_minutes"])))
        if got:
            w = match_wifi(got[0], st["wifi_sites"])
            if w is not None:
                found.append({"source": "wifi", "site_id": w.get("site_id"), "floor_id": w.get("floor_id"), "zone_id": None, "at": got[1]})
    if loc_on and presence.get("inside") is True and isinstance(presence.get("at"), str):
        at = P._parse(presence["at"])
        if at is not None and at >= now - dt.timedelta(minutes=ps["stale_minutes"]):
            found.append({"source": "geofence", "site_id": presence.get("site_id"), "floor_id": None, "zone_id": None, "at": presence["at"]})
    if left_at:
        found = [f for f in found if f["at"] > left_at]  # an exit newer than the report: the person left
    if not found:
        return None
    return max(found, key=lambda f: (_PRECISION[f["source"]], f["at"]))


def people_view(conn: sqlite3.Connection, principal: Principal) -> dict[str, Any]:
    """The screen's whole answer (GET presence/people)."""
    st = P.load_settings(conn)
    ps = st["people"]
    now = P.now_utc()
    configured = {"sites": len(st["sites"]), "beacons": len(st["beacons"]), "wifi_sites": len(st["wifi_sites"])}
    base: dict[str, Any] = {
        "enabled": st["enabled"], "generated_at": P.iso(now), "configured": configured,
        "settings": {k: ps[k] for k in ("show_names", "refresh_seconds", "stale_minutes", "beacon_max_age_minutes", "wifi_max_age_minutes", "min_proximity")},
        "people": [], "floors": [], "sites": [], "totals": {"inside": 0, "named": 0, "hidden": 0, "on_floors": 0, "site_only": 0},
    }
    install_view = authorize(conn, principal, VIEW, INSTALLATION).allowed
    floor_rows = conn.execute(
        "SELECT f.id, f.name, f.level, f.sort_order, b.name AS building_name, b.sort_order AS b_order FROM floors f JOIN buildings b ON b.id = f.building_id"
        " WHERE f.deleted_at IS NULL AND b.deleted_at IS NULL ORDER BY b.sort_order, b.name, f.level DESC, f.sort_order"
    ).fetchall()
    visible_floor: dict[str, bool] = {}

    def floor_ok(fid: str) -> bool:
        if fid not in visible_floor:
            visible_floor[fid] = install_view or authorize(conn, principal, VIEW, ("floor", fid)).allowed
        return visible_floor[fid]

    floors = {r["id"]: r for r in floor_rows if floor_ok(r["id"])}
    all_floor_ids = {r["id"] for r in floor_rows}
    zones = {r["id"]: r for r in conn.execute("SELECT id, floor_id, name FROM spatial_zones WHERE deleted_at IS NULL").fetchall()}
    site_names = {str(s.get("id")): s.get("name") or str(s.get("id")) for s in st["sites"]}
    base["floors"] = [{"floor_id": fid, "name": r["name"], "level": r["level"], "building": r["building_name"], "count": 0, "zones": []} for fid, r in floors.items()]
    if not st["enabled"]:
        return base
    opted_out = set(P.opt_out_users(conn))
    best: dict[str, dict[str, Any]] = {}
    names: dict[str, str] = {}
    rows = conn.execute(
        "SELECT d.*, u.username, u.display_name FROM mobile_devices d JOIN users u ON u.id = d.user_id"
        " WHERE d.revoked_at IS NULL AND u.active = 1 AND d.notice_ack_version >= ?",
        (st["notice_version"],),
    ).fetchall()
    for d in rows:
        place = place_device(conn, d, st, now)
        if place is None:
            continue
        cur = best.get(d["user_id"])
        if cur is None or (_PRECISION[place["source"]], place["at"]) > (_PRECISION[cur["source"]], cur["at"]):
            best[d["user_id"]] = place
            names[d["user_id"]] = d["display_name"] or d["username"] or ""
    floor_count: dict[str, int] = {}
    zone_count: dict[tuple[str, str], int] = {}
    site_count: dict[str, int] = {}
    people: list[dict[str, Any]] = []
    totals = base["totals"]
    for uid, place in best.items():
        fid = place["floor_id"]
        if fid and fid not in floors:
            if fid in all_floor_ids:
                continue  # placed on a floor the caller may not see
            fid = None  # the beacon names a floor that was deleted since: the site only
        if not fid and not install_view:
            continue  # placed on a site only: visible at installation scope
        totals["inside"] += 1
        if uid in opted_out:
            totals["hidden"] += 1
            continue
        zid = place["zone_id"] if fid and place["zone_id"] in zones and zones[place["zone_id"]]["floor_id"] == fid else None
        if fid:
            totals["on_floors"] += 1
            floor_count[fid] = floor_count.get(fid, 0) + 1
            if zid:
                zone_count[(fid, zid)] = zone_count.get((fid, zid), 0) + 1
        else:
            totals["site_only"] += 1
            sid = str(place["site_id"] or "")
            site_count[sid] = site_count.get(sid, 0) + 1
        if ps["show_names"]:
            fr = floors.get(fid) if fid else None
            people.append({
                "user_id": uid, "name": names.get(uid) or uid, "source": place["source"], "at": place["at"],
                "site_id": place["site_id"], "site_name": site_names.get(str(place["site_id"]), "") if place["site_id"] else "",
                "floor_id": fid, "floor_name": fr["name"] if fr else "", "zone_id": zid, "zone_name": zones[zid]["name"] if zid else "",
            })
    totals["named"] = len(people)
    order = {fid: i for i, fid in enumerate(floors)}
    people.sort(key=lambda p: (order.get(p["floor_id"], 10_000), p["zone_name"], p["name"]))
    for f in base["floors"]:
        f["count"] = floor_count.get(f["floor_id"], 0)
        f["zones"] = sorted(({"zone_id": z, "name": zones[z]["name"], "count": n} for (fl, z), n in zone_count.items() if fl == f["floor_id"]), key=lambda z: z["name"])
    base["sites"] = sorted(({"site_id": s, "name": site_names.get(s, s), "count": n} for s, n in site_count.items()), key=lambda s: s["name"])
    base["people"] = people
    return base
