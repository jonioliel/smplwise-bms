"""CR-TIMESCRUB101 slice 1: the building at an instant (snapshot) and over a period (range) for the historical map.

Every layer of the floor is authorised on its own (section 6): a layer the caller may not see comes back `not_permitted` with NO
data - not even entity ids. Every layer says what is recorded and for how long (status, retention, from) and never dresses the
last value up as the state of the past (AGENTS.md "Historical unknown is not current state"):

- `ha_history.state_at` stays the single reader of `ha_state_history` for an instant (forward fill <= 24 h);
- a recorded gap (`ha_state_history_gaps`, the sync was not listening) makes every HA state unknown when the instant falls in it
  OR when the gap lies between the state's last change and the instant (a state is never carried across a gap);
- elevators replay their derived state (`infra_elevator_states`); the cab position is not recorded and is said so.

Pure reads: no Home Assistant call, no write except the one audit row per (user, floor, day) when the presence layer was served.
"""
from __future__ import annotations

import datetime as dt
import math
import sqlite3
from typing import Any

from ..rbac import INSTALLATION, Principal, authorize
from . import ha_history
from .timeutil import iso_utc, parse_utc

ENTITY_LAYERS = ("lights", "presence", "openings", "temperature", "devices", "alarm")
RANGE_LAYERS = (*ENTITY_LAYERS, "elevators")
# section 6: the permission of each layer and the scope it is judged on
LAYER_PERMISSION = {"lights": "devices.read", "openings": "devices.read", "temperature": "devices.read", "devices": "devices.read",
                    "presence": "history.presence", "alarm": "alarm.view", "elevators": "devices.read"}
# keep in step with frontend/src/map/room-state.ts (the live map's classification, which the replay mirrors)
PRESENCE_CLASSES = frozenset(ha_history.PRESENCE_CLASSES)
OPENING_CLASSES = frozenset({"door", "window", "opening", "garage_door", "gate"})
PRESENCE_WORDS = ("motion", "presence", "occupancy", "pir")
OPENING_WORDS = ("door", "window", "gate", "garage")

MAX_POINTS = 10_000       # change-points per range answer before it is bucketed (section 4.2)
MAX_BUCKETS = 1_440
ROW_SCAN_CAP = 500_000    # above this many native rows in the window the range is refused (413 range_too_large)
RANGE_MAX_DEFAULT = 7
RANGE_MAX_BOUNDS = (1, 30)
ELEVATOR_RETENTION_DAYS = 8  # services/elevators.HISTORY_KEEP_S


def enabled(settings: dict[str, Any]) -> bool:
    return str(settings.get("history.timescrub", "false")) == "true"


def range_max_days(settings: dict[str, Any]) -> int:
    lo, hi = RANGE_MAX_BOUNDS
    try:
        return max(lo, min(hi, int(settings.get("history.range_max_days") or RANGE_MAX_DEFAULT)))
    except (TypeError, ValueError):
        return RANGE_MAX_DEFAULT


# ---------------------------------------------------------------- classification

def layer_of(domain: str, device_class: str | None, entity_id: str, anchor_layer: str | None) -> str:
    """The one layer an anchored entity belongs to (mirror of room-state.ts isPresenceEntity / isOpeningEntity / isLightEntity)."""
    low = entity_id.lower()
    if domain == "binary_sensor":
        if device_class:
            if device_class in PRESENCE_CLASSES:
                return "presence"
            if device_class in OPENING_CLASSES:
                return "openings"
        else:
            if any(w in low for w in PRESENCE_WORDS):
                return "presence"
            if any(w in low for w in OPENING_WORDS):
                return "openings"
        return "devices"
    if domain == "lock" or (domain == "cover" and device_class in OPENING_CLASSES):
        return "openings"
    if domain == "light" or (domain == "switch" and anchor_layer == "lights"):
        return "lights"
    if domain == "sensor" and device_class == "temperature":
        return "temperature"
    if domain == "alarm_control_panel":
        return "alarm"
    return "devices"


