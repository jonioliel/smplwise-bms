"""Home Assistant catalogue + state sync (MASTER_SPEC ch. 14/15, T023/T024).

A background thread keeps one WebSocket session to HA Core: registries (entities, devices, areas,
floors) and a full state snapshot at connect, then `state_changed` subscription. Rows carry occurred
(HA `last_changed`/`last_updated`) and received (`state_seen_at`) times; while disconnected the API
reports `fresh: false` and nothing is invented. Attributes are trimmed to an allow-list."""
from __future__ import annotations

import asyncio
import json
import logging
import queue
import sqlite3
import threading
import time
from typing import Any

from ..config import Settings
from ..db import Database, now_iso
from ..errors import ApiError
from . import ha_client

log = logging.getLogger("smplwise.ha")

REGISTRY_REFRESH_S = 600
ATTR_ALLOW = {
    "friendly_name", "unit_of_measurement", "device_class", "state_class", "icon", "supported_features", "brightness", "color_mode",
    "current_position", "current_tilt_position", "temperature", "current_temperature", "target_temp_high", "target_temp_low", "hvac_modes",
    "hvac_action", "fan_mode", "preset_mode", "percentage", "battery_level", "battery", "occupancy", "motion", "contact", "door", "window",
    "locked", "code_format", "options", "min", "max", "step", "mode", "media_title", "volume_level", "is_volume_muted", "source", "last_triggered",
    "restored", "assumed_state", "entity_picture_local", "editable", "power", "voltage", "current", "energy",
}
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

    def as_dict(self) -> dict[str, Any]:
        return {k: getattr(self, k) for k in ("connected", "last_snapshot_at", "last_event_at", "last_registry_at", "last_error", "reconnects", "sequence", "entities", "started_at", "ha_version")}


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


def trim_attributes(attrs: dict[str, Any]) -> str:
    kept = {k: v for k, v in (attrs or {}).items() if k in ATTR_ALLOW}
    text = json.dumps(kept, ensure_ascii=False, default=str)
    if len(text) > 4000:
        kept = {k: kept[k] for k in list(kept)[:10]}
        text = json.dumps(kept, ensure_ascii=False, default=str)[:4000]
    return text


def upsert_state(conn: sqlite3.Connection, st: dict[str, Any], seen: str | None = None) -> dict[str, Any]:
    """Insert or update one HA state object. Returns the stored row as a dict."""
    seen = seen or now_iso()
    eid = st["entity_id"]
    domain = eid.split(".", 1)[0]
    attrs = st.get("attributes") or {}
    state = st.get("state")
    available = 0 if state in ("unavailable", None) else 1
    row = conn.execute("SELECT entity_id FROM ha_entities WHERE entity_id = ?", (eid,)).fetchone()
    common = (
        attrs.get("friendly_name") or "",
        domain,
        attrs.get("device_class"),
        attrs.get("unit_of_measurement"),
        attrs.get("icon"),
        int(attrs.get("supported_features") or 0),
        state,
        trim_attributes(attrs),
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
        n += 1
    return n


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
    for i in range(attempts):
        try:
            return fn()
        except sqlite3.OperationalError as exc:
            if "locked" not in str(exc).lower() or i == attempts - 1:
                raise
            log.warning("HA sync: database busy, retrying in %.0fs", wait_s)
            time.sleep(wait_s)
    return None


def count_entities(conn: sqlite3.Connection) -> int:
    return conn.execute("SELECT COUNT(*) FROM ha_entities WHERE removed_at IS NULL AND disabled = 0").fetchone()[0]


def store_states(db: Database, states: list[dict[str, Any]], seen: str) -> set[str]:
    present: set[str] = set()
    rows = [st for st in states if st["entity_id"].split(".", 1)[0] not in STATE_DOMAINS_SKIP]
    for chunk in _chunks(rows):
        def _write(chunk=chunk) -> None:
            with db.connection() as conn:
                for st in chunk:
                    upsert_state(conn, st, seen)
        _busy_retry(_write)
        present.update(st["entity_id"] for st in chunk)
    with db.connection() as conn:
        STATE.entities = count_entities(conn)
    return present


def snapshot(db: Database, settings: Settings) -> int:
    """REST snapshot (also usable without the WebSocket, e.g. in tests)."""
    states = ha_client.get_states(settings)
    seen = now_iso()
    store_states(db, states, seen)
    STATE.last_snapshot_at = seen
    return len(states)


class HaSync:
    def __init__(self) -> None:
        self.thread: threading.Thread | None = None
        self.stop = threading.Event()
        self.db: Database | None = None
        self.settings: Settings | None = None

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

        def on_event(data: dict[str, Any]) -> None:
            new = data.get("new_state")
            eid = data.get("entity_id", "")
            if not new or eid.split(".", 1)[0] in STATE_DOMAINS_SKIP:
                return
            try:
                with db.connection() as conn:
                    row = upsert_state(conn, new)
                    # T053: door / motion / lock transitions are kept as events for the correlation timeline
                    from .correlation import record_transition

                    record_transition(conn, data.get("old_state"), new)
            except Exception:
                log.exception("state update failed for %s", eid)
                return
            STATE.sequence += 1
            STATE.last_event_at = now_iso()
            publish({"type": "entity_state_changed", "sequence": STATE.sequence, "entity": row})

        async def on_ready(call) -> None:
            cfg = await call("get_config")
            STATE.ha_version = (cfg.get("result") or {}).get("version")
            await self._refresh_registry(call)
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
            # periodic registry refresh inside the session
            async def refresher() -> None:
                while not stop_evt.is_set():
                    await asyncio.sleep(REGISTRY_REFRESH_S)
                    try:
                        await self._refresh_registry(call)
                    except Exception as exc:
                        log.warning("registry refresh failed: %s", type(exc).__name__)

            asyncio.create_task(refresher())

        await ha_client.ws_session(settings, on_ready, on_event, stop_evt)

    async def _refresh_registry(self, call) -> None:
        assert self.db
        ents = (await call("config/entity_registry/list")).get("result") or []
        devs = (await call("config/device_registry/list")).get("result") or []
        areas = (await call("config/area_registry/list")).get("result") or []
        try:
            floors = (await call("config/floor_registry/list")).get("result") or []
        except Exception:
            floors = []
        maps = ha_client.registry_maps(ents, devs, areas, floors)
        db = self.db
        loop = asyncio.get_event_loop()

        def _apply() -> None:
            items = [(k, v) for k, v in maps.items() if k.split(".", 1)[0] not in STATE_DOMAINS_SKIP]
            for chunk in _chunks(items):
                def _write(chunk=chunk) -> None:
                    with db.connection() as conn:
                        apply_registry(conn, dict(chunk))
                _busy_retry(_write)

            def _tombstone() -> None:
                with db.connection() as conn:
                    present = set(maps) | {r["entity_id"] for r in conn.execute("SELECT entity_id FROM ha_entities WHERE state_seen_at >= ?", (STATE.last_snapshot_at or "",)).fetchall()}
                    if STATE.last_snapshot_at:
                        tombstone_missing(conn, present)
                    STATE.entities = count_entities(conn)
            _busy_retry(_tombstone)

        await loop.run_in_executor(None, _apply)
        STATE.last_registry_at = now_iso()


SYNC = HaSync()
