"""Live event ingestion from the NVR's alert stream (MASTER_SPEC ch. 26, T031).

`GET /ISAPI/Event/notification/alertStream` is a long-lived multipart response: one `<EventNotificationAlert>`
document per event, plus a `videoloss/inactive` heartbeat every ~10 s. This module

- parses the stream robustly (documents split on their closing tag, unknown types kept as `other`),
- keeps the heartbeat as a health signal only (never stored as an event),
- normalizes device types to product types, maps `channelID` to the camera row, converts the device
  time (ISO with offset) to UTC and keeps the raw string,
- de-duplicates bursts: an `active` event opens a row (dedup key camera+type+minute bucket), repeats
  within DEDUP_WINDOW_S increase `count`, `inactive` closes it,
- records a `coverage_gap` event when the connection was lost for longer than GAP_AFTER_S,
- reconnects with back-off and exposes its state for /health,
- pushes stored events to WebSocket subscribers through a thread-safe queue.

Everything here is read-only against the device. Historical events are never fabricated from the
live stream; the recording-derived motion events live in `events_derive.py` with confidence "inferred".
"""
from __future__ import annotations

import datetime as dt
import json
import logging
import queue
import re
import sqlite3
import threading
import time
import uuid
import xml.etree.ElementTree as ET
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Callable

import httpx

from ..config import Settings
from ..db import Database, now_iso, retry_locked
from ..recorder_scope import PRIMARY
from .timeutil import UTC, iso_utc, nvr_wall_to_utc, zone
from . import xmlsafe

log = logging.getLogger("smplwise.events")

DEDUP_WINDOW_S = 30
GAP_AFTER_S = 45
HEARTBEAT_TIMEOUT_S = 90

# device eventType (lower-case) → normalized type, severity
TYPE_MAP: dict[str, tuple[str, str]] = {
    "vmd": ("motion", "info"),
    "motiondetection": ("motion", "info"),
    "linedetection": ("line", "alert"),
    "fielddetection": ("field", "alert"),
    "regionentrance": ("field", "alert"),
    "regionexiting": ("field", "alert"),
    "intrusion": ("field", "alert"),
    "videoloss": ("offline", "critical"),
    "videolost": ("offline", "critical"),
    "ipcdisconnect": ("offline", "critical"),
    "shelteralarm": ("tamper", "alert"),
    "tamperdetection": ("tamper", "alert"),
    "facedetection": ("person", "info"),
    "humandetect": ("person", "info"),
    "vehicledetection": ("vehicle", "info"),
    "io": ("io", "alert"),
    "diskfull": ("storage", "critical"),
    "diskerror": ("storage", "critical"),
    "nicbroken": ("system", "critical"),
    "ipconflict": ("system", "critical"),
    "illaccess": ("system", "alert"),
}


@dataclass
class ParsedAlert:
    raw_type: str
    state: str  # active | inactive
    channel: int | None
    dyn_channel: int | None
    device_time: str
    description: str
    target: str  # human | vehicle | ''
    active_post_count: int
    raw_tags: dict[str, str] = field(default_factory=dict)

    @property
    def is_heartbeat(self) -> bool:
        return self.raw_type.lower() in ("videoloss", "videolost") and self.state == "inactive"


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def parse_alert(xml: str) -> ParsedAlert | None:
    try:
        root = xmlsafe.parse(xml)
    except ET.ParseError:
        return None
    tags: dict[str, str] = {}
    for el in root.iter():
        name = _local(el.tag)
        if el.text and el.text.strip() and name not in tags:
            tags[name] = el.text.strip()
    if not tags.get("eventType"):
        return None
    ch = tags.get("channelID") or ""
    dyn = tags.get("dynChannelID") or ""
    return ParsedAlert(
        raw_type=tags.get("eventType", ""),
        state=(tags.get("eventState") or "active").lower(),
        channel=int(ch) if ch.isdigit() else None,
        dyn_channel=int(dyn) if dyn.isdigit() else None,
        device_time=tags.get("dateTime", ""),
        description=tags.get("eventDescription", ""),
        target=(tags.get("detectionTarget") or tags.get("targetType") or "").lower(),
        active_post_count=int(tags["activePostCount"]) if tags.get("activePostCount", "").isdigit() else 0,
        raw_tags={k: v for k, v in tags.items() if k not in ("ipAddress", "macAddress")},  # never keep addresses
    )


