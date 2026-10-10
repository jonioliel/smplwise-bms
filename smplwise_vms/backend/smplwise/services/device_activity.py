"""DEVHIST S1 (docs/changes/CR-032-DEVICE-ACTIVITY.md): the activity log of the electrical devices - who turned a device on or
off, who changed its temperature, brightness, position. Written by the HA sync path from the state_changed push that is already
received (no extra HA call, `record_change` runs inside handle_state_event's transaction), read by GET /devices/{id}/activity.

What is stored: only the electrical domains of the device cards (light, switch / input_boolean, climate / fan / humidifier,
cover - the same table services/devices.card_of uses for the controls) and, per domain, only the watched attributes (WATCHED);
a sensor is never stored; a current-temperature drift is not an event. Changes of one dimmer drag / one cover run are merged into
one row (coalescing); a chatty entity is rate-limited and the hole is recorded as a coverage gap, never silently lost.

Attribution (CR-032 3.2; the order matters):
1. `context.id` matches a `ha_actions.context_id` - a command made through Arx: the operator (exact), via `arx`. The bridge calls
   Home Assistant with the person's OWN user context (smplwise_bridge Context(user_id=...)), so even before the add-on has stored
   the context id of the answer the state change already carries the person's HA user id; `link_context` then marks the row `arx`.
2. `context.user_id` set: that Home Assistant user (exact), via `ha` (the HA app or UI).
3. The context (or its parent) is a recent automation / script / scene state change: that item is the source - exact when the
   state of the item itself carries the same context id. The item may be seen AFTER the device change, so `note_source` also
   back-fills the rows already stored.
4. A context without user or parent: "manual at the device" - estimated (`device`, confidence `inferred`); HA cannot tell a
   physical button from a vendor app or a cloud voice assistant, and never WHO. A parent without a known source: an automation
   of unknown name (inferred).
5. A change to or from `unavailable` / `unknown`: the system (availability), exact.
Nothing here guesses a person: an unknown stays unknown."""
from __future__ import annotations

import base64
import collections
import datetime as dt
import json
import logging
import re
import sqlite3
import threading
import time
from typing import Any

from ..db import Database, get_setting, now_iso, set_setting
from .timeutil import iso_utc, parse_utc

log = logging.getLogger("smplwise.device_activity")

RETENTION_DAYS = 90  # owner-recommended default; the setting device_activity.retention_days overrides it
MAX_ROWS = 500_000  # the whole table
MAX_ROWS_PER_ENTITY = 5_000
PRUNE_EVERY_S = 900.0

# the cards whose entities are "electrical devices" (services/devices.card_of): the server's `activity` flag on a card row
ACTIVITY_CARDS = ("lighting", "switches", "climate", "heating", "covers", "security")
# owner decision 2026-10-05: all twelve kinds of the first half-version, security devices included (behind a stricter permission)
ACTIVITY_DOMAINS = frozenset({"light", "switch", "input_boolean", "climate", "fan", "humidifier", "cover", "water_heater", "valve", "vacuum", "lock", "alarm_control_panel"})
VIRTUAL_DOMAINS = frozenset({"input_boolean"})
# a security device's activity needs a permission that OPERATES it, never just the one that shows it (the existing alarm / door family;
# nothing new, nobody who could not see the device gains it; any one of the list at the entity's placement): a lock - door.unlock (held only
# through a custom role) or ha.entity.control (operator and above), an alarm panel - alarm.arm (plus alarm.view)
SECURITY_PERMISSIONS = {"lock": ("door.unlock", "ha.entity.control"), "alarm_control_panel": ("alarm.arm",)}
ACTIVITY_KINDS = ("light", "switch", "outlet", "cover", "garage_door", "climate", "heater", "fan", "water_heater", "valve", "vacuum", "generic")
GARAGE_CLASSES = frozenset({"garage", "gate"})


