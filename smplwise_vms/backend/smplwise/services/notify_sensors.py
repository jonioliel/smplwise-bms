"""Notification sources that come from Home Assistant entities (CR-018 section 5): leak / smoke / gas / CO sensors, doors and windows left
open, low batteries, devices that stay unavailable, the intrusion alarm's triggered state (and, off by default, its arm / disarm changes), and the
doorbell event entity.

Everything here is STATELESS: a condition is read from the mirrored entity row (`ha_entities`: state, device_class, last_changed), so a restart
loses no timer and a state seen in the start-up snapshot is handled like a pushed one. Two entry points feed it:

- `on_state(conn, old, new, ha_connected)` - from services/ha_sync.handle_state_event, inside its transaction and a savepoint, for the INSTANT
  sources (a leak, smoke, gas, CO, the alarm triggered, a battery that crossed its threshold, a doorbell ring) and for every condition that just
  ENDED, so a resolve is not delayed by a tick. It is decided from the pushed old / new state alone and touches the database only on a real
  transition: the great majority of pushes (a temperature, a light) cost nothing.
- `scan(conn, ha_connected, now)` - every monitor pass (services/notify_sources.tick): conditions that must HOLD for the policy's `after_s` (a door
  open ten minutes, a device unavailable fifteen) and anything a restart or a missed push left open. It reconciles the open rows with the
  mirror (notify_sources.reconcile): announce once, resolve when the condition ended.

A condition whose sensor is `unavailable` / `unknown` is neither announced nor resolved (a wet sensor that drops off the network stays wet);
while Home Assistant itself is disconnected the "unavailable" family is not judged at all (every entity looks unavailable then - that is the
system's own fault, `system.health`, never a hundred device notifications). Subjects are catalogued entities only; who receives each row is
services/notify_visibility's decision, not this module's.
"""
from __future__ import annotations

import datetime as dt
import json
import logging
import sqlite3
from dataclasses import dataclass
from typing import Any

from . import notify, notify_sources
from .devices import DOOR_COVER_CLASSES, OPENING_CLASSES
from .notify_policy import get_policy
from .timeutil import parse_utc

log = logging.getLogger("smplwise.notify")

SAFETY_CLASSES = {"moisture": "sensor.leak", "smoke": "sensor.smoke", "gas": "sensor.gas", "carbon_monoxide": "sensor.co"}
BATTERY_LOW, BATTERY_OK = 15.0, 25.0  # low below 15 %, recovered above 25 % (a gap, so one reading never flaps)
SOURCES = ("sensor.leak", "sensor.smoke", "sensor.gas", "sensor.co", "opening.left_open", "device.battery_low", "device.unavailable", "alarm.triggered")
UNAVAILABLE_DOMAINS = ("light", "switch", "cover", "climate", "fan", "lock", "media_player", "camera", "binary_sensor", "sensor", "vacuum", "valve", "siren", "humidifier", "water_heater")
ARM_STATES_HE = {"disarmed": "מנוטרלת", "armed_home": "דרוכה (בבית)", "armed_away": "דרוכה (מחוץ לבית)", "armed_night": "דרוכה (לילה)", "armed_vacation": "דרוכה (חופשה)",
                 "armed_custom_bypass": "דרוכה (עקיפה)", "arming": "בדריכה", "pending": "ממתינה", "triggered": "הופעלה"}
NOT_A_RING = frozenset({"motion", "person", "package", "vehicle", "animal", "pet"})  # a doorbell event entity may also report these
INDETERMINATE = frozenset({"unavailable", "unknown", "", None})
PLACED_ROW = ("removed_at IS NULL AND disabled = 0 AND hidden = 0 AND (entity_category IS NULL OR entity_category = '')")  # the catalogue (notify_visibility.catalogued)


@dataclass(frozen=True)
class Cond:
    source: str
    active: bool
    keep: bool = False  # neither announced nor resolved this time (an indeterminate state, the battery's hysteresis band)
    detail: str = ""    # the battery level, for the body