def normalize_type(alert: ParsedAlert) -> tuple[str, str]:
    """(type, severity). `detectionTarget` refines smart events only when the device provided it."""
    base, severity = TYPE_MAP.get(alert.raw_type.lower(), ("other", "info"))
    if alert.target == "human" and base in ("motion", "line", "field", "other"):
        return "person", severity
    if alert.target == "vehicle" and base in ("motion", "line", "field", "other"):
        return "vehicle", severity
    return base, severity


def device_time_to_utc(value: str, tz_name: str, now: dt.datetime | None = None) -> tuple[dt.datetime, str]:
    """The stream's dateTime carries an offset ('2026-09-15T20:49:02+03:00'). Trust it when it lands within an
    hour of now; otherwise fall back to the wall-clock interpretation (KNOWN_QUIRKS T1). Returns (utc, precision)."""
    now = now or dt.datetime.now(UTC)
    v = value.strip()
    try:
        parsed = dt.datetime.fromisoformat(v.replace("Z", "+00:00"))
    except ValueError:
        return now, "received"
    if parsed.tzinfo is not None:
        utc = parsed.astimezone(UTC)
        # live alerts arrive within seconds; an hour-sized error is the standard-vs-DST offset quirk (T1)
        if abs((utc - now).total_seconds()) <= 900:
            return utc, "device_offset"
    wall = nvr_wall_to_utc(parsed.replace(tzinfo=None).isoformat(), zone(tz_name))
    return wall, "wall_clock"


class IngestState:
    def __init__(self) -> None:
        self.connected = False
        self.last_heartbeat_at: str | None = None
        self.last_event_at: str | None = None
        self.last_error: str | None = None
        self.reconnects = 0
        self.events_stored = 0
        self.started_at: str | None = None
        self.disconnected_since: float | None = None
        self.ws_drops = 0  # pushes a slow event socket missed (its queue was full)
        self.queue: "IngestQueue | None" = None  # CR-024: a further recorder's listener has its own queue (None = QUEUE)

    def as_dict(self) -> dict[str, Any]:
        return {
            "connected": self.connected,
            "last_heartbeat_at": self.last_heartbeat_at,
            "last_event_at": self.last_event_at,
            "last_error": self.last_error,
            "reconnects": self.reconnects,
            "events_stored": self.events_stored,
            "started_at": self.started_at,
            "queue": (self.queue or QUEUE).stats(),
            "ws_drops": self.ws_drops,
        }


# ---------------------------------------------------------------- backpressure (T068)

MAX_PENDING = 256  # alerts waiting for the database; ~8 channels x ~16 kinds x 2 states, far above a healthy backlog of 0-1
DRAIN_S = 5.0  # at shutdown the writer stores what is still queued for at most this long


