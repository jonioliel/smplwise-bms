"""Home Assistant catalogue + state sync (MASTER_SPEC ch. 14/15, T023/T024).

A background thread keeps one WebSocket session to HA Core: registries (entities, devices, areas,
floors) and a full state snapshot at connect, then `state_changed` subscription. Rows carry occurred
(HA `last_changed`/`last_updated`) and received (`state_seen_at`) times; while disconnected the API
reports `fresh: false` and nothing is invented. Attributes are trimmed to an allow-list.

Structure (CR-007 HA refresh): the session also subscribes to HA's `*_registry_updated` events (entity, device,
area, floor - all on HA's non-admin subscribe allow-list). Any of them schedules ONE debounced registry refresh
(REGISTRY_DEBOUNCE_S after the last event, never later than REGISTRY_MAX_WAIT_S after the first of a burst); when the
refresh changed the mirror, a `structure_changed` notice goes out on /ha/ws so open screens refetch. The periodic
refresh stays as a safety net, and `HaSync.refresh_now` lets a user force one. A refresh whose entity or device
listing fails writes nothing (a partial listing would move every device-area entity to "no area" and tombstone
entities); a failed area / floor listing keeps that mirror table and resolves names from it."""
from __future__ import annotations

import asyncio
import concurrent.futures
import json
import logging
import queue
import sqlite3
import threading
import time
from typing import Any

from ..config import Settings
from ..db import Database, now_iso, retry_locked
from ..errors import ApiError
from . import ha_client

log = logging.getLogger("smplwise.ha")

REGISTRY_REFRESH_S = 600  # safety net only: registry events trigger a refresh within seconds
REGISTRY_EVENTS = ("entity_registry_updated", "device_registry_updated", "area_registry_updated", "floor_registry_updated")
REGISTRY_DEBOUNCE_S = 1.5  # one refresh for a burst (an integration reload fires one event per entity)
REGISTRY_MAX_WAIT_S = 10.0  # ...but a burst that never pauses still refreshes this often
MANUAL_REFRESH_TIMEOUT_S = 30.0
MANUAL_COALESCE_S = 3.0  # a manual refresh right after another refresh returns that one's result (no second listing)
ATTR_ALLOW = {
    "friendly_name", "unit_of_measurement", "device_class", "state_class", "icon", "supported_features", "brightness", "color_mode",
    "current_position", "current_tilt_position", "temperature", "current_temperature", "target_temp_high", "target_temp_low", "hvac_modes",
    "hvac_action", "fan_mode", "preset_mode", "percentage", "battery_level", "battery", "occupancy", "motion", "contact", "door", "window",
    "locked", "code_format", "options", "min", "max", "step", "mode", "media_title", "volume_level", "is_volume_muted", "source", "last_triggered",
    "restored", "assumed_state", "editable", "power", "voltage", "current", "energy",
    # CR-023: a `state_class: total` energy counter restarts when `last_reset` changes (services/energy_counter.py)
    "last_reset",
    # CR-007 slice 2: what the devices-area controls offer (the modes an entity really has, its target range) and
    # the step an attribute confirmation must tolerate (a 3-speed fan lands on 33/67/100)
    "fan_modes", "min_temp", "max_temp", "target_temp_step", "percentage_step",
    # CR-007 slice 4: climate/covers in full - preset, swing, target humidity (climate and humidifier alike) and a
    # humidifier's own mode list
    "preset_modes", "swing_mode", "swing_modes", "humidity", "current_humidity", "min_humidity", "max_humidity", "available_modes",
    # CR-010 (the alarm section): what an alarm panel reports about itself (whether arming needs the code, who changed
    # it last, Alarmo's open / bypassed sensors and arm mode, the exit / entry delay) and what zone sensors report about
    # their zone (its number - the bypass pairing's last strategy - bypass, tamper, trouble, last trip). Never a code:
    # Home Assistant does not put one in any state attribute.
    "code_arm_required", "changed_by", "open_sensors", "bypassed_sensors", "arm_mode", "next_state", "delay",
    "zone_id", "zone", "zone_number", "zone_name", "bypassed", "bypass", "tamper", "device_tamper", "zone_tamper", "zone_trouble",
    "zone_open", "last_tripped_time", "battery_low",
    # owner 2026-09-30 (the home screen's weather widget): a weather entity's temperature unit (its temperature and
    # humidity are allowed above)
    "temperature_unit", "wind_speed", "wind_speed_unit", "forecast",
    # home redesign (owner 2026-09-30, decision 5): what else a weather entity can offer - the widget lists exactly the fields
    # the chosen entity reports (pressure, visibility, UV, precipitation, wind bearing / gust, feels-like) with their units
    "pressure", "pressure_unit", "visibility", "visibility_unit", "uv_index", "wind_bearing", "wind_gust_speed", "apparent_temperature",
    "dew_point", "cloud_coverage", "precipitation", "precipitation_unit",
    # CR-014 (schedules): a schedule switch's next trigger / current and next slot, and the sun's next rising / setting
    # (the preview of a schedule that starts at sunrise or sunset). The switch's `actions` / `timeslots` are not kept:
    # the definitions come from the scheduler component itself (services/schedules.py).
    "next_trigger", "current_slot", "next_slot", "next_rising", "next_setting",
    # CR-015 (multimedia, MEDIA_API.md 11): what a screen card and the remote draw - the TV's sources and apps, what is playing, the
    # sound output, Samsung Frame's art mode, an Android remote's activities - and, for 0.1.150, MA's grouping facts. Never
    # `ip_address`, never `entity_picture` / `entity_picture_local` (a tokenised HA proxy URL `/api/media_player_proxy/...?token=`: kept
    # server-side in memory for the artwork proxy only, services/media_store.note_picture - CR-015 review M2).
    "source_list", "app_id", "app_name", "media_content_type", "media_channel", "media_duration", "media_position", "media_position_updated_at",
    "sound_output", "sound_mode", "art_mode_status", "activity_list", "current_activity", "group_members", "mass_player_type", "active_queue",
    # CR-016 (players, speakers, groups): the artist / album of what plays, shuffle / repeat, a Sonos queue's position and size, a receiver's
    # sound modes (a list, protected like the source list). `media_content_id` (a URL), `entity_picture` and every media URL stay out.
    "media_artist", "media_album_name", "shuffle", "repeat", "queue_position", "queue_size", "sound_mode_list",
    # CR-017 (automations, scenes, scripts): an automation's / scene's config id (`id`), a script's / automation's running count (`current`) and
    # parallel-run limit (`max`); a scene's member list (`entity_id`, kept for the scene domain only - see trim_attributes). `last_triggered` and `mode` are above.
    "id", "current", "max",
    # schedules follow-up (2026-10-04, owner decision 3): a siren's own tones - the only tones a schedule may offer it (a list, or id -> name)
    "available_tones",
}
AUTOMATION_PREFIXES = ("automation.", "script.", "scene.")  # CR-017
AUTOMATION_EVENTS = ("automation_reloaded", "scene_reloaded", "automation_triggered", "script_started")
MEDIA_LIST_KEYS = {"source_list": 80, "activity_list": 200, "sound_mode_list": 80}  # attribute -> the longest item kept; 100 items at most (MAX_MEDIA_LIST)
HELPER_GROUP_MEMBERS_MAX = 120  # a `group` helper player's `entity_id` attribute (its member list): kept for media_player entities only
MAX_MEDIA_LIST = 100
STATE_DOMAINS_SKIP = {"update", "image", "conversation", "zone", "person", "device_tracker", "notify", "tts", "stt", "wake_word", "assist_satellite"}