def conditions(domain: str, device_class: str | None, state: str | None) -> list[Cond]:
    """What an entity's domain, device class and state say right now - pure, no database."""
    cls = (device_class or "").lower()
    out: list[Cond] = []
    indeterminate = state in INDETERMINATE
    if domain == "binary_sensor":
        if cls in SAFETY_CLASSES:
            out.append(Cond(SAFETY_CLASSES[cls], state == "on", keep=indeterminate))
        if cls in OPENING_CLASSES:
            out.append(Cond("opening.left_open", state == "on", keep=indeterminate))
        if cls == "battery":
            out.append(Cond("device.battery_low", state == "on", keep=indeterminate, detail="נמוכה"))
    elif domain == "cover" and cls in DOOR_COVER_CLASSES:
        out.append(Cond("opening.left_open", state in ("open", "opening"), keep=indeterminate))
    elif domain == "sensor" and cls == "battery":
        try:
            level = float(state)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            out.append(Cond("device.battery_low", False, keep=True))
        else:
            low = level < BATTERY_LOW
            out.append(Cond("device.battery_low", low, keep=(not low and level <= BATTERY_OK), detail=f"{int(round(level))}%"))
    elif domain == "alarm_control_panel":
        out.append(Cond("alarm.triggered", state == "triggered", keep=indeterminate))
    if domain in UNAVAILABLE_DOMAINS:
        out.append(Cond("device.unavailable", state == "unavailable"))
    return out


def _name(row: sqlite3.Row) -> str:
    return str(row["name"] or row["original_name"] or row["entity_id"])


def _subject(source: str) -> str:
    return "alarm_panel" if source == "alarm.triggered" else "entity"


def _since(row: sqlite3.Row) -> dt.datetime | None:
    for k in ("last_changed", "state_seen_at"):
        try:
            if row[k]:
                return parse_utc(str(row[k]).replace(" ", "T"))
        except (ValueError, KeyError):
            continue
    return None