def _device_instant(alert: ParsedAlert) -> dt.datetime | None:
    try:
        t = dt.datetime.fromisoformat(alert.device_time.strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    return t if t.tzinfo is not None else None


class _Pending:
    __slots__ = ("first", "alert", "key", "merged", "taken")

    def __init__(self, alert: ParsedAlert, key: tuple[Any, ...]) -> None:
        self.first = alert  # the burst's first alert: its time is where a new row starts
        self.alert = alert  # the newest alert folded in (its time ends the burst)
        self.key = key
        self.merged = 0  # later same-state alerts of the same camera / kind folded into this entry
        self.taken = False

    def can_absorb(self, alert: ParsedAlert) -> bool:
        """Only a continuation of the same burst: same state, and within DEDUP_WINDOW_S of both the entry's newest
        alert and its first - the span store_alert would merge anyway - so coalescing never joins two episodes
        (motion at 10:00:00 and at 10:01:40 stay two rows, as without the queue)."""
        if self.taken or self.alert.state != alert.state:
            return False
        t, first, last = _device_instant(alert), _device_instant(self.first), _device_instant(self.alert)
        if t is None or first is None or last is None:
            return False
        return abs((t - last).total_seconds()) <= DEDUP_WINDOW_S and abs((t - first).total_seconds()) <= DEDUP_WINDOW_S


class IngestQueue:
    """The bounded hand-off between the alert-stream reader and the database writer. The reader never waits for the
    database: it keeps reading the NVR's socket (a stalled reader misses heartbeats and the NVR drops the stream) and
    queues each alert here. Policy when the writer falls behind (a slow or busy database):
    - coalesce: an alert for a camera / kind whose previous alert, in the same state, is still waiting AND lies within
      DEDUP_WINDOW_S of it (the same burst) is folded into that entry: the writer stores the burst's first alert and
      then the newest one carrying the count of those in between - exactly the row(s) and count store_alert would
      have produced alert by alert;
    - drop: when MAX_PENDING distinct alerts are still waiting, the OLDEST one is dropped and counted;
    - shutdown: the writer gets DRAIN_S to store what is waiting; the rest is counted (dropped_shutdown) and logged.
    Invariant (checked by the soak): accepted == processed + failed + coalesced + dropped + depth."""

    def __init__(self, maxlen: int = MAX_PENDING) -> None:
        self.maxlen = maxlen
        self._cv = threading.Condition()
        self._items: deque[_Pending] = deque()
        self._last: dict[tuple[Any, ...], _Pending] = {}
        self.accepted = 0
        self.coalesced = 0
        self.dropped = 0
        self.dropped_repeats = 0
        self.dropped_shutdown = 0
        self.processed = 0
        self.failed = 0
        self.high_water = 0
        self._last_drop_log = 0.0

    @staticmethod
    def key_of(alert: ParsedAlert) -> tuple[Any, ...]:
        return (alert.channel, alert.dyn_channel, alert.raw_type.lower(), alert.target)

    def put(self, alert: ParsedAlert) -> str:
        key = self.key_of(alert)
        dropped: _Pending | None = None
        with self._cv:
            self.accepted += 1
            prev = self._last.get(key)
            if prev is not None and prev.can_absorb(alert):
                prev.merged += 1
                prev.alert = alert  # keep the newest
                self.coalesced += 1
                return "coalesced"
            p = _Pending(alert, key)
            self._items.append(p)
            self._last[key] = p
            if len(self._items) > self.maxlen:
                dropped = self._items.popleft()
                dropped.taken = True
                if self._last.get(dropped.key) is dropped:
                    del self._last[dropped.key]
                self.dropped += 1
                self.dropped_repeats += dropped.merged  # already counted in `coalesced`; lost with it
            self.high_water = max(self.high_water, len(self._items))
            self._cv.notify()
        if dropped is not None:
            now = time.monotonic()
            if now - self._last_drop_log > 60:
                self._last_drop_log = now
                log.warning("alert queue full (%d waiting for the database): dropping the oldest alerts; %d dropped so far", self.maxlen, self.dropped)
            return "dropped_oldest"
        return "queued"

    def get(self, timeout: float = 1.0) -> _Pending | None:
        with self._cv:
            if not self._items:
                self._cv.wait(timeout)
            if not self._items:
                return None
            p = self._items.popleft()
            p.taken = True
            if self._last.get(p.key) is p:
                del self._last[p.key]
            return p

    def discard_all(self) -> int:
        """Shutdown: whatever is still waiting after the drain deadline is dropped - counted, never silent."""
        with self._cv:
            n = len(self._items)
            for p in self._items:
                p.taken = True
                self.dropped_repeats += p.merged
            self._items.clear()
            self._last.clear()
            self.dropped += n
            self.dropped_shutdown += n
            return n

    def done(self, ok: bool) -> None:
        with self._cv:
            if ok:
                self.processed += 1
            else:
                self.failed += 1

    def depth(self) -> int:
        with self._cv:
            return len(self._items)

    def stats(self) -> dict[str, Any]:
        with self._cv:
            return {"depth": len(self._items), "max": self.maxlen, "high_water": self.high_water, "accepted": self.accepted, "processed": self.processed,
                    "failed": self.failed, "coalesced": self.coalesced, "dropped": self.dropped, "dropped_repeats": self.dropped_repeats,
                    "dropped_shutdown": self.dropped_shutdown}

    def reset(self) -> None:
        with self._cv:
            self._items.clear()
            self._last.clear()
            self.accepted = self.coalesced = self.dropped = self.dropped_repeats = self.dropped_shutdown = self.processed = self.failed = self.high_water = 0


QUEUE = IngestQueue()
STATE = IngestState()
_subscribers: list[queue.Queue] = []
_sub_lock = threading.Lock()


def subscribe() -> queue.Queue:
    q: queue.Queue = queue.Queue(maxsize=200)
    with _sub_lock:
        _subscribers.append(q)
    return q


def unsubscribe(q: queue.Queue) -> None:
    with _sub_lock:
        if q in _subscribers:
            _subscribers.remove(q)


def publish(event: dict[str, Any]) -> None:
    with _sub_lock:
        subs = list(_subscribers)
    for q in subs:
        try:
            q.put_nowait(event)
        except queue.Full:  # a slow socket loses this push (its client reloads the list); counted, never blocks ingest
            STATE.ws_drops += 1


def row_to_event(row: sqlite3.Row) -> dict[str, Any]:
    d = dict(row)
    d["details"] = json.loads(d.pop("details_json") or "{}")
    return d


def store_alert(conn: sqlite3.Connection, alert: ParsedAlert, tz_name: str, camera_lookup: Callable[[int], sqlite3.Row | None], now: dt.datetime | None = None,
                repeats: int = 0, recorder_id: str = PRIMARY) -> dict[str, Any] | None:
    """Insert / merge one parsed alert. Returns the stored (or updated) event, or None for heartbeats/noise.
    `repeats`: older alerts of the same burst that the ingest queue folded into this one (backpressure) - added to the
    row's count so a slow database never makes a burst look smaller than the device reported.
    CR-024: `recorder_id` is the recorder whose alert stream sent it - kept on the row (`events.recorder_id`), part of the merge
    of device-level events (no camera) and of the dedup key of a further recorder, so channel numbers that repeat on two
    recorders never merge two recorders' events."""
    if alert.is_heartbeat:
        return None
    now = now or dt.datetime.now(UTC)
    etype, severity = normalize_type(alert)
    cam = None
    channel = alert.channel
    if channel is not None:
        cam = camera_lookup(channel)
    if cam is None and alert.dyn_channel is not None:
        cam = camera_lookup(alert.dyn_channel)
        if cam is not None:
            channel = alert.dyn_channel
    if etype == "offline" and channel == 0:
        return None  # device-wide videoloss noise carries channel 0 (KNOWN_QUIRKS C4)
    occurred, precision = device_time_to_utc(alert.device_time, tz_name, now)
    cam_key = cam["id"] if cam else ""
    rec_sql, rec_args = _recorder_clause(conn, recorder_id)
    if alert.state == "inactive":
        # close the most recent open row of this camera/type (bursts may span buckets)
        open_row = conn.execute(
            "SELECT * FROM events WHERE source = 'alertstream' AND type = ? AND COALESCE(camera_id, '') = ?" + rec_sql + " AND state = 'active' AND occurred_at >= ? ORDER BY occurred_at DESC LIMIT 1",
            (etype, cam_key, *rec_args, iso_utc(occurred - dt.timedelta(minutes=10))),
        ).fetchone()
        if open_row is None:
            return None  # an inactive without a known active: nothing to show
        conn.execute("UPDATE events SET state = 'inactive', ended_at = ? WHERE id = ?", (iso_utc(occurred), open_row["id"]))
        return row_to_event(conn.execute("SELECT * FROM events WHERE id = ?", (open_row["id"],)).fetchone())
    # active: merge into a row that is still open and was last seen within the window
    prev = conn.execute(
        "SELECT * FROM events WHERE source = 'alertstream' AND type = ? AND COALESCE(camera_id, '') = ?" + rec_sql + " AND state = 'active' AND COALESCE(ended_at, occurred_at) >= ? ORDER BY occurred_at DESC LIMIT 1",
        (etype, cam_key, *rec_args, iso_utc(occurred - dt.timedelta(seconds=DEDUP_WINDOW_S))),
    ).fetchone()
    if prev is not None:
        conn.execute("UPDATE events SET count = count + 1 + ?, ended_at = ? WHERE id = ?", (max(0, repeats), iso_utc(occurred), prev["id"]))
        return row_to_event(conn.execute("SELECT * FROM events WHERE id = ?", (prev["id"],)).fetchone())
    key = f"as:{cam_key or f'ch{channel}'}:{etype}:{iso_utc(occurred)}"
    if recorder_id != PRIMARY and not cam_key:
        key = f"as:{recorder_id}:ch{channel}:{etype}:{iso_utc(occurred)}"  # a camera id is unique already; a device event is not
    if conn.execute("SELECT 1 FROM events WHERE dedup_key = ?", (key,)).fetchone():
        return None
    details = {"description": alert.description, "device_time": alert.device_time, "time_precision": precision, "target": alert.target or None, "active_post_count": alert.active_post_count}
    if repeats > 0:
        details["coalesced"] = repeats  # the row starts at the newest of them (the older times were not kept)
    eid = uuid.uuid4().hex[:12]
    conn.execute(
        "INSERT INTO events(id, source, raw_type, type, camera_id, channel, occurred_at, ended_at, received_at, state, count, severity, confidence, details_json, dedup_key, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (eid, "alertstream", alert.raw_type, etype, cam["id"] if cam else None, channel, iso_utc(occurred), None, iso_utc(now), "active", 1 + max(0, repeats), severity, "measured", json.dumps(details, ensure_ascii=False), key, now_iso()),
    )
    _set_recorder(conn, eid, recorder_id)
    return row_to_event(conn.execute("SELECT * FROM events WHERE id = ?", (eid,)).fetchone())


def _has_recorder_column(conn: sqlite3.Connection) -> bool:
    return any(r[1] == "recorder_id" for r in conn.execute("PRAGMA table_info(events)").fetchall())


def _recorder_clause(conn: sqlite3.Connection, recorder_id: str) -> tuple[str, tuple[Any, ...]]:
    """CR-024: the merge of an alert stays inside its recorder (a row from before 0055 without a recorder is the first one's)."""
    if not _has_recorder_column(conn):
        return "", ()
    return " AND COALESCE(recorder_id, ?) = ?", (PRIMARY, recorder_id)


def _set_recorder(conn: sqlite3.Connection, event_id: str, recorder_id: str) -> None:
    if _has_recorder_column(conn):
        conn.execute("UPDATE events SET recorder_id = ? WHERE id = ?", (recorder_id, event_id))


def record_gap(conn: sqlite3.Connection, started: dt.datetime, ended: dt.datetime, reason: str, recorder_id: str = PRIMARY) -> dict[str, Any]:
    eid = uuid.uuid4().hex[:12]
    key = f"gap:{iso_utc(started)}" if recorder_id == PRIMARY else f"gap:{recorder_id}:{iso_utc(started)}"
    conn.execute(
        "INSERT OR IGNORE INTO events(id, source, raw_type, type, camera_id, channel, occurred_at, ended_at, received_at, state, count, severity, confidence, details_json, dedup_key, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (eid, "system", "alertstream_disconnected", "coverage_gap", None, None, iso_utc(started), iso_utc(ended), now_iso(), "none", 1, "alert", "measured", json.dumps({"reason": reason, "seconds": int((ended - started).total_seconds())}), key, now_iso()),
    )
    row = conn.execute("SELECT id FROM events WHERE dedup_key = ?", (key,)).fetchone()
    if row is not None and row["id"] == eid:
        _set_recorder(conn, eid, recorder_id)
    return row_to_event(conn.execute("SELECT * FROM events WHERE dedup_key = ?", (key,)).fetchone())


class AlertStreamListener:
    """Two background threads: the reader (connect → read documents → queue; back-off on failure) and the writer
    (queue → store → publish). The bounded QUEUE between them is the backpressure: a slow database never stalls the
    NVR socket and never grows memory without bound (T068)."""

    def __init__(self, recorder_id: str = PRIMARY, state: "IngestState | None" = None, ingest_queue: "IngestQueue | None" = None) -> None:
        self.thread: threading.Thread | None = None
        self.writer: threading.Thread | None = None
        self.stop = threading.Event()
        self.db: Database | None = None
        self.settings: Settings | None = None
        self.tz_getter: Callable[[], str] = lambda: "Asia/Jerusalem"
        self.generation = 0  # a writer from an earlier start() ends itself when this moves on
        # CR-024: one listener per recorder; the first recorder's uses the module STATE / QUEUE (the shape /health reads)
        self.recorder_id = recorder_id
        self.state = state if state is not None else STATE
        self.queue = ingest_queue if ingest_queue is not None else QUEUE
        if self.queue is not QUEUE:
            self.state.queue = self.queue

    def start(self, db: Database, settings: Settings, tz_getter: Callable[[], str]) -> None:
        """`settings`: THIS recorder's effective settings (recorder_scope.settings_for)."""
        self.db, self.settings, self.tz_getter = db, settings, tz_getter
        STATE_ = self.state
        if not (settings.nvr_host and settings.nvr_user and settings.nvr_password):
            STATE_.last_error = "nvr_not_configured"
            return
        self.stop.clear()
        self.generation += 1
        STATE_.started_at = now_iso()
        self.writer = threading.Thread(target=self._drain, args=(self.generation,), name="alertstream-writer", daemon=True)
        self.writer.start()
        self.thread = threading.Thread(target=self._loop, name="alertstream", daemon=True)
        self.thread.start()

    def shutdown(self) -> None:
        """Stop reading; the writer stores what is queued (at most DRAIN_S) and counts the rest (restart, update)."""
        self.stop.set()
        self.generation += 1
        w = self.writer
        if w is not None and w.is_alive() and w is not threading.current_thread():
            w.join(timeout=DRAIN_S + 1)

    def submit(self, alert: ParsedAlert) -> str:
        """The reader's side: a heartbeat is noted at once, anything else waits in the bounded queue for the writer."""
        if alert.is_heartbeat:
            self.state.last_heartbeat_at = now_iso()
            return "heartbeat"
        return self.queue.put(alert)

    def _store_pending(self, p: _Pending) -> None:
        try:
            if p.merged:
                self._handle(p.first)  # the burst starts where the device said it did
                self._handle(p.alert, repeats=p.merged - 1)  # the newest closes the span and carries the ones between
            else:
                self._handle(p.alert)
            self.queue.done(True)
        except Exception:  # noqa: BLE001 - one bad alert (or a database busy past the retries) must not stop the writer
            self.queue.done(False)
            log.exception("alert handling failed")

    def _drain(self, generation: int) -> None:
        while not self.stop.is_set() and generation == self.generation:
            p = self.queue.get(timeout=1.0)
            if p is not None:
                self._store_pending(p)
        # stopping: store what is still queued, within DRAIN_S; anything left is counted and logged, never lost silently
        deadline = time.monotonic() + DRAIN_S
        while time.monotonic() < deadline:
            p = self.queue.get(timeout=0)
            if p is None:
                return
            self._store_pending(p)
        n = self.queue.discard_all()
        if n:
            log.warning("alert stream stopping: %d queued alert(s) not stored within %.0f s (counted as dropped_shutdown)", n, DRAIN_S)

    def _camera_lookup(self, conn: sqlite3.Connection) -> Callable[[int], sqlite3.Row | None]:
        cache: dict[int, sqlite3.Row | None] = {}

        def lookup(channel: int) -> sqlite3.Row | None:
            if channel not in cache:
                cache[channel] = conn.execute("SELECT * FROM cameras WHERE channel = ? AND recorder_id = ?", (channel, self.recorder_id)).fetchone()
            return cache[channel]

        return lookup

    def _handle(self, alert: ParsedAlert, repeats: int = 0) -> None:
        assert self.db
        if alert.is_heartbeat:
            self.state.last_heartbeat_at = now_iso()
            return
        # the zone is read BEFORE the write connection opens: the getter opens its own connection, and doing that
        # while this thread held the write lock blocked every writer for busy_timeout on every alert (0.1.58)
        tz = self.tz_getter()
        from . import rules as rules_svc  # local import: rules depend on correlation which depends on this module

        db = self.db
        fired: list[dict[str, Any]] = []

        def _write() -> dict[str, Any] | None:
            fired.clear()
            with db.connection() as conn:  # FULL: the NVR never sends an alert again (db.py, durability classes)
                stored = store_alert(conn, alert, tz, self._camera_lookup(conn), repeats=repeats, recorder_id=self.recorder_id)
                if stored:
                    try:
                        # the HA notifications go out after the commit (deliver_pending), never under the write lock
                        fired.extend(rules_svc.evaluate_event(conn, stored, tz, deliver=False))
                    except Exception:  # noqa: BLE001 - a rule must never break ingestion
                        log.exception("rule evaluation failed for %s", stored.get("id"))
                return stored

        stored = retry_locked(_write, what="alert stream")  # a busy database delays an alert, it does not drop it
        rules_svc.deliver_pending(fired)
        if stored:
            self.state.last_event_at = stored["occurred_at"]
            self.state.events_stored += 1
            publish(stored)

    def _loop(self) -> None:
        assert self.settings and self.db
        s = self.settings
        from .recorders import vendor_io

        if vendor_io.handles(s):  # CR-025: a Provision-ISR recorder polls / receives pushes instead of the ISAPI stream
            from .recorders.provision_events import run_loop

            run_loop(self)
            return
        backoff = 5.0
        url = f"http://{s.nvr_host}:{s.nvr_http_port}/ISAPI/Event/notification/alertStream"
        while not self.stop.is_set():
            try:
                with httpx.Client(auth=httpx.DigestAuth(s.nvr_user or "", s.nvr_password or ""), timeout=httpx.Timeout(connect=15, read=HEARTBEAT_TIMEOUT_S, write=15, pool=15)) as c:
                    with c.stream("GET", url, headers={"Accept": "application/xml"}) as r:
                        if r.status_code != 200:
                            self.state.last_error = f"http_{r.status_code}"
                            raise RuntimeError(f"alertStream HTTP {r.status_code}")
                        if self.state.disconnected_since is not None:
                            gap = time.time() - self.state.disconnected_since
                            if gap >= GAP_AFTER_S:
                                since, until, why = dt.datetime.fromtimestamp(self.state.disconnected_since, UTC), dt.datetime.now(UTC), self.state.last_error or "disconnected"

                                def _gap() -> dict[str, Any]:
                                    with self.db.connection() as conn:
                                        return record_gap(conn, since, until, why, recorder_id=self.recorder_id)

                                publish(retry_locked(_gap, what="alert stream gap"))
                            self.state.disconnected_since = None
                        self.state.connected = True
                        self.state.last_error = None
                        backoff = 5.0
                        log.info("alertStream connected (%s)", self.recorder_id)
                        buf = b""
                        for chunk in r.iter_bytes(4096):
                            if self.stop.is_set():
                                break
                            buf += chunk
                            while True:
                                end = buf.find(b"</EventNotificationAlert>")
                                if end < 0:
                                    break
                                start = buf.rfind(b"<EventNotificationAlert", 0, end)
                                doc = buf[start:end + len(b"</EventNotificationAlert>")].decode("utf-8", "ignore") if start >= 0 else ""
                                buf = buf[end + len(b"</EventNotificationAlert>"):]
                                alert = parse_alert(doc) if doc else None
                                if alert:
                                    self.submit(alert)  # never waits for the database (the writer thread stores it)
                            if len(buf) > 1_000_000:
                                buf = buf[-100_000:]
            except Exception as exc:
                if self.stop.is_set():
                    break
                self.state.last_error = self.state.last_error or type(exc).__name__
                log.warning("alertStream disconnected (%s): %s (retry in %.0fs)", self.recorder_id, type(exc).__name__, backoff)
            if self.state.connected:
                self.state.reconnects += 1
            self.state.connected = False
            if self.state.disconnected_since is None:
                self.state.disconnected_since = time.time()
            self.stop.wait(backoff)
            backoff = min(60.0, backoff * 2)
        self.state.connected = False


LISTENER = AlertStreamListener()
# CR-024: the alert streams of the further recorders, one listener each (own state, own queue): one recorder that is down never
# delays or drops another's alerts. Started / stopped by main.py; read by /health (`recorder_states`).
EXTRA: dict[str, AlertStreamListener] = {}


def start_extra_one(db: Database, settings: Settings, recorder_id: str, tz_getter: Callable[[], str]) -> AlertStreamListener:
    """Start the listener of one further recorder (`settings` = the process-wide settings; the recorder's own connection is
    taken from them). The first recorder is LISTENER and never started here."""
    from ..recorder_scope import settings_for

    if recorder_id == PRIMARY:
        raise ValueError("the first recorder's alert stream is LISTENER")
    listener = EXTRA.get(recorder_id)
    if listener is None:
        listener = EXTRA[recorder_id] = AlertStreamListener(recorder_id, IngestState(), IngestQueue())
    listener.start(db, settings_for(settings, recorder_id), tz_getter)
    return listener


def shutdown_extra() -> None:
    for listener in list(EXTRA.values()):
        listener.shutdown()


def recorder_states() -> dict[str, dict[str, Any]]:
    """Every recorder's alert-stream state (the first one's is STATE), no address."""
    return {PRIMARY: STATE.as_dict(), **{rid: lst.state.as_dict() for rid, lst in sorted(EXTRA.items())}}