# CARD1 (2026-10-07): a water heater or a tap wired through a plain switch (the common Israeli boiler relay, an irrigation relay) has no device
# class of its own in Home Assistant, so the SERVER names the equipment from the entity's display name - the one decision the client never
# makes (device-activity-press.ts). Conservative word lists, Hebrew and English; anything else stays a switch. The controls stay switch.*.
WATER_HEATER_NAME_RE = re.compile(r"דוד|בוילר|דוד\s*שמש|boiler|water[\s_-]?heater", re.IGNORECASE)
VALVE_NAME_RE = re.compile(r"ברז|שסתום|השקיה|ממטר|valve|irrigation|sprinkler", re.IGNORECASE)


# DEVTYPE (owner 2026-10-09): the types an administrator may fix per entity in Settings (services/device_types). Only the on/off domains
# whose type is a guess - a switch and a virtual on/off helper; every other domain's kind follows its own domain / class (a climate
# entity's heating-or-air-conditioning group has its own override, device_climate_kind). Presentation only: the controls stay the domain's.
TYPE_OVERRIDE_KINDS: dict[str, tuple[str, ...]] = {
    "switch": ("switch", "outlet", "light", "fan", "heater", "water_heater", "valve"),
    "input_boolean": ("switch", "light", "fan", "heater", "water_heater", "valve"),
}


def switch_equipment(name: str | None) -> str | None:
    """`water_heater` / `valve` for a switch whose name says so, else None."""
    if not name:
        return None
    if WATER_HEATER_NAME_RE.search(name):
        return "water_heater"
    if VALVE_NAME_RE.search(name):
        return "valve"
    return None


def activity_kind(domain: str, device_class: str | None = None, climate_kind: str | None = None, name: str | None = None, override: str | None = None) -> str | None:
    """The popup's device kind (twelve): None when the domain has no activity at all. `override` is an administrator's fixed type
    (DEVTYPE, table device_type_override); it wins over the device class and the name when the domain may carry it."""
    if domain not in ACTIVITY_DOMAINS:
        return None
    if override and override in TYPE_OVERRIDE_KINDS.get(domain, ()):
        return override
    if domain == "switch":
        if device_class == "outlet":
            return "outlet"
        return switch_equipment(name) or "switch"
    if domain == "input_boolean":
        return "switch"
    if domain == "cover":
        return "garage_door" if (device_class or "") in GARAGE_CLASSES else "cover"
    if domain == "climate":
        return "heater" if climate_kind == "heating" else "climate"
    if domain in ("light", "fan", "water_heater", "valve", "vacuum"):
        return domain
    return "generic"  # humidifier, lock, alarm panel

# the attributes whose change is an event, per domain (the value as stored: brightness_pct is brightness 0-255 as a percentage)
WATCHED: dict[str, tuple[str, ...]] = {
    "light": ("brightness_pct", "color_temp_kelvin", "rgb_color", "effect"),
    "climate": ("temperature", "target_temp_low", "target_temp_high", "fan_mode", "preset_mode", "swing_mode", "humidity"),
    "fan": ("percentage", "preset_mode", "oscillating", "direction"),
    "humidifier": ("humidity", "mode"),
    "cover": ("current_position", "current_tilt_position"),
    "water_heater": ("temperature", "away_mode"),
    "valve": ("current_position",),
    "vacuum": ("fan_speed",),
    "lock": (),
    "alarm_control_panel": (),
    "switch": (),
    "input_boolean": (),
}
COLOUR_MODES = frozenset({"rgb", "rgbw", "rgbww", "hs", "xy"})
UNAVAILABLE = ("unavailable", "unknown")
COVER_MOVING = ("opening", "closing", "locking", "unlocking")  # a cover, a valve or a lock on its way

ACTOR_TYPES = ("person", "automation", "script", "scene", "schedule", "device", "system", "unknown")
KINDS = ("power", "value", "availability")