class SyncState:
    def __init__(self) -> None:
        self.connected = False
        self.last_snapshot_at: str | None = None
        self.last_event_at: str | None = None
        self.last_registry_at: str | None = None
        self.last_error: str | None = None
        self.reconnects = 0
        self.sequence = 0
        self.entities = 0
        self.started_at: str | None = None
        self.ha_version: str | None = None
        self.last_registry_error: str | None = None  # the listing that failed on the last refresh (mirror kept)
        self.last_structure_at: str | None = None  # the last refresh that actually changed floors / areas / entities
        self.registry_events = 0  # registry-updated events seen since start

    def __setattr__(self, name: str, value: Any) -> None:
        # when the connection was lost (monotonic): the NVR-less health reports an HA outage past a grace period
        if name == "connected":
            prev = self.__dict__.get("connected")
            if value and not prev:
                self.__dict__["disconnected_since"] = None
            elif not value and prev is not False:
                self.__dict__["disconnected_since"] = time.monotonic()
        super().__setattr__(name, value)

    def down_for(self) -> float:
        since = self.__dict__.get("disconnected_since")
        return 0.0 if self.connected or since is None else time.monotonic() - since

    def as_dict(self) -> dict[str, Any]:
        return {k: getattr(self, k) for k in ("connected", "last_snapshot_at", "last_event_at", "last_registry_at", "last_error", "reconnects", "sequence", "entities", "started_at", "ha_version",
                                              "last_registry_error", "last_structure_at", "registry_events")}


STATE = SyncState()
_subscribers: list[queue.Queue] = []
_sub_lock = threading.Lock()


def subscribe() -> queue.Queue:
    q: queue.Queue = queue.Queue(maxsize=500)
    with _sub_lock:
        _subscribers.append(q)
    return q


def unsubscribe(q: queue.Queue) -> None:
    with _sub_lock:
        if q in _subscribers:
            _subscribers.remove(q)


def publish(msg: dict[str, Any]) -> None:
    with _sub_lock:
        subs = list(_subscribers)
    for q in subs:
        try:
            q.put_nowait(msg)
        except queue.Full:
            pass


FORECAST_KEEP = 14  # a weather entity's own `forecast` attribute: the first entries only (a week of days, or half a day of hours)
FORECAST_FIELDS = ("datetime", "condition", "temperature", "templow", "precipitation_probability", "precipitation")


def trim_forecast(raw: Any) -> list[dict[str, Any]]:
    """The compact form of a `forecast` attribute: the fields the home widget reads, the first FORECAST_KEEP entries. A
    48-hour hourly forecast used to blow the 4000-character attribute budget and cut the stored JSON in half."""
    if not isinstance(raw, list):
        return []
    return [{k: item[k] for k in FORECAST_FIELDS if k in item} for item in raw[:FORECAST_KEEP] if isinstance(item, dict)]


def _media_list(raw: Any, longest: int) -> list[str]:
    """A TV's own source / activity strings: text only, at most MAX_MEDIA_LIST of them, none longer than `longest` (an item is dropped,
    never cut - a cut string would no longer be the TV's own)."""
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    for item in raw:
        if isinstance(item, str) and 0 < len(item) <= longest and item not in out:
            out.append(item)
        if len(out) >= MAX_MEDIA_LIST:
            break
    return out


SECRET_ATTRS = ("entity_picture", "entity_picture_local")


def _tokenised(value: Any) -> bool:
    """A string that carries a tokenised Home Assistant URL (`...?token=...`): never stored, never sent to a browser."""
    return isinstance(value, str) and "token=" in value.lower()


def scrub_attributes(attrs: dict[str, Any]) -> dict[str, Any]:
    """The attributes without a picture URL or any value carrying an access token (rows stored before CR-015 review M2 may hold one)."""
    return {k: v for k, v in attrs.items() if k not in SECRET_ATTRS and not _tokenised(v)}


def trim_attributes(attrs: dict[str, Any], domain: str | None = None) -> str:
    kept = scrub_attributes({k: v for k, v in (attrs or {}).items() if k in ATTR_ALLOW})
    if "forecast" in kept:
        kept["forecast"] = trim_forecast(kept["forecast"])
    # CR-015: a TV's source / activity lists are far larger than the 4000-character budget of the other attributes and must reach
    # the model whole (they are bounded above instead): taken out first, put back after the budget rule ran on the rest
    media_lists = {k: _media_list(kept.pop(k), n) for k, n in MEDIA_LIST_KEYS.items() if k in kept}
    if domain in ("media_player", "scene") and isinstance((attrs or {}).get("entity_id"), list):  # CR-017: a scene's members (a native scene lists what it sets)
        media_lists["entity_id"] = _media_list(attrs["entity_id"], HELPER_GROUP_MEMBERS_MAX)  # CR-016: the members of a helper group (a shortcut, never joinable)
    text = json.dumps(kept, ensure_ascii=False, default=str)
    if len(text) > 4000:
        kept = {k: kept[k] for k in list(kept)[:10]}
        text = json.dumps(kept, ensure_ascii=False, default=str)[:4000]
    if media_lists:
        try:
            merged = json.loads(text)
        except ValueError:
            merged = {}
        merged.update(media_lists)
        text = json.dumps(merged, ensure_ascii=False, default=str)
    return text