def floor_entities(conn: sqlite3.Connection, floor_id: str, at_iso: str | None) -> dict[str, list[str]]:
    """The floor's anchored HA entities per layer: the anchors effective at `at_iso` (all current ones when None). The switches of
    the structure's circuits are NOT added yet (slice 1: the bundle's circuit_states carry them). Sorted ids, each entity in exactly one layer. As the floor bundle
    (routers/anchors.floor_map): the anchors of the instant only from the floor's first publish on - before it, the current anchors."""
    history_from = conn.execute("SELECT MIN(published_at) FROM plan_versions WHERE floor_id = ? AND published_at IS NOT NULL", (floor_id,)).fetchone()[0]
    if at_iso and history_from and at_iso >= history_from:
        rows = conn.execute("SELECT resource_id, layer_id FROM map_anchors WHERE floor_id = ? AND resource_type = 'ha_entity' AND effective_from <= ? AND (effective_to IS NULL OR effective_to > ?)",
                            (floor_id, at_iso, at_iso)).fetchall()
    else:
        rows = conn.execute("SELECT resource_id, layer_id FROM map_anchors WHERE floor_id = ? AND resource_type = 'ha_entity' AND effective_to IS NULL", (floor_id,)).fetchall()
    anchor_layer = {r["resource_id"]: r["layer_id"] for r in rows}
    out: dict[str, list[str]] = {k: [] for k in ENTITY_LAYERS}
    if not anchor_layer:
        return out
    ids = sorted(anchor_layer)
    meta = {r["entity_id"]: r for r in conn.execute(f"SELECT entity_id, domain, device_class FROM ha_entities WHERE entity_id IN ({','.join('?' * len(ids))})", ids).fetchall()}
    for eid in ids:
        m = meta.get(eid)
        domain = m["domain"] if m else eid.split(".", 1)[0]
        out[layer_of(domain, m["device_class"] if m else None, eid, anchor_layer[eid])].append(eid)
    return out


# ---------------------------------------------------------------- permissions

def layer_permissions(conn: sqlite3.Connection, principal: Principal, floor_id: str, reach: str) -> dict[str, bool]:
    """Per layer: may the caller see it on this floor. A camera-only reader (reach "cameras") sees cameras alone (T055)."""
    out: dict[str, bool] = {}
    for layer, perm in LAYER_PERMISSION.items():
        if reach != "floor":
            out[layer] = False
        elif layer == "elevators":
            out[layer] = authorize(conn, principal, perm, INSTALLATION).allowed  # as routers/elevators.py READ
        else:
            out[layer] = authorize(conn, principal, perm, ("floor", floor_id)).allowed
    return out


def _locked(extra: dict[str, Any] | None = None) -> dict[str, Any]:
    return {"status": "not_permitted", "retention_days": None, "from": None, **(extra or {})}


# ---------------------------------------------------------------- coverage

def coverage(conn: sqlite3.Connection, lo: str, hi: str) -> dict[str, Any]:
    cov = ha_history.coverage(conn)
    return {"from": cov["from"], "to": cov["to"], "gaps": ha_history.gaps(conn, lo, hi), "forward_fill_max_s": ha_history.FORWARD_FILL_MAX_S}


def _gap_between(gaps: list[dict[str, Any]], since: str | None, at_iso: str) -> dict[str, Any] | None:
    """The gap that holds `at_iso`, or lies between `since` (the state's last change) and `at_iso`."""
    for g in gaps:
        if g["from"] <= at_iso <= g["to"]:
            return g
        if since is not None and since < g["to"] and g["from"] < at_iso:
            return g
    return None


def _retention(layer: str, presence_days: int) -> int:
    return presence_days if layer == "presence" else ha_history.RETENTION_DAYS


# ---------------------------------------------------------------- snapshot