# coalescing: the changes of one drag, one transition or one cover run are one row
VALUE_MERGE_SAME_CONTEXT_S = 30.0
VALUE_MERGE_SAME_ACTOR_S = 2.0
COVER_RUN_MERGE_S = 600.0
# the write-rate guard: a chatty entity (a flapping device) cannot flood the table
ENTITY_RATE = (30, 60.0)  # rows per window (seconds) per entity
GLOBAL_RATE = (2000, 60.0)
SOURCE_TTL_S = 600.0
SOURCE_MAX = 2000

_lock = threading.Lock()
_entity_marks: dict[str, collections.deque] = {}
_global_marks: collections.deque = collections.deque()
_sources: "collections.OrderedDict[str, tuple[str, str, str, float]]" = collections.OrderedDict()  # context id -> (type, entity id, name, monotonic)
_last_prune = 0.0
_started_set = False
STATS = {"stored": 0, "merged": 0, "rate_limited": 0}


def is_activity_domain(domain: str) -> bool:
    return domain in ACTIVITY_DOMAINS


def reset() -> None:
    """Test hook: forget the in-memory guards and the source map."""
    global _last_prune, _started_set
    with _lock:
        _started_set = False
        _entity_marks.clear()
        _global_marks.clear()
        _sources.clear()
        _last_prune = 0.0
        STATS.update(stored=0, merged=0, rate_limited=0)


# ---------------------------------------------------------------- what a state looks like

def _num(v: Any) -> float | int | None:
    if isinstance(v, bool) or v is None:
        return None
    if isinstance(v, (int, float)):
        return v
    try:
        return float(v) if isinstance(v, str) and v.strip() else None
    except ValueError:
        return None


def _stable(v: Any) -> Any:
    if isinstance(v, (list, tuple)):
        return [_stable(x) for x in v][:5]
    if isinstance(v, float):
        return round(v, 2)
    if isinstance(v, (str, int, bool)) or v is None:
        return v
    return None


def snapshot_of(state: dict[str, Any] | None, domain: str) -> dict[str, Any]:
    """{"state": ..., <watched attributes present>} of one HA state object."""
    state = state or {}
    attrs = state.get("attributes") or {}
    out: dict[str, Any] = {"state": state.get("state") if isinstance(state.get("state"), str) else (None if state.get("state") is None else str(state.get("state")))}
    for key in WATCHED.get(domain, ()):
        if key == "brightness_pct":
            b = _num(attrs.get("brightness"))
            value: Any = None if b is None else max(0, min(100, round(float(b) / 255.0 * 100)))
        elif key == "rgb_color":
            value = attrs.get("rgb_color") if attrs.get("color_mode") in COLOUR_MODES else None
        elif key == "temperature":
            value = _num(attrs.get("temperature"))
        elif key == "current_position" and domain == "valve":
            value = _num(attrs.get("current_position"))
        else:
            value = attrs.get(key)
        value = _stable(value)
        if value is not None:
            out[key] = value
    return out


def _context(state: dict[str, Any]) -> dict[str, Any]:
    c = state.get("context")
    return c if isinstance(c, dict) else {}


def _at(old: dict[str, Any], new: dict[str, Any], state_changed: bool) -> str:
    raw = new.get("last_changed") if state_changed else new.get("last_updated")
    for candidate in (raw, new.get("last_updated"), new.get("last_changed")):
        if candidate:
            try:
                return iso_utc(parse_utc(candidate))
            except (ValueError, TypeError):
                continue
    return now_iso()