def signal_of(row: sqlite3.Row, c: Cond, hold_s: int = 0, *, resolve: bool = False) -> notify.Signal:
    params: dict[str, Any] = {"name": _name(row), "place": row["area_name"] or ""}
    if c.source == "opening.left_open":
        params["minutes"] = max(1, hold_s // 60)
    if c.detail:
        params["level"] = c.detail
    return notify.Signal(c.source, _subject(c.source), row["entity_id"], params=params, place=row["area_name"] or None, origin={"entity_id": row["entity_id"]}, resolve=resolve)


def _entity(conn: sqlite3.Connection, entity_id: str, alarm: bool = False) -> sqlite3.Row | None:
    where = "removed_at IS NULL" if alarm else PLACED_ROW
    return conn.execute(f"SELECT * FROM ha_entities WHERE entity_id = ? AND {where}", (entity_id,)).fetchone()


def _hold(conn: sqlite3.Connection, source: str, cache: dict[str, int]) -> int:
    if source not in cache:
        cache[source] = int((get_policy(conn, source) or {}).get("after_s") or 0)
    return cache[source]


# ---------------------------------------------------------------- the pushed state (instant sources, and every end)

def may_notify(old: dict[str, Any] | None, new: dict[str, Any]) -> bool:
    """Pure: would this push start or end any condition (or be a doorbell ring)? Lets the caller pick the transaction's durability and skip the rest."""
    try:
        return bool(_transitions(old, new)) or _is_ring(old, new) or _is_arm_change(old, new)
    except Exception:  # noqa: BLE001
        return False


def _split(st: dict[str, Any] | None) -> tuple[str, str | None, str | None]:
    eid = str((st or {}).get("entity_id") or "")
    attrs = (st or {}).get("attributes") or {}
    return eid.split(".", 1)[0], attrs.get("device_class") if isinstance(attrs, dict) else None, (st or {}).get("state")


def _transitions(old: dict[str, Any] | None, new: dict[str, Any]) -> list[tuple[Cond, Cond | None]]:
    domain, cls, state = _split(new)
    _od, ocls, ostate = _split(old)
    before = {c.source: c for c in conditions(domain, ocls or cls, ostate)} if old else {}
    out = []
    for c in conditions(domain, cls, state):
        prev = before.get(c.source)
        if (c.active and not c.keep) if prev is None else (prev.active != c.active or prev.keep != c.keep):  # a first state counts only when the condition holds
            out.append((c, prev))
    return out


def _is_ring(old: dict[str, Any] | None, new: dict[str, Any]) -> bool:
    eid = str(new.get("entity_id") or "")
    attrs = new.get("attributes") or {}
    if not eid.startswith("event.") or (attrs.get("device_class") if isinstance(attrs, dict) else None) != "doorbell":
        return False
    if new.get("state") in INDETERMINATE or old is None or old.get("state") == new.get("state"):
        return False  # a first state is a start-up, not a ring; an event entity's state is the time of its last event
    return str(attrs.get("event_type") or "").lower() not in NOT_A_RING


def _is_arm_change(old: dict[str, Any] | None, new: dict[str, Any]) -> bool:
    return str(new.get("entity_id") or "").startswith("alarm_control_panel.") and old is not None and old.get("state") != new.get("state") and new.get("state") in ARM_STATES_HE and new.get("state") != "triggered"


def on_state(conn: sqlite3.Connection, old: dict[str, Any] | None, new: dict[str, Any], ha_connected: bool = True, now: dt.datetime | None = None) -> None:
    """One state_changed push, inside the caller's transaction (the mirror row is already written). Never raises, and a failure rolls back only
    its own savepoint."""
    try:
        if not may_notify(old, new):
            return
        conn.execute("SAVEPOINT notify_state")
        try:
            _apply_push(conn, old, new, ha_connected)
            conn.execute("RELEASE notify_state")
        except Exception:
            conn.execute("ROLLBACK TO notify_state")
            conn.execute("RELEASE notify_state")
            raise
    except Exception:  # noqa: BLE001 - notification bookkeeping never breaks the state update
        log.exception("notification state hook failed for %s", (new or {}).get("entity_id"))


def _apply_push(conn: sqlite3.Connection, old: dict[str, Any] | None, new: dict[str, Any], ha_connected: bool) -> None:
    eid = str(new.get("entity_id") or "")
    domain = eid.split(".", 1)[0]
    if _is_ring(old, new):
        row = _entity(conn, eid)
        if row is not None:  # the doorbell's own entity, in the catalogue: the place only
            notify.emit_full(conn, notify.Signal("door.ring", "entity", eid, params={"name": _name(row), "place": row["area_name"] or ""}, place=row["area_name"] or None, origin={"entity_id": eid}))
        return
    holds: dict[str, int] = {}
    for c, prev in _transitions(old, new):
        if c.source == "device.unavailable" and not ha_connected:
            continue
        if c.keep:
            continue
        if c.active:
            if _hold(conn, c.source, holds) > 0:
                continue  # a timed condition: the monitor pass announces it once it has held
            row = _entity(conn, eid, alarm=domain == "alarm_control_panel")
            if row is not None and _unopened(conn, c.source, eid):
                notify.emit_full(conn, signal_of(row, c))
        else:
            notify.emit_full(conn, notify.Signal(c.source, _subject(c.source), eid, resolve=True))  # nothing open = a cheap no-op
    if _is_arm_change(old, new):
        row = _entity(conn, eid, alarm=True)
        if row is not None:  # off by default (the policy is disabled until the administrator turns it on): then emit says "disabled"
            notify.emit_full(conn, notify.Signal("alarm.state", "alarm_panel", eid, dedupe_key=f"alarm.state:alarm_panel:{eid}:{new['state']}", place=row["area_name"] or None,
                                                 params={"name": _name(row), "state": ARM_STATES_HE[new["state"]], "place": row["area_name"] or ""}, origin={"entity_id": eid}))


def _unopened(conn: sqlite3.Connection, source: str, eid: str) -> bool:
    key = f"{source}:{_subject(source)}:{eid}"
    return conn.execute("SELECT 1 FROM notifications WHERE dedupe_key = ? AND state != 'resolved'", (key,)).fetchone() is None


# ---------------------------------------------------------------- the monitor pass (timed conditions, catch-up, resolve)

def scan(conn: sqlite3.Connection, ha_connected: bool = True, now: dt.datetime | None = None) -> dict[str, dict[str, int]]:
    """Reconcile every entity family with the open notifications of its source. Bounded: one indexed read of the candidate rows (at most
    2000) and at most notify_sources.MAX_PER_PASS announcements per source per pass."""
    now = now or notify.now_utc()
    holds: dict[str, int] = {}
    due: dict[str, dict[str, notify.Signal]] = {s: {} for s in SOURCES}
    active: dict[str, set[str]] = {s: set() for s in SOURCES}
    classes = ",".join(f"'{c}'" for c in sorted(set(SAFETY_CLASSES) | OPENING_CLASSES | {"battery"}))
    covers = ",".join(f"'{c}'" for c in sorted(DOOR_COVER_CLASSES))
    domains = ",".join(f"'{d}'" for d in UNAVAILABLE_DOMAINS)
    rows = conn.execute(
        f"""SELECT * FROM ha_entities WHERE {PLACED_ROW}
              AND ((domain = 'binary_sensor' AND device_class IN ({classes}) AND state = 'on')
                OR (domain = 'cover' AND device_class IN ({covers}) AND state IN ('open', 'opening'))
                OR (domain = 'sensor' AND device_class = 'battery')
                OR (state = 'unavailable' AND domain IN ({domains})))
            ORDER BY entity_id LIMIT 2000"""
    ).fetchall()
    rows += conn.execute("SELECT * FROM ha_entities WHERE domain = 'alarm_control_panel' AND removed_at IS NULL ORDER BY entity_id LIMIT 50").fetchall()
    # an entity that is on / open but whose condition is "indeterminate" never lands here (state = 'on'); an open row of it is judged below
    for row in rows:
        for c in conditions(row["domain"], row["device_class"], row["state"]):
            if c.source == "device.unavailable" and not ha_connected:
                continue
            key = f"{c.source}:{_subject(c.source)}:{row['entity_id']}"
            if c.active or c.keep:
                active[c.source].add(key)
            if c.active and not c.keep:
                hold = _hold(conn, c.source, holds)
                since = _since(row)
                if hold <= 0 or since is None or (now - since).total_seconds() >= hold:
                    due[c.source][key] = signal_of(row, c, hold)
    # an open row whose entity is not a candidate any more (the condition ended; the entity vanished or left the catalogue) is resolved by reconcile
    # - except an entity that is indeterminate right now, which must keep its row, and the whole unavailable family while HA is down
    for source in SOURCES:
        if source == "device.unavailable" and not ha_connected:
            continue
        for r in conn.execute("SELECT dedupe_key, subject_id FROM notifications WHERE source = ? AND state != 'resolved'", (source,)).fetchall():
            if r["dedupe_key"] in active[source]:
                continue
            cur = conn.execute("SELECT domain, device_class, state FROM ha_entities WHERE entity_id = ? AND removed_at IS NULL", (r["subject_id"],)).fetchone()
            if cur is not None and cur["state"] in INDETERMINATE and source != "device.unavailable":
                active[source].add(r["dedupe_key"])  # the sensor dropped off the network: the condition is unknown, not over
    out: dict[str, dict[str, int]] = {}
    for source in SOURCES:
        if source == "device.unavailable" and not ha_connected:
            continue
        out[source] = notify_sources.reconcile(conn, source, due[source], active[source], now)
    return out