GAP_REASON = "פער בהקלטה: המערכת לא הייתה מחוברת ולא קלטה שינויים"


def snapshot(conn: sqlite3.Connection, principal: Principal, floor_id: str, at_iso: str, reach: str, settings: dict[str, Any],
             camera_ids: list[str], cameras_allowed: bool, events_allowed: bool) -> dict[str, Any]:
    """The state of every layer of the floor at `at_iso` (section 4.1). `camera_ids` = the floor's cameras the caller may play."""
    perms = layer_permissions(conn, principal, floor_id, reach)
    t = parse_utc(at_iso)
    cov = coverage(conn, iso_utc(t - dt.timedelta(days=1)), iso_utc(t + dt.timedelta(days=1)))
    presence_days = ha_history.presence_retention_days(conn)
    per_layer = floor_entities(conn, floor_id, at_iso)
    layers: dict[str, Any] = {}
    gap_now = _gap_between(cov["gaps"], None, at_iso)
    for layer in ENTITY_LAYERS:
        if not perms[layer]:
            layers[layer] = _locked({"entities": {}})
            continue
        ids = per_layer[layer]
        block: dict[str, Any] = {"retention_days": _retention(layer, presence_days), "from": cov["from"], "entities": {}}
        if not ids:
            layers[layer] = {"status": "empty", **block}
            continue
        states = ha_history.state_at(conn, ids, at_iso)
        if str(settings.get("history.ha_secondary", "false")) == "true" and layer != "presence":
            missing = [e for e in ids if not states.get(e, {}).get("known")]
            if missing:  # S2: the HA recorder fills what the local history does not know (marked as a secondary source)
                states.update(ha_history.recorder_state_at(missing, at_iso))
        for eid in ids:
            s = dict(states.get(eid) or {"state": None, "changed_at": None, "known": False, "reason": "אין היסטוריה"})
            if s.get("source") != "ha_recorder" and _gap_between(cov["gaps"], s.get("changed_at"), at_iso) is not None:
                s.update(known=False, reason=GAP_REASON)
            block["entities"][eid] = {"state": s.get("state"), "changed_at": s.get("changed_at"), "known": bool(s.get("known")), "reason": s.get("reason"),
                                      **({"source": s["source"]} if s.get("source") and s["source"] != "vms" else {})}
        if not cov["from"] or at_iso < cov["from"]:
            status = "not_recorded"
        elif gap_now is not None:
            status = "gap"
        else:
            status = "ok"
        layers[layer] = {"status": status, **block}
    layers["elevators"] = _elevators_snapshot(conn, at_iso) if perms["elevators"] else _locked({"position": "not_recorded", "items": {}})
    layers["cameras"] = {"status": ("ok" if camera_ids else "empty") if cameras_allowed else "not_permitted", "camera_ids": camera_ids if cameras_allowed else []}
    layers["events"] = {"status": "ok" if events_allowed else "not_permitted", "retention_days": int(settings.get("events.retention_days") or 30) if events_allowed else None}
    return {"at": at_iso, "floor_id": floor_id, "settings": {"range_max_days": range_max_days(settings), "presence_retention_days": presence_days},
            "coverage": cov, "layers": layers}