def classify(domain: str, old: dict[str, Any], new: dict[str, Any]) -> tuple[str, list[str]] | None:
    """(kind, changed keys) of a change, or None when it is not an event (a drift of an unwatched attribute)."""
    os_, ns = old.get("state"), new.get("state")
    if os_ != ns:
        if os_ in UNAVAILABLE or ns in UNAVAILABLE:
            return "availability", ["state"]
        changed = ["state"] + [k for k in WATCHED.get(domain, ()) if old.get(k) != new.get(k)]
        if domain == "climate" and os_ != "off" and ns != "off":
            return "value", changed  # heat -> cool: the mode is a value of a device that stays on
        return "power", changed
    changed = [k for k in WATCHED.get(domain, ()) if old.get(k) != new.get(k)]
    return ("value", changed) if changed else None


# ---------------------------------------------------------------- attribution

def _user_name(conn: sqlite3.Connection, user_id: str) -> str | None:
    r = conn.execute("SELECT name, username FROM ha_users WHERE id = ?", (user_id,)).fetchone()
    return ((r["name"] or r["username"]) if r else None) or None


def _entity_name(conn: sqlite3.Connection, entity_id: str) -> str | None:
    r = conn.execute("SELECT name FROM ha_entities WHERE entity_id = ?", (entity_id,)).fetchone()
    return (r["name"] or None) if r else None


def _source_of(ctx_ids: list[str]) -> tuple[str, str, str] | None:
    now = time.monotonic()
    with _lock:
        for cid in ctx_ids:
            hit = _sources.get(cid)
            if hit and now - hit[3] <= SOURCE_TTL_S:
                return hit[0], hit[1], hit[2]
    return None


def attribute(conn: sqlite3.Connection, kind: str, ctx: dict[str, Any]) -> dict[str, Any]:
    cid, pid, uid = ctx.get("id") or None, ctx.get("parent_id") or None, ctx.get("user_id") or None
    base: dict[str, Any] = {"actor_type": "unknown", "actor_ref": None, "actor_name": None, "source_type": None, "source_ref": None, "source_name": None, "via": "unknown", "confidence": "unknown"}
    if kind == "availability":
        return {**base, "actor_type": "system", "via": "device", "confidence": "exact"}
    src = _source_of([c for c in (cid, pid) if c])
    if src:
        base.update(source_type=src[0], source_ref=src[1], source_name=src[2])
    if cid:
        a = conn.execute("SELECT principal_user_id, principal_username FROM ha_actions WHERE context_id = ? ORDER BY requested_at DESC LIMIT 1", (cid,)).fetchone()
        if a:
            return {**base, "actor_type": "person", "actor_ref": a["principal_user_id"], "actor_name": _user_name(conn, a["principal_user_id"]) or a["principal_username"], "via": "arx", "confidence": "exact"}
    if uid:
        return {**base, "actor_type": "person", "actor_ref": uid, "actor_name": _user_name(conn, uid), "via": "ha", "confidence": "exact"}
    if src:
        return {**base, "actor_type": src[0], "actor_ref": src[1], "actor_name": src[2], "via": "ha", "confidence": "exact"}
    if pid:
        return {**base, "actor_type": "automation", "via": "ha", "confidence": "inferred"}
    if cid:
        return {**base, "actor_type": "device", "via": "device", "confidence": "inferred"}
    return base


# ---------------------------------------------------------------- the write path

def _admit(entity_id: str) -> str | None:
    """None = admitted; else why it is not (the guard's own marks are taken here)."""
    now = time.monotonic()
    with _lock:
        while _global_marks and now - _global_marks[0] > GLOBAL_RATE[1]:
            _global_marks.popleft()
        marks = _entity_marks.setdefault(entity_id, collections.deque())
        while marks and now - marks[0] > ENTITY_RATE[1]:
            marks.popleft()
        if len(marks) >= ENTITY_RATE[0] or len(_global_marks) >= GLOBAL_RATE[0]:
            return "rate_limit"
        marks.append(now)
        _global_marks.append(now)
        if len(_entity_marks) > 5000:  # forget idle entities
            for k in [k for k, v in _entity_marks.items() if not v or now - v[-1] > ENTITY_RATE[1]][:2000]:
                _entity_marks.pop(k, None)
    return None