def feature_bits(value: Any) -> int:
    """HA's `supported_features` is an int bit-mask, but an integration may put anything there (one installation's switches
    carry a list of feature names). A number is kept; anything else carries no bits: 0, never an exception - one odd
    attribute must not cost the whole snapshot (the owner's 2026-09-30 report: 130 switches "not available")."""
    if isinstance(value, bool):
        return 0
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, str):
        try:
            return int(value.strip())
        except ValueError:
            return 0
    return 0


def scalar_text(value: Any) -> str | None:
    """A catalogue text column (name, device class, unit, icon) out of an attribute: text as is, other scalars as text,
    a list / dict (which SQLite cannot bind) as None."""
    if value is None or isinstance(value, (list, dict, tuple, set)):
        return None
    return value if isinstance(value, str) else str(value)


def upsert_state(conn: sqlite3.Connection, st: dict[str, Any], seen: str | None = None) -> dict[str, Any]:
    """Insert or update one HA state object. Returns the stored row as a dict."""
    seen = seen or now_iso()
    eid = st["entity_id"]
    domain = eid.split(".", 1)[0]
    attrs = st.get("attributes") or {}
    state = st.get("state")
    if state is not None and not isinstance(state, str):
        state = str(state)
    available = 0 if state in ("unavailable", None) else 1
    if domain == "media_player":
        from . import media_store  # CR-015: the picture URL stays in memory for the artwork proxy, never in the attributes

        media_store.note_picture(eid, attrs)
        media_store.note_features(conn, eid, state, feature_bits(attrs.get("supported_features")))  # CR-016 5.4: the last good mask of an endpoint that was available
    row = conn.execute("SELECT entity_id FROM ha_entities WHERE entity_id = ?", (eid,)).fetchone()
    common = (
        scalar_text(attrs.get("friendly_name")) or "",
        domain,
        scalar_text(attrs.get("device_class")),
        scalar_text(attrs.get("unit_of_measurement")),
        scalar_text(attrs.get("icon")),
        feature_bits(attrs.get("supported_features")),
        state,
        trim_attributes(attrs, domain),
        st.get("last_changed"),
        st.get("last_updated"),
        seen,
        available,
        seen,
    )
    if row:
        conn.execute(
            """UPDATE ha_entities SET name = CASE WHEN name = '' THEN ? ELSE name END, domain = ?, device_class = COALESCE(?, device_class), unit = COALESCE(?, unit), icon = COALESCE(?, icon),
               supported_features = ?, state = ?, attributes_json = ?, last_changed = ?, last_updated = ?, state_seen_at = ?, available = ?, removed_at = NULL, updated_at = ? WHERE entity_id = ?""",
            (*common, eid),
        )
    else:
        conn.execute(
            """INSERT INTO ha_entities(entity_id, name, domain, device_class, unit, icon, supported_features, state, attributes_json, last_changed, last_updated, state_seen_at, available, updated_at, first_seen_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (eid, *common, seen),
        )
    from . import ha_history  # local import: the history depends on db only

    # T041: every state the VMS learns of is history from now on. Durability: a pure state update commits on a
    # synchronous=NORMAL connection (db.py, durability classes), so these ha_state_history rows - which HA does NOT send
    # again - can lose roughly the last 30 s (until the next WAL fsync / checkpoint) on a power cut; an add-on crash
    # or restart loses nothing. The current state itself is corrected by the next push / snapshot.
    ha_history.record(conn, st)
    return entity_row(conn.execute("SELECT * FROM ha_entities WHERE entity_id = ?", (eid,)).fetchone())


def apply_registry(conn: sqlite3.Connection, maps: dict[str, dict[str, Any]]) -> int:
    n = 0
    now = now_iso()
    for eid, m in maps.items():
        row = conn.execute("SELECT entity_id, name FROM ha_entities WHERE entity_id = ?", (eid,)).fetchone()
        if row:
            conn.execute(
                """UPDATE ha_entities SET registry_id = ?, unique_id = ?, platform = ?, device_id = ?, area_id = ?, area_name = ?, ha_floor_id = ?, ha_floor_name = ?,
                   name = CASE WHEN ? != '' THEN ? ELSE name END, original_name = ?, icon = COALESCE(icon, ?), entity_category = ?, disabled = ?, hidden = ?, updated_at = ? WHERE entity_id = ?""",
                (m["registry_id"], m["unique_id"], m["platform"], m["device_id"], m["area_id"], m["area_name"], m["ha_floor_id"], m["ha_floor_name"], m["name"], m["name"], m["original_name"], m["icon"], m["entity_category"], m["disabled"], m["hidden"], now, eid),
            )
        else:
            domain = eid.split(".", 1)[0]
            conn.execute(
                """INSERT INTO ha_entities(entity_id, registry_id, unique_id, platform, device_id, area_id, area_name, ha_floor_id, ha_floor_name, name, original_name, domain, icon, entity_category, disabled, hidden, available, first_seen_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)""",
                (eid, m["registry_id"], m["unique_id"], m["platform"], m["device_id"], m["area_id"], m["area_name"], m["ha_floor_id"], m["ha_floor_name"], m["name"], m["original_name"], domain, m["icon"], m["entity_category"], m["disabled"], m["hidden"], now, now),
            )
        # CR-010: the config entry (a separate statement so a database before migration 0036 - the upgrade tests -
        # still takes the registry above)
        try:
            conn.execute("UPDATE ha_entities SET config_entry_id = ? WHERE entity_id = ?", (m.get("config_entry_id"), eid))
        except sqlite3.OperationalError as exc:
            if "config_entry_id" not in str(exc):
                raise
        n += 1
    return n


def apply_structure(conn: sqlite3.Connection, areas: list[dict[str, Any]] | None, floors: list[dict[str, Any]] | None) -> None:
    """Mirror HA's area and floor registries (CR-007): a table is rewritten whole, in the listing's order, so a
    renamed / moved / deleted area never lingers. `None` for a listing means "that call did not succeed": its table
    is left exactly as it was rather than emptied (review finding: one failed floor_registry call must not wipe the
    tree until the next refresh). Only the fields the devices tree shows are kept."""
    now = now_iso()
    if floors is not None:
        conn.execute("DELETE FROM ha_floors")
        for i, f in enumerate(floors):
            if not f.get("floor_id"):
                continue
            level = f.get("level")
            conn.execute(
                "INSERT OR REPLACE INTO ha_floors(floor_id, name, level, icon, position, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                (f["floor_id"], f.get("name") or f["floor_id"], int(level) if isinstance(level, (int, float)) and not isinstance(level, bool) else None, f.get("icon"), i, now),
            )
    if areas is not None:
        conn.execute("DELETE FROM ha_areas")
        for i, a in enumerate(areas):
            if not a.get("area_id"):
                continue
            conn.execute(
                "INSERT OR REPLACE INTO ha_areas(area_id, name, floor_id, icon, position, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                (a["area_id"], a.get("name") or a["area_id"], a.get("floor_id"), a.get("icon"), i, now),
            )


def _listing(reply: dict[str, Any] | None) -> list[dict[str, Any]] | None:
    """A registry listing out of a WebSocket reply: the list on success, None when HA refused or answered oddly."""
    if not isinstance(reply, dict) or not reply.get("success", True):
        return None
    result = reply.get("result")
    return result if isinstance(result, list) else None


def mirror_fingerprint(conn: sqlite3.Connection) -> str:
    """What the structure screens read from the mirror (live entities with their area / floor / name / visibility,
    the area and floor tables): equal before and after a refresh means nothing a screen shows moved."""
    import hashlib

    h = hashlib.sha1()
    for sql in (
        "SELECT entity_id, area_id, area_name, ha_floor_id, ha_floor_name, name, device_id, disabled, hidden, entity_category FROM ha_entities WHERE removed_at IS NULL ORDER BY entity_id",
        "SELECT area_id, name, floor_id, icon, position FROM ha_areas ORDER BY area_id",
        "SELECT floor_id, name, level, icon, position FROM ha_floors ORDER BY floor_id",
    ):
        for r in conn.execute(sql):
            h.update(json.dumps(list(r), ensure_ascii=False, default=str).encode("utf-8"))
        h.update(b"|")
    return h.hexdigest()


def state_removed(conn: sqlite3.Connection, entity_id: str) -> bool:
    """HA removed the entity's state (`state_changed` with no new state: the entity was deleted, or its integration is
    reloading / unloaded). An entity HA's registry knows is only marked unavailable - the registry refresh this
    schedules decides whether it is gone (an integration reload keeps it, and must not cost it its switch protection). An
    entity without a registry entry has nothing else to tell us, so it is tombstoned now (placement kept; a later
    state brings it back - upsert_state clears removed_at) instead of lingering in the tree. True when a row changed."""
    row = conn.execute("SELECT registry_id FROM ha_entities WHERE entity_id = ? AND removed_at IS NULL", (entity_id,)).fetchone()
    if not row:
        return False
    now = now_iso()
    if row["registry_id"]:
        conn.execute("UPDATE ha_entities SET available = 0, updated_at = ? WHERE entity_id = ?", (now, entity_id))
    else:
        conn.execute("UPDATE ha_entities SET removed_at = ?, available = 0, updated_at = ? WHERE entity_id = ?", (now, now, entity_id))
    return True


class Debouncer:
    """Trailing debounce with a ceiling, on one asyncio loop: `poke(reason)` (re)arms the timer for `delay` seconds,
    but never past `max_wait` after the first poke of the burst; `fire(reasons)` then runs once with every reason seen."""

    def __init__(self, loop: asyncio.AbstractEventLoop, fire, delay: float, max_wait: float) -> None:
        self.loop, self.fire, self.delay, self.max_wait = loop, fire, delay, max_wait
        self.handle: asyncio.TimerHandle | None = None
        self.first: float | None = None
        self.reasons: set[str] = set()

    def poke(self, reason: str) -> None:
        now = self.loop.time()
        if self.first is None:
            self.first = now
        self.reasons.add(reason)
        if self.handle is not None:
            self.handle.cancel()
        wait = max(0.0, min(self.delay, self.first + self.max_wait - now))
        self.handle = self.loop.call_later(wait, self._run)

    def _run(self) -> None:
        reasons, self.reasons, self.first, self.handle = self.reasons, set(), None, None
        self.fire(reasons)

    def cancel(self) -> None:
        if self.handle is not None:
            self.handle.cancel()
        self.handle, self.first, self.reasons = None, None, set()


def tombstone_missing(conn: sqlite3.Connection, present: set[str]) -> int:
    """Entities that vanished from both the state snapshot and the registry are tombstoned (placement kept)."""
    now = now_iso()
    rows = conn.execute("SELECT entity_id FROM ha_entities WHERE removed_at IS NULL").fetchall()
    n = 0
    for r in rows:
        if r["entity_id"] not in present:
            conn.execute("UPDATE ha_entities SET removed_at = ?, available = 0, updated_at = ? WHERE entity_id = ?", (now, now, r["entity_id"]))
            n += 1
    return n


def entity_row(r: sqlite3.Row) -> dict[str, Any]:
    d = dict(r)
    try:
        d["attributes"] = json.loads(d.pop("attributes_json") or "{}")
    except ValueError:
        d["attributes"] = {}
    if isinstance(d["attributes"], dict):
        d["attributes"] = scrub_attributes(d["attributes"])  # a row stored before CR-015 review M2 may still hold a tokenised picture URL
    d["disabled"] = bool(d["disabled"])
    d["hidden"] = bool(d["hidden"])
    d["available"] = bool(d["available"])
    d["fresh"] = STATE.connected and d.get("state_seen_at") is not None
    return d


CHUNK = 150  # rows per transaction: keeps the SQLite write lock short while other workers run


def _chunks(items: list[Any], n: int = CHUNK):
    for i in range(0, len(items), n):
        yield items[i : i + n]


def _busy_retry(fn, attempts: int = 3, wait_s: float = 2.0):
    """Run a write phase; a busy database (another worker holding the lock past busy_timeout) is retried, not fatal."""
    return retry_locked(fn, what="HA sync", attempts=attempts, base_s=wait_s / 2)


def handle_state_event(db: Database, data: dict[str, Any], attempts: int = 1) -> dict[str, Any]:
    """One state_changed push: the mirror row, the correlation event (T053: door / motion / lock transitions) and the
    rule alerts in one short transaction. Rule notifications to HA are sent after the commit - under the write lock a
    slow HA answer stalled every other writer (round-10 lock storm).
    One attempt by default (bounded by BUSY_TIMEOUT_S): this runs inside the HA WebSocket client's event loop, and
    retries of ~30 s would miss the socket's ping deadline and cost a disconnect plus a full resync. A state lost to a
    busy database is corrected by the next push of that entity or the next snapshot."""
    from . import rules as rules_svc
    from .correlation import may_record, record_transition

    new = data["new_state"]
    fired: list[dict[str, Any]] = []
    # a pure mirror update commits without fsync; one that may record a correlation event (and rule alerts) - rows HA
    # never sends again - is fsynced (db.py, durability classes)
    from . import notify_sensors  # CR-018: leak / smoke / gas / CO, the alarm, a doorbell ring - and every condition that just ended

    durable = may_record(data.get("old_state"), new) or notify_sensors.may_notify(data.get("old_state"), new)  # a notification row is a fact HA never sends again

    def _write() -> dict[str, Any]:
        fired.clear()
        with db.connection(durable=durable) as conn:
            row = upsert_state(conn, new)
            if str(new.get("entity_id") or "").startswith(AUTOMATION_PREFIXES):
                from . import automations as automations_svc  # CR-017: an automation / script / scene state feeds the item cache, the runs and the clients

                try:
                    automations_svc.MIRROR.on_entity_state(conn, row, data.get("old_state"))
                except Exception:  # noqa: BLE001 - never lose the state update itself
                    log.exception("automation state hook failed for %s", new.get("entity_id"))
            if str(new.get("entity_id") or "").startswith("switch.schedule_"):
                from . import schedules as schedules_svc  # CR-014: a schedule switch's state feeds the mirror and the derived runs

                try:
                    schedules_svc.MIRROR.on_entity_state(conn, row, data.get("old_state"))
                except Exception:  # noqa: BLE001 - never lose the state update itself
                    log.exception("schedule state hook failed for %s", new.get("entity_id"))
            notify_sensors.on_state(conn, data.get("old_state"), new, STATE.connected)  # inside this transaction, in its own savepoint; never raises
            transition = record_transition(conn, data.get("old_state"), new)
            if transition:
                try:
                    fired.extend(rules_svc.evaluate_event(conn, transition, deliver=False))
                except Exception:  # noqa: BLE001
                    log.exception("rule evaluation failed for %s", transition.get("id"))
            return row

    row = retry_locked(_write, what="HA state update", attempts=attempts, base_s=0.25)
    rules_svc.deliver_pending(fired)
    if str(new.get("entity_id") or "").startswith(AUTOMATION_PREFIXES):
        from . import automations as automations_svc

        automations_svc.MIRROR.flush()  # CR-017: after the commit - deferred pulls (a no-op while the debounce timer runs them)
    if str(new.get("entity_id") or "").startswith("switch.schedule_"):
        from . import schedules as schedules_svc

        schedules_svc.MIRROR.flush()  # CR-014: after the commit - deferred item fetches (a no-op while the debounce timer runs them)
    return row


def count_entities(conn: sqlite3.Connection) -> int:
    return conn.execute("SELECT COUNT(*) FROM ha_entities WHERE removed_at IS NULL AND disabled = 0").fetchone()[0]


DATA_ERRORS = (TypeError, ValueError, sqlite3.InterfaceError, sqlite3.DataError)  # a state's own shape, never a busy database


def store_states(db: Database, states: list[dict[str, Any]], seen: str) -> set[str]:
    """Write a full state snapshot in chunks. One state that cannot be stored (a shape the catalogue does not know) is
    skipped and logged, never the chunk or the snapshot with it: a failed snapshot kept the session from ever
    connecting ("not synced") and left every entity the registry had created marked unavailable."""
    present: set[str] = set()
    rows = [st for st in states if st["entity_id"].split(".", 1)[0] not in STATE_DOMAINS_SKIP]
    for chunk in _chunks(rows):
        def _write(chunk=chunk) -> None:
            with db.connection(durable=False) as conn:
                for st in chunk:
                    conn.execute("SAVEPOINT state_row")
                    try:
                        upsert_state(conn, st, seen)
                    except DATA_ERRORS as exc:
                        conn.execute("ROLLBACK TO state_row")
                        log.warning("state of %s not stored: %s", st.get("entity_id"), type(exc).__name__)
                    finally:
                        conn.execute("RELEASE state_row")
        _busy_retry(_write)
        present.update(st["entity_id"] for st in chunk)
    with db.connection(mode="read") as conn:
        STATE.entities = count_entities(conn)
    return present


def snapshot(db: Database, settings: Settings) -> int:
    """REST snapshot (also usable without the WebSocket, e.g. in tests)."""
    states = ha_client.get_states(settings)
    seen = now_iso()
    store_states(db, states, seen)
    STATE.last_snapshot_at = seen
    return len(states)


async def subscribe_registry_events(call) -> int:
    """Subscribe the session to HA's registry-updated events; returns how many HA accepted. A refusal is logged, never
    fatal: the state feed matters more, and the periodic refresh still catches structure changes."""
    ok = 0
    for et in REGISTRY_EVENTS:
        try:
            reply = await call("subscribe_events", event_type=et)
        except Exception as exc:  # noqa: BLE001
            log.warning("subscribing to %s failed: %s", et, type(exc).__name__)
            continue
        if reply.get("success"):
            ok += 1
        else:
            log.warning("HA refused the %s subscription (%s); structure changes wait for the periodic refresh", et, (reply.get("error") or {}).get("code"))
    return ok


class HaSync:
    def __init__(self) -> None:
        self.thread: threading.Thread | None = None
        self.stop = threading.Event()
        self.db: Database | None = None
        self.settings: Settings | None = None
        # the live session's loop and `call` (None between sessions) and its one-refresh-at-a-time lock
        self._session_loop: asyncio.AbstractEventLoop | None = None
        self._session_call: Any = None
        self._refresh_lock: asyncio.Lock | None = None
        # every mirror write (the sync's refresh, the dev registry seed) holds this thread lock for its whole duration
        self.mirror_lock = threading.Lock()
        # (monotonic time, changed) of the last refresh that completed, for MANUAL_COALESCE_S
        self._last_done: tuple[float, bool] | None = None
        # CR-014: the id of this session's `scheduler_updated` subscription (its event frames carry it), None = not subscribed
        self._sched_sub_id: int | None = None

    def start(self, db: Database, settings: Settings) -> None:
        self.db, self.settings = db, settings
        if not ha_client.configured(settings):
            STATE.last_error = "ha_not_configured"
            return
        STATE.started_at = now_iso()
        self.stop.clear()
        self.thread = threading.Thread(target=self._run, name="ha-sync", daemon=True)
        self.thread.start()

    def shutdown(self) -> None:
        self.stop.set()

    def _run(self) -> None:
        asyncio.run(self._loop())

    async def _loop(self) -> None:
        assert self.db and self.settings
        backoff = 5.0
        stop_evt = asyncio.Event()

        async def watch_stop() -> None:
            while not self.stop.is_set():
                await asyncio.sleep(1)
            stop_evt.set()

        asyncio.create_task(watch_stop())
        while not self.stop.is_set():
            try:
                await self._session(stop_evt)
                backoff = 5.0
            except Exception as exc:
                if self.stop.is_set():
                    break
                STATE.last_error = type(exc).__name__ if not isinstance(exc, ApiError) else exc.code
                log.warning("HA sync disconnected: %s (retry in %.0fs)", STATE.last_error, backoff)
            if STATE.connected:
                STATE.reconnects += 1
            STATE.connected = False
            publish({"type": "ha_sync_state", "connected": False})
            try:
                await asyncio.wait_for(stop_evt.wait(), timeout=backoff)
            except asyncio.TimeoutError:
                pass
            backoff = min(60.0, backoff * 2)
        STATE.connected = False

    async def _session(self, stop_evt: asyncio.Event) -> None:
        assert self.db and self.settings
        db, settings = self.db, self.settings
        loop = asyncio.get_event_loop()

        debouncer: Debouncer | None = None
        tasks: set[asyncio.Task[Any]] = set()

        def on_event(data: dict[str, Any]) -> None:
            new = data.get("new_state")
            eid = data.get("entity_id", "")
            if eid.split(".", 1)[0] in STATE_DOMAINS_SKIP:
                return
            if not new:
                # a registry_updated frame carries entity_id too, but never the old_state / new_state keys
                if "new_state" in data and data.get("old_state") is not None:
                    try:
                        with db.connection(durable=False) as conn:
                            removed = state_removed(conn, eid)
                    except Exception:
                        log.exception("state removal failed for %s", eid)
                        return
                    if removed and debouncer is not None:
                        debouncer.poke("state_removed")
                return
            try:
                row = handle_state_event(db, data)
            except Exception:
                log.exception("state update failed for %s", eid)
                return
            STATE.sequence += 1
            STATE.last_event_at = now_iso()
            publish({"type": "entity_state_changed", "sequence": STATE.sequence, "entity": row})
            if eid.startswith(("media_player.", "remote.")):
                from . import media_store  # CR-015: a screen's own `media_state` frame (throttled, scoped by media.read in /ha/ws)

                media_store.on_state_event(db, eid)

        def on_message(msg: dict[str, Any]) -> None:
            if self._sched_sub_id is not None and msg.get("id") == self._sched_sub_id:
                from . import schedules as schedules_svc  # CR-014: a frame of the scheduler component's own subscription

                try:
                    schedules_svc.MIRROR.on_component_event(msg)
                except Exception:  # noqa: BLE001
                    log.exception("scheduler event hook failed")
                return
            event = msg.get("event")
            if isinstance(event, dict) and event.get("event_type") in AUTOMATION_EVENTS:
                from . import automations as automations_svc  # CR-017: reloads, automation runs, script starts

                try:
                    automations_svc.MIRROR.on_ha_event(msg)
                except Exception:  # noqa: BLE001
                    log.exception("automations event hook failed")
                return
            if not isinstance(event, dict) or event.get("event_type") not in REGISTRY_EVENTS:
                return
            STATE.registry_events += 1
            if debouncer is not None:
                debouncer.poke(event["event_type"])

        refresher_task: asyncio.Task[None] | None = None

        async def on_ready(call) -> None:
            nonlocal refresher_task, debouncer
            cfg = await call("get_config")
            STATE.ha_version = (cfg.get("result") or {}).get("version")

            def fire(reasons: set[str]) -> None:
                task = asyncio.create_task(self._refresh_and_notify(call, ",".join(sorted(reasons)), force_notice="state_removed" in reasons))
                tasks.add(task)
                task.add_done_callback(tasks.discard)

            debouncer = Debouncer(loop, fire, REGISTRY_DEBOUNCE_S, REGISTRY_MAX_WAIT_S)
            self._refresh_lock = asyncio.Lock()
            # subscribed BEFORE the first listing, so a change made while it runs is not lost between the two
            await subscribe_registry_events(call)
            await self._refresh_and_notify(call, "connect", notify=False)
            states = await call("get_states")
            seen = now_iso()
            await loop.run_in_executor(None, store_states, db, states.get("result") or [], seen)
            STATE.last_snapshot_at = seen
            sub = await call("subscribe_events", event_type="state_changed")
            if not sub.get("success"):
                raise RuntimeError("subscribe_events refused")
            STATE.connected = True
            STATE.last_error = None
            log.info("HA sync connected: %d entities, HA %s", STATE.entities, STATE.ha_version)
            publish({"type": "ha_sync_state", "connected": True})
            self._session_loop, self._session_call = loop, call  # refresh_now (the manual button) runs on this session from here on
            self._sched_sub_id = None
            task = asyncio.create_task(self._schedules_start(call, "connect"))  # CR-014: subscribe + full pull when the feature is on
            tasks.add(task)
            task.add_done_callback(tasks.discard)
            task = asyncio.create_task(self._automations_start(call, "connect"))  # CR-017: subscribe + full pull when the feature is on
            tasks.add(task)
            task.add_done_callback(tasks.discard)

            # periodic registry refresh inside the session: the safety net under the registry events
            async def refresher() -> None:
                while not stop_evt.is_set():
                    await asyncio.sleep(REGISTRY_REFRESH_S)
                    await self._refresh_and_notify(call, "periodic")
                    await self._schedules_pull("periodic")  # CR-014: the third refresh layer (§6.2)
                    await self._automations_pull("periodic")  # CR-017: the full pull of every 10 minutes (§12)

            refresher_task = asyncio.create_task(refresher(), name="ha-registry-refresher")

        try:
            await ha_client.ws_session(settings, on_ready, on_event, stop_evt, on_message=on_message)
        finally:
            self._session_loop = self._session_call = None
            self._sched_sub_id = None
            if debouncer is not None:
                debouncer.cancel()
            for task in list(tasks):
                task.cancel()
            # the refresher belongs to this session: without this every reconnect leaked one more task that kept
            # calling the closed socket ("registry refresh failed: ConnectionClosedOK" every 10 minutes, F13)
            if refresher_task is not None:
                refresher_task.cancel()

    async def _refresh_and_notify(self, call, reason: str, *, notify: bool = True, force_notice: bool = False) -> bool | None:
        """One registry refresh at a time; a `structure_changed` notice when it moved anything a screen shows (or when
        `force_notice`: an entity's state was removed). Returns changed, or None when the refresh wrote nothing
        (a listing failed, or the call itself raised - logged, the mirror kept)."""
        if self._refresh_lock is None:
            self._refresh_lock = asyncio.Lock()
        async with self._refresh_lock:
            started = time.monotonic()
            try:
                changed = await self._refresh_registry(call)
            except Exception as exc:  # noqa: BLE001 - a dropped socket; the session's own loop reconnects
                log.warning("registry refresh (%s) failed: %s", reason, type(exc).__name__)
                STATE.last_registry_error = type(exc).__name__
                return None
            if changed is None:
                return None
            self._last_done = (time.monotonic(), changed)
            log.info("registry refresh (%s) in %.0f ms: %s", reason, (time.monotonic() - started) * 1000, "changed" if changed else "no change")
            if changed:
                STATE.last_structure_at = STATE.last_registry_at
            if notify and (changed or force_notice):
                publish({"type": "structure_changed", "reason": reason, "changed": changed, "last_registry_at": STATE.last_registry_at})
            return changed

    # ------------------------------------------------------------------ CR-014: the scheduler component (read-only WS calls)

    def ws_call(self, msg_type: str, timeout: float = 10.0, **kw: Any) -> dict[str, Any]:
        """Run one WebSocket command on the live session from a request thread (the refresh_now pattern) and return HA's
        reply (`{"success": bool, "result" | "error": ...}`). 503 `ha_unavailable` while HA is not connected; an answer
        that does not come within `timeout` is 503 `scheduler_unavailable` (the call is cancelled, never retried)."""
        loop, call = self._session_loop, self._session_call
        if not STATE.connected or loop is None or call is None:
            raise ApiError(503, "ha_unavailable", "תשתית המערכת אינה זמינה כרגע.", retryable=True)
        fut = asyncio.run_coroutine_threadsafe(call(msg_type, **kw), loop)
        try:
            return fut.result(timeout=timeout)
        except concurrent.futures.TimeoutError:
            fut.cancel()
            raise ApiError(503, "scheduler_unavailable", "התזמונים אינם זמינים כרגע.", retryable=True) from None
        except (concurrent.futures.CancelledError, asyncio.CancelledError):
            raise ApiError(503, "ha_unavailable", "החיבור לתשתית המערכת נותק.", retryable=True) from None

    async def _schedules_start(self, call, reason: str) -> None:
        """When the feature is on: subscribe to `scheduler_updated` (a refusal is logged - the state and periodic layers
        remain) and do the full pull."""
        from . import schedules as schedules_svc

        if self.db is None or not schedules_svc.MIRROR.feature_on(self.db):
            return
        try:
            reply = await call("scheduler_updated")
            if isinstance(reply, dict) and reply.get("success"):
                self._sched_sub_id = reply.get("id")
            else:
                log.info("the scheduler component did not accept the scheduler_updated subscription (%s)", ((reply or {}).get("error") or {}).get("code"))
        except Exception as exc:  # noqa: BLE001
            log.warning("scheduler_updated subscription failed: %s", type(exc).__name__)
        await self._schedules_pull(reason)

    async def _schedules_pull(self, reason: str) -> None:
        from . import schedules as schedules_svc

        if self.db is None or not schedules_svc.MIRROR.feature_on(self.db):
            return
        try:
            await asyncio.get_event_loop().run_in_executor(None, schedules_svc.MIRROR.pull, None, reason)
        except Exception as exc:  # noqa: BLE001 - a failed pull keeps the cache (services/schedules.py records why)
            log.warning("schedules pull (%s) failed: %s", reason, type(exc).__name__)

    def schedules_switched_on(self) -> None:
        """The feature was just switched on in the settings: subscribe and pull on the live session (thread-safe)."""
        loop, call = self._session_loop, self._session_call
        if loop is None or call is None or not STATE.connected:
            return
        asyncio.run_coroutine_threadsafe(self._schedules_start(call, "enabled"), loop)

    # ------------------------------------------------------------------ CR-017: automations, scripts, scenes (reads + events only)

    async def _automations_start(self, call, reason: str) -> None:
        """When the feature is on: subscribe to the reload / run events (a refusal is logged - the state and periodic layers remain) and do the full pull."""
        from . import automations as automations_svc

        if self.db is None or not automations_svc.MIRROR.feature_on(self.db):
            return
        for et in AUTOMATION_EVENTS:
            try:
                reply = await call("subscribe_events", event_type=et)
                if not (isinstance(reply, dict) and reply.get("success")):
                    log.info("HA did not accept the %s subscription", et)
            except Exception as exc:  # noqa: BLE001
                log.warning("%s subscription failed: %s", et, type(exc).__name__)
        await self._automations_pull(reason)

    async def _automations_pull(self, reason: str) -> None:
        from . import automations as automations_svc

        if self.db is None or not automations_svc.MIRROR.feature_on(self.db):
            return
        try:
            await asyncio.get_event_loop().run_in_executor(None, automations_svc.MIRROR.pull, None, reason)
        except Exception as exc:  # noqa: BLE001 - a failed pull keeps the cache (services/automations.py records why)
            log.warning("automations pull (%s) failed: %s", reason, type(exc).__name__)

    def automations_switched_on(self) -> None:
        """The feature was just switched on in the settings: subscribe and pull on the live session (thread-safe)."""
        loop, call = self._session_loop, self._session_call
        if loop is None or call is None or not STATE.connected:
            return
        asyncio.run_coroutine_threadsafe(self._automations_start(call, "enabled"), loop)

    def refresh_now(self) -> dict[str, Any]:
        """Force a registry refresh from a request thread (the "רענן מ-Home Assistant" button): runs on the live
        session's loop, waits for it, and says whether anything changed. 503 while HA is not connected."""
        loop, call = self._session_loop, self._session_call
        if not STATE.connected or loop is None or call is None:
            raise ApiError(503, "ha_unavailable", "אין כרגע חיבור לתשתית המערכת; המבנה יתעדכן מעצמו כשהחיבור יחזור.", retryable=True)
        done = self._last_done
        if done is not None and time.monotonic() - done[0] < MANUAL_COALESCE_S:
            # a refresh finished a moment ago (another user's button, a registry event): its answer is this one's
            return {"changed": done[1], "last_registry_at": STATE.last_registry_at, "coalesced": True}
        fut = asyncio.run_coroutine_threadsafe(self._refresh_and_notify(call, "manual"), loop)
        try:
            changed = fut.result(timeout=MANUAL_REFRESH_TIMEOUT_S)
        except concurrent.futures.TimeoutError:
            # NOT cancelled: the refresh keeps the lock until its mirror write is done, so no other refresh can write
            # beside it (a cancelled one released the lock while its executor write went on)
            raise ApiError(504, "ha_timeout", "תשתית המערכת לא ענתה בזמן; הרענון ממשיך ברקע - נסו שוב בעוד רגע.", retryable=True) from None
        except concurrent.futures.CancelledError:
            # the HA socket dropped mid-refresh (the session cancels its pending calls): nothing was written
            raise ApiError(503, "ha_unavailable", "החיבור לתשתית המערכת נותק במהלך הרענון; המבנה יתעדכן מעצמו כשהחיבור יחזור.", retryable=True) from None
        if changed is None:
            raise ApiError(502, "ha_registry_incomplete", "תשתית המערכת לא החזירה את הרישום המלא; המבנה הקודם נשמר. נסו שוב בעוד רגע.", retryable=True,
                           details={"failed": STATE.last_registry_error})
        return {"changed": changed, "last_registry_at": STATE.last_registry_at}

    async def _refresh_registry(self, call) -> bool | None:
        """Fetch the four registries and rewrite the mirror. Returns whether the mirror changed, or None when the entity
        or device listing failed - then NOTHING is written: an empty device list would move every entity whose area
        comes from its device to "ללא שיוך", an empty entity list would tombstone entities and mark every switch protection
        as gone (CR-019)."""
        assert self.db
        ents = _listing(await call("config/entity_registry/list"))
        devs = _listing(await call("config/device_registry/list"))
        if ents is None or devs is None:
            STATE.last_registry_error = "entity_registry" if ents is None else "device_registry"
            log.warning("%s listing failed; keeping the previous mirror", STATE.last_registry_error)
            return None
        areas_listing = _listing(await call("config/area_registry/list"))
        try:
            floors_listing = _listing(await call("config/floor_registry/list"))
        except Exception as exc:  # noqa: BLE001 - an HA without floors (old core) or a dropped call: keep what we have
            log.warning("floor registry unavailable: %s", type(exc).__name__)
            floors_listing = None
        if areas_listing is None:
            log.warning("area registry listing failed; keeping the previous area mirror")
        if floors_listing is None:
            log.warning("floor registry listing failed; keeping the previous floor mirror")
        db = self.db
        loop = asyncio.get_event_loop()
        result: dict[str, Any] = {}

        def _apply() -> None:
            with self.mirror_lock:
                _apply_locked()

        def _apply_locked() -> None:
            with db.connection(mode="read") as conn:
                if not ents and conn.execute("SELECT 1 FROM ha_entities WHERE registry_id IS NOT NULL AND removed_at IS NULL LIMIT 1").fetchone():
                    # an empty entity registry while the mirror knows registry entities is a bad answer, not a wipe
                    result["incomplete"] = True
                    return
                before = mirror_fingerprint(conn)
                # a listing that failed resolves names from the mirror it keeps, not from nothing (an entity's area
                # name and floor would otherwise be blanked until the next refresh)
                areas = areas_listing if areas_listing is not None else [dict(r) for r in conn.execute("SELECT area_id, name, floor_id, icon FROM ha_areas")]
                floors = floors_listing if floors_listing is not None else [dict(r) for r in conn.execute("SELECT floor_id, name, level, icon FROM ha_floors")]
            maps = ha_client.registry_maps(ents, devs, areas, floors)
            items = [(k, v) for k, v in maps.items() if k.split(".", 1)[0] not in STATE_DOMAINS_SKIP]
            for chunk in _chunks(items):
                def _write(chunk=chunk) -> None:
                    with db.connection(durable=False) as conn:
                        apply_registry(conn, dict(chunk))
                _busy_retry(_write)

            def _structure() -> None:
                with db.connection(durable=False) as conn:
                    apply_structure(conn, areas_listing, floors_listing)
            _busy_retry(_structure)

            def _tombstone() -> None:
                with db.connection(durable=False) as conn:
                    # an entity that had a registry entry and no longer has one is gone, however recent its last state
                    # (HA deleted it, or renamed its id); one HA never registered stays while it keeps reporting states
                    present = set(maps) | {r["entity_id"] for r in conn.execute("SELECT entity_id FROM ha_entities WHERE state_seen_at >= ? AND registry_id IS NULL", (STATE.last_snapshot_at or "",)).fetchall()}
                    if STATE.last_snapshot_at:
                        tombstone_missing(conn, present)
                    STATE.entities = count_entities(conn)
            _busy_retry(_tombstone)

            def _protection() -> None:
                from . import switch_protection  # CR-019: rename follow, gone / purge, classify every switch seen for the first time

                with db.connection(label="switch_protection.reconcile") as conn:  # durable: safety state and its audit rows
                    switch_protection.reconcile(conn, set(maps), devices=devs)
            try:
                _busy_retry(_protection)
            except Exception:  # noqa: BLE001 - never costs the refresh; an unjudged switch stays out of group actions (fail-safe)
                log.exception("switch protection reconcile failed")

            def _media() -> None:
                from . import media_store  # CR-015: the device mirror and the media device model follow every registry refresh

                with db.connection(durable=False) as conn:
                    media_store.apply_devices(conn, devs)
                    result["media_changed"] = media_store.rebuild(conn)
            try:
                _busy_retry(_media)
            except Exception:  # noqa: BLE001 - a media-model failure never costs the registry refresh itself
                log.exception("media device model rebuild failed")
            if result.get("media_changed"):
                publish({"type": "media_devices_changed", "reason": "registry"})
            with db.connection(mode="read") as conn:
                result["changed"] = mirror_fingerprint(conn) != before

        write = loop.run_in_executor(None, _apply)
        try:
            await asyncio.shield(write)
        except asyncio.CancelledError:
            # cancelled (the session ended) while the executor still writes: hold the refresh lock until the write is
            # done - releasing it now would let the next refresh write beside this one
            while not write.done():
                try:
                    await asyncio.wait({write})
                except asyncio.CancelledError:
                    continue
            raise
        if result.get("incomplete"):
            STATE.last_registry_error = "entity_registry"
            log.warning("entity registry listing came back empty; keeping the previous mirror")
            return None
        STATE.last_registry_at = now_iso()
        STATE.last_registry_error = None
        return bool(result.get("changed"))


SYNC = HaSync()