def _elevator_rows(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    try:
        return conn.execute("SELECT id, name FROM infra_elevators WHERE enabled = 1 ORDER BY sort_order, name").fetchall()
    except sqlite3.OperationalError:  # a database before 0118
        return []


def _elevators_snapshot(conn: sqlite3.Connection, at_iso: str) -> dict[str, Any]:
    rows = _elevator_rows(conn)
    first = None
    try:
        first = conn.execute("SELECT MIN(at) FROM infra_elevator_states").fetchone()[0]
    except sqlite3.OperationalError:
        rows = []
    items: dict[str, Any] = {}
    for r in rows:
        last = conn.execute("SELECT at, state FROM infra_elevator_states WHERE elevator_id = ? AND at <= ? ORDER BY at DESC LIMIT 1", (r["id"], at_iso)).fetchone()
        # the evaluator writes `unknown` across a stop of the monitor (elevators.record_gap): unknown is never a state of the elevator
        known = last is not None and last["state"] != "unknown"
        items[r["id"]] = {"name": r["name"], "state": last["state"] if known else None, "at": last["at"] if last else None, "known": known}
    status = "empty" if not rows else ("not_recorded" if not first or at_iso < first else "ok")
    return {"status": status, "retention_days": ELEVATOR_RETENTION_DAYS, "from": first, "position": "not_recorded", "items": items}


# ---------------------------------------------------------------- range

class RangeTooLarge(Exception):
    def __init__(self, rows: int):
        super().__init__("range_too_large")
        self.rows = rows


def history_range(conn: sqlite3.Connection, principal: Principal, floor_id: str, lo: str, hi: str, reach: str, layers: list[str],
                  step_s: int | None = None) -> dict[str, Any]:
    """Change-points per entity over lo..hi (section 4.2). Exact when the window holds at most MAX_POINTS native rows; otherwise
    bucketed (`bucket_s`): each point is the LAST state of its bucket, its `t` the bucket's start and `n` the number of changes in
    it (the screen draws n > 1 as "changed during"). Above ROW_SCAN_CAP native rows: RangeTooLarge."""
    perms = layer_permissions(conn, principal, floor_id, reach)
    cov = coverage(conn, lo, hi)
    presence_days = ha_history.presence_retention_days(conn)
    per_layer = floor_entities(conn, floor_id, None)
    wanted = [layer for layer in RANGE_LAYERS if layer in layers]
    ids = sorted({e for layer in wanted if layer in ENTITY_LAYERS and perms[layer] for e in per_layer[layer]})
    native = 0
    if ids:
        marks = ",".join("?" * len(ids))
        native = conn.execute(f"SELECT COUNT(*) FROM ha_state_history WHERE entity_id IN ({marks}) AND changed_at > ? AND changed_at <= ?", (*ids, lo, hi)).fetchone()[0]
    if native > ROW_SCAN_CAP:
        raise RangeTooLarge(native)
    span_s = max(1.0, (parse_utc(hi) - parse_utc(lo)).total_seconds())
    bucket_s: int | None = None
    if native > MAX_POINTS:
        # the caller's step when given, never finer than MAX_BUCKETS buckets over the window
        bucket_s = max(int(step_s or 1), math.ceil(span_s / MAX_BUCKETS))
    series = _series(conn, ids, lo, hi, bucket_s) if ids else {}
    initial = ha_history.state_at(conn, ids, lo) if ids else {}
    out_layers: dict[str, Any] = {}
    for layer in wanted:
        if layer == "elevators":
            out_layers[layer] = _elevators_range(conn, lo, hi) if perms[layer] else _locked({"position": "not_recorded", "items": {}})
            continue
        if not perms[layer]:
            out_layers[layer] = _locked({"entities": {}})
            continue
        lids = per_layer[layer]
        block: dict[str, Any] = {"retention_days": _retention(layer, presence_days), "from": cov["from"], "entities": {}}
        if not lids:
            out_layers[layer] = {"status": "empty", **block}
            continue
        for eid in lids:
            ini = initial.get(eid) or {"state": None, "known": False, "changed_at": None}
            known0 = bool(ini.get("known")) and _gap_between(cov["gaps"], ini.get("changed_at"), lo) is None
            block["entities"][eid] = {"initial": {"state": ini.get("state") if known0 else None, "known": known0},
                                      "points": series.get(eid, {}).get("points", []), "bounded_after": series.get(eid, {}).get("bounded_after", False)}
        status = "not_recorded" if not cov["from"] or hi < cov["from"] else ("gap" if cov["gaps"] else "ok")
        out_layers[layer] = {"status": status, **block}
    return {"from": lo, "to": hi, "floor_id": floor_id, "bucket_s": bucket_s, "native_rows": native, "coverage": cov, "layers": out_layers}


def _series(conn: sqlite3.Connection, ids: list[str], lo: str, hi: str, bucket_s: int | None) -> dict[str, dict[str, Any]]:
    marks = ",".join("?" * len(ids))
    out: dict[str, dict[str, Any]] = {eid: {"points": [], "bounded_after": False} for eid in ids}
    if bucket_s is None:
        for r in conn.execute(f"SELECT entity_id, state, changed_at FROM ha_state_history WHERE entity_id IN ({marks}) AND changed_at > ? AND changed_at <= ? ORDER BY entity_id, changed_at, id",
                              (*ids, lo, hi)).fetchall():
            pts = out[r["entity_id"]]["points"]
            if pts and pts[-1][1] == r["state"]:
                continue  # a re-confirmation of the same state is not a change
            pts.append([r["changed_at"], r["state"], 1])
    else:
        t0 = parse_utc(lo)
        # SQLite: a bare column next to MAX() comes from the row holding the maximum - the LAST state of each bucket, one indexed pass
        # whole seconds first (julianday is a float: 3600 s must not land at 3599.9999), then the integer bucket
        q = (f"SELECT entity_id, CAST(ROUND((julianday(changed_at) - julianday(?)) * 86400.0) AS INTEGER) / ? AS b, COUNT(*) AS n, MAX(changed_at) AS last_at, state "
             f"FROM ha_state_history WHERE entity_id IN ({marks}) AND changed_at > ? AND changed_at <= ? GROUP BY entity_id, b ORDER BY entity_id, b")
        for r in conn.execute(q, (lo.replace("Z", ""), bucket_s, *ids, lo, hi)).fetchall():
            start = iso_utc(t0 + dt.timedelta(seconds=int(r["b"]) * bucket_s))
            out[r["entity_id"]]["points"].append([start, r["state"], int(r["n"])])
    for r in conn.execute(f"SELECT DISTINCT entity_id FROM ha_state_history WHERE entity_id IN ({marks}) AND changed_at > ?", (*ids, hi)).fetchall():
        out[r["entity_id"]]["bounded_after"] = True
    return out


def _elevators_range(conn: sqlite3.Connection, lo: str, hi: str) -> dict[str, Any]:
    rows = _elevator_rows(conn)
    try:
        first = conn.execute("SELECT MIN(at) FROM infra_elevator_states").fetchone()[0]
    except sqlite3.OperationalError:
        return {"status": "empty", "retention_days": ELEVATOR_RETENTION_DAYS, "from": None, "position": "not_recorded", "items": {}}
    items: dict[str, Any] = {}
    for r in rows:
        before = conn.execute("SELECT at, state FROM infra_elevator_states WHERE elevator_id = ? AND at <= ? ORDER BY at DESC LIMIT 1", (r["id"], lo)).fetchone()
        pts = [[p["at"], None if p["state"] == "unknown" else p["state"], 1]
               for p in conn.execute("SELECT at, state FROM infra_elevator_states WHERE elevator_id = ? AND at > ? AND at <= ? ORDER BY at", (r["id"], lo, hi)).fetchall()]
        after = conn.execute("SELECT 1 FROM infra_elevator_states WHERE elevator_id = ? AND at > ? LIMIT 1", (r["id"], hi)).fetchone() is not None
        known0 = before is not None and before["state"] != "unknown"
        # the elevator's state is a derived state written on every change by a 15 s evaluator: it holds until the next row
        items[r["id"]] = {"name": r["name"], "initial": {"state": before["state"] if known0 else None, "known": known0}, "points": pts, "bounded_after": True if (after or pts or before) else False}
    status = "empty" if not rows else ("not_recorded" if not first or hi < first else "ok")
    return {"status": status, "retention_days": ELEVATOR_RETENTION_DAYS, "from": first, "position": "not_recorded", "items": items}