def _note_gap(conn: sqlite3.Connection, entity_id: str | None, at: str, reason: str) -> None:
    last = conn.execute("SELECT id, ended_at FROM device_activity_gaps WHERE entity_id IS ? AND reason = ? ORDER BY id DESC LIMIT 1", (entity_id, reason)).fetchone()
    if last and (parse_utc(at) - parse_utc(last["ended_at"])).total_seconds() <= 120:
        conn.execute("UPDATE device_activity_gaps SET ended_at = ? WHERE id = ?", (at, last["id"]))
    else:
        conn.execute("INSERT INTO device_activity_gaps(entity_id, started_at, ended_at, reason) VALUES (?,?,?,?)", (entity_id, at, at, reason))


def record_change(conn: sqlite3.Connection, old_state: dict[str, Any] | None, new_state: dict[str, Any] | None) -> int | None:
    """One state_changed push -> at most one row. Returns the row id (also of a merged row), None when nothing was stored.
    Never raises on a data problem: the caller's mirror update must not be lost to the activity log."""
    try:
        return _record(conn, old_state, new_state)
    except Exception:  # noqa: BLE001 - the log is secondary to the state mirror
        log.exception("device activity record failed for %s", (new_state or {}).get("entity_id"))
        return None


def _record(conn: sqlite3.Connection, old_state: dict[str, Any] | None, new_state: dict[str, Any] | None) -> int | None:
    if not new_state or not old_state:
        return None  # a first sight of an entity is a snapshot, not an activity
    eid = new_state.get("entity_id") or ""
    domain = eid.split(".", 1)[0]
    if domain not in ACTIVITY_DOMAINS:
        return None
    frm, to = snapshot_of(old_state, domain), snapshot_of(new_state, domain)
    verdict = classify(domain, frm, to)
    if verdict is None:
        return None
    kind, changed = verdict
    at = _at(old_state, new_state, "state" in changed)
    ctx = _context(new_state)
    cid, pid = ctx.get("id") or None, ctx.get("parent_id") or None

    # coalescing first: a merged change adds no row, so the rate guard does not count it
    prev = conn.execute("SELECT * FROM device_activity WHERE entity_id = ? ORDER BY at_utc DESC, id DESC LIMIT 1", (eid,)).fetchone()
    if prev is not None:
        gap_s = abs((parse_utc(at) - parse_utc(prev["at_utc"])).total_seconds())
        prev_to = json.loads(prev["to_json"])
        merge = False
        if kind == "value" and prev["kind"] == "value":
            same_ctx = cid is not None and cid == prev["context_id"]
            ctx_for_actor = attribute(conn, kind, ctx)
            same_actor = ctx_for_actor["actor_type"] == prev["actor_type"] and ctx_for_actor["actor_ref"] == prev["actor_ref"] and ctx_for_actor["actor_type"] not in ("unknown", "device", "system")
            merge = (same_ctx and gap_s <= VALUE_MERGE_SAME_CONTEXT_S) or (same_actor and gap_s <= VALUE_MERGE_SAME_ACTOR_S)
        elif domain in ("cover", "valve", "lock") and prev_to.get("state") in COVER_MOVING and frm.get("state") in COVER_MOVING and gap_s <= COVER_RUN_MERGE_S:
            merge = True  # opening -> open (or closing -> closed): one run, shown as its final state and position
        elif domain in ("cover", "valve") and prev["kind"] == "power" and prev_to.get("state") in COVER_MOVING and kind == "value" and gap_s <= COVER_RUN_MERGE_S:
            merge = True  # a position report while the run is still going
        if merge:
            conn.execute("UPDATE device_activity SET to_json = ?, context_id = COALESCE(?, context_id), parent_id = COALESCE(?, parent_id) WHERE id = ?",
                         (json.dumps(to, ensure_ascii=False), cid, pid, prev["id"]))
            with _lock:
                STATS["merged"] += 1
            return prev["id"]

    why = _admit(eid)
    if why:
        with _lock:
            STATS["rate_limited"] += 1
        _note_gap(conn, eid, at, why)
        return None
    who = attribute(conn, kind, ctx)
    cur = conn.execute(
        """INSERT INTO device_activity(entity_id, domain, at_utc, kind, actor_type, actor_ref, actor_name, source_type, source_ref, source_name, via, confidence, context_id, parent_id, from_json, to_json)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (eid, domain, at, kind, who["actor_type"], who["actor_ref"], who["actor_name"], who["source_type"], who["source_ref"], who["source_name"], who["via"], who["confidence"], cid, pid,
         json.dumps(frm, ensure_ascii=False), json.dumps(to, ensure_ascii=False)),
    )
    with _lock:
        STATS["stored"] += 1
    _ensure_started(conn)
    return cur.lastrowid


def _ensure_started(conn: sqlite3.Connection) -> None:
    """The start of the log ("tracked since": history starts from zero when the feature first runs), written once."""
    global _started_set
    if _started_set:
        return
    if not get_setting(conn, "device_activity.started_at"):
        set_setting(conn, "device_activity.started_at", now_iso())
    _started_set = True


def note_source(conn: sqlite3.Connection, state: dict[str, Any] | None) -> int:
    """An automation / script / scene state change was received: remember its context id as that item's, and attribute the
    device rows already stored under it (the item's own state can arrive after the devices it changed). Returns the rows updated."""
    if not state:
        return 0
    eid = state.get("entity_id") or ""
    stype = eid.split(".", 1)[0]
    if stype not in ("automation", "script", "scene"):
        return 0
    cid = _context(state).get("id")
    if not cid:
        return 0
    name = (state.get("attributes") or {}).get("friendly_name") if isinstance((state.get("attributes") or {}).get("friendly_name"), str) else None
    name = name or _entity_name(conn, eid) or eid
    with _lock:
        _sources[cid] = (stype, eid, name, time.monotonic())
        _sources.move_to_end(cid)
        while len(_sources) > SOURCE_MAX:
            _sources.popitem(last=False)
    n = conn.execute("UPDATE device_activity SET source_type = ?, source_ref = ?, source_name = ? WHERE (context_id = ? OR parent_id = ?) AND source_type IS NULL AND entity_id != ?", (stype, eid, name, cid, cid, eid)).rowcount
    if n:
        # a device change that had no person behind it is now known to be this item's
        conn.execute("UPDATE device_activity SET actor_type = ?, actor_ref = ?, actor_name = ?, via = 'ha', confidence = 'exact' WHERE (context_id = ? OR parent_id = ?) AND actor_type IN ('device', 'automation') AND source_ref = ?", (stype, eid, name, cid, cid, eid))
    return n


def link_context(conn: sqlite3.Connection, context_id: str | None, user_id: str, username: str | None) -> int:
    """The bridge answered a command made through Arx with the HA context id: the rows under it were done by this person, via Arx."""
    if not context_id:
        return 0
    name = _user_name(conn, user_id) or username
    return conn.execute("UPDATE device_activity SET actor_type = 'person', actor_ref = ?, actor_name = ?, via = 'arx', confidence = 'exact' WHERE context_id = ?", (user_id, name, context_id)).rowcount


def note_context(conn: sqlite3.Connection, action_id: str, result: Any, user_id: str, username: str | None) -> str | None:
    """Store the bridge's `context_id` on the ha_actions record and link the activity rows already written under it."""
    cid = result.get("context_id") if isinstance(result, dict) else None
    if not isinstance(cid, str) or not cid or len(cid) > 64:
        return None
    conn.execute("UPDATE ha_actions SET context_id = ? WHERE id = ?", (cid, action_id))
    link_context(conn, cid, user_id, username)
    return cid


def note_connect(db: Database, previous_seen: str | None) -> None:
    """HA sync (re)connected: when the log has not been fed since `previous_seen` (the last state the mirror recorded before this
    session), that stretch is a coverage gap; the start of the log is recorded once."""
    try:
        now = now_iso()
        with db.connection(durable=False) as conn:
            _ensure_started(conn)
            if previous_seen:
                try:
                    if (parse_utc(now) - parse_utc(previous_seen)).total_seconds() > 60:
                        conn.execute("INSERT INTO device_activity_gaps(entity_id, started_at, ended_at, reason) VALUES (NULL, ?, ?, 'disconnected')", (previous_seen, now))
                except (ValueError, TypeError):
                    pass
    except Exception:  # noqa: BLE001
        log.exception("device activity connect note failed")


# ---------------------------------------------------------------- retention

def retention_days(conn: sqlite3.Connection) -> int:
    try:
        return max(7, min(365, int(get_setting(conn, "device_activity.retention_days") or RETENTION_DAYS)))
    except (TypeError, ValueError):
        return RETENTION_DAYS


def prune(conn: sqlite3.Connection, days: int | None = None, *, max_rows: int = MAX_ROWS, per_entity: int = MAX_ROWS_PER_ENTITY) -> dict[str, int]:
    """Rows older than the retention, then the per-entity and whole-table size caps (oldest first)."""
    days = days if days is not None else retention_days(conn)
    cutoff = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")
    out = {"expired": conn.execute("DELETE FROM device_activity WHERE at_utc < ?", (cutoff,)).rowcount, "per_entity": 0, "over_cap": 0}
    conn.execute("DELETE FROM device_activity_gaps WHERE ended_at < ?", (cutoff,))
    for r in conn.execute("SELECT entity_id, COUNT(*) AS n FROM device_activity GROUP BY entity_id HAVING n > ?", (per_entity,)).fetchall():
        out["per_entity"] += conn.execute(
            "DELETE FROM device_activity WHERE entity_id = ? AND id IN (SELECT id FROM device_activity WHERE entity_id = ? ORDER BY at_utc ASC, id ASC LIMIT ?)",
            (r["entity_id"], r["entity_id"], r["n"] - per_entity)).rowcount
    total = conn.execute("SELECT COUNT(*) FROM device_activity").fetchone()[0]
    if total > max_rows:
        out["over_cap"] = conn.execute("DELETE FROM device_activity WHERE id IN (SELECT id FROM device_activity ORDER BY at_utc ASC, id ASC LIMIT ?)", (total - max_rows,)).rowcount
    return out


def prune_db(db: Database, *, force: bool = False) -> dict[str, int] | None:
    """The janitor's call (every 30 s): does the work at most every PRUNE_EVERY_S."""
    global _last_prune
    now = time.monotonic()
    if not force and now - _last_prune < PRUNE_EVERY_S:
        return None
    _last_prune = now
    with db.connection() as conn:
        return prune(conn)


# ---------------------------------------------------------------- the read model

def _cursor(at: str, row_id: int) -> str:
    return base64.urlsafe_b64encode(f"{at}|{row_id}".encode()).decode().rstrip("=")


def _decode_cursor(cursor: str) -> tuple[str, int] | None:
    try:
        raw = base64.urlsafe_b64decode(cursor + "=" * (-len(cursor) % 4)).decode()
        at, rid = raw.rsplit("|", 1)
        parse_utc(at)
        return at, int(rid)
    except (ValueError, TypeError, UnicodeDecodeError):
        return None


def _item(r: sqlite3.Row) -> dict[str, Any]:
    frm, to = json.loads(r["from_json"]), json.loads(r["to_json"])
    changed = [k for k in sorted(set(frm) | set(to)) if frm.get(k) != to.get(k)]
    actor: dict[str, Any] = {"type": r["actor_type"]}
    if r["actor_name"]:
        actor["name"] = r["actor_name"]
    source = {"type": r["source_type"], "id": r["source_ref"], "name": r["source_name"]} if r["source_type"] else None
    return {"id": r["id"], "at": r["at_utc"], "kind": r["kind"], "actor": actor, "source": source, "from": frm, "to": to, "changed": changed,
            "via": r["via"], "confidence": r["confidence"]}


def linked_power(conn: sqlite3.Connection, entity_id: str) -> dict[str, Any] | None:
    """An outlet's own power reading: a power sensor on the SAME device (registry device id) - never guessed from names or areas.
    None when there is none (the UI then shows no power at all)."""
    r = conn.execute("SELECT device_id, domain, device_class FROM ha_entities WHERE entity_id = ?", (entity_id,)).fetchone()
    if not r or r["domain"] != "switch" or r["device_class"] != "outlet" or not r["device_id"]:
        return None
    s = conn.execute("SELECT entity_id, state, unit FROM ha_entities WHERE device_id = ? AND domain = 'sensor' AND device_class = 'power' AND removed_at IS NULL AND disabled = 0 ORDER BY entity_id LIMIT 1", (r["device_id"],)).fetchone()
    if not s:
        return None
    return {"entity_id": s["entity_id"], "value": _num(s["state"]), "unit": s["unit"] or "W"}


def start_of_log(conn: sqlite3.Connection) -> str | None:
    started = get_setting(conn, "device_activity.started_at")
    first = conn.execute("SELECT MIN(at_utc) FROM device_activity").fetchone()[0]
    return min([x for x in (started, first) if x], default=None)


def list_activity(conn: sqlite3.Connection, entity_id: str, *, since: str | None, until: str | None, actor: str | None, kind: str | None, limit: int, cursor: str | None,
                  connected: bool | None = None) -> dict[str, Any]:
    """One entity's rows, newest first, with the coverage the caller needs to judge them. Raises ValueError on a bad cursor / period."""
    where, args = ["entity_id = ?"], [entity_id]
    if since:
        where.append("at_utc >= ?")
        args.append(iso_utc(parse_utc(since)))
    if until:
        where.append("at_utc < ?")
        args.append(iso_utc(parse_utc(until)))
    if actor:
        where.append("actor_type = ?")
        args.append(actor)
    if kind:
        where.append("kind = ?")
        args.append(kind)
    if cursor:
        c = _decode_cursor(cursor)
        if c is None:
            raise ValueError("cursor")
        where.append("(at_utc < ? OR (at_utc = ? AND id < ?))")
        args += [c[0], c[0], c[1]]
    rows = conn.execute(f"SELECT * FROM device_activity WHERE {' AND '.join(where)} ORDER BY at_utc DESC, id DESC LIMIT ?", (*args, limit + 1)).fetchall()
    page = rows[:limit]
    nxt = _cursor(page[-1]["at_utc"], page[-1]["id"]) if len(rows) > limit and page else None
    started = start_of_log(conn)
    gap_rows = conn.execute("SELECT started_at, ended_at, reason FROM device_activity_gaps WHERE (entity_id IS NULL OR entity_id = ?) AND ended_at >= ? ORDER BY started_at DESC LIMIT 50",
                            (entity_id, since and iso_utc(parse_utc(since)) or "")).fetchall()
    gaps = [{"from": g["started_at"], "to": g["ended_at"], "reason": g["reason"]} for g in gap_rows if not until or g["started_at"] < iso_utc(parse_utc(until))]
    window_from = iso_utc(parse_utc(since)) if since else None
    partial = bool(gaps) or bool(started and window_from and window_from < started)
    availability = "unavailable" if (started is None and connected is False) else ("partial" if partial else "ok")
    return {"tracked_since": started, "items": [_item(r) for r in page], "next_cursor": nxt, "retention_days": retention_days(conn), "coverage": {"from": started, "gaps": gaps}, "availability": availability}
